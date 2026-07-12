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
  return String(value || "all-software-low-token-learning-cycle")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-low-token-learning-cycle";
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function sleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function compactText(value, max = 360) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function queueItemSelector(item) {
  return item.queueItemId || item.software || item.processName || "";
}

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-low-token-learning-cycles")));
const stateDir = resolve(argValue("--state-dir", join(process.cwd(), ".transparent-apprentice", "software-observer-watch-state")));
const state = argValue("--state", "");
const metadataStateDir = resolve(argValue("--metadata-state-dir", join(stateDir, "metadata-delta-gate")));
const metadataState = argValue("--metadata-state", "");
const metadataDeltaGateEnabled = !hasFlag("--skip-metadata-delta-gate") && argValue("--metadata-delta-gate", "true") !== "false";
const cycles = Number(argValue("--cycles", "1"));
const intervalMs = Number(argValue("--interval-ms", "0"));
const maxItems = Number(argValue("--max-items", "8"));
const maxLogsPerItem = Number(argValue("--max-logs-per-item", "4"));
const maxTailLines = Number(argValue("--max-tail-lines", "80"));
const maxTailBytes = Number(argValue("--max-tail-bytes", "65536"));
const maxSnippetChars = Number(argValue("--max-snippet-chars", "360"));
const maxLearningItems = Number(argValue("--max-learning-items", "3"));
const teacherStyle = argValue("--teacher-style", "ask_teacher_preference");
const teacherMarkers = argValues("--teacher-marker");

mkdirSync(outputRoot, { recursive: true });
mkdirSync(stateDir, { recursive: true });
if (metadataDeltaGateEnabled) mkdirSync(metadataStateDir, { recursive: true });

const queueArg = argValue("--queue", argValue("--queue-path", ""));
const inventoryArg = argValue("--inventory", argValue("--inventory-path", ""));
let queueInput = null;
let generatedQueueFromInventory = null;

if (queueArg) {
  queueInput = readJsonInput(queueArg, "--queue");
} else if (inventoryArg) {
  const inventoryInput = readJsonInput(inventoryArg, "--inventory");
  const queueResult = runNodeScript("create-software-observer-queue.mjs", [
    "--inventory",
    inventoryInput.path || JSON.stringify(inventoryInput.value),
    "--output-dir",
    join(outputRoot, "generated-observer-queues"),
    "--max-candidates",
    String(maxItems),
    "--max-files-per-candidate",
    String(maxLogsPerItem)
  ]);
  queueInput = {
    value: JSON.parse(readFileSync(queueResult.queuePath, "utf8")),
    path: queueResult.queuePath
  };
  const stableQueueId = slugify(`inventory-learning-${inventoryInput.value.inventoryId || basename(inventoryInput.path || "inline-inventory")}`);
  queueInput.value.queueId = stableQueueId;
  writeFileSync(queueResult.queuePath, JSON.stringify(queueInput.value, null, 2), "utf8");
  generatedQueueFromInventory = {
    inventoryPath: inventoryInput.path || "",
    queuePath: queueResult.queuePath,
    stableQueueId,
    queuedCount: queueResult.queuedCount,
    topSoftware: queueResult.topSoftware || [],
    fullLogsRead: false,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  };
} else {
  throw new Error("--queue or --inventory is required");
}

