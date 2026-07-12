#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return (
    String(value || "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation"
  );
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["evidence_collected_return_to_cockpit_review", "ready_to_return_to_cockpit", "ready_for_cockpit_review"].includes(decision)) {
    return "evidence_collected_return_to_cockpit_review";
  }
  if (["teacher_excluded_from_monitoring", "excluded"].includes(decision)) return "teacher_excluded_from_monitoring";
  if (["blocked", "blocked_needs_more_low_token_evidence", "needs_more_evidence"].includes(decision)) {
    return "blocked_needs_more_low_token_evidence";
  }
  if (["needs_teacher_review", "correction_to_high_reasoning_repair", "acknowledge_no_blocked_rows"].includes(decision)) {
    return decision;
  }
  if (
    [
      "accepted",
      "run_metadata_gate_now",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "write_memory",
      "register_schedule",
      "unlock_packaging",
      "claim_complete"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunMetadataGate: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
    metadataGateRunnerInvoked: false,
    boundedTailReadInvoked: false,
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

const goal = argValue("--goal", "Validate teacher receipt for blocked low-token waiting-row evidence acquisition.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--evidence-plan", "")),
  "--plan",
  "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    argValue(
      "--output-dir",
      join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validations")
    )
  )
);

const plan = planInput.value;
const receipt = receiptInput.value;
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(plan.planId || goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation.json");
const htmlPath = join(validationDir, "original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-validation.html");
const readmePath = join(validationDir, "ORIGINAL_GOAL_LOW_TOKEN_BLOCKED_WAITING_ROW_EVIDENCE_PLAN_RECEIPT_VALIDATION_START_HERE.md");
const lockState = locks();
const forbiddenDecisions = new Set([
  "accepted",
  "run_metadata_gate_now",
  "read_logs_now",
  "read_full_logs",
  "capture_screenshot_now",
  "execute_now",
  "write_memory",
  "register_schedule",
  "unlock_packaging",
  "claim_complete"
]);
const receiptRows = Array.isArray(receipt.receiptRows) ? receipt.receiptRows : [];
const receiptRowById = new Map(receiptRows.map((row) => [String(row.rowId || ""), row]));
const planRowById = new Map((plan.actionRows || []).map((row) => [String(row.rowId || ""), row]));
const topLevelDecision = normalizeDecision(receipt.teacherDecision);
const blockers = [];
if (receipt.planId !== plan.planId) blockers.push("receipt_plan_id_mismatch");
if (forbiddenDecisions.has(topLevelDecision)) blockers.push("forbidden_top_level_decision");
if (receipt.blockedShortcutsReviewed !== true) blockers.push("blocked_shortcuts_not_reviewed");
if (receipt.noFullLogReadConfirmed !== true) blockers.push("no_full_log_read_not_confirmed");
if (receipt.noScreenshotConfirmed !== true) blockers.push("no_screenshot_not_confirmed");
if (receipt.noSoftwareExecutionConfirmed !== true) blockers.push("no_software_execution_not_confirmed");
if (receipt.rollbackRetained !== true && (plan.actionRows || []).length > 0) blockers.push("rollback_not_retained");

const validationRows = (plan.actionRows || []).map((sourceRow) => {
  const receiptRow = receiptRowById.get(String(sourceRow.rowId || ""));
  const missingReceiptRow = !receiptRow;
  const normalizedDecision = normalizeDecision(receiptRow?.teacherDecision);
  const forbiddenDecision = forbiddenDecisions.has(normalizedDecision);
  const needsLogSource = (sourceRow.missingEvidenceKinds || []).includes("log_source_route_or_reviewed_fallback");
  const needsCompactWatch = (sourceRow.missingEvidenceKinds || []).includes("compact_watch_or_learning_evidence");
  const needsTeacherReview = (sourceRow.missingEvidenceKinds || []).includes("teacher_review_receipt");
  const logSourceReviewed = receiptRow?.logSourceOrFallbackReviewed === true;
  const compactWatchReviewed = receiptRow?.compactWatchEvidenceReviewed === true;
  const teacherReviewCompleted = receiptRow?.teacherReviewCompleted === true;
  const evidenceSummaryPresent =
    Boolean(String(receiptRow?.sourceRouteOrFallbackSummary || "").trim()) ||
    Boolean(String(receiptRow?.compactEvidenceSummary || "").trim()) ||
    Boolean(String(receiptRow?.reviewedEvidencePathOrSignal || "").trim());
  const excluded = normalizedDecision === "teacher_excluded_from_monitoring";
  const readyToReturn =
    !missingReceiptRow &&
    !forbiddenDecision &&
    normalizedDecision === "evidence_collected_return_to_cockpit_review" &&
    (!needsLogSource || logSourceReviewed) &&
    (!needsCompactWatch || compactWatchReviewed) &&
    (!needsTeacherReview || teacherReviewCompleted) &&
    evidenceSummaryPresent;
  const status = missingReceiptRow
    ? "blocked_missing_receipt_row"
    : forbiddenDecision
      ? "blocked_for_forbidden_decision"
      : excluded
        ? "teacher_excluded_from_monitoring_return_to_cockpit_review"
        : normalizedDecision === "correction_to_high_reasoning_repair"
          ? "correction_routes_to_high_reasoning_repair"
          : normalizedDecision === "blocked_needs_more_low_token_evidence"
            ? "blocked_needs_more_low_token_evidence"
            : readyToReturn
              ? "ready_to_return_to_waiting_row_cockpit_review"
              : "needs_teacher_review_or_missing_reviewed_evidence";
  return {
    rowId: sourceRow.rowId,
    ledgerNumber: sourceRow.ledgerNumber || "",
    software: sourceRow.software || "",
    missingEvidenceKinds: sourceRow.missingEvidenceKinds || [],
    sourceCoverageContractStatus: sourceRow.coverageContractReview?.status || "",
    sourceCoverageContractAllowsMetadataGateReview: sourceRow.coverageContractReview?.allowsMetadataGateReview === true,
    sourceCoverageContractMissingRequirements: sourceRow.coverageContractReview?.missingRequirements || [],
    sourceLowTokenRouteGap: sourceRow.lowTokenRouteGap || {},
    receiptDecision: receiptRow?.teacherDecision || "",
    normalizedDecision,
    logSourceReviewed,
    compactWatchReviewed,
    teacherReviewCompleted,
    evidenceSummaryPresent,
    status,
    readyToReturnToCockpitReview: readyToReturn || excluded,
    nextAction:
      readyToReturn || excluded
        ? "return_to_waiting_row_cockpit_receipt_validation"
        : status === "correction_routes_to_high_reasoning_repair"
          ? "route_teacher_correction_to_high_reasoning_repair"
          : "collect_more_low_token_evidence_or_complete_teacher_review",
    locks: lockState
  };
});

const extraRows = receiptRows
  .filter((row) => !planRowById.has(String(row.rowId || "")))
  .map((row) => ({
    rowId: row.rowId || "",
    software: row.software || "",
    normalizedDecision: normalizeDecision(row.teacherDecision),
    status: "blocked_unknown_plan_row",
    readyToReturnToCockpitReview: false,
    nextAction: "remove_unknown_receipt_row",
    locks: lockState
  }));
if (extraRows.length) blockers.push("unknown_receipt_rows_present");

const readyRows = validationRows.filter((row) => row.readyToReturnToCockpitReview);
const invalidRows = validationRows.filter(
  (row) =>
    row.status.startsWith("blocked_") ||
    row.status === "needs_teacher_review_or_missing_reviewed_evidence"
);
const correctionRows = validationRows.filter((row) => row.status === "correction_routes_to_high_reasoning_repair");
if (topLevelDecision === "acknowledge_no_blocked_rows" && (plan.actionRows || []).length > 0) {
  blockers.push("cannot_acknowledge_no_blocked_rows_while_plan_has_action_rows");
}
if (topLevelDecision === "correction_to_high_reasoning_repair" && !String(receipt.teacherNote || "").trim()) {
  blockers.push("teacher_correction_note_missing");
}
const hardBlocked = blockers.length > 0 || extraRows.length > 0 || validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const status = hardBlocked
  ? "blocked_for_invalid_or_forbidden_receipt"
  : readyRows.length === (plan.actionRows || []).length
    ? "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit"
    : correctionRows.length > 0
      ? "evidence_plan_receipt_routes_corrections_to_high_reasoning"
      : "evidence_plan_receipt_needs_more_teacher_review_or_low_token_evidence";
const allRowsReady = readyRows.length === (plan.actionRows || []).length && invalidRows.length === 0;
const returnCommand =
  allRowsReady && !hardBlocked
    ? commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
        ["--cockpit", plan.sourceEvidence?.cockpit || plan.paths?.sourceCockpit || "<original-goal-low-token-coverage-waiting-row-cockpit.json>"],
        ["--receipt", "<teacher-filled-low-token-waiting-row-cockpit-receipt.json>"],
        ["--output-dir", join(validationDir, "waiting-row-cockpit-receipt-validation")]
      ])
    : "";
