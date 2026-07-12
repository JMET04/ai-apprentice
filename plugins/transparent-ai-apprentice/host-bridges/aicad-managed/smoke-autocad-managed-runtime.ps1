param(
  [string]$AutoCADRoot = "",
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$BridgeRoot = $PSScriptRoot
$PluginRoot = Split-Path -Parent (Split-Path -Parent $BridgeRoot)
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $PluginRoot)
$CoreDll = Join-Path $BridgeRoot "runtime\AI.Apprentice.NativeSelection.bundle\Contents\AI.Apprentice.AutoCAD.Selection.dll"
if (-not (Test-Path -LiteralPath $CoreDll)) { throw "AutoCAD core bridge DLL is missing: $CoreDll" }

if (-not $AutoCADRoot) {
  $registration = Get-ItemProperty -Path "HKLM:\SOFTWARE\Autodesk\AutoCAD\R25.0\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.AcadLocation } |
    Select-Object -First 1
  if ($registration) { $AutoCADRoot = $registration.AcadLocation }
}
if (-not $AutoCADRoot) { $AutoCADRoot = "D:\软件安装\CAD\AutoCAD 2025" }
$CoreConsole = Join-Path $AutoCADRoot "accoreconsole.exe"
if (-not (Test-Path -LiteralPath $CoreConsole)) { throw "AutoCAD 2025 Core Console was not found: $CoreConsole" }
if (Get-Process accoreconsole -ErrorAction SilentlyContinue) { throw "An AutoCAD Core Console process is already running; runtime smoke stopped without touching it." }

if (-not $OutputDir) { $OutputDir = Join-Path $WorkspaceRoot ".ta-smoke\autocad-managed-runtime-formal" }
$Inbox = Join-Path $OutputDir "inbox"
$ScriptPath = Join-Path $OutputDir "runtime-smoke.scr"
$ApplyScriptPath = Join-Path $OutputDir "runtime-apply-smoke.scr"
$ReceiptPath = Join-Path $OutputDir "runtime-smoke-receipt.json"
$NativeApplyReceiptPath = Join-Path $OutputDir "runtime-native-apply-receipt.json"
$NativeApplyRequestPath = Join-Path $OutputDir "runtime-native-apply-request.json"
$DrawingPath = Join-Path $OutputDir "runtime-native-line.dwg"
$FaceCaptureScriptPath = Join-Path $OutputDir "runtime-face-capture-smoke.scr"
$FaceApplyScriptPath = Join-Path $OutputDir "runtime-face-apply-smoke.scr"
$FaceDrawingPath = Join-Path $OutputDir "runtime-native-solid.dwg"
$FaceApplyRequestPath = Join-Path $OutputDir "runtime-face-apply-request.json"
$FaceApplyReceiptPath = Join-Path $OutputDir "runtime-face-apply-receipt.json"
$FaceHandlePath = Join-Path $OutputDir "runtime-face-handle.txt"
New-Item -ItemType Directory -Force -Path $Inbox | Out-Null
Get-ChildItem -LiteralPath $Inbox -Filter "selection-autocad-managed-*.json" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Remove-Item -LiteralPath $NativeApplyReceiptPath, $NativeApplyRequestPath, $DrawingPath, $FaceDrawingPath, $FaceApplyRequestPath, $FaceApplyReceiptPath, $FaceHandlePath -Force -ErrorAction SilentlyContinue

$dllForScript = $CoreDll.Replace("\", "/")
$drawingForScript = $DrawingPath.Replace("\", "/")
$scriptLines = @(
  '(setvar "FILEDIA" 0)',
  '(setq aiApprenticeOldSecureLoad (getvar "SECURELOAD"))',
  '(setvar "SECURELOAD" 0)',
  "(command `"_.NETLOAD`" `"$dllForScript`")",
  '(setvar "SECURELOAD" aiApprenticeOldSecureLoad)',
  '(command "_.LINE" "0,0" "100,0" "")',
  "(command `"_.SAVEAS`" `"2018`" `"$drawingForScript`")",
  '(setq aiApprenticeSmokeSelection (ssget "_L"))',
  '(sssetfirst nil aiApprenticeSmokeSelection)',
  'AIAPPRENTICE_CAPTURE_SELECTION_COMMAND'
)
[IO.File]::WriteAllLines($ScriptPath, $scriptLines, [Text.UTF8Encoding]::new($false))

$oldInbox = $env:AI_APPRENTICE_NATIVE_SELECTION_INBOX
$oldPluginRoot = $env:AI_APPRENTICE_PLUGIN_ROOT
try {
  $env:AI_APPRENTICE_NATIVE_SELECTION_INBOX = $Inbox
  $env:AI_APPRENTICE_PLUGIN_ROOT = ""
  & $CoreConsole /s $ScriptPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "AutoCAD Core Console exited with code $LASTEXITCODE." }
} finally {
  $env:AI_APPRENTICE_NATIVE_SELECTION_INBOX = $oldInbox
  $env:AI_APPRENTICE_PLUGIN_ROOT = $oldPluginRoot
}

