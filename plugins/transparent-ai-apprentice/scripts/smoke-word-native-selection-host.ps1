param([Parameter(Mandatory = $true)][string]$StateDirectory)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
$readyPath = Join-Path $StateDirectory "ready.json"
$stopPath = Join-Path $StateDirectory "stop"
$resultPath = Join-Path $StateDirectory "result.json"
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Add()
  $document.Content.Text = "本方案将在周五提交审核。其他内容保持不变。"
  $allText = [string]$document.Content.Text
  $start = $allText.IndexOf("周五")
  $word.Selection.SetRange($start, $start + 2)
  $ready = [ordered]@{
    status = "ready"
    hwnd = $word.Hwnd
    documentName = $document.Name
    selection = [string]$word.Selection.Text
    start = $word.Selection.Start
    end = $word.Selection.End
  }
  [IO.File]::WriteAllText($readyPath, ($ready | ConvertTo-Json) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  while (-not (Test-Path -LiteralPath $stopPath)) { Start-Sleep -Milliseconds 100 }
  $result = [ordered]@{
    status = "completed"
    documentName = $document.Name
    text = [string]$document.Content.Text
    documentWasStillOpen = $document.Windows.Count -ge 0
  }
  [IO.File]::WriteAllText($resultPath, ($result | ConvertTo-Json) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
} finally {
  if ($document) { try { $document.Close(0) } catch {} }
  if ($word) { try { $word.Quit() } catch {} }
}