const validation = {
  ok: !hardBlocked && allRowsReady,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision: topLevelDecision,
  sourceEvidence: {
    plan: planInput.path,
    receipt: receiptInput.path,
    sourceCockpit: plan.sourceEvidence?.cockpit || plan.paths?.sourceCockpit || ""
  },
  counts: {
    planRows: (plan.actionRows || []).length,
    receiptRows: receiptRows.length,
    readyRows: readyRows.length,
    invalidRows: invalidRows.length,
    correctionRows: correctionRows.length,
    extraRows: extraRows.length,
    blockers: blockers.length
  },
  blockers,
  validationRows,
  extraRows,
  nextSafeCommand: returnCommand
    ? {
        tool: "validate_original_goal_low_token_coverage_waiting_row_cockpit_receipt",
        commandLine: returnCommand,
        executeNow: false,
        readyRowIds: readyRows.map((row) => row.rowId),
        blockedUntil: "teacher fills the waiting-row cockpit receipt using the reviewed evidence result"
      }
    : null,
  highReasoningCorrectionHandoff:
    correctionRows.length > 0 || topLevelDecision === "correction_to_high_reasoning_repair"
      ? {
          executeNow: false,
          teacherCorrection: receipt.teacherNote || "",
          rowIds: correctionRows.map((row) => row.rowId)
        }
      : null,
  blockedTransitions: [
    "run_metadata_gate_from_blocked_waiting_row_evidence_plan_receipt",
    "read_logs_from_blocked_waiting_row_evidence_plan_receipt",
    "read_full_logs_from_blocked_waiting_row_evidence_plan_receipt",
    "capture_screenshot_from_blocked_waiting_row_evidence_plan_receipt",
    "execute_target_software_from_blocked_waiting_row_evidence_plan_receipt",
    "register_schedule_from_blocked_waiting_row_evidence_plan_receipt",
    "write_memory_from_blocked_waiting_row_evidence_plan_receipt",
    "claim_all_software_coverage_complete_from_blocked_waiting_row_evidence_plan_receipt",
    "claim_original_goal_complete_from_blocked_waiting_row_evidence_plan_receipt"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason:
      "Blocked waiting-row evidence-plan receipt validation can only return reviewed evidence to the waiting-row cockpit receipt gate. It never runs metadata gates or claims coverage."
  },
  paths: {
    validation: validationPath,
    html: htmlPath,
    readme: readmePath,
    sourcePlan: planInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: lockState
};

writeJson(validationPath, validation);
const rowsHtml = validationRows
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.normalizedDecision
      )}</td><td>${htmlEscape(row.status)}</td><td>${htmlEscape(row.nextAction)}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>Blocked Waiting Row Evidence Receipt Validation</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;vertical-align:top}code,pre{background:#f5f5f5;padding:2px 4px}pre{white-space:pre-wrap}</style></head><body><h1>Blocked Waiting Row Evidence Receipt Validation</h1><p>Status: <code>${htmlEscape(status)}</code></p><p>Next safe command: <code>${htmlEscape(returnCommand)}</code></p><table><thead><tr><th>Row</th><th>Software</th><th>Decision</th><th>Status</th><th>Next action</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>\n`,
  "utf8"
);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Blocked Waiting Row Evidence Plan Receipt Validation",
    "",
    `Status: ${status}`,
    `Ready rows: ${readyRows.length}/${(plan.actionRows || []).length}`,
    "",
    "This validation prepares only a return to the waiting-row cockpit receipt gate.",
    "It does not run metadata gates, read logs, read full logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "Next safe command:",
    returnCommand || "- none"
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_result_v1",
      status,
      validationPath,
      htmlPath,
      readmePath,
      counts: validation.counts,
      nextSafeCommand: validation.nextSafeCommand,
      executeNow: false,
      locks: lockState
    },
    null,
    2
  )
);
if (!validation.ok) process.exit(1);
