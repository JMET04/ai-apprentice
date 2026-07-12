#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const outputRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-coverage-repair-queue-smoke", String(Date.now()));
mkdirSync(outputRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Bounded real local all-software coverage repair queue smoke.",
  "--max-processes",
  "6",
  "--max-installed",
  "6",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(outputRoot, "inventory-kit")
]);

const probeInventoryPath = join(outputRoot, "real-local-software-observer-inventory.json");
const probe = spawnSync("powershell", [
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  probeInventoryPath,
  "-MaxProcesses",
  "6",
  "-MaxInstalled",
  "6",
  "-MaxLogFilesPerCandidate",
  "1"
], {
  cwd: outputRoot,
  encoding: "utf8",
  timeout: 60000
});

const probeInventory = existsSync(probeInventoryPath) ? readJson(probeInventoryPath) : null;
const queueResult = probeInventory
  ? runNodeScript("create-software-observer-queue.mjs", [
      "--inventory",
      probeInventoryPath,
      "--max-candidates",
      "6",
      "--max-files-per-candidate",
      "1",
      "--max-depth",
      "0",
      "--max-entries-per-dir",
      "40",
      "--output-dir",
      join(outputRoot, "queue")
    ])
  : null;
const queueJson = queueResult ? readJson(queueResult.queuePath) : null;
const coverageResult = queueResult
  ? runNodeScript("create-all-software-observer-coverage-audit.mjs", [
      "--goal",
      "Bounded real local all-software coverage repair queue smoke.",
      "--inventory",
      probeInventoryPath,
      "--queue",
      queueResult.queuePath,
      "--max-rows",
      "6",
      "--output-dir",
      join(outputRoot, "coverage-audit")
    ])
  : null;
const auditJson = coverageResult ? readJson(coverageResult.auditPath) : null;
const auditReceipt = coverageResult ? readJson(coverageResult.receiptPath) : null;
const repairQueueResult = coverageResult
  ? runNodeScript("create-all-software-coverage-repair-queue.mjs", [
      "--goal",
      "Turn real local all-software coverage audit gaps into reviewed repair actions.",
      "--audit",
      coverageResult.auditPath,
      "--repair-plan",
      coverageResult.repairPlanPath,
      "--max-items",
      "6",
      "--output-dir",
      join(outputRoot, "coverage-repair-queue")
    ])
  : null;
const repairQueue = repairQueueResult ? readJson(repairQueueResult.queuePath) : null;
const repairReceiptTemplate = repairQueueResult ? readJson(repairQueueResult.receiptTemplatePath) : null;
const repairItems = repairQueue?.repairItems || [];
const allowedTools = new Set([
  "teach_apprentice",
  "create_software_observer_queue",
  "watch_log_source_metadata_deltas",
  "create_software_capability_profile",
  "create_software_control_channel_probe",
  "create_universal_software_observer_kit",
  "create_triggered_visual_check_request"
]);

