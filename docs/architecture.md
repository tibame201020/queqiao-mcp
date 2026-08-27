# Architecture

## Goal

Make Queqiao an MCP client through an independent extension, analogous in purpose to `pi-mcp-extension` / `pi-mcp-adapter`, while preserving Queqiao's security model and stable public MCP surface.

## Topology

```text
AI Client
  -> Queqiao public MCP server
     -> native Queqiao tools
     -> queqiao-mcp extension
        -> MCP client manager
           -> stdio MCP server
           -> Streamable HTTP MCP server
           -> legacy SSE MCP server (compatibility)
```

## Public surface

The default public surface should remain small and stable. V0 should expose one proxy-style tool rather than registering every downstream tool into the Queqiao deployment manifest.

Proposed logical operations behind the proxy:

- list configured servers / status
- search cached downstream tools
- describe one downstream tool
- call one downstream tool
- connect / reconnect / disconnect when explicitly requested

Selected downstream tools may later be promoted to direct Queqiao tools, but promotion is opt-in because each direct tool changes the public tool surface.

## Lifecycle

Default lifecycle is lazy:

1. Read validated downstream server configuration.
2. Load cached metadata without connecting where possible.
3. Connect only on first call or explicit connect.
4. Discover paginated tools and cache metadata.
5. Forward calls and propagate cancellation.
6. Disconnect idle local servers after a bounded timeout.
7. Reconnect according to bounded policy where configured.

Future lifecycle modes may include eager and keep-alive.

## Queqiao integration boundary

Current live Queqiao already provides:

- trusted local-module ExtensionHost
- global / workspace activation
- register / extend / replace composition
- extension ordering
- declared contribution contract validation
- Worker-authoritative tool execution

However, the external extension boundary is not yet fully public:

1. The published `@tibame201020/queqiao` package currently bundles CLI entry points and does not export a supported Extension API/SDK for third-party TypeScript packages.
2. Gateway extension targeting exists in configuration schema, but the live runtime currently instantiates ExtensionHost on Worker only.
3. Tool capabilities currently cover `workspace:read`, `workspace:write`, and `workspace:exec`; there is no explicit outbound-network/downstream-MCP capability contract yet.

These are Queqiao-core prerequisites, not reasons to merge this extension into the core repository.

## Host strategy

### V0

Run `queqiao-mcp` as a Worker-hosted extension because that is the live supported ExtensionHost path today. `workspaceId` remains the routing/authority anchor.

### Follow-up

Add Gateway-hosted extension runtime only when remote HTTP MCP aggregation needs a gateway-level lifecycle independent of a Worker. Do not add it merely for symmetry.

## Security rules

The extension must not bypass Queqiao authority by directly using unrestricted `child_process` or ad-hoc process spawning for stdio MCP servers.

The extension must not treat arbitrary outbound HTTP as implicitly trusted. Remote MCP endpoints need an explicit outbound policy/capability boundary before production release.

Secrets and OAuth credentials stay outside source repositories and public MCP results. Downstream MCP configuration must support secret references rather than embedding credentials in committed config.

Cancellation, timeout, concurrency and output/result-size bounds must propagate across the downstream MCP call.

## Configuration

The extension should own downstream MCP server configuration, but reuse Queqiao platform/runtime paths and atomic configuration conventions.

Configuration must be declarative and support at least:

- server id
- enabled state
- transport
- stdio command/argv OR remote URL
- environment variables via secret references
- lifecycle mode
- per-server tool include/exclude policy
- optional direct-tool promotion in a later revision

## Compatibility inspiration

From `pi-mcp-extension`:

- multi-transport client manager
- paginated discovery
- list-changed refresh
- cancellation propagation
- reconnection / health checks
- safe subprocess lifecycle

From `pi-mcp-adapter`:

- one token-efficient proxy tool
- lazy connections
- metadata cache
- search / describe before call
- optional direct-tool promotion

Queqiao-specific security and deployment rules take precedence over either reference design.
