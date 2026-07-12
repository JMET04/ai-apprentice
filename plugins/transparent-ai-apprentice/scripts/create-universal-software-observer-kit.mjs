#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function slugify(value) {
  return String(value || "universal-software-observer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "universal-software-observer";
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

const goal = argValue("--goal", "Learn how the teacher works in an arbitrary software application.");
const software = argValue("--software", argValue("--app", "unknown software"));
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const outputRoot = argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "universal-observer-kits"));
const logPaths = [...argValues("--log-path"), ...argValues("--log")];
const logRoots = [...argValues("--log-root"), ...argValues("--folder")];
const eventLogs = argValues("--windows-event-log");

mkdirSync(outputRoot, { recursive: true });
const kitId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const kitDir = join(outputRoot, kitId);
mkdirSync(kitDir, { recursive: true });

const readmePath = join(kitDir, "UNIVERSAL_OBSERVER_START_HERE.md");
const collectorPath = join(kitDir, "collect-universal-observation.ps1");
const manifestPath = join(kitDir, "universal-observer-manifest.json");
const sourceCatalogPath = join(kitDir, "software-source-catalog.json");
const policyPath = join(kitDir, "universal-observation-policy.json");
const evidenceTemplatePath = join(kitDir, "universal-observation-template.json");

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeControlImplemented: false,
  teacherConfirmationRequired: true
};

const sourceCatalog = {
  format: "transparent_ai_universal_software_source_catalog_v1",
  kitId,
  software,
  processName,
  windowTitle,
  explicitLogPaths: logPaths,
  explicitLogRoots: logRoots,
  windowsEventLogs: eventLogs.length > 0 ? eventLogs : ["Application", "System"],
  discoveryOrder: [
    "teacher-provided log paths",
    "teacher-provided log root folders",
    "process-name matching under AppData Local/Roaming, ProgramData, Temp, and workspace",
    "Windows Event Log recent entries for Application/System or teacher-selected logs",
    "file modified-time deltas",
    "manual teacher marker",
    "triggered screenshot only after meaningful state change"
  ],
  commonLogRootHints: [
    "%APPDATA%",
    "%LOCALAPPDATA%",
    "%PROGRAMDATA%",
    "%TEMP%",
    "%USERPROFILE%\\Documents",
    "%USERPROFILE%\\AppData\\Local\\CrashDumps",
    "current workspace"
  ],
  notHardcodedToSoftware: true,
  customNativeIntegrationRequired: false,
  locks
};

const observationPolicy = {
  format: "transparent_ai_universal_observation_policy_v1",
  kitId,
  goal,
  software,
  principle: "Adapt to any teacher's software by discovering cheap local evidence before spending tokens on screenshots.",
  lowTokenStrategy: [
    "Summarize changed file paths, log tail hashes, and event counts instead of full logs.",
    "Store only compact tail snippets around error/warning/state-change keywords.",
    "Prefer process/window/event metadata before screenshots.",
    "Ask the teacher only when evidence is ambiguous or a reusable rule boundary is missing.",
    "Emit transparent_ai_universal_software_observation_v1 for teach_apprentice."
  ],
  triggerKeywords: [
    "error",
    "exception",
    "failed",
    "warning",
    "blocked",
    "denied",
    "timeout",
    "saved",
    "exported",
    "completed",
    "回滚",
    "失败",
    "错误",
    "警告",
    "完成",
    "导出"
  ],
  screenshotPolicy: {
    defaultMode: "on_trigger_only",
    fullContinuousRecording: false,
    minimumSecondsBetweenSnapshots: 20,
    reasonRequired: true
  },
  teacherAdaptation: {
    supportsDifferentTeachingStyles: [
      "step narration",
      "before/after examples",
      "drawn overlay annotations",
      "voice explanation",
      "screen event exports",
      "logs and event deltas",
      "manual markers"
    ],
    askPreferenceBeforeLongObservation: true
  },
  locks
};

