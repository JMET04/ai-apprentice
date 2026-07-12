param(
  [switch]$RunCodexAdd
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PluginName = "transparent-ai-apprentice"
$SourcePlugin = Join-Path $RepoRoot "plugins\$PluginName"
$SourceManifest = Join-Path $SourcePlugin ".codex-plugin\plugin.json"

if (-not (Test-Path -LiteralPath $SourceManifest)) {
  throw "Plugin manifest not found: $SourceManifest"
}

$HomeDir = [Environment]::GetFolderPath("UserProfile")
$TargetRoot = Join-Path $HomeDir "plugins"
$TargetPlugin = Join-Path $TargetRoot $PluginName
$MarketplaceDir = Join-Path $HomeDir ".agents\plugins"
$MarketplacePath = Join-Path $MarketplaceDir "marketplace.json"

New-Item -ItemType Directory -Force -Path $TargetRoot, $MarketplaceDir | Out-Null

if (Test-Path -LiteralPath $TargetPlugin) {
  $ResolvedTarget = (Resolve-Path -LiteralPath $TargetPlugin).Path
  $ResolvedRoot = (Resolve-Path -LiteralPath $TargetRoot).Path
  if (-not $ResolvedTarget.StartsWith($ResolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to replace unexpected plugin path: $ResolvedTarget"
  }
  Remove-Item -LiteralPath $TargetPlugin -Recurse -Force
}

Copy-Item -LiteralPath $SourcePlugin -Destination $TargetPlugin -Recurse -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "package.json") -Destination (Join-Path $TargetPlugin "package.json") -Force

if (Test-Path -LiteralPath $MarketplacePath) {
  $Marketplace = Get-Content -LiteralPath $MarketplacePath -Raw | ConvertFrom-Json
  if (-not $Marketplace.name) {
    $Marketplace | Add-Member -NotePropertyName "name" -NotePropertyValue "personal"
  }
  if (-not $Marketplace.interface) {
    $Marketplace | Add-Member -NotePropertyName "interface" -NotePropertyValue ([pscustomobject]@{ displayName = "Personal" })
  }
  if (-not $Marketplace.plugins) {
    $Marketplace | Add-Member -NotePropertyName "plugins" -NotePropertyValue @()
  }
} else {
  $Marketplace = [pscustomobject]@{
    name = "personal"
    interface = [pscustomobject]@{ displayName = "Personal" }
    plugins = @()
  }
}

$Entry = [pscustomobject]@{
  name = $PluginName
  source = [pscustomobject]@{
    source = "local"
    path = "./plugins/$PluginName"
  }
  policy = [pscustomobject]@{
    installation = "AVAILABLE"
    authentication = "ON_INSTALL"
  }
  category = "Productivity"
}

$OtherPlugins = @($Marketplace.plugins | Where-Object { $_.name -ne $PluginName })
$Marketplace.plugins = @($OtherPlugins + $Entry)
$MarketplaceJson = $Marketplace | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($MarketplacePath, $MarketplaceJson + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

$Verify = & node (Join-Path $TargetPlugin "scripts\verify-plugin.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "Copied plugin verifier failed."
}
$VerifyResult = ConvertFrom-Json ($Verify -join "`n")

$McpServer = Join-Path $TargetPlugin "scripts\mcp-server.mjs"
$StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
$StartInfo.FileName = "node"
$StartInfo.Arguments = "`"$McpServer`""
$StartInfo.WorkingDirectory = $HomeDir
$StartInfo.RedirectStandardInput = $true
$StartInfo.RedirectStandardOutput = $true
$StartInfo.RedirectStandardError = $true
$StartInfo.UseShellExecute = $false

$Process = [System.Diagnostics.Process]::new()
$Process.StartInfo = $StartInfo
[void]$Process.Start()
$Process.StandardInput.WriteLine('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}')
$Process.StandardInput.WriteLine('{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}')
$Process.StandardInput.WriteLine('{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
$Process.StandardInput.Close()
$Stdout = $Process.StandardOutput.ReadToEnd()
$Stderr = $Process.StandardError.ReadToEnd()
$Process.WaitForExit()
if ($Process.ExitCode -ne 0) {
  throw "Copied plugin MCP server failed: $Stderr $Stdout"
}

$McpLines = @($Stdout -split "`r?`n" | Where-Object { $_.Trim() })
if ($McpLines.Count -lt 2) {
  throw "Copied plugin MCP server returned too few JSON-RPC lines: $Stdout"
}
$ToolsResponse = $McpLines[1] | ConvertFrom-Json
$ToolNames = @($ToolsResponse.result.tools | ForEach-Object { $_.name })
if ($ToolNames.Count -ne 5 -or ($ToolNames -notcontains "teach_apprentice") -or ($ToolNames -notcontains "show_teaching_card") -or ($ToolNames -notcontains "run_apprentice_profile") -or ($ToolNames -notcontains "review_apprentice_profile") -or ($ToolNames -notcontains "correct_last_result")) {
  throw "Copied plugin default MCP tools/list check failed: $($ToolNames -join ', ')"
}

$AdvancedStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
$AdvancedStartInfo.FileName = "node"
$AdvancedStartInfo.Arguments = "`"$McpServer`""
$AdvancedStartInfo.WorkingDirectory = $HomeDir
$AdvancedStartInfo.RedirectStandardInput = $true
$AdvancedStartInfo.RedirectStandardOutput = $true
$AdvancedStartInfo.RedirectStandardError = $true
$AdvancedStartInfo.UseShellExecute = $false
$AdvancedStartInfo.Environment["TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS"] = "1"

$AdvancedProcess = [System.Diagnostics.Process]::new()
$AdvancedProcess.StartInfo = $AdvancedStartInfo
[void]$AdvancedProcess.Start()
$AdvancedProcess.StandardInput.WriteLine('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}')
$AdvancedProcess.StandardInput.WriteLine('{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}')
$AdvancedProcess.StandardInput.WriteLine('{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')
$AdvancedProcess.StandardInput.Close()
$AdvancedStdout = $AdvancedProcess.StandardOutput.ReadToEnd()
$AdvancedStderr = $AdvancedProcess.StandardError.ReadToEnd()
$AdvancedProcess.WaitForExit()
if ($AdvancedProcess.ExitCode -ne 0) {
  throw "Copied plugin advanced MCP server failed: $AdvancedStderr $AdvancedStdout"
}

$AdvancedMcpLines = @($AdvancedStdout -split "`r?`n" | Where-Object { $_.Trim() })
if ($AdvancedMcpLines.Count -lt 2) {
  throw "Copied plugin advanced MCP server returned too few JSON-RPC lines: $AdvancedStdout"
}
$AdvancedToolsResponse = $AdvancedMcpLines[1] | ConvertFrom-Json
$AdvancedToolNames = @($AdvancedToolsResponse.result.tools | ForEach-Object { $_.name })
$RequiredAdvancedToolNames = @(
  "teach_apprentice",
  "continue_teaching",
  "create_plugin_health_index",
  "create_plugin_manual_test_readiness_pack",
  "create_plugin_manual_test_result_receipt_template",
  "create_plugin_manual_test_session_packet",
  "validate_plugin_manual_test_result_receipt",
  "create_tlcl_direction_operational_console",
  "create_tlcl_next_route_input_contract",
  "create_tlcl_runtime_gate",
  "create_tlcl_reasoning_budget_governor",
  "create_tlcl_rag_evidence_attachment",
  "create_real_case_pilot_intake",
  "start_guided_teaching",
  "create_goal_command_center",
  "create_all_software_observer_bootstrap",
  "create_software_control_channel_profile",
  "create_transparent_sketch_overlay_kit",
  "create_supervised_software_action_kit",
  "show_teaching_card",
  "review_apprentice_profile",
  "correct_last_result"
)
$MissingAdvancedToolNames = @($RequiredAdvancedToolNames | Where-Object { $AdvancedToolNames -notcontains $_ })
if ($AdvancedToolNames.Count -lt 100 -or $MissingAdvancedToolNames.Count -gt 0) {
  throw "Copied plugin advanced MCP tools/list check failed: count=$($AdvancedToolNames.Count); missing=$($MissingAdvancedToolNames -join ', ')"
}
$McpSummary = [pscustomobject]@{
  mode = $ToolsResponse.result.mode
  toolCount = $ToolNames.Count
  tools = $ToolNames
  advancedMode = $AdvancedToolsResponse.result.mode
  advancedToolCount = $AdvancedToolNames.Count
  advancedTools = $AdvancedToolNames
}

$CodexAddStatus = "not_run"
$CodexAddError = ""
if ($RunCodexAdd) {
  try {
    & codex plugin add "$PluginName@personal"
    if ($LASTEXITCODE -eq 0) {
      $CodexAddStatus = "passed"
    } else {
      $CodexAddStatus = "failed"
      $CodexAddError = "codex plugin add exited with $LASTEXITCODE"
    }
  } catch {
    $CodexAddStatus = "failed"
    $CodexAddError = $_.Exception.Message
  }
}

[pscustomobject]@{
  status = "installed_to_personal_marketplace"
  pluginName = $PluginName
  sourcePlugin = $SourcePlugin
  targetPlugin = $TargetPlugin
  marketplacePath = $MarketplacePath
  verifier = $VerifyResult
  mcp = $McpSummary
  codexAdd = $CodexAddStatus
  codexAddError = $CodexAddError
  nextManualCommand = "codex plugin add $PluginName@personal"
} | ConvertTo-Json -Depth 12










