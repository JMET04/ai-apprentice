#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-coverage-rollout-batch-smoke", String(Date.now()));
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Build bounded real-local evidence for all-software coverage rollout batch proof.",
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
const probe = spawnSync("powershell", [
  "-ExecutionPolicy",
  "Bypass",
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
], {
  cwd: smokeRoot,
  encoding: "utf8",
  timeout: 60000
});
if (probe.status !== 0) throw new Error(probe.stderr || probe.stdout || "read-only inventory probe failed");
const inventory = readJson(inventoryPath);

const queue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "6",
  "--output-dir",
  join(smokeRoot, "observer-queue")
]);

const audit = runNodeScript("create-all-software-observer-coverage-audit.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--max-rows",
  "8",
  "--output-dir",
  join(smokeRoot, "coverage-audit")
]);
const auditJson = readJson(audit.auditPath);

const repairQueue = runNodeScript("create-all-software-coverage-repair-queue.mjs", [
  "--audit",
  audit.auditPath,
  "--repair-plan",
  audit.repairPlanPath,
  "--max-items",
  "8",
  "--output-dir",
  join(smokeRoot, "repair-queue")
]);

const expansion = runNodeScript("create-all-software-coverage-expansion-plan.mjs", [
  "--inventory",
  inventoryPath,
  "--audit",
  audit.auditPath,
  "--repair-queue",
  repairQueue.queuePath,
  "--batch-size",
  "3",
  "--max-software",
  "8",
  "--output-dir",
  join(smokeRoot, "expansion-plan")
]);
const plan = readJson(expansion.planPath);

const rollout = runNodeScript("run-all-software-coverage-rollout-batch.mjs", [
  "--plan",
  expansion.planPath,
  "--batch",
  "batch-001",
  "--teacher-reviewed",
  "--runs",
  "1",
  "--max-items",
  "3",
  "--output-dir",
  join(smokeRoot, "rollout-batch")
]);
const rolloutJson = readJson(rollout.rolloutPath);
const receipt = readJson(rollout.receiptPath);
const runnerJournal = rollout.runnerJournalPath ? readJson(rollout.runnerJournalPath) : null;

const checks = [
  {
    name: "Real local expansion batch becomes a bounded rollout runner packet",
    pass:
      rolloutJson.format === "transparent_ai_all_software_coverage_rollout_batch_run_v1" &&
      receipt.format === "transparent_ai_all_software_coverage_rollout_batch_receipt_v1" &&
      rolloutJson.sourceBatchId === "batch-001" &&
      rolloutJson.queuedCount > 0,
    evidence: rollout.rolloutPath
  },
  {
    name: "Rollout runner consumes reviewed batch through existing queue and automatic low-token runner",
    pass:
      rolloutJson.teacherReviewed === true &&
      rolloutJson.queuePath &&
      rolloutJson.automaticRunner.journalPath &&
      runnerJournal?.format === "transparent_ai_automatic_low_token_learning_runner_v1",
    evidence: `${rolloutJson.queuePath}; ${rolloutJson.automaticRunner.journalPath}`
  },
  {
    name: "Rollout runner stays metadata-first and keeps broad completion unclaimed",
    pass:
      runnerJournal.automaticRunPolicy.metadataGateFirst === true &&
      runnerJournal.automaticRunPolicy.skipTailWhenMetadataUnchanged === true &&
      rolloutJson.completionBoundary.allSoftwareCoverageComplete === false &&
      rollout.allSoftwareCoverageComplete === false,
    evidence: JSON.stringify(rolloutJson.completionBoundary)
  },
  {
    name: "Rollout runner keeps screenshots memory schedules execution and packaging locked",
    pass:
      receipt.screenshotsCaptured === false &&
      receipt.fullContinuousRecording === false &&
      receipt.memoryWritten === false &&
      receipt.softwareActionsExecuted === false &&
      receipt.scheduledTaskInstalled === false &&
      receipt.nativeUniversalExecution === false &&
      receipt.packagingGated === true,
    evidence: rollout.receiptPath
  },
  {
    name: "Rollout batch explicitly hands off to coverage audit before widening",
    pass:
      rolloutJson.nextCoverageAuditCall.tool === "create_all_software_observer_coverage_audit" &&
      rolloutJson.nextCoverageAuditCall.arguments.queue === rolloutJson.queuePath &&
      auditJson.format === "transparent_ai_all_software_observer_coverage_audit_v1",
    evidence: `${audit.auditPath}; ${rolloutJson.nextCoverageAuditCall.arguments.queue}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_coverage_rollout_batch_smoke_v1",
  smokeRoot,
  counts: {
    inventoryCandidates: inventory.softwareCandidates.length,
    expansionBatches: plan.batches.length,
    rolloutQueued: rollout.queuedCount,
    runnerRuns: runnerJournal?.runRecords?.length || 0,
    compactLearningEvents: runnerJournal?.totals?.compactLearningEvents || 0
  },
  paths: {
    inventory: inventoryPath,
    expansionPlan: expansion.planPath,
    rollout: rollout.rolloutPath,
    receipt: rollout.receiptPath,
    runnerJournal: rollout.runnerJournalPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
