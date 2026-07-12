#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
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
    String(value || "fallback-route-evidence-plan-receipt-draft")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "fallback-route-evidence-plan-receipt-draft"
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

function locks() {
  return {
    reviewOnly: true,
    draftOnly: true,
    commandTemplateOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    draftDoesNotValidateReceipt: true,
    draftDoesNotRunMetadataGate: true,
    draftDoesNotReadLogs: true,
    draftDoesNotReadFullLogs: true,
    draftDoesNotCaptureScreenshots: true,
    draftDoesNotExecuteTargetSoftware: true,
    draftDoesNotRegisterSchedule: true,
    draftDoesNotWriteMemory: true,
    selectedRouteIsNotCoverage: true,
    compactWatchEvidenceNotFabricated: true,
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

const goal = argValue("--goal", "Draft blocked waiting-row evidence-plan receipt from teacher-selected fallback routes.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--route-validation", "")),
  "--validation",
  "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_validation_v1"
);
const planInput = readJsonInput(
  argValue("--plan", argValue("--evidence-plan", "")),
  "--plan",
  "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    argValue(
      "--output-dir",
      join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-fallback-route-evidence-plan-receipt-drafts")
    )
  )
);

const validation = validationInput.value;
const plan = planInput.value;
const lockState = locks();
const allowPartialReady = hasFlag("--allow-partial-ready") || argValue("--allow-partial-ready", "") === "true";
const draftId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(validation.validationId || plan.planId || goal)}`;
const draftDir = join(outRoot, draftId);
const draftPath = join(draftDir, "teacher-low-token-blocked-waiting-row-evidence-plan-receipt-draft.json");
const packetPath = join(draftDir, "original-goal-low-token-fallback-route-evidence-plan-receipt-draft.json");
const htmlPath = join(draftDir, "original-goal-low-token-fallback-route-evidence-plan-receipt-draft.html");
const readmePath = join(draftDir, "ORIGINAL_GOAL_LOW_TOKEN_FALLBACK_ROUTE_EVIDENCE_PLAN_RECEIPT_DRAFT_START_HERE.md");

const routeRowsById = new Map((validation.validationRows || []).map((row) => [String(row.rowId || ""), row]));
const blockers = [];
const validationReadyRows = (validation.validationRows || []).filter(
  (row) => row.status === "selected_route_ready_for_low_token_evidence_follow_up" || row.status === "teacher_marked_out_of_scope_for_follow_up"
);
const validationInvalidRows = (validation.validationRows || []).filter(
  (row) => row.status?.startsWith?.("blocked_") || row.status === "needs_teacher_review_or_valid_route_selection"
);
const validationHardBlocked =
  (Array.isArray(validation.blockers) && validation.blockers.length > 0) ||
  String(validation.status || "").includes("forbidden") ||
  validationInvalidRows.some((row) => String(row.status || "").includes("forbidden"));
const partialReadyAllowed = allowPartialReady && validation.ok !== true && validationReadyRows.length > 0 && !validationHardBlocked;
const partialReadyWarnings = [];
if (validation.ok !== true && !partialReadyAllowed) blockers.push("fallback_route_receipt_validation_not_ok");
if (allowPartialReady && validationReadyRows.length === 0) blockers.push("partial_ready_requested_but_no_ready_rows");
if (partialReadyAllowed && validationInvalidRows.length > 0) partialReadyWarnings.push("partial_ready_rows_still_need_teacher_review");
if (validation.locks?.routeSelectionIsNotCoverage !== true) blockers.push("route_selection_not_coverage_lock_missing");
if (validation.locks?.validationDoesNotReadLogs !== true) blockers.push("source_validation_log_lock_missing");
if (validation.locks?.validationDoesNotExecuteTargetSoftware !== true) blockers.push("source_validation_execution_lock_missing");

const receiptRows = (plan.actionRows || []).map((planRow) => {
  const routeRow = routeRowsById.get(String(planRow.rowId || ""));
  const selectedRoute = routeRow?.status === "selected_route_ready_for_low_token_evidence_follow_up";
  const excluded = routeRow?.status === "teacher_marked_out_of_scope_for_follow_up";
  const needsCompactWatch = (planRow.missingEvidenceKinds || []).includes("compact_watch_or_learning_evidence");
  const needsTeacherReview = (planRow.missingEvidenceKinds || []).includes("teacher_review_receipt");
  const sourceRouteSummary = selectedRoute
    ? `Teacher selected fallback route ${routeRow.selectedRouteId} (${routeRow.selectedRouteKind || "route"}) after privacy and evidence review.`
    : excluded
      ? "Teacher marked this software row out of scope or excluded from monitoring."
      : "";
  return {
    rowId: planRow.rowId,
    ledgerNumber: planRow.ledgerNumber || "",
    software: planRow.software || "",
    missingEvidenceKinds: planRow.missingEvidenceKinds || [],
    teacherDecision: excluded
      ? "teacher_excluded_from_monitoring"
      : selectedRoute && !needsCompactWatch
        ? "evidence_collected_return_to_cockpit_review"
        : "needs_teacher_review",
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "evidence_collected_return_to_cockpit_review",
      "blocked_needs_more_low_token_evidence",
      "teacher_excluded_from_monitoring",
      "correction_to_high_reasoning_repair"
    ],
    blockedTeacherDecisions: [
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
    ],
    logSourceOrFallbackReviewed: selectedRoute || excluded,
    compactWatchEvidenceReviewed: excluded ? true : selectedRoute && !needsCompactWatch,
    teacherReviewCompleted: excluded || (selectedRoute && needsTeacherReview),
    sourceRouteOrFallbackSummary: sourceRouteSummary,
    compactEvidenceSummary: excluded
      ? "Teacher exclusion means compact watch evidence is not required for this row."
      : needsCompactWatch
        ? ""
        : selectedRoute
          ? "No compact watch evidence was required by the source plan."
          : "",
    reviewedEvidencePathOrSignal: selectedRoute
      ? `${validationInput.path}#${planRow.rowId}:${routeRow.selectedRouteId}`
      : excluded
        ? `${validationInput.path}#${planRow.rowId}:teacher_excluded`
        : "",
    reviewerNote: selectedRoute
      ? "Draft copied only the teacher-selected fallback route. Compact watch evidence remains unchecked until separately reviewed."
      : excluded
        ? "Draft preserves teacher exclusion without claiming coverage."
        : "Route validation did not provide a ready row; keep this row under teacher review."
  };
});

