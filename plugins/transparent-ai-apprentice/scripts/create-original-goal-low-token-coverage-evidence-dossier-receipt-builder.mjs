#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-coverage-evidence-dossier-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-coverage-evidence-dossier-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJsonFile(path, value) {
  writeFileSync(path, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotWriteReceipt: true,
    browserCanDownloadGeneratedReceipt: true,
    browserCanCopyGeneratedReceipt: true,
    builderUsesSafeTextRendering: true,
    browserCanBulkApplyRecommendedReviewDecisions: true,
    browserCanResetRowsToNeedsTeacherReview: true,
    browserCanCaptureTeacherNotes: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunFollowUpPlan: true,
    builderDoesNotRunBatch: true,
    builderDoesNotReadLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotRegisterSchedule: true,
    builderDoesNotWriteMemory: true,
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
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function defaultDecisionForBucket(bucket) {
  if (bucket === "waiting_for_low_token_watch_evidence") return "teacher_reviewed_collect_metadata_follow_up";
  if (bucket === "waiting_for_queue_enrollment") return "teacher_reviewed_promote_to_observer_queue";
  if (bucket === "needs_teacher_signal_or_exclusion") return "teacher_reviewed_prepare_signal_question";
  if (bucket === "ready_for_teacher_coverage_review") return "teacher_reviewed_ready_coverage_row";
  if (bucket === "teacher_excluded_or_private") return "teacher_excluded_or_private";
  return "needs_teacher_review";
}

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Low-Token Coverage Evidence Dossier Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    `Source dossier: ${builder.paths.sourceDossier}`,
    "",
    "Use the HTML page to generate a teacher-filled receipt for the low-token coverage dossier rows.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON in the browser.",
    "- Bulk controls only prefill teacher-review choices in the browser; the teacher still must inspect, generate, save, and validate the receipt.",
    "- It can copy or download the generated receipt only after the teacher clicks the browser control.",
    "- The generator script does not save the generated receipt.",
    "- It does not validate the receipt.",
    "- It does not run follow-up plans, read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher receipt for the original-goal low-token coverage evidence dossier.");
