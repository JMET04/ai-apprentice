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
    String(value || "tlcl-rag-primary-source-evidence-request-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-primary-source-evidence-request-result"
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
    primarySourceEvidenceRequestResultReceiptOnly: true,
    builderDoesNotRunConfirmedSourceRegistryPackage: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotFetchExternalSources: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
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

const tlclValidationInput =
  argValue("--tlcl-primary-source-evidence-request-handoff-validation") ||
  argValue("--tlcl-selected-follow-up-planning-result-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const primarySourceValidationInput =
  argValue("--rag-primary-source-evidence-request-validation") ||
  argValue("--primary-source-evidence-request-validation") ||
  argValue("--primary-source-validation") ||
  argValue("--validation-result");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-primary-source-evidence-request-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: primaryInputValue, path: primaryInputPath } = readJsonInput(
  primarySourceValidationInput,
  "RAG primary-source evidence request validation"
);
if (!tlclInputValue || !primaryInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt-builder.mjs --tlcl-primary-source-evidence-request-handoff-validation <tlcl-validation.json-or-result.json> --rag-primary-source-evidence-request-validation <primary-source-validation.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL primary-source evidence request handoff validation"
);
const { packet: primarySourceValidation, packetPath: primarySourceValidationPath } = loadFullPacket(
  primaryInputValue,
  primaryInputPath,
  "transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1",
  ["validationPath"],
  "RAG primary-source evidence request validation"
);

const handoff = tlclValidation.manualPrimarySourceEvidenceRequestReceiptBuilderHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_selected_follow_up_planning_ready_for_primary_source_evidence_request_receipt_builder") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual primary-source evidence request receipt building.");
}
if (tlclValidation.readyForPrimarySourceEvidenceRequestReceiptBuilder !== true) {
  block("tlcl_primary_source_request_ready_flag_missing", "TLCL validation must set readyForPrimarySourceEvidenceRequestReceiptBuilder=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_primary_source_evidence_request_receipt_builder_handoff_v1"
) {
  block("manual_primary_source_request_handoff_missing", "TLCL validation must contain the manual primary-source request handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-primary-source-evidence-request-receipt-builder.mjs") {
  block("manual_primary_source_request_handoff_next_tool_invalid", "TLCL handoff must target the existing primary-source evidence request receipt builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunPrimarySourceEvidenceRequestReceiptBuilder !== true) {
  block("tlcl_primary_source_request_execution_lock_missing", "Prior TLCL validation must keep primary-source request builder execution locked.");
}
if (tlclValidation.locks?.validatorDoesNotFetchRag !== true || tlclValidation.locks?.validatorDoesNotWriteMemory !== true) {
  block("tlcl_result_lock_missing", "Prior TLCL validation must keep RAG fetch and memory writes locked.");
}

if (primarySourceValidation.status !== "ready_for_review_only_primary_source_registry_follow_up") {
  block("primary_source_validation_not_ready", "Primary-source validation must be ready only for review-only source registry follow-up.");
}
if (!Array.isArray(primarySourceValidation.confirmedSources) || primarySourceValidation.confirmedSources.length === 0) {
  block("confirmed_sources_missing", "Primary-source validation must include confirmedSources.");
}
if (primarySourceValidation.planningPacketPath && handoff?.sourceRagSelectedFollowUpPlanningPacketPath) {
  if (resolve(primarySourceValidation.planningPacketPath) !== resolve(handoff.sourceRagSelectedFollowUpPlanningPacketPath)) {
    block("planning_packet_path_mismatch", "Primary-source validation planningPacketPath must match the TLCL handoff planning packet.");
  }
}

let planningPacket = null;
let primarySourceReceipt = null;
if (!primarySourceValidation.planningPacketPath || !existsSync(primarySourceValidation.planningPacketPath)) {
  block("primary_source_validation_planning_packet_missing", "Primary-source validation planningPacketPath is missing.");
} else {
  planningPacket = readJson(primarySourceValidation.planningPacketPath);
}
if (!primarySourceValidation.receiptPath || !existsSync(primarySourceValidation.receiptPath)) {
  block("primary_source_validation_receipt_missing", "Primary-source validation receiptPath is missing.");
} else {
  primarySourceReceipt = readJson(primarySourceValidation.receiptPath);
}
if (planningPacket && hashKnowledge(planningPacket) !== primarySourceValidation.planningHash) {
  block("primary_source_validation_planning_hash_mismatch", "Primary-source validation planningHash no longer matches the planning packet.");
}
if (planningPacket?.rollbackPointPath && !isRetainedRollbackPoint(planningPacket.rollbackPointPath)) {
  block("rollback_point_not_retained", "Planning packet must still reference a retained rollback point.");
}
if (primarySourceReceipt?.decision !== "teacher_provided_primary_sources") {
  block("primary_source_receipt_decision_invalid", "The teacher-filled primary-source receipt must provide primary sources.");
}
if (primarySourceReceipt?.planningHash !== primarySourceValidation.planningHash) {
  block("primary_source_receipt_planning_hash_mismatch", "Primary-source receipt planningHash must match validation.");
}
if (
  primarySourceValidation.planningLogicEvidenceHash &&
  hashKnowledge(primarySourceValidation.planningLogicEvidence || null) !== primarySourceValidation.planningLogicEvidenceHash
) {
  block("primary_source_planning_logic_evidence_hash_mismatch", "Primary-source validation planning logic evidence hash no longer matches.");
}
if (
  primarySourceValidation.nextReview?.planningLogicEvidenceHash &&
  primarySourceValidation.nextReview.planningLogicEvidenceHash !== primarySourceValidation.planningLogicEvidenceHash
) {
  block("primary_source_next_review_planning_logic_hash_mismatch", "Primary-source validation nextReview planning logic hash must match.");
}
for (const source of primarySourceValidation.confirmedSources || []) {
  const id = source.source_id || "unknown";
  if (source.review?.review_only !== true) block(`confirmed_source_review_only_missing:${id}`, "Confirmed source must remain review-only.");
  if (source.review?.accepted !== false) block(`confirmed_source_acceptance_lock_open:${id}`, "Confirmed source must not be accepted.");
  if (source.review?.packaging_gated !== true) block(`confirmed_source_packaging_gate_missing:${id}`, "Confirmed source must remain packaging gated.");
  if (!String(source.review?.logic_extraction_hint || "").trim()) {
    block(`confirmed_source_logic_hint_missing:${id}`, "Confirmed source must include a logic extraction hint.");
  }
}
if (
  primarySourceValidation.locks?.reviewOnly !== true ||
  primarySourceValidation.locks?.evidenceOnly !== true ||
  primarySourceValidation.locks?.accepted !== false ||
  primarySourceValidation.locks?.ruleEnabled !== false ||
  primarySourceValidation.locks?.memoryEnabled !== false ||
  primarySourceValidation.locks?.softwareActionsExecuted !== false ||
  primarySourceValidation.locks?.externalFetchPerformed !== false ||
  primarySourceValidation.locks?.packagingUnlocked !== false ||
  primarySourceValidation.locks?.deliveryGateOpen !== false ||
  primarySourceValidation.nextReview?.mayPrepareSourceRegistryFollowUp !== true ||
  primarySourceValidation.nextReview?.mayFetchExternalSources !== false ||
  primarySourceValidation.nextReview?.mayExecuteSoftware !== false ||
  primarySourceValidation.nextReview?.mayEnableRules !== false ||
  primarySourceValidation.nextReview?.mayWriteMemory !== false ||
  primarySourceValidation.nextReview?.mayUnlockPackaging !== false ||
  primarySourceValidation.nextReview?.mayClaimGoalComplete !== false
) {
  block("primary_source_validation_locks_open", "Primary-source validation must remain locked and review-only.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(primarySourceValidation.validationId || "primary-source-evidence-request")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_primary_source_evidence_request_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_primary_source_evidence_request_result_receipt";
const validationHash = hashKnowledge(primarySourceValidation);

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_v1",
  sourcePrimarySourceEvidenceRequestResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagPrimarySourceEvidenceRequestValidationId: primarySourceValidation.validationId || "",
  sourceRagPrimarySourceEvidenceRequestValidationPath: primarySourceValidationPath,
  primarySourceValidationHash: validationHash,
  sourceRagSelectedFollowUpPlanningPacketPath: primarySourceValidation.planningPacketPath || "",
  sourcePrimarySourceReceiptPath: primarySourceValidation.receiptPath || "",
  planningHash: primarySourceValidation.planningHash || "",
  planningLogicEvidenceHash: primarySourceValidation.planningLogicEvidenceHash || "",
  rollbackPoint: planningPacket?.rollbackPointPath || handoff?.rollbackPoint || "",
  confirmedSources: primarySourceValidation.confirmedSources || [],
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "primary_source_evidence_request_result_reviewed_ready_for_source_registry_follow_up",
    "needs_more_primary_source_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
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
  ],
  primarySourceEvidenceRequestValidationReviewed: false,
  confirmedSourcesReviewed: false,
  logicExtractionHintsReviewed: false,
  sourceRegistryCommandReviewed: false,
  teacherConfirmedNoConfirmedSourceRegistryPackageRun: false,
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
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_builder_v1",
  primarySourceEvidenceRequestResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagPrimarySourceEvidenceRequestValidationPath: primarySourceValidationPath,
  sourceRagPrimarySourceEvidenceRequestValidation: {
    validationId: primarySourceValidation.validationId || "",
    validationHash,
    planningPacketPath: primarySourceValidation.planningPacketPath || "",
    receiptPath: primarySourceValidation.receiptPath || "",
    planningHash: primarySourceValidation.planningHash || "",
    planningLogicEvidenceHash: primarySourceValidation.planningLogicEvidenceHash || "",
    confirmedSourceCount: primarySourceValidation.confirmedSources?.length || 0,
    confirmedSources: primarySourceValidation.confirmedSources || []
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-primary-source-evidence-request-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-primary-source-evidence-request-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_confirmed_source_registry_package_from_primary_source_validation",
    "auto_run_source_registry_command",
    "fetch_external_sources_from_primary_source_validation",
    "invoke_model_from_primary_source_validation",
    "write_memory_from_primary_source_validation",
    "enable_rule_from_primary_source_validation",
    "unlock_packaging_from_primary_source_validation",
    "claim_completion_from_primary_source_validation"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Primary-Source Evidence Request Result Receipt",
    "",
    "This packet brings the separately validated primary-source evidence request result back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG primary-source validation: ${primarySourceValidationPath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not create the confirmed source registry package, fetch external sources, execute software, invoke a model, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_builder_result_v1",
      status,
      primarySourceEvidenceRequestResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagPrimarySourceEvidenceRequestValidationPath: primarySourceValidationPath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
