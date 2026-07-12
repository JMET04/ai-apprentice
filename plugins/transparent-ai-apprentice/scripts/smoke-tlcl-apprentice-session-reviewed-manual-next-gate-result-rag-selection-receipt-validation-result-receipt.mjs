#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const outRoot = join(root, ".transparent-apprentice", "tlcl-rag-selection-receipt-validation-result-receipt-smoke");
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

function makeTeacherSelectionReceipt(template) {
  const receipt = clone(template);
  receipt.decision = "teacher_selected_review_only_follow_up";
  const allowedPreferred = [
    "request_more_primary_sources",
    "prepare_disabled_rule_rewrite_review",
    "add_validator_coverage_review",
    "prepare_next_teacher_receipt"
  ];
  const rows = Array.isArray(receipt.itemReviews) ? receipt.itemReviews : [];
  const selectedRow =
    rows.find((row) => (row.allowedFollowUpDecisions || []).includes("request_more_primary_sources")) ||
    rows.find((row) => (row.allowedFollowUpDecisions || []).some((decision) => allowedPreferred.includes(decision)));
  if (!selectedRow) throw new Error("Smoke fixture does not contain an allowed selected follow-up row.");
  const selectedDecision =
    (selectedRow.allowedFollowUpDecisions || []).find((decision) => allowedPreferred.includes(decision)) ||
    "request_more_primary_sources";
  for (const row of rows) {
    if (row.itemId === selectedRow.itemId) {
      row.decision = "select_review_only_follow_up";
      row.selectedFollowUpDecision = selectedDecision;
      row.itemReviewed = true;
      row.noActionBoundaryReviewed = true;
      row.reviewerNote = "Teacher selected this review-only RAG follow-up lane for TLCL smoke.";
      if (row.itemId === "confirm_rollback_retained") row.rollbackStillRetained = true;
    }
    if (row.itemId === "review_primary_source_logic_evidence") {
      row.logicEvidenceReviewed = true;
      row.logicFitDecisionConfirmed = true;
      row.logicEvidenceDecision = "logic_evidence_confirmed";
      row.reviewerNote = row.reviewerNote || "Teacher confirmed the primary-source logic evidence for this smoke.";
    }
  }
  receipt.reviewerNote = "Teacher selected exactly one review-only follow-up lane for validation.";
  return receipt;
}

const previousSmoke = runJson([
  "plugins/transparent-ai-apprentice/scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt.mjs"
]).json;
const tlclSelectionReceiptValidationPath = previousSmoke.validValidation.validationPath;
const manualHandoff = previousSmoke.validValidation.manualSelectionReceiptValidationHandoff;

const selectionReceiptTemplate = readJson(manualHandoff.receiptTemplatePath);
const teacherSelectionReceiptPath = writeJson(
  join(outRoot, "teacher-filled-rag-selection-receipt.json"),
  makeTeacherSelectionReceipt(selectionReceiptTemplate)
);
const selectionReceiptValidationResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/knowledge/validate-rag-follow-up-queue-selection-receipt.mjs",
  "--follow-up-queue",
  manualHandoff.sourceRagFollowUpQueuePath,
  "--receipt",
  teacherSelectionReceiptPath,
  "--out-dir",
  join(outRoot, "rag-selection-receipt-validation")
]).json;

const builderResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt-builder.mjs",
  "--tlcl-selection-receipt-validation-handoff-validation",
  tlclSelectionReceiptValidationPath,
  "--rag-selection-receipt-validation",
  selectionReceiptValidationResult.validationPath,
  "--output-dir",
  join(outRoot, "builder")
]).json;

const receipt = readJson(builderResult.receiptTemplatePath);
const validReceipt = {
  ...clone(receipt),
  teacherDecision: "selection_receipt_validation_result_reviewed_ready_for_selected_follow_up_planning",
  selectionReceiptValidationResultReviewed: true,
  selectedFollowUpReviewed: true,
  selectedFollowUpPlanningCommandReviewed: true,
  teacherConfirmedNoSelectedFollowUpPlanningRun: true,
  teacherConfirmedNoFollowUpLaneChanged: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes:
    "Teacher confirmed the selection receipt validation result is ready only for separate selected follow-up planning."
};
const validReceiptPath = writeJson(join(outRoot, "valid-tlcl-receipt.json"), validReceipt);
const validValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-validation")
]).json;

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-tlcl-receipt.json"), {
  ...clone(receipt),
  teacherDecision: "run_selected_follow_up_planning_packet",
  teacherNotes: "This forbidden decision should be blocked."
});
const forbiddenValidation = runJson(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs",
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
  ragFollowUpQueueHash: "sha256:bad"
});
const mismatchValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  mismatchReceiptPath,
  "--output-dir",
  join(outRoot, "mismatch-validation")
]).json;

const evidenceReceiptPath = writeJson(join(outRoot, "evidence-tlcl-receipt.json"), {
  ...clone(receipt),
  teacherDecision: "needs_more_selection_receipt_validation_evidence",
  teacherNotes: "Need more selection validation evidence before selected follow-up planning."
});
const evidenceValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs",
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
  teacherNotes: "The selection receipt validation result should go back to high reasoning repair."
});
const correctionValidation = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs",
  "--builder",
  builderResult.resultReceiptBuilderPath,
  "--receipt",
  correctionReceiptPath,
  "--output-dir",
  join(outRoot, "correction-validation")
]).json;

const checks = [
  {
    name: "TLCL RAG selection receipt validation result receipt builder consumes existing selection validation",
    passed:
      builderResult.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_selection_receipt_validation_result_waiting_for_teacher_confirmation" &&
      readJson(builderResult.resultReceiptBuilderPath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_builder_v1" &&
      readJson(builderResult.receiptTemplatePath).format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_v1",
    evidence: { resultReceiptBuilderPath: builderResult.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG selection receipt validation result validation prepares selected follow-up planning handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_selection_receipt_validation_ready_for_selected_follow_up_planning" &&
      validValidation.readyForSelectedFollowUpPlanning === true &&
      validValidation.manualSelectedFollowUpPlanningHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_selected_follow_up_planning_handoff_v1" &&
      validValidation.manualSelectedFollowUpPlanningHandoff?.nextTool ===
        "knowledge/create-rag-selected-follow-up-planning-packet.mjs" &&
      validValidation.manualSelectedFollowUpPlanningHandoff?.executeNow === false,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG selection receipt validation result validation blocks forbidden planner runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_selection_receipt_validation_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true,
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG selection receipt validation result validation detects queue hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_selected_follow_up_planning" &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "follow_up_queue_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG selection receipt validation result validation can request more validation evidence",
    passed:
      evidenceValidation.status === "needs_more_selection_receipt_validation_evidence_before_selected_follow_up_planning" &&
      evidenceValidation.needsMoreSelectionReceiptValidationEvidence === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG selection receipt validation result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_selection_receipt_validation_result",
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const report = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclSelectionReceiptValidationPath,
  ragSelectionReceiptValidationPath: selectionReceiptValidationResult.validationPath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exit(1);
