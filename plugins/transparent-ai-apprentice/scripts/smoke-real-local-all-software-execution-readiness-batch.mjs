#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-readiness-batch-smoke", String(Date.now()));
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

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const goal =
  "Prove real local software can flow from inventory to dry-run execution readiness without executing target apps.";
const run = runNodeScript("run-real-local-all-software-execution-readiness-batch.mjs", [
  "--goal",
  goal,
  "--max-processes",
  "8",
  "--max-installed",
  "8",
  "--max-software",
  "8",
  "--max-pilots",
  "2",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  smokeRoot
]);

const packet = readJson(run.packetPath);
const receipt = readJson(run.receiptPath);
const batch = readJson(packet.generatedEvidence.executionPilotDryRunBatch);
const checks = [
  check(
    "Readiness batch starts from a real local read-only inventory",
    packet.format === "transparent_ai_real_local_all_software_execution_readiness_batch_v1" &&
      packet.counts.inventoryCandidates > 0 &&
      existsSync(packet.generatedEvidence.realLocalInventory),
    packet.generatedEvidence.realLocalInventory
  ),
  check(
    "Readiness batch creates control-channel coverage and execution pilot queue from real local rows",
    packet.counts.coverageRows > 0 &&
      packet.counts.pilotItems > 0 &&
      existsSync(packet.generatedEvidence.controlChannelCoverageAudit) &&
      existsSync(packet.generatedEvidence.executionPilotQueue),
    JSON.stringify(packet.counts)
  ),
  check(
    "Readiness batch runs selected real local pilots in dry-run mode only",
    packet.counts.selectedPilots > 0 &&
      packet.counts.dryRuns === packet.counts.selectedPilots &&
      packet.counts.completedControlledRoutes === 0 &&
      batch.executeRequested === false,
    JSON.stringify(packet.counts)
  ),
  check(
    "Readiness batch produces outcome verification and post-action checkpoints for dry-run pilots",
    packet.counts.outcomeVerificationCount === packet.counts.selectedPilots &&
      packet.counts.postActionCheckpointCount === packet.counts.selectedPilots &&
      packet.dryRunPilotResults.every((row) => existsSync(row.outcomeVerificationPath) && existsSync(row.postActionCheckpointPath)),
    packet.generatedEvidence.executionPilotDryRunBatch
  ),
  check(
    "Readiness batch keeps real execution native control screenshots memory rules and packaging locked",
    receipt.targetSoftwareCommandsExecuted === false &&
      receipt.nativeUniversalExecution === false &&
      receipt.allSoftwareExecutionComplete === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true &&
      receipt.locks.screenshotsCaptured === false &&
      receipt.locks.memoryWritten === false,
    JSON.stringify(receipt.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_readiness_batch_smoke_v1",
  smokeRoot,
  counts: packet.counts,
  paths: {
    packet: run.packetPath,
    receipt: run.receiptPath,
    readme: run.readmePath,
    inventory: packet.generatedEvidence.realLocalInventory,
    coverageAudit: packet.generatedEvidence.controlChannelCoverageAudit,
    pilotQueue: packet.generatedEvidence.executionPilotQueue,
    dryRunBatch: packet.generatedEvidence.executionPilotDryRunBatch
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
