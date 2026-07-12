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
    String(value || "tlcl-rag-follow-up-queue-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-follow-up-queue-result-validation"
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
    validatorDoesNotRunSelectionReceiptBuilder: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotSelectFollowUpLane: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    selectionReceiptBuilderRun: false,
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
  argValue("--follow-up-queue-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-follow-up-queue-result-receipt-validation"))
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "follow_up_queue_result_reviewed_ready_for_selection_receipt_builder",
  "needs_more_follow_up_queue_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_selection_receipt_builder",
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

if (builder.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_builder_v1") {
  block("builder_format_invalid", "Builder must be the TLCL RAG follow-up queue result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_follow_up_queue_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunSelectionReceiptBuilder !== true) {
  block("builder_selection_receipt_builder_lock_missing", "Builder must keep selection receipt builder execution locked.");
}
if (receipt.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_v1") {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceFollowUpQueueResultReceiptBuilderId !== builder.followUpQueueResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRagFollowUpQueuePath !== builder.sourceRagFollowUpQueuePath) {
  block("source_follow_up_queue_path_mismatch", "Receipt source follow-up queue path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.ragFollowUpQueueHash !== builder.sourceRagFollowUpQueue?.queueHash) {
  block("follow_up_queue_hash_mismatch", "Receipt follow-up queue hash must match builder.");
}
if (receipt.sourceRagAuditReviewValidationPath !== builder.sourceRagFollowUpQueue?.validationPath) {
  block("source_audit_review_validation_path_mismatch", "Receipt source audit review validation path must match builder.");
}
if (receipt.auditTrailPath !== builder.sourceRagFollowUpQueue?.auditTrailPath) {
  block("audit_trail_path_mismatch", "Receipt auditTrailPath must match builder.");
}
if (receipt.rollbackPoint !== builder.sourceRagFollowUpQueue?.rollbackPoint) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match the follow-up queue.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
try {
  const queue = readJson(receipt.sourceRagFollowUpQueuePath);
  const auditReviewValidation = readJson(receipt.sourceRagAuditReviewValidationPath);
  sourceStillValid =
    queue.format === "transparent_ai_rag_audit_review_follow_up_queue_v1" &&
    queue.status === "waiting_for_teacher_reviewed_follow_up_selection" &&
    queue.queueDecision === "manual_review_only_follow_up_queue_ready" &&
    hashKnowledge(queue) === receipt.ragFollowUpQueueHash &&
    queue.validationPath === receipt.sourceRagAuditReviewValidationPath &&
    queue.validationHash === receipt.ragAuditReviewValidationHash &&
    queue.auditTrailPath === receipt.auditTrailPath &&
    queue.rollbackPoint === receipt.rollbackPoint &&
    auditReviewValidation.format === "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1" &&
    hashKnowledge(auditReviewValidation) === receipt.ragAuditReviewValidationHash &&
    queue.locks?.reviewOnly === true &&
    queue.locks?.accepted === false &&
    queue.locks?.ruleEnabled === false &&
    queue.locks?.memoryEnabled === false &&
    queue.locks?.softwareActionsExecuted === false &&
    queue.locks?.externalFetchPerformed === false &&
    queue.locks?.packagingUnlocked === false &&
    queue.locks?.deliveryGateOpen === false &&
    queue.locks?.queueDoesNotRunCommands === true &&
    queue.locks?.queueDoesNotOpenFiles === true &&
    queue.locks?.queueDoesNotFetchSources === true &&
    queue.locks?.queueDoesNotClaimCompletion === true;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("follow_up_queue_source_not_still_valid", "The referenced follow-up queue or audit review validation is missing, changed, or unlocked.");
}

if (decision === "follow_up_queue_result_reviewed_ready_for_selection_receipt_builder") {
  if (receipt.followUpQueueResultReviewed !== true) block("follow_up_queue_result_review_required", "Teacher must review the follow-up queue result.");
  if (receipt.queueItemsReviewed !== true) block("queue_items_review_required", "Teacher must review the queue items.");
  if (receipt.selectionReceiptBuilderCommandReviewed !== true) {
    block("selection_receipt_builder_command_review_required", "Teacher must review the selection receipt builder command boundary.");
  }
  if (receipt.teacherConfirmedNoSelectionReceiptBuilderRun !== true) {
    block("teacher_no_selection_receipt_builder_confirmation_required", "Teacher must confirm no selection receipt builder was run here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if ((decision === "needs_more_follow_up_queue_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "follow_up_queue_result_reviewed_ready_for_selection_receipt_builder" &&
  sourceStillValid &&
  receipt.followUpQueueResultReviewed === true &&
  receipt.queueItemsReviewed === true &&
  receipt.selectionReceiptBuilderCommandReviewed === true &&
  receipt.teacherConfirmedNoSelectionReceiptBuilderRun === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_follow_up_queue_result_decision"
  : ready
    ? "tlcl_rag_follow_up_queue_ready_for_selection_receipt_builder"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_follow_up_queue_evidence" && blockers.length === 0
        ? "needs_more_follow_up_queue_evidence_before_selection_receipt_builder"
        : "needs_teacher_review_before_selection_receipt_builder";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualSelectionReceiptBuilderHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_selection_receipt_builder_handoff_v1",
      sourceRagFollowUpQueueId: builder.sourceRagFollowUpQueue?.queueId || "",
      sourceRagFollowUpQueuePath: builder.sourceRagFollowUpQueuePath || "",
      ragFollowUpQueueHash: receipt.ragFollowUpQueueHash,
      sourceRagAuditReviewValidationPath: receipt.sourceRagAuditReviewValidationPath,
      auditTrailPath: receipt.auditTrailPath,
      rollbackPoint: receipt.rollbackPoint,
      nextTool: "knowledge/create-rag-follow-up-queue-selection-receipt-builder.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-follow-up-queue-selection-receipt-builder.mjs --follow-up-queue "${builder.sourceRagFollowUpQueuePath}"`,
      instruction:
        "Prepare only a separate review-only follow-up queue selection receipt builder. Do not select a lane, execute commands, enable rules, write memory, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_follow_up_queue_result",
        sourceFollowUpQueueResultReceiptBuilderId: builder.followUpQueueResultReceiptBuilderId || "",
        sourceRagFollowUpQueuePath: builder.sourceRagFollowUpQueuePath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the follow-up queue did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForSelectionReceiptBuilder: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreFollowUpQueueEvidence: status === "needs_more_follow_up_queue_evidence_before_selection_receipt_builder",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagFollowUpQueuePath: receipt.sourceRagFollowUpQueuePath || ""
  },
  manualSelectionReceiptBuilderHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_selection_receipt_builder_from_follow_up_queue_confirmation",
    "select_follow_up_lane_from_follow_up_queue_confirmation",
    "auto_run_selection_receipt_builder_command",
    "invoke_model_from_follow_up_queue_confirmation",
    "fetch_rag_from_follow_up_queue_confirmation",
    "write_memory_from_follow_up_queue_confirmation",
    "enable_rule_from_follow_up_queue_confirmation",
    "unlock_packaging_from_follow_up_queue_confirmation",
    "claim_completion_from_follow_up_queue_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-follow-up-queue-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-follow-up-queue-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_FOLLOW_UP_QUEUE_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Follow-Up Queue Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the selection receipt builder. It only prepares a manual builder handoff after the follow-up queue result is reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForSelectionReceiptBuilder: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreFollowUpQueueEvidence: validation.needsMoreFollowUpQueueEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualSelectionReceiptBuilderHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
