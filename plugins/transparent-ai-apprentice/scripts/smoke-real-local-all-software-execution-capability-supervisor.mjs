#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-capability-supervisor-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 360000
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
  "Supervise bounded real-local all-software execution capability rounds without universal native-control claims.";

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
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "execution-capability-matrix")
]);

const preparedSupervisorResult = runNodeScript("run-all-software-execution-capability-supervisor.mjs", [
  "--goal",
  goal,
  "--matrix",
  matrixResult.matrixPath,
  "--inventory",
  inventoryPath,
  "--coverage-audit",
  coverage.auditPath,
  "--pilot-queue",
  pilotQueue.queuePath,
  "--max-rounds",
  "2",
  "--max-rows",
  "4",
  "--output-dir",
  join(smokeRoot, "prepared-supervisor")
]);

const reviewedSupervisorResult = runNodeScript("run-all-software-execution-capability-supervisor.mjs", [
  "--goal",
  goal,
  "--matrix",
  matrixResult.matrixPath,
  "--inventory",
  inventoryPath,
  "--coverage-audit",
  coverage.auditPath,
  "--pilot-queue",
  pilotQueue.queuePath,
  "--max-rounds",
  "2",
  "--max-rows",
  "4",
  "--teacher-reviewed",
  "--output-dir",
  join(smokeRoot, "reviewed-supervisor")
]);

const preparedSupervisor = readJson(preparedSupervisorResult.supervisorPath);
const preparedReceipt = readJson(preparedSupervisorResult.receiptPath);
const reviewedSupervisor = readJson(reviewedSupervisorResult.supervisorPath);
const reviewedReceipt = readJson(reviewedSupervisorResult.receiptPath);

const reviewedText = JSON.stringify(reviewedSupervisor);
const checks = [
  check(
    "Execution capability supervisor reuses matrix follow-up and stops before reconciliation without teacher review",
    preparedSupervisor.format === "transparent_ai_all_software_execution_capability_supervisor_v1" &&
      preparedSupervisor.status === "prepared_follow_up_waiting_for_teacher_review" &&
      preparedSupervisor.counts.followUpBatches === 1 &&
      preparedSupervisor.counts.reconciliations === 0 &&
      preparedSupervisor.rounds[0]?.stoppedBeforeReconciliation === true,
    preparedSupervisorResult.supervisorPath
  ),
  check(
    "Teacher-reviewed execution capability supervisor advances multiple safe matrix rounds",
    reviewedSupervisor.status === "reviewed_rounds_completed_waiting_for_teacher_matrix_review" &&
      reviewedSupervisor.counts.roundsAttempted === 2 &&
      reviewedSupervisor.counts.followUpBatches === 2 &&
      reviewedSupervisor.counts.reconciliations === 2 &&
      reviewedSupervisor.rounds.every((round) => existsSync(round.followUpBatchPath) && existsSync(round.reconciliationPath)) &&
      reviewedSupervisor.rounds.some((round) => existsSync(round.nextMatrixPath)),
    JSON.stringify(reviewedSupervisor.counts)
  ),
  check(
    "Supervisor keeps execution capability completion and native universal control unclaimed",
    reviewedText.includes("allSoftwareExecutionComplete") &&
      reviewedSupervisor.completionBoundary.allSoftwareExecutionComplete === false &&
      reviewedSupervisor.completionBoundary.nativeUniversalExecution === false &&
      reviewedReceipt.locks.nativeUniversalExecution === false &&
      reviewedReceipt.locks.allSoftwareExecutionComplete === false,
    reviewedSupervisorResult.receiptPath
  ),
  check(
    "Supervisor preserves screenshots logs memory target commands UI events and packaging locks",
    preparedReceipt.format === "transparent_ai_all_software_execution_capability_supervisor_receipt_v1" &&
      reviewedReceipt.format === "transparent_ai_all_software_execution_capability_supervisor_receipt_v1" &&
      reviewedReceipt.locks.screenshotsCaptured === false &&
      reviewedReceipt.locks.fullContinuousRecording === false &&
      reviewedReceipt.locks.logContentsRead === false &&
      reviewedReceipt.locks.fileContentsRead === false &&
      reviewedReceipt.locks.uiEventsSent === false &&
      reviewedReceipt.locks.softwareActionsExecuted === false &&
      reviewedReceipt.locks.targetSoftwareCommandsExecuted === false &&
      reviewedReceipt.locks.memoryWritten === false &&
      reviewedReceipt.locks.packagingGated === true,
    reviewedSupervisorResult.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_capability_supervisor_smoke_v1",
  smokeRoot,
  paths: {
    inventory: inventoryPath,
    coverageAudit: coverage.auditPath,
    pilotQueue: pilotQueue.queuePath,
    matrix: matrixResult.matrixPath,
    preparedSupervisor: preparedSupervisorResult.supervisorPath,
    preparedReceipt: preparedSupervisorResult.receiptPath,
    reviewedSupervisor: reviewedSupervisorResult.supervisorPath,
    reviewedReceipt: reviewedSupervisorResult.receiptPath
  },
  counts: {
    prepared: preparedSupervisor.counts,
    reviewed: reviewedSupervisor.counts
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
