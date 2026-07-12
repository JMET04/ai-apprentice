#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  return String(value || "all-software-observer-coverage-audit")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-observer-coverage-audit";
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
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    memoryWritten: false,
    teacherConfirmationRequired: true
  };
}

function candidateKey(row = {}) {
  return String(row.queueItemId || row.software || row.processName || row.name || "unknown software").toLowerCase();
}

function keyVariants(row = {}) {
  return [
    row.queueItemId,
    row.software,
    row.processName,
    row.name,
    row.displayName
  ]
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean);
}

function normalizeInventoryCandidate(row = {}) {
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
    nextProfileCall: row.nextProfileCall || null,
    nextObserverCall: row.nextObserverCall || null,
    nextRunCall: row.nextRunCall || null
  };
}

function watchEvidenceByKey(paths) {
  const evidence = new Map();
  for (const path of paths) {
    const parsed = readJsonInput(path, "--watch-cycle/--learning-cycle", true);
    const value = parsed.value;
    if (!value || typeof value !== "object") continue;
    const rows = [
      ...(Array.isArray(value.changedItems) ? value.changedItems : []),
      ...(Array.isArray(value.watchRuns) ? value.watchRuns.flatMap((run) => run.changedItems || []) : []),
      ...(Array.isArray(value.metadataGateRuns) ? value.metadataGateRuns.flatMap((run) => run.changedItems || []) : []),
      ...(Array.isArray(value.learningRuns) ? value.learningRuns : []),
      ...(Array.isArray(value.learningEvents) ? value.learningEvents : []),
      ...(Array.isArray(value.compactLearningEvents) ? value.compactLearningEvents : [])
    ];
    for (const row of rows) {
      for (const key of keyVariants(row)) {
        if (!evidence.has(key)) evidence.set(key, []);
        evidence.get(key).push({
          sourcePath: parsed.path,
          format: value.format || "",
          status: row.status || row.classification || row.eventType || "observed",
          lowTokenEvidence: true
        });
      }
    }
  }
  return evidence;
}

function coverageStatus({ inventoryCandidate, queueItem, watchEvidence }) {
  const inventoryLogs = inventoryCandidate?.candidateLogFiles?.length || 0;
  const queueLogs = (queueItem?.recentLogCandidates?.length || 0) + (queueItem?.candidateLogFiles?.length || 0);
  const fallbackSignals = queueItem?.nonLogFallbackSignals?.length || 0;
  const windowsEvents = inventoryCandidate?.windowsEventLogs?.length || 0;
  const roots = inventoryCandidate?.candidateLogRoots?.length || 0;
  const watchCount = watchEvidence?.length || 0;

  if (queueLogs > 0 && watchCount > 0) return "covered_with_log_route_and_watch_evidence";
  if (queueLogs > 0) return "covered_with_log_metadata_route";
  if (fallbackSignals > 0 && watchCount > 0) return "covered_with_non_log_fallback_and_watch_evidence";
  if (fallbackSignals > 0 || windowsEvents > 0 || roots > 0) return "covered_with_non_log_fallback_route";
  if (inventoryLogs > 0) return "inventory_logs_waiting_for_queue";
  return "needs_teacher_review_or_manual_signal";
}

function routeType(status) {
  if (status.includes("log_route")) return "log_metadata_then_tail_on_trigger";
  if (status.includes("non_log")) return "windows_event_process_file_delta_or_teacher_marker";
  if (status.includes("inventory_logs")) return "queue_not_built_yet";
  return "coverage_gap";
}

const inventoryInput = readJsonInput(argValue("--inventory", argValue("--inventory-path", "")), "--inventory", true);
const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue", true);
const watchPaths = [...argValues("--watch-cycle"), ...argValues("--learning-cycle"), ...argValues("--evidence")];
const goal = argValue("--goal", "Audit all-software low-token observer coverage before claiming broad learning.");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-observer-coverage-audits")));
const maxRows = Number(argValue("--max-rows", "80"));

mkdirSync(outputRoot, { recursive: true });
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });

