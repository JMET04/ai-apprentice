#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "software-observer-inventory")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "software-observer-inventory";
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

const goal = argValue("--goal", "Build a low-token observation inventory for software on this computer.");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "software-observer-inventories")));
const maxProcesses = Number(argValue("--max-processes", "80"));
const maxInstalled = Number(argValue("--max-installed", "160"));
const maxLogFilesPerCandidate = Number(argValue("--max-log-files-per-candidate", "6"));
const includeSystem = hasFlag("--include-system");

mkdirSync(outputRoot, { recursive: true });
const inventoryId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const inventoryDir = join(outputRoot, inventoryId);
mkdirSync(inventoryDir, { recursive: true });

const readmePath = join(inventoryDir, "SOFTWARE_INVENTORY_START_HERE.md");
const probePath = join(inventoryDir, "collect-software-observer-inventory.ps1");
const inventoryTemplatePath = join(inventoryDir, "software-observer-inventory-template.json");
const batchPlanPath = join(inventoryDir, "software-observer-batch-plan.json");
const manifestPath = join(inventoryDir, "software-observer-inventory-manifest.json");

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const commonLogRoots = [
  "%APPDATA%",
  "%LOCALAPPDATA%",
  "%PROGRAMDATA%",
  "%TEMP%",
  "%USERPROFILE%\\Documents",
  "%USERPROFILE%\\AppData\\Local\\CrashDumps"
];

const teachingStyleRoutes = [
  "silent work-along from log/event deltas",
  "step narration",
  "before/after examples",
  "drawn transparent overlay annotations",
  "voice explanation",
  "screen event exports",
  "manual teacher markers"
];

const inventoryTemplate = {
  format: "transparent_ai_software_observer_inventory_v1",
  inventoryId,
  goal,
  createdAt: new Date().toISOString(),
  source: "template_waiting_for_read_only_probe",
  discoveryScope: {
    runningProcesses: true,
    installedApplications: true,
    candidateLogRoots: commonLogRoots,
    boundedLogSourceIndex: true,
    maxLogFilesPerCandidate,
    windowsEventLogs: ["Application", "System"],
    includeSystemProcesses: includeSystem,
    maxProcesses,
    maxInstalled
  },
  softwareCandidates: [
    {
      software: "example-browser-or-editor",
      processName: "example",
      windowTitle: "Example active window",
      installPath: "",
      candidateLogRoots: ["%LOCALAPPDATA%\\Example", "%APPDATA%\\Example"],
      windowsEventLogs: ["Application"],
      confidence: 0.5,
      reason: "template row; replace with probe output"
    }
  ],
  locks
};

const batchPlan = {
  format: "transparent_ai_software_observer_batch_plan_v1",
  inventoryId,
  goal,
  strategy: "all_software_low_token_inventory_first",
  principle: "Inventory likely software and cheap evidence surfaces first; create per-software profiles/observers only for teacher-approved or goal-relevant candidates.",
  defaultNextTools: [
    "create_software_capability_profile",
    "create_software_observer_queue",
    "create_adaptive_software_observer_from_profile",
    "create_universal_software_observer_kit"
  ],
  perSoftwarePlanTemplate: {
    profileTool: "create_software_capability_profile",
    observerTool: "create_universal_software_observer_kit",
    adaptiveBridgeTool: "create_adaptive_software_observer_from_profile",
    preferredSignals: [
      "explicit log files",
      "candidate log roots",
      "Windows Event Log summaries",
      "file modified-time deltas",
      "process/window metadata",
      "manual teacher marker",
      "triggered screenshot only after meaningful state change"
    ],
    compactEvidenceFormat: "transparent_ai_universal_software_observation_v1"
  },
  teacherReviewQuestions: [
    "Which running or installed apps should the apprentice learn beside first?",
    "Which apps are private or out of scope and must be excluded?",
    "Should the observer ask by voice, floating text, or manual notes when a log change is ambiguous?",
    "Which teacher style should be preferred for this software: silent work-along, narration, examples, overlay, voice, or event export?"
  ],
  limits: [
    "This inventory does not guarantee every app exposes useful logs.",
    "This inventory does not enable native universal execution.",
    "The generated probe summarizes metadata and candidate roots; it does not upload files or continuously record the screen.",
    "Per-software observer setup remains teacher-review-only until the teacher chooses a candidate."
  ],
  locks
};

