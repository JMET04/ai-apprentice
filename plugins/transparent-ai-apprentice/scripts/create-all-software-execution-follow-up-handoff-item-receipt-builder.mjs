#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "execution-handoff-item-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-handoff-item-receipt-builder"
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

function readJsonOptional(path) {
  if (!path || !existsSync(path)) return null;
  return readJson(path);
}

function writeReadme(path, builder) {
  const lines = [
    "# Execution Follow-Up Handoff Item Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Goal: ${builder.goal}`,
    `Source item run: ${builder.paths.sourceItemRun}`,
    "",
    "Use this after one dry-run handoff item has produced runner evidence.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder only creates a teacher review receipt template.",
    "- It does not validate the receipt, create an approval gate, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Build a teacher review receipt for one dry-run execution handoff item.");
const runInput = readJsonInput(
  argValue("--run", argValue("--item-run", "")),
  "--run",
  "transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1"
);
if (!runInput.value) throw new Error("--run is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-handoff-item-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const run = runInput.value;
const pilotRunnerReceipt = readJsonOptional(run.generatedEvidence?.pilotRunnerReceiptPath);
const builderPath = join(builderDir, "all-software-execution-handoff-item-receipt-builder.json");
const htmlPath = join(builderDir, "all-software-execution-handoff-item-receipt-builder.html");
const receiptTemplatePath = join(builderDir, "teacher-execution-handoff-item-review-receipt-template.json");
const readmePath = join(builderDir, "ALL_SOFTWARE_EXECUTION_HANDOFF_ITEM_RECEIPT_BUILDER_START_HERE.md");

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  builderDoesNotValidateReceipt: true,
  builderDoesNotCreateApprovalGate: true,
  builderDoesNotInvokeRunner: true,
  builderDoesNotExecuteTargetSoftware: true,
  builderDoesNotSendUiEvents: true,
  builderDoesNotReadLogs: true,
  builderDoesNotCaptureScreenshots: true,
  builderDoesNotWriteMemory: true,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false
};

const reviewItem = {
  itemRunId: run.runId,
  rowId: run.selectedItem?.rowId || "",
  software: run.pilotRunnerResult?.software || run.selectedItem?.arguments?.software || "",
  pilotId: run.pilotRunnerResult?.pilotId || run.selectedItem?.arguments?.pilotId || "",
  adapterId: run.pilotRunnerResult?.adapterId || run.selectedItem?.arguments?.adapterId || "",
  itemRunStatus: run.status || "",
  pilotRunnerStatus: run.pilotRunnerResult?.status || pilotRunnerReceipt?.status || "",
  runnerInvoked: run.runnerInvoked === true,
  executeRequested: run.executeRequested === true,
  dryRunOnly: run.executeRequested !== true,
  evidencePaths: {
    itemRun: runInput.path,
    pilotRunnerRun: run.generatedEvidence?.pilotRunnerRunPath || "",
    pilotRunnerReceipt: run.generatedEvidence?.pilotRunnerReceiptPath || "",
    adapterReceipt: run.generatedEvidence?.adapterReceiptPath || "",
    outcomeVerification: run.generatedEvidence?.outcomeVerificationPath || "",
    postActionCheckpoint: run.generatedEvidence?.postActionCheckpointPath || ""
  },
  defaultTeacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "dry_run_matched_expected", "dry_run_mismatch_blocked"],
  blockedTeacherDecisions: [
    "accepted",
    "execute_now",
    "run_execute_mode",
    "write_memory",
    "claim_complete",
    "native_universal_execution",
    "unlock_packaging"
  ],
  requiredReviewChecks: [
    "evidenceReviewed",
    "pilotRunnerReceiptReviewed",
    "outcomeVerificationReviewed",
    "postActionCheckpointReviewed"
  ],
  nextGateBoundary:
    "A matched dry-run may only prepare a separate execution approval gate template. It cannot execute target software or save learning."
};

const receiptTemplate = {
  format: "transparent_ai_all_software_execution_follow_up_handoff_item_review_receipt_v1",
  builderId,
  sourceItemRun: runInput.path,
  itemRunId: run.runId,
  teacherDecision: "needs_teacher_review",
  evidenceReviewed: false,
  pilotRunnerReceiptReviewed: false,
  outcomeVerificationReviewed: false,
  postActionCheckpointReviewed: false,
  teacherMatchedExpected: false,
  teacherNote: "",
  blockedTeacherDecisions: reviewItem.blockedTeacherDecisions
};

