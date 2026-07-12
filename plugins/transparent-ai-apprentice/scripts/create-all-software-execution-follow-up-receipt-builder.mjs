#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-execution-follow-up-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-follow-up-receipt-builder"
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

function writeReadme(path, builder) {
  const lines = [
    "# All-Software Execution Follow-Up Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    `Source batch: ${builder.paths.sourceBatch}`,
    "",
    "Use the HTML page to generate a teacher-filled review receipt for prepared execution follow-up rows.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder only creates JSON in the browser.",
    "- It does not save the generated receipt.",
    "- It does not validate the receipt.",
    "- It does not invoke dry-run runners, execute target software, send UI events, capture screenshots, write memory, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher-facing execution follow-up receipt generator.");
const batchInput = readJsonInput(
  argValue("--batch", argValue("--follow-up-batch", "")),
  "--batch",
  "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1"
);
if (!batchInput.value) throw new Error("--batch is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-follow-up-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const batch = batchInput.value;
const htmlPath = join(builderDir, "all-software-execution-follow-up-receipt-builder.html");
const builderPath = join(builderDir, "all-software-execution-follow-up-receipt-builder.json");
const readmePath = join(builderDir, "ALL_SOFTWARE_EXECUTION_FOLLOW_UP_RECEIPT_BUILDER_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  builderDoesNotWriteReceipt: true,
  builderDoesNotValidateReceipt: true,
  builderDoesNotInvokeRunner: true,
  builderDoesNotExecuteTargetSoftware: true,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fileContentsRead: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false
};

const reviewRows = (batch.rowResults || []).map((row) => ({
  rowId: row.rowId,
  software: row.software,
  lane: row.lane,
  currentStatus: row.status,
  runnerInvoked: row.runnerInvoked === true,
  nextTool: row.nextCall?.tool || "",
  nextArguments: row.nextCall?.arguments || {},
  blockedUntil: row.nextCall?.blockedUntil || "teacher reviews this row",
  logicSourceRequiredBeforeExecution: true,
  requiredLogicSourceTypes: [
    "teacher_confirmed_numbered_target_or_exact_route",
    "reviewed_control_channel_profile",
    "reviewed_api_cli_file_browser_macro_mapping",
    "rollback_and_preflight_policy",
    "outcome_verifier_or_post_action_evidence_checkpoint"
  ],
  missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
  forbiddenWithoutLogicSource: ["execute_now", "run_execute_mode", "send_ui_event", "write_memory", "claim_complete"],
  defaultDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "teacher_reviewed_prepare_dry_run", "blocked_needs_more_evidence"],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "run_execute_mode",
    "memory_enabled",
    "claim_complete",
    "native_universal_execution",
    "generate_or_execute_unbacked_action_detail"
  ]
}));

const builder = {
  ok: true,
  format: "transparent_ai_all_software_execution_follow_up_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "receipt_builder_ready_for_teacher_use",
  sourceBatchStatus: batch.status || "waiting_for_teacher_review",
  counts: {
    totalRows: reviewRows.length,
    preparedRunnerCalls: batch.counts?.preparedRunnerCalls || 0,
    dryRunRunnerInvocations: batch.counts?.dryRunRunnerInvocations || 0
  },
  reviewRows,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    sourceBatch: batchInput.path,
    sourceMatrix: batch.matrixPath || "",
    sourcePilotQueue: batch.pilotQueuePath || ""
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-execution-follow-up-receipt.mjs --batch "' +
    (batchInput.path || "<follow-up-batch.json>") +
    '" --receipt "<teacher-filled-execution-follow-up-receipt.json>"',
  blockedActions: [
    "invoke_dry_run_runner_from_receipt_builder",
    "execute_target_software_from_receipt_builder",
    "send_ui_events_from_receipt_builder",
    "capture_screenshot_from_receipt_builder",
    "write_memory_from_receipt_builder",
    "claim_goal_complete_from_receipt_builder"
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
  <title>Execution Follow-Up Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.55; }
    .panel, .row { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 14px; margin-top: 16px; }
    label { display: block; margin: 8px 0; }
    input[type="checkbox"] { width: 18px; height: 18px; vertical-align: middle; }
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
    <h1>Execution Follow-Up Receipt Builder</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <h2>Generate Receipt JSON</h2>
      <p>Select rows only after reviewing the prepared dry-run call. This page only builds JSON in your browser. It does not save files, validate, invoke runners, or execute software.</p>
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
        '<label><input type="checkbox" data-row-id="' + row.rowId + '"> Allow dry-run review for ' +
        row.software + '</label><p class="muted">Lane: <code>' + row.lane +
        '</code></p><p class="muted">Status: <code>' + row.currentStatus +
        '</code></p><p>Next tool: <code>' + (row.nextTool || 'review-only') +
        '</code></p><p class="muted">Logic source required before execution: <code>true</code></p>';
      rowsEl.appendChild(card);
    }
    function buildReceipt() {
      const checks = new Map(Array.from(document.querySelectorAll("input[data-row-id]")).map((input) => [input.dataset.rowId, input.checked]));
      return {
        format: "transparent_ai_all_software_execution_follow_up_review_receipt_v1",
        builderId: builder.builderId,
        sourceBatch: builder.paths.sourceBatch,
        decision: "needs_teacher_review",
        rowDecisions: builder.reviewRows.map((row) => {
          const reviewed = checks.get(row.rowId) === true;
          return {
            rowId: row.rowId,
            software: row.software,
            teacherDecision: reviewed ? "teacher_reviewed_prepare_dry_run" : "needs_teacher_review",
            evidenceReviewed: reviewed,
            logicSourceReviewed: reviewed,
            missingLogicSourceBehavior: row.missingLogicSourceBehavior,
            teacherNote: reviewed ? "teacher reviewed prepared dry-run call and its required logic-source contract only" : ""
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
      format: "transparent_ai_all_software_execution_follow_up_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      readmePath,
      rowCount: reviewRows.length,
      locks
    },
    null,
    2
  )
);
