#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function makeSmokeRoot(preferredRoot = "") {
  const id = String(Date.now());
  const candidates = [
    preferredRoot ? join(resolve(preferredRoot), id) : "",
    join(repoRoot, ".transparent-apprentice", "real-local-all-software-execution-pilot-queue-smoke", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "real-local-all-software-execution-pilot-queue", id)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create a real local execution pilot queue smoke directory.");
}

const smokeRoot = makeSmokeRoot(argValue("--output-dir", argValue("--out-dir", "")));

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = smokeRoot) {
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const goal =
  "Create teacher-reviewed dry-run pilot trials from real local control-channel coverage without executing target software.";

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  goal,
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
const probe = runPowerShell([
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
]);
if (probe.status !== 0 || !existsSync(inventoryPath)) {
  throw new Error(probe.stderr || probe.stdout || "real local inventory probe failed");
}

const coverage = runNodeScript("create-all-software-control-channel-coverage-audit.mjs", [
  "--goal",
  goal,
  "--inventory",
  inventoryPath,
  "--max-software",
  "8",
  "--create-profiles",
  "--output-dir",
  join(smokeRoot, "control-channel-coverage")
]);

const pilotResult = runNodeScript("create-all-software-execution-pilot-queue.mjs", [
  "--goal",
  goal,
  "--coverage-audit",
  coverage.auditPath,
  "--max-pilots",
  "4",
  "--create-adapter-packages",
  "--output-dir",
  join(smokeRoot, "execution-pilot-queue")
]);

const queue = readJson(pilotResult.queuePath);
const receipt = readJson(pilotResult.receiptPath);
const firstPilot = queue.pilots[0] || null;
const firstAdapter = firstPilot?.adapterSelectionPath ? readJson(firstPilot.adapterSelectionPath) : null;

const checks = [
  check(
    "Real local control-channel coverage feeds execution pilot queue",
    queue.format === "transparent_ai_all_software_execution_pilot_queue_v1" &&
      queue.sourceAuditPath === coverage.auditPath &&
      queue.counts.pilotItems > 0,
    `${pilotResult.queuePath}; pilots=${queue.counts.pilotItems}`
  ),
  check(
    "Pilot queue converts eligible rows into teacher-confirmed dry-run-first pilots",
    queue.pilots.every(
      (pilot) =>
        pilot.teacherConfirmationRequired === true &&
        pilot.numberedTargetRequired === true &&
        pilot.dryRunFirst === true &&
        pilot.executeModeBlockedUntilTeacherConfirmation === true &&
        pilot.blockedTransitions.includes("execute_now")
    ),
    JSON.stringify(queue.counts)
  ),
  check(
    "Pilot queue reuses existing execution adapter package generator",
    queue.counts.adapterPackagesCreated === queue.counts.pilotItems &&
      firstAdapter?.format === "transparent_ai_existing_software_execution_adapter_selection_v1" &&
      firstAdapter?.recommendedRoute?.dryRunFirst === true,
    firstPilot?.adapterPackagePath || ""
  ),
  check(
    "Pilot queue preserves blocked rows instead of claiming all-software execution",
    queue.completionBoundary.allSoftwareExecutionComplete === false &&
      queue.completionBoundary.nativeUniversalExecution === false &&
      Array.isArray(queue.blockedRows) &&
      queue.pilots.every((pilot) => pilot.requiredEvidenceBeforeExecute.length > 0),
    queue.completionBoundary.reason
  ),
  check(
    "Pilot queue keeps screenshots memory UI events target commands and packaging locked",
    receipt.format === "transparent_ai_all_software_execution_pilot_queue_receipt_v1" &&
      receipt.locks.screenshotsCaptured === false &&
      receipt.locks.uiEventsSent === false &&
      receipt.locks.softwareActionsExecuted === false &&
      receipt.locks.targetSoftwareCommandsExecuted === false &&
      receipt.locks.memoryWritten === false &&
      receipt.locks.packagingGated === true,
    pilotResult.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_execution_pilot_queue_smoke_v1",
  smokeRoot,
  counts: queue.counts,
  paths: {
    inventory: inventoryPath,
    coverageAudit: coverage.auditPath,
    queue: pilotResult.queuePath,
    receipt: pilotResult.receiptPath,
    firstAdapterSelection: firstPilot?.adapterSelectionPath || ""
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
