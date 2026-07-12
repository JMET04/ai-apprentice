#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const outRoot = join(root, ".transparent-apprentice", "tlcl-rag-follow-up-queue-result-receipt-smoke");
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

const previousSmoke = runJson([
  "plugins/transparent-ai-apprentice/scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt.mjs"
]).json;
const tlclFollowUpQueueValidationPath = previousSmoke.validValidation.validationPath;
const manualHandoff = previousSmoke.validValidation.manualFollowUpQueueHandoff;

const queueResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-audit-review-follow-up-queue.mjs",
  "--audit-review-validation",
  manualHandoff.sourceRagAuditReviewValidationPath,
  "--rollback-point",
  manualHandoff.rollbackPoint,
  "--out-dir",
  join(outRoot, "rag-follow-up-queue")
]).json;

const builderResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt-builder.mjs",
  "--tlcl-follow-up-queue-handoff-validation",
  tlclFollowUpQueueValidationPath,
  "--rag-follow-up-queue",
  queueResult.queuePath,
  "--output-dir",
  join(outRoot, "builder")
]).json;

const receipt = readJson(builderResult.receiptTemplatePath);
const validReceipt = {
  ...clone(receipt),
  teacherDecision: "follow_up_queue_result_reviewed_ready_for_selection_receipt_builder",
  followUpQueueResultReviewed: true,
  queueItemsReviewed: true,
  selectionReceiptBuilderCommandReviewed: true,
  teacherConfirmedNoSelectionReceiptBuilderRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "Teacher confirmed the follow-up queue result is ready only for separate selection receipt builder planning."
};
const validReceiptPath = join(outRoot, "valid-tlcl-receipt.json");
writeJson(validReceiptPath, validReceipt);
const validValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt.mjs",
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
  teacherDecision: "run_selection_receipt_builder",
  teacherNotes: "This forbidden decision should be blocked."
});
const forbiddenValidation = runJson(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt.mjs",
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
  ragFollowUpQueueHash: "sha256:bad"
});
const mismatchValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt.mjs",
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
  teacherDecision: "needs_more_follow_up_queue_evidence",
  teacherNotes: "Need more queue evidence before selection receipt builder planning."
});
const evidenceValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt.mjs",
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
  teacherNotes: "The follow-up queue should go back to high reasoning repair."
});
const correctionValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  correctionReceiptPath,
  "--output-dir",
  join(outRoot, "correction-validation")
]).json;

const checks = [
  {
    name: "TLCL RAG follow-up queue result receipt builder consumes existing follow-up queue",
    passed:
      builderResult.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_follow_up_queue_result_waiting_for_teacher_confirmation" &&
      readJson(builderResult.resultReceiptBuilderPath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_builder_v1" &&
      readJson(builderResult.receiptTemplatePath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_v1",
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG follow-up queue result validation prepares selection receipt builder handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_follow_up_queue_ready_for_selection_receipt_builder" &&
      validValidation.readyForSelectionReceiptBuilder === true &&
      validValidation.manualSelectionReceiptBuilderHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_selection_receipt_builder_handoff_v1" &&
      validValidation.manualSelectionReceiptBuilderHandoff?.nextTool ===
        "knowledge/create-rag-follow-up-queue-selection-receipt-builder.mjs" &&
      validValidation.manualSelectionReceiptBuilderHandoff?.executeNow === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG follow-up queue result validation blocks forbidden selection receipt builder runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_follow_up_queue_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true,
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG follow-up queue result validation detects queue hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_selection_receipt_builder" &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "follow_up_queue_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG follow-up queue result validation can request more queue evidence",
    passed:
      evidenceValidation.status === "needs_more_follow_up_queue_evidence_before_selection_receipt_builder" &&
      evidenceValidation.needsMoreFollowUpQueueEvidence === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG follow-up queue result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_follow_up_queue_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const report = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclFollowUpQueueValidationPath,
  queuePath: queueResult.queuePath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exit(1);
