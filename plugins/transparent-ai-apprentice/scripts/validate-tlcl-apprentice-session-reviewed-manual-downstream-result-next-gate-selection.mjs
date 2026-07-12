#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-reviewed-manual-downstream-result-next-gate-selection-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reviewed-manual-downstream-result-next-gate-selection-validation"
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

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sameJson(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["next_gate_selected_for_manual_preparation", "selected", "ready_for_manual_next_gate"].includes(decision)) {
    return "next_gate_selected_for_manual_preparation";
  }
  if (["needs_more_result_evidence", "needs_more_evidence", "blocked_needs_more_evidence"].includes(decision)) {
    return "needs_more_result_evidence";
  }
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_logic_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (
    [
      "execute_now",
      "accepted",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "claim_complete",
      "invoke_model",
      "fetch_rag",
      "run_next_gate"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotExecuteNextGateTool: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    downstreamToolInvoked: false,
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

const selectorInput = readJsonInput(argValue("--selector", argValue("--builder", "")), "--selector");
const receiptInput = readJsonInput(argValue("--receipt", argValue("--teacher-receipt", "")), "--receipt");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue(
      "--out-dir",
      join(process.cwd(), ".transparent-apprentice", "tlcl-reviewed-manual-downstream-result-next-gate-selection-validations")
    )
  )
);
mkdirSync(outputRoot, { recursive: true });

