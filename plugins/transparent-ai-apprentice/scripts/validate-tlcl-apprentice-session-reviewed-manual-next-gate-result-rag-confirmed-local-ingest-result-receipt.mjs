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
    String(value || "tlcl-rag-confirmed-local-ingest-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-confirmed-local-ingest-result-validation"
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
    validatorDoesNotRunRetrievalDraft: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotFetchExternalSources: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    retrievalDraftRun: false,
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
  argValue("--confirmed-local-ingest-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-confirmed-local-ingest-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "confirmed_local_ingest_result_reviewed_ready_for_retrieval_draft_follow_up",
  "needs_more_local_ingest_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_retrieval_draft",
  "execute_retrieval_command",
  "fetch_external_sources",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG confirmed local ingest result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_confirmed_local_ingest_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunRetrievalDraft !== true) {
  block("builder_retrieval_draft_lock_missing", "Builder must keep retrieval draft execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceConfirmedLocalIngestResultReceiptBuilderId !== builder.confirmedLocalIngestResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceIngestRunPath !== builder.sourceIngestRunPath) {
  block("source_ingest_run_path_mismatch", "Receipt ingest run path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.sourceIngestRunHash !== builder.sourceIngestRun?.ingestRunHash) {
  block("source_ingest_run_hash_mismatch", "Receipt ingest run hash must match builder.");
}
if (receipt.sourceRegistryHash !== builder.sourceIngestRun?.registryHash) {
  block("source_registry_hash_mismatch", "Receipt registry hash must match builder.");
}
if (receipt.planningLogicEvidenceHash !== builder.sourceIngestRun?.planningLogicEvidenceHash) {
  block("planning_logic_evidence_hash_mismatch", "Receipt planningLogicEvidenceHash must match builder.");
}
if (JSON.stringify(receipt.localCorpusIndexes || []) !== JSON.stringify(builder.sourceIngestRun?.localCorpusIndexes || [])) {
  block("local_corpus_indexes_mismatch", "Receipt localCorpusIndexes must match builder.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}
if (!String(receipt.retrievalQuery || "").trim()) block("retrieval_query_required", "Receipt must include a reviewed retrievalQuery.");
if (!Number.isInteger(Number(receipt.topK)) || Number(receipt.topK) < 1 || Number(receipt.topK) > 10) {
  block("top_k_invalid", "Receipt topK must be an integer from 1 to 10.");
}

let sourceStillValid = false;
let ingestRun = null;
try {
  ingestRun = readJson(receipt.sourceIngestRunPath);
  sourceStillValid =
    ingestRun.format === "transparent_ai_rag_confirmed_local_ingest_run_v1" &&
    hashKnowledge(ingestRun) === receipt.sourceIngestRunHash &&
    ingestRun.registryPath === receipt.sourceRegistryPath &&
    ingestRun.registryHash === receipt.sourceRegistryHash &&
    ingestRun.teacherReviewed === true &&
    ingestRun.ingestedCount >= 1 &&
    ingestRun.rollbackPoint === receipt.rollbackPoint &&
    isRetainedRollbackPoint(receipt.rollbackPoint) &&
    Array.isArray(ingestRun.runs) &&
    ingestRun.runs.length > 0 &&
    JSON.stringify(
      ingestRun.runs.map((row) => ({
        sourceId: row.sourceId,
        indexPath: row.indexPath,
        logicExtractionHint: row.logicExtractionHint || ""
      }))
    ) === JSON.stringify(receipt.localCorpusIndexes || []) &&
    ingestRun.runs.every((row) => row.indexPath && existsSync(row.indexPath) && row.executedCommand?.kind === "node_spawn_no_shell") &&
    ingestRun.locks?.reviewOnly === true &&
    ingestRun.locks?.evidenceOnly === true &&
    ingestRun.locks?.accepted === false &&
    ingestRun.locks?.ruleEnabled === false &&
    ingestRun.locks?.memoryEnabled === false &&
    ingestRun.locks?.softwareActionsExecuted === false &&
    ingestRun.locks?.externalFetchPerformed === false &&
    ingestRun.locks?.packagingUnlocked === false &&
    ingestRun.nextReview?.mayRetrieve === true &&
    ingestRun.nextReview?.mayDraftDisabledRules === true &&
    ingestRun.nextReview?.mayEnableRules === false &&
    ingestRun.nextReview?.mayWriteMemory === false &&
    ingestRun.nextReview?.mayExecuteSoftware === false &&
    ingestRun.nextReview?.mayFetchExternalSources === false &&
    ingestRun.nextReview?.mayUnlockPackaging === false;
  if (
    sourceStillValid &&
    ingestRun.planningLogicEvidenceHash &&
    hashKnowledge(ingestRun.planningLogicEvidence || null) !== ingestRun.planningLogicEvidenceHash
  ) {
    sourceStillValid = false;
  }
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("local_ingest_run_not_still_valid", "The referenced local ingest run, corpus indexes, or rollback point is missing, changed, or unlocked.");
}

if (decision === "confirmed_local_ingest_result_reviewed_ready_for_retrieval_draft_follow_up") {
  if (receipt.localIngestRunReviewed !== true) block("local_ingest_run_review_required", "Teacher must review the local ingest run.");
  if (receipt.localCorpusIndexesReviewed !== true) {
    block("local_corpus_indexes_review_required", "Teacher must review local corpus indexes.");
  }
  if (receipt.retrievalQueryReviewed !== true) block("retrieval_query_review_required", "Teacher must review the retrieval query.");
  if (receipt.logicExtractionHintsReviewed !== true) {
    block("logic_extraction_hints_review_required", "Teacher must review logic extraction hints.");
  }
  if (receipt.teacherConfirmedNoRetrievalDraftRun !== true) {
    block("teacher_no_retrieval_draft_run_confirmation_required", "Teacher must confirm no retrieval draft was run here.");
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
  (decision === "needs_more_local_ingest_evidence" || decision === "correction_to_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required", "Teacher notes are required for local ingest evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "confirmed_local_ingest_result_reviewed_ready_for_retrieval_draft_follow_up" &&
  sourceStillValid &&
  receipt.localIngestRunReviewed === true &&
  receipt.localCorpusIndexesReviewed === true &&
  receipt.retrievalQueryReviewed === true &&
  receipt.logicExtractionHintsReviewed === true &&
  receipt.teacherConfirmedNoRetrievalDraftRun === true &&
  receipt.teacherConfirmedNoExternalFetch === true &&
  receipt.teacherConfirmedNoMemoryOrRuleWrite === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_confirmed_local_ingest_result_decision"
  : ready
    ? "tlcl_rag_confirmed_local_ingest_ready_for_retrieval_draft_follow_up"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_local_ingest_evidence" && blockers.length === 0
        ? "needs_more_local_ingest_evidence_before_retrieval_draft_follow_up"
        : "needs_teacher_review_before_retrieval_draft_follow_up";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualConfirmedRetrievalDraftFollowUpHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_retrieval_draft_follow_up_handoff_v1",
      sourceIngestRunId: builder.sourceIngestRun?.runId || "",
      sourceIngestRunPath: receipt.sourceIngestRunPath || "",
      sourceIngestRunHash: receipt.sourceIngestRunHash || "",
      sourceRegistryPath: receipt.sourceRegistryPath || "",
      sourceRegistryHash: receipt.sourceRegistryHash || "",
      planningLogicEvidenceHash: receipt.planningLogicEvidenceHash || "",
      localCorpusIndexCount: receipt.localCorpusIndexes?.length || 0,
      retrievalQuery: receipt.retrievalQuery || "",
      topK: Number(receipt.topK || 3),
      rollbackPoint: receipt.rollbackPoint || "",
      nextTool: "knowledge/run-rag-confirmed-retrieval-draft.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\run-rag-confirmed-retrieval-draft.mjs --ingest-run "${receipt.sourceIngestRunPath}" --query "${String(receipt.retrievalQuery || "").replace(/"/g, '\\"')}" --top-k "${Number(receipt.topK || 3)}" --rollback-point "${receipt.rollbackPoint}" --teacher-reviewed`,
      instruction:
        "Run only the review-only confirmed retrieval draft as a separate manual step after the local ingest result, corpus indexes, retrieval query, and logic hints are reviewed. Do not fetch external sources, invoke a model, enable rules, write memory, execute target software, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_local_ingest_result",
        sourceConfirmedLocalIngestResultReceiptBuilderId:
          builder.confirmedLocalIngestResultReceiptBuilderId || "",
        sourceIngestRunPath: builder.sourceIngestRunPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the confirmed local ingest result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForConfirmedRetrievalDraftFollowUp: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreLocalIngestEvidence: status === "needs_more_local_ingest_evidence_before_retrieval_draft_follow_up",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceIngestRunPath: receipt.sourceIngestRunPath || "",
    sourceRegistryPath: receipt.sourceRegistryPath || ""
  },
  manualConfirmedRetrievalDraftFollowUpHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_retrieval_draft_from_local_ingest_confirmation",
    "execute_prepared_retrieval_command",
    "fetch_external_sources_from_local_ingest_confirmation",
    "invoke_model_from_local_ingest_confirmation",
    "write_memory_from_local_ingest_confirmation",
    "enable_rule_from_local_ingest_confirmation",
    "unlock_packaging_from_local_ingest_confirmation",
    "claim_completion_from_local_ingest_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-confirmed-local-ingest-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-confirmed-local-ingest-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_CONFIRMED_LOCAL_INGEST_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Confirmed Local Ingest Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run retrieval or draft rules. It only prepares a manual handoff after the local ingest run, corpus indexes, retrieval query, and logic hints are reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForConfirmedRetrievalDraftFollowUp: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreLocalIngestEvidence: validation.needsMoreLocalIngestEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualConfirmedRetrievalDraftFollowUpHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
