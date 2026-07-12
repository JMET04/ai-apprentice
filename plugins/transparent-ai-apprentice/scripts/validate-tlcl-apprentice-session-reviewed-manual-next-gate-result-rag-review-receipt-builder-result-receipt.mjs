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
    String(value || "tlcl-rag-review-receipt-builder-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-review-receipt-builder-result-validation"
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
    validatorDoesNotValidateRagReviewReceipt: true,
    validatorDoesNotExecuteRagValidator: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    ragValidatorExecuted: false,
    commandAutoRun: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

const builderInput = argValue("--builder") || argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-review-receipt-builder-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "rag_review_receipt_builder_result_reviewed_ready_for_teacher_receipt",
  "needs_more_builder_result_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_rag_validator",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG review receipt builder result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_review_receipt_builder_result_receipt_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotExecuteRagValidator !== true) {
  block("builder_validator_execution_lock_missing", "Builder must keep RAG validator execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}
const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceResultReceiptBuilderId !== builder.resultReceiptBuilderId) {
  block("source_result_receipt_builder_id_mismatch", "Receipt sourceResultReceiptBuilderId must match builder.");
}
if (receipt.sourceRagReviewReceiptBuilderId !== builder.sourceRagReviewReceiptBuilder?.builderId) {
  block("source_rag_builder_id_mismatch", "Receipt sourceRagReviewReceiptBuilderId must match the existing RAG builder.");
}
if (receipt.sourceRagReviewReceiptBuilderPath !== builder.sourceRagReviewReceiptBuilderPath) {
  block("source_rag_builder_path_mismatch", "Receipt source RAG builder path must match builder.");
}
if (receipt.packagePath !== builder.sourceRagReviewReceiptBuilder?.packagePath) {
  block("package_path_mismatch", "Receipt packagePath must match builder packagePath.");
}
if (receipt.ragBuilderPackageHash !== builder.sourceRagReviewReceiptBuilder?.packageHash) {
  block("rag_builder_package_hash_mismatch", "Receipt ragBuilderPackageHash must match builder.");
}
if (receipt.receiptTemplatePath !== builder.sourceRagReviewReceiptBuilder?.receiptTemplatePath) {
  block("receipt_template_path_mismatch", "Receipt receiptTemplatePath must match builder.");
}
if (receipt.validationCommand !== builder.sourceRagReviewReceiptBuilder?.validationCommand) {
  block("validation_command_mismatch", "Receipt validationCommand must match builder.");
}
if (receipt.confirmedRollbackPoint !== builder.handoff?.confirmedRollbackPoint) {
  block("confirmed_rollback_point_mismatch", "Receipt confirmedRollbackPoint must match adapter handoff.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}
if (!receipt.receiptTemplatePath || !existsSync(receipt.receiptTemplatePath)) {
  block("rag_receipt_template_missing", "The RAG review receipt template path no longer exists.");
}

let packageStillValid = false;
try {
  const packagePacket = readJson(receipt.packagePath);
  packageStillValid =
    packagePacket.format === "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1" &&
    packagePacket.status === "ready_for_teacher_rule_dsl_review_package" &&
    hashKnowledge(packagePacket) === receipt.ragBuilderPackageHash &&
    packagePacket.locks?.ruleEnabled === false &&
    packagePacket.locks?.memoryEnabled === false &&
    packagePacket.locks?.softwareActionsExecuted === false &&
    packagePacket.locks?.externalFetchPerformed === false &&
    packagePacket.locks?.packagingUnlocked === false;
} catch {
  packageStillValid = false;
}
if (!packageStillValid) block("rule_dsl_validation_package_not_still_valid", "The referenced Rule DSL validation package is missing, changed, or unlocked.");

if (decision === "rag_review_receipt_builder_result_reviewed_ready_for_teacher_receipt") {
  if (receipt.builderOutputReviewed !== true) block("builder_output_review_required", "Teacher must review the existing builder output.");
  if (receipt.receiptTemplateReviewed !== true) block("receipt_template_review_required", "Teacher must review the RAG receipt template.");
  if (receipt.validationCommandReviewed !== true) block("validation_command_review_required", "Teacher must review the validation command.");
  if (receipt.teacherConfirmedNoExecution !== true) block("teacher_no_execution_confirmation_required", "Teacher must confirm no execution happened here.");
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
}
if ((decision === "needs_more_builder_result_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}

if (decision === "needs_teacher_review" && blockers.length === 0) {
  warnings.push("waiting_for_teacher_review");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "rag_review_receipt_builder_result_reviewed_ready_for_teacher_receipt" &&
  receipt.builderOutputReviewed === true &&
  receipt.receiptTemplateReviewed === true &&
  receipt.validationCommandReviewed === true &&
  receipt.teacherConfirmedNoExecution === true &&
  receipt.blockedActionsConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_review_receipt_builder_result_decision"
  : ready
    ? "tlcl_rag_review_receipt_template_ready_for_teacher_fill"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_builder_result_evidence" && blockers.length === 0
        ? "needs_more_builder_result_evidence_before_rag_review_receipt"
        : "needs_teacher_review_before_rag_review_receipt_template";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualRagReviewReceiptTemplateHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_review_receipt_template_handoff_v1",
      sourceRagReviewReceiptBuilderId: builder.sourceRagReviewReceiptBuilder?.builderId || "",
      sourceRagReviewReceiptBuilderPath: builder.sourceRagReviewReceiptBuilderPath || "",
      packagePath: builder.sourceRagReviewReceiptBuilder?.packagePath || "",
      packageHash: builder.sourceRagReviewReceiptBuilder?.packageHash || "",
      receiptTemplatePath: builder.sourceRagReviewReceiptBuilder?.receiptTemplatePath || "",
      validationCommand: builder.sourceRagReviewReceiptBuilder?.validationCommand || "",
      confirmedRollbackPoint: builder.handoff?.confirmedRollbackPoint || "",
      instruction: "Fill the existing RAG review receipt template in a separate teacher step, then run its existing validator only after teacher confirmation.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_review_receipt_builder_result",
        sourceResultReceiptBuilderId: builder.resultReceiptBuilderId || "",
        sourceRagReviewReceiptBuilderPath: builder.sourceRagReviewReceiptBuilderPath || "",
        packagePath: builder.sourceRagReviewReceiptBuilder?.packagePath || "",
        confirmedRollbackPoint: builder.handoff?.confirmedRollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction: "Return to the high-reasoning compile layer because the existing RAG builder result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForRagReviewReceiptTeacherFill: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreBuilderResultEvidence: status === "needs_more_builder_result_evidence_before_rag_review_receipt",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceAdapterValidationPath: builder.sourceAdapterValidationPath || "",
    sourceRagReviewReceiptBuilderPath: builder.sourceRagReviewReceiptBuilderPath || ""
  },
  manualRagReviewReceiptTemplateHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_rag_review_receipt_validator_from_builder_result_validation",
    "auto_run_rag_review_receipt_validation_command",
    "invoke_model_from_builder_result_validation",
    "fetch_rag_from_builder_result_validation",
    "write_memory_from_builder_result_validation",
    "enable_rule_from_builder_result_validation",
    "unlock_packaging_from_builder_result_validation",
    "claim_completion_from_builder_result_validation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-review-receipt-builder-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-review-receipt-builder-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_REVIEW_RECEIPT_BUILDER_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Review Receipt Builder Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the existing RAG review receipt validator. It only prepares the teacher-fill handoff when the builder result is reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForRagReviewReceiptTeacherFill: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreBuilderResultEvidence: validation.needsMoreBuilderResultEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualRagReviewReceiptTemplateHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
