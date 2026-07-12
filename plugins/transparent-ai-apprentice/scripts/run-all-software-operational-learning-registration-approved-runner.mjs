#!/usr/bin/env node
import { spawnSync } from "node:child_process";
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
  return (
    String(value || "all-software-operational-learning-registration-approved-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-learning-registration-approved-runner"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label, expectedFormat = "") {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) {
    throw new Error(`${label} must be ${expectedFormat}`);
  }
  return parsed;
}

function explicitRegistrationConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed recurring monitor registration",
    "teacher confirmed scheduled task registration",
    "teacher approved execute registration after dry-run rehearsal",
    "teacher confirmed approved registration runner",
    "teacher confirmed approved recurring monitor registration runner",
    "register the reviewed recurring monitor",
    "approve registering recurring low-token monitor",
    "i confirm recurring monitor registration",
    "i approve the scheduled task registration",
    "\u786e\u8ba4\u6ce8\u518c\u5468\u671f\u4f4e token \u76d1\u63a7",
    "\u786e\u8ba4\u5b89\u88c5\u5468\u671f\u4f4e token \u5b66\u4e60\u4efb\u52a1",
    "\u5141\u8bb8\u6ce8\u518c\u5df2\u5ba1\u6838\u7684\u5468\u671f\u76d1\u63a7"
  ].some((marker) => text.includes(marker));
}

