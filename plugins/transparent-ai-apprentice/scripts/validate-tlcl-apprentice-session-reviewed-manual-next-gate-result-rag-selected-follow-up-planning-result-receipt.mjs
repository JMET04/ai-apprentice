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
    String(value || "tlcl-rag-selected-follow-up-planning-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-selected-follow-up-planning-result-validation"
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
    validatorDoesNotRunPrimarySourceEvidenceRequestReceiptBuilder: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotChangeSelectedFollowUpLane: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
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

const builderInput =
  argValue("--builder") ||
  argValue("--selected-follow-up-planning-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-selected-follow-up-planning-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "selected_follow_up_planning_result_reviewed_ready_for_primary_source_evidence_request",
  "needs_more_selected_follow_up_planning_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
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
]);

if (
  builder.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG selected follow-up planning result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_selected_follow_up_planning_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunPrimarySourceEvidenceRequestReceiptBuilder !== true) {
  block("builder_primary_source_request_lock_missing", "Builder must keep primary-source evidence request receipt builder execution locked.");
}
if (
  receipt.format !==
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_v1"
) {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceSelectedFollowUpPlanningResultReceiptBuilderId !== builder.selectedFollowUpPlanningResultReceiptBuilderId) {
  block("source_builder_id_mismatch", "Receipt source id must match builder.");
}
if (receipt.sourceRagSelectedFollowUpPlanningPacketPath !== builder.sourceRagSelectedFollowUpPlanningPacketPath) {
  block("source_planning_packet_path_mismatch", "Receipt source planning packet path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.sourceRagSelectionReceiptValidationPath !== builder.sourceRagSelectedFollowUpPlanningPacket?.selectionValidationPath) {
  block("source_selection_validation_path_mismatch", "Receipt source selection validation path must match builder.");
}
if (receipt.selectionValidationHash !== builder.sourceRagSelectedFollowUpPlanningPacket?.selectionValidationHash) {
  block("selection_validation_hash_mismatch", "Receipt selectionValidationHash must match builder.");
}
if (receipt.selectedFollowUpDecision !== builder.sourceRagSelectedFollowUpPlanningPacket?.selectedFollowUpDecision) {
  block("selected_follow_up_decision_mismatch", "Receipt selected follow-up decision must match builder.");
}
if (JSON.stringify(receipt.selectedFollowUp || null) !== JSON.stringify(builder.sourceRagSelectedFollowUpPlanningPacket?.selectedFollowUp || null)) {
  block("selected_follow_up_mismatch", "Receipt selectedFollowUp must match builder.");
}
if (JSON.stringify(receipt.plannedItems || []) !== JSON.stringify(builder.sourceRagSelectedFollowUpPlanningPacket?.plannedItems || [])) {
  block("planned_items_mismatch", "Receipt plannedItems must match builder.");
}
if (receipt.rollbackPoint !== builder.sourceRagSelectedFollowUpPlanningPacket?.rollbackPointPath) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match builder.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let sourceStillValid = false;
try {
  const packet = readJson(receipt.sourceRagSelectedFollowUpPlanningPacketPath);
  const selectionValidation = readJson(receipt.sourceRagSelectionReceiptValidationPath);
  sourceStillValid =
    packet.format === "transparent_ai_rag_selected_follow_up_planning_packet_v1" &&
    packet.status === "selected_follow_up_planning_ready_for_teacher_review" &&
    packet.selectionValidationPath === receipt.sourceRagSelectionReceiptValidationPath &&
    packet.selectionValidationHash === receipt.selectionValidationHash &&
    hashKnowledge(selectionValidation) === receipt.selectionValidationHash &&
    packet.rollbackPointPath === receipt.rollbackPoint &&
    isRetainedRollbackPoint(packet.rollbackPointPath) &&
    packet.selectedFollowUpDecision === "request_more_primary_sources" &&
    packet.selectedFollowUpDecision === receipt.selectedFollowUpDecision &&
    JSON.stringify(packet.selectedFollowUp || null) === JSON.stringify(receipt.selectedFollowUp || null) &&
    JSON.stringify(packet.plannedItems || []) === JSON.stringify(receipt.plannedItems || []) &&
    packet.plannedItems?.some((item) => item.itemId === "prepare_primary_source_evidence_request") &&
    packet.locks?.reviewOnly === true &&
    packet.locks?.evidenceOnly === true &&
    packet.locks?.accepted === false &&
    packet.locks?.ruleEnabled === false &&
    packet.locks?.memoryEnabled === false &&
    packet.locks?.softwareActionsExecuted === false &&
    packet.locks?.externalFetchPerformed === false &&
    packet.locks?.packagingUnlocked === false &&
    packet.locks?.deliveryGateOpen === false &&
    packet.locks?.rollbackRetained === true &&
    packet.nextReview?.mayAskTeacherForSources === true &&
    packet.nextReview?.mayFetchExternalSources === false &&
    packet.nextReview?.mayExecuteSoftware === false &&
    packet.nextReview?.mayEnableRules === false &&
    packet.nextReview?.mayWriteMemory === false &&
    packet.nextReview?.mayUnlockPackaging === false &&
    packet.nextReview?.mayClaimGoalComplete === false;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("selected_follow_up_planning_source_not_still_valid", "The referenced selected follow-up planning packet or selection validation is missing, changed, or unlocked.");
}

if (decision === "selected_follow_up_planning_result_reviewed_ready_for_primary_source_evidence_request") {
  if (receipt.selectedFollowUpPlanningPacketReviewed !== true) {
    block("selected_follow_up_planning_packet_review_required", "Teacher must review the selected follow-up planning packet.");
  }
  if (receipt.plannedItemsReviewed !== true) block("planned_items_review_required", "Teacher must review the planned items.");
  if (receipt.primarySourceEvidenceRequestCommandReviewed !== true) {
    block("primary_source_evidence_request_command_review_required", "Teacher must review the primary-source evidence request command boundary.");
  }
  if (receipt.teacherConfirmedNoPrimarySourceEvidenceRequestBuilderRun !== true) {
    block("teacher_no_primary_source_request_builder_run_confirmation_required", "Teacher must confirm no primary-source evidence request receipt builder was run here.");
  }
  if (receipt.teacherConfirmedNoExternalFetch !== true) {
    block("teacher_no_external_fetch_confirmation_required", "Teacher must confirm no external fetch happened here.");
  }
  if (receipt.teacherConfirmedNoFollowUpLaneChanged !== true) {
    block("teacher_no_follow_up_lane_changed_confirmation_required", "Teacher must confirm the selected follow-up lane was not changed here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if (
  (decision === "needs_more_selected_follow_up_planning_evidence" || decision === "correction_to_high_reasoning_repair") &&
  !String(receipt.teacherNotes || "").trim()
) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "selected_follow_up_planning_result_reviewed_ready_for_primary_source_evidence_request" &&
  sourceStillValid &&
  receipt.selectedFollowUpPlanningPacketReviewed === true &&
  receipt.plannedItemsReviewed === true &&
  receipt.primarySourceEvidenceRequestCommandReviewed === true &&
  receipt.teacherConfirmedNoPrimarySourceEvidenceRequestBuilderRun === true &&
  receipt.teacherConfirmedNoExternalFetch === true &&
  receipt.teacherConfirmedNoFollowUpLaneChanged === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_selected_follow_up_planning_result_decision"
  : ready
    ? "tlcl_rag_selected_follow_up_planning_ready_for_primary_source_evidence_request_receipt_builder"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_selected_follow_up_planning_evidence" && blockers.length === 0
        ? "needs_more_selected_follow_up_planning_evidence_before_primary_source_request"
        : "needs_teacher_review_before_primary_source_request";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualPrimarySourceEvidenceRequestReceiptBuilderHandoff = ready
  ? {
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_primary_source_evidence_request_receipt_builder_handoff_v1",
      sourceRagSelectedFollowUpPlanningId: builder.sourceRagSelectedFollowUpPlanningPacket?.planningId || "",
      sourceRagSelectedFollowUpPlanningPacketPath: builder.sourceRagSelectedFollowUpPlanningPacketPath || "",
      sourceRagSelectionReceiptValidationPath: receipt.sourceRagSelectionReceiptValidationPath || "",
      selectionValidationHash: receipt.selectionValidationHash || "",
      selectedFollowUp: receipt.selectedFollowUp || null,
      selectedFollowUpDecision: receipt.selectedFollowUpDecision || "",
      rollbackPoint: receipt.rollbackPoint || "",
      nextTool: "knowledge/create-rag-primary-source-evidence-request-receipt-builder.mjs",
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-primary-source-evidence-request-receipt-builder.mjs --planning-packet "${receipt.sourceRagSelectedFollowUpPlanningPacketPath}"`,
      instruction:
        "Create only the teacher-facing primary-source evidence request receipt builder as a separate manual step. Do not fetch sources, execute software, change the selected lane, enable rules, write memory, unlock packaging, or claim completion.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_selected_follow_up_planning_result",
        sourceSelectedFollowUpPlanningResultReceiptBuilderId: builder.selectedFollowUpPlanningResultReceiptBuilderId || "",
        sourceRagSelectedFollowUpPlanningPacketPath: builder.sourceRagSelectedFollowUpPlanningPacketPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the selected follow-up planning packet did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForPrimarySourceEvidenceRequestReceiptBuilder: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreSelectedFollowUpPlanningEvidence:
    status === "needs_more_selected_follow_up_planning_evidence_before_primary_source_request",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagSelectedFollowUpPlanningPacketPath: receipt.sourceRagSelectedFollowUpPlanningPacketPath || "",
    sourceRagSelectionReceiptValidationPath: receipt.sourceRagSelectionReceiptValidationPath || ""
  },
  manualPrimarySourceEvidenceRequestReceiptBuilderHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_primary_source_evidence_request_receipt_builder_from_planning_confirmation",
    "fetch_external_sources_from_planning_confirmation",
    "change_selected_follow_up_lane_from_planning_confirmation",
    "auto_run_primary_source_evidence_request_command",
    "invoke_model_from_planning_confirmation",
    "write_memory_from_planning_confirmation",
    "enable_rule_from_planning_confirmation",
    "unlock_packaging_from_planning_confirmation",
    "claim_completion_from_planning_confirmation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-selected-follow-up-planning-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-selected-follow-up-planning-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_SELECTED_FOLLOW_UP_PLANNING_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Selected Follow-Up Planning Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the primary-source evidence request receipt builder. It only prepares a manual handoff after the selected follow-up planning packet is reviewed."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForPrimarySourceEvidenceRequestReceiptBuilder: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreSelectedFollowUpPlanningEvidence: validation.needsMoreSelectedFollowUpPlanningEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualPrimarySourceEvidenceRequestReceiptBuilderHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
