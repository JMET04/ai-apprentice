param(
  [string]$InboxPath = "",
  [string]$CodexLink = ""
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
$createdNew = $false
$mutex = [Threading.Mutex]::new($true, "AI_APPR_DESKTOP_COMPANION_V1", [ref]$createdNew)
if (-not $createdNew) { return }
$PluginRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$WorkspaceRoot = Split-Path -Parent (Split-Path -Parent $PluginRoot)
if (-not $InboxPath) { $InboxPath = Join-Path $WorkspaceRoot ".transparent-apprentice\native-selections\inbox" }
New-Item -ItemType Directory -Path $InboxPath -Force | Out-Null

[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        Title="AI 学徒桌面助手" Width="390" Height="530" WindowStyle="None"
        AllowsTransparency="True" Background="Transparent" Topmost="True"
        ShowInTaskbar="True" ResizeMode="CanResizeWithGrip">
  <Border CornerRadius="8" Background="#F7F9FA" BorderBrush="#AAB7BE" BorderThickness="1">
    <Grid>
      <Grid.RowDefinitions><RowDefinition Height="82"/><RowDefinition Height="*"/><RowDefinition Height="62"/></Grid.RowDefinitions>
      <Border Grid.Row="0" Name="HeaderBorder" Background="#17333F" CornerRadius="8,8,0,0">
        <Grid Margin="16,12"><Grid.ColumnDefinitions><ColumnDefinition Width="58"/><ColumnDefinition Width="*"/><ColumnDefinition Width="36"/></Grid.ColumnDefinitions>
          <Grid Width="48" Height="48">
            <Ellipse Fill="#2F9BC7" Stroke="#BFEAF5" StrokeThickness="2"/>
            <Rectangle Width="26" Height="20" RadiusX="5" RadiusY="5" Fill="#EAF8FC"/>
            <Ellipse Width="4" Height="4" Fill="#17333F" HorizontalAlignment="Left" Margin="17,0,0,0"/>
            <Ellipse Width="4" Height="4" Fill="#17333F" HorizontalAlignment="Right" Margin="0,0,17,0"/>
            <Line X1="24" Y1="4" X2="24" Y2="0" Stroke="#BFEAF5" StrokeThickness="2"/>
          </Grid>
          <StackPanel Grid.Column="1" Margin="10,2,0,0"><TextBlock Text="AI 学徒助手" Foreground="White" FontSize="17" FontWeight="SemiBold"/><TextBlock Text="读取宿主选区，交给当前 Agent" Foreground="#BFEAF5" Margin="0,4,0,0"/></StackPanel>
          <Button Grid.Column="2" Name="CloseButton" Content="×" Foreground="White" Background="Transparent" BorderThickness="0" FontSize="22" ToolTip="关闭助手"/>
        </Grid>
      </Border>
      <ScrollViewer Grid.Row="1" VerticalScrollBarVisibility="Auto"><StackPanel Margin="18">
        <TextBlock Text="当前原生选区" FontWeight="SemiBold" Foreground="#17333F"/>
        <Border Margin="0,8,0,0" Padding="12" Background="White" BorderBrush="#CCD6DB" BorderThickness="1" CornerRadius="4">
          <StackPanel><TextBlock Name="HostText" Text="等待 Word 或工程软件选区" FontWeight="SemiBold"/><TextBlock Name="SelectionText" Margin="0,6,0,0" TextWrapping="Wrap" Foreground="#40545D" MaxHeight="90"/></StackPanel>
        </Border>
        <TextBlock Text="你的修改意见" FontWeight="SemiBold" Foreground="#17333F" Margin="0,16,0,0"/>
        <TextBox Name="InstructionBox" Margin="0,8,0,0" MinHeight="105" AcceptsReturn="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto" ToolTip="说明只需要修改什么，以及哪些内容保持不变"/>
        <CheckBox Name="BackgroundCheck" IsChecked="True" Margin="0,16,0,0" Content="后台准备修改，不抢占当前屏幕"/>
        <CheckBox Name="ScreenControlCheck" IsChecked="False" Margin="0,10,0,0" Content="这一次允许 Agent 使用屏幕控制兜底"/>
        <TextBlock Margin="0,14,0,0" Foreground="#6A4C00" TextWrapping="Wrap" Text="桌面助手不运行模型。它只把选区和意见交给 Codex 中正在使用 AI 学徒插件的 Agent。"/>
      </StackPanel></ScrollViewer>
      <Grid Grid.Row="2" Margin="18,8,18,12"><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="12"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
        <Button Name="RefreshButton" Content="刷新选区" Padding="12,8" ToolTip="重新读取插件收件箱"/>
        <Button Name="OpenAgentButton" Grid.Column="2" Content="交给 Agent" Padding="12,8" Background="#176F93" Foreground="White" BorderBrush="#176F93" ToolTip="保存意见到当前 Agent 插件收件箱"/>
      </Grid>
    </Grid>
  </Border>
</Window>
'@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)
$hostText = $window.FindName("HostText")
$selectionText = $window.FindName("SelectionText")
$instructionBox = $window.FindName("InstructionBox")
$backgroundCheck = $window.FindName("BackgroundCheck")
$screenControlCheck = $window.FindName("ScreenControlCheck")

$script:latestPath = ""
$script:latestWriteTime = [DateTime]::MinValue
function Refresh-Selection {
  $latest = Get-ChildItem -LiteralPath $InboxPath -Filter "selection-*.json" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if (-not $latest) {
    $hostText.Text = "等待 Word 或工程软件选区"
    $selectionText.Text = "选中文字或对象后右键唤起 AI 学徒。"
    $script:latestPath = ""
    return
  }
  $data = Get-Content -LiteralPath $latest.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  $script:latestPath = $latest.FullName
  $script:latestWriteTime = $latest.LastWriteTimeUtc
  $hostText.Text = "$($data.host.application) · $($data.host.documentName)"
  if ($data.surfaceKind -eq "office_native_text") {
    $selectionText.Text = "$($data.selection.nativeLocator)`n$($data.selection.text)"
  } else {
    $selectionText.Text = "$($data.selection.objectType) · $($data.selection.objectId)`n$($data.selection.nativeLocator)"
  }
}

$window.FindName("CloseButton").Add_Click({ $window.Close() })
$window.FindName("RefreshButton").Add_Click({ Refresh-Selection })
$window.FindName("OpenAgentButton").Add_Click({
  if (-not $script:latestPath) { [System.Windows.MessageBox]::Show("请先在 Word 或工程软件中选择内容。", "AI 学徒") | Out-Null; return }
  $data = Get-Content -LiteralPath $script:latestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $requestedAt = [DateTime]::UtcNow.ToString("o")
  $previousRevision = if ($null -ne $data.teacherInstructionRevision) { [int]$data.teacherInstructionRevision } else { 0 }
  $revision = $previousRevision + 1
  $backgroundPreparation = [bool]$backgroundCheck.IsChecked
  $allowScreenControl = [bool]$screenControlCheck.IsChecked
  $history = if ($null -ne $data.teacherInstructionHistory) { @($data.teacherInstructionHistory) } else { @() }
  $history += [pscustomobject]@{
    revision = $revision
    instruction = $instructionBox.Text
    requestedAt = $requestedAt
    backgroundPreparation = $backgroundPreparation
    allowScreenControl = $allowScreenControl
  }
  $data | Add-Member -NotePropertyName teacherInstructionDraft -NotePropertyValue $instructionBox.Text -Force
  $data | Add-Member -NotePropertyName teacherInstructionRevision -NotePropertyValue $revision -Force
  $data | Add-Member -NotePropertyName teacherInstructionHistory -NotePropertyValue $history -Force
  $data | Add-Member -NotePropertyName handoffRequestedAt -NotePropertyValue $requestedAt -Force
  $data | Add-Member -NotePropertyName preparationMode -NotePropertyValue $(if ($backgroundPreparation) { "background" } else { "foreground" }) -Force
  $data | Add-Member -NotePropertyName screenControlPolicy -NotePropertyValue $(if ($allowScreenControl) { "explicit_opt_in" } else { "disabled" }) -Force
  $data | Add-Member -NotePropertyName interactionPreference -NotePropertyValue ([pscustomobject]@{
    backgroundPreparation = $backgroundPreparation
    allowScreenControl = $allowScreenControl
    keepHostDocumentOpen = $true
  }) -Force
  $updated = $data | ConvertTo-Json -Depth 14
  [IO.File]::WriteAllText($script:latestPath, $updated + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  $prompt = "请用 AI 学徒插件读取最新原生选区。我的第 $revision 版修改意见已写在 teacherInstructionDraft 和 teacherInstructionHistory。先复述选区、修订号和变更范围，再给出局部修改预览并等我审核。保持宿主文件打开；按 interactionPreference 决定后台处理。只有 screenControlPolicy=explicit_opt_in 时才允许屏幕控制兜底。"
  Set-Clipboard -Value $prompt
  $hostText.Text = "意见已保存到当前 Agent 收件箱"
  $selectionText.Text = "提示词已复制。请回到当前 Codex 任务粘贴发送，插件会读取这次选区和第 $revision 版意见。"
  if ($CodexLink) { Start-Process $CodexLink }
})
$window.FindName("HeaderBorder").Add_MouseLeftButtonDown({ if ($_.ChangedButton -eq "Left") { $window.DragMove() } })

$workArea = [System.Windows.SystemParameters]::WorkArea
$window.Left = $workArea.Right - $window.Width - 18
$window.Top = $workArea.Bottom - $window.Height - 18
$timer = New-Object Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(700)
$timer.Add_Tick({
  $latest = Get-ChildItem -LiteralPath $InboxPath -Filter "selection-*.json" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if ($latest -and ($latest.FullName -ne $script:latestPath -or $latest.LastWriteTimeUtc -gt $script:latestWriteTime)) {
    Refresh-Selection
    $window.Activate() | Out-Null
  }
})
$window.Add_Closed({ $timer.Stop(); try { $mutex.ReleaseMutex() } catch {}; $mutex.Dispose() })
Refresh-Selection
$timer.Start()
$window.ShowDialog() | Out-Null
