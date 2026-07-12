#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "all-software-recurring-monitor-approval-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-recurring-monitor-approval-gate"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function explicitTeacherConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed recurring low-token monitoring",
    "teacher confirmed all-software recurring monitoring",
    "approve recurring all-software low-token monitor",
    "allow recurring low-token learning monitor",
    "i confirm recurring all-software low-token monitoring",
    "\u786e\u8ba4\u542f\u7528\u5468\u671f\u4f4e token \u76d1\u63a7",
    "\u786e\u8ba4\u542f\u7528\u5168\u8f6f\u4ef6\u4f4e token \u5b66\u4e60\u76d1\u63a7",
    "\u5141\u8bb8\u5468\u671f\u4f4e token \u5b66\u4e60"
  ].some((marker) => text.includes(marker));
}

function explicitScopeConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher reviewed monitored software scope",
    "teacher approved monitored software scope",
    "all monitored software scope reviewed",
    "approved reviewed queues and exclusions",
    "\u5df2\u786e\u8ba4\u76d1\u63a7\u8f6f\u4ef6\u8303\u56f4",
    "\u5df2\u5ba1\u6838\u76d1\u63a7\u8303\u56f4\u548c\u6392\u9664\u9879",
    "\u786e\u8ba4\u53ea\u76d1\u63a7\u5df2\u5ba1\u6838\u8303\u56f4"
  ].some((marker) => text.includes(marker));
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Recurring Monitor Approval Gate",
    "",
    `Goal: ${packet.goal}`,
    `Schedule task: ${packet.schedule?.taskName || ""}`,
    `Status: ${packet.status}`,
    "",
    "This gate sits after an automatic low-token learning schedule package and before any Windows Scheduled Task registration.",
    "",
    "Review order:",
    "1. Confirm the monitored software queue or inventory is the reviewed in-scope set.",
    "2. Confirm private or excluded software is not being monitored.",
    "3. Confirm the schedule uses metadata-first low-token learning and bounded runs.",
    "4. Confirm a rollback point exists.",
    "5. Only then copy the generated registration request.",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary: this approval gate does not register a task, does not capture screenshots, does not read full logs, does not execute target software, does not write long-term memory, and does not claim universal native control."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Approve a reviewed recurring all-software low-token learning monitor.");
const scheduleInput = readJsonInput(argValue("--schedule", argValue("--schedule-package", argValue("--schedule-path", ""))), "--schedule");
if (!scheduleInput.value || scheduleInput.value.format !== "transparent_ai_automatic_low_token_learning_schedule_v1") {
  throw new Error("--schedule must be a transparent_ai_automatic_low_token_learning_schedule_v1 path or JSON object string");
}

const schedule = scheduleInput.value;
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--monitor-confirmation", ""));
const scopeConfirmation = argValue("--scope-confirmation", argValue("--teacher-scope-confirmation", ""));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-recurring-monitor-approval-gates")));

const registerPath = schedule.files?.registerTask || "";
const runnerPath = schedule.files?.runner || "";
const queuePath = schedule.queuePath || "";
const inventoryPath = schedule.inventoryPath || "";
const schedulePolicy = schedule.schedulePolicy || {};
const locksFromSchedule = schedule.locks || {};
const teacherConfirmationMatched = explicitTeacherConfirmation(teacherConfirmation);
const scopeConfirmationMatched = explicitScopeConfirmation(scopeConfirmation) || hasFlag("--teacher-reviewed-scope");
const rollbackPointCreated = hasFlag("--rollback-point-created");

