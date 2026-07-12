#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

function slugify(value) {
  return String(value || "software-observer-queue-item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "software-observer-queue-item";
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
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

function readTailSummary(log, maxTailLines, maxSnippetChars, maxTailBytes) {
  const path = String(log.path || log);
  if (!path || !existsSync(path)) return null;
  const stat = statSync(path);
  const bytesToRead = Math.min(stat.size, maxTailBytes);
  const buffer = Buffer.alloc(bytesToRead);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buffer, 0, bytesToRead, Math.max(0, stat.size - bytesToRead));
  } finally {
    closeSync(fd);
  }
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const tail = lines.slice(-maxTailLines);
  const interesting = tail.filter((line) =>
    /(error|exception|failed|warning|blocked|denied|timeout|saved|exported|completed|success|done|finished|失败|错误|警告|完成|导出|保存)/iu.test(line)
  );
  const retained = interesting.length > 0 ? interesting.slice(-12).join("\n") : tail.slice(-3).join("\n");
  return {
    path,
    bytes: log.bytes ?? stat.size,
    lastWriteTimeUtc: log.lastWriteTimeUtc || null,
    tailLineCount: tail.length,
    interestingLineCount: interesting.length,
    interestingTail: interesting.slice(-12).map((line) => compactText(line, maxSnippetChars)),
    retainedSnippet: compactText(retained, maxSnippetChars),
    tailBytesRead: bytesToRead,
    fullLogRead: false,
    lowTokenUse: "selected_log_tail_only"
  };
}

function selectQueueItem(queue, selector) {
  const items = Array.isArray(queue.queue) ? queue.queue : [];
  if (items.length === 0) throw new Error("Queue has no items");
  if (!selector) return items[0];
  const normalized = String(selector).toLowerCase();
  return items.find((item) =>
    String(item.queueItemId || "").toLowerCase() === normalized ||
    String(item.software || "").toLowerCase() === normalized ||
    String(item.processName || "").toLowerCase() === normalized
  ) || items[0];
}

const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const selector = argValue("--item", argValue("--queue-item", argValue("--software", "")));
const teacherStyle = argValue("--teacher-style", "ask_teacher_preference");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "software-observer-queue-runs")));
const maxTailLines = Number(argValue("--max-tail-lines", "80"));
const maxSnippetChars = Number(argValue("--max-snippet-chars", "360"));
const maxTailBytes = Number(argValue("--max-tail-bytes", "65536"));
const teacherMarkers = argValues("--teacher-marker");

