#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-coverage-enrollment-ledger-smoke", String(Date.now()));
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
  "Build bounded real-local evidence for an all-software enrollment ledger.",
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

const logSourceLedger = runNodeScript("create-all-software-log-source-discovery-ledger.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "log-source-ledger")
]);

const ledgerResult = runNodeScript("create-all-software-coverage-enrollment-ledger.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--coverage-audit",
  audit.auditPath,
  "--log-source-discovery-ledger",
  logSourceLedger.ledgerPath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "ledger")
]);
const ledger = readJson(ledgerResult.ledgerPath);
const receipt = readJson(ledgerResult.receiptPath);
const mcpServerText = readFileSync(join(pluginRoot, "scripts", "mcp-server.mjs"), "utf8");

const checks = [
  {
    name: "Enrollment ledger accounts for bounded real-local inventory rows",
    pass:
      ledger.format === "transparent_ai_all_software_coverage_enrollment_ledger_v1" &&
      receipt.format === "transparent_ai_all_software_coverage_enrollment_ledger_receipt_v1" &&
      ledger.counts.ledgerRows > 0 &&
      ledger.counts.ledgerRows === Math.min(inventory.softwareCandidates.length, 6),
    evidence: ledgerResult.ledgerPath
  },
  {
    name: "Enrollment ledger separates enrolled waiting rows from teacher signal or exclusion gaps",
    pass:
      ledger.rows.every((row) => row.status && Array.isArray(row.nextActions)) &&
      ledger.nextReviewQueue.length === ledgerResult.nextReviewQueueCount &&
      ledger.counts.queueItemsSeen === queue.queuedCount,
    evidence: JSON.stringify(ledger.counts)
  },
  {
    name: "Enrollment ledger can align coverage rows to the current log-source discovery ledger",
    pass:
      ledger.sourceEvidence.logSourceDiscoveryLedgerPath === logSourceLedger.ledgerPath &&
      ledger.counts.logSourceDiscoveryRowsSeen === Math.min(inventory.softwareCandidates.length, 6) &&
      ledger.counts.rowsWithLogSourceRoute === ledger.counts.ledgerRows &&
      ledger.rows.every((row) => row.logSourceRoutePresent === true && row.logSourceDiscoveryStatus),
    evidence: JSON.stringify({
      logSourceDiscoveryRowsSeen: ledger.counts.logSourceDiscoveryRowsSeen,
      rowsWithLogSourceRoute: ledger.counts.rowsWithLogSourceRoute
    })
  },
  {
    name: "Enrollment ledger refuses to claim all-software completion from a bounded sample",
    pass:
      ledger.allSoftwareCoverageComplete === false &&
      receipt.allSoftwareCoverageComplete === false &&
      ledger.completionBoundary.requiredBeforeCompletion.includes("every in-scope row has watch or compact-learning evidence"),
    evidence: JSON.stringify(ledger.completionBoundary)
  },
  {
    name: "Enrollment ledger keeps screenshots logs execution schedules memory native control and packaging locked",
    pass:
      receipt.screenshotsCaptured === false &&
      receipt.fullContinuousRecording === false &&
      receipt.logContentsRead === false &&
      receipt.fileContentsRead === false &&
      receipt.softwareActionsExecuted === false &&
      receipt.scheduledTaskInstalled === false &&
      receipt.memoryWritten === false &&
      receipt.nativeUniversalExecution === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true,
    evidence: ledgerResult.receiptPath
  },
  {
    name: "MCP advanced surface exposes all-software coverage enrollment ledger",
    pass: mcpServerText.includes('name: "create_all_software_coverage_enrollment_ledger"'),
    evidence: "mcp-server.mjs contains create_all_software_coverage_enrollment_ledger"
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_all_software_coverage_enrollment_ledger_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
