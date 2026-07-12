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
    String(value || "tlcl-rag-selected-follow-up-planning-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-selected-follow-up-planning-result"
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
    selectedFollowUpPlanningResultReceiptOnly: true,
    builderDoesNotRunPrimarySourceEvidenceRequestReceiptBuilder: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotChangeSelectedFollowUpLane: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    primarySourceEvidenceRequestReceiptBuilderRun: false,
    commandAutoRun: false,
    selectedFollowUpLaneChanged: false,
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
  argValue("--tlcl-selected-follow-up-planning-handoff-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const planningPacketInput =
  argValue("--rag-selected-follow-up-planning-packet") ||
  argValue("--selected-follow-up-planning-packet") ||
  argValue("--planning-packet") ||
  argValue("--packet");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-selected-follow-up-planning-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: planningInputValue, path: planningInputPath } = readJsonInput(planningPacketInput, "RAG selected follow-up planning packet");
if (!tlclInputValue || !planningInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt-builder.mjs --tlcl-selected-follow-up-planning-handoff-validation <tlcl-validation.json-or-result.json> --rag-selected-follow-up-planning-packet <planning-packet.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL selected follow-up planning handoff validation"
);
const { packet: planningPacket, packetPath: planningPacketPath } = loadFullPacket(
  planningInputValue,
  planningInputPath,
  "transparent_ai_rag_selected_follow_up_planning_packet_v1",
  ["packetPath"],
  "RAG selected follow-up planning packet"
);

const handoff = tlclValidation.manualSelectedFollowUpPlanningHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_selection_receipt_validation_ready_for_selected_follow_up_planning") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual selected follow-up planning.");
}
if (tlclValidation.readyForSelectedFollowUpPlanning !== true) {
  block("tlcl_selected_follow_up_planning_ready_flag_missing", "TLCL validation must set readyForSelectedFollowUpPlanning=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_selected_follow_up_planning_handoff_v1"
) {
  block("manual_selected_follow_up_planning_handoff_missing", "TLCL validation must contain the manual selected follow-up planning handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-selected-follow-up-planning-packet.mjs") {
  block("manual_selected_follow_up_planning_handoff_next_tool_invalid", "TLCL handoff must target the existing selected follow-up planning packet tool.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunSelectedFollowUpPlanningPacket !== true) {
  block("tlcl_selected_follow_up_planning_execution_lock_missing", "Prior TLCL validation must keep selected follow-up planning execution locked.");
}
if (tlclValidation.locks?.validatorDoesNotSelectFollowUpLane !== true) {
  block("tlcl_follow_up_lane_change_lock_missing", "Prior TLCL validation must not change the selected follow-up lane.");
}

const selectionValidationPath = planningPacket.selectionValidationPath ? resolve(planningPacket.selectionValidationPath) : "";
let selectionValidation = null;
if (!selectionValidationPath || !existsSync(selectionValidationPath)) {
  block("planning_packet_selection_validation_missing", "Planning packet selectionValidationPath is missing.");
} else {
  selectionValidation = readJson(selectionValidationPath);
}
if (handoff?.sourceRagSelectionReceiptValidationPath && selectionValidationPath && resolve(handoff.sourceRagSelectionReceiptValidationPath) !== selectionValidationPath) {
  block("handoff_selection_validation_path_mismatch", "Planning packet selectionValidationPath must match the TLCL handoff source selection validation.");
}
if (selectionValidation && hashKnowledge(selectionValidation) !== planningPacket.selectionValidationHash) {
  block("planning_packet_selection_validation_hash_mismatch", "Planning packet selectionValidationHash no longer matches its source selection validation.");
}
if (JSON.stringify(planningPacket.selectedFollowUp || null) !== JSON.stringify(handoff?.selectedFollowUp || null)) {
  block("selected_follow_up_mismatch", "Planning packet selectedFollowUp must match the TLCL handoff selected follow-up.");
}
if (planningPacket.selectedFollowUpDecision !== handoff?.selectedFollowUpDecision) {
  block("selected_follow_up_decision_mismatch", "Planning packet selectedFollowUpDecision must match the TLCL handoff selected decision.");
}
if (planningPacket.rollbackPointPath && handoff?.rollbackPoint && resolve(planningPacket.rollbackPointPath) !== resolve(handoff.rollbackPoint)) {
  block("rollback_point_mismatch", "Planning packet rollbackPointPath must match the TLCL handoff rollbackPoint.");
}
if (!isRetainedRollbackPoint(planningPacket.rollbackPointPath || "")) {
  block("rollback_point_not_retained", "Planning packet must reference a retained rollback point.");
}
if (planningPacket.status !== "selected_follow_up_planning_ready_for_teacher_review") {
  block("planning_packet_not_ready", "Planning packet must be ready only for teacher review.");
}
if (planningPacket.selectedFollowUpDecision !== "request_more_primary_sources") {
  block("planning_packet_not_primary_source_request", "This TLCL handoff only prepares the primary-source evidence request path.");
}
if (!Array.isArray(planningPacket.plannedItems) || planningPacket.plannedItems.length === 0) {
  block("planning_packet_items_missing", "Planning packet must include plannedItems.");
}
if (!planningPacket.plannedItems?.some((item) => item.itemId === "prepare_primary_source_evidence_request")) {
  block("primary_source_evidence_request_item_missing", "Planning packet must include a primary-source evidence request item.");
}
if (
  planningPacket.locks?.reviewOnly !== true ||
  planningPacket.locks?.evidenceOnly !== true ||
  planningPacket.locks?.accepted !== false ||
  planningPacket.locks?.ruleEnabled !== false ||
  planningPacket.locks?.memoryEnabled !== false ||
  planningPacket.locks?.softwareActionsExecuted !== false ||
  planningPacket.locks?.externalFetchPerformed !== false ||
  planningPacket.locks?.packagingUnlocked !== false ||
  planningPacket.locks?.deliveryGateOpen !== false ||
  planningPacket.locks?.rollbackRetained !== true ||
  planningPacket.nextReview?.mayAskTeacherForSources !== true ||
  planningPacket.nextReview?.mayFetchExternalSources !== false ||
  planningPacket.nextReview?.mayExecuteSoftware !== false ||
  planningPacket.nextReview?.mayEnableRules !== false ||
  planningPacket.nextReview?.mayWriteMemory !== false ||
  planningPacket.nextReview?.mayUnlockPackaging !== false ||
  planningPacket.nextReview?.mayClaimGoalComplete !== false
) {
  block("planning_packet_locks_open", "RAG selected follow-up planning packet must remain locked and review-only.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(planningPacket.planningId || "selected-follow-up-planning")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_selected_follow_up_planning_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_selected_follow_up_planning_result_receipt";

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_v1",
  sourceSelectedFollowUpPlanningResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagSelectedFollowUpPlanningId: planningPacket.planningId || "",
  sourceRagSelectedFollowUpPlanningPacketPath: planningPacketPath,
  sourceRagSelectionReceiptValidationPath: planningPacket.selectionValidationPath || "",
  selectionValidationHash: planningPacket.selectionValidationHash || "",
  rollbackPoint: planningPacket.rollbackPointPath || handoff?.rollbackPoint || "",
  selectedFollowUp: planningPacket.selectedFollowUp || null,
  selectedFollowUpDecision: planningPacket.selectedFollowUpDecision || "",
  plannedItems: planningPacket.plannedItems || [],
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "selected_follow_up_planning_result_reviewed_ready_for_primary_source_evidence_request",
    "needs_more_selected_follow_up_planning_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_primary_source_evidence_request_receipt_builder",
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
  selectedFollowUpPlanningPacketReviewed: false,
  plannedItemsReviewed: false,
  primarySourceEvidenceRequestCommandReviewed: false,
  teacherConfirmedNoPrimarySourceEvidenceRequestBuilderRun: false,
  teacherConfirmedNoExternalFetch: false,
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
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_builder_v1",
  selectedFollowUpPlanningResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagSelectedFollowUpPlanningPacketPath: planningPacketPath,
  sourceRagSelectedFollowUpPlanningPacket: {
    planningId: planningPacket.planningId || "",
    selectionValidationPath: planningPacket.selectionValidationPath || "",
    selectionValidationHash: planningPacket.selectionValidationHash || "",
    rollbackPointPath: planningPacket.rollbackPointPath || "",
    selectedFollowUp: planningPacket.selectedFollowUp || null,
    selectedFollowUpDecision: planningPacket.selectedFollowUpDecision || "",
    plannedItems: planningPacket.plannedItems || []
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-selected-follow-up-planning-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-selected-follow-up-planning-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_SELECTED_FOLLOW_UP_PLANNING_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_primary_source_evidence_request_receipt_builder_from_planning_result",
    "auto_run_primary_source_evidence_request_command",
    "fetch_external_sources_from_planning_result",
    "change_selected_follow_up_lane_from_planning_result",
    "invoke_model_from_planning_result",
    "write_memory_from_planning_result",
    "enable_rule_from_planning_result",
    "unlock_packaging_from_planning_result",
    "claim_completion_from_planning_result"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Selected Follow-Up Planning Result Receipt",
    "",
    "This packet brings the separately produced RAG selected follow-up planning packet back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG selected follow-up planning packet: ${planningPacketPath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the primary-source evidence request receipt builder, fetch sources, execute software, change the selected lane, invoke a model, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_builder_result_v1",
      status,
      selectedFollowUpPlanningResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagSelectedFollowUpPlanningPacketPath: planningPacketPath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