const collectorScript = String.raw`param(
  [string]$ManifestPath = "$(Join-Path $PSScriptRoot 'universal-observer-manifest.json')",
  [int]$TailLines = 80,
  [int]$RecentEventMinutes = 15
)

$ErrorActionPreference = "Stop"
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$KitDir = Split-Path -Parent $ManifestPath
$EventsPath = Join-Path $KitDir "universal-observation-events.jsonl"
$SummaryPath = Join-Path $KitDir "universal-observation-summary.json"

function Add-JsonLine($Object) {
  ($Object | ConvertTo-Json -Depth 8 -Compress) + [Environment]::NewLine | Add-Content -LiteralPath $EventsPath -Encoding UTF8
}

function Get-LogTailSummary($Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $Item = Get-Item -LiteralPath $Path
  $Tail = Get-Content -LiteralPath $Path -Tail $TailLines -ErrorAction SilentlyContinue
  $Interesting = @($Tail | Where-Object { $_ -match '(?i)error|exception|failed|warning|blocked|denied|timeout|saved|exported|completed|回滚|失败|错误|警告|完成|导出' })
  [pscustomobject]@{
    path = $Item.FullName
    lastWriteTimeUtc = $Item.LastWriteTimeUtc.ToString("o")
    bytes = $Item.Length
    tailLineCount = @($Tail).Count
    interestingLineCount = @($Interesting).Count
    interestingTail = @($Interesting | Select-Object -Last 12)
  }
}

$CandidateLogs = @()
foreach ($Path in @($Manifest.sourceCatalog.explicitLogPaths)) {
  if ($Path) { $CandidateLogs += $Path }
}
foreach ($Root in @($Manifest.sourceCatalog.explicitLogRoots)) {
  if ($Root -and (Test-Path -LiteralPath $Root)) {
    $CandidateLogs += @(Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Extension -match '\.(log|txt|jsonl|trace|etl|csv)$' } |
      Sort-Object LastWriteTimeUtc -Descending |
      Select-Object -First 30 |
      ForEach-Object { $_.FullName })
  }
}

$ProcessName = [string]$Manifest.sourceCatalog.processName
if ($ProcessName) {
  $Roots = @($env:APPDATA, $env:LOCALAPPDATA, $env:PROGRAMDATA, $env:TEMP, (Get-Location).Path) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  foreach ($Root in $Roots) {
    $CandidateLogs += @(Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match [regex]::Escape($ProcessName) -and $_.Extension -match '\.(log|txt|jsonl|trace|csv)$' } |
      Sort-Object LastWriteTimeUtc -Descending |
      Select-Object -First 15 |
      ForEach-Object { $_.FullName })
  }
}

$LogSummaries = @()
foreach ($Path in @($CandidateLogs | Select-Object -Unique | Select-Object -First 80)) {
  $Summary = Get-LogTailSummary $Path
  if ($Summary) {
    $LogSummaries += $Summary
    if ($Summary.interestingLineCount -gt 0) {
      Add-JsonLine ([pscustomobject]@{
        format = "transparent_ai_universal_observation_event_v1"
        type = "interesting_log_delta"
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        source = $Summary.path
        summary = $Summary
      })
    }
  }
}

$EventSummaries = @()
foreach ($EventLog in @($Manifest.sourceCatalog.windowsEventLogs)) {
  try {
    $Since = (Get-Date).AddMinutes(-1 * $RecentEventMinutes)
    $Events = @(Get-WinEvent -FilterHashtable @{ LogName = $EventLog; StartTime = $Since } -MaxEvents 25 -ErrorAction SilentlyContinue)
    $EventSummaries += [pscustomobject]@{
      logName = $EventLog
      recentCount = $Events.Count
      latest = @($Events | Select-Object -First 5 | ForEach-Object {
        [pscustomobject]@{
          provider = $_.ProviderName
          id = $_.Id
          level = $_.LevelDisplayName
          timeCreatedUtc = $_.TimeCreated.ToUniversalTime().ToString("o")
          messagePreview = ($_.Message -replace '\s+', ' ').Substring(0, [Math]::Min(240, ($_.Message -replace '\s+', ' ').Length))
        }
      })
    }
  } catch {
    $EventSummaries += [pscustomobject]@{ logName = $EventLog; error = $_.Exception.Message }
  }
}

$Observation = [pscustomobject]@{
  format = "transparent_ai_universal_software_observation_v1"
  kitId = $Manifest.kitId
  software = $Manifest.software
  processName = $Manifest.sourceCatalog.processName
  windowTitle = $Manifest.sourceCatalog.windowTitle
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  fullContinuousRecording = $false
  logSummaries = $LogSummaries
  eventSummaries = $EventSummaries
  needsTeacherQuestion = (($LogSummaries | Where-Object { $_.interestingLineCount -gt 0 }).Count -gt 0)
  suggestedTeacherQuestions = @(
    "Which of these log or event changes matters for the reusable rule?",
    "Is this a success, warning, failure, or normal state change?",
    "Should the apprentice ask before acting when this signal appears again?"
  )
  locks = $Manifest.locks
}

$Observation | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $SummaryPath -Encoding UTF8
Write-Output ($Observation | ConvertTo-Json -Depth 10)
`;

