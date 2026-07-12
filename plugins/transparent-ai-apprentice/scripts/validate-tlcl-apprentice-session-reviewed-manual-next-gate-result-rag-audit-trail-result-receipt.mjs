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
    String(value || "tlcl-rag-audit-trail-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-audit-trail-result-validation"
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

function hashBare(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function validationLocks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotRunAuditReviewReceiptBuilder: true,
    validatorDoesNotRunFollowUpQueue: true,
    validatorDoesNotOpenDeliveryGate: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    auditReviewReceiptBuilderRun: false,
    followUpQueueCreated: false,
    deliveryGateOpen: false,
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
  argValue("--audit-trail-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-audit-trail-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "audit_trail_result_reviewed_ready_for_audit_review_receipt",
  "needs_more_audit_trail_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_audit_review_receipt_builder",
  "run_follow_up_queue",
  "open_delivery_gate",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG audit trail result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_audit_trail_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunAuditReviewReceiptBuilder !== true) {
  block("builder_audit_review_receipt_lock_missing", "Builder must keep audit review receipt builder execution locked.");
}
if (receipt.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_v1") {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceAuditTrailResultReceiptBuilderId !== builder.auditTrailResultReceiptBuilderId) {
  block("source_audit_trail_result_receipt_builder_id_mismatch", "Receipt sourceAuditTrailResultReceiptBuilderId must match builder.");
}
if (receipt.sourceRagAuditTrailPath !== builder.sourceRagAuditTrailPath) {
  block("source_rag_audit_trail_path_mismatch", "Receipt source audit trail path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.auditTrailPath !== builder.sourceRagAuditTrailPath) {
  block("audit_trail_path_mismatch", "Receipt auditTrailPath must match builder.");
}
if (resolve(receipt.rollbackPoint || "") !== resolve(builder.sourceRagAuditTrail?.rollbackPoint || "")) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match builder rollback point.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let auditTrail = null;
let sourceStillValid = false;
try {
  auditTrail = readJson(receipt.auditTrailPath);
  const sourceGate = readJson(receipt.sourceGatePath);
  sourceStillValid =
    auditTrail.format === "transparent_ai_rag_delivery_gate_audit_trail_v1" &&
    auditTrail.status === "audit_trail_ready_for_teacher_review" &&
    auditTrail.teacherReviewed === true &&
    hashKnowledge(auditTrail) === receipt.auditTrailHash &&
    auditTrail.sourceGatePath === receipt.sourceGatePath &&
    auditTrail.sourceGateHash === receipt.sourceGateHash &&
    auditTrail.sourceGateHash === hashBare(sourceGate) &&
    auditTrail.rollbackPoint === receipt.rollbackPoint &&
    existsSync(auditTrail.rollbackPoint) &&
    auditTrail.locks?.reviewOnly === true &&
    auditTrail.locks?.evidenceOnly === true &&
    auditTrail.locks?.accepted === false &&
    auditTrail.locks?.ruleEnabled === false &&
    auditTrail.locks?.memoryEnabled === false &&
    auditTrail.locks?.softwareActionsExecuted === false &&
    auditTrail.locks?.externalFetchPerformed === false &&
    auditTrail.locks?.packagingGated === true &&
    auditTrail.locks?.packagingUnlocked === false &&
    auditTrail.locks?.deliveryGateOpen === false;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("rag_audit_trail_source_not_still_valid", "The referenced audit trail, source gate, or rollback point is missing, changed, or unlocked.");
}

const sourceReadyForAuditReviewReceipt =
  sourceStillValid &&
  Array.isArray(auditTrail?.evidenceChain) &&
  auditTrail.evidenceChain.some((entry) => entry.step === "closed_delivery_gate") &&
  auditTrail.evidenceChain.some((entry) => entry.step === "retained_rollback_point") &&
  Array.isArray(auditTrail?.blockedTransitions) &&
  auditTrail.blockedTransitions.includes("validation_report_delivery_allowed_to_packaging_unlock") &&
  auditTrail.blockedTransitions.includes("validation_report_delivery_allowed_to_software_execution") &&
  Array.isArray(auditTrail?.replay?.forbiddenInterpretations) &&
  auditTrail.replay.forbiddenInterpretations.includes("technology_acceptance") &&
  auditTrail.replay.forbiddenInterpretations.includes("packaging_unlock") &&
  auditTrail.replay.forbiddenInterpretations.includes("goal_completion");

if (decision === "audit_trail_result_reviewed_ready_for_audit_review_receipt") {
  if (!sourceReadyForAuditReviewReceipt) {
    block("source_not_ready_for_audit_review_receipt", "Audit trail must remain locked and preserve evidence, blocked transitions, and forbidden interpretations.");
  }
  if (receipt.auditTrailResultReviewed !== true) block("audit_trail_result_review_required", "Teacher must review the audit trail result.");
  if (receipt.evidenceChainReviewed !== true) block("evidence_chain_review_required", "Teacher must review the audit evidence chain.");
  if (receipt.blockedTransitionsReviewed !== true) block("blocked_transitions_review_required", "Teacher must review blocked transitions.");
  if (receipt.forbiddenInterpretationsReviewed !== true) {
    block("forbidden_interpretations_review_required", "Teacher must review forbidden audit interpretations.");
  }
  if (receipt.noActionLocksReviewed !== true) block("no_action_locks_review_required", "Teacher must review no-action locks.");
  if (receipt.teacherConfirmedNoAuditReviewReceiptBuilderRun !== true) {
    block("teacher_no_audit_review_builder_confirmation_required", "Teacher must confirm no audit review receipt builder was run here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if ((decision === "needs_more_audit_trail_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "audit_trail_result_reviewed_ready_for_audit_review_receipt" &&
  sourceReadyForAuditReviewReceipt &&
  receipt.auditTrailResultReviewed === true &&
  receipt.evidenceChainReviewed === true &&
  receipt.blockedTransitionsReviewed === true &&
  receipt.forbiddenInterpretationsReviewed === true &&
  receipt.noActionLocksReviewed === true &&
  receipt.teacherConfirmedNoAuditReviewReceiptBuilderRun === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_audit_trail_result_decision"
  : ready
    ? "tlcl_rag_audit_trail_ready_for_audit_review_receipt_planning"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_audit_trail_evidence" && blockers.length === 0
        ? "needs_more_audit_trail_evidence_before_audit_review_receipt"
        : "needs_teacher_review_before_audit_review_receipt";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const auditReviewReceiptHandoff = ready
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_review_receipt_handoff_v1",
      nextTool: "knowledge/create-rag-delivery-gate-audit-review-receipt-builder.mjs",
      auditTrailPath: receipt.auditTrailPath,
      auditTrailHash: receipt.auditTrailHash,
      sourceGatePath: receipt.sourceGatePath,
      sourceGateHash: receipt.sourceGateHash,
      rollbackPoint: receipt.rollbackPoint,
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-review-receipt-builder.mjs --audit-trail "${receipt.auditTrailPath}"`,
      instruction:
        "Run this audit review receipt builder only as a separate teacher-approved step. It must create a teacher receipt template without accepting technology, enabling rules, writing memory, executing software, fetching RAG, opening delivery, creating a follow-up queue, or unlocking packaging.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_audit_trail_result",
        sourceAuditTrailResultReceiptBuilderId: builder.auditTrailResultReceiptBuilderId || "",
        sourceRagAuditTrailPath: receipt.auditTrailPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the audit trail result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForAuditReviewReceiptPlanning: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreAuditTrailEvidence: status === "needs_more_audit_trail_evidence_before_audit_review_receipt",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagAuditTrailPath: receipt.auditTrailPath || ""
  },
  auditReviewReceiptHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_audit_review_receipt_builder_from_tlcl_audit_trail_result",
    "run_follow_up_queue_from_tlcl_audit_trail_result",
    "open_delivery_gate_from_tlcl_audit_trail_result",
    "invoke_model_from_tlcl_audit_trail_result",
    "fetch_rag_from_tlcl_audit_trail_result",
    "write_memory_from_tlcl_audit_trail_result",
    "enable_rule_from_tlcl_audit_trail_result",
    "unlock_packaging_from_tlcl_audit_trail_result",
    "claim_completion_from_tlcl_audit_trail_result"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-audit-trail-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-audit-trail-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_AUDIT_TRAIL_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Audit Trail Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the audit review receipt builder. It only prepares a manual audit review receipt handoff when the teacher confirms the existing audit trail result."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForAuditReviewReceiptPlanning: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreAuditTrailEvidence: validation.needsMoreAuditTrailEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      auditReviewReceiptHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
