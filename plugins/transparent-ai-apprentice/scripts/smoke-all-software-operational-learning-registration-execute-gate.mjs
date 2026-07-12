#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "oreg", String(Date.now()));
const smokeGoal = "oreg";

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const trialResult = runNodeScript("run-all-software-operational-learning-trial.mjs", [
  "--goal",
  smokeGoal,
  "--max-processes",
  "4",
  "--max-installed",
  "4",
  "--max-log-files-per-candidate",
  "1",
  "--max-queue-candidates",
  "3",
  "--runs",
  "1",
  "--max-runner-items",
  "2",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "8",
  "--max-learning-items",
  "1",
  "--output-dir",
  join(smokeRoot, "trial")
]);

const activationResult = runNodeScript("create-all-software-operational-learning-activation-gate.mjs", [
  "--goal",
  smokeGoal,
  "--trial",
  trialResult.trialPath,
  "--teacher-confirmation",
  "teacher confirmed all-software recurring monitoring",
  "--scope-confirmation",
  "teacher reviewed monitored software scope",
  "--registration-confirmation",
  "teacher confirmed recurring monitor registration",
  "--teacher-reviewed-scope",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "activation")
]);

const rehearsalResult = runNodeScript("run-all-software-operational-learning-activation-dry-run-rehearsal.mjs", [
  "--goal",
  smokeGoal,
  "--activation-gate",
  activationResult.activationGatePath,
  "--output-dir",
  join(smokeRoot, "rehearsal")
]);

const blockedResult = runNodeScript("create-all-software-operational-learning-registration-execute-gate.mjs", [
  "--goal",
  smokeGoal,
  "--dry-run-rehearsal",
  rehearsalResult.rehearsalPath,
  "--output-dir",
  join(smokeRoot, "blocked-gate")
]);

const readyResult = runNodeScript("create-all-software-operational-learning-registration-execute-gate.mjs", [
  "--goal",
  smokeGoal,
  "--dry-run-rehearsal",
  rehearsalResult.rehearsalPath,
  "--teacher-registration-confirmation",
  "teacher approved execute registration after dry-run rehearsal",
  "--rollback-point",
  join(repoRoot, ".transparent-apprentice", "rollback-points", "smoke-rollback-point"),
  "--output-dir",
  join(smokeRoot, "ready-gate")
]);

const blockedGate = readJson(blockedResult.gatePath);
const readyGate = readJson(readyResult.gatePath);
const readyReceipt = readJson(readyResult.receiptPath);
const rehearsal = readJson(rehearsalResult.rehearsalPath);

const checks = [
  check(
    "Registration execute gate blocks without explicit teacher confirmation and rollback",
    blockedGate.format === "transparent_ai_all_software_operational_learning_registration_execute_gate_v1" &&
      blockedGate.status === "blocked_before_registration_execute_request" &&
      blockedGate.blockers.includes("missing_explicit_teacher_registration_confirmation") &&
      blockedGate.blockers.includes("rollback_point_not_confirmed_for_registration_execute_gate") &&
      blockedGate.locks.executeRequestExecuted === false &&
      blockedGate.locks.scheduledTaskRegistered === false,
    JSON.stringify(blockedGate.blockers)
  ),
  check(
    "Registration execute gate consumes a passed dry-run rehearsal and registration runner",
    readyGate.paths.sourceDryRunRehearsal === rehearsalResult.rehearsalPath &&
      readyGate.paths.sourceRegistrationRunner === rehearsal.paths.sourceRegistrationRunner &&
      readyGate.paths.wrapper === rehearsal.paths.wrapper &&
      existsSync(readyGate.paths.wrapper),
    `${readyGate.paths.sourceDryRunRehearsal}; ${readyGate.paths.sourceRegistrationRunner}`
  ),
  check(
    "Registration execute gate preserves teacher-reviewed operational monitor scope",
    readyGate.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      readyGate.operationalScope.sourceTrialPath === rehearsal.operationalScope?.sourceTrialPath &&
      readyGate.operationalScope.sourceSchedulePath === rehearsal.operationalScope?.sourceSchedulePath &&
      readyGate.operationalScope.teacherReviewedScope === true &&
      readyReceipt.operationalScope?.sourceTrialPath === readyGate.operationalScope.sourceTrialPath,
    JSON.stringify(readyGate.operationalScope)
  ),
  check(
    "Ready gate prepares execute and rollback commands without running them",
    readyGate.status === "ready_for_teacher_registration_execute_review" &&
      readyGate.readyForTeacherRegistrationExecuteReview === true &&
      readyGate.executeRequest.display.includes("-Execute") &&
      readyGate.rollbackRequest.display.includes("-Unregister") &&
      readyGate.executeRequest.preparedButNotExecuted === true &&
      readyGate.locks.executeRequestPrepared === true &&
      readyGate.locks.executeRequestExecuted === false,
    JSON.stringify({ execute: readyGate.executeRequest, rollback: readyGate.rollbackRequest })
  ),
  check(
    "Registration execute gate keeps system-change and learning locks closed",
    readyReceipt.format === "transparent_ai_all_software_operational_learning_registration_execute_gate_receipt_v1" &&
      readyReceipt.executeRequestExecuted === false &&
      readyReceipt.scheduledTaskRegistered === false &&
      readyReceipt.scheduledTaskStarted === false &&
      readyReceipt.scheduledTaskUnregistered === false &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.screenshotsCaptured === false &&
      readyReceipt.longTermMemoryWritten === false &&
      readyReceipt.nativeUniversalExecution === false &&
      readyGate.locks.unattendedAllAppMonitoringComplete === false,
    JSON.stringify(readyReceipt.locks)
  ),
  check(
    "Registration execute gate writes teacher-readable start-here file",
    existsSync(readyResult.readme) &&
      readFileSync(readyResult.readme, "utf8").includes("ALL-Software Operational Learning Registration Execute Gate".replace("ALL", "All")) &&
      readFileSync(readyResult.readme, "utf8").includes("does not execute the registration command"),
    readyResult.readme
  )
];

const failed = checks.filter((item) => !item.pass);
const summary = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_learning_registration_execute_gate_smoke_v1",
  smokeRoot,
  trialPath: trialResult.trialPath,
  activationGatePath: activationResult.activationGatePath,
  rehearsalPath: rehearsalResult.rehearsalPath,
  blockedGatePath: blockedResult.gatePath,
  readyGatePath: readyResult.gatePath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
