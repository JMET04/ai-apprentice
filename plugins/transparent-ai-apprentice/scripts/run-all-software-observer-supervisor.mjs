#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "all-software-observer-supervisor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-observer-supervisor";
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function sleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runWatchCycle(args) {
  const result = spawnSync(process.execPath, [join(__dirname, "run-software-observer-watch-cycle.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "run-software-observer-watch-cycle.mjs failed");
  }
  return JSON.parse(result.stdout);
}

const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-observer-supervisors")));
const cycles = Number(argValue("--cycles", "3"));
const intervalMs = Number(argValue("--interval-ms", "0"));
const maxRuntimeMs = Number(argValue("--max-runtime-ms", "120000"));
const maxItems = Number(argValue("--max-items", "8"));
const maxLogsPerItem = Number(argValue("--max-logs-per-item", "4"));
const maxTailLines = Number(argValue("--max-tail-lines", "80"));
const maxTailBytes = Number(argValue("--max-tail-bytes", "65536"));
const maxSnippetChars = Number(argValue("--max-snippet-chars", "360"));
const teacherMarkers = argValues("--teacher-marker");
const continueAfterChange = hasFlag("--continue-after-change");
const stopOnChange = !continueAfterChange;
const queueId = queueInput.value.queueId || slugify(basename(queueInput.path || "inline-queue"));
const stateDir = resolve(argValue("--state-dir", join(process.cwd(), ".transparent-apprentice", "software-observer-watch-state")));
const state = argValue("--state", "");

mkdirSync(outputRoot, { recursive: true });
mkdirSync(stateDir, { recursive: true });
const supervisorId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(queueId)}`;
const supervisorDir = join(outputRoot, supervisorId);
mkdirSync(supervisorDir, { recursive: true });

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const startedAt = Date.now();
const cycleRuns = [];
let stopReason = "";

for (let index = 0; index < Math.max(1, cycles); index += 1) {
  if (Date.now() - startedAt > maxRuntimeMs) {
    stopReason = "max_runtime_reached";
    break;
  }

  const cycleOutputDir = join(supervisorDir, `cycle-${String(index + 1).padStart(2, "0")}`);
  const args = [
    "--queue",
    queueInput.path || JSON.stringify(queueInput.value),
    "--state-dir",
    stateDir,
    "--output-dir",
    cycleOutputDir,
    "--max-items",
    String(maxItems),
    "--max-logs-per-item",
    String(maxLogsPerItem),
    "--max-tail-lines",
    String(maxTailLines),
    "--max-tail-bytes",
    String(maxTailBytes),
    "--max-snippet-chars",
    String(maxSnippetChars)
  ];
  if (state) args.push("--state", state);
  for (const marker of teacherMarkers) args.push("--teacher-marker", marker);

  const result = runWatchCycle(args);
  const watchCycle = JSON.parse(readFileSync(result.watchCyclePath, "utf8"));
  const cycle = {
    cycleNumber: index + 1,
    status: result.status,
    watchCyclePath: result.watchCyclePath,
    receiptPath: result.receiptPath,
    statePath: result.statePath,
    baselineWasPresent: result.baselineWasPresent,
    scannedItems: result.scannedItems,
    scannedLogs: result.scannedLogs,
    changedLogs: result.changedLogs,
    screenshotRequests: result.screenshotRequests,
    changedItems: watchCycle.counts.changedItems,
    nextTeachingCall: watchCycle.nextTeachingCall,
    locks: watchCycle.locks
  };
  cycleRuns.push(cycle);

  if (stopOnChange && (cycle.changedLogs > 0 || cycle.screenshotRequests > 0)) {
    stopReason = "meaningful_delta_detected_waiting_for_teacher_review";
    break;
  }
  if (index < cycles - 1) sleep(intervalMs);
}

if (!stopReason) {
  stopReason = cycleRuns.length >= cycles ? "planned_cycles_completed" : "stopped_without_cycle";
}

const changedCycles = cycleRuns.filter((cycle) => cycle.changedLogs > 0 || cycle.screenshotRequests > 0);
const supervisorPath = join(supervisorDir, "all-software-observer-supervisor.json");
const receiptPath = join(supervisorDir, "all-software-observer-supervisor-receipt.json");
const readmePath = join(supervisorDir, "ALL_SOFTWARE_OBSERVER_SUPERVISOR_START_HERE.md");

const supervisor = {
  format: "transparent_ai_all_software_observer_supervisor_v1",
  supervisorId,
  queueId,
  queuePath: queueInput.path || "",
  createdAt: new Date(startedAt).toISOString(),
  completedAt: new Date().toISOString(),
  status: changedCycles.length > 0 ? "waiting_for_teacher_delta_review" : "no_meaningful_delta_detected",
  stopReason,
  lowTokenStrategy:
    "Run bounded watch cycles over reviewed software queue items, persist baselines, stop on meaningful deltas, and request screenshots only after cheap signals are not enough.",
  schedulePolicy: {
    cyclesRequested: cycles,
    cyclesRun: cycleRuns.length,
    intervalMs,
    maxRuntimeMs,
    stopOnChange,
    boundedPeriodicRun: true,
    backgroundTaskInstalled: false,
    continuousRecording: false
  },
  limits: {
    maxItems,
    maxLogsPerItem,
    maxTailLines,
    maxTailBytes,
    maxSnippetChars,
    fullLogsRead: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false
  },
  counts: {
    cyclesRun: cycleRuns.length,
    changedCycles: changedCycles.length,
    scannedItems: cycleRuns.reduce((sum, cycle) => sum + cycle.scannedItems, 0),
    scannedLogs: cycleRuns.reduce((sum, cycle) => sum + cycle.scannedLogs, 0),
    changedLogs: cycleRuns.reduce((sum, cycle) => sum + cycle.changedLogs, 0),
    screenshotRequests: cycleRuns.reduce((sum, cycle) => sum + cycle.screenshotRequests, 0)
  },
  cycleRuns,
  nextTeacherAction:
    changedCycles.length > 0
      ? "Review the changed watch-cycle packets, decide whether one bounded screenshot is needed, then teach only the reusable signal."
      : "No meaningful delta was detected; run another bounded supervisor pass later or adjust the teacher markers/software queue.",
  nextTeachingCall:
    changedCycles.length > 0
      ? {
          tool: "teach_apprentice",
          arguments: {
            goal: "Teach from bounded multi-software supervisor delta evidence.",
            message: `Use this supervisor receipt and changed watch-cycle packets for review: ${receiptPath}`
          }
        }
      : null,
  locks
};

const receipt = {
  format: "transparent_ai_all_software_observer_supervisor_receipt_v1",
  supervisorId,
  status: supervisor.status,
  stopReason,
  supervisorPath,
  cyclesRun: supervisor.counts.cyclesRun,
  changedLogs: supervisor.counts.changedLogs,
  screenshotRequests: supervisor.counts.screenshotRequests,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  backgroundTaskInstalled: false,
  teacherConfirmationRequired: true,
  locks
};

writeFileSync(supervisorPath, JSON.stringify(supervisor, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
writeFileSync(readmePath, [
  "# All Software Observer Supervisor",
  "",
  "This bounded supervisor runs repeated low-token watch cycles over a reviewed software observer queue.",
  "",
  `Queue: ${queueInput.path || "inline JSON"}`,
  `Cycles run: ${supervisor.counts.cyclesRun}`,
  `Changed logs: ${supervisor.counts.changedLogs}`,
  `Screenshot requests: ${supervisor.counts.screenshotRequests}`,
  `Stop reason: ${stopReason}`,
  "",
  "It does not install a background service, read full logs, capture screenshots, continuously record, enable memory, or claim native universal execution.",
  "",
  "Next: review `all-software-observer-supervisor.json` and `all-software-observer-supervisor-receipt.json`; teach only after the teacher confirms the changed signal is reusable."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_all_software_observer_supervisor_result_v1",
  supervisorId,
  supervisorDir,
  supervisorPath,
  receiptPath,
  readme: readmePath,
  status: supervisor.status,
  stopReason,
  cyclesRun: supervisor.counts.cyclesRun,
  changedLogs: supervisor.counts.changedLogs,
  screenshotRequests: supervisor.counts.screenshotRequests,
  nextTeachingCall: supervisor.nextTeachingCall,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  backgroundTaskInstalled: false,
  locks
}, null, 2));
