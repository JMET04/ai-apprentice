#!/usr/bin/env node
import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

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
  return String(value || "software-observer-watch-cycle")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "software-observer-watch-cycle";
}

function compactText(value, max = 360) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function hashText(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex").slice(0, 16);
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
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
    /(error|exception|failed|failure|warning|blocked|denied|timeout|saved|exported|completed|success|done|finished|错误|失败|警告|阻塞|完成|导出|保存)/iu.test(line)
  );
  const retained = interesting.length > 0 ? interesting.slice(-12).join("\n") : tail.slice(-3).join("\n");
  return {
    path,
    bytes: stat.size,
    lastWriteTimeUtc: stat.mtime.toISOString(),
    tailLineCount: tail.length,
    interestingLineCount: interesting.length,
    interestingTail: interesting.slice(-12).map((line) => compactText(line, maxSnippetChars)),
    retainedSnippet: compactText(retained, maxSnippetChars),
    tailBytesRead: bytesToRead,
    fullLogRead: false,
    lowTokenUse: "selected_log_tail_only"
  };
}

function summaryFingerprint(summary) {
  const snippet = [
    ...(summary.interestingTail || []),
    summary.retainedSnippet || ""
  ].filter(Boolean).join("\n");
  return {
    path: summary.path,
    bytes: summary.bytes ?? null,
    lastWriteTimeUtc: summary.lastWriteTimeUtc || null,
    interestingLineCount: summary.interestingLineCount ?? 0,
    retainedSnippet: compactText(snippet),
    snippetHash: hashText(snippet),
    metadataHash: hashText(`${summary.bytes ?? ""}|${summary.lastWriteTimeUtc || ""}|${summary.tailLineCount ?? ""}`)
  };
}

function classifyChange(current, teacherMarkers) {
  const text = `${current.retainedSnippet}\n${teacherMarkers.join("\n")}`;
  if (/(fatal|exception|failed|failure|error|denied|timeout|blocked|crash|错误|失败|异常|拒绝|超时|阻塞|崩溃)/iu.test(text)) {
    return "failure_or_blocker";
  }
  if (/(warn|warning|deprecated|retry|conflict|警告|重试|冲突)/iu.test(text)) return "warning";
  if (/(ambiguous|unclear|unknown|manual marker|teacher marker|不确定|不清楚|老师标记|人工标记)/iu.test(text)) {
    return "ambiguous_or_teacher_marker";
  }
  if (/(saved|exported|completed|success|done|finished|保存|导出|完成|成功)/iu.test(text)) return "success_state_change";
  return current.retainedSnippet ? "state_change" : "metadata_only_change";
}

function shouldRecommendScreenshot(classification, teacherMarkers) {
  return ["failure_or_blocker", "warning", "ambiguous_or_teacher_marker"].includes(classification) ||
    teacherMarkers.some((marker) => /screenshot|screen|截图|截屏|看屏幕|看画面/iu.test(marker));
}

function loadState(path) {
  if (!path || !existsSync(path)) {
    return {
      format: "transparent_ai_software_observer_watch_state_v1",
      createdAt: new Date().toISOString(),
      queueId: "",
      logs: {}
    };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "software-observer-watch-cycles")));
const stateRoot = resolve(argValue("--state-dir", join(process.cwd(), ".transparent-apprentice", "software-observer-watch-state")));
const maxItems = Number(argValue("--max-items", "8"));
const maxLogsPerItem = Number(argValue("--max-logs-per-item", "4"));
const maxTailLines = Number(argValue("--max-tail-lines", "80"));
const maxTailBytes = Number(argValue("--max-tail-bytes", "65536"));
const maxSnippetChars = Number(argValue("--max-snippet-chars", "360"));
const teacherMarkers = argValues("--teacher-marker");

mkdirSync(outputRoot, { recursive: true });
mkdirSync(stateRoot, { recursive: true });

const queue = queueInput.value;
const queueId = queue.queueId || slugify(basename(queueInput.path || "inline-queue"));
const statePath = resolve(argValue("--state", join(stateRoot, `${slugify(queueId)}.json`)));
mkdirSync(dirname(statePath), { recursive: true });
const previousState = loadState(statePath);
const hadBaseline = Object.keys(previousState.logs || {}).length > 0;
const now = new Date().toISOString();
const cycleId = `${now.replace(/[:.]/g, "-")}-${slugify(queueId)}`;
const cycleDir = join(outputRoot, cycleId);
mkdirSync(cycleDir, { recursive: true });

const selectedItems = (Array.isArray(queue.queue) ? queue.queue : [])
  .slice()
  .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
  .slice(0, maxItems);

const nextState = {
  format: "transparent_ai_software_observer_watch_state_v1",
  createdAt: previousState.createdAt || now,
  updatedAt: now,
  queueId,
  queuePath: queueInput.path || "",
  logs: {}
};

