#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "low-token-fallback-route-manual-review-patch-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "low-token-fallback-route-manual-review-patch-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    teacherPatchValidationOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
    routeSelectionIsNotCoverage: true,
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

const allowedDecisions = new Set([
  "needs_teacher_review",
  "select_recommended_route_after_review",
  "select_different_candidate_route_after_review",
  "mark_out_of_scope",
  "request_new_route"
]);

function validateRow(manualRow, patchRow) {
  const blockers = [];
  const candidateRoutes = Array.isArray(manualRow.candidateRoutes) ? manualRow.candidateRoutes : [];
  const candidateRouteIds = new Set(candidateRoutes.map((route) => route.routeId).filter(Boolean));
  const decision = String(patchRow?.teacherDecision || "needs_teacher_review");
  const selectedRouteId = String(patchRow?.selectedRouteId || "");

  if (!patchRow) blockers.push("missing_patch_row");
  if (!allowedDecisions.has(decision)) blockers.push("unsupported_teacher_decision");
  if (patchRow && patchRow.rowId !== manualRow.rowId) blockers.push("row_id_mismatch");
  if (patchRow && patchRow.software !== manualRow.software) blockers.push("software_mismatch");
  if (patchRow && patchRow.noContentReadConfirmed !== true) blockers.push("no_content_read_not_confirmed");
  if (patchRow && patchRow.privacyBoundaryReviewed !== true) blockers.push("privacy_boundary_not_reviewed");

  if (decision === "needs_teacher_review") {
    blockers.push("teacher_decision_still_needs_review");
  }

  if (decision === "request_new_route") {
    if (!String(patchRow?.routeSelectionNote || "").trim()) blockers.push("new_route_request_note_missing");
  }

  if (decision === "mark_out_of_scope") {
    if (!String(patchRow?.routeSelectionNote || "").trim()) blockers.push("out_of_scope_reason_missing");
  }

  if (decision === "select_recommended_route_after_review") {
    if (!selectedRouteId) blockers.push("selected_route_missing");
    if (selectedRouteId !== manualRow.recommendation?.safestRouteId) blockers.push("selected_route_not_recommended");
    if (patchRow?.routeEvidenceReviewed !== true) blockers.push("route_evidence_not_reviewed");
  }

  if (decision === "select_different_candidate_route_after_review") {
    if (!selectedRouteId) blockers.push("selected_route_missing");
    if (!candidateRouteIds.has(selectedRouteId)) blockers.push("selected_route_not_in_candidate_routes");
    if (selectedRouteId === manualRow.recommendation?.safestRouteId) blockers.push("different_route_decision_used_recommended_route");
    if (patchRow?.routeEvidenceReviewed !== true) blockers.push("route_evidence_not_reviewed");
    if (!String(patchRow?.routeSelectionNote || "").trim()) blockers.push("different_route_reason_missing");
  }

  const readyForFollowUp =
    blockers.length === 0 &&
    ["select_recommended_route_after_review", "select_different_candidate_route_after_review", "mark_out_of_scope"].includes(
      decision
    );

  return {
    rowId: manualRow.rowId,
    software: manualRow.software || "",
    category: manualRow.category || "",
    teacherDecision: decision,
    recommendedRouteId: manualRow.recommendation?.safestRouteId || "",
    selectedRouteId,
    readyForFollowUp,
    status: readyForFollowUp
      ? decision === "mark_out_of_scope"
        ? "teacher_marked_out_of_scope_ready_for_locked_follow_up"
        : "teacher_selected_manual_route_ready_for_locked_follow_up"
      : "manual_route_patch_needs_teacher_review",
    blockers,
    locks: locks()
  };
}

