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

function slugify(value) {
  return (
    String(value || "all-software-operational-learning-activation-dry-run-rehearsal")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "all-software-operational-learning-activation-dry-run-rehearsal"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
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

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: Number(argValue("--child-timeout-ms", "180000"))
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function powershellExe() {
  const windowsRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
  const systemPowerShell = join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return existsSync(systemPowerShell) ? systemPowerShell : "powershell.exe";
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Operational Learning Activation Dry-Run Rehearsal",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    "",
    "What this rehearsal did:",
    "- Read an all-software operational learning activation gate.",
    "- Located the generated recurring-monitor registration wrapper.",
    "- Ran the wrapper with `-TeacherConfirmed` but without `-Execute`.",
    "- Captured stdout, stderr, and exit code as review evidence.",
    "- Queried scheduled-task status through the existing read-only verifier after the dry run.",
    "",
    "Open in order:",
    `1. Rehearsal packet: ${packet.paths.rehearsal}`,
    `2. Receipt: ${packet.paths.receipt}`,
    `3. Source activation gate: ${packet.paths.sourceActivationGate}`,
    `4. Source registration runner: ${packet.paths.sourceRegistrationRunner}`,
    `5. Dry-run wrapper: ${packet.paths.wrapper}`,
    `6. Post-rehearsal status query: ${packet.paths.postRehearsalRegistrationStatus || "not created"}`,
    "",
    "Dry-run command executed:",
    "",
    "```powershell",
    packet.dryRunCommand.display,
    "```",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary:",
    "- This rehearsal does not pass `-Execute` to the wrapper.",
    "- It does not register, start, stop, or unregister a Windows Scheduled Task.",
    "- It does not launch target software, send UI events, capture screenshots, read full logs, write long-term memory, enable rules, accept technology, or claim universal native control."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Rehearse the reviewed all-software operational learning activation runner in dry-run mode before any system change."
);
const activationInput = readJsonInput(
  argValue("--activation-gate", argValue("--activation", argValue("--gate", ""))),
  "--activation-gate",
  "transparent_ai_all_software_operational_learning_activation_gate_v1"
);
if (!activationInput.value) throw new Error("--activation-gate is required");

const activationGate = activationInput.value;
const operationalScope = activationGate.operationalScope || null;
const runnerPath = resolve(
  argValue(
    "--registration-runner",
    argValue("--runner", activationGate.paths?.registrationRunner || "")
  )
);
if (!runnerPath || !existsSync(runnerPath)) {
  throw new Error("A source registration runner path is required and must exist");
}

const registrationRunner = readJson(runnerPath);
if (registrationRunner.format !== "transparent_ai_all_software_recurring_monitor_registration_runner_v1") {
  throw new Error("--registration-runner must be transparent_ai_all_software_recurring_monitor_registration_runner_v1");
}

const wrapperPath = resolve(registrationRunner.files?.wrapper || "");
if (!wrapperPath || !existsSync(wrapperPath)) {
  throw new Error("Source registration runner must include an existing files.wrapper");
}

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-activation-dry-run-rehearsals")
  )
);
mkdirSync(outputRoot, { recursive: true });
const rehearsalId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const rehearsalDir = join(outputRoot, rehearsalId);
mkdirSync(rehearsalDir, { recursive: true });

const wrapperArgs = ["-ExecutionPolicy", "Bypass", "-File", wrapperPath, "-TeacherConfirmed"];
const wrapperCommand = powershellExe();
const wrapperResult = spawnSync(wrapperCommand, wrapperArgs, {
  cwd: rehearsalDir,
  encoding: "utf8",
  timeout: Number(argValue("--wrapper-timeout-ms", "120000")),
  maxBuffer: 10 * 1024 * 1024
});

const stdout = String(wrapperResult.stdout || "");
const stderr = String(wrapperResult.stderr || "");
const dryRunOutputMatched =
  wrapperResult.status === 0 &&
  stdout.includes("dry_run=true") &&
  stdout.includes("register=") &&
  stdout.includes("unregister=");

const statusResult = runNodeScript("verify-all-software-recurring-monitor-registration-status.mjs", [
  "--goal",
  goal,
  "--registration-runner",
  runnerPath,
  "--output-dir",
  join(rehearsalDir, "post-rehearsal-registration-status")
]);
const postStatus = readJson(statusResult.statusPath);

