#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".transparent-apprentice", "tlcl-rag-review-receipt-validation-result-receipt-smoke");
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
      "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt.mjs"
    )
  ).stdout
);
const tlclValidationPath = priorSmoke.validValidation.validationPath;
const handoff = priorSmoke.validValidation.manualRagReviewReceiptTemplateHandoff;
const ragReceiptTemplate = readJson(handoff.receiptTemplatePath);
const filledRagReceipt = {
  ...ragReceiptTemplate,
  decision: "teacher_reviewed_rule_dsl_validation_package",
  ruleDslReviews: ragReceiptTemplate.ruleDslReviews.map((row) => ({
    ...row,
    decision: "approve_disabled_rule_for_package_planning",
    evidenceReviewed: true,
    ruleReviewed: true,
    dslValidationReviewed: true,
    logicExtractionHintReviewed: Boolean(row.logicExtractionHint),
    logicFitDecisionReviewed: Boolean(row.logicExtractionHint),
    reviewerNote:
      "Teacher reviewed the RAG evidence, disabled Rule Card, and deterministic Rule DSL validation; continue only to review-only disabled package planning."
  }))
};
const filledRagReceiptPath = writeJson(join(root, "teacher-filled-rag-review-receipt.json"), filledRagReceipt);
const ragValidationResult = JSON.parse(
  runScript(join(pluginRoot, "scripts", "knowledge", "validate-rag-reviewed-rule-dsl-review-receipt.mjs"), [
    "--rule-dsl-validation-package",
    handoff.packagePath,
    "--receipt",
    filledRagReceiptPath,
    "--out-dir",
    join(root, "rag-validation")
  ]).stdout
);

const builderResult = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt-builder.mjs"
    ),
    [
      "--tlcl-builder-result-validation",
      tlclValidationPath,
      "--rag-review-receipt-validation",
      JSON.stringify(ragValidationResult),
      "--output-dir",
      join(root, "builder")
    ]
  ).stdout
);
const builderPacket = readJson(builderResult.validationResultReceiptBuilderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);

const validReceiptPath = writeJson(join(root, "valid-validation-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "rag_review_receipt_validation_result_reviewed_ready_for_disabled_package_planning",
  ragReviewReceiptValidationReviewed: true,
  readyStatusReviewed: true,
  reviewedDisabledRulesReviewed: true,
  teacherConfirmedNoDisabledPackageBuilderRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "Teacher confirmed the RAG validation result may be handed off to a separate review-only disabled package planning step."
});
const validValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt.mjs"
    ),
    ["--builder", builderResult.validationResultReceiptBuilderPath, "--receipt", validReceiptPath, "--output-dir", join(root, "valid-validation")]
  ).stdout
);

const forbiddenReceiptPath = writeJson(join(root, "forbidden-disabled-package-builder-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_disabled_package_builder",
  ragReviewReceiptValidationReviewed: true,
  readyStatusReviewed: true,
  reviewedDisabledRulesReviewed: true,
  teacherConfirmedNoDisabledPackageBuilderRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "This forbidden receipt tries to run the disabled package builder."
});
const forbiddenRun = runScript(
  join(
    pluginRoot,
    "scripts",
    "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt.mjs"
  ),
  ["--builder", builderResult.validationResultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);
const forbiddenValidation = JSON.parse(forbiddenRun.stdout);

const mismatchReceiptPath = writeJson(join(root, "mismatch-package-hash-receipt.json"), {
  ...receiptTemplate,
  packageHash: "sha256:mismatch",
  teacherDecision: "rag_review_receipt_validation_result_reviewed_ready_for_disabled_package_planning",
  ragReviewReceiptValidationReviewed: true,
  readyStatusReviewed: true,
  reviewedDisabledRulesReviewed: true,
  teacherConfirmedNoDisabledPackageBuilderRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "This receipt has a mismatched package hash."
});
const mismatchValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt.mjs"
    ),
    ["--builder", builderResult.validationResultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
  ).stdout
);

const evidenceReceiptPath = writeJson(join(root, "needs-more-validation-evidence-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "needs_more_rag_review_validation_evidence",
  teacherNotes: "Teacher wants more evidence from the RAG review validation before disabled package planning."
});
const evidenceValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt.mjs"
    ),
    ["--builder", builderResult.validationResultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
  ).stdout
);

const correctionReceiptPath = writeJson(join(root, "correction-validation-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The RAG validation result shows the logic contract should be repaired by the high-reasoning layer."
});
const correctionValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt.mjs"
    ),
    ["--builder", builderResult.validationResultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
  ).stdout
);

const checks = [
  {
    name: "TLCL RAG validation result receipt builder consumes existing RAG review receipt validation",
    passed:
      builderResult.ok === true &&
      builderResult.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_review_receipt_validation_result_waiting_for_teacher_confirmation" &&
      builderPacket.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_builder_v1" &&
      receiptTemplate.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_v1" &&
      builderResult.sourceReadyForDisabledPackagePlanning === true &&
      builderResult.locks?.builderDoesNotRunDisabledPackageBuilder === true,
    evidence: { validationResultReceiptBuilderPath: builderResult.validationResultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG validation result validation prepares manual disabled package planning handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_review_receipt_validation_ready_for_disabled_package_planning" &&
      validValidation.readyForDisabledPackagePlanning === true &&
      validValidation.disabledPackagePlanningHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_disabled_package_planning_handoff_v1" &&
      validValidation.disabledPackagePlanningHandoff?.nextTool === "knowledge/create-rag-reviewed-disabled-rule-package.mjs" &&
      validValidation.disabledPackagePlanningHandoff?.executeNow === false &&
      validValidation.locks?.validatorDoesNotRunDisabledPackageBuilder === true,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG validation result validation blocks forbidden disabled package builder runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_review_receipt_validation_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG validation result validation detects package hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_disabled_package_planning" &&
      mismatchValidation.readyForDisabledPackagePlanning === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "rag_review_receipt_validation_source_not_still_valid"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG validation result validation can request more evidence",
    passed:
      evidenceValidation.status === "needs_more_rag_review_validation_evidence_before_disabled_package_planning" &&
      evidenceValidation.needsMoreRagReviewValidationEvidence === true &&
      evidenceValidation.locks?.validatorDoesNotRunDisabledPackageBuilder === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG validation result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_review_receipt_validation_result" &&
      correctionValidation.highReasoningRepairHandoff?.executeNow === false,
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclValidationPath,
  ragReviewReceiptValidationPath: ragValidationResult.validationPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
