#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "./knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".transparent-apprentice", "tlcl-rag-confirmed-source-registry-result-receipt-smoke");
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
    teacherDecision: "confirmed_source_registry_result_reviewed_ready_for_local_ingest_follow_up",
    sourceRegistryReviewed: true,
    sourceRowsReviewed: true,
    localIngestCommandsReviewed: true,
    logicExtractionHintsReviewed: true,
    blockedExternalReferencesReviewed: true,
    teacherConfirmedNoLocalIngestRun: true,
    teacherConfirmedNoExternalFetch: true,
    teacherConfirmedNoMemoryOrRuleWrite: true,
    blockedActionsConfirmed: true,
    rollbackPointConfirmed: true,
    teacherNotes: "Teacher reviewed the source registry package result and only allows a separate manual local ingest handoff."
  };
}

const primarySourceResult = runJson(
  "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs",
  []
);
const tlclPrimarySourceValidationPath = primarySourceResult.validValidation.validationPath;
const sourceRegistryResult = runJson("knowledge/create-rag-confirmed-source-registry-package.mjs", [
  "--validation",
  primarySourceResult.ragPrimarySourceEvidenceRequestValidationPath,
  "--out-dir",
  join(root, "source-registry")
]);

const builderResult = runJson(
  "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt-builder.mjs",
  [
    "--tlcl-confirmed-source-registry-handoff-validation",
    tlclPrimarySourceValidationPath,
    "--rag-confirmed-source-registry-package",
    sourceRegistryResult.sourceRegistryPath,
    "--output-dir",
    join(root, "tlcl-builder")
  ]
);
const builder = readJson(builderResult.resultReceiptBuilderPath);
const readyReceipt = fillReadyReceipt(readJson(builderResult.receiptTemplatePath));
const readyReceiptPath = join(root, "ready-source-registry-result-receipt.json");
writeJson(readyReceiptPath, readyReceipt);
const validValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", readyReceiptPath, "--output-dir", join(root, "valid-validation")]
);

const forbiddenReceipt = { ...readyReceipt, teacherDecision: "run_local_ingest" };
const forbiddenReceiptPath = join(root, "forbidden-source-registry-result-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);

const mismatchReceipt = { ...readyReceipt, sourceRegistryHash: "sha256:bad-registry-hash" };
const mismatchReceiptPath = join(root, "mismatch-source-registry-result-receipt.json");
writeJson(mismatchReceiptPath, mismatchReceipt);
const mismatchValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
);

const evidenceReceipt = {
  ...readJson(builderResult.receiptTemplatePath),
  teacherDecision: "needs_more_source_registry_evidence",
  teacherNotes: "Need more source registry evidence before local ingest follow-up."
};
const evidenceReceiptPath = join(root, "needs-more-source-registry-evidence-receipt.json");
writeJson(evidenceReceiptPath, evidenceReceipt);
const evidenceValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
);

const correctionReceipt = {
  ...readJson(builderResult.receiptTemplatePath),
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The source registry result should go back to high reasoning repair."
};
const correctionReceiptPath = join(root, "correction-source-registry-result-receipt.json");
writeJson(correctionReceiptPath, correctionReceipt);
const correctionValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs",
  ["--builder", builderResult.resultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
);

const checks = [
  {
    name: "TLCL RAG confirmed source registry result receipt builder consumes existing registry package",
    passed:
      builderResult.ok === true &&
      builder.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_builder_v1" &&
      builder.sourceRegistry.readyLocalIngestCount >= 1,
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG confirmed source registry result validation prepares local ingest handoff",
    passed:
      validValidation.readyForConfirmedLocalIngestFollowUp === true &&
      validValidation.manualConfirmedLocalIngestFollowUpHandoff?.nextTool ===
        "knowledge/run-rag-confirmed-local-ingest.mjs" &&
      validValidation.locks?.localIngestRun === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG confirmed source registry result validation blocks forbidden local ingest runs",
    passed:
      forbiddenValidation.ok === false &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG confirmed source registry result validation detects registry hash mismatch",
    passed:
      mismatchValidation.ok === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "source_registry_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG confirmed source registry result validation can request more registry evidence",
    passed:
      evidenceValidation.ok === true &&
      evidenceValidation.needsMoreSourceRegistryEvidence === true &&
      evidenceValidation.readyForConfirmedLocalIngestFollowUp === false,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG confirmed source registry result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.ok === true &&
      correctionValidation.correctionToHighReasoningRepair === true &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_source_registry_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const summary = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclPrimarySourceValidationPath,
  sourceRegistryPath: sourceRegistryResult.sourceRegistryPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
