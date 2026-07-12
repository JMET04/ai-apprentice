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
    String(value || "tlcl-rag-validation-report-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-validation-report-result"
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
    validationReportResultReceiptOnly: true,
    builderDoesNotRunDeliveryGateBuilder: true,
    builderDoesNotOpenDeliveryGate: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    deliveryGateBuilderRun: false,
    deliveryGateCreated: false,
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
  argValue("--tlcl-validation-report-planning-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const validationReportInput =
  argValue("--rag-validation-report") ||
  argValue("--validation-report") ||
  argValue("--validation-report-result") ||
  argValue("--builder-result");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-validation-report-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: validationReportInputValue, path: validationReportInputPath } = readJsonInput(
  validationReportInput,
  "RAG validation report"
);
if (!tlclInputValue || !validationReportInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt-builder.mjs --tlcl-validation-report-planning-validation <tlcl-validation.json-or-result.json> --rag-validation-report <validation-report-packet.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL validation"
);
const { packet: validationReportPacket, packetPath: validationReportPacketPath } = loadFullPacket(
  validationReportInputValue,
  validationReportInputPath,
  "transparent_ai_rag_disabled_package_validation_report_v1",
  ["packetPath"],
  "RAG validation report"
);

const handoff = tlclValidation.validationReportHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_disabled_package_ready_for_validation_report_planning") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for validation report planning.");
}
if (tlclValidation.readyForValidationReportPlanning !== true) {
  block("tlcl_validation_report_planning_flag_missing", "TLCL validation must set readyForValidationReportPlanning=true.");
}
if (
  !handoff ||
  handoff.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_validation_report_handoff_v1"
) {
  block("manual_validation_report_handoff_missing", "TLCL validation must contain the manual validation report handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-disabled-package-validation-report.mjs") {
  block("handoff_next_tool_mismatch", "Handoff must point to the existing RAG disabled package validation report builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunValidationReportBuilder !== true) {
  block("tlcl_validation_report_execution_lock_missing", "TLCL validation must keep validation report builder execution locked.");
}

const currentValidationReportPacketHash = hashKnowledge(validationReportPacket);
let disabledPackage = null;
let report = null;
if (!validationReportPacket.disabledPackagePath || !existsSync(validationReportPacket.disabledPackagePath)) {
  block("source_disabled_package_missing", "Validation report packet disabledPackagePath is missing or no longer exists.");
} else {
  disabledPackage = readJson(validationReportPacket.disabledPackagePath);
}
if (!validationReportPacket.validationReportPath || !existsSync(validationReportPacket.validationReportPath)) {
  block("source_validation_report_missing", "Validation report path is missing or no longer exists.");
} else {
  report = readJson(validationReportPacket.validationReportPath);
}

if (handoff?.disabledPackagePath && validationReportPacket.disabledPackagePath && resolve(handoff.disabledPackagePath) !== resolve(validationReportPacket.disabledPackagePath)) {
  block("handoff_disabled_package_path_mismatch", "Validation report packet disabledPackagePath must match the TLCL handoff.");
}
if (handoff?.rollbackPoint && validationReportPacket.rollbackPoint && resolve(handoff.rollbackPoint) !== resolve(validationReportPacket.rollbackPoint)) {
  block("handoff_rollback_point_mismatch", "Validation report packet rollbackPoint must match the TLCL handoff.");
}
if (disabledPackage && validationReportPacket.disabledPackageHash !== hashKnowledge(disabledPackage)) {
  block("validation_report_disabled_package_hash_mismatch", "Validation report disabledPackageHash no longer matches source disabled package.");
}
if (validationReportPacket.status !== "ready_for_teacher_validation_report_review") {
  block("validation_report_status_invalid", "Validation report packet must be ready for teacher validation report review.");
}
if (
  validationReportPacket.locks?.reviewOnly !== true ||
  validationReportPacket.locks?.evidenceOnly !== true ||
  validationReportPacket.locks?.accepted !== false ||
  validationReportPacket.locks?.ruleEnabled !== false ||
  validationReportPacket.locks?.activeRulePackageCompiled !== false ||
  validationReportPacket.locks?.memoryEnabled !== false ||
  validationReportPacket.locks?.softwareActionsExecuted !== false ||
  validationReportPacket.locks?.externalFetchPerformed !== false ||
  validationReportPacket.locks?.packagingGated !== true ||
  validationReportPacket.locks?.packagingUnlocked !== false
) {
  block("validation_report_locks_open", "Validation report packet locks must remain closed.");
}
if (report) {
  const nonSkippedRuleRows = (report.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped");
  if (report.delivery_allowed !== true || report.status !== "skipped") {
    block("validation_report_delivery_status_invalid", "Validation report must show skipped disabled rules and delivery_allowed=true.");
  }
  if (nonSkippedRuleRows.length || validationReportPacket.summary?.activeRulesEvaluated !== 0 || validationReportPacket.summary?.validatorRowsEvaluated !== 0) {
    block("validation_report_contains_active_validator_rows", "Validation report must not evaluate active validator rows.");
  }
  if (validationReportPacket.summary?.lifecycleSkippedRows !== validationReportPacket.summary?.disabledRuleCount) {
    block("validation_report_lifecycle_skip_count_mismatch", "Every disabled rule must appear as a lifecycle skipped row.");
  }
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(validationReportPacket.reportId || validationReportPacket.status)}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_validation_report_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_validation_report_result_receipt";

const receiptTemplate = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_v1",
  sourceValidationReportResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagValidationReportId: validationReportPacket.reportId || "",
  sourceRagValidationReportPacketPath: validationReportPacketPath,
  sourceRagValidationReportStatus: validationReportPacket.status || "",
  validationReportPacketPath,
  validationReportPacketHash: currentValidationReportPacketHash,
  validationReportPath: validationReportPacket.validationReportPath || "",
  disabledPackagePath: validationReportPacket.disabledPackagePath || "",
  disabledPackageHash: validationReportPacket.disabledPackageHash || "",
  disabledRuleCount: validationReportPacket.summary?.disabledRuleCount || 0,
  lifecycleSkippedRows: validationReportPacket.summary?.lifecycleSkippedRows || 0,
  deliveryAllowed: validationReportPacket.summary?.deliveryAllowed === true,
  rollbackPoint: validationReportPacket.rollbackPoint || "",
  handoffRollbackPoint: handoff?.rollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "validation_report_result_reviewed_ready_for_delivery_gate",
    "needs_more_validation_report_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_delivery_gate_builder",
    "execute_now",
    "accepted",
    "enable_rule",
    "write_memory",
    "fetch_rag",
    "invoke_model",
    "unlock_packaging",
    "claim_complete"
  ],
  validationReportResultReviewed: false,
  validationReportRowsReviewed: false,
  disabledLifecycleSkipsReviewed: false,
  teacherConfirmedNoDeliveryGateRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_builder_v1",
  validationReportResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagValidationReportPacketPath: validationReportPacketPath,
  sourceRagValidationReport: {
    reportId: validationReportPacket.reportId || "",
    status: validationReportPacket.status || "",
    validationReportPath: validationReportPacket.validationReportPath || "",
    rollbackPoint: validationReportPacket.rollbackPoint || "",
    disabledRuleCount: validationReportPacket.summary?.disabledRuleCount || 0,
    lifecycleSkippedRows: validationReportPacket.summary?.lifecycleSkippedRows || 0
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-validation-report-result-receipt-template.json"),
  validationReportResultReceiptBuilderPath: join(builderDir, "tlcl-rag-validation-report-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_VALIDATION_REPORT_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_delivery_gate_builder_from_validation_report_result",
    "open_delivery_gate_from_validation_report_result",
    "invoke_model_from_validation_report_result",
    "fetch_rag_from_validation_report_result",
    "write_memory_from_validation_report_result",
    "enable_rule_from_validation_report_result",
    "unlock_packaging_from_validation_report_result",
    "claim_completion_from_validation_report_result"
  ],
  locks: builderLocks()
};

writeJson(builderPacket.validationReportResultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Validation Report Result Receipt",
    "",
    "This packet brings the existing RAG disabled package validation report result back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Validation report packet: ${validationReportPacketPath}`,
    `- Validation report: ${validationReportPacket.validationReportPath || ""}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the delivery gate builder, open delivery, enable rules, write memory, fetch RAG, execute software, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_builder_result_v1",
      status,
      validationReportResultReceiptBuilderId: builderId,
      validationReportResultReceiptBuilderPath: builderPacket.validationReportResultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagValidationReportPacketPath: validationReportPacketPath,
      validationReportStatus: validationReportPacket.status || "",
      disabledRuleCount: validationReportPacket.summary?.disabledRuleCount || 0,
      lifecycleSkippedRows: validationReportPacket.summary?.lifecycleSkippedRows || 0,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
