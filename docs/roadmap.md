# Roadmap

## Phase 0 — External extension contract

Queqiao core:

- expose a supported external Extension API/SDK from the published package
- define version compatibility rules for external extensions
- define safe host capability(s) needed by downstream MCP transports
- keep runtime config/secrets external and atomic

Exit: this repository can compile against a supported public Queqiao contract without copying internal types.

## Phase 1 — Minimal proxy extension

`queqiao-mcp`:

- Worker-hosted extension
- one stable public `mcp` proxy tool
- validated downstream server config
- lazy connection manager
- tool list/search/describe/call
- Streamable HTTP + stdio
- cancellation + timeout + bounded result handling
- metadata cache
- unit tests and mock MCP integration tests

Exit: Queqiao can call at least one remote MCP server and one local stdio MCP server through the same stable proxy surface.

## Phase 2 — Production lifecycle

- reconnect policy
- health checks
- `tools/list_changed`
- idle shutdown
- legacy SSE compatibility
- server status / diagnostics
- secure credential references and OAuth design where needed

## Phase 3 — Selective direct tools

- optional direct-tool promotion
- include/exclude policy
- deterministic namespacing/collision handling
- deployment-manifest impact diagnostics

## Phase 4 — Management UX

- Queqiao CLI install/config/status commands
- Dashboard MCP server management surface
- import/detect common MCP configuration formats only when provenance and secret handling are safe
