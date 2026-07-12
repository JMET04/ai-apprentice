#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return String(value || "all-software-coverage-expansion-plan")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-expansion-plan";
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
    scheduledTaskInstalled: false,
    teacherConfirmationRequired: true
  };
}

function normalizeSoftware(row = {}, index = 0) {
  return {
    id: slugify(row.queueItemId || row.software || row.name || row.processName || `software-${index + 1}`),
    software: String(row.software || row.name || row.displayName || row.processName || "unknown software"),
    processName: String(row.processName || ""),
    windowTitle: String(row.windowTitle || row.mainWindowTitle || ""),
    candidateLogFiles: Array.isArray(row.candidateLogFiles) ? row.candidateLogFiles : [],
    candidateLogRoots: Array.isArray(row.candidateLogRoots) ? row.candidateLogRoots : [],
    windowsEventLogs: Array.isArray(row.windowsEventLogs) ? row.windowsEventLogs : [],
    lowTokenSignals: Array.isArray(row.lowTokenSignals) ? row.lowTokenSignals : [],
    nonLogFallbackSignals: Array.isArray(row.nonLogFallbackSignals) ? row.nonLogFallbackSignals : [],
    raw: row
  };
}

function rowsFromEvidence({ inventory, audit, repairQueue, runner }) {
  const rows = [];
  const seen = new Set();
  const add = (row, source, index) => {
    const normalized = normalizeSoftware(row, index);
    const key = `${normalized.software}|${normalized.processName}|${normalized.windowTitle}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ ...normalized, source });
  };

  const inventoryRows = Array.isArray(inventory?.softwareCandidates) ? inventory.softwareCandidates : [];
  inventoryRows.forEach((row, index) => add(row, "inventory", index));

  const auditRows = Array.isArray(audit?.coverageRows) ? audit.coverageRows : [];
  auditRows.forEach((row, index) => add(row, "coverage_audit", index));

  const repairRows = Array.isArray(repairQueue?.repairItems) ? repairQueue.repairItems : [];
  repairRows.forEach((row, index) => add(row, "repair_queue", index));

  const runnerRows = Array.isArray(runner?.runRecords)
    ? runner.runRecords.flatMap((record) => record.softwareItems || record.changedItems || [])
    : [];
  runnerRows.forEach((row, index) => add(row, "automatic_runner", index));

  return rows;
}

function rowRisk(row) {
  const text = `${row.software} ${row.processName} ${row.windowTitle}`.toLowerCase();
  if (text.includes("private") || text.includes("secret") || text.includes("personal") || text.includes("credential")) return "needs_exclusion_review";
  if (row.software === "unknown software" || text.includes("unknown")) return "needs_identity_review";
  return "normal_review";
}

function signalStatus(row, auditRowsByName, repairRowsByName) {
  const key = row.software.toLowerCase();
  const auditRow = auditRowsByName.get(key);
  const repairRow = repairRowsByName.get(key);
  const coverageStatus = String(auditRow?.coverageStatus || repairRow?.coverageStatus || "");
  const actionKind = String(repairRow?.actionKind || "");
  const logSignals = row.candidateLogFiles.length + row.candidateLogRoots.length;
  const fallbackSignals = row.windowsEventLogs.length + row.lowTokenSignals.length + row.nonLogFallbackSignals.length;
  if (coverageStatus.includes("watch_evidence")) return "has_watch_evidence";
  if (coverageStatus.includes("log_metadata_route") || logSignals > 0) return "has_log_metadata_route";
  if (coverageStatus.includes("non_log_fallback") || fallbackSignals > 0 || actionKind === "validate_non_log_fallback_signal") {
    return "has_non_log_fallback_route";
  }
  if (actionKind) return "needs_repair_queue_action";
  return "needs_low_token_signal_discovery";
}

function nextCallsFor(row, status, paths, batchId) {
  if (status === "has_log_metadata_route") {
    return [
      {
        tool: "create_software_observer_queue",
        arguments: { inventory: paths.inventoryPath || "<reviewed inventory path>", maxCandidates: 1, software: row.software }
      },
      {
        tool: "watch_log_source_metadata_deltas",
        arguments: { queue: "<reviewed observer queue path>", maxItems: 1 }
      },
      {
        tool: "run_automatic_low_token_learning_runner",
        arguments: { queue: "<reviewed observer queue path>", runs: 2, maxItems: 1, stateDir: `<persistent state for ${batchId}>` }
      }
    ];
  }
  if (status === "has_non_log_fallback_route") {
    return [
      {
        tool: "create_universal_software_observer_kit",
        arguments: { software: row.software, processName: row.processName, teacherMarkerRequired: true }
      },
      {
        tool: "create_triggered_visual_check_request",
        arguments: {
          deltaMonitor: "<meaningful non-log delta result>",
          maxScreenshots: 1,
          note: "Only after teacher review confirms visual grounding is needed."
        }
      }
    ];
  }
  return [
    {
      tool: "create_software_capability_profile",
      arguments: {
        software: row.software,
        processName: row.processName,
        windowTitle: row.windowTitle,
        goal: "Find low-token log, event, file-delta, process/window, or teacher-marker signals before screenshots."
      }
    },
    {
      tool: "create_software_control_channel_probe",
      arguments: { software: row.software, processName: row.processName, windowTitle: row.windowTitle, runReadOnlyProbe: false }
    },
    {
      tool: "create_all_software_coverage_repair_queue",
      arguments: { audit: paths.auditPath || "<coverage audit path>", maxItems: 10 }
    }
  ];
}

function makeBatches(rows, { batchSize, audit, repairQueue, paths }) {
  const auditRows = Array.isArray(audit?.coverageRows) ? audit.coverageRows : [];
  const repairRows = Array.isArray(repairQueue?.repairItems) ? repairQueue.repairItems : [];
  const auditRowsByName = new Map(auditRows.map((row) => [String(row.software || row.processName || "").toLowerCase(), row]));
  const repairRowsByName = new Map(repairRows.map((row) => [String(row.software || row.processName || "").toLowerCase(), row]));

  const planned = rows.map((row) => {
    const risk = rowRisk(row);
    const status = signalStatus(row, auditRowsByName, repairRowsByName);
    const priority =
      risk !== "normal_review" ? 10 :
      status === "needs_low_token_signal_discovery" ? 20 :
      status === "needs_repair_queue_action" ? 30 :
      status === "has_non_log_fallback_route" ? 40 :
      status === "has_log_metadata_route" ? 50 :
      60;
    return { ...row, risk, signalStatus: status, priority };
  }).sort((a, b) => a.priority - b.priority || a.software.localeCompare(b.software));

  const batches = [];
  for (let index = 0; index < planned.length; index += batchSize) {
    const batchRows = planned.slice(index, index + batchSize);
    const batchId = `batch-${String(batches.length + 1).padStart(3, "0")}`;
    batches.push({
      batchId,
      status: "waiting_for_teacher_review",
      batchSize: batchRows.length,
      goal: "Expand all-software low-token learning coverage without continuous recording or broad execution claims.",
      rows: batchRows.map((row) => ({
        software: row.software,
        processName: row.processName,
        windowTitle: row.windowTitle,
        source: row.source,
        risk: row.risk,
        signalStatus: row.signalStatus,
        nextCalls: nextCallsFor(row, row.signalStatus, paths, batchId),
        stopConditions: [
          "teacher excludes this software",
          "no reviewed low-token signal is available",
          "metadata/source mismatch appears",
          "a screenshot would be needed before a meaningful signal and teacher review"
        ],
        continueConditions: [
          "teacher confirms this software is in scope",
          "a log metadata route or non-log fallback route is reviewed",
          "metadata-only baseline is initialized before tail reads",
          "changed evidence is compacted into teacher-review learning events"
        ],
        locks: locks()
      })),
      locks: locks()
    });
  }
  return batches;
}

const goal = argValue("--goal", "Expand all local software coverage with low-token reviewed batches.");
const inventoryInput = readJsonInput(argValue("--inventory", argValue("--inventory-path", "")), "--inventory", true);
const auditInput = readJsonInput(argValue("--audit", argValue("--audit-path", "")), "--audit", true);
const repairQueueInput = readJsonInput(argValue("--repair-queue", argValue("--repair-queue-path", "")), "--repair-queue", true);
const runnerInput = readJsonInput(argValue("--runner", argValue("--runner-path", "")), "--runner", true);
if (!inventoryInput.value && !auditInput.value && !repairQueueInput.value && !runnerInput.value) {
  throw new Error("--inventory, --audit, --repair-queue, or --runner is required");
}

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-expansion-plans")));
const batchSize = Math.max(1, Number(argValue("--batch-size", "8")));
const maxSoftware = Math.max(1, Number(argValue("--max-software", "120")));
mkdirSync(outputRoot, { recursive: true });
const planId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const planDir = join(outputRoot, planId);
mkdirSync(planDir, { recursive: true });

const evidenceRows = rowsFromEvidence({
  inventory: inventoryInput.value,
  audit: auditInput.value,
  repairQueue: repairQueueInput.value,
  runner: runnerInput.value
}).slice(0, maxSoftware);
const paths = {
  inventoryPath: inventoryInput.path,
  auditPath: auditInput.path,
  repairQueuePath: repairQueueInput.path,
  runnerPath: runnerInput.path
};
const batches = makeBatches(evidenceRows, {
  batchSize,
  audit: auditInput.value,
  repairQueue: repairQueueInput.value,
  paths
});

const counts = {
  candidateSoftware: evidenceRows.length,
  batches: batches.length,
  needsExclusionReview: batches.flatMap((batch) => batch.rows).filter((row) => row.risk !== "normal_review").length,
  needsLowTokenSignalDiscovery: batches.flatMap((batch) => batch.rows).filter((row) => row.signalStatus === "needs_low_token_signal_discovery").length,
  hasLogMetadataRoute: batches.flatMap((batch) => batch.rows).filter((row) => row.signalStatus === "has_log_metadata_route").length,
  hasNonLogFallbackRoute: batches.flatMap((batch) => batch.rows).filter((row) => row.signalStatus === "has_non_log_fallback_route").length,
  hasWatchEvidence: batches.flatMap((batch) => batch.rows).filter((row) => row.signalStatus === "has_watch_evidence").length
};

const planPath = join(planDir, "all-software-coverage-expansion-plan.json");
const receiptPath = join(planDir, "all-software-coverage-expansion-plan-receipt.json");
const readmePath = join(planDir, "ALL_SOFTWARE_COVERAGE_EXPANSION_PLAN_START_HERE.md");

const plan = {
  format: "transparent_ai_all_software_coverage_expansion_plan_v1",
  planId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_review",
  goal,
  sourceEvidence: paths,
  expansionPolicy: {
    boundedBatchSize: batchSize,
    maxSoftware,
    metadataFirst: true,
    skipTailWhenMetadataUnchanged: true,
    oneScreenshotOnlyAfterMeaningfulSignalAndTeacherReview: true,
    teacherExclusionReviewBeforeObservation: true,
    noBackgroundTaskInstalledByDefault: true,
    noUniversalNativeExecutionClaim: true
  },
  counts,
  batches,
  nextTeacherActions: [
    "Review batch 001 and exclude private or out-of-scope software.",
    "For each in-scope row, run the listed low-token discovery or metadata gate calls.",
    "Only after a meaningful changed signal, decide whether one visual check is needed.",
    "After each batch, rerun coverage audit and regenerate this expansion plan for the next batch."
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason: "This is a reviewed expansion plan for widening coverage, not proof that every installed app is already covered.",
    proofNeededBeforeCompletion: [
      "all in-scope software has reviewed low-token route or teacher-approved exclusion",
      "recurring runner state covers reviewed rows without continuous recording",
      "coverage audit shows no unreviewed gaps",
      "teacher confirms completion"
    ]
  },
  locks: locks()
};

const receipt = {
  format: "transparent_ai_all_software_coverage_expansion_plan_receipt_v1",
  planPath,
  status: "waiting_for_teacher_review",
  candidateSoftware: counts.candidateSoftware,
  batches: counts.batches,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  memoryWritten: false,
  locks: locks()
};

const readme = [
  "# All-Software Coverage Expansion Plan",
  "",
  `Status: ${plan.status}`,
  `Candidate software: ${counts.candidateSoftware}`,
  `Batches: ${counts.batches}`,
  "",
  "## Start Here",
  "",
  "1. Review batch 001 and remove private or out-of-scope software.",
  "2. Run only the listed low-token next calls for reviewed rows.",
  "3. Do not capture screenshots until a meaningful changed signal exists and the teacher confirms the need.",
  "4. Rerun coverage audit after each batch before widening scope.",
  "",
  "## Completion Boundary",
  "",
  plan.completionBoundary.reason
];

writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(readmePath, `${readme.join("\n")}\n`, "utf8");

console.log(JSON.stringify({
  status: plan.status,
  format: "transparent_ai_all_software_coverage_expansion_plan_result_v1",
  planPath,
  receiptPath,
  readmePath,
  counts,
  locks: plan.locks
}, null, 2));
