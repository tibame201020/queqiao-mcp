# queqiao-mcp

Official MCP client extension for [Queqiao](https://github.com/tibame201020/Queqiao).

`queqiao-mcp` lets one Queqiao Worker connect to downstream MCP servers while Queqiao keeps a stable public `extension` proxy tool instead of expanding every downstream tool into the public manifest.

## Status

Pre-release v0.1 implementation. The independent Extension contract introduced by Queqiao PR #30 has been dogfooded end-to-end with both synthetic MCP fixtures and the standard [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) server. Current local readiness evidence is recorded in [`docs/validation/v0.1-readiness-2026-08-28.md`](docs/validation/v0.1-readiness-2026-08-28.md).

Verified acceptance chain:

```text
MCP client / LLM
→ Queqiao Gateway
→ Queqiao Worker
→ extension proxy
→ queqiao-mcp
→ chrome-devtools-mcp
→ headless isolated Chrome
```

## Install

After `queqiao-mcp` is published to npm:

```bash
queqiao extension install npm:queqiao-mcp --attach-all
```

Or install into the Extension Hub first and attach selected Workers later:

```bash
queqiao extension install npm:queqiao-mcp
queqiao extension attach dev.queqiao.mcp --worker windows
```

`attach` is activation. There is no separate enable/disable state.

## Configure downstream MCP servers

Default config paths:

- Windows: `%LOCALAPPDATA%\Queqiao\extensions\mcp\config.json`
- Linux/macOS: `$XDG_CONFIG_HOME/queqiao/extensions/mcp/config.json`, falling back to `~/.config/queqiao/extensions/mcp/config.json`
- Override: `QUEQIAO_MCP_CONFIG`

### stdio

```json
{
  "servers": {
    "chrome-devtools": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@1.7.0"],
      "enabled": true,
      "timeoutMs": 120000
    }
  }
}
```

On Windows, MCP packages distributed through `.cmd` launchers may be configured through `cmd.exe /c`, for example:

```json
{
  "transport": "stdio",
  "command": "cmd.exe",
  "args": ["/d", "/s", "/c", "npx", "-y", "chrome-devtools-mcp@1.7.0"],
  "enabled": true,
  "timeoutMs": 120000
}
```

### Streamable HTTP

```json
{
  "servers": {
    "remote": {
      "transport": "streamable-http",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": { "env": "REMOTE_MCP_TOKEN", "prefix": "Bearer " }
      },
      "enabled": true,
      "timeoutMs": 30000
    }
  }
}
```

Secrets are referenced from environment variables rather than stored directly in config.

## Proxy operations

`queqiao-mcp` registers one internal capability named `mcp`. The stable Queqiao public `extension` tool discovers and invokes it.

Supported operations:

- `servers` — list configured downstream servers without connecting
- `search` — discover/search downstream tools
- `describe` — return one downstream tool schema
- `call` — call one downstream tool
- `refresh` — reconnect and refresh tool metadata

Connections are lazy and reused while the ExtensionHost generation is active. `dispose()` closes all downstream MCP clients, so Queqiao detach/hot-reload retires stdio subprocesses and HTTP sessions with the extension lifecycle.

## Trust boundary

Queqiao extensions are trusted plugin code, analogous to IDE or coding-agent extensions; they are not syscall-sandboxed plugins. Installing and attaching `queqiao-mcp` permits it to create downstream stdio processes and network connections through the official MCP SDK.

Queqiao remains responsible for explicit package installation/attachment, Extension contract validation, Gateway→Worker routing, public tool exposure, and ExtensionHost lifecycle. `queqiao-mcp` owns downstream MCP credentials, subprocess/network behavior, timeouts, cancellation, and cleanup.

## Development

```bash
npm ci
npm run check
```

Stable CI uses real in-process/child-process MCP fixtures for stdio and Streamable HTTP on Windows and Ubuntu.

Windows release acceptance against the independent Queqiao package contract and Chrome DevTools MCP:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\accept-chrome-devtools.ps1 -QueqiaoCore ..\Queqiao
```

The acceptance script uses a temporary Extension Hub, Gateway, Worker, npm registry, Chrome profile, and dynamic loopback ports. It does not modify existing stable/shadow Queqiao runtime configuration.

See [`docs/architecture.md`](docs/architecture.md) and [`docs/roadmap.md`](docs/roadmap.md).

## License

MIT
