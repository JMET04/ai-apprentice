#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "opactivation-smoke", String(Date.now()));

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
  "Operational activation smoke.",
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
  "Operational activation smoke.",
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

const activationGate = readJson(activationResult.activationGatePath);
const receipt = readJson(activationResult.receiptPath);
const approvalGate = readJson(activationGate.paths.approvalGate);
const registrationRunner = readJson(activationGate.paths.registrationRunner);
const registrationStatus = readJson(activationGate.paths.registrationStatus);
const checks = [
  check(
    "Activation gate writes machine-readable packet, receipt, and start-here file",
    activationGate.format === "transparent_ai_all_software_operational_learning_activation_gate_v1" &&
      receipt.format === "transparent_ai_all_software_operational_learning_activation_gate_receipt_v1" &&
      existsSync(activationResult.readme),
    activationResult.activationGatePath
  ),
  check(
    "Activation gate reuses operational trial evidence and existing recurring monitor approval gate",
    activationGate.paths.sourceTrial === trialResult.trialPath &&
      approvalGate.format === "transparent_ai_all_software_recurring_monitor_approval_gate_v1" &&
      approvalGate.readyForRegistrationRequest === true,
    activationGate.paths.approvalGate
  ),
  check(
    "Activation gate records teacher-reviewed operational monitor scope",
    activationGate.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      activationGate.operationalScope.sourceTrialPath === trialResult.trialPath &&
      activationGate.operationalScope.sourceSchedulePath === activationGate.paths.sourceSchedule &&
      activationGate.operationalScope.sourceLogSourceDiscoveryLedger === activationGate.paths.sourceLogSourceDiscoveryLedger &&
      (activationGate.operationalScope.sourceLogSourceDiscoveryRows || 0) >= 1 &&
      activationGate.operationalScope.teacherReviewedScope === true &&
      activationGate.operationalScope.rollbackPointCreated === true &&
      receipt.operationalScope?.sourceTrialPath === trialResult.trialPath,
    JSON.stringify(activationGate.operationalScope)
  ),
  check(
    "Activation gate carries low-token source-route evidence from the operational trial",
    existsSync(activationGate.paths.sourceLogSourceDiscoveryLedger) &&
      activationGate.lowTokenSourceRouteEvidence?.ledgerReady === true &&
      activationGate.lowTokenSourceRouteEvidence?.reviewOnly === true &&
      activationGate.lowTokenSourceRouteEvidence?.logContentsRead === false &&
      activationGate.lowTokenSourceRouteEvidence?.screenshotsCaptured === false &&
      activationGate.lowTokenSourceRouteEvidence?.softwareActionsExecuted === false &&
      activationGate.lowTokenSourceRouteEvidence?.activationGateConsumesSourceRouteEvidence === true &&
      activationGate.lowTokenSourceRouteEvidence?.gateDoesNotReadLogContents === true &&
      activationGate.lowTokenSourceRouteEvidence?.counts?.logSourceDiscoveryRows >= 1 &&
      receipt.lowTokenSourceRouteEvidence?.sourceLogSourceDiscoveryLedger === activationGate.paths.sourceLogSourceDiscoveryLedger &&
      activationGate.existingAbilitiesReused.includes("create_all_software_log_source_discovery_ledger"),
    activationGate.paths.sourceLogSourceDiscoveryLedger
  ),
  check(
    "Activation gate prepares dry-run registration runner without executing registration",
    registrationRunner.format === "transparent_ai_all_software_recurring_monitor_registration_runner_v1" &&
      registrationRunner.status === "dry_run_ready_for_teacher_review" &&
      registrationRunner.locks?.dryRunDefault === true &&
      receipt.scheduledTaskRegistered === false,
    activationGate.paths.registrationRunner
  ),
  check(
    "Activation gate verifies scheduled-task status through read-only query only",
    registrationStatus.format === "transparent_ai_all_software_recurring_monitor_registration_status_v1" &&
      registrationStatus.locks?.statusVerifierDoesNotChangeSystem === true &&
      registrationStatus.queryResult?.queryChangedSystem === false,
    activationGate.paths.registrationStatus
  ),
  check(
    "Activation gate keeps safety locks closed while moving toward automatic low-token learning",
    activationGate.readyForTeacherRegistrationReview === true &&
      activationGate.locks.activationGateDoesNotRegisterTask === true &&
      activationGate.locks.scheduledTaskRegistered === false &&
      activationGate.locks.targetSoftwareCommandsExecuted === false &&
      activationGate.locks.screenshotsCaptured === false &&
      activationGate.locks.longTermMemoryWritten === false &&
      activationGate.locks.nativeUniversalExecution === false,
    JSON.stringify(activationGate.locks)
  )
];

const failed = checks.filter((item) => !item.pass);
if (failed.length) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        smoke: "transparent_ai_all_software_operational_learning_activation_gate_smoke_v1",
        trialPath: trialResult.trialPath,
        activationGatePath: activationResult.activationGatePath,
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
      smoke: "transparent_ai_all_software_operational_learning_activation_gate_smoke_v1",
      smokeRoot,
      trialPath: trialResult.trialPath,
      activationGatePath: activationResult.activationGatePath,
      registrationRunnerPath: activationResult.registrationRunnerPath,
      registrationStatusPath: activationResult.registrationStatusPath,
      checks
    },
    null,
    2
  )
);