mkdirSync(outputRoot, { recursive: true });
const queue = queueInput.value;
const item = selectQueueItem(queue, selector);
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${item.software}-${item.queueItemId || item.processName}`)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const observerArgs = [];
const nextObserverArgs = item.nextObserverCall?.arguments || {};
const goal = nextObserverArgs.goal || queue.goal || "Run one low-token observation from a reviewed software observer queue.";
observerArgs.push("--goal", goal);
observerArgs.push("--software", item.software || nextObserverArgs.software || "unknown software");
if (item.processName || nextObserverArgs.processName) observerArgs.push("--process-name", item.processName || nextObserverArgs.processName);
if (item.windowTitle || nextObserverArgs.windowTitle) observerArgs.push("--window-title", item.windowTitle || nextObserverArgs.windowTitle);
for (const path of item.recentLogCandidates?.map((log) => log.path).filter(Boolean) || nextObserverArgs.logPaths || []) {
  observerArgs.push("--log-path", path);
}
for (const root of nextObserverArgs.logRoots || []) observerArgs.push("--log-root", root);
for (const eventLog of item.windowsEventLogs || nextObserverArgs.windowsEventLogs || []) observerArgs.push("--windows-event-log", eventLog);
observerArgs.push("--output-dir", join(runDir, "observer-kit"));

const observerKit = runNodeScript("create-universal-software-observer-kit.mjs", observerArgs);
const logSummaries = (item.recentLogCandidates || [])
  .slice(0, 20)
  .map((log) => readTailSummary(log, maxTailLines, maxSnippetChars, maxTailBytes))
  .filter(Boolean);
const nonLogFallbackSummaries = item.nonLogFallbackRequired || logSummaries.length === 0
  ? (item.nonLogFallbackSignals || []).map((signal, index) => ({
      id: `non-log-fallback-${index + 1}`,
      sourceType: signal.sourceType || "non_log_fallback",
      sources: Array.isArray(signal.sources) ? signal.sources : [],
      lowTokenUse: signal.lowTokenUse || "metadata_only_before_screenshot",
      reviewQuestion: signal.reviewQuestion || "Which non-log signal should label this software state?",
      fallbackRequired: true,
      screenshotCaptured: false,
      teacherMarkerRequiredBeforeMemory: signal.sourceType === "manual_teacher_marker"
    }))
  : [];

const observation = {
  format: "transparent_ai_universal_software_observation_v1",
  source: "software_observer_queue_item_runner",
  queuePath: queueInput.path,
  queueId: queue.queueId || null,
  queueItemId: item.queueItemId || null,
  kitId: observerKit.kitId || null,
  software: item.software,
  processName: item.processName || "",
  windowTitle: item.windowTitle || "",
  createdAt: new Date().toISOString(),
  observationMode: "selected_queue_item_metadata_and_bounded_tail",
  logAvailability: logSummaries.length > 0 ? "candidate_logs_observed" : "no_candidate_logs_non_log_fallback",
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  logContentsRead: logSummaries.length > 0 ? "bounded_tail_only_for_selected_candidate_logs" : "none_no_candidate_logs",
  maxTailLines,
  maxTailBytes,
  retainedSnippetLimit: maxSnippetChars,
  logSummaries,
  nonLogFallbackSummaries,
  eventSummaries: (item.windowsEventLogs || []).map((logName) => ({
    logName,
    mode: logSummaries.length > 0 ? "queued_for_low_token_recent_count_or_preview" : "non_log_fallback_count_or_preview_before_screenshot",
    recentCount: null,
    latest: []
  })),
  teacherMarkers,
  needsTeacherQuestion:
    logSummaries.some((summary) => summary.interestingLineCount > 0) ||
    nonLogFallbackSummaries.length > 0 ||
    teacherMarkers.length > 0,
  suggestedTeacherQuestions: [
    "Which compact event is the actual reusable teaching signal?",
    "Is this signal success, warning, failure, or normal state change?",
    "What counterexample should stop this rule from overgeneralizing?",
    "If this app has no useful logs, which non-log signal should be watched first?"
  ],
  locks: {
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false,
    teacherConfirmationRequired: true
  }
};

const observationPath = join(runDir, "universal-observation-summary.json");
writeFileSync(observationPath, JSON.stringify(observation, null, 2), "utf8");

const compact = runNodeScript("compact-universal-observation-learning-events.mjs", [
  "--observation",
  observationPath,
  "--teacher-style",
  teacherStyle,
  "--output-dir",
  join(runDir, "compact-learning")
]);

const receipt = {
  format: "transparent_ai_software_observer_queue_item_run_receipt_v1",
  runId,
  createdAt: new Date().toISOString(),
  queuePath: queueInput.path,
  queueItem: {
    queueItemId: item.queueItemId || "",
    software: item.software,
    processName: item.processName || "",
    score: item.score ?? null,
    confidence: item.confidence || ""
  },
  observerKit,
  observationPath,
  compactLearningEvents: compact,
  lowTokenProof: {
    selectedOneQueueItem: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: logSummaries.length > 0 ? "bounded_tail_only_for_selected_candidate_logs" : "none_no_candidate_logs",
    nonLogFallbackUsed: nonLogFallbackSummaries.length > 0,
    nonLogFallbackSignalCount: nonLogFallbackSummaries.length,
    maxTailLines,
    maxTailBytes,
    retainedSnippetLimit: maxSnippetChars
  },
  nextTeachingCall: {
    tool: "teach_apprentice",
    arguments: {
      goal,
      message: `Use this compact low-token observation packet for ${item.software}: ${compact.packetPath}`
    }
  },
  nextDeltaMonitorCall: {
    tool: "monitor_software_observation_deltas",
    arguments: {
      baseline: "<optional previous universal-observation-summary.json or queue-item receipt>",
      current: observationPath,
      teacherMarkers,
      maxTailLines,
      maxTailBytes,
      maxSnippetChars,
      outputDir: join(runDir, "delta-monitor")
    }
  },
  locks: observation.locks
};

const receiptPath = join(runDir, "software-observer-queue-item-run-receipt.json");
const readmePath = join(runDir, "QUEUE_ITEM_RUN_START_HERE.md");
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
writeFileSync(readmePath, [
  "# Software Observer Queue Item Run",
  "",
  `Software: ${item.software}`,
  `Queue item: ${item.queueItemId || ""}`,
  "",
  "This run consumes one reviewed all-software observer queue item and turns it into low-token learning evidence.",
  "",
  "Files:",
  "",
  `- Observer kit: ${observerKit.kitPath}`,
  `- Observation summary: ${observationPath}`,
  `- Compact learning events: ${compact.packetPath}`,
  `- Run receipt: ${receiptPath}`,
  "",
  "Next step: paste the compact learning event packet into `teach_apprentice`, then answer which event is the reusable rule boundary.",
  "",
  "Locked defaults: ruleEnabled=false, accepted=false, packagingGated=true, fullContinuousRecording=false, nativeUniversalExecution=false."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_software_observer_queue_item_run_result_v1",
  runId,
  runDir,
  queueItemId: item.queueItemId || "",
  software: item.software,
  observerKitPath: observerKit.kitPath,
  observationPath,
  compactLearningEventsPath: compact.packetPath,
  receiptPath,
  teacherReadme: readmePath,
  compactEventCount: compact.compactEventCount,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  status: "waiting_for_teacher_review"
}, null, 2));
