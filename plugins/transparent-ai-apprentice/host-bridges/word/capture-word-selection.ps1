param(
  [ValidateSet("right_click", "command", "desktop_companion", "test_fixture")]
  [string]$Trigger = "command",
  [string]$InboxPath = "",
  [string]$FixturePath = "",
  [string]$CodexLink = "",
  [ValidateRange(0, 1000)][int]$ContextCharacters = 0,
  [switch]$NoOpenCodex,
  [switch]$OpenCompanion
)

$ErrorActionPreference = "Stop"
$PluginRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $PluginRoot)
if (-not $InboxPath) {
  $InboxPath = Join-Path $WorkspaceRoot ".transparent-apprentice\native-selections\inbox"
}
New-Item -ItemType Directory -Path $InboxPath -Force | Out-Null

function Get-SafeValue([scriptblock]$Getter, $Fallback = "") {
  try { return & $Getter } catch { return $Fallback }
}

if ($FixturePath) {
  $fixture = Get-Content -LiteralPath $FixturePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $hostInfo = $fixture.host
  $nativeSelection = $fixture.selection
} else {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
  $selection = $word.Selection
  $document = $word.ActiveDocument
  if ($null -eq $selection -or $selection.Start -eq $selection.End) {
    throw "Word has no non-empty native text selection. Select text before invoking AI Apprentice."
  }

  $start = [int]$selection.Start
  $end = [int]$selection.End
  $text = [string]$selection.Text
  $contextStart = [Math]::Max(0, $start - $ContextCharacters)
  $contextEnd = [Math]::Min([int]$document.Content.End, $end + $ContextCharacters)
  $before = [string]$document.Range($contextStart, $start).Text
  $after = [string]$document.Range($end, $contextEnd).Text
  $paragraphNumber = [int](Get-SafeValue { $document.Range(0, $start).Paragraphs.Count } 1)
  $documentPath = [string](Get-SafeValue { $document.FullName } "")
  $documentHash = ""
  if ($documentPath -and (Test-Path -LiteralPath $documentPath)) {
    $documentHash = (Get-FileHash -LiteralPath $documentPath -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  $hostInfo = [ordered]@{
    application = "Microsoft Word"
    version = [string](Get-SafeValue { $word.Version } "")
    documentName = [string]$document.Name
    documentPath = $documentPath
    documentSha256 = $documentHash
    sessionId = "word-$($word.Hwnd)-$($document.Name)"
  }
  $nativeSelection = [ordered]@{
    nativeKind = "word_range"
    nativeLocator = "paragraph:$paragraphNumber/range:$start-$end"
    text = $text
    range = [ordered]@{ start = $start; end = $end; storyType = [int]$selection.StoryType }
    contextBefore = $before
    contextAfter = $after
    properties = [ordered]@{
      paragraph = $paragraphNumber
      style = [string](Get-SafeValue { $selection.Style.NameLocal } "")
      fontName = [string](Get-SafeValue { $selection.Font.Name } "")
      fontSize = [double](Get-SafeValue { $selection.Font.Size } 0)
      bold = [int](Get-SafeValue { $selection.Font.Bold } 0)
      italic = [int](Get-SafeValue { $selection.Font.Italic } 0)
      languageId = [int](Get-SafeValue { $selection.LanguageID } 0)
    }
    relationships = @("active Word document", "exact COM range", "paragraph:$paragraphNumber")
    protectedObjectIds = @("word-content-before-range:$start", "word-content-after-range:$end")
  }
}

$capturedAt = [DateTime]::UtcNow.ToString("o")
$packet = [ordered]@{
  format = "ai_apprentice_native_selection_v1"
  surfaceKind = "office_native_text"
  host = $hostInfo
  selection = $nativeSelection
  capture = [ordered]@{
    trigger = $Trigger
    adapter = "word_com_selection_bridge_v1"
    capturedAt = $capturedAt
  }
  interactionPreference = [ordered]@{
    backgroundPreparation = $true
    allowScreenControl = $false
    keepHostDocumentOpen = $true
  }
  executionBoundary = [ordered]@{
    mode = "host_agent_plugin"
    reasoningOwner = "host_agent"
    modelApiRequired = $false
    apiKeyRequired = $false
    companionRole = "capture_and_handoff_only"
  }
  reviewOnly = $true
  accepted = $false
  ruleEnabled = $false
  packagingGated = $true
}

$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$outputPath = Join-Path $InboxPath "selection-word-$stamp.json"
$json = $packet | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

$prompt = "请使用 AI 学徒插件的 manage_native_selection 读取最新 Word 原生选区，先复述你读到的文字和范围，再问我希望怎么改。不要关闭 Word，不要重写整份文档；默认后台准备，未经我允许不要控制屏幕。"
Set-Clipboard -Value $prompt
if ($OpenCompanion) {
  $companion = Join-Path $PluginRoot "assets\desktop-companion\AI-Apprentice-Companion.ps1"
  if (Test-Path -LiteralPath $companion) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $companion)
  }
}
if (-not $NoOpenCodex -and $CodexLink) { Start-Process $CodexLink }

[pscustomobject]@{
  status = "captured_for_agent_plugin"
  format = $packet.format
  selectionPath = $outputPath
  nativeLocator = $packet.selection.nativeLocator
  selectedText = $packet.selection.text
  codexLink = $CodexLink
  promptCopiedToClipboard = $true
  ownApiStarted = $false
  reasoningOwner = $packet.executionBoundary.reasoningOwner
} | ConvertTo-Json -Depth 6
