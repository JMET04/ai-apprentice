#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-rag-selection-receipt-validation-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-selection-receipt-validation-result-validation"
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashKnowledge(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function validationLocks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotRunSelectedFollowUpPlanningPacket: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotSelectFollowUpLane: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    selectedFollowUpPlanningPacketRun: false,
    commandAutoRun: false,
    followUpLaneSelected: false,
    softwareExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

const builderInput =
  argValue("--builder") ||
  argValue("--selection-receipt-validation-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-selection-receipt-validation-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "selection_receipt_validation_result_reviewed_ready_for_selected_follow_up_planning",
  "needs_more_selection_receipt_validation_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_selected_follow_up_planning_packet",
  "select_follow_up_lane",
  "execute_now",
  "accepted",
  "enable_rule",
  "write_memory",
  "fetch_rag",
  "invoke_model",
  "unlock_packaging",
  "claim_complete"
]);

if (
  builder.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG selection receipt validation result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_selection_receipt_validation_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunSelectedFollowUpPlanningPacket !== true) {
  block("builder_selected_follow_up_planning_lock_missing", "Builder must keep selected follow-up planning packet execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceSelectionReceiptValidationResultReceiptBuilderId !== builder.selectionReceiptValidationResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRagSelectionReceiptValidationPath !== builder.sourceRagSelectionReceiptValidationPath) {
  block("source_selection_receipt_validation_path_mismatch", "Receipt source RAG selection receipt validation path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.sourceRagFollowUpQueuePath !== builder.sourceRagSelectionReceiptValidation?.queuePath) {
  block("source_follow_up_queue_path_mismatch", "Receipt source follow-up queue path must match builder.");
}
if (receipt.ragFollowUpQueueHash !== builder.sourceRagSelectionReceiptValidation?.queueHash) {
  block("follow_up_queue_hash_mismatch", "Receipt follow-up queue hash must match builder.");
}
if (receipt.selectedFollowUpDecision !== builder.sourceRagSelectionReceiptValidation?.selectedFollowUpDecision) {
  block("selected_follow_up_decision_mismatch", "Receipt selected follow-up decision must match builder.");
}
if (JSON.stringify(receipt.selectedFollowUp || null) !== JSON.stringify(builder.sourceRagSelectionReceiptValidation?.selectedFollowUp || null)) {
  block("selected_follow_up_mismatch", "Receipt selectedFollowUp must match builder.");
}
if (receipt.rollbackPoint !== builder.sourceRagSelectionReceiptValidation?.rollbackPoint) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match builder.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
try {
  const selectionValidation = readJson(receipt.sourceRagSelectionReceiptValidationPath);
  const queue = readJson(receipt.sourceRagFollowUpQueuePath);
  sourceStillValid =
    selectionValidation.format === "transparent_ai_rag_follow_up_queue_selection_receipt_validation_v1" &&
    selectionValidation.status === "ready_for_selected_review_only_rag_follow_up" &&
    selectionValidation.queuePath === receipt.sourceRagFollowUpQueuePath &&
    selectionValidation.queueHash === receipt.ragFollowUpQueueHash &&
    JSON.stringify(selectionValidation.selectedFollowUp || null) === JSON.stringify(receipt.selectedFollowUp || null) &&
    selectionValidation.selectedFollowUp?.selectedFollowUpDecision === receipt.selectedFollowUpDecision &&
    hashKnowledge(queue) === receipt.ragFollowUpQueueHash &&
    queue.format === "transparent_ai_rag_audit_review_follow_up_queue_v1" &&
    queue.status === "waiting_for_teacher_reviewed_follow_up_selection" &&
    queue.queueDecision === "manual_review_only_follow_up_queue_ready" &&
    queue.locks?.reviewOnly === true &&
    queue.locks?.accepted === false &&
    queue.locks?.ruleEnabled === false &&
    queue.locks?.memoryEnabled === false &&
    queue.locks?.softwareActionsExecuted === false &&
    queue.locks?.externalFetchPerformed === false &&
    queue.locks?.packagingUnlocked === false &&
    queue.locks?.deliveryGateOpen === false &&
    queue.locks?.queueDoesNotRunCommands === true &&
    queue.locks?.queueDoesNotFetchSources === true &&
    queue.locks?.queueDoesNotClaimCompletion === true &&
    selectionValidation.locks?.reviewOnly === true &&
    selectionValidation.locks?.evidenceOnly === true &&
    selectionValidation.locks?.accepted === false &&
    selectionValidation.locks?.ruleEnabled === false &&
    selectionValidation.locks?.memoryEnabled === false &&
    selectionValidation.locks?.softwareActionsExecuted === false &&
    selectionValidation.locks?.externalFetchPerformed === false &&
    selectionValidation.locks?.packagingUnlocked === false &&
    selectionValidation.locks?.deliveryGateOpen === false &&
    selectionValidation.nextReview?.mayPrepareSelectedReviewOnlyFollowUp === true &&
    selectionValidation.nextReview?.mayFetchExternalSources === false &&
    selectionValidation.nextReview?.mayExecuteSoftware === false &&
    selectionValidation.nextReview?.mayUnlockPackaging === false &&
    selectionValidation.nextReview?.mayClaimGoalComplete === false;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("selection_receipt_validation_source_not_still_valid", "The referenced selection receipt validation or source queue is missing, changed, or unlocked.");
}

if (decision === "selection_receipt_validation_result_reviewed_ready_for_selected_follow_up_planning") {
  if (receipt.selectionReceiptValidationResultReviewed !== true) {
    block("selection_receipt_validation_result_review_required", "Teacher must review the selection receipt validation result.");
  }
  if (receipt.selectedFollowUpReviewed !== true) block("selected_follow_up_review_required", "Teacher must review the selected follow-up lane.");
  if (receipt.selectedFollowUpPlanningCommandReviewed !== true) {
    block("selected_follow_up_planning_command_review_required", "Teacher must review the selected follow-up planning command boundary.");
  }
  if (receipt.teacherConfirmedNoSelectedFollowUpPlanningRun !== true) {
    block("teacher_no_selected_follow_up_planning_run_confirmation_required", "Teacher must confirm no selected follow-up planning packet was run here.");
  }
  if (receipt.teacherConfirmedNoFollowUpLaneChanged !== true) {
    block("teacher_no_follow_up_lane_changed_confirmation_required", "Teacher must confirm the selected follow-up lane was not changed here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if (
  (decision === "needs_more_selection_receipt_validation_evidence" || decision === "correction_to_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "selection_receipt_validation_result_reviewed_ready_for_selected_follow_up_planning" &&
  sourceStillValid &&
  receipt.selectionReceiptValidationResultReviewed === true &&
  receipt.selectedFollowUpReviewed === true &&
  receipt.selectedFollowUpPlanningCommandReviewed === true &&
  receipt.teacherConfirmedNoSelectedFollowUpPlanningRun === true &&
  receipt.teacherConfirmedNoFollowUpLaneChanged === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_selection_receipt_validation_result_decision"
  : ready
    ? "tlcl_rag_selection_receipt_validation_ready_for_selected_follow_up_planning"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_selection_receipt_validation_evidence" && blockers.length === 0
        ? "needs_more_selection_receipt_validation_evidence_before_selected_follow_up_planning"
        : "needs_teacher_review_before_selected_follow_up_planning";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualSelectedFollowUpPlanningHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_selected_follow_up_planning_handoff_v1",
      sourceRagSelectionReceiptValidationId: builder.sourceRagSelectionReceiptValidation?.validationId || "",
      sourceRagSelectionReceiptValidationPath: builder.sourceRagSelectionReceiptValidationPath || "",
      sourceRagFollowUpQueuePath: receipt.sourceRagFollowUpQueuePath || "",
      ragFollowUpQueueHash: receipt.ragFollowUpQueueHash || "",
      selectedFollowUp: receipt.selectedFollowUp || null,
      selectedFollowUpDecision: receipt.selectedFollowUpDecision || "",
      rollbackPoint: receipt.rollbackPoint || "",
      nextTool: "knowledge/create-rag-selected-follow-up-planning-packet.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-selected-follow-up-planning-packet.mjs --selection-validation "${receipt.sourceRagSelectionReceiptValidationPath}" --rollback-point "${receipt.rollbackPoint}"`,
      instruction:
        "Prepare only the selected review-only RAG follow-up planning packet as a separate manual step. Do not execute software, fetch RAG, change the selected lane, enable rules, write memory, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_selection_receipt_validation_result",
        sourceSelectionReceiptValidationResultReceiptBuilderId: builder.selectionReceiptValidationResultReceiptBuilderId || "",
        sourceRagSelectionReceiptValidationPath: builder.sourceRagSelectionReceiptValidationPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the selection receipt validation result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForSelectedFollowUpPlanning: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreSelectionReceiptValidationEvidence:
    status === "needs_more_selection_receipt_validation_evidence_before_selected_follow_up_planning",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagSelectionReceiptValidationPath: receipt.sourceRagSelectionReceiptValidationPath || "",
    sourceRagFollowUpQueuePath: receipt.sourceRagFollowUpQueuePath || ""
  },
  manualSelectedFollowUpPlanningHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_selected_follow_up_planning_packet_from_selection_validation_confirmation",
    "change_selected_follow_up_lane_from_selection_validation_confirmation",
    "auto_run_selected_follow_up_planning_command",
    "invoke_model_from_selection_validation_confirmation",
    "fetch_rag_from_selection_validation_confirmation",
    "write_memory_from_selection_validation_confirmation",
    "enable_rule_from_selection_validation_confirmation",
    "unlock_packaging_from_selection_validation_confirmation",
    "claim_completion_from_selection_validation_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-selection-receipt-validation-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-selection-receipt-validation-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_SELECTION_RECEIPT_VALIDATION_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Selection Receipt Validation Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the selected follow-up planning packet. It only prepares a manual planning handoff after the selection receipt validation result is reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForSelectedFollowUpPlanning: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreSelectionReceiptValidationEvidence: validation.needsMoreSelectionReceiptValidationEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualSelectedFollowUpPlanningHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
