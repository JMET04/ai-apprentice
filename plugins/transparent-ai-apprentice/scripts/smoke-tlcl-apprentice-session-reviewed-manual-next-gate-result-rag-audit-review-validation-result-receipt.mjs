#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const outRoot = join(root, ".transparent-apprentice", "tlcl-rag-audit-review-validation-result-receipt-smoke");
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runJson(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    ...options
  });
  const text = String(result.stdout || "").trim();
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`Command failed: node ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  const jsonStart = text.indexOf("{");
  if (jsonStart < 0) {
    throw new Error(`Command did not emit JSON: node ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  return {
    status: result.status,
    stdout: text,
    stderr: String(result.stderr || ""),
    json: JSON.parse(text.slice(jsonStart))
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fillAuditReviewReceipt(templatePath) {
  const receipt = readJson(templatePath);
  receipt.decision = "teacher_reviewed_audit_trail_for_follow_up";
  receipt.evidenceChainReviews = (receipt.evidenceChainReviews || []).map((row) => ({
    ...row,
    decision: "reviewed_evidence_chain_step",
    evidenceReviewed: true,
    hashReviewed: true,
    reviewerNote: `Reviewed ${row.step || row.path || "evidence row"} for TLCL smoke.`
  }));
  receipt.logicEvidenceReviews = (receipt.logicEvidenceReviews || []).map((row) => ({
    ...row,
    decision: "reviewed_logic_evidence",
    logicEvidenceReviewed: true,
    logicFitReviewed: true,
    reviewerNote: `Reviewed logic evidence ${row.sourceId || row.ruleId || "row"} for TLCL smoke.`
  }));
  receipt.blockedTransitionsReviewed = true;
  receipt.forbiddenInterpretationsReviewed = true;
  receipt.noActionLocksReviewed = true;
  receipt.rollbackPointRetained = true;
  receipt.reviewerNote = "Teacher reviewed the audit receipt validation result boundary before follow-up planning.";
  return receipt;
}

const previousSmoke = runJson([
  "plugins/transparent-ai-apprentice/scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt.mjs"
]).json;
const tlclTemplateValidationPath = previousSmoke.validValidation.validationPath;
const ragBuilderResult = previousSmoke.existingAuditReviewReceiptBuilderResult;
const filledReceiptPath = join(outRoot, "filled-rag-audit-review-receipt.json");
writeJson(filledReceiptPath, fillAuditReviewReceipt(ragBuilderResult.templatePath));

const ragValidationResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/knowledge/validate-rag-delivery-gate-audit-review-receipt.mjs",
  "--audit-trail",
  ragBuilderResult.builderPath ? readJson(ragBuilderResult.builderPath).auditTrailPath : ragBuilderResult.auditTrailPath,
  "--receipt",
  filledReceiptPath,
  "--out-dir",
  join(outRoot, "rag-validation")
]).json;

const builderResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt-builder.mjs",
  "--tlcl-audit-review-receipt-template-validation",
  tlclTemplateValidationPath,
  "--rag-audit-review-validation",
  ragValidationResult.validationPath,
  "--output-dir",
  join(outRoot, "builder")
]).json;

const receipt = readJson(builderResult.receiptTemplatePath);
const validReceipt = {
  ...clone(receipt),
  teacherDecision: "audit_review_validation_result_reviewed_ready_for_follow_up_queue",
  validationResultReviewed: true,
  auditReviewReceiptReviewed: true,
  followUpQueueCommandReviewed: true,
  teacherConfirmedNoFollowUpQueueCreated: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "Teacher confirmed the validation result is ready only for separate follow-up queue planning."
};
const validReceiptPath = join(outRoot, "valid-tlcl-receipt.json");
writeJson(validReceiptPath, validReceipt);
const validValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-validation")
]).json;

const forbiddenReceiptPath = join(outRoot, "forbidden-tlcl-receipt.json");
writeJson(forbiddenReceiptPath, {
  ...clone(receipt),
  teacherDecision: "run_follow_up_queue",
  teacherNotes: "This forbidden decision should be blocked."
});
const forbiddenValidation = runJson(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt.mjs",
    "--builder",
    builderResult.resultReceiptBuilderPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(outRoot, "forbidden-validation")
  ],
  { allowFailure: true }
).json;

const mismatchReceiptPath = join(outRoot, "mismatch-tlcl-receipt.json");
writeJson(mismatchReceiptPath, {
  ...clone(validReceipt),
  ragAuditReviewValidationHash: "sha256:bad"
});
const mismatchValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  mismatchReceiptPath,
  "--output-dir",
  join(outRoot, "mismatch-validation")
]).json;

const evidenceReceiptPath = join(outRoot, "evidence-tlcl-receipt.json");
writeJson(evidenceReceiptPath, {
  ...clone(receipt),
  teacherDecision: "needs_more_audit_review_validation_evidence",
  teacherNotes: "Need more validation evidence before queue planning."
});
const evidenceValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  evidenceReceiptPath,
  "--output-dir",
  join(outRoot, "evidence-validation")
]).json;

const correctionReceiptPath = join(outRoot, "correction-tlcl-receipt.json");
writeJson(correctionReceiptPath, {
  ...clone(receipt),
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The audit review validation result should go back to high reasoning repair."
});
const correctionValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  correctionReceiptPath,
  "--output-dir",
  join(outRoot, "correction-validation")
]).json;

const checks = [
  {
    name: "TLCL RAG audit review validation result receipt builder consumes existing audit review validation",
    passed:
      builderResult.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_audit_review_validation_result_waiting_for_teacher_confirmation" &&
      readJson(builderResult.resultReceiptBuilderPath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_builder_v1" &&
      readJson(builderResult.receiptTemplatePath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_v1",
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG audit review validation result validation prepares follow-up queue handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_audit_review_validation_ready_for_follow_up_queue_planning" &&
      validValidation.readyForFollowUpQueuePlanning === true &&
      validValidation.manualFollowUpQueueHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_queue_handoff_v1" &&
      validValidation.manualFollowUpQueueHandoff?.nextTool === "knowledge/create-rag-audit-review-follow-up-queue.mjs" &&
      validValidation.manualFollowUpQueueHandoff?.executeNow === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG audit review validation result validation blocks forbidden follow-up queue runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_audit_review_validation_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true,
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG audit review validation result validation detects validation hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_follow_up_queue_planning" &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "rag_validation_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG audit review validation result validation can request more evidence",
    passed:
      evidenceValidation.status === "needs_more_audit_review_validation_evidence_before_follow_up_queue" &&
      evidenceValidation.needsMoreAuditReviewValidationEvidence === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG audit review validation result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_audit_review_validation_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const report = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclTemplateValidationPath,
  ragValidationPath: ragValidationResult.validationPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exit(1);