const checks = [
  {
    name: "Bounded real local inventory and queue feed coverage repair planning",
    pass:
      probe.status === 0 &&
      probeInventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(probeInventory?.softwareCandidates) &&
      probeInventory.softwareCandidates.length > 0 &&
      queueJson?.format === "transparent_ai_software_observer_queue_v1" &&
      Array.isArray(queueJson?.queue) &&
      queueJson.queue.length > 0,
    evidence: JSON.stringify({
      inventoryPath: probeInventoryPath,
      queuePath: queueResult?.queuePath || "",
      candidates: probeInventory?.softwareCandidates?.length || 0,
      queueItems: queueJson?.queue?.length || 0
    })
  },
  {
    name: "Real local coverage audit is the source for the repair queue",
    pass:
      coverageResult?.format === "transparent_ai_all_software_observer_coverage_audit_result_v1" &&
      auditJson?.format === "transparent_ai_all_software_observer_coverage_audit_v1" &&
      auditJson?.sourceEvidence?.inventoryPath === resolve(probeInventoryPath) &&
      auditJson?.sourceEvidence?.queuePath === resolve(queueResult?.queuePath || "") &&
      auditJson?.counts?.totalAudited > 0 &&
      repairQueue?.format === "transparent_ai_all_software_coverage_repair_queue_v1" &&
      repairQueue?.sourceEvidence?.auditPath === resolve(coverageResult?.auditPath || "") &&
      repairQueue?.sourceEvidence?.repairPlanPath === resolve(coverageResult?.repairPlanPath || ""),
    evidence: JSON.stringify({
      auditPath: coverageResult?.auditPath || "",
      repairPlanPath: coverageResult?.repairPlanPath || "",
      repairQueuePath: repairQueueResult?.queuePath || "",
      counts: auditJson?.counts || null
    })
  },
  {
    name: "Repair queue either lists real local gaps or honestly reports none",
    pass:
      repairQueueResult?.format === "transparent_ai_all_software_coverage_repair_queue_result_v1" &&
      repairQueue?.counts?.rowsConsidered === auditJson?.coverageRows?.length &&
      repairQueue?.counts?.repairItems === repairItems.length &&
      (repairItems.length > 0
        ? repairQueueResult.status === "coverage_repair_items_waiting_for_teacher_review"
        : repairQueueResult.status === "no_coverage_repair_items_detected"),
    evidence: JSON.stringify({
      status: repairQueueResult?.status || "",
      rowsConsidered: repairQueue?.counts?.rowsConsidered ?? null,
      repairItems: repairQueue?.counts?.repairItems ?? null,
      actionKinds: repairItems.map((item) => item.actionKind)
    })
  },
  {
    name: "Real local repair actions reuse existing low-token tools only",
    pass:
      repairItems.every((item) => item.nextRepairCalls.every((call) => allowedTools.has(call.tool))) &&
      repairItems.every((item) => item.blockedUntilTeacherReview === true) &&
      repairItems.every((item) => item.screenshotsAllowedNow === false && item.executionAllowedNow === false),
    evidence: JSON.stringify(repairItems.map((item) => ({
      software: item.software,
      actionKind: item.actionKind,
      tools: item.nextRepairCalls.map((call) => call.tool)
    })))
  },
  {
    name: "Real local repair queue receipt template stays review-only",
    pass:
      repairReceiptTemplate?.format === "transparent_ai_all_software_coverage_repair_queue_receipt_template_v1" &&
      repairReceiptTemplate?.defaultDecision === "needs_teacher_review" &&
      repairReceiptTemplate?.blockedDecisions?.includes("accepted") &&
      repairReceiptTemplate?.rows?.every((row) => row.ruleEnabled === false && row.accepted === false && row.packagingGated === true),
    evidence: repairQueueResult?.receiptTemplatePath || ""
  },
  {
    name: "Real local coverage repair flow keeps contents, screenshots, execution, memory, and packaging locked",
    pass:
      probeInventory?.discoveryScope?.logContentsRead === false &&
      probeInventory?.discoveryScope?.fullContinuousRecording === false &&
      queueJson?.boundedScan?.fullLogsRead === false &&
      queueJson?.boundedScan?.screenshotsCaptured === false &&
      auditReceipt?.fileContentsRead === false &&
      auditReceipt?.screenshotsCaptured === false &&
      auditReceipt?.softwareActionsExecuted === false &&
      auditReceipt?.memoryWritten === false &&
      repairQueue?.locks?.logContentsRead === false &&
      repairQueue?.locks?.screenshotsCaptured === false &&
      repairQueue?.locks?.softwareActionsExecuted === false &&
      repairQueue?.locks?.memoryWritten === false &&
      repairQueue?.locks?.packagingGated === true,
    evidence: outputRoot
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_coverage_repair_queue_smoke_v1",
  outputRoot,
  counts: {
    inventoryCandidates: probeInventory?.softwareCandidates?.length || 0,
    queueItems: queueJson?.queue?.length || 0,
    auditedRows: auditJson?.counts?.totalAudited || 0,
    repairItems: repairItems.length
  },
  paths: {
    inventory: probeInventoryPath,
    queue: queueResult?.queuePath || "",
    audit: coverageResult?.auditPath || "",
    repairPlan: coverageResult?.repairPlanPath || "",
    repairQueue: repairQueueResult?.queuePath || "",
    repairReceiptTemplate: repairQueueResult?.receiptTemplatePath || ""
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
