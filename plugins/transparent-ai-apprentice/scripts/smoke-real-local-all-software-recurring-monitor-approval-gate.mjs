#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-recurring-monitor-approval-gate-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = smokeRoot) {
  const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${args.join(" ")} failed`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Prepare a real local recurring all-software low-token monitor approval gate.",
  "--max-processes",
  "10",
  "--max-installed",
  "10",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
runPowerShell([
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "10",
  "-MaxInstalled",
  "10",
  "-MaxLogFilesPerCandidate",
  "1"
]);
const inventory = readJson(inventoryPath);

const queue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "8",
  "--max-files-per-candidate",
  "1",
  "--max-depth",
  "0",
  "--max-entries-per-dir",
  "40",
  "--output-dir",
  join(smokeRoot, "real-queue")
]);
const queuePacket = readJson(queue.queuePath);

const schedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Create a real local recurring all-software low-token learning schedule package for approval.",
  "--queue",
  queue.queuePath,
  "--task-name",
  "TransparentAI-Smoke-RealLocal-Recurring-Monitor",
  "--interval-minutes",
  "20",
  "--runs-per-launch",
  "1",
  "--max-items",
  "4",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "1024",
  "--max-tail-lines",
  "20",
  "--max-learning-items",
  "1",
  "--output-dir",
  join(smokeRoot, "real-schedule")
]);
const schedulePacket = readJson(schedule.schedulePath);

const blocked = runNodeScript("create-all-software-recurring-monitor-approval-gate.mjs", [
  "--goal",
  "Approve a real local recurring all-software low-token monitor.",
  "--schedule",
  schedule.schedulePath,
  "--output-dir",
  join(smokeRoot, "blocked-gate")
]);
const blockedPacket = readJson(blocked.gatePath);

const ready = runNodeScript("create-all-software-recurring-monitor-approval-gate.mjs", [
  "--goal",
  "Approve a real local recurring all-software low-token monitor.",
  "--schedule",
  schedule.schedulePath,
  "--teacher-confirmation",
  "teacher confirmed all-software recurring monitoring",
  "--scope-confirmation",
  "teacher reviewed monitored software scope",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-gate")
]);
const readyPacket = readJson(ready.gatePath);
const readyReceipt = readJson(ready.receiptPath);

const checks = [
  {
    name: "Real local inventory and queue create reviewed scope for recurring monitor approval",
    pass:
      inventory.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      queuePacket.format === "transparent_ai_software_observer_queue_v1" &&
      Array.isArray(queuePacket.queue) &&
      queuePacket.queue.length > 0,
    evidence: `${inventoryPath}; ${queue.queuePath}`
  },
  {
    name: "Real local reviewed queue creates an automatic low-token schedule package without registering a task",
    pass:
      schedulePacket.format === "transparent_ai_automatic_low_token_learning_schedule_v1" &&
      schedulePacket.queuePath === resolve(queue.queuePath) &&
      existsSync(schedulePacket.files?.registerTask || "") &&
      schedulePacket.schedulePolicy?.requiresTeacherConfirmedFlag === true &&
      schedulePacket.locks?.scheduledTaskInstalled === false &&
      schedulePacket.locks?.softwareActionsExecuted === false &&
      schedulePacket.locks?.nativeUniversalExecution === false,
    evidence: schedule.schedulePath
  },
  {
    name: "Real local recurring monitor approval gate blocks before teacher scope confirmation and rollback",
    pass:
      blocked.status === "blocked_before_recurring_monitor_registration_request" &&
      blockedPacket.blockers.includes("missing_explicit_teacher_recurring_monitor_confirmation") &&
      blockedPacket.blockers.includes("missing_reviewed_monitor_scope_confirmation") &&
      blockedPacket.blockers.includes("rollback_point_not_confirmed_for_recurring_monitor") &&
      blockedPacket.locks.approvalGateDoesNotRegisterTask === true,
    evidence: blocked.gatePath
  },
  {
    name: "Real local recurring monitor approval gate produces a registration request after scope, teacher confirmation, and rollback",
    pass:
      ready.status === "ready_for_teacher_confirmed_recurring_monitor_registration_request" &&
      readyPacket.readyForRegistrationRequest === true &&
      readyPacket.scopeConfirmationMatched === true &&
      readyPacket.teacherConfirmationMatched === true &&
      readyPacket.rollbackPointCreated === true &&
      readyPacket.generatedRegistrationRequest?.args.includes("-TeacherConfirmed") &&
      readyPacket.blockers.length === 0,
    evidence: ready.gatePath
  },
  {
    name: "Real local recurring monitor approval gate still does not install task, screenshot, memory, execution, or native control",
    pass:
      readyReceipt.taskRegistered === false &&
      readyReceipt.scheduledTaskInstalled === false &&
      readyReceipt.screenshotsCaptured === false &&
      readyReceipt.rawFullLogsRetained === false &&
      readyReceipt.longTermMemoryWritten === false &&
      readyReceipt.softwareActionsExecuted === false &&
      readyReceipt.nativeUniversalExecution === false,
    evidence: ready.receiptPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_recurring_monitor_approval_gate_smoke_v1",
  smokeRoot,
  counts: {
    inventoryCandidates: inventory.softwareCandidates?.length ?? 0,
    queueItems: queuePacket.queue?.length ?? 0
  },
  paths: {
    inventory: inventoryPath,
    queue: queue.queuePath,
    schedule: schedule.schedulePath,
    blockedGate: blocked.gatePath,
    readyGate: ready.gatePath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
