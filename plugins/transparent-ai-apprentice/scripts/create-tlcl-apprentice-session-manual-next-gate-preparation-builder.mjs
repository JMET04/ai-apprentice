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
    String(value || "tlcl-manual-next-gate-preparation-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-manual-next-gate-preparation-builder"
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
    builderOnly: true,
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

function preparationForGate(handoff, validation) {
  const gate = handoff?.selectedNextGate || validation?.selectedNextGate || "";
  const resultEvidencePaths = handoff?.resultEvidencePaths || validation?.highReasoningRepairHandoff?.resultEvidencePaths || [];
  const confirmedRollbackPoint = handoff?.confirmedRollbackPoint || validation?.highReasoningRepairHandoff?.confirmedRollbackPoint || "";
  if (gate === "prepare_rag_rule_dsl_review_follow_up") {
    return {
      selectedNextGate: gate,
      nextTool: "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
      commandTemplate:
        handoff?.commandTemplate ||
        'node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-reviewed-rule-dsl-validation-package.mjs --review-validation "<rag-confirmed-retrieval-draft-review-receipt-validation.json>" --rollback-point "<rollback-point-dir>" --teacher-reviewed',
      requiredInputs: [
        "teacher-reviewed RAG confirmed retrieval draft review receipt validation",
        "retained rollback point directory",
        "teacher-reviewed flag"
      ],
      expectedOutputFormat: "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1",
      roleBoundary: "highest_reasoning_logic_contract_compile_or_repair",
      resultEvidencePaths,
      confirmedRollbackPoint
    };
  }
  if (gate === "prepare_medium_runtime_dry_run_prep") {
    return {
      selectedNextGate: gate,
      nextTool: "create-tlcl-medium-runtime-dry-run-prep.mjs",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-medium-runtime-dry-run-prep.mjs --runtime-gate "<tlcl-runtime-gate.json>" --spatial-route-bridge "<spatial-route-bridge.json>" --knowledge-augmented-spatial-bridge "<knowledge-spatial-bridge.json>"',
      requiredInputs: [
        "medium_runtime_allowed TLCL runtime gate",
        "teacher-confirmed spatial route bridge or knowledge-augmented spatial bridge",
        "accepted provider role-use plan when required",
        "retained rollback point"
      ],
      expectedOutputFormat: "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1",
      roleBoundary: "medium_reasoning_runtime_after_contract_validation",
      resultEvidencePaths,
      confirmedRollbackPoint
    };
  }
  if (gate === "continue_teaching") {
    return {
      selectedNextGate: gate,
      nextTool: "continue_teaching",
      commandTemplate: "continue_teaching with the reviewed result evidence and teacher notes",
      requiredInputs: ["reviewed downstream result evidence", "teacher notes or next example"],
      expectedOutputFormat: "transparent_ai_teaching_exchange_v1",
      roleBoundary: "teacher_guided_apprentice_iteration",
      resultEvidencePaths,
      confirmedRollbackPoint
    };
  }
  if (gate === "correction_to_high_reasoning_repair" || validation?.correctionToHighReasoningRepair === true) {
    return {
      selectedNextGate: "correction_to_high_reasoning_repair",
      nextTool: "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
      commandTemplate:
        'node plugins\\transparent-ai-apprentice\\scripts\\create-tlcl-rag-informed-high-reasoning-repair-intake.mjs --attachment "<tlcl-rag-evidence-attachment.json>"',
      requiredInputs: [
        "teacher correction or blocker note",
        "reviewed result evidence",
        "RAG evidence attachment when the correction is RAG-informed",
        "retained rollback point"
      ],
      expectedOutputFormat: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_v1",
      roleBoundary: "highest_reasoning_logic_contract_repair",
      resultEvidencePaths,
      confirmedRollbackPoint
    };
  }
  if (gate === "needs_more_result_evidence") {
    return {
      selectedNextGate: gate,
      nextTool: "manual_evidence_collection",
      commandTemplate: "collect and attach more result evidence before choosing the next TLCL gate",
      requiredInputs: ["additional result evidence", "teacher note explaining the evidence gap"],
      expectedOutputFormat: "teacher_reviewed_result_evidence_packet",
      roleBoundary: "teacher_evidence_collection",
      resultEvidencePaths,
      confirmedRollbackPoint
    };
  }
  return {
    selectedNextGate: gate || "needs_teacher_review",
    nextTool: "",
    commandTemplate: "",
    requiredInputs: ["teacher must select a supported next gate"],
    expectedOutputFormat: "",
    roleBoundary: "blocked_before_manual_next_gate_preparation",
    resultEvidencePaths,
    confirmedRollbackPoint
  };
}

const validationInput = readJsonInput(
  argValue("--validation", argValue("--next-gate-validation", argValue("--selection-validation", ""))),
  "--validation"
);
const outputRoot = resolve(
  argValue("--output-dir", argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-manual-next-gate-preparation-builders")))
);
mkdirSync(outputRoot, { recursive: true });

const validation = validationInput.value;
const handoff = validation?.manualNextGateHandoff || null;
const highRepairHandoff = validation?.highReasoningRepairHandoff || null;
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!validation) block("validation_missing", "A next-gate selection validation is required.");
if (
  validation &&
  ![
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_validation_v1",
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_validation_result_v1"
  ].includes(validation.format)
) {
  block("validation_format_invalid", "Validation must be a reviewed manual downstream result next-gate selection validation packet or result.");
}
if (validation && validation.readyForManualPreparation !== true && validation.correctionToHighReasoningRepair !== true) {
  block("validation_not_ready_for_manual_preparation", "Validation must be readyForManualPreparation=true or correctionToHighReasoningRepair=true.");
}
if (validation && !["reviewed_manual_downstream_result_next_gate_selected_waiting_for_manual_preparation", "correction_to_high_reasoning_repair_required"].includes(validation.status)) {
  block("validation_status_not_ready", "Validation status is not ready for manual next-gate preparation.");
}
if (validation?.readyForManualPreparation === true && !handoff) {
  block("manual_next_gate_handoff_missing", "Validation must contain manualNextGateHandoff when readyForManualPreparation=true.");
}
if (validation?.correctionToHighReasoningRepair === true && !handoff && !highRepairHandoff) {
  block("high_reasoning_repair_handoff_missing", "Correction validation must contain a highReasoningRepairHandoff.");
}
if (handoff && handoff.executeNow !== false) block("handoff_execute_lock_missing", "manualNextGateHandoff must keep executeNow=false.");
if (handoff && handoff.reviewOnly !== true) block("handoff_review_only_missing", "manualNextGateHandoff must keep reviewOnly=true.");
if (highRepairHandoff?.executeNow === true) block("high_repair_execute_lock_missing", "highReasoningRepairHandoff must not execute now.");
if (validation?.locks?.validatorDoesNotExecuteNextGateTool !== true) {
  block("source_validation_lock_missing", "Source validation must prove it did not execute the next-gate tool.");
}

const preparation = preparationForGate(handoff || highRepairHandoff || { selectedNextGate: validation?.selectedNextGate }, validation);
if (!preparation.nextTool) block("selected_next_gate_not_supported", "Selected next gate is not supported by the manual preparation builder.");

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(preparation.selectedNextGate || "blocked")}`;
const builderDir = join(outputRoot, builderId);
const builderPath = join(builderDir, "tlcl-manual-next-gate-preparation-builder.json");
const receiptTemplatePath = join(builderDir, "tlcl-manual-next-gate-preparation-receipt-template.json");
const htmlPath = join(builderDir, "tlcl-manual-next-gate-preparation-builder.html");
const readmePath = join(builderDir, "TLCL_MANUAL_NEXT_GATE_PREPARATION_BUILDER_START_HERE.md");
const builderLocks = locks();
const ok = blockerRows.length === 0;
const status = ok
  ? "manual_next_gate_preparation_builder_waiting_for_teacher_review"
  : "blocked_before_manual_next_gate_preparation_builder";

const receiptTemplate = ok
  ? {
      format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_receipt_v1",
      sourceValidationId: validation.validationId || "",
      sourceValidationPath: validationInput.path || "<inline-validation>",
      selectedNextGate: preparation.selectedNextGate,
      reviewedNextTool: preparation.nextTool,
      reviewedCommandTemplate: preparation.commandTemplate,
      requiredInputs: preparation.requiredInputs,
      expectedOutputFormat: preparation.expectedOutputFormat,
      roleBoundary: preparation.roleBoundary,
      resultEvidencePaths: preparation.resultEvidencePaths,
      confirmedRollbackPoint: preparation.confirmedRollbackPoint,
      teacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "manual_next_gate_prepared_for_separate_use",
        "needs_more_result_evidence",
        "correction_to_high_reasoning_repair",
        "needs_teacher_review"
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
      selectedGateReviewed: false,
      commandTemplateReviewed: false,
      requiredInputsReviewed: false,
      rollbackPointRetained: false,
      teacherConfirmedSeparateManualUse: false,
      blockedActionsConfirmed: true,
      executeNow: false,
      reviewOnly: true,
      teacherNotes: "",
      locks: builderLocks
    }
  : null;

const builder = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceValidationPath: validationInput.path,
  sourceValidationId: validation?.validationId || "",
  selectedNextGate: preparation.selectedNextGate,
  preparation,
  receiptTemplate,
  blockers: blockerRows,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-apprentice-session-manual-next-gate-preparation-receipt.mjs --builder "' +
    builderPath +
    '" --receipt "<teacher-filled-manual-next-gate-preparation-receipt.json>"',
  blockedActions: [
    "execute_next_gate_tool_from_manual_next_gate_preparation_builder",
    "auto_run_command_from_manual_next_gate_preparation_builder",
    "invoke_model_from_manual_next_gate_preparation_builder",
    "fetch_rag_from_manual_next_gate_preparation_builder",
    "write_memory_from_manual_next_gate_preparation_builder",
    "enable_rule_from_manual_next_gate_preparation_builder",
    "unlock_packaging_from_manual_next_gate_preparation_builder",
    "claim_completion_from_manual_next_gate_preparation_builder"
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
    "# TLCL Manual Next Gate Preparation Builder",
    "",
    `- Status: ${status}`,
    `- Selected next gate: ${preparation.selectedNextGate}`,
    `- Next tool: ${preparation.nextTool || "<blocked>"}`,
    "",
    "This builder prepares a teacher-review receipt for a separate manual next-gate step. It does not run the next gate, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
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
  <title>TLCL Manual Next Gate Preparation</title>
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
    <h1>TLCL Manual Next Gate Preparation</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>This page prepares a separate manual next-gate step. It does not execute tools, call models, fetch RAG, write memory, or enable rules.</p>
    <section>
      <p>Builder: <a href="${htmlEscape(pathToFileURL(builderPath).href)}">${htmlEscape(builderPath)}</a></p>
      <p>Next tool: <code>${htmlEscape(preparation.nextTool || "<blocked>")}</code></p>
      <p>Validation command: <code>${htmlEscape(builder.nextValidationCommand)}</code></p>
    </section>
    <section>
      <h2>Preparation</h2>
      <textarea id="preparationJson" spellcheck="false"></textarea>
    </section>
    <section>
      <h2>Receipt</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="manual_next_gate_prepared_for_separate_use">manual_next_gate_prepared_for_separate_use</option>
          <option value="needs_more_result_evidence">needs_more_result_evidence</option>
          <option value="correction_to_high_reasoning_repair">correction_to_high_reasoning_repair</option>
        </select>
      </label>
      <label><input id="gateReviewed" type="checkbox"> Selected gate reviewed</label>
      <label><input id="commandReviewed" type="checkbox"> Command template reviewed</label>
      <label><input id="inputsReviewed" type="checkbox"> Required inputs reviewed</label>
      <label><input id="rollbackRetained" type="checkbox"> Rollback point retained</label>
      <label><input id="separateManual" type="checkbox"> Confirm separate manual use only</label>
      <label>Teacher notes<input id="notes" type="text"></label>
      <button id="generate">Generate Receipt JSON</button>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    document.getElementById("preparationJson").value = JSON.stringify(builder.preparation, null, 2);
    const receiptEl = document.getElementById("receiptJson");
    function buildReceipt() {
      return {
        ...builder.receiptTemplate,
        teacherDecision: document.getElementById("decision").value,
        selectedGateReviewed: document.getElementById("gateReviewed").checked,
        commandTemplateReviewed: document.getElementById("commandReviewed").checked,
        requiredInputsReviewed: document.getElementById("inputsReviewed").checked,
        rollbackPointRetained: document.getElementById("rollbackRetained").checked,
        teacherConfirmedSeparateManualUse: document.getElementById("separateManual").checked,
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
      format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_builder_result_v1",
      status,
      builderId,
      selectedNextGate: preparation.selectedNextGate,
      nextTool: preparation.nextTool,
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
