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
    String(value || "tlcl-rag-delivery-gate-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-delivery-gate-result-validation"
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

function validationLocks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotRunAuditTrailBuilder: true,
    validatorDoesNotOpenDeliveryGate: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    auditTrailBuilderRun: false,
    auditTrailCreated: false,
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
  argValue("--delivery-gate-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-delivery-gate-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "delivery_gate_result_reviewed_ready_for_audit_trail",
  "needs_more_delivery_gate_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_audit_trail_builder",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG delivery gate result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_delivery_gate_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunAuditTrailBuilder !== true) {
  block("builder_audit_trail_lock_missing", "Builder must keep audit trail builder execution locked.");
}
if (receipt.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_v1") {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceDeliveryGateResultReceiptBuilderId !== builder.deliveryGateResultReceiptBuilderId) {
  block("source_delivery_gate_result_receipt_builder_id_mismatch", "Receipt sourceDeliveryGateResultReceiptBuilderId must match builder.");
}
if (receipt.sourceRagDeliveryGatePath !== builder.sourceRagDeliveryGatePath) {
  block("source_rag_delivery_gate_path_mismatch", "Receipt source delivery gate path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.deliveryGatePath !== builder.sourceRagDeliveryGatePath) {
  block("delivery_gate_path_mismatch", "Receipt deliveryGatePath must match builder.");
}
if (resolve(receipt.rollbackPoint || "") !== resolve(builder.sourceRagDeliveryGate?.rollbackPoint || "")) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match builder rollback point.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let deliveryGate = null;
let sourceStillValid = false;
try {
  deliveryGate = readJson(receipt.deliveryGatePath);
  const validationReportPacket = readJson(receipt.validationReportPacketPath);
  const validationReport = readJson(receipt.validationReportPath);
  sourceStillValid =
    deliveryGate.format === "transparent_ai_rag_validation_report_delivery_gate_v1" &&
    deliveryGate.status === "review_only_delivery_gate_closed" &&
    hashKnowledge(deliveryGate) === receipt.deliveryGateHash &&
    deliveryGate.validationReportPacketPath === receipt.validationReportPacketPath &&
    deliveryGate.validationReportPacketHash === hashKnowledge(validationReportPacket) &&
    deliveryGate.validationReportPath === receipt.validationReportPath &&
    deliveryGate.validationReportHash === hashKnowledge(validationReport) &&
    deliveryGate.summary?.disabledRuleCount === receipt.disabledRuleCount &&
    deliveryGate.summary?.lifecycleSkippedRows === receipt.lifecycleSkippedRows &&
    deliveryGate.summary?.reportDeliveryAllowed === receipt.reportDeliveryAllowed &&
    deliveryGate.summary?.gateAllowsPackaging === false &&
    deliveryGate.summary?.gateAllowsExecution === false &&
    receipt.gateAllowsPackaging === false &&
    receipt.gateAllowsExecution === false &&
    deliveryGate.decision?.deliveryAllowedOnlyMeansDisabledRulesDidNotBlock === true &&
    deliveryGate.locks?.reviewOnly === true &&
    deliveryGate.locks?.evidenceOnly === true &&
    deliveryGate.locks?.accepted === false &&
    deliveryGate.locks?.ruleEnabled === false &&
    deliveryGate.locks?.activeRulePackageCompiled === false &&
    deliveryGate.locks?.memoryEnabled === false &&
    deliveryGate.locks?.softwareActionsExecuted === false &&
    deliveryGate.locks?.externalFetchPerformed === false &&
    deliveryGate.locks?.packagingGated === true &&
    deliveryGate.locks?.packagingUnlocked === false &&
    deliveryGate.locks?.deliveryGateOpen === false &&
    validationReport.delivery_allowed === true &&
    validationReport.status === "skipped";
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("rag_delivery_gate_source_not_still_valid", "The referenced delivery gate, validation report packet, or report is missing, changed, or unlocked.");
}

const sourceReadyForAuditTrail =
  sourceStillValid &&
  Array.isArray(deliveryGate?.blockedTransitions) &&
  deliveryGate.blockedTransitions.includes("validation_report_delivery_allowed_to_packaging_unlock") &&
  deliveryGate.blockedTransitions.includes("validation_report_delivery_allowed_to_software_execution") &&
  deliveryGate?.nextReview?.requiredNextArtifact === "teacher_review_receipt_or_follow_up_queue";

if (decision === "delivery_gate_result_reviewed_ready_for_audit_trail") {
  if (!sourceReadyForAuditTrail) {
    block("source_not_ready_for_audit_trail", "Delivery gate must be closed, locked, and preserve blocked transitions before audit trail planning.");
  }
  if (receipt.deliveryGateResultReviewed !== true) block("delivery_gate_result_review_required", "Teacher must review the delivery gate result.");
  if (receipt.blockedTransitionsReviewed !== true) block("blocked_transitions_review_required", "Teacher must review blocked transitions.");
  if (receipt.forbiddenInterpretationsReviewed !== true) {
    block("forbidden_interpretations_review_required", "Teacher must review forbidden delivery_allowed interpretations.");
  }
  if (receipt.teacherConfirmedGateClosed !== true) block("closed_gate_confirmation_required", "Teacher must confirm the gate is closed.");
  if (receipt.teacherConfirmedNoAuditTrailRun !== true) {
    block("teacher_no_audit_trail_confirmation_required", "Teacher must confirm no audit trail builder was run here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if ((decision === "needs_more_delivery_gate_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "delivery_gate_result_reviewed_ready_for_audit_trail" &&
  sourceReadyForAuditTrail &&
  receipt.deliveryGateResultReviewed === true &&
  receipt.blockedTransitionsReviewed === true &&
  receipt.forbiddenInterpretationsReviewed === true &&
  receipt.teacherConfirmedGateClosed === true &&
  receipt.teacherConfirmedNoAuditTrailRun === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_delivery_gate_result_decision"
  : ready
    ? "tlcl_rag_delivery_gate_ready_for_audit_trail_planning"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_delivery_gate_evidence" && blockers.length === 0
        ? "needs_more_delivery_gate_evidence_before_audit_trail"
        : "needs_teacher_review_before_audit_trail";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const auditTrailHandoff = ready
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_trail_handoff_v1",
      nextTool: "knowledge/create-rag-delivery-gate-audit-trail.mjs",
      deliveryGatePath: receipt.deliveryGatePath,
      deliveryGateHash: receipt.deliveryGateHash,
      validationReportPacketPath: receipt.validationReportPacketPath,
      validationReportPath: receipt.validationReportPath,
      disabledRuleCount: receipt.disabledRuleCount,
      lifecycleSkippedRows: receipt.lifecycleSkippedRows,
      rollbackPoint: receipt.rollbackPoint,
      requiredFlags: ["--teacher-reviewed"],
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-trail.mjs --delivery-gate "${receipt.deliveryGatePath}" --rollback-point "${receipt.rollbackPoint}" --teacher-reviewed`,
      instruction:
        "Run this audit trail command only as a separate teacher-approved step. It must record evidence and blocked transitions without accepting technology, enabling rules, writing memory, executing software, fetching RAG, opening delivery, or unlocking packaging.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_delivery_gate_result",
        sourceDeliveryGateResultReceiptBuilderId: builder.deliveryGateResultReceiptBuilderId || "",
        sourceRagDeliveryGatePath: receipt.deliveryGatePath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the delivery gate result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForAuditTrailPlanning: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreDeliveryGateEvidence: status === "needs_more_delivery_gate_evidence_before_audit_trail",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagDeliveryGatePath: receipt.deliveryGatePath || ""
  },
  auditTrailHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_audit_trail_builder_from_tlcl_delivery_gate_result",
    "open_delivery_gate_from_tlcl_delivery_gate_result",
    "invoke_model_from_tlcl_delivery_gate_result",
    "fetch_rag_from_tlcl_delivery_gate_result",
    "write_memory_from_tlcl_delivery_gate_result",
    "enable_rule_from_tlcl_delivery_gate_result",
    "unlock_packaging_from_tlcl_delivery_gate_result",
    "claim_completion_from_tlcl_delivery_gate_result"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-delivery-gate-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-delivery-gate-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_DELIVERY_GATE_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Delivery Gate Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the audit trail builder. It only prepares a manual audit trail handoff when the teacher confirms the existing closed delivery gate result."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForAuditTrailPlanning: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreDeliveryGateEvidence: validation.needsMoreDeliveryGateEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      auditTrailHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
