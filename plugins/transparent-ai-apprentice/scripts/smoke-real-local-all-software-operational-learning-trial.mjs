#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "optrial-smoke", String(Date.now()));

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
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

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const result = runNodeScript("run-all-software-operational-learning-trial.mjs", [
  "--goal",
  "Operational trial smoke.",
  "--max-processes",
  "4",
  "--max-installed",
  "4",
  "--max-log-files-per-candidate",
  "1",
  "--max-queue-candidates",
  "3",
  "--runs",
  "1",
  "--max-runner-items",
  "2",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "8",
  "--max-learning-items",
  "1",
  "--output-dir",
  smokeRoot
]);

const trial = readJson(result.trialPath);
const receipt = readJson(result.receiptPath);
const checks = [
  check(
    "Operational trial writes machine-readable trial, receipt, and teacher start-here files",
    trial.format === "transparent_ai_all_software_operational_learning_trial_v1" &&
      receipt.format === "transparent_ai_all_software_operational_learning_trial_receipt_v1" &&
      existsSync(result.readme),
    result.trialPath
  ),
  check(
    "Trial actually launches the existing low-token runner manually",
    receipt.manualLowTokenRunnerLaunched === true && existsSync(trial.paths.manualRunnerJournal) && (trial.counts.manualRunnerRuns || 0) >= 1,
    trial.paths.manualRunnerJournal
  ),
  check(
    "Run-output audit and operational workbench consume the manual runner output",
    existsSync(trial.paths.runOutputAudit) && existsSync(trial.paths.operationalWorkbench) && (trial.counts.reviewedRunCount || 0) >= 1,
    `${trial.paths.runOutputAudit}; ${trial.paths.operationalWorkbench}`
  ),
  check(
    "Trial carries readiness log-source discovery ledger into operational evidence",
    existsSync(trial.paths.logSourceDiscoveryLedger) &&
      trial.lowTokenSourceRouteEvidence.ledgerReady === true &&
      trial.lowTokenSourceRouteEvidence.reviewOnly === true &&
      trial.lowTokenSourceRouteEvidence.logContentsRead === false &&
      trial.lowTokenSourceRouteEvidence.screenshotsCaptured === false &&
      trial.lowTokenSourceRouteEvidence.softwareActionsExecuted === false &&
      (trial.counts.logSourceDiscoveryRows || 0) >= 1 &&
      typeof trial.counts.logSourceDiscoveryMissingRows === "number" &&
      trial.existingAbilitiesReused.includes("create_all_software_log_source_discovery_ledger"),
    trial.paths.logSourceDiscoveryLedger
  ),
  check(
    "Trial is honest about unattended registration and teacher-review blockers",
    trial.blockers.includes("scheduled_task_not_registered_or_not_matching") &&
      trial.blockers.includes("teacher_review_packet_missing_or_not_replayed") &&
      trial.proofBoundary.operationalUnattendedComplete === false,
    JSON.stringify(trial.blockers)
  ),
  check(
    "Safety locks stay closed during real-local operational trial",
    receipt.scheduledTaskRegistered === false &&
      receipt.scheduledTaskStarted === false &&
      receipt.targetSoftwareCommandsExecuted === false &&
      receipt.screenshotsCaptured === false &&
      receipt.longTermMemoryWritten === false &&
      receipt.nativeUniversalExecution === false &&
      receipt.locks.packagingGated === true,
    JSON.stringify(receipt.locks)
  )
];

const failed = checks.filter((item) => !item.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", smoke: "transparent_ai_real_local_all_software_operational_learning_trial_smoke_v1", checks }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      smoke: "transparent_ai_real_local_all_software_operational_learning_trial_smoke_v1",
      smokeRoot,
      trialPath: result.trialPath,
      counts: trial.counts,
      checks
    },
    null,
    2
  )
);
