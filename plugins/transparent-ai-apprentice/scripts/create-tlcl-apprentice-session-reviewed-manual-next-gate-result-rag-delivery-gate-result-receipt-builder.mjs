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
    String(value || "tlcl-rag-delivery-gate-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-delivery-gate-result"
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

function builderLocks() {
  return {
    reviewOnly: true,
    deliveryGateResultReceiptOnly: true,
    builderDoesNotRunAuditTrailBuilder: true,
    builderDoesNotOpenDeliveryGate: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
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
  argValue("--tlcl-delivery-gate-planning-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const deliveryGateInput =
  argValue("--rag-delivery-gate") ||
  argValue("--delivery-gate") ||
  argValue("--delivery-gate-result") ||
  argValue("--builder-result");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-delivery-gate-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: deliveryGateInputValue, path: deliveryGateInputPath } = readJsonInput(deliveryGateInput, "RAG delivery gate");
if (!tlclInputValue || !deliveryGateInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt-builder.mjs --tlcl-delivery-gate-planning-validation <tlcl-validation.json-or-result.json> --rag-delivery-gate <delivery-gate.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL validation"
);
const { packet: deliveryGate, packetPath: deliveryGatePath } = loadFullPacket(
  deliveryGateInputValue,
  deliveryGateInputPath,
  "transparent_ai_rag_validation_report_delivery_gate_v1",
  ["gatePath"],
  "RAG delivery gate"
);

const handoff = tlclValidation.deliveryGateHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_validation_report_ready_for_delivery_gate_planning") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for delivery gate planning.");
}
if (tlclValidation.readyForDeliveryGatePlanning !== true) {
  block("tlcl_delivery_gate_planning_flag_missing", "TLCL validation must set readyForDeliveryGatePlanning=true.");
}
if (!handoff || handoff.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_delivery_gate_handoff_v1") {
  block("manual_delivery_gate_handoff_missing", "TLCL validation must contain the manual delivery gate handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-validation-report-delivery-gate.mjs") {
  block("handoff_next_tool_mismatch", "Handoff must point to the existing RAG validation report delivery gate builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunDeliveryGateBuilder !== true) {
  block("tlcl_delivery_gate_execution_lock_missing", "TLCL validation must keep delivery gate builder execution locked.");
}

let validationReportPacket = null;
let validationReport = null;
if (!deliveryGate.validationReportPacketPath || !existsSync(deliveryGate.validationReportPacketPath)) {
  block("source_validation_report_packet_missing", "Delivery gate validationReportPacketPath is missing or no longer exists.");
} else {
  validationReportPacket = readJson(deliveryGate.validationReportPacketPath);
}
if (!deliveryGate.validationReportPath || !existsSync(deliveryGate.validationReportPath)) {
  block("source_validation_report_missing", "Delivery gate validationReportPath is missing or no longer exists.");
} else {
  validationReport = readJson(deliveryGate.validationReportPath);
}

if (handoff?.validationReportPacketPath && deliveryGate.validationReportPacketPath && resolve(handoff.validationReportPacketPath) !== resolve(deliveryGate.validationReportPacketPath)) {
  block("handoff_validation_report_packet_path_mismatch", "Delivery gate validationReportPacketPath must match the TLCL handoff.");
}
if (handoff?.rollbackPoint && deliveryGate.rollbackPoint && resolve(handoff.rollbackPoint) !== resolve(deliveryGate.rollbackPoint)) {
  block("handoff_rollback_point_mismatch", "Delivery gate rollbackPoint must match the TLCL handoff.");
}
if (validationReportPacket && deliveryGate.validationReportPacketHash !== hashKnowledge(validationReportPacket)) {
  block("delivery_gate_validation_packet_hash_mismatch", "Delivery gate validationReportPacketHash no longer matches source packet.");
}
if (validationReport && deliveryGate.validationReportHash !== hashKnowledge(validationReport)) {
  block("delivery_gate_validation_report_hash_mismatch", "Delivery gate validationReportHash no longer matches source report.");
}
if (deliveryGate.status !== "review_only_delivery_gate_closed") {
  block("delivery_gate_status_invalid", "Delivery gate must be closed and review-only.");
}
if (
  deliveryGate.decision?.deliveryAllowedOnlyMeansDisabledRulesDidNotBlock !== true ||
  deliveryGate.summary?.gateAllowsPackaging !== false ||
  deliveryGate.summary?.gateAllowsExecution !== false ||
  deliveryGate.locks?.reviewOnly !== true ||
  deliveryGate.locks?.evidenceOnly !== true ||
  deliveryGate.locks?.accepted !== false ||
  deliveryGate.locks?.ruleEnabled !== false ||
  deliveryGate.locks?.activeRulePackageCompiled !== false ||
  deliveryGate.locks?.memoryEnabled !== false ||
  deliveryGate.locks?.softwareActionsExecuted !== false ||
  deliveryGate.locks?.externalFetchPerformed !== false ||
  deliveryGate.locks?.packagingGated !== true ||
  deliveryGate.locks?.packagingUnlocked !== false ||
  deliveryGate.locks?.deliveryGateOpen !== false
) {
  block("delivery_gate_locks_open", "Delivery gate locks must remain closed.");
}
if (
  !Array.isArray(deliveryGate.blockedTransitions) ||
  !deliveryGate.blockedTransitions.includes("validation_report_delivery_allowed_to_packaging_unlock") ||
  !deliveryGate.blockedTransitions.includes("validation_report_delivery_allowed_to_software_execution")
) {
  block("delivery_gate_blocked_transitions_missing", "Delivery gate must preserve blocked delivery_allowed interpretations.");
}
if (validationReport && (validationReport.delivery_allowed !== true || validationReport.status !== "skipped")) {
  block("delivery_gate_validation_report_status_invalid", "Delivery gate source report must remain skipped with delivery_allowed=true.");
}

const deliveryGateHash = hashKnowledge(deliveryGate);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(deliveryGate.gateId || deliveryGate.status)}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_delivery_gate_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_delivery_gate_result_receipt";

const receiptTemplate = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_v1",
  sourceDeliveryGateResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagDeliveryGateId: deliveryGate.gateId || "",
  sourceRagDeliveryGatePath: deliveryGatePath,
  sourceRagDeliveryGateStatus: deliveryGate.status || "",
  deliveryGatePath,
  deliveryGateHash,
  validationReportPacketPath: deliveryGate.validationReportPacketPath || "",
  validationReportPacketHash: deliveryGate.validationReportPacketHash || "",
  validationReportPath: deliveryGate.validationReportPath || "",
  validationReportHash: deliveryGate.validationReportHash || "",
  disabledRuleCount: deliveryGate.summary?.disabledRuleCount || 0,
  lifecycleSkippedRows: deliveryGate.summary?.lifecycleSkippedRows || 0,
  reportDeliveryAllowed: deliveryGate.summary?.reportDeliveryAllowed === true,
  gateAllowsPackaging: deliveryGate.summary?.gateAllowsPackaging === true,
  gateAllowsExecution: deliveryGate.summary?.gateAllowsExecution === true,
  rollbackPoint: deliveryGate.rollbackPoint || "",
  handoffRollbackPoint: handoff?.rollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "delivery_gate_result_reviewed_ready_for_audit_trail",
    "needs_more_delivery_gate_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
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
  ],
  deliveryGateResultReviewed: false,
  blockedTransitionsReviewed: false,
  forbiddenInterpretationsReviewed: false,
  teacherConfirmedGateClosed: false,
  teacherConfirmedNoAuditTrailRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_builder_v1",
  deliveryGateResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagDeliveryGatePath: deliveryGatePath,
  sourceRagDeliveryGate: {
    gateId: deliveryGate.gateId || "",
    status: deliveryGate.status || "",
    validationReportPacketPath: deliveryGate.validationReportPacketPath || "",
    validationReportPath: deliveryGate.validationReportPath || "",
    rollbackPoint: deliveryGate.rollbackPoint || "",
    disabledRuleCount: deliveryGate.summary?.disabledRuleCount || 0,
    lifecycleSkippedRows: deliveryGate.summary?.lifecycleSkippedRows || 0,
    blockedTransitions: deliveryGate.blockedTransitions || []
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-delivery-gate-result-receipt-template.json"),
  deliveryGateResultReceiptBuilderPath: join(builderDir, "tlcl-rag-delivery-gate-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_DELIVERY_GATE_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_audit_trail_builder_from_delivery_gate_result",
    "open_delivery_gate_from_delivery_gate_result",
    "invoke_model_from_delivery_gate_result",
    "fetch_rag_from_delivery_gate_result",
    "write_memory_from_delivery_gate_result",
    "enable_rule_from_delivery_gate_result",
    "unlock_packaging_from_delivery_gate_result",
    "claim_completion_from_delivery_gate_result"
  ],
  locks: builderLocks()
};

writeJson(builderPacket.deliveryGateResultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Delivery Gate Result Receipt",
    "",
    "This packet brings the existing closed RAG delivery gate result back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Delivery gate: ${deliveryGatePath}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the audit trail builder, open delivery, enable rules, write memory, fetch RAG, execute software, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_builder_result_v1",
      status,
      deliveryGateResultReceiptBuilderId: builderId,
      deliveryGateResultReceiptBuilderPath: builderPacket.deliveryGateResultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagDeliveryGatePath: deliveryGatePath,
      deliveryGateStatus: deliveryGate.status || "",
      disabledRuleCount: deliveryGate.summary?.disabledRuleCount || 0,
      lifecycleSkippedRows: deliveryGate.summary?.lifecycleSkippedRows || 0,
      blockedTransitions: deliveryGate.blockedTransitions || [],
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