const copiedRouteRows = receiptRows.filter((row) => row.logSourceOrFallbackReviewed).length;
const compactEvidenceStillNeeded = receiptRows.filter(
  (row) => row.teacherDecision !== "teacher_excluded_from_monitoring" && row.compactWatchEvidenceReviewed !== true
).length;
const rowsStillNeedingTeacherReview = receiptRows.filter((row) => row.teacherDecision === "needs_teacher_review").length;
const allRowsExcluded = receiptRows.length > 0 && receiptRows.every((row) => row.teacherDecision === "teacher_excluded_from_monitoring");
const topLevelDecision =
  blockers.length > 0
    ? "blocked"
    : allRowsExcluded
      ? "evidence_collected_return_to_cockpit_review"
      : "needs_teacher_review";

const draftReceipt = {
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1",
  draftOnly: true,
  draftSource: "fallback_route_evidence_pack_receipt_validation",
  sourceRouteValidationPath: validationInput.path,
  sourcePlanPath: planInput.path,
  planId: plan.planId || "",
  teacherDecision: topLevelDecision,
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "evidence_collected_return_to_cockpit_review",
    "acknowledge_no_blocked_rows",
    "blocked",
    "correction_to_high_reasoning_repair"
  ],
  blockedTeacherDecisions: [
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
  ],
  blockedShortcutsReviewed: blockers.length === 0,
  noFullLogReadConfirmed: validation.locks?.validationDoesNotReadFullLogs === true,
  noScreenshotConfirmed: validation.locks?.validationDoesNotCaptureScreenshots === true,
  noSoftwareExecutionConfirmed: validation.locks?.validationDoesNotExecuteTargetSoftware === true,
  rollbackRetained: false,
  receiptRows,
  teacherNote:
    "Draft generated from validated fallback route selections. Teacher must review remaining compact evidence and retained rollback before validation.",
  locks: lockState
};

