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
  return (
    String(value || "all-software-operational-learning-registration-execute-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-learning-registration-execute-gate"
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
    "register the reviewed recurring monitor",
    "approve registering recurring low-token monitor",
    "i confirm recurring monitor registration",
    "i approve the scheduled task registration",
    "\u786e\u8ba4\u6ce8\u518c\u5468\u671f\u4f4e token \u76d1\u63a7",
    "\u786e\u8ba4\u5b89\u88c5\u5468\u671f\u4f4e token \u5b66\u4e60\u4efb\u52a1",
    "\u5141\u8bb8\u6ce8\u518c\u5df2\u5ba1\u6838\u7684\u5468\u671f\u76d1\u63a7"
  ].some((marker) => text.includes(marker));
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Operational Learning Registration Execute Gate",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    `Operational scope: ${packet.operationalScope?.scopeKind || "unspecified"}`,
    "",
    "This is the review gate after activation dry-run rehearsal and before any real Windows Scheduled Task registration.",
    "",
    "Evidence reviewed:",
    `- Dry-run rehearsal: ${packet.paths.sourceDryRunRehearsal}`,
    `- Registration runner: ${packet.paths.sourceRegistrationRunner}`,
    `- Wrapper: ${packet.paths.wrapper}`,
    `- Post-rehearsal status: ${packet.paths.postRehearsalRegistrationStatus || "not provided"}`,
    "",
    "Execute request prepared for a human or next supervised agent:",
    "",
    "```powershell",
    packet.executeRequest.display,
    "```",
    "",
    "Rollback/unregister command:",
    "",
    "```powershell",
    packet.rollbackRequest.display,
    "```",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary:",
    "- This gate does not execute the registration command.",
    "- It does not register, start, stop, or unregister a Windows Scheduled Task.",
    "- It does not launch target software, send UI events, capture screenshots, read full logs, write long-term memory, enable rules, accept technology, unlock packaging, or claim all-app unattended learning completion."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Create the final teacher-reviewed execute gate after all-software activation dry-run rehearsal."
);
const rehearsalInput = readJsonInput(
  argValue("--dry-run-rehearsal", argValue("--rehearsal", "")),
  "--dry-run-rehearsal",
  "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1"
);
if (!rehearsalInput.value) throw new Error("--dry-run-rehearsal is required");

const rehearsal = rehearsalInput.value;
const operationalScope = rehearsal.operationalScope || null;
const registrationRunnerPath = resolve(
  argValue("--registration-runner", rehearsal.paths?.sourceRegistrationRunner || "")
);
if (!registrationRunnerPath || !existsSync(registrationRunnerPath)) {
  throw new Error("A source registration runner path is required and must exist");
}
const registrationRunner = readJson(registrationRunnerPath);
if (registrationRunner.format !== "transparent_ai_all_software_recurring_monitor_registration_runner_v1") {
  throw new Error("--registration-runner must be transparent_ai_all_software_recurring_monitor_registration_runner_v1");
}

const postStatusPath = resolve(
  argValue("--registration-status", rehearsal.paths?.postRehearsalRegistrationStatus || "")
);
const postStatus = postStatusPath && existsSync(postStatusPath) ? readJson(postStatusPath) : null;
const wrapperPath = resolve(registrationRunner.files?.wrapper || rehearsal.paths?.wrapper || "");
const registerScriptPath = resolve(registrationRunner.registerCommand?.scriptPath || "");
const unregisterScriptPath = resolve(registrationRunner.unregisterCommand?.scriptPath || "");
const teacherRegistrationConfirmation = argValue(
  "--teacher-registration-confirmation",
  argValue("--registration-confirmation", argValue("--teacher-confirmation", ""))
);
const teacherConfirmedRegistration = explicitRegistrationConfirmation(teacherRegistrationConfirmation);
const rollbackPointPath = argValue("--rollback-point", argValue("--rollback", ""));
const rollbackPointCreated = hasFlag("--rollback-point-created") || Boolean(rollbackPointPath);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-registration-execute-gates")
  )
);

const blockers = [];
if (rehearsal.dryRunRehearsalPassed !== true) blockers.push("dry_run_rehearsal_not_passed");
if (rehearsal.status !== "dry_run_rehearsal_passed_no_system_change") {
  blockers.push("dry_run_rehearsal_status_not_passed_no_system_change");
}
if (rehearsal.locks?.wrapperExecuteFlagPassed !== false) blockers.push("dry_run_rehearsal_may_have_used_execute_flag");
if (rehearsal.locks?.scheduledTaskRegistered !== false) blockers.push("dry_run_rehearsal_registered_task");
if (rehearsal.locks?.registrationStatusQueryOnly !== true) blockers.push("dry_run_rehearsal_missing_read_only_status_lock");
if (registrationRunner.status !== "dry_run_ready_for_teacher_review") {
  blockers.push("source_registration_runner_not_dry_run_ready");
}
if (registrationRunner.locks?.dryRunDefault !== true) blockers.push("source_registration_runner_not_dry_run_default");
if (!wrapperPath || !existsSync(wrapperPath)) blockers.push("registration_wrapper_not_found");
if (!registerScriptPath || !existsSync(registerScriptPath)) blockers.push("register_script_not_found");
if (!unregisterScriptPath || !existsSync(unregisterScriptPath)) blockers.push("unregister_script_not_found");
if (postStatus && postStatus.locks?.statusVerifierDoesNotChangeSystem !== true) {
  blockers.push("post_rehearsal_status_verifier_missing_no_change_lock");
}
if (postStatus?.queryResult?.queryChangedSystem === true) blockers.push("post_rehearsal_status_query_changed_system");
if (postStatus?.queryResult?.found === true) blockers.push("scheduled_task_already_registered_before_execute_gate");
if (!teacherConfirmedRegistration) blockers.push("missing_explicit_teacher_registration_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_registration_execute_gate");

