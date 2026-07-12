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
  return String(value || "automatic-low-token-learning-runner")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "automatic-low-token-learning-runner";
}

function readJsonInput(value, label) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) {
    return {
      value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")),
      path: resolve(trimmed)
    };
  }
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
    encoding: "utf8",
    timeout: Math.max(120000, Number(argValue("--child-timeout-ms", "120000")))
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function stableInputPath(input, outputDir, name) {
  if (!input) return "";
  if (input.path) return input.path;
  const path = join(outputDir, name);
  writeFileSync(path, `${JSON.stringify(input.value, null, 2)}\n`, "utf8");
  return path;
}

const goal = argValue("--goal", "Automatically learn from reviewed all-software log deltas with a low token budget.");
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const inventoryInput = readJsonInput(argValue("--inventory", argValue("--inventory-path", "")), "--inventory");
if (!queueInput && !inventoryInput) throw new Error("--queue or --inventory is required");

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "automatic-low-token-learning-runs")));
mkdirSync(outputRoot, { recursive: true });
const runnerId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const runnerDir = join(outputRoot, runnerId);
mkdirSync(runnerDir, { recursive: true });

const queuePath = stableInputPath(queueInput, runnerDir, "reviewed-software-observer-queue.json");
const inventoryPath = stableInputPath(inventoryInput, runnerDir, "reviewed-software-observer-inventory.json");
const stateDir = resolve(argValue("--state-dir", join(runnerDir, "persistent-state")));
const cycleOutputRoot = resolve(argValue("--cycle-output-dir", join(runnerDir, "learning-cycles")));
mkdirSync(stateDir, { recursive: true });
mkdirSync(cycleOutputRoot, { recursive: true });

const runs = Math.max(1, Number(argValue("--runs", argValue("--cycles", "2"))));
const intervalMs = Math.max(0, Number(argValue("--interval-ms", "0")));
const maxItems = Math.max(1, Number(argValue("--max-items", "8")));
const maxLogsPerItem = Math.max(1, Number(argValue("--max-logs-per-item", "4")));
const maxTailLines = Math.max(1, Number(argValue("--max-tail-lines", "80")));
const maxTailBytes = Math.max(256, Number(argValue("--max-tail-bytes", "65536")));
const maxSnippetChars = Math.max(80, Number(argValue("--max-snippet-chars", "360")));
const maxLearningItems = Math.max(1, Number(argValue("--max-learning-items", "3")));
const teacherStyle = argValue("--teacher-style", "ask_teacher_preference");
const teacherMarkers = argValues("--teacher-marker");
const stopAfterLearningEvents = !hasFlag("--continue-after-learning-events");

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  memoryEnabled: false,
  longTermMemoryWritten: false,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  teacherReviewRequiredBeforeMemory: true
};

const runRecords = [];
for (let index = 0; index < runs; index += 1) {
  const cycleDir = join(cycleOutputRoot, `cycle-${String(index + 1).padStart(2, "0")}`);
  const args = [
    "--state-dir",
    stateDir,
    "--metadata-state-dir",
    join(stateDir, "metadata-delta-gate"),
    "--output-dir",
    cycleDir,
    "--cycles",
    "1",
    "--max-items",
    String(maxItems),
    "--max-logs-per-item",
    String(maxLogsPerItem),
    "--max-tail-lines",
    String(maxTailLines),
    "--max-tail-bytes",
    String(maxTailBytes),
    "--max-snippet-chars",
    String(maxSnippetChars),
    "--max-learning-items",
    String(maxLearningItems),
    "--teacher-style",
    teacherStyle
  ];
  if (queuePath) args.unshift("--queue", queuePath);
  else args.unshift("--inventory", inventoryPath);
  for (const marker of teacherMarkers) args.push("--teacher-marker", marker);

  const result = runNodeScript("run-all-software-low-token-learning-cycle.mjs", args);
  const cycle = JSON.parse(readFileSync(result.learningCyclePath, "utf8").replace(/^\uFEFF/, ""));
  const receipt = JSON.parse(readFileSync(result.receiptPath, "utf8").replace(/^\uFEFF/, ""));
  const record = {
    runNumber: index + 1,
    status: result.status,
    learningCyclePath: result.learningCyclePath,
    receiptPath: result.receiptPath,
    metadataGateRuns: result.metadataGateRuns,
    tailReadSkippedByMetadataGate: result.tailReadSkippedByMetadataGate,
    changedItems: result.changedItems,
    changedLogs: result.changedLogs,
    processedLearningItems: result.processedLearningItems,
    compactLearningEvents: result.compactLearningEvents,
    nonLogFallbackItems: result.nonLogFallbackItems,
    screenshotRequests: result.screenshotRequests,
    longTermMemoryWritten: receipt.longTermMemoryWritten === true,
    fullContinuousRecording: receipt.fullContinuousRecording === true,
    screenshotsCaptured: receipt.screenshotsCaptured === true,
    rawFullLogsRetained: receipt.rawFullLogsRetained === true,
    nativeUniversalExecution: receipt.nativeUniversalExecution === true,
    nextTeachingCall: cycle.teacherReviewCard?.nextTeachingCall ?? null
  };
  runRecords.push(record);
  if (stopAfterLearningEvents && record.compactLearningEvents > 0) break;
  if (index < runs - 1) sleep(intervalMs);
}

