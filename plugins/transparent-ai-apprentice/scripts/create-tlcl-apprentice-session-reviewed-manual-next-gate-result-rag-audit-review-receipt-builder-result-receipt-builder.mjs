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
    String(value || "tlcl-rag-audit-review-receipt-builder-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-audit-review-receipt-builder-result"
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

function resultLocks() {
  return {
    reviewOnly: true,
    auditReviewReceiptBuilderResultReceiptOnly: true,
    builderDoesNotValidateAuditReviewReceipt: true,
    builderDoesNotRunFollowUpQueue: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    auditReviewReceiptValidatorRun: false,
    followUpQueueCreated: false,
    commandAutoRun: false,
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
  argValue("--tlcl-audit-review-receipt-planning-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const ragBuilderInput =
  argValue("--rag-audit-review-receipt-builder") ||
  argValue("--audit-review-receipt-builder") ||
  argValue("--builder-result") ||
  argValue("--builder");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-audit-review-receipt-builder-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: ragBuilderInputValue, path: ragBuilderInputPath } = readJsonInput(
  ragBuilderInput,
  "RAG audit review receipt builder"
);
if (!tlclInputValue || !ragBuilderInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt-builder.mjs --tlcl-audit-review-receipt-planning-validation <tlcl-validation.json-or-result.json> --rag-audit-review-receipt-builder <builder.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL validation"
);
const { packet: ragBuilder, packetPath: ragBuilderPath } = loadFullPacket(
  ragBuilderInputValue,
  ragBuilderInputPath,
  "transparent_ai_rag_delivery_gate_audit_review_receipt_builder_v1",
  ["builderPath"],
  "RAG audit review receipt builder"
);

const handoff = tlclValidation.auditReviewReceiptHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_audit_trail_ready_for_audit_review_receipt_planning") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for audit review receipt planning.");
}
if (tlclValidation.readyForAuditReviewReceiptPlanning !== true) {
  block("tlcl_audit_review_receipt_planning_flag_missing", "TLCL validation must set readyForAuditReviewReceiptPlanning=true.");
}
if (
  !handoff ||
  handoff.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_review_receipt_handoff_v1"
) {
  block("manual_audit_review_receipt_handoff_missing", "TLCL validation must contain the manual audit review receipt handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-delivery-gate-audit-review-receipt-builder.mjs") {
  block("handoff_next_tool_mismatch", "Handoff must point to the existing RAG audit review receipt builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunAuditReviewReceiptBuilder !== true) {
  block("tlcl_audit_review_builder_execution_lock_missing", "TLCL validation must keep audit review receipt builder execution locked.");
}

const auditTrailPath = ragBuilder.auditTrailPath ? resolve(ragBuilder.auditTrailPath) : "";
const receiptTemplatePath = ragBuilder.receiptTemplatePath ? resolve(ragBuilder.receiptTemplatePath) : "";
let auditTrail = null;
let receiptTemplate = null;
if (!auditTrailPath || !existsSync(auditTrailPath)) {
  block("rag_builder_audit_trail_missing", "RAG audit review receipt builder auditTrailPath is missing.");
} else {
  auditTrail = readJson(auditTrailPath);
}
if (!receiptTemplatePath || !existsSync(receiptTemplatePath)) {
  block("rag_audit_review_receipt_template_missing", "RAG audit review receipt template path is missing.");
} else {
  receiptTemplate = readJson(receiptTemplatePath);
}

if (handoff?.auditTrailPath && auditTrailPath && resolve(handoff.auditTrailPath) !== auditTrailPath) {
  block("handoff_audit_trail_path_mismatch", "RAG builder auditTrailPath must match the TLCL handoff.");
}
if (handoff?.auditTrailHash && auditTrail && handoff.auditTrailHash !== hashKnowledge(auditTrail)) {
  block("handoff_audit_trail_hash_mismatch", "TLCL handoff auditTrailHash no longer matches the current audit trail.");
}
if (ragBuilder.auditHash && auditTrail && ragBuilder.auditHash !== hashKnowledge(auditTrail)) {
  block("rag_builder_audit_hash_mismatch", "RAG builder auditHash no longer matches the current audit trail.");
}
if (auditTrail?.format !== "transparent_ai_rag_delivery_gate_audit_trail_v1") {
  block("audit_trail_format_invalid", "RAG builder audit trail must be transparent_ai_rag_delivery_gate_audit_trail_v1.");
}
if (auditTrail?.status !== "audit_trail_ready_for_teacher_review") {
  block("audit_trail_status_invalid", "RAG builder audit trail must remain ready for teacher review.");
}
if (
  auditTrail &&
  (auditTrail.locks?.reviewOnly !== true ||
    auditTrail.locks?.evidenceOnly !== true ||
    auditTrail.locks?.accepted !== false ||
    auditTrail.locks?.ruleEnabled !== false ||
    auditTrail.locks?.memoryEnabled !== false ||
    auditTrail.locks?.softwareActionsExecuted !== false ||
    auditTrail.locks?.externalFetchPerformed !== false ||
    auditTrail.locks?.packagingUnlocked !== false ||
    auditTrail.locks?.deliveryGateOpen !== false)
) {
  block("audit_trail_locks_open", "RAG builder audit trail locks must remain closed.");
}
if (receiptTemplate?.format !== "transparent_ai_rag_delivery_gate_audit_review_receipt_v1") {
  block("audit_review_receipt_template_format_invalid", "RAG builder receipt template must be transparent_ai_rag_delivery_gate_audit_review_receipt_v1.");
}
if (receiptTemplate?.auditHash && auditTrail && receiptTemplate.auditHash !== hashKnowledge(auditTrail)) {
  block("audit_review_receipt_template_audit_hash_mismatch", "RAG builder receipt template auditHash must match the current audit trail.");
}
if (!String(ragBuilder.validationCommand || "").includes("validate-rag-delivery-gate-audit-review-receipt.mjs")) {
  block("rag_audit_review_validation_command_missing", "RAG builder validationCommand must point to the existing audit review receipt validator.");
}
if (
  ragBuilder.locks?.reviewOnly !== true ||
  ragBuilder.locks?.evidenceOnly !== true ||
  ragBuilder.locks?.accepted !== false ||
  ragBuilder.locks?.ruleEnabled !== false ||
  ragBuilder.locks?.memoryEnabled !== false ||
  ragBuilder.locks?.softwareActionsExecuted !== false ||
  ragBuilder.locks?.externalFetchPerformed !== false ||
  ragBuilder.locks?.packagingUnlocked !== false ||
  ragBuilder.locks?.deliveryGateOpen !== false
) {
  block("rag_builder_locks_open", "RAG audit review receipt builder locks must remain closed.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(ragBuilder.builderId || "audit-review-builder-result")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_audit_review_receipt_builder_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_audit_review_receipt_builder_result_receipt";

const receipt = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_v1",
  sourceAuditReviewReceiptBuilderResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagAuditReviewReceiptBuilderId: ragBuilder.builderId || "",
  sourceRagAuditReviewReceiptBuilderPath: ragBuilderPath,
  auditTrailPath,
  auditTrailHash: auditTrail ? hashKnowledge(auditTrail) : "",
  receiptTemplatePath,
  validationCommand: ragBuilder.validationCommand || "",
  rollbackPoint: handoff?.rollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "audit_review_receipt_builder_result_reviewed_ready_for_teacher_receipt",
    "needs_more_audit_review_builder_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_audit_review_receipt_validator",
    "run_follow_up_queue",
    "execute_now",
    "accepted",
    "enable_rule",
    "write_memory",
    "fetch_rag",
    "invoke_model",
    "unlock_packaging",
    "claim_complete"
  ],
  builderOutputReviewed: false,
  receiptTemplateReviewed: false,
  validationCommandReviewed: false,
  teacherConfirmedNoValidationRun: false,
  teacherConfirmedNoFollowUpQueue: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_builder_v1",
  auditReviewReceiptBuilderResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagAuditReviewReceiptBuilderPath: ragBuilderPath,
  sourceRagAuditReviewReceiptBuilder: {
    builderId: ragBuilder.builderId || "",
    auditTrailPath,
    auditHash: ragBuilder.auditHash || "",
    receiptTemplatePath,
    validationCommand: ragBuilder.validationCommand || ""
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-audit-review-receipt-builder-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-audit-review-receipt-builder-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_AUDIT_REVIEW_RECEIPT_BUILDER_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_audit_review_receipt_validator_from_builder_result",
    "run_follow_up_queue_from_builder_result",
    "auto_run_audit_review_receipt_validation_command",
    "invoke_model_from_audit_review_builder_result",
    "fetch_rag_from_audit_review_builder_result",
    "write_memory_from_audit_review_builder_result",
    "enable_rule_from_audit_review_builder_result",
    "unlock_packaging_from_audit_review_builder_result",
    "claim_completion_from_audit_review_builder_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Audit Review Receipt Builder Result Receipt",
    "",
    "This packet brings the existing RAG audit review receipt builder output back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing audit review receipt builder: ${ragBuilderPath}`,
    `- Existing audit review receipt template: ${receiptTemplatePath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not validate the audit review receipt, create a follow-up queue, execute software, fetch RAG, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_builder_result_v1",
      status,
      auditReviewReceiptBuilderResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagAuditReviewReceiptBuilderPath: ragBuilderPath,
      auditTrailPath,
      receiptTemplatePathFromRagBuilder: receiptTemplatePath,
      validationCommand: ragBuilder.validationCommand || "",
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
