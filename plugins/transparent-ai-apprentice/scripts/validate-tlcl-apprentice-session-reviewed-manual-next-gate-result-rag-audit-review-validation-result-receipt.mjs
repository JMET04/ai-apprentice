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
    String(value || "tlcl-rag-audit-review-validation-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-audit-review-validation-result-validation"
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
    validatorDoesNotRunFollowUpQueue: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    followUpQueueCreated: false,
    commandAutoRun: false,
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
  argValue("--audit-review-validation-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-audit-review-validation-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "audit_review_validation_result_reviewed_ready_for_follow_up_queue",
  "needs_more_audit_review_validation_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_follow_up_queue",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG audit review validation-result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_audit_review_validation_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunFollowUpQueue !== true) {
  block("builder_follow_up_queue_lock_missing", "Builder must keep follow-up queue creation locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceAuditReviewValidationResultReceiptBuilderId !== builder.auditReviewValidationResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRagAuditReviewValidationPath !== builder.sourceRagAuditReviewValidationPath) {
  block("source_rag_audit_review_validation_path_mismatch", "Receipt source RAG audit review validation path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.auditTrailPath !== builder.sourceRagAuditReviewValidation?.auditTrailPath) {
  block("audit_trail_path_mismatch", "Receipt auditTrailPath must match builder.");
}
if (receipt.auditReviewReceiptPath !== builder.sourceRagAuditReviewValidation?.receiptPath) {
  block("audit_review_receipt_path_mismatch", "Receipt auditReviewReceiptPath must match builder.");
}
if (receipt.ragAuditReviewValidationHash !== builder.sourceRagAuditReviewValidation?.validationHash) {
  block("rag_validation_hash_mismatch", "Receipt validation hash must match builder.");
}
if (receipt.rollbackPoint !== builder.handoff?.rollbackPoint) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match the prior TLCL handoff.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
try {
  const ragValidation = readJson(receipt.sourceRagAuditReviewValidationPath);
  const auditTrail = readJson(receipt.auditTrailPath);
  const auditReceipt = readJson(receipt.auditReviewReceiptPath);
  sourceStillValid =
    ragValidation.format === "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1" &&
    ragValidation.status === "ready_for_review_only_follow_up_queue" &&
    ragValidation.auditTrailPath === receipt.auditTrailPath &&
    ragValidation.receiptPath === receipt.auditReviewReceiptPath &&
    ragValidation.auditHash === receipt.auditTrailHash &&
    hashKnowledge(ragValidation) === receipt.ragAuditReviewValidationHash &&
    auditTrail.format === "transparent_ai_rag_delivery_gate_audit_trail_v1" &&
    hashKnowledge(auditTrail) === receipt.auditTrailHash &&
    auditReceipt.format === "transparent_ai_rag_delivery_gate_audit_review_receipt_v1" &&
    ragValidation.nextReview?.mayPrepareReviewOnlyFollowUpQueue === true &&
    ragValidation.nextReview?.mayAcceptTechnology === false &&
    ragValidation.nextReview?.mayEnableRules === false &&
    ragValidation.nextReview?.mayWriteMemory === false &&
    ragValidation.nextReview?.mayExecuteSoftware === false &&
    ragValidation.nextReview?.mayFetchExternalSources === false &&
    ragValidation.nextReview?.mayOpenDeliveryGate === false &&
    ragValidation.nextReview?.mayUnlockPackaging === false &&
    ragValidation.nextReview?.mayClaimGoalComplete === false &&
    ragValidation.locks?.reviewOnly === true &&
    ragValidation.locks?.accepted === false &&
    ragValidation.locks?.ruleEnabled === false &&
    ragValidation.locks?.memoryEnabled === false &&
    ragValidation.locks?.softwareActionsExecuted === false &&
    ragValidation.locks?.externalFetchPerformed === false &&
    ragValidation.locks?.packagingUnlocked === false &&
    ragValidation.locks?.deliveryGateOpen === false;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block(
    "rag_audit_review_validation_source_not_still_valid",
    "The referenced audit review validation, teacher receipt, or audit trail is missing, changed, or unlocked."
  );
}

if (decision === "audit_review_validation_result_reviewed_ready_for_follow_up_queue") {
  if (receipt.validationResultReviewed !== true) block("validation_result_review_required", "Teacher must review the audit review validation result.");
  if (receipt.auditReviewReceiptReviewed !== true) block("audit_review_receipt_review_required", "Teacher must review the filled audit review receipt.");
  if (receipt.followUpQueueCommandReviewed !== true) block("follow_up_queue_command_review_required", "Teacher must review the follow-up queue command boundary.");
  if (receipt.teacherConfirmedNoFollowUpQueueCreated !== true) {
    block("teacher_no_follow_up_queue_confirmation_required", "Teacher must confirm no follow-up queue was created here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if ((decision === "needs_more_audit_review_validation_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "audit_review_validation_result_reviewed_ready_for_follow_up_queue" &&
  sourceStillValid &&
  receipt.validationResultReviewed === true &&
  receipt.auditReviewReceiptReviewed === true &&
  receipt.followUpQueueCommandReviewed === true &&
  receipt.teacherConfirmedNoFollowUpQueueCreated === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_audit_review_validation_result_decision"
  : ready
    ? "tlcl_rag_audit_review_validation_ready_for_follow_up_queue_planning"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_audit_review_validation_evidence" && blockers.length === 0
        ? "needs_more_audit_review_validation_evidence_before_follow_up_queue"
        : "needs_teacher_review_before_follow_up_queue_planning";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualFollowUpQueueHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_queue_handoff_v1",
      sourceRagAuditReviewValidationId: builder.sourceRagAuditReviewValidation?.validationId || "",
      sourceRagAuditReviewValidationPath: builder.sourceRagAuditReviewValidationPath || "",
      auditTrailPath: receipt.auditTrailPath,
      auditTrailHash: receipt.auditTrailHash,
      auditReviewReceiptPath: receipt.auditReviewReceiptPath,
      rollbackPoint: receipt.rollbackPoint,
      nextTool: "knowledge/create-rag-audit-review-follow-up-queue.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-audit-review-follow-up-queue.mjs --audit-review-validation "${builder.sourceRagAuditReviewValidationPath}" --rollback-point "${receipt.rollbackPoint}"`,
      instruction:
        "Prepare only a separate review-only follow-up queue after this TLCL confirmation. Do not run commands, enable rules, write memory, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_audit_review_validation_result",
        sourceAuditReviewValidationResultReceiptBuilderId: builder.auditReviewValidationResultReceiptBuilderId || "",
        sourceRagAuditReviewValidationPath: builder.sourceRagAuditReviewValidationPath || "",
        auditTrailPath: receipt.auditTrailPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the audit review validation result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForFollowUpQueuePlanning: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreAuditReviewValidationEvidence: status === "needs_more_audit_review_validation_evidence_before_follow_up_queue",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagAuditReviewValidationPath: receipt.sourceRagAuditReviewValidationPath || ""
  },
  manualFollowUpQueueHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_follow_up_queue_from_validation_result_confirmation",
    "auto_run_follow_up_queue_command",
    "invoke_model_from_validation_result_confirmation",
    "fetch_rag_from_validation_result_confirmation",
    "write_memory_from_validation_result_confirmation",
    "enable_rule_from_validation_result_confirmation",
    "unlock_packaging_from_validation_result_confirmation",
    "claim_completion_from_validation_result_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-audit-review-validation-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-audit-review-validation-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_AUDIT_REVIEW_VALIDATION_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Audit Review Validation Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not create a follow-up queue. It only prepares a manual follow-up queue handoff when the validation result is reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForFollowUpQueuePlanning: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreAuditReviewValidationEvidence: validation.needsMoreAuditReviewValidationEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualFollowUpQueueHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
