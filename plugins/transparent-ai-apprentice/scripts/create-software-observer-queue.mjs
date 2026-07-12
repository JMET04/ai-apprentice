#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "software-observer-queue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "software-observer-queue";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function expandWindowsEnv(value) {
  let expanded = String(value || "");
  expanded = expanded.replace(/%([^%]+)%/g, (_, key) => process.env[key] || process.env[key.toUpperCase()] || "");
  if (expanded === "current workspace") return process.cwd();
  return expanded;
}

function normalizeCandidate(candidate) {
  return {
    software: String(candidate.software || candidate.name || candidate.displayName || "unknown software"),
    processName: String(candidate.processName || ""),
    processId: candidate.processId ?? candidate.id ?? "",
    windowTitle: String(candidate.windowTitle || candidate.mainWindowTitle || ""),
    installPath: String(candidate.installPath || candidate.path || ""),
    candidateLogRoots: Array.isArray(candidate.candidateLogRoots) ? candidate.candidateLogRoots : [],
    candidateLogFiles: Array.isArray(candidate.candidateLogFiles) ? candidate.candidateLogFiles : [],
    windowsEventLogs: Array.isArray(candidate.windowsEventLogs) && candidate.windowsEventLogs.length > 0
      ? candidate.windowsEventLogs
      : ["Application", "System"],
    confidence: Number(candidate.confidence ?? 0.35),
    reason: String(candidate.reason || "inventory_candidate")
  };
}

function isLogLike(path) {
  const extension = extname(path).toLowerCase();
  return [".log", ".txt", ".jsonl", ".trace", ".etl", ".csv", ".out", ".err"].includes(extension);
}

function boundedFindLogFiles(root, software, processName, options) {
  const expandedRoot = resolve(expandWindowsEnv(root));
  const found = [];
  const seen = new Set();
  const softwareLower = String(software || "").toLowerCase();
  const processLower = String(processName || "").toLowerCase();

  function visit(dir, depth) {
    if (found.length >= options.maxFiles) return;
    if (depth > options.maxDepth) return;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).slice(0, options.maxEntriesPerDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= options.maxFiles) break;
      const path = join(dir, entry.name);
      if (seen.has(path)) continue;
      seen.add(path);
      if (entry.isDirectory()) {
        const name = entry.name.toLowerCase();
        const likely = !softwareLower || name.includes(softwareLower) || (processLower && name.includes(processLower)) || depth > 0;
        if (likely) visit(path, depth + 1);
        continue;
      }
      if (!entry.isFile() || !isLogLike(path)) continue;
      const lower = path.toLowerCase();
      const nameMatched = !softwareLower || lower.includes(softwareLower) || (processLower && lower.includes(processLower));
      if (!nameMatched && depth === 0) continue;
      try {
        const stat = statSync(path);
        found.push({
          path,
          bytes: stat.size,
          lastWriteTimeUtc: stat.mtime.toISOString(),
          extension: extname(path),
          lowTokenUse: "metadata_first_then_tail_on_trigger"
        });
      } catch {}
    }
  }

  if (existsSync(expandedRoot)) visit(expandedRoot, 0);
  return found.sort((left, right) => String(right.lastWriteTimeUtc).localeCompare(String(left.lastWriteTimeUtc)));
}

function nonLogFallbackSignals(candidate, roots) {
  return [
    {
      sourceType: "windows_event_log",
      sources: candidate.windowsEventLogs,
      lowTokenUse: "count_and_preview_only_before_screenshot",
      reviewQuestion: "Are recent Application/System events relevant to this software task, or background noise?"
    },
    {
      sourceType: "process_window_metadata",
      sources: [candidate.processName, candidate.windowTitle].filter(Boolean),
      lowTokenUse: "process_and_window_title_metadata_only",
      reviewQuestion: "Does the current process/window state prove the task changed, or should the teacher add a marker?"
    },
    {
      sourceType: "file_modified_time_deltas",
      sources: roots,
      lowTokenUse: "mtime_size_extension_metadata_only",
      reviewQuestion: "Which watched folder or exported file should count as the task signal?"
    },
    {
      sourceType: "manual_teacher_marker",
      sources: ["teacher marker text", "short voice/text note", "before/after marker"],
      lowTokenUse: "short_teacher_label_without_screen_recording",
      reviewQuestion: "What short teacher marker should label this no-log software state?"
    }
  ];
}

