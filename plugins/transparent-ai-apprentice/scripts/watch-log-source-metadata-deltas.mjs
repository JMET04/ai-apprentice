#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
  return String(value || "log-source-metadata-deltas")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "log-source-metadata-deltas";
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

function loadState(path) {
  if (!path || !existsSync(path)) {
    return {
      format: "transparent_ai_log_source_metadata_watch_state_v1",
      createdAt: new Date().toISOString(),
      queueId: "",
      logs: {}
    };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function metadataForLog(log, item) {
  const path = String(log?.path || log || "");
  if (!path) return null;
  if (!existsSync(path)) {
    return {
      path,
      exists: false,
      bytes: null,
      lastWriteTimeUtc: null,
      extension: path.includes(".") ? path.slice(path.lastIndexOf(".")).toLowerCase() : "",
      software: item.software || "",
      queueItemId: item.queueItemId || "",
      source: log?.source || "queue_recent_log_candidate",
      metadataHash: hashText("missing"),
      lowTokenUse: "metadata_only_change_gate_before_tail_or_screenshot"
    };
  }
  const stat = statSync(path);
  return {
    path,
    exists: true,
    bytes: stat.size,
    lastWriteTimeUtc: stat.mtime.toISOString(),
    extension: path.includes(".") ? path.slice(path.lastIndexOf(".")).toLowerCase() : "",
    software: item.software || "",
    queueItemId: item.queueItemId || "",
    source: log?.source || "queue_recent_log_candidate",
    metadataHash: hashText(`${stat.size}|${stat.mtimeMs}`),
    lowTokenUse: "metadata_only_change_gate_before_tail_or_screenshot"
  };
}

function classifyMetadataDelta(previous, current, teacherMarkers) {
  const markerText = teacherMarkers.join("\n");
  if (previous && previous.exists && !current.exists) return "log_disappeared";
  if (!previous && current.exists) return "new_log_metadata_seen";
  if (previous && !previous.exists && current.exists) return "log_reappeared";
  if (/teacher marker|manual marker|ambiguous|unclear|screenshot|screen|老师|标记|截图|看屏幕/iu.test(markerText)) {
    return "teacher_marker_on_metadata_change";
  }
  if ((current.bytes ?? 0) > (previous?.bytes ?? 0)) return "log_grew";
  if ((current.bytes ?? 0) < (previous?.bytes ?? 0)) return "log_truncated_or_rotated";
  return "mtime_only_change";
}

const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "log-source-metadata-deltas")));
const stateRoot = resolve(argValue("--state-dir", join(process.cwd(), ".transparent-apprentice", "log-source-metadata-state")));
const maxItems = Number(argValue("--max-items", "12"));
const maxLogsPerItem = Number(argValue("--max-logs-per-item", "8"));
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
const gateId = `${now.replace(/[:.]/g, "-")}-${slugify(queueId)}`;
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });

const selectedItems = (Array.isArray(queue.queue) ? queue.queue : [])
  .slice()
  .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
  .slice(0, maxItems);

const nextState = {
  format: "transparent_ai_log_source_metadata_watch_state_v1",
  createdAt: previousState.createdAt || now,
  updatedAt: now,
  queueId,
  queuePath: queueInput.path || "",
  logs: {}
};