const selector = selectorInput.value;
const receipt = receiptInput.value;
const reviewedResult = selector?.reviewedDownstreamResult || null;
const decision = normalizeDecision(receipt?.teacherDecision);
const selectedNextGate = String(receipt?.selectedNextGate || "").trim();
const forbiddenDecisions = new Set([
  "execute_now",
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete",
  "invoke_model",
  "fetch_rag",
  "run_next_gate"
]);
const allowedDecisions = new Set([
  "next_gate_selected_for_manual_preparation",
  "needs_more_result_evidence",
  "correction_to_high_reasoning_repair",
  "needs_teacher_review"
]);
const candidateMap = new Map((selector?.candidateNextGates || []).map((item) => [item.gate, item]));
const selectedCandidate = candidateMap.get(selectedNextGate) || null;
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!selector) block("selector_missing", "A reviewed manual downstream result next-gate selector is required.");
if (!receipt) block("receipt_missing", "A next-gate selection receipt is required.");
if (
  selector &&
  ![
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selector_v1",
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selector_result_v1"
  ].includes(selector.format)
) {
  block("selector_format_invalid", "Selector must be a TLCL reviewed manual downstream result next-gate selector packet or result.");
}
if (receipt && receipt.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_receipt_v1") {
  block("receipt_format_invalid", "Receipt must be transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_receipt_v1.");
}
if (selector?.ok !== true) block("selector_not_ok", "Selector must have ok=true.");
if (selector && selector.status !== "reviewed_manual_downstream_result_next_gate_selector_waiting_for_teacher_choice") {
  block("selector_status_not_ready", "Selector status is not waiting for teacher choice.");
}
if (!reviewedResult) block("reviewed_downstream_result_missing", "Selector must contain reviewedDownstreamResult.");
if (reviewedResult?.executeNow !== false) block("reviewed_result_execute_lock_missing", "reviewedDownstreamResult must keep executeNow=false.");
if (reviewedResult?.reviewOnly !== true) block("reviewed_result_review_only_missing", "reviewedDownstreamResult must keep reviewOnly=true.");
if (selector?.locks?.selectorDoesNotExecuteNextGateTool !== true) {
  block("source_selector_lock_missing", "Source selector must prove it did not execute a next-gate tool.");
}
if (receipt?.sourceSelectorId !== selector?.selectorId) block("source_selector_id_mismatch", "Receipt sourceSelectorId must match selector.selectorId.");
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt?.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt?.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt?.reviewedRoute !== reviewedResult?.route) block("reviewed_route_mismatch", "Receipt reviewedRoute must match reviewedDownstreamResult.route.");
if (receipt?.reviewedNextTool !== reviewedResult?.nextTool) {
  block("reviewed_next_tool_mismatch", "Receipt reviewedNextTool must match reviewedDownstreamResult.nextTool.");
}
if (!sameJson(receipt?.reviewedArgs || {}, reviewedResult?.args || {})) {
  block("reviewed_args_mismatch", "Receipt reviewedArgs must match reviewedDownstreamResult.args.");
}
if (receipt?.reviewedCommandTemplate !== reviewedResult?.commandTemplate) {
  block("reviewed_command_template_mismatch", "Receipt reviewedCommandTemplate must match reviewedDownstreamResult.commandTemplate.");
}
if (receipt?.confirmedRollbackPoint !== reviewedResult?.confirmedRollbackPoint) {
  block("rollback_point_mismatch", "Receipt confirmedRollbackPoint must match reviewedDownstreamResult.confirmedRollbackPoint.");
}
if (!sameJson(receipt?.resultEvidencePaths || [], reviewedResult?.resultEvidencePaths || [])) {
  block("result_evidence_paths_mismatch", "Receipt resultEvidencePaths must match reviewedDownstreamResult.resultEvidencePaths.");
}
if (receipt?.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");

if (decision === "next_gate_selected_for_manual_preparation") {
  if (!selectedCandidate) block("selected_next_gate_not_candidate", "selectedNextGate must be one of selector.candidateNextGates.");
  if (receipt?.selectedGateReviewed !== true) block("selected_gate_not_reviewed", "Teacher must review the selected next gate.");
  if (receipt?.resultEvidenceStillValid !== true) block("result_evidence_not_confirmed_valid", "Teacher must confirm the reviewed result evidence still applies.");
  if (receipt?.teacherConfirmedNoExecution !== true) block("teacher_no_execution_not_confirmed", "Teacher must confirm this validation does not execute the next gate.");
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt?.teacherNotes || "").trim()) {
  block("high_reasoning_repair_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}
if (decision === "needs_more_result_evidence" && !String(receipt?.teacherNotes || "").trim()) {
  block("more_evidence_note_missing", "Needs-more-evidence decision requires teacherNotes.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForManualPreparation =
  decision === "next_gate_selected_for_manual_preparation" && selectedCandidate && blockerRows.length === 0;
const correctionToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const needsMoreResultEvidence = decision === "needs_more_result_evidence" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_reviewed_manual_downstream_result_next_gate_decision"
  : readyForManualPreparation
    ? "reviewed_manual_downstream_result_next_gate_selected_waiting_for_manual_preparation"
    : correctionToHighReasoningRepair
      ? "correction_to_high_reasoning_repair_required"
      : needsMoreResultEvidence
        ? "needs_more_result_evidence_before_next_gate_selection"
        : "needs_teacher_review_before_next_gate_selection";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(selectedNextGate || decision)}`;
const validationDir = join(outputRoot, validationId);
const validationPath = join(validationDir, "tlcl-reviewed-manual-downstream-result-next-gate-selection-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-reviewed-manual-downstream-result-next-gate-selection-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REVIEWED_MANUAL_DOWNSTREAM_RESULT_NEXT_GATE_SELECTION_VALIDATION_START_HERE.md");
const validationLocks = locks();

const manualNextGateHandoff = readyForManualPreparation
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_manual_next_gate_handoff_v1",
      selectedNextGate,
      selectedGateLabel: selectedCandidate.label,
      targetRole: selectedCandidate.targetRole,
      nextToolHint: selectedCandidate.nextToolHint,
      route: reviewedResult.route || "",
      sourceNextTool: reviewedResult.nextTool || "",
      args: reviewedResult.args || {},
      commandTemplate: reviewedResult.commandTemplate || "",
      observedResultStatus: reviewedResult.observedResultStatus || "",
      resultEvidencePaths: reviewedResult.resultEvidencePaths || [],
      confirmedRollbackPoint: reviewedResult.confirmedRollbackPoint || "",
      instruction:
        "Prepare this next TLCL gate manually in a separate step. Do not execute it from the selector validation result.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt?.teacherNotes || ""
    }
  : null;

const resultValidation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  selectedNextGate,
  readyForManualPreparation,
  correctionToHighReasoningRepair,
  needsMoreResultEvidence,
  forbiddenDecisionUsed,
  blockers: blockerRows,
  sourceEvidence: {
    selectorPath: selectorInput.path,
    receiptPath: receiptInput.path,
    sourceSelectorId: selector?.selectorId || "",
    sourceValidationId: selector?.sourceValidationId || ""
  },
  manualNextGateHandoff,
  highReasoningRepairHandoff:
    correctionToHighReasoningRepair && !forbiddenDecisionUsed
      ? {
          route: "high_reasoning_logic_contract_repair_after_reviewed_manual_downstream_result",
          selectedNextGate: "correction_to_high_reasoning_repair",
          sourceSelectorId: selector?.selectorId || "",
          resultEvidencePaths: reviewedResult?.resultEvidencePaths || [],
          confirmedRollbackPoint: reviewedResult?.confirmedRollbackPoint || "",
          teacherNotes: receipt?.teacherNotes || "",
          instruction:
            "Return to the high-reasoning compile layer because the reviewed manual downstream result revealed a logic, evidence, or route problem.",
          executeNow: false,
          reviewOnly: true
        }
      : null,
  blockedActions: [
    "execute_next_gate_tool_from_reviewed_manual_downstream_result_next_gate_validation",
    "auto_run_command_from_reviewed_manual_downstream_result_next_gate_validation",
    "invoke_model_from_reviewed_manual_downstream_result_next_gate_validation",
    "fetch_rag_from_reviewed_manual_downstream_result_next_gate_validation",
    "write_memory_from_reviewed_manual_downstream_result_next_gate_validation",
    "enable_rule_from_reviewed_manual_downstream_result_next_gate_validation",
    "unlock_packaging_from_reviewed_manual_downstream_result_next_gate_validation",
    "claim_completion_from_reviewed_manual_downstream_result_next_gate_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receipt: receiptRecordPath,
    readme: readmePath,
    sourceSelector: selectorInput.path,
    sourceReceipt: receiptInput.path
  }
};
const validationReceipt = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_validation_receipt_v1",
  validationId,
  status,
  decision,
  selectedNextGate,
  readyForManualPreparation,
  correctionToHighReasoningRepair,
  needsMoreResultEvidence,
  forbiddenDecisionUsed,
  blockers: blockerRows,
  nextGateToolInvoked: false,
  targetSoftwareCommandsExecuted: false,
  modelInvoked: false,
  ragFetched: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: validationLocks
};

writeJson(validationPath, resultValidation);
writeJson(receiptRecordPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reviewed Manual Downstream Result Next Gate Selection Validation",
    "",
    `- Status: ${status}`,
    `- Decision: ${decision}`,
    `- Selected next gate: ${selectedNextGate || "<none>"}`,
    `- Ready for manual preparation: ${Boolean(readyForManualPreparation)}`,
    "",
    "This validation only checks a teacher-selected next TLCL gate. It does not run the next gate, auto-run commands, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockerRows.length ? blockerRows.map((row) => `- ${row.code}: ${row.message}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: !forbiddenDecisionUsed,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_validation_result_v1",
      validationId,
      status,
      decision,
      selectedNextGate,
      readyForManualPreparation: Boolean(readyForManualPreparation),
      correctionToHighReasoningRepair,
      needsMoreResultEvidence,
      forbiddenDecisionUsed,
      blockers: blockerRows,
      validationPath,
      receiptPath: receiptRecordPath,
      readmePath,
      manualNextGateHandoff,
      highReasoningRepairHandoff: resultValidation.highReasoningRepairHandoff,
      locks: validationLocks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