function runNodeScript(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: resolve(__dirname, "..", "..", ".."),
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0 && !options.allowNonZeroJson) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  try {
    return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed: ${error.message}`);
  }
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Operational Learning Registration Approved Runner",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    "",
    "This is the supervised execution bridge after a registration execute gate. It may call the existing recurring-monitor registration runner only when the teacher has given final registration approval, a rollback point exists, execute mode is explicit, and system-change permission is explicit.",
    "",
    "Source evidence:",
    `- Registration execute gate: ${packet.paths.sourceRegistrationExecuteGate}`,
    `- Source registration runner: ${packet.paths.sourceRegistrationRunner}`,
    `- Operational scope: ${packet.operationalScope?.scopeKind || "unspecified"}`,
    "",
    "Produced evidence:",
    `- Approved runner packet: ${packet.paths.approvedRunner}`,
    `- Receipt: ${packet.paths.receipt}`,
    `- Invoked registration runner: ${packet.paths.invokedRegistrationRunner || "not invoked"}`,
    `- Post-execute registration status: ${packet.paths.postExecuteRegistrationStatus || "not run"}`,
    "",
    "Execution result:",
    `- Registration runner invoked: ${packet.registrationRunnerInvoked}`,
    `- Registration command exited zero: ${packet.registrationCommandExitedZero}`,
    `- Post-execute task registered: ${packet.postExecuteTaskRegistered}`,
    `- Post-execute runner match: ${packet.postExecuteRegisteredMatchesExpectedRunner}`,
    "",
    "Blockers:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary:",
    "- A zero exit code is not treated as proof of recurring learning. The read-only registration status verifier is the authoritative evidence.",
    "- This runner does not start the scheduled task, read full logs, capture screenshots, execute target software, write long-term memory, enable rules, accept technology, unlock packaging, or claim all-app unattended learning completion."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Run one teacher-approved all-software recurring monitor registration command and witness the read-only status."
);
const gateInput = readJsonInput(
  argValue("--registration-execute-gate", argValue("--execute-gate", argValue("--gate", ""))),
  "--registration-execute-gate",
  "transparent_ai_all_software_operational_learning_registration_execute_gate_v1"
);
if (!gateInput.value) throw new Error("--registration-execute-gate is required");

const gate = gateInput.value;
const teacherConfirmation = argValue(
  "--teacher-registration-confirmation",
  argValue("--registration-confirmation", argValue("--teacher-confirmation", ""))
);
const teacherConfirmedRegistration = explicitRegistrationConfirmation(teacherConfirmation);
const executeApprovedRegistration = hasFlag("--execute-approved-registration");
const allowSystemChange = hasFlag("--allow-system-change");
const rollbackPointPath = argValue("--rollback-point", argValue("--rollback", ""));
const rollbackPointCreated = hasFlag("--rollback-point-created") || Boolean(rollbackPointPath);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-registration-approved-runners")
  )
);

const sourceRunnerPath = resolve(gate.paths?.sourceRegistrationRunner || "");
const sourceRunner = sourceRunnerPath && existsSync(sourceRunnerPath) ? readJson(sourceRunnerPath) : null;
const sourceApprovalGatePath = sourceRunner?.sourceApprovalGatePath ? resolve(sourceRunner.sourceApprovalGatePath) : "";
const operationalScope = gate.operationalScope || null;
const blockers = [];

if (gate.status !== "ready_for_teacher_registration_execute_review") {
  blockers.push("registration_execute_gate_not_ready_for_teacher_review");
}
if (gate.readyForTeacherRegistrationExecuteReview !== true) {
  blockers.push("registration_execute_gate_ready_flag_missing");
}
if (gate.executeRequest?.preparedButNotExecuted !== true) {
  blockers.push("registration_execute_gate_missing_prepared_execute_request");
}
if (gate.locks?.executeRequestExecuted !== false) blockers.push("registration_execute_gate_already_executed");
if (gate.locks?.scheduledTaskRegistered !== false) blockers.push("registration_execute_gate_claims_task_registered");
if (Array.isArray(gate.blockers) && gate.blockers.length) blockers.push("registration_execute_gate_has_blockers");
if (!sourceRunnerPath || !existsSync(sourceRunnerPath)) blockers.push("source_registration_runner_not_found");
if (sourceRunner && sourceRunner.format !== "transparent_ai_all_software_recurring_monitor_registration_runner_v1") {
  blockers.push("source_registration_runner_format_mismatch");
}
if (sourceRunner && sourceRunner.status !== "dry_run_ready_for_teacher_review") {
  blockers.push("source_registration_runner_not_dry_run_ready");
}
if (sourceRunner && sourceRunner.locks?.dryRunDefault !== true) {
  blockers.push("source_registration_runner_not_dry_run_default");
}
if (!sourceApprovalGatePath || !existsSync(sourceApprovalGatePath)) {
  blockers.push("source_approval_gate_not_found");
}
if (!operationalScope) blockers.push("operational_scope_missing_from_registration_execute_gate");
if (operationalScope && operationalScope.teacherReviewedScope !== true) {
  blockers.push("operational_scope_not_teacher_reviewed");
}
if (
  operationalScope?.sourceSchedulePath &&
  sourceRunner?.sourceSchedulePath &&
  resolve(operationalScope.sourceSchedulePath) !== resolve(sourceRunner.sourceSchedulePath)
) {
  blockers.push("operational_scope_schedule_mismatch_with_source_runner");
}
if (!executeApprovedRegistration) blockers.push("missing_execute_approved_registration_flag");
if (!allowSystemChange) blockers.push("missing_allow_system_change_for_registration");
if (!teacherConfirmedRegistration) blockers.push("missing_final_teacher_registration_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_registration_approved_runner");

mkdirSync(outputRoot, { recursive: true });
const approvedRunId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal).slice(0, 36)}`;
const approvedRunDir = join(outputRoot, approvedRunId);
mkdirSync(approvedRunDir, { recursive: true });

let invokedRegistrationRunnerResult = null;
let invokedRegistrationRunner = null;
let invokedRegistrationRunnerReceipt = null;
let postExecuteStatusResult = null;
let postExecuteStatus = null;
let postExecuteStatusReceipt = null;

if (!blockers.length) {
  const runnerOutputDir = join(approvedRunDir, "runner");
  invokedRegistrationRunnerResult = runNodeScript("run-all-software-recurring-monitor-registration-runner.mjs", [
    "--goal",
    "approved-registration-run",
    "--approval-gate",
    sourceApprovalGatePath,
    "--teacher-confirmation",
    `${teacherConfirmation}; teacher confirmed recurring monitor registration`,
    "--rollback-point-created",
    "--execute",
    "--allow-system-change",
    "--output-dir",
    runnerOutputDir
  ], { allowNonZeroJson: true });
  invokedRegistrationRunner = readJson(invokedRegistrationRunnerResult.runnerPath);
  invokedRegistrationRunnerReceipt = readJson(invokedRegistrationRunnerResult.receiptPath);

  postExecuteStatusResult = runNodeScript("verify-all-software-recurring-monitor-registration-status.mjs", [
    "--goal",
    "approved-registration-status-witness",
    "--registration-runner",
    invokedRegistrationRunnerResult.runnerPath,
    "--output-dir",
    join(approvedRunDir, "post-execute-registration-status")
  ]);
  postExecuteStatus = readJson(postExecuteStatusResult.statusPath);
  postExecuteStatusReceipt = readJson(postExecuteStatusResult.receiptPath);
}

const registrationRunnerInvoked = Boolean(invokedRegistrationRunnerResult);
const registrationCommandExitedZero = invokedRegistrationRunnerReceipt?.executionResult?.status === 0;
const postExecuteTaskRegistered = postExecuteStatusResult?.taskRegistered === true;
const postExecuteRegisteredMatchesExpectedRunner = postExecuteStatusResult?.registeredMatchesExpectedRunner === true;

let status = "blocked_before_registration_approved_runner";
if (registrationRunnerInvoked && invokedRegistrationRunnerResult?.status === "execute_requested_but_registration_failed") {
  status = "registration_execute_requested_but_runner_failed";
} else if (registrationRunnerInvoked && postExecuteRegisteredMatchesExpectedRunner) {
  status = "registration_execute_completed_and_status_matched";
} else if (registrationRunnerInvoked && registrationCommandExitedZero && !postExecuteRegisteredMatchesExpectedRunner) {
  status = "registration_execute_completed_but_status_not_registered_or_mismatch";
} else if (registrationRunnerInvoked) {
  status = "registration_execute_invoked_waiting_for_status_resolution";
}

const locks = {
  reviewOnly: !registrationRunnerInvoked,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  finalTeacherRegistrationConfirmationRequired: true,
  rollbackPointRequiredBeforeSystemChange: true,
  allowSystemChangeRequired: true,
  executeApprovedRegistrationRequired: true,
  registrationRunnerInvoked,
  registrationCommandExitedZero,
  statusVerifierRanAfterExecute: Boolean(postExecuteStatusResult),
  scheduledTaskRegistered: postExecuteTaskRegistered,
  registeredMatchesExpectedRunner: postExecuteRegisteredMatchesExpectedRunner,
  scheduledTaskStarted: false,
  scheduledTaskStopped: false,
  scheduledTaskUnregistered: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  longTermMemoryWritten: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  unattendedAllAppMonitoringComplete: false,
  goalComplete: false
};

const approvedRunnerPath = join(approvedRunDir, "all-software-operational-learning-registration-approved-runner.json");
const receiptPath = join(approvedRunDir, "all-software-operational-learning-registration-approved-runner-receipt.json");
const readmePath = join(approvedRunDir, "ALL_SOFTWARE_OPERATIONAL_LEARNING_REGISTRATION_APPROVED_RUNNER_START_HERE.md");

const packet = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_registration_approved_runner_v1",
  approvedRunId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceGateStatus: gate.status,
  sourceRegistrationRunnerStatus: sourceRunner?.status || "",
  operationalScope,
  executeApprovedRegistration,
  allowSystemChange,
  teacherConfirmedRegistration,
  rollbackPointCreated,
  registrationRunnerInvoked,
  registrationCommandExitedZero,
  postExecuteTaskRegistered,
  postExecuteRegisteredMatchesExpectedRunner,
  postExecuteStatus: postExecuteStatusResult?.status || "",
  paths: {
    approvedRunner: approvedRunnerPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceRegistrationExecuteGate: gateInput.path,
    sourceRegistrationRunner: sourceRunnerPath,
    sourceApprovalGate: sourceApprovalGatePath,
    rollbackPoint: rollbackPointPath,
    invokedRegistrationRunner: invokedRegistrationRunnerResult?.runnerPath || "",
    invokedRegistrationRunnerReceipt: invokedRegistrationRunnerResult?.receiptPath || "",
    postExecuteRegistrationStatus: postExecuteStatusResult?.statusPath || "",
    postExecuteRegistrationStatusReceipt: postExecuteStatusResult?.receiptPath || ""
  },
  invokedRegistrationRunnerResult,
  postExecuteStatusResult,
  blockedActions: [
    "execute registration without a ready registration execute gate",
    "execute registration without final teacher registration confirmation",
    "execute registration without rollback point evidence",
    "execute registration without explicit allow-system-change",
    "treat command exit success as proof of recurring learning without read-only scheduled-task status",
    "start the scheduled task from this approved runner",
    "read full logs, capture screenshots, execute target software, write memory, enable rules, accept technology, unlock packaging, or claim completion"
  ],
  blockers: [...new Set(blockers)],
  locks
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_registration_approved_runner_receipt_v1",
  approvedRunId,
  status,
  registrationRunnerInvoked,
  registrationCommandExitedZero,
  postExecuteTaskRegistered,
  postExecuteRegisteredMatchesExpectedRunner,
  postExecuteStatus: postExecuteStatusResult?.status || "",
  operationalScope,
  invokedRegistrationRunnerStatus: invokedRegistrationRunnerResult?.status || "",
  executedSystemChangeCommand: registrationRunnerInvoked,
  scheduledTaskRegistered: postExecuteTaskRegistered,
  scheduledTaskStarted: false,
  scheduledTaskStopped: false,
  scheduledTaskUnregistered: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  unattendedAllAppMonitoringComplete: false,
  goalComplete: false,
  blockers: packet.blockers,
  locks
};

writeFileSync(approvedRunnerPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_learning_registration_approved_runner_result_v1",
      status,
      approvedRunId,
      approvedRunnerPath,
      receiptPath,
      readmePath,
      sourceRegistrationExecuteGate: gateInput.path,
      registrationRunnerInvoked,
      registrationCommandExitedZero,
      postExecuteTaskRegistered,
      postExecuteRegisteredMatchesExpectedRunner,
      postExecuteStatus: postExecuteStatusResult?.status || "",
      invokedRegistrationRunnerPath: invokedRegistrationRunnerResult?.runnerPath || "",
      postExecuteRegistrationStatusPath: postExecuteStatusResult?.statusPath || "",
      blockers: packet.blockers,
      locks
    },
    null,
    2
  )
);
