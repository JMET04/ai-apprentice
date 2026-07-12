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
    String(value || "tlcl-rag-selection-receipt-validation-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-selection-receipt-validation-result"
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
    selectionReceiptValidationResultReceiptOnly: true,
    builderDoesNotRunSelectedFollowUpPlanningPacket: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotSelectFollowUpLane: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    selectedFollowUpPlanningPacketRun: false,
    commandAutoRun: false,
    followUpLaneSelected: false,
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
  argValue("--tlcl-selection-receipt-validation-handoff-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const selectionValidationInput =
  argValue("--rag-selection-receipt-validation") ||
  argValue("--selection-receipt-validation") ||
  argValue("--validation-result");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-selection-receipt-validation-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: selectionValidationInputValue, path: selectionValidationInputPath } = readJsonInput(
  selectionValidationInput,
  "RAG selection receipt validation"
);
if (!tlclInputValue || !selectionValidationInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt-builder.mjs --tlcl-selection-receipt-validation-handoff-validation <tlcl-validation.json-or-result.json> --rag-selection-receipt-validation <selection-validation.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL selection receipt validation handoff validation"
);
const { packet: selectionValidation, packetPath: selectionValidationPath } = loadFullPacket(
  selectionValidationInputValue,
  selectionValidationInputPath,
  "transparent_ai_rag_follow_up_queue_selection_receipt_validation_v1",
  ["validationPath"],
  "RAG follow-up queue selection receipt validation"
);

const handoff = tlclValidation.manualSelectionReceiptValidationHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_selection_receipt_builder_ready_for_selection_receipt_validation") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual selection receipt validation.");
}
if (tlclValidation.readyForSelectionReceiptValidation !== true) {
  block("tlcl_selection_receipt_validation_ready_flag_missing", "TLCL validation must set readyForSelectionReceiptValidation=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_selection_receipt_validation_handoff_v1"
) {
  block("manual_selection_receipt_validation_handoff_missing", "TLCL validation must contain the manual selection receipt validation handoff.");
}
if (handoff?.nextTool !== "knowledge/validate-rag-follow-up-queue-selection-receipt.mjs") {
  block("manual_selection_receipt_validation_handoff_next_tool_invalid", "TLCL handoff must target the existing selection receipt validator.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunSelectionReceiptValidation !== true) {
  block("tlcl_selection_receipt_validation_execution_lock_missing", "Prior TLCL validation must keep selection receipt validation execution locked.");
}
if (tlclValidation.locks?.validatorDoesNotSelectFollowUpLane !== true) {
  block("tlcl_follow_up_lane_selection_lock_missing", "Prior TLCL validation must not select a follow-up lane.");
}

const queuePath = selectionValidation.queuePath ? resolve(selectionValidation.queuePath) : "";
let queue = null;
if (!queuePath || !existsSync(queuePath)) {
  block("selection_receipt_validation_queue_missing", "Selection receipt validation queuePath is missing.");
} else {
  queue = readJson(queuePath);
}
if (handoff?.sourceRagFollowUpQueuePath && queuePath && resolve(handoff.sourceRagFollowUpQueuePath) !== queuePath) {
  block("handoff_follow_up_queue_path_mismatch", "Selection receipt validation queuePath must match the TLCL handoff source queue.");
}
if (queue && hashKnowledge(queue) !== handoff?.ragFollowUpQueueHash) {
  block("selection_receipt_validation_queue_hash_mismatch", "Source queue no longer matches the TLCL handoff queue hash.");
}
if (selectionValidation.queueHash !== handoff?.ragFollowUpQueueHash) {
  block("selection_receipt_validation_recorded_queue_hash_mismatch", "Selection receipt validation queueHash must match the TLCL handoff queue hash.");
}
if (handoff?.receiptTemplatePath && !existsSync(handoff.receiptTemplatePath)) {
  block("selection_receipt_template_missing", "The teacher receipt template referenced by the TLCL handoff is missing.");
}
if (selectionValidation.status !== "ready_for_selected_review_only_rag_follow_up") {
  block("selection_receipt_validation_not_ready", "Selection receipt validation must be ready for selected review-only RAG follow-up.");
}
if (!selectionValidation.selectedFollowUp) {
  block("selected_follow_up_missing", "Selection receipt validation must contain one selectedFollowUp.");
}
const allowedSelectedFollowUps = new Set([
  "request_more_primary_sources",
  "prepare_disabled_rule_rewrite_review",
  "add_validator_coverage_review",
  "prepare_next_teacher_receipt"
]);
if (!allowedSelectedFollowUps.has(selectionValidation.selectedFollowUp?.selectedFollowUpDecision)) {
  block("selected_follow_up_decision_not_allowed", "Selected follow-up decision is not allowed for the planning packet.");
}
if (
  selectionValidation.locks?.reviewOnly !== true ||
  selectionValidation.locks?.evidenceOnly !== true ||
  selectionValidation.locks?.accepted !== false ||
  selectionValidation.locks?.ruleEnabled !== false ||
  selectionValidation.locks?.memoryEnabled !== false ||
  selectionValidation.locks?.softwareActionsExecuted !== false ||
  selectionValidation.locks?.externalFetchPerformed !== false ||
  selectionValidation.locks?.packagingUnlocked !== false ||
  selectionValidation.locks?.deliveryGateOpen !== false ||
  selectionValidation.nextReview?.mayPrepareSelectedReviewOnlyFollowUp !== true ||
  selectionValidation.nextReview?.mayFetchExternalSources !== false ||
  selectionValidation.nextReview?.mayExecuteSoftware !== false ||
  selectionValidation.nextReview?.mayUnlockPackaging !== false ||
  selectionValidation.nextReview?.mayClaimGoalComplete !== false
) {
  block("selection_receipt_validation_locks_open", "RAG selection receipt validation must remain locked and review-only.");
}
if (
  queue &&
  (queue.format !== "transparent_ai_rag_audit_review_follow_up_queue_v1" ||
    queue.status !== "waiting_for_teacher_reviewed_follow_up_selection" ||
    queue.queueDecision !== "manual_review_only_follow_up_queue_ready" ||
    queue.locks?.reviewOnly !== true ||
    queue.locks?.accepted !== false ||
    queue.locks?.ruleEnabled !== false ||
    queue.locks?.memoryEnabled !== false ||
    queue.locks?.softwareActionsExecuted !== false ||
    queue.locks?.externalFetchPerformed !== false ||
    queue.locks?.packagingUnlocked !== false ||
    queue.locks?.deliveryGateOpen !== false ||
    queue.locks?.queueDoesNotRunCommands !== true ||
    queue.locks?.queueDoesNotFetchSources !== true ||
    queue.locks?.queueDoesNotClaimCompletion !== true)
) {
  block("source_follow_up_queue_not_locked", "Source follow-up queue must remain locked and waiting for teacher selection.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(selectionValidation.validationId || "selection-receipt-validation")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_selection_receipt_validation_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_selection_receipt_validation_result_receipt";

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_v1",
  sourceSelectionReceiptValidationResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagSelectionReceiptValidationId: selectionValidation.validationId || "",
  sourceRagSelectionReceiptValidationPath: selectionValidationPath,
  sourceRagFollowUpQueuePath: selectionValidation.queuePath || "",
  ragFollowUpQueueHash: selectionValidation.queueHash || "",
  selectedFollowUp: selectionValidation.selectedFollowUp || null,
  selectedFollowUpDecision: selectionValidation.selectedFollowUp?.selectedFollowUpDecision || "",
  rollbackPoint: handoff?.rollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "selection_receipt_validation_result_reviewed_ready_for_selected_follow_up_planning",
    "needs_more_selection_receipt_validation_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_selected_follow_up_planning_packet",
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
  selectionReceiptValidationResultReviewed: false,
  selectedFollowUpReviewed: false,
  selectedFollowUpPlanningCommandReviewed: false,
  teacherConfirmedNoSelectedFollowUpPlanningRun: false,
  teacherConfirmedNoFollowUpLaneChanged: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_builder_v1",
  selectionReceiptValidationResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagSelectionReceiptValidationPath: selectionValidationPath,
  sourceRagSelectionReceiptValidation: {
    validationId: selectionValidation.validationId || "",
    queuePath: selectionValidation.queuePath || "",
    queueHash: selectionValidation.queueHash || "",
    receiptPath: selectionValidation.receiptPath || "",
    selectedFollowUp: selectionValidation.selectedFollowUp || null,
    selectedFollowUpDecision: selectionValidation.selectedFollowUp?.selectedFollowUpDecision || "",
    rollbackPoint: handoff?.rollbackPoint || ""
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-selection-receipt-validation-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-selection-receipt-validation-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_SELECTION_RECEIPT_VALIDATION_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_selected_follow_up_planning_packet_from_selection_validation_result",
    "auto_run_selected_follow_up_planning_command",
    "select_follow_up_lane_from_selection_validation_result",
    "invoke_model_from_selection_validation_result",
    "fetch_rag_from_selection_validation_result",
    "write_memory_from_selection_validation_result",
    "enable_rule_from_selection_validation_result",
    "unlock_packaging_from_selection_validation_result",
    "claim_completion_from_selection_validation_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Selection Receipt Validation Result Receipt",
    "",
    "This packet brings the separately produced RAG follow-up queue selection receipt validation result back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG selection receipt validation: ${selectionValidationPath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the selected follow-up planning packet, change the selected lane, execute software, fetch RAG, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_builder_result_v1",
      status,
      selectionReceiptValidationResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagSelectionReceiptValidationPath: selectionValidationPath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
