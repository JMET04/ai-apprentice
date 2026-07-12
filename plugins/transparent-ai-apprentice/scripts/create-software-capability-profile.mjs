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
  return String(value || "software-capability-profile")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "software-capability-profile";
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

function inferSoftwareFamily(text) {
  const normalized = String(text || "").toLowerCase();
  const families = [
    {
      id: "browser-saas",
      markers: ["browser", "chrome", "edge", "firefox", "web", "saas", "crm", "erp", "admin"],
      usefulChannels: ["browser recorder events", "audit logs", "network/export artifacts", "window title", "triggered screenshots"]
    },
    {
      id: "ide-terminal",
      markers: ["ide", "code", "vscode", "visual studio", "terminal", "git", "test", "compiler", "cli"],
      usefulChannels: ["terminal output", "test logs", "changed files", "debug console", "workspace deltas"]
    },
    {
      id: "office-data",
      markers: ["excel", "sheet", "word", "powerpoint", "office", "spreadsheet", "power bi", "tableau"],
      usefulChannels: ["recent document paths", "exported tables", "formula/error messages", "file modified-time deltas"]
    },
    {
      id: "design-media-3d",
      markers: ["figma", "photoshop", "illustrator", "blender", "maya", "fusion", "cad", "cam", "cae", "solidworks", "slicer"],
      usefulChannels: ["export/render logs", "asset snapshots", "model file deltas", "transparent sketch overlay packets"]
    },
    {
      id: "database-ops",
      markers: ["database", "postgres", "mysql", "sqlite", "sql", "db", "redis", "server"],
      usefulChannels: ["server logs", "query output", "migration files", "Windows Event Log", "service status"]
    }
  ];
  return families.find((family) => family.markers.some((marker) => normalized.includes(marker))) ?? {
    id: "unknown-desktop-software",
    markers: [],
    usefulChannels: ["process/window metadata", "candidate log roots", "Windows Event Log", "file deltas", "teacher markers"]
  };
}

const goal = argValue("--goal", argValue("--task", "Discover how to observe this software with low token cost."));
const software = argValue("--software", argValue("--app", "unknown software"));
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", "");
const installPath = argValue("--install-path", "");
const outputRoot = argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "software-capability-profiles"));
const explicitLogPaths = [...argValues("--log-path"), ...argValues("--log")];
const explicitLogRoots = [...argValues("--log-root"), ...argValues("--folder")];
const windowsEventLogs = argValues("--windows-event-log");
const teachingStyles = argValues("--teaching-style");

mkdirSync(outputRoot, { recursive: true });
const profileId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const profileDir = join(outputRoot, profileId);
mkdirSync(profileDir, { recursive: true });

const readmePath = join(profileDir, "SOFTWARE_PROFILE_START_HERE.md");
const probePath = join(profileDir, "probe-software-capability.ps1");
const profilePath = join(profileDir, "software-capability-profile.json");
const observationPlanPath = join(profileDir, "software-observation-plan.json");
const nextObserverArgsPath = join(profileDir, "next-observer-arguments.json");
const teacherAdaptationPath = join(profileDir, "teacher-method-adaptation.json");

const family = inferSoftwareFamily(`${software} ${processName} ${windowTitle} ${goal}`);
const eventLogs = windowsEventLogs.length > 0 ? windowsEventLogs : ["Application", "System"];
const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const searchRoots = [
  ...explicitLogRoots,
  "%APPDATA%",
  "%LOCALAPPDATA%",
  "%PROGRAMDATA%",
  "%TEMP%",
  "%USERPROFILE%\\Documents",
  "%USERPROFILE%\\AppData\\Local\\CrashDumps",
  "current workspace"
];

const profile = {
  format: "transparent_ai_software_capability_profile_v1",
  profileId,
  goal,
  software,
  processName,
  windowTitle,
  installPath,
  inferredFamily: family.id,
  confidence: processName || windowTitle || explicitLogPaths.length || explicitLogRoots.length ? "medium" : "low",
  observableChannels: [
    "explicit log files",
    "candidate log roots",
    "process metadata",
    "main window title",
    "Windows Event Log",
    "modified file deltas",
    "manual teacher marker",
    "triggered screenshot",
    "transparent sketch overlay packet"
  ],
  familyUsefulChannels: family.usefulChannels,
  explicitLogPaths,
  candidateLogRoots: searchRoots,
  windowsEventLogs: eventLogs,
  noTokenFirstProbeOrder: [
    "match running process and visible window metadata",
    "check explicit log files and roots",
    "sample recent Windows Event Log counts",
    "summarize modified file candidates instead of reading full files",
    "ask the teacher which signal matters when confidence is low",
    "trigger screenshot only when a source changed or teacher marks a checkpoint"
  ],
  teachingStyleAdaptation: {
    supported: [
      "teacher works silently while logs change",
      "teacher narrates steps",
      "teacher draws on transparent overlay",
      "teacher gives before/after examples",
      "teacher exports recorder events",
      "teacher answers short boundary questions"
    ],
    requested: teachingStyles,
    askPreferenceBeforeLongObservation: true
  },
  limits: [
    "This profile discovers likely observation sources; it does not prove every app exposes useful logs.",
    "The generated probe is read-only by default.",
    "The apprentice must keep rules disabled until teacher review and approval.",
    "GUI execution remains supervised and dry-run-first through the supervised action bridge."
  ],
  locks
};