const itemResults = selectedItems.map((item) => {
  const metadataRows = (item.recentLogCandidates || [])
    .slice(0, maxLogsPerItem)
    .map((log) => metadataForLog(log, item))
    .filter(Boolean);
  const deltas = metadataRows.map((current) => {
    const previous = previousState.logs?.[current.path] || null;
    nextState.logs[current.path] = current;
    if (!previous) {
      return {
        path: current.path,
        status: hadBaseline ? "new_log_seen" : "baseline_initialized",
        classification: hadBaseline ? classifyMetadataDelta(previous, current, teacherMarkers) : "baseline_initialized",
        previous: null,
        current,
        tailReadRecommended: hadBaseline && current.exists,
        screenshotRecommended: false
      };
    }
    const changed =
      previous.metadataHash !== current.metadataHash ||
      previous.bytes !== current.bytes ||
      previous.lastWriteTimeUtc !== current.lastWriteTimeUtc ||
      previous.exists !== current.exists;
    return {
      path: current.path,
      status: changed ? "metadata_changed" : "unchanged",
      classification: changed ? classifyMetadataDelta(previous, current, teacherMarkers) : "unchanged",
      previous: {
        exists: previous.exists,
        bytes: previous.bytes ?? null,
        lastWriteTimeUtc: previous.lastWriteTimeUtc || null,
        metadataHash: previous.metadataHash || ""
      },
      current,
      tailReadRecommended: changed && current.exists,
      screenshotRecommended: false
    };
  });
  const changed = deltas.filter((delta) => ["metadata_changed", "new_log_seen"].includes(delta.status));
  return {
    queueItemId: item.queueItemId || "",
    software: item.software || "",
    processName: item.processName || "",
    score: item.score ?? 0,
    logAvailability: metadataRows.length > 0 ? "candidate_logs_found" : "no_candidate_logs_found",
    nonLogFallbackRecommended: metadataRows.length === 0,
    nonLogFallbackSignals: metadataRows.length === 0 ? (item.nonLogFallbackSignals || []) : [],
    scannedLogMetadataCount: metadataRows.length,
    changedLogMetadataCount: changed.length,
    tailReadRecommended: changed.some((delta) => delta.tailReadRecommended),
    deltas
  };
});

writeFileSync(statePath, JSON.stringify(nextState, null, 2), "utf8");

