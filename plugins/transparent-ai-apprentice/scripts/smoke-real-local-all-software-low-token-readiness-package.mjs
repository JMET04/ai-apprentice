#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-low-token-readiness-package-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const result = runNodeScript("create-real-local-all-software-low-token-readiness-package.mjs", [
  "--goal",
  "Smoke a real-local all-software low-token readiness package with bounded metadata-first learning.",
  "--max-processes",
  "8",
  "--max-installed",
  "8",
  "--max-log-files-per-candidate",
  "1",
  "--max-queue-candidates",
  "5",
  "--max-runner-items",
  "3",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12",
  "--max-learning-items",
  "1",
  "--output-dir",
  smokeRoot
]);

const readiness = readJson(result.packagePath);
const receipt = readJson(result.receiptPath);
const inventory = readJson(readiness.paths.inventory);
const queue = readJson(readiness.paths.observerQueue);
const logSourceLedger = readJson(readiness.paths.logSourceDiscoveryLedger);
const coverage = readJson(readiness.paths.coverageAudit);
const repairQueue = readJson(readiness.paths.repairQueue);
const schedule = readJson(readiness.paths.automaticSchedule);
const runner = readiness.paths.automaticRunner ? readJson(readiness.paths.automaticRunner) : null;
const visualQueue = readiness.paths.triggeredVisualCheckQueue ? readJson(readiness.paths.triggeredVisualCheckQueue) : null;
const teacherReviewDashboard = readiness.paths.teacherReviewDashboard
  ? readFileSync(readiness.paths.teacherReviewDashboard, "utf8")
  : "";

