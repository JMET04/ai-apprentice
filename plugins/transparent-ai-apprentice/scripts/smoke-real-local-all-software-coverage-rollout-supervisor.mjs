#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-coverage-rollout-supervisor-smoke", String(Date.now()));
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Build bounded real-local evidence for all-software coverage rollout supervisor proof.",
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
  "--max-batches",
  "2",
  "--runs-per-batch",
  "1",
  "--max-items",
  "2",
  "--output-dir",
  join(smokeRoot, "rollout-supervisor")
]);
const supervisorJson = readJson(supervisor.supervisorPath);
const receipt = readJson(supervisor.receiptPath);

const checks = [
  {
    name: "Real local expansion plan becomes a multi-batch rollout supervisor packet",
    pass:
      supervisorJson.format === "transparent_ai_all_software_coverage_rollout_supervisor_v1" &&
      receipt.format === "transparent_ai_all_software_coverage_rollout_supervisor_receipt_v1" &&
      supervisorJson.selectedBatches.length >= 1 &&
      supervisorJson.completedBatchPackets >= 1,
    evidence: supervisor.supervisorPath
  },
  {
    name: "Supervisor reuses the existing single-batch rollout runner for each selected batch",
    pass:
      supervisorJson.batchPackets.every((packet) => packet.usesExistingBatchRunner === true) &&
      supervisorJson.batchPackets.every((packet) => packet.rolloutPath && packet.queuePath),
    evidence: supervisorJson.batchPackets.map((packet) => packet.rolloutPath).join("; ")
  },
  {
    name: "Supervisor reruns coverage audit after each selected batch before widening",
    pass:
      supervisorJson.auditPackets.length === supervisorJson.batchPackets.length &&
      supervisorJson.auditPackets.every((packet) => packet.coverageAuditRerunAfterBatch === true && packet.auditPath),
    evidence: supervisorJson.auditPackets.map((packet) => packet.auditPath).join("; ")
  },
  {
    name: "Supervisor reviewed mode preserves metadata-first automatic runner evidence",
    pass:
      supervisor.teacherReviewed === true &&
      supervisor.runnerRuns >= 1 &&
      supervisorJson.batchPackets.some((packet) => packet.runnerJournalPath),
    evidence: `runnerRuns=${supervisor.runnerRuns}; compactLearningEvents=${supervisor.compactLearningEvents}`
  },
  {
    name: "Supervisor keeps broad all-software completion unclaimed",
    pass:
      supervisorJson.completionBoundary.allSoftwareCoverageComplete === false &&
      supervisor.allSoftwareCoverageComplete === false &&
      receipt.allSoftwareCoverageComplete === false,
    evidence: JSON.stringify(supervisorJson.completionBoundary)
  },
  {
    name: "Supervisor keeps screenshots memory schedules execution native control and packaging locked",
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
    evidence: supervisor.receiptPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_coverage_rollout_supervisor_smoke_v1",
  smokeRoot,
  counts: {
    inventoryCandidates: inventory.softwareCandidates.length,
    expansionBatches: plan.batches.length,
    selectedBatches: supervisor.selectedBatches.length,
    completedBatchPackets: supervisor.completedBatchPackets,
    auditPackets: supervisor.auditPackets,
    queuedSoftware: supervisor.queuedSoftware,
    runnerRuns: supervisor.runnerRuns,
    compactLearningEvents: supervisor.compactLearningEvents
  },
  paths: {
    inventory: inventoryPath,
    expansionPlan: expansion.planPath,
    supervisor: supervisor.supervisorPath,
    receipt: supervisor.receiptPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