const builder = {
  ok: true,
  format: "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "handoff_item_receipt_builder_ready_for_teacher_review",
  reviewItem,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourceItemRun: runInput.path,
    pilotRunnerReceipt: run.generatedEvidence?.pilotRunnerReceiptPath || ""
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-execution-follow-up-handoff-item-receipt.mjs --run "' +
    (runInput.path || "<execution-follow-up-handoff-item-run.json>") +
    '" --receipt "<teacher-filled-execution-handoff-item-review-receipt.json>"',
  blockedActions: [
    "create_execution_approval_gate_from_builder",
    "execute_target_software_from_builder",
    "send_ui_events_from_builder",
    "read_logs_from_builder",
    "capture_screenshot_from_builder",
    "write_memory_from_builder",
    "claim_all_software_execution_complete_from_builder"
  ],
  locks
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
  <title>Execution Handoff Item Review</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; }
    main { max-width: 1040px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(13,31,54,.06); margin-top: 16px; }
    label { display: block; margin: 10px 0; }
    select, input[type="text"] { min-height: 34px; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    textarea { width: 100%; min-height: 220px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Execution Handoff Item Review</h1>
    <p>${htmlEscape(goal)}</p>
    <p><span class="badge">review only</span></p>
    <section class="panel">
      <p>Row: <code>${htmlEscape(reviewItem.rowId || "unknown")}</code></p>
      <p>Pilot: <code>${htmlEscape(reviewItem.pilotId || "unknown")}</code> Adapter: <code>${htmlEscape(reviewItem.adapterId || "unknown")}</code></p>
      <p>Status: <code>${htmlEscape(reviewItem.itemRunStatus)}</code></p>
      <p>Pilot runner receipt: <code>${htmlEscape(reviewItem.evidencePaths.pilotRunnerReceipt || "missing")}</code></p>
      <p>Outcome verification: <code>${htmlEscape(reviewItem.evidencePaths.outcomeVerification || "missing")}</code></p>
      <p>Post-action checkpoint: <code>${htmlEscape(reviewItem.evidencePaths.postActionCheckpoint || "missing")}</code></p>
    </section>
    <section class="panel">
      <label>Teacher decision
        <select id="decision">
          ${reviewItem.allowedTeacherDecisions.map((decision) => `<option value="${htmlEscape(decision)}">${htmlEscape(decision)}</option>`).join("")}
        </select>
      </label>
      <label><input type="checkbox" id="evidenceReviewed"> I reviewed the handoff item run evidence.</label>
      <label><input type="checkbox" id="pilotRunnerReceiptReviewed"> I reviewed the pilot runner receipt.</label>
      <label><input type="checkbox" id="outcomeVerificationReviewed"> I reviewed the outcome verification.</label>
      <label><input type="checkbox" id="postActionCheckpointReviewed"> I reviewed the post-action checkpoint.</label>
      <label><input type="checkbox" id="teacherMatchedExpected"> The dry-run evidence matches my intended route/result.</label>
      <label>Teacher note <input type="text" id="teacherNote" placeholder="Optional note"></label>
      <p>
        <button id="generate">Generate Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </p>
      <textarea id="receipt" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    </section>
  </main>
  <script>
    const template = ${jsonForScript(receiptTemplate)};
    function buildReceipt() {
      return {
        ...template,
        teacherDecision: document.getElementById("decision").value,
        evidenceReviewed: document.getElementById("evidenceReviewed").checked,
        pilotRunnerReceiptReviewed: document.getElementById("pilotRunnerReceiptReviewed").checked,
        outcomeVerificationReviewed: document.getElementById("outcomeVerificationReviewed").checked,
        postActionCheckpointReviewed: document.getElementById("postActionCheckpointReviewed").checked,
        teacherMatchedExpected: document.getElementById("teacherMatchedExpected").checked,
        teacherNote: document.getElementById("teacherNote").value
      };
    }
    document.getElementById("generate").addEventListener("click", () => {
      document.getElementById("receipt").value = JSON.stringify(buildReceipt(), null, 2);
    });
    document.getElementById("copy").addEventListener("click", async () => {
      const value = document.getElementById("receipt").value || JSON.stringify(buildReceipt(), null, 2);
      document.getElementById("receipt").value = value;
      await navigator.clipboard.writeText(value);
    });
    document.getElementById("receipt").value = JSON.stringify(template, null, 2);
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
      format: "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      locks
    },
    null,
    2
  )
);
