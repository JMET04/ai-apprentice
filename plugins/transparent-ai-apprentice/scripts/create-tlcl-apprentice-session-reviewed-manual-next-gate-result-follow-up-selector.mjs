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
    String(value || "tlcl-reviewed-manual-next-gate-result-follow-up-selector")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reviewed-manual-next-gate-result-follow-up-selector"
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
    selectorOnly: true,
    selectorDoesNotValidateReceipt: true,
    selectorDoesNotExecuteFollowUpTool: true,
    selectorDoesNotAutoRunCommand: true,
    selectorDoesNotInvokeModel: true,
    selectorDoesNotFetchRag: true,
    selectorDoesNotWriteMemory: true,
    selectorDoesNotEnableRule: true,
    selectorDoesNotUnlockPackaging: true,
    followUpToolInvoked: false,
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

function candidateFollowUps(result) {
  const selectedGate = String(result?.selectedNextGate || "").toLowerCase();
  const outputFormat = String(result?.observedOutputFormat || result?.expectedOutputFormat || "").toLowerCase();
  const candidates = [
    {
      followUp: "prepare_rag_rule_dsl_review_receipt",
      label: "Prepare RAG Rule DSL review receipt",
      targetRole: "teacher_reviews_high_reasoning_contract_output",
      reason:
        "The next-gate result looks like a RAG Rule DSL validation package, so the next safe step is a teacher review receipt before disabled package planning.",
      nextToolHint: "knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs",
      executeNow: false,
      reviewOnly: true
    },
    {
      followUp: "prepare_medium_runtime_result_review",
      label: "Prepare medium-runtime result review",
      targetRole: "medium_reasoning_runtime_result_review",
      reason:
        "Use only after a bounded medium-runtime dry-run result returns and needs teacher review before reuse or repair.",
      nextToolHint: "manual_medium_runtime_result_review",
      executeNow: false,
      reviewOnly: true
    },
    {
      followUp: "continue_teaching",
      label: "Continue teaching loop",
      targetRole: "teacher_guided_apprentice_iteration",
      reason: "Use the reviewed next-gate result as the next example or correction in the teaching loop.",
      nextToolHint: "continue_teaching",
      executeNow: false,
      reviewOnly: true
    },
    {
      followUp: "correction_to_high_reasoning_repair",
      label: "High reasoning contract repair",
      targetRole: "highest_reasoning_logic_contract_repair",
      reason: "Escalate back to the expensive reasoning layer when the returned result reveals a contract, evidence, or route problem.",
      nextToolHint: "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
      executeNow: false,
      reviewOnly: true
    },
    {
      followUp: "needs_more_result_evidence",
      label: "Request more result evidence",
      targetRole: "teacher_evidence_collection",
      reason: "Stop before any follow-up because the returned result needs stronger evidence or clearer provenance.",
      nextToolHint: "manual_evidence_collection",
      executeNow: false,
      reviewOnly: true
    }
  ];
  if (selectedGate.includes("rag") || selectedGate.includes("rule") || outputFormat.includes("rag") || outputFormat.includes("rule")) {
    return candidates;
  }
  return candidates.filter((item) => item.followUp !== "prepare_rag_rule_dsl_review_receipt");
}

const validationInput = readJsonInput(
  argValue("--validation", argValue("--result-validation", argValue("--manual-next-gate-result-validation", ""))),
  "--validation"
);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-reviewed-manual-next-gate-result-follow-up-selectors"))
  )
);
mkdirSync(outputRoot, { recursive: true });

