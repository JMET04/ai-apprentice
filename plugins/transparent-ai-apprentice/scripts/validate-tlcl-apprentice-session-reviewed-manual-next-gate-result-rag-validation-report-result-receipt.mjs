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
    String(value || "tlcl-rag-validation-report-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-validation-report-result-validation"
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
    validatorDoesNotRunDeliveryGateBuilder: true,
    validatorDoesNotOpenDeliveryGate: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
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

const builderInput =
  argValue("--builder") ||
  argValue("--validation-report-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-validation-report-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "validation_report_result_reviewed_ready_for_delivery_gate",
  "needs_more_validation_report_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_delivery_gate_builder",
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
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG validation report result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_validation_report_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunDeliveryGateBuilder !== true) {
  block("builder_delivery_gate_lock_missing", "Builder must keep delivery gate builder execution locked.");
}
if (receipt.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_v1") {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceValidationReportResultReceiptBuilderId !== builder.validationReportResultReceiptBuilderId) {
  block("source_validation_report_result_receipt_builder_id_mismatch", "Receipt sourceValidationReportResultReceiptBuilderId must match builder.");
}
if (receipt.sourceRagValidationReportPacketPath !== builder.sourceRagValidationReportPacketPath) {
  block("source_rag_validation_report_packet_path_mismatch", "Receipt source validation report packet path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.validationReportPacketPath !== builder.sourceRagValidationReportPacketPath) {
  block("validation_report_packet_path_mismatch", "Receipt validationReportPacketPath must match builder.");
}
if (receipt.validationReportPath !== builder.sourceRagValidationReport?.validationReportPath) {
  block("validation_report_path_mismatch", "Receipt validationReportPath must match builder.");
}
if (resolve(receipt.rollbackPoint || "") !== resolve(builder.sourceRagValidationReport?.rollbackPoint || "")) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match builder rollback point.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let validationReportPacket = null;
let sourceStillValid = false;
try {
  validationReportPacket = readJson(receipt.validationReportPacketPath);
  const disabledPackage = readJson(receipt.disabledPackagePath);
  const report = readJson(receipt.validationReportPath);
  const nonSkippedRuleRows = (report.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped");
  sourceStillValid =
    validationReportPacket.format === "transparent_ai_rag_disabled_package_validation_report_v1" &&
    validationReportPacket.status === "ready_for_teacher_validation_report_review" &&
    hashKnowledge(validationReportPacket) === receipt.validationReportPacketHash &&
    validationReportPacket.validationReportPath === receipt.validationReportPath &&
    validationReportPacket.disabledPackagePath === receipt.disabledPackagePath &&
    validationReportPacket.disabledPackageHash === hashKnowledge(disabledPackage) &&
    validationReportPacket.summary?.disabledRuleCount === receipt.disabledRuleCount &&
    validationReportPacket.summary?.lifecycleSkippedRows === receipt.lifecycleSkippedRows &&
    validationReportPacket.summary?.deliveryAllowed === receipt.deliveryAllowed &&
    validationReportPacket.locks?.reviewOnly === true &&
    validationReportPacket.locks?.evidenceOnly === true &&
    validationReportPacket.locks?.accepted === false &&
    validationReportPacket.locks?.ruleEnabled === false &&
    validationReportPacket.locks?.activeRulePackageCompiled === false &&
    validationReportPacket.locks?.memoryEnabled === false &&
    validationReportPacket.locks?.softwareActionsExecuted === false &&
    validationReportPacket.locks?.externalFetchPerformed === false &&
    validationReportPacket.locks?.packagingGated === true &&
    validationReportPacket.locks?.packagingUnlocked === false &&
    report.delivery_allowed === true &&
    report.status === "skipped" &&
    nonSkippedRuleRows.length === 0;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("rag_validation_report_source_not_still_valid", "The referenced validation report packet, disabled package, or report is missing, changed, or unlocked.");
}

const sourceReadyForDeliveryGate =
  sourceStillValid &&
  validationReportPacket?.nextReview?.mayEnableRules === false &&
  validationReportPacket?.nextReview?.mayWriteMemory === false &&
  validationReportPacket?.nextReview?.mayExecuteSoftware === false &&
  validationReportPacket?.nextReview?.mayFetchExternalSources === false &&
  validationReportPacket?.nextReview?.mayUnlockPackaging === false;

if (decision === "validation_report_result_reviewed_ready_for_delivery_gate") {
  if (!sourceReadyForDeliveryGate) {
    block("source_not_ready_for_delivery_gate", "Validation report packet must be locked and review-only before delivery gate planning.");
  }
  if (receipt.validationReportResultReviewed !== true) block("validation_report_result_review_required", "Teacher must review the validation report result.");
  if (receipt.validationReportRowsReviewed !== true) block("validation_report_rows_review_required", "Teacher must review validation report rows.");
  if (receipt.disabledLifecycleSkipsReviewed !== true) {
    block("disabled_lifecycle_skips_review_required", "Teacher must review disabled lifecycle skipped rows.");
  }
  if (receipt.teacherConfirmedNoDeliveryGateRun !== true) {
    block("teacher_no_delivery_gate_confirmation_required", "Teacher must confirm no delivery gate builder was run here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if ((decision === "needs_more_validation_report_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "validation_report_result_reviewed_ready_for_delivery_gate" &&
  sourceReadyForDeliveryGate &&
  receipt.validationReportResultReviewed === true &&
  receipt.validationReportRowsReviewed === true &&
  receipt.disabledLifecycleSkipsReviewed === true &&
  receipt.teacherConfirmedNoDeliveryGateRun === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_validation_report_result_decision"
  : ready
    ? "tlcl_rag_validation_report_ready_for_delivery_gate_planning"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_validation_report_evidence" && blockers.length === 0
        ? "needs_more_validation_report_evidence_before_delivery_gate"
        : "needs_teacher_review_before_delivery_gate";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const deliveryGateHandoff = ready
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_delivery_gate_handoff_v1",
      nextTool: "knowledge/create-rag-validation-report-delivery-gate.mjs",
      validationReportPacketPath: receipt.validationReportPacketPath,
      validationReportPacketHash: receipt.validationReportPacketHash,
      validationReportPath: receipt.validationReportPath,
      disabledPackagePath: receipt.disabledPackagePath,
      disabledRuleCount: receipt.disabledRuleCount,
      lifecycleSkippedRows: receipt.lifecycleSkippedRows,
      rollbackPoint: receipt.rollbackPoint,
      requiredFlags: ["--teacher-reviewed"],
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-validation-report-delivery-gate.mjs --validation-report-packet "${receipt.validationReportPacketPath}" --rollback-point "${receipt.rollbackPoint}" --teacher-reviewed`,
      instruction:
        "Run this delivery gate command only as a separate teacher-approved step. It must keep delivery_allowed as review-only evidence and must not enable rules, write memory, execute software, fetch RAG, or unlock packaging.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_validation_report_result",
        sourceValidationReportResultReceiptBuilderId: builder.validationReportResultReceiptBuilderId || "",
        sourceRagValidationReportPacketPath: receipt.validationReportPacketPath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the validation report result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForDeliveryGatePlanning: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreValidationReportEvidence: status === "needs_more_validation_report_evidence_before_delivery_gate",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagValidationReportPacketPath: receipt.validationReportPacketPath || ""
  },
  deliveryGateHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_delivery_gate_builder_from_tlcl_validation_report_result",
    "open_delivery_gate_from_tlcl_validation_report_result",
    "invoke_model_from_tlcl_validation_report_result",
    "fetch_rag_from_tlcl_validation_report_result",
    "write_memory_from_tlcl_validation_report_result",
    "enable_rule_from_tlcl_validation_report_result",
    "unlock_packaging_from_tlcl_validation_report_result",
    "claim_completion_from_tlcl_validation_report_result"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-validation-report-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-validation-report-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_VALIDATION_REPORT_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Validation Report Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the delivery gate builder. It only prepares a manual delivery gate handoff when the teacher confirms the existing validation report result."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForDeliveryGatePlanning: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreValidationReportEvidence: validation.needsMoreValidationReportEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      deliveryGateHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
