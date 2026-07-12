#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-rag-retrieval-draft-review-validation-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-retrieval-draft-review-validation-result-validation"
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

function isRetainedRollbackPoint(path) {
  if (!path || !existsSync(path)) return false;
  const stat = statSync(path);
  const manifestPath = stat.isDirectory() ? join(path, "rollback-point.json") : path;
  if (!existsSync(manifestPath)) return false;
  const manifest = readJson(manifestPath);
  return (
    (manifest.format === "transparent_ai_rollback_point_v1" ||
      manifest.format === "transparent_ai_rollback_point_result_v1") &&
    manifest.status === "waiting_for_teacher_confirmation" &&
    manifest.deleteOnlyAfterTeacherConfirmation === true
  );
}

function validationLocks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotRunRuleDslValidationPackage: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotFetchExternalSources: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotUnlockPackaging: true,
    ruleDslValidationPackageRun: false,
    commandAutoRun: false,
    ruleEnabled: false,
    memoryWritten: false,
    externalSourcesFetched: false,
    softwareExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  };
}

const builderInput =
  argValue("--builder") ||
  argValue("--retrieval-draft-review-validation-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-retrieval-draft-review-validation-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "retrieval_draft_review_validation_result_reviewed_ready_for_rule_dsl_validation_package",
  "needs_more_retrieval_draft_review_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_rule_dsl_validation_package",
  "execute_rule_dsl_validation_command",
  "enable_rule",
  "write_memory",
  "fetch_external_sources",
  "execute_now",
  "accepted",
  "fetch_rag",
  "invoke_model",
  "unlock_packaging",
  "claim_complete"
]);