mkdirSync(outputRoot, { recursive: true });
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });

const gatePath = join(gateDir, "all-software-operational-learning-registration-execute-gate.json");
const receiptPath = join(gateDir, "all-software-operational-learning-registration-execute-gate-receipt.json");
const readmePath = join(gateDir, "ALL_SOFTWARE_OPERATIONAL_LEARNING_REGISTRATION_EXECUTE_GATE_START_HERE.md");

const executeRequest = {
  shell: "powershell.exe",
  wrapper: wrapperPath,
  args: ["-ExecutionPolicy", "Bypass", "-File", wrapperPath, "-TeacherConfirmed", "-Execute"],
  display: `powershell.exe -ExecutionPolicy Bypass -File "${wrapperPath}" -TeacherConfirmed -Execute`,
  teacherMustRunManuallyOrViaSeparateApprovedExecuteStep: true,
  preparedButNotExecuted: true
};
const rollbackRequest = {
  shell: "powershell.exe",
  wrapper: wrapperPath,
  args: ["-ExecutionPolicy", "Bypass", "-File", wrapperPath, "-TeacherConfirmed", "-Execute", "-Unregister"],
  display: `powershell.exe -ExecutionPolicy Bypass -File "${wrapperPath}" -TeacherConfirmed -Execute -Unregister`,
  preparedButNotExecuted: true
};

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  registrationExecuteGateCreated: true,
  executeRequestPrepared: true,
  executeRequestExecuted: false,
  wrapperExecuteFlagPassed: false,
  scheduledTaskRegistered: false,
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
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  unattendedAllAppMonitoringComplete: false,
  teacherConfirmationRequiredBeforeSystemChange: true,
  rollbackPointRequiredBeforeSystemChange: true
};

const status = blockers.length
  ? "blocked_before_registration_execute_request"
  : "ready_for_teacher_registration_execute_review";
const packet = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  readyForTeacherRegistrationExecuteReview: blockers.length === 0,
  operationalScope,
  sourceDryRunRehearsalStatus: rehearsal.status,
  sourceRegistrationRunnerStatus: registrationRunner.status,
  teacherConfirmedRegistration,
  rollbackPointCreated,
  paths: {
    gate: gatePath,
    receipt: receiptPath,
    readme: readmePath,
    sourceDryRunRehearsal: rehearsalInput.path,
    sourceRegistrationRunner: registrationRunnerPath,
    wrapper: wrapperPath,
    registerScript: registerScriptPath,
    unregisterScript: unregisterScriptPath,
    postRehearsalRegistrationStatus: postStatusPath && existsSync(postStatusPath) ? postStatusPath : "",
    rollbackPoint: rollbackPointPath
  },
  existingAbilitiesReused: [
    "run_all_software_operational_learning_activation_dry_run_rehearsal",
    "run_all_software_recurring_monitor_registration_runner",
    "verify_all_software_recurring_monitor_registration_status"
  ],
  executeRequest,
  rollbackRequest,
  nextSafeStep:
    blockers.length === 0
      ? "Teacher can review the execute request and run it separately only after confirming rollback and scope one more time."
      : "Resolve blockers, rerun dry-run rehearsal if needed, and keep the registration command unexecuted.",
  blockedActions: [
    "execute registration from this gate",
    "register scheduled task without teacher manually running the prepared request",
    "start scheduled task from this gate",
    "unregister scheduled task from this gate",
    "write long-term memory from this gate",
    "claim unattended all-app monitoring completion"
  ],
  blockers: [...new Set(blockers)],
  locks
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_registration_execute_gate_receipt_v1",
  gateId,
  status,
  readyForTeacherRegistrationExecuteReview: packet.readyForTeacherRegistrationExecuteReview,
  operationalScope,
  sourceDryRunRehearsal: rehearsalInput.path,
  sourceRegistrationRunner: registrationRunnerPath,
  executeRequestPrepared: true,
  executeRequestExecuted: false,
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  scheduledTaskUnregistered: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  blockers: packet.blockers,
  locks
};

writeFileSync(gatePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_learning_registration_execute_gate_result_v1",
      gateId,
      status,
      readyForTeacherRegistrationExecuteReview: packet.readyForTeacherRegistrationExecuteReview,
      operationalScope,
      gatePath,
      receiptPath,
      readme: readmePath,
      sourceDryRunRehearsal: rehearsalInput.path,
      sourceRegistrationRunner: registrationRunnerPath,
      wrapperPath,
      executeRequestPrepared: true,
      executeRequestExecuted: false,
      scheduledTaskRegistered: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      longTermMemoryWritten: false,
      nativeUniversalExecution: false,
      blockers: packet.blockers.length,
      locks
    },
    null,
    2
  )
);
