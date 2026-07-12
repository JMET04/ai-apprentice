#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "oreg-approved", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function psSingleQuoted(value) {
  return String(value || "").replace(/'/g, "''");
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const markerPath = join(smokeRoot, "fake-registration-marker.txt");
const registerScriptPath = join(smokeRoot, "fake-register.ps1");
const unregisterScriptPath = join(smokeRoot, "fake-unregister.ps1");
const scheduledRunnerPath = join(smokeRoot, "scheduled-runner.ps1");
writeFileSync(
  registerScriptPath,
  [
    "param([switch]$TeacherConfirmed)",
    "$ErrorActionPreference = 'Stop'",
    "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed required' }",
    `Set-Content -LiteralPath '${psSingleQuoted(markerPath)}' -Value 'registered-marker-only' -Encoding UTF8`,
    "exit 0"
  ].join("\n") + "\n",
  "utf8"
);
writeFileSync(
  unregisterScriptPath,
  [
    "param([switch]$TeacherConfirmed)",
    "$ErrorActionPreference = 'Stop'",
    "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed required' }",
    `if (Test-Path -LiteralPath '${psSingleQuoted(markerPath)}') { Remove-Item -LiteralPath '${psSingleQuoted(markerPath)}' -Force }`,
    "exit 0"
  ].join("\n") + "\n",
  "utf8"
);
writeFileSync(scheduledRunnerPath, "Write-Output 'scheduled runner fixture only'\n", "utf8");

const schedulePath = join(smokeRoot, "fake-schedule.json");
const operationalScope = {
  scopeKind: "teacher_reviewed_operational_low_token_monitor_scope",
  sourceTrialPath: join(smokeRoot, "operational-trial.json"),
  sourceSchedulePath: schedulePath,
  sourceReviewedRunCount: 1,
  teacherReviewedScope: true,
  rollbackPointCreated: true
};
writeJson(schedulePath, {
  ok: true,
  format: "transparent_ai_automatic_low_token_learning_schedule_v1",
  taskName: `TransparentAI-Smoke-Approved-Registration-${Date.now()}`,
  files: {
    registerTask: registerScriptPath,
    unregisterTask: unregisterScriptPath,
    runner: scheduledRunnerPath
  },
  schedulePolicy: {
    requiresTeacherConfirmedFlag: true
  },
  locks: {
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false
  }
});

const approvalGatePath = join(smokeRoot, "fake-recurring-monitor-approval-gate.json");
writeJson(approvalGatePath, {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_approval_gate_v1",
  status: "ready_for_registration_request",
  readyForRegistrationRequest: true,
  sourceSchedulePath: schedulePath,
  generatedRegistrationRequest: {
    scriptPath: registerScriptPath,
    taskName: readJson(schedulePath).taskName
  },
  schedule: {
    sourceSchedulePath: schedulePath,
    taskName: readJson(schedulePath).taskName
  },
  locks: {
    approvalGateDoesNotRegisterTask: true,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false
  }
});

const sourceRunner = runNodeScript("run-all-software-recurring-monitor-registration-runner.mjs", [
  "--goal",
  "Create source dry-run registration runner for approved-runner smoke.",
  "--approval-gate",
  approvalGatePath,
  "--teacher-confirmation",
  "teacher confirmed recurring monitor registration",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "source-dry-runner")
]);
const sourceRunnerPacket = readJson(sourceRunner.runnerPath);

const postRehearsalStatus = runNodeScript("verify-all-software-recurring-monitor-registration-status.mjs", [
  "--goal",
  "Fixture post-rehearsal status.",
  "--registration-runner",
  sourceRunner.runnerPath,
  "--output-dir",
  join(smokeRoot, "post-rehearsal-status")
]);

const rehearsalPath = join(smokeRoot, "fake-activation-dry-run-rehearsal.json");
writeJson(rehearsalPath, {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
  status: "dry_run_rehearsal_passed_no_system_change",
  dryRunRehearsalPassed: true,
  operationalScope,
  paths: {
    sourceRegistrationRunner: sourceRunner.runnerPath,
    wrapper: sourceRunner.wrapperPath,
    postRehearsalRegistrationStatus: postRehearsalStatus.statusPath
  },
  locks: {
    wrapperExecuteFlagPassed: false,
    scheduledTaskRegistered: false,
    registrationStatusQueryOnly: true
  }
});

const executeGate = runNodeScript("create-all-software-operational-learning-registration-execute-gate.mjs", [
  "--goal",
  "Prepare ready registration execute gate for approved-runner smoke.",
  "--dry-run-rehearsal",
  rehearsalPath,
  "--teacher-registration-confirmation",
  "teacher approved execute registration after dry-run rehearsal",
  "--rollback-point",
  join(smokeRoot, "rollback-point"),
  "--output-dir",
  join(smokeRoot, "ready-execute-gate")
]);
const executeGatePacket = readJson(executeGate.gatePath);