const probeScript = String.raw`param(
  [string]$OutputPath = "$(Join-Path $PSScriptRoot 'software-observer-inventory.json')",
  [int]$MaxProcesses = __MAX_PROCESSES__,
  [int]$MaxInstalled = __MAX_INSTALLED__,
  [int]$MaxLogFilesPerCandidate = __MAX_LOG_FILES_PER_CANDIDATE__,
  [switch]$IncludeSystem
)

$ErrorActionPreference = "Stop"

function Convert-ToSafeString($Value) {
  if ($null -eq $Value) { return "" }
  return [string]$Value
}

function Get-CandidateRoots($Name) {
  $SafeName = (Convert-ToSafeString $Name).Trim()
  $Roots = @($env:APPDATA, $env:LOCALAPPDATA, $env:PROGRAMDATA, $env:TEMP, (Join-Path $env:USERPROFILE "Documents"), (Join-Path $env:LOCALAPPDATA "CrashDumps")) |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  $Candidates = @()
  foreach ($Root in $Roots) {
    if ($SafeName) {
      $Candidates += (Join-Path $Root $SafeName)
    }
    $Candidates += $Root
  }
  @($Candidates | Select-Object -Unique | Select-Object -First 8)
}

function Test-LogLikePath($Path) {
  $Extension = [System.IO.Path]::GetExtension([string]$Path).ToLowerInvariant()
  @(".log", ".txt", ".jsonl", ".trace", ".etl", ".csv", ".out", ".err") -contains $Extension
}

function Add-LogFileMetadata($Path, [System.Collections.ArrayList]$Found, [int]$MaxFiles) {
  if ($Found.Count -ge $MaxFiles) { return }
  if (-not (Test-LogLikePath $Path)) { return }
  try {
    $Item = Get-Item -LiteralPath $Path -ErrorAction Stop
    if (-not $Item.PSIsContainer) {
      [void]$Found.Add([pscustomobject]@{
        path = $Item.FullName
        bytes = $Item.Length
        lastWriteTimeUtc = $Item.LastWriteTimeUtc.ToString("o")
        extension = $Item.Extension
        lowTokenUse = "metadata_first_then_tail_on_trigger"
      })
    }
  } catch {}
}

function Search-LogFilesBounded($Directory, [System.Collections.ArrayList]$Found, [int]$MaxFiles, [int]$Depth, [int]$MaxDepth) {
  if ($Found.Count -ge $MaxFiles -or $Depth -gt $MaxDepth) { return }
  if (-not (Test-Path -LiteralPath $Directory)) { return }
  try {
    $Files = @(Get-ChildItem -LiteralPath $Directory -File -ErrorAction SilentlyContinue | Select-Object -First 80)
    foreach ($File in $Files) {
      if ($Found.Count -ge $MaxFiles) { break }
      Add-LogFileMetadata $File.FullName $Found $MaxFiles
    }
    if ($Depth -ge $MaxDepth) { return }
    $Dirs = @(Get-ChildItem -LiteralPath $Directory -Directory -ErrorAction SilentlyContinue | Select-Object -First 32)
    foreach ($Dir in $Dirs) {
      if ($Found.Count -ge $MaxFiles) { break }
      Search-LogFilesBounded $Dir.FullName $Found $MaxFiles ($Depth + 1) $MaxDepth
    }
  } catch {}
}

function Get-CandidateLogFiles($Name, $Roots, [int]$MaxFiles) {
  $SafeName = (Convert-ToSafeString $Name).Trim()
  $Found = New-Object System.Collections.ArrayList
  foreach ($Root in @($Roots | Select-Object -First 8)) {
    if ($Found.Count -ge $MaxFiles) { break }
    if (-not $Root -or -not (Test-Path -LiteralPath $Root)) { continue }
    $Leaf = Split-Path -Leaf $Root
    $LeafMatches = $SafeName -and $Leaf -like "*$SafeName*"
    if ($LeafMatches) {
      Search-LogFilesBounded $Root $Found $MaxFiles 0 2
      continue
    }
    try {
      $MatchingDirs = @(Get-ChildItem -LiteralPath $Root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $SafeName -and $_.Name -like "*$SafeName*" } |
        Select-Object -First 8)
      foreach ($Dir in $MatchingDirs) {
        if ($Found.Count -ge $MaxFiles) { break }
        Search-LogFilesBounded $Dir.FullName $Found $MaxFiles 0 2
      }
      $RootFiles = @(Get-ChildItem -LiteralPath $Root -File -ErrorAction SilentlyContinue |
        Where-Object { Test-LogLikePath $_.FullName -and ((-not $SafeName) -or $_.Name -like "*$SafeName*") } |
        Select-Object -First $MaxFiles)
      foreach ($File in $RootFiles) {
        if ($Found.Count -ge $MaxFiles) { break }
        Add-LogFileMetadata $File.FullName $Found $MaxFiles
      }
    } catch {}
  }
  @($Found | Sort-Object lastWriteTimeUtc -Descending | Select-Object -First $MaxFiles)
}

$SkipNames = @("Idle", "System", "Registry", "smss", "csrss", "wininit", "services", "lsass", "svchost", "fontdrvhost", "dwm")
$Processes = @(Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $IncludeSystem -or ($SkipNames -notcontains $_.ProcessName) } |
  Sort-Object ProcessName |
  Select-Object -First $MaxProcesses |
  ForEach-Object {
    $Path = ""
    try { $Path = $_.Path } catch { $Path = "" }
    $Roots = Get-CandidateRoots $_.ProcessName
    $LogFiles = Get-CandidateLogFiles $_.ProcessName $Roots $MaxLogFilesPerCandidate
    [pscustomobject]@{
      software = $_.ProcessName
      processName = $_.ProcessName
      processId = $_.Id
      windowTitle = Convert-ToSafeString $_.MainWindowTitle
      installPath = Convert-ToSafeString $Path
      candidateLogRoots = $Roots
      candidateLogFiles = $LogFiles
      windowsEventLogs = @("Application", "System")
      confidence = if ($_.MainWindowTitle) { 0.72 } else { 0.55 }
      reason = if (@($LogFiles).Count -gt 0) { "running_process_metadata_with_log_source_index" } else { "running_process_metadata" }
    }
  })

$UninstallRoots = @(
  "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
  "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
)
$Installed = @()
foreach ($Root in $UninstallRoots) {
  try {
    $Installed += @(Get-ItemProperty -Path $Root -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName } |
      Select-Object -First $MaxInstalled |
      ForEach-Object {
        $Roots = Get-CandidateRoots $_.DisplayName
        $LogFiles = Get-CandidateLogFiles $_.DisplayName $Roots $MaxLogFilesPerCandidate
        [pscustomobject]@{
          software = Convert-ToSafeString $_.DisplayName
          processName = ""
          windowTitle = ""
          installPath = Convert-ToSafeString $_.InstallLocation
          candidateLogRoots = $Roots
          candidateLogFiles = $LogFiles
          windowsEventLogs = @("Application")
          confidence = if (@($LogFiles).Count -gt 0) { 0.52 } else { 0.45 }
          reason = if (@($LogFiles).Count -gt 0) { "installed_application_registry_with_log_source_index" } else { "installed_application_registry" }
        }
      })
  } catch {}
}

$AllCandidates = @($Processes + $Installed |
  Where-Object { $_.software } |
  Sort-Object software -Unique)

$LogSourceIndex = @($AllCandidates |
  ForEach-Object {
    [pscustomobject]@{
      software = $_.software
      processName = $_.processName
      sourceReason = $_.reason
      candidateLogFileCount = @($_.candidateLogFiles).Count
      candidateLogFiles = @($_.candidateLogFiles)
      windowsEventLogs = @($_.windowsEventLogs)
      lowTokenPolicy = "metadata_only_now_tail_only_on_trigger"
    }
  } |
  Where-Object { $_.candidateLogFileCount -gt 0 } |
  Sort-Object candidateLogFileCount -Descending)

$Inventory = [pscustomobject]@{
  format = "transparent_ai_software_observer_inventory_v1"
  logSourceIndexFormat = "transparent_ai_all_software_log_source_index_v1"
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  source = "read_only_local_probe"
  discoveryScope = [pscustomobject]@{
    runningProcesses = $true
    installedApplications = $true
    candidateLogRoots = @("%APPDATA%", "%LOCALAPPDATA%", "%PROGRAMDATA%", "%TEMP%", "%USERPROFILE%\Documents", "%USERPROFILE%\AppData\Local\CrashDumps")
    windowsEventLogs = @("Application", "System")
    boundedLogSourceIndex = $true
    maxLogFilesPerCandidate = $MaxLogFilesPerCandidate
    logContentsRead = $false
    fullContinuousRecording = $false
    nativeUniversalExecution = $false
  }
  softwareCandidates = @($AllCandidates | Select-Object -First ($MaxProcesses + $MaxInstalled))
  logSourceIndex = [pscustomobject]@{
    format = "transparent_ai_all_software_log_source_index_v1"
    source = "bounded_metadata_only_inventory_probe"
    logContentsRead = $false
    fullLogsRead = $false
    indexedSoftwareCount = @($LogSourceIndex).Count
    indexedLogFileCount = @($LogSourceIndex | ForEach-Object { $_.candidateLogFileCount } | Measure-Object -Sum).Sum
    entries = @($LogSourceIndex)
  }
  nextTools = @("create_software_capability_profile", "create_adaptive_software_observer_from_profile", "create_universal_software_observer_kit")
  locks = [pscustomobject]@{
    ruleEnabled = $false
    accepted = $false
    technologyAccepted = $false
    packagingGated = $true
    fullContinuousRecording = $false
    nativeUniversalExecution = $false
    teacherConfirmationRequired = $true
  }
}

$Inventory | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output ($Inventory | ConvertTo-Json -Depth 12)
`
  .replace("__MAX_PROCESSES__", String(maxProcesses))
  .replace("__MAX_INSTALLED__", String(maxInstalled))
  .replace("__MAX_LOG_FILES_PER_CANDIDATE__", String(maxLogFilesPerCandidate));