function writeHtml(path, packet) {
  const rows = packet.validationRows
    .map(
      (row) => `<article class="row">
        <h2>${htmlEscape(row.software || row.rowId)}</h2>
        <p><strong>Row:</strong> <code>${htmlEscape(row.rowId)}</code></p>
        <p><strong>Decision:</strong> <code>${htmlEscape(row.teacherDecision)}</code></p>
        <p><strong>Status:</strong> <code>${htmlEscape(row.status)}</code></p>
        <p><strong>Recommended route:</strong> <code>${htmlEscape(row.recommendedRouteId)}</code></p>
        <p><strong>Selected route:</strong> <code>${htmlEscape(row.selectedRouteId)}</code></p>
        <p><strong>Blockers:</strong> ${row.blockers.length ? row.blockers.map((item) => `<code>${htmlEscape(item)}</code>`).join(" ") : "none"}</p>
      </article>`
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Low-Token Manual Route Review Patch Validation</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    .summary, .row { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 15px; margin: 14px 0; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Low-Token Manual Route Review Patch Validation</h1>
  <section class="summary">
    <p><strong>Status:</strong> <code>${htmlEscape(packet.status)}</code></p>
    <p><strong>Ready rows:</strong> ${htmlEscape(packet.counts.readyRows)} / ${htmlEscape(packet.counts.totalRows)}</p>
    <p><strong>Manual pack:</strong> <a href="${htmlEscape(fileHref(packet.sourceEvidence.manualReviewPack))}">${htmlEscape(packet.sourceEvidence.manualReviewPack)}</a></p>
    <p><strong>Teacher patch:</strong> <a href="${htmlEscape(fileHref(packet.sourceEvidence.teacherPatch))}">${htmlEscape(packet.sourceEvidence.teacherPatch)}</a></p>
    <p>This validation does not read logs, capture screenshots, execute software, register schedules, write memory, enable rules, or claim coverage.</p>
  </section>
  ${rows}
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, packet) {
  const lines = [
    "# Low-Token Manual Route Review Patch Validation",
    "",
    `Status: ${packet.status}`,
    `Ready rows: ${packet.counts.readyRows} / ${packet.counts.totalRows}`,
    `Blocked rows: ${packet.counts.blockedRows}`,
    "",
    "Rows:",
    ...packet.validationRows.map((row) => `- ${row.rowId} ${row.software}: ${row.status} (${row.blockers.join(", ") || "no blockers"})`),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const manualReviewPackPath = resolve(argValue("--pack", argValue("--manual-review-pack", "")));
const teacherPatchPath = resolve(argValue("--patch", argValue("--teacher-patch", "")));
if (!manualReviewPackPath || !existsSync(manualReviewPackPath) || !teacherPatchPath || !existsSync(teacherPatchPath)) {
  throw new Error(
    "Usage: node validate-original-goal-low-token-fallback-route-manual-review-patch.mjs --pack <manual-review-pack.json> --patch <teacher-filled-patch.json>"
  );
}

const manualReviewPack = readJson(manualReviewPackPath);
const teacherPatch = readJson(teacherPatchPath);
if (manualReviewPack.format !== "transparent_ai_low_token_fallback_route_manual_review_pack_v1") {
  throw new Error("--pack must be transparent_ai_low_token_fallback_route_manual_review_pack_v1");
}
if (teacherPatch.format !== "transparent_ai_low_token_fallback_route_manual_review_patch_v1") {
  throw new Error("--patch must be transparent_ai_low_token_fallback_route_manual_review_patch_v1");
}

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), "artifacts", "low-token-fallback-route-manual-review-patch-validations"))
);
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(basename(teacherPatchPath, ".json"))}`;
const dir = join(outputRoot, validationId);
mkdirSync(dir, { recursive: true });

const patchRowsById = new Map((teacherPatch.rows || []).map((row) => [row.rowId, row]));
const validationRows = (manualReviewPack.manualRows || []).map((row) => validateRow(row, patchRowsById.get(row.rowId)));
const missingPatchRows = (teacherPatch.rows || []).filter(
  (row) => !(manualReviewPack.manualRows || []).some((manualRow) => manualRow.rowId === row.rowId)
);
const readyRows = validationRows.filter((row) => row.readyForFollowUp).length;
const blockedRows = validationRows.length - readyRows;
const lockState = locks();
const packetPath = join(dir, "low-token-fallback-route-manual-review-patch-validation.json");
const htmlPath = join(dir, "low-token-fallback-route-manual-review-patch-validation.html");
const readmePath = join(dir, "LOW_TOKEN_FALLBACK_ROUTE_MANUAL_REVIEW_PATCH_VALIDATION_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_low_token_fallback_route_manual_review_patch_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status:
    readyRows === validationRows.length && missingPatchRows.length === 0
      ? "manual_route_patch_ready_for_locked_follow_up"
      : "manual_route_patch_waiting_for_teacher_review_or_corrections",
  sourceEvidence: {
    manualReviewPack: manualReviewPackPath,
    teacherPatch: teacherPatchPath,
    sourceValidation: manualReviewPack.sourceEvidence?.validation || ""
  },
  counts: {
    totalRows: validationRows.length,
    readyRows,
    blockedRows,
    missingPatchRows: missingPatchRows.length,
    remoteControlRows: validationRows.filter((row) => row.category === "remote_control_app").length,
    chatRows: validationRows.filter((row) => row.category === "chat_app").length
  },
  validationRows,
  missingPatchRows: missingPatchRows.map((row) => ({ rowId: row.rowId || "", software: row.software || "" })),
  blockedClaims: [
    "claim_all_software_low_token_coverage_complete_from_manual_patch_validation",
    "run_metadata_probe_from_manual_patch_validation",
    "read_logs_from_manual_patch_validation",
    "execute_target_software_from_manual_patch_validation",
    "register_monitor_from_manual_patch_validation",
    "write_memory_from_manual_patch_validation",
    "claim_goal_complete_from_manual_patch_validation"
  ],
  paths: {
    validation: packetPath,
    html: htmlPath,
    readme: readmePath
  },
  locks: lockState
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_low_token_fallback_route_manual_review_patch_validation_result_v1",
      status: packet.status,
      validationPath: packetPath,
      htmlPath,
      readmePath,
      counts: packet.counts,
      goalComplete: false,
      locks: lockState
    },
    null,
    2
  )
);
