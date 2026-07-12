#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-triggered-visual-check-smoke", String(Date.now()));
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

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Find a real local software candidate for triggered visual check smoke.",
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
const inventoryProbe = runPowerShell([
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
]);
const inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
const candidate = Array.isArray(inventory?.softwareCandidates) && inventory.softwareCandidates.length > 0
  ? inventory.softwareCandidates.find((row) => row.windowTitle || row.processName) || inventory.softwareCandidates[0]
  : null;
if (!candidate) throw new Error("Real local inventory returned no software candidates.");

const software = String(candidate.software || candidate.processName || "real local software");
const processName = String(candidate.processName || "");
const windowTitle = String(candidate.windowTitle || "");
const controlledLogPath = join(smokeRoot, "teacher-reviewed-controlled-real-local-candidate.log");
writeFileSync(controlledLogPath, "baseline: teacher reviewed controlled metadata source\n", "utf8");

const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "real-local-triggered-visual-check-queue",
  sourceInventoryPath: inventoryPath,
  note:
    "This queue binds a controlled teacher-reviewed log metadata source to a real local software candidate so the smoke can prove trigger behavior without reading or mutating real software logs.",
  queue: [
    {
      queueItemId: `real-local-${software.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "software"}`,
      software,
      processName,
      windowTitle,
      score: 0.99,
      realLocalCandidate: true,
      candidateEvidence: {
        inventoryPath,
        source: "read_only_real_local_inventory_probe",
        originalCandidateSoftware: candidate.software || "",
        originalCandidateProcessName: candidate.processName || ""
      },
      recentLogCandidates: [
        {
          path: controlledLogPath,
          source: "teacher_reviewed_controlled_log_metadata_for_real_local_candidate"
        }
      ],
      lowTokenSignals: ["log metadata delta", "teacher marker", "triggered screenshot only after review"],
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        fullContinuousRecording: false,
        nativeUniversalExecution: false
      }
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
};
const queuePath = join(smokeRoot, "real-local-triggered-visual-check-queue.json");
writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
const stateDir = join(smokeRoot, "metadata-state");

const baseline = runNodeScript("watch-log-source-metadata-deltas.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "baseline"),
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1"
]);

const unchanged = runNodeScript("watch-log-source-metadata-deltas.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "unchanged"),
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1"
]);

const noVisual = runNodeScript("create-triggered-visual-check-request.mjs", [
  "--metadata-gate",
  unchanged.gatePath,
  "--software",
  software,
  "--target-window-title",
  windowTitle,
  "--output-dir",
  join(smokeRoot, "no-change-visual-request")
]);
const noVisualPacket = readJson(noVisual.packetPath);

appendFileSync(controlledLogPath, "changed: teacher worked and low-token metadata changed\n", "utf8");
const changed = runNodeScript("watch-log-source-metadata-deltas.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "changed"),
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1"
]);
const changedGate = readJson(changed.gatePath);
const narrowedQueue = readJson(changed.narrowedQueuePath);

const defaultAfterChange = runNodeScript("create-triggered-visual-check-request.mjs", [
  "--metadata-gate",
  changed.gatePath,
  "--software",
  software,
  "--target-window-title",
  windowTitle,
  "--output-dir",
  join(smokeRoot, "changed-default-visual-request")
]);
const defaultAfterChangePacket = readJson(defaultAfterChange.packetPath);

const teacherRequested = runNodeScript("create-triggered-visual-check-request.mjs", [
  "--metadata-gate",
  changed.gatePath,
  "--software",
  software,
  "--target-window-title",
  windowTitle,
  "--teacher-marker",
  "teacher marker: metadata changed and the result is visually ambiguous, request one bounded screenshot after review",
  "--allow-metadata-screenshot-request",
  "--max-requests",
  "1",
  "--output-dir",
  join(smokeRoot, "teacher-requested-visual-request")
]);
const teacherRequestedPacket = readJson(teacherRequested.packetPath);

