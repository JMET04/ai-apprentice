#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "all-software-recurring-monitor-registration-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-recurring-monitor-registration-runner"
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

function explicitRegistrationConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed recurring monitor registration",
    "teacher confirmed scheduled task registration",
    "register the reviewed recurring monitor",
    "approve registering recurring low-token monitor",
    "i confirm recurring monitor registration",
    "\u786e\u8ba4\u6ce8\u518c\u5468\u671f\u4f4e token \u76d1\u63a7",
    "\u786e\u8ba4\u5b89\u88c5\u5468\u671f\u4f4e token \u5b66\u4e60\u4efb\u52a1",
    "\u5141\u8bb8\u6ce8\u518c\u5df2\u5ba1\u6838\u7684\u5468\u671f\u76d1\u63a7"
  ].some((marker) => text.includes(marker));
}

function psSingleQuoted(value) {
  return String(value || "").replace(/'/g, "''");
}

function maybeScheduleFromGate(gate, gatePath) {
  const schedulePath = gate.sourceSchedulePath || "";
  if (schedulePath && existsSync(schedulePath)) return { schedule: readJson(schedulePath), schedulePath: resolve(schedulePath) };
  if (gatePath) {
    const maybePath = gate.schedule?.sourceSchedulePath || gate.schedulePath || "";
    if (maybePath && existsSync(maybePath)) return { schedule: readJson(maybePath), schedulePath: resolve(maybePath) };
  }
  return { schedule: null, schedulePath: "" };
}

function writeWrapper(path, packet) {
  const registerPath = packet.registerCommand?.scriptPath || "";
  const unregisterPath = packet.unregisterCommand?.scriptPath || "";
  const lines = [
    "param(",
    "  [switch]$TeacherConfirmed,",
    "  [switch]$Execute,",
    "  [switch]$Unregister",
    ")",
    "$ErrorActionPreference = 'Stop'",
    "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed is required before changing the recurring low-token monitor task.' }",
    "if (-not $Execute) {",
    "  Write-Output 'dry_run=true'",
    `  Write-Output 'register=${psSingleQuoted(registerPath)}'`,
    `  Write-Output 'unregister=${psSingleQuoted(unregisterPath)}'`,
    "  exit 0",
    "}",
    "if ($Unregister) {",
    `  & '${psSingleQuoted(unregisterPath)}' -TeacherConfirmed`,
    "  exit $LASTEXITCODE",
    "}",
    `& '${psSingleQuoted(registerPath)}' -TeacherConfirmed`,
    "exit $LASTEXITCODE"
  ];
  writeFileSync(path, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

function writeReadme(path, packet) {
  const lines = [
    "# Recurring Monitor Registration Runner",
    "",
    `Goal: ${packet.goal}`,
    `Status: ${packet.status}`,
    `Task name: ${packet.taskName || ""}`,
    "",
    "This runner is the supervised step after the recurring monitor approval gate. It defaults to dry-run and does not register a Windows task unless a teacher explicitly confirms and execution is requested.",
    "",
    "Dry run:",
    "",
    "```powershell",
    `powershell -ExecutionPolicy Bypass -File "${packet.files.wrapper}" -TeacherConfirmed`,
    "```",
    "",
    "Register after teacher confirmation and rollback review:",
    "",
    "```powershell",
    `powershell -ExecutionPolicy Bypass -File "${packet.files.wrapper}" -TeacherConfirmed -Execute`,
    "```",
    "",
    "Unregister if rollback is needed:",
    "",
    "```powershell",
    `powershell -ExecutionPolicy Bypass -File "${packet.files.wrapper}" -TeacherConfirmed -Execute -Unregister`,
    "```",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary: dry-run mode writes reviewable evidence only. It does not capture screenshots, read full logs, execute target software, write long-term memory, or claim universal native control."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Run a teacher-confirmed recurring all-software low-token monitor registration.");
const gateInput = readJsonInput(argValue("--approval-gate", argValue("--gate", argValue("--gate-path", ""))), "--approval-gate");
if (!gateInput.value || gateInput.value.format !== "transparent_ai_all_software_recurring_monitor_approval_gate_v1") {
  throw new Error("--approval-gate must be a transparent_ai_all_software_recurring_monitor_approval_gate_v1 path or JSON object string");
}

const gate = gateInput.value;
const { schedule, schedulePath } = maybeScheduleFromGate(gate, gateInput.path);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-recurring-monitor-registration-runners")));
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--registration-confirmation", ""));
const teacherConfirmedRegistration = explicitRegistrationConfirmation(teacherConfirmation);
const rollbackPointCreated = hasFlag("--rollback-point-created");
const executeRequested = hasFlag("--execute");
const allowSystemChange = hasFlag("--allow-system-change");
const dryRunOnly = !executeRequested;

const registerPath = gate.generatedRegistrationRequest?.scriptPath || gate.schedule?.registerPath || "";
const unregisterPath = schedule?.files?.unregisterTask || "";
const taskName = gate.generatedRegistrationRequest?.taskName || gate.schedule?.taskName || schedule?.taskName || "";
const blockers = [];
if (gate.readyForRegistrationRequest !== true) blockers.push("approval_gate_not_ready_for_registration_request");
if (!gate.generatedRegistrationRequest) blockers.push("missing_generated_registration_request");
if (!registerPath || !existsSync(registerPath)) blockers.push("register_task_script_not_found");
if (!unregisterPath || !existsSync(unregisterPath)) blockers.push("unregister_task_script_not_found");
if (gate.locks?.approvalGateDoesNotRegisterTask !== true) blockers.push("source_gate_did_not_preserve_no_register_boundary");
if (gate.locks?.softwareActionsExecuted !== false) blockers.push("source_gate_allows_target_software_execution");
if (gate.locks?.nativeUniversalExecution !== false) blockers.push("source_gate_claims_native_universal_execution");
if (schedule && schedule.schedulePolicy?.requiresTeacherConfirmedFlag !== true) blockers.push("schedule_register_script_does_not_require_teacher_confirmed");
if (!teacherConfirmedRegistration) blockers.push("missing_explicit_teacher_registration_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_registration_runner");
if (executeRequested && !allowSystemChange) blockers.push("execute_requested_without_allow_system_change");

const readyToRun = blockers.length === 0;
mkdirSync(outputRoot, { recursive: true });
const runnerId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runnerDir = join(outputRoot, runnerId);
mkdirSync(runnerDir, { recursive: true });

const wrapperPath = join(runnerDir, "run-recurring-monitor-registration.ps1");
const runnerPath = join(runnerDir, "recurring-monitor-registration-runner.json");
const receiptPath = join(runnerDir, "recurring-monitor-registration-runner-receipt.json");
const readmePath = join(runnerDir, "RECURRING_MONITOR_REGISTRATION_RUNNER_START_HERE.md");

const registerCommand = registerPath
  ? {
      shell: "powershell",
      scriptPath: resolve(registerPath),
      args: ["-TeacherConfirmed"],
      taskName
    }
  : null;
const unregisterCommand = unregisterPath
  ? {
      shell: "powershell",
      scriptPath: resolve(unregisterPath),
      args: ["-TeacherConfirmed"],
      taskName
    }
  : null;

const locks = {
  reviewOnly: dryRunOnly,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  teacherRegistrationConfirmationRequired: true,
  rollbackPointRequired: true,
  dryRunDefault: true
};

const packet = {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
  runnerId,
  createdAt: new Date().toISOString(),
  goal,
  status: readyToRun
    ? dryRunOnly
      ? "dry_run_ready_for_teacher_review"
      : "ready_to_execute_teacher_confirmed_registration"
    : "blocked_before_recurring_monitor_registration_runner",
  sourceApprovalGatePath: gateInput.path,
  sourceSchedulePath: schedulePath,
  taskName,
  executeRequested,
  dryRunOnly,
  allowSystemChange,
  teacherConfirmedRegistration,
  rollbackPointCreated,
  blockers,
  registerCommand,
  unregisterCommand,
  files: {
    wrapper: wrapperPath,
    runner: runnerPath,
    receipt: receiptPath,
    readme: readmePath
  },
  blockedActions: [
    "register recurring monitor without explicit teacher registration confirmation",
    "register recurring monitor without rollback point",
    "register recurring monitor when the approval gate is not ready",
    "read full logs by default",
    "capture screenshots by default",
    "execute target software from the recurring monitor",
    "write long-term memory from unattended monitor output",
    "claim universal native control"
  ],
  locks
};

writeWrapper(wrapperPath, packet);

let executionResult = null;
if (readyToRun && executeRequested) {
  const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", wrapperPath, "-TeacherConfirmed", "-Execute"], {
    cwd: runnerDir,
    encoding: "utf8",
    timeout: 120000
  });
  executionResult = {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    taskRegistered: result.status === 0
  };
  if (result.status !== 0) {
    packet.status = "execute_requested_but_registration_failed";
    packet.blockers.push("registration_command_failed");
  }
}

const receipt = {
  format: "transparent_ai_all_software_recurring_monitor_registration_runner_receipt_v1",
  runnerId,
  status: packet.status,
  readyToRun,
  executeRequested,
  dryRunOnly,
  allowSystemChange,
  taskRegistered: Boolean(executionResult?.taskRegistered),
  scheduledTaskInstalled: Boolean(executionResult?.taskRegistered),
  wrapperPath,
  registerCommand,
  unregisterCommand,
  executionResult,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(runnerPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_registration_runner_result_v1",
      status: packet.status,
      runnerId,
      runnerPath,
      receiptPath,
      readmePath,
      wrapperPath,
      readyToRun,
      executeRequested,
      dryRunOnly,
      taskRegistered: receipt.taskRegistered,
      scheduledTaskInstalled: receipt.scheduledTaskInstalled,
      blockers: packet.blockers,
      registerCommand,
      unregisterCommand,
      locks
    },
    null,
    2
  )
);

if (packet.status === "execute_requested_but_registration_failed") process.exit(1);
