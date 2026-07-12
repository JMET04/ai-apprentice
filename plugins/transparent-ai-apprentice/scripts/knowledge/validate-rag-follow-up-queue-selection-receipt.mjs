#!/usr/bin/env node
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const queuePath = resolve(arg("--follow-up-queue", arg("--queue", "")));
const receiptPath = resolve(arg("--receipt", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-follow-up-queue-selection-receipt-validation"))
);

if (!queuePath || !receiptPath) {
  throw new Error(
    "Usage: node validate-rag-follow-up-queue-selection-receipt.mjs --follow-up-queue <rag-audit-review-follow-up-queue.json> --receipt <teacher-filled-receipt.json> [--out-dir <dir>]"
  );
}

const queue = readJson(queuePath);
const receipt = readJson(receiptPath);
if (queue.format !== "transparent_ai_rag_audit_review_follow_up_queue_v1") {
  throw new Error("Expected transparent_ai_rag_audit_review_follow_up_queue_v1.");
}
if (receipt.format !== "transparent_ai_rag_follow_up_queue_selection_receipt_v1") {
  throw new Error("Expected transparent_ai_rag_follow_up_queue_selection_receipt_v1.");
}

const queueHash = hashText(JSON.stringify(queue));
const planningLogicEvidence = queue.planningLogicEvidence || null;
const planningLogicEvidenceHash = queue.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = queue.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = queue.nextReview?.planningLogicEvidenceHash || "";
const allowedTop = new Set(["needs_teacher_review", "teacher_selected_review_only_follow_up", "blocked"]);
const allowedRows = new Set(["needs_teacher_review", "select_review_only_follow_up", "request_more_detail", "blocked"]);
const forbidden = new Set([
  "accepted",
  "accept_technology",
  "enable_rule",
  "activate_rule",
  "write_memory",
  "execute_software",
  "fetch_external_source",
  "open_delivery_gate",
  "unlock_packaging",
  "claim_goal_complete"
]);
const errors = [];
const warnings = [];

if (queue.status !== "waiting_for_teacher_reviewed_follow_up_selection") errors.push("QUEUE_STATUS_NOT_WAITING_FOR_SELECTION");
if (queue.queueDecision !== "manual_review_only_follow_up_queue_ready") errors.push("QUEUE_DECISION_NOT_READY_FOR_SELECTION");
if (queue.locks?.reviewOnly !== true) errors.push("QUEUE_REVIEW_ONLY_LOCK_NOT_CLOSED");
if (queue.locks?.accepted !== false) errors.push("QUEUE_ACCEPTANCE_LOCK_NOT_CLOSED");
if (queue.locks?.ruleEnabled !== false) errors.push("QUEUE_RULE_LOCK_NOT_CLOSED");
if (queue.locks?.memoryEnabled !== false) errors.push("QUEUE_MEMORY_LOCK_NOT_CLOSED");
if (queue.locks?.softwareActionsExecuted !== false) errors.push("QUEUE_SOFTWARE_EXECUTION_LOCK_NOT_CLOSED");
if (queue.locks?.externalFetchPerformed !== false) errors.push("QUEUE_EXTERNAL_FETCH_LOCK_NOT_CLOSED");
if (queue.locks?.packagingUnlocked !== false) errors.push("QUEUE_PACKAGING_LOCK_NOT_CLOSED");
if (queue.locks?.deliveryGateOpen !== false) errors.push("QUEUE_DELIVERY_GATE_LOCK_NOT_CLOSED");

if (receipt.queueId !== queue.queueId) errors.push("QUEUE_ID_MISMATCH");
if (receipt.queueHash !== queueHash) errors.push("QUEUE_HASH_MISMATCH");
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  errors.push("FOLLOW_UP_SELECTION_QUEUE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  errors.push("FOLLOW_UP_SELECTION_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  errors.push("FOLLOW_UP_SELECTION_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
if ((receipt.planningLogicEvidenceHash || "") !== planningLogicEvidenceHash) {
  errors.push("FOLLOW_UP_SELECTION_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (hashText(JSON.stringify(receipt.planningLogicEvidence || null)) !== hashText(JSON.stringify(planningLogicEvidence))) {
  errors.push("FOLLOW_UP_SELECTION_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
if (!allowedTop.has(receipt.decision)) errors.push("TOP_LEVEL_DECISION_NOT_ALLOWED");
if (forbidden.has(receipt.decision)) errors.push("FORBIDDEN_TOP_LEVEL_DECISION");

const queueRows = new Map((queue.queueItems || []).map((item) => [item.itemId, item]));
const receiptRows = Array.isArray(receipt.itemReviews) ? receipt.itemReviews : [];
if (receiptRows.length !== queueRows.size) errors.push("QUEUE_SELECTION_ROW_COUNT_MISMATCH");
const queueLogicExtractionHints = Array.isArray(queue.logicExtractionHints) ? queue.logicExtractionHints : [];
const logicEvidenceQueueRow = queueRows.get("review_primary_source_logic_evidence");
const allowedLogicEvidenceDecisions = new Set([
  "needs_teacher_review",
  "logic_evidence_confirmed",
  "request_logic_recheck",
  "request_more_primary_sources",
  "blocked"
]);

const selectedRows = [];
let forbiddenDecisionUsed = false;
let logicEvidenceReview = null;
for (const row of receiptRows) {
  const queueRow = queueRows.get(row.itemId);
  if (!queueRow) {
    errors.push(`UNKNOWN_QUEUE_SELECTION_ROW:${row.itemId || row.order || "unknown"}`);
    continue;
  }
  if (!allowedRows.has(row.decision)) errors.push(`ROW_DECISION_NOT_ALLOWED:${row.itemId}`);
  if (forbidden.has(row.decision)) {
    errors.push(`FORBIDDEN_ROW_DECISION:${row.itemId}`);
    forbiddenDecisionUsed = true;
  }
  if (row.sourceHash !== queueRow.sourceHash) errors.push(`QUEUE_ROW_HASH_MISMATCH:${row.itemId}`);
  if (row.queueStatus !== queueRow.status) errors.push(`QUEUE_ROW_STATUS_MISMATCH:${row.itemId}`);
  if (queueRow.itemId === "review_primary_source_logic_evidence") {
    if (!allowedLogicEvidenceDecisions.has(row.logicEvidenceDecision)) {
      errors.push("LOGIC_EVIDENCE_DECISION_NOT_ALLOWED");
    }
    if (queueLogicExtractionHints.length > 0 && !Array.isArray(row.logicExtractionHints)) {
      errors.push("LOGIC_EVIDENCE_HINTS_MISSING_FROM_RECEIPT_ROW");
    }
    if (
      queueLogicExtractionHints.length > 0 &&
      hashText(JSON.stringify(row.logicExtractionHints || [])) !== hashText(JSON.stringify(queueLogicExtractionHints))
    ) {
      errors.push("LOGIC_EVIDENCE_HINTS_MISMATCH");
    }
    logicEvidenceReview = {
      itemId: row.itemId,
      decision: row.logicEvidenceDecision,
      logicEvidenceReviewed: row.logicEvidenceReviewed === true,
      logicFitDecisionConfirmed: row.logicFitDecisionConfirmed === true,
      reviewerNote: row.reviewerNote || "",
      logicExtractionHints: queueLogicExtractionHints
    };
  }

  if (row.decision === "select_review_only_follow_up") {
    selectedRows.push({ row, queueRow });
    if (row.itemReviewed !== true) errors.push(`SELECTED_ROW_REQUIRES_ITEM_REVIEW:${row.itemId}`);
    if (row.noActionBoundaryReviewed !== true) errors.push(`SELECTED_ROW_REQUIRES_NO_ACTION_BOUNDARY_REVIEW:${row.itemId}`);
    if (!String(row.reviewerNote || "").trim()) errors.push(`SELECTED_ROW_REQUIRES_REVIEWER_NOTE:${row.itemId}`);
    if (!Array.isArray(queueRow.allowedNextDecisions) || !queueRow.allowedNextDecisions.includes(row.selectedFollowUpDecision)) {
      errors.push(`SELECTED_ROW_FOLLOW_UP_DECISION_NOT_ALLOWED:${row.itemId}`);
    }
    if (forbidden.has(row.selectedFollowUpDecision)) errors.push(`SELECTED_ROW_FORBIDDEN_FOLLOW_UP_DECISION:${row.itemId}`);
    if (queueRow.itemId === "confirm_rollback_retained" && row.rollbackStillRetained !== true) {
      errors.push("SELECTED_ROLLBACK_ROW_REQUIRES_ROLLBACK_RETAINED");
    }
  }
}

if (receipt.decision === "teacher_selected_review_only_follow_up" && selectedRows.length !== 1) {
  errors.push("TOP_LEVEL_SELECTION_REQUIRES_EXACTLY_ONE_SELECTED_ROW");
}
if (receipt.decision === "teacher_selected_review_only_follow_up" && logicEvidenceQueueRow && queueLogicExtractionHints.length > 0) {
  if (!logicEvidenceReview) errors.push("SELECTION_REQUIRES_PRIMARY_SOURCE_LOGIC_EVIDENCE_ROW");
  if (logicEvidenceReview?.decision !== "logic_evidence_confirmed") {
    errors.push("SELECTION_REQUIRES_CONFIRMED_PRIMARY_SOURCE_LOGIC_EVIDENCE");
  }
  if (logicEvidenceReview?.logicEvidenceReviewed !== true) {
    errors.push("SELECTION_REQUIRES_REVIEWED_PRIMARY_SOURCE_LOGIC_EVIDENCE");
  }
  if (logicEvidenceReview?.logicFitDecisionConfirmed !== true) {
    errors.push("SELECTION_REQUIRES_CONFIRMED_PRIMARY_SOURCE_LOGIC_FIT");
  }
  if (!String(logicEvidenceReview?.reviewerNote || "").trim()) {
    errors.push("SELECTION_REQUIRES_PRIMARY_SOURCE_LOGIC_REVIEWER_NOTE");
  }
}
if (receipt.decision === "needs_teacher_review" && selectedRows.length > 0) {
  errors.push("SELECTED_ROWS_REQUIRE_REVIEWED_TOP_LEVEL_DECISION");
}
if (receipt.decision === "blocked" && !String(receipt.reviewerNote || "").trim()) {
  warnings.push("BLOCKED_DECISION_SHOULD_INCLUDE_REVIEWER_NOTE");
}

const selected = selectedRows[0] || null;
const status =
  errors.length > 0 || forbiddenDecisionUsed
    ? "blocked"
    : selected
      ? "ready_for_selected_review_only_rag_follow_up"
      : "waiting_for_teacher_review";

const validation = {
  format: "transparent_ai_rag_follow_up_queue_selection_receipt_validation_v1",
  validationId: stableId("rag_follow_up_queue_selection_receipt_validation", `${queuePath}:${receiptPath}`),
  createdAt: new Date().toISOString(),
  queuePath,
  receiptPath,
  queueHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status,
  errors,
  warnings,
  selectedFollowUp: selected
    ? {
        itemId: selected.queueRow.itemId,
        order: selected.queueRow.order,
        kind: selected.queueRow.kind,
        selectedFollowUpDecision: selected.row.selectedFollowUpDecision,
        action: selected.queueRow.action,
        reviewerNote: selected.row.reviewerNote,
        logicEvidenceReviews: logicEvidenceReview ? [logicEvidenceReview] : [],
        logicExtractionHints: queueLogicExtractionHints,
        planningLogicEvidence,
        planningLogicEvidenceHash
      }
    : null,
  nextReview: {
    instruction:
      status === "ready_for_selected_review_only_rag_follow_up"
        ? "Prepare only the selected review-only RAG follow-up planning packet. Do not execute or persist anything."
        : status === "blocked"
          ? "Fix the teacher queue-selection receipt before any follow-up planning."
          : "Have the teacher select exactly one review-only follow-up lane.",
    mayPrepareSelectedReviewOnlyFollowUp: status === "ready_for_selected_review_only_rag_follow_up",
    mayAcceptTechnology: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayOpenDeliveryGate: false,
    mayUnlockPackaging: false,
    mayClaimGoalComplete: false,
    logicExtractionHints: queueLogicExtractionHints,
    logicEvidenceReviews: logicEvidenceReview ? [logicEvidenceReview] : [],
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
    deliveryGateOpen: false
  }
};

const validationDir = join(outDir, validation.validationId);
const validationPath = join(validationDir, "rag-follow-up-queue-selection-receipt-validation.json");
writeJson(validationPath, validation);

console.log(
  JSON.stringify(
    {
      ok: status !== "blocked",
      status,
      validationPath,
      selectedFollowUp: validation.selectedFollowUp,
      errors,
      warnings,
      locks: validation.locks
    },
    null,
    2
  )
);

if (status === "blocked") process.exit(1);
