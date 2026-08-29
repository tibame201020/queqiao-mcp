# Architecture

## Goal

Make Queqiao an MCP client through an independent extension, analogous in purpose to `pi-mcp-extension` / `pi-mcp-adapter`, while preserving Queqiao's stable public MCP surface.

## Topology

```text
AI client
  -> Queqiao public MCP Gateway
     -> fixed public `extension` proxy
        -> native Worker
           -> queqiao-mcp (`mcp` internal capability)
              -> MCP client manager
                 -> stdio MCP server
                 -> Streamable HTTP MCP server
```

Gateway remains exposure/routing only. Worker remains the ExtensionHost execution unit. The Extension Hub is package/control-plane state and is not in the request path.

## Queqiao contract

Queqiao PR #30 provides the external Extension API v1:

- public TypeScript declarations at `@tibame201020/queqiao/extension`
- registry npm Extension Hub install/uninstall
- Worker attach/detach lifecycle
- fixed Revision 7 public `extension` proxy
- generation-based Worker ExtensionHost hot reload
- last-known-good replacement, request leases, and deferred `dispose()`

`queqiao-mcp` uses the public SDK as a compile-time contract only. Its packed runtime does not import Queqiao internals or bundle another Queqiao host instance.

## Public surface

`queqiao-mcp` contributes one internal Worker tool named `mcp`. Queqiao's fixed public `extension` proxy exposes it without changing the connector manifest whenever downstream servers change.

V0 operations:

- `servers`
- `search`
- `describe`
- `call`
- `refresh`

Downstream tools are not promoted to direct public Queqiao tools in v0.

## Lifecycle

1. Load and validate declarative downstream configuration.
2. `servers` reports configuration without connecting.
3. Discovery/call creates a downstream MCP client lazily.
4. The client performs standard MCP `tools/list` and `tools/call` operations.
5. The session and discovered tool metadata are reused while the server configuration is unchanged.
6. Configuration changes cause the old client to close before a new session is created.
7. Queqiao ExtensionHost `dispose()` closes every remaining downstream client.

V0 has in-memory metadata per active session. Persistent metadata caching, idle eviction, `tools/list_changed`, reconnect backoff, and legacy SSE remain follow-up work.

## Transports

### stdio

Uses the official MCP TypeScript SDK `StdioClientTransport`. The configured command/argv is executed in the Worker OS environment.

Windows `.cmd` based launchers can be expressed explicitly through `cmd.exe /c`. Linux/macOS can use their native executable form.

### Streamable HTTP

Uses the official MCP TypeScript SDK `StreamableHTTPClientTransport`. Optional headers resolve values from environment-variable references.

Legacy SSE is intentionally not part of v0.

## Trust and security boundary

Queqiao extensions are trusted plugin code, comparable to VS Code, IntelliJ, or coding-agent extensions. Queqiao does not attempt to syscall-sandbox arbitrary TypeScript extensions.

Queqiao owns:

- explicit install/uninstall and attach/detach intent
- package metadata/entry-point validation
- stable public MCP exposure and Gateway→Worker routing
- Extension contribution contract validation
- ExtensionHost hot reload and disposal lifecycle

`queqiao-mcp` owns:

- downstream stdio/network behavior
- downstream credentials
- MCP timeout/cancellation handling
- subprocess/session cleanup
- validation of its own downstream configuration

Secrets stay outside source control. V0 config accepts environment-variable references for stdio environment values and HTTP headers.

## Configuration

Each server has:

- server id
- enabled state
- transport
- timeout
- stdio command/argv, optional cwd and environment references; or
- Streamable HTTP URL and optional header references

`QUEQIAO_MCP_CONFIG` overrides the platform default config location.

## Acceptance baseline

Stable unit/integration tests use real MCP transports with deterministic fixtures:

- real stdio child MCP server
- real loopback Streamable HTTP MCP handler

Release acceptance additionally uses the independent standard `chrome-devtools-mcp` package, pinned to a known version, and exercises the complete path:

```text
OAuth MCP client
-> Queqiao Gateway
-> Worker
-> extension proxy
-> queqiao-mcp
-> chrome-devtools-mcp
-> headless isolated Chrome
```

The acceptance assertion calls Chrome DevTools MCP `list_pages` and requires a real browser result.

## Compatibility inspiration

From `pi-mcp-extension`:

- multi-transport MCP client lifecycle
- cancellation and reconnect-oriented design
- tool discovery

From `pi-mcp-adapter`:

- one token-efficient proxy surface
- lazy connection
- search/describe before call
- optional direct-tool promotion later

Queqiao's Extension Hub/Worker/Gateway architecture remains authoritative for integration semantics.
