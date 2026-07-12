#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-manual-next-gate-result-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-manual-next-gate-result-receipt-validation"
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
  if (["manual_next_gate_result_reviewed_ready_for_follow_up", "ready_for_follow_up"].includes(decision)) {
    return "manual_next_gate_result_reviewed_ready_for_follow_up";
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
      "run_next_gate",
      "accepted",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "claim_complete",
      "invoke_model",
      "fetch_rag"
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
const receiptInput = readJsonInput(argValue("--receipt", argValue("--teacher-receipt", "")), "--receipt");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-manual-next-gate-result-receipt-validations"))
  )
);
mkdirSync(outputRoot, { recursive: true });

const validation = validationInput.value;
const receipt = receiptInput.value;
const preparation = validation?.manualNextGatePreparation || null;
const decision = normalizeDecision(receipt?.teacherDecision);
const forbiddenDecisions = new Set([
  "execute_now",
  "run_next_gate",
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete",
  "invoke_model",
  "fetch_rag"
]);
const allowedDecisions = new Set([
  "manual_next_gate_result_reviewed_ready_for_follow_up",
  "needs_more_result_evidence",
  "correction_to_high_reasoning_repair",
  "needs_teacher_review"
]);
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!validation) block("validation_missing", "A manual next-gate preparation validation is required.");
if (!receipt) block("receipt_missing", "A manual next-gate result receipt is required.");
if (
  validation &&
  ![
    "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_v1",
    "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_result_v1"
  ].includes(validation.format)
) {
  block("validation_format_invalid", "Validation must be a TLCL manual next-gate preparation validation packet or result.");
}
if (receipt && receipt.format !== "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_v1") {
  block("receipt_format_invalid", "Receipt must be transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_v1.");
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
if (receipt?.sourcePreparationValidationId !== validation?.validationId) {
  block("source_preparation_validation_id_mismatch", "Receipt sourcePreparationValidationId must match validation.validationId.");
}
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt?.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt?.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt?.selectedNextGate !== preparation?.selectedNextGate) {
  block("selected_next_gate_mismatch", "Receipt selectedNextGate must match manualNextGatePreparation.selectedNextGate.");
}
if (receipt?.reviewedNextTool !== preparation?.nextTool) {
  block("reviewed_next_tool_mismatch", "Receipt reviewedNextTool must match manualNextGatePreparation.nextTool.");
}
if (receipt?.reviewedCommandTemplate !== preparation?.commandTemplate) {
  block("reviewed_command_template_mismatch", "Receipt reviewedCommandTemplate must match manualNextGatePreparation.commandTemplate.");
}
if (!sameJson(receipt?.reviewedRequiredInputs || [], preparation?.requiredInputs || [])) {
  block("reviewed_required_inputs_mismatch", "Receipt reviewedRequiredInputs must match manualNextGatePreparation.requiredInputs.");
}
if (receipt?.reviewedExpectedOutputFormat !== preparation?.expectedOutputFormat) {
  block("reviewed_expected_output_format_mismatch", "Receipt reviewedExpectedOutputFormat must match manualNextGatePreparation.expectedOutputFormat.");
}
if (receipt?.reviewedRoleBoundary !== preparation?.roleBoundary) {
  block("reviewed_role_boundary_mismatch", "Receipt reviewedRoleBoundary must match manualNextGatePreparation.roleBoundary.");
}
if (!sameJson(receipt?.upstreamResultEvidencePaths || [], preparation?.resultEvidencePaths || [])) {
  block("upstream_result_evidence_paths_mismatch", "Receipt upstreamResultEvidencePaths must match manualNextGatePreparation.resultEvidencePaths.");
}
if (receipt?.confirmedRollbackPoint !== preparation?.confirmedRollbackPoint) {
  block("rollback_point_mismatch", "Receipt confirmedRollbackPoint must match manualNextGatePreparation.confirmedRollbackPoint.");
}
if (receipt?.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");

const nextGateResultEvidencePaths = Array.isArray(receipt?.nextGateResultEvidencePaths)
  ? receipt.nextGateResultEvidencePaths.map((item) => String(item || "").trim()).filter(Boolean)
  : [];
const observedStatus = String(receipt?.observedNextGateResultStatus || "").trim();
const observedStatusAllowed = new Set(["completed_reviewed", "completed_with_warnings", "blocked_needs_more_evidence"]);

if (decision === "manual_next_gate_result_reviewed_ready_for_follow_up") {
  if (receipt?.manualNextGateUseWasSeparate !== true) {
    block("manual_next_gate_step_not_confirmed_separate", "Teacher must confirm the next-gate step was separate.");
  }
  if (receipt?.nextGateResultEvidenceReviewed !== true) {
    block("next_gate_result_evidence_not_reviewed", "Teacher must review next-gate result evidence.");
  }
  if (!observedStatusAllowed.has(observedStatus)) {
    block("observed_next_gate_result_status_not_allowed", "Observed next-gate result status must be completed_reviewed, completed_with_warnings, or blocked_needs_more_evidence.");
  }
  if (nextGateResultEvidencePaths.length === 0) {
    block("next_gate_result_evidence_missing", "At least one next-gate result evidence path or summary is required.");
  }
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt?.teacherNotes || "").trim()) {
  block("high_reasoning_repair_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}
if (decision === "needs_more_result_evidence" && !String(receipt?.teacherNotes || "").trim()) {
  block("more_evidence_note_missing", "Needs-more-evidence decision requires teacherNotes.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForFollowUp = decision === "manual_next_gate_result_reviewed_ready_for_follow_up" && blockerRows.length === 0;
const correctionToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const needsMoreResultEvidence = decision === "needs_more_result_evidence" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_manual_next_gate_result_decision"
  : readyForFollowUp
    ? "manual_next_gate_result_reviewed_waiting_for_tlcl_follow_up"
    : correctionToHighReasoningRepair
      ? "correction_to_high_reasoning_repair_required"
      : needsMoreResultEvidence
        ? "needs_more_result_evidence_before_tlcl_follow_up"
        : "needs_teacher_review_or_more_manual_next_gate_result_evidence";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(preparation?.selectedNextGate || decision)}`;
const validationDir = join(outputRoot, validationId);
const resultValidationPath = join(validationDir, "tlcl-manual-next-gate-result-receipt-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-manual-next-gate-result-receipt-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_MANUAL_NEXT_GATE_RESULT_RECEIPT_VALIDATION_START_HERE.md");
const validationLocks = locks();

const reviewedManualNextGateResult = readyForFollowUp
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_v1",
      sourcePreparationValidationId: validation?.validationId || "",
      selectedNextGate: preparation.selectedNextGate || "",
      nextTool: preparation.nextTool || "",
      commandTemplate: preparation.commandTemplate || "",
      requiredInputs: preparation.requiredInputs || [],
      expectedOutputFormat: preparation.expectedOutputFormat || "",
      roleBoundary: preparation.roleBoundary || "",
      upstreamResultEvidencePaths: preparation.resultEvidencePaths || [],
      observedNextGateResultStatus: observedStatus,
      observedOutputFormat: receipt?.observedOutputFormat || "",
      nextGateResultEvidencePaths,
      confirmedRollbackPoint: preparation.confirmedRollbackPoint || "",
      followUpBoundary:
        "teacher_reviews_next_gate_result_then_selects_follow_up_or_returns_to_high_reasoning_repair",
      executeNow: false,
      reviewOnly: true
    }
  : null;

const resultValidation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForFollowUp,
  correctionToHighReasoningRepair,
  needsMoreResultEvidence,
  forbiddenDecisionUsed,
  blockers: blockerRows,
  sourceEvidence: {
    preparationValidationPath: validationInput.path,
    receiptPath: receiptInput.path,
    sourcePreparationValidationId: validation?.validationId || ""
  },
  reviewedManualNextGateResult,
  highReasoningRepairHandoff:
    correctionToHighReasoningRepair && !forbiddenDecisionUsed
      ? {
          route: "high_reasoning_logic_contract_repair_after_manual_next_gate_result",
          sourcePreparationValidationId: validation?.validationId || "",
          selectedNextGate: preparation?.selectedNextGate || "",
          teacherNotes: receipt?.teacherNotes || "",
          resultEvidencePaths: nextGateResultEvidencePaths,
          confirmedRollbackPoint: preparation?.confirmedRollbackPoint || "",
          executeNow: false,
          reviewOnly: true,
          instruction:
            "Return to the high-reasoning compile layer because the manual next-gate result revealed a logic, evidence, or route problem."
        }
      : null,
  blockedActions: [
    "execute_next_gate_tool_from_manual_next_gate_result_validation",
    "auto_run_command_from_manual_next_gate_result_validation",
    "invoke_model_from_manual_next_gate_result_validation",
    "fetch_rag_from_manual_next_gate_result_validation",
    "write_memory_from_manual_next_gate_result_validation",
    "enable_rule_from_manual_next_gate_result_validation",
    "unlock_packaging_from_manual_next_gate_result_validation",
    "claim_completion_from_manual_next_gate_result_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: resultValidationPath,
    receipt: receiptRecordPath,
    readme: readmePath,
    sourceValidation: validationInput.path,
    sourceReceipt: receiptInput.path
  }
};
const validationReceipt = {
  format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForFollowUp,
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

writeJson(resultValidationPath, resultValidation);
writeJson(receiptRecordPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Manual Next-Gate Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Decision: ${decision}`,
    `- Ready for TLCL follow-up: ${readyForFollowUp}`,
    "",
    "This validation only checks teacher-reviewed result evidence from a separate manual next-gate step. It does not run the next-gate tool, auto-run commands, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForFollowUp,
      correctionToHighReasoningRepair,
      needsMoreResultEvidence,
      forbiddenDecisionUsed,
      blockers: blockerRows,
      validationPath: resultValidationPath,
      receiptPath: receiptRecordPath,
      readmePath,
      reviewedManualNextGateResult,
      highReasoningRepairHandoff: resultValidation.highReasoningRepairHandoff,
      locks: validationLocks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
