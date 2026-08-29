import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { adapterConfigSchema, readAdapterConfig, resolveEnvRef } from "./config.js";

let temporary: string | undefined;
afterEach(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }); temporary = undefined; });

describe("adapter config", () => {
  it("accepts UTF-8 BOM JSON written by common Windows tools", async () => {
    temporary = await mkdtemp(path.join(os.tmpdir(), "queqiao-mcp-config-"));
    const file = path.join(temporary, "config.json");
    await writeFile(file, `\uFEFF${JSON.stringify({ servers: {} })}`, "utf8");
    await expect(readAdapterConfig(file)).resolves.toEqual({ servers: {} });
  });

  it("rejects non-HTTP URLs for Streamable HTTP transport", () => {
    const result = adapterConfigSchema.safeParse({
      servers: {
        invalid: {
          transport: "streamable-http",
          url: "file:///tmp/mcp",
          enabled: true,
          timeoutMs: 5000
        }
      }
    });
    expect(result.success).toBe(false);
  });

  it("resolves secret references from environment variables", () => {
    process.env.QUEQIAO_MCP_TEST_SECRET = "token";
    try { expect(resolveEnvRef({ env: "QUEQIAO_MCP_TEST_SECRET", prefix: "Bearer " })).toBe("Bearer token"); }
    finally { delete process.env.QUEQIAO_MCP_TEST_SECRET; }
  });
});