const dossierInput = readJsonInput(
  argValue("--dossier", argValue("--coverage-dossier", "")),
  "--dossier",
  "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1"
);
if (!dossierInput.value) throw new Error("--dossier is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-coverage-evidence-dossier-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const dossier = dossierInput.value;
const lockState = locks();
const htmlPath = join(builderDir, "original-goal-low-token-coverage-evidence-dossier-receipt-builder.html");
const builderPath = join(builderDir, "original-goal-low-token-coverage-evidence-dossier-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-low-token-coverage-dossier-receipt-template.json");
const readmePath = join(builderDir, "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_DOSSIER_RECEIPT_BUILDER_START_HERE.md");

const reviewRows = [...(dossier.nextReviewRows || []), ...(dossier.sampleReadyRows || [])]
  .filter((row, index, rows) => rows.findIndex((candidate) => candidate.ledgerNumber === row.ledgerNumber) === index)
  .map((row) => ({
    ledgerNumber: row.ledgerNumber || 0,
    software: row.software || "unknown software",
    processName: row.processName || "",
    status: row.status || "",
    bucket: row.bucket || "needs_teacher_signal_or_exclusion",
    watchEvidenceCount: row.watchEvidenceCount || 0,
    candidateLogFileCount: row.candidateLogFileCount || 0,
    candidateLogRootCount: row.candidateLogRootCount || 0,
    windowsEventLogCount: row.windowsEventLogCount || 0,
    nonLogFallbackSignalCount: row.nonLogFallbackSignalCount || 0,
    nextAction: row.nextAction || "",
    defaultDecision: defaultDecisionForBucket(row.bucket),
    allowedTeacherDecisions: [
      "needs_teacher_review",
      "teacher_reviewed_collect_metadata_follow_up",
      "teacher_reviewed_promote_to_observer_queue",
      "teacher_reviewed_prepare_signal_question",
      "teacher_reviewed_ready_coverage_row",
      "teacher_excluded_or_private",
      "blocked_needs_more_evidence"
    ],
    blockedTeacherDecisions: [
      "accepted",
      "run_now",
      "execute_now",
      "allow_bounded_tail",
      "capture_screenshot",
      "read_full_logs",
      "execute_software",
      "register_schedule",
      "write_memory",
      "claim_complete",
      "native_universal_execution",
      "unlock_packaging"
    ],
    locks: lockState
  }));

const receiptTemplate = {
  format: "transparent_ai_original_goal_low_token_coverage_dossier_review_receipt_v1",
  builderId,
  sourceDossier: dossierInput.path,
  decision: "needs_teacher_review",
  coverageAccepted: false,
  allSoftwareCoverageComplete: false,
  allowBoundedTail: false,
  rowDecisions: reviewRows.map((row) => ({
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    bucket: row.bucket,
    teacherDecision: row.defaultDecision,
    evidenceReviewed: false,
    teacherNote: ""
  })),
  locks: lockState
};

const builder = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_dossier_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "low_token_coverage_dossier_receipt_builder_ready_for_teacher_use",
  sourceDossierStatus: dossier.status || "",
  counts: {
    dossierRows: dossier.counts?.ledgerRows || 0,
    reviewRows: reviewRows.length,
    waitingForLowTokenEvidence: dossier.counts?.waitingForLowTokenEvidence || 0,
    waitingForQueueEnrollment: dossier.counts?.waitingForQueueEnrollment || 0,
    needsTeacherSignalOrExclusion: dossier.counts?.needsTeacherSignalOrExclusion || 0,
    readyForTeacherCoverageReview: dossier.counts?.readyForTeacherCoverageReview || 0
  },
  reviewRows,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs --builder "' +
    builderPath +
    '" --receipt "<teacher-filled-low-token-coverage-dossier-receipt.json>"',
  blockedActions: [
    "run_follow_up_plan_from_dossier_receipt_builder",
    "read_logs_from_dossier_receipt_builder",
    "capture_screenshot_from_dossier_receipt_builder",
    "execute_target_software_from_dossier_receipt_builder",
    "register_schedule_from_dossier_receipt_builder",
    "write_memory_from_dossier_receipt_builder",
    "claim_all_software_coverage_complete_from_dossier_receipt_builder",
    "render_untrusted_software_names_with_inner_html",
    "auto_apply_bulk_decisions_without_teacher_click",
    "save_bulk_decisions_without_receipt_validation"
  ],
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceDossier: dossierInput.path,
    sourceStatusRefresh: dossier.sourceEvidence?.statusRefresh || "",
    sourceLedger: dossier.sourceEvidence?.coverageEnrollmentLedger || ""
  },
  locks: lockState
};

