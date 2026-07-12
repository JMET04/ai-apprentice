param([string]$BundleContents = "")

$ErrorActionPreference = "Stop"
$PluginRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $PluginRoot)
$Inbox = Join-Path $WorkspaceRoot ".transparent-apprentice\native-selections\inbox"
New-Item -ItemType Directory -Path $Inbox -Force | Out-Null
[Environment]::SetEnvironmentVariable("AI_APPRENTICE_PLUGIN_ROOT", $PluginRoot, "User")
[Environment]::SetEnvironmentVariable("AI_APPRENTICE_NATIVE_SELECTION_INBOX", $Inbox, "User")
$env:AI_APPRENTICE_PLUGIN_ROOT = $PluginRoot
$env:AI_APPRENTICE_NATIVE_SELECTION_INBOX = $Inbox

if (-not $BundleContents) {
  $BundleContents = Join-Path $PluginRoot "integrations\aicad-agent-v1\plugin\aicad-agent\runtime\autocad\AiCadConstraint.bundle\Contents"
}
if (-not (Test-Path -LiteralPath $BundleContents)) { throw "AICAD bundle Contents directory not found: $BundleContents" }

$source = Join-Path $PSScriptRoot "AI_Apprentice_Selection.lsp"
$target = Join-Path $BundleContents "AI_Apprentice_Selection.lsp"
Copy-Item -LiteralPath $source -Destination $target -Force
$entry = Join-Path $BundleContents "AiCadConstraint.lsp"
$loadLine = '(load "AI_Apprentice_Selection.lsp" nil)'
$entryText = Get-Content -LiteralPath $entry -Raw -Encoding UTF8
if ($entryText -notmatch [regex]::Escape($loadLine)) {
  Add-Content -LiteralPath $entry -Value "`r`n$loadLine`r`n" -Encoding UTF8
}

$liveLoaded = $false
try {
  $acad = [Runtime.InteropServices.Marshal]::GetActiveObject("AutoCAD.Application")
  $lispPath = $target.Replace("\", "/")
  $acad.ActiveDocument.SendCommand("(load `"$lispPath`") ")
  $liveLoaded = $true
} catch {}

[pscustomobject]@{
  status = "installed_for_agent_plugin"
  target = $target
  autoloadEntry = $entry
  inbox = $Inbox
  loadedIntoActiveAutoCad = $liveLoaded
  rightClickBridgeDefault = "on_for_selected_or_picked_entities"
  ownApiInstalled = $false
} | ConvertTo-Json -Depth 5