const queue = queueInput.value;
const queueId = queue.queueId || slugify(basename(queueInput.path || "inline-queue"));
const cycleId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(queueId)}`;
const cycleDir = join(outputRoot, cycleId);
mkdirSync(cycleDir, { recursive: true });

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  memoryEnabled: false,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const watchRuns = [];
const metadataGateRuns = [];
const changedByItem = new Map();
let tailReadSkippedByMetadataGate = 0;
let nonLogFallbackQueuePath = "";
let nonLogFallbackItems = 0;

for (let index = 0; index < Math.max(1, cycles); index += 1) {
  if (metadataDeltaGateEnabled) {
    const gateOutputDir = join(cycleDir, `metadata-delta-gate-${String(index + 1).padStart(2, "0")}`);
    const gateArgs = [
      "--queue",
      queueInput.path || JSON.stringify(queue),
      "--state-dir",
      metadataStateDir,
      "--output-dir",
      gateOutputDir,
      "--max-items",
      String(maxItems),
      "--max-logs-per-item",
      String(maxLogsPerItem)
    ];
    if (metadataState) gateArgs.push("--state", metadataState);
    for (const marker of teacherMarkers) gateArgs.push("--teacher-marker", marker);

    const result = runNodeScript("watch-log-source-metadata-deltas.mjs", gateArgs);
    const gate = JSON.parse(readFileSync(result.gatePath, "utf8"));
    const run = {
      cycleNumber: index + 1,
      gatePath: result.gatePath,
      receiptPath: result.receiptPath,
      statePath: result.statePath,
      narrowedQueuePath: result.narrowedQueuePath || "",
      nonLogFallbackQueuePath: result.nonLogFallbackQueuePath || "",
      baselineWasPresent: result.baselineWasPresent,
      status: result.status,
      scannedItems: gate.counts.scannedItems,
      scannedLogMetadata: gate.counts.scannedLogMetadata,
      changedItems: gate.counts.changedItems,
      changedLogMetadata: gate.counts.changedLogMetadata,
      narrowedQueueItems: gate.counts.narrowedQueueItems,
      nonLogFallbackItems: gate.counts.nonLogFallbackItems || 0,
      logContentsRead: false,
      fullLogsRead: false,
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      locks: gate.locks
    };
    metadataGateRuns.push(run);
    if (result.nonLogFallbackQueuePath) {
      nonLogFallbackQueuePath = result.nonLogFallbackQueuePath;
      nonLogFallbackItems += gate.counts.nonLogFallbackItems || 0;
      const fallbackQueue = JSON.parse(readFileSync(result.nonLogFallbackQueuePath, "utf8"));
      for (const item of Array.isArray(fallbackQueue.queue) ? fallbackQueue.queue : []) {
        const key = queueItemSelector(item);
        if (!key || changedByItem.has(key)) continue;
        changedByItem.set(key, {
          ...item,
          queuePath: result.nonLogFallbackQueuePath,
          metadataGatePath: result.gatePath,
          metadataGateStatus: "non_log_fallback_waiting_for_teacher_review",
          nonLogFallbackUsed: true
        });
      }
    }

    if (!result.narrowedQueuePath) {
      tailReadSkippedByMetadataGate += gate.counts.scannedLogMetadata;
      if (changedByItem.size > 0) break;
      if (index < cycles - 1) sleep(intervalMs);
      continue;
    }

    const narrowedQueue = JSON.parse(readFileSync(result.narrowedQueuePath, "utf8"));
    for (const item of Array.isArray(narrowedQueue.queue) ? narrowedQueue.queue : []) {
      const key = queueItemSelector(item);
      if (!key || changedByItem.has(key)) continue;
      changedByItem.set(key, {
        ...item,
        queuePath: result.narrowedQueuePath,
        metadataGatePath: result.gatePath,
        metadataGateStatus: result.status
      });
    }

    if (changedByItem.size > 0) break;
    if (index < cycles - 1) sleep(intervalMs);
    continue;
  }

  const watchOutputDir = join(cycleDir, `watch-cycle-${String(index + 1).padStart(2, "0")}`);
  const watchArgs = [
    "--queue",
    queueInput.path || JSON.stringify(queue),
    "--state-dir",
    stateDir,
    "--output-dir",
    watchOutputDir,
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
  if (state) watchArgs.push("--state", state);
  for (const marker of teacherMarkers) watchArgs.push("--teacher-marker", marker);

  const result = runNodeScript("run-software-observer-watch-cycle.mjs", watchArgs);
  const watchCycle = JSON.parse(readFileSync(result.watchCyclePath, "utf8"));
  const run = {
    cycleNumber: index + 1,
    watchCyclePath: result.watchCyclePath,
    receiptPath: result.receiptPath,
    statePath: result.statePath,
    baselineWasPresent: result.baselineWasPresent,
    status: result.status,
    scannedItems: result.scannedItems,
    scannedLogs: result.scannedLogs,
    changedLogs: result.changedLogs,
    screenshotRequests: result.screenshotRequests,
    changedItems: watchCycle.itemResults
      .filter((item) => item.changedLogCount > 0)
      .map((item) => ({
        queueItemId: item.queueItemId || "",
        software: item.software || "",
        processName: item.processName || "",
        changedLogCount: item.changedLogCount,
        screenshotRecommended: item.screenshotRecommended === true,
        classifications: item.logDeltas
          .filter((delta) => ["changed", "new_log_seen"].includes(delta.status))
          .map((delta) => delta.classification)
      })),
    locks: watchCycle.locks
  };
  watchRuns.push(run);

  for (const item of watchCycle.itemResults.filter((entry) => entry.changedLogCount > 0)) {
    const key = queueItemSelector(item);
    if (!key || changedByItem.has(key)) continue;
    changedByItem.set(key, { ...item, queuePath: queueInput.path || "" });
  }

  if (changedByItem.size > 0) break;
  if (index < cycles - 1) sleep(intervalMs);
}

const selectedChangedItems = [...changedByItem.values()].slice(0, Math.max(0, maxLearningItems));
const learningRuns = selectedChangedItems.map((item) => {
  const itemQueuePath = item.queuePath || queueInput.path || JSON.stringify(queue);
  const args = [
    "--queue",
    itemQueuePath,
    "--item",
    queueItemSelector(item),
    "--teacher-style",
    teacherStyle,
    "--max-tail-lines",
    String(maxTailLines),
    "--max-tail-bytes",
    String(maxTailBytes),
    "--max-snippet-chars",
    String(maxSnippetChars),
    "--output-dir",
    join(cycleDir, "learning-events")
  ];
  for (const marker of teacherMarkers) args.push("--teacher-marker", marker);
  const result = runNodeScript("run-software-observer-queue-item.mjs", args);
  const packet = JSON.parse(readFileSync(result.compactLearningEventsPath, "utf8"));
  return {
    queueItemId: result.queueItemId || item.queueItemId || "",
    software: result.software || item.software || "",
    sourceQueuePath: itemQueuePath,
    metadataGatePath: item.metadataGatePath || "",
    metadataGateStatus: item.metadataGateStatus || "",
    nonLogFallbackUsed: item.nonLogFallbackUsed === true,
    observationPath: result.observationPath,
    compactLearningEventsPath: result.compactLearningEventsPath,
    receiptPath: result.receiptPath,
    compactEventCount: result.compactEventCount,
    status: result.status,
    classifications: (packet.compactLearningEvents || []).map((event) => event.classification),
    reviewPrompt: packet.teacherAdaptation?.askNext || "",
    fullContinuousRecording: result.fullContinuousRecording === true,
    screenshotsCaptured: result.screenshotsCaptured === true,
    rawFullLogsRetained: result.rawFullLogsRetained === true,
    nativeUniversalExecution: result.nativeUniversalExecution === true
  };
});

const changedLogCount = watchRuns.reduce((sum, run) => sum + run.changedLogs, 0);
const changedLogMetadataCount = metadataGateRuns.reduce((sum, run) => sum + run.changedLogMetadata, 0);
const compactEventCount = learningRuns.reduce((sum, run) => sum + (run.compactEventCount || 0), 0);
const status = learningRuns.length > 0
  ? "learning_events_waiting_for_teacher_review"
  : metadataGateRuns.some((run) => run.baselineWasPresent === false) || watchRuns.some((run) => run.baselineWasPresent === false)
    ? "baseline_initialized_waiting_for_next_cycle"
    : metadataDeltaGateEnabled && metadataGateRuns.length > 0
      ? "no_metadata_delta_skip_tail_waiting_for_next_cycle"
    : "no_meaningful_delta_detected_waiting_for_next_cycle";

const learningCyclePath = join(cycleDir, "all-software-low-token-learning-cycle.json");
const receiptPath = join(cycleDir, "all-software-low-token-learning-cycle-receipt.json");
const readmePath = join(cycleDir, "ALL_SOFTWARE_LOW_TOKEN_LEARNING_CYCLE_START_HERE.md");

const learningCycle = {
  format: "transparent_ai_all_software_low_token_learning_cycle_v1",
  cycleId,
  queueId,
  queuePath: queueInput.path || "",
  createdAt: new Date().toISOString(),
  status,
  lowTokenStrategy:
    metadataDeltaGateEnabled
      ? "Run a metadata-only log source delta gate first; skip tail reads when size/mtime/existence are unchanged, and read bounded tails only for narrowed changed logs before creating compact teacher-review learning events."
      : "Run persisted metadata/tail-hash watch cycles first; only changed reviewed queue items are converted into compact learning events for teacher review.",
  limits: {
    maxItems,
    maxLogsPerItem,
    maxTailLines,
    maxTailBytes,
    maxSnippetChars,
    maxLearningItems,
    metadataDeltaGateEnabled,
    fullLogsRead: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    longTermMemoryWritten: false,
    softwareActionsExecuted: false
  },
  counts: {
    metadataGateRuns: metadataGateRuns.length,
    metadataScannedLogMetadata: metadataGateRuns.reduce((sum, run) => sum + run.scannedLogMetadata, 0),
    metadataChangedLogMetadata: changedLogMetadataCount,
    nonLogFallbackItems,
    tailReadSkippedByMetadataGate,
    watchCyclesRun: watchRuns.length,
    scannedItems: watchRuns.reduce((sum, run) => sum + run.scannedItems, 0),
    scannedLogs: watchRuns.reduce((sum, run) => sum + run.scannedLogs, 0),
    changedLogs: changedLogCount + changedLogMetadataCount,
    changedItems: changedByItem.size,
    processedLearningItems: learningRuns.length,
    compactLearningEvents: compactEventCount,
    screenshotRequests: watchRuns.reduce((sum, run) => sum + run.screenshotRequests, 0)
  },
  metadataGateRuns,
  nonLogFallbackQueuePath,
  watchRuns,
  learningRuns,
  generatedQueueFromInventory,
  teacherReviewCard: {
    title: "All-software low-token learning cycle review",
    status,
    summary:
      learningRuns.length > 0
        ? `${learningRuns.length} changed software item(s) were converted into ${compactEventCount} compact learning event(s).`
        : metadataDeltaGateEnabled
          ? "No compact learning event was created yet; the metadata gate either initialized a baseline, skipped unchanged logs, or found no non-log fallback item."
          : "No compact learning event was created yet; the cycle either initialized a baseline or found no meaningful delta.",
    reviewQuestions: [
      "Which changed signal is the actual reusable teaching signal?",
      "Is the signal success, warning, failure, or normal progress?",
      "What counterexample should prevent this from becoming an overbroad rule?",
      "Should a bounded screenshot be requested for only this changed item?"
    ],
    nextTeachingCall:
      learningRuns.length > 0
        ? {
            tool: "teach_apprentice",
            arguments: {
              goal: "Review compact all-software low-token learning events.",
              message: `Use this learning-cycle receipt and compact event packets for teacher review: ${receiptPath}`
            }
          }
        : null
  },
  locks
};

const receipt = {
  format: "transparent_ai_all_software_low_token_learning_cycle_receipt_v1",
  cycleId,
  status,
  learningCyclePath,
  counts: learningCycle.counts,
  learningEventPackets: learningRuns.map((run) => run.compactLearningEventsPath),
  metadataGatePackets: metadataGateRuns.map((run) => run.gatePath),
  nonLogFallbackQueuePath,
  watchCyclePackets: watchRuns.map((run) => run.watchCyclePath),
  metadataDeltaGateEnabled,
  tailReadSkippedByMetadataGate,
  generatedQueueFromInventory,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true,
  locks
};

writeFileSync(learningCyclePath, JSON.stringify(learningCycle, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
writeFileSync(readmePath, [
  "# All-Software Low-Token Learning Cycle",
  "",
  "This cycle is the low-token bridge between all-software watch cycles and teacher-reviewable learning events.",
  "",
  `Queue: ${queueInput.path || "inline JSON"}`,
  generatedQueueFromInventory ? `Generated queue from inventory: ${generatedQueueFromInventory.queuePath}` : "",
  `Status: ${status}`,
  `Watch cycles: ${learningCycle.counts.watchCyclesRun}`,
  `Changed items: ${learningCycle.counts.changedItems}`,
  `Non-log fallback items: ${learningCycle.counts.nonLogFallbackItems}`,
  `Compact learning events: ${learningCycle.counts.compactLearningEvents}`,
  "",
  "Default behavior:",
  "",
  "- Read only bounded log tails from reviewed queue items.",
  "- Default to metadata-only log source checks before any bounded tail read.",
  "- Skip tail reads when log existence, size, and mtime did not change.",
  "- If no candidate logs exist, route the selected software through Windows events, process/window metadata, file deltas, and teacher markers before screenshots.",
  "- Persist baselines and learn only from later deltas.",
  "- Convert only changed items into compact learning packets.",
  "- Keep screenshots trigger-only and not captured by default.",
  "- Do not execute software, save memory, enable rules, or unlock packaging.",
  "",
  "Next: review `all-software-low-token-learning-cycle.json`, then choose which compact event is the reusable teacher signal."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_all_software_low_token_learning_cycle_result_v1",
  cycleId,
  cycleDir,
  learningCyclePath,
  receiptPath,
  teacherReadme: readmePath,
  status,
  generatedQueueFromInventory,
  watchCyclesRun: learningCycle.counts.watchCyclesRun,
  metadataDeltaGateEnabled,
  metadataGateRuns: learningCycle.counts.metadataGateRuns,
  tailReadSkippedByMetadataGate,
  changedItems: learningCycle.counts.changedItems,
  changedLogs: learningCycle.counts.changedLogs,
  processedLearningItems: learningCycle.counts.processedLearningItems,
  compactLearningEvents: learningCycle.counts.compactLearningEvents,
  nonLogFallbackItems: learningCycle.counts.nonLogFallbackItems,
  screenshotRequests: learningCycle.counts.screenshotRequests,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false
}, null, 2));
