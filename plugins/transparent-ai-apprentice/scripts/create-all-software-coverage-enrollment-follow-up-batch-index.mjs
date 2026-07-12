#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function slugify(value) {
  return (
    String(value || "all-software-coverage-enrollment-follow-up-batch-index")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-coverage-enrollment-follow-up-batch-index"
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reviewOnlyLocks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
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
    memoryWritten: false,
    scheduledTaskInstalled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

const goal = argValue("--goal", "Create a review-only batch index for all-software coverage enrollment follow-up.");
const planPath = argValue("--plan", argValue("--follow-up-plan", ""));
if (!planPath || !existsSync(planPath)) throw new Error("--plan must point to a follow-up plan JSON file");

const batchSizeArg = Number.parseInt(argValue("--batch-size", "12"), 10);
const knownGeneratedRowsArg = Number.parseInt(argValue("--known-generated-rows", "0"), 10);
const currentOffsetArg = Number.parseInt(argValue("--current-offset", "0"), 10);
const batchSize = Number.isFinite(batchSizeArg) && batchSizeArg > 0 ? batchSizeArg : 12;
const knownGeneratedRows = Number.isFinite(knownGeneratedRowsArg) && knownGeneratedRowsArg > 0 ? knownGeneratedRowsArg : 0;
const currentOffsetRows = Number.isFinite(currentOffsetArg) && currentOffsetArg >= 0 ? currentOffsetArg : 0;

const latestBuilder = argValue("--latest-builder", "");
const latestValidation = argValue("--latest-validation", "");
const latestHandoffQueue = argValue("--latest-handoff-queue", "");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), "artifacts", "current-goal-all-software-coverage-enrollment-follow-up-batch-indexes")
  )
);
mkdirSync(outputRoot, { recursive: true });

const plan = readJson(planPath);
if (plan.format !== "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1") {
  throw new Error("--plan must be transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1");
}

const followUpItems = Array.isArray(plan.followUpItems) ? plan.followUpItems : [];
const locks = reviewOnlyLocks();
const batchIndexId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const batchIndexDir = join(outputRoot, batchIndexId);
mkdirSync(batchIndexDir, { recursive: true });

const batches = [];
for (let offsetRows = 0; offsetRows < followUpItems.length; offsetRows += batchSize) {
  const rows = followUpItems.slice(offsetRows, offsetRows + batchSize);
  const isCurrent = currentOffsetRows === offsetRows;
  const isKnownGenerated = offsetRows + rows.length <= knownGeneratedRows;
  batches.push({
    batchIndex: batches.length + 1,
    offsetRows,
    maxRows: batchSize,
    includedRows: rows.length,
    rowRange: `${offsetRows + 1}-${offsetRows + rows.length}`,
    firstFollowUpId: rows[0]?.followUpId || "",
    lastFollowUpId: rows[rows.length - 1]?.followUpId || "",
    firstSoftware: rows[0]?.software || "",
    lastSoftware: rows[rows.length - 1]?.software || "",
    status: isCurrent
      ? "current_start_here_batch_waiting_teacher_review"
      : isKnownGenerated
        ? "generated_or_prior_batch_waiting_teacher_review"
        : "not_generated_yet",
    createBuilderCommand:
      'node plugins\\transparent-ai-apprentice\\scripts\\create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs --plan "' +
      planPath +
      `" --max-rows ${batchSize} --offset ${offsetRows} --output-dir artifacts\\current-goal-all-software-coverage-enrollment-follow-up-small-batch-receipt-builders`,
    locks
  });
}

