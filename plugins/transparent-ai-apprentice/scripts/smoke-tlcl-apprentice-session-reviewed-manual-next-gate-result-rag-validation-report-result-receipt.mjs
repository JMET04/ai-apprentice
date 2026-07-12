#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".transparent-apprentice", "tlcl-rag-validation-report-result-receipt-smoke");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args = [], expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 60 * 1024 * 1024
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${scriptPath} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${scriptPath} unexpectedly passed:\nSTDOUT:\n${result.stdout}`);
  }
  return result;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const priorSmoke = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt.mjs"
    )
  ).stdout
);
const tlclValidationPath = priorSmoke.validValidation.validationPath;
const handoff = priorSmoke.validValidation.validationReportHandoff;
const rollbackPoint = resolve(repoRoot, handoff.rollbackPoint);
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "tlcl-rag-validation-report-result-smoke",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const validationReportResult = JSON.parse(
  runScript(join(pluginRoot, "scripts", "knowledge", "create-rag-disabled-package-validation-report.mjs"), [
    "--disabled-rule-package",
    handoff.disabledPackagePath,
    "--rollback-point",
    handoff.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "manual-existing-validation-report")
  ]).stdout
);

const builderResult = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt-builder.mjs"
    ),
    [
      "--tlcl-validation-report-planning-validation",
      tlclValidationPath,
      "--rag-validation-report",
      JSON.stringify(validationReportResult),
      "--output-dir",
      join(root, "builder")
    ]
  ).stdout
);
const builderPacket = readJson(builderResult.validationReportResultReceiptBuilderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);

const validReceiptPath = writeJson(join(root, "valid-validation-report-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "validation_report_result_reviewed_ready_for_delivery_gate",
  validationReportResultReviewed: true,
  validationReportRowsReviewed: true,
  disabledLifecycleSkipsReviewed: true,
  teacherConfirmedNoDeliveryGateRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "Teacher confirmed the validation report result may be handed off to a separate delivery gate planning step."
});
const validValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt.mjs"),
    ["--builder", builderResult.validationReportResultReceiptBuilderPath, "--receipt", validReceiptPath, "--output-dir", join(root, "valid-validation")]
  ).stdout
);

const forbiddenReceiptPath = writeJson(join(root, "forbidden-delivery-gate-builder-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_delivery_gate_builder",
  validationReportResultReviewed: true,
  validationReportRowsReviewed: true,
  disabledLifecycleSkipsReviewed: true,
  teacherConfirmedNoDeliveryGateRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "This forbidden receipt tries to run the delivery gate builder."
});
const forbiddenRun = runScript(
  join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt.mjs"),
  ["--builder", builderResult.validationReportResultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);
const forbiddenValidation = JSON.parse(forbiddenRun.stdout);

const mismatchReceiptPath = writeJson(join(root, "mismatch-validation-report-packet-hash-receipt.json"), {
  ...receiptTemplate,
  validationReportPacketHash: "sha256:mismatch",
  teacherDecision: "validation_report_result_reviewed_ready_for_delivery_gate",
  validationReportResultReviewed: true,
  validationReportRowsReviewed: true,
  disabledLifecycleSkipsReviewed: true,
  teacherConfirmedNoDeliveryGateRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "This receipt has a mismatched validation report packet hash."
});
const mismatchValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt.mjs"),
    ["--builder", builderResult.validationReportResultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
  ).stdout
);

const evidenceReceiptPath = writeJson(join(root, "needs-more-validation-report-evidence-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "needs_more_validation_report_evidence",
  teacherNotes: "Teacher wants more evidence from the validation report before delivery gate planning."
});
const evidenceValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt.mjs"),
    ["--builder", builderResult.validationReportResultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
  ).stdout
);

const correctionReceiptPath = writeJson(join(root, "correction-validation-report-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The validation report result shows the logic contract should be repaired by the high-reasoning layer."
});
const correctionValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt.mjs"),
    ["--builder", builderResult.validationReportResultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
  ).stdout
);

const checks = [
  {
    name: "TLCL RAG validation report result receipt builder consumes existing validation report",
    passed:
      builderResult.ok === true &&
      builderResult.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_validation_report_result_waiting_for_teacher_confirmation" &&
      builderPacket.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_builder_v1" &&
      receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_v1" &&
      builderResult.disabledRuleCount === 1 &&
      builderResult.lifecycleSkippedRows === 1 &&
      builderResult.locks?.builderDoesNotRunDeliveryGateBuilder === true,
    evidence: { validationReportResultReceiptBuilderPath: builderResult.validationReportResultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG validation report result validation prepares manual delivery gate handoff",
    passed:
      validValidation.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_validation_report_ready_for_delivery_gate_planning" &&
      validValidation.readyForDeliveryGatePlanning === true &&
      validValidation.deliveryGateHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_delivery_gate_handoff_v1" &&
      validValidation.deliveryGateHandoff?.nextTool === "knowledge/create-rag-validation-report-delivery-gate.mjs" &&
      validValidation.deliveryGateHandoff?.executeNow === false &&
      validValidation.locks?.validatorDoesNotRunDeliveryGateBuilder === true,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG validation report result validation blocks forbidden delivery gate runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_validation_report_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG validation report result validation detects validation report hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_delivery_gate" &&
      mismatchValidation.readyForDeliveryGatePlanning === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "rag_validation_report_source_not_still_valid"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG validation report result validation can request more evidence",
    passed:
      evidenceValidation.status === "needs_more_validation_report_evidence_before_delivery_gate" &&
      evidenceValidation.needsMoreValidationReportEvidence === true &&
      evidenceValidation.locks?.validatorDoesNotRunDeliveryGateBuilder === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG validation report result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route === "high_reasoning_logic_contract_repair_after_tlcl_rag_validation_report_result" &&
      correctionValidation.highReasoningRepairHandoff?.executeNow === false,
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclValidationPath,
  validationReportPacketPath: validationReportResult.packetPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
