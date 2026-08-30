import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { mcpToolInputSchema, queqiaoExtension } from "./index.js";

describe("queqiao-mcp extension contract", () => {
  it("requires workspaceId for Worker-hosted extension routing", async () => {
    expect(mcpToolInputSchema.safeParse({ operation: "servers" }).success).toBe(false);
    expect(mcpToolInputSchema.safeParse({ workspaceId: "workspace-a", operation: "servers" }).success).toBe(true);

    const registerTool = vi.fn();
    queqiaoExtension.activate({ registerTool } as any);
    const definition = registerTool.mock.calls[0]?.[0];
    expect(definition).toBeDefined();

    const result = await definition.execute(
      { workspaceId: "workspace-a", operation: "servers" },
      { workspaceId: "workspace-a" }
    );
    expect(result.workspaceId).toBe("workspace-a");
  });

  it("keeps package and runtime extension contracts aligned", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    expect(queqiaoExtension.manifest.id).toBe(packageJson.queqiao.manifest.id);
    expect(queqiaoExtension.manifest.version).toBe(packageJson.queqiao.manifest.version);
    expect(packageJson.version).toBe(packageJson.queqiao.manifest.version);

    const contribution = packageJson.queqiao.manifest.contributions.find(
      (entry: { operation?: string; tool?: string }) => entry.operation === "register" && entry.tool === "mcp"
    );
    expect(contribution).toBeDefined();
    const { $schema: _ignored, ...runtimeSchema } = z.toJSONSchema(mcpToolInputSchema, { io: "input" });
    expect(contribution.inputSchema).toEqual(runtimeSchema);
  });
});
