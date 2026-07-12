param(
  [Parameter(Mandatory = $true)][string]$RequestPath,
  [ValidateSet("verify", "apply")][string]$Action = "verify"
)

$ErrorActionPreference = "Stop"
$request = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$snapshot = $request.selection.snapshot
$packet = $request.correction.packet
if ($snapshot.surfaceKind -ne "office_native_text") { throw "The native selection is not a Word text selection." }
if ($packet.surfaceKind -ne "office_native_text") { throw "The reviewed correction is not an Office text correction." }

$word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
$document = $word.ActiveDocument
$expectedName = [string]$snapshot.host.documentName
$expectedPath = [string]$snapshot.host.documentPath
$expectedSessionId = [string]$snapshot.host.sessionId
$actualPath = ""
try { $actualPath = [string]$document.FullName } catch {}
if ($document.Name -ne $expectedName) {
  throw "Active Word document changed: expected '$expectedName', found '$($document.Name)'."
}
if ($expectedSessionId -and $expectedSessionId -notlike "word-$($word.Hwnd)-*") {
  throw "Active Word application instance no longer matches the captured selection session."
}
if ($expectedPath -and $actualPath -and ([IO.Path]::GetFullPath($expectedPath) -ne [IO.Path]::GetFullPath($actualPath))) {
  throw "Active Word document path no longer matches the captured selection."
}

$start = [int]$snapshot.selection.range.start
$end = [int]$snapshot.selection.range.end
$range = $document.Range($start, $end)
$before = [string]$range.Text
$expectedText = [string]$packet.correction.originalText
if ($before -cne $expectedText) {
  throw "Word selection changed after capture. Expected '$expectedText', found '$before'."
}
$replacement = if ($packet.correction.operation -eq "delete_text") { "" } else { [string]$packet.correction.replacementText }

$undoRecordStarted = $false
if ($Action -eq "apply") {
  try {
    $word.UndoRecord.StartCustomRecord("AI Apprentice native selection edit")
    $undoRecordStarted = $true
  } catch {}
  try {
    $range.Text = $replacement
  } finally {
    if ($undoRecordStarted) { $word.UndoRecord.EndCustomRecord() }
  }
}

$after = if ($Action -eq "apply") { [string]$document.Range($start, $start + $replacement.Length).Text } else { $replacement }
if ($Action -eq "apply" -and $after -cne $replacement) {
  throw "Word did not produce the reviewed replacement text."
}

[pscustomobject]@{
  format = "ai_apprentice_word_native_selection_result_v1"
  status = if ($Action -eq "apply") { "applied_pending_teacher_verification" } else { "verified_ready_for_apply" }
  action = $Action
  documentName = $document.Name
  documentPath = $actualPath
  nativeLocator = $snapshot.selection.nativeLocator
  range = [ordered]@{ start = $start; endBefore = $end; endAfter = $start + $replacement.Length }
  before = $before
  after = $after
  exactCapturedRangeMatched = $true
  documentLeftOpen = $true
  documentSavedAutomatically = $false
  screenControlUsed = $false
  undoRecordCreated = $undoRecordStarted
  teacherVerificationRequired = $true
  accepted = $false
  ruleEnabled = $false
  packagingGated = $true
} | ConvertTo-Json -Depth 8