const totals = runRecords.reduce(
  (acc, record) => ({
    metadataGateRuns: acc.metadataGateRuns + (record.metadataGateRuns || 0),
    tailReadSkippedByMetadataGate: acc.tailReadSkippedByMetadataGate + (record.tailReadSkippedByMetadataGate || 0),
    changedItems: acc.changedItems + (record.changedItems || 0),
    changedLogs: acc.changedLogs + (record.changedLogs || 0),
    processedLearningItems: acc.processedLearningItems + (record.processedLearningItems || 0),
    compactLearningEvents: acc.compactLearningEvents + (record.compactLearningEvents || 0),
    nonLogFallbackItems: acc.nonLogFallbackItems + (record.nonLogFallbackItems || 0),
    screenshotRequests: acc.screenshotRequests + (record.screenshotRequests || 0)
  }),
  {
    metadataGateRuns: 0,
    tailReadSkippedByMetadataGate: 0,
    changedItems: 0,
    changedLogs: 0,
    processedLearningItems: 0,
    compactLearningEvents: 0,
    nonLogFallbackItems: 0,
    screenshotRequests: 0
  }
);

const status = totals.compactLearningEvents > 0
  ? "learning_events_waiting_for_teacher_review"
  : runRecords.some((record) => record.status === "baseline_initialized_waiting_for_next_cycle")
    ? "baseline_initialized_waiting_for_next_automatic_run"
    : "no_metadata_delta_skip_tail_waiting_for_next_automatic_run";

const journalPath = join(runnerDir, "automatic-low-token-learning-runner.json");
const receiptPath = join(runnerDir, "automatic-low-token-learning-runner-receipt.json");
const statusPath = join(runnerDir, "automatic-low-token-learning-status.json");
const readmePath = join(runnerDir, "AUTOMATIC_LOW_TOKEN_LEARNING_RUNNER_START_HERE.md");

const journal = {
  format: "transparent_ai_automatic_low_token_learning_runner_v1",
  runnerId,
  goal,
  createdAt: new Date().toISOString(),
  status,
  queuePath,
  inventoryPath,
  stateDir,
  cycleOutputRoot,
  automaticRunPolicy: {
    reviewedQueueRequired: Boolean(queuePath || inventoryPath),
    runsRequested: runs,
    runsCompleted: runRecords.length,
    intervalMs,
    stopAfterLearningEvents,
    metadataGateFirst: true,
    skipTailWhenMetadataUnchanged: true,
    compactChangedItemsOnly: true,
    screenshotsTriggerOnly: true,
    memoryRequiresTeacherReview: true
  },
  limits: {
    maxItems,
    maxLogsPerItem,
    maxTailLines,
    maxTailBytes,
    maxSnippetChars,
    maxLearningItems
  },
  totals,
  runRecords,
  nextTeachingCalls: runRecords.map((record) => record.nextTeachingCall).filter(Boolean),
  blockedActions: [
    "read full logs by default",
    "capture screenshots by default",
    "write long-term memory from automatic runs",
    "execute software from automatic observation",
    "claim universal native software control"
  ],
  locks
};

const receipt = {
  format: "transparent_ai_automatic_low_token_learning_runner_receipt_v1",
  runnerId,
  status,
  journalPath,
  runCount: runRecords.length,
  totals,
  lastRun: runRecords[runRecords.length - 1] ?? null,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(statusPath, `${JSON.stringify({
  format: "transparent_ai_automatic_low_token_learning_status_v1",
  runnerId,
  status,
  stateDir,
  lastRun: receipt.lastRun,
  totals,
  nextAction:
    totals.compactLearningEvents > 0
      ? "teacher_review_compact_learning_events_before_memory_or_screenshot"
      : "run_again_later_or_wait_for_metadata_delta"
}, null, 2)}\n`, "utf8");
writeFileSync(readmePath, [
  "# Automatic Low-Token Learning Runner",
  "",
  "This runner repeatedly calls the all-software low-token learning cycle with persistent state.",
  "",
  `Status: ${status}`,
  `Runs completed: ${runRecords.length}`,
  `Compact learning events: ${totals.compactLearningEvents}`,
  `Tail reads skipped by metadata gate: ${totals.tailReadSkippedByMetadataGate}`,
  "",
  "Safety defaults:",
  "",
  "- Metadata delta gate runs before bounded tail reads.",
  "- Unchanged logs skip tail reads.",
  "- Changed items become compact teacher-review learning events.",
  "- Screenshots are trigger-only and not captured here.",
  "- Long-term memory, rule enablement, software execution, and packaging remain locked."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_automatic_low_token_learning_runner_result_v1",
  runnerId,
  runnerDir,
  journalPath,
  receiptPath,
  statusPath,
  teacherReadme: readmePath,
  status,
  runCount: runRecords.length,
  totals,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false
}, null, 2));