const checks = [
  {
    name: "Readiness package runs real local inventory and observer queue with bounded limits",
    pass:
      readiness.format === "transparent_ai_real_local_all_software_low_token_readiness_package_v1" &&
      inventory.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      queue.format === "transparent_ai_software_observer_queue_v1" &&
      Array.isArray(queue.queue) &&
      queue.queue.length > 0 &&
      readiness.counts.realLocalCandidates === inventory.softwareCandidates.length,
    evidence: `${readiness.paths.inventory}; ${readiness.paths.observerQueue}`
  },
  {
    name: "Readiness package maps real local software rows to log sources or low-token fallbacks",
    pass:
      logSourceLedger.format === "transparent_ai_all_software_log_source_discovery_ledger_v1" &&
      logSourceLedger.sourceEvidence.inventoryPath === readiness.paths.inventory &&
      logSourceLedger.sourceEvidence.queuePath === readiness.paths.observerQueue &&
      Array.isArray(logSourceLedger.rows) &&
      logSourceLedger.rows.length > 0 &&
      readiness.paths.logSourceDiscoveryLedgerReceipt &&
      existsSync(readiness.paths.logSourceDiscoveryLedgerReceipt) &&
      readiness.paths.logSourceDiscoveryLedgerReadme &&
      existsSync(readiness.paths.logSourceDiscoveryLedgerReadme) &&
      readiness.counts.logSourceDiscoveryRows === logSourceLedger.rows.length &&
      readiness.counts.logSourceDiscoveryRows === inventory.softwareCandidates.length &&
      typeof readiness.counts.logSourceDiscoveryMissingRows === "number" &&
      typeof readiness.counts.directLogCandidatesReadyForMetadataGate === "number" &&
      typeof readiness.counts.lowTokenFallbackRoutesReadyForReview === "number" &&
      readiness.boundaries.logSourceDiscoveryComplete === false &&
      logSourceLedger.locks.logContentsRead === false &&
      logSourceLedger.locks.fullLogsRead === false &&
      logSourceLedger.locks.screenshotsCaptured === false &&
      logSourceLedger.locks.softwareActionsExecuted === false &&
      logSourceLedger.locks.nativeUniversalExecution === false,
    evidence: readiness.paths.logSourceDiscoveryLedger
  },
  {
    name: "Readiness package proves the bounded real-local sample is not CAD or SolidWorks only",
    pass:
      readiness.scopeEvidence?.scopeClaim === "real_local_bounded_all_software_not_cad_solidworks_only" &&
      readiness.counts.nonCadSolidWorksCandidates > 0 &&
      readiness.scopeEvidence.nonCadSolidWorksCandidateRows === readiness.counts.nonCadSolidWorksCandidates &&
      readiness.scopeEvidence.nonCadSolidWorksLedgerRows > 0 &&
      Array.isArray(readiness.scopeEvidence.sampledNonCadSolidWorksRows) &&
      readiness.scopeEvidence.sampledNonCadSolidWorksRows.length > 0 &&
      readiness.scopeEvidence.sampledNonCadSolidWorksRows.every(
        (row) =>
          row.discoveryStatus &&
          !/\b(cad|solidworks|sw\d*|autocad|fusion\s*360|inventor)\b/i.test(
            `${row.software || ""} ${row.processName || ""}`
          )
      ) &&
      readiness.scopeEvidence.boundedNotComplete === true,
    evidence: JSON.stringify(readiness.scopeEvidence?.sampledNonCadSolidWorksRows || [])
  },
  {
    name: "Readiness package runs automatic low-token runner metadata-first without memory or screenshots",
    pass:
      runner?.format === "transparent_ai_automatic_low_token_learning_runner_v1" &&
      runner.automaticRunPolicy.metadataGateFirst === true &&
      runner.automaticRunPolicy.skipTailWhenMetadataUnchanged === true &&
      runner.locks.fullContinuousRecording === false &&
      runner.locks.screenshotsCaptured === false &&
      runner.locks.longTermMemoryWritten === false &&
      runner.locks.softwareActionsExecuted === false &&
      runner.locks.nativeUniversalExecution === false,
    evidence: readiness.paths.automaticRunner
  },
  {
    name: "Readiness package creates coverage audit and repair queue for widening all-software learning",
    pass:
      coverage.format === "transparent_ai_all_software_observer_coverage_audit_v1" &&
      Array.isArray(coverage.coverageRows) &&
      coverage.coverageRows.length > 0 &&
      coverage.counts.withWatchEvidence > 0 &&
      repairQueue.format === "transparent_ai_all_software_coverage_repair_queue_v1" &&
      repairQueue.policy.onlyGapsQueued === true &&
      repairQueue.locks.fullContinuousRecording === false &&
      repairQueue.locks.screenshotsCaptured === false &&
      repairQueue.locks.softwareActionsExecuted === false,
    evidence: `${readiness.paths.coverageAudit}; ${readiness.paths.repairQueue}`
  },
  {
    name: "Readiness package writes a teacher review dashboard for fallback and repair rows",
    pass:
      readiness.paths.teacherReviewDashboard &&
      existsSync(readiness.paths.teacherReviewDashboard) &&
      teacherReviewDashboard.includes("Real Local All-Software Low-Token Teacher Review") &&
      teacherReviewDashboard.includes("missing source rows") &&
      teacherReviewDashboard.includes("fallback routes needing review") &&
      teacherReviewDashboard.includes("Teacher Review Queue") &&
      teacherReviewDashboard.includes("Screenshots, target software execution, memory writes") &&
      teacherReviewDashboard.includes("Repair queue"),
    evidence: readiness.paths.teacherReviewDashboard || "missing teacher review dashboard"
  },
  {
    name: "Readiness package creates a teacher-confirmed schedule package but does not register it",
    pass:
      schedule.format === "transparent_ai_automatic_low_token_learning_schedule_v1" &&
      schedule.schedulePolicy.taskRegistered === false &&
      schedule.schedulePolicy.scheduledTaskInstalled === false &&
      schedule.schedulePolicy.requiresTeacherConfirmedFlag === true &&
      existsSync(readiness.paths.scheduledRunner) &&
      existsSync(readiness.paths.scheduleRegisterScript),
    evidence: readiness.paths.automaticSchedule
  },
  {
    name: "Readiness package creates triggered visual-check queue only as review-gated follow-up",
    pass:
      visualQueue?.format === "transparent_ai_automatic_triggered_visual_check_queue_v1" &&
      visualQueue.locks.maxOneScreenshotPerRequest === true &&
      visualQueue.locks.teacherConfirmationRequiredBeforeCapture === true &&
      visualQueue.locks.screenshotsCaptured === false &&
      visualQueue.locks.softwareActionsExecuted === false,
    evidence: readiness.paths.triggeredVisualCheckQueue
  },
  {
    name: "Readiness package keeps broad completion, native execution, schedules, screenshots, memory, and packaging locked",
    pass:
      receipt.format === "transparent_ai_real_local_all_software_low_token_readiness_receipt_v1" &&
      readiness.boundaries.broadAllInstalledSoftwareComplete === false &&
      readiness.boundaries.arbitraryNativeExecutionComplete === false &&
      readiness.boundaries.scheduledTaskRegistered === false &&
      readiness.boundaries.screenshotsCaptured === false &&
      readiness.boundaries.longTermMemoryWritten === false &&
      readiness.locks.accepted === false &&
      readiness.locks.ruleEnabled === false &&
      readiness.locks.packagingGated === true &&
      readiness.locks.scheduledTaskInstalled === false &&
      readiness.locks.nativeUniversalExecution === false,
    evidence: result.receiptPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_low_token_readiness_package_smoke_v1",
  smokeRoot,
  packagePath: result.packagePath,
  counts: readiness.counts,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