const validation = validationInput.value;
const reviewedResult = validation?.reviewedManualNextGateResult || null;
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!validation) block("validation_missing", "A manual next-gate result validation is required.");
if (
  validation &&
  ![
    "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_validation_v1",
    "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_validation_result_v1"
  ].includes(validation.format)
) {
  block("validation_format_invalid", "Validation must be a TLCL manual next-gate result receipt validation packet or result.");
}
if (validation && validation.readyForFollowUp !== true) {
  block("follow_up_not_ready", "Validation must be readyForFollowUp=true.");
}
if (validation && validation.status !== "manual_next_gate_result_reviewed_waiting_for_tlcl_follow_up") {
  block("validation_status_not_ready", "Validation status is not waiting for TLCL follow-up.");
}
if (!reviewedResult) block("reviewed_manual_next_gate_result_missing", "Validation must contain reviewedManualNextGateResult.");
if (reviewedResult?.executeNow !== false) block("reviewed_result_execute_lock_missing", "reviewedManualNextGateResult must keep executeNow=false.");
if (reviewedResult?.reviewOnly !== true) block("reviewed_result_review_only_missing", "reviewedManualNextGateResult must keep reviewOnly=true.");
if (!Array.isArray(reviewedResult?.nextGateResultEvidencePaths) || reviewedResult.nextGateResultEvidencePaths.length === 0) {
  block("reviewed_next_gate_result_evidence_missing", "reviewedManualNextGateResult must include nextGateResultEvidencePaths.");
}
if (validation?.locks?.validatorDoesNotExecuteNextGateTool !== true) {
  block("source_validation_lock_missing", "Source validation must prove it did not execute the next-gate tool.");
}

