#!/usr/bin/env node
import { createHash } from "node:crypto";
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
  return String(value || "software-observation-delta-monitor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "software-observation-delta-monitor";
}

function compactText(value, max = 360) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function hashText(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex").slice(0, 16);
}

function readJsonInput(value, label, optional = false) {
  if (!value) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
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

function loadObservationFromPacket(packet, packetPath) {
  if (!packet) return null;
  if (packet.format === "transparent_ai_universal_software_observation_v1") return packet;
  if (packet.observationPath && existsSync(packet.observationPath)) {
    return JSON.parse(readFileSync(packet.observationPath, "utf8"));
  }
  if (packet.observation && packet.observation.format === "transparent_ai_universal_software_observation_v1") {
    return packet.observation;
  }
  if (packetPath && packet.format === "transparent_ai_software_observer_queue_item_run_receipt_v1") {
    throw new Error(`Receipt at ${packetPath} does not include a readable observationPath`);
  }
  return packet;
}

function observationFromQueue(queue, selector, maxTailLines, maxSnippetChars, maxTailBytes, teacherMarkers) {
  const item = selectQueueItem(queue, selector);
  const logSummaries = (item.recentLogCandidates || [])
    .slice(0, 20)
    .map((log) => readTailSummary(log, maxTailLines, maxSnippetChars, maxTailBytes))
    .filter(Boolean);
  return {
    format: "transparent_ai_universal_software_observation_v1",
    source: "software_observation_delta_monitor_current_queue_snapshot",
    queueId: queue.queueId || null,
    queueItemId: item.queueItemId || null,
    software: item.software,
    processName: item.processName || "",
    windowTitle: item.windowTitle || "",
    createdAt: new Date().toISOString(),
    observationMode: "selected_queue_item_metadata_and_bounded_tail_delta_snapshot",
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: "bounded_tail_only_for_selected_candidate_logs",
    maxTailLines,
    maxTailBytes,
    retainedSnippetLimit: maxSnippetChars,
    logSummaries,
    eventSummaries: (item.windowsEventLogs || []).map((logName) => ({
      logName,
      mode: "queued_for_low_token_recent_count_or_preview",
      recentCount: null,
      latest: []
    })),
    teacherMarkers,
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
}

function normalizeLogSummary(summary) {
  const snippet = [
    ...(summary.interestingTail || []),
    summary.retainedSnippet || ""
  ].filter(Boolean).join("\n");
  return {
    path: summary.path || "",
    bytes: summary.bytes ?? null,
    lastWriteTimeUtc: summary.lastWriteTimeUtc || null,
    tailLineCount: summary.tailLineCount ?? null,
    interestingLineCount: summary.interestingLineCount ?? 0,
    snippet,
    snippetHash: hashText(snippet),
    metadataHash: hashText(`${summary.bytes ?? ""}|${summary.lastWriteTimeUtc || ""}|${summary.tailLineCount ?? ""}`)
  };
}

function classifyChange(current, teacherMarkers) {
  const text = `${current.snippet}\n${teacherMarkers.join("\n")}`;
  if (/(fatal|exception|failed|failure|error|denied|timeout|blocked|crash|错误|失败|异常|拒绝|超时|阻塞|崩溃)/iu.test(text)) {
    return "failure_or_blocker";
  }
  if (/(warn|warning|deprecated|retry|conflict|警告|重试|冲突)/iu.test(text)) return "warning";
  if (/(ambiguous|unclear|unknown|manual marker|teacher marker|不确定|不清楚|老师标记|人工标记)/iu.test(text)) return "ambiguous_or_teacher_marker";
  if (/(saved|exported|completed|success|done|finished|保存|导出|完成|成功)/iu.test(text)) return "success_state_change";
  return current.snippet ? "state_change" : "metadata_only_change";
}

function compareObservations(baselineObservation, currentObservation, teacherMarkers) {
  const baselineLogs = new Map((baselineObservation?.logSummaries || []).map((summary) => {
    const normalized = normalizeLogSummary(summary);
    return [normalized.path, normalized];
  }));
  const currentLogs = new Map((currentObservation?.logSummaries || []).map((summary) => {
    const normalized = normalizeLogSummary(summary);
    return [normalized.path, normalized];
  }));
  const changedLogs = [];
  const addedLogs = [];
  const removedLogs = [];

  for (const [path, current] of currentLogs.entries()) {
    const baseline = baselineLogs.get(path);
    if (!baseline) {
      addedLogs.push({ path, current, classification: classifyChange(current, teacherMarkers) });
      continue;
    }
    const changed =
      baseline.snippetHash !== current.snippetHash ||
      baseline.metadataHash !== current.metadataHash ||
      baseline.interestingLineCount !== current.interestingLineCount;
    if (changed) {
      changedLogs.push({
        path,
        baseline: {
          bytes: baseline.bytes,
          lastWriteTimeUtc: baseline.lastWriteTimeUtc,
          snippetHash: baseline.snippetHash,
          interestingLineCount: baseline.interestingLineCount
        },
        current: {
          bytes: current.bytes,
          lastWriteTimeUtc: current.lastWriteTimeUtc,
          snippetHash: current.snippetHash,
          interestingLineCount: current.interestingLineCount,
          retainedSnippet: compactText(current.snippet)
        },
        classification: classifyChange(current, teacherMarkers)
      });
    }
  }

  for (const [path, baseline] of baselineLogs.entries()) {
    if (!currentLogs.has(path)) removedLogs.push({ path, baseline });
  }

  return { changedLogs, addedLogs, removedLogs };
}

function screenshotPolicy(delta, teacherMarkers) {
  const all = [...delta.changedLogs, ...delta.addedLogs];
  const trigger = all.find((entry) =>
    ["failure_or_blocker", "warning", "ambiguous_or_teacher_marker"].includes(entry.classification)
  );
  const markerRequestsScreenshot = teacherMarkers.some((marker) => /screenshot|screen|截屏|截图|看画面|看屏幕/iu.test(marker));
  const screenshotRecommended = Boolean(trigger || markerRequestsScreenshot);
  return {
    screenshotRequiredByDefault: false,
    screenshotRecommended,
    screenshotCaptured: false,
    fullContinuousRecording: false,
    reason: screenshotRecommended
      ? trigger
        ? `cheap_signal_${trigger.classification}`
        : "teacher_marker_requested_visual_check"
      : all.length > 0
      ? "cheap_log_delta_enough_for_teacher_review"
      : "no_meaningful_delta_detected",
    request: screenshotRecommended
      ? {
          type: "teacher_or_agent_triggered_screenshot_request",
          captureOnlyAfterReview: true,
          target: trigger?.path || "visible active software window",
          instruction: "Take one bounded screenshot only if the teacher or supervising agent agrees the cheap signal is insufficient."
        }
      : null
  };
}

const baselineInput = readJsonInput(argValue("--baseline", argValue("--baseline-observation", "")), "--baseline", true);
const currentInput = readJsonInput(argValue("--current", argValue("--current-observation", "")), "--current", true);
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue", true);
const selector = argValue("--item", argValue("--queue-item", argValue("--software", "")));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "software-observation-delta-monitors")));
const maxTailLines = Number(argValue("--max-tail-lines", "80"));
const maxSnippetChars = Number(argValue("--max-snippet-chars", "360"));
const maxTailBytes = Number(argValue("--max-tail-bytes", "65536"));
const teacherMarkers = argValues("--teacher-marker");

