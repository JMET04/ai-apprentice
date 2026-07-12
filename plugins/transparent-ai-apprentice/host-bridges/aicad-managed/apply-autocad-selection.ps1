param(
  [Parameter(Mandatory = $true)][string]$RequestPath,
  [ValidateSet("verify", "apply")][string]$Action = "verify",
  [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"
$request = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($request.format -ne "ai_apprentice_autocad_native_selection_request_v1") { throw "Unsupported AutoCAD native request format." }
if ($request.action -ne $Action) { throw "Request action does not match the adapter action." }
$snapshot = $request.selection.snapshot
$receiptPath = [string]$request.receiptPath
if (-not $receiptPath) { throw "Request receiptPath is required." }

$acad = [Runtime.InteropServices.Marshal]::GetActiveObject("AutoCAD.Application")
$document = $acad.ActiveDocument
$expectedName = [string]$snapshot.host.documentName
$expectedPath = [string]$snapshot.host.documentPath
$actualName = [string]$document.Name
if ($actualName -ne $expectedName -and [IO.Path]::GetFileName($actualName) -ne [IO.Path]::GetFileName($expectedName)) {
  throw "Active AutoCAD document changed: expected '$expectedName', found '$($document.Name)'."
}
$actualPath = ""
try { $actualPath = [string]$document.FullName } catch {}
if ($expectedPath -and $actualPath -and ([IO.Path]::GetFullPath($expectedPath) -ne [IO.Path]::GetFullPath($actualPath))) {
  throw "Active AutoCAD document path no longer matches the captured selection."
}

Remove-Item -LiteralPath $receiptPath -Force -ErrorAction SilentlyContinue
$installedCore = Join-Path $env:APPDATA "Autodesk\ApplicationPlugins\AI.Apprentice.NativeSelection.bundle\Contents\AI.Apprentice.AutoCAD.Selection.dll"
if (-not (Test-Path -LiteralPath $installedCore)) {
  $installedCore = Join-Path $PSScriptRoot "runtime\AI.Apprentice.NativeSelection.bundle\Contents\AI.Apprentice.AutoCAD.Selection.dll"
}
if (-not (Test-Path -LiteralPath $installedCore)) { throw "AutoCAD native selection core DLL is not installed." }
$coreForLisp = $installedCore.Replace("\", "/").Replace('"', '\"')
$requestForLisp = $RequestPath.Replace("\", "/").Replace('"', '\"')
$command = '(progn (command "_.NETLOAD" "{0}") (command "AIAPPRENTICE_APPLY_REQUEST" "{1}") (princ)) ' -f $coreForLisp, $requestForLisp
$document.SendCommand($command)
$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
while (-not (Test-Path -LiteralPath $receiptPath)) {
  if ([DateTime]::UtcNow -ge $deadline) { throw "Timed out waiting for the AutoCAD native edit receipt." }
  Start-Sleep -Milliseconds 100
}
$result = Get-Content -LiteralPath $receiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($result.status -eq "blocked") { throw "AutoCAD blocked the native edit: $($result.error)" }
$result | ConvertTo-Json -Depth 12