const manifest = {
  format: "transparent_ai_universal_software_observer_manifest_v1",
  kitId,
  goal,
  software,
  sourceCatalog,
  observationPolicy,
  files: {
    readme: readmePath,
    collector: collectorPath,
    sourceCatalog: sourceCatalogPath,
    policy: policyPath,
    evidenceTemplate: evidenceTemplatePath,
    manifest: manifestPath
  },
  nextTeachingCall: {
    tool: "compact_universal_observation_learning_events",
    message: "Run the collector, then compress transparent_ai_universal_software_observation_v1 into compact learning events before teaching."
  },
  nextCompactLearningTool: "compact_universal_observation_learning_events",
  locks
};

const evidenceTemplate = {
  format: "transparent_ai_universal_software_observation_v1",
  kitId,
  software,
  fullContinuousRecording: false,
  logSummaries: [],
  eventSummaries: [],
  teacherNotes: [],
  overlaySketchPackets: [],
  suggestedTeacherQuestions: [],
  locks
};

writeFileSync(readmePath, [
  "# Universal Software Observer Kit",
  "",
  `Goal: ${goal}`,
  `Software: ${software}`,
  "",
  "This kit is not hardcoded to CAD or SolidWorks. It first discovers cheap local evidence for any software: teacher-provided logs, log root folders, process-name matches, Windows Event Log entries, file modified-time deltas, and manual teacher markers.",
  "",
  "Run:",
  "",
  "```powershell",
  ".\\collect-universal-observation.ps1",
  "```",
  "",
  "Then compress the generated `transparent_ai_universal_software_observation_v1` into compact learning events:",
  "",
  "```bash",
  "node plugins/transparent-ai-apprentice/scripts/compact-universal-observation-learning-events.mjs --observation universal-observation-summary.json",
  "```",
  "",
  "Paste `compact-learning-events.json` back to `teach_apprentice` and answer which event represents the reusable rule boundary.",
  "",
  "Limits: this is a low-token observer, not a universal native controller. It does not claim every application exposes useful logs. It adapts by discovering sources and asking the teacher when evidence is ambiguous.",
  "",
  "Locked defaults: ruleEnabled=false, accepted=false, technologyAccepted=false, packagingGated=true."
].join("\n"), "utf8");
writeUtf8Bom(collectorPath, collectorScript);
writeFileSync(sourceCatalogPath, JSON.stringify(sourceCatalog, null, 2), "utf8");
writeFileSync(policyPath, JSON.stringify(observationPolicy, null, 2), "utf8");
writeFileSync(evidenceTemplatePath, JSON.stringify(evidenceTemplate, null, 2), "utf8");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_universal_software_observer_kit_result_v1",
  kitId,
  kitPath: manifestPath,
  teacherReadme: readmePath,
  collector: collectorPath,
  sourceCatalog: sourceCatalogPath,
  observationPolicy: policyPath,
  evidenceTemplate: evidenceTemplatePath,
  nextCompactLearningTool: "compact_universal_observation_learning_events",
  fullContinuousRecording: false,
  notHardcodedToSoftware: true,
  customNativeIntegrationRequired: false,
  reviewLocks: locks
}, null, 2));