const readme = `# Software Observer Inventory

Goal: ${goal}

This kit creates an all-software, low-token observation inventory before any per-app learning run. It reuses existing capabilities:

1. Run \`collect-software-observer-inventory.ps1\` to collect read-only process, installed-app, candidate-root, bounded log-source metadata, and Windows Event Log metadata.
2. Review \`software-observer-inventory.json\` and exclude private or irrelevant apps.
3. For selected candidates, call \`create_software_capability_profile\`, then \`create_adaptive_software_observer_from_profile\` or \`create_universal_software_observer_kit\`.
4. Use transparent overlay or examples only when logs/events are not enough.

It does not continuously record the screen and does not claim native universal software execution.
`;

const manifest = {
  format: "transparent_ai_software_observer_inventory_manifest_v1",
  inventoryId,
  goal,
  createdAt: new Date().toISOString(),
  files: {
    readme: readmePath,
    readOnlyProbe: probePath,
    inventoryTemplate: inventoryTemplatePath,
    batchPlan: batchPlanPath,
    manifest: manifestPath
  },
  capabilities: {
    inventoriesRunningProcesses: true,
    inventoriesInstalledApplications: true,
    buildsAllSoftwareLogSourceIndex: true,
    logSourceIndexFormat: "transparent_ai_all_software_log_source_index_v1",
    readsLogContentsByDefault: false,
    proposesPerSoftwareLowTokenSources: true,
    notHardcodedToCadOrSolidWorks: true,
    supportsDifferentTeachingStyles: teachingStyleRoutes,
    fullContinuousRecording: false,
    nativeUniversalExecution: false,
    teacherReviewOnly: true
  },
  nextMcpCalls: batchPlan.defaultNextTools,
  locks
};

writeFileSync(readmePath, readme, "utf8");
writeUtf8Bom(probePath, probeScript);
writeFileSync(inventoryTemplatePath, JSON.stringify(inventoryTemplate, null, 2), "utf8");
writeFileSync(batchPlanPath, JSON.stringify(batchPlan, null, 2), "utf8");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_software_observer_inventory_result_v1",
  inventoryId,
  inventoryDir,
  readme: readmePath,
  readOnlyProbe: probePath,
  inventoryTemplate: inventoryTemplatePath,
  batchPlan: batchPlanPath,
  manifest: manifestPath,
  defaultNextTools: batchPlan.defaultNextTools,
  candidateLogRoots: commonLogRoots,
  maxLogFilesPerCandidate,
  logSourceIndexFormat: "transparent_ai_all_software_log_source_index_v1",
  teachingStyleRoutes,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  locks
}, null, 2));
