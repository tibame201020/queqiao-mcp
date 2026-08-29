import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import type { McpAdapterConfig, McpServerConfig } from "./config.js";
import { resolveEnvRef } from "./config.js";

export type JsonObject = Record<string, unknown>;
export type McpToolMetadata = {
  server: string;
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};
export type ServerStatus = {
  server: string;
  transport: McpServerConfig["transport"];
  enabled: boolean;
  connected: boolean;
  cachedTools: number;
};

type Session = { key: string; client: Client; tools: McpToolMetadata[] };
type PendingSession = { key: string; promise: Promise<Session> };

const keyOf = (value: McpServerConfig) => JSON.stringify(value);
const requestOptions = (value: McpServerConfig, signal?: AbortSignal) => ({
  timeout: value.timeoutMs,
  ...(signal ? { signal } : {})
});

function stdioEnv(value: Extract<McpServerConfig, { transport: "stdio" }>) {
  const env = { ...getDefaultEnvironment() };
  for (const [name, reference] of Object.entries(value.env ?? {})) {
    env[name] = resolveEnvRef(reference);
  }
  return env;
}

function headers(value: Extract<McpServerConfig, { transport: "streamable-http" }>) {
  return Object.fromEntries(
    Object.entries(value.headers ?? {}).map(([name, reference]) => [name, resolveEnvRef(reference)])
  );
}

export class McpClientManager {
  private readonly sessions = new Map<string, Session>();
  private readonly pending = new Map<string, PendingSession>();

  constructor(private readonly loadConfig: () => Promise<McpAdapterConfig>) {}

  async servers(): Promise<ServerStatus[]> {
    const config = await this.reconcile();
    return Object.entries(config.servers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([server, value]) => ({
        server,
        transport: value.transport,
        enabled: value.enabled,
        connected: this.sessions.has(server),
        cachedTools: this.sessions.get(server)?.tools.length ?? 0
      }));
  }

  async search(query: string, limit: number, signal?: AbortSignal) {
    const config = await this.reconcile();
    const needle = query.toLowerCase();
    const matches: McpToolMetadata[] = [];
    for (const [server, value] of Object.entries(config.servers)) {
      if (!value.enabled) continue;
      const session = await this.ensure(server, value, signal);
      matches.push(
        ...session.tools.filter((tool) =>
          [tool.name, tool.title, tool.description, tool.server].some((candidate) =>
            candidate?.toLowerCase().includes(needle)
          )
        )
      );
    }
    return matches.slice(0, limit);
  }

  async describe(server: string, tool: string, signal?: AbortSignal) {
    const value = await this.serverConfig(server);
    const session = await this.ensure(server, value, signal);
    const found = session.tools.find((candidate) => candidate.name === tool);
    if (!found) throw new Error(`Downstream MCP tool not found: ${server}/${tool}`);
    return found;
  }

  async call(server: string, tool: string, args: JsonObject, signal?: AbortSignal) {
    const value = await this.serverConfig(server);
    const session = await this.ensure(server, value, signal);
    if (!session.tools.some((candidate) => candidate.name === tool)) {
      throw new Error(`Downstream MCP tool not found: ${server}/${tool}`);
    }
    return session.client.callTool({ name: tool, arguments: args }, requestOptions(value, signal));
  }

  async refresh(server?: string, signal?: AbortSignal) {
    const config = await this.reconcile();
    const selected = server
      ? [[server, config.servers[server]] as const]
      : Object.entries(config.servers);
    const refreshed: string[] = [];

    for (const [name, value] of selected) {
      if (!value) throw new Error(`Downstream MCP server not found: ${name}`);
      if (!value.enabled) continue;
      await this.ensure(name, value, signal, true);
      refreshed.push(name);
    }
    return { refreshed };
  }

  async dispose() {
    const pending = [...this.pending.values()].map((entry) => entry.promise);
    await Promise.allSettled(pending);
    this.pending.clear();

    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map((session) => session.client.close()));
  }

  private async reconcile() {
    const config = await this.loadConfig();
    for (const [server, session] of [...this.sessions]) {
      const next = config.servers[server];
      if (!next || !next.enabled || keyOf(next) !== session.key) {
        this.sessions.delete(server);
        await session.client.close().catch(() => undefined);
      }
    }
    return config;
  }

  private async serverConfig(server: string) {
    const config = await this.reconcile();
    const value = config.servers[server];
    if (!value) throw new Error(`Downstream MCP server not found: ${server}`);
    if (!value.enabled) throw new Error(`Downstream MCP server is disabled: ${server}`);
    return value;
  }

  private async ensure(
    server: string,
    value: McpServerConfig,
    signal?: AbortSignal,
    force = false
  ): Promise<Session> {
    const key = keyOf(value);
    const inFlight = this.pending.get(server);
    if (inFlight) {
      if (!force && inFlight.key === key) return inFlight.promise;
      await inFlight.promise.catch(() => undefined);
    }

    if (force) {
      const existing = this.sessions.get(server);
      if (existing) {
        this.sessions.delete(server);
        await existing.client.close().catch(() => undefined);
      }
    } else {
      const existing = this.sessions.get(server);
      if (existing?.key === key) return existing;
      if (existing) {
        this.sessions.delete(server);
        await existing.client.close().catch(() => undefined);
      }
    }

    const promise = this.connect(server, value, key, signal).finally(() => {
      const current = this.pending.get(server);
      if (current?.promise === promise) this.pending.delete(server);
    });
    this.pending.set(server, { key, promise });
    return promise;
  }

  private async connect(
    server: string,
    value: McpServerConfig,
    key: string,
    signal?: AbortSignal
  ): Promise<Session> {
    const client = new Client({ name: "queqiao-mcp", version: "0.1.0" });
    const transport = value.transport === "stdio"
      ? new StdioClientTransport({
          command: value.command,
          args: value.args,
          ...(value.cwd ? { cwd: value.cwd } : {}),
          env: stdioEnv(value)
        })
      : new StreamableHTTPClientTransport(new URL(value.url), {
          requestInit: { headers: headers(value) }
        });

    try {
      await client.connect(transport, requestOptions(value, signal));
      const session: Session = {
        key,
        client,
        tools: await this.listTools(server, client, value, signal)
      };
      this.sessions.set(server, session);
      return session;
    } catch (error) {
      await client.close().catch(() => undefined);
      throw error;
    }
  }

  private async listTools(
    server: string,
    client: Client,
    value: McpServerConfig,
    signal?: AbortSignal
  ) {
    const result = await client.listTools(undefined, requestOptions(value, signal));
    return result.tools.map((tool) => ({
      server,
      name: tool.name,
      ...(tool.title ? { title: tool.title } : {}),
      ...(tool.description ? { description: tool.description } : {}),
      inputSchema: tool.inputSchema as Record<string, unknown>
    }));
  }
}
