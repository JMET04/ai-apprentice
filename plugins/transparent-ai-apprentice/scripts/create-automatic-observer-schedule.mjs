#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
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
  return String(value || "automatic-observer-schedule")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "automatic-observer-schedule";
}

function readJsonInput(value, label) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function persistInlineJson(input, outputDir, fileName) {
  if (!input) return "";
  if (input.path) return input.path;
  const path = join(outputDir, fileName);
  writeFileSync(path, JSON.stringify(input.value, null, 2), "utf8");
  return path;
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

function psSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

const goal = argValue("--goal", "Automatically run low-token observer checks across reviewed software.");
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "automatic-observer-schedules")));
const taskName = argValue("--task-name", "TransparentAI-Apprentice-LowTokenObserver");
const intervalMinutes = Math.max(1, Number(argValue("--interval-minutes", "15")));
const cyclesPerRun = Math.max(1, Number(argValue("--cycles-per-run", "1")));
const maxRuntimeMs = Math.max(1000, Number(argValue("--max-runtime-ms", "120000")));
const maxItems = Math.max(1, Number(argValue("--max-items", "8")));
const maxLogsPerItem = Math.max(1, Number(argValue("--max-logs-per-item", "4")));
const maxTailLines = Math.max(1, Number(argValue("--max-tail-lines", "80")));
const maxTailBytes = Math.max(256, Number(argValue("--max-tail-bytes", "65536")));
const maxSnippetChars = Math.max(80, Number(argValue("--max-snippet-chars", "360")));
const allowRegisterScript = !hasFlag("--no-register-script");

mkdirSync(outputRoot, { recursive: true });
const scheduleId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(taskName)}`;
const scheduleDir = join(outputRoot, scheduleId);
mkdirSync(scheduleDir, { recursive: true });

const queuePath = persistInlineJson(queueInput, scheduleDir, "reviewed-software-observer-queue.json");
const stateDir = resolve(argValue("--state-dir", join(scheduleDir, "watch-state")));
const runOutputDir = resolve(argValue("--run-output-dir", join(scheduleDir, "scheduled-runs")));
mkdirSync(stateDir, { recursive: true });
mkdirSync(runOutputDir, { recursive: true });

const runnerPath = join(scheduleDir, "run-scheduled-observer.ps1");
const registerPath = join(scheduleDir, "register-scheduled-observer-task.ps1");
const unregisterPath = join(scheduleDir, "unregister-scheduled-observer-task.ps1");
const schedulePath = join(scheduleDir, "automatic-observer-schedule.json");
const receiptPath = join(scheduleDir, "automatic-observer-schedule-receipt.json");
const readmePath = join(scheduleDir, "AUTOMATIC_OBSERVER_SCHEDULE_START_HERE.md");
const supervisorScript = join(__dirname, "run-all-software-observer-supervisor.mjs");

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  scheduledTaskInstalled: false,
  teacherConfirmationRequired: true
};

const runnerLines = [
  "param(",
  "  [string]$RunLabel = (Get-Date -Format 'yyyyMMdd-HHmmss')",
  ")",
  "$ErrorActionPreference = 'Stop'",
  `$NodeExe = '${psSingleQuoted(process.execPath)}'`,
  `$SupervisorScript = '${psSingleQuoted(supervisorScript)}'`,
  `$QueuePath = '${psSingleQuoted(queuePath || "<reviewed software observer queue path required>")}'`,
  `$StateDir = '${psSingleQuoted(stateDir)}'`,
  `$OutputDir = Join-Path '${psSingleQuoted(runOutputDir)}' $RunLabel`,
  "New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null",
  "if (-not (Test-Path -LiteralPath $QueuePath)) { throw \"Reviewed observer queue not found: $QueuePath\" }",
  "& $NodeExe $SupervisorScript --queue $QueuePath --state-dir $StateDir --output-dir $OutputDir --cycles '" + cyclesPerRun + "' --max-runtime-ms '" + maxRuntimeMs + "' --max-items '" + maxItems + "' --max-logs-per-item '" + maxLogsPerItem + "' --max-tail-lines '" + maxTailLines + "' --max-tail-bytes '" + maxTailBytes + "' --max-snippet-chars '" + maxSnippetChars + "'",
  "if ($LASTEXITCODE -ne 0) { throw \"Scheduled low-token observer run failed with exit code $LASTEXITCODE\" }"
];
writeUtf8Bom(runnerPath, runnerLines.join("\n"));

const registerLines = [
  "param(",
  "  [switch]$TeacherConfirmed",
  ")",
  "$ErrorActionPreference = 'Stop'",
  "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed is required before registering an automatic observer scheduled task.' }",
  `$TaskName = '${psSingleQuoted(taskName)}'`,
  `$Runner = '${psSingleQuoted(runnerPath)}'`,
  "$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument \"-NoProfile -ExecutionPolicy Bypass -File `\"$Runner`\"\"",
  `$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes ${intervalMinutes})`,
  "$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)",
  "Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description 'Transparent AI Apprentice low-token observer; bounded runs only; no continuous recording.' -Force | Out-Null",
  "Write-Output \"registered=$TaskName\""
];
writeUtf8Bom(registerPath, registerLines.join("\n"));

