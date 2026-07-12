#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "recurring-monitor-registration-status")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "recurring-monitor-registration-status"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function psSingleQuoted(value) {
  return String(value || "").replace(/'/g, "''");
}

function normalizePathish(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/`"/g, "\"")
    .replace(/"/g, "")
    .toLowerCase();
}

function powershellExe() {
  const windowsRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
  const systemPowerShell = join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return existsSync(systemPowerShell) ? systemPowerShell : "powershell.exe";
}

function queryScheduledTask(taskName) {
  const command = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$TaskName = '${psSingleQuoted(taskName)}'`,
    "$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue",
    "if ($null -eq $task) {",
    "  @{ found = $false; taskName = $TaskName; queryChangedSystem = $false } | ConvertTo-Json -Depth 8",
    "  exit 0",
    "}",
    "$info = $null",
    "try { $info = $task | Get-ScheduledTaskInfo } catch { $info = $null }",
    "$actions = @($task.Actions | ForEach-Object { @{ Execute = $_.Execute; Arguments = $_.Arguments; WorkingDirectory = $_.WorkingDirectory } })",
    "$triggers = @($task.Triggers | ForEach-Object { @{ Enabled = $_.Enabled; StartBoundary = $_.StartBoundary; EndBoundary = $_.EndBoundary; Repetition = [string]$_.Repetition } })",
    "@{",
    "  found = $true",
    "  taskName = $task.TaskName",
    "  taskPath = $task.TaskPath",
    "  state = [string]$task.State",
    "  actions = $actions",
    "  triggers = $triggers",
    "  lastRunTime = if ($info) { [string]$info.LastRunTime } else { '' }",
    "  nextRunTime = if ($info) { [string]$info.NextRunTime } else { '' }",
    "  lastTaskResult = if ($info) { $info.LastTaskResult } else { $null }",
    "  queryChangedSystem = $false",
    "} | ConvertTo-Json -Depth 10"
  ].join("\n");

  const result = spawnSync(powershellExe(), ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.status !== 0) {
    return {
      ok: false,
      found: false,
      taskName,
      queryChangedSystem: false,
      error: result.stderr || result.stdout || "Get-ScheduledTask query failed"
    };
  }
  try {
    return { ok: true, ...JSON.parse(result.stdout.replace(/^\uFEFF/, "")) };
  } catch (error) {
    return {
      ok: false,
      found: false,
      taskName,
      queryChangedSystem: false,
      error: `Could not parse scheduled task query JSON: ${error.message}`,
      stdout: result.stdout
    };
  }
}

