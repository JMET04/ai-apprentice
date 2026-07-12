#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-coverage-expansion-plan-smoke", String(Date.now()));
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
  "Build bounded real-local evidence for all-software coverage expansion planning.",
  "--max-processes",
  "10",
  "--max-installed",
  "10",
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
  "10",
  "-MaxInstalled",
  "10",
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
  "8",
  "--output-dir",
  join(smokeRoot, "observer-queue")
]);
const queueJson = readJson(queue.queuePath);

const audit = runNodeScript("create-all-software-observer-coverage-audit.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--max-rows",
  "10",
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
  "10",
  "--output-dir",
  join(smokeRoot, "repair-queue")
]);
const repairQueueJson = readJson(repairQueue.queuePath);

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
  "10",
  "--output-dir",
  join(smokeRoot, "expansion-plan")
]);
const plan = readJson(expansion.planPath);
const receipt = readJson(expansion.receiptPath);
const allRows = plan.batches.flatMap((batch) => batch.rows);
const nextTools = new Set(allRows.flatMap((row) => row.nextCalls.map((call) => call.tool)));

const checks = [
  {
    name: "Real local inventory feeds coverage expansion planning",
    pass:
      inventory.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      expansion.counts.candidateSoftware > 0,
    evidence: `inventory=${inventoryPath}; candidates=${inventory.softwareCandidates.length}`
  },
  {
    name: "Coverage expansion plan batches all sampled software for teacher review",
    pass:
      plan.format === "transparent_ai_all_software_coverage_expansion_plan_v1" &&
      plan.status === "waiting_for_teacher_review" &&
      plan.counts.candidateSoftware === allRows.length &&
      plan.batches.length >= 1 &&
      plan.batches.every((batch) => batch.batchSize <= 3 && batch.status === "waiting_for_teacher_review"),
    evidence: expansion.planPath
  },
  {
    name: "Expansion plan reuses existing low-token tools instead of new monitoring technology",
    pass:
      nextTools.size > 0 &&
      [...nextTools].every((tool) =>
        [
          "create_software_observer_queue",
          "watch_log_source_metadata_deltas",
          "run_automatic_low_token_learning_runner",
          "create_universal_software_observer_kit",
          "create_triggered_visual_check_request",
          "create_software_capability_profile",
          "create_software_control_channel_probe",
          "create_all_software_coverage_repair_queue"
        ].includes(tool)
      ),
    evidence: JSON.stringify([...nextTools])
  },
  {
    name: "Expansion plan keeps completion boundary honest",
    pass:
      plan.completionBoundary.allSoftwareCoverageComplete === false &&
      plan.completionBoundary.proofNeededBeforeCompletion.some((item) => item.includes("all in-scope software")) &&
      plan.expansionPolicy.noUniversalNativeExecutionClaim === true &&
      receipt.nativeUniversalExecution === false,
    evidence: JSON.stringify(plan.completionBoundary)
  },
  {
    name: "Expansion plan keeps screenshots memory schedules execution and packaging locked",
    pass:
      receipt.screenshotsCaptured === false &&
      receipt.fullContinuousRecording === false &&
      receipt.memoryWritten === false &&
      receipt.softwareActionsExecuted === false &&
      receipt.packagingGated === true &&
      receipt.locks.scheduledTaskInstalled === false &&
      plan.locks.rawFullLogsRetained === false,
    evidence: expansion.receiptPath
  },
  {
    name: "Coverage audit and repair queue still feed the expansion plan",
    pass:
      auditJson.format === "transparent_ai_all_software_observer_coverage_audit_v1" &&
      repairQueueJson.format === "transparent_ai_all_software_coverage_repair_queue_v1" &&
      plan.sourceEvidence.auditPath === audit.auditPath &&
      plan.sourceEvidence.repairQueuePath === repairQueue.queuePath,
    evidence: `${audit.auditPath}; ${repairQueue.queuePath}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_coverage_expansion_plan_smoke_v1",
  smokeRoot,
  counts: {
    inventoryCandidates: inventory.softwareCandidates.length,
    queueItems: Array.isArray(queueJson.queue) ? queueJson.queue.length : 0,
    auditedRows: auditJson.counts?.totalAudited ?? 0,
    repairItems: Array.isArray(repairQueueJson.repairItems) ? repairQueueJson.repairItems.length : 0,
    expansionBatches: plan.batches.length,
    expansionRows: allRows.length
  },
  paths: {
    inventory: inventoryPath,
    queue: queue.queuePath,
    audit: audit.auditPath,
    repairQueue: repairQueue.queuePath,
    expansionPlan: expansion.planPath,
    expansionReceipt: expansion.receiptPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
