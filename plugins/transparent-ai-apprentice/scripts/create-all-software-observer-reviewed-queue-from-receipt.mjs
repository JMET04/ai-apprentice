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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function slugify(value, fallback = "row") {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || fallback;
}

function candidateRowId(candidate, index) {
  return slugify(candidate.software || candidate.processName || `candidate-${index + 1}`, `candidate-${index + 1}`);
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map((part) => {
      const text = String(part);
      return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
    })
    .join(" ");
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
    nativeUniversalExecution: false,
    softwareActionsExecuted: false,
    scheduledTaskRegistered: false,
    memoryEnabled: false,
    teacherConfirmationRequired: true,
    bridgeDoesNotRunInventoryProbe: true,
    bridgeDoesNotReadLogContents: true,
    bridgeDoesNotTailLogs: true,
    bridgeDoesNotCaptureScreenshots: true,
    bridgeDoesNotInitializeWatchBaseline: true,
    bridgeDoesNotExecuteTargetSoftware: true,
    bridgeDoesNotWriteMemory: true,
    goalComplete: false
  };
}

function runNodeScript(scriptName, args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function normalizeReceiptRow(row) {
  return {
    rowNumber: Number(row.rowNumber || 0),
    rowId: String(row.rowId || ""),
    software: String(row.software || ""),
    decision: String(row.decision || "needs_teacher_source"),
    teachingStyle: String(row.teachingStyle || "ask_teacher_when_ambiguous"),
    teacherLogSourceHint: String(row.teacherLogSourceHint || ""),
    teacherNote: String(row.teacherNote || ""),
    approvedForReviewedObservation: row.approvedForReviewedObservation === true
  };
}

function validateReceipt(receipt) {
  const rows = Array.isArray(receipt.rows) ? receipt.rows.map(normalizeReceiptRow) : [];
  const allowed = new Set([
    "exclude_private_or_out_of_scope",
    "priority_observe",
    "observe_later",
    "needs_teacher_source",
    "blocked"
  ]);
  const forbidden = new Set([
    "accepted",
    "enable_memory",
    "native_universal_execution",
    "continuous_recording",
    "execute_software"
  ]);
  const invalidRows = rows.filter((row) => !allowed.has(row.decision) || forbidden.has(row.decision));
  const approvedRows = rows.filter(
    (row) =>
      (row.decision === "priority_observe" || row.decision === "observe_later") &&
      row.approvedForReviewedObservation === true
  );
  const excludedRows = rows.filter((row) => row.decision === "exclude_private_or_out_of_scope");
  const blockers = [];
  if (receipt.format !== "transparent_ai_all_software_observer_inventory_review_receipt_v1") {
    blockers.push("receipt_format_mismatch");
  }
  if (!receipt.teacherConfirmedPrivateAppsExcluded) blockers.push("teacher_must_confirm_private_apps_excluded");
  if (!receipt.teacherConfirmedReadOnlyObservationOnly) blockers.push("teacher_must_confirm_read_only_observation_only");
  if (invalidRows.length > 0) blockers.push("receipt_contains_invalid_or_forbidden_decisions");
  if (approvedRows.length === 0) blockers.push("no_rows_approved_for_reviewed_observation");
  return {
    ok: blockers.length === 0,
    blockers,
    rows,
    approvedRows,
    excludedRows,
    invalidRows,
    counts: {
      receiptRows: rows.length,
      approvedRows: approvedRows.length,
      excludedRows: excludedRows.length,
      invalidRows: invalidRows.length,
      needsTeacherSourceRows: rows.filter((row) => row.decision === "needs_teacher_source").length,
      blockedRows: rows.filter((row) => row.decision === "blocked").length
    }
  };
}

function candidateMatchesReceiptRow(candidate, index, row) {
  const rowNumberMatch = row.rowNumber === index + 1;
  const rowIdMatch = row.rowId && row.rowId === candidateRowId(candidate, index);
  const softwareMatch = row.software && row.software.toLowerCase() === String(candidate.software || "").toLowerCase();
  return rowIdMatch || (rowNumberMatch && softwareMatch) || (rowNumberMatch && !row.software);
}

function reviewedInventoryFromReceipt(inventory, validation) {
  const candidates = Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates : [];
  const approved = [];
  const excluded = [];
  const ignored = [];
  const stylesByRowId = {};
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const row = validation.rows.find((candidateRow) => candidateMatchesReceiptRow(candidate, index, candidateRow));
    const rowId = candidateRowId(candidate, index);
    if (!row) {
      ignored.push({ rowId, software: candidate.software || candidate.processName || "unknown", reason: "missing_receipt_row" });
      continue;
    }
    stylesByRowId[rowId] = {
      rowId,
      software: row.software || candidate.software || candidate.processName || "unknown",
      decision: row.decision,
      teachingStyle: row.teachingStyle,
      teacherLogSourceHint: row.teacherLogSourceHint,
      teacherNote: row.teacherNote
    };
    if (row.decision === "exclude_private_or_out_of_scope") {
      excluded.push({ rowId, software: row.software || candidate.software || candidate.processName || "unknown" });
      continue;
    }
    if (
      (row.decision === "priority_observe" || row.decision === "observe_later") &&
      row.approvedForReviewedObservation === true
    ) {
      approved.push({
        ...candidate,
        teacherReview: stylesByRowId[rowId],
        teacherReviewedForAllSoftwareObservation: true
      });
      continue;
    }
    ignored.push({
      rowId,
      software: row.software || candidate.software || candidate.processName || "unknown",
      reason: row.decision
    });
  }
  approved.sort((left, right) => {
    const leftPriority = left.teacherReview?.decision === "priority_observe" ? 1 : 0;
    const rightPriority = right.teacherReview?.decision === "priority_observe" ? 1 : 0;
    return rightPriority - leftPriority;
  });
  return {
    ...inventory,
    softwareCandidates: approved,
    teacherReviewedInventory: {
      status: "teacher_receipt_filtered_inventory_ready_for_low_token_queue",
      privateAppsExcludedBeforeQueue: true,
      readOnlyObservationOnly: true,
      sourceReceiptFormat: "transparent_ai_all_software_observer_inventory_review_receipt_v1",
      approvedCount: approved.length,
      excludedCount: excluded.length,
      ignoredCount: ignored.length,
      excludedRows: excluded.slice(0, 80),
      ignoredRows: ignored.slice(0, 80),
      teachingStylesByRowId: stylesByRowId
    },
    discoveryScope: {
      ...(inventory.discoveryScope || {}),
      logContentsRead: false,
      fullContinuousRecording: false,
      nativeUniversalExecution: false
    }
  };
}