const inventoryPath = resolve(argValue("--inventory", argValue("--inventory-path", "")));
if (!inventoryPath || !existsSync(inventoryPath)) {
  throw new Error("Pass --inventory path/to/software-observer-inventory.json");
}

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "software-observer-queues")));
const maxCandidates = Number(argValue("--max-candidates", "30"));
const maxFilesPerCandidate = Number(argValue("--max-files-per-candidate", "8"));
const maxDepth = Number(argValue("--max-depth", "2"));
const maxEntriesPerDir = Number(argValue("--max-entries-per-dir", "220"));

mkdirSync(outputRoot, { recursive: true });
const inventory = readJson(inventoryPath);
const inventoryId = inventory.inventoryId || slugify(basename(inventoryPath));
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`queue-${inventoryId}`)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const candidates = Array.isArray(inventory.softwareCandidates)
  ? inventory.softwareCandidates.map(normalizeCandidate)
  : [];

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const queued = candidates.slice(0, maxCandidates).map((candidate) => {
  const roots = candidate.candidateLogRoots.length > 0
    ? candidate.candidateLogRoots
    : ["%APPDATA%", "%LOCALAPPDATA%", "%PROGRAMDATA%", "%TEMP%"];
  const indexedLogCandidates = candidate.candidateLogFiles.map((log) => ({
    path: String(log.path || ""),
    bytes: Number(log.bytes ?? 0),
    lastWriteTimeUtc: String(log.lastWriteTimeUtc || ""),
    extension: String(log.extension || extname(String(log.path || ""))),
    lowTokenUse: String(log.lowTokenUse || "metadata_first_then_tail_on_trigger"),
    source: "inventory_log_source_index"
  })).filter((log) => log.path);
  const scannedLogCandidates = roots.flatMap((root) =>
    boundedFindLogFiles(root, candidate.software, candidate.processName, {
      maxFiles: maxFilesPerCandidate,
      maxDepth,
      maxEntriesPerDir
    })
  );
  const seenLogPaths = new Set();
  const recentLogCandidates = [...indexedLogCandidates, ...scannedLogCandidates]
    .filter((log) => {
      const key = String(log.path).toLowerCase();
      if (!key || seenLogPaths.has(key)) return false;
      seenLogPaths.add(key);
      return true;
    })
    .slice(0, maxFilesPerCandidate);
  const fallbackSignals = recentLogCandidates.length === 0 ? nonLogFallbackSignals(candidate, roots) : [];
  const score =
    candidate.confidence +
    (candidate.windowTitle ? 0.18 : 0) +
    (candidate.processName ? 0.16 : 0) +
    Math.min(0.32, recentLogCandidates.length * 0.06) +
    (fallbackSignals.length > 0 ? 0.08 : 0);
  return {
    queueItemId: slugify(`${candidate.software}-${candidate.processName || "app"}`),
    software: candidate.software,
    processName: candidate.processName,
    processId: candidate.processId,
    windowTitle: candidate.windowTitle,
    installPath: candidate.installPath,
    sourceReason: candidate.reason,
    score: Number(score.toFixed(3)),
    confidence: score >= 0.75 ? "high" : score >= 0.52 ? "medium" : "low",
    recentLogCandidates,
    indexedLogCandidateCount: indexedLogCandidates.length,
    logAvailability: recentLogCandidates.length > 0 ? "candidate_logs_found" : "no_candidate_logs_found",
    nonLogFallbackRequired: recentLogCandidates.length === 0,
    nonLogFallbackSignals: fallbackSignals,
    nonLogFallbackPolicy: {
      status: recentLogCandidates.length === 0 ? "fallback_review_required" : "not_needed",
      reason:
        recentLogCandidates.length === 0
          ? "No likely log file was found in bounded metadata scan; use Windows events, process/window metadata, file deltas, or teacher markers before screenshots."
          : "Candidate logs are available; use metadata gate before bounded tail reads.",
      screenshotAllowedOnlyAfter: [
        "teacher marker says the non-log signal is ambiguous",
        "Windows Event or file-delta metadata changes but cannot identify the reusable rule",
        "teacher explicitly requests a bounded screenshot for the selected software"
      ]
    },
    windowsEventLogs: candidate.windowsEventLogs,
    lowTokenSignals: [
      "log metadata and mtime",
      "short tail only after trigger",
      "Windows Event Log recent count and preview",
      "file modified-time deltas",
      "manual teacher marker",
      "non-log fallback when no candidate logs exist",
      "triggered screenshot only if ambiguous"
    ],
    nextProfileCall: {
      tool: "create_software_capability_profile",
      arguments: {
        goal: inventory.goal || "Learn from this software with low-token evidence.",
        software: candidate.software,
        ...(candidate.processName ? { processName: candidate.processName } : {}),
        ...(candidate.windowTitle ? { windowTitle: candidate.windowTitle } : {}),
        ...(candidate.installPath ? { installPath: candidate.installPath } : {}),
        logPaths: recentLogCandidates.map((log) => log.path),
        logRoots: roots,
        windowsEventLogs: candidate.windowsEventLogs
      }
    },
    nextObserverCall: {
      tool: "create_universal_software_observer_kit",
      arguments: {
        goal: inventory.goal || "Learn from this software with low-token evidence.",
        software: candidate.software,
        ...(candidate.processName ? { processName: candidate.processName } : {}),
        ...(candidate.windowTitle ? { windowTitle: candidate.windowTitle } : {}),
        logPaths: recentLogCandidates.map((log) => log.path),
        logRoots: roots,
        windowsEventLogs: candidate.windowsEventLogs
      }
    },
    nextRunCall: {
      tool: "run_software_observer_queue_item",
      arguments: {
        queue: "<path to software-observer-queue.json>",
        item: slugify(`${candidate.software}-${candidate.processName || "app"}`),
        teacherStyle: "ask_teacher_preference",
        maxTailBytes: 65536,
        maxTailLines: 80
      }
    },
    nextMetadataDeltaGateCall: {
      tool: "watch_log_source_metadata_deltas",
      arguments: {
        queue: "<path to software-observer-queue.json>",
        item: slugify(`${candidate.software}-${candidate.processName || "app"}`),
        maxItems: 12,
        maxLogsPerItem: 8
      }
    },
    nextNonLogFallbackRunCall: {
      tool: "run_software_observer_queue_item",
      arguments: {
        queue: "<path to software-observer-queue.json>",
        item: slugify(`${candidate.software}-${candidate.processName || "app"}`),
        teacherStyle: "ask_teacher_preference",
        maxTailBytes: 0,
        maxTailLines: 0,
        nonLogFallback: true
      }
    },
    nextDeltaMonitorCall: {
      tool: "monitor_software_observation_deltas",
      arguments: {
        baseline: "<optional previous universal-observation-summary.json or queue-item receipt>",
        queue: "<path to software-observer-queue.json>",
        item: slugify(`${candidate.software}-${candidate.processName || "app"}`),
        maxTailBytes: 65536,
        maxTailLines: 80
      }
    },
    nextCompactLearningTool: "compact_universal_observation_learning_events",
    teacherReviewQuestion:
      recentLogCandidates.length > 0
        ? "Which of these log candidates should count as the reusable teaching signal?"
        : "No likely log file was found in the bounded scan; choose Windows Events, file deltas, process/window metadata, manual markers, or a triggered screenshot only if these are ambiguous."
  };
});

