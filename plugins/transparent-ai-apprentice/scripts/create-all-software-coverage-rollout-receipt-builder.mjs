#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-coverage-rollout-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-coverage-rollout-receipt-builder"
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

function batchRows(plan, convergenceAudit) {
  const convergenceByBatch = new Map(
    (
      convergenceAudit?.batchRows ||
      convergenceAudit?.remainingBatches ||
      convergenceAudit?.preparedBatches ||
      convergenceAudit?.batchStatus ||
      []
    )
      .map((item) => [String(item.batchId || item.id || ""), item])
      .filter(([id]) => id)
  );
  return (plan.batches || []).map((batch) => {
    const convergence = convergenceByBatch.get(String(batch.batchId)) || {};
    const plannedSoftware = convergence.plannedSoftware || [];
    return {
      batchId: batch.batchId,
      status: convergence.status || batch.status || "waiting_for_teacher_review",
      batchSize: convergence.plannedRows || batch.batchSize || batch.rows?.length || 0,
      software:
        plannedSoftware.length > 0
          ? plannedSoftware
          : (batch.rows || []).map((row) => row.software || row.processName || "unknown software"),
      defaultDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "needs_teacher_review",
        "teacher_reviewed_prepare_rollout",
        "blocked_needs_more_evidence",
        "teacher_excluded_batch"
      ],
      blockedTeacherDecisions: [
        "accepted",
        "execute_now",
        "register_schedule",
        "enable_memory",
        "claim_complete",
        "native_universal_execution",
        "unlock_packaging"
      ],
      nextReviewedCommand: `node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-rollout-supervisor.mjs --plan "${plan.__sourcePath || "<coverage-expansion-plan.json>"}" --teacher-reviewed --start-batch ${batch.batchId} --max-batches 1`,
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        teacherConfirmationRequired: true
      }
    };
  });
}

function writeReadme(path, builder) {
  const lines = [
    "# All-Software Coverage Rollout Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Source expansion plan: ${builder.paths.sourceExpansionPlan}`,
    "",
    "Use the HTML page to create a teacher review receipt for prepared coverage rollout batches.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON in the browser.",
    "- It does not run the coverage rollout supervisor.",
    "- It does not start software, capture screenshots, register tasks, write memory, enable rules, accept technology, or claim all-software completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher-facing receipt before all-software coverage rollout batches.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--coverage-expansion-plan", "")),
  "--plan",
  "transparent_ai_all_software_coverage_expansion_plan_v1"
);
if (!planInput.value) throw new Error("--plan is required");
const convergenceInput = readJsonInput(argValue("--convergence-audit", ""), "--convergence-audit");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-rollout-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const plan = { ...planInput.value, __sourcePath: planInput.path };
const htmlPath = join(builderDir, "all-software-coverage-rollout-receipt-builder.html");
const builderPath = join(builderDir, "all-software-coverage-rollout-receipt-builder.json");
const readmePath = join(builderDir, "ALL_SOFTWARE_COVERAGE_ROLLOUT_RECEIPT_BUILDER_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  builderDoesNotWriteReceipt: true,
  builderDoesNotValidateReceipt: true,
  rolloutSupervisorInvoked: false,
  coverageRunnerInvoked: false,
  scheduledTaskRegistered: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fileContentsRead: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false
};

const reviewRows = batchRows(plan, convergenceInput.value);
const builder = {
  ok: true,
  format: "transparent_ai_all_software_coverage_rollout_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "coverage_rollout_receipt_builder_ready_for_teacher_use",
  sourcePlanStatus: plan.status || "waiting_for_teacher_review",
  counts: {
    batches: reviewRows.length,
    totalSoftware: reviewRows.reduce((total, row) => total + row.software.length, 0)
  },
  reviewRows,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    sourceExpansionPlan: planInput.path,
    sourceConvergenceAudit: convergenceInput.path
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-coverage-rollout-receipt.mjs --plan "' +
    (planInput.path || "<coverage-expansion-plan.json>") +
    '" --receipt "<teacher-filled-coverage-rollout-receipt.json>"',
  blockedActions: [
    "run_coverage_rollout_supervisor_from_builder",
    "run_automatic_low_token_learning_from_builder",
    "register_schedule_from_builder",
    "capture_screenshot_from_builder",
    "write_memory_from_builder",
    "claim_all_software_coverage_complete_from_builder"
  ],
  locks
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Coverage Rollout Receipt Builder</title>
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
    textarea { width: 100%; min-height: 260px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Coverage Rollout Receipt Builder</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Generate Receipt JSON</h2>
      <p>Choose the next review-only route for each prepared coverage rollout batch. This page only builds JSON in your browser. It does not run coverage rollout.</p>
      <div id="rows" class="grid"></div>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
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
        '<label>' + row.batchId + ' (' + row.batchSize + ' software)</label><select data-batch-id="' + row.batchId + '">' +
        row.allowedTeacherDecisions.map((decision) => '<option value="' + decision + '">' + decision + '</option>').join('') +
        '</select><p class="muted">Status: <code>' + row.status +
        '</code></p><p>Software: ' + row.software.slice(0, 6).join(', ') + (row.software.length > 6 ? '...' : '') + '</p>';
      rowsEl.appendChild(card);
    }
    function buildReceipt() {
      const decisions = new Map(Array.from(document.querySelectorAll("select[data-batch-id]")).map((select) => [select.dataset.batchId, select.value]));
      return {
        format: "transparent_ai_all_software_coverage_rollout_review_receipt_v1",
        builderId: builder.builderId,
        sourceExpansionPlan: builder.paths.sourceExpansionPlan,
        decision: "needs_teacher_review",
        batchDecisions: builder.reviewRows.map((row) => {
          const decision = decisions.get(row.batchId) || "needs_teacher_review";
          return {
            batchId: row.batchId,
            teacherDecision: decision,
            evidenceReviewed: decision !== "needs_teacher_review",
            teacherNote: decision === "needs_teacher_review" ? "" : "teacher selected review-only coverage rollout follow-up"
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
      format: "transparent_ai_all_software_coverage_rollout_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      readmePath,
      batchCount: reviewRows.length,
      totalSoftware: builder.counts.totalSoftware,
      allSoftwareCoverageComplete: false,
      locks
    },
    null,
    2
  )
);