function writeReadme(path, packet) {
  const lines = [
    "# Recurring Monitor Registration Status",
    "",
    `Status: ${packet.status}`,
    `Task name: ${packet.taskName || ""}`,
    `Task registered: ${packet.taskRegistered}`,
    "",
    "This verifier only reads Windows Scheduled Task metadata. It does not register, unregister, start, stop, or modify the task.",
    "",
    "Expected runner evidence:",
    `- Scheduled runner: ${packet.expectedScheduledRunnerPath || ""}`,
    `- Register script: ${packet.expectedRegisterScriptPath || ""}`,
    "",
    "Rollback/unregister handoff:",
    "",
    "```powershell",
    packet.unregisterCommand?.scriptPath
      ? `powershell -ExecutionPolicy Bypass -File "${packet.unregisterCommand.scriptPath}" -TeacherConfirmed`
      : "# no unregister script found in source runner",
    "```",
    "",
    "Blocked actions:"
  ];
  for (const blocker of packet.blockedActions) lines.push(`- ${blocker}`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Verify a teacher-reviewed recurring monitor registration status without changing the system.");
const runnerInput = readJsonInput(
  argValue("--registration-runner", argValue("--runner", argValue("--runner-path", ""))),
  "--registration-runner"
);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-recurring-monitor-registration-status")));

const runner = runnerInput.value;
if (!runner || runner.format !== "transparent_ai_all_software_recurring_monitor_registration_runner_v1") {
  throw new Error("--registration-runner must be a transparent_ai_all_software_recurring_monitor_registration_runner_v1 path or JSON object string");
}

const schedulePath = runner.sourceSchedulePath || "";
const schedule = schedulePath && existsSync(schedulePath) ? readJson(schedulePath) : null;
const taskName = argValue("--task-name", runner.taskName || schedule?.taskName || "");
if (!taskName) throw new Error("Could not determine task name from --registration-runner or --task-name");

mkdirSync(outputRoot, { recursive: true });
const verifierId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(taskName)}`;
const verifierDir = join(outputRoot, verifierId);
mkdirSync(verifierDir, { recursive: true });

const expectedScheduledRunnerPath = resolve(
  argValue("--expected-runner-path", schedule?.files?.runner || runner.expectedScheduledRunnerPath || "")
);
const expectedRegisterScriptPath = runner.registerCommand?.scriptPath ? resolve(runner.registerCommand.scriptPath) : "";
const observedTask = queryScheduledTask(taskName);
const observedActions = Array.isArray(observedTask.actions) ? observedTask.actions : [];
const observedActionText = normalizePathish(
  observedActions.map((action) => `${action.Execute || ""} ${action.Arguments || ""} ${action.WorkingDirectory || ""}`).join(" ")
);
const expectedRunnerMatched = expectedScheduledRunnerPath ? observedActionText.includes(normalizePathish(expectedScheduledRunnerPath)) : false;
const powershellMatched = observedActions.some((action) => normalizePathish(action.Execute).includes("powershell"));

let status = "scheduled_task_query_failed";
if (observedTask.ok && observedTask.found === false) {
  status = "verified_not_registered_yet";
} else if (observedTask.ok && observedTask.found === true && expectedRunnerMatched && powershellMatched) {
  status = "registered_and_matches_reviewed_runner";
} else if (observedTask.ok && observedTask.found === true) {
  status = "registered_but_mismatch_blocked";
}

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  statusVerifierDoesNotChangeSystem: true,
  scheduledTaskQueryOnly: true,
  registerTaskCalled: false,
  unregisterTaskCalled: false,
  startTaskCalled: false,
  stopTaskCalled: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false
};

const packetPath = join(verifierDir, "recurring-monitor-registration-status.json");
const receiptPath = join(verifierDir, "recurring-monitor-registration-status-receipt.json");
const readmePath = join(verifierDir, "RECURRING_MONITOR_REGISTRATION_STATUS_START_HERE.md");

const packet = {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  verifierId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceRegistrationRunnerPath: runnerInput.path,
  sourceSchedulePath: schedulePath,
  taskName,
  taskRegistered: observedTask.found === true,
  scheduledTaskInstalled: observedTask.found === true,
  expectedScheduledRunnerPath,
  expectedRegisterScriptPath,
  registeredMatchesExpectedRunner: observedTask.found === true && expectedRunnerMatched && powershellMatched,
  observedTask,
  queryResult: {
    ok: observedTask.ok,
    found: observedTask.found === true,
    queryChangedSystem: false,
    expectedRunnerMatched,
    powershellMatched
  },
  unregisterCommand: runner.unregisterCommand || null,
  blockedActions: [
    "register a scheduled task from this verifier",
    "unregister a scheduled task from this verifier",
    "start or stop a scheduled task from this verifier",
    "treat registration match as teacher acceptance",
    "enable reusable rules or packaging from this verifier",
    "execute target software from recurring monitor status checking"
  ],
  locks,
  files: {
    status: packetPath,
    receipt: receiptPath,
    readme: readmePath
  }
};

const receipt = {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_receipt_v1",
  verifierId,
  status,
  taskName,
  taskRegistered: packet.taskRegistered,
  scheduledTaskInstalled: packet.scheduledTaskInstalled,
  registeredMatchesExpectedRunner: packet.registeredMatchesExpectedRunner,
  queryChangedSystem: false,
  registerTaskCalled: false,
  unregisterTaskCalled: false,
  startTaskCalled: false,
  stopTaskCalled: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_registration_status_result_v1",
      status,
      verifierId,
      statusPath: packetPath,
      receiptPath,
      readmePath,
      taskName,
      taskRegistered: packet.taskRegistered,
      scheduledTaskInstalled: packet.scheduledTaskInstalled,
      registeredMatchesExpectedRunner: packet.registeredMatchesExpectedRunner,
      queryChangedSystem: false,
      unregisterCommand: packet.unregisterCommand,
      locks
    },
    null,
    2
  )
);
