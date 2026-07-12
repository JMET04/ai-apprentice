#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const selectionValidationPath = resolve(arg("--selection-validation", arg("--validation", "")));
const rollbackPointArg = arg("--rollback-point", "");
const rollbackPointPath = rollbackPointArg ? resolve(rollbackPointArg) : "";
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-selected-follow-up-planning-packet"))
);

if (!selectionValidationPath || !rollbackPointPath) {
  throw new Error(
    "Usage: node create-rag-selected-follow-up-planning-packet.mjs --selection-validation <rag-follow-up-queue-selection-receipt-validation.json> --rollback-point <retained-rollback-dir-or-manifest> [--out-dir <dir>]"
  );
}

function isRetainedRollbackPoint(path) {
  if (!existsSync(path)) return false;
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

function requireClosedSelectionLocks(validation) {
  return (
    validation.locks?.reviewOnly === true &&
    validation.locks?.accepted === false &&
    validation.locks?.ruleEnabled === false &&
    validation.locks?.memoryEnabled === false &&
    validation.locks?.softwareActionsExecuted === false &&
    validation.locks?.externalFetchPerformed === false &&
    validation.locks?.packagingUnlocked === false &&
    validation.locks?.deliveryGateOpen === false &&
    validation.nextReview?.mayPrepareSelectedReviewOnlyFollowUp === true &&
    validation.nextReview?.mayFetchExternalSources === false &&
    validation.nextReview?.mayExecuteSoftware === false &&
    validation.nextReview?.mayUnlockPackaging === false &&
    validation.nextReview?.mayClaimGoalComplete === false
  );
}

const validation = readJson(selectionValidationPath);
if (validation.format !== "transparent_ai_rag_follow_up_queue_selection_receipt_validation_v1") {
  throw new Error("Expected transparent_ai_rag_follow_up_queue_selection_receipt_validation_v1.");
}
if (validation.status !== "ready_for_selected_review_only_rag_follow_up") {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_READY_SELECTION_VALIDATION");
}
if (!requireClosedSelectionLocks(validation)) {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_LOCKED_SELECTION_VALIDATION");
}
if (!isRetainedRollbackPoint(rollbackPointPath)) {
  throw new Error("ROLLBACK_POINT_NOT_FOUND");
}

const allowedFollowUps = new Set([
  "request_more_primary_sources",
  "prepare_disabled_rule_rewrite_review",
  "add_validator_coverage_review",
  "prepare_next_teacher_receipt"
]);
const selectedDecision = validation.selectedFollowUp?.selectedFollowUpDecision;
if (!allowedFollowUps.has(selectedDecision)) {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_REJECTS_FORBIDDEN_DECISION");
}
const logicExtractionHints = Array.isArray(validation.nextReview?.logicExtractionHints)
  ? validation.nextReview.logicExtractionHints
  : Array.isArray(validation.selectedFollowUp?.logicExtractionHints)
    ? validation.selectedFollowUp.logicExtractionHints
    : [];
const logicEvidenceReviews = Array.isArray(validation.nextReview?.logicEvidenceReviews)
  ? validation.nextReview.logicEvidenceReviews
  : Array.isArray(validation.selectedFollowUp?.logicEvidenceReviews)
    ? validation.selectedFollowUp.logicEvidenceReviews
    : [];
const planningLogicEvidence =
  validation.planningLogicEvidence ??
  validation.selectedFollowUp?.planningLogicEvidence ??
  validation.nextReview?.planningLogicEvidence ??
  null;
const planningLogicEvidenceHash =
  validation.planningLogicEvidenceHash ||
  validation.selectedFollowUp?.planningLogicEvidenceHash ||
  validation.nextReview?.planningLogicEvidenceHash ||
  "";
const selectedPlanningLogicEvidence = validation.selectedFollowUp?.planningLogicEvidence ?? null;
const selectedPlanningLogicEvidenceHash = validation.selectedFollowUp?.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = validation.nextReview?.planningLogicEvidence ?? null;
const nextReviewPlanningLogicEvidenceHash = validation.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && selectedPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_SELECTED_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(selectedPlanningLogicEvidence || null)) !== selectedPlanningLogicEvidenceHash
) {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_SELECTED_LOGIC_EVIDENCE_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH");
}
if (
  logicExtractionHints.length > 0 &&
  !logicEvidenceReviews.some(
    (row) =>
      row?.decision === "logic_evidence_confirmed" &&
      row.logicEvidenceReviewed === true &&
      row.logicFitDecisionConfirmed === true
  )
) {
  throw new Error("RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_CONFIRMED_LOGIC_EVIDENCE");
}

