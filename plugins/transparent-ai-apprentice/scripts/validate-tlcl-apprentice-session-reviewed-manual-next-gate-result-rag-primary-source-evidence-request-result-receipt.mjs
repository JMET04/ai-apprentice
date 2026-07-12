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
    String(value || "tlcl-rag-primary-source-evidence-request-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-primary-source-evidence-request-result-validation"
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
    validatorDoesNotRunConfirmedSourceRegistryPackage: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotFetchExternalSources: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    confirmedSourceRegistryPackageRun: false,
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
  argValue("--primary-source-evidence-request-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-primary-source-evidence-request-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "primary_source_evidence_request_result_reviewed_ready_for_source_registry_follow_up",
  "needs_more_primary_source_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_confirmed_source_registry_package",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG primary-source evidence request result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_primary_source_evidence_request_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunConfirmedSourceRegistryPackage !== true) {
  block("builder_source_registry_lock_missing", "Builder must keep confirmed source registry package execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourcePrimarySourceEvidenceRequestResultReceiptBuilderId !== builder.primarySourceEvidenceRequestResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRagPrimarySourceEvidenceRequestValidationPath !== builder.sourceRagPrimarySourceEvidenceRequestValidationPath) {
  block("source_primary_source_validation_path_mismatch", "Receipt source primary-source validation path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.primarySourceValidationHash !== builder.sourceRagPrimarySourceEvidenceRequestValidation?.validationHash) {
  block("primary_source_validation_hash_mismatch", "Receipt validation hash must match builder.");
}
if (receipt.sourceRagSelectedFollowUpPlanningPacketPath !== builder.sourceRagPrimarySourceEvidenceRequestValidation?.planningPacketPath) {
  block("source_planning_packet_path_mismatch", "Receipt planning packet path must match builder.");
}
if (receipt.sourcePrimarySourceReceiptPath !== builder.sourceRagPrimarySourceEvidenceRequestValidation?.receiptPath) {
  block("source_primary_source_receipt_path_mismatch", "Receipt source primary-source receipt path must match builder.");
}
if (receipt.planningHash !== builder.sourceRagPrimarySourceEvidenceRequestValidation?.planningHash) {
  block("planning_hash_mismatch", "Receipt planningHash must match builder.");
}
if (receipt.planningLogicEvidenceHash !== builder.sourceRagPrimarySourceEvidenceRequestValidation?.planningLogicEvidenceHash) {
  block("planning_logic_evidence_hash_mismatch", "Receipt planningLogicEvidenceHash must match builder.");
}
if (
  JSON.stringify(receipt.confirmedSources || []) !==
  JSON.stringify(builder.sourceRagPrimarySourceEvidenceRequestValidation?.confirmedSources || [])
) {
  block("confirmed_sources_mismatch", "Receipt confirmedSources must match builder.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
try {
  const validation = readJson(receipt.sourceRagPrimarySourceEvidenceRequestValidationPath);
  const planningPacket = readJson(receipt.sourceRagSelectedFollowUpPlanningPacketPath);
  const primarySourceReceipt = readJson(receipt.sourcePrimarySourceReceiptPath);
  sourceStillValid =
    validation.format === "transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1" &&
    validation.status === "ready_for_review_only_primary_source_registry_follow_up" &&
    validation.planningPacketPath === receipt.sourceRagSelectedFollowUpPlanningPacketPath &&
    validation.receiptPath === receipt.sourcePrimarySourceReceiptPath &&
    hashKnowledge(validation) === receipt.primarySourceValidationHash &&
    hashKnowledge(planningPacket) === receipt.planningHash &&
    primarySourceReceipt.decision === "teacher_provided_primary_sources" &&
    primarySourceReceipt.planningHash === receipt.planningHash &&
    planningPacket.rollbackPointPath === receipt.rollbackPoint &&
    isRetainedRollbackPoint(planningPacket.rollbackPointPath) &&
    Array.isArray(validation.confirmedSources) &&
    validation.confirmedSources.length > 0 &&
    JSON.stringify(validation.confirmedSources || []) === JSON.stringify(receipt.confirmedSources || []) &&
    validation.locks?.reviewOnly === true &&
    validation.locks?.evidenceOnly === true &&
    validation.locks?.accepted === false &&
    validation.locks?.ruleEnabled === false &&
    validation.locks?.memoryEnabled === false &&
    validation.locks?.softwareActionsExecuted === false &&
    validation.locks?.externalFetchPerformed === false &&
    validation.locks?.packagingUnlocked === false &&
    validation.locks?.deliveryGateOpen === false &&
    validation.nextReview?.mayPrepareSourceRegistryFollowUp === true &&
    validation.nextReview?.mayFetchExternalSources === false &&
    validation.nextReview?.mayExecuteSoftware === false &&
    validation.nextReview?.mayEnableRules === false &&
    validation.nextReview?.mayWriteMemory === false &&
    validation.nextReview?.mayUnlockPackaging === false &&
    validation.nextReview?.mayClaimGoalComplete === false;
  if (
    sourceStillValid &&
    validation.planningLogicEvidenceHash &&
    hashKnowledge(validation.planningLogicEvidence || null) !== validation.planningLogicEvidenceHash
  ) {
    sourceStillValid = false;
  }
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("primary_source_validation_source_not_still_valid", "The referenced primary-source validation, receipt, planning packet, or rollback point is missing, changed, or unlocked.");
}

if (decision === "primary_source_evidence_request_result_reviewed_ready_for_source_registry_follow_up") {
  if (receipt.primarySourceEvidenceRequestValidationReviewed !== true) {
    block("primary_source_validation_review_required", "Teacher must review the primary-source validation.");
  }
  if (receipt.confirmedSourcesReviewed !== true) block("confirmed_sources_review_required", "Teacher must review confirmed sources.");
  if (receipt.logicExtractionHintsReviewed !== true) {
    block("logic_extraction_hints_review_required", "Teacher must review logic extraction hints.");
  }
  if (receipt.sourceRegistryCommandReviewed !== true) {
    block("source_registry_command_review_required", "Teacher must review the source registry command boundary.");
  }
  if (receipt.teacherConfirmedNoConfirmedSourceRegistryPackageRun !== true) {
    block("teacher_no_source_registry_package_run_confirmation_required", "Teacher must confirm no source registry package was run here.");
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
  (decision === "needs_more_primary_source_evidence" || decision === "correction_to_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required", "Teacher notes are required for source evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "primary_source_evidence_request_result_reviewed_ready_for_source_registry_follow_up" &&
  sourceStillValid &&
  receipt.primarySourceEvidenceRequestValidationReviewed === true &&
  receipt.confirmedSourcesReviewed === true &&
  receipt.logicExtractionHintsReviewed === true &&
  receipt.sourceRegistryCommandReviewed === true &&
  receipt.teacherConfirmedNoConfirmedSourceRegistryPackageRun === true &&
  receipt.teacherConfirmedNoExternalFetch === true &&
  receipt.teacherConfirmedNoMemoryOrRuleWrite === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_primary_source_evidence_request_result_decision"
  : ready
    ? "tlcl_rag_primary_source_evidence_request_ready_for_confirmed_source_registry_follow_up"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_primary_source_evidence" && blockers.length === 0
        ? "needs_more_primary_source_evidence_before_source_registry_follow_up"
        : "needs_teacher_review_before_source_registry_follow_up";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualConfirmedSourceRegistryFollowUpHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_source_registry_follow_up_handoff_v1",
      sourceRagPrimarySourceEvidenceRequestValidationId:
        builder.sourceRagPrimarySourceEvidenceRequestValidation?.validationId || "",
      sourceRagPrimarySourceEvidenceRequestValidationPath: builder.sourceRagPrimarySourceEvidenceRequestValidationPath || "",
      sourceRagSelectedFollowUpPlanningPacketPath: receipt.sourceRagSelectedFollowUpPlanningPacketPath || "",
      primarySourceValidationHash: receipt.primarySourceValidationHash || "",
      planningHash: receipt.planningHash || "",
      planningLogicEvidenceHash: receipt.planningLogicEvidenceHash || "",
      confirmedSourceCount: receipt.confirmedSources?.length || 0,
      rollbackPoint: receipt.rollbackPoint || "",
      nextTool: "knowledge/create-rag-confirmed-source-registry-package.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-confirmed-source-registry-package.mjs --validation "${receipt.sourceRagPrimarySourceEvidenceRequestValidationPath}"`,
      instruction:
        "Create only the review-only confirmed source registry package as a separate manual step. Do not fetch external sources, execute software, invoke a model, enable rules, write memory, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_primary_source_evidence_request_result",
        sourcePrimarySourceEvidenceRequestResultReceiptBuilderId:
          builder.primarySourceEvidenceRequestResultReceiptBuilderId || "",
        sourceRagPrimarySourceEvidenceRequestValidationPath: builder.sourceRagPrimarySourceEvidenceRequestValidationPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the primary-source evidence request result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForConfirmedSourceRegistryFollowUp: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMorePrimarySourceEvidence: status === "needs_more_primary_source_evidence_before_source_registry_follow_up",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagPrimarySourceEvidenceRequestValidationPath:
      receipt.sourceRagPrimarySourceEvidenceRequestValidationPath || "",
    sourceRagSelectedFollowUpPlanningPacketPath: receipt.sourceRagSelectedFollowUpPlanningPacketPath || ""
  },
  manualConfirmedSourceRegistryFollowUpHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_confirmed_source_registry_package_from_primary_source_confirmation",
    "fetch_external_sources_from_primary_source_confirmation",
    "auto_run_source_registry_command",
    "invoke_model_from_primary_source_confirmation",
    "write_memory_from_primary_source_confirmation",
    "enable_rule_from_primary_source_confirmation",
    "unlock_packaging_from_primary_source_confirmation",
    "claim_completion_from_primary_source_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-primary-source-evidence-request-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-primary-source-evidence-request-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Primary-Source Evidence Request Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not create the confirmed source registry package. It only prepares a manual handoff after primary-source evidence and logic hints are reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForConfirmedSourceRegistryFollowUp: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMorePrimarySourceEvidence: validation.needsMorePrimarySourceEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualConfirmedSourceRegistryFollowUpHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
