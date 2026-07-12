#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const outRoot = join(root, ".transparent-apprentice", "tlcl-rag-selected-follow-up-planning-result-receipt-smoke");
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
  "plugins/transparent-ai-apprentice/scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs"
]).json;
const tlclSelectedFollowUpPlanningPath = previousSmoke.validValidation.validationPath;
const manualHandoff = previousSmoke.validValidation.manualSelectedFollowUpPlanningHandoff;

const planningPacketResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-selected-follow-up-planning-packet.mjs",
  "--selection-validation",
  manualHandoff.sourceRagSelectionReceiptValidationPath,
  "--rollback-point",
  manualHandoff.rollbackPoint,
  "--out-dir",
  join(outRoot, "rag-selected-follow-up-planning")
]).json;

const builderResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt-builder.mjs",
  "--tlcl-selected-follow-up-planning-handoff-validation",
  tlclSelectedFollowUpPlanningPath,
  "--rag-selected-follow-up-planning-packet",
  planningPacketResult.packetPath,
  "--output-dir",
  join(outRoot, "builder")
]).json;

const receipt = readJson(builderResult.receiptTemplatePath);
const validReceipt = {
  ...clone(receipt),
  teacherDecision: "selected_follow_up_planning_result_reviewed_ready_for_primary_source_evidence_request",
  selectedFollowUpPlanningPacketReviewed: true,
  plannedItemsReviewed: true,
  primarySourceEvidenceRequestCommandReviewed: true,
  teacherConfirmedNoPrimarySourceEvidenceRequestBuilderRun: true,
  teacherConfirmedNoExternalFetch: true,
  teacherConfirmedNoFollowUpLaneChanged: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes:
    "Teacher confirmed the selected follow-up planning packet is ready only for separate primary-source evidence request receipt building."
};
const validReceiptPath = writeJson(join(outRoot, "valid-tlcl-receipt.json"), validReceipt);
const validValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-validation")
]).json;

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-tlcl-receipt.json"), {
  ...clone(receipt),
  teacherDecision: "run_primary_source_evidence_request_receipt_builder",
  teacherNotes: "This forbidden decision should be blocked."
});
const forbiddenValidation = runJson(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs",
    "--builder",
    builderResult.resultReceiptBuilderPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(outRoot, "forbidden-validation")
  ],
  { allowFailure: true }
).json;

const mismatchReceiptPath = writeJson(join(outRoot, "mismatch-tlcl-receipt.json"), {
  ...clone(validReceipt),
  selectionValidationHash: "sha256:bad"
});
const mismatchValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  mismatchReceiptPath,
  "--output-dir",
  join(outRoot, "mismatch-validation")
]).json;

const evidenceReceiptPath = writeJson(join(outRoot, "evidence-tlcl-receipt.json"), {
  ...clone(receipt),
  teacherDecision: "needs_more_selected_follow_up_planning_evidence",
  teacherNotes: "Need more selected follow-up planning evidence before primary-source request."
});
const evidenceValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  evidenceReceiptPath,
  "--output-dir",
  join(outRoot, "evidence-validation")
]).json;

const correctionReceiptPath = writeJson(join(outRoot, "correction-tlcl-receipt.json"), {
  ...clone(receipt),
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The selected follow-up planning packet should go back to high reasoning repair."
});
const correctionValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  correctionReceiptPath,
  "--output-dir",
  join(outRoot, "correction-validation")
]).json;

const checks = [
  {
    name: "TLCL RAG selected follow-up planning result receipt builder consumes existing planning packet",
    passed:
      builderResult.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_selected_follow_up_planning_result_waiting_for_teacher_confirmation" &&
      readJson(builderResult.resultReceiptBuilderPath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_builder_v1" &&
      readJson(builderResult.receiptTemplatePath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_v1",
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG selected follow-up planning result validation prepares primary-source evidence request handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_validation_result_v1" &&
      validValidation.status ===
        "tlcl_rag_selected_follow_up_planning_ready_for_primary_source_evidence_request_receipt_builder" &&
      validValidation.readyForPrimarySourceEvidenceRequestReceiptBuilder === true &&
      validValidation.manualPrimarySourceEvidenceRequestReceiptBuilderHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_primary_source_evidence_request_receipt_builder_handoff_v1" &&
      validValidation.manualPrimarySourceEvidenceRequestReceiptBuilderHandoff?.nextTool ===
        "knowledge/create-rag-primary-source-evidence-request-receipt-builder.mjs" &&
      validValidation.manualPrimarySourceEvidenceRequestReceiptBuilderHandoff?.executeNow === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG selected follow-up planning result validation blocks forbidden primary-source builder runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_selected_follow_up_planning_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true,
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG selected follow-up planning result validation detects selection validation hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_primary_source_request" &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "selection_validation_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG selected follow-up planning result validation can request more planning evidence",
    passed:
      evidenceValidation.status === "needs_more_selected_follow_up_planning_evidence_before_primary_source_request" &&
      evidenceValidation.needsMoreSelectedFollowUpPlanningEvidence === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG selected follow-up planning result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_selected_follow_up_planning_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const report = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclSelectedFollowUpPlanningPath,
  ragSelectedFollowUpPlanningPacketPath: planningPacketResult.packetPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exit(1);
