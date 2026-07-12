#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "./knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".transparent-apprentice", "tlcl-rag-confirmed-local-ingest-result-receipt-smoke");
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
    teacherDecision: "confirmed_local_ingest_result_reviewed_ready_for_retrieval_draft_follow_up",
    localIngestRunReviewed: true,
    localCorpusIndexesReviewed: true,
    retrievalQueryReviewed: true,
    logicExtractionHintsReviewed: true,
    teacherConfirmedNoRetrievalDraftRun: true,
    teacherConfirmedNoExternalFetch: true,
    teacherConfirmedNoMemoryOrRuleWrite: true,
    blockedActionsConfirmed: true,
    rollbackPointConfirmed: true,
    teacherNotes: "Teacher reviewed the local ingest result and only allows a separate manual retrieval draft handoff."
  };
}

const localIngestGateResult = runJson(
  "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs",
  []
);
const tlclLocalIngestValidationPath = localIngestGateResult.validValidation.validationPath;
const handoff = localIngestGateResult.validValidation.manualConfirmedLocalIngestFollowUpHandoff;
const ingestRunResult = runJson("knowledge/run-rag-confirmed-local-ingest.mjs", [
  "--registry",
  handoff.sourceRegistryPath,
  "--source-id",
  "all",
  "--rollback-point",
  handoff.rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "local-ingest")
]);

const builderResult = runJson(
  "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt-builder.mjs",
  [
    "--tlcl-confirmed-local-ingest-handoff-validation",
    tlclLocalIngestValidationPath,
    "--rag-confirmed-local-ingest-run",
    ingestRunResult.runPath,
    "--output-dir",
    join(root, "tlcl-builder")
  ]
);
const builder = readJson(builderResult.resultReceiptBuilderPath);
const readyReceipt = fillReadyReceipt(readJson(builderResult.receiptTemplatePath));
const readyReceiptPath = join(root, "ready-local-ingest-result-receipt.json");
writeJson(readyReceiptPath, readyReceipt);
const validValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", readyReceiptPath, "--output-dir", join(root, "valid-validation")]
);

const forbiddenReceipt = { ...readyReceipt, teacherDecision: "run_retrieval_draft" };
const forbiddenReceiptPath = join(root, "forbidden-local-ingest-result-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);

const mismatchReceipt = { ...readyReceipt, sourceIngestRunHash: "sha256:bad-ingest-hash" };
const mismatchReceiptPath = join(root, "mismatch-local-ingest-result-receipt.json");
writeJson(mismatchReceiptPath, mismatchReceipt);
const mismatchValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
);

const evidenceReceipt = {
  ...readJson(builderResult.receiptTemplatePath),
  teacherDecision: "needs_more_local_ingest_evidence",
  teacherNotes: "Need more local ingest evidence before retrieval draft follow-up."
};
const evidenceReceiptPath = join(root, "needs-more-local-ingest-evidence-receipt.json");
writeJson(evidenceReceiptPath, evidenceReceipt);
const evidenceValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
);

const correctionReceipt = {
  ...readJson(builderResult.receiptTemplatePath),
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The local ingest result should go back to high reasoning repair."
};
const correctionReceiptPath = join(root, "correction-local-ingest-result-receipt.json");
writeJson(correctionReceiptPath, correctionReceipt);
const correctionValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
);

const checks = [
  {
    name: "TLCL RAG confirmed local ingest result receipt builder consumes existing ingest run",
    passed:
      builderResult.ok === true &&
      builder.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_builder_v1" &&
      builder.sourceIngestRun.ingestedCount >= 1,
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG confirmed local ingest result validation prepares retrieval draft handoff",
    passed:
      validValidation.readyForConfirmedRetrievalDraftFollowUp === true &&
      validValidation.manualConfirmedRetrievalDraftFollowUpHandoff?.nextTool ===
        "knowledge/run-rag-confirmed-retrieval-draft.mjs" &&
      validValidation.locks?.retrievalDraftRun === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG confirmed local ingest result validation blocks forbidden retrieval draft runs",
    passed:
      forbiddenValidation.ok === false &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG confirmed local ingest result validation detects ingest hash mismatch",
    passed:
      mismatchValidation.ok === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "source_ingest_run_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG confirmed local ingest result validation can request more ingest evidence",
    passed:
      evidenceValidation.ok === true &&
      evidenceValidation.needsMoreLocalIngestEvidence === true &&
      evidenceValidation.readyForConfirmedRetrievalDraftFollowUp === false,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG confirmed local ingest result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.ok === true &&
      correctionValidation.correctionToHighReasoningRepair === true &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_local_ingest_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const summary = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclLocalIngestValidationPath,
  ingestRunPath: ingestRunResult.runPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
