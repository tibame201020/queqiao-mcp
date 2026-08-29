# Roadmap

## Phase 0 — External extension contract ✅

Queqiao PR #30 established:

- public Extension API v1
- Extension Hub install/uninstall
- Worker attach/detach
- fixed public `extension` proxy
- Worker hot reload and `dispose()` lifecycle

Exit met: `queqiao-mcp` compiles against the public contract without copying or importing private Queqiao packages.

## Phase 1 — Minimal proxy extension — v0.1 baseline

Implemented:

- Worker-hosted extension
- one internal `mcp` capability reached through Queqiao's stable public proxy
- validated downstream server config
- lazy MCP client sessions
- `servers/search/describe/call/refresh`
- stdio + Streamable HTTP
- cancellation/timeout propagation through MCP SDK calls
- environment-variable references for downstream secrets
- deterministic real-transport tests
- Chrome DevTools MCP end-to-end release acceptance

v0.1 release closure requires:

- final compatibility acceptance against the released Queqiao 0.8.1 CLI/runtime contract
- green GitHub Actions on Windows and Ubuntu before merge
- npm package review from the merged, tagged release commit

The original Extension API readiness evidence is in `docs/validation/v0.1-readiness-2026-08-28.md`; final Queqiao 0.8.1 release-candidate evidence is recorded separately under `docs/validation/`.

## Phase 2 — Production lifecycle

- persistent metadata cache
- `tools/list_changed`
- bounded reconnect/backoff policy
- health/status diagnostics
- idle shutdown
- result-size policy
- richer credential/OAuth configuration where downstream servers require it
- legacy SSE only if real compatibility demand exists

## Phase 3 — Selective direct tools

- optional direct-tool promotion
- include/exclude policy
- deterministic namespacing/collision handling
- deployment-manifest impact diagnostics

## Phase 4 — Management UX

- Queqiao Dashboard MCP server management surface
- config editing/validation UI
- import/detect common MCP configuration formats when provenance and secret handling are safe
