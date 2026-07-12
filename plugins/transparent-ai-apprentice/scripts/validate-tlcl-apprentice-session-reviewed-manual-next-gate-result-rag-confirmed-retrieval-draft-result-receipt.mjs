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
    String(value || "tlcl-rag-confirmed-retrieval-draft-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-confirmed-retrieval-draft-result-validation"
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
    validatorDoesNotRunRetrievalDraftReviewReceiptBuilder: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotRunRuleDslValidation: true,
    validatorDoesNotFetchExternalSources: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    retrievalDraftReviewReceiptBuilderRun: false,
    ruleDslValidationRun: false,
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

const builderInput =
  argValue("--builder") ||
  argValue("--confirmed-retrieval-draft-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-confirmed-retrieval-draft-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "confirmed_retrieval_draft_result_reviewed_ready_for_review_receipt_follow_up",
  "needs_more_retrieval_draft_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_retrieval_draft_review_receipt_builder",
  "execute_review_receipt_builder_command",
  "validate_rule_dsl",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG confirmed retrieval draft result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_confirmed_retrieval_draft_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunRetrievalDraftReviewReceiptBuilder !== true) {
  block("builder_review_receipt_builder_lock_missing", "Builder must keep retrieval draft review receipt builder execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceConfirmedRetrievalDraftResultReceiptBuilderId !== builder.confirmedRetrievalDraftResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRetrievalDraftRunPath !== builder.sourceRetrievalDraftRunPath) {
  block("source_retrieval_draft_run_path_mismatch", "Receipt retrieval draft run path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.sourceRetrievalDraftRunHash !== builder.sourceRetrievalDraftRun?.retrievalDraftRunHash) {
  block("source_retrieval_draft_run_hash_mismatch", "Receipt retrieval draft run hash must match builder.");
}
if (receipt.sourceIngestRunHash !== builder.sourceRetrievalDraftRun?.ingestRunHash) {
  block("source_ingest_run_hash_mismatch", "Receipt ingest run hash must match builder.");
}
if (receipt.planningLogicEvidenceHash !== builder.sourceRetrievalDraftRun?.planningLogicEvidenceHash) {
  block("planning_logic_evidence_hash_mismatch", "Receipt planningLogicEvidenceHash must match builder.");
}
if (receipt.retrievalQuery !== builder.sourceRetrievalDraftRun?.query) {
  block("retrieval_query_mismatch", "Receipt retrievalQuery must match builder.");
}
if (Number(receipt.topK) !== Number(builder.sourceRetrievalDraftRun?.topK || 3)) {
  block("top_k_mismatch", "Receipt topK must match builder.");
}
if (JSON.stringify(receipt.retrievalRows || []) !== JSON.stringify(builder.sourceRetrievalDraftRun?.retrievalRows || [])) {
  block("retrieval_rows_mismatch", "Receipt retrievalRows must match builder.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
let retrievalDraftRun = null;
try {
  retrievalDraftRun = readJson(receipt.sourceRetrievalDraftRunPath);
  sourceStillValid =
    retrievalDraftRun.format === "transparent_ai_rag_confirmed_retrieval_draft_run_v1" &&
    hashKnowledge(retrievalDraftRun) === receipt.sourceRetrievalDraftRunHash &&
    retrievalDraftRun.ingestRunPath === receipt.sourceIngestRunPath &&
    retrievalDraftRun.ingestRunHash === receipt.sourceIngestRunHash &&
    retrievalDraftRun.query === receipt.retrievalQuery &&
    Number(retrievalDraftRun.topK) === Number(receipt.topK) &&
    retrievalDraftRun.teacherReviewed === true &&
    retrievalDraftRun.rollbackPoint === receipt.rollbackPoint &&
    isRetainedRollbackPoint(receipt.rollbackPoint) &&
    Array.isArray(retrievalDraftRun.retrievals) &&
    retrievalDraftRun.retrievals.length > 0 &&
    JSON.stringify(
      retrievalDraftRun.retrievals.map((row) => ({
        sourceId: row.sourceId,
        indexPath: row.indexPath,
        retrievalPath: row.retrievalPath,
        retrievalStatus: row.retrievalStatus,
        chunkCount: row.chunkCount || 0,
        logicExtractionHint: row.logicExtractionHint || "",
        rulePath: row.ruleDraft?.rulePath || "",
        ruleLifecycle: row.ruleDraft?.lifecycle || "",
        evidenceRefs: row.ruleDraft?.evidenceRefs || []
      }))
    ) === JSON.stringify(receipt.retrievalRows || []) &&
    retrievalDraftRun.retrievals.every((row) => {
      const ruleOk =
        !row.ruleDraft ||
        (row.ruleDraft.rulePath &&
          existsSync(row.ruleDraft.rulePath) &&
          row.ruleDraft.lifecycle === "draft_disabled" &&
          row.ruleDraft.executedCommand?.kind === "node_spawn_no_shell");
      return (
        row.indexPath &&
        existsSync(row.indexPath) &&
        row.retrievalPath &&
        existsSync(row.retrievalPath) &&
        row.executedCommand?.kind === "node_spawn_no_shell" &&
        ruleOk
      );
    }) &&
    retrievalDraftRun.locks?.reviewOnly === true &&
    retrievalDraftRun.locks?.evidenceOnly === true &&
    retrievalDraftRun.locks?.accepted === false &&
    retrievalDraftRun.locks?.ruleEnabled === false &&
    retrievalDraftRun.locks?.memoryEnabled === false &&
    retrievalDraftRun.locks?.softwareActionsExecuted === false &&
    retrievalDraftRun.locks?.externalFetchPerformed === false &&
    retrievalDraftRun.locks?.packagingUnlocked === false &&
    retrievalDraftRun.nextReview?.mayEnableRules === false &&
    retrievalDraftRun.nextReview?.mayWriteMemory === false &&
    retrievalDraftRun.nextReview?.mayExecuteSoftware === false &&
    retrievalDraftRun.nextReview?.mayFetchExternalSources === false &&
    retrievalDraftRun.nextReview?.mayUnlockPackaging === false;
  if (
    sourceStillValid &&
    retrievalDraftRun.planningLogicEvidenceHash &&
    hashKnowledge(retrievalDraftRun.planningLogicEvidence || null) !== retrievalDraftRun.planningLogicEvidenceHash
  ) {
    sourceStillValid = false;
  }
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block(
    "retrieval_draft_run_not_still_valid",
    "The referenced retrieval draft run, evidence packets, disabled drafts, or rollback point is missing, changed, or unlocked."
  );
}

if (decision === "confirmed_retrieval_draft_result_reviewed_ready_for_review_receipt_follow_up") {
  if (receipt.retrievalDraftRunReviewed !== true) block("retrieval_draft_run_review_required", "Teacher must review the retrieval draft run.");
  if (receipt.retrievalRowsReviewed !== true) block("retrieval_rows_review_required", "Teacher must review retrieval rows.");
  if (receipt.retrievalChunksReviewed !== true) block("retrieval_chunks_review_required", "Teacher must review retrieved chunks.");
  if (Number(receipt.ruleDraftCount || 0) > 0 && receipt.disabledRuleDraftsReviewed !== true) {
    block("disabled_rule_drafts_review_required", "Teacher must review disabled Rule Card drafts.");
  }
  if (receipt.logicExtractionHintsReviewed !== true) {
    block("logic_extraction_hints_review_required", "Teacher must review logic extraction hints.");
  }
  if (receipt.teacherConfirmedNoReviewReceiptBuilderRun !== true) {
    block("teacher_no_review_receipt_builder_run_confirmation_required", "Teacher must confirm no review receipt builder was run here.");
  }
  if (receipt.teacherConfirmedNoRuleDslValidationRun !== true) {
    block("teacher_no_rule_dsl_validation_run_confirmation_required", "Teacher must confirm no Rule DSL validation was run here.");
  }
  if (receipt.teacherConfirmedNoExternalFetch !== true) {
    block("teacher_no_external_fetch_confirmation_required", "Teacher must confirm no external fetch happened here.");
  }
  if (receipt.teacherConfirmedNoMemoryOrRuleWrite !== true) {
    block("teacher_no_memory_or_rule_write_confirmation_required", "Teacher must confirm no memory write or rule enablement happened here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if (
  (decision === "needs_more_retrieval_draft_evidence" || decision === "correction_to_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required", "Teacher notes are required for retrieval draft evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "confirmed_retrieval_draft_result_reviewed_ready_for_review_receipt_follow_up" &&
  sourceStillValid &&
  receipt.retrievalDraftRunReviewed === true &&
  receipt.retrievalRowsReviewed === true &&
  receipt.retrievalChunksReviewed === true &&
  (Number(receipt.ruleDraftCount || 0) === 0 || receipt.disabledRuleDraftsReviewed === true) &&
  receipt.logicExtractionHintsReviewed === true &&
  receipt.teacherConfirmedNoReviewReceiptBuilderRun === true &&
  receipt.teacherConfirmedNoRuleDslValidationRun === true &&
  receipt.teacherConfirmedNoExternalFetch === true &&
  receipt.teacherConfirmedNoMemoryOrRuleWrite === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_confirmed_retrieval_draft_result_decision"
  : ready
    ? "tlcl_rag_confirmed_retrieval_draft_ready_for_review_receipt_follow_up"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_retrieval_draft_evidence" && blockers.length === 0
        ? "needs_more_retrieval_draft_evidence_before_review_receipt_follow_up"
        : "needs_teacher_review_before_retrieval_draft_review_receipt_follow_up";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualConfirmedRetrievalDraftReviewReceiptFollowUpHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_retrieval_draft_review_receipt_follow_up_handoff_v1",
      sourceRetrievalDraftRunId: builder.sourceRetrievalDraftRun?.runId || "",
      sourceRetrievalDraftRunPath: receipt.sourceRetrievalDraftRunPath || "",
      sourceRetrievalDraftRunHash: receipt.sourceRetrievalDraftRunHash || "",
      sourceIngestRunPath: receipt.sourceIngestRunPath || "",
      sourceIngestRunHash: receipt.sourceIngestRunHash || "",
      planningLogicEvidenceHash: receipt.planningLogicEvidenceHash || "",
      retrievalQuery: receipt.retrievalQuery || "",
      topK: Number(receipt.topK || 3),
      retrievalRowCount: receipt.retrievalRows?.length || 0,
      evidenceFoundCount: Number(receipt.evidenceFoundCount || 0),
      ruleDraftCount: Number(receipt.ruleDraftCount || 0),
      rollbackPoint: receipt.rollbackPoint || "",
      nextTool: "knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs --retrieval-draft-run "${receipt.sourceRetrievalDraftRunPath}"`,
      instruction:
        "Build only the detailed teacher review receipt as a separate manual step after the retrieval draft result is reviewed. Do not validate Rule DSL, fetch external sources, invoke a model, enable rules, write memory, execute target software, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_retrieval_draft_result",
        sourceConfirmedRetrievalDraftResultReceiptBuilderId:
          builder.confirmedRetrievalDraftResultReceiptBuilderId || "",
        sourceRetrievalDraftRunPath: builder.sourceRetrievalDraftRunPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the confirmed retrieval draft result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForConfirmedRetrievalDraftReviewReceiptFollowUp: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreRetrievalDraftEvidence: status === "needs_more_retrieval_draft_evidence_before_review_receipt_follow_up",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRetrievalDraftRunPath: receipt.sourceRetrievalDraftRunPath || "",
    sourceIngestRunPath: receipt.sourceIngestRunPath || ""
  },
  manualConfirmedRetrievalDraftReviewReceiptFollowUpHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_retrieval_draft_review_receipt_builder_from_result_confirmation",
    "execute_prepared_review_receipt_builder_command",
    "run_rule_dsl_validation_from_result_confirmation",
    "fetch_external_sources_from_result_confirmation",
    "invoke_model_from_result_confirmation",
    "write_memory_from_result_confirmation",
    "enable_rule_from_result_confirmation",
    "unlock_packaging_from_result_confirmation",
    "claim_completion_from_result_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-confirmed-retrieval-draft-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-confirmed-retrieval-draft-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_CONFIRMED_RETRIEVAL_DRAFT_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Confirmed Retrieval Draft Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not build the detailed review receipt or validate Rule DSL. It only prepares a manual handoff after the retrieval draft run, retrieved chunks, disabled drafts, and logic hints are reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForConfirmedRetrievalDraftReviewReceiptFollowUp: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreRetrievalDraftEvidence: validation.needsMoreRetrievalDraftEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualConfirmedRetrievalDraftReviewReceiptFollowUpHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
