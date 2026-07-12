#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".transparent-apprentice", "tlcl-rag-audit-trail-result-receipt-smoke");
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
      "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt.mjs"
    )
  ).stdout
);
const tlclValidationPath = priorSmoke.validValidation.validationPath;
const handoff = priorSmoke.validValidation.auditTrailHandoff;

const auditTrailResult = JSON.parse(
  runScript(join(pluginRoot, "scripts", "knowledge", "create-rag-delivery-gate-audit-trail.mjs"), [
    "--delivery-gate",
    handoff.deliveryGatePath,
    "--rollback-point",
    handoff.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "manual-existing-audit-trail")
  ]).stdout
);

const builderResult = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt-builder.mjs"
    ),
    [
      "--tlcl-audit-trail-planning-validation",
      tlclValidationPath,
      "--rag-audit-trail",
      JSON.stringify(auditTrailResult),
      "--output-dir",
      join(root, "builder")
    ]
  ).stdout
);
const builderPacket = readJson(builderResult.auditTrailResultReceiptBuilderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);

const validReceiptPath = writeJson(join(root, "valid-audit-trail-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "audit_trail_result_reviewed_ready_for_audit_review_receipt",
  auditTrailResultReviewed: true,
  evidenceChainReviewed: true,
  blockedTransitionsReviewed: true,
  forbiddenInterpretationsReviewed: true,
  noActionLocksReviewed: true,
  teacherConfirmedNoAuditReviewReceiptBuilderRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "Teacher confirmed the audit trail result may be handed off to a separate audit review receipt builder step."
});
const validValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt.mjs"),
    ["--builder", builderResult.auditTrailResultReceiptBuilderPath, "--receipt", validReceiptPath, "--output-dir", join(root, "valid-validation")]
  ).stdout
);

const forbiddenReceiptPath = writeJson(join(root, "forbidden-audit-review-builder-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_audit_review_receipt_builder",
  auditTrailResultReviewed: true,
  evidenceChainReviewed: true,
  blockedTransitionsReviewed: true,
  forbiddenInterpretationsReviewed: true,
  noActionLocksReviewed: true,
  teacherConfirmedNoAuditReviewReceiptBuilderRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "This forbidden receipt tries to run the audit review receipt builder."
});
const forbiddenRun = runScript(
  join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt.mjs"),
  ["--builder", builderResult.auditTrailResultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);
const forbiddenValidation = JSON.parse(forbiddenRun.stdout);

const mismatchReceiptPath = writeJson(join(root, "mismatch-audit-trail-hash-receipt.json"), {
  ...receiptTemplate,
  auditTrailHash: "sha256:mismatch",
  teacherDecision: "audit_trail_result_reviewed_ready_for_audit_review_receipt",
  auditTrailResultReviewed: true,
  evidenceChainReviewed: true,
  blockedTransitionsReviewed: true,
  forbiddenInterpretationsReviewed: true,
  noActionLocksReviewed: true,
  teacherConfirmedNoAuditReviewReceiptBuilderRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "This receipt has a mismatched audit trail hash."
});
const mismatchValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt.mjs"),
    ["--builder", builderResult.auditTrailResultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
  ).stdout
);

const evidenceReceiptPath = writeJson(join(root, "needs-more-audit-trail-evidence-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "needs_more_audit_trail_evidence",
  teacherNotes: "Teacher wants more audit trail evidence before audit review receipt planning."
});
const evidenceValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt.mjs"),
    ["--builder", builderResult.auditTrailResultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
  ).stdout
);

const correctionReceiptPath = writeJson(join(root, "correction-audit-trail-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The audit trail result shows the logic contract should be repaired by the high-reasoning layer."
});
const correctionValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt.mjs"),
    ["--builder", builderResult.auditTrailResultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
  ).stdout
);

const checks = [
  {
    name: "TLCL RAG audit trail result receipt builder consumes existing audit trail",
    passed:
      builderResult.ok === true &&
      builderResult.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_audit_trail_result_waiting_for_teacher_confirmation" &&
      builderPacket.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_builder_v1" &&
      receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_v1" &&
      builderResult.evidenceSteps.includes("closed_delivery_gate") &&
      builderResult.evidenceSteps.includes("retained_rollback_point") &&
      builderResult.locks?.builderDoesNotRunAuditReviewReceiptBuilder === true,
    evidence: { auditTrailResultReceiptBuilderPath: builderResult.auditTrailResultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG audit trail result validation prepares manual audit review receipt handoff",
    passed:
      validValidation.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_audit_trail_ready_for_audit_review_receipt_planning" &&
      validValidation.readyForAuditReviewReceiptPlanning === true &&
      validValidation.auditReviewReceiptHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_review_receipt_handoff_v1" &&
      validValidation.auditReviewReceiptHandoff?.nextTool === "knowledge/create-rag-delivery-gate-audit-review-receipt-builder.mjs" &&
      validValidation.auditReviewReceiptHandoff?.executeNow === false &&
      validValidation.locks?.validatorDoesNotRunAuditReviewReceiptBuilder === true,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG audit trail result validation blocks forbidden audit review builder runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_audit_trail_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG audit trail result validation detects audit trail hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_audit_review_receipt" &&
      mismatchValidation.readyForAuditReviewReceiptPlanning === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "rag_audit_trail_source_not_still_valid"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG audit trail result validation can request more evidence",
    passed:
      evidenceValidation.status === "needs_more_audit_trail_evidence_before_audit_review_receipt" &&
      evidenceValidation.needsMoreAuditTrailEvidence === true &&
      evidenceValidation.locks?.validatorDoesNotRunAuditReviewReceiptBuilder === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG audit trail result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route === "high_reasoning_logic_contract_repair_after_tlcl_rag_audit_trail_result" &&
      correctionValidation.highReasoningRepairHandoff?.executeNow === false,
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclValidationPath,
  auditTrailPath: auditTrailResult.auditPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
