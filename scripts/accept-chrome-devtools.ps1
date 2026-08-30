param(
  [string]$QueqiaoCore = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\Queqiao")
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$core = (Resolve-Path $QueqiaoCore).Path
$queqiao = Join-Path $core "dist\queqiao.js"
$runtimeRoot = Join-Path $env:TEMP ("queqiao-mcp-acceptance-" + [guid]::NewGuid().ToString("N"))
$localAppData = Join-Path $runtimeRoot "LocalAppData"
$registryState = Join-Path $runtimeRoot "registry.json"
$registryProcess = $null
$tarballPath = $null

function Get-FreePort {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start()
  try { return ([Net.IPEndPoint]$listener.LocalEndpoint).Port }
  finally { $listener.Stop() }
}

function Invoke-Queqiao([string[]]$Arguments) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & node $queqiao @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) { throw "queqiao $($Arguments -join ' ') failed:`n$($output -join "`n")" }
  return ($output -join "`n")
}

function Get-ChromePath {
  $keys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
  )
  foreach ($key in $keys) {
    if (Test-Path $key) {
      $value = (Get-ItemProperty $key)."(default)"
      if ($value -and (Test-Path $value)) { return $value }
    }
  }
  $candidates = @(
    "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
    "${env:PROGRAMFILES(X86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  foreach ($candidate in $candidates) { if ($candidate -and (Test-Path $candidate)) { return $candidate } }
  throw "Google Chrome was not found"
}