const blockers = [];
if (!queuePath && !inventoryPath) blockers.push("missing_reviewed_queue_or_inventory_scope");
if (queuePath && !existsSync(queuePath)) blockers.push("reviewed_queue_path_not_found");
if (inventoryPath && !existsSync(inventoryPath)) blockers.push("reviewed_inventory_path_not_found");
if (!runnerPath || !existsSync(runnerPath)) blockers.push("scheduled_runner_path_not_found");
if (!registerPath || !existsSync(registerPath)) blockers.push("register_task_script_not_found");
if (schedulePolicy.scheduler !== "windows_scheduled_task") blockers.push("schedule_policy_is_not_windows_scheduled_task");
if (schedulePolicy.requiresTeacherConfirmedFlag !== true) blockers.push("register_script_does_not_require_teacher_confirmed_flag");
if (schedulePolicy.metadataGateFirst !== true) blockers.push("schedule_does_not_start_with_metadata_gate");
if (schedulePolicy.continuousRecording !== false) blockers.push("schedule_allows_continuous_recording");
if (locksFromSchedule.scheduledTaskInstalled !== false || schedulePolicy.scheduledTaskInstalled !== false) blockers.push("schedule_already_installed_or_install_state_unclear");
if (locksFromSchedule.longTermMemoryWritten !== false) blockers.push("schedule_allows_unattended_memory_write");
if (locksFromSchedule.softwareActionsExecuted !== false) blockers.push("schedule_allows_target_software_execution");
if (locksFromSchedule.nativeUniversalExecution !== false) blockers.push("schedule_claims_native_universal_execution");
if (!teacherConfirmationMatched) blockers.push("missing_explicit_teacher_recurring_monitor_confirmation");
if (!scopeConfirmationMatched) blockers.push("missing_reviewed_monitor_scope_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_recurring_monitor");

const readyForRegistrationRequest = blockers.length === 0;
mkdirSync(outputRoot, { recursive: true });
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  scheduledTaskInstalled: false,
  approvalGateDoesNotRegisterTask: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  teacherScopeConfirmationRequired: true,
  teacherRecurringMonitorConfirmationRequired: true,
  rollbackPointRequired: true
};

const packet = {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_approval_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  goal,
  status: readyForRegistrationRequest ? "ready_for_teacher_confirmed_recurring_monitor_registration_request" : "blocked_before_recurring_monitor_registration_request",
  readyForRegistrationRequest,
  sourceSchedulePath: scheduleInput.path,
  schedule: {
    format: schedule.format || "",
    scheduleId: schedule.scheduleId || "",
    taskName: schedule.taskName || "",
    inputKind: schedule.inputKind || "",
    queuePath,
    inventoryPath,
    runnerPath,
    registerPath,
    runOutputDir: schedule.runOutputDir || "",
    stateDir: schedule.stateDir || "",
    intervalMinutes: schedulePolicy.intervalMinutes ?? null,
    runsPerLaunch: schedulePolicy.runsPerLaunch ?? null,
    metadataGateFirst: schedulePolicy.metadataGateFirst === true,
    skipTailWhenMetadataUnchanged: schedulePolicy.skipTailWhenMetadataUnchanged === true,
    scheduledTaskInstalled: schedulePolicy.scheduledTaskInstalled === true
  },
  teacherConfirmationMatched,
  scopeConfirmationMatched,
  rollbackPointCreated,
  blockers,
  generatedRegistrationRequest: readyForRegistrationRequest
    ? {
        shell: "powershell",
        scriptPath: resolve(registerPath),
        args: ["-TeacherConfirmed"],
        taskName: schedule.taskName || "",
        mustRunManuallyAfterTeacherReview: true
      }
    : null,
  blockedActions: [
    "register recurring monitor without teacher scope confirmation",
    "register recurring monitor without rollback point",
    "monitor private or excluded software without review",
    "capture screenshots by default",
    "read full logs by default",
    "write long-term memory without teacher review",
    "execute target software from monitor",
    "claim universal native control"
  ],
  locks
};

const receipt = {
  format: "transparent_ai_all_software_recurring_monitor_approval_gate_receipt_v1",
  gateId,
  status: packet.status,
  readyForRegistrationRequest,
  taskRegistered: false,
  scheduledTaskInstalled: false,
  registrationRequestGenerated: Boolean(packet.generatedRegistrationRequest),
  registerPath,
  teacherConfirmationMatched,
  scopeConfirmationMatched,
  rollbackPointCreated,
  blockers,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks
};

const gatePath = join(gateDir, "all-software-recurring-monitor-approval-gate.json");
const receiptPath = join(gateDir, "all-software-recurring-monitor-approval-gate-receipt.json");
const readmePath = join(gateDir, "ALL_SOFTWARE_RECURRING_MONITOR_APPROVAL_GATE_START_HERE.md");
writeFileSync(gatePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_approval_gate_result_v1",
      status: packet.status,
      gateId,
      gatePath,
      receiptPath,
      readmePath,
      readyForRegistrationRequest,
      blockers,
      generatedRegistrationRequest: packet.generatedRegistrationRequest,
      locks
    },
    null,
    2
  )
);
