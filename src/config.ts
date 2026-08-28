import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
const envRef=z.object({env:z.string().min(1),prefix:z.string().optional()}).strict();
const common={enabled:z.boolean().default(true),timeoutMs:z.number().int().min(100).max(120000).default(30000)};
const stdio=z.object({...common,transport:z.literal("stdio"),command:z.string().min(1),args:z.array(z.string()).default([]),cwd:z.string().min(1).optional(),env:z.record(z.string(),envRef).optional()}).strict();
const httpUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Streamable HTTP URL must use http or https");
const http=z.object({...common,transport:z.literal("streamable-http"),url:httpUrl,headers:z.record(z.string(),envRef).optional()}).strict();
export const serverConfigSchema=z.discriminatedUnion("transport",[stdio,http]);
export const adapterConfigSchema=z.object({servers:z.record(z.string(),serverConfigSchema).default({})}).strict();
export type McpServerConfig=z.infer<typeof serverConfigSchema>;
export type McpAdapterConfig=z.infer<typeof adapterConfigSchema>;
export function defaultConfigPath(){if(process.env.QUEQIAO_MCP_CONFIG)return path.resolve(process.env.QUEQIAO_MCP_CONFIG);if(process.platform==="win32")return path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),"AppData","Local"),"Queqiao","extensions","mcp","config.json");return path.join(process.env.XDG_CONFIG_HOME||path.join(os.homedir(),".config"),"queqiao","extensions","mcp","config.json");}
export async function readAdapterConfig(file=defaultConfigPath()):Promise<McpAdapterConfig>{try{const text=await readFile(file,"utf8");return adapterConfigSchema.parse(JSON.parse(text.replace(/^\uFEFF/,"")));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return{servers:{}};throw error;}}
export function resolveEnvRef(ref:z.infer<typeof envRef>){const value=process.env[ref.env];if(value===undefined)throw new Error(`Required environment variable is not set: ${ref.env}`);return `${ref.prefix??""}${value}`;}
