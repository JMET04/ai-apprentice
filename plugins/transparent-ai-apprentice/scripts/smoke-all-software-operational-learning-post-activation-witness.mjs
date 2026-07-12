#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "opaw", String(Date.now()));

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

mkdirSync(smokeRoot, { recursive: true });

const runnerPath = join(smokeRoot, "registration-runner.json");
const schedulePath = join(smokeRoot, "schedule.json");
const dryRunRehearsalPath = writeJson(join(smokeRoot, "dry-run-rehearsal.json"), {
  format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
  status: "passed_no_system_change",
  paths: {
    wrapper: join(smokeRoot, "register-wrapper.ps1"),
    sourceRegistrationRunner: runnerPath,
    sourceSchedule: schedulePath
  },
  locks: {
    activationDryRunWrapperExecuted: true,
    wrapperExecuteFlagPassed: false,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});
writeFileSync(join(smokeRoot, "register-wrapper.ps1"), "# smoke wrapper\n", "utf8");
writeJson(runnerPath, {
  format: "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
  status: "dry_run_ready_for_teacher_review",
  sourceSchedulePath: schedulePath,
  taskName: "TransparentAISmokePostActivationWitness"
});
writeJson(schedulePath, {
  format: "transparent_ai_automatic_low_token_learning_schedule_v1",
  status: "ready_for_teacher_registration_review",
  taskName: "TransparentAISmokePostActivationWitness",
  runOutputDir: join(smokeRoot, "run-output")
});

const executeGatePath = writeJson(join(smokeRoot, "registration-execute-gate.json"), {
  format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
  status: "ready_for_teacher_registration_execute_review",
  paths: {
    wrapper: join(smokeRoot, "register-wrapper.ps1"),
    sourceRegistrationRunner: runnerPath,
    sourceSchedule: schedulePath
  },
  locks: {
    executeRequestPrepared: true,
    executeRequestExecuted: false,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});

const missingStatusResult = runNodeScript("create-all-software-operational-learning-post-activation-witness.mjs", [
  "--goal",
  "Witness post activation chain without system changes.",
  "--dry-run-rehearsal",
  dryRunRehearsalPath,
  "--registration-execute-gate",
  executeGatePath,
  "--output-dir",
  join(smokeRoot, "missing-status")
]);
const missingStatus = readJson(missingStatusResult.witnessPath);

const registeredStatusPath = writeJson(join(smokeRoot, "registered-status.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "registered_and_matches_reviewed_runner",
  taskRegistered: true,
  registeredMatchesExpectedRunner: true,
  sourceRegistrationRunnerPath: runnerPath,
  sourceSchedulePath: schedulePath,
  locks: {
    statusVerifierDoesNotChangeSystem: true
  }
});
const emptyOutputAuditPath = writeJson(join(smokeRoot, "empty-run-output-audit.json"), {
  format: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
  status: "waiting_for_first_scheduled_run_output",
  reviewedRunCount: 0,
  totals: { compactLearningEvents: 0 }
});
const registeredNoOutputResult = runNodeScript("create-all-software-operational-learning-post-activation-witness.mjs", [
  "--goal",
  "Witness post activation registered chain waiting for output.",
  "--dry-run-rehearsal",
  dryRunRehearsalPath,
  "--registration-execute-gate",
  executeGatePath,
  "--registration-status",
  registeredStatusPath,
  "--run-output-audit",
  emptyOutputAuditPath,
  "--output-dir",
  join(smokeRoot, "registered-no-output")
]);
const registeredNoOutput = readJson(registeredNoOutputResult.witnessPath);

const outputAuditPath = writeJson(join(smokeRoot, "run-output-audit.json"), {
  format: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
  status: "learning_events_waiting_for_teacher_review",
  reviewedRunCount: 1,
  totals: { compactLearningEvents: 2 }
});
const reviewPacketPath = writeJson(join(smokeRoot, "teacher-review-packet.json"), {
  format: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
  status: "waiting_for_teacher_review",
  reviewItemCount: 2
});
const replayPath = writeJson(join(smokeRoot, "review-replay.json"), {
  format: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
  status: "review_decisions_replayed",
  replayItems: [
    { id: "review-1", status: "ready_for_follow_up" },
    { id: "review-2", status: "ready_for_follow_up" }
  ]
});
const unattendedPath = writeJson(join(smokeRoot, "unattended-audit.json"), {
  format: "transparent_ai_all_software_unattended_learning_audit_v1",
  status: "unattended_learning_ready_for_teacher_operational_review",
  unattendedAllAppMonitoringComplete: true
});
const readyResult = runNodeScript("create-all-software-operational-learning-post-activation-witness.mjs", [
  "--goal",
  "Witness post activation chain ready for teacher operational review.",
  "--dry-run-rehearsal",
  dryRunRehearsalPath,
  "--registration-execute-gate",
  executeGatePath,
  "--registration-status",
  registeredStatusPath,
  "--run-output-audit",
  outputAuditPath,
  "--teacher-review-packet",
  reviewPacketPath,
  "--review-decision-replay-queue",
  replayPath,
  "--unattended-audit",
  unattendedPath,
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyWitness = readJson(readyResult.witnessPath);
const readyReceipt = readJson(readyResult.receiptPath);

const checks = [
  check(
    "Post-activation witness blocks before read-only registration status exists",
    missingStatus.format === "transparent_ai_all_software_operational_learning_post_activation_witness_v1" &&
      missingStatus.status === "waiting_for_post_activation_registration_status" &&
      missingStatus.remainingGaps.some((gap) => gap.kind === "missing_post_activation_registration_status") &&
      missingStatus.locks.registerTaskCalled === false &&
      missingStatus.locks.runnerLaunched === false,
    JSON.stringify(missingStatus.remainingGaps)
  ),
  check(
    "Registered task without reviewed output is not overclaimed as operational",
    registeredNoOutput.status === "registered_waiting_for_post_activation_output_review" &&
      registeredNoOutput.remainingGaps.some((gap) => gap.kind === "missing_post_activation_reviewed_run_output") &&
      registeredNoOutput.readyForTeacherOperationalReview === false,
    JSON.stringify({ status: registeredNoOutput.status, gaps: registeredNoOutput.remainingGaps })
  ),
  check(
    "Complete evidence chain reaches teacher operational review while goal completion remains unclaimed",
    readyWitness.status === "post_activation_witness_ready_for_teacher_operational_review" &&
      readyWitness.readyForTeacherOperationalReview === true &&
      readyWitness.remainingGaps.length === 0 &&
      readyWitness.completionBoundary.goalComplete === false &&
      readyWitness.completionBoundary.universalNativeControlComplete === false,
    JSON.stringify(readyWitness.completionBoundary)
  ),
  check(
    "Post-activation witness keeps system-change and learning locks closed",
    readyReceipt.format === "transparent_ai_all_software_operational_learning_post_activation_witness_receipt_v1" &&
      readyReceipt.registerTaskCalled === false &&
      readyReceipt.startTaskCalled === false &&
      readyReceipt.runnerLaunched === false &&
      readyReceipt.screenshotsCaptured === false &&
      readyReceipt.softwareActionsExecuted === false &&
      readyReceipt.longTermMemoryWritten === false &&
      readyReceipt.nativeUniversalExecution === false,
    JSON.stringify(readyReceipt.locks)
  ),
  check(
    "Post-activation witness writes teacher-readable start-here file",
    existsSync(readyResult.readme) &&
      readFileSync(readyResult.readme, "utf8").includes("Post-Activation Witness") &&
      readFileSync(readyResult.readme, "utf8").includes("does not register Windows Scheduled Tasks"),
    readyResult.readme
  )
];

const failed = checks.filter((item) => !item.pass);
const summary = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_learning_post_activation_witness_smoke_v1",
  smokeRoot,
  missingStatusWitness: missingStatusResult.witnessPath,
  registeredNoOutputWitness: registeredNoOutputResult.witnessPath,
  readyWitness: readyResult.witnessPath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
