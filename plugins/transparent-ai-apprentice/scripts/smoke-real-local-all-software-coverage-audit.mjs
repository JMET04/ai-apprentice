#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const outputRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-coverage-audit-smoke", String(Date.now()));
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
  "Bounded real local all-software coverage audit smoke.",
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
      "Bounded real local all-software coverage audit smoke.",
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
const receiptJson = coverageResult ? readJson(coverageResult.receiptPath) : null;
const repairPlanJson = coverageResult ? readJson(coverageResult.repairPlanPath) : null;

const checks = [
  {
    name: "Bounded real local inventory probe runs before coverage audit",
    pass:
      probe.status === 0 &&
      probeInventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      probeInventory?.source === "read_only_local_probe" &&
      Array.isArray(probeInventory?.softwareCandidates) &&
      probeInventory.softwareCandidates.length > 0,
    evidence: `status=${probe.status}; candidates=${probeInventory?.softwareCandidates?.length ?? 0}; path=${probeInventoryPath}`
  },
  {
    name: "Inventory probe keeps contents, screenshots, recording, and native execution locked",
    pass:
      probeInventory?.discoveryScope?.logContentsRead === false &&
      probeInventory?.discoveryScope?.fullContinuousRecording === false &&
      probeInventory?.discoveryScope?.nativeUniversalExecution === false &&
      probeInventory?.logSourceIndex?.fullLogsRead === false &&
      probeInventory?.locks?.packagingGated === true,
    evidence: JSON.stringify({
      discoveryScope: probeInventory?.discoveryScope,
      logSourceIndex: probeInventory?.logSourceIndex,
      locks: probeInventory?.locks
    })
  },
  {
    name: "Real local inventory turns into a bounded observer queue for coverage audit",
    pass:
      queueResult?.format === "transparent_ai_software_observer_queue_result_v1" &&
      queueJson?.format === "transparent_ai_software_observer_queue_v1" &&
      Array.isArray(queueJson?.queue) &&
      queueJson.queue.length > 0 &&
      queueJson?.boundedScan?.fullLogsRead === false &&
      queueJson?.boundedScan?.screenshotsCaptured === false &&
      queueJson?.boundedScan?.fullContinuousRecording === false &&
      queueJson?.locks?.nativeUniversalExecution === false,
    evidence: queueResult?.queuePath || ""
  },
  {
    name: "Coverage audit consumes real local inventory and queue evidence",
    pass:
      coverageResult?.format === "transparent_ai_all_software_observer_coverage_audit_result_v1" &&
      auditJson?.format === "transparent_ai_all_software_observer_coverage_audit_v1" &&
      auditJson?.sourceEvidence?.inventoryPath === resolve(probeInventoryPath) &&
      auditJson?.sourceEvidence?.queuePath === resolve(queueResult?.queuePath || "") &&
      auditJson?.counts?.totalAudited > 0 &&
      auditJson?.counts?.missingQueueItem === 0 &&
      auditJson?.policy?.allSoftwareDoesNotMeanAllAppsExposeLogs === true,
    evidence: `${coverageResult?.auditPath || ""}; missingQueueItem=${auditJson?.counts?.missingQueueItem ?? "unknown"}`
  },
  {
    name: "Coverage audit reads no log or file contents and keeps screenshots/execution/memory locked",
    pass:
      receiptJson?.format === "transparent_ai_all_software_observer_coverage_audit_receipt_v1" &&
      receiptJson?.logContentsRead === false &&
      receiptJson?.fullLogsRead === false &&
      receiptJson?.fileContentsRead === false &&
      receiptJson?.screenshotsCaptured === false &&
      receiptJson?.fullContinuousRecording === false &&
      receiptJson?.softwareActionsExecuted === false &&
      receiptJson?.memoryWritten === false &&
      receiptJson?.accepted === false &&
      receiptJson?.ruleEnabled === false &&
      receiptJson?.packagingGated === true &&
      receiptJson?.locks?.nativeUniversalExecution === false,
    evidence: JSON.stringify(receiptJson)
  },
  {
    name: "Coverage repair plan preserves broad-coverage blockers instead of overclaiming",
    pass:
      repairPlanJson?.format === "transparent_ai_all_software_observer_coverage_repair_plan_v1" &&
      Array.isArray(repairPlanJson?.repairItems) &&
      repairPlanJson?.blockedActions?.includes("claim_all_software_covered_without_audit") &&
      repairPlanJson?.blockedActions?.includes("read_full_logs_by_default") &&
      repairPlanJson?.blockedActions?.includes("start_continuous_recording") &&
      repairPlanJson?.blockedActions?.includes("capture_screenshot_without_trigger") &&
      repairPlanJson?.blockedActions?.includes("execute_software") &&
      repairPlanJson?.locks?.packagingGated === true,
    evidence: coverageResult?.repairPlanPath || ""
  },
  {
    name: "Bounded real local inventory, queue, and coverage audit complete without log/file contents, screenshots, execution, or memory",
    pass:
      probeInventory?.discoveryScope?.logContentsRead === false &&
      queueJson?.boundedScan?.fullLogsRead === false &&
      receiptJson?.fileContentsRead === false &&
      receiptJson?.screenshotsCaptured === false &&
      receiptJson?.softwareActionsExecuted === false &&
      receiptJson?.memoryWritten === false,
    evidence: outputRoot
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_coverage_audit_smoke_v1",
  outputRoot,
  counts: auditJson?.counts || null,
  paths: {
    inventory: probeInventoryPath,
    queue: queueResult?.queuePath || "",
    audit: coverageResult?.auditPath || "",
    receipt: coverageResult?.receiptPath || "",
    repairPlan: coverageResult?.repairPlanPath || ""
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
