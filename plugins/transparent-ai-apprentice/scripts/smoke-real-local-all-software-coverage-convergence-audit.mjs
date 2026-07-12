#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-coverage-convergence-audit-smoke", String(Date.now()));
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Build bounded real-local evidence for all-software coverage convergence audit proof.",
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
  "2",
  "--max-software",
  "8",
  "--output-dir",
  join(smokeRoot, "expansion-plan")
]);
const plan = readJson(expansion.planPath);

const supervisorA = runNodeScript("run-all-software-coverage-rollout-supervisor.mjs", [
  "--plan",
  expansion.planPath,
  "--teacher-reviewed",
  "--start-batch",
  "batch-001",
  "--max-batches",
  "2",
  "--runs-per-batch",
  "1",
  "--max-items",
  "2",
  "--output-dir",
  join(smokeRoot, "rollout-supervisor-a")
]);

const supervisorB = runNodeScript("run-all-software-coverage-rollout-supervisor.mjs", [
  "--plan",
  expansion.planPath,
  "--teacher-reviewed",
  "--start-batch",
  "batch-003",
  "--max-batches",
  "2",
  "--runs-per-batch",
  "1",
  "--max-items",
  "2",
  "--output-dir",
  join(smokeRoot, "rollout-supervisor-b")
]);

const convergence = runNodeScript("create-all-software-coverage-convergence-audit.mjs", [
  "--plan",
  expansion.planPath,
  "--supervisor",
  supervisorA.supervisorPath,
  "--supervisor",
  supervisorB.supervisorPath,
  "--output-dir",
  join(smokeRoot, "convergence-audit")
]);
const convergenceJson = readJson(convergence.auditPath);
const receipt = readJson(convergence.receiptPath);

const checks = [
  {
    name: "Convergence audit aggregates a real local expansion plan and multiple supervisors",
    pass:
      convergenceJson.format === "transparent_ai_all_software_coverage_convergence_audit_v1" &&
      receipt.format === "transparent_ai_all_software_coverage_convergence_audit_receipt_v1" &&
      convergenceJson.counts.supervisorsAudited === 2 &&
      convergenceJson.counts.plannedBatches === plan.batches.length,
    evidence: convergence.auditPath
  },
  {
    name: "Convergence audit proves all sampled planned batches have post-batch audit packets",
    pass:
      convergenceJson.coverageConvergedForTeacherReview === true &&
      convergenceJson.counts.advancedWithPostBatchAudit === plan.batches.length &&
      convergenceJson.remainingBatches.length === 0,
    evidence: JSON.stringify(convergenceJson.counts)
  },
  {
    name: "Convergence audit keeps full all-software completion unclaimed after sampled convergence",
    pass:
      convergenceJson.allSoftwareCoverageComplete === false &&
      receipt.allSoftwareCoverageComplete === false &&
      convergence.allSoftwareCoverageComplete === false &&
      convergenceJson.completionBoundary.reason.includes("teacher acceptance"),
    evidence: JSON.stringify(convergenceJson.completionBoundary)
  },
  {
    name: "Convergence audit keeps screenshots memory schedules execution native control and packaging locked",
    pass:
      receipt.screenshotsCaptured === false &&
      receipt.fullContinuousRecording === false &&
      receipt.rawFullLogsRetained === false &&
      receipt.memoryWritten === false &&
      receipt.softwareActionsExecuted === false &&
      receipt.scheduledTaskInstalled === false &&
      receipt.nativeUniversalExecution === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true,
    evidence: convergence.receiptPath
  },
  {
    name: "Convergence audit gives a next review action instead of auto-accepting coverage",
    pass:
      convergenceJson.nextCommand.includes("Review every post-batch coverage audit receipt") &&
      convergenceJson.completionBoundary.stillNeeded.includes("teacher reviews post-batch audit receipts"),
    evidence: convergenceJson.nextCommand
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_coverage_convergence_audit_smoke_v1",
  smokeRoot,
  counts: {
    inventoryCandidates: inventory.softwareCandidates.length,
    plannedBatches: plan.batches.length,
    supervisorsAudited: convergenceJson.counts.supervisorsAudited,
    advancedWithPostBatchAudit: convergenceJson.counts.advancedWithPostBatchAudit,
    remainingBatchCount: convergence.remainingBatchCount,
    queuedSoftware: convergenceJson.counts.queuedSoftware,
    runnerRuns: convergenceJson.counts.runnerRuns,
    compactLearningEvents: convergenceJson.counts.compactLearningEvents
  },
  paths: {
    inventory: inventoryPath,
    expansionPlan: expansion.planPath,
    supervisorA: supervisorA.supervisorPath,
    supervisorB: supervisorB.supervisorPath,
    convergence: convergence.auditPath,
    receipt: convergence.receiptPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
