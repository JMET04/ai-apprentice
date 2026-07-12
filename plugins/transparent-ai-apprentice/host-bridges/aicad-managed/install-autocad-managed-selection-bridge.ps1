param([string]$ApplicationPluginsPath = "")

$ErrorActionPreference = "Stop"
$BridgeRoot = $PSScriptRoot
$PluginRoot = Split-Path -Parent (Split-Path -Parent $BridgeRoot)
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $PluginRoot)
$SourceBundle = Join-Path $BridgeRoot "runtime\AI.Apprentice.NativeSelection.bundle"
$SourceDll = Join-Path $SourceBundle "Contents\AI.Apprentice.AutoCAD.Selection.dll"
$SourceContextDll = Join-Path $SourceBundle "Contents\AI.Apprentice.AutoCAD.ContextMenu.dll"
if (-not (Test-Path -LiteralPath $SourceDll)) { throw "Managed AutoCAD core bridge DLL is missing: $SourceDll" }
if (-not (Test-Path -LiteralPath $SourceContextDll)) { throw "Managed AutoCAD context-menu DLL is missing: $SourceContextDll" }
if (-not $ApplicationPluginsPath) { $ApplicationPluginsPath = Join-Path $env:APPDATA "Autodesk\ApplicationPlugins" }
$Inbox = Join-Path $WorkspaceRoot ".transparent-apprentice\native-selections\inbox"
$TargetBundle = Join-Path $ApplicationPluginsPath "AI.Apprentice.NativeSelection.bundle"

New-Item -ItemType Directory -Force -Path $ApplicationPluginsPath, $Inbox | Out-Null
if (Test-Path -LiteralPath $TargetBundle) {
  $resolvedTarget = (Resolve-Path -LiteralPath $TargetBundle).Path
  $resolvedRoot = [IO.Path]::GetFullPath($ApplicationPluginsPath)
  if (-not $resolvedTarget.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar)) {
    throw "Refusing to replace bundle outside Autodesk ApplicationPlugins: $resolvedTarget"
  }
  Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
}
Copy-Item -LiteralPath $SourceBundle -Destination $TargetBundle -Recurse -Force
[Environment]::SetEnvironmentVariable("AI_APPRENTICE_PLUGIN_ROOT", $PluginRoot, "User")
[Environment]::SetEnvironmentVariable("AI_APPRENTICE_NATIVE_SELECTION_INBOX", $Inbox, "User")

[pscustomobject]@{
  status = "installed_for_host_agent_plugin"
  bundle = $TargetBundle
  inbox = $Inbox
  reasoningOwner = "host_agent"
  modelApiRequired = $false
  apiKeyRequired = $false
  restartAutoCADRequired = $true
} | ConvertTo-Json -Depth 5
