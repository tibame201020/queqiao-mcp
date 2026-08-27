# queqiao-mcp

Official MCP client extension for [Queqiao](https://github.com/tibame201020/Queqiao).

`queqiao-mcp` lets Queqiao act as an MCP client and aggregate downstream MCP servers without baking third-party integrations into Queqiao core.

## Status

Architecture / bootstrap phase. The repository is intentionally independent from Queqiao core.

## Direction

- Stable, token-efficient MCP proxy surface instead of exposing every downstream tool by default.
- Lazy connections and cached tool metadata.
- Modern MCP transports: stdio and Streamable HTTP first; legacy SSE as compatibility support.
- Downstream tool discovery, describe, call, lifecycle and cancellation.
- Optional promotion of selected downstream tools to direct Queqiao tools later.
- Queqiao Worker authority remains authoritative. The extension must not bypass process, workspace, network or secret policy.

## Repository relationship

This is not a fork, submodule, or Queqiao monorepo package. It is a standalone extension repository that consumes a versioned Queqiao Extension API.

Current prerequisite: Queqiao needs to expose a supported external Extension API/SDK from its published package. Until that contract exists, this repository will not duplicate private internal Queqiao types.

See [`docs/architecture.md`](docs/architecture.md) and [`docs/roadmap.md`](docs/roadmap.md).

## License

MIT
