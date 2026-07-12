#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "automatic-low-token-learning-schedule")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "automatic-low-token-learning-schedule";
}

function readJsonInput(value, label) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function persistInlineJson(input, outputDir, fileName) {
  if (!input) return "";
  if (input.path) return input.path;
  const path = join(outputDir, fileName);
  writeFileSync(path, `${JSON.stringify(input.value, null, 2)}\n`, "utf8");
  return path;
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

function psSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

const goal = argValue("--goal", "Automatically learn from reviewed all-software log deltas with a low token budget.");
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const inventoryInput = readJsonInput(argValue("--inventory", argValue("--inventory-path", "")), "--inventory");
if (!queueInput && !inventoryInput) throw new Error("--queue or --inventory is required");

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "automatic-low-token-learning-schedules")));
const taskName = argValue("--task-name", "TransparentAI-Apprentice-LowTokenLearning");
const intervalMinutes = Math.max(1, Number(argValue("--interval-minutes", "15")));
const runsPerLaunch = Math.max(1, Number(argValue("--runs-per-launch", argValue("--cycles-per-run", "1"))));
const maxItems = Math.max(1, Number(argValue("--max-items", "8")));
const maxLogsPerItem = Math.max(1, Number(argValue("--max-logs-per-item", "4")));
const maxTailLines = Math.max(1, Number(argValue("--max-tail-lines", "80")));
const maxTailBytes = Math.max(256, Number(argValue("--max-tail-bytes", "65536")));
const maxSnippetChars = Math.max(80, Number(argValue("--max-snippet-chars", "360")));
const maxLearningItems = Math.max(1, Number(argValue("--max-learning-items", "3")));
const teacherStyle = argValue("--teacher-style", "ask_teacher_preference");
const allowRegisterScript = !hasFlag("--no-register-script");

mkdirSync(outputRoot, { recursive: true });
const scheduleId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(taskName)}`;
const scheduleDir = join(outputRoot, scheduleId);
mkdirSync(scheduleDir, { recursive: true });

const queuePath = persistInlineJson(queueInput, scheduleDir, "reviewed-software-observer-queue.json");
const inventoryPath = persistInlineJson(inventoryInput, scheduleDir, "reviewed-software-observer-inventory.json");
const stateDir = resolve(argValue("--state-dir", join(scheduleDir, "persistent-learning-state")));
const runOutputDir = resolve(argValue("--run-output-dir", join(scheduleDir, "scheduled-learning-runs")));
mkdirSync(stateDir, { recursive: true });
mkdirSync(runOutputDir, { recursive: true });

const runnerPath = join(scheduleDir, "run-scheduled-low-token-learning.ps1");
const registerPath = join(scheduleDir, "register-low-token-learning-task.ps1");
const unregisterPath = join(scheduleDir, "unregister-low-token-learning-task.ps1");
const schedulePath = join(scheduleDir, "automatic-low-token-learning-schedule.json");
const receiptPath = join(scheduleDir, "automatic-low-token-learning-schedule-receipt.json");
const readmePath = join(scheduleDir, "AUTOMATIC_LOW_TOKEN_LEARNING_SCHEDULE_START_HERE.md");
const learningRunnerScript = join(__dirname, "run-automatic-low-token-learning-runner.mjs");

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  scheduledTaskInstalled: false,
  teacherConfirmationRequired: true
};

const inputArgLines = queuePath
  ? [`$InputKind = '--queue'`, `$InputPath = '${psSingleQuoted(queuePath)}'`]
  : [`$InputKind = '--inventory'`, `$InputPath = '${psSingleQuoted(inventoryPath)}'`];

const runnerLines = [
  "param(",
  "  [string]$RunLabel = (Get-Date -Format 'yyyyMMdd-HHmmss')",
  ")",
  "$ErrorActionPreference = 'Stop'",
  `$NodeExe = '${psSingleQuoted(process.execPath)}'`,
  `$LearningRunner = '${psSingleQuoted(learningRunnerScript)}'`,
  ...inputArgLines,
  `$StateDir = '${psSingleQuoted(stateDir)}'`,
  `$RunRoot = Join-Path '${psSingleQuoted(runOutputDir)}' $RunLabel`,
  "New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null",
  "if (-not (Test-Path -LiteralPath $InputPath)) { throw \"Reviewed learning input not found: $InputPath\" }",
  `& $NodeExe $LearningRunner $InputKind $InputPath --state-dir $StateDir --output-dir $RunRoot --runs '${runsPerLaunch}' --interval-ms '0' --max-items '${maxItems}' --max-logs-per-item '${maxLogsPerItem}' --max-tail-lines '${maxTailLines}' --max-tail-bytes '${maxTailBytes}' --max-snippet-chars '${maxSnippetChars}' --max-learning-items '${maxLearningItems}' --teacher-style '${psSingleQuoted(teacherStyle)}'`,
  "if ($LASTEXITCODE -ne 0) { throw \"Scheduled low-token learning run failed with exit code $LASTEXITCODE\" }"
];
writeUtf8Bom(runnerPath, runnerLines.join("\n"));

const registerLines = [
  "param(",
  "  [switch]$TeacherConfirmed",
  ")",
  "$ErrorActionPreference = 'Stop'",
  "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed is required before registering an automatic low-token learning scheduled task.' }",
  `$TaskName = '${psSingleQuoted(taskName)}'`,
  `$Runner = '${psSingleQuoted(runnerPath)}'`,
  "$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument \"-NoProfile -ExecutionPolicy Bypass -File `\"$Runner`\"\"",
  `$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes ${intervalMinutes})`,
  "$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)",
  "Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description 'Transparent AI Apprentice automatic low-token learning; bounded reviewed queue runs only.' -Force | Out-Null",
  "Write-Output \"registered=$TaskName\""
];
writeUtf8Bom(registerPath, registerLines.join("\n"));

