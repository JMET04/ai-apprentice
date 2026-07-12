#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function makeSmokeRoot(preferredRoot = "") {
  const id = String(Date.now());
  const candidates = [
    preferredRoot ? join(resolve(preferredRoot), id) : "",
    join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-capability-convergence-audit-smoke", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "real-local-all-software-execution-capability-convergence-audit", id)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create a real local execution convergence audit smoke directory.");
}

const smokeRoot = makeSmokeRoot(argValue("--output-dir", argValue("--out-dir", "")));

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
  "Audit bounded real-local all-software execution capability convergence without native execution claims.";

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

const noSupervisorResult = runNodeScript("create-all-software-execution-capability-convergence-audit.mjs", [
  "--goal",
  goal,
  "--matrix",
  matrixResult.matrixPath,
  "--output-dir",
  join(smokeRoot, "no-supervisor-convergence-audit")
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

const reviewedAuditResult = runNodeScript("create-all-software-execution-capability-convergence-audit.mjs", [
  "--goal",
  goal,
  "--matrix",
  matrixResult.matrixPath,
  "--supervisor",
  reviewedSupervisorResult.supervisorPath,
  "--output-dir",
  join(smokeRoot, "reviewed-convergence-audit")
]);

const noSupervisorAudit = readJson(noSupervisorResult.auditPath);
const reviewedAudit = readJson(reviewedAuditResult.auditPath);
const reviewedReceipt = readJson(reviewedAuditResult.receiptPath);
const reviewedSupervisor = readJson(reviewedSupervisorResult.supervisorPath);
const externalReconciliationPath = reviewedSupervisor.rounds?.find((round) => round.reconciliationPath)?.reconciliationPath || "";
const externalReconciliationAuditResult = externalReconciliationPath
  ? runNodeScript("create-all-software-execution-capability-convergence-audit.mjs", [
      "--goal",
      goal,
      "--matrix",
      matrixResult.matrixPath,
      "--supervisor",
      reviewedSupervisorResult.supervisorPath,
      "--reconciliation",
      externalReconciliationPath,
      "--output-dir",
      join(smokeRoot, "external-reconciliation-convergence-audit")
    ])
  : null;
const externalReconciliationAudit = externalReconciliationAuditResult ? readJson(externalReconciliationAuditResult.auditPath) : null;

const checks = [
  check(
    "Execution convergence audit detects missing supervisor before completion review",
    noSupervisorAudit.format === "transparent_ai_all_software_execution_capability_convergence_audit_v1" &&
      noSupervisorAudit.status === "execution_capability_still_has_remaining_lanes_or_review_gaps" &&
      noSupervisorAudit.remainingReviewGaps.some((gap) => gap.kind === "missing_supervisor") &&
      noSupervisorAudit.allSoftwareExecutionComplete === false,
    noSupervisorResult.auditPath
  ),
  check(
    "Execution convergence audit aggregates real-local supervisor rounds and latest matrix",
    reviewedAudit.format === "transparent_ai_all_software_execution_capability_convergence_audit_v1" &&
      reviewedAudit.counts.supervisorsAudited === 1 &&
      reviewedAudit.counts.reconciliations >= 1 &&
      reviewedAudit.sourceEvidence.latestMatrixPath &&
      existsSync(reviewedAudit.sourceEvidence.latestMatrixPath) &&
      reviewedAudit.supervisorSummary[0]?.followUpBatches > 0 &&
      reviewedSupervisor.teacherReviewed === true,
    JSON.stringify(reviewedAudit.counts)
  ),
  check(
    "Execution convergence audit can include standalone reconciliation evidence without claiming execution",
    Boolean(externalReconciliationPath) &&
      externalReconciliationAudit?.counts?.externalReconciliationsAudited === 1 &&
      externalReconciliationAudit.sourceEvidence.reconciliationPaths.includes(externalReconciliationPath) &&
      externalReconciliationAudit.reconciliationSummary[0]?.reconciliationPath === externalReconciliationPath &&
      externalReconciliationAudit.allSoftwareExecutionComplete === false &&
      externalReconciliationAudit.nativeUniversalExecution === false,
    externalReconciliationAuditResult?.auditPath || externalReconciliationPath
  ),
  check(
    "Execution convergence audit identifies remaining lanes instead of claiming completion",
    reviewedAudit.allSoftwareExecutionComplete === false &&
      reviewedAudit.nativeUniversalExecution === false &&
      Array.isArray(reviewedAudit.remainingReviewGaps) &&
      reviewedAudit.completionBoundary?.allSoftwareExecutionComplete === false &&
      reviewedAudit.completionBoundary?.reason,
    reviewedAuditResult.auditPath
  ),
  check(
    "Execution convergence audit preserves completion and native-control locks",
    reviewedReceipt.format === "transparent_ai_all_software_execution_capability_convergence_audit_receipt_v1" &&
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
    reviewedAuditResult.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_capability_convergence_audit_smoke_v1",
  smokeRoot,
  paths: {
    inventory: inventoryPath,
    coverageAudit: coverage.auditPath,
    pilotQueue: pilotQueue.queuePath,
    matrix: matrixResult.matrixPath,
    reviewedSupervisor: reviewedSupervisorResult.supervisorPath,
    externalReconciliation: externalReconciliationPath,
    noSupervisorAudit: noSupervisorResult.auditPath,
    reviewedAudit: reviewedAuditResult.auditPath,
    externalReconciliationAudit: externalReconciliationAuditResult?.auditPath || "",
    reviewedReceipt: reviewedAuditResult.receiptPath
  },
  counts: reviewedAudit.counts,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