const unregisterLines = [
  "param(",
  "  [switch]$TeacherConfirmed",
  ")",
  "$ErrorActionPreference = 'Stop'",
  "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed is required before unregistering this observer scheduled task.' }",
  `$TaskName = '${psSingleQuoted(taskName)}'`,
  "Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false",
  "Write-Output \"unregistered=$TaskName\""
];
writeUtf8Bom(unregisterPath, unregisterLines.join("\n"));

const queueSummary = queueInput?.value
  ? {
      format: queueInput.value.format || "",
      queueId: queueInput.value.queueId || "",
      queuedCount: Array.isArray(queueInput.value.queue) ? queueInput.value.queue.length : 0
    }
  : null;

const schedule = {
  format: "transparent_ai_automatic_observer_schedule_v1",
  scheduleId,
  goal,
  createdAt: new Date().toISOString(),
  status: queuePath ? "waiting_for_teacher_registration_confirmation" : "blocked_until_reviewed_queue_is_provided",
  taskName,
  queuePath,
  queueSummary,
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
    cyclesPerRun,
    maxRuntimeMs,
    taskRegistered: false,
    scheduledTaskInstalled: false,
    requiresTeacherConfirmedFlag: true,
    boundedPeriodicRun: true,
    continuousRecording: false,
    stopOnMeaningfulDelta: true
  },
  lowTokenStrategy:
    "Use Windows Task Scheduler only to start bounded supervisor runs. Each run reuses metadata/log/file/window deltas first, persists baselines, stops on meaningful deltas, and requests screenshots only after cheap signals are ambiguous.",
  limits: {
    maxItems,
    maxLogsPerItem,
    maxTailLines,
    maxTailBytes,
    maxSnippetChars,
    fullLogsRead: false,
    screenshotsCapturedByScheduler: false,
    fullContinuousRecording: false
  },
  nextMcpCall: queuePath
    ? {
        tool: "run_all_software_observer_supervisor",
        arguments: {
          queue: queuePath,
          stateDir,
          outputDir: runOutputDir,
          cycles: cyclesPerRun,
          maxRuntimeMs,
          maxItems,
          maxLogsPerItem,
          maxTailLines,
          maxTailBytes,
          maxSnippetChars
        }
      }
    : null,
  blockedActions: [
    "register scheduled task without teacher confirmation",
    "enable memory from scheduled observations without teacher review",
    "capture screenshots by default",
    "read full logs by default",
    "claim native universal software execution"
  ],
  locks
};

const receipt = {
  format: "transparent_ai_automatic_observer_schedule_receipt_v1",
  scheduleId,
  status: schedule.status,
  taskName,
  queuePath,
  runnerPath,
  registerPath,
  unregisterPath,
  taskRegistered: false,
  scheduledTaskInstalled: false,
  teacherConfirmationRequired: true,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  screenshotsCaptured: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(schedulePath, JSON.stringify(schedule, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
writeFileSync(readmePath, [
  "# Automatic Observer Schedule",
  "",
  "This package prepares a teacher-reviewed Windows Scheduled Task for low-token software observation.",
  "",
  `Task name: ${taskName}`,
  `Interval minutes: ${intervalMinutes}`,
  `Reviewed queue: ${queuePath || "not provided yet"}`,
  "",
  "Default state: not registered. Run the generated register script only after the teacher confirms the reviewed queue and interval.",
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
  "The scheduled task runs bounded supervisor passes only. It does not continuously record, read full logs, capture screenshots by default, enable memory, or claim native universal software execution."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_automatic_observer_schedule_result_v1",
  scheduleId,
  scheduleDir,
  schedulePath,
  receiptPath,
  readme: readmePath,
  runnerPath,
  registerPath,
  unregisterPath,
  taskName,
  intervalMinutes,
  status: schedule.status,
  taskRegistered: false,
  scheduledTaskInstalled: false,
  teacherConfirmationRequired: true,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  screenshotsCaptured: false,
  nativeUniversalExecution: false,
  queueProvided: Boolean(queuePath),
  queuedCount: queueSummary?.queuedCount ?? 0,
  nextMcpCall: schedule.nextMcpCall,
  locks
}, null, 2));