if (
  builder.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG retrieval-draft review validation result receipt builder.");
}
if (
  builder.ok !== true ||
  builder.status !== "tlcl_rag_retrieval_draft_review_validation_result_waiting_for_teacher_confirmation"
) {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunRuleDslValidationPackage !== true) {
  block("builder_rule_dsl_validation_lock_missing", "Builder must keep Rule DSL validation package execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (
  receipt.sourceRetrievalDraftReviewValidationResultReceiptBuilderId !==
  builder.retrievalDraftReviewValidationResultReceiptBuilderId
) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceReviewValidationPath !== builder.sourceReviewValidationPath) {
  block("source_review_validation_path_mismatch", "Receipt review validation path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.sourceReviewValidationHash !== builder.sourceReviewValidation?.reviewValidationHash) {
  block("source_review_validation_hash_mismatch", "Receipt review validation hash must match builder.");
}
if (receipt.sourceRetrievalDraftRunHash !== builder.sourceReviewValidation?.runHash) {
  block("source_retrieval_draft_run_hash_mismatch", "Receipt retrieval draft run hash must match builder.");
}
if (receipt.planningLogicEvidenceHash !== builder.sourceReviewValidation?.planningLogicEvidenceHash) {
  block("planning_logic_evidence_hash_mismatch", "Receipt planningLogicEvidenceHash must match builder.");
}
if (JSON.stringify(receipt.approvedDraftRows || []) !== JSON.stringify(builder.sourceReviewValidation?.approvedDraftRows || [])) {
  block("approved_draft_rows_mismatch", "Receipt approvedDraftRows must match builder.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
let reviewValidation = null;
try {
  reviewValidation = readJson(receipt.sourceReviewValidationPath);
  sourceStillValid =
    reviewValidation.format === "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1" &&
    hashKnowledge(reviewValidation) === receipt.sourceReviewValidationHash &&
    reviewValidation.status === "ready_for_review_only_rule_dsl_validation" &&
    reviewValidation.runPath === receipt.sourceRetrievalDraftRunPath &&
    reviewValidation.runHash === receipt.sourceRetrievalDraftRunHash &&
    (reviewValidation.planningLogicEvidenceHash || "") === (receipt.planningLogicEvidenceHash || "") &&
    Array.isArray(reviewValidation.approvedDisabledDrafts) &&
    reviewValidation.approvedDisabledDrafts.length === Number(receipt.approvedDraftCount || 0) &&
    JSON.stringify(
      reviewValidation.approvedDisabledDrafts.map((row) => ({
        sourceId: row.sourceId || "",
        retrievalPath: row.retrievalPath || "",
        rulePath: row.rulePath || "",
        ruleLifecycle: row.ruleLifecycle || "",
        logicExtractionHint: row.logicExtractionHint || "",
        logicFitDecision: row.logicFitDecision || "not_applicable",
        evidenceRefs: row.evidenceRefs || [],
        reviewerNote: row.reviewerNote || ""
      }))
    ) === JSON.stringify(receipt.approvedDraftRows || []) &&
    isRetainedRollbackPoint(receipt.rollbackPoint) &&
    reviewValidation.approvedDisabledDrafts.every((row) => {
      return (
        row.rulePath &&
        existsSync(row.rulePath) &&
        row.ruleLifecycle === "draft_disabled" &&
        (!row.logicExtractionHint || row.logicFitDecision === "matches_intended_logic") &&
        Array.isArray(row.evidenceRefs) &&
        row.evidenceRefs.length > 0
      );
    }) &&
    reviewValidation.locks?.reviewOnly === true &&
    reviewValidation.locks?.evidenceOnly === true &&
    reviewValidation.locks?.accepted === false &&
    reviewValidation.locks?.ruleEnabled === false &&
    reviewValidation.locks?.memoryEnabled === false &&
    reviewValidation.locks?.softwareActionsExecuted === false &&
    reviewValidation.locks?.externalFetchPerformed === false &&
    reviewValidation.locks?.packagingUnlocked === false &&
    reviewValidation.nextReview?.mayEnableRules === false &&
    reviewValidation.nextReview?.mayWriteMemory === false &&
    reviewValidation.nextReview?.mayExecuteSoftware === false &&
    reviewValidation.nextReview?.mayFetchExternalSources === false &&
    reviewValidation.nextReview?.mayUnlockPackaging === false;
  if (
    sourceStillValid &&
    reviewValidation.planningLogicEvidenceHash &&
    hashKnowledge(reviewValidation.planningLogicEvidence || null) !== reviewValidation.planningLogicEvidenceHash
  ) {
    sourceStillValid = false;
  }
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block(
    "review_validation_not_still_valid",
    "The referenced retrieval-draft review validation, approved disabled drafts, locks, or rollback point is missing, changed, or unlocked."
  );
}

if (decision === "retrieval_draft_review_validation_result_reviewed_ready_for_rule_dsl_validation_package") {
  if (receipt.reviewValidationReviewed !== true) {
    block("review_validation_review_required", "Teacher must review the retrieval-draft review validation result.");
  }
  if (receipt.approvedDraftRowsReviewed !== true) block("approved_draft_rows_review_required", "Teacher must review approved draft rows.");
  if (receipt.disabledRuleDraftsReviewed !== true) block("disabled_rule_drafts_review_required", "Teacher must review disabled Rule Card drafts.");
  if (receipt.logicExtractionHintsReviewed !== true) block("logic_extraction_hints_review_required", "Teacher must review logic extraction hints.");
  if (receipt.ruleDslValidationPackageCommandReviewed !== true) {
    block("rule_dsl_validation_package_command_review_required", "Teacher must review the prepared Rule DSL validation-package command boundary.");
  }
  if (receipt.teacherConfirmedNoRuleDslValidationPackageRun !== true) {
    block("teacher_no_rule_dsl_validation_package_run_confirmation_required", "Teacher must confirm no Rule DSL validation package was run here.");
  }
  if (receipt.teacherConfirmedNoRuleEnablement !== true) {
    block("teacher_no_rule_enablement_confirmation_required", "Teacher must confirm no rule enablement happened here.");
  }
  if (receipt.teacherConfirmedNoMemoryWrite !== true) {
    block("teacher_no_memory_write_confirmation_required", "Teacher must confirm no memory write happened here.");
  }
  if (receipt.teacherConfirmedNoExternalFetch !== true) {
    block("teacher_no_external_fetch_confirmation_required", "Teacher must confirm no external fetch happened here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if (
  (decision === "needs_more_retrieval_draft_review_evidence" || decision === "correction_to_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required", "Teacher notes are required for review evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "retrieval_draft_review_validation_result_reviewed_ready_for_rule_dsl_validation_package" &&
  sourceStillValid &&
  receipt.reviewValidationReviewed === true &&
  receipt.approvedDraftRowsReviewed === true &&
  receipt.disabledRuleDraftsReviewed === true &&
  receipt.logicExtractionHintsReviewed === true &&
  receipt.ruleDslValidationPackageCommandReviewed === true &&
  receipt.teacherConfirmedNoRuleDslValidationPackageRun === true &&
  receipt.teacherConfirmedNoRuleEnablement === true &&
  receipt.teacherConfirmedNoMemoryWrite === true &&
  receipt.teacherConfirmedNoExternalFetch === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_retrieval_draft_review_validation_result_decision"
  : ready
    ? "tlcl_rag_retrieval_draft_review_validation_ready_for_rule_dsl_validation_package"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_retrieval_draft_review_evidence" && blockers.length === 0
        ? "needs_more_retrieval_draft_review_evidence_before_rule_dsl_validation_package"
        : "needs_teacher_review_before_rule_dsl_validation_package";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualRuleDslValidationPackageFollowUpHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_rule_dsl_validation_package_follow_up_handoff_v1",
      sourceReviewValidationId: builder.sourceReviewValidation?.validationId || "",
      sourceReviewValidationPath: receipt.sourceReviewValidationPath || "",
      sourceReviewValidationHash: receipt.sourceReviewValidationHash || "",
      sourceRetrievalDraftRunPath: receipt.sourceRetrievalDraftRunPath || "",
      sourceRetrievalDraftRunHash: receipt.sourceRetrievalDraftRunHash || "",
      planningLogicEvidenceHash: receipt.planningLogicEvidenceHash || "",
      approvedDraftCount: Number(receipt.approvedDraftCount || 0),
      rollbackPoint: receipt.rollbackPoint || "",
      nextTool: "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-reviewed-rule-dsl-validation-package.mjs --review-validation "${receipt.sourceReviewValidationPath}" --rollback-point "${receipt.rollbackPoint}" --teacher-reviewed`,
      instruction:
        "Run only the review-only Rule DSL validation package as a separate manual step after the retrieval-draft review validation result and disabled drafts are reviewed. Do not enable rules, write memory, fetch external sources, invoke a model, execute target software, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_retrieval_draft_review_validation_result",
        sourceRetrievalDraftReviewValidationResultReceiptBuilderId:
          builder.retrievalDraftReviewValidationResultReceiptBuilderId || "",
        sourceReviewValidationPath: builder.sourceReviewValidationPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the reviewed disabled draft validation result does not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForRuleDslValidationPackageFollowUp: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreRetrievalDraftReviewEvidence:
    status === "needs_more_retrieval_draft_review_evidence_before_rule_dsl_validation_package",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceReviewValidationPath: receipt.sourceReviewValidationPath || "",
    sourceRetrievalDraftRunPath: receipt.sourceRetrievalDraftRunPath || ""
  },
  manualRuleDslValidationPackageFollowUpHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_rule_dsl_validation_package_from_review_validation_confirmation",
    "execute_prepared_rule_dsl_validation_package_command",
    "enable_rule_from_review_validation_confirmation",
    "fetch_external_sources_from_review_validation_confirmation",
    "invoke_model_from_review_validation_confirmation",
    "write_memory_from_review_validation_confirmation",
    "unlock_packaging_from_review_validation_confirmation",
    "claim_completion_from_review_validation_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-retrieval-draft-review-validation-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-retrieval-draft-review-validation-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_RETRIEVAL_DRAFT_REVIEW_VALIDATION_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Retrieval Draft Review Validation Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the Rule DSL validation package. It only prepares a manual handoff after the retrieval-draft review validation result, approved disabled drafts, logic hints, and rollback point are reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_validation_result_v1",
      status,
      validationPath,
      validationReceiptPath,
      readyForRuleDslValidationPackageFollowUp: validation.readyForRuleDslValidationPackageFollowUp,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreRetrievalDraftReviewEvidence: validation.needsMoreRetrievalDraftReviewEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      manualRuleDslValidationPackageFollowUpHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);
if (forbiddenDecisionUsed) process.exit(1);
