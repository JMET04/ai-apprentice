#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-capability-matrix-follow-up-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000
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
  "Advance a real-local all-software execution capability matrix into the next bounded follow-up batch without universal native-control claims.";

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

const missingLogicFollowUp = runNodeScript("run-all-software-execution-capability-matrix-follow-up-batch.mjs", [
  "--matrix",
  matrixResult.matrixPath,
  "--pilot-queue",
  pilotQueue.queuePath,
  "--lane-filter",
  "collect_control_channel_evidence",
  "--action-logic-source-status",
  "observation_ready_but_action_logic_source_missing",
  "--max-rows",
  "3",
  "--output-dir",
  join(smokeRoot, "missing-logic-follow-up")
]);

const matrix = readJson(matrixResult.matrixPath);
const preparedBatch = readJson(preparedFollowUp.batchPath);
const preparedReceipt = readJson(preparedFollowUp.receiptPath);
const reviewedBatch = readJson(reviewedFollowUp.batchPath);
const reviewedReceipt = readJson(reviewedFollowUp.receiptPath);
const missingLogicBatch = readJson(missingLogicFollowUp.batchPath);
const reviewedText = JSON.stringify(reviewedBatch);

const checks = [
  check(
    "Follow-up batch consumes a real-local execution capability matrix",
    preparedBatch.format === "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1" &&
      preparedBatch.matrixPath === resolve(matrixResult.matrixPath) &&
      preparedBatch.counts.selectedRows > 0,
    preparedFollowUp.batchPath
  ),
  check(
    "Unreviewed follow-up prepares calls but does not invoke dry-run pilot runners",
    preparedBatch.teacherReviewed === false &&
      preparedBatch.counts.dryRunRunnerInvocations === 0 &&
      preparedBatch.rowResults.every((row) => row.runnerInvoked !== true),
    JSON.stringify(preparedBatch.counts)
  ),
  check(
    "Teacher-reviewed follow-up advances pilot-ready rows only through dry-run runner or review-only lanes",
    reviewedBatch.teacherReviewed === true &&
      reviewedBatch.rowResults.every((row) =>
        row.lane === "review_and_run_one_dry_run_pilot"
          ? row.status.includes("dry_run") || row.status.includes("runner") || row.status.includes("blocked")
          : row.status.includes("waiting") || row.status.includes("probe_package")
      ),
    JSON.stringify(reviewedBatch.counts)
  ),
  check(
    "Follow-up creates reviewable control-channel probe packages or teacher handoffs for non-pilot rows",
    reviewedText.includes("control_channel_probe_package") ||
      reviewedText.includes("waiting_for_numbered_target_or_exact_route_confirmation") ||
      reviewedText.includes("waiting_for_teacher_signal_or_exclusion") ||
      reviewedBatch.counts.selectedRows === matrix.rows.length,
    reviewedFollowUp.batchPath
  ),
  check(
    "Follow-up can target missing action-logic-source rows and create read-only control-channel probes",
    missingLogicBatch.selection.laneFilters.includes("collect_control_channel_evidence") &&
      missingLogicBatch.selection.actionLogicSourceStatusFilters.includes("observation_ready_but_action_logic_source_missing") &&
      missingLogicBatch.counts.controlChannelProbePackages > 0 &&
      missingLogicBatch.rowResults.every((row) => row.status.includes("control_channel_probe_package")),
    JSON.stringify(missingLogicBatch.counts)
  ),
  check(
    "Follow-up keeps screenshots full logs memory target commands UI events native execution and completion locked",
    preparedReceipt.format === "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_receipt_v1" &&
      reviewedReceipt.format === "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_receipt_v1" &&
      reviewedReceipt.locks.screenshotsCaptured === false &&
      reviewedReceipt.locks.fullContinuousRecording === false &&
      reviewedReceipt.locks.logContentsRead === false &&
      reviewedReceipt.locks.fileContentsRead === false &&
      reviewedReceipt.locks.uiEventsSent === false &&
      reviewedReceipt.locks.targetSoftwareCommandsExecuted === false &&
      reviewedReceipt.locks.memoryWritten === false &&
      reviewedReceipt.locks.nativeUniversalExecution === false &&
      reviewedReceipt.locks.allSoftwareExecutionComplete === false &&
      reviewedReceipt.locks.packagingGated === true,
    reviewedFollowUp.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_capability_matrix_follow_up_batch_smoke_v1",
  smokeRoot,
  counts: {
    matrix: matrix.counts,
    preparedFollowUp: preparedBatch.counts,
    reviewedFollowUp: reviewedBatch.counts
    ,
    missingLogicFollowUp: missingLogicBatch.counts
  },
  paths: {
    inventory: inventoryPath,
    coverageAudit: coverage.auditPath,
    pilotQueue: pilotQueue.queuePath,
    matrix: matrixResult.matrixPath,
    preparedFollowUp: preparedFollowUp.batchPath,
    reviewedFollowUp: reviewedFollowUp.batchPath,
    reviewedReceipt: reviewedFollowUp.receiptPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
