#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-execution-pilot-selector-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
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

const selector = runNode("create-real-local-execution-pilot-selector.mjs", [
  "--goal",
  "Smoke a teacher-numbered real local execution pilot selector.",
  "--max-processes",
  "8",
  "--max-installed",
  "8",
  "--max-software",
  "8",
  "--max-pilots",
  "2",
  "--max-candidates",
  "2",
  "--selected-number",
  "1",
  "--teacher-marker",
  "selector smoke dry run only",
  "--output-dir",
  smokeRoot
]);

const packet = readJson(selector.selectorPath);
const receipt = readJson(selector.receiptPath);
const runner = selector.runnerPath && existsSync(selector.runnerPath) ? readJson(selector.runnerPath) : null;

const checks = [
  {
    name: "Selector creates numbered real-local pilot candidates",
    pass:
      selector.format === "transparent_ai_real_local_execution_pilot_selector_result_v1" &&
      packet.format === "transparent_ai_real_local_execution_pilot_selector_v1" &&
      packet.counts.numberedCandidates > 0 &&
      packet.numberedCandidates[0].number === 1,
    evidence: `candidates=${packet.counts.numberedCandidates}`
  },
  {
    name: "Selector can advance one teacher-numbered candidate into dry-run runner evidence",
    pass:
      selector.runnerInvoked === true &&
      receipt.runnerInvoked === true &&
      Boolean(selector.runnerReceiptPath) &&
      Boolean(selector.outcomeVerificationPath) &&
      Boolean(selector.postActionCheckpointPath),
    evidence: `runner=${selector.runnerStatus}; pilot=${selector.selectedPilotId}; software=${selector.selectedSoftware}`
  },
  {
    name: "Selector keeps real execution, screenshots, memory, and universal completion locked",
    pass:
      packet.locks.accepted === false &&
      packet.locks.ruleEnabled === false &&
      packet.locks.packagingGated === true &&
      packet.locks.screenshotsCaptured === false &&
      packet.locks.fullContinuousRecording === false &&
      packet.locks.memoryWritten === false &&
      packet.locks.nativeUniversalExecution === false &&
      packet.locks.allSoftwareExecutionComplete === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true &&
      receipt.nativeUniversalExecution === false &&
      receipt.allSoftwareExecutionComplete === false,
    evidence: `accepted=${receipt.accepted}; memory=${receipt.memoryWritten}; universal=${receipt.nativeUniversalExecution}`
  },
  {
    name: "Selected dry-run runner does not claim all-software completion",
    pass:
      runner &&
      runner.format === "transparent_ai_all_software_execution_pilot_runner_v1" &&
      runner.completionBoundary?.allSoftwareExecutionComplete === false &&
      runner.completionBoundary?.nativeUniversalExecution === false &&
      runner.locks?.memoryWritten === false,
    evidence: runner ? `runnerStatus=${runner.status}; controlled=${runner.controlledRouteActionExecuted}` : "runner missing"
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_execution_pilot_selector_smoke_v1",
  passed,
  total: checks.length,
  selectorPath: selector.selectorPath,
  receiptPath: selector.receiptPath,
  runnerPath: selector.runnerPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
