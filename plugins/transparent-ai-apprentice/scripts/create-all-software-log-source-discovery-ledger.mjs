#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

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
  return String(value || "all-software-log-source-discovery-ledger")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-log-source-discovery-ledger";
}

function readJsonInput(input, label, optional = false) {
  const text = String(input || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{") || text.startsWith("[")) return { value: JSON.parse(text), path: "" };
  if (optional) return { value: { reference: text }, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function locks(allSoftwareLogSourceDiscoveryComplete = false) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    allSoftwareLogSourceDiscoveryComplete,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    scheduledTaskInstalled: false,
    nativeUniversalExecution: false
  };
}

function keyVariants(row = {}) {
  return [row.queueItemId, row.software, row.processName, row.name, row.displayName]
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean);
}

function normalizeCandidate(row = {}) {
  return {
    software: String(row.software || row.name || row.displayName || "unknown software"),
    processName: String(row.processName || ""),
    windowTitle: String(row.windowTitle || row.mainWindowTitle || ""),
    installPath: String(row.installPath || row.path || ""),
    candidateLogFiles: Array.isArray(row.candidateLogFiles) ? row.candidateLogFiles : [],
    candidateLogRoots: Array.isArray(row.candidateLogRoots) ? row.candidateLogRoots : [],
    windowsEventLogs: Array.isArray(row.windowsEventLogs) ? row.windowsEventLogs : [],
    reason: String(row.reason || "inventory_candidate")
  };
}

function normalizeQueueItem(row = {}) {
  return {
    queueItemId: String(row.queueItemId || ""),
    software: String(row.software || row.name || "unknown software"),
    processName: String(row.processName || ""),
    recentLogCandidates: Array.isArray(row.recentLogCandidates) ? row.recentLogCandidates : [],
    candidateLogFiles: Array.isArray(row.candidateLogFiles) ? row.candidateLogFiles : [],
    logAvailability: String(row.logAvailability || ""),
    nonLogFallbackRequired: row.nonLogFallbackRequired === true,
    nonLogFallbackSignals: Array.isArray(row.nonLogFallbackSignals) ? row.nonLogFallbackSignals : [],
    nextMetadataDeltaGateCall: row.nextMetadataDeltaGateCall || null,
    nextNonLogFallbackRunCall: row.nextNonLogFallbackRunCall || null,
    nextObserverCall: row.nextObserverCall || null
  };
}

function mapByKeys(rows) {
  const map = new Map();
  for (const row of rows) {
    for (const key of keyVariants(row)) {
      if (!map.has(key)) map.set(key, row);
    }
  }
  return map;
}

function explicitExclusionFor(candidate, exclusions) {
  const keys = new Set(keyVariants(candidate));
  return exclusions.find((item) => keys.has(String(item || "").toLowerCase().trim())) || "";
}

function discoveryStatus(candidate, queueItem, exclusion) {
  if (exclusion) return "teacher_excluded_or_private";
  const directLogs = (candidate.candidateLogFiles?.length || 0) + (queueItem?.recentLogCandidates?.length || 0) + (queueItem?.candidateLogFiles?.length || 0);
  if (directLogs > 0) return "direct_log_candidates_ready_for_metadata_gate";
  if ((queueItem?.nonLogFallbackSignals?.length || 0) > 0 || queueItem?.nonLogFallbackRequired) {
    return "non_log_low_token_fallback_ready_for_review";
  }
  if ((candidate.windowsEventLogs?.length || 0) > 0) return "windows_event_log_fallback_ready_for_review";
  if ((candidate.candidateLogRoots?.length || 0) > 0) return "candidate_roots_need_bounded_scan";
  return "needs_teacher_log_source_or_exclusion";
}

function nextActionsFor(status, candidate, queueItem, paths) {
  if (status === "teacher_excluded_or_private") return ["keep_exclusion_locked_until_teacher_changes_scope"];
  if (status === "direct_log_candidates_ready_for_metadata_gate") {
    return [
      "run_metadata_gate_before_tail_read",
      queueItem?.nextMetadataDeltaGateCall || {
        tool: "watch_log_source_metadata_deltas",
        arguments: { queue: paths.queuePath || "<software-observer-queue.json>", item: candidate.software }
      }
    ];
  }
  if (status === "non_log_low_token_fallback_ready_for_review") {
    return [
      "review_non_log_fallback_before_screenshot",
      queueItem?.nextNonLogFallbackRunCall || {
        tool: "run_software_observer_queue_item",
        arguments: { queue: paths.queuePath || "<software-observer-queue.json>", item: candidate.software, nonLogFallback: true }
      }
    ];
  }
  if (status === "windows_event_log_fallback_ready_for_review") {
    return [
      "use_windows_event_count_and_preview_before_screenshot",
      {
        tool: "create_software_capability_profile",
        arguments: { software: candidate.software, windowsEventLogs: candidate.windowsEventLogs }
      }
    ];
  }
  if (status === "candidate_roots_need_bounded_scan") {
    return [
      "extend_observer_queue_with_bounded_root_scan",
      {
        tool: "create_software_observer_queue",
        arguments: { inventory: paths.inventoryPath || "<software-observer-inventory.json>", maxFilesPerCandidate: 8 }
      }
    ];
  }
  return [
    "ask_teacher_for_log_source_marker_or_exclusion",
    {
      tool: "teach_apprentice",
      arguments: {
        whatToTeach: `Choose a low-token source for ${candidate.software}`,
        message: "Pick a log/export folder, Windows Event source, file-delta folder, manual marker, or mark this software private/out of scope."
      }
    }
  ];
}

const inventoryInput = readJsonInput(argValue("--inventory", argValue("--inventory-path", "")), "--inventory");
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue", true);
const exclusions = [...argValues("--exclude"), ...argValues("--teacher-excluded")];
const goal = argValue("--goal", "Discover per-software log or low-token fallback sources before claiming all-software learning coverage.");
const maxRows = Number(argValue("--max-rows", "160"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-log-source-discovery-ledgers")));

mkdirSync(outputRoot, { recursive: true });
const ledgerId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const ledgerDir = join(outputRoot, ledgerId);
mkdirSync(ledgerDir, { recursive: true });

const candidates = Array.isArray(inventoryInput.value?.softwareCandidates)
  ? inventoryInput.value.softwareCandidates.map(normalizeCandidate)
  : [];
const queueItems = Array.isArray(queueInput.value?.queue)
  ? queueInput.value.queue.map(normalizeQueueItem)
  : Array.isArray(queueInput.value?.items)
    ? queueInput.value.items.map(normalizeQueueItem)
    : [];
const queueByKey = mapByKeys(queueItems);

const rows = candidates.slice(0, maxRows).map((candidate, index) => {
  const queueItem = keyVariants(candidate).map((key) => queueByKey.get(key)).find(Boolean) || null;
  const exclusion = explicitExclusionFor(candidate, exclusions);
  const status = discoveryStatus(candidate, queueItem, exclusion);
  const directLogCandidateCount =
    (candidate.candidateLogFiles?.length || 0) +
    (queueItem?.recentLogCandidates?.length || 0) +
    (queueItem?.candidateLogFiles?.length || 0);
  return {
    ledgerNumber: index + 1,
    software: candidate.software,
    processName: candidate.processName,
    windowTitle: candidate.windowTitle,
    installPath: candidate.installPath,
    discoveryStatus: status,
    teacherExcluded: Boolean(exclusion),
    queueItemPresent: Boolean(queueItem),
    directLogCandidateCount,
    candidateLogRootCount: candidate.candidateLogRoots?.length || 0,
    windowsEventLogCount: candidate.windowsEventLogs?.length || 0,
    nonLogFallbackSignalCount: queueItem?.nonLogFallbackSignals?.length || 0,
    canAttemptAutomaticLogReadAfterMetadataGate: status === "direct_log_candidates_ready_for_metadata_gate",
    logReadRequiresTrigger: directLogCandidateCount > 0,
    nextActions: nextActionsFor(status, candidate, queueItem, {
      inventoryPath: inventoryInput.path,
      queuePath: queueInput.path
    }),
    locks: locks()
  };
});

const counts = {
  totalInventoryRows: candidates.length,
  ledgerRows: rows.length,
  directLogCandidatesReadyForMetadataGate: rows.filter((row) => row.discoveryStatus === "direct_log_candidates_ready_for_metadata_gate").length,
  nonLogLowTokenFallbackReadyForReview: rows.filter((row) => row.discoveryStatus === "non_log_low_token_fallback_ready_for_review").length,
  windowsEventLogFallbackReadyForReview: rows.filter((row) => row.discoveryStatus === "windows_event_log_fallback_ready_for_review").length,
  candidateRootsNeedBoundedScan: rows.filter((row) => row.discoveryStatus === "candidate_roots_need_bounded_scan").length,
  needsTeacherLogSourceOrExclusion: rows.filter((row) => row.discoveryStatus === "needs_teacher_log_source_or_exclusion").length,
  teacherExcludedOrPrivate: rows.filter((row) => row.discoveryStatus === "teacher_excluded_or_private").length
};

const allRowsHaveSourceRoute =
  rows.length > 0 &&
  rows.every((row) => row.discoveryStatus !== "needs_teacher_log_source_or_exclusion");
const allSoftwareLogSourceDiscoveryComplete =
  rows.length > 0 &&
  allRowsHaveSourceRoute &&
  counts.needsTeacherLogSourceOrExclusion === 0 &&
  counts.candidateRootsNeedBoundedScan === 0;
const status =
  rows.length === 0
    ? "no_inventory_rows"
    : counts.needsTeacherLogSourceOrExclusion > 0
      ? "waiting_for_teacher_log_source_or_exclusion"
      : allRowsHaveSourceRoute
        ? "all_rows_have_reviewable_low_token_source_route_waiting_for_teacher_review"
        : "waiting_for_low_token_source_route_review";
const ledgerPath = join(ledgerDir, "all-software-log-source-discovery-ledger.json");
const receiptPath = join(ledgerDir, "all-software-log-source-discovery-ledger-receipt.json");
const readmePath = join(ledgerDir, "ALL_SOFTWARE_LOG_SOURCE_DISCOVERY_LEDGER_START_HERE.md");

const ledger = {
  format: "transparent_ai_all_software_log_source_discovery_ledger_v1",
  ledgerId,
  createdAt: new Date().toISOString(),
  goal,
  sourceEvidence: {
    inventoryPath: inventoryInput.path,
    inventoryFormat: inventoryInput.value?.format || "",
    queuePath: queueInput.path,
    queueFormat: queueInput.value?.format || "",
    teacherExcludedSoftware: exclusions
  },
  status,
  counts,
  rows,
  allRowsHaveSourceRoute,
  allSoftwareLogSourceDiscoveryComplete,
  completionBoundary: {
    allSoftwareLogSourceDiscoveryComplete,
    reason:
      "This ledger proves every bounded inventory row has a current log-source route or a specific missing-source question. It does not prove every app on the computer is fully learned.",
    requiredBeforeCompletion: [
      "real local inventory has been widened to the teacher-approved scope",
      "every in-scope row has a direct log route, event/file/process fallback, or teacher-provided marker",
      "metadata gates run before any bounded tail read",
      "teacher reviews no-log fallback routes before screenshots",
      "coverage enrollment and learning-cycle ledgers are rerun after source discovery"
    ]
  },
  nextReviewQueue: rows
    .filter((row) => row.discoveryStatus !== "direct_log_candidates_ready_for_metadata_gate" && !row.teacherExcluded)
    .map((row) => ({
      ledgerNumber: row.ledgerNumber,
      software: row.software,
      discoveryStatus: row.discoveryStatus,
      nextActions: row.nextActions
    })),
  locks: locks(allSoftwareLogSourceDiscoveryComplete)
};

const receipt = {
  format: "transparent_ai_all_software_log_source_discovery_ledger_receipt_v1",
  ledgerId,
  ledgerPath,
  status,
  counts,
  allRowsHaveSourceRoute,
  allSoftwareLogSourceDiscoveryComplete,
  nextReviewQueueCount: ledger.nextReviewQueue.length,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All-Software Log Source Discovery Ledger",
    "",
    `Inventory: ${inventoryInput.path}`,
    `Queue: ${queueInput.path || "(not provided)"}`,
    "",
    "This ledger is the per-software source map for the original low-token learning goal.",
    `Status: ${status}`,
    "",
    "A software row is not treated as learnable from logs until it has either direct log candidates behind a metadata gate or a reviewed low-token fallback route such as Windows Events, file modified-time deltas, process/window metadata, or a teacher marker.",
    "",
    "Next:",
    "",
    "1. Run metadata gates only for `direct_log_candidates_ready_for_metadata_gate` rows.",
    "2. Review `non_log_low_token_fallback_ready_for_review` and `windows_event_log_fallback_ready_for_review` rows before any screenshot.",
    "3. Ask the teacher for rows marked `needs_teacher_log_source_or_exclusion`.",
    "4. Rerun coverage enrollment and learning-cycle ledgers after source routes are reviewed.",
    "",
    "Locked defaults: logContentsRead=false, fullLogsRead=false, screenshotsCaptured=false, softwareActionsExecuted=false, memoryWritten=false, nativeUniversalExecution=false, accepted=false, ruleEnabled=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_all_software_log_source_discovery_ledger_result_v1",
  ledgerId,
  ledgerPath,
  receiptPath,
  teacherReadme: readmePath,
  status,
  counts,
  allRowsHaveSourceRoute,
  allSoftwareLogSourceDiscoveryComplete,
  nextReviewQueueCount: ledger.nextReviewQueue.length,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  locks: locks()
}, null, 2));
