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
    String(value || "tlcl-rag-confirmed-source-registry-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-confirmed-source-registry-result-validation"
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
    validatorDoesNotRunLocalIngest: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotFetchExternalSources: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    localIngestRun: false,
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
  argValue("--confirmed-source-registry-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-confirmed-source-registry-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "confirmed_source_registry_result_reviewed_ready_for_local_ingest_follow_up",
  "needs_more_source_registry_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_local_ingest",
  "execute_ingest_command",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG confirmed source registry result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_confirmed_source_registry_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunLocalIngest !== true) {
  block("builder_local_ingest_lock_missing", "Builder must keep local ingest execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceConfirmedSourceRegistryResultReceiptBuilderId !== builder.confirmedSourceRegistryResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRegistryPath !== builder.sourceRegistryPath) {
  block("source_registry_path_mismatch", "Receipt registry path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.sourceRegistryHash !== builder.sourceRegistry?.registryHash) {
  block("source_registry_hash_mismatch", "Receipt registry hash must match builder.");
}
if (receipt.primarySourceValidationHash !== builder.sourceRegistry?.validationHash) {
  block("primary_source_validation_hash_mismatch", "Receipt primary-source validation hash must match builder.");
}
if (receipt.planningLogicEvidenceHash !== builder.sourceRegistry?.planningLogicEvidenceHash) {
  block("planning_logic_evidence_hash_mismatch", "Receipt planningLogicEvidenceHash must match builder.");
}
if (JSON.stringify(receipt.readyLocalSourceIds || []) !== JSON.stringify(builder.sourceRegistry?.readyLocalSourceIds || [])) {
  block("ready_local_source_ids_mismatch", "Receipt readyLocalSourceIds must match builder.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
let registry = null;
try {
  registry = readJson(receipt.sourceRegistryPath);
  sourceStillValid =
    registry.format === "transparent_ai_rag_confirmed_source_registry_package_v1" &&
    registry.sourceRegistryFollowUpKind === "primary_source_evidence_follow_up" &&
    hashKnowledge(registry) === receipt.sourceRegistryHash &&
    registry.validationPath === receipt.sourceRagPrimarySourceEvidenceRequestValidationPath &&
    registry.validationHash === receipt.primarySourceValidationHash &&
    registry.locks?.reviewOnly === true &&
    registry.locks?.evidenceOnly === true &&
    registry.locks?.accepted === false &&
    registry.locks?.ruleEnabled === false &&
    registry.locks?.memoryEnabled === false &&
    registry.locks?.softwareActionsExecuted === false &&
    registry.locks?.externalFetchPerformed === false &&
    registry.locks?.packagingUnlocked === false &&
    registry.nextReview?.mayFetchExternalSources === false &&
    registry.nextReview?.mayExecuteSoftware === false &&
    registry.nextReview?.mayEnableRules === false &&
    registry.nextReview?.mayWriteMemory === false &&
    registry.nextReview?.mayUnlockPackaging === false &&
    Array.isArray(registry.sourceRows) &&
    registry.sourceRows.length > 0 &&
    registry.readyLocalIngestCount >= 1 &&
    JSON.stringify(
      registry.sourceRows
        .filter((row) => row.ingestStatus === "ready_for_review_only_local_corpus_ingest")
        .map((row) => row.sourceId)
    ) === JSON.stringify(receipt.readyLocalSourceIds || []) &&
    isRetainedRollbackPoint(receipt.rollbackPoint);
  if (
    sourceStillValid &&
    registry.planningLogicEvidenceHash &&
    hashKnowledge(registry.planningLogicEvidence || null) !== registry.planningLogicEvidenceHash
  ) {
    sourceStillValid = false;
  }
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("source_registry_package_not_still_valid", "The referenced source registry package, local ingest rows, or rollback point is missing, changed, or unlocked.");
}

if (decision === "confirmed_source_registry_result_reviewed_ready_for_local_ingest_follow_up") {
  if (receipt.sourceRegistryReviewed !== true) block("source_registry_review_required", "Teacher must review the source registry package.");
  if (receipt.sourceRowsReviewed !== true) block("source_rows_review_required", "Teacher must review source rows.");
  if (receipt.localIngestCommandsReviewed !== true) {
    block("local_ingest_commands_review_required", "Teacher must review local ingest command boundaries.");
  }
  if (receipt.logicExtractionHintsReviewed !== true) {
    block("logic_extraction_hints_review_required", "Teacher must review logic extraction hints.");
  }
  if (receipt.blockedExternalReferencesReviewed !== true) {
    block("blocked_external_references_review_required", "Teacher must review blocked external references.");
  }
  if (receipt.teacherConfirmedNoLocalIngestRun !== true) {
    block("teacher_no_local_ingest_run_confirmation_required", "Teacher must confirm no local ingest was run here.");
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
  (decision === "needs_more_source_registry_evidence" || decision === "correction_to_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required", "Teacher notes are required for source registry evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "confirmed_source_registry_result_reviewed_ready_for_local_ingest_follow_up" &&
  sourceStillValid &&
  receipt.sourceRegistryReviewed === true &&
  receipt.sourceRowsReviewed === true &&
  receipt.localIngestCommandsReviewed === true &&
  receipt.logicExtractionHintsReviewed === true &&
  receipt.blockedExternalReferencesReviewed === true &&
  receipt.teacherConfirmedNoLocalIngestRun === true &&
  receipt.teacherConfirmedNoExternalFetch === true &&
  receipt.teacherConfirmedNoMemoryOrRuleWrite === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_confirmed_source_registry_result_decision"
  : ready
    ? "tlcl_rag_confirmed_source_registry_ready_for_local_ingest_follow_up"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_source_registry_evidence" && blockers.length === 0
        ? "needs_more_source_registry_evidence_before_local_ingest_follow_up"
        : "needs_teacher_review_before_local_ingest_follow_up";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualConfirmedLocalIngestFollowUpHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_local_ingest_follow_up_handoff_v1",
      sourceRegistryPackageId: builder.sourceRegistry?.packageId || "",
      sourceRegistryPath: receipt.sourceRegistryPath || "",
      sourceRegistryHash: receipt.sourceRegistryHash || "",
      sourceRagPrimarySourceEvidenceRequestValidationPath:
        receipt.sourceRagPrimarySourceEvidenceRequestValidationPath || "",
      primarySourceValidationHash: receipt.primarySourceValidationHash || "",
      planningLogicEvidenceHash: receipt.planningLogicEvidenceHash || "",
      readyLocalIngestCount: receipt.readyLocalSourceIds?.length || 0,
      readyLocalSourceIds: receipt.readyLocalSourceIds || [],
      rollbackPoint: receipt.rollbackPoint || "",
      nextTool: "knowledge/run-rag-confirmed-local-ingest.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\run-rag-confirmed-local-ingest.mjs --registry "${receipt.sourceRegistryPath}" --source-id "all" --rollback-point "${receipt.rollbackPoint}" --teacher-reviewed`,
      instruction:
        "Run only the review-only confirmed local ingest as a separate manual step for ready local text sources. Do not fetch external sources, invoke a model, enable rules, write memory, execute target software, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_source_registry_result",
        sourceConfirmedSourceRegistryResultReceiptBuilderId:
          builder.confirmedSourceRegistryResultReceiptBuilderId || "",
        sourceRegistryPath: builder.sourceRegistryPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the confirmed source registry result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForConfirmedLocalIngestFollowUp: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreSourceRegistryEvidence: status === "needs_more_source_registry_evidence_before_local_ingest_follow_up",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRegistryPath: receipt.sourceRegistryPath || "",
    sourceRagPrimarySourceEvidenceRequestValidationPath:
      receipt.sourceRagPrimarySourceEvidenceRequestValidationPath || ""
  },
  manualConfirmedLocalIngestFollowUpHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_local_ingest_from_registry_confirmation",
    "execute_prepared_local_ingest_command",
    "fetch_external_sources_from_registry_confirmation",
    "invoke_model_from_registry_confirmation",
    "write_memory_from_registry_confirmation",
    "enable_rule_from_registry_confirmation",
    "unlock_packaging_from_registry_confirmation",
    "claim_completion_from_registry_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-confirmed-source-registry-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-confirmed-source-registry-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_CONFIRMED_SOURCE_REGISTRY_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Confirmed Source Registry Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run local ingest. It only prepares a manual handoff after the registry package, source rows, local ingest command boundaries, and logic hints are reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForConfirmedLocalIngestFollowUp: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreSourceRegistryEvidence: validation.needsMoreSourceRegistryEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualConfirmedLocalIngestFollowUpHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
