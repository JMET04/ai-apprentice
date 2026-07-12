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
    String(value || "tlcl-rag-follow-up-queue-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-follow-up-queue-result"
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

function resultLocks() {
  return {
    reviewOnly: true,
    followUpQueueResultReceiptOnly: true,
    builderDoesNotRunSelectionReceiptBuilder: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    selectionReceiptBuilderRun: false,
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
  argValue("--tlcl-follow-up-queue-handoff-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const followUpQueueInput =
  argValue("--rag-follow-up-queue") ||
  argValue("--follow-up-queue") ||
  argValue("--queue") ||
  argValue("--queue-result");
const outputDir = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-follow-up-queue-result-receipt-builder"))
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: queueInputValue, path: queueInputPath } = readJsonInput(followUpQueueInput, "RAG follow-up queue");
if (!tlclInputValue || !queueInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt-builder.mjs --tlcl-follow-up-queue-handoff-validation <tlcl-validation.json-or-result.json> --rag-follow-up-queue <queue.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL follow-up queue handoff validation"
);
const { packet: followUpQueue, packetPath: followUpQueuePath } = loadFullPacket(
  queueInputValue,
  queueInputPath,
  "transparent_ai_rag_audit_review_follow_up_queue_v1",
  ["queuePath"],
  "RAG follow-up queue"
);

const handoff = tlclValidation.manualFollowUpQueueHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_audit_review_validation_ready_for_follow_up_queue_planning") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual follow-up queue planning.");
}
if (tlclValidation.readyForFollowUpQueuePlanning !== true) {
  block("tlcl_follow_up_queue_ready_flag_missing", "TLCL validation must set readyForFollowUpQueuePlanning=true.");
}
if (
  !handoff ||
  handoff.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_queue_handoff_v1"
) {
  block("manual_follow_up_queue_handoff_missing", "TLCL validation must contain the manual RAG follow-up queue handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-audit-review-follow-up-queue.mjs") {
  block("manual_follow_up_queue_handoff_next_tool_invalid", "TLCL handoff must target the existing RAG follow-up queue builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunFollowUpQueue !== true) {
  block("tlcl_follow_up_queue_execution_lock_missing", "TLCL validation must keep follow-up queue execution locked.");
}

const auditReviewValidationPath = followUpQueue.validationPath ? resolve(followUpQueue.validationPath) : "";
let auditReviewValidation = null;
if (!auditReviewValidationPath || !existsSync(auditReviewValidationPath)) {
  block("follow_up_queue_validation_source_missing", "Follow-up queue validationPath is missing.");
} else {
  auditReviewValidation = readJson(auditReviewValidationPath);
}
if (handoff?.sourceRagAuditReviewValidationPath && auditReviewValidationPath && resolve(handoff.sourceRagAuditReviewValidationPath) !== auditReviewValidationPath) {
  block("handoff_validation_path_mismatch", "Follow-up queue validationPath must match the TLCL handoff source validation.");
}
if (handoff?.auditTrailPath && followUpQueue.auditTrailPath && resolve(handoff.auditTrailPath) !== resolve(followUpQueue.auditTrailPath)) {
  block("handoff_audit_trail_path_mismatch", "Follow-up queue auditTrailPath must match the TLCL handoff audit trail.");
}
if (handoff?.auditTrailHash && followUpQueue.queueItems?.length && handoff.auditTrailHash !== followUpQueue.queueItems[0]?.sourceHash) {
  block("handoff_audit_trail_hash_mismatch", "Follow-up queue audit evidence hash must match the TLCL handoff audit trail hash.");
}
if (handoff?.rollbackPoint && followUpQueue.rollbackPoint && resolve(handoff.rollbackPoint) !== resolve(followUpQueue.rollbackPoint)) {
  block("rollback_point_mismatch", "Follow-up queue rollbackPoint must match the TLCL handoff rollback point.");
}
if (auditReviewValidation?.format !== "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1") {
  block("audit_review_validation_format_invalid", "Follow-up queue must point back to the RAG audit review validation packet.");
}
if (auditReviewValidation && hashKnowledge(auditReviewValidation) !== followUpQueue.validationHash) {
  block("follow_up_queue_validation_hash_mismatch", "Follow-up queue validationHash no longer matches its source validation.");
}
if (
  followUpQueue.status !== "waiting_for_teacher_reviewed_follow_up_selection" ||
  followUpQueue.queueDecision !== "manual_review_only_follow_up_queue_ready" ||
  followUpQueue.locks?.reviewOnly !== true ||
  followUpQueue.locks?.accepted !== false ||
  followUpQueue.locks?.ruleEnabled !== false ||
  followUpQueue.locks?.memoryEnabled !== false ||
  followUpQueue.locks?.softwareActionsExecuted !== false ||
  followUpQueue.locks?.externalFetchPerformed !== false ||
  followUpQueue.locks?.packagingUnlocked !== false ||
  followUpQueue.locks?.deliveryGateOpen !== false ||
  followUpQueue.locks?.queueDoesNotRunCommands !== true ||
  followUpQueue.locks?.queueDoesNotOpenFiles !== true ||
  followUpQueue.locks?.queueDoesNotFetchSources !== true ||
  followUpQueue.locks?.queueDoesNotClaimCompletion !== true
) {
  block("follow_up_queue_locks_open", "RAG follow-up queue must remain a locked review-only manual queue.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(followUpQueue.queueId || "follow-up-queue")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_follow_up_queue_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_follow_up_queue_result_receipt";
const queueHash = hashKnowledge(followUpQueue);

const receipt = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_v1",
  sourceFollowUpQueueResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagFollowUpQueueId: followUpQueue.queueId || "",
  sourceRagFollowUpQueuePath: followUpQueuePath,
  ragFollowUpQueueHash: queueHash,
  sourceRagAuditReviewValidationPath: auditReviewValidationPath,
  ragAuditReviewValidationHash: auditReviewValidation ? hashKnowledge(auditReviewValidation) : "",
  auditTrailPath: followUpQueue.auditTrailPath || "",
  rollbackPoint: followUpQueue.rollbackPoint || handoff?.rollbackPoint || "",
  queueItemsCount: Array.isArray(followUpQueue.queueItems) ? followUpQueue.queueItems.length : 0,
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "follow_up_queue_result_reviewed_ready_for_selection_receipt_builder",
    "needs_more_follow_up_queue_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_selection_receipt_builder",
    "select_follow_up_lane",
    "execute_now",
    "accepted",
    "enable_rule",
    "write_memory",
    "fetch_rag",
    "invoke_model",
    "unlock_packaging",
    "claim_complete"
  ],
  followUpQueueResultReviewed: false,
  queueItemsReviewed: false,
  selectionReceiptBuilderCommandReviewed: false,
  teacherConfirmedNoSelectionReceiptBuilderRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_builder_v1",
  followUpQueueResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagFollowUpQueuePath: followUpQueuePath,
  sourceRagFollowUpQueue: {
    queueId: followUpQueue.queueId || "",
    validationPath: auditReviewValidationPath,
    auditTrailPath: followUpQueue.auditTrailPath || "",
    rollbackPoint: followUpQueue.rollbackPoint || "",
    status: followUpQueue.status || "",
    queueDecision: followUpQueue.queueDecision || "",
    queueHash,
    queueItemsCount: receipt.queueItemsCount
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-follow-up-queue-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-follow-up-queue-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_FOLLOW_UP_QUEUE_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_selection_receipt_builder_from_follow_up_queue_result",
    "auto_run_selection_receipt_builder_command",
    "select_follow_up_lane_from_follow_up_queue_result",
    "invoke_model_from_follow_up_queue_result",
    "fetch_rag_from_follow_up_queue_result",
    "write_memory_from_follow_up_queue_result",
    "enable_rule_from_follow_up_queue_result",
    "unlock_packaging_from_follow_up_queue_result",
    "claim_completion_from_follow_up_queue_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Follow-Up Queue Result Receipt",
    "",
    "This packet brings the separately generated RAG audit-review follow-up queue back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG follow-up queue: ${followUpQueuePath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the selection receipt builder, select a follow-up lane, execute software, fetch RAG, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_builder_result_v1",
      status,
      followUpQueueResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagFollowUpQueuePath: followUpQueuePath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
