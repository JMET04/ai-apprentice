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
    String(value || "event-triggered-low-token-observation-policy-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "event-triggered-low-token-observation-policy-receipt-builder"
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

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
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
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    browserReceiptBuilder: true,
    builderWritesDefaultReceiptTemplate: true,
    builderDoesNotWriteTeacherFilledReceipt: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotRunBudgetPlan: true,
    builderDoesNotRunCapture: true,
    builderDoesNotRunLearningHandoff: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotSendUiEvents: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRules: true,
    builderDoesNotUnlockPackaging: true,
    captureInvoked: false,
    learningHandoffInvoked: false,
    budgetPlanInvoked: false,
    screenshotsCaptured: false,
    fullLogsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# Event Triggered Low Token Observation Policy Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Policy: ${builder.paths.sourcePolicy}`,
    "",
    "Use the browser page to generate a teacher-filled receipt JSON after reviewing each low-token trigger row.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    `- Default receipt template: ${builder.paths.receiptTemplate}`,
    `- Next validation command: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder writes only the builder packet, browser page, README, and a default receipt template.",
    "- The browser page can download teacher-filled JSON locally, but this script does not write teacher-filled receipts.",
    "- It does not validate receipts, capture screenshots, read full logs, execute software, send UI events, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Event Triggered Low Token Policy Receipt Builder</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 10px; }
    p { line-height: 1.5; }
    .panel, .row { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(14, 30, 50, .06); }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    .grid { display: grid; gap: 12px; }
    .row { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.2fr) minmax(220px, 1.2fr); gap: 12px; align-items: start; }
    label { display: block; font-size: 13px; color: #2d4058; margin-bottom: 5px; }
    select, input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd6e3; border-radius: 6px; padding: 8px; font: inherit; }
    textarea { min-height: 64px; resize: vertical; }
    textarea.output { min-height: 300px; font: 13px Consolas, monospace; }
    button { min-height: 36px; border-radius: 6px; border: 1px solid #174d89; background: #174d89; color: #fff; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #5b687a; font-size: 13px; }
    .lock { color: #7b241c; font-weight: 700; }
    @media (max-width: 760px) { main { padding: 18px; } .row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>Event Triggered Low Token Policy Receipt Builder</h1>
    <p><span class="badge">review only</span> <span class="badge">no screenshots now</span> <span class="badge">no execution</span></p>
    <p>Review each trigger row. Confirming a visual row only prepares a later teacher-confirmed one-screenshot command template after validation; this page never captures.</p>
    <p><strong>Policy:</strong> <a href="${htmlEscape(fileHref(builder.paths.sourcePolicy))}">${htmlEscape(builder.paths.sourcePolicy)}</a></p>
    <section class="panel">
      <h2>Rows</h2>
      <div id="rows" class="grid"></div>
      <div class="toolbar">
        <button id="generate">Generate Receipt JSON</button>
        <button id="download" class="secondary">Download Receipt JSON</button>
        <button id="copy" class="secondary">Copy JSON</button>
      </div>
      <textarea id="receipt" class="output" spellcheck="false"></textarea>
      <p class="muted">Next validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
      <p class="lock">Forbidden decisions remain blocked: accepted, execute_now, capture_now, read_full_logs, write_memory, enable_rule, unlock_packaging, native_universal_execution, claim_goal_complete.</p>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const rowsEl = document.getElementById("rows");
    const receiptEl = document.getElementById("receipt");
    const decisions = builder.allowedDecisions;
    function el(tag, attrs = {}, text = "") {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "className") node.className = value;
        else node.setAttribute(key, value);
      }
      if (text) node.textContent = text;
      return node;
    }
    for (const row of builder.reviewRows) {
      const card = el("article", { className: "row" });
      const summary = el("div");
      summary.innerHTML = "<strong>" + row.rowId + "</strong><p class='muted'>" + row.software + "</p><p>Decision: <code>" + row.lowTokenDecision + "</code></p><p>Max screenshots: <code>" + row.maxScreenshots + "</code></p>";
      const decisionBox = el("div");
      const decisionLabel = el("label", {}, "Teacher decision");
      const select = el("select", { "data-row-id": row.rowId, "data-field": "teacherDecision" });
      for (const decision of decisions) {
        const option = el("option", { value: decision }, decision);
        select.appendChild(option);
      }
      decisionBox.appendChild(decisionLabel);
      decisionBox.appendChild(select);
      const noteBox = el("div");
      noteBox.appendChild(el("label", {}, "Teacher note"));
      noteBox.appendChild(el("textarea", { "data-row-id": row.rowId, "data-field": "teacherNote", placeholder: "Why this row is confirmed, blocked, or too expensive" }));
      noteBox.appendChild(el("label", {}, "Lower-token alternative"));
      noteBox.appendChild(el("input", { "data-row-id": row.rowId, "data-field": "lowerTokenAlternative", placeholder: "metadata-only, compact event only, no visual..." }));
      noteBox.appendChild(el("label", {}, "Approved visual request id"));
      noteBox.appendChild(el("input", { "data-row-id": row.rowId, "data-field": "approvedVisualCheckRequestId", placeholder: row.visualRow ? "<teacher-reviewed-request-id>" : "" }));
      card.appendChild(summary);
      card.appendChild(decisionBox);
      card.appendChild(noteBox);
      rowsEl.appendChild(card);
    }
    function valueFor(rowId, field) {
      const input = document.querySelector('[data-row-id="' + rowId + '"][data-field="' + field + '"]');
      return input ? input.value : "";
    }
    function buildReceipt() {
      return {
        format: "transparent_ai_event_triggered_low_token_observation_policy_receipt_v1",
        policyId: builder.policyId,
        policyPath: builder.paths.sourcePolicy,
        defaultDecision: "needs_teacher_review",
        allowedDecisions: builder.allowedDecisions,
        forbiddenDecisions: builder.forbiddenDecisions,
        rowReceipts: builder.reviewRows.map((row) => ({
          rowId: row.rowId,
          teacherDecision: valueFor(row.rowId, "teacherDecision") || "needs_teacher_review",
          teacherNote: valueFor(row.rowId, "teacherNote"),
          lowerTokenAlternative: valueFor(row.rowId, "lowerTokenAlternative"),
          approvedVisualCheckRequestId: valueFor(row.rowId, "approvedVisualCheckRequestId"),
          locks: {
            accepted: false,
            ruleEnabled: false,
            packagingGated: true,
            captureNow: false,
            executeNow: false,
            writeMemoryNow: false
          }
        })),
        nextValidationCommandTemplate: builder.nextValidationCommand,
        locks: builder.locks
      };
    }
    function render() {
      receiptEl.value = JSON.stringify(buildReceipt(), null, 2);
    }
    function download() {
      render();
      const blob = new Blob([receiptEl.value + "\\n"], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "teacher-filled-event-triggered-low-token-observation-policy-receipt.json";
      a.click();
      URL.revokeObjectURL(a.href);
    }
    document.getElementById("generate").addEventListener("click", render);
    document.getElementById("download").addEventListener("click", download);
    document.getElementById("copy").addEventListener("click", async () => {
      render();
      await navigator.clipboard.writeText(receiptEl.value);
    });
    document.addEventListener("input", render);
    render();
  </script>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a browser receipt generator for the event-triggered low-token observation policy.");
const policyInput = readJsonInput(
  argValue("--policy", argValue("--builder", "")),
  "--policy",
  "transparent_ai_event_triggered_low_token_observation_policy_v1"
);
if (!policyInput.value) throw new Error("--policy is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "event-triggered-low-token-observation-policy-receipt-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const policy = policyInput.value;
const builderPath = join(builderDir, "event-triggered-low-token-observation-policy-receipt-builder.json");
const htmlPath = join(builderDir, "event-triggered-low-token-observation-policy-receipt-builder.html");
const readmePath = join(builderDir, "EVENT_TRIGGERED_LOW_TOKEN_OBSERVATION_POLICY_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplatePath = join(builderDir, "teacher-event-triggered-low-token-observation-policy-receipt-template.json");
const nextValidationCommand =
  policy.nextReceiptValidationCommand ||
  commandLine("validate-event-triggered-low-token-observation-policy-receipt.mjs", [
    ["--policy", policyInput.path || "<event-triggered-low-token-observation-policy.json>"],
    ["--receipt", "<teacher-filled-event-triggered-low-token-observation-policy-receipt.json>"],
    ["--output-dir", join(builderDir, "receipt-validation")]
  ]);
const lockState = locks();
const allowedDecisions = [
  "needs_teacher_review",
  "teacher_confirms_policy",
  "teacher_requests_lower_token_cost",
  "teacher_marks_visual_trigger_too_expensive",
  "blocked"
];
const forbiddenDecisions = [
  "accepted",
  "execute_now",
  "run_now",
  "capture_now",
  "capture_screenshot",
  "read_full_logs",
  "send_ui_events",
  "register_schedule",
  "continuous_recording",
  "write_memory",
  "enable_rule",
  "unlock_packaging",
  "native_universal_execution",
  "claim_goal_complete"
];
const reviewRows = (policy.triggerRows || []).map((row) => ({
  rowId: row.rowId,
  sourceActionId: row.sourceActionId || "",
  software: row.software || "",
  triggerClass: row.triggerClass || "",
  route: row.route || "",
  lowTokenDecision: row.lowTokenDecision || "",
  visualRow: Number(row.maxScreenshots || 0) > 0,
  maxScreenshots: row.maxScreenshots || 0,
  screenshotAllowedNow: row.screenshotAllowedNow === true,
  nextInstruction: row.nextInstruction || "",
  defaultDecision: "needs_teacher_review"
}));

const receiptTemplate = {
  format: "transparent_ai_event_triggered_low_token_observation_policy_receipt_v1",
  policyId: policy.policyId || "",
  policyPath: policyInput.path,
  defaultDecision: "needs_teacher_review",
  allowedDecisions,
  forbiddenDecisions,
  rowReceipts: reviewRows.map((row) => ({
    rowId: row.rowId,
    teacherDecision: "needs_teacher_review",
    teacherNote: "",
    lowerTokenAlternative: "",
    approvedVisualCheckRequestId: "",
    locks: {
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      captureNow: false,
      executeNow: false,
      writeMemoryNow: false
    }
  })),
  nextValidationCommandTemplate: nextValidationCommand,
  locks: lockState
};

const builder = {
  ok: true,
  format: "transparent_ai_event_triggered_low_token_observation_policy_receipt_builder_v1",
  builderId,
  policyId: policy.policyId || "",
  createdAt: new Date().toISOString(),
  goal,
  status: "browser_receipt_builder_ready_for_teacher_policy_review",
  policyStatus: policy.status || "",
  reviewRows,
  reviewRowCount: reviewRows.length,
  visualRowCount: reviewRows.filter((row) => row.visualRow).length,
  compactRowCount: reviewRows.filter((row) => !row.visualRow).length,
  allowedDecisions,
  forbiddenDecisions,
  nextValidationCommand,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    receiptTemplate: receiptTemplatePath,
    sourcePolicy: policyInput.path,
    sourcePolicyHtml: policy.paths?.html || "",
    sourcePolicyReadme: policy.paths?.readme || ""
  },
  blockedActions: [
    "capture_screenshot_from_receipt_builder",
    "read_full_logs_from_receipt_builder",
    "execute_target_software_from_receipt_builder",
    "send_ui_events_from_receipt_builder",
    "write_memory_from_receipt_builder",
    "enable_rule_from_receipt_builder",
    "unlock_packaging_from_receipt_builder",
    "claim_goal_complete_from_receipt_builder"
  ],
  locks: lockState
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_event_triggered_low_token_observation_policy_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      receiptTemplatePath,
      nextValidationCommand,
      status: builder.status,
      reviewRowCount: builder.reviewRowCount,
      visualRowCount: builder.visualRowCount,
      compactRowCount: builder.compactRowCount,
      locks: lockState
    },
    null,
    2
  )
);