const inventoryCandidates = Array.isArray(inventoryInput.value?.softwareCandidates)
  ? inventoryInput.value.softwareCandidates.map(normalizeInventoryCandidate)
  : [];
const queueItems = Array.isArray(queueInput.value?.queue)
  ? queueInput.value.queue.map(normalizeQueueItem)
  : Array.isArray(queueInput.value?.items)
    ? queueInput.value.items.map(normalizeQueueItem)
    : [];
const queueByKey = new Map();
for (const item of queueItems) {
  for (const key of keyVariants(item)) {
    if (!queueByKey.has(key)) queueByKey.set(key, item);
  }
}
const watchByKey = watchEvidenceByKey(watchPaths);

const baseRows = inventoryCandidates.length > 0
  ? inventoryCandidates
  : queueItems.map((item) => ({
      software: item.software,
      processName: item.processName,
      windowTitle: item.windowTitle,
      installPath: "",
      candidateLogFiles: [],
      candidateLogRoots: [],
      windowsEventLogs: [],
      reason: "queue_only"
    }));

const rows = baseRows.slice(0, maxRows).map((candidate) => {
  const keys = keyVariants(candidate);
  const queueItem = keys.map((key) => queueByKey.get(key)).find(Boolean) || null;
  const seenWatch = new Set();
  const watchEvidence = keys
    .flatMap((key) => watchByKey.get(key) || [])
    .filter((item) => {
      const id = `${item.sourcePath}|${item.format}|${item.status}`;
      if (seenWatch.has(id)) return false;
      seenWatch.add(id);
      return true;
    });
  const status = coverageStatus({ inventoryCandidate: candidate, queueItem, watchEvidence });
  const gaps = [];
  if (!queueItem) gaps.push("missing_observer_queue_item");
  if (status === "needs_teacher_review_or_manual_signal") gaps.push("missing_log_or_non_log_signal");
  if (status === "inventory_logs_waiting_for_queue") gaps.push("inventory_log_sources_not_promoted_to_queue");
  if (watchEvidence.length === 0) gaps.push("no_watch_or_learning_cycle_evidence_yet");

  return {
    software: candidate.software,
    processName: candidate.processName,
    windowTitle: candidate.windowTitle,
    coverageStatus: status,
    routeType: routeType(status),
    candidateLogFileCount: (candidate.candidateLogFiles?.length || 0) + (queueItem?.recentLogCandidates?.length || 0),
    candidateLogRootCount: candidate.candidateLogRoots?.length || 0,
    nonLogFallbackSignalCount: queueItem?.nonLogFallbackSignals?.length || 0,
    watchEvidenceCount: watchEvidence.length,
    queueItemPresent: Boolean(queueItem),
    gaps,
    nextRepairCalls:
      gaps.length === 0
        ? []
        : [
            !queueItem && inventoryInput.path
              ? { tool: "create_software_observer_queue", arguments: { inventory: inventoryInput.path, maxCandidates: maxRows } }
              : null,
            status === "needs_teacher_review_or_manual_signal"
              ? {
                  tool: "teach_apprentice",
                  arguments: {
                    whatToTeach: `Need a low-token signal for ${candidate.software}`,
                    message: "Please provide a log path, export folder, Windows Event source, or manual teacher marker for this software."
                  }
                }
              : null,
            queueItem
              ? { tool: "watch_log_source_metadata_deltas", arguments: { queue: queueInput.path || "<queue path>", maxItems: 1 } }
              : null
          ].filter(Boolean),
    locks: locks()
  };
});

const counts = {
  totalAudited: rows.length,
  coveredWithLogRoute: rows.filter((row) => row.coverageStatus.includes("log_route")).length,
  coveredWithNonLogFallback: rows.filter((row) => row.coverageStatus.includes("non_log_fallback")).length,
  inventoryLogsWaitingForQueue: rows.filter((row) => row.coverageStatus === "inventory_logs_waiting_for_queue").length,
  needsTeacherReviewOrManualSignal: rows.filter((row) => row.coverageStatus === "needs_teacher_review_or_manual_signal").length,
  withWatchEvidence: rows.filter((row) => row.watchEvidenceCount > 0).length,
  missingQueueItem: rows.filter((row) => row.gaps.includes("missing_observer_queue_item")).length
};

