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
    String(value || "tlcl-rag-audit-review-receipt-builder-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-audit-review-receipt-builder-result-validation"
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
    validatorDoesNotValidateAuditReviewReceipt: true,
    validatorDoesNotRunFollowUpQueue: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    auditReviewReceiptValidatorRun: false,
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
  argValue("--audit-review-receipt-builder-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-audit-review-receipt-builder-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "audit_review_receipt_builder_result_reviewed_ready_for_teacher_receipt",
  "needs_more_audit_review_builder_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_audit_review_receipt_validator",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG audit review receipt builder-result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_audit_review_receipt_builder_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotValidateAuditReviewReceipt !== true) {
  block("builder_audit_review_validator_lock_missing", "Builder must keep audit review receipt validation locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceAuditReviewReceiptBuilderResultReceiptBuilderId !== builder.auditReviewReceiptBuilderResultReceiptBuilderId) {
  block("source_builder_result_receipt_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRagAuditReviewReceiptBuilderPath !== builder.sourceRagAuditReviewReceiptBuilderPath) {
  block("source_rag_audit_review_builder_path_mismatch", "Receipt source RAG audit review builder path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.auditTrailPath !== builder.sourceRagAuditReviewReceiptBuilder?.auditTrailPath) {
  block("audit_trail_path_mismatch", "Receipt auditTrailPath must match builder.");
}
if (receipt.receiptTemplatePath !== builder.sourceRagAuditReviewReceiptBuilder?.receiptTemplatePath) {
  block("receipt_template_path_mismatch", "Receipt receiptTemplatePath must match builder.");
}
if (receipt.validationCommand !== builder.sourceRagAuditReviewReceiptBuilder?.validationCommand) {
  block("validation_command_mismatch", "Receipt validationCommand must match builder.");
}
if (receipt.rollbackPoint !== builder.handoff?.rollbackPoint) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match the prior TLCL handoff.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
try {
  const auditTrail = readJson(receipt.auditTrailPath);
  const auditBuilder = readJson(receipt.sourceRagAuditReviewReceiptBuilderPath);
  const auditReceiptTemplate = readJson(receipt.receiptTemplatePath);
  sourceStillValid =
    auditBuilder.format === "transparent_ai_rag_delivery_gate_audit_review_receipt_builder_v1" &&
    auditBuilder.auditTrailPath === receipt.auditTrailPath &&
    auditBuilder.receiptTemplatePath === receipt.receiptTemplatePath &&
    auditBuilder.validationCommand === receipt.validationCommand &&
    auditTrail.format === "transparent_ai_rag_delivery_gate_audit_trail_v1" &&
    auditTrail.status === "audit_trail_ready_for_teacher_review" &&
    hashKnowledge(auditTrail) === receipt.auditTrailHash &&
    auditBuilder.auditHash === receipt.auditTrailHash &&
    auditReceiptTemplate.format === "transparent_ai_rag_delivery_gate_audit_review_receipt_v1" &&
    auditReceiptTemplate.auditHash === receipt.auditTrailHash &&
    auditTrail.locks?.reviewOnly === true &&
    auditTrail.locks?.evidenceOnly === true &&
    auditTrail.locks?.accepted === false &&
    auditTrail.locks?.ruleEnabled === false &&
    auditTrail.locks?.memoryEnabled === false &&
    auditTrail.locks?.softwareActionsExecuted === false &&
    auditTrail.locks?.externalFetchPerformed === false &&
    auditTrail.locks?.packagingUnlocked === false &&
    auditTrail.locks?.deliveryGateOpen === false;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block(
    "rag_audit_review_receipt_builder_source_not_still_valid",
    "The referenced audit review receipt builder, template, or audit trail is missing, changed, or unlocked."
  );
}

if (decision === "audit_review_receipt_builder_result_reviewed_ready_for_teacher_receipt") {
  if (receipt.builderOutputReviewed !== true) block("builder_output_review_required", "Teacher must review the existing audit review receipt builder output.");
  if (receipt.receiptTemplateReviewed !== true) block("receipt_template_review_required", "Teacher must review the audit review receipt template.");
  if (receipt.validationCommandReviewed !== true) block("validation_command_review_required", "Teacher must review the validation command.");
  if (receipt.teacherConfirmedNoValidationRun !== true) {
    block("teacher_no_validation_run_confirmation_required", "Teacher must confirm no audit review receipt validator was run here.");
  }
  if (receipt.teacherConfirmedNoFollowUpQueue !== true) {
    block("teacher_no_follow_up_queue_confirmation_required", "Teacher must confirm no follow-up queue was created here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if ((decision === "needs_more_audit_review_builder_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "audit_review_receipt_builder_result_reviewed_ready_for_teacher_receipt" &&
  sourceStillValid &&
  receipt.builderOutputReviewed === true &&
  receipt.receiptTemplateReviewed === true &&
  receipt.validationCommandReviewed === true &&
  receipt.teacherConfirmedNoValidationRun === true &&
  receipt.teacherConfirmedNoFollowUpQueue === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_audit_review_receipt_builder_result_decision"
  : ready
    ? "tlcl_rag_audit_review_receipt_template_ready_for_teacher_fill"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_audit_review_builder_evidence" && blockers.length === 0
        ? "needs_more_audit_review_builder_evidence_before_teacher_receipt"
        : "needs_teacher_review_before_audit_review_receipt_template";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualAuditReviewReceiptTemplateHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_review_receipt_template_handoff_v1",
      sourceRagAuditReviewReceiptBuilderId: builder.sourceRagAuditReviewReceiptBuilder?.builderId || "",
      sourceRagAuditReviewReceiptBuilderPath: builder.sourceRagAuditReviewReceiptBuilderPath || "",
      auditTrailPath: receipt.auditTrailPath,
      auditTrailHash: receipt.auditTrailHash,
      receiptTemplatePath: receipt.receiptTemplatePath,
      validationCommand: receipt.validationCommand,
      rollbackPoint: receipt.rollbackPoint,
      instruction:
        "Fill the existing RAG audit review receipt template in a separate teacher step, then run its existing validator only after teacher confirmation. Do not create a follow-up queue yet.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_audit_review_receipt_builder_result",
        sourceAuditReviewReceiptBuilderResultReceiptBuilderId: builder.auditReviewReceiptBuilderResultReceiptBuilderId || "",
        sourceRagAuditReviewReceiptBuilderPath: builder.sourceRagAuditReviewReceiptBuilderPath || "",
        auditTrailPath: receipt.auditTrailPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the audit review receipt builder result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForAuditReviewReceiptTeacherFill: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreAuditReviewBuilderEvidence: status === "needs_more_audit_review_builder_evidence_before_teacher_receipt",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagAuditReviewReceiptBuilderPath: receipt.sourceRagAuditReviewReceiptBuilderPath || ""
  },
  manualAuditReviewReceiptTemplateHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_audit_review_receipt_validator_from_builder_result_validation",
    "run_follow_up_queue_from_builder_result_validation",
    "auto_run_audit_review_receipt_validation_command",
    "invoke_model_from_builder_result_validation",
    "fetch_rag_from_builder_result_validation",
    "write_memory_from_builder_result_validation",
    "enable_rule_from_builder_result_validation",
    "unlock_packaging_from_builder_result_validation",
    "claim_completion_from_builder_result_validation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-audit-review-receipt-builder-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-audit-review-receipt-builder-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_AUDIT_REVIEW_RECEIPT_BUILDER_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Audit Review Receipt Builder Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the audit review receipt validator or create a follow-up queue. It only prepares the teacher-fill handoff when the builder result is reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForAuditReviewReceiptTeacherFill: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreAuditReviewBuilderEvidence: validation.needsMoreAuditReviewBuilderEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualAuditReviewReceiptTemplateHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
