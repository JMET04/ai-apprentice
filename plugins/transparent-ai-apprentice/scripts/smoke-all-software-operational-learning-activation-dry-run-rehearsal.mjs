#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "oar", String(Date.now()));
const smokeGoal = "oar";

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000
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

const activationGate = readJson(activationResult.activationGatePath);
const registrationRunner = readJson(activationGate.paths.registrationRunner);
const rehearsal = readJson(rehearsalResult.rehearsalPath);
const receipt = readJson(rehearsalResult.receiptPath);
const postStatus = readJson(rehearsalResult.postRehearsalRegistrationStatusPath);

const checks = [
  check(
    "Dry-run rehearsal writes packet, receipt, and start-here file",
    rehearsal.format === "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1" &&
      receipt.format === "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_receipt_v1" &&
      existsSync(rehearsalResult.readme),
    rehearsalResult.rehearsalPath
  ),
  check(
    "Rehearsal consumes activation gate and existing registration runner wrapper",
    rehearsal.paths.sourceActivationGate === activationResult.activationGatePath &&
      rehearsal.paths.sourceRegistrationRunner === activationGate.paths.registrationRunner &&
      rehearsal.paths.wrapper === registrationRunner.files.wrapper &&
      existsSync(rehearsal.paths.wrapper),
    `${activationResult.activationGatePath}; ${activationGate.paths.registrationRunner}`
  ),
  check(
    "Rehearsal preserves teacher-reviewed operational monitor scope",
    rehearsal.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      rehearsal.operationalScope.sourceTrialPath === activationGate.operationalScope?.sourceTrialPath &&
      rehearsal.operationalScope.sourceSchedulePath === activationGate.operationalScope?.sourceSchedulePath &&
      rehearsal.operationalScope.teacherReviewedScope === true &&
      receipt.operationalScope?.sourceTrialPath === rehearsal.operationalScope.sourceTrialPath,
    JSON.stringify(rehearsal.operationalScope)
  ),
  check(
    "Wrapper is really executed in dry-run mode without Execute flag",
    rehearsal.dryRunExecution.exitCode === 0 &&
      rehearsal.dryRunExecution.stdout.includes("dry_run=true") &&
      rehearsal.dryRunExecution.stdout.includes("register=") &&
      rehearsal.dryRunExecution.stdout.includes("unregister=") &&
      rehearsal.dryRunCommand.executeFlagPassed === false &&
      rehearsal.locks.activationDryRunWrapperExecuted === true &&
      rehearsal.locks.wrapperExecuteFlagPassed === false,
    JSON.stringify(rehearsal.dryRunExecution)
  ),
  check(
    "Post-rehearsal scheduled-task status query remains read-only",
    postStatus.format === "transparent_ai_all_software_recurring_monitor_registration_status_v1" &&
      postStatus.locks?.statusVerifierDoesNotChangeSystem === true &&
      postStatus.queryResult?.queryChangedSystem === false &&
      rehearsal.postRehearsalRegistrationStatus.queryChangedSystem === false,
    rehearsalResult.postRehearsalRegistrationStatusPath
  ),
  check(
    "Dry-run rehearsal keeps system-change and learning locks closed",
    rehearsal.dryRunRehearsalPassed === true &&
      rehearsal.locks.scheduledTaskRegistered === false &&
      rehearsal.locks.scheduledTaskStarted === false &&
      rehearsal.locks.scheduledTaskUnregistered === false &&
      rehearsal.locks.targetSoftwareCommandsExecuted === false &&
      rehearsal.locks.screenshotsCaptured === false &&
      rehearsal.locks.longTermMemoryWritten === false &&
      rehearsal.locks.nativeUniversalExecution === false &&
      receipt.scheduledTaskRegistered === false &&
      receipt.wrapperExecuteFlagPassed === false,
    JSON.stringify(rehearsal.locks)
  )
];

const failed = checks.filter((item) => !item.pass);
if (failed.length) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        smoke: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_smoke_v1",
        smokeRoot,
        trialPath: trialResult.trialPath,
        activationGatePath: activationResult.activationGatePath,
        rehearsalPath: rehearsalResult.rehearsalPath,
        checks
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      smoke: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_smoke_v1",
      smokeRoot,
      trialPath: trialResult.trialPath,
      activationGatePath: activationResult.activationGatePath,
      rehearsalPath: rehearsalResult.rehearsalPath,
      postRehearsalRegistrationStatusPath: rehearsalResult.postRehearsalRegistrationStatusPath,
      checks
    },
    null,
    2
  )
);
