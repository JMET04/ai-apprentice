#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-convergence-automatic-learning-package-smoke", String(Date.now()));
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
  "Build bounded real-local evidence for convergence automatic learning package proof.",
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

const supervisor = runNodeScript("run-all-software-coverage-rollout-supervisor.mjs", [
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
  join(smokeRoot, "rollout-supervisor")
]);

const convergence = runNodeScript("create-all-software-coverage-convergence-audit.mjs", [
  "--plan",
  expansion.planPath,
  "--supervisor",
  supervisor.supervisorPath,
  "--output-dir",
  join(smokeRoot, "convergence-audit")
]);

const autoPackage = runNodeScript("create-convergence-automatic-learning-package.mjs", [
  "--convergence",
  convergence.auditPath,
  "--teacher-reviewed",
  "--run-once",
  "--runs-per-queue",
  "1",
  "--max-items",
  "2",
  "--max-learning-items",
  "2",
  "--output-dir",
  join(smokeRoot, "automatic-learning-package")
]);
const packageJson = readJson(autoPackage.packagePath);
const receipt = readJson(autoPackage.receiptPath);

const checks = [
  {
    name: "Convergence automatic learning package extracts reviewed queues from convergence audit",
    pass:
      packageJson.format === "transparent_ai_convergence_automatic_learning_package_v1" &&
      receipt.format === "transparent_ai_convergence_automatic_learning_package_receipt_v1" &&
      packageJson.queueJobs.length > 0 &&
      autoPackage.queueCount === packageJson.queueJobs.length,
    evidence: autoPackage.packagePath
  },
  {
    name: "Package reuses existing automatic low-token learning runner for every reviewed queue",
    pass:
      packageJson.files.runner.endsWith("run-converged-coverage-learning.ps1") &&
      packageJson.runOnce.results.length === packageJson.queueJobs.length &&
      packageJson.runOnce.results.every((result) => result.journalPath && result.receiptPath),
    evidence: packageJson.runOnce.results.map((result) => result.journalPath).join("; ")
  },
  {
    name: "Package creates teacher-confirmed schedule scripts without registering a task",
    pass:
      packageJson.files.registerTask &&
      packageJson.files.unregisterTask &&
      packageJson.schedulePolicy.requiresTeacherConfirmedFlag === true &&
      packageJson.schedulePolicy.taskRegistered === false &&
      receipt.scheduledTaskInstalled === false,
    evidence: packageJson.files.registerTask
  },
  {
    name: "Package keeps broad completion and native execution unclaimed",
    pass:
      packageJson.allSoftwareCoverageComplete === false &&
      receipt.allSoftwareCoverageComplete === false &&
      receipt.nativeUniversalExecution === false &&
      packageJson.completionBoundary.reason.includes("universal native execution"),
    evidence: JSON.stringify(packageJson.completionBoundary)
  },
  {
    name: "Package keeps screenshots memory schedules execution and packaging locked",
    pass:
      receipt.screenshotsCaptured === false &&
      receipt.fullContinuousRecording === false &&
      receipt.rawFullLogsRetained === false &&
      receipt.memoryWritten === false &&
      receipt.longTermMemoryWritten === false &&
      receipt.softwareActionsExecuted === false &&
      receipt.scheduledTaskInstalled === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true,
    evidence: autoPackage.receiptPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_convergence_automatic_learning_package_smoke_v1",
  smokeRoot,
  counts: {
    inventoryCandidates: inventory.softwareCandidates.length,
    plannedBatches: plan.batches.length,
    convergenceAdvancedWithAudit: readJson(convergence.auditPath).counts.advancedWithPostBatchAudit,
    queueCount: autoPackage.queueCount,
    runOnceResults: autoPackage.runOnceResults,
    runnerRuns: autoPackage.runnerRuns,
    compactLearningEvents: autoPackage.compactLearningEvents
  },
  paths: {
    inventory: inventoryPath,
    expansionPlan: expansion.planPath,
    supervisor: supervisor.supervisorPath,
    convergence: convergence.auditPath,
    package: autoPackage.packagePath,
    receipt: autoPackage.receiptPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
