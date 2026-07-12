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
    String(value || "tlcl-rag-audit-review-validation-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-audit-review-validation-result"
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
    auditReviewValidationResultReceiptOnly: true,
    builderDoesNotRunFollowUpQueue: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
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
  argValue("--tlcl-audit-review-receipt-template-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const ragValidationInput =
  argValue("--rag-audit-review-validation") ||
  argValue("--audit-review-validation") ||
  argValue("--validation-result");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-audit-review-validation-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: ragValidationInputValue, path: ragValidationInputPath } = readJsonInput(
  ragValidationInput,
  "RAG audit review validation"
);
if (!tlclInputValue || !ragValidationInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt-builder.mjs --tlcl-audit-review-receipt-template-validation <tlcl-validation.json-or-result.json> --rag-audit-review-validation <validation.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL validation"
);
const { packet: ragValidation, packetPath: ragValidationPath } = loadFullPacket(
  ragValidationInputValue,
  ragValidationInputPath,
  "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1",
  ["validationPath"],
  "RAG audit review validation"
);

const handoff = tlclValidation.manualAuditReviewReceiptTemplateHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_audit_review_receipt_template_ready_for_teacher_fill") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for teacher audit review receipt fill.");
}
if (tlclValidation.readyForAuditReviewReceiptTeacherFill !== true) {
  block("tlcl_teacher_fill_flag_missing", "TLCL validation must set readyForAuditReviewReceiptTeacherFill=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_review_receipt_template_handoff_v1"
) {
  block("manual_audit_review_receipt_template_handoff_missing", "TLCL validation must contain the manual audit review receipt template handoff.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotValidateAuditReviewReceipt !== true) {
  block("tlcl_audit_review_validation_execution_lock_missing", "TLCL validation must keep audit review receipt validation locked.");
}

const auditTrailPath = ragValidation.auditTrailPath ? resolve(ragValidation.auditTrailPath) : "";
const auditReceiptPath = ragValidation.receiptPath ? resolve(ragValidation.receiptPath) : "";
let auditTrail = null;
let auditReceipt = null;
if (!auditTrailPath || !existsSync(auditTrailPath)) {
  block("rag_validation_audit_trail_missing", "RAG audit review validation auditTrailPath is missing.");
} else {
  auditTrail = readJson(auditTrailPath);
}
if (!auditReceiptPath || !existsSync(auditReceiptPath)) {
  block("rag_validation_receipt_missing", "RAG audit review validation receiptPath is missing.");
} else {
  auditReceipt = readJson(auditReceiptPath);
}

if (handoff?.auditTrailPath && auditTrailPath && resolve(handoff.auditTrailPath) !== auditTrailPath) {
  block("handoff_audit_trail_path_mismatch", "RAG validation auditTrailPath must match the TLCL handoff.");
}
if (handoff?.auditTrailHash && auditTrail && handoff.auditTrailHash !== hashKnowledge(auditTrail)) {
  block("handoff_audit_trail_hash_mismatch", "TLCL handoff auditTrailHash no longer matches the current audit trail.");
}
if (ragValidation.auditHash && auditTrail && ragValidation.auditHash !== hashKnowledge(auditTrail)) {
  block("rag_validation_audit_hash_mismatch", "RAG validation auditHash no longer matches the current audit trail.");
}
if (auditTrail?.format !== "transparent_ai_rag_delivery_gate_audit_trail_v1") {
  block("audit_trail_format_invalid", "RAG validation audit trail must be transparent_ai_rag_delivery_gate_audit_trail_v1.");
}
if (auditReceipt?.format !== "transparent_ai_rag_delivery_gate_audit_review_receipt_v1") {
  block("audit_review_receipt_format_invalid", "RAG validation receipt must be transparent_ai_rag_delivery_gate_audit_review_receipt_v1.");
}
if (ragValidation.status !== "ready_for_review_only_follow_up_queue") {
  block("rag_validation_status_invalid", "RAG audit review validation must be ready only for review-only follow-up queue planning.");
}
if (ragValidation.nextReview?.mayPrepareReviewOnlyFollowUpQueue !== true) {
  block("rag_validation_follow_up_flag_missing", "RAG validation must allow only review-only follow-up queue preparation.");
}
for (const [key, expected] of [
  ["mayAcceptTechnology", false],
  ["mayEnableRules", false],
  ["mayWriteMemory", false],
  ["mayExecuteSoftware", false],
  ["mayFetchExternalSources", false],
  ["mayOpenDeliveryGate", false],
  ["mayUnlockPackaging", false],
  ["mayClaimGoalComplete", false]
]) {
  if (ragValidation.nextReview?.[key] !== expected) {
    block(`rag_validation_${key}_lock_invalid`, `RAG validation nextReview.${key} must be ${expected}.`);
  }
}
if (
  ragValidation.locks?.reviewOnly !== true ||
  ragValidation.locks?.evidenceOnly !== true ||
  ragValidation.locks?.accepted !== false ||
  ragValidation.locks?.ruleEnabled !== false ||
  ragValidation.locks?.memoryEnabled !== false ||
  ragValidation.locks?.softwareActionsExecuted !== false ||
  ragValidation.locks?.externalFetchPerformed !== false ||
  ragValidation.locks?.packagingUnlocked !== false ||
  ragValidation.locks?.deliveryGateOpen !== false
) {
  block("rag_validation_locks_open", "RAG audit review validation locks must remain closed.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(ragValidation.validationId || "audit-review-validation-result")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_audit_review_validation_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_audit_review_validation_result_receipt";
const validationHash = hashKnowledge(ragValidation);

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_v1",
  sourceAuditReviewValidationResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagAuditReviewValidationId: ragValidation.validationId || "",
  sourceRagAuditReviewValidationPath: ragValidationPath,
  auditTrailPath,
  auditTrailHash: auditTrail ? hashKnowledge(auditTrail) : "",
  auditReviewReceiptPath: auditReceiptPath,
  ragAuditReviewValidationHash: validationHash,
  rollbackPoint: handoff?.rollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "audit_review_validation_result_reviewed_ready_for_follow_up_queue",
    "needs_more_audit_review_validation_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
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
  validationResultReviewed: false,
  auditReviewReceiptReviewed: false,
  followUpQueueCommandReviewed: false,
  teacherConfirmedNoFollowUpQueueCreated: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_builder_v1",
  auditReviewValidationResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagAuditReviewValidationPath: ragValidationPath,
  sourceRagAuditReviewValidation: {
    validationId: ragValidation.validationId || "",
    auditTrailPath,
    receiptPath: auditReceiptPath,
    status: ragValidation.status || "",
    mayPrepareReviewOnlyFollowUpQueue: ragValidation.nextReview?.mayPrepareReviewOnlyFollowUpQueue === true,
    validationHash
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-audit-review-validation-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-audit-review-validation-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_AUDIT_REVIEW_VALIDATION_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_follow_up_queue_from_audit_review_validation_result",
    "auto_run_follow_up_queue_command",
    "invoke_model_from_audit_review_validation_result",
    "fetch_rag_from_audit_review_validation_result",
    "write_memory_from_audit_review_validation_result",
    "enable_rule_from_audit_review_validation_result",
    "unlock_packaging_from_audit_review_validation_result",
    "claim_completion_from_audit_review_validation_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Audit Review Validation Result Receipt",
    "",
    "This packet brings the existing RAG audit review receipt validation result back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG audit review validation: ${ragValidationPath}`,
    `- Existing teacher audit review receipt: ${auditReceiptPath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not create a follow-up queue, execute software, fetch RAG, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_builder_result_v1",
      status,
      auditReviewValidationResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagAuditReviewValidationPath: ragValidationPath,
      auditTrailPath,
      auditReviewReceiptPath: auditReceiptPath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
