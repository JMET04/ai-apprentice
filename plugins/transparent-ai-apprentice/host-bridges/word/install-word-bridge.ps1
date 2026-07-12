param([switch]$SkipVbaImport)

$ErrorActionPreference = "Stop"
$PluginRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
[Environment]::SetEnvironmentVariable("AI_APPRENTICE_PLUGIN_ROOT", $PluginRoot, "User")
$env:AI_APPRENTICE_PLUGIN_ROOT = $PluginRoot

$result = [ordered]@{
  status = "environment_configured"
  pluginRoot = $PluginRoot
  vbaImported = $false
  requiresWordRestart = $true
  ownApiInstalled = $false
}

if (-not $SkipVbaImport) {
  try {
    try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application") }
    catch { $word = New-Object -ComObject Word.Application }
    $project = $word.NormalTemplate.VBProject
    foreach ($name in @("AI_Apprentice_WordBridge", "CAIApprenticeEvents")) {
      foreach ($component in @($project.VBComponents)) {
        if ($component.Name -eq $name) { $project.VBComponents.Remove($component) }
      }
    }
    $project.VBComponents.Import((Join-Path $PSScriptRoot "CAIApprenticeEvents.cls")) | Out-Null
    $project.VBComponents.Import((Join-Path $PSScriptRoot "AI_Apprentice_WordBridge.bas")) | Out-Null
    $word.NormalTemplate.Save()
    $result.status = "installed_into_word_normal_template"
    $result.vbaImported = $true
  } catch {
    $result.status = "environment_configured_vba_import_needs_teacher_action"
    $result.vbaImportError = $_.Exception.Message
    $result.nextAction = "In Word Trust Center, allow trusted access to the VBA project object model, then rerun this installer; or import the .cls and .bas files manually."
  }
}

[pscustomobject]$result | ConvertTo-Json -Depth 5