function writeBlockedOutputs(paths, receiptPath, inventoryPath, validation, inventory) {
  const bridge = {
    ok: true,
    format: "transparent_ai_all_software_observer_reviewed_queue_bridge_v1",
    createdAt: new Date().toISOString(),
    status: "blocked_waiting_for_valid_teacher_inventory_review_receipt",
    receiptPath,
    inventoryPath,
    validationPath: paths.validationPath,
    reviewedInventoryPath: "",
    queuePath: "",
    readmePath: paths.readmePath,
    validation,
    counts: {
      inventoryCandidates: Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates.length : 0,
      receiptRows: validation.counts.receiptRows,
      approvedRows: validation.counts.approvedRows,
      excludedRows: validation.counts.excludedRows,
      ignoredRows: validation.counts.needsTeacherSourceRows + validation.counts.blockedRows,
      queuedCount: 0,
      noLogFallbackCount: 0
    },
    didCreateReviewedInventory: false,
    didCreateQueue: false,
    nextTeacherAction:
      "Fill the inventory review receipt, confirm private exclusions and read-only observation, then approve at least one row for reviewed observation.",
    locks: locks(),
    goalComplete: false
  };
  writeFileSync(paths.bridgePath, `${JSON.stringify(bridge, null, 2)}\n`, "utf8");
  writeFileSync(paths.validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  writeFileSync(
    paths.readmePath,
    [
      "# All Software Reviewed Queue Bridge",
      "",
      "Status: blocked_waiting_for_valid_teacher_inventory_review_receipt",
      "",
      "The bridge did not create a reviewed inventory or queue because the teacher receipt is incomplete or unsafe.",
      "",
      `Blockers: ${validation.blockers.join(", ") || "none"}`,
      "",
      "No logs, screenshots, target software actions, memory writes, schedules, or acceptance changes were performed."
    ].join("\n"),
    "utf8"
  );
  return bridge;
}

const inventoryPath = resolve(argValue("--inventory", argValue("--inventory-path", "")));
const receiptPath = resolve(argValue("--receipt", argValue("--receipt-path", "")));
const outputRoot = resolve(
  argValue("--output-dir", join("artifacts", "current-goal-all-software-observer-reviewed-queues"))
);
const maxCandidates = Number(argValue("--max-candidates", "30"));
const maxFilesPerCandidate = Number(argValue("--max-files-per-candidate", "3"));
const maxDepth = Number(argValue("--max-depth", "2"));
const maxEntriesPerDir = Number(argValue("--max-entries-per-dir", "180"));

if (!inventoryPath || !existsSync(inventoryPath)) throw new Error("--inventory is required");
if (!receiptPath || !existsSync(receiptPath)) throw new Error("--receipt is required");

mkdirSync(outputRoot, { recursive: true });
const paths = {
  bridgePath: join(outputRoot, "all-software-observer-reviewed-queue-bridge.json"),
  validationPath: join(outputRoot, "all-software-observer-inventory-review-receipt-validation.json"),
  reviewedInventoryPath: join(outputRoot, "software-observer-inventory-teacher-reviewed.json"),
  readmePath: join(outputRoot, "ALL_SOFTWARE_REVIEWED_QUEUE_BRIDGE.md")
};

const inventory = readJson(inventoryPath);
const receipt = readJson(receiptPath);
const validation = validateReceipt(receipt);
writeFileSync(paths.validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");

if (!validation.ok) {
  const blocked = writeBlockedOutputs(paths, receiptPath, inventoryPath, validation, inventory);
  console.log(
    JSON.stringify(
      {
        ok: true,
        format: "transparent_ai_all_software_observer_reviewed_queue_bridge_result_v1",
        status: blocked.status,
        bridgePath: paths.bridgePath,
        validationPath: paths.validationPath,
        readmePath: paths.readmePath,
        didCreateReviewedInventory: false,
        didCreateQueue: false,
        logsRead: false,
        screenshotsCaptured: false,
        softwareActionsExecuted: false,
        memoryWritten: false,
        goalComplete: false
      },
      null,
      2
    )
  );
  process.exit(0);
}

const reviewedInventory = reviewedInventoryFromReceipt(inventory, validation);
writeFileSync(paths.reviewedInventoryPath, `${JSON.stringify(reviewedInventory, null, 2)}\n`, "utf8");

const queueResult = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  paths.reviewedInventoryPath,
  "--output-dir",
  join(outputRoot, "observer-queue"),
  "--max-candidates",
  String(maxCandidates),
  "--max-files-per-candidate",
  String(maxFilesPerCandidate),
  "--max-depth",
  String(maxDepth),
  "--max-entries-per-dir",
  String(maxEntriesPerDir)
]);

