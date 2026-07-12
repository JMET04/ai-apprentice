#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-metadata-gate-preflight-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-metadata-gate-preflight-receipt-builder"
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

function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
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
    builderDoesNotRunMetadataGate: true,
    builderDoesNotReadLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotRegisterSchedule: true,
    builderDoesNotWriteMemory: true,
    metadataGateRunnerInvoked: false,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    rollbackPointRequiredBeforeRun: true,
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

function writeReadme(path, builder) {
  const lines = [
    "# Original Goal Low-Token Metadata Gate Preflight Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Ready rows: ${builder.counts.readyRows}`,
    `Blocked rows: ${builder.counts.blockedRows}`,
    `Source preflight: ${builder.paths.sourcePreflight}`,
    "",
    "Use this builder to create a teacher-filled receipt before any metadata gate batch command is prepared.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder packet: ${builder.paths.builder}`,
    `- Receipt template: ${builder.paths.receiptTemplate}`,
    `- Validation command template: ${builder.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This builder does not save the generated receipt.",
    "- It does not validate receipts.",
    "- It does not run metadata gates, read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "- The validator requires explicit teacher confirmation and a retained rollback point before it prepares any batch command."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder, receiptTemplate) {
  const rows = builder.reviewRows
    .map(
      (row) => `<tr>
        <td>${htmlEscape(row.ledgerNumber)}</td>
        <td>${htmlEscape(row.software)}</td>
        <td>${htmlEscape(row.followUpId)}</td>
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.defaultDecision)}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Low-Token Metadata Gate Receipt Builder</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 18px 0 10px; }
    .panel, table { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; box-shadow: 0 1px 2px rgba(13,31,54,.06); }
    .panel { padding: 16px; margin: 14px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .row-card { border: 1px solid #d8dee8; border-radius: 8px; padding: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { text-align: left; vertical-align: top; padding: 10px; border-bottom: 1px solid #e6ebf2; }
    th { background: #eef3f8; }
    label { display: block; margin: 8px 0; font-weight: 600; }
    input[type="text"], select { min-height: 34px; width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 4px 8px; }
    input[type="checkbox"] { margin-right: 6px; }
    textarea { width: 100%; min-height: 300px; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 10px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; margin-right: 6px; }
    button.secondary { background: #fff; color: #174d89; }
    code, pre { background: #eef2f7; border-radius: 4px; }
    code { padding: 2px 5px; word-break: break-all; }
    pre { padding: 12px; overflow: auto; max-height: 460px; }
    .badge { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 999px; background: #e8f2ff; color: #174d89; font-size: 12px; }
    .muted { color: #586579; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Low-Token Metadata Gate Receipt Builder</h1>
  <p><span class="badge">review only</span></p>
  <section class="panel">
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Ready rows:</strong> ${htmlEscape(builder.counts.readyRows)}; blocked rows: ${htmlEscape(builder.counts.blockedRows)}</p>
    <p class="muted">The teacher must fill the receipt template, set a retained rollback point, and run the validator. This page does not execute commands.</p>
  </section>
  <section class="panel">
    <h2>Validation Command Template</h2>
    <p><code>${htmlEscape(builder.nextValidationCommand)}</code></p>
  </section>
  <section class="panel">
    <h2>Generate Receipt JSON</h2>
    <p class="muted">Fill the teacher confirmation, point to a retained rollback directory or manifest, review each row, then copy the JSON into a receipt file for the validator. This browser page only builds JSON; it does not save files or run the metadata gate.</p>
    <label for="decision">Overall decision</label>
    <select id="decision">
      <option value="needs_teacher_review">needs_teacher_review</option>
      <option value="teacher_confirmed_run_low_token_metadata_gate">teacher_confirmed_run_low_token_metadata_gate</option>
      <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
    </select>
    <label for="teacherConfirmation">Teacher confirmation</label>
    <input id="teacherConfirmation" type="text" placeholder="teacher confirmed after reviewing evidence and retaining rollback point">
    <label for="rollbackPoint">Retained rollback point path</label>
    <input id="rollbackPoint" type="text" placeholder="D:\\path\\to\\rollback-point">
    <label><input id="rollbackPointCreated" type="checkbox">Rollback point has been created and retained</label>
    <label><input id="allowCommandGeneration" type="checkbox">Allow validator to prepare the metadata gate command</label>
    <p>
      <button id="markReady" class="secondary">Mark Ready Rows Confirmed</button>
      <button id="generate">Generate Receipt JSON</button>
      <button id="copy" class="secondary">Copy JSON</button>
    </p>
    <div id="rows" class="grid"></div>
    <textarea id="receipt" spellcheck="false"></textarea>
  </section>
  <h2>Rows</h2>
  <table>
    <thead><tr><th>#</th><th>Software</th><th>Follow-up</th><th>Status</th><th>Default decision</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <section class="panel">
    <h2>Receipt Template</h2>
    <pre>${htmlEscape(JSON.stringify(receiptTemplate, null, 2))}</pre>
  </section>
</main>
<script>
  const builder = ${jsonForScript(builder)};
  const receiptTemplate = ${jsonForScript(receiptTemplate)};
  const rowsEl = document.getElementById("rows");
  const receiptEl = document.getElementById("receipt");

  for (const row of builder.reviewRows) {
    const card = document.createElement("article");
    card.className = "row-card";
    const title = document.createElement("strong");
    title.textContent = row.ledgerNumber + ". " + row.software;
    const followUp = document.createElement("p");
    followUp.className = "muted";
    followUp.textContent = row.followUpId;
    const status = document.createElement("p");
    status.className = "muted";
    status.textContent = row.status;

    const decisionLabel = document.createElement("label");
    decisionLabel.appendChild(document.createTextNode("Teacher decision"));
    const decisionSelect = document.createElement("select");
    decisionSelect.dataset.followUpId = row.followUpId;
    decisionSelect.dataset.field = "decision";
    for (const decision of row.allowedTeacherDecisions) {
      const option = document.createElement("option");
      option.value = decision;
      option.textContent = decision;
      decisionSelect.appendChild(option);
    }
    decisionLabel.appendChild(decisionSelect);

    const reviewedLabel = document.createElement("label");
    const reviewedInput = document.createElement("input");
    reviewedInput.type = "checkbox";
    reviewedInput.dataset.followUpId = row.followUpId;
    reviewedInput.dataset.field = "reviewed";
    reviewedLabel.appendChild(reviewedInput);
    reviewedLabel.appendChild(document.createTextNode("Evidence reviewed"));

    const noteLabel = document.createElement("label");
    noteLabel.appendChild(document.createTextNode("Teacher note"));
    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.dataset.followUpId = row.followUpId;
    noteInput.dataset.field = "note";
    noteInput.placeholder = "optional note";
    noteLabel.appendChild(noteInput);

    card.appendChild(title);
    card.appendChild(followUp);
    card.appendChild(status);
    card.appendChild(decisionLabel);
    card.appendChild(reviewedLabel);
    card.appendChild(noteLabel);
    rowsEl.appendChild(card);
  }

  function buildReceipt() {
    const receipt = JSON.parse(JSON.stringify(receiptTemplate));
    receipt.decision = document.getElementById("decision").value;
    receipt.teacherConfirmation = document.getElementById("teacherConfirmation").value;
    receipt.rollbackPointCreated = document.getElementById("rollbackPointCreated").checked;
    receipt.rollbackPoint = document.getElementById("rollbackPoint").value;
    receipt.allowCommandGeneration = document.getElementById("allowCommandGeneration").checked;
    receipt.rowDecisions = receipt.rowDecisions.map((row) => {
      const selector = '[data-follow-up-id="' + row.followUpId + '"]';
      return {
        ...row,
        teacherDecision: document.querySelector(selector + '[data-field="decision"]').value,
        evidenceReviewed: document.querySelector(selector + '[data-field="reviewed"]').checked,
        teacherNote: document.querySelector(selector + '[data-field="note"]').value
      };
    });
    return receipt;
  }

  function render() {
    receiptEl.value = JSON.stringify(buildReceipt(), null, 2);
  }

  document.getElementById("markReady").addEventListener("click", () => {
    for (const row of builder.reviewRows) {
      const selector = '[data-follow-up-id="' + row.followUpId + '"]';
      const decision = document.querySelector(selector + '[data-field="decision"]');
      const reviewed = document.querySelector(selector + '[data-field="reviewed"]');
      if (row.readyForTeacherConfirmedMetadataGate) {
        decision.value = "teacher_confirmed_run_low_token_metadata_gate";
        reviewed.checked = true;
      } else {
        decision.value = "blocked_needs_more_evidence";
      }
    }
    document.getElementById("decision").value = "teacher_confirmed_run_low_token_metadata_gate";
    render();
  });
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
}

const goal = argValue("--goal", "Build teacher confirmation receipt for low-token metadata gate preflight.");
const preflightInput = readJsonInput(
  argValue("--preflight", argValue("--metadata-gate-preflight", "")),
  "--preflight",
  "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1"
);
if (!preflightInput.value) throw new Error("--preflight is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-metadata-gate-preflight-receipt-builders")
  )
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const preflight = preflightInput.value;
const lockState = locks();
const reviewRows = (preflight.rows || []).map((row) => ({
  ledgerNumber: row.ledgerNumber || "",
  software: row.software || "",
  processName: row.processName || "",
  followUpId: row.followUpId || "",
  queueItemId: row.queueItemId || "",
  sourceStatus: row.status || "",
  readyForTeacherConfirmedMetadataGate: row.readyForTeacherConfirmedMetadataGate === true,
  blockers: row.blockers || [],
  status:
    row.readyForTeacherConfirmedMetadataGate === true
      ? "awaiting_teacher_confirmation_and_retained_rollback_point"
      : "blocked_before_metadata_gate",
  defaultDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_confirmed_run_low_token_metadata_gate",
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
const readyRows = reviewRows.filter((row) => row.readyForTeacherConfirmedMetadataGate);
const blockedRows = reviewRows.filter((row) => !row.readyForTeacherConfirmedMetadataGate);
const builderPath = join(builderDir, "original-goal-low-token-metadata-gate-preflight-receipt-builder.json");
const htmlPath = join(builderDir, "original-goal-low-token-metadata-gate-preflight-receipt-builder.html");
const receiptTemplatePath = join(builderDir, "teacher-low-token-metadata-gate-preflight-receipt-template.json");
const readmePath = join(builderDir, "ORIGINAL_GOAL_LOW_TOKEN_METADATA_GATE_PREFLIGHT_RECEIPT_BUILDER_START_HERE.md");
const nextValidationCommand =
  "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs --preflight " +
  quote(preflightInput.path || "<metadata-gate-preflight.json>") +
  ' --receipt "<teacher-low-token-metadata-gate-preflight-receipt.json>" --output-dir ' +
  quote(join(builderDir, "receipt-validation"));

const receiptTemplate = {
  format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1",
  builderId,
  sourcePreflight: preflightInput.path,
  decision: "needs_teacher_review",
  teacherConfirmation: "",
  rollbackPointCreated: false,
  rollbackPoint: "",
  allowCommandGeneration: false,
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
  format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status:
    readyRows.length > 0
      ? "metadata_gate_preflight_receipt_builder_ready_for_teacher_confirmation"
      : "metadata_gate_preflight_receipt_builder_blocked_no_ready_rows",
  purpose:
    "Build a teacher-filled receipt template that must confirm evidence, retained rollback point, and command preparation before the metadata gate preflight can become a prepared command.",
  counts: {
    reviewRows: reviewRows.length,
    readyRows: readyRows.length,
    blockedRows: blockedRows.length
  },
  reviewRows,
  paths: {
    builder: builderPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourcePreflight: preflightInput.path
  },
  nextValidationCommand,
  blockedTransitions: [
    "save_teacher_acceptance_from_builder",
    "run_metadata_gate_from_builder",
    "read_logs_from_builder",
    "capture_screenshot_from_builder",
    "execute_target_software_from_builder",
    "register_schedule_from_builder",
    "write_memory_from_builder",
    "claim_goal_complete_from_builder",
    "render_untrusted_software_names_with_inner_html"
  ],
  browserSafety: {
    usesSafeTextRendering: true,
    untrustedFieldsRenderedWithTextContent: ["software", "followUpId", "status", "teacherDecision"]
  },
  locks: lockState
};

writeJsonFile(builderPath, builder);
writeJsonFile(receiptTemplatePath, receiptTemplate);
writeHtml(htmlPath, builder, receiptTemplate);
writeReadme(readmePath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_builder_result_v1",
      builderPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      status: builder.status,
      counts: builder.counts,
      nextValidationCommand,
      locks: lockState
    },
    null,
    2
  )
);
