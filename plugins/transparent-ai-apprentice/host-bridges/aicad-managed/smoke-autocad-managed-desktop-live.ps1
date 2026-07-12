param(
  [string]$AutoCADRoot = "",
  [string]$EvidenceRoot = ""
)

$ErrorActionPreference = "Stop"
$BridgeRoot = $PSScriptRoot
$PluginRoot = Split-Path -Parent (Split-Path -Parent $BridgeRoot)
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $PluginRoot)
if (-not $EvidenceRoot) { $EvidenceRoot = Join-Path $WorkspaceRoot ".ta-smoke\autocad-managed-runtime-formal" }
$DrawingPath = Join-Path $EvidenceRoot "runtime-native-line.dwg"
$RequestPath = Join-Path $EvidenceRoot "runtime-native-apply-request.json"
$AdapterPath = Join-Path $BridgeRoot "apply-autocad-selection.ps1"
if (-not (Test-Path -LiteralPath $DrawingPath) -or -not (Test-Path -LiteralPath $RequestPath)) {
  throw "Core runtime evidence is missing. Run npm run smoke:aicad-managed-runtime first."
}
if (Get-Process acad,accoreconsole -ErrorAction SilentlyContinue) {
  throw "An AutoCAD process is already running; desktop smoke stopped without touching it."
}
if (-not $AutoCADRoot) {
  $registration = Get-ItemProperty -Path "HKLM:\SOFTWARE\Autodesk\AutoCAD\R25.0\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.AcadLocation } |
    Select-Object -First 1
  if ($registration) { $AutoCADRoot = $registration.AcadLocation }
}
$AutoCADExe = Join-Path $AutoCADRoot "acad.exe"
if (-not (Test-Path -LiteralPath $AutoCADExe)) { throw "AutoCAD executable was not found: $AutoCADExe" }

$process = $null
$acad = $null
try {
  $process = Start-Process -FilePath $AutoCADExe -ArgumentList @("/nologo", ('"' + $DrawingPath + '"')) -WindowStyle Hidden -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(75)
  do {
    Start-Sleep -Milliseconds 500
    try { $acad = [Runtime.InteropServices.Marshal]::GetActiveObject("AutoCAD.Application") } catch {}
    if ($acad) {
      try { $activePath = [string]$acad.ActiveDocument.FullName } catch { $activePath = "" }
      if ($activePath -and ([IO.Path]::GetFullPath($activePath) -eq [IO.Path]::GetFullPath($DrawingPath))) { break }
    }
  } while ([DateTime]::UtcNow -lt $deadline)
  if (-not $acad -or -not $activePath) { throw "AutoCAD desktop host did not open the test drawing in time." }

  $adapterOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File $AdapterPath -RequestPath $RequestPath -Action apply -TimeoutSeconds 45
  if ($LASTEXITCODE -ne 0) { throw "AutoCAD desktop adapter process failed." }
  $result = $adapterOutput -join "`n" | ConvertFrom-Json
  $checks = [ordered]@{
    appliedPendingTeacherVerification = $result.status -eq "applied_pending_teacher_verification"
    exactNativeLineMatched = $result.exactCapturedEntityMatched -eq $true -and [double]$result.before.length -eq 100 -and [double]$result.after.length -eq 450
    documentNotSaved = $result.documentSavedAutomatically -eq $false
    screenControlNotUsed = $result.screenControlUsed -eq $false
    reviewLocksClosed = $result.accepted -eq $false -and $result.ruleEnabled -eq $false -and $result.packagingGated -eq $true
  }
  $passed = @($checks.Values | Where-Object { $_ }).Count
  [pscustomobject]@{
    format = "ai_apprentice_autocad_managed_desktop_live_smoke_v1"
    status = if ($passed -eq $checks.Count) { "passed" } else { "failed" }
    passed = $passed
    total = $checks.Count
    drawingPath = $DrawingPath
    result = $result
    checks = $checks
  } | ConvertTo-Json -Depth 12
  if ($passed -ne $checks.Count) { exit 1 }
} finally {
  if ($acad) {
    try { $acad.ActiveDocument.Close($false) } catch {}
    try { $acad.Quit() } catch {}
  }
  if ($process) {
    try { Wait-Process -Id $process.Id -Timeout 20 -ErrorAction SilentlyContinue } catch {}
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) { Stop-Process -Id $process.Id -Force }
  }
}