$oldLocalAppData = $env:LOCALAPPDATA
$oldRegistry = $env:npm_config_registry
$oldCache = $env:npm_config_cache
try {
  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
  $env:LOCALAPPDATA = $localAppData
  $env:npm_config_cache = Join-Path $runtimeRoot "npm-cache"

  if (!(Test-Path $queqiao)) {
    Push-Location $core
    try {
      if (!(Test-Path "node_modules")) {
        npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "Queqiao npm ci failed" }
      }
      npm run build
      if ($LASTEXITCODE -ne 0) { throw "Queqiao workspace build failed" }
      npm run build:package
      if ($LASTEXITCODE -ne 0) { throw "Queqiao package build failed" }
    } finally { Pop-Location }
  }

  Push-Location $repo
  try {
    if (!(Test-Path "node_modules")) {
      npm ci --ignore-scripts --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { throw "queqiao-mcp npm ci failed" }
    }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "queqiao-mcp build failed" }
    $tarball = (npm pack --ignore-scripts --silent | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or !$tarball) { throw "queqiao-mcp npm pack failed" }
    $tarballPath = Join-Path $repo $tarball
  } finally { Pop-Location }

  $workerPort = Get-FreePort
  $gatewayPort = Get-FreePort
  $managementPort = Get-FreePort
  $registryProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @(
    (Join-Path $repo "test-fixtures\npm-registry.mjs"),
    $tarballPath,
    $registryState
  ) -WorkingDirectory $repo -PassThru -WindowStyle Hidden
  for ($i = 0; $i -lt 100 -and !(Test-Path $registryState); $i++) { Start-Sleep -Milliseconds 100 }
  if (!(Test-Path $registryState)) { throw "Ephemeral npm registry did not start" }
  $registryInfo = Get-Content $registryState -Raw | ConvertFrom-Json
  $env:npm_config_registry = $registryInfo.registry

  $workspace = Join-Path $runtimeRoot "mcp-e2e-workspace"
  New-Item -ItemType Directory -Force -Path $workspace | Out-Null
  Push-Location $core
  try {
    $bootstrap = & npx --no-install tsx (Join-Path $repo "test-fixtures\bootstrap-queqiao.mts") $core $workerPort $gatewayPort $managementPort $workspace
    if ($LASTEXITCODE -ne 0) { throw "Queqiao deterministic runtime bootstrap failed" }
  } finally { Pop-Location }
  $bootstrapInfo = $bootstrap | ConvertFrom-Json
  if ($bootstrapInfo.workspaceId -ne "mcp-e2e-workspace") {
    throw "Unexpected bootstrap Workspace id: $($bootstrapInfo.workspaceId)"
  }
  Invoke-Queqiao @("extension", "install", "npm:@tibame201020/queqiao-mcp", "--worker", "mcp-e2e") | Out-Null

  $chrome = Get-ChromePath
  $mcpConfigPath = Join-Path $localAppData "Queqiao\extensions\mcp\config.json"
  New-Item -ItemType Directory -Force -Path (Split-Path $mcpConfigPath) | Out-Null
  $mcpConfig = @{
    servers = @{
      "chrome-devtools" = @{
        transport = "stdio"
        command = "cmd.exe"
        args = @(
          "/d", "/s", "/c", "npx", "-y", "chrome-devtools-mcp@1.7.0",
          "--headless=true", "--isolated=true", "--no-usage-statistics", "--no-performance-crux",
          "--executablePath=$chrome"
        )
        enabled = $true
        timeoutMs = 120000
      }
    }
  }
  [IO.File]::WriteAllText($mcpConfigPath, ($mcpConfig | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))

  Invoke-Queqiao @("worker", "serve", "--worker", "mcp-e2e", "--bg") | Out-Null
  for ($i = 0; $i -lt 100; $i++) {
    try {
      $workerStatus = Invoke-Queqiao @("worker", "status", "--worker", "mcp-e2e", "--json") | ConvertFrom-Json
      if ($workerStatus.health.reachable -and $workerStatus.health.identityMatches) { break }
    } catch {}
    Start-Sleep -Milliseconds 100
  }
  if (!$workerStatus.health.reachable -or !$workerStatus.health.identityMatches) { throw "Worker did not become ready" }

  Invoke-Queqiao @("gateway", "serve", "--gateway", "mcp-e2e-gateway", "--bg") | Out-Null
  $join = $null
  for ($i = 0; $i -lt 100 -and !$join; $i++) {
    try { $join = Invoke-Queqiao @("gateway", "join-token", "--gateway", "mcp-e2e-gateway", "--expires", "60", "--json") | ConvertFrom-Json }
    catch { Start-Sleep -Milliseconds 100 }
  }
  if (!$join) { throw "Gateway management endpoint did not become ready" }
  Invoke-Queqiao @("worker", "join", "--worker", "mcp-e2e", "--join-code", $join.joinCode, "--json") | Out-Null

  $env:QUEQIAO_E2E_GATEWAY = "http://127.0.0.1:$gatewayPort/"
  $env:QUEQIAO_E2E_APPROVAL_FILE = Join-Path $localAppData "Queqiao\gateways\mcp-e2e-gateway\data\secrets\oauth-approval.secret"
  $result = & node (Join-Path $repo "test-fixtures\gateway-chrome-client.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Gateway Chrome DevTools MCP client failed" }
  $parsed = $result | ConvertFrom-Json
  if (!$parsed.ok -or $parsed.downstreamServer -ne "chrome-devtools" -or $parsed.downstreamTool -ne "list_pages") {
    throw "Unexpected Chrome DevTools acceptance result: $result"
  }
  Write-Output $result
} finally {
  try { if (Test-Path $queqiao) { Invoke-Queqiao @("worker", "stop", "--worker", "mcp-e2e") | Out-Null } } catch {}
  try { if (Test-Path $queqiao) { Invoke-Queqiao @("gateway", "stop", "--gateway", "mcp-e2e-gateway") | Out-Null } } catch {}
  if ($registryProcess -and !$registryProcess.HasExited) { Stop-Process -Id $registryProcess.Id -Force -ErrorAction SilentlyContinue }
  if ($tarballPath) { Remove-Item $tarballPath -Force -ErrorAction SilentlyContinue }
  Remove-Item $runtimeRoot -Recurse -Force -ErrorAction SilentlyContinue
  $env:LOCALAPPDATA = $oldLocalAppData
  $env:npm_config_registry = $oldRegistry
  $env:npm_config_cache = $oldCache
}