const observationPlan = {
  format: "transparent_ai_software_observation_plan_v1",
  profileId,
  software,
  principle: "Use existing OS and application signals before spending tokens on screenshots or video.",
  stages: [
    {
      id: "profile_read_only_probe",
      action: "Run the generated PowerShell probe or inspect the JSON profile.",
      evidence: "software-capability-probe-result.json",
      tokenCost: "low",
      continueWhen: "candidate logs, events, or file deltas are found",
      stopWhen: "probe cannot identify the app and teacher has not provided a process/window/log hint"
    },
    {
      id: "create_universal_observer",
      action: "Create a universal observer kit using the discovered process, log roots, and event logs.",
      evidence: "transparent_ai_universal_software_observation_v1",
      tokenCost: "low",
      continueWhen: "observation summary includes a meaningful changed source",
      stopWhen: "no source changed and the teacher did not mark a checkpoint"
    },
    {
      id: "workalong_learning",
      action: "Use workalong collector and teacher questions only on ambiguity or reusable rule boundaries.",
      evidence: "transparent_ai_workalong_observation_v1",
      tokenCost: "medium only on triggers",
      continueWhen: "teacher confirms the source interpretation",
      stopWhen: "the teacher says not to save or asks to rollback"
    },
    {
      id: "overlay_to_supervised_action",
      action: "If the teacher draws a transparent sketch, compile it to a dry-run supervised action plan.",
      evidence: "transparent_ai_supervised_software_action_plan_v1",
      tokenCost: "low until screenshots are reviewed",
      continueWhen: "teacher confirms dry run and focused target window",
      stopWhen: "coordinates, perspective, or target state are uncertain"
    }
  ],
  locks
};

const nextObserverArguments = {
  tool: "create_universal_software_observer_kit",
  arguments: {
    goal,
    software,
    ...(processName ? { processName } : {}),
    ...(windowTitle ? { windowTitle } : {}),
    logPaths: explicitLogPaths,
    logRoots: explicitLogRoots,
    windowsEventLogs: eventLogs
  },
  alsoUseful: {
    workalongTool: "create_workalong_teaching_kit",
    overlayTool: "create_transparent_sketch_overlay_kit",
    actionTool: "create_supervised_software_action_kit"
  }
};

const teacherAdaptation = {
  format: "transparent_ai_teacher_method_adaptation_v1",
  profileId,
  software,
  defaultQuestion: "Which of these cheap signals should count as the moment I should learn from?",
  lowTokenQuestions: [
    "Is this log/event/file change normal, success, warning, failure, or a reusable decision point?",
    "Should I ask before acting when this signal appears again?",
    "What is the counterexample where this signal should not trigger the rule?",
    "If you draw on the overlay, should I treat it as a 2D position, perspective relation, or 3D depth hint?"
  ],
  answerModes: ["short text", "voice transcript", "transparent sketch", "before/after example", "manual marker"],
  locks
};

