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
  return String(value || "all-software-coverage-enrollment-ledger")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-enrollment-ledger";
}

function readJsonInput(input, label, optional = false) {
  if (!input) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const text = String(input).trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{") || text.startsWith("[")) return { value: JSON.parse(text), path: "" };
  if (optional) return { value: { reference: text }, path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    screenshotsCapturedByThisTool: false,
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
    windowTitle: String(row.windowTitle || ""),
    recentLogCandidates: Array.isArray(row.recentLogCandidates) ? row.recentLogCandidates : [],
    candidateLogFiles: Array.isArray(row.candidateLogFiles) ? row.candidateLogFiles : [],
    nonLogFallbackRequired: row.nonLogFallbackRequired === true,
    nonLogFallbackSignals: Array.isArray(row.nonLogFallbackSignals) ? row.nonLogFallbackSignals : [],
    lowTokenSignals: Array.isArray(row.lowTokenSignals) ? row.lowTokenSignals : [],
    nextMetadataDeltaGateCall: row.nextMetadataDeltaGateCall || null,
    nextRunCall: row.nextRunCall || null,
    nextNonLogFallbackRunCall: row.nextNonLogFallbackRunCall || null,
    nextDeltaMonitorCall: row.nextDeltaMonitorCall || null
  };
}

function coverageAuditRows(value) {
  if (!value || typeof value !== "object") return [];
  return Array.isArray(value.rows) ? value.rows : Array.isArray(value.coverageRows) ? value.coverageRows : [];
}

function logSourceRows(value) {
  if (!value || typeof value !== "object") return [];
  return Array.isArray(value.rows) ? value.rows : [];
}

function convergenceRows(value) {
  if (!value || typeof value !== "object") return [];
  return Array.isArray(value.batchRows) ? value.batchRows : [];
}

function evidenceRows(paths) {
  const byKey = new Map();
  for (const input of paths) {
    const parsed = readJsonInput(input, "--evidence", true);
    const value = parsed.value;
    if (!value || typeof value !== "object") continue;
    const rows = [
      ...(Array.isArray(value.changedItems) ? value.changedItems : []),
      ...(Array.isArray(value.learningEvents) ? value.learningEvents : []),
      ...(Array.isArray(value.compactLearningEvents) ? value.compactLearningEvents : []),
      ...(Array.isArray(value.watchRuns) ? value.watchRuns.flatMap((run) => run.changedItems || run.items || []) : []),
      ...(Array.isArray(value.queueItemRuns) ? value.queueItemRuns : []),
      ...(Array.isArray(value.batchRows) ? value.batchRows : [])
    ];
    for (const row of rows) {
      for (const key of keyVariants(row)) {
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push({
          sourcePath: parsed.path,
          format: value.format || "",
          status: row.status || row.coverageStatus || row.classification || "observed"
        });
      }
    }
  }
  return byKey;
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
  return exclusions.find((item) => {
    const text = String(item || "").toLowerCase().trim();
    return text && keys.has(text);
  }) || "";
}

function enrollmentStatus({ candidate, queueItem, coverageRow, logSourceRow, evidence, exclusion }) {
  if (exclusion) return "teacher_excluded_or_private";
  const logSourceStatus = String(logSourceRow?.discoveryStatus || "");
  const queueLogs =
    (queueItem?.recentLogCandidates?.length || 0) +
    (queueItem?.candidateLogFiles?.length || 0) +
    Number(logSourceRow?.directLogCandidateCount || 0);
  const fallbackSignals =
    (queueItem?.nonLogFallbackSignals?.length || 0) + Number(logSourceRow?.nonLogFallbackSignalCount || 0);
  const windowsEventSignals = Number(logSourceRow?.windowsEventLogCount || 0);
  const auditStatus = String(coverageRow?.coverageStatus || "");
  const hasWatchEvidence = (evidence?.length || 0) > 0 || Number(coverageRow?.watchEvidenceCount || 0) > 0;
  const inventorySignals =
    (candidate.candidateLogFiles?.length || 0) +
    (candidate.candidateLogRoots?.length || 0) +
    (candidate.windowsEventLogs?.length || 0) +
    Number(logSourceRow?.candidateLogRootCount || 0) +
    windowsEventSignals;

  if (
    (queueLogs > 0 ||
      auditStatus.includes("log_route") ||
      logSourceStatus === "direct_log_candidates_ready_for_metadata_gate") &&
    hasWatchEvidence
  ) {
    return "enrolled_log_route_with_watch_evidence";
  }
  if (
    queueLogs > 0 ||
    auditStatus.includes("log_route") ||
    logSourceStatus === "direct_log_candidates_ready_for_metadata_gate"
  ) {
    return "enrolled_log_route_waiting_for_watch_evidence";
  }
  if (
    (fallbackSignals > 0 || auditStatus.includes("non_log") || logSourceStatus === "non_log_low_token_fallback_ready_for_review") &&
    hasWatchEvidence
  ) {
    return "enrolled_non_log_fallback_with_watch_evidence";
  }
  if (fallbackSignals > 0 || auditStatus.includes("non_log") || logSourceStatus === "non_log_low_token_fallback_ready_for_review") {
    return "enrolled_non_log_fallback_waiting_for_watch_evidence";
  }
  if (
    (windowsEventSignals > 0 || logSourceStatus === "windows_event_log_fallback_ready_for_review") &&
    hasWatchEvidence
  ) {
    return "enrolled_windows_event_fallback_with_watch_evidence";
  }
  if (windowsEventSignals > 0 || logSourceStatus === "windows_event_log_fallback_ready_for_review") {
    return "enrolled_windows_event_fallback_waiting_for_watch_evidence";
  }
  if (inventorySignals > 0) return "inventory_signal_waiting_for_queue_enrollment";
  return "needs_teacher_signal_or_exclusion";
}

function nextActionsFor(status, candidate, queueItem, paths) {
  if (status === "teacher_excluded_or_private") return ["keep_exclusion_locked_until_teacher_changes_scope"];
  if (status.endsWith("_with_watch_evidence")) return ["teacher_review_coverage_receipt_before_acceptance"];
  if (status.includes("waiting_for_watch_evidence")) {
    return [
      "run_watch_log_source_metadata_deltas_or_queue_item",
      queueItem?.nextMetadataDeltaGateCall || { tool: "watch_log_source_metadata_deltas", arguments: { queue: paths.queuePath || "<queue path>" } },
      queueItem?.nextRunCall || { tool: "run_software_observer_queue_item", arguments: { queue: paths.queuePath || "<queue path>" } }
    ];
  }
  if (status === "inventory_signal_waiting_for_queue_enrollment") {
    return [
      "create_or_extend_software_observer_queue",
      { tool: "create_software_observer_queue", arguments: { inventory: paths.inventoryPath || "<inventory path>" } }
    ];
  }
  return [
    "ask_teacher_for_low_token_signal_or_exclusion",
    {
      tool: "teach_apprentice",
      arguments: {
        whatToTeach: `Need a low-token learning signal for ${candidate.software}`,
        message: "Please choose a log path, export folder, Windows Event source, manual marker, or mark this software as private/out of scope."
      }
    }
  ];
}

const inventoryInput = readJsonInput(argValue("--inventory", argValue("--inventory-path", "")), "--inventory");
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue", true);
const coverageInput = readJsonInput(argValue("--coverage-audit", argValue("--audit", "")), "--coverage-audit", true);
const convergenceInput = readJsonInput(argValue("--convergence-audit", argValue("--convergence", "")), "--convergence-audit", true);
const logSourceInput = readJsonInput(
  argValue("--log-source-discovery-ledger", argValue("--source-discovery-ledger", "")),
  "--log-source-discovery-ledger",
  true
);
const exclusions = [...argValues("--exclude"), ...argValues("--teacher-excluded")];
const evidenceByKey = evidenceRows([...argValues("--watch-cycle"), ...argValues("--learning-cycle"), ...argValues("--evidence")]);
const goal = argValue("--goal", "Build a per-software enrollment ledger before claiming all-software low-token coverage.");
const maxRows = Number(argValue("--max-rows", "120"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-ledgers")));

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
const auditByKey = mapByKeys(coverageAuditRows(coverageInput.value));
const logSourceByKey = mapByKeys(logSourceRows(logSourceInput.value));
const convergence = convergenceInput.value || {};

const rows = candidates.slice(0, maxRows).map((candidate, index) => {
  const keys = keyVariants(candidate);
  const queueItem = keys.map((key) => queueByKey.get(key)).find(Boolean) || null;
  const coverageRow = keys.map((key) => auditByKey.get(key)).find(Boolean) || null;
  const logSourceRow = keys.map((key) => logSourceByKey.get(key)).find(Boolean) || null;
  const evidence = keys.flatMap((key) => evidenceByKey.get(key) || []);
  const exclusion = explicitExclusionFor(candidate, exclusions);
  const status = enrollmentStatus({ candidate, queueItem, coverageRow, logSourceRow, evidence, exclusion });
  const readyForTeacherCoverageReview = status.endsWith("_with_watch_evidence");
  const candidateLogFileCount =
    (candidate.candidateLogFiles?.length || 0) +
    (queueItem?.recentLogCandidates?.length || 0) +
    Number(logSourceRow?.directLogCandidateCount || 0);
  const candidateLogRootCount = Math.max(
    candidate.candidateLogRoots?.length || 0,
    Number(logSourceRow?.candidateLogRootCount || 0)
  );
  const windowsEventLogCount = Math.max(
    candidate.windowsEventLogs?.length || 0,
    Number(logSourceRow?.windowsEventLogCount || 0)
  );
  const nonLogFallbackSignalCount =
    (queueItem?.nonLogFallbackSignals?.length || 0) + Number(logSourceRow?.nonLogFallbackSignalCount || 0);
  return {
    ledgerNumber: index + 1,
    software: candidate.software,
    processName: candidate.processName,
    windowTitle: candidate.windowTitle,
    installPath: candidate.installPath,
    status,
    logSourceDiscoveryStatus: String(logSourceRow?.discoveryStatus || ""),
    logSourceRoutePresent: Boolean(logSourceRow),
    readyForTeacherCoverageReview,
    teacherExcluded: Boolean(exclusion),
    queueItemPresent: Boolean(queueItem) || logSourceRow?.queueItemPresent === true,
    coverageAuditStatus: coverageRow?.coverageStatus || "",
    candidateLogFileCount,
    candidateLogRootCount,
    windowsEventLogCount,
    nonLogFallbackSignalCount,
    watchEvidenceCount: evidence.length + Number(coverageRow?.watchEvidenceCount || 0),
    evidence,
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
  teacherExcludedOrPrivate: rows.filter((row) => row.status === "teacher_excluded_or_private").length,
  enrolledWithWatchEvidence: rows.filter((row) => row.status.endsWith("_with_watch_evidence")).length,
  enrolledWaitingForWatchEvidence: rows.filter((row) => row.status.includes("waiting_for_watch_evidence")).length,
  inventorySignalWaitingForQueueEnrollment: rows.filter((row) => row.status === "inventory_signal_waiting_for_queue_enrollment").length,
  needsTeacherSignalOrExclusion: rows.filter((row) => row.status === "needs_teacher_signal_or_exclusion").length,
  queueItemsSeen: queueItems.length,
  coverageAuditRowsSeen: coverageAuditRows(coverageInput.value).length,
  logSourceDiscoveryRowsSeen: logSourceRows(logSourceInput.value).length,
  rowsWithLogSourceRoute: rows.filter((row) => row.logSourceRoutePresent).length,
  convergenceBatchRowsSeen: convergenceRows(convergence).length
};

const allRowsAccountedFor =
  counts.ledgerRows > 0 &&
  counts.ledgerRows === counts.totalInventoryRows &&
  rows.every((row) => row.readyForTeacherCoverageReview || row.teacherExcluded);
const allSoftwareCoverageComplete = false;
const ledgerPath = join(ledgerDir, "all-software-coverage-enrollment-ledger.json");
const receiptPath = join(ledgerDir, "all-software-coverage-enrollment-ledger-receipt.json");
const readmePath = join(ledgerDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_LEDGER_START_HERE.md");

const ledger = {
  format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
  ledgerId,
  createdAt: new Date().toISOString(),
  goal,
  sourceEvidence: {
    inventoryPath: inventoryInput.path,
    inventoryFormat: inventoryInput.value?.format || "",
    queuePath: queueInput.path,
    queueFormat: queueInput.value?.format || "",
    logSourceDiscoveryLedgerPath: logSourceInput.path,
    logSourceDiscoveryLedgerFormat: logSourceInput.value?.format || "",
    coverageAuditPath: coverageInput.path,
    coverageAuditFormat: coverageInput.value?.format || "",
    convergenceAuditPath: convergenceInput.path,
    convergenceAuditFormat: convergence.format || "",
    teacherExcludedSoftware: exclusions
  },
  counts,
  rows,
  allRowsAccountedFor,
  allSoftwareCoverageComplete,
  completionBoundary: {
    allSoftwareCoverageComplete,
    reason:
      "This ledger proves per-software enrollment status for the bounded inventory, not universal unattended coverage for every possible app.",
    requiredBeforeCompletion: [
      "every in-scope row has watch or compact-learning evidence",
      "private/out-of-scope rows have explicit teacher exclusions",
      "coverage audit and enrollment ledger are rerun after inventory expansion",
      "teacher reviews the final ledger receipt",
      "native semantic control remains a separate proof requirement"
    ]
  },
  nextReviewQueue: rows
    .filter((row) => !row.readyForTeacherCoverageReview && !row.teacherExcluded)
    .map((row) => ({
      ledgerNumber: row.ledgerNumber,
      software: row.software,
      status: row.status,
      logSourceDiscoveryStatus: row.logSourceDiscoveryStatus,
      nextActions: row.nextActions
    })),
  locks: locks()
};

const receipt = {
  format: "transparent_ai_all_software_coverage_enrollment_ledger_receipt_v1",
  ledgerId,
  ledgerPath,
  counts,
  allRowsAccountedFor,
  allSoftwareCoverageComplete,
  nextReviewQueueCount: ledger.nextReviewQueue.length,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fileContentsRead: false,
  softwareActionsExecuted: false,
  scheduledTaskInstalled: false,
  nativeUniversalExecution: false,
  memoryWritten: false,
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
    "# All-Software Coverage Enrollment Ledger",
    "",
    `Inventory: ${inventoryInput.path}`,
    `Queue: ${queueInput.path || "(not provided)"}`,
    `Coverage audit: ${coverageInput.path || "(not provided)"}`,
    "",
    "This is the closure ledger for the all-software low-token learning goal.",
    "",
    "A row is not complete just because it was discovered. It must either have low-token watch/learning evidence, or the teacher must explicitly exclude it as private or out of scope.",
    "",
    "Next:",
    "",
    "1. Review `all-software-coverage-enrollment-ledger.json`.",
    "2. For every row in `nextReviewQueue`, run the listed low-token queue/watch action or add a teacher exclusion.",
    "3. Rerun the ledger after widening inventory and after recurring monitor output audits.",
    "4. Do not claim all-software coverage until the final teacher-reviewed ledger has no in-scope gaps.",
    "",
    "Locked defaults: fullContinuousRecording=false, screenshotsCapturedByThisTool=false, logContentsRead=false, softwareActionsExecuted=false, memoryWritten=false, nativeUniversalExecution=false, accepted=false, ruleEnabled=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_ledger_result_v1",
      ledgerId,
      ledgerPath,
      receiptPath,
      teacherReadme: readmePath,
      counts,
      allRowsAccountedFor,
      allSoftwareCoverageComplete,
      nextReviewQueueCount: ledger.nextReviewQueue.length,
      screenshotsCapturedByThisTool: false,
      fullContinuousRecording: false,
      logContentsRead: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      memoryWritten: false,
      locks: locks()
    },
    null,
    2
  )
);