const bridge = {
  ok: true,
  format: "transparent_ai_all_software_observer_reviewed_queue_bridge_v1",
  createdAt: new Date().toISOString(),
  status: "reviewed_inventory_queue_ready_waiting_for_metadata_delta_watch",
  inventoryPath,
  receiptPath,
  validationPath: paths.validationPath,
  reviewedInventoryPath: paths.reviewedInventoryPath,
  queuePath: queueResult.queuePath,
  queueReadme: queueResult.teacherReadme,
  nextObserverCalls: queueResult.nextObserverCalls,
  readmePath: paths.readmePath,
  counts: {
    inventoryCandidates: Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates.length : 0,
    receiptRows: validation.counts.receiptRows,
    approvedRows: validation.counts.approvedRows,
    excludedRows: validation.counts.excludedRows,
    ignoredRows: reviewedInventory.teacherReviewedInventory.ignoredCount,
    queuedCount: queueResult.queuedCount || 0,
    noLogFallbackCount: queueResult.noLogFallbackCount || 0
  },
  lowTokenPolicy: {
    inventoryProbeRunHere: false,
    queueUsesMetadataScanning: true,
    logContentsRead: false,
    tailLogsRead: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    watchBaselineInitialized: false,
    nextStep: "Run watch_log_source_metadata_deltas on one queued item before any bounded tail read or triggered screenshot."
  },
  nextCommands: {
    watchMetadataDeltas: commandText("watch_log_source_metadata_deltas.mjs", [
      "--queue",
      queueResult.queuePath || "<software-observer-queue.json>",
      "--max-items",
      "8",
      "--max-logs-per-item",
      "2"
    ]),
    startReviewedObservationFromReceipt: commandText("start-teach-execute-reviewed-observation.mjs", [
      "--goal",
      "Run teacher-confirmed read-only observation from reviewed inventory receipt.",
      "--software",
      "all local software",
      "--teacher-confirmed",
      "--teacher-confirmation",
      receipt.teacherConfirmationText || "teacher confirmed private exclusions and read-only observation",
      "--output-dir",
      join("artifacts", "current-goal-teach-execute-reviewed-observations")
    ])
  },
  locks: locks(),
  goalComplete: false
};

writeFileSync(paths.bridgePath, `${JSON.stringify(bridge, null, 2)}\n`, "utf8");
writeFileSync(
  paths.readmePath,
  [
    "# All Software Reviewed Queue Bridge",
    "",
    `Status: ${bridge.status}`,
    "",
    "This bridge consumes a teacher-filled inventory review receipt and creates a low-token observer queue only for approved rows.",
    "",
    `- Inventory candidates: ${bridge.counts.inventoryCandidates}`,
    `- Approved rows: ${bridge.counts.approvedRows}`,
    `- Excluded rows: ${bridge.counts.excludedRows}`,
    `- Queued rows: ${bridge.counts.queuedCount}`,
    `- Queue: ${bridge.queuePath}`,
    `- Reviewed inventory: ${bridge.reviewedInventoryPath}`,
    "",
    "Boundary: no inventory probe, no log contents, no tail reads, no screenshots, no watch baseline, no software execution, no memory writes, no rule enablement, no acceptance, and no completion claim.",
    "",
    "Next safe step:",
    "",
    bridge.nextCommands.watchMetadataDeltas
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_observer_reviewed_queue_bridge_result_v1",
      status: bridge.status,
      bridgePath: paths.bridgePath,
      validationPath: paths.validationPath,
      reviewedInventoryPath: paths.reviewedInventoryPath,
      queuePath: bridge.queuePath,
      readmePath: paths.readmePath,
      counts: bridge.counts,
      didCreateReviewedInventory: true,
      didCreateQueue: true,
      didRunInventoryProbe: false,
      logsRead: false,
      tailLogsRead: false,
      screenshotsCaptured: false,
      watchBaselineInitialized: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      goalComplete: false
    },
    null,
    2
  )
);