const itemResults = selectedItems.map((item) => {
  const summaries = (item.recentLogCandidates || [])
    .slice(0, maxLogsPerItem)
    .map((log) => readTailSummary(log, maxTailLines, maxSnippetChars, maxTailBytes))
    .filter(Boolean);
  const logDeltas = summaries.map((summary) => {
    const current = summaryFingerprint(summary);
    const previous = previousState.logs?.[current.path] || null;
    nextState.logs[current.path] = {
      queueItemId: item.queueItemId || "",
      software: item.software || "",
      processName: item.processName || "",
      ...current
    };
    if (!previous) {
      return {
        path: current.path,
        status: hadBaseline ? "new_log_seen" : "baseline_initialized",
        classification: hadBaseline ? classifyChange(current, teacherMarkers) : "baseline_initialized",
        current,
        previous: null,
        screenshotRecommended: hadBaseline && shouldRecommendScreenshot(classifyChange(current, teacherMarkers), teacherMarkers)
      };
    }
    const changed =
      previous.snippetHash !== current.snippetHash ||
      previous.metadataHash !== current.metadataHash ||
      previous.interestingLineCount !== current.interestingLineCount;
    const classification = changed ? classifyChange(current, teacherMarkers) : "unchanged";
    return {
      path: current.path,
      status: changed ? "changed" : "unchanged",
      classification,
      previous: {
        bytes: previous.bytes ?? null,
        lastWriteTimeUtc: previous.lastWriteTimeUtc || null,
        snippetHash: previous.snippetHash || "",
        interestingLineCount: previous.interestingLineCount ?? 0
      },
      current,
      screenshotRecommended: changed && shouldRecommendScreenshot(classification, teacherMarkers)
    };
  });
  const changed = logDeltas.filter((delta) => ["changed", "new_log_seen"].includes(delta.status));
  return {
    queueItemId: item.queueItemId || "",
    software: item.software || "",
    processName: item.processName || "",
    windowTitle: item.windowTitle || "",
    scannedLogCount: summaries.length,
    changedLogCount: changed.length,
    screenshotRecommended: changed.some((delta) => delta.screenshotRecommended),
    logDeltas
  };
});

writeFileSync(statePath, JSON.stringify(nextState, null, 2), "utf8");

const changedItems = itemResults.filter((item) => item.changedLogCount > 0);
const screenshotRequests = itemResults.flatMap((item) =>
  item.logDeltas
    .filter((delta) => delta.screenshotRecommended)
    .map((delta) => ({
      software: item.software,
      queueItemId: item.queueItemId,
      logPath: delta.path,
      classification: delta.classification,
      captureOnlyAfterReview: true,
      instruction: "Capture one bounded screenshot only if this cheap log delta is not enough to classify the teacher signal."
    }))
);

const watchCycle = {
  format: "transparent_ai_software_observer_watch_cycle_v1",
  cycleId,
  createdAt: now,
  queueId,
  queuePath: queueInput.path || "",
  statePath,
  baselineWasPresent: hadBaseline,
  lowTokenStrategy:
    "Scan multiple reviewed software queue items, read only bounded log tails, compare against persisted baseline hashes, and request screenshots only on meaningful deltas.",
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
    scannedItems: itemResults.length,
    scannedLogs: itemResults.reduce((sum, item) => sum + item.scannedLogCount, 0),
    changedItems: changedItems.length,
    changedLogs: itemResults.reduce((sum, item) => sum + item.changedLogCount, 0),
    screenshotRequests: screenshotRequests.length
  },
  itemResults,
  screenshotRequests,
  nextTeachingCall: changedItems.length > 0
    ? {
        tool: "teach_apprentice",
        arguments: {
          goal: "Teach from compact multi-software log delta evidence.",
          message: `Use this low-token watch cycle packet and ask which changed signal is reusable: ${join(cycleDir, "software-observer-watch-cycle.json")}`
        }
      }
    : null,
  locks: {
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    nativeUniversalExecution: false,
    teacherConfirmationRequired: true
  }
};

const watchCyclePath = join(cycleDir, "software-observer-watch-cycle.json");
const receiptPath = join(cycleDir, "software-observer-watch-cycle-receipt.json");
const readmePath = join(cycleDir, "WATCH_CYCLE_START_HERE.md");
writeFileSync(watchCyclePath, JSON.stringify(watchCycle, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify({
  format: "transparent_ai_software_observer_watch_cycle_receipt_v1",
  cycleId,
  createdAt: now,
  watchCyclePath,
  statePath,
  status: !hadBaseline
    ? "baseline_initialized_waiting_for_next_cycle"
    : changedItems.length > 0
    ? "waiting_for_teacher_delta_review"
    : "no_meaningful_delta_detected",
  lowTokenProof: watchCycle.limits,
  counts: watchCycle.counts,
  locks: watchCycle.locks
}, null, 2), "utf8");
writeFileSync(readmePath, [
  "# Software Observer Watch Cycle",
  "",
  "This cycle scans multiple reviewed software queue items without continuous recording.",
  "",
  `Queue: ${queueInput.path || "inline JSON"}`,
  `State: ${statePath}`,
  `Scanned items: ${watchCycle.counts.scannedItems}`,
  `Changed logs: ${watchCycle.counts.changedLogs}`,
  `Screenshot requests: ${watchCycle.counts.screenshotRequests}`,
  "",
  "Run this again after the teacher or software changes state. The first run initializes the baseline; later runs report only changed signals.",
  "",
  "Locked defaults: screenshotsCaptured=false, fullContinuousRecording=false, rawFullLogsRetained=false, nativeUniversalExecution=false, ruleEnabled=false, accepted=false, packagingGated=true."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_software_observer_watch_cycle_result_v1",
  cycleId,
  cycleDir,
  watchCyclePath,
  receiptPath,
  statePath,
  baselineWasPresent: hadBaseline,
  scannedItems: watchCycle.counts.scannedItems,
  scannedLogs: watchCycle.counts.scannedLogs,
  changedLogs: watchCycle.counts.changedLogs,
  screenshotRequests: watchCycle.counts.screenshotRequests,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  status: !hadBaseline
    ? "baseline_initialized_waiting_for_next_cycle"
    : changedItems.length > 0
    ? "waiting_for_teacher_delta_review"
    : "no_meaningful_delta_detected"
}, null, 2));
