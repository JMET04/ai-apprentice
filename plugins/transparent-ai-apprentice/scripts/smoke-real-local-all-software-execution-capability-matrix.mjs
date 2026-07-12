#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-capability-matrix-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
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
  "Create a real-local all-software execution capability matrix that routes each app from low-token observation toward teacher-reviewed execution pilots.";

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  goal,
  "--max-processes",
  "8",
  "--max-installed",
  "8",
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
  "8",
  "-MaxInstalled",
  "8",
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
  "8",
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
  "4",
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

const matrix = readJson(matrixResult.matrixPath);
const evidenceChainLedger = readJson(matrixResult.evidenceChainLedgerPath);
const receipt = readJson(matrixResult.receiptPath);
const matrixText = JSON.stringify(matrix);
const evidenceChainLedgerText = JSON.stringify(evidenceChainLedger);

const checks = [
  check(
    "Real local inventory coverage and pilot evidence feed execution capability matrix",
    matrix.format === "transparent_ai_all_software_execution_capability_matrix_v1" &&
      matrix.sourceEvidence.inventoryPath === resolve(inventoryPath) &&
      matrix.sourceEvidence.coverageAuditPath === resolve(coverage.auditPath) &&
      matrix.sourceEvidence.pilotQueuePath === resolve(pilotQueue.queuePath) &&
      matrix.counts.totalRows > 0,
    `${matrixResult.matrixPath}; rows=${matrix.counts.totalRows}`
  ),
  check(
    "Matrix maps software rows into execution capability stages and next review lanes",
    matrix.rows.every((row) => row.executionCapabilityStage && row.nextActionLane && Array.isArray(row.nextCalls)) &&
      matrix.nextReviewQueue.length > 0 &&
      matrixText.includes("review_and_run_one_dry_run_pilot"),
    JSON.stringify(matrix.counts)
  ),
  check(
    "Matrix writes a per-software execution evidence-chain ledger",
    evidenceChainLedger.format === "transparent_ai_all_software_execution_evidence_chain_ledger_v1" &&
      evidenceChainLedger.matrixPath === matrixResult.matrixPath &&
      evidenceChainLedger.summary.totalRows === matrix.counts.totalRows &&
      evidenceChainLedger.rows.length === matrix.rows.length &&
      evidenceChainLedger.rows.every((row) => Array.isArray(row.evidenceChain) && row.evidenceChain.length >= 6),
    `${matrixResult.evidenceChainLedgerPath}; rows=${evidenceChainLedger.rows.length}`
  ),
  check(
    "Evidence-chain ledger blocks execute requests until observation control target logic dry-run and rollback evidence are reviewed",
    evidenceChainLedger.rows.every(
      (row) =>
        row.readyForExecuteRequest === false &&
        row.executeRequestBlockedReason &&
        Array.isArray(row.beforeExecuteMissing) &&
        row.reviewOnly === true &&
        row.accepted === false &&
        row.ruleEnabled === false &&
        row.packagingGated === true
    ) &&
      evidenceChainLedgerText.includes("low_token_observation") &&
      evidenceChainLedgerText.includes("control_channel") &&
      evidenceChainLedgerText.includes("teacher_intent_binding") &&
      evidenceChainLedgerText.includes("action_logic_source") &&
      evidenceChainLedgerText.includes("dry_run_execution_package") &&
      evidenceChainLedgerText.includes("rollback_and_post_action_checkpoint"),
    JSON.stringify(evidenceChainLedger.summary)
  ),
  check(
    "Matrix links dry-run pilot-ready rows to existing pilot runner instead of claiming native control",
    matrix.rows
      .filter((row) => row.executionCapabilityStage === "dry_run_pilot_package_ready")
      .every(
        (row) =>
          row.dryRunPilotReady === true &&
          row.nextCalls.includes("run_all_software_execution_pilot_runner") &&
          row.packagingGated === true
      ) && matrix.completionBoundary.nativeUniversalExecution === false,
    matrix.completionBoundary.reason
  ),
  check(
    "Matrix preserves observation-only and teacher-evidence gaps as explicit lanes",
    matrixText.includes("collect_control_channel_evidence") ||
      matrixText.includes("ask_teacher_for_signal_or_exclusion") ||
      matrix.counts.needsTeacherSignalOrControlEvidence >= 0,
    JSON.stringify(matrix.nextReviewQueue.slice(0, 3))
  ),
  check(
    "Matrix keeps screenshots logs memory UI events target commands and packaging locked",
    receipt.format === "transparent_ai_all_software_execution_capability_matrix_receipt_v1" &&
      receipt.locks.screenshotsCaptured === false &&
      receipt.locks.logContentsRead === false &&
      receipt.locks.uiEventsSent === false &&
      receipt.locks.softwareActionsExecuted === false &&
      receipt.locks.targetSoftwareCommandsExecuted === false &&
      receipt.locks.memoryWritten === false &&
      receipt.locks.allSoftwareExecutionComplete === false &&
      receipt.locks.packagingGated === true,
    matrixResult.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_capability_matrix_smoke_v1",
  smokeRoot,
  counts: matrix.counts,
  paths: {
    inventory: inventoryPath,
    coverageAudit: coverage.auditPath,
    pilotQueue: pilotQueue.queuePath,
    matrix: matrixResult.matrixPath,
    evidenceChainLedger: matrixResult.evidenceChainLedgerPath,
    receipt: matrixResult.receiptPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
