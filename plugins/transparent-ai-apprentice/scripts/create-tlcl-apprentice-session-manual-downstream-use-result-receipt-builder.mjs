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
    String(value || "tlcl-manual-downstream-use-result-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-manual-downstream-use-result-receipt-builder"
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
    builderDoesNotExecuteDownstreamTool: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    downstreamToolInvoked: false,
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

const validationInput = readJsonInput(argValue("--validation", argValue("--route-request-validation", "")), "--validation");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue(
      "--out-dir",
      join(process.cwd(), ".transparent-apprentice", "tlcl-apprentice-session-manual-downstream-result-receipt-builders")
    )
  )
);
mkdirSync(outputRoot, { recursive: true });

const validation = validationInput.value;
const manualDownstreamUse = validation?.manualDownstreamUse || null;
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!validation) block("validation_missing", "A validated route request receipt validation is required.");
if (
  validation &&
  ![
    "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_v1",
    "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_result_v1"
  ].includes(validation.format)
) {
  block("validation_format_invalid", "Validation must be a TLCL validated route request receipt validation packet or result.");
}
if (validation && validation.readyForManualDownstreamUse !== true) {
  block("manual_downstream_use_not_ready", "Validation must be readyForManualDownstreamUse=true.");
}
if (validation && validation.status !== "tlcl_validated_route_request_reviewed_waiting_for_separate_manual_downstream_use") {
  block("validation_status_not_ready", "Validation status is not waiting for separate manual downstream use.");
}
if (!manualDownstreamUse) block("manual_downstream_use_missing", "Validation must contain manualDownstreamUse.");
if (manualDownstreamUse?.executeNow !== false) block("manual_downstream_execute_lock_missing", "manualDownstreamUse must keep executeNow=false.");
if (validation?.locks?.validatorDoesNotExecuteDownstreamTool !== true) {
  block("source_validation_lock_missing", "Source validation must prove it did not execute the downstream tool.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(manualDownstreamUse?.route || "blocked")}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });
const builderPath = join(builderDir, "tlcl-apprentice-session-manual-downstream-use-result-receipt-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-apprentice-session-manual-downstream-use-result-receipt-template.json");
const htmlPath = join(builderDir, "tlcl-apprentice-session-manual-downstream-use-result-receipt-builder.html");
const readmePath = join(builderDir, "TLCL_MANUAL_DOWNSTREAM_USE_RESULT_RECEIPT_BUILDER_START_HERE.md");
const builderLocks = locks();
const ok = blockerRows.length === 0;
const status = ok
  ? "manual_downstream_use_result_receipt_builder_waiting_for_teacher_result_evidence"
  : "blocked_before_manual_downstream_use_result_receipt_builder";

const receiptTemplate = ok
  ? {
      format: "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_v1",
      sourceValidationId: validation.validationId || "",
      sourceValidationPath: validationInput.path || "<inline-validation>",
      teacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "manual_downstream_result_reviewed_ready_for_next_gate",
        "needs_more_evidence",
        "correction_to_high_reasoning_repair"
      ],
      forbiddenTeacherDecisions: [
        "execute_now",
        "accepted",
        "enable_rule",
        "write_memory",
        "unlock_packaging",
        "claim_complete",
        "invoke_model",
        "fetch_rag"
      ],
      reviewedRoute: manualDownstreamUse.route || "",
      reviewedNextTool: manualDownstreamUse.nextTool || "",
      reviewedArgs: manualDownstreamUse.args || {},
      reviewedCommandTemplate: manualDownstreamUse.commandTemplate || "",
      confirmedRollbackPoint: manualDownstreamUse.confirmedRollbackPoint || "",
      manualDownstreamUseWasSeparate: false,
      downstreamResultEvidenceReviewed: false,
      observedResultStatus: "not_run_yet",
      resultEvidencePaths: [],
      executeNow: false,
      reviewOnly: true,
      blockedActionsConfirmed: true,
      teacherNotes: "",
      locks: builderLocks
    }
  : null;

const builder = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceValidationPath: validationInput.path,
  sourceValidationId: validation?.validationId || "",
  manualDownstreamUse,
  receiptTemplate,
  blockers: blockerRows,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs --validation "' +
    (validationInput.path || "<tlcl-validated-route-request-receipt-validation.json>") +
    '" --receipt "<teacher-filled-manual-downstream-use-result-receipt.json>"',
  blockedActions: [
    "execute_downstream_tool_from_manual_downstream_result_receipt_builder",
    "auto_run_command_from_manual_downstream_result_receipt_builder",
    "invoke_model_from_manual_downstream_result_receipt_builder",
    "fetch_rag_from_manual_downstream_result_receipt_builder",
    "write_memory_from_manual_downstream_result_receipt_builder",
    "enable_rule_from_manual_downstream_result_receipt_builder",
    "unlock_packaging_from_manual_downstream_result_receipt_builder",
    "claim_completion_from_manual_downstream_result_receipt_builder"
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
    "# TLCL Manual Downstream Use Result Receipt Builder",
    "",
    `- Status: ${status}`,
    `- Source validation: ${validationInput.path || "<inline validation>"}`,
    `- Next tool: ${manualDownstreamUse?.nextTool || "<blocked>"}`,
    "",
    "This builder creates a teacher receipt template for evidence produced by a separate manual downstream step. It does not run the downstream tool, validate the receipt, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
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
  <title>TLCL Manual Downstream Result Receipt</title>
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
    <h1>TLCL Manual Downstream Result Receipt</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>This page records result evidence from a separate manual downstream step. It does not execute tools or claim completion.</p>
    <section>
      <p>Builder: <a href="${htmlEscape(pathToFileURL(builderPath).href)}">${htmlEscape(builderPath)}</a></p>
      <p>Next tool: <code>${htmlEscape(manualDownstreamUse?.nextTool || "<blocked>")}</code></p>
      <p>Validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    </section>
    <section>
      <h2>Receipt</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="manual_downstream_result_reviewed_ready_for_next_gate">manual_downstream_result_reviewed_ready_for_next_gate</option>
          <option value="needs_more_evidence">needs_more_evidence</option>
          <option value="correction_to_high_reasoning_repair">correction_to_high_reasoning_repair</option>
        </select>
      </label>
      <label><input id="separate" type="checkbox"> Manual downstream step was separate</label>
      <label><input id="evidenceReviewed" type="checkbox"> Downstream result evidence reviewed</label>
      <label>Observed result status<input id="observedStatus" type="text" value="completed_reviewed"></label>
      <label>Result evidence paths or summaries, one per line<textarea id="evidencePaths" spellcheck="false"></textarea></label>
      <label>Teacher notes<input id="notes" type="text"></label>
      <button id="generate">Generate Receipt JSON</button>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
    <section>
      <h2>Manual Downstream Use</h2>
      <textarea id="manualUseJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const receiptEl = document.getElementById("receiptJson");
    const manualUseEl = document.getElementById("manualUseJson");
    manualUseEl.value = JSON.stringify(builder.manualDownstreamUse, null, 2);
    function buildReceipt() {
      return {
        ...builder.receiptTemplate,
        teacherDecision: document.getElementById("decision").value,
        manualDownstreamUseWasSeparate: document.getElementById("separate").checked,
        downstreamResultEvidenceReviewed: document.getElementById("evidenceReviewed").checked,
        observedResultStatus: document.getElementById("observedStatus").value,
        resultEvidencePaths: document.getElementById("evidencePaths").value.split(/\\r?\\n/).map((item) => item.trim()).filter(Boolean),
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
      format: "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_builder_result_v1",
      status,
      builderId,
      sourceValidationId: validation?.validationId || "",
      nextTool: manualDownstreamUse?.nextTool || "",
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