const nextRecommendedBatch = batches.find((batch) => batch.status === "not_generated_yet") || null;
const jsonPath = join(batchIndexDir, "all-software-coverage-enrollment-follow-up-batch-index.json");
const htmlPath = join(batchIndexDir, "all-software-coverage-enrollment-follow-up-batch-index.html");
const readmePath = join(batchIndexDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_BATCH_INDEX.md");

const batchIndex = {
  ok: true,
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_index_v1",
  batchIndexId,
  createdAt: new Date().toISOString(),
  goal,
  status: "review_only_all_software_batch_index_ready_goal_not_complete",
  sourceFollowUpPlan: resolve(planPath),
  sourcePlanStatus: plan.status || "",
  totalFollowUpRows: followUpItems.length,
  batchSize,
  totalBatches: batches.length,
  knownGeneratedRows,
  currentOffsetRows,
  remainingRowsAfterKnownBatches: Math.max(0, followUpItems.length - knownGeneratedRows),
  latestStartHereSmallBatch: {
    builder: latestBuilder,
    validation: latestValidation,
    handoffQueue: latestHandoffQueue
  },
  nextRecommendedBatch,
  batches,
  paths: {
    batchIndex: jsonPath,
    html: htmlPath,
    readme: readmePath,
    sourceFollowUpPlan: resolve(planPath),
    latestBuilder,
    latestValidation,
    latestHandoffQueue
  },
  completionBoundary: {
    goalComplete: false,
    reason:
      "This index only organizes teacher review batches. It does not run software, read logs, capture screenshots, write memory, or prove all software coverage.",
    requiredBeforeCompletion: [
      "teacher reviews each batch or excludes private software",
      "reviewed batches produce low-token watch evidence",
      "coverage ledger is regenerated after evidence",
      "final teacher acceptance stays separate"
    ]
  },
  locks
};

const tableRows = batches
  .map(
    (batch) => `<tr>
  <td>${htmlEscape(batch.batchIndex)}</td>
  <td>${htmlEscape(batch.rowRange)}</td>
  <td>${htmlEscape(batch.includedRows)}</td>
  <td>${htmlEscape(batch.offsetRows)}</td>
  <td>${htmlEscape(batch.firstSoftware)}</td>
  <td>${htmlEscape(batch.lastSoftware)}</td>
  <td><code>${htmlEscape(batch.status)}</code></td>
  <td><code>${htmlEscape(batch.createBuilderCommand)}</code></td>
</tr>`
  )
  .join("\n");

writeFileSync(jsonPath, `${JSON.stringify(batchIndex, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All-Software Coverage Enrollment Follow-Up Batch Index",
    "",
    `Status: ${batchIndex.status}`,
    `Total follow-up rows: ${batchIndex.totalFollowUpRows}`,
    `Batch size: ${batchIndex.batchSize}`,
    `Total batches: ${batchIndex.totalBatches}`,
    `Known generated rows: ${batchIndex.knownGeneratedRows}`,
    `Remaining after known batches: ${batchIndex.remainingRowsAfterKnownBatches}`,
    `Current offset: ${batchIndex.currentOffsetRows}`,
    `Next recommended offset: ${batchIndex.nextRecommendedBatch?.offsetRows ?? ""}`,
    "",
    "Safety boundary:",
    "- This is review-only.",
    "- It does not read log contents, capture screenshots, execute software, write memory, install schedules, or claim completion.",
    ""
  ].join("\n"),
  "utf8"
);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>All-Software Coverage Batch Index</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #172033; }
    .status { padding: 10px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; margin-bottom: 14px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; }
    th { background: #eef3f8; text-align: left; }
    code { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>All-Software Coverage Batch Index</h1>
  <div class="status">
    <p>Status: <code>${htmlEscape(batchIndex.status)}</code></p>
    <p>Total rows: ${htmlEscape(batchIndex.totalFollowUpRows)}; batch size: ${htmlEscape(batchIndex.batchSize)}; total batches: ${htmlEscape(batchIndex.totalBatches)}; known generated rows: ${htmlEscape(batchIndex.knownGeneratedRows)}; remaining: ${htmlEscape(batchIndex.remainingRowsAfterKnownBatches)}</p>
    <p>This is review-only and does not execute software or claim completion.</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Batch</th>
        <th>Rows</th>
        <th>Count</th>
        <th>Offset</th>
        <th>First software</th>
        <th>Last software</th>
        <th>Status</th>
        <th>Create builder command</th>
      </tr>
    </thead>
    <tbody>
${tableRows}
    </tbody>
  </table>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: batchIndex.format,
      status: batchIndex.status,
      jsonPath,
      htmlPath,
      readmePath,
      totalFollowUpRows: batchIndex.totalFollowUpRows,
      batchSize: batchIndex.batchSize,
      totalBatches: batchIndex.totalBatches,
      knownGeneratedRows: batchIndex.knownGeneratedRows,
      nextRecommendedOffset: batchIndex.nextRecommendedBatch?.offsetRows ?? null,
      goalComplete: false
    },
    null,
    2
  )
);