const changedItems = itemResults.filter((item) => item.changedLogMetadataCount > 0);
const nonLogFallbackItemIds = new Set(
  itemResults
    .filter((item) => item.nonLogFallbackRecommended)
    .map((item) => item.queueItemId)
);
const changedPathSet = new Set(
  changedItems.flatMap((item) => item.deltas.filter((delta) => delta.tailReadRecommended).map((delta) => delta.path))
);
const narrowedQueue = {
  ...queue,
  format: "transparent_ai_software_observer_queue_v1",
  queueId: `${queueId}-metadata-changed`,
  sourceQueueId: queueId,
  sourceQueuePath: queueInput.path || "",
  narrowedBy: "transparent_ai_log_source_metadata_delta_watch_v1",
  queue: (queue.queue || [])
    .map((item) => ({
      ...item,
      recentLogCandidates: (item.recentLogCandidates || []).filter((log) => changedPathSet.has(String(log.path || log)))
    }))
    .filter((item) => (item.recentLogCandidates || []).length > 0),
  locks: {
    ...(queue.locks || {}),
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
};
const nonLogFallbackQueue = {
  ...queue,
  format: "transparent_ai_software_observer_queue_v1",
  queueId: `${queueId}-non-log-fallback`,
  sourceQueueId: queueId,
  sourceQueuePath: queueInput.path || "",
  narrowedBy: "transparent_ai_non_log_low_token_fallback_v1",
  queue: (queue.queue || [])
    .filter((item) => nonLogFallbackItemIds.has(item.queueItemId || ""))
    .map((item) => ({
      ...item,
      recentLogCandidates: [],
      logAvailability: "no_candidate_logs_found",
      nonLogFallbackRequired: true,
      nonLogFallbackReason:
        "Metadata gate found no candidate logs for this reviewed software item; use Windows events, process/window metadata, file deltas, or teacher markers before screenshots.",
      lowTokenSignals: Array.from(new Set([...(item.lowTokenSignals || []), "non-log fallback before screenshot"])),
      locks: {
        ...(item.locks || {}),
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        fullContinuousRecording: false,
        nativeUniversalExecution: false
      }
    })),
  locks: {
    ...(queue.locks || {}),
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
};

const gatePath = join(gateDir, "log-source-metadata-delta-watch.json");
const receiptPath = join(gateDir, "log-source-metadata-delta-watch-receipt.json");
const narrowedQueuePath = join(gateDir, "metadata-changed-software-observer-queue.json");
const nonLogFallbackQueuePath = join(gateDir, "non-log-fallback-software-observer-queue.json");
if (narrowedQueue.queue.length > 0) writeFileSync(narrowedQueuePath, JSON.stringify(narrowedQueue, null, 2), "utf8");
if (nonLogFallbackQueue.queue.length > 0) writeFileSync(nonLogFallbackQueuePath, JSON.stringify(nonLogFallbackQueue, null, 2), "utf8");

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fullLogsRead: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const gate = {
  format: "transparent_ai_log_source_metadata_delta_watch_v1",
  gateId,
  createdAt: now,
  queueId,
  queuePath: queueInput.path || "",
  statePath,
  baselineWasPresent: hadBaseline,
  lowTokenStrategy:
    "Compare log path metadata only (exists, bytes, mtime, extension) before tail reads, screenshots, continuous recording, or memory writes.",
  limits: {
    maxItems,
    maxLogsPerItem,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false
  },
  counts: {
    scannedItems: itemResults.length,
    scannedLogMetadata: itemResults.reduce((sum, item) => sum + item.scannedLogMetadataCount, 0),
    changedItems: changedItems.length,
    changedLogMetadata: itemResults.reduce((sum, item) => sum + item.changedLogMetadataCount, 0),
    narrowedQueueItems: narrowedQueue.queue.length,
    nonLogFallbackItems: nonLogFallbackQueue.queue.length
  },
  itemResults,
  narrowedQueuePath: narrowedQueue.queue.length > 0 ? narrowedQueuePath : "",
  nonLogFallbackQueuePath: nonLogFallbackQueue.queue.length > 0 ? nonLogFallbackQueuePath : "",
  nextTailReadCall: narrowedQueue.queue.length > 0
    ? {
        tool: "run_software_observer_watch_cycle",
        arguments: {
          queue: narrowedQueuePath,
          stateDir: "<same stateDir used for watch-cycle tail baselines>",
          maxTailBytes: 65536,
          maxTailLines: 80
        }
      }
    : null,
  nextTeacherAction:
    changedItems.length > 0
      ? "Review changed metadata first; run the narrowed watch-cycle only for changed logs before considering any screenshot."
      : nonLogFallbackQueue.queue.length > 0
      ? "No candidate logs were found for some reviewed apps. Run the non-log fallback queue to use Windows events, process/window metadata, file deltas, or teacher markers before screenshots."
      : hadBaseline
      ? "No log metadata changed. Skip tail reads and screenshots for this pass."
      : "Metadata baseline initialized. Run another metadata pass after the teacher works before reading tails.",
  locks
};

const receipt = {
  format: "transparent_ai_log_source_metadata_delta_watch_receipt_v1",
  gateId,
  status: changedItems.length > 0 ? "metadata_delta_waiting_for_tail_review" : hadBaseline ? "no_metadata_delta_skip_tail" : "baseline_initialized_waiting_for_metadata_delta",
  gatePath,
  statePath,
  narrowedQueuePath: gate.narrowedQueuePath,
  nonLogFallbackQueuePath: gate.nonLogFallbackQueuePath,
  changedLogMetadata: gate.counts.changedLogMetadata,
  nonLogFallbackItems: gate.counts.nonLogFallbackItems,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(gatePath, JSON.stringify(gate, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_log_source_metadata_delta_watch_result_v1",
  status: receipt.status,
  gateId,
  gatePath,
  receiptPath,
  statePath,
  narrowedQueuePath: gate.narrowedQueuePath,
  nonLogFallbackQueuePath: gate.nonLogFallbackQueuePath,
  baselineWasPresent: hadBaseline,
  scannedLogMetadata: gate.counts.scannedLogMetadata,
  changedLogMetadata: gate.counts.changedLogMetadata,
  nonLogFallbackItems: gate.counts.nonLogFallbackItems,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  nativeUniversalExecution: false
}, null, 2));
