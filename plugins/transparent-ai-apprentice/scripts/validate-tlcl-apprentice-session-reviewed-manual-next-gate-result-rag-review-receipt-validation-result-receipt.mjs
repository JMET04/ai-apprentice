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
    String(value || "tlcl-rag-review-receipt-validation-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-review-receipt-validation-result-validation"
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
    validatorDoesNotRunDisabledPackageBuilder: true,
    validatorDoesNotCompileRulePackage: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    disabledPackageBuilderRun: false,
    rulePackageCompiled: false,
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
  argValue("--validation-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-review-receipt-validation-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "rag_review_receipt_validation_result_reviewed_ready_for_disabled_package_planning",
  "needs_more_rag_review_validation_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_disabled_package_builder",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG review receipt validation result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_review_receipt_validation_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunDisabledPackageBuilder !== true) {
  block("builder_disabled_package_lock_missing", "Builder must keep disabled package builder execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceValidationResultReceiptBuilderId !== builder.validationResultReceiptBuilderId) {
  block("source_validation_result_receipt_builder_id_mismatch", "Receipt sourceValidationResultReceiptBuilderId must match builder.");
}
if (receipt.sourceRagReviewReceiptValidationPath !== builder.sourceRagReviewReceiptValidationPath) {
  block("source_rag_review_receipt_validation_path_mismatch", "Receipt source RAG validation path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.packagePath !== builder.sourceRagReviewReceiptValidation?.packagePath) {
  block("package_path_mismatch", "Receipt packagePath must match builder packagePath.");
}
if (receipt.ragReviewReceiptPath !== builder.sourceRagReviewReceiptValidation?.receiptPath) {
  block("rag_review_receipt_path_mismatch", "Receipt ragReviewReceiptPath must match builder receiptPath.");
}
if (receipt.sourceRagReviewReceiptValidationStatus !== builder.sourceRagReviewReceiptValidation?.status) {
  block("rag_review_receipt_validation_status_mismatch", "Receipt source status must match builder source status.");
}
if (receipt.reviewedDisabledRuleCount !== builder.sourceRagReviewReceiptValidation?.reviewedDisabledRuleCount) {
  block("reviewed_disabled_rule_count_mismatch", "Receipt reviewedDisabledRuleCount must match builder.");
}
if (receipt.confirmedRollbackPoint !== builder.handoff?.confirmedRollbackPoint) {
  block("confirmed_rollback_point_mismatch", "Receipt confirmedRollbackPoint must match the prior TLCL handoff.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let ragValidation = null;
let packageStillValid = false;
try {
  ragValidation = readJson(receipt.sourceRagReviewReceiptValidationPath);
  const packagePacket = readJson(receipt.packagePath);
  packageStillValid =
    ragValidation.format === "transparent_ai_rag_reviewed_rule_dsl_review_receipt_validation_v1" &&
    ragValidation.status === receipt.sourceRagReviewReceiptValidationStatus &&
    ragValidation.packagePath === receipt.packagePath &&
    ragValidation.receiptPath === receipt.ragReviewReceiptPath &&
    hashKnowledge(packagePacket) === receipt.packageHash &&
    ragValidation.packageHash === receipt.packageHash &&
    packagePacket.format === "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1" &&
    packagePacket.status === "ready_for_teacher_rule_dsl_review_package" &&
    packagePacket.locks?.ruleEnabled === false &&
    packagePacket.locks?.memoryEnabled === false &&
    packagePacket.locks?.softwareActionsExecuted === false &&
    packagePacket.locks?.externalFetchPerformed === false &&
    packagePacket.locks?.packagingUnlocked === false;
} catch {
  packageStillValid = false;
}
if (!packageStillValid) {
  block("rag_review_receipt_validation_source_not_still_valid", "The referenced RAG review receipt validation or package is missing, changed, or unlocked.");
}

const sourceReadyForDisabledPackagePlanning =
  ragValidation?.status === "ready_for_review_only_disabled_rule_package_planning" &&
  ragValidation?.nextReview?.mayPrepareDisabledRulePackageReview === true &&
  Array.isArray(ragValidation?.reviewedDisabledRules) &&
  ragValidation.reviewedDisabledRules.length > 0 &&
  ragValidation?.locks?.ruleEnabled === false &&
  ragValidation?.locks?.memoryEnabled === false &&
  ragValidation?.locks?.softwareActionsExecuted === false &&
  ragValidation?.locks?.externalFetchPerformed === false &&
  ragValidation?.locks?.packagingUnlocked === false;

if (decision === "rag_review_receipt_validation_result_reviewed_ready_for_disabled_package_planning") {
  if (!sourceReadyForDisabledPackagePlanning) {
    block("source_not_ready_for_disabled_package_planning", "RAG validation must be ready for review-only disabled package planning.");
  }
  if (receipt.ragReviewReceiptValidationReviewed !== true) block("rag_validation_review_required", "Teacher must review the RAG validation result.");
  if (receipt.readyStatusReviewed !== true) block("ready_status_review_required", "Teacher must review the ready status.");
  if (receipt.reviewedDisabledRulesReviewed !== true) block("reviewed_disabled_rules_review_required", "Teacher must review the disabled rules list.");
  if (receipt.teacherConfirmedNoDisabledPackageBuilderRun !== true) {
    block("teacher_no_disabled_package_builder_run_confirmation_required", "Teacher must confirm no disabled package builder was run here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if (
  (decision === "needs_more_rag_review_validation_evidence" || decision === "correction_to_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "rag_review_receipt_validation_result_reviewed_ready_for_disabled_package_planning" &&
  sourceReadyForDisabledPackagePlanning &&
  receipt.ragReviewReceiptValidationReviewed === true &&
  receipt.readyStatusReviewed === true &&
  receipt.reviewedDisabledRulesReviewed === true &&
  receipt.teacherConfirmedNoDisabledPackageBuilderRun === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_review_receipt_validation_result_decision"
  : ready
    ? "tlcl_rag_review_receipt_validation_ready_for_disabled_package_planning"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_rag_review_validation_evidence" && blockers.length === 0
        ? "needs_more_rag_review_validation_evidence_before_disabled_package_planning"
        : "needs_teacher_review_before_disabled_package_planning";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const disabledPackagePlanningHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_disabled_package_planning_handoff_v1",
      nextTool: "knowledge/create-rag-reviewed-disabled-rule-package.mjs",
      reviewValidationPath: receipt.sourceRagReviewReceiptValidationPath,
      packagePath: receipt.packagePath,
      packageHash: receipt.packageHash,
      ragReviewReceiptPath: receipt.ragReviewReceiptPath,
      reviewedDisabledRuleCount: receipt.reviewedDisabledRuleCount,
      rollbackPoint: receipt.confirmedRollbackPoint,
      requiredFlags: ["--teacher-reviewed"],
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-reviewed-disabled-rule-package.mjs --review-validation "${receipt.sourceRagReviewReceiptValidationPath}" --rollback-point "${receipt.confirmedRollbackPoint}" --teacher-reviewed`,
      instruction:
        "Run this disabled package planning command only as a separate teacher-approved step. It stages reviewed draft_disabled rules for review; it must not enable rules, write memory, execute software, fetch RAG, or unlock packaging.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_review_receipt_validation_result",
        sourceValidationResultReceiptBuilderId: builder.validationResultReceiptBuilderId || "",
        sourceRagReviewReceiptValidationPath: receipt.sourceRagReviewReceiptValidationPath || "",
        packagePath: receipt.packagePath || "",
        confirmedRollbackPoint: receipt.confirmedRollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the RAG review receipt validation result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForDisabledPackagePlanning: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreRagReviewValidationEvidence: status === "needs_more_rag_review_validation_evidence_before_disabled_package_planning",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagReviewReceiptValidationPath: receipt.sourceRagReviewReceiptValidationPath || ""
  },
  disabledPackagePlanningHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_disabled_package_builder_from_tlcl_rag_validation_result",
    "compile_rule_package_from_tlcl_rag_validation_result",
    "invoke_model_from_tlcl_rag_validation_result",
    "fetch_rag_from_tlcl_rag_validation_result",
    "write_memory_from_tlcl_rag_validation_result",
    "enable_rule_from_tlcl_rag_validation_result",
    "unlock_packaging_from_tlcl_rag_validation_result",
    "claim_completion_from_tlcl_rag_validation_result"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-review-receipt-validation-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-review-receipt-validation-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_REVIEW_RECEIPT_VALIDATION_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Review Receipt Validation Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the disabled package builder. It only prepares a manual disabled-package planning handoff when the teacher confirms the existing RAG validation result."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForDisabledPackagePlanning: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreRagReviewValidationEvidence: validation.needsMoreRagReviewValidationEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      disabledPackagePlanningHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