const auditPath = join(auditDir, "all-software-observer-coverage-audit.json");
const receiptPath = join(auditDir, "all-software-observer-coverage-audit-receipt.json");
const readmePath = join(auditDir, "ALL_SOFTWARE_OBSERVER_COVERAGE_AUDIT_START_HERE.md");
const repairPlanPath = join(auditDir, "coverage-repair-plan.json");

const audit = {
  format: "transparent_ai_all_software_observer_coverage_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  sourceEvidence: {
    inventoryPath: inventoryInput.path,
    inventoryFormat: inventoryInput.value?.format || "",
    queuePath: queueInput.path,
    queueFormat: queueInput.value?.format || "",
    watchEvidencePaths: watchPaths
  },
  counts,
  coverageRows: rows,
  policy: {
    allSoftwareDoesNotMeanAllAppsExposeLogs: true,
    logRoutePreferred: true,
    nonLogFallbackAllowedBeforeScreenshots: true,
    screenshotsOnlyAfterCoverageGapOrAmbiguity: true,
    teacherMustExcludePrivateApps: true,
    lowTokenBeforeTailRead: true
  },
  locks: locks()
};

const repairPlan = {
  format: "transparent_ai_all_software_observer_coverage_repair_plan_v1",
  auditId,
  defaultNextTool: "create_software_observer_queue",
  repairItems: rows
    .filter((row) => row.gaps.length > 0)
    .map((row) => ({
      software: row.software,
      coverageStatus: row.coverageStatus,
      gaps: row.gaps,
      nextRepairCalls: row.nextRepairCalls,
      teacherReviewRequired: true
    })),
  blockedActions: [
    "claim_all_software_covered_without_audit",
    "read_full_logs_by_default",
    "start_continuous_recording",
    "capture_screenshot_without_trigger",
    "write_memory_from_coverage_audit",
    "execute_software",
    "unlock_packaging"
  ],
  locks: locks()
};

const receipt = {
  format: "transparent_ai_all_software_observer_coverage_audit_receipt_v1",
  auditId,
  status: counts.needsTeacherReviewOrManualSignal > 0 || counts.missingQueueItem > 0
    ? "coverage_gaps_waiting_for_teacher_review"
    : "coverage_routes_ready_for_low_token_watch_review",
  totalAudited: counts.totalAudited,
  coveredWithLogRoute: counts.coveredWithLogRoute,
  coveredWithNonLogFallback: counts.coveredWithNonLogFallback,
  needsTeacherReviewOrManualSignal: counts.needsTeacherReviewOrManualSignal,
  logContentsRead: false,
  fullLogsRead: false,
  fileContentsRead: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeFileSync(repairPlanPath, `${JSON.stringify(repairPlan, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All Software Observer Coverage Audit",
    "",
    `Status: ${receipt.status}`,
    "",
    `Audited software rows: ${counts.totalAudited}`,
    `Covered with log metadata route: ${counts.coveredWithLogRoute}`,
    `Covered with non-log fallback route: ${counts.coveredWithNonLogFallback}`,
    `Needs teacher/manual signal: ${counts.needsTeacherReviewOrManualSignal}`,
    "",
    "Review order:",
    "1. Exclude private or out-of-scope software.",
    "2. For coverage gaps, add a log path, export folder, Windows Event source, or teacher marker.",
    "3. Promote inventory log sources into a reviewed observer queue.",
    "4. Run metadata delta gates before bounded tail reads.",
    "5. Request screenshots only after a meaningful low-token trigger or ambiguity.",
    "",
    "This audit reads only existing JSON evidence and metadata counts. It does not read logs, capture screenshots, execute software, write memory, accept outcomes, enable rules, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_observer_coverage_audit_result_v1",
      auditId,
      status: receipt.status,
      auditPath,
      receiptPath,
      repairPlanPath,
      readme: readmePath,
      counts,
      logContentsRead: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      reviewLocks: locks()
    },
    null,
    2
  )
);
