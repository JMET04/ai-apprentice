#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-reconciliation-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], timeout = 300000) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Build bounded real-local evidence for an enrollment follow-up reconciliation.",
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
const probe = spawnSync("powershell", [
  "-ExecutionPolicy",
  "Bypass",
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
], { cwd: smokeRoot, encoding: "utf8", timeout: 60000 });
if (probe.status !== 0) throw new Error(probe.stderr || probe.stdout || "read-only inventory probe failed");

const queue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "6",
  "--max-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "observer-queue")
]);

const audit = runNodeScript("create-all-software-observer-coverage-audit.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "coverage-audit")
]);

const ledger = runNodeScript("create-all-software-coverage-enrollment-ledger.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--coverage-audit",
  audit.auditPath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "ledger")
]);

const plan = runNodeScript("create-all-software-coverage-enrollment-follow-up-plan.mjs", [
  "--ledger",
  ledger.ledgerPath,
  "--max-items",
  "6",
  "--output-dir",
  join(smokeRoot, "follow-up-plan")
]);

const dryRunBatch = runNodeScript("run-all-software-coverage-enrollment-follow-up-batch.mjs", [
  "--plan",
  plan.planPath,
  "--max-items",
  "4",
  "--output-dir",
  join(smokeRoot, "dry-run-batch")
]);

const dryRunReconciliation = runNodeScript("reconcile-all-software-coverage-enrollment-follow-up-batch.mjs", [
  "--batch",
  dryRunBatch.batchPath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "dry-run-reconciliation")
]);
const dryRunReconciliationJson = readJson(dryRunReconciliation.reconciliationPath);
const dryRunReceipt = readJson(dryRunReconciliation.receiptPath);

const reviewedBatch = runNodeScript("run-all-software-coverage-enrollment-follow-up-batch.mjs", [
  "--plan",
  plan.planPath,
  "--teacher-reviewed",
  "--max-items",
  "4",
  "--max-queue-items",
  "4",
  "--max-logs-per-item",
  "1",
  "--output-dir",
  join(smokeRoot, "reviewed-batch")
]);

const reviewedReconciliation = runNodeScript("reconcile-all-software-coverage-enrollment-follow-up-batch.mjs", [
  "--batch",
  reviewedBatch.batchPath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "reviewed-reconciliation")
]);
const reviewedReconciliationJson = readJson(reviewedReconciliation.reconciliationPath);
const reviewedReceipt = readJson(reviewedReconciliation.receiptPath);

const rerunReconciliation = runNodeScript("reconcile-all-software-coverage-enrollment-follow-up-batch.mjs", [
  "--batch",
  reviewedBatch.batchPath,
  "--teacher-reviewed-rerun",
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "rerun-reconciliation")
]);
const rerunReconciliationJson = readJson(rerunReconciliation.reconciliationPath);
const rerunReceipt = readJson(rerunReconciliation.receiptPath);
const regeneratedLedger = readJson(rerunReconciliation.nextEnrollmentLedgerPath);
const mcpServerText = readFileSync(join(pluginRoot, "scripts", "mcp-server.mjs"), "utf8");

const checks = [
  {
    name: "Reconciliation blocks unreviewed follow-up batch evidence",
    pass:
      dryRunReconciliationJson.format === "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_v1" &&
      dryRunReceipt.format === "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_receipt_v1" &&
      dryRunReconciliationJson.status === "waiting_for_teacher_review" &&
      dryRunReconciliationJson.sourceEvidence.batchTeacherReviewed === false &&
      !dryRunReconciliation.nextEnrollmentLedgerPath,
    evidence: dryRunReconciliation.reconciliationPath
  },
  {
    name: "Reviewed batch reconciliation prepares next audit and ledger commands without rerun by default",
    pass:
      (reviewedReconciliationJson.status === "ready_for_next_coverage_audit_and_enrollment_ledger" ||
        reviewedReconciliationJson.status === "missing_batch_evidence_for_reledger") &&
      reviewedReconciliationJson.sourceEvidence.batchTeacherReviewed === true &&
      reviewedReconciliationJson.plannedCommands.nextCoverageAuditCommand.includes("create-all-software-observer-coverage-audit.mjs") &&
      reviewedReconciliationJson.plannedCommands.nextEnrollmentLedgerCommand.includes("create-all-software-coverage-enrollment-ledger.mjs") &&
      !reviewedReconciliation.nextEnrollmentLedgerPath,
    evidence: reviewedReconciliation.reconciliationPath
  },
  {
    name: "Teacher-reviewed rerun regenerates coverage audit and enrollment ledger from batch evidence",
    pass:
      rerunReconciliationJson.status === "reconciled_next_ledger_ready_for_review" &&
      rerunReconciliation.nextCoverageAuditPath &&
      rerunReconciliation.nextEnrollmentLedgerPath &&
      regeneratedLedger.format === "transparent_ai_all_software_coverage_enrollment_ledger_v1" &&
      regeneratedLedger.sourceEvidence.inventoryPath === inventoryPath &&
      regeneratedLedger.sourceEvidence.queuePath === queue.queuePath,
    evidence: rerunReconciliation.reconciliationPath
  },
  {
    name: "Reconciliation keeps screenshots logs execution schedules memory native control and completion locked",
    pass:
      rerunReceipt.allSoftwareCoverageComplete === false &&
      rerunReceipt.screenshotsCaptured === false &&
      rerunReceipt.screenshotsCapturedByThisTool === false &&
      rerunReceipt.fullContinuousRecording === false &&
      rerunReceipt.rawFullLogsRetained === false &&
      rerunReceipt.logContentsRead === false &&
      rerunReceipt.fullLogsRead === false &&
      rerunReceipt.fileContentsRead === false &&
      rerunReceipt.softwareActionsExecuted === false &&
      rerunReceipt.targetSoftwareCommandsExecuted === false &&
      rerunReceipt.scheduledTaskInstalled === false &&
      rerunReceipt.memoryWritten === false &&
      rerunReceipt.nativeUniversalExecution === false &&
      rerunReceipt.accepted === false &&
      rerunReceipt.ruleEnabled === false &&
      rerunReceipt.packagingGated === true,
    evidence: rerunReconciliation.receiptPath
  },
  {
    name: "MCP advanced surface exposes follow-up reconciliation",
    pass: mcpServerText.includes('name: "reconcile_all_software_coverage_enrollment_follow_up_batch"'),
    evidence: "mcp-server.mjs contains reconcile_all_software_coverage_enrollment_follow_up_batch"
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
