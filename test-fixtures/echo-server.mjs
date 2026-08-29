import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
void serveStdio(()=>{const server=new McpServer({name:"queqiao-mcp-test",version:"1.0.0"});server.registerTool("echo",{title:"Echo",description:"Echo text",inputSchema:z.object({text:z.string()})},async({text})=>({content:[{type:"text",text}],structuredContent:{text}}));return server;});
