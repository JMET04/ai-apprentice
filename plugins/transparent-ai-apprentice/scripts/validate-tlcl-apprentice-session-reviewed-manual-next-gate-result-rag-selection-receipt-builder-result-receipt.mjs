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
    String(value || "tlcl-rag-selection-receipt-builder-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-selection-receipt-builder-result-validation"
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
    validatorDoesNotRunSelectionReceiptValidation: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotSelectFollowUpLane: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    selectionReceiptValidationRun: false,
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
  argValue("--selection-receipt-builder-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-selection-receipt-builder-result-receipt-validation"))
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "selection_receipt_builder_result_reviewed_ready_for_selection_receipt_validation",
  "needs_more_selection_receipt_builder_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_selection_receipt_validation",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG selection receipt builder result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_selection_receipt_builder_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunSelectionReceiptValidation !== true) {
  block("builder_selection_receipt_validation_lock_missing", "Builder must keep selection receipt validation execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceSelectionReceiptBuilderResultReceiptBuilderId !== builder.selectionReceiptBuilderResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRagSelectionReceiptBuilderPath !== builder.sourceRagSelectionReceiptBuilderPath) {
  block("source_selection_receipt_builder_path_mismatch", "Receipt source RAG selection receipt builder path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.sourceRagFollowUpQueuePath !== builder.sourceRagSelectionReceiptBuilder?.queuePath) {
  block("source_follow_up_queue_path_mismatch", "Receipt source follow-up queue path must match builder.");
}
if (receipt.ragFollowUpQueueHash !== builder.sourceRagSelectionReceiptBuilder?.queueHash) {
  block("follow_up_queue_hash_mismatch", "Receipt follow-up queue hash must match builder.");
}
if (receipt.receiptTemplatePath !== builder.sourceRagSelectionReceiptBuilder?.receiptTemplatePath) {
  block("receipt_template_path_mismatch", "Receipt template path must match builder.");
}
if (receipt.validationCommand !== builder.sourceRagSelectionReceiptBuilder?.validationCommand) {
  block("validation_command_mismatch", "Receipt validation command must match builder.");
}
if (receipt.rollbackPoint !== builder.sourceRagSelectionReceiptBuilder?.rollbackPoint) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match builder.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
try {
  const selectionBuilder = readJson(receipt.sourceRagSelectionReceiptBuilderPath);
  const queue = readJson(receipt.sourceRagFollowUpQueuePath);
  sourceStillValid =
    selectionBuilder.format === "transparent_ai_rag_follow_up_queue_selection_receipt_builder_v1" &&
    selectionBuilder.queuePath === receipt.sourceRagFollowUpQueuePath &&
    selectionBuilder.queueHash === receipt.ragFollowUpQueueHash &&
    selectionBuilder.receiptTemplatePath === receipt.receiptTemplatePath &&
    selectionBuilder.validationCommand === receipt.validationCommand &&
    existsSync(selectionBuilder.receiptTemplatePath) &&
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
    selectionBuilder.locks?.reviewOnly === true &&
    selectionBuilder.locks?.evidenceOnly === true &&
    selectionBuilder.locks?.accepted === false &&
    selectionBuilder.locks?.ruleEnabled === false &&
    selectionBuilder.locks?.memoryEnabled === false &&
    selectionBuilder.locks?.softwareActionsExecuted === false &&
    selectionBuilder.locks?.externalFetchPerformed === false &&
    selectionBuilder.locks?.packagingUnlocked === false &&
    selectionBuilder.locks?.deliveryGateOpen === false;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("selection_receipt_builder_source_not_still_valid", "The referenced selection receipt builder or source queue is missing, changed, or unlocked.");
}

if (decision === "selection_receipt_builder_result_reviewed_ready_for_selection_receipt_validation") {
  if (receipt.selectionReceiptBuilderResultReviewed !== true) block("selection_receipt_builder_result_review_required", "Teacher must review the selection receipt builder result.");
  if (receipt.receiptTemplateReviewed !== true) block("receipt_template_review_required", "Teacher must review the receipt template.");
  if (receipt.selectionReceiptValidationCommandReviewed !== true) {
    block("selection_receipt_validation_command_review_required", "Teacher must review the selection receipt validation command boundary.");
  }
  if (receipt.teacherConfirmedNoSelectionReceiptValidationRun !== true) {
    block("teacher_no_selection_receipt_validation_confirmation_required", "Teacher must confirm no selection receipt validation was run here.");
  }
  if (receipt.teacherConfirmedNoFollowUpLaneSelected !== true) {
    block("teacher_no_follow_up_lane_selected_confirmation_required", "Teacher must confirm no follow-up lane was selected here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if ((decision === "needs_more_selection_receipt_builder_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "selection_receipt_builder_result_reviewed_ready_for_selection_receipt_validation" &&
  sourceStillValid &&
  receipt.selectionReceiptBuilderResultReviewed === true &&
  receipt.receiptTemplateReviewed === true &&
  receipt.selectionReceiptValidationCommandReviewed === true &&
  receipt.teacherConfirmedNoSelectionReceiptValidationRun === true &&
  receipt.teacherConfirmedNoFollowUpLaneSelected === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_selection_receipt_builder_result_decision"
  : ready
    ? "tlcl_rag_selection_receipt_builder_ready_for_selection_receipt_validation"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_selection_receipt_builder_evidence" && blockers.length === 0
        ? "needs_more_selection_receipt_builder_evidence_before_selection_receipt_validation"
        : "needs_teacher_review_before_selection_receipt_validation";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualSelectionReceiptValidationHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_selection_receipt_validation_handoff_v1",
      sourceRagSelectionReceiptBuilderId: builder.sourceRagSelectionReceiptBuilder?.builderId || "",
      sourceRagSelectionReceiptBuilderPath: builder.sourceRagSelectionReceiptBuilderPath || "",
      sourceRagFollowUpQueuePath: receipt.sourceRagFollowUpQueuePath || "",
      ragFollowUpQueueHash: receipt.ragFollowUpQueueHash || "",
      receiptTemplatePath: receipt.receiptTemplatePath || "",
      rollbackPoint: receipt.rollbackPoint || "",
      nextTool: "knowledge/validate-rag-follow-up-queue-selection-receipt.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\validate-rag-follow-up-queue-selection-receipt.mjs --follow-up-queue "${receipt.sourceRagFollowUpQueuePath}" --receipt "<teacher-filled-selection-receipt.json>"`,
      instruction:
        "Validate only a teacher-filled RAG follow-up queue selection receipt as a separate manual step. Do not select a lane here, run planning, execute commands, enable rules, write memory, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_selection_receipt_builder_result",
        sourceSelectionReceiptBuilderResultReceiptBuilderId: builder.selectionReceiptBuilderResultReceiptBuilderId || "",
        sourceRagSelectionReceiptBuilderPath: builder.sourceRagSelectionReceiptBuilderPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the selection receipt builder did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForSelectionReceiptValidation: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreSelectionReceiptBuilderEvidence: status === "needs_more_selection_receipt_builder_evidence_before_selection_receipt_validation",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagSelectionReceiptBuilderPath: receipt.sourceRagSelectionReceiptBuilderPath || "",
    sourceRagFollowUpQueuePath: receipt.sourceRagFollowUpQueuePath || ""
  },
  manualSelectionReceiptValidationHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_selection_receipt_validation_from_builder_confirmation",
    "select_follow_up_lane_from_builder_confirmation",
    "auto_run_selection_receipt_validation_command",
    "invoke_model_from_builder_confirmation",
    "fetch_rag_from_builder_confirmation",
    "write_memory_from_builder_confirmation",
    "enable_rule_from_builder_confirmation",
    "unlock_packaging_from_builder_confirmation",
    "claim_completion_from_builder_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-selection-receipt-builder-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-selection-receipt-builder-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_SELECTION_RECEIPT_BUILDER_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Selection Receipt Builder Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the RAG selection receipt validator. It only prepares a manual validation handoff after the builder result is reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForSelectionReceiptValidation: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreSelectionReceiptBuilderEvidence: validation.needsMoreSelectionReceiptBuilderEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualSelectionReceiptValidationHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