const nextValidationCommand = commandLine("validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs", [
  ["--plan", planInput.path || "<original-goal-low-token-blocked-waiting-row-evidence-plan.json>"],
  ["--receipt", draftPath],
  ["--output-dir", join(draftDir, "evidence-plan-receipt-validation")]
]);

const packet = {
  ok: blockers.length === 0,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_plan_receipt_draft_v1",
  draftId,
  createdAt: new Date().toISOString(),
  goal,
  status: blockers.length
    ? "blocked_until_fallback_route_receipt_validation_is_ready"
    : partialReadyAllowed
      ? "partial_draft_ready_for_ready_fallback_routes_remaining_rows_still_blocked"
    : compactEvidenceStillNeeded || rowsStillNeedingTeacherReview
      ? "draft_ready_needs_compact_evidence_and_teacher_review"
      : "draft_ready_for_evidence_plan_receipt_validation",
  sourceRouteValidationPath: validationInput.path,
  sourcePlanPath: planInput.path,
  draftReceiptPath: draftPath,
  nextValidationCommand,
  counts: {
    planRows: receiptRows.length,
    sourceValidationReadyRows: validationReadyRows.length,
    sourceValidationInvalidRows: validationInvalidRows.length,
    partialReadyAllowed,
    copiedRouteRows,
    compactEvidenceStillNeeded,
    rowsStillNeedingTeacherReview,
    teacherExcludedRows: receiptRows.filter((row) => row.teacherDecision === "teacher_excluded_from_monitoring").length,
    blockers: blockers.length
  },
  blockers,
  warnings: [
    ...partialReadyWarnings,
    "This draft does not prove compact watch evidence.",
    "This draft does not retain rollback for the teacher.",
    "This draft must be reviewed before validation and cockpit return."
  ],
  paths: {
    packet: packetPath,
    draftReceipt: draftPath,
    html: htmlPath,
    readme: readmePath,
    sourceRouteValidation: validationInput.path,
    sourcePlan: planInput.path
  },
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

writeJson(draftPath, draftReceipt);
writeJson(packetPath, packet);
const rows = receiptRows
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.teacherDecision
      )}</td><td>${htmlEscape(row.sourceRouteOrFallbackSummary)}</td><td>${htmlEscape(
        row.compactWatchEvidenceReviewed ? "yes" : "no"
      )}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>Fallback Route Evidence Plan Receipt Draft</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;vertical-align:top}code,pre{background:#f5f5f5;padding:2px 4px}pre{white-space:pre-wrap}</style></head><body><h1>Fallback Route Evidence Plan Receipt Draft</h1><p>Status: <code>${htmlEscape(packet.status)}</code></p><p>Copied route rows: ${packet.counts.copiedRouteRows}; compact evidence still needed: ${packet.counts.compactEvidenceStillNeeded}</p><table><thead><tr><th>Row</th><th>Software</th><th>Decision</th><th>Route Summary</th><th>Compact Evidence Reviewed</th></tr></thead><tbody>${rows || "<tr><td colspan=\"5\">No rows.</td></tr>"}</tbody></table><h2>Next Validation Command</h2><pre>${htmlEscape(nextValidationCommand)}</pre></body></html>\n`,
  "utf8"
);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Fallback Route Evidence Plan Receipt Draft",
    "",
    `Status: ${packet.status}`,
    `Copied route rows: ${packet.counts.copiedRouteRows}`,
    `Compact evidence still needed: ${packet.counts.compactEvidenceStillNeeded}`,
    "",
    "This draft copies teacher-selected fallback route evidence into the blocked waiting-row evidence-plan receipt format.",
    "",
    "Safety boundary:",
    "- It does not read logs, read full logs, run metadata gates, capture screenshots, execute software, register schedules, write memory, unlock packaging, or claim completion.",
    "- It does not fabricate compact watch evidence or retained rollback.",
    "- The teacher must review this draft before running the next validation command.",
    "",
    "Next validation command:",
    nextValidationCommand
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: packet.ok,
      format: "transparent_ai_original_goal_low_token_fallback_route_evidence_plan_receipt_draft_result_v1",
      status: packet.status,
      packetPath,
      draftReceiptPath: draftPath,
      htmlPath,
      readmePath,
      counts: packet.counts,
      blockers,
      nextValidationCommand,
      locks: lockState,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
if (!packet.ok) process.exit(1);
