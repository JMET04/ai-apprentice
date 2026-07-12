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
    String(value || "tlcl-rag-audit-trail-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-audit-trail-result"
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

function builderLocks() {
  return {
    reviewOnly: true,
    auditTrailResultReceiptOnly: true,
    builderDoesNotRunAuditReviewReceiptBuilder: true,
    builderDoesNotRunFollowUpQueue: true,
    builderDoesNotOpenDeliveryGate: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
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

const tlclValidationInput =
  argValue("--tlcl-audit-trail-planning-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const auditTrailInput =
  argValue("--rag-audit-trail") ||
  argValue("--audit-trail") ||
  argValue("--audit-trail-result") ||
  argValue("--builder-result");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-audit-trail-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: auditTrailInputValue, path: auditTrailInputPath } = readJsonInput(auditTrailInput, "RAG audit trail");
if (!tlclInputValue || !auditTrailInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt-builder.mjs --tlcl-audit-trail-planning-validation <tlcl-validation.json-or-result.json> --rag-audit-trail <audit-trail.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL validation"
);
const { packet: auditTrail, packetPath: auditTrailPath } = loadFullPacket(
  auditTrailInputValue,
  auditTrailInputPath,
  "transparent_ai_rag_delivery_gate_audit_trail_v1",
  ["auditPath"],
  "RAG audit trail"
);

const handoff = tlclValidation.auditTrailHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_delivery_gate_ready_for_audit_trail_planning") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for audit trail planning.");
}
if (tlclValidation.readyForAuditTrailPlanning !== true) {
  block("tlcl_audit_trail_planning_flag_missing", "TLCL validation must set readyForAuditTrailPlanning=true.");
}
if (!handoff || handoff.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_trail_handoff_v1") {
  block("manual_audit_trail_handoff_missing", "TLCL validation must contain the manual audit trail handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-delivery-gate-audit-trail.mjs") {
  block("handoff_next_tool_mismatch", "Handoff must point to the existing RAG delivery gate audit trail builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunAuditTrailBuilder !== true) {
  block("tlcl_audit_trail_execution_lock_missing", "TLCL validation must keep audit trail builder execution locked.");
}

let sourceGate = null;
if (!auditTrail.sourceGatePath || !existsSync(auditTrail.sourceGatePath)) {
  block("source_delivery_gate_missing", "Audit trail sourceGatePath is missing or no longer exists.");
} else {
  sourceGate = readJson(auditTrail.sourceGatePath);
}
if (handoff?.deliveryGatePath && auditTrail.sourceGatePath && resolve(handoff.deliveryGatePath) !== resolve(auditTrail.sourceGatePath)) {
  block("handoff_delivery_gate_path_mismatch", "Audit trail source gate must match the TLCL handoff.");
}
if (handoff?.rollbackPoint && auditTrail.rollbackPoint && resolve(handoff.rollbackPoint) !== resolve(auditTrail.rollbackPoint)) {
  block("handoff_rollback_point_mismatch", "Audit trail rollback point must match the TLCL handoff.");
}
if (handoff?.deliveryGateHash && sourceGate && handoff.deliveryGateHash !== hashKnowledge(sourceGate)) {
  block("handoff_delivery_gate_hash_mismatch", "Handoff deliveryGateHash no longer matches the source gate.");
}
if (sourceGate && auditTrail.sourceGateHash !== hashBare(sourceGate)) {
  block("audit_trail_source_gate_hash_mismatch", "Audit trail sourceGateHash no longer matches the source gate.");
}
if (!auditTrail.rollbackPoint || !existsSync(auditTrail.rollbackPoint)) {
  block("audit_trail_rollback_point_missing", "Audit trail rollbackPoint is missing or no longer exists.");
}
if (auditTrail.status !== "audit_trail_ready_for_teacher_review" || auditTrail.teacherReviewed !== true) {
  block("audit_trail_status_invalid", "Audit trail must be teacher-reviewed and ready for teacher review.");
}
if (
  auditTrail.locks?.reviewOnly !== true ||
  auditTrail.locks?.evidenceOnly !== true ||
  auditTrail.locks?.accepted !== false ||
  auditTrail.locks?.ruleEnabled !== false ||
  auditTrail.locks?.memoryEnabled !== false ||
  auditTrail.locks?.softwareActionsExecuted !== false ||
  auditTrail.locks?.externalFetchPerformed !== false ||
  auditTrail.locks?.packagingGated !== true ||
  auditTrail.locks?.packagingUnlocked !== false ||
  auditTrail.locks?.deliveryGateOpen !== false
) {
  block("audit_trail_locks_open", "Audit trail locks must remain closed.");
}
if (
  !Array.isArray(auditTrail.evidenceChain) ||
  !auditTrail.evidenceChain.some((entry) => entry.step === "closed_delivery_gate") ||
  !auditTrail.evidenceChain.some((entry) => entry.step === "retained_rollback_point")
) {
  block("audit_trail_evidence_chain_incomplete", "Audit trail must include closed delivery gate and retained rollback evidence.");
}
if (
  !Array.isArray(auditTrail.blockedTransitions) ||
  !auditTrail.blockedTransitions.includes("validation_report_delivery_allowed_to_packaging_unlock") ||
  !auditTrail.blockedTransitions.includes("validation_report_delivery_allowed_to_software_execution")
) {
  block("audit_trail_blocked_transitions_missing", "Audit trail must preserve blocked delivery_allowed interpretations.");
}
if (
  !Array.isArray(auditTrail.replay?.forbiddenInterpretations) ||
  !auditTrail.replay.forbiddenInterpretations.includes("technology_acceptance") ||
  !auditTrail.replay.forbiddenInterpretations.includes("packaging_unlock") ||
  !auditTrail.replay.forbiddenInterpretations.includes("goal_completion")
) {
  block("audit_trail_forbidden_interpretations_missing", "Audit trail must replay forbidden interpretations.");
}

const auditTrailHash = hashKnowledge(auditTrail);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(auditTrail.auditId || auditTrail.status)}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_audit_trail_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_audit_trail_result_receipt";

const receiptTemplate = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_v1",
  sourceAuditTrailResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagAuditTrailId: auditTrail.auditId || "",
  sourceRagAuditTrailPath: auditTrailPath,
  sourceRagAuditTrailStatus: auditTrail.status || "",
  auditTrailPath,
  auditTrailHash,
  sourceGatePath: auditTrail.sourceGatePath || "",
  sourceGateHash: auditTrail.sourceGateHash || "",
  rollbackPoint: auditTrail.rollbackPoint || "",
  handoffRollbackPoint: handoff?.rollbackPoint || "",
  evidenceSteps: (auditTrail.evidenceChain || []).map((entry) => entry.step),
  blockedTransitions: auditTrail.blockedTransitions || [],
  forbiddenInterpretations: auditTrail.replay?.forbiddenInterpretations || [],
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "audit_trail_result_reviewed_ready_for_audit_review_receipt",
    "needs_more_audit_trail_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
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
  ],
  auditTrailResultReviewed: false,
  evidenceChainReviewed: false,
  blockedTransitionsReviewed: false,
  forbiddenInterpretationsReviewed: false,
  noActionLocksReviewed: false,
  teacherConfirmedNoAuditReviewReceiptBuilderRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_builder_v1",
  auditTrailResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagAuditTrailPath: auditTrailPath,
  sourceRagAuditTrail: {
    auditId: auditTrail.auditId || "",
    status: auditTrail.status || "",
    sourceGatePath: auditTrail.sourceGatePath || "",
    rollbackPoint: auditTrail.rollbackPoint || "",
    evidenceSteps: (auditTrail.evidenceChain || []).map((entry) => entry.step),
    blockedTransitions: auditTrail.blockedTransitions || [],
    forbiddenInterpretations: auditTrail.replay?.forbiddenInterpretations || []
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-audit-trail-result-receipt-template.json"),
  auditTrailResultReceiptBuilderPath: join(builderDir, "tlcl-rag-audit-trail-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_AUDIT_TRAIL_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_audit_review_receipt_builder_from_audit_trail_result",
    "run_follow_up_queue_from_audit_trail_result",
    "open_delivery_gate_from_audit_trail_result",
    "invoke_model_from_audit_trail_result",
    "fetch_rag_from_audit_trail_result",
    "write_memory_from_audit_trail_result",
    "enable_rule_from_audit_trail_result",
    "unlock_packaging_from_audit_trail_result",
    "claim_completion_from_audit_trail_result"
  ],
  locks: builderLocks()
};

writeJson(builderPacket.auditTrailResultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Audit Trail Result Receipt",
    "",
    "This packet brings the existing RAG delivery gate audit trail result back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Audit trail: ${auditTrailPath}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the audit review receipt builder, create a follow-up queue, open delivery, enable rules, write memory, fetch RAG, execute software, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_builder_result_v1",
      status,
      auditTrailResultReceiptBuilderId: builderId,
      auditTrailResultReceiptBuilderPath: builderPacket.auditTrailResultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagAuditTrailPath: auditTrailPath,
      auditTrailStatus: auditTrail.status || "",
      evidenceSteps: builderPacket.sourceRagAuditTrail.evidenceSteps,
      blockedTransitions: auditTrail.blockedTransitions || [],
      forbiddenInterpretations: auditTrail.replay?.forbiddenInterpretations || [],
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
