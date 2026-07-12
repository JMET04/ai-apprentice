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
    String(value || "original-goal-low-token-fallback-route-evidence-pack-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "original-goal-low-token-fallback-route-evidence-pack-receipt-validation"
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
  if (["routes_selected_for_follow_up", "select_candidate_route", "mark_out_of_scope", "request_new_route", "needs_teacher_review", "blocked", "request_new_routes"].includes(decision)) {
    return decision;
  }
  if (
    [
      "accepted",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "register_monitor_now",
      "write_memory_now",
      "claim_all_software_coverage_complete",
      "claim_goal_complete"
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
    validationDoesNotRunMetadataProbe: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
    routeSelectionIsNotCoverage: true,
    metadataProbeInvoked: false,
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

const goal = argValue("--goal", "Validate teacher fallback route selections.");
const packInput = readJsonInput(
  argValue("--pack", argValue("--fallback-route-evidence-pack", "")),
  "--pack",
  "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_v1"
);
const outputRoot = resolve(
  argValue(
    "--out-dir",
    argValue(
      "--output-dir",
      join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-fallback-route-evidence-pack-receipt-validations")
    )
  )
);

const pack = packInput.value;
const receipt = receiptInput.value;
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(pack.packId || goal)}`;
const validationDir = join(outputRoot, validationId);
const validationPath = join(validationDir, "original-goal-low-token-fallback-route-evidence-pack-receipt-validation.json");
const htmlPath = join(validationDir, "original-goal-low-token-fallback-route-evidence-pack-receipt-validation.html");
const readmePath = join(validationDir, "ORIGINAL_GOAL_LOW_TOKEN_FALLBACK_ROUTE_EVIDENCE_PACK_RECEIPT_VALIDATION_START_HERE.md");
const lockState = locks();
const forbidden = new Set([
  "accepted",
  "read_logs_now",
  "read_full_logs",
  "capture_screenshot_now",
  "execute_now",
  "register_monitor_now",
  "write_memory_now",
  "claim_all_software_coverage_complete",
  "claim_goal_complete"
]);

const blockers = [];
const topDecision = normalizeDecision(receipt.teacherDecision);
if (receipt.packId !== pack.packId) blockers.push("receipt_pack_id_mismatch");
if (forbidden.has(topDecision)) blockers.push("forbidden_top_level_decision");
if (receipt.routeSelectionIsNotCoverage !== true) blockers.push("route_selection_not_coverage_not_confirmed");
if (receipt.blockedShortcutsReviewed !== true) blockers.push("blocked_shortcuts_not_reviewed");
if (receipt.noFullLogReadConfirmed !== true) blockers.push("no_full_log_read_not_confirmed");
if (receipt.noScreenshotConfirmed !== true) blockers.push("no_screenshot_not_confirmed");
if (receipt.noSoftwareExecutionConfirmed !== true) blockers.push("no_software_execution_not_confirmed");
if (receipt.noMemoryWriteConfirmed !== true) blockers.push("no_memory_write_not_confirmed");

const packRowsById = new Map((pack.rows || []).map((row) => [String(row.rowId || ""), row]));
const receiptRows = Array.isArray(receipt.receiptRows) ? receipt.receiptRows : [];
const receiptRowsById = new Map(receiptRows.map((row) => [String(row.rowId || ""), row]));
const validationRows = (pack.rows || []).map((packRow) => {
  const receiptRow = receiptRowsById.get(String(packRow.rowId || ""));
  const decision = normalizeDecision(receiptRow?.teacherDecision);
  const routeIds = new Set((packRow.candidateRoutes || []).map((route) => route.routeId));
  const selectedRouteId = String(receiptRow?.selectedRouteId || "").trim();
  const forbiddenDecision = forbidden.has(decision);
  const routeExists = selectedRouteId ? routeIds.has(selectedRouteId) : false;
  const selectedRoute = (packRow.candidateRoutes || []).find((route) => route.routeId === selectedRouteId) || null;
  const safeEvidenceReviewed =
    receiptRow?.routeEvidenceReviewed === true &&
    receiptRow?.privacyBoundaryReviewed === true &&
    receiptRow?.noContentReadConfirmed === true &&
    Boolean(String(receiptRow?.routeSelectionNote || receiptRow?.reviewedEvidencePathOrSignal || "").trim());
  const status = !receiptRow
    ? "blocked_missing_receipt_row"
    : forbiddenDecision
      ? "blocked_for_forbidden_decision"
      : decision === "mark_out_of_scope"
        ? "teacher_marked_out_of_scope_for_follow_up"
        : decision === "request_new_route"
          ? "teacher_requested_new_fallback_route"
          : decision === "select_candidate_route" && routeExists && safeEvidenceReviewed
            ? "selected_route_ready_for_low_token_evidence_follow_up"
            : "needs_teacher_review_or_valid_route_selection";
  return {
    rowId: packRow.rowId,
    ledgerNumber: packRow.ledgerNumber || "",
    software: packRow.software || "",
    category: packRow.category || "",
    receiptDecision: receiptRow?.teacherDecision || "",
    normalizedDecision: decision,
    selectedRouteId,
    selectedRouteKind: selectedRoute?.routeKind || "",
    routeExists,
    routeEvidenceReviewed: receiptRow?.routeEvidenceReviewed === true,
    privacyBoundaryReviewed: receiptRow?.privacyBoundaryReviewed === true,
    noContentReadConfirmed: receiptRow?.noContentReadConfirmed === true,
    status,
    readyForFollowUp:
      status === "selected_route_ready_for_low_token_evidence_follow_up" ||
      status === "teacher_marked_out_of_scope_for_follow_up",
    nextAction:
      status === "selected_route_ready_for_low_token_evidence_follow_up"
        ? "copy_selected_route_summary_into_blocked_waiting_row_evidence_plan_receipt"
        : status === "teacher_marked_out_of_scope_for_follow_up"
          ? "copy_teacher_exclusion_into_blocked_waiting_row_evidence_plan_receipt"
          : status === "teacher_requested_new_fallback_route"
            ? "regenerate_or_extend_fallback_route_evidence_pack"
            : "complete_teacher_route_review",
    locks: lockState
  };
});

const extraRows = receiptRows
  .filter((row) => !packRowsById.has(String(row.rowId || "")))
  .map((row) => ({
    rowId: row.rowId || "",
    software: row.software || "",
    status: "blocked_unknown_pack_row",
    readyForFollowUp: false,
    locks: lockState
  }));
if (extraRows.length) blockers.push("unknown_receipt_rows_present");

const readyRows = validationRows.filter((row) => row.readyForFollowUp);
const invalidRows = validationRows.filter(
  (row) =>
    row.status.startsWith("blocked_") ||
    row.status === "needs_teacher_review_or_valid_route_selection"
);
const requestNewRouteRows = validationRows.filter((row) => row.status === "teacher_requested_new_fallback_route");
const hardBlocked = blockers.length > 0 || extraRows.length > 0 || validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const allRowsRouted = readyRows.length === (pack.rows || []).length && invalidRows.length === 0 && requestNewRouteRows.length === 0;
const status = hardBlocked
  ? "blocked_for_invalid_or_forbidden_fallback_route_receipt"
  : allRowsRouted
    ? "fallback_route_receipt_ready_for_low_token_evidence_plan_follow_up"
    : requestNewRouteRows.length
      ? "fallback_route_receipt_requests_new_route_generation"
      : "fallback_route_receipt_needs_more_teacher_route_review";

const nextCommand =
  allRowsRouted && !hardBlocked
    ? commandLine("create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs", [
        ["--validation", validationPath],
        ["--plan", pack.sourceEvidence?.blockedWaitingRowEvidencePlan || "<original-goal-low-token-blocked-waiting-row-evidence-plan.json>"],
        ["--output-dir", join(validationDir, "fallback-route-evidence-plan-receipt-draft")]
      ])
    : "";

const validation = {
  ok: !hardBlocked && allRowsRouted,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision: topDecision,
  sourceEvidence: {
    pack: packInput.path,
    receipt: receiptInput.path,
    blockedWaitingRowEvidencePlan: pack.sourceEvidence?.blockedWaitingRowEvidencePlan || ""
  },
  counts: {
    packRows: (pack.rows || []).length,
    receiptRows: receiptRows.length,
    readyRows: readyRows.length,
    invalidRows: invalidRows.length,
    requestNewRouteRows: requestNewRouteRows.length,
    extraRows: extraRows.length,
    blockers: blockers.length
  },
  blockers,
  validationRows,
  extraRows,
  nextSafeCommand: {
    executeNow: false,
    commandLine: nextCommand,
    reason: nextCommand
      ? "Teacher-selected fallback routes can now be copied into a blocked waiting-row evidence plan receipt draft without fabricating compact evidence."
      : "Route selections are incomplete, invalid, forbidden, or need new route generation.",
    selectedRouteStillNotCoverage: true
  },
  blockedShortcuts: [
    "Do not infer coverage from selected fallback routes.",
    "Do not run metadata probes from this validator.",
    "Do not read logs, full logs, chat content, browser history, account data, or media history.",
    "Do not capture screenshots, execute target software, register schedules, write memory, unlock packaging, or claim completion."
  ],
  paths: {
    validation: validationPath,
    html: htmlPath,
    readme: readmePath
  },
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

writeJson(validationPath, validation);
const rows = validationRows
  .map(
    (row) =>
      `<tr><td>${htmlEscape(row.rowId)}</td><td>${htmlEscape(row.software)}</td><td>${htmlEscape(
        row.selectedRouteId
      )}</td><td>${htmlEscape(row.status)}</td></tr>`
  )
  .join("\n");
writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>Fallback Route Receipt Validation</title><style>body{font-family:Arial,sans-serif;margin:24px;line-height:1.4}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;vertical-align:top}code,pre{background:#f5f5f5;padding:2px 4px}pre{white-space:pre-wrap}</style></head><body><h1>Fallback Route Receipt Validation</h1><p>Status: <code>${htmlEscape(status)}</code></p><table><thead><tr><th>Row</th><th>Software</th><th>Selected Route</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><h2>Next Safe Command</h2><pre>${htmlEscape(nextCommand || "No command until route receipt is valid.")}</pre></body></html>\n`,
  "utf8"
);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Fallback Route Evidence Pack Receipt Validation",
    "",
    `Status: ${status}`,
    `Ready rows: ${readyRows.length}`,
    `Invalid rows: ${invalidRows.length}`,
    "",
    "This validation checks teacher-selected fallback routes before any downstream low-token evidence plan receipt.",
    "",
    "Safety boundary:",
    "- This validator is review-only.",
    "- It does not run metadata probes, read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "- Selected routes remain evidence paths only.",
    "",
    "Next safe command:",
    nextCommand || "No command until route receipt is valid."
  ].join("\n"),
  "utf8"
);

const result = {
  ok: validation.ok,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_validation_result_v1",
  status,
  validationPath,
  htmlPath,
  readmePath,
  counts: validation.counts,
  blockers,
  nextSafeCommand: validation.nextSafeCommand,
  locks: lockState,
  executeNow: false,
  goalComplete: false
};
console.log(JSON.stringify(result, null, 2));
if (!validation.ok) process.exit(1);