const missingFlag = runNodeScript("run-all-software-operational-learning-registration-approved-runner.mjs", [
  "--goal",
  "Missing final execute flag should block.",
  "--registration-execute-gate",
  executeGate.gatePath,
  "--teacher-confirmation",
  "teacher confirmed approved registration runner",
  "--rollback-point-created",
  "--allow-system-change",
  "--output-dir",
  join(smokeRoot, "missing-flag")
]);
const missingAllow = runNodeScript("run-all-software-operational-learning-registration-approved-runner.mjs", [
  "--goal",
  "Missing allow-system-change should block.",
  "--registration-execute-gate",
  executeGate.gatePath,
  "--teacher-confirmation",
  "teacher confirmed approved registration runner",
  "--rollback-point-created",
  "--execute-approved-registration",
  "--output-dir",
  join(smokeRoot, "missing-allow")
]);
const ready = runNodeScript("run-all-software-operational-learning-registration-approved-runner.mjs", [
  "--goal",
  "Run fake approved registration through existing runner and status verifier.",
  "--registration-execute-gate",
  executeGate.gatePath,
  "--teacher-confirmation",
  "teacher confirmed approved registration runner",
  "--rollback-point-created",
  "--execute-approved-registration",
  "--allow-system-change",
  "--output-dir",
  join(smokeRoot, "ready-approved-runner")
]);
const readyPacket = readJson(ready.approvedRunnerPath);
const readyReceipt = readJson(ready.receiptPath);
const postExecuteStatusPacket = readJson(ready.postExecuteRegistrationStatusPath);

const checks = [
  check(
    "Registration approved runner blocks without final execute-approved-registration flag",
    missingFlag.status === "blocked_before_registration_approved_runner" &&
      missingFlag.blockers.includes("missing_execute_approved_registration_flag") &&
      missingFlag.registrationRunnerInvoked === false,
    JSON.stringify(missingFlag.blockers)
  ),
  check(
    "Registration approved runner blocks without explicit system-change allow flag",
    missingAllow.status === "blocked_before_registration_approved_runner" &&
      missingAllow.blockers.includes("missing_allow_system_change_for_registration") &&
      missingAllow.registrationRunnerInvoked === false,
    JSON.stringify(missingAllow.blockers)
  ),
  check(
    "Ready registration approved runner invokes the existing registration runner exactly after reviewed gate evidence",
    executeGatePacket.status === "ready_for_teacher_registration_execute_review" &&
      executeGatePacket.operationalScope?.teacherReviewedScope === true &&
      sourceRunnerPacket.status === "dry_run_ready_for_teacher_review" &&
      ready.registrationRunnerInvoked === true &&
      readyPacket.paths.sourceRegistrationExecuteGate === executeGate.gatePath &&
      readyPacket.paths.sourceRegistrationRunner === sourceRunner.runnerPath &&
      readyPacket.operationalScope?.sourceSchedulePath === schedulePath &&
      existsSync(markerPath),
    JSON.stringify({ source: sourceRunner.runnerPath, gate: executeGate.gatePath, markerPath })
  ),
  check(
    "Approved runner treats read-only scheduled-task status as authoritative after command success",
    ready.registrationCommandExitedZero === true &&
      ready.postExecuteTaskRegistered === false &&
      ready.postExecuteRegisteredMatchesExpectedRunner === false &&
      ready.postExecuteStatus === "verified_not_registered_yet" &&
      postExecuteStatusPacket.queryResult?.queryChangedSystem === false,
    ready.postExecuteRegistrationStatusPath
  ),
  check(
    "Registration approved runner preserves teacher-reviewed operational monitor scope",
    readyPacket.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      readyPacket.operationalScope?.teacherReviewedScope === true &&
      readyReceipt.operationalScope?.sourceTrialPath === operationalScope.sourceTrialPath,
    JSON.stringify(readyPacket.operationalScope)
  ),
  check(
    "Registration approved runner keeps learning, screenshot, target execution, packaging, and completion locks closed",
    readyReceipt.executedSystemChangeCommand === true &&
      readyReceipt.scheduledTaskRegistered === false &&
      readyReceipt.scheduledTaskStarted === false &&
      readyReceipt.scheduledTaskStopped === false &&
      readyReceipt.screenshotsCaptured === false &&
      readyReceipt.rawFullLogsRetained === false &&
      readyReceipt.softwareActionsExecuted === false &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.longTermMemoryWritten === false &&
      readyReceipt.nativeUniversalExecution === false &&
      readyReceipt.goalComplete === false &&
      readyReceipt.locks?.packagingGated === true,
    JSON.stringify(readyReceipt.locks)
  )
];

const failed = checks.filter((item) => !item.pass);
const summary = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_learning_registration_approved_runner_smoke_v1",
  smokeRoot,
  paths: {
    approvalGate: approvalGatePath,
    sourceRunner: sourceRunner.runnerPath,
    postRehearsalStatus: postRehearsalStatus.statusPath,
    rehearsal: rehearsalPath,
    executeGate: executeGate.gatePath,
    readyApprovedRunner: ready.approvedRunnerPath,
    postExecuteStatus: ready.postExecuteRegistrationStatusPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