const unregisterLines = [
  "param(",
  "  [switch]$TeacherConfirmed",
  ")",
  "$ErrorActionPreference = 'Stop'",
  "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed is required before unregistering this learning scheduled task.' }",
  `$TaskName = '${psSingleQuoted(taskName)}'`,
  "Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false",
  "Write-Output \"unregistered=$TaskName\""
];
writeUtf8Bom(unregisterPath, unregisterLines.join("\n"));

const inputSummary = (queueInput || inventoryInput)?.value
  ? {
      format: (queueInput || inventoryInput).value.format || "",
      queuedCount: Array.isArray((queueInput || inventoryInput).value.queue) ? (queueInput || inventoryInput).value.queue.length : null,
      candidateCount: Array.isArray((queueInput || inventoryInput).value.softwareCandidates) ? (queueInput || inventoryInput).value.softwareCandidates.length : null
    }
  : null;

const schedule = {
  format: "transparent_ai_automatic_low_token_learning_schedule_v1",
  scheduleId,
  goal,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_registration_confirmation",
  taskName,
  inputKind: queuePath ? "queue" : "inventory",
  queuePath,
  inventoryPath,
  inputSummary,
  stateDir,
  runOutputDir,
  files: {
    runner: runnerPath,
    registerTask: allowRegisterScript ? registerPath : "",
    unregisterTask: allowRegisterScript ? unregisterPath : "",
    receipt: receiptPath,
    readme: readmePath
  },
  schedulePolicy: {
    scheduler: "windows_scheduled_task",
    intervalMinutes,
    runsPerLaunch,
    taskRegistered: false,
    scheduledTaskInstalled: false,
    requiresTeacherConfirmedFlag: true,
    boundedLaunch: true,
    metadataGateFirst: true,
    skipTailWhenMetadataUnchanged: true,
    stopAfterLearningEvents: true,
    continuousRecording: false
  },
  lowTokenLearningStrategy:
    "Use Windows Task Scheduler only to launch bounded automatic learning runner passes. Each pass reuses persistent metadata baselines, skips unchanged logs, reads only bounded tails after metadata changes, and writes compact teacher-review learning events before memory.",
  limits: {
    maxItems,
    maxLogsPerItem,
    maxTailLines,
    maxTailBytes,
    maxSnippetChars,
    maxLearningItems,
    fullLogsRead: false,
    screenshotsCapturedByScheduler: false,
    fullContinuousRecording: false
  },
  nextMcpCall: {
    tool: "run_automatic_low_token_learning_runner",
    arguments: {
      queue: queuePath || undefined,
      inventory: queuePath ? undefined : inventoryPath,
      stateDir,
      outputDir: runOutputDir,
      runs: runsPerLaunch,
      intervalMs: 0,
      maxItems,
      maxLogsPerItem,
      maxTailLines,
      maxTailBytes,
      maxSnippetChars,
      maxLearningItems,
      teacherStyle
    }
  },
  blockedActions: [
    "register scheduled learning task without teacher confirmation",
    "write long-term memory from scheduled runs without teacher review",
    "capture screenshots by default",
    "read full logs by default",
    "execute target software from scheduled learning",
    "claim native universal software execution"
  ],
  locks
};

const receipt = {
  format: "transparent_ai_automatic_low_token_learning_schedule_receipt_v1",
  scheduleId,
  status: schedule.status,
  taskName,
  queuePath,
  inventoryPath,
  runnerPath,
  registerPath,
  unregisterPath,
  taskRegistered: false,
  scheduledTaskInstalled: false,
  teacherConfirmationRequired: true,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(readmePath, [
  "# Automatic Low-Token Learning Schedule",
  "",
  "This package prepares a teacher-reviewed Windows Scheduled Task that launches bounded automatic low-token learning runs.",
  "",
  `Task name: ${taskName}`,
  `Interval minutes: ${intervalMinutes}`,
  `Input: ${queuePath || inventoryPath}`,
  "",
  "Default state: not registered. Run the generated register script only after the teacher confirms the reviewed input and interval.",
  "",
  "Manual dry run:",
  "",
  "```powershell",
  `powershell -ExecutionPolicy Bypass -File "${runnerPath}"`,
  "```",
  "",
  "Register after teacher confirmation:",
  "",
  "```powershell",
  `powershell -ExecutionPolicy Bypass -File "${registerPath}" -TeacherConfirmed`,
  "```",
  "",
  "Unregister after teacher confirmation:",
  "",
  "```powershell",
  `powershell -ExecutionPolicy Bypass -File "${unregisterPath}" -TeacherConfirmed`,
  "```",
  "",
  "Locked defaults: no continuous recording, no screenshots by default, no full logs, no software execution, no long-term memory writes, and no packaging unlock."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_automatic_low_token_learning_schedule_result_v1",
  scheduleId,
  scheduleDir,
  schedulePath,
  receiptPath,
  teacherReadme: readmePath,
  runnerPath,
  registerPath,
  unregisterPath,
  taskName,
  taskRegistered: false,
  scheduledTaskInstalled: false,
  advancedRunnerTool: "run_automatic_low_token_learning_runner",
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false
}, null, 2));