const planByDecision = {
  request_more_primary_sources: [
    {
      itemId: "prepare_primary_source_evidence_request",
      order: 1,
      kind: "teacher_evidence_request",
      instruction:
        "Prepare a teacher-facing request for additional primary-source manuals, standards, papers, drawings, or verified notes related to the selected RAG gap.",
      expectedTeacherInput: "Local source paths or pasted source excerpts with permission and domain notes.",
      executesNow: false,
      externalFetchPerformed: false,
      softwareActionsExecuted: false,
      ruleEnabled: false,
      packagingUnlocked: false
    },
    {
      itemId: "prepare_source_card_review_rows",
      order: 2,
      kind: "source_card_review_planning",
      instruction: "List the source-card fields a teacher must review before any later local ingest step is allowed.",
      expectedTeacherInput: "Teacher confirms source type, trust level, domain, and review-only boundary.",
      executesNow: false,
      externalFetchPerformed: false,
      softwareActionsExecuted: false,
      ruleEnabled: false,
      packagingUnlocked: false
    }
  ],
  prepare_disabled_rule_rewrite_review: [
    {
      itemId: "prepare_disabled_rule_rewrite_review",
      order: 1,
      kind: "disabled_rule_rewrite_review",
      instruction:
        "Prepare a teacher review prompt for rewriting the disabled Rule Card while keeping lifecycle=draft_disabled and ruleEnabled=false.",
      expectedTeacherInput: "Teacher marks which condition, severity, remediation, or evidence reference should be rewritten.",
      executesNow: false,
      externalFetchPerformed: false,
      softwareActionsExecuted: false,
      ruleEnabled: false,
      packagingUnlocked: false
    }
  ],
  add_validator_coverage_review: [
    {
      itemId: "prepare_validator_coverage_review",
      order: 1,
      kind: "validator_coverage_review",
      instruction:
        "Prepare review-only validator coverage questions for unknown, blocking, and disabled-rule paths before any validator registry change.",
      expectedTeacherInput: "Teacher confirms which validation case should be covered next.",
      executesNow: false,
      externalFetchPerformed: false,
      softwareActionsExecuted: false,
      ruleEnabled: false,
      packagingUnlocked: false
    }
  ],
  prepare_next_teacher_receipt: [
    {
      itemId: "prepare_next_teacher_receipt_template",
      order: 1,
      kind: "teacher_receipt_template_planning",
      instruction:
        "Prepare the next teacher receipt template fields for the selected RAG follow-up while defaulting every decision to needs_teacher_review.",
      expectedTeacherInput: "Teacher fills observed evidence, blocker questions, and next-review notes.",
      executesNow: false,
      externalFetchPerformed: false,
      softwareActionsExecuted: false,
      ruleEnabled: false,
      packagingUnlocked: false
    }
  ]
};

const validationHash = hashText(JSON.stringify(validation));
const planningId = stableId("rag_selected_follow_up_planning_packet", `${selectionValidationPath}:${validationHash}`);
const planningDir = join(outDir, planningId);
const packetPath = join(planningDir, "rag-selected-follow-up-planning-packet.json");
const packet = {
  format: "transparent_ai_rag_selected_follow_up_planning_packet_v1",
  planningId,
  createdAt: new Date().toISOString(),
  selectionValidationPath,
  selectionValidationHash: validationHash,
  rollbackPointPath,
  status: "selected_follow_up_planning_ready_for_teacher_review",
  selectedFollowUp: validation.selectedFollowUp,
  selectedFollowUpDecision: selectedDecision,
  logicExtractionHints,
  logicEvidenceReviews,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  plannedItems: planByDecision[selectedDecision],
  blockedActions: [
    "external_fetch",
    "software_execution",
    "rule_enablement",
    "long_term_memory_write",
    "delivery_gate_open",
    "packaging_unlock",
    "technology_acceptance",
    "goal_completion_claim"
  ],
  nextReview: {
    instruction: "Teacher reviews this planning packet and decides whether to provide evidence, request changes, or block the route.",
    mayAskTeacherForSources: selectedDecision === "request_more_primary_sources",
    mayPrepareReceiptTemplate: selectedDecision === "prepare_next_teacher_receipt",
    mayFetchExternalSources: false,
    mayExecuteSoftware: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayOpenDeliveryGate: false,
    mayUnlockPackaging: false,
    mayClaimGoalComplete: false,
    logicExtractionHints,
    logicEvidenceReviews,
    planningLogicEvidence,
    planningLogicEvidenceHash
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    deliveryGateOpen: false,
    rollbackRetained: true
  }
};

writeJson(packetPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: packet.format,
      status: packet.status,
      packetPath,
      selectedFollowUpDecision: selectedDecision,
      plannedItems: packet.plannedItems.length,
      locks: packet.locks
    },
    null,
    2
  )
);
