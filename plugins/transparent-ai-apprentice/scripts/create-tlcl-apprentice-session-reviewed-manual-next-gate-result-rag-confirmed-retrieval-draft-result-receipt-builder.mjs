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
    String(value || "tlcl-rag-confirmed-retrieval-draft-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-confirmed-retrieval-draft-result"
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
    confirmedRetrievalDraftResultReceiptOnly: true,
    builderDoesNotRunRetrievalDraftReviewReceiptBuilder: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotFetchExternalSources: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    retrievalDraftReviewReceiptBuilderRun: false,
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

const tlclValidationInput =
  argValue("--tlcl-confirmed-retrieval-draft-handoff-validation") ||
  argValue("--tlcl-confirmed-local-ingest-result-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const retrievalDraftRunInput =
  argValue("--rag-confirmed-retrieval-draft-run") ||
  argValue("--confirmed-retrieval-draft-run") ||
  argValue("--retrieval-draft-run") ||
  argValue("--draft-run");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-confirmed-retrieval-draft-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: runInputValue, path: runInputPath } = readJsonInput(
  retrievalDraftRunInput,
  "RAG confirmed retrieval draft run"
);
if (!tlclInputValue || !runInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt-builder.mjs --tlcl-confirmed-retrieval-draft-handoff-validation <tlcl-validation.json-or-result.json> --rag-confirmed-retrieval-draft-run <retrieval-draft-run.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL confirmed retrieval draft handoff validation"
);
const { packet: retrievalDraftRun, packetPath: retrievalDraftRunPath } = loadFullPacket(
  runInputValue,
  runInputPath,
  "transparent_ai_rag_confirmed_retrieval_draft_run_v1",
  ["runPath"],
  "RAG confirmed retrieval draft run"
);

const handoff = tlclValidation.manualConfirmedRetrievalDraftFollowUpHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_confirmed_local_ingest_ready_for_retrieval_draft_follow_up") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual confirmed retrieval draft follow-up.");
}
if (tlclValidation.readyForConfirmedRetrievalDraftFollowUp !== true) {
  block("tlcl_retrieval_draft_ready_flag_missing", "TLCL validation must set readyForConfirmedRetrievalDraftFollowUp=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_retrieval_draft_follow_up_handoff_v1"
) {
  block("manual_retrieval_draft_handoff_missing", "TLCL validation must contain the manual confirmed retrieval draft handoff.");
}
if (handoff?.nextTool !== "knowledge/run-rag-confirmed-retrieval-draft.mjs") {
  block("manual_retrieval_draft_handoff_next_tool_invalid", "TLCL handoff must target the existing confirmed retrieval draft runner.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunRetrievalDraft !== true) {
  block("tlcl_retrieval_draft_execution_lock_missing", "Prior TLCL validation must keep retrieval draft execution locked.");
}
if (tlclValidation.locks?.validatorDoesNotFetchRag !== true || tlclValidation.locks?.validatorDoesNotWriteMemory !== true) {
  block("tlcl_result_lock_missing", "Prior TLCL validation must keep RAG fetch and memory writes locked.");
}

if (handoff?.sourceIngestRunPath && resolve(retrievalDraftRun.ingestRunPath || "") !== resolve(handoff.sourceIngestRunPath)) {
  block("retrieval_draft_ingest_run_path_mismatch", "Retrieval draft run ingestRunPath must match the TLCL handoff.");
}
if (retrievalDraftRun.ingestRunHash !== handoff?.sourceIngestRunHash) {
  block("retrieval_draft_ingest_run_hash_mismatch", "Retrieval draft run ingestRunHash must match the TLCL handoff.");
}
if (retrievalDraftRun.query !== handoff?.retrievalQuery) {
  block("retrieval_draft_query_mismatch", "Retrieval draft query must match the TLCL handoff reviewed retrievalQuery.");
}
if (Number(retrievalDraftRun.topK) !== Number(handoff?.topK || 3)) {
  block("retrieval_draft_top_k_mismatch", "Retrieval draft topK must match the TLCL handoff topK.");
}
if (retrievalDraftRun.rollbackPoint !== handoff?.rollbackPoint) {
  block("retrieval_draft_rollback_point_mismatch", "Retrieval draft rollback point must match the TLCL handoff rollback point.");
}
if (!isRetainedRollbackPoint(retrievalDraftRun.rollbackPoint)) {
  block("rollback_point_not_retained", "Retrieval draft rollback point must still be retained.");
}
if (retrievalDraftRun.teacherReviewed !== true) {
  block("retrieval_draft_teacher_review_missing", "Retrieval draft run must be teacher-reviewed.");
}
if (!Array.isArray(retrievalDraftRun.retrievals) || retrievalDraftRun.retrievals.length === 0) {
  block("retrieval_draft_rows_missing", "Retrieval draft run must include at least one retrieval row.");
}
if (retrievalDraftRun.retrievalCount < 1) {
  block("retrieval_draft_no_retrievals", "Retrieval draft run must retrieve from at least one local corpus index.");
}
for (const row of retrievalDraftRun.retrievals || []) {
  const id = row.sourceId || "unknown";
  if (!row.indexPath || !existsSync(row.indexPath)) block(`retrieval_draft_index_missing:${id}`, "Local corpus index must exist.");
  if (!row.retrievalPath || !existsSync(row.retrievalPath)) {
    block(`retrieval_draft_packet_missing:${id}`, "Retrieval evidence packet must exist.");
  }
  if (!String(row.logicExtractionHint || "").trim()) {
    block(`retrieval_draft_logic_hint_missing:${id}`, "Retrieval rows must carry a logic extraction hint.");
  }
  if (row.executedCommand?.kind !== "node_spawn_no_shell") {
    block(`retrieval_draft_no_shell_evidence_missing:${id}`, "Retrieval rows must record no-shell execution evidence.");
  }
  if (row.ruleDraft) {
    if (!row.ruleDraft.rulePath || !existsSync(row.ruleDraft.rulePath)) {
      block(`retrieval_draft_rule_path_missing:${id}`, "Disabled Rule Card draft must exist.");
    }
    if (row.ruleDraft.lifecycle !== "draft_disabled") {
      block(`retrieval_draft_rule_lifecycle_invalid:${id}`, "Rule Card drafts must remain draft_disabled.");
    }
    if (row.ruleDraft.executedCommand?.kind !== "node_spawn_no_shell") {
      block(`retrieval_draft_rule_no_shell_evidence_missing:${id}`, "Rule draft rows must record no-shell execution evidence.");
    }
  }
}
if (
  retrievalDraftRun.planningLogicEvidenceHash &&
  hashKnowledge(retrievalDraftRun.planningLogicEvidence || null) !== retrievalDraftRun.planningLogicEvidenceHash
) {
  block("retrieval_draft_planning_logic_evidence_hash_mismatch", "Retrieval draft planning logic evidence hash no longer matches.");
}
if (
  retrievalDraftRun.nextReview?.planningLogicEvidenceHash &&
  retrievalDraftRun.nextReview.planningLogicEvidenceHash !== retrievalDraftRun.planningLogicEvidenceHash
) {
  block("retrieval_draft_next_review_planning_logic_hash_mismatch", "Retrieval draft nextReview planning logic hash must match.");
}
if (
  retrievalDraftRun.locks?.reviewOnly !== true ||
  retrievalDraftRun.locks?.evidenceOnly !== true ||
  retrievalDraftRun.locks?.accepted !== false ||
  retrievalDraftRun.locks?.ruleEnabled !== false ||
  retrievalDraftRun.locks?.memoryEnabled !== false ||
  retrievalDraftRun.locks?.softwareActionsExecuted !== false ||
  retrievalDraftRun.locks?.externalFetchPerformed !== false ||
  retrievalDraftRun.locks?.packagingUnlocked !== false ||
  retrievalDraftRun.nextReview?.mayEnableRules !== false ||
  retrievalDraftRun.nextReview?.mayWriteMemory !== false ||
  retrievalDraftRun.nextReview?.mayExecuteSoftware !== false ||
  retrievalDraftRun.nextReview?.mayFetchExternalSources !== false ||
  retrievalDraftRun.nextReview?.mayUnlockPackaging !== false
) {
  block("retrieval_draft_locks_open", "Retrieval draft run must remain locked and review-only.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(retrievalDraftRun.runId || "confirmed-retrieval-draft")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_confirmed_retrieval_draft_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_confirmed_retrieval_draft_result_receipt";
const retrievalDraftRunHash = hashKnowledge(retrievalDraftRun);
const retrievalRows = (retrievalDraftRun.retrievals || []).map((row) => ({
  sourceId: row.sourceId,
  indexPath: row.indexPath,
  retrievalPath: row.retrievalPath,
  retrievalStatus: row.retrievalStatus,
  chunkCount: row.chunkCount || 0,
  logicExtractionHint: row.logicExtractionHint || "",
  rulePath: row.ruleDraft?.rulePath || "",
  ruleLifecycle: row.ruleDraft?.lifecycle || "",
  evidenceRefs: row.ruleDraft?.evidenceRefs || []
}));

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_v1",
  sourceConfirmedRetrievalDraftResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRetrievalDraftRunId: retrievalDraftRun.runId || "",
  sourceRetrievalDraftRunPath: retrievalDraftRunPath,
  sourceRetrievalDraftRunHash: retrievalDraftRunHash,
  sourceIngestRunPath: retrievalDraftRun.ingestRunPath || "",
  sourceIngestRunHash: retrievalDraftRun.ingestRunHash || "",
  planningLogicEvidenceHash: retrievalDraftRun.planningLogicEvidenceHash || "",
  rollbackPoint: retrievalDraftRun.rollbackPoint || handoff?.rollbackPoint || "",
  retrievalQuery: retrievalDraftRun.query || "",
  topK: Number(retrievalDraftRun.topK || 3),
  retrievalRows,
  evidenceFoundCount: retrievalDraftRun.evidenceFoundCount || 0,
  ruleDraftCount: retrievalDraftRun.ruleDraftCount || 0,
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "confirmed_retrieval_draft_result_reviewed_ready_for_review_receipt_follow_up",
    "needs_more_retrieval_draft_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
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
  ],
  retrievalDraftRunReviewed: false,
  retrievalRowsReviewed: false,
  retrievalChunksReviewed: false,
  disabledRuleDraftsReviewed: false,
  logicExtractionHintsReviewed: false,
  teacherConfirmedNoReviewReceiptBuilderRun: false,
  teacherConfirmedNoRuleDslValidationRun: false,
  teacherConfirmedNoExternalFetch: false,
  teacherConfirmedNoMemoryOrRuleWrite: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_builder_v1",
  confirmedRetrievalDraftResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRetrievalDraftRunPath: retrievalDraftRunPath,
  sourceRetrievalDraftRun: {
    runId: retrievalDraftRun.runId || "",
    retrievalDraftRunHash,
    ingestRunPath: retrievalDraftRun.ingestRunPath || "",
    ingestRunHash: retrievalDraftRun.ingestRunHash || "",
    query: retrievalDraftRun.query || "",
    topK: Number(retrievalDraftRun.topK || 3),
    evidenceFoundCount: retrievalDraftRun.evidenceFoundCount || 0,
    ruleDraftCount: retrievalDraftRun.ruleDraftCount || 0,
    planningLogicEvidenceHash: retrievalDraftRun.planningLogicEvidenceHash || "",
    retrievalRows
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-confirmed-retrieval-draft-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-confirmed-retrieval-draft-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_CONFIRMED_RETRIEVAL_DRAFT_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_retrieval_draft_review_receipt_builder_from_retrieval_draft_result",
    "auto_run_review_receipt_builder_command",
    "run_rule_dsl_validation_from_retrieval_draft_result",
    "fetch_external_sources_from_retrieval_draft_result",
    "invoke_model_from_retrieval_draft_result",
    "write_memory_from_retrieval_draft_result",
    "enable_rule_from_retrieval_draft_result",
    "unlock_packaging_from_retrieval_draft_result",
    "claim_completion_from_retrieval_draft_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Confirmed Retrieval Draft Result Receipt",
    "",
    "This packet brings the separately created confirmed retrieval draft run back into the TLCL teacher-review loop before the detailed retrieval draft review receipt builder.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG confirmed retrieval draft run: ${retrievalDraftRunPath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not build the review receipt, validate Rule DSL, fetch external sources, invoke a model, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_builder_result_v1",
      status,
      confirmedRetrievalDraftResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRetrievalDraftRunPath: retrievalDraftRunPath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