const selectorId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(reviewedResult?.selectedNextGate || "blocked")}`;
const selectorDir = join(outputRoot, selectorId);
mkdirSync(selectorDir, { recursive: true });
const selectorPath = join(selectorDir, "tlcl-reviewed-manual-next-gate-result-follow-up-selector.json");
const receiptTemplatePath = join(selectorDir, "tlcl-reviewed-manual-next-gate-result-follow-up-selection-receipt-template.json");
const htmlPath = join(selectorDir, "tlcl-reviewed-manual-next-gate-result-follow-up-selector.html");
const readmePath = join(selectorDir, "TLCL_REVIEWED_MANUAL_NEXT_GATE_RESULT_FOLLOW_UP_SELECTOR_START_HERE.md");
const selectorLocks = locks();
const ok = blockerRows.length === 0;
const status = ok
  ? "reviewed_manual_next_gate_result_follow_up_selector_waiting_for_teacher_choice"
  : "blocked_before_reviewed_manual_next_gate_result_follow_up_selector";
const candidates = ok ? candidateFollowUps(reviewedResult) : [];

const receiptTemplate = ok
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selection_receipt_v1",
      sourceSelectorId: selectorId,
      sourceSelectorPath: selectorPath,
      sourceValidationId: validation.validationId || "",
      sourceValidationPath: validationInput.path || "<inline-validation>",
      teacherDecision: "needs_teacher_review",
      allowedTeacherDecisions: [
        "follow_up_selected_for_manual_preparation",
        "needs_more_result_evidence",
        "correction_to_high_reasoning_repair",
        "needs_teacher_review"
      ],
      forbiddenTeacherDecisions: [
        "execute_now",
        "run_follow_up",
        "accepted",
        "enable_rule",
        "write_memory",
        "unlock_packaging",
        "claim_complete",
        "invoke_model",
        "fetch_rag"
      ],
      selectedFollowUp: "",
      allowedFollowUps: candidates.map((item) => item.followUp),
      reviewedSelectedNextGate: reviewedResult.selectedNextGate || "",
      reviewedNextTool: reviewedResult.nextTool || "",
      reviewedCommandTemplate: reviewedResult.commandTemplate || "",
      reviewedExpectedOutputFormat: reviewedResult.expectedOutputFormat || "",
      observedOutputFormat: reviewedResult.observedOutputFormat || "",
      upstreamResultEvidencePaths: reviewedResult.upstreamResultEvidencePaths || [],
      nextGateResultEvidencePaths: reviewedResult.nextGateResultEvidencePaths || [],
      confirmedRollbackPoint: reviewedResult.confirmedRollbackPoint || "",
      selectedFollowUpReviewed: false,
      resultEvidenceStillValid: false,
      teacherConfirmedNoExecution: false,
      blockedActionsConfirmed: true,
      executeNow: false,
      reviewOnly: true,
      teacherNotes: "",
      locks: selectorLocks
    }
  : null;

const selector = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selector_v1",
  selectorId,
  createdAt: new Date().toISOString(),
  status,
  sourceValidationPath: validationInput.path,
  sourceValidationId: validation?.validationId || "",
  reviewedManualNextGateResult: reviewedResult,
  candidateFollowUps: candidates,
  receiptTemplate,
  blockers: blockerRows,
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection.mjs --selector "' +
    selectorPath +
    '" --receipt "<teacher-filled-follow-up-selection-receipt.json>"',
  blockedActions: [
    "execute_follow_up_tool_from_reviewed_manual_next_gate_result_selector",
    "auto_run_command_from_reviewed_manual_next_gate_result_selector",
    "invoke_model_from_reviewed_manual_next_gate_result_selector",
    "fetch_rag_from_reviewed_manual_next_gate_result_selector",
    "write_memory_from_reviewed_manual_next_gate_result_selector",
    "enable_rule_from_reviewed_manual_next_gate_result_selector",
    "unlock_packaging_from_reviewed_manual_next_gate_result_selector",
    "claim_completion_from_reviewed_manual_next_gate_result_selector"
  ],
  locks: selectorLocks,
  paths: {
    selector: selectorPath,
    receiptTemplate: receiptTemplatePath,
    html: htmlPath,
    readme: readmePath,
    sourceValidation: validationInput.path
  }
};

writeJson(selectorPath, selector);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Reviewed Manual Next-Gate Result Follow-Up Selector",
    "",
    `- Status: ${status}`,
    `- Source validation: ${validationInput.path || "<inline validation>"}`,
    `- Candidate follow-ups: ${candidates.map((item) => item.followUp).join(", ") || "<blocked>"}`,
    "",
    "This selector lets a teacher choose the next TLCL follow-up after reviewing a separate manual next-gate result. It prepares a receipt only. It does not run the follow-up, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    `Next validation command: ${selector.nextValidationCommand}`
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
  <title>TLCL Follow-Up Selection</title>
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
    <h1>TLCL Follow-Up Selection</h1>
    <p>Status: <code>${htmlEscape(status)}</code></p>
    <p>This page chooses one manual follow-up from a reviewed next-gate result. It does not execute tools or claim completion.</p>
    <section>
      <p>Selector: <a href="${htmlEscape(pathToFileURL(selectorPath).href)}">${htmlEscape(selectorPath)}</a></p>
      <p>Validation command: <code>${htmlEscape(selector.nextValidationCommand)}</code></p>
    </section>
    <section>
      <h2>Receipt</h2>
      <label>Decision
        <select id="decision">
          <option value="needs_teacher_review">needs_teacher_review</option>
          <option value="follow_up_selected_for_manual_preparation">follow_up_selected_for_manual_preparation</option>
          <option value="needs_more_result_evidence">needs_more_result_evidence</option>
          <option value="correction_to_high_reasoning_repair">correction_to_high_reasoning_repair</option>
        </select>
      </label>
      <label>Selected follow-up
        <select id="followUp">
          <option value="">needs_teacher_review</option>
          ${candidates.map((item) => `<option value="${htmlEscape(item.followUp)}">${htmlEscape(item.followUp)}</option>`).join("\n          ")}
        </select>
      </label>
      <label><input id="followUpReviewed" type="checkbox"> Selected follow-up reviewed</label>
      <label><input id="evidenceValid" type="checkbox"> Result evidence still valid</label>
      <label><input id="noExecution" type="checkbox"> Confirm no execution now</label>
      <label>Teacher notes<input id="notes" type="text"></label>
      <button id="generate">Generate Receipt JSON</button>
      <textarea id="receiptJson" spellcheck="false"></textarea>
    </section>
    <section>
      <h2>Candidate Follow-Ups</h2>
      <textarea id="candidateJson" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const selector = ${jsonForScript(selector)};
    const receiptEl = document.getElementById("receiptJson");
    document.getElementById("candidateJson").value = JSON.stringify(selector.candidateFollowUps, null, 2);
    function buildReceipt() {
      return {
        ...selector.receiptTemplate,
        teacherDecision: document.getElementById("decision").value,
        selectedFollowUp: document.getElementById("followUp").value,
        selectedFollowUpReviewed: document.getElementById("followUpReviewed").checked,
        resultEvidenceStillValid: document.getElementById("evidenceValid").checked,
        teacherConfirmedNoExecution: document.getElementById("noExecution").checked,
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
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selector_result_v1",
      status,
      selectorId,
      sourceValidationId: validation?.validationId || "",
      candidateFollowUps: candidates,
      selectorPath,
      receiptTemplatePath,
      htmlPath,
      readmePath,
      blockers: blockerRows,
      locks: selectorLocks
    },
    null,
    2
  )
);
