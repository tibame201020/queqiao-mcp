import { createServer } from "node:http";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { McpClientManager } from "./client-manager.js";

function handler() {
  return createMcpHandler(() => {
    const server = new McpServer({ name: "http-test", version: "1.0.0" });
    server.registerTool("echo-http", { title: "HTTP Echo", description: "Echo over HTTP", inputSchema: z.object({ text: z.string() }) }, async ({ text }) => ({ content: [{ type: "text", text }], structuredContent: { text } }));
    return server;
  });
}

describe("McpClientManager Streamable HTTP", () => {
  it("discovers, calls, refreshes, and disposes a real HTTP MCP server", async () => {
    const mcp = handler();
    const http = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) Array.isArray(value) ? value.forEach(v => headers.append(name, v)) : value !== undefined && headers.set(name, value);
      const body = Buffer.concat(chunks);
      const result = await mcp.fetch(new Request(`http://${req.headers.host}${req.url ?? "/"}`, { method: req.method ?? "GET", headers, ...(body.length ? { body } : {}) }));
      res.statusCode = result.status;
      result.headers.forEach((value, name) => res.setHeader(name, value));
      if (!result.body) res.end();
      else res.end(Buffer.from(await result.arrayBuffer()));
    });
    await new Promise<void>((resolve, reject) => { http.once("error", reject); http.listen(0, "127.0.0.1", resolve); });
    const address = http.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP listener");
    const manager = new McpClientManager(async () => ({ servers: { remote: { transport: "streamable-http", url: `http://127.0.0.1:${address.port}/mcp`, enabled: true, timeoutMs: 5000 } } }));
    try {
      expect(await manager.search("http echo", 10)).toEqual([expect.objectContaining({ server: "remote", name: "echo-http", title: "HTTP Echo" })]);
      const result = await manager.call("remote", "echo-http", { text: "network" });
      expect(result).toMatchObject({ structuredContent: { text: "network" } });
      expect(result.isError).not.toBe(true);
      await expect(manager.refresh("remote")).resolves.toEqual({ refreshed: ["remote"] });
    } finally {
      await manager.dispose();
      await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
    }
  });
});
