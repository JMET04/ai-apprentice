#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".transparent-apprentice", "tlcl-rag-audit-review-receipt-builder-result-receipt-smoke");
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
      "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt.mjs"
    )
  ).stdout
);
const tlclValidationPath = priorSmoke.validValidation.validationPath;
const handoff = priorSmoke.validValidation.auditReviewReceiptHandoff;

const existingAuditReviewReceiptBuilderResult = JSON.parse(
  runScript(join(pluginRoot, "scripts", "knowledge", "create-rag-delivery-gate-audit-review-receipt-builder.mjs"), [
    "--audit-trail",
    handoff.auditTrailPath,
    "--out-dir",
    join(root, "manual-existing-audit-review-receipt-builder")
  ]).stdout
);

const builderResult = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt-builder.mjs"
    ),
    [
      "--tlcl-audit-review-receipt-planning-validation",
      tlclValidationPath,
      "--rag-audit-review-receipt-builder",
      JSON.stringify(existingAuditReviewReceiptBuilderResult),
      "--output-dir",
      join(root, "builder")
    ]
  ).stdout
);
const builderPacket = readJson(builderResult.resultReceiptBuilderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);

const validReceiptPath = writeJson(join(root, "valid-builder-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "audit_review_receipt_builder_result_reviewed_ready_for_teacher_receipt",
  builderOutputReviewed: true,
  receiptTemplateReviewed: true,
  validationCommandReviewed: true,
  teacherConfirmedNoValidationRun: true,
  teacherConfirmedNoFollowUpQueue: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "Teacher confirmed the audit review receipt builder result is ready for separate teacher receipt filling."
});
const validValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt.mjs"
    ),
    ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", validReceiptPath, "--output-dir", join(root, "valid-validation")]
  ).stdout
);

const forbiddenReceiptPath = writeJson(join(root, "forbidden-validator-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_audit_review_receipt_validator",
  builderOutputReviewed: true,
  receiptTemplateReviewed: true,
  validationCommandReviewed: true,
  teacherConfirmedNoValidationRun: false,
  teacherConfirmedNoFollowUpQueue: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "This forbidden receipt tries to run the audit review receipt validator."
});
const forbiddenRun = runScript(
  join(
    pluginRoot,
    "scripts",
    "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt.mjs"
  ),
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);
const forbiddenValidation = JSON.parse(forbiddenRun.stdout);

const mismatchReceiptPath = writeJson(join(root, "mismatch-validation-command-receipt.json"), {
  ...receiptTemplate,
  validationCommand: "node wrong-audit-review-validator.mjs --receipt <teacher-filled-receipt.json>",
  teacherDecision: "audit_review_receipt_builder_result_reviewed_ready_for_teacher_receipt",
  builderOutputReviewed: true,
  receiptTemplateReviewed: true,
  validationCommandReviewed: true,
  teacherConfirmedNoValidationRun: true,
  teacherConfirmedNoFollowUpQueue: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "This receipt has a mismatched validation command."
});
const mismatchValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt.mjs"
    ),
    ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
  ).stdout
);

const evidenceReceiptPath = writeJson(join(root, "needs-more-builder-evidence-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "needs_more_audit_review_builder_evidence",
  teacherNotes: "Teacher wants more evidence from the audit review receipt builder before filling the receipt."
});
const evidenceValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt.mjs"
    ),
    ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
  ).stdout
);

const correctionReceiptPath = writeJson(join(root, "correction-builder-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The audit review receipt builder result does not match the intended TLCL contract."
});
const correctionValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt.mjs"
    ),
    ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
  ).stdout
);

const checks = [
  {
    name: "TLCL RAG audit review receipt builder result receipt builder consumes existing audit review builder output",
    passed:
      builderResult.ok === true &&
      builderResult.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_audit_review_receipt_builder_result_waiting_for_teacher_confirmation" &&
      builderPacket.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_builder_v1" &&
      receiptTemplate.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_v1" &&
      builderResult.locks?.builderDoesNotValidateAuditReviewReceipt === true,
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG audit review receipt builder result validation prepares teacher-fill handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_audit_review_receipt_template_ready_for_teacher_fill" &&
      validValidation.readyForAuditReviewReceiptTeacherFill === true &&
      validValidation.manualAuditReviewReceiptTemplateHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_audit_review_receipt_template_handoff_v1" &&
      validValidation.manualAuditReviewReceiptTemplateHandoff?.executeNow === false &&
      validValidation.locks?.validatorDoesNotValidateAuditReviewReceipt === true,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG audit review receipt builder result validation blocks forbidden validator runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_audit_review_receipt_builder_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG audit review receipt builder result validation detects validation command mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_audit_review_receipt_template" &&
      mismatchValidation.readyForAuditReviewReceiptTeacherFill === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "validation_command_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG audit review receipt builder result validation can request more evidence",
    passed:
      evidenceValidation.status === "needs_more_audit_review_builder_evidence_before_teacher_receipt" &&
      evidenceValidation.needsMoreAuditReviewBuilderEvidence === true &&
      evidenceValidation.locks?.validatorDoesNotValidateAuditReviewReceipt === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG audit review receipt builder result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_audit_review_receipt_builder_result" &&
      correctionValidation.highReasoningRepairHandoff?.executeNow === false,
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclValidationPath,
  existingAuditReviewReceiptBuilderResult,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
