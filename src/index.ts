import type { QueqiaoExtension } from "@tibame201020/queqiao/extension";
import { z } from "zod";
import { McpClientManager } from "./client-manager.js";
import { readAdapterConfig } from "./config.js";

export const mcpToolInputSchema = z.object({
  workspaceId: z.string(),
  operation: z.enum(["servers", "search", "describe", "call", "refresh"]),
  server: z.string().optional(),
  query: z.string().optional(),
  tool: z.string().optional(),
  arguments: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(50).optional()
});

type McpInput = z.infer<typeof mcpToolInputSchema>;
type Context = { workspaceId: string; signal?: AbortSignal };
const manager = new McpClientManager(() => readAdapterConfig());
const need = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export const queqiaoExtension = {
  manifest: {
    id: "dev.queqiao.mcp",
    version: "0.1.1",
    displayName: "Queqiao MCP Adapter",
    supportedEnvironments: ["windows", "linux", "darwin"]
  },
  activate(api) {
    api.registerTool({
      name: "mcp",
      title: "Downstream MCP",
      description: "Search, describe, and call tools exposed by downstream MCP servers without expanding the public Queqiao manifest.",
      inputSchema: mcpToolInputSchema,
      requiredCapabilities: [],
      risk: "execute",
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true, idempotentHint: false },
      async execute(input, context) {
        const request = input as McpInput;
        if (request.operation === "servers") return { workspaceId: context.workspaceId, servers: await manager.servers() };
        if (request.operation === "search") return { workspaceId: context.workspaceId, matches: await manager.search(need(request.query, "query"), request.limit ?? 10, context.signal) };
        if (request.operation === "describe") return { workspaceId: context.workspaceId, tool: await manager.describe(need(request.server, "server"), need(request.tool, "tool"), context.signal) };
        if (request.operation === "call") return { workspaceId: context.workspaceId, result: await manager.call(need(request.server, "server"), need(request.tool, "tool"), request.arguments ?? {}, context.signal) };
        return { workspaceId: context.workspaceId, ...await manager.refresh(request.server, context.signal) };
      }
    });
  },
  async dispose() {
    await manager.dispose();
  }
} satisfies QueqiaoExtension<Context>;

export default queqiaoExtension;
export { McpClientManager } from "./client-manager.js";
export { readAdapterConfig, defaultConfigPath } from "./config.js";
