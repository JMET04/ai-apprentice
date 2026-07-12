#!/usr/bin/env node
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const auditTrailPath = resolve(arg("--audit-trail", ""));
const receiptPath = resolve(arg("--receipt", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-delivery-gate-audit-review-receipt-validation"))
);

if (!auditTrailPath || !receiptPath) {
  throw new Error(
    "Usage: node validate-rag-delivery-gate-audit-review-receipt.mjs --audit-trail <rag-delivery-gate-audit-trail.json> --receipt <teacher-filled-receipt.json> [--out-dir <dir>]"
  );
}

const audit = readJson(auditTrailPath);
const receipt = readJson(receiptPath);
if (audit.format !== "transparent_ai_rag_delivery_gate_audit_trail_v1") {
  throw new Error("Expected transparent_ai_rag_delivery_gate_audit_trail_v1.");
}
if (receipt.format !== "transparent_ai_rag_delivery_gate_audit_review_receipt_v1") {
  throw new Error("Expected transparent_ai_rag_delivery_gate_audit_review_receipt_v1.");
}

const auditHash = hashText(JSON.stringify(audit));
const planningLogicEvidence = audit.planningLogicEvidence || null;
const planningLogicEvidenceHash = audit.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = audit.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = audit.nextReview?.planningLogicEvidenceHash || "";
const allowedTop = new Set(["needs_teacher_review", "teacher_reviewed_audit_trail_for_follow_up", "blocked"]);
const allowedRows = new Set(["needs_teacher_review", "reviewed_evidence_chain_step", "blocked"]);
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

if (audit.status !== "audit_trail_ready_for_teacher_review") errors.push("AUDIT_STATUS_NOT_READY_FOR_TEACHER_REVIEW");
if (audit.locks?.reviewOnly !== true) errors.push("AUDIT_REVIEW_ONLY_LOCK_NOT_CLOSED");
if (audit.locks?.accepted !== false) errors.push("AUDIT_ACCEPTANCE_LOCK_NOT_CLOSED");
if (audit.locks?.ruleEnabled !== false) errors.push("AUDIT_RULE_LOCK_NOT_CLOSED");
if (audit.locks?.memoryEnabled !== false) errors.push("AUDIT_MEMORY_LOCK_NOT_CLOSED");
if (audit.locks?.softwareActionsExecuted !== false) errors.push("AUDIT_SOFTWARE_EXECUTION_LOCK_NOT_CLOSED");
if (audit.locks?.externalFetchPerformed !== false) errors.push("AUDIT_EXTERNAL_FETCH_LOCK_NOT_CLOSED");
if (audit.locks?.packagingUnlocked !== false) errors.push("AUDIT_PACKAGING_LOCK_NOT_CLOSED");
if (audit.locks?.deliveryGateOpen !== false) errors.push("AUDIT_DELIVERY_GATE_LOCK_NOT_CLOSED");
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  errors.push("AUDIT_REVIEW_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  errors.push("AUDIT_REVIEW_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash) {
  errors.push("AUDIT_REVIEW_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}

if (receipt.auditId !== audit.auditId) errors.push("AUDIT_ID_MISMATCH");
if (receipt.auditHash !== auditHash) errors.push("AUDIT_HASH_MISMATCH");
if ((receipt.planningLogicEvidenceHash || "") !== planningLogicEvidenceHash) {
  errors.push("AUDIT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (hashText(JSON.stringify(receipt.planningLogicEvidence || null)) !== hashText(JSON.stringify(planningLogicEvidence))) {
  errors.push("AUDIT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
if (!allowedTop.has(receipt.decision)) errors.push("TOP_LEVEL_DECISION_NOT_ALLOWED");
if (forbidden.has(receipt.decision)) errors.push("FORBIDDEN_TOP_LEVEL_DECISION");

const auditRows = new Map((audit.evidenceChain || []).map((entry) => [entry.step, entry]));
const receiptRows = Array.isArray(receipt.evidenceChainReviews) ? receipt.evidenceChainReviews : [];
if (receiptRows.length !== auditRows.size) errors.push("AUDIT_EVIDENCE_CHAIN_ROW_COUNT_MISMATCH");
const auditLogicRows = new Map((audit.disabledRuleLogicRows || []).map((row) => [String(row.sourceId || ""), row]));
const receiptLogicRows = Array.isArray(receipt.logicEvidenceReviews) ? receipt.logicEvidenceReviews : [];
if (receiptLogicRows.length !== auditLogicRows.size) errors.push("AUDIT_LOGIC_EVIDENCE_ROW_COUNT_MISMATCH");

let reviewedRows = 0;
let reviewedLogicRows = 0;
let forbiddenDecisionUsed = false;
for (const row of receiptRows) {
  const auditRow = auditRows.get(row.step);
  if (!auditRow) {
    errors.push(`UNKNOWN_AUDIT_EVIDENCE_ROW:${row.step || row.path || "unknown"}`);
    continue;
  }
  if (!allowedRows.has(row.decision)) errors.push(`ROW_DECISION_NOT_ALLOWED:${row.step}`);
  if (forbidden.has(row.decision)) {
    errors.push(`FORBIDDEN_ROW_DECISION:${row.step}`);
    forbiddenDecisionUsed = true;
  }
  if (row.path !== auditRow.path) errors.push(`AUDIT_ROW_PATH_MISMATCH:${row.step}`);
  if (row.hash !== auditRow.hash) errors.push(`AUDIT_ROW_HASH_MISMATCH:${row.step}`);
  if (row.decision === "reviewed_evidence_chain_step") {
    reviewedRows += 1;
    if (row.evidenceReviewed !== true) errors.push(`REVIEWED_ROW_REQUIRES_EVIDENCE_REVIEW:${row.step}`);
    if (row.hashReviewed !== true) errors.push(`REVIEWED_ROW_REQUIRES_HASH_REVIEW:${row.step}`);
    if (!String(row.reviewerNote || "").trim()) errors.push(`REVIEWED_ROW_REQUIRES_REVIEWER_NOTE:${row.step}`);
  }
}
for (const row of receiptLogicRows) {
  const auditRow = auditLogicRows.get(String(row.sourceId || ""));
  if (!auditRow) {
    errors.push(`UNKNOWN_AUDIT_LOGIC_EVIDENCE_ROW:${row.sourceId || row.ruleId || "unknown"}`);
    continue;
  }
  if (!["needs_teacher_review", "reviewed_logic_evidence", "request_logic_recheck", "blocked"].includes(row.decision)) {
    errors.push(`LOGIC_ROW_DECISION_NOT_ALLOWED:${row.sourceId || row.ruleId}`);
  }
  if (forbidden.has(row.decision)) {
    errors.push(`FORBIDDEN_LOGIC_ROW_DECISION:${row.sourceId || row.ruleId}`);
    forbiddenDecisionUsed = true;
  }
  if ((row.ruleId || "") !== (auditRow.ruleId || "")) errors.push(`AUDIT_LOGIC_ROW_RULE_ID_MISMATCH:${row.sourceId}`);
  if ((row.logicExtractionHint || "") !== (auditRow.logicExtractionHint || "")) {
    errors.push(`AUDIT_LOGIC_EXTRACTION_HINT_MISMATCH:${row.sourceId}`);
  }
  if ((row.logicFitDecision || "not_applicable") !== (auditRow.logicFitDecision || "not_applicable")) {
    errors.push(`AUDIT_LOGIC_FIT_DECISION_MISMATCH:${row.sourceId}`);
  }
  if (row.decision === "reviewed_logic_evidence") {
    reviewedLogicRows += 1;
    if (row.logicEvidenceReviewed !== true) errors.push(`REVIEWED_LOGIC_ROW_REQUIRES_LOGIC_EVIDENCE_REVIEW:${row.sourceId}`);
    if (row.logicFitReviewed !== true) errors.push(`REVIEWED_LOGIC_ROW_REQUIRES_LOGIC_FIT_REVIEW:${row.sourceId}`);
    if (auditRow.logicFitDecision !== "matches_intended_logic") errors.push(`REVIEWED_LOGIC_ROW_REQUIRES_MATCHING_LOGIC_FIT:${row.sourceId}`);
    if (!String(row.reviewerNote || "").trim()) errors.push(`REVIEWED_LOGIC_ROW_REQUIRES_REVIEWER_NOTE:${row.sourceId}`);
  }
}

if (receipt.decision === "teacher_reviewed_audit_trail_for_follow_up") {
  if (reviewedRows !== auditRows.size) errors.push("FOLLOW_UP_DECISION_REQUIRES_ALL_EVIDENCE_ROWS_REVIEWED");
  if (reviewedLogicRows !== auditLogicRows.size) errors.push("FOLLOW_UP_DECISION_REQUIRES_ALL_LOGIC_EVIDENCE_ROWS_REVIEWED");
  if (receipt.blockedTransitionsReviewed !== true) errors.push("FOLLOW_UP_DECISION_REQUIRES_BLOCKED_TRANSITIONS_REVIEW");
  if (receipt.forbiddenInterpretationsReviewed !== true) errors.push("FOLLOW_UP_DECISION_REQUIRES_FORBIDDEN_INTERPRETATIONS_REVIEW");
  if (receipt.noActionLocksReviewed !== true) errors.push("FOLLOW_UP_DECISION_REQUIRES_NO_ACTION_LOCK_REVIEW");
  if (receipt.rollbackPointRetained !== true) errors.push("FOLLOW_UP_DECISION_REQUIRES_RETAINED_ROLLBACK_POINT");
  if (!String(receipt.reviewerNote || "").trim()) errors.push("FOLLOW_UP_DECISION_REQUIRES_REVIEWER_NOTE");
}
if (receipt.decision === "needs_teacher_review" && reviewedRows > 0) {
  errors.push("REVIEWED_ROWS_REQUIRE_REVIEWED_TOP_LEVEL_DECISION");
}
if (receipt.decision === "blocked" && !String(receipt.reviewerNote || "").trim()) {
  warnings.push("BLOCKED_DECISION_SHOULD_INCLUDE_REVIEWER_NOTE");
}

const ready = receipt.decision === "teacher_reviewed_audit_trail_for_follow_up" && errors.length === 0 && !forbiddenDecisionUsed;
const status = errors.length > 0 || forbiddenDecisionUsed ? "blocked" : ready ? "ready_for_review_only_follow_up_queue" : "waiting_for_teacher_review";

const validation = {
  format: "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1",
  validationId: stableId("rag_delivery_gate_audit_review_receipt_validation", `${auditTrailPath}:${receiptPath}`),
  createdAt: new Date().toISOString(),
  auditTrailPath,
  receiptPath,
  auditHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status,
  errors,
  warnings,
  reviewedEvidenceRows: reviewedRows,
  reviewedLogicEvidenceRows: reviewedLogicRows,
  nextReview: {
    instruction:
      status === "ready_for_review_only_follow_up_queue"
        ? "Prepare only a separate review-only follow-up queue. Do not treat this as acceptance or permission."
        : status === "blocked"
          ? "Fix or re-review the audit receipt before any follow-up queue planning."
          : "Have the teacher review every audit evidence row, blocked transition, forbidden interpretation, no-action lock, and rollback point.",
    mayPrepareReviewOnlyFollowUpQueue: status === "ready_for_review_only_follow_up_queue",
    mayAcceptTechnology: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayOpenDeliveryGate: false,
    mayUnlockPackaging: false,
    mayClaimGoalComplete: false,
    logicExtractionHints: (audit.disabledRuleLogicRows || []).map((row) => ({
      sourceId: row.sourceId,
      ruleId: row.ruleId,
      logicExtractionHint: row.logicExtractionHint,
      logicFitDecision: row.logicFitDecision
    })),
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
const validationPath = join(validationDir, "rag-delivery-gate-audit-review-receipt-validation.json");
writeJson(validationPath, validation);

console.log(
  JSON.stringify(
    {
      ok: status !== "blocked",
      status,
      validationPath,
      reviewedEvidenceRows: reviewedRows,
      errors,
      warnings,
      locks: validation.locks
    },
    null,
    2
  )
);

if (status === "blocked") process.exit(1);