const probeScript = String.raw`param(
  [string]$ProfilePath = "$(Join-Path $PSScriptRoot 'software-capability-profile.json')",
  [int]$RecentEventMinutes = 15,
  [int]$MaxFilesPerRoot = 40
)

$ErrorActionPreference = "Stop"
$Profile = Get-Content -LiteralPath $ProfilePath -Raw -Encoding UTF8 | ConvertFrom-Json
$ProfileDir = Split-Path -Parent $ProfilePath
$OutPath = Join-Path $ProfileDir "software-capability-probe-result.json"

function Resolve-HintPath([string]$Path) {
  if (-not $Path) { return "" }
  $expanded = [Environment]::ExpandEnvironmentVariables($Path)
  if ($expanded -eq "current workspace") { return (Get-Location).Path }
  return $expanded
}

function Get-ShortFileSummary($Item) {
  [pscustomobject]@{
    path = $Item.FullName
    lastWriteTimeUtc = $Item.LastWriteTimeUtc.ToString("o")
    bytes = $Item.Length
    extension = $Item.Extension
  }
}

$Processes = @()
if ($Profile.processName) {
  $Processes = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -like "*$($Profile.processName)*" -or $_.Path -like "*$($Profile.processName)*"
  } | Select-Object -First 8 | ForEach-Object {
    [pscustomobject]@{
      processName = $_.ProcessName
      id = $_.Id
      mainWindowTitle = $_.MainWindowTitle
      path = $_.Path
      startTime = if ($_.StartTime) { $_.StartTime.ToUniversalTime().ToString("o") } else { "" }
    }
  })
}

$CandidateLogs = @()
foreach ($Path in @($Profile.explicitLogPaths)) {
  $Expanded = Resolve-HintPath $Path
  if ($Expanded -and (Test-Path -LiteralPath $Expanded)) {
    $CandidateLogs += Get-Item -LiteralPath $Expanded
  }
}

foreach ($Root in @($Profile.candidateLogRoots)) {
  $ExpandedRoot = Resolve-HintPath $Root
  if (-not $ExpandedRoot -or -not (Test-Path -LiteralPath $ExpandedRoot)) { continue }
  $CandidateLogs += @(Get-ChildItem -LiteralPath $ExpandedRoot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Extension -match '\.(log|txt|jsonl|trace|etl|csv|out|err)$' -and
      ($_.FullName -match [regex]::Escape($Profile.software) -or -not $Profile.processName -or $_.FullName -match [regex]::Escape($Profile.processName))
    } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First $MaxFilesPerRoot)
}

$EventSummaries = @()
foreach ($LogName in @($Profile.windowsEventLogs)) {
  try {
    $Since = (Get-Date).AddMinutes(-1 * $RecentEventMinutes)
    $Events = @(Get-WinEvent -FilterHashtable @{ LogName = $LogName; StartTime = $Since } -MaxEvents 20 -ErrorAction SilentlyContinue)
    $EventSummaries += [pscustomobject]@{
      logName = $LogName
      recentCount = $Events.Count
      latest = @($Events | Select-Object -First 5 | ForEach-Object {
        [pscustomobject]@{
          provider = $_.ProviderName
          id = $_.Id
          level = $_.LevelDisplayName
          timeCreatedUtc = $_.TimeCreated.ToUniversalTime().ToString("o")
        }
      })
    }
  } catch {
    $EventSummaries += [pscustomobject]@{ logName = $LogName; error = $_.Exception.Message }
  }
}

$Probe = [pscustomobject]@{
  format = "transparent_ai_software_capability_probe_result_v1"
  profileId = $Profile.profileId
  software = $Profile.software
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  fullContinuousRecording = $false
  readOnlyProbe = $true
  processMatches = $Processes
  candidateLogs = @($CandidateLogs | Select-Object -Unique FullName | Select-Object -First 120 | ForEach-Object { Get-ShortFileSummary (Get-Item -LiteralPath $_.FullName) })
  eventSummaries = $EventSummaries
  recommendedNextTool = "create_universal_software_observer_kit"
  needsTeacherQuestion = (($Processes.Count -eq 0) -and (@($CandidateLogs).Count -eq 0))
  suggestedTeacherQuestion = "I could not confidently identify cheap observation sources. What process name, log folder, or visible window should I watch first?"
  locks = $Profile.locks
}

$Probe | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutPath -Encoding UTF8
Write-Output ($Probe | ConvertTo-Json -Depth 12)
`;

writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
writeFileSync(observationPlanPath, `${JSON.stringify(observationPlan, null, 2)}\n`, "utf8");
writeFileSync(nextObserverArgsPath, `${JSON.stringify(nextObserverArguments, null, 2)}\n`, "utf8");
writeFileSync(teacherAdaptationPath, `${JSON.stringify(teacherAdaptation, null, 2)}\n`, "utf8");
writeUtf8Bom(probePath, probeScript);
writeFileSync(
  readmePath,
  [
    "# Software Capability Profile",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "Use this first when the target app is unfamiliar. It discovers low-token observation sources before screenshots or video.",
    "",
    "Recommended order:",
    "",
    "1. Review `software-capability-profile.json`.",
    "2. Optionally run the read-only probe:",
    "",
    "```powershell",
    ".\\probe-software-capability.ps1",
    "```",
    "",
    "3. Use `next-observer-arguments.json` to create a universal observer kit.",
    "4. Paste the compact observation packet back to `teach_apprentice`.",
    "",
    "Limits: this does not prove every app exposes logs and does not execute native software. It narrows the next low-token observation step and keeps teacher review gates closed.",
    "",
    "Locked defaults: ruleEnabled=false, accepted=false, technologyAccepted=false, packagingGated=true, fullContinuousRecording=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_software_capability_profile_result_v1",
      profileId,
      profilePath,
      teacherReadme: readmePath,
      probe: probePath,
      observationPlan: observationPlanPath,
      nextObserverArguments: nextObserverArgsPath,
      teacherAdaptation: teacherAdaptationPath,
      inferredFamily: family.id,
      observableChannelCount: profile.observableChannels.length,
      defaultNextTool: "create_universal_software_observer_kit",
      fullContinuousRecording: false,
      nativeUniversalExecution: false,
      reviewLocks: locks
    },
    null,
    2
  )
);
