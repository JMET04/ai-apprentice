#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "original-goal-low-token-fallback-route-shortlist-batch-review")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "original-goal-low-token-fallback-route-shortlist-batch-review"
  );
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

function fileHref(path) {
  return `file:///${String(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
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
    batchReviewOnly: true,
    draftOnly: true,
    teacherMustConfirm: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    batchReviewDoesNotSelectRoutes: true,
    batchReviewDoesNotRunMetadataProbe: true,
    batchReviewDoesNotReadLogs: true,
    batchReviewDoesNotReadFullLogs: true,
    batchReviewDoesNotTailFiles: true,
    batchReviewDoesNotCaptureScreenshots: true,
    batchReviewDoesNotExecuteTargetSoftware: true,
    batchReviewDoesNotRegisterSchedule: true,
    batchReviewDoesNotWriteMemory: true,
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

function isMetadataOnly(row) {
  return row.riskBoundary === "metadata_only_low_token" && String(row.tokenPolicy || "").includes("metadata_only");
}

function isManual(row) {
  return (
    String(row.riskBoundary || "").includes("manual_marker") ||
    String(row.riskBoundary || "").includes("zero_token") ||
    String(row.recommendedRouteId || "").includes("teacher_exclusion")
  );
}

function isPrivacySensitive(row) {
  return String(row.riskBoundary || "").includes("privacy_sensitive") || String(row.category || "").includes("chat");
}

function receiptRowFromRecommendation(row, selected) {
  const base = {
    rowId: row.rowId,
    ledgerNumber: row.ledgerNumber || "",
    software: row.software || "",
    category: row.category || "",
    allowedRouteIds: row.recommendedRoute?.routeId ? [row.recommendedRoute.routeId] : row.allowedRouteIds || [],
    recommendedRouteId: row.recommendedRouteId || "",
    teacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: ["needs_teacher_review", "select_candidate_route", "mark_out_of_scope", "request_new_route"],
    blockedTeacherDecisions: [
      "accepted",
      "read_logs_now",
      "read_full_logs",
      "capture_screenshot_now",
      "execute_now",
      "register_monitor_now",
      "write_memory_now",
      "claim_all_software_coverage_complete",
      "claim_goal_complete"
    ],
    selectedRouteId: "",
    routeEvidenceReviewed: false,
    privacyBoundaryReviewed: false,
    noContentReadConfirmed: false,
    routeSelectionNote: "",
    reviewedEvidencePathOrSignal: ""
  };
  if (!selected) return base;
  return {
    ...base,
    teacherDecision: "select_candidate_route",
    selectedRouteId: row.recommendedRouteId || "",
    routeEvidenceReviewed: true,
    privacyBoundaryReviewed: true,
    noContentReadConfirmed: true,
    routeSelectionNote:
      "DRAFT ONLY: teacher may batch-confirm this metadata-only recommendation after checking the row, route boundary, and no-content-read rule.",
    reviewedEvidencePathOrSignal: row.evidenceToReview || "metadata-only route evidence summary"
  };
}

function writeHtml(path, reviewPack) {
  function rowsTable(rows, emptyLabel) {
    if (!rows.length) return `<p>${htmlEscape(emptyLabel)}</p>`;
    return `<table><thead><tr><th>#</th><th>Row</th><th>Software</th><th>Category</th><th>Route</th><th>Boundary</th><th>Teacher action</th></tr></thead><tbody>${rows
      .map(
        (row) => `<tr>
          <td>${htmlEscape(row.priority)}</td>
          <td>${htmlEscape(row.rowId)}</td>
          <td>${htmlEscape(row.software)}</td>
          <td>${htmlEscape(row.category)}</td>
          <td><code>${htmlEscape(row.recommendedRouteId)}</code></td>
          <td>${htmlEscape(row.riskBoundary)}</td>
          <td>${htmlEscape(row.teacherAction)}</td>
        </tr>`
      )
      .join("\n")}</tbody></table>`;
  }
  const links = Object.entries(reviewPack.paths)
    .filter(([, value]) => value)
    .map(([key, value]) => `<li><a href="${htmlEscape(fileHref(value))}">${htmlEscape(key)}</a></li>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Low-Token Fallback Route Batch Review</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #18212b; background: #f6f8fa; }
    main { max-width: 1220px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 17px; margin: 24px 0 8px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #778597; border-radius: 6px; background: #fff; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d7dde5; }
    th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #e4e9ef; }
    code { background: #eef2f6; padding: 1px 4px; border-radius: 4px; }
    a { color: #0b5cad; }
  </style>
</head>
<body>
  <main>
    <h1>Low-Token Fallback Route Batch Review</h1>
    <p class="status">${htmlEscape(reviewPack.status)}</p>
    <p>Goal: ${htmlEscape(reviewPack.goal)}</p>
    <p>Metadata-only batch rows: ${htmlEscape(reviewPack.counts.metadataOnlyBatchRows)} | Manual rows: ${htmlEscape(
      reviewPack.counts.manualReviewRows
    )} | Privacy rows: ${htmlEscape(reviewPack.counts.privacySensitiveRows)}</p>
    <h2>Batch-Confirm Candidate Rows</h2>
    ${rowsTable(reviewPack.reviewLanes.metadataOnlyBatchRows, "No rows are safe for batch review.")}
    <h2>Manual One-By-One Rows</h2>
    ${rowsTable(reviewPack.reviewLanes.manualReviewRows, "No manual rows.")}
    <h2>Privacy-Sensitive Rows</h2>
    ${rowsTable(reviewPack.reviewLanes.privacySensitiveRows, "No privacy-sensitive rows.")}
    <h2>Evidence</h2>
    <ul>${links}</ul>
    <h2>Important</h2>
    <p>The batch draft is only a convenience template. It must be teacher-confirmed and validator-checked before any follow-up, and it still does not run probes, read logs, capture screenshots, execute software, register schedules, write memory, or claim coverage.</p>
  </main>
</body>
</html>`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher batch-review pack from a low-token fallback route shortlist.");
const shortlistInput = readJsonInput(
  argValue("--shortlist", argValue("--fallback-route-shortlist", "")),
  "--shortlist",
  "transparent_ai_original_goal_low_token_fallback_route_shortlist_v1"
);
const outputRoot = resolve(
  argValue(
    "--out-dir",
    argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-fallback-route-shortlist-batch-reviews"))
  )
);

const shortlist = shortlistInput.value;
const lockState = locks();
const reviewId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(shortlist.shortlistId || goal)}`;
const dir = join(outputRoot, reviewId);
const reviewPackPath = join(dir, "original-goal-low-token-fallback-route-shortlist-batch-review.json");
const htmlPath = join(dir, "original-goal-low-token-fallback-route-shortlist-batch-review.html");
const defaultReceiptPath = join(dir, "teacher-low-token-fallback-route-batch-review-default-receipt-template.json");
const batchDraftReceiptPath = join(dir, "teacher-low-token-fallback-route-metadata-only-batch-draft-receipt.json");
const readmePath = join(dir, "ORIGINAL_GOAL_LOW_TOKEN_FALLBACK_ROUTE_SHORTLIST_BATCH_REVIEW_START_HERE.md");

const recommendations = Array.isArray(shortlist.recommendations) ? shortlist.recommendations : [];
const metadataOnlyBatchRows = recommendations
  .filter((row) => isMetadataOnly(row) && !isPrivacySensitive(row))
  .map((row) => ({ ...row, teacherAction: "May be batch-confirmed only after checking metadata-only and no-content-read constraints." }));
const manualReviewRows = recommendations
  .filter((row) => isManual(row))
  .map((row) => ({ ...row, teacherAction: "Must be reviewed one by one; do not batch-confirm security/manual-marker routes." }));
const privacySensitiveRows = recommendations
  .filter((row) => isPrivacySensitive(row) && !manualReviewRows.some((manual) => manual.rowId === row.rowId))
  .map((row) => ({ ...row, teacherAction: "Must be reviewed one by one because content/account/chat boundaries matter." }));
const otherReviewRows = recommendations
  .filter(
    (row) =>
      !metadataOnlyBatchRows.some((batchRow) => batchRow.rowId === row.rowId) &&
      !manualReviewRows.some((manualRow) => manualRow.rowId === row.rowId) &&
      !privacySensitiveRows.some((privacyRow) => privacyRow.rowId === row.rowId)
  )
  .map((row) => ({ ...row, teacherAction: "Needs one-by-one review because it did not satisfy the conservative batch rule." }));

const sourcePackPath = shortlist.sourceEvidence?.packPath || shortlist.paths?.sourcePack || "";
const defaultReceipt = {
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_v1",
  templateOnly: true,
  batchReviewId: reviewId,
  sourceShortlistPath: shortlistInput.path,
  sourcePackPath,
  packId: shortlist.sourceEvidence?.packId || "",
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "routes_selected_for_follow_up", "blocked", "request_new_routes"],
  blockedTeacherDecisions: [
    "accepted",
    "read_logs_now",
    "read_full_logs",
    "capture_screenshot_now",
    "execute_now",
    "register_monitor_now",
    "write_memory_now",
    "claim_all_software_coverage_complete",
    "claim_goal_complete"
  ],
  routeSelectionIsNotCoverage: true,
  blockedShortcutsReviewed: false,
  noFullLogReadConfirmed: false,
  noScreenshotConfirmed: false,
  noSoftwareExecutionConfirmed: false,
  noMemoryWriteConfirmed: false,
  receiptRows: recommendations.map((row) => receiptRowFromRecommendation(row, false)),
  locks: lockState
};

const batchDraftReceipt = {
  ...defaultReceipt,
  templateOnly: false,
  draftOnly: true,
  teacherMustConfirm: true,
  teacherDecision: "routes_selected_for_follow_up",
  blockedShortcutsReviewed: true,
  noFullLogReadConfirmed: true,
  noScreenshotConfirmed: true,
  noSoftwareExecutionConfirmed: true,
  noMemoryWriteConfirmed: true,
  receiptRows: recommendations.map((row) =>
    receiptRowFromRecommendation(row, metadataOnlyBatchRows.some((batchRow) => batchRow.rowId === row.rowId))
  ),
  draftWarning:
    "This draft only pre-fills metadata-only rows. It is not teacher acceptance, not route execution, not coverage, and not completion. Manual/privacy rows remain needs_teacher_review."
};

const reviewPack = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_shortlist_batch_review_v1",
  reviewId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_batch_review_of_low_token_fallback_routes",
  sourceEvidence: {
    shortlistPath: shortlistInput.path,
    shortlistId: shortlist.shortlistId || "",
    sourcePackPath,
    packId: shortlist.sourceEvidence?.packId || "",
    sourceCandidateRoutes: shortlist.counts?.sourceCandidateRoutes || 0
  },
  counts: {
    totalRows: recommendations.length,
    metadataOnlyBatchRows: metadataOnlyBatchRows.length,
    manualReviewRows: manualReviewRows.length,
    privacySensitiveRows: privacySensitiveRows.length,
    otherReviewRows: otherReviewRows.length,
    draftSelectedRows: metadataOnlyBatchRows.length,
    rowsStillNeedingOneByOneReview: manualReviewRows.length + privacySensitiveRows.length + otherReviewRows.length
  },
  reviewLanes: {
    metadataOnlyBatchRows,
    manualReviewRows,
    privacySensitiveRows,
    otherReviewRows
  },
  defaultValidationCommand: commandLine("validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs", [
    ["--pack", sourcePackPath || "<original-goal-low-token-fallback-route-evidence-pack.json>"],
    ["--receipt", defaultReceiptPath],
    ["--output-dir", join(dir, "default-receipt-validation")]
  ]),
  draftValidationCommand: commandLine("validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs", [
    ["--pack", sourcePackPath || "<original-goal-low-token-fallback-route-evidence-pack.json>"],
    ["--receipt", batchDraftReceiptPath],
    ["--output-dir", join(dir, "metadata-only-draft-validation")]
  ]),
  blockedShortcuts: [
    "batch_review_does_not_select_routes_until_teacher_confirms_receipt",
    "metadata_only_batch_draft_is_not_acceptance",
    "manual_and_privacy_rows_must_remain_one_by_one",
    "do_not_run_metadata_probe_from_review_pack",
    "do_not_read_logs_or_full_logs",
    "do_not_capture_screenshots",
    "do_not_execute_target_software",
    "do_not_register_schedule",
    "do_not_write_memory",
    "do_not_claim_all_software_coverage_complete",
    "do_not_claim_goal_complete"
  ],
  paths: {
    reviewPack: reviewPackPath,
    html: htmlPath,
    readme: readmePath,
    defaultReceipt: defaultReceiptPath,
    metadataOnlyBatchDraftReceipt: batchDraftReceiptPath,
    sourceShortlist: shortlistInput.path,
    sourcePack: sourcePackPath
  },
  locks: lockState,
  executeNow: false,
  goalComplete: false
};

writeJson(reviewPackPath, reviewPack);
writeJson(defaultReceiptPath, defaultReceipt);
writeJson(batchDraftReceiptPath, batchDraftReceipt);
writeHtml(htmlPath, reviewPack);
writeFileSync(
  readmePath,
  [
    "# Original Goal Low-Token Fallback Route Shortlist Batch Review",
    "",
    `Status: ${reviewPack.status}`,
    `Total rows: ${reviewPack.counts.totalRows}`,
    `Metadata-only batch rows: ${reviewPack.counts.metadataOnlyBatchRows}`,
    `Rows still needing one-by-one review: ${reviewPack.counts.rowsStillNeedingOneByOneReview}`,
    "",
    "This pack reduces teacher review cost by grouping only conservative metadata-only recommendations. It does not select routes, run probes, read logs, capture screenshots, execute software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "",
    "Teacher workflow:",
    "1. Open the HTML and review the batch lane plus manual lanes.",
    "2. Use the default receipt for a fully manual path, or edit the draft receipt after confirming every pre-filled metadata-only row.",
    "3. Run the validator. A partial draft can show ready rows while still blocking manual/privacy rows.",
    "",
    `Review pack: ${reviewPackPath}`,
    `Default receipt: ${defaultReceiptPath}`,
    `Metadata-only batch draft: ${batchDraftReceiptPath}`,
    `Default validation command: ${reviewPack.defaultValidationCommand}`,
    `Draft validation command: ${reviewPack.draftValidationCommand}`
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_fallback_route_shortlist_batch_review_result_v1",
      status: reviewPack.status,
      reviewPackPath,
      htmlPath,
      defaultReceiptPath,
      batchDraftReceiptPath,
      readmePath,
      counts: reviewPack.counts,
      defaultValidationCommand: reviewPack.defaultValidationCommand,
      draftValidationCommand: reviewPack.draftValidationCommand,
      locks: lockState,
      executeNow: false,
      goalComplete: false
    },
    null,
    2
  )
);
