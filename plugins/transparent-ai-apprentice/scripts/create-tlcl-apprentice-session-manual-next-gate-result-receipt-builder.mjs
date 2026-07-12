#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-manual-next-gate-result-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-manual-next-gate-result-receipt-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(resolve(text)), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
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
    receiptBuilderOnly: true,
    builderDoesNotValidateReceipt: true,
    builderDoesNotExecuteNextGateTool: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    nextGateToolInvoked: false,
    targetSoftwareCommandsExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const validationInput = readJsonInput(
  argValue("--validation", argValue("--preparation-validation", argValue("--manual-next-gate-preparation-validation", ""))),
  "--validation"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-manual-next-gate-result-receipt-builders"))
  )
);
mkdirSync(outputRoot, { recursive: true });

const validation = validationInput.value;
const preparation = validation?.manualNextGatePreparation || null;
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!validation) block("validation_missing", "A manual next-gate preparation validation is required.");
if (
  validation &&
  ![
    "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_v1",
    "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_result_v1"
  ].includes(validation.format)
) {
  block("validation_format_invalid", "Validation must be a TLCL manual next-gate preparation validation packet or result.");
}
if (validation && validation.readyForSeparateManualNextGateUse !== true) {
  block("manual_next_gate_use_not_ready", "Validation must be readyForSeparateManualNextGateUse=true.");
}
if (validation && validation.status !== "manual_next_gate_prepared_waiting_for_separate_manual_use") {
  block("validation_status_not_ready", "Validation status is not waiting for separate manual next-gate use.");
}
if (!preparation) block("manual_next_gate_preparation_missing", "Validation must contain manualNextGatePreparation.");
if (preparation?.executeNow !== false) block("manual_next_gate_execute_lock_missing", "manualNextGatePreparation must keep executeNow=false.");
if (validation?.locks?.validatorDoesNotExecuteNextGateTool !== true) {
  block("source_validation_lock_missing", "Source validation must prove it did not execute the next-gate tool.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(preparation?.selectedNextGate || "blocked")}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });
const builderPath = join(builderDir, "tlcl-manual-next-gate-result-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-manual-next-gate-result-receipt-template.json");
const htmlPath = join(builderDir, "tlcl-manual-next-gate-result-receipt-builder.html");
const readmePath = join(builderDir, "TLCL_MANUAL_NEXT_GATE_RESULT_RECEIPT_BUILDER_START_HERE.md");
const builderLocks = locks();
const ok = blockerRows.length === 0;
const status = ok
  ? "manual_next_gate_result_receipt_builder_waiting_for_teacher_result_evidence"
  : "blocked_before_manual_next_gate_result_receipt_builder";

const receiptTemplate = ok
  ? {
      format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_v1",
      sourcePreparationValidationId: validation.validationId || "",
      sourcePreparationValidationPath: validationInput.path || "<inline-validation>",
      teacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "manual_next_gate_result_reviewed_ready_for_follow_up",
        "needs_more_result_evidence",
        "correction_to_high_reasoning_repair"
      ],
      forbiddenTeacherDecisions: [
        "execute_now",
        "run_next_gate",
        "accepted",
        "enable_rule",
        "write_memory",
        "unlock_packaging",
        "claim_complete",
        "invoke_model",
        "fetch_rag"
      ],
      selectedNextGate: preparation.selectedNextGate || "",
      reviewedNextTool: preparation.nextTool || "",
      reviewedCommandTemplate: preparation.commandTemplate || "",
      reviewedRequiredInputs: preparation.requiredInputs || [],
      reviewedExpectedOutputFormat: preparation.expectedOutputFormat || "",
      reviewedRoleBoundary: preparation.roleBoundary || "",
      upstreamResultEvidencePaths: preparation.resultEvidencePaths || [],
      confirmedRollbackPoint: preparation.confirmedRollbackPoint || "",
      manualNextGateUseWasSeparate: false,
      nextGateResultEvidenceReviewed: false,
      observedNextGateResultStatus: "not_run_yet",
      observedOutputFormat: "",
      nextGateResultEvidencePaths: [],
      executeNow: false,
      reviewOnly: true,
      blockedActionsConfirmed: true,
      teacherNotes: "",
      locks: builderLocks
    }
  : null;

const builder = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status,
  sourcePreparationValidationPath: validationInput.path,
  sourcePreparationValidationId: validation?.validationId || "",
  manualNextGatePreparation: preparation,
  receiptTemplate,
  blockers: blockerRows,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-apprentice-session-manual-next-gate-result-receipt.mjs --validation "' +
    (validationInput.path || "<tlcl-manual-next-gate-preparation-validation.json>") +
    '" --receipt "<teacher-filled-manual-next-gate-result-receipt.json>"',
  blockedActions: [
    "execute_next_gate_tool_from_manual_next_gate_result_receipt_builder",
    "auto_run_command_from_manual_next_gate_result_receipt_builder",
    "invoke_model_from_manual_next_gate_result_receipt_builder",
    "fetch_rag_from_manual_next_gate_result_receipt_builder",
    "write_memory_from_manual_next_gate_result_receipt_builder",
    "enable_rule_from_manual_next_gate_result_receipt_builder",
    "unlock_packaging_from_manual_next_gate_result_receipt_builder",
    "claim_completion_from_manual_next_gate_result_receipt_builder"
  ],
  locks: builderLocks,
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath,
    sourceValidation: validationInput.path
  }
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Manual Next-Gate Result Receipt Builder",
    "",
    `- Status: ${status}`,
    `- Source preparation validation: ${validationInput.path || "<inline validation>"}`,
    `- Selected next gate: ${preparation?.selectedNextGate || "<blocked>"}`,
    `- Next tool: ${preparation?.nextTool || "<blocked>"}`,
    "",
    "This builder creates a teacher receipt template for evidence produced by a separate manual next-gate step. It does not run the next gate, validate the receipt, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    `Next validation command: ${builder.nextValidationCommand}`
  ].join("\n") + "\n",
  "utf8"
);

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TLCL Manual Next-Gate Result Receipt</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; background: #f7f9fc; color: #17202a; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 22px; }
    h1 { font-size: 25px; margin: 0 0 8px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #d8e0ec; border-radius: 8px; padding: 15px; margin-top: 12px; }
    label { display: block; margin-top: 10px; }
    input, select, textarea, button { font: inherit; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
    textarea { min-height: 170px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 8px 12px; cursor: pointer; margin-top: 8px; }
    code { word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <h1>TLCL Manual Next-Gate Result Receipt</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>This page records result evidence from a separate manual next-gate step. It does not execute tools or claim completion.</p>
    <section>
      <p>Builder: <a href="${htmlEscape(pathToFileURL(builderPath).href)}">${htmlEscape(builderPath)}</a></p>
      <p>Selected next gate: <code>${htmlEscape(preparation?.selectedNextGate || "<blocked>")}</code></p>
      <p>Next tool: <code>${htmlEscape(preparation?.nextTool || "<blocked>")}</code></p>
      <p>Validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    </section>
    <section>
      <h2>Receipt</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="manual_next_gate_result_reviewed_ready_for_follow_up">manual_next_gate_result_reviewed_ready_for_follow_up</option>
          <option value="needs_more_result_evidence">needs_more_result_evidence</option>
          <option value="correction_to_high_reasoning_repair">correction_to_high_reasoning_repair</option>
        </select>
      </label>
      <label><input id="separate" type="checkbox"> Manual next-gate step was separate</label>
      <label><input id="evidenceReviewed" type="checkbox"> Next-gate result evidence reviewed</label>
      <label>Observed next-gate result status<input id="observedStatus" type="text" value="completed_reviewed"></label>
      <label>Observed output format<input id="observedFormat" type="text" value="${htmlEscape(preparation?.expectedOutputFormat || "")}"></label>
      <label>Next-gate result evidence paths or summaries, one per line<textarea id="evidencePaths" spellcheck="false"></textarea></label>
      <label>Teacher notes<input id="notes" type="text"></label>
      <button id="generate">Generate Receipt JSON</button>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
    <section>
      <h2>Manual Next-Gate Preparation</h2>
      <textarea id="preparationJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const receiptEl = document.getElementById("receiptJson");
    const preparationEl = document.getElementById("preparationJson");
    preparationEl.value = JSON.stringify(builder.manualNextGatePreparation, null, 2);
    function buildReceipt() {
      return {
        ...builder.receiptTemplate,
        teacherDecision: document.getElementById("decision").value,
        manualNextGateUseWasSeparate: document.getElementById("separate").checked,
        nextGateResultEvidenceReviewed: document.getElementById("evidenceReviewed").checked,
        observedNextGateResultStatus: document.getElementById("observedStatus").value,
        observedOutputFormat: document.getElementById("observedFormat").value,
        nextGateResultEvidencePaths: document.getElementById("evidencePaths").value.split(/\\r?\\n/).map((item) => item.trim()).filter(Boolean),
        teacherNotes: document.getElementById("notes").value
      };
    }
    function render() { receiptEl.value = JSON.stringify(buildReceipt(), null, 2); }
    document.getElementById("generate").addEventListener("click", render);
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
      ok,
      format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_builder_result_v1",
      status,
      builderId,
      sourcePreparationValidationId: validation?.validationId || "",
      sourcePreparationValidationPath: validationInput.path,
      selectedNextGate: preparation?.selectedNextGate || "",
      nextTool: preparation?.nextTool || "",
      builderPath,
      receiptTemplatePath,
      htmlPath,
      readmePath,
      blockers: blockerRows,
      locks: builderLocks
    },
    null,
    2
  )
);