writeJsonFile(builderPath, builder);
writeJsonFile(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, builder);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Low-Token Coverage Dossier Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p, li { line-height: 1.55; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-top: 16px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    label { display: block; margin: 8px 0; font-weight: 600; }
    select { min-height: 34px; width: 100%; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    textarea#receipt { min-height: 320px; }
    textarea.note { min-height: 72px; margin-top: 6px; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Low-Token Coverage Dossier Receipt Builder</h1>
  <section class="panel">
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Review rows:</strong> ${htmlEscape(reviewRows.length)}; waiting low-token evidence: ${htmlEscape(builder.counts.waitingForLowTokenEvidence)}; waiting queue enrollment: ${htmlEscape(builder.counts.waitingForQueueEnrollment)}</p>
    <p class="muted">This page generates a receipt JSON only. It does not run tools, read full logs, capture screenshots, execute software, write memory, accept coverage, unlock packaging, or claim completion.</p>
    <p><code>${htmlEscape(builder.nextValidationCommand)}</code></p>
  </section>
  <section class="panel">
    <h2>Bulk Review Helpers</h2>
    <p class="muted">These buttons only prefill visible choices in this browser page. They do not save, validate, execute, read logs, or claim coverage.</p>
    <div class="actions">
      <button class="secondary" id="apply-recommended-waiting">Set waiting rows to metadata follow-up</button>
      <button class="secondary" id="apply-recommended-ready">Set ready rows to coverage review</button>
      <button class="secondary" id="reset-needs-review">Reset all rows to needs teacher review</button>
    </div>
  </section>
  <section class="grid" id="rows"></section>
  <h2>Generated Receipt JSON</h2>
  <textarea id="receipt"></textarea>
  <div class="actions">
    <button id="generate">Generate receipt JSON</button>
    <button class="secondary" id="download">Download receipt JSON</button>
    <button class="secondary" id="copy">Copy JSON</button>
  </div>
  <p class="muted" id="status"></p>
</main>
<script>
const template = ${jsonForScript(receiptTemplate)};
const rows = ${jsonForScript(reviewRows)};
const rowContainer = document.getElementById("rows");
const output = document.getElementById("receipt");
const statusLine = document.getElementById("status");
const downloadFileName = "teacher-low-token-coverage-dossier-receipt.json";

function appendText(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text == null ? "" : String(text);
  parent.appendChild(element);
  return element;
}

for (const row of rows) {
  const el = document.createElement("section");
  el.className = "row";
  appendText(el, "span", "#" + row.ledgerNumber + " " + row.bucket, "badge");
  appendText(el, "h2", row.software);
  appendText(el, "p", row.status, "muted");
  appendText(el, "p", row.nextAction);
  const label = appendText(el, "label", "Teacher decision");
  const select = document.createElement("select");
  select.dataset.ledger = String(row.ledgerNumber);
  for (const decision of row.allowedTeacherDecisions) {
    const option = document.createElement("option");
    option.value = decision;
    option.textContent = decision;
    option.selected = decision === row.defaultDecision;
    select.appendChild(option);
  }
  label.appendChild(select);
  const noteLabel = appendText(el, "label", "Teacher note");
  const note = document.createElement("textarea");
  note.className = "note";
  note.dataset.ledgerNote = String(row.ledgerNumber);
  note.placeholder = "Optional review note or blocker.";
  noteLabel.appendChild(note);
  rowContainer.appendChild(el);
}
function generate() {
  const receipt = JSON.parse(JSON.stringify(template));
  for (const select of document.querySelectorAll("select[data-ledger]")) {
    const ledger = Number(select.getAttribute("data-ledger"));
    const target = receipt.rowDecisions.find((row) => Number(row.ledgerNumber) === ledger);
    if (target) {
      target.teacherDecision = select.value;
      target.evidenceReviewed = select.value !== "needs_teacher_review";
    }
  }
  for (const note of document.querySelectorAll("textarea[data-ledger-note]")) {
    const ledger = Number(note.getAttribute("data-ledger-note"));
    const target = receipt.rowDecisions.find((row) => Number(row.ledgerNumber) === ledger);
    if (target) target.teacherNote = note.value || "";
  }
  receipt.decision = "teacher_reviewed_low_token_coverage_dossier";
  receipt.generatedAt = new Date().toISOString();
  output.value = JSON.stringify(receipt, null, 2);
  statusLine.textContent = "Receipt JSON generated in the browser. Save it and run the validation command above.";
  return output.value;
}
function downloadReceipt() {
  const text = output.value || generate();
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
  statusLine.textContent = "Download prepared by the browser.";
}
async function copyReceipt() {
  const text = output.value || generate();
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    output.focus();
    output.select();
    document.execCommand("copy");
  }
  statusLine.textContent = "Receipt JSON copied.";
}
function setRowsByBucket(bucket, decision) {
  let changed = 0;
  for (const row of rows) {
    if (row.bucket !== bucket) continue;
    const select = document.querySelector('select[data-ledger="' + row.ledgerNumber + '"]');
    if (select && Array.from(select.options).some((option) => option.value === decision)) {
      select.value = decision;
      changed += 1;
    }
  }
  generate();
  statusLine.textContent = "Updated " + changed + " visible rows. Review the choices before downloading the receipt.";
}
function resetAllRows() {
  let changed = 0;
  for (const select of document.querySelectorAll("select[data-ledger]")) {
    select.value = "needs_teacher_review";
    changed += 1;
  }
  generate();
  statusLine.textContent = "Reset " + changed + " rows to needs_teacher_review.";
}
document.getElementById("generate").addEventListener("click", generate);
document.getElementById("download").addEventListener("click", downloadReceipt);
document.getElementById("copy").addEventListener("click", () => {
  copyReceipt().catch((error) => {
    statusLine.textContent = "Copy failed: " + error.message;
  });
});
document.getElementById("apply-recommended-waiting").addEventListener("click", () => {
  setRowsByBucket("waiting_for_low_token_watch_evidence", "teacher_reviewed_collect_metadata_follow_up");
});
document.getElementById("apply-recommended-ready").addEventListener("click", () => {
  setRowsByBucket("ready_for_teacher_coverage_review", "teacher_reviewed_ready_coverage_row");
});
document.getElementById("reset-needs-review").addEventListener("click", resetAllRows);
generate();
</script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_coverage_dossier_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      status: builder.status,
      counts: builder.counts,
      locks: lockState
    },
    null,
    2
  )
);
