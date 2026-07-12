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
    String(value || "tlcl-rag-retrieval-draft-review-validation-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-retrieval-draft-review-validation-result"
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

function loadFullPacket(inputValue, inputPath, expectedFormat, pathFields, label) {
  let packet = inputValue;
  let packetPath = inputPath || "";
  for (const field of pathFields) {
    if (packet?.[field] && existsSync(packet[field])) {
      packetPath = resolve(packet[field]);
      packet = readJson(packetPath);
      break;
    }
  }
  if (packet?.format !== expectedFormat) {
    throw new Error(`Expected ${expectedFormat} or a ${label} result with ${pathFields.join(" / ")}.`);
  }
  return { packet, packetPath };
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

function resultLocks() {
  return {
    reviewOnly: true,
    retrievalDraftReviewValidationResultReceiptOnly: true,
    builderDoesNotRunRuleDslValidationPackage: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotFetchExternalSources: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    ruleDslValidationPackageRun: false,
    commandAutoRun: false,
    externalSourcesFetched: false,
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

const tlclReviewReceiptHandoffValidationInput =
  argValue("--tlcl-retrieval-draft-review-receipt-handoff-validation") ||
  argValue("--tlcl-confirmed-retrieval-draft-result-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const reviewValidationInput =
  argValue("--rag-retrieval-draft-review-validation") ||
  argValue("--retrieval-draft-review-validation") ||
  argValue("--review-validation");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-retrieval-draft-review-validation-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(
  tlclReviewReceiptHandoffValidationInput,
  "TLCL retrieval-draft review receipt handoff validation"
);
const { value: reviewInputValue, path: reviewInputPath } = readJsonInput(
  reviewValidationInput,
  "RAG retrieval-draft review validation"
);
if (!tlclInputValue || !reviewInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt-builder.mjs --tlcl-retrieval-draft-review-receipt-handoff-validation <tlcl-validation.json-or-result.json> --rag-retrieval-draft-review-validation <review-validation.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL retrieval-draft review receipt handoff validation"
);
const { packet: reviewValidation, packetPath: reviewValidationPath } = loadFullPacket(
  reviewInputValue,
  reviewInputPath,
  "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
  ["validationPath"],
  "RAG retrieval-draft review validation"
);

const handoff = tlclValidation.manualConfirmedRetrievalDraftReviewReceiptFollowUpHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_confirmed_retrieval_draft_ready_for_review_receipt_follow_up") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual retrieval-draft review receipt follow-up.");
}
if (tlclValidation.readyForConfirmedRetrievalDraftReviewReceiptFollowUp !== true) {
  block("tlcl_review_receipt_ready_flag_missing", "TLCL validation must set readyForConfirmedRetrievalDraftReviewReceiptFollowUp=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_retrieval_draft_review_receipt_follow_up_handoff_v1"
) {
  block("manual_review_receipt_handoff_missing", "TLCL validation must contain the manual retrieval-draft review receipt handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs") {
  block("manual_review_receipt_handoff_next_tool_invalid", "TLCL handoff must target the existing retrieval-draft review receipt builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunRetrievalDraftReviewReceiptBuilder !== true) {
  block("tlcl_review_receipt_execution_lock_missing", "Prior TLCL validation must keep the review receipt builder locked.");
}
if (tlclValidation.locks?.validatorDoesNotRunRuleDslValidation !== true || tlclValidation.locks?.validatorDoesNotWriteMemory !== true) {
  block("tlcl_result_lock_missing", "Prior TLCL validation must keep Rule DSL validation and memory writes locked.");
}

if (reviewValidation.status !== "ready_for_review_only_rule_dsl_validation") {
  block("review_validation_status_invalid", "Review validation must be ready for review-only Rule DSL validation.");
}
if (!Array.isArray(reviewValidation.approvedDisabledDrafts) || reviewValidation.approvedDisabledDrafts.length === 0) {
  block("approved_disabled_drafts_missing", "Review validation must contain teacher-approved disabled Rule Card drafts.");
}
if (resolve(reviewValidation.runPath || "") !== resolve(handoff?.sourceRetrievalDraftRunPath || "")) {
  block("review_validation_run_path_mismatch", "Review validation runPath must match the TLCL handoff retrieval draft run.");
}
if (reviewValidation.runHash !== handoff?.sourceRetrievalDraftRunHash) {
  block("review_validation_run_hash_mismatch", "Review validation runHash must match the TLCL handoff retrieval draft run hash.");
}
if ((reviewValidation.planningLogicEvidenceHash || "") !== (handoff?.planningLogicEvidenceHash || "")) {
  block("planning_logic_evidence_hash_mismatch", "Review validation planning logic hash must match the TLCL handoff.");
}
if (!isRetainedRollbackPoint(handoff?.rollbackPoint)) {
  block("rollback_point_not_retained", "The handoff rollback point must still be retained.");
}
if (
  reviewValidation.locks?.reviewOnly !== true ||
  reviewValidation.locks?.evidenceOnly !== true ||
  reviewValidation.locks?.accepted !== false ||
  reviewValidation.locks?.ruleEnabled !== false ||
  reviewValidation.locks?.memoryEnabled !== false ||
  reviewValidation.locks?.softwareActionsExecuted !== false ||
  reviewValidation.locks?.externalFetchPerformed !== false ||
  reviewValidation.locks?.packagingUnlocked !== false ||
  reviewValidation.nextReview?.mayEnableRules !== false ||
  reviewValidation.nextReview?.mayWriteMemory !== false ||
  reviewValidation.nextReview?.mayExecuteSoftware !== false ||
  reviewValidation.nextReview?.mayFetchExternalSources !== false ||
  reviewValidation.nextReview?.mayUnlockPackaging !== false
) {
  block("review_validation_locks_open", "Review validation must remain locked and review-only.");
}
if (
  reviewValidation.planningLogicEvidenceHash &&
  hashKnowledge(reviewValidation.planningLogicEvidence || null) !== reviewValidation.planningLogicEvidenceHash
) {
  block("review_validation_planning_logic_hash_mismatch", "Review validation planning logic evidence hash no longer matches.");
}
for (const draft of reviewValidation.approvedDisabledDrafts || []) {
  const id = draft.sourceId || draft.rulePath || "unknown";
  if (!draft.rulePath || !existsSync(draft.rulePath)) block(`approved_draft_rule_path_missing:${id}`, "Approved disabled Rule Card draft must exist.");
  if (draft.ruleLifecycle !== "draft_disabled") block(`approved_draft_lifecycle_invalid:${id}`, "Approved draft must remain draft_disabled.");
  if (draft.logicExtractionHint && draft.logicFitDecision !== "matches_intended_logic") {
    block(`approved_draft_logic_fit_not_confirmed:${id}`, "Approved draft with a logic hint must match the intended logic.");
  }
  if (!Array.isArray(draft.evidenceRefs) || draft.evidenceRefs.length === 0) {
    block(`approved_draft_evidence_refs_missing:${id}`, "Approved draft must carry evidence refs.");
  }
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(reviewValidation.validationId || "retrieval-draft-review-validation")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_retrieval_draft_review_validation_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_retrieval_draft_review_validation_result_receipt";
const reviewValidationHash = hashKnowledge(reviewValidation);
const approvedDraftRows = (reviewValidation.approvedDisabledDrafts || []).map((row) => ({
  sourceId: row.sourceId || "",
  retrievalPath: row.retrievalPath || "",
  rulePath: row.rulePath || "",
  ruleLifecycle: row.ruleLifecycle || "",
  logicExtractionHint: row.logicExtractionHint || "",
  logicFitDecision: row.logicFitDecision || "not_applicable",
  evidenceRefs: row.evidenceRefs || [],
  reviewerNote: row.reviewerNote || ""
}));

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_v1",
  sourceRetrievalDraftReviewValidationResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceReviewValidationId: reviewValidation.validationId || "",
  sourceReviewValidationPath: reviewValidationPath,
  sourceReviewValidationHash: reviewValidationHash,
  sourceRetrievalDraftRunPath: reviewValidation.runPath || "",
  sourceRetrievalDraftRunHash: reviewValidation.runHash || "",
  planningLogicEvidenceHash: reviewValidation.planningLogicEvidenceHash || "",
  rollbackPoint: handoff?.rollbackPoint || "",
  approvedDraftRows,
  approvedDraftCount: approvedDraftRows.length,
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "retrieval_draft_review_validation_result_reviewed_ready_for_rule_dsl_validation_package",
    "needs_more_retrieval_draft_review_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
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
  ],
  reviewValidationReviewed: false,
  approvedDraftRowsReviewed: false,
  disabledRuleDraftsReviewed: false,
  logicExtractionHintsReviewed: false,
  ruleDslValidationPackageCommandReviewed: false,
  teacherConfirmedNoRuleDslValidationPackageRun: false,
  teacherConfirmedNoRuleEnablement: false,
  teacherConfirmedNoMemoryWrite: false,
  teacherConfirmedNoExternalFetch: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_builder_v1",
  retrievalDraftReviewValidationResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceReviewValidationPath: reviewValidationPath,
  sourceReviewValidation: {
    validationId: reviewValidation.validationId || "",
    reviewValidationHash,
    runPath: reviewValidation.runPath || "",
    runHash: reviewValidation.runHash || "",
    planningLogicEvidenceHash: reviewValidation.planningLogicEvidenceHash || "",
    approvedDraftCount: approvedDraftRows.length,
    approvedDraftRows
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-retrieval-draft-review-validation-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-retrieval-draft-review-validation-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_RETRIEVAL_DRAFT_REVIEW_VALIDATION_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_rule_dsl_validation_package_from_review_validation_result",
    "auto_run_rule_dsl_validation_command",
    "enable_rule_from_review_validation_result",
    "write_memory_from_review_validation_result",
    "fetch_external_sources_from_review_validation_result",
    "invoke_model_from_review_validation_result",
    "unlock_packaging_from_review_validation_result",
    "claim_completion_from_review_validation_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.receiptTemplatePath, receipt);
writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Retrieval Draft Review Validation Result Receipt",
    "",
    `- Status: ${status}`,
    `- Review validation: ${reviewValidationPath}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "This builder does not run the Rule DSL validation package. It only asks the teacher to confirm the reviewed disabled drafts may be handed off to the next manual Rule DSL validation-package step."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_builder_result_v1",
      status,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      approvedDraftCount: approvedDraftRows.length,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);
if (!ok) process.exit(1);