if (!currentInput.value && !queueInput.value) {
  throw new Error("Provide --current observation/receipt or --queue for a current bounded-tail snapshot");
}

mkdirSync(outputRoot, { recursive: true });
const baselineObservation = loadObservationFromPacket(baselineInput.value, baselineInput.path);
const currentObservation = currentInput.value
  ? loadObservationFromPacket(currentInput.value, currentInput.path)
  : observationFromQueue(queueInput.value, selector, maxTailLines, maxSnippetChars, maxTailBytes, teacherMarkers);

const monitorId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(currentObservation.software || selector || "software")}`;
const monitorDir = join(outputRoot, monitorId);
mkdirSync(monitorDir, { recursive: true });

const delta = compareObservations(baselineObservation, currentObservation, teacherMarkers);
const policy = screenshotPolicy(delta, teacherMarkers);
const currentSnapshotPath = join(monitorDir, "current-observation-snapshot.json");
const monitorPath = join(monitorDir, "software-observation-delta-monitor.json");
const receiptPath = join(monitorDir, "software-observation-delta-monitor-receipt.json");
const readmePath = join(monitorDir, "DELTA_MONITOR_START_HERE.md");

writeFileSync(currentSnapshotPath, JSON.stringify(currentObservation, null, 2), "utf8");

const monitor = {
  format: "transparent_ai_software_observation_delta_monitor_v1",
  monitorId,
  createdAt: new Date().toISOString(),
  source: "baseline_vs_current_low_token_delta_monitor",
  baselinePath: baselineInput.path || "",
  currentPath: currentInput.path || currentSnapshotPath,
  queuePath: queueInput.path || "",
  software: currentObservation.software || "",
  processName: currentObservation.processName || "",
  windowTitle: currentObservation.windowTitle || "",
  lowTokenStrategy:
    "Compare bounded log/event summaries, metadata hashes, and teacher markers first; request a single screenshot only on failure, warning, ambiguity, or teacher marker.",
  delta,
  counts: {
    changedLogs: delta.changedLogs.length,
    addedLogs: delta.addedLogs.length,
    removedLogs: delta.removedLogs.length,
    teacherMarkers: teacherMarkers.length
  },
  screenshotPolicy: policy,
  nextTeachingCall: {
    tool: "teach_apprentice",
    arguments: {
      goal: `Teach from low-token delta evidence for ${currentObservation.software || "the selected software"}.`,
      message: `Use this delta monitor packet and ask the teacher which changed signal is reusable: ${monitorPath}`
    }
  },
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

const receipt = {
  format: "transparent_ai_software_observation_delta_monitor_receipt_v1",
  monitorId,
  createdAt: monitor.createdAt,
  monitorPath,
  currentSnapshotPath,
  lowTokenProof: {
    baselineCompared: Boolean(baselineObservation),
    currentFromQueueSnapshot: Boolean(!currentInput.value && queueInput.value),
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: currentInput.value ? "existing_compact_observation_only" : "bounded_tail_only_for_selected_candidate_logs",
    maxTailLines,
    maxTailBytes,
    retainedSnippetLimit: maxSnippetChars
  },
  screenshotPolicy: policy,
  status: policy.screenshotRecommended ? "waiting_for_triggered_screenshot_review" : "waiting_for_teacher_delta_review",
  locks: monitor.locks
};

writeFileSync(monitorPath, JSON.stringify(monitor, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
writeFileSync(readmePath, [
  "# Software Observation Delta Monitor",
  "",
  "This monitor compares baseline and current low-token evidence before asking for visual context.",
  "",
  `Software: ${monitor.software}`,
  `Changed logs: ${monitor.counts.changedLogs}`,
  `Added logs: ${monitor.counts.addedLogs}`,
  `Removed logs: ${monitor.counts.removedLogs}`,
  `Screenshot recommended: ${policy.screenshotRecommended}`,
  "",
  "Files:",
  "",
  `- Current snapshot: ${currentSnapshotPath}`,
  `- Delta monitor packet: ${monitorPath}`,
  `- Receipt: ${receiptPath}`,
  "",
  "Locked defaults: screenshotsCaptured=false, fullContinuousRecording=false, rawFullLogsRetained=false, nativeUniversalExecution=false, ruleEnabled=false, accepted=false, packagingGated=true."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_software_observation_delta_monitor_result_v1",
  monitorId,
  monitorDir,
  monitorPath,
  receiptPath,
  currentSnapshotPath,
  changedLogCount: monitor.counts.changedLogs,
  addedLogCount: monitor.counts.addedLogs,
  removedLogCount: monitor.counts.removedLogs,
  screenshotRecommended: policy.screenshotRecommended,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  status: receipt.status
}, null, 2));
