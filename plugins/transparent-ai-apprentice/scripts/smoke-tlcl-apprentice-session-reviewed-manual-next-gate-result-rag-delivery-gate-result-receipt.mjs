#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".transparent-apprentice", "tlcl-rag-delivery-gate-result-receipt-smoke");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args = [], expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024
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
      "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt.mjs"
    )
  ).stdout
);
const tlclValidationPath = priorSmoke.validValidation.validationPath;
const handoff = priorSmoke.validValidation.deliveryGateHandoff;
const rollbackPoint = resolve(repoRoot, handoff.rollbackPoint);
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "tlcl-rag-delivery-gate-result-smoke",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const deliveryGateResult = JSON.parse(
  runScript(join(pluginRoot, "scripts", "knowledge", "create-rag-validation-report-delivery-gate.mjs"), [
    "--validation-report-packet",
    handoff.validationReportPacketPath,
    "--rollback-point",
    handoff.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "manual-existing-delivery-gate")
  ]).stdout
);

const builderResult = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt-builder.mjs"
    ),
    [
      "--tlcl-delivery-gate-planning-validation",
      tlclValidationPath,
      "--rag-delivery-gate",
      JSON.stringify(deliveryGateResult),
      "--output-dir",
      join(root, "builder")
    ]
  ).stdout
);
const builderPacket = readJson(builderResult.deliveryGateResultReceiptBuilderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);

const validReceiptPath = writeJson(join(root, "valid-delivery-gate-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "delivery_gate_result_reviewed_ready_for_audit_trail",
  deliveryGateResultReviewed: true,
  blockedTransitionsReviewed: true,
  forbiddenInterpretationsReviewed: true,
  teacherConfirmedGateClosed: true,
  teacherConfirmedNoAuditTrailRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "Teacher confirmed the closed delivery gate result may be handed off to a separate audit trail planning step."
});
const validValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt.mjs"),
    ["--builder", builderResult.deliveryGateResultReceiptBuilderPath, "--receipt", validReceiptPath, "--output-dir", join(root, "valid-validation")]
  ).stdout
);

const forbiddenReceiptPath = writeJson(join(root, "forbidden-audit-trail-builder-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_audit_trail_builder",
  deliveryGateResultReviewed: true,
  blockedTransitionsReviewed: true,
  forbiddenInterpretationsReviewed: true,
  teacherConfirmedGateClosed: true,
  teacherConfirmedNoAuditTrailRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "This forbidden receipt tries to run the audit trail builder."
});
const forbiddenRun = runScript(
  join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt.mjs"),
  ["--builder", builderResult.deliveryGateResultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);
const forbiddenValidation = JSON.parse(forbiddenRun.stdout);

const mismatchReceiptPath = writeJson(join(root, "mismatch-delivery-gate-hash-receipt.json"), {
  ...receiptTemplate,
  deliveryGateHash: "sha256:mismatch",
  teacherDecision: "delivery_gate_result_reviewed_ready_for_audit_trail",
  deliveryGateResultReviewed: true,
  blockedTransitionsReviewed: true,
  forbiddenInterpretationsReviewed: true,
  teacherConfirmedGateClosed: true,
  teacherConfirmedNoAuditTrailRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "This receipt has a mismatched delivery gate hash."
});
const mismatchValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt.mjs"),
    ["--builder", builderResult.deliveryGateResultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
  ).stdout
);

const evidenceReceiptPath = writeJson(join(root, "needs-more-delivery-gate-evidence-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "needs_more_delivery_gate_evidence",
  teacherNotes: "Teacher wants more delivery gate evidence before audit trail planning."
});
const evidenceValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt.mjs"),
    ["--builder", builderResult.deliveryGateResultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
  ).stdout
);

const correctionReceiptPath = writeJson(join(root, "correction-delivery-gate-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The delivery gate result shows the logic contract should be repaired by the high-reasoning layer."
});
const correctionValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt.mjs"),
    ["--builder", builderResult.deliveryGateResultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
  ).stdout
);

const checks = [
  {
    name: "TLCL RAG delivery gate result receipt builder consumes existing closed delivery gate",
    passed:
      builderResult.ok === true &&
      builderResult.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_delivery_gate_result_waiting_for_teacher_confirmation" &&
      builderPacket.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_builder_v1" &&
      receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_v1" &&
      builderResult.disabledRuleCount === 1 &&
      builderResult.lifecycleSkippedRows === 1 &&
      builderResult.locks?.builderDoesNotRunAuditTrailBuilder === true,
    evidence: { deliveryGateResultReceiptBuilderPath: builderResult.deliveryGateResultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG delivery gate result validation prepares manual audit trail handoff",
    passed:
      validValidation.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_delivery_gate_ready_for_audit_trail_planning" &&
      validValidation.readyForAuditTrailPlanning === true &&
      validValidation.auditTrailHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_trail_handoff_v1" &&
      validValidation.auditTrailHandoff?.nextTool === "knowledge/create-rag-delivery-gate-audit-trail.mjs" &&
      validValidation.auditTrailHandoff?.executeNow === false &&
      validValidation.locks?.validatorDoesNotRunAuditTrailBuilder === true,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG delivery gate result validation blocks forbidden audit trail runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_delivery_gate_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG delivery gate result validation detects delivery gate hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_audit_trail" &&
      mismatchValidation.readyForAuditTrailPlanning === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "rag_delivery_gate_source_not_still_valid"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG delivery gate result validation can request more evidence",
    passed:
      evidenceValidation.status === "needs_more_delivery_gate_evidence_before_audit_trail" &&
      evidenceValidation.needsMoreDeliveryGateEvidence === true &&
      evidenceValidation.locks?.validatorDoesNotRunAuditTrailBuilder === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG delivery gate result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route === "high_reasoning_logic_contract_repair_after_tlcl_rag_delivery_gate_result" &&
      correctionValidation.highReasoningRepairHandoff?.executeNow === false,
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclValidationPath,
  deliveryGatePath: deliveryGateResult.gatePath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
