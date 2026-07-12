#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-coverage-enrollment-follow-up-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-coverage-enrollment-follow-up-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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
    builderDoesNotValidateReceipt: true,
    builderDoesNotRunBatch: true,
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
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# All-Software Coverage Enrollment Follow-Up Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    `Source follow-up plan: ${builder.paths.sourceFollowUpPlan}`,
    `Review scope: ${builder.reviewScope?.scopeKind || "unknown"}`,
    `Batch scope: ${builder.reviewBatchScope?.mode || "unknown"} (${builder.reviewBatchScope?.includedRows ?? 0} of ${builder.reviewBatchScope?.totalFollowUpRows ?? 0} rows)`,
    builder.reviewBatchScope?.omittedRows
      ? `Omitted rows remain waiting for later review: ${builder.reviewBatchScope.omittedRows}`
      : "",
    builder.paths.sourceDryRunBatch ? `Source dry-run batch: ${builder.paths.sourceDryRunBatch}` : "",
    "",
    "Use the HTML page to generate a teacher-filled review receipt for enrollment follow-up rows.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Next reviewed batch command template: ${builder.nextReviewedBatchCommand}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON in the browser.",
    "- It does not save the generated receipt.",
    "- It does not validate the receipt.",
    "- It does not run metadata gates, read log tails, capture screenshots, execute software, register schedules, write memory, or claim all-software completion."
  ].filter(Boolean);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher-facing enrollment follow-up receipt generator.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--follow-up-plan", "")),
  "--plan",
  "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1"
);
if (!planInput.value) throw new Error("--plan is required");
const batchInput = readJsonInput(
  argValue("--batch", argValue("--dry-run-batch", "")),
  "--batch",
  "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1"
);
const maxRowsArg = Number.parseInt(argValue("--max-rows", argValue("--max-review-rows", "0")), 10);
const offsetRowsArg = Number.parseInt(argValue("--offset", "0"), 10);
const maxRows = Number.isFinite(maxRowsArg) && maxRowsArg > 0 ? maxRowsArg : 0;
const offsetRows = Number.isFinite(offsetRowsArg) && offsetRowsArg > 0 ? offsetRowsArg : 0;

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const plan = planInput.value;
const htmlPath = join(builderDir, "all-software-coverage-enrollment-follow-up-receipt-builder.html");
const builderPath = join(builderDir, "all-software-coverage-enrollment-follow-up-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "teacher-coverage-enrollment-follow-up-receipt-template.json");
const readmePath = join(builderDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECEIPT_BUILDER_START_HERE.md");
const lockState = locks();

const allFollowUpItems = plan.followUpItems || [];
const selectedFollowUpItems = maxRows > 0 ? allFollowUpItems.slice(offsetRows, offsetRows + maxRows) : allFollowUpItems;
const reviewBatchScope = {
  mode: maxRows > 0 ? "small_batch_teacher_review" : "full_enrollment_follow_up_review",
  totalFollowUpRows: allFollowUpItems.length,
  includedRows: selectedFollowUpItems.length,
  omittedRows: Math.max(0, allFollowUpItems.length - selectedFollowUpItems.length),
  offsetRows,
  maxRows: maxRows || null,
  teacherMustReviewOnlyIncludedRows: true,
  omittedRowsRemainWaitingForLaterReview: maxRows > 0
};

const reviewRows = selectedFollowUpItems.map((item) => ({
  followUpId: item.followUpId,
  ledgerNumber: item.ledgerNumber,
  software: item.software,
  status: item.status,
  route: item.route,
  tool: item.tool,
  fallbackTool: item.fallbackTool || "",
  instruction: item.instruction,
  expectedEvidence: item.expectedEvidence,
  stopIf: item.stopIf || [],
  defaultDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_run_metadata_gate",
    "teacher_reviewed_prepare_signal_question",
    "blocked_needs_more_evidence",
    "teacher_excluded_or_private"
  ],
  blockedTeacherDecisions: [
    "accepted",
    "run_now",
    "allow_bounded_tail",
    "capture_screenshot",
    "execute_software",
    "register_schedule",
    "write_memory",
    "claim_complete",
    "native_universal_execution"
  ]
}));

const nextReviewedBatchCommand =
  'node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-enrollment-follow-up-batch.mjs --plan "' +
  (planInput.path || "<follow-up-plan.json>") +
  '" --teacher-reviewed --max-items ' +
  Math.max(1, reviewRows.length || 1) +
  ' --max-queue-items ' +
  Math.max(1, reviewRows.length || 1) +
  " --max-logs-per-item 1 --max-tail-lines 16 --max-tail-bytes 1024";

const receiptTemplate = {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1",
  builderId,
  sourceFollowUpPlan: planInput.path,
  sourceDryRunBatch: batchInput.path,
  reviewBatchScope,
  reviewScope: plan.reviewScope || null,
  decision: "needs_teacher_review",
  allowBoundedTail: false,
  rowDecisions: reviewRows.map((row) => ({
    followUpId: row.followUpId,
    ledgerNumber: row.ledgerNumber,
    software: row.software,
    teacherDecision: "needs_teacher_review",
    evidenceReviewed: false,
    teacherNote: ""
  })),
  locks: lockState
};

const builder = {
  ok: true,
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "coverage_enrollment_follow_up_receipt_builder_ready_for_teacher_use",
  sourcePlanStatus: plan.status || "coverage_follow_up_plan_ready",
  sourceBatchStatus: batchInput.value?.status || "not_supplied",
  reviewBatchScope,
  reviewScope: plan.reviewScope || null,
  counts: {
    followUpRows: reviewRows.length,
    totalFollowUpRows: allFollowUpItems.length,
    omittedFollowUpRows: reviewBatchScope.omittedRows,
    dryRunSelectedItems: batchInput.value?.selectedItemCount || 0,
    dryRunRanTools: batchInput.value?.ranToolCount || 0
  },
  reviewRows,
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceFollowUpPlan: planInput.path,
    sourceDryRunBatch: batchInput.path,
    sourceLedger: plan.sourceLedgerPath || ""
  },
  nextReviewedBatchCommand,
  nextReconciliationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\reconcile-all-software-coverage-enrollment-follow-up-batch.mjs --batch "<reviewed-batch-run.json>" --plan "' +
    (planInput.path || "<follow-up-plan.json>") +
    '"',
  blockedActions: [
    "run_metadata_gate_from_receipt_builder",
    "read_bounded_tail_from_receipt_builder",
    "capture_screenshot_from_receipt_builder",
    "execute_software_from_receipt_builder",
    "register_schedule_from_receipt_builder",
    "write_memory_from_receipt_builder",
    "claim_all_software_coverage_complete_from_receipt_builder"
  ],
  locks: lockState
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Coverage Enrollment Follow-Up Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p, li { line-height: 1.55; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 14px; margin-top: 16px; }
    label { display: block; margin: 8px 0; font-weight: 600; }
    select { min-height: 34px; width: 100%; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    textarea { width: 100%; min-height: 300px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Coverage Enrollment Follow-Up Receipt Builder</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <p><strong>Review scope:</strong> ${htmlEscape(plan.reviewScope?.scopeKind || "unknown")}</p>
    <p><strong>Batch scope:</strong> ${htmlEscape(reviewBatchScope.mode)} (${htmlEscape(reviewBatchScope.includedRows)} of ${htmlEscape(reviewBatchScope.totalFollowUpRows)} rows)</p>
    ${
      reviewBatchScope.omittedRows
        ? `<p class="muted">${htmlEscape(reviewBatchScope.omittedRows)} rows are intentionally omitted from this small review batch and remain waiting for later teacher review.</p>`
        : ""
    }
    ${
      plan.reviewScope?.scopeKind === "teacher_reviewed_subset_ledger"
        ? `<p class="muted">Teacher-reviewed subset: ${htmlEscape(plan.reviewScope.subsetPurpose || "")}<br>Source ledger: ${htmlEscape(plan.reviewScope.sourceLedgerPath || "not supplied")}<br>Reviewed rows: ${htmlEscape(plan.reviewScope.reviewedFollowUpRows)}; unreviewed rows excluded: ${htmlEscape(plan.reviewScope.unreviewedRowsExcluded)}</p>`
        : `<p class="muted">This plan was built from the full enrollment ledger. For original-goal focused follow-up, prefer a teacher-reviewed subset ledger when available.</p>`
    }
    <section class="panel">
      <h2>Generate Receipt JSON</h2>
      <p>Choose the next review-only route for each waiting software row. This page only builds JSON in your browser; it does not run metadata gates, read tails, capture screenshots, or execute software.</p>
      <div id="rows" class="grid"></div>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next reviewed batch command template: <code>${htmlEscape(nextReviewedBatchCommand)}</code></p>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const rowsEl = document.getElementById("rows");
    const receiptEl = document.getElementById("receipt");
    for (const row of builder.reviewRows) {
      const card = document.createElement("article");
      card.className = "row";
      card.innerHTML =
        '<label>' + row.ledgerNumber + '. ' + row.software + '</label><select data-follow-up-id="' + row.followUpId + '">' +
        row.allowedTeacherDecisions.map((decision) => '<option value="' + decision + '">' + decision + '</option>').join('') +
        '</select><p class="muted">Status: <code>' + row.status +
        '</code></p><p>Route: <code>' + row.route +
        '</code></p><p>Tool: <code>' + (row.tool || 'review-only') +
        '</code></p><p class="muted">' + row.instruction + '</p>';
      rowsEl.appendChild(card);
    }
    function buildReceipt() {
      const decisions = new Map(Array.from(document.querySelectorAll("select[data-follow-up-id]")).map((select) => [select.dataset.followUpId, select.value]));
      return {
        format: "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1",
        builderId: builder.builderId,
        sourceFollowUpPlan: builder.paths.sourceFollowUpPlan,
        sourceDryRunBatch: builder.paths.sourceDryRunBatch,
        reviewBatchScope: builder.reviewBatchScope,
        reviewScope: builder.reviewScope,
        decision: "needs_teacher_review",
        allowBoundedTail: false,
        rowDecisions: builder.reviewRows.map((row) => {
          const decision = decisions.get(row.followUpId) || "needs_teacher_review";
          return {
            followUpId: row.followUpId,
            ledgerNumber: row.ledgerNumber,
            software: row.software,
            teacherDecision: decision,
            evidenceReviewed: decision !== "needs_teacher_review",
            teacherNote: decision === "needs_teacher_review" ? "" : "teacher selected review-only low-token follow-up route"
          };
        }),
        locks: builder.locks
      };
    }
    function render() {
      receiptEl.value = JSON.stringify(buildReceipt(), null, 2);
    }
    document.getElementById("generate").addEventListener("click", render);
    document.getElementById("copy").addEventListener("click", async () => {
      render();
      await navigator.clipboard.writeText(receiptEl.value);
    });
    render();
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
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      followUpRowCount: reviewRows.length,
      allSoftwareCoverageComplete: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      locks: lockState
    },
    null,
    2
  )
);
