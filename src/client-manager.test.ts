import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { McpClientManager } from "./client-manager.js";

describe("McpClientManager stdio",()=>{
  it("discovers, describes, calls, and disposes a real stdio MCP server",async()=>{
    const manager=new McpClientManager(async()=>({servers:{local:{transport:"stdio",command:path.basename(process.execPath),args:[path.resolve("test-fixtures/echo-server.mjs")],cwd:process.cwd(),enabled:true,timeoutMs:5000}}}));
    try{
      expect(await manager.servers()).toEqual([{server:"local",transport:"stdio",enabled:true,connected:false,cachedTools:0}]);
      const matches=await manager.search("echo",10);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({server:"local",name:"echo",title:"Echo"});
      expect(await manager.describe("local","echo")).toMatchObject({server:"local",name:"echo"});
      const result=await manager.call("local","echo",{text:"hello"});
      expect(result).toMatchObject({structuredContent:{text:"hello"}});
      expect(result.isError).not.toBe(true);
      expect((await manager.servers())[0]).toMatchObject({connected:true,cachedTools:1});
    }finally{await manager.dispose();}
  });

  it("deduplicates concurrent first connections to the same server", async () => {
    const server = { transport: "stdio" as const, command: "node", args: [], enabled: true, timeoutMs: 5000 };
    const manager = new McpClientManager(async () => ({ servers: { local: server } }));
    const close = vi.fn(async () => undefined);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const connect = vi.spyOn(manager as any, "connect").mockImplementation(async () => {
      await gate;
      return {
        key: JSON.stringify(server),
        client: { close },
        tools: [{ server: "local", name: "echo", inputSchema: {} }]
      };
    });

    const first = manager.search("echo", 10);
    const second = manager.search("echo", 10);
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      [expect.objectContaining({ server: "local", name: "echo" })],
      [expect.objectContaining({ server: "local", name: "echo" })]
    ]);
    expect(connect).toHaveBeenCalledTimes(1);
    await manager.dispose();
  });
});