const blockers = [];
if (activationGate.readyForTeacherRegistrationReview !== true) {
  blockers.push("activation_gate_not_ready_for_teacher_registration_review");
}
if (registrationRunner.status !== "dry_run_ready_for_teacher_review") {
  blockers.push("source_registration_runner_not_dry_run_ready");
}
if (registrationRunner.locks?.dryRunDefault !== true) {
  blockers.push("source_registration_runner_does_not_default_to_dry_run");
}
if (wrapperResult.status !== 0) {
  blockers.push("dry_run_wrapper_exit_code_nonzero");
}
if (!stdout.includes("dry_run=true")) {
  blockers.push("dry_run_wrapper_stdout_missing_dry_run_true");
}
if (!stdout.includes("register=") || !stdout.includes("unregister=")) {
  blockers.push("dry_run_wrapper_stdout_missing_register_or_unregister_handoff");
}
if (stderr.trim()) {
  blockers.push("dry_run_wrapper_wrote_stderr");
}
if (postStatus.locks?.statusVerifierDoesNotChangeSystem !== true || postStatus.queryResult?.queryChangedSystem !== false) {
  blockers.push("post_rehearsal_status_query_changed_system_or_missing_lock");
}

const status = blockers.length
  ? "dry_run_rehearsal_needs_teacher_review"
  : "dry_run_rehearsal_passed_no_system_change";
const rehearsalPath = join(rehearsalDir, "all-software-operational-learning-activation-dry-run-rehearsal.json");
const receiptPath = join(rehearsalDir, "all-software-operational-learning-activation-dry-run-rehearsal-receipt.json");
const readmePath = join(rehearsalDir, "ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_DRY_RUN_REHEARSAL_START_HERE.md");

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  activationDryRunWrapperExecuted: true,
  wrapperExecuteFlagPassed: false,
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  scheduledTaskStopped: false,
  scheduledTaskUnregistered: false,
  registrationStatusQueryOnly: true,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  unattendedAllAppMonitoringComplete: false,
  teacherConfirmationRequiredBeforeSystemChange: true
};

const packet = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
  rehearsalId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  dryRunRehearsalPassed: blockers.length === 0,
  operationalScope,
  sourceActivationStatus: activationGate.status,
  sourceRegistrationRunnerStatus: registrationRunner.status,
  paths: {
    rehearsal: rehearsalPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceActivationGate: activationInput.path,
    sourceRegistrationRunner: runnerPath,
    wrapper: wrapperPath,
    postRehearsalRegistrationStatus: statusResult.statusPath,
    postRehearsalRegistrationStatusReceipt: statusResult.receiptPath || ""
  },
  existingAbilitiesReused: [
    "create_all_software_operational_learning_activation_gate",
    "run_all_software_recurring_monitor_registration_runner",
    "verify_all_software_recurring_monitor_registration_status"
  ],
  dryRunCommand: {
    command: wrapperCommand,
    args: wrapperArgs,
    display: `powershell.exe -ExecutionPolicy Bypass -File "${wrapperPath}" -TeacherConfirmed`,
    executeFlagPassed: false
  },
  dryRunExecution: {
    exitCode: wrapperResult.status,
    stdout,
    stderr,
    matchedExpectedDryRunOutput: dryRunOutputMatched
  },
  postRehearsalRegistrationStatus: {
    statusPath: statusResult.statusPath,
    taskState: postStatus.queryResult?.state || postStatus.queryResult?.taskState || "",
    queryChangedSystem: postStatus.queryResult?.queryChangedSystem === true,
    verifierDoesNotChangeSystem: postStatus.locks?.statusVerifierDoesNotChangeSystem === true
  },
  nextSafeStep:
    blockers.length === 0
      ? "Teacher can review this dry-run rehearsal. Real registration still requires a separate explicit execute-mode approval and kept rollback point."
      : "Review the blockers before any execute-mode registration request.",
  blockedActions: [
    "pass -Execute from rehearsal",
    "register scheduled task from rehearsal",
    "start scheduled task from rehearsal",
    "unregister scheduled task from rehearsal",
    "capture screenshots from rehearsal",
    "write long-term memory from rehearsal",
    "execute target software from rehearsal",
    "claim unattended all-app monitoring completion"
  ],
  blockers: [...new Set(blockers)],
  locks
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_receipt_v1",
  rehearsalId,
  status,
  dryRunRehearsalPassed: blockers.length === 0,
  operationalScope,
  sourceActivationGate: activationInput.path,
  sourceRegistrationRunner: runnerPath,
  wrapper: wrapperPath,
  wrapperExitCode: wrapperResult.status,
  wrapperStdoutMatched: dryRunOutputMatched,
  postRehearsalRegistrationStatus: statusResult.statusPath,
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  scheduledTaskUnregistered: false,
  wrapperExecuteFlagPassed: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  blockers: packet.blockers,
  locks
};

writeFileSync(rehearsalPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_result_v1",
      rehearsalId,
      status,
      dryRunRehearsalPassed: blockers.length === 0,
      operationalScope,
      rehearsalPath,
      receiptPath,
      readme: readmePath,
      sourceActivationGate: activationInput.path,
      sourceRegistrationRunner: runnerPath,
      wrapperPath,
      postRehearsalRegistrationStatusPath: statusResult.statusPath,
      wrapperExitCode: wrapperResult.status,
      wrapperExecuteFlagPassed: false,
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
