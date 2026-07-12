#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-capability-follow-up-reconciliation-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = smokeRoot) {
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const goal =
  "Reconcile real-local all-software execution capability matrix follow-up evidence into the next reviewed matrix pass.";

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  goal,
  "--max-processes",
  "6",
  "--max-installed",
  "6",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
const probe = runPowerShell([
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "6",
  "-MaxInstalled",
  "6",
  "-MaxLogFilesPerCandidate",
  "1"
]);
if (probe.status !== 0 || !existsSync(inventoryPath)) {
  throw new Error(probe.stderr || probe.stdout || "real local inventory probe failed");
}

const coverage = runNodeScript("create-all-software-control-channel-coverage-audit.mjs", [
  "--goal",
  goal,
  "--inventory",
  inventoryPath,
  "--max-software",
  "6",
  "--create-profiles",
  "--output-dir",
  join(smokeRoot, "control-channel-coverage")
]);

const pilotQueue = runNodeScript("create-all-software-execution-pilot-queue.mjs", [
  "--goal",
  goal,
  "--coverage-audit",
  coverage.auditPath,
  "--max-pilots",
  "3",
  "--create-adapter-packages",
  "--output-dir",
  join(smokeRoot, "execution-pilot-queue")
]);

const matrixResult = runNodeScript("create-all-software-execution-capability-matrix.mjs", [
  "--goal",
  goal,
  "--inventory",
  inventoryPath,
  "--coverage-audit",
  coverage.auditPath,
  "--pilot-queue",
  pilotQueue.queuePath,
  "--output-dir",
  join(smokeRoot, "execution-capability-matrix")
]);

const preparedFollowUp = runNodeScript("run-all-software-execution-capability-matrix-follow-up-batch.mjs", [
  "--matrix",
  matrixResult.matrixPath,
  "--pilot-queue",
  pilotQueue.queuePath,
  "--max-rows",
  "4",
  "--output-dir",
  join(smokeRoot, "prepared-follow-up")
]);

const reviewedFollowUp = runNodeScript("run-all-software-execution-capability-matrix-follow-up-batch.mjs", [
  "--matrix",
  matrixResult.matrixPath,
  "--pilot-queue",
  pilotQueue.queuePath,
  "--max-rows",
  "4",
  "--teacher-reviewed",
  "--output-dir",
  join(smokeRoot, "reviewed-follow-up")
]);

const preparedReconciliation = runNodeScript("reconcile-all-software-execution-capability-matrix-follow-up-batch.mjs", [
  "--follow-up-batch",
  preparedFollowUp.batchPath,
  "--matrix",
  matrixResult.matrixPath,
  "--inventory",
  inventoryPath,
  "--coverage-audit",
  coverage.auditPath,
  "--pilot-queue",
  pilotQueue.queuePath,
  "--output-dir",
  join(smokeRoot, "prepared-reconciliation")
]);

const reviewedReconciliation = runNodeScript("reconcile-all-software-execution-capability-matrix-follow-up-batch.mjs", [
  "--follow-up-batch",
  reviewedFollowUp.batchPath,
  "--matrix",
  matrixResult.matrixPath,
  "--inventory",
  inventoryPath,
  "--coverage-audit",
  coverage.auditPath,
  "--pilot-queue",
  pilotQueue.queuePath,
  "--teacher-reviewed-rerun",
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "reviewed-reconciliation")
]);

const prepared = readJson(preparedReconciliation.reconciliationPath);
const preparedReceipt = readJson(preparedReconciliation.receiptPath);
const reviewed = readJson(reviewedReconciliation.reconciliationPath);
const reviewedReceipt = readJson(reviewedReconciliation.receiptPath);
const reviewedText = JSON.stringify(reviewed);

const checks = [
  check(
    "Reconciliation consumes a follow-up batch and keeps unreviewed rerun disabled by default",
    prepared.format === "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_v1" &&
      prepared.sourceEvidence.followUpBatchPath === resolve(preparedFollowUp.batchPath) &&
      prepared.generated.nextMatrixPath === "" &&
      prepared.counts.reconciledRows > 0,
    preparedReconciliation.reconciliationPath
  ),
  check(
    "Reconciliation maps follow-up rows into explicit next lanes and calls",
    prepared.rows.every((row) => row.evidenceKind && row.nextLane && Array.isArray(row.nextCalls)) &&
      reviewedText.includes("review_dry_run_receipt_then_decide_execute_gate_or_more_evidence"),
    JSON.stringify(prepared.counts)
  ),
  check(
    "Teacher-reviewed reconciliation can regenerate safe next coverage pilot queue and matrix packages",
    reviewed.status === "reconciled_next_execution_matrix_ready_for_review" &&
      existsSync(reviewed.generated.nextCoverageAuditPath) &&
      existsSync(reviewed.generated.nextPilotQueuePath) &&
      existsSync(reviewed.generated.nextMatrixPath),
    JSON.stringify(reviewed.generated)
  ),
  check(
    "Reconciliation keeps screenshots logs memory target commands UI events native execution and completion locked",
    preparedReceipt.format === "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_receipt_v1" &&
      reviewedReceipt.format === "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_receipt_v1" &&
      reviewedReceipt.locks.screenshotsCaptured === false &&
      reviewedReceipt.locks.fullContinuousRecording === false &&
      reviewedReceipt.locks.logContentsRead === false &&
      reviewedReceipt.locks.fileContentsRead === false &&
      reviewedReceipt.locks.uiEventsSent === false &&
      reviewedReceipt.locks.softwareActionsExecuted === false &&
      reviewedReceipt.locks.targetSoftwareCommandsExecuted === false &&
      reviewedReceipt.locks.memoryWritten === false &&
      reviewedReceipt.locks.nativeUniversalExecution === false &&
      reviewedReceipt.locks.allSoftwareExecutionComplete === false &&
      reviewedReceipt.locks.packagingGated === true,
    reviewedReconciliation.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_capability_follow_up_reconciliation_smoke_v1",
  smokeRoot,
  counts: {
    prepared: prepared.counts,
    reviewed: reviewed.counts
  },
  paths: {
    inventory: inventoryPath,
    coverageAudit: coverage.auditPath,
    pilotQueue: pilotQueue.queuePath,
    matrix: matrixResult.matrixPath,
    preparedFollowUp: preparedFollowUp.batchPath,
    reviewedFollowUp: reviewedFollowUp.batchPath,
    preparedReconciliation: preparedReconciliation.reconciliationPath,
    reviewedReconciliation: reviewedReconciliation.reconciliationPath,
    reviewedReceipt: reviewedReconciliation.receiptPath,
    nextMatrix: reviewed.generated.nextMatrixPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
