# @tibame201020/queqiao-mcp

[English](https://github.com/tibame201020/queqiao-mcp/blob/main/README.md) | [繁體中文](https://github.com/tibame201020/queqiao-mcp/blob/main/README.zh-TW.md)

[Queqiao](https://github.com/tibame201020/Queqiao) 的官方 MCP client extension。

`@tibame201020/queqiao-mcp` 讓單一 Queqiao Worker 能連接下游 MCP server，同時讓 Queqiao 維持穩定的公開 `extension` proxy tool，而不是把每個下游 tool 都展開到公開 manifest。

## 狀態

v0.1 baseline 對應 Queqiao 0.8.1。自 v0.1.1 起，canonical npm package 為 `@tibame201020/queqiao-mcp`；最初未加 scope 的 `queqiao-mcp@0.1.0` 僅保留作為歷史 bootstrap 相容版本。Queqiao PR #30 引入的獨立 Extension contract，已使用 synthetic MCP fixtures 與標準 [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) server，對正式發布的 Queqiao 0.8.1 完成端到端驗證。Readiness evidence 位於 [`docs/validation/`](docs/validation/)。

已驗證的 acceptance chain：

```text
MCP client / LLM
→ Queqiao Gateway
→ Queqiao Worker
→ extension proxy
→ queqiao-mcp
→ chrome-devtools-mcp
→ headless isolated Chrome
```

## 安裝

從 npm 安裝：

```bash
queqiao extension install npm:@tibame201020/queqiao-mcp --attach-all
```

或先安裝到 Extension Hub，再附加到指定 Worker：

```bash
queqiao extension install npm:@tibame201020/queqiao-mcp
queqiao extension attach dev.queqiao.mcp --worker windows
```

`attach` 即為 activation，沒有另外的 enable/disable 狀態。

## 設定下游 MCP server

預設設定檔位置：

- Windows：`%LOCALAPPDATA%\Queqiao\extensions\mcp\config.json`
- Linux/macOS：`$XDG_CONFIG_HOME/queqiao/extensions/mcp/config.json`，若未設定則使用 `~/.config/queqiao/extensions/mcp/config.json`
- 覆寫：`QUEQIAO_MCP_CONFIG`

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

在 Windows 上，若 MCP package 透過 `.cmd` launcher 發布，可以透過 `cmd.exe /c` 設定，例如：

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

Secret 透過環境變數引用，不直接存進設定檔。

## Proxy operations

`queqiao-mcp` 會註冊一個名為 `mcp` 的 internal capability。Queqiao 穩定的公開 `extension` tool 會負責 discover 與 invoke。

支援的 operations：

- `servers` — 列出已設定的下游 server，不主動連線
- `search` — discover/search 下游 tools
- `describe` — 回傳單一 downstream tool schema
- `call` — 呼叫單一 downstream tool
- `refresh` — 重新連線並刷新 tool metadata

Connection 採 lazy 建立，並在 ExtensionHost generation 存活期間重複使用。`dispose()` 會關閉所有 downstream MCP clients，因此 Queqiao detach/hot-reload 時，stdio subprocess 與 HTTP session 會隨 extension lifecycle 一起退役。

## 信任邊界

Queqiao extension 屬於 trusted plugin code，概念上類似 IDE 或 coding-agent extension；不是 syscall sandbox plugin。安裝並 attach `queqiao-mcp` 代表允許它透過官方 MCP SDK 建立 downstream stdio process 與 network connection。

Queqiao 仍負責明確的 package install/attach、Extension contract validation、Gateway→Worker routing、public tool exposure 與 ExtensionHost lifecycle。`queqiao-mcp` 則負責 downstream MCP credentials、subprocess/network behavior、timeouts、cancellation 與 cleanup。

## 開發

```bash
npm ci
npm run check
```

Stable CI 在 Windows 與 Ubuntu 上使用真實的 in-process/child-process MCP fixtures 驗證 stdio 與 Streamable HTTP。

Windows release acceptance 會針對獨立 Queqiao package contract 與 Chrome DevTools MCP 執行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\accept-chrome-devtools.ps1 -QueqiaoCore ..\Queqiao
```

Acceptance script 使用 temporary Extension Hub、Gateway、Worker、npm registry、Chrome profile 與 dynamic loopback ports，不會修改既有 stable/shadow Queqiao runtime configuration。

另見 [`docs/architecture.md`](docs/architecture.md) 與 [`docs/roadmap.md`](docs/roadmap.md)。

## 授權

MIT
