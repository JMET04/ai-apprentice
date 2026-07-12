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
    String(value || "tlcl-rag-confirmed-local-ingest-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-confirmed-local-ingest-result"
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
    confirmedLocalIngestResultReceiptOnly: true,
    builderDoesNotRunRetrievalDraft: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotFetchExternalSources: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
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

const tlclValidationInput =
  argValue("--tlcl-confirmed-local-ingest-handoff-validation") ||
  argValue("--tlcl-confirmed-source-registry-result-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const ingestRunInput =
  argValue("--rag-confirmed-local-ingest-run") ||
  argValue("--confirmed-local-ingest-run") ||
  argValue("--local-ingest-run") ||
  argValue("--ingest-run");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-confirmed-local-ingest-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: ingestInputValue, path: ingestInputPath } = readJsonInput(ingestRunInput, "RAG confirmed local ingest run");
if (!tlclInputValue || !ingestInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt-builder.mjs --tlcl-confirmed-local-ingest-handoff-validation <tlcl-validation.json-or-result.json> --rag-confirmed-local-ingest-run <ingest-run.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL confirmed local ingest handoff validation"
);
const { packet: ingestRun, packetPath: ingestRunPath } = loadFullPacket(
  ingestInputValue,
  ingestInputPath,
  "transparent_ai_rag_confirmed_local_ingest_run_v1",
  ["runPath"],
  "RAG confirmed local ingest run"
);

const handoff = tlclValidation.manualConfirmedLocalIngestFollowUpHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_confirmed_source_registry_ready_for_local_ingest_follow_up") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual confirmed local ingest follow-up.");
}
if (tlclValidation.readyForConfirmedLocalIngestFollowUp !== true) {
  block("tlcl_local_ingest_ready_flag_missing", "TLCL validation must set readyForConfirmedLocalIngestFollowUp=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_local_ingest_follow_up_handoff_v1"
) {
  block("manual_local_ingest_handoff_missing", "TLCL validation must contain the manual confirmed local ingest handoff.");
}
if (handoff?.nextTool !== "knowledge/run-rag-confirmed-local-ingest.mjs") {
  block("manual_local_ingest_handoff_next_tool_invalid", "TLCL handoff must target the existing confirmed local ingest runner.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunLocalIngest !== true) {
  block("tlcl_local_ingest_execution_lock_missing", "Prior TLCL validation must keep local ingest execution locked.");
}
if (tlclValidation.locks?.validatorDoesNotFetchRag !== true || tlclValidation.locks?.validatorDoesNotWriteMemory !== true) {
  block("tlcl_result_lock_missing", "Prior TLCL validation must keep RAG fetch and memory writes locked.");
}

if (handoff?.sourceRegistryPath && resolve(ingestRun.registryPath || "") !== resolve(handoff.sourceRegistryPath)) {
  block("ingest_run_registry_path_mismatch", "Ingest run registryPath must match the TLCL handoff registry path.");
}
if (ingestRun.registryHash !== handoff?.sourceRegistryHash) {
  block("ingest_run_registry_hash_mismatch", "Ingest run registryHash must match the TLCL handoff registry hash.");
}
if (ingestRun.rollbackPoint !== handoff?.rollbackPoint) {
  block("ingest_run_rollback_point_mismatch", "Ingest run rollback point must match the TLCL handoff rollback point.");
}
if (!isRetainedRollbackPoint(ingestRun.rollbackPoint)) {
  block("rollback_point_not_retained", "Ingest run rollback point must still be retained.");
}
if (ingestRun.teacherReviewed !== true) {
  block("ingest_run_teacher_review_missing", "Ingest run must be teacher-reviewed.");
}
if (!Array.isArray(ingestRun.runs) || ingestRun.runs.length === 0) {
  block("ingest_run_rows_missing", "Ingest run must include at least one local corpus run.");
}
if (ingestRun.ingestedCount < 1) {
  block("ingest_run_no_indexes", "Ingest run must create at least one local corpus index before retrieval follow-up.");
}
for (const row of ingestRun.runs || []) {
  const id = row.sourceId || "unknown";
  if (!row.indexPath || !existsSync(row.indexPath)) block(`ingest_run_index_missing:${id}`, "Local corpus index must exist.");
  if (!String(row.logicExtractionHint || "").trim()) {
    block(`ingest_run_logic_hint_missing:${id}`, "Local ingest rows must carry a logic extraction hint.");
  }
  if (row.executedCommand?.kind !== "node_spawn_no_shell") {
    block(`ingest_run_no_shell_evidence_missing:${id}`, "Local ingest rows must record no-shell execution evidence.");
  }
}
if (
  ingestRun.planningLogicEvidenceHash &&
  hashKnowledge(ingestRun.planningLogicEvidence || null) !== ingestRun.planningLogicEvidenceHash
) {
  block("ingest_run_planning_logic_evidence_hash_mismatch", "Ingest run planning logic evidence hash no longer matches.");
}
if (
  ingestRun.nextReview?.planningLogicEvidenceHash &&
  ingestRun.nextReview.planningLogicEvidenceHash !== ingestRun.planningLogicEvidenceHash
) {
  block("ingest_run_next_review_planning_logic_hash_mismatch", "Ingest run nextReview planning logic hash must match.");
}
if (
  ingestRun.locks?.reviewOnly !== true ||
  ingestRun.locks?.evidenceOnly !== true ||
  ingestRun.locks?.accepted !== false ||
  ingestRun.locks?.ruleEnabled !== false ||
  ingestRun.locks?.memoryEnabled !== false ||
  ingestRun.locks?.softwareActionsExecuted !== false ||
  ingestRun.locks?.externalFetchPerformed !== false ||
  ingestRun.locks?.packagingUnlocked !== false ||
  ingestRun.nextReview?.mayRetrieve !== true ||
  ingestRun.nextReview?.mayDraftDisabledRules !== true ||
  ingestRun.nextReview?.mayEnableRules !== false ||
  ingestRun.nextReview?.mayWriteMemory !== false ||
  ingestRun.nextReview?.mayExecuteSoftware !== false ||
  ingestRun.nextReview?.mayFetchExternalSources !== false ||
  ingestRun.nextReview?.mayUnlockPackaging !== false
) {
  block("ingest_run_locks_open", "Ingest run must remain locked and review-only.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(ingestRun.runId || "confirmed-local-ingest")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_confirmed_local_ingest_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_confirmed_local_ingest_result_receipt";
const ingestRunHash = hashKnowledge(ingestRun);
const localCorpusIndexes = (ingestRun.runs || []).map((row) => ({
  sourceId: row.sourceId,
  indexPath: row.indexPath,
  logicExtractionHint: row.logicExtractionHint || ""
}));
const defaultRetrievalQuery =
  localCorpusIndexes.find((row) => row.logicExtractionHint)?.logicExtractionHint ||
  "Retrieve evidence for the teacher-confirmed data-to-output logic relationship.";

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_v1",
  sourceConfirmedLocalIngestResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceIngestRunId: ingestRun.runId || "",
  sourceIngestRunPath: ingestRunPath,
  sourceIngestRunHash: ingestRunHash,
  sourceRegistryPath: ingestRun.registryPath || "",
  sourceRegistryHash: ingestRun.registryHash || "",
  planningLogicEvidenceHash: ingestRun.planningLogicEvidenceHash || "",
  rollbackPoint: ingestRun.rollbackPoint || handoff?.rollbackPoint || "",
  localCorpusIndexes,
  retrievalQuery: defaultRetrievalQuery,
  topK: 3,
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "confirmed_local_ingest_result_reviewed_ready_for_retrieval_draft_follow_up",
    "needs_more_local_ingest_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
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
  ],
  localIngestRunReviewed: false,
  localCorpusIndexesReviewed: false,
  retrievalQueryReviewed: false,
  logicExtractionHintsReviewed: false,
  teacherConfirmedNoRetrievalDraftRun: false,
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
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_builder_v1",
  confirmedLocalIngestResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceIngestRunPath: ingestRunPath,
  sourceIngestRun: {
    runId: ingestRun.runId || "",
    ingestRunHash,
    registryPath: ingestRun.registryPath || "",
    registryHash: ingestRun.registryHash || "",
    sourceId: ingestRun.sourceId || "",
    ingestedCount: ingestRun.ingestedCount || 0,
    skippedNonLocalCount: ingestRun.skippedNonLocalCount || 0,
    planningLogicEvidenceHash: ingestRun.planningLogicEvidenceHash || "",
    localCorpusIndexes
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-confirmed-local-ingest-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-confirmed-local-ingest-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_CONFIRMED_LOCAL_INGEST_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_retrieval_draft_from_local_ingest_result",
    "auto_run_retrieval_command",
    "fetch_external_sources_from_local_ingest_result",
    "invoke_model_from_local_ingest_result",
    "write_memory_from_local_ingest_result",
    "enable_rule_from_local_ingest_result",
    "unlock_packaging_from_local_ingest_result",
    "claim_completion_from_local_ingest_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Confirmed Local Ingest Result Receipt",
    "",
    "This packet brings the separately created confirmed local ingest run back into the TLCL teacher-review loop before retrieval drafting.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG confirmed local ingest run: ${ingestRunPath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run retrieval, draft rules, fetch external sources, invoke a model, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_builder_result_v1",
      status,
      confirmedLocalIngestResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceIngestRunPath: ingestRunPath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