const checks = [
  {
    name: "Real local software candidate is selected before metadata-triggered visual check",
    pass:
      inventoryProbe.status === 0 &&
      inventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      queue.queue[0].realLocalCandidate === true &&
      Boolean(software),
    evidence: `software=${software}; inventory=${inventoryPath}`
  },
  {
    name: "Metadata baseline and unchanged pass skip tail reads and screenshots",
    pass:
      baseline.status === "baseline_initialized_waiting_for_metadata_delta" &&
      baseline.logContentsRead === false &&
      baseline.screenshotsCaptured === false &&
      unchanged.status === "no_metadata_delta_skip_tail" &&
      unchanged.changedLogMetadata === 0 &&
      unchanged.logContentsRead === false &&
      unchanged.screenshotsCaptured === false &&
      noVisualPacket.requestCount === 0 &&
      noVisualPacket.status === "no_visual_check_needed_from_current_low_token_evidence",
    evidence: `${baseline.gatePath}; ${unchanged.gatePath}; ${noVisual.packetPath}`
  },
  {
    name: "Changed metadata narrows the real local queue before any screenshot",
    pass:
      changed.status === "metadata_delta_waiting_for_tail_review" &&
      changed.changedLogMetadata === 1 &&
      changed.logContentsRead === false &&
      changed.screenshotsCaptured === false &&
      changedGate.counts.changedLogMetadata === 1 &&
      narrowedQueue.queue.length === 1 &&
      narrowedQueue.queue[0].software === software,
    evidence: `${changed.gatePath}; ${changed.narrowedQueuePath}`
  },
  {
    name: "Changed metadata still prefers bounded-tail review before screenshots by default",
    pass:
      defaultAfterChangePacket.requestCount === 0 &&
      defaultAfterChangePacket.status === "no_visual_check_needed_from_current_low_token_evidence" &&
      defaultAfterChangePacket.skippedReason.includes("bounded-tail") &&
      defaultAfterChangePacket.locks.screenshotsCaptured === false,
    evidence: defaultAfterChange.packetPath
  },
  {
    name: "Teacher marker can request exactly one bounded visual check after metadata change",
    pass:
      teacherRequestedPacket.format === "transparent_ai_triggered_visual_check_request_v1" &&
      teacherRequestedPacket.requestCount === 1 &&
      teacherRequestedPacket.requests[0].source === "log_source_metadata_delta_gate" &&
      teacherRequestedPacket.requests[0].software === software &&
      teacherRequestedPacket.requests[0].captureOnlyAfterReview === true &&
      teacherRequestedPacket.requests[0].maxScreenshots === 1 &&
      teacherRequestedPacket.requests[0].triggerEvidence.tailReadRecommendedFirst === true,
    evidence: teacherRequested.packetPath
  },
  {
    name: "Real local triggered visual check keeps recording, screenshots, execution, memory, and packaging locked",
    pass:
      teacherRequestedPacket.locks.screenshotsCaptured === false &&
      teacherRequestedPacket.locks.fullContinuousRecording === false &&
      teacherRequestedPacket.locks.softwareActionsExecuted === false &&
      teacherRequestedPacket.locks.nativeUniversalExecution === false &&
      teacherRequestedPacket.locks.accepted === false &&
      teacherRequestedPacket.locks.ruleEnabled === false &&
      teacherRequestedPacket.locks.packagingGated === true,
    evidence: JSON.stringify(teacherRequestedPacket.locks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_triggered_visual_check_smoke_v1",
  smokeRoot,
  realLocalSoftware: { software, processName, windowTitle },
  paths: {
    inventory: inventoryPath,
    queue: queuePath,
    baselineGate: baseline.gatePath,
    unchangedGate: unchanged.gatePath,
    changedGate: changed.gatePath,
    narrowedQueue: changed.narrowedQueuePath,
    teacherRequestedVisualCheck: teacherRequested.packetPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
