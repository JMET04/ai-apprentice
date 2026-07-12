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
    String(value || "tlcl-rag-selection-receipt-builder-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-selection-receipt-builder-result"
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
    selectionReceiptBuilderResultReceiptOnly: true,
    builderDoesNotRunSelectionReceiptValidation: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotSelectFollowUpLane: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    selectionReceiptValidationRun: false,
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
  argValue("--tlcl-selection-receipt-builder-handoff-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const selectionBuilderInput =
  argValue("--rag-selection-receipt-builder") ||
  argValue("--selection-receipt-builder") ||
  argValue("--builder-result") ||
  argValue("--builder");
const outputDir = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-selection-receipt-builder-result-receipt-builder"))
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: selectionBuilderInputValue, path: selectionBuilderInputPath } = readJsonInput(
  selectionBuilderInput,
  "RAG selection receipt builder"
);
if (!tlclInputValue || !selectionBuilderInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt-builder.mjs --tlcl-selection-receipt-builder-handoff-validation <tlcl-validation.json-or-result.json> --rag-selection-receipt-builder <builder.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL selection receipt builder handoff validation"
);
const { packet: selectionBuilder, packetPath: selectionBuilderPath } = loadFullPacket(
  selectionBuilderInputValue,
  selectionBuilderInputPath,
  "transparent_ai_rag_follow_up_queue_selection_receipt_builder_v1",
  ["builderPath"],
  "RAG follow-up queue selection receipt builder"
);

const handoff = tlclValidation.manualSelectionReceiptBuilderHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_follow_up_queue_ready_for_selection_receipt_builder") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual selection receipt builder planning.");
}
if (tlclValidation.readyForSelectionReceiptBuilder !== true) {
  block("tlcl_selection_receipt_builder_ready_flag_missing", "TLCL validation must set readyForSelectionReceiptBuilder=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_selection_receipt_builder_handoff_v1"
) {
  block("manual_selection_receipt_builder_handoff_missing", "TLCL validation must contain the manual selection receipt builder handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-follow-up-queue-selection-receipt-builder.mjs") {
  block("manual_selection_receipt_builder_handoff_next_tool_invalid", "TLCL handoff must target the existing RAG selection receipt builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunSelectionReceiptBuilder !== true) {
  block("tlcl_selection_receipt_builder_execution_lock_missing", "TLCL validation must keep selection receipt builder execution locked.");
}

const queuePath = selectionBuilder.queuePath ? resolve(selectionBuilder.queuePath) : "";
let queue = null;
if (!queuePath || !existsSync(queuePath)) {
  block("selection_receipt_builder_queue_missing", "Selection receipt builder queuePath is missing.");
} else {
  queue = readJson(queuePath);
}
if (handoff?.sourceRagFollowUpQueuePath && queuePath && resolve(handoff.sourceRagFollowUpQueuePath) !== queuePath) {
  block("handoff_follow_up_queue_path_mismatch", "Selection receipt builder queuePath must match the TLCL handoff source queue.");
}
if (queue && hashKnowledge(queue) !== handoff?.ragFollowUpQueueHash) {
  block("selection_receipt_builder_queue_hash_mismatch", "Selection receipt builder queue no longer matches the TLCL handoff queue hash.");
}
if (selectionBuilder.queueHash !== handoff?.ragFollowUpQueueHash) {
  block("selection_receipt_builder_recorded_queue_hash_mismatch", "Selection receipt builder recorded queueHash must match the TLCL handoff queue hash.");
}
if (!selectionBuilder.receiptTemplatePath || !existsSync(selectionBuilder.receiptTemplatePath)) {
  block("selection_receipt_template_missing", "Selection receipt builder must write a receipt template.");
}
if (!selectionBuilder.validationCommand?.includes("validate-rag-follow-up-queue-selection-receipt.mjs")) {
  block("selection_receipt_validation_command_missing", "Selection receipt builder must point to the existing selection receipt validator.");
}
if (
  selectionBuilder.locks?.reviewOnly !== true ||
  selectionBuilder.locks?.evidenceOnly !== true ||
  selectionBuilder.locks?.accepted !== false ||
  selectionBuilder.locks?.ruleEnabled !== false ||
  selectionBuilder.locks?.memoryEnabled !== false ||
  selectionBuilder.locks?.softwareActionsExecuted !== false ||
  selectionBuilder.locks?.externalFetchPerformed !== false ||
  selectionBuilder.locks?.packagingUnlocked !== false ||
  selectionBuilder.locks?.deliveryGateOpen !== false
) {
  block("selection_receipt_builder_locks_open", "RAG selection receipt builder must remain locked and review-only.");
}
if (
  queue &&
  (queue.format !== "transparent_ai_rag_audit_review_follow_up_queue_v1" ||
    queue.status !== "waiting_for_teacher_reviewed_follow_up_selection" ||
    queue.queueDecision !== "manual_review_only_follow_up_queue_ready" ||
    queue.locks?.reviewOnly !== true ||
    queue.locks?.queueDoesNotRunCommands !== true ||
    queue.locks?.queueDoesNotFetchSources !== true ||
    queue.locks?.queueDoesNotClaimCompletion !== true)
) {
  block("source_follow_up_queue_not_locked", "Source follow-up queue must remain locked and waiting for teacher selection.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(selectionBuilder.builderId || "selection-receipt-builder")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_selection_receipt_builder_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_selection_receipt_builder_result_receipt";

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_v1",
  sourceSelectionReceiptBuilderResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagSelectionReceiptBuilderId: selectionBuilder.builderId || "",
  sourceRagSelectionReceiptBuilderPath: selectionBuilderPath,
  sourceRagFollowUpQueuePath: selectionBuilder.queuePath || "",
  ragFollowUpQueueHash: selectionBuilder.queueHash || "",
  receiptTemplatePath: selectionBuilder.receiptTemplatePath || "",
  validationCommand: selectionBuilder.validationCommand || "",
  rollbackPoint: handoff?.rollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "selection_receipt_builder_result_reviewed_ready_for_selection_receipt_validation",
    "needs_more_selection_receipt_builder_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_selection_receipt_validation",
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
  selectionReceiptBuilderResultReviewed: false,
  receiptTemplateReviewed: false,
  selectionReceiptValidationCommandReviewed: false,
  teacherConfirmedNoSelectionReceiptValidationRun: false,
  teacherConfirmedNoFollowUpLaneSelected: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_builder_v1",
  selectionReceiptBuilderResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagSelectionReceiptBuilderPath: selectionBuilderPath,
  sourceRagSelectionReceiptBuilder: {
    builderId: selectionBuilder.builderId || "",
    queuePath: selectionBuilder.queuePath || "",
    queueHash: selectionBuilder.queueHash || "",
    receiptTemplatePath: selectionBuilder.receiptTemplatePath || "",
    validationCommand: selectionBuilder.validationCommand || "",
    rollbackPoint: handoff?.rollbackPoint || ""
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-selection-receipt-builder-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-selection-receipt-builder-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_SELECTION_RECEIPT_BUILDER_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_selection_receipt_validation_from_builder_result",
    "auto_run_selection_receipt_validation_command",
    "select_follow_up_lane_from_builder_result",
    "invoke_model_from_builder_result",
    "fetch_rag_from_builder_result",
    "write_memory_from_builder_result",
    "enable_rule_from_builder_result",
    "unlock_packaging_from_builder_result",
    "claim_completion_from_builder_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Selection Receipt Builder Result Receipt",
    "",
    "This packet brings the separately generated RAG follow-up queue selection receipt builder back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG selection receipt builder: ${selectionBuilderPath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the selection receipt validator, select a follow-up lane, execute software, fetch RAG, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_builder_result_v1",
      status,
      selectionReceiptBuilderResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagSelectionReceiptBuilderPath: selectionBuilderPath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
