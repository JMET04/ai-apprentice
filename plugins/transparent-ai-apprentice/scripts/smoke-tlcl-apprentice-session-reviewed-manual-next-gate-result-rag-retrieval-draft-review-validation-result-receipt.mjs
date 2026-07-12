#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "./knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".transparent-apprentice", "tlcl-rag-retrieval-draft-review-validation-result-receipt-smoke");
mkdirSync(root, { recursive: true });

function runScript(relativeScript, args, expectOk = true) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", relativeScript), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${relativeScript} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${relativeScript} unexpectedly passed:\nSTDOUT:\n${result.stdout}`);
  }
  return result;
}

function runJson(relativeScript, args, expectOk = true) {
  return JSON.parse(runScript(relativeScript, args, expectOk).stdout);
}

function fillRetrievalDraftReviewReceipt(receipt) {
  return {
    ...receipt,
    decision: "teacher_reviewed_disabled_drafts",
    retrievalReviews: receipt.retrievalReviews.map((row) =>
      row.rulePath
        ? {
            ...row,
            decision: "approve_disabled_draft_for_rule_dsl_validation",
            evidenceReviewed: true,
            ruleDraftReviewed: true,
            logicExtractionHintReviewed: Boolean(row.logicExtractionHint),
            logicFitDecision: row.logicExtractionHint ? "matches_intended_logic" : "not_applicable",
            reviewerNote:
              "Teacher reviewed the retrieved chunk, disabled Rule Card draft, and logic hint for review-only Rule DSL validation."
          }
        : row
    )
  };
}

function fillReadyReceipt(receipt) {
  return {
    ...receipt,
    teacherDecision: "retrieval_draft_review_validation_result_reviewed_ready_for_rule_dsl_validation_package",
    reviewValidationReviewed: true,
    approvedDraftRowsReviewed: true,
    disabledRuleDraftsReviewed: true,
    logicExtractionHintsReviewed: true,
    ruleDslValidationPackageCommandReviewed: true,
    teacherConfirmedNoRuleDslValidationPackageRun: true,
    teacherConfirmedNoRuleEnablement: true,
    teacherConfirmedNoMemoryWrite: true,
    teacherConfirmedNoExternalFetch: true,
    blockedActionsConfirmed: true,
    rollbackPointConfirmed: true,
    teacherNotes:
      "Teacher reviewed the retrieval-draft review validation result and only allows a separate manual Rule DSL validation package handoff."
  };
}

const priorGate = runJson(
  "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs",
  []
);
const tlclReviewReceiptHandoffValidationPath = priorGate.validValidation.validationPath;
const retrievalDraftRunPath = priorGate.retrievalDraftRunPath;

const detailedReviewBuilder = runJson("knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs", [
  "--retrieval-draft-run",
  retrievalDraftRunPath,
  "--out-dir",
  join(root, "detailed-review-builder")
]);
const detailedReviewReceipt = fillRetrievalDraftReviewReceipt(readJson(detailedReviewBuilder.templatePath));
const detailedReviewReceiptPath = join(root, "teacher-reviewed-detailed-retrieval-draft-receipt.json");
writeJson(detailedReviewReceiptPath, detailedReviewReceipt);
const reviewValidation = runJson("knowledge/validate-rag-confirmed-retrieval-draft-review-receipt.mjs", [
  "--retrieval-draft-run",
  retrievalDraftRunPath,
  "--receipt",
  detailedReviewReceiptPath,
  "--out-dir",
  join(root, "detailed-review-validation")
]);

const builderResult = runJson(
  "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt-builder.mjs",
  [
    "--tlcl-retrieval-draft-review-receipt-handoff-validation",
    tlclReviewReceiptHandoffValidationPath,
    "--rag-retrieval-draft-review-validation",
    reviewValidation.validationPath,
    "--output-dir",
    join(root, "tlcl-builder")
  ]
);
const builder = readJson(builderResult.resultReceiptBuilderPath);
const readyReceipt = fillReadyReceipt(readJson(builderResult.receiptTemplatePath));
const readyReceiptPath = join(root, "ready-review-validation-result-receipt.json");
writeJson(readyReceiptPath, readyReceipt);
const validValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", readyReceiptPath, "--output-dir", join(root, "valid-validation")]
);

const forbiddenReceipt = { ...readyReceipt, teacherDecision: "run_rule_dsl_validation_package" };
const forbiddenReceiptPath = join(root, "forbidden-rule-dsl-validation-package-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);

const mismatchReceipt = { ...readyReceipt, sourceReviewValidationHash: "sha256:bad-review-validation-hash" };
const mismatchReceiptPath = join(root, "mismatch-review-validation-result-receipt.json");
writeJson(mismatchReceiptPath, mismatchReceipt);
const mismatchValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
);

const evidenceReceipt = {
  ...readJson(builderResult.receiptTemplatePath),
  teacherDecision: "needs_more_retrieval_draft_review_evidence",
  teacherNotes: "Need more reviewed disabled draft evidence before preparing the Rule DSL validation package handoff."
};
const evidenceReceiptPath = join(root, "needs-more-review-evidence-receipt.json");
writeJson(evidenceReceiptPath, evidenceReceipt);
const evidenceValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
);

const correctionReceipt = {
  ...readJson(builderResult.receiptTemplatePath),
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The reviewed disabled draft does not match the intended logic and must return to high reasoning repair."
};
const correctionReceiptPath = join(root, "correction-review-validation-result-receipt.json");
writeJson(correctionReceiptPath, correctionReceipt);
const correctionValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
);

const checks = [
  {
    name: "TLCL RAG retrieval draft review validation result receipt builder consumes existing review validation",
    passed:
      builderResult.ok === true &&
      builder.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_builder_v1" &&
      builder.sourceReviewValidation.approvedDraftCount >= 1,
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG retrieval draft review validation result prepares Rule DSL validation package handoff",
    passed:
      validValidation.readyForRuleDslValidationPackageFollowUp === true &&
      validValidation.manualRuleDslValidationPackageFollowUpHandoff?.nextTool ===
        "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs" &&
      validValidation.locks?.ruleDslValidationPackageRun === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG retrieval draft review validation result blocks forbidden Rule DSL package runs",
    passed:
      forbiddenValidation.ok === false &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG retrieval draft review validation result detects review validation hash mismatch",
    passed:
      mismatchValidation.ok === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "source_review_validation_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG retrieval draft review validation result can request more reviewed draft evidence",
    passed:
      evidenceValidation.ok === true &&
      evidenceValidation.needsMoreRetrievalDraftReviewEvidence === true &&
      evidenceValidation.readyForRuleDslValidationPackageFollowUp === false,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG retrieval draft review validation result can route correction back to high reasoning repair",
    passed:
      correctionValidation.ok === true &&
      correctionValidation.correctionToHighReasoningRepair === true &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_retrieval_draft_review_validation_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const summary = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclReviewReceiptHandoffValidationPath,
  retrievalDraftRunPath,
  reviewValidationPath: reviewValidation.validationPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
