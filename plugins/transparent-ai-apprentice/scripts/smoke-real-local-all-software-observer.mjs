#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const outputRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-observer-smoke", String(Date.now()));
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
  "Real local all-software low-token observer proof.",
  "--max-processes",
  "8",
  "--max-installed",
  "12",
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
const realQueue = probeInventory
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
      join(outputRoot, "real-queue")
    ])
  : null;
const realQueueJson = realQueue ? readJson(realQueue.queuePath) : null;
const realBaseline = realQueue
  ? runNodeScript("run-software-observer-watch-cycle.mjs", [
      "--queue",
      realQueue.queuePath,
      "--state-dir",
      join(outputRoot, "real-watch-state"),
      "--output-dir",
      join(outputRoot, "real-watch-cycle"),
      "--max-items",
      "3",
      "--max-logs-per-item",
      "1",
      "--max-tail-bytes",
      "512",
      "--max-tail-lines",
      "12"
    ])
  : null;
const realBaselineJson = realBaseline ? readJson(realBaseline.watchCyclePath) : null;

const firstCandidate = Array.isArray(probeInventory?.softwareCandidates) && probeInventory.softwareCandidates.length > 0
  ? probeInventory.softwareCandidates[0]
  : { software: "real-local-candidate", processName: "unknown" };
const controlledLogPath = join(outputRoot, "controlled-real-candidate.log");
writeFileSync(controlledLogPath, "startup complete\n", "utf8");
const controlledQueuePath = join(outputRoot, "controlled-real-candidate-queue.json");
writeFileSync(controlledQueuePath, JSON.stringify({
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "real-local-controlled-delta",
  queue: [
    {
      queueItemId: "real-local-controlled-candidate",
      software: firstCandidate.software || "real-local-candidate",
      processName: firstCandidate.processName || "",
      windowTitle: firstCandidate.windowTitle || "",
      score: 0.91,
      recentLogCandidates: [{ path: controlledLogPath, source: "controlled_real_local_delta_log" }]
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
}, null, 2), "utf8");

const controlledStateDir = join(outputRoot, "controlled-watch-state");
const controlledFirst = runNodeScript("run-software-observer-watch-cycle.mjs", [
  "--queue",
  controlledQueuePath,
  "--state-dir",
  controlledStateDir,
  "--output-dir",
  join(outputRoot, "controlled-first"),
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12"
]);
appendFileSync(controlledLogPath, "ERROR teacher-reviewed export failed after app state changed\n", "utf8");
const controlledSecond = runNodeScript("run-software-observer-watch-cycle.mjs", [
  "--queue",
  controlledQueuePath,
  "--state-dir",
  controlledStateDir,
  "--output-dir",
  join(outputRoot, "controlled-second"),
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12"
]);
const controlledSecondJson = readJson(controlledSecond.watchCyclePath);

const checks = [
  {
    name: "Real local inventory probe runs with small limits",
    pass:
      probe.status === 0 &&
      probeInventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      probeInventory?.source === "read_only_local_probe" &&
      Array.isArray(probeInventory?.softwareCandidates) &&
      probeInventory.softwareCandidates.length > 0,
    evidence: `status=${probe.status}; candidates=${probeInventory?.softwareCandidates?.length ?? 0}; path=${probeInventoryPath}`
  },
  {
    name: "Real local inventory keeps log reading, screenshots, recording, and native execution locked",
    pass:
      probeInventory?.discoveryScope?.logContentsRead === false &&
      probeInventory?.discoveryScope?.fullContinuousRecording === false &&
      probeInventory?.discoveryScope?.nativeUniversalExecution === false &&
      probeInventory?.logSourceIndex?.fullLogsRead === false &&
      probeInventory?.locks?.packagingGated === true,
    evidence: JSON.stringify({
      discoveryScope: probeInventory?.discoveryScope,
      locks: probeInventory?.locks
    })
  },
  {
    name: "Real local inventory turns into a reviewed observer queue",
    pass:
      realQueue?.format === "transparent_ai_software_observer_queue_result_v1" &&
      realQueueJson?.format === "transparent_ai_software_observer_queue_v1" &&
      realQueueJson?.boundedScan?.fullLogsRead === false &&
      realQueueJson?.boundedScan?.screenshotsCaptured === false &&
      realQueueJson?.boundedScan?.fullContinuousRecording === false &&
      Array.isArray(realQueueJson?.queue) &&
      realQueueJson.queue.length > 0,
    evidence: realQueue?.queuePath || ""
  },
  {
    name: "Real local queue can initialize a low-token watch baseline",
    pass:
      realBaseline?.format === "transparent_ai_software_observer_watch_cycle_result_v1" &&
      realBaselineJson?.format === "transparent_ai_software_observer_watch_cycle_v1" &&
      realBaselineJson?.limits?.fullLogsRead === false &&
      realBaselineJson?.limits?.screenshotsCaptured === false &&
      realBaselineJson?.limits?.fullContinuousRecording === false &&
      realBaselineJson?.locks?.nativeUniversalExecution === false,
    evidence: realBaseline?.watchCyclePath || ""
  },
  {
    name: "Controlled real-candidate delta proves screenshot is trigger-only after a changed signal",
    pass:
      controlledFirst.status === "baseline_initialized_waiting_for_next_cycle" &&
      controlledSecond.status === "waiting_for_teacher_delta_review" &&
      controlledSecondJson.counts.changedLogs === 1 &&
      controlledSecondJson.counts.screenshotRequests === 1 &&
      controlledSecondJson.screenshotRequests[0]?.captureOnlyAfterReview === true &&
      controlledSecondJson.locks.screenshotsCaptured === false,
    evidence: JSON.stringify(controlledSecondJson.screenshotRequests)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_observer_smoke_v1",
  outputRoot,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