$packetFile = Get-ChildItem -LiteralPath $Inbox -Filter "selection-autocad-managed-*.json" -File |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1
if (-not $packetFile) { throw "AutoCAD runtime did not create a native selection packet." }
$packet = Get-Content -LiteralPath $packetFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$nativeRequest = [ordered]@{
  format = "ai_apprentice_autocad_native_selection_request_v1"
  action = "apply"
  correctionId = "runtime-line-length-smoke"
  receiptPath = $NativeApplyReceiptPath
  selection = [ordered]@{ snapshot = $packet }
  correction = [ordered]@{
    packet = [ordered]@{
      surfaceKind = "engineering_native_object"
      target = [ordered]@{ action = "set_dimension"; targetValue = 450.0; unit = "mm" }
    }
  }
  reviewOnly = $true
  accepted = $false
  ruleEnabled = $false
  packagingGated = $true
}
[IO.File]::WriteAllText($NativeApplyRequestPath, (($nativeRequest | ConvertTo-Json -Depth 14) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
$requestForScript = $NativeApplyRequestPath.Replace("\", "/")
$applyScriptLines = @(
  '(setvar "FILEDIA" 0)',
  '(setq aiApprenticeOldSecureLoad (getvar "SECURELOAD"))',
  '(setvar "SECURELOAD" 0)',
  "(command `"_.NETLOAD`" `"$dllForScript`")",
  '(setvar "SECURELOAD" aiApprenticeOldSecureLoad)',
  'AIAPPRENTICE_APPLY_REQUEST',
  "`"$requestForScript`""
)
[IO.File]::WriteAllLines($ApplyScriptPath, $applyScriptLines, [Text.UTF8Encoding]::new($false))
& $CoreConsole /i $DrawingPath /s $ApplyScriptPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "AutoCAD Core Console native apply exited with code $LASTEXITCODE." }
if (-not (Test-Path -LiteralPath $NativeApplyReceiptPath)) { throw "AutoCAD runtime did not create a native apply receipt." }
$nativeApply = Get-Content -LiteralPath $NativeApplyReceiptPath -Raw -Encoding UTF8 | ConvertFrom-Json

Get-ChildItem -LiteralPath $Inbox -Filter "selection-autocad-managed-*.json" -File -ErrorAction SilentlyContinue | Remove-Item -Force
$faceDrawingForScript = $FaceDrawingPath.Replace("\", "/")
$faceHandleForScript = $FaceHandlePath.Replace("\", "/")
$faceCaptureLines = @(
  '(setvar "FILEDIA" 0)',
  '(setq aiApprenticeOldSecureLoad (getvar "SECURELOAD"))',
  '(setvar "SECURELOAD" 0)',
  "(command `"_.NETLOAD`" `"$dllForScript`")",
  '(setvar "SECURELOAD" aiApprenticeOldSecureLoad)',
  '(command "_.BOX" "0,0,0" "100,80" "60")',
  "(command `"_.SAVEAS`" `"2018`" `"$faceDrawingForScript`")",
  "(setq aiApprenticeHandleStream (open `"$faceHandleForScript`" `"w`"))",
  '(write-line (cdr (assoc 5 (entget (entlast)))) aiApprenticeHandleStream)',
  '(close aiApprenticeHandleStream)'
)
[IO.File]::WriteAllLines($FaceCaptureScriptPath, $faceCaptureLines, [Text.UTF8Encoding]::new($false))
& $CoreConsole /s $FaceCaptureScriptPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "AutoCAD Core Console face capture exited with code $LASTEXITCODE." }
if (-not (Test-Path -LiteralPath $FaceHandlePath)) { throw "AutoCAD runtime did not expose the solid handle for face execution." }
$faceHandle = (Get-Content -LiteralPath $FaceHandlePath -Raw -Encoding UTF8).Trim()
$facePacket = [ordered]@{
  surfaceKind = "engineering_native_object"
  host = [ordered]@{ documentName = $FaceDrawingPath; documentPath = $FaceDrawingPath }
  selection = [ordered]@{
    nativeKind = "autocad_face"
    nativeLocator = "handle:$faceHandle/subentity:face:1"
    objectType = "3DSOLID"
    properties = [ordered]@{ handle = $faceHandle; layer = "0"; subentityType = "face"; subentityIndex = 1 }
  }
}
$faceRequest = [ordered]@{
  format = "ai_apprentice_autocad_native_selection_request_v1"
  action = "apply"
  correctionId = "runtime-face-offset-smoke"
  receiptPath = $FaceApplyReceiptPath
  selection = [ordered]@{ snapshot = $facePacket }
  correction = [ordered]@{ packet = [ordered]@{ surfaceKind = "engineering_native_object"; target = [ordered]@{ action = "offset_face"; targetValue = 10.0; unit = "mm" } } }
  reviewOnly = $true
  accepted = $false
  ruleEnabled = $false
  packagingGated = $true
}
[IO.File]::WriteAllText($FaceApplyRequestPath, (($faceRequest | ConvertTo-Json -Depth 14) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
$faceRequestForScript = $FaceApplyRequestPath.Replace("\", "/")
$faceApplyLines = @(
  '(setvar "FILEDIA" 0)',
  '(setq aiApprenticeOldSecureLoad (getvar "SECURELOAD"))',
  '(setvar "SECURELOAD" 0)',
  "(command `"_.NETLOAD`" `"$dllForScript`")",
  '(setvar "SECURELOAD" aiApprenticeOldSecureLoad)',
  'AIAPPRENTICE_APPLY_REQUEST',
  "`"$faceRequestForScript`""
)
[IO.File]::WriteAllLines($FaceApplyScriptPath, $faceApplyLines, [Text.UTF8Encoding]::new($false))
& $CoreConsole /i $FaceDrawingPath /s $FaceApplyScriptPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "AutoCAD Core Console face apply exited with code $LASTEXITCODE." }
if (-not (Test-Path -LiteralPath $FaceApplyReceiptPath)) { throw "AutoCAD runtime did not create a face apply receipt." }
$faceApply = Get-Content -LiteralPath $FaceApplyReceiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
$checks = [ordered]@{
  format = $packet.format -eq "ai_apprentice_native_selection_v1"
  surfaceKind = $packet.surfaceKind -eq "engineering_native_object"
  realLineEntity = $packet.selection.nativeKind -eq "autocad_entity" -and $packet.selection.objectType -eq "LINE"
  nativeHandle = [bool]($packet.selection.nativeLocator -match '^handle:[0-9A-F]+$')
  headlessEntityFallback = $packet.selection.properties.headlessHost -eq $true -and $null -eq $packet.selection.properties.subentityType
  hostAgentBoundary = $packet.executionBoundary.mode -eq "host_agent_plugin" -and $packet.executionBoundary.reasoningOwner -eq "host_agent"
  noModelApiOrKey = $packet.executionBoundary.modelApiRequired -eq $false -and $packet.executionBoundary.apiKeyRequired -eq $false
  screenControlOff = $packet.interactionPreference.allowScreenControl -eq $false
  reviewLocks = $packet.reviewOnly -eq $true -and $packet.accepted -eq $false -and $packet.ruleEnabled -eq $false -and $packet.packagingGated -eq $true
  commandTriggerAccurate = $packet.capture.trigger -eq "command"
  lineGeometryCaptured = [Math]::Abs([double]$packet.selection.properties.length - 100.0) -lt 0.000001
  nativeLineLengthApplied = $nativeApply.status -eq "applied_pending_teacher_verification" -and [Math]::Abs([double]$nativeApply.before.length - 100.0) -lt 0.000001 -and [Math]::Abs([double]$nativeApply.after.length - 450.0) -lt 0.000001
  nativeApplyReviewLocks = $nativeApply.accepted -eq $false -and $nativeApply.ruleEnabled -eq $false -and $nativeApply.packagingGated -eq $true -and $nativeApply.teacherVerificationRequired -eq $true
  nativeApplyDoesNotSave = $nativeApply.documentSavedAutomatically -eq $false -and $nativeApply.documentLeftOpen -eq $true
  nativeFaceOffsetApplied = $faceApply.status -eq "applied_pending_teacher_verification" -and $faceApply.operation -eq "offset_face" -and [double]$faceApply.after.volume -ne [double]$faceApply.before.volume
  nativeFaceOffsetReviewLocks = $faceApply.accepted -eq $false -and $faceApply.ruleEnabled -eq $false -and $faceApply.packagingGated -eq $true -and $faceApply.teacherVerificationRequired -eq $true
}
$passed = @($checks.Values | Where-Object { $_ }).Count
$receipt = [ordered]@{
  format = "ai_apprentice_autocad_managed_runtime_smoke_v1"
  status = if ($passed -eq $checks.Count) { "passed" } else { "failed" }
  passed = $passed
  total = $checks.Count
  autoCADCoreConsole = $CoreConsole
  coreDllSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $CoreDll).Hash.ToLowerInvariant()
  packetPath = $packetFile.FullName
  packet = $packet
  nativeApplyRequestPath = $NativeApplyRequestPath
  nativeApplyReceiptPath = $NativeApplyReceiptPath
  nativeApply = $nativeApply
  faceApplyRequestPath = $FaceApplyRequestPath
  faceApplyReceiptPath = $FaceApplyReceiptPath
  faceApply = $faceApply
  checks = $checks
  evidenceBoundary = "Core Console proves real database entity capture plus native LINE and 3DSOLID face transactions; desktop COM dispatch, Ctrl-subentity face capture, and right-click UX remain manual host checks."
}
[IO.File]::WriteAllText($ReceiptPath, (($receipt | ConvertTo-Json -Depth 14) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
$receipt | ConvertTo-Json -Depth 14
if ($receipt.status -ne "passed") { exit 1 }
