#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const outRoot = join(root, ".transparent-apprentice", "tlcl-rag-primary-source-evidence-request-result-receipt-smoke");
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function runJson(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 30,
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

const planningResultSmoke = runJson([
  "plugins/transparent-ai-apprentice/scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs"
]).json;
const tlclPrimarySourceRequestPath = planningResultSmoke.validValidation.validationPath;
const planningPacketPath = planningResultSmoke.ragSelectedFollowUpPlanningPacketPath;

const sourcePath = writeJson(join(outRoot, "teacher-primary-source.json"), {
  format: "teacher_primary_source_fixture_v1",
  rule: "When packaging width changes, flap offset equals width * 0.12 and fold angle stays 90 degrees.",
  fields: {
    width: 120,
    flapOffset: 14.4,
    foldAngle: 90
  }
});

const primarySourceBuilder = runJson([
  "plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-primary-source-evidence-request-receipt-builder.mjs",
  "--planning-packet",
  planningPacketPath,
  "--out-dir",
  join(outRoot, "primary-source-builder")
]).json;
const primarySourceReceiptTemplate = readJson(primarySourceBuilder.templatePath);
const primarySourceReceipt = {
  ...clone(primarySourceReceiptTemplate),
  decision: "teacher_provided_primary_sources",
  providedSources: [
    {
      sourceId: "teacher.primary.box_logic",
      title: "Teacher primary source for packaging logic",
      uri: sourcePath,
      sourceType: "teacher_note",
      domain: "packaging_design",
      trustLevelAfterReview: "teacher_supplied",
      permissionStatus: "teacher_supplied",
      evidenceReviewed: true,
      reviewOnlyBoundaryReviewed: true,
      logicExtractionHint: "Extract width to flap offset ratio and fixed fold angle as data-to-output logic.",
      reviewerNote: "Teacher reviewed this local primary source as evidence only."
    }
  ]
};
const primarySourceReceiptPath = writeJson(join(outRoot, "primary-source-receipt.json"), primarySourceReceipt);
const primarySourceValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/knowledge/validate-rag-primary-source-evidence-request-receipt.mjs",
  "--planning-packet",
  planningPacketPath,
  "--receipt",
  primarySourceReceiptPath,
  "--out-dir",
  join(outRoot, "primary-source-validation")
]).json;

const builderResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt-builder.mjs",
  "--tlcl-primary-source-evidence-request-handoff-validation",
  tlclPrimarySourceRequestPath,
  "--rag-primary-source-evidence-request-validation",
  primarySourceValidation.validationPath,
  "--output-dir",
  join(outRoot, "tlcl-builder")
]).json;

const receipt = readJson(builderResult.receiptTemplatePath);
const validReceipt = {
  ...clone(receipt),
  teacherDecision: "primary_source_evidence_request_result_reviewed_ready_for_source_registry_follow_up",
  primarySourceEvidenceRequestValidationReviewed: true,
  confirmedSourcesReviewed: true,
  logicExtractionHintsReviewed: true,
  sourceRegistryCommandReviewed: true,
  teacherConfirmedNoConfirmedSourceRegistryPackageRun: true,
  teacherConfirmedNoExternalFetch: true,
  teacherConfirmedNoMemoryOrRuleWrite: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes:
    "Teacher confirmed primary-source evidence and logic hints are ready only for a separate confirmed source registry follow-up."
};
const validReceiptPath = writeJson(join(outRoot, "valid-tlcl-primary-source-result-receipt.json"), validReceipt);
const validValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-validation")
]).json;

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-tlcl-primary-source-result-receipt.json"), {
  ...clone(receipt),
  teacherDecision: "run_confirmed_source_registry_package",
  teacherNotes: "This forbidden decision should be blocked."
});
const forbiddenValidation = runJson(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs",
    "--builder",
    builderResult.resultReceiptBuilderPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(outRoot, "forbidden-validation")
  ],
  { allowFailure: true }
).json;

const mismatchReceiptPath = writeJson(join(outRoot, "mismatch-tlcl-primary-source-result-receipt.json"), {
  ...clone(validReceipt),
  primarySourceValidationHash: "sha256:bad"
});
const mismatchValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  mismatchReceiptPath,
  "--output-dir",
  join(outRoot, "mismatch-validation")
]).json;

const evidenceReceiptPath = writeJson(join(outRoot, "evidence-tlcl-primary-source-result-receipt.json"), {
  ...clone(receipt),
  teacherDecision: "needs_more_primary_source_evidence",
  teacherNotes: "Need more primary-source evidence before source registry follow-up."
});
const evidenceValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  evidenceReceiptPath,
  "--output-dir",
  join(outRoot, "evidence-validation")
]).json;

const correctionReceiptPath = writeJson(join(outRoot, "correction-tlcl-primary-source-result-receipt.json"), {
  ...clone(receipt),
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The primary-source evidence request result should go back to high reasoning repair."
});
const correctionValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  correctionReceiptPath,
  "--output-dir",
  join(outRoot, "correction-validation")
]).json;

const checks = [
  {
    name: "TLCL RAG primary-source evidence request result receipt builder consumes existing validation",
    passed:
      builderResult.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_primary_source_evidence_request_result_waiting_for_teacher_confirmation" &&
      readJson(builderResult.resultReceiptBuilderPath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_builder_v1" &&
      readJson(builderResult.receiptTemplatePath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_v1",
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG primary-source evidence request result validation prepares source registry handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_validation_result_v1" &&
      validValidation.status ===
        "tlcl_rag_primary_source_evidence_request_ready_for_confirmed_source_registry_follow_up" &&
      validValidation.readyForConfirmedSourceRegistryFollowUp === true &&
      validValidation.manualConfirmedSourceRegistryFollowUpHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_source_registry_follow_up_handoff_v1" &&
      validValidation.manualConfirmedSourceRegistryFollowUpHandoff?.nextTool ===
        "knowledge/create-rag-confirmed-source-registry-package.mjs" &&
      validValidation.manualConfirmedSourceRegistryFollowUpHandoff?.executeNow === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG primary-source evidence request result validation blocks forbidden registry package runs",
    passed:
      forbiddenValidation.status ===
        "blocked_for_forbidden_tlcl_rag_primary_source_evidence_request_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true,
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG primary-source evidence request result validation detects validation hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_source_registry_follow_up" &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "primary_source_validation_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG primary-source evidence request result validation can request more source evidence",
    passed:
      evidenceValidation.status === "needs_more_primary_source_evidence_before_source_registry_follow_up" &&
      evidenceValidation.needsMorePrimarySourceEvidence === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG primary-source evidence request result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_primary_source_evidence_request_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const report = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclPrimarySourceRequestPath,
  ragPrimarySourceEvidenceRequestValidationPath: primarySourceValidation.validationPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exit(1);
