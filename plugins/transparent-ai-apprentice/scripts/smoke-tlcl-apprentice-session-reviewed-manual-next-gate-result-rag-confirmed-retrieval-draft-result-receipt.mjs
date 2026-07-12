#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "./knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".transparent-apprentice", "tlcl-rag-confirmed-retrieval-draft-result-receipt-smoke");
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

function fillReadyReceipt(receipt) {
  return {
    ...receipt,
    teacherDecision: "confirmed_retrieval_draft_result_reviewed_ready_for_review_receipt_follow_up",
    retrievalDraftRunReviewed: true,
    retrievalRowsReviewed: true,
    retrievalChunksReviewed: true,
    disabledRuleDraftsReviewed: true,
    logicExtractionHintsReviewed: true,
    teacherConfirmedNoReviewReceiptBuilderRun: true,
    teacherConfirmedNoRuleDslValidationRun: true,
    teacherConfirmedNoExternalFetch: true,
    teacherConfirmedNoMemoryOrRuleWrite: true,
    blockedActionsConfirmed: true,
    rollbackPointConfirmed: true,
    teacherNotes:
      "Teacher reviewed the retrieval draft result and only allows a separate manual review receipt builder handoff."
  };
}

const localIngestResultGate = runJson(
  "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs",
  []
);
const tlclRetrievalDraftValidationPath = localIngestResultGate.validValidation.validationPath;
const handoff = localIngestResultGate.validValidation.manualConfirmedRetrievalDraftFollowUpHandoff;
const retrievalDraftRunResult = runJson("knowledge/run-rag-confirmed-retrieval-draft.mjs", [
  "--ingest-run",
  handoff.sourceIngestRunPath,
  "--query",
  handoff.retrievalQuery,
  "--top-k",
  String(handoff.topK),
  "--rollback-point",
  handoff.rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "retrieval-draft")
]);

const builderResult = runJson(
  "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt-builder.mjs",
  [
    "--tlcl-confirmed-retrieval-draft-handoff-validation",
    tlclRetrievalDraftValidationPath,
    "--rag-confirmed-retrieval-draft-run",
    retrievalDraftRunResult.runPath,
    "--output-dir",
    join(root, "tlcl-builder")
  ]
);
const builder = readJson(builderResult.resultReceiptBuilderPath);
const readyReceipt = fillReadyReceipt(readJson(builderResult.receiptTemplatePath));
const readyReceiptPath = join(root, "ready-retrieval-draft-result-receipt.json");
writeJson(readyReceiptPath, readyReceipt);
const validValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", readyReceiptPath, "--output-dir", join(root, "valid-validation")]
);

const forbiddenReceipt = { ...readyReceipt, teacherDecision: "run_retrieval_draft_review_receipt_builder" };
const forbiddenReceiptPath = join(root, "forbidden-retrieval-draft-result-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);

const mismatchReceipt = { ...readyReceipt, sourceRetrievalDraftRunHash: "sha256:bad-retrieval-draft-hash" };
const mismatchReceiptPath = join(root, "mismatch-retrieval-draft-result-receipt.json");
writeJson(mismatchReceiptPath, mismatchReceipt);
const mismatchValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
);

const evidenceReceipt = {
  ...readJson(builderResult.receiptTemplatePath),
  teacherDecision: "needs_more_retrieval_draft_evidence",
  teacherNotes: "Need more retrieval draft evidence before building the detailed review receipt."
};
const evidenceReceiptPath = join(root, "needs-more-retrieval-draft-evidence-receipt.json");
writeJson(evidenceReceiptPath, evidenceReceipt);
const evidenceValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
);

const correctionReceipt = {
  ...readJson(builderResult.receiptTemplatePath),
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The retrieval draft result should go back to high reasoning repair."
};
const correctionReceiptPath = join(root, "correction-retrieval-draft-result-receipt.json");
writeJson(correctionReceiptPath, correctionReceipt);
const correctionValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
);

const checks = [
  {
    name: "TLCL RAG confirmed retrieval draft result receipt builder consumes existing retrieval draft run",
    passed:
      builderResult.ok === true &&
      builder.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_builder_v1" &&
      builder.sourceRetrievalDraftRun.retrievalRows.length >= 1,
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG confirmed retrieval draft result validation prepares review receipt handoff",
    passed:
      validValidation.readyForConfirmedRetrievalDraftReviewReceiptFollowUp === true &&
      validValidation.manualConfirmedRetrievalDraftReviewReceiptFollowUpHandoff?.nextTool ===
        "knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs" &&
      validValidation.locks?.retrievalDraftReviewReceiptBuilderRun === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG confirmed retrieval draft result validation blocks forbidden review receipt builder runs",
    passed:
      forbiddenValidation.ok === false &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG confirmed retrieval draft result validation detects retrieval draft hash mismatch",
    passed:
      mismatchValidation.ok === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "source_retrieval_draft_run_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG confirmed retrieval draft result validation can request more retrieval draft evidence",
    passed:
      evidenceValidation.ok === true &&
      evidenceValidation.needsMoreRetrievalDraftEvidence === true &&
      evidenceValidation.readyForConfirmedRetrievalDraftReviewReceiptFollowUp === false,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG confirmed retrieval draft result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.ok === true &&
      correctionValidation.correctionToHighReasoningRepair === true &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_retrieval_draft_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const summary = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclRetrievalDraftValidationPath,
  retrievalDraftRunPath: retrievalDraftRunResult.runPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