const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId,
  inventoryPath,
  inventoryFormat: inventory.format || "",
  createdAt: new Date().toISOString(),
  boundedScan: {
    maxCandidates,
    maxFilesPerCandidate,
    maxDepth,
    maxEntriesPerDir,
    fullLogsRead: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false
  },
  queue: queued.sort((left, right) => right.score - left.score),
  defaultNextToolOrder: [
    "create_software_capability_profile",
    "create_universal_software_observer_kit",
    "watch_log_source_metadata_deltas",
    "run_software_observer_queue_item",
    "monitor_software_observation_deltas",
    "compact_universal_observation_learning_events",
    "teach_apprentice"
  ],
  limits: [
    "This queue uses bounded metadata scanning and may miss app-specific logs outside candidate roots.",
    "It does not read full logs and does not continuously record the screen.",
    "When no log is found, it creates a non-log fallback route instead of pretending log learning is available.",
    "It does not prove native universal app execution.",
    "Teacher review chooses which queued item becomes an observer."
  ],
  locks
};

const queuePath = join(queueDir, "software-observer-queue.json");
const readmePath = join(queueDir, "SOFTWARE_OBSERVER_QUEUE_START_HERE.md");
const nextCallsPath = join(queueDir, "next-observer-calls.json");

writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf8");
writeFileSync(nextCallsPath, JSON.stringify(queue.queue.map((item) => ({
  software: item.software,
  score: item.score,
  nextProfileCall: item.nextProfileCall,
  nextObserverCall: item.nextObserverCall,
  nextMetadataDeltaGateCall: { ...item.nextMetadataDeltaGateCall, arguments: { ...item.nextMetadataDeltaGateCall.arguments, queue: queuePath } },
  nextRunCall: { ...item.nextRunCall, arguments: { ...item.nextRunCall.arguments, queue: queuePath } },
  nextDeltaMonitorCall: { ...item.nextDeltaMonitorCall, arguments: { ...item.nextDeltaMonitorCall.arguments, queue: queuePath } },
  nextCompactLearningTool: item.nextCompactLearningTool
})), null, 2), "utf8");
writeFileSync(readmePath, [
  "# Software Observer Queue",
  "",
  `Inventory: ${inventoryPath}`,
  "",
  "This queue turns the all-software inventory or probe output into reviewable, low-token per-software observer next steps.",
  "",
  "It only scans bounded file metadata and log-like file names. It does not read full logs, capture screenshots, or run native app actions.",
  "",
  "Suggested next flow:",
  "",
  "1. Review `software-observer-queue.json` and exclude private apps.",
  "2. Pick the highest-value app or the app the teacher is using now.",
  "3. Run `watch_log_source_metadata_deltas` first so unchanged logs do not spend tail-read or screenshot budget.",
  "4. Only when metadata changes, run the queued `run_software_observer_queue_item` or narrowed `run_software_observer_watch_cycle` call; inspect `create_software_capability_profile` first if sources are unclear.",
  "5. Compare baseline/current evidence with `monitor_software_observation_deltas` before spending screenshot tokens.",
  "6. Review the generated observation summary, compact learning events, delta monitor packet, and queue item run receipt before teaching memory.",
  "",
  "Locked defaults: accepted=false, ruleEnabled=false, packagingGated=true, fullContinuousRecording=false, nativeUniversalExecution=false."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_software_observer_queue_result_v1",
  queueId,
  queuePath,
  teacherReadme: readmePath,
  nextObserverCalls: nextCallsPath,
  queuedCount: queue.queue.length,
  topSoftware: queue.queue.slice(0, 5).map((item) => ({ software: item.software, score: item.score, logs: item.recentLogCandidates.length })),
  noLogFallbackCount: queue.queue.filter((item) => item.nonLogFallbackRequired).length,
  fullLogsRead: false,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  locks
}, null, 2));
