#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reviewed-manual-downstream-result-next-gate-selection-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function runJson(script, args = [], options = {}) {
  try {
    return JSON.parse(
      execFileSync(process.execPath, [join(scriptsRoot, script), ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 40 * 1024 * 1024
      })
    );
  } catch (error) {
    if (!options.allowFailure) throw error;
    const stdout = String(error.stdout || "").trim();
    return stdout
      ? JSON.parse(stdout)
      : {
          ok: false,
          status: "process_failed_without_json",
          stderr: String(error.stderr || ""),
          code: error.status
        };
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const upstreamSmoke = runJson("smoke-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs");
const reviewedResultValidationPath = upstreamSmoke.validValidation.validationPath;

const selector = runJson("create-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selector.mjs", [
  "--validation",
  reviewedResultValidationPath,
  "--output-dir",
  join(outRoot, "selector")
]);
const selectorPacket = readJson(selector.selectorPath);
const receiptTemplate = readJson(selector.receiptTemplatePath);
const selectedGate = selectorPacket.candidateNextGates.some((item) => item.gate === "prepare_rag_rule_dsl_review_follow_up")
  ? "prepare_rag_rule_dsl_review_follow_up"
  : selectorPacket.candidateNextGates[0]?.gate || "";

const validReceiptPath = writeJson(join(outRoot, "valid-next-gate-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "next_gate_selected_for_manual_preparation",
  selectedNextGate: selectedGate,
  selectedGateReviewed: true,
  resultEvidenceStillValid: true,
  teacherConfirmedNoExecution: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher selected the next TLCL gate for manual preparation only."
});
const validValidation = runJson("validate-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs", [
  "--selector",
  selector.selectorPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-validation")
]);

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-next-gate-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "execute_now",
  selectedNextGate: selectedGate,
  selectedGateReviewed: true,
  resultEvidenceStillValid: true,
  teacherConfirmedNoExecution: true
});
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs",
  ["--selector", selector.selectorPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(outRoot, "forbidden-validation")],
  { allowFailure: true }
);

const nonCandidateReceiptPath = writeJson(join(outRoot, "non-candidate-next-gate-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "next_gate_selected_for_manual_preparation",
  selectedNextGate: "run_unreviewed_external_agent",
  selectedGateReviewed: true,
  resultEvidenceStillValid: true,
  teacherConfirmedNoExecution: true
});
const nonCandidateValidation = runJson("validate-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs", [
  "--selector",
  selector.selectorPath,
  "--receipt",
  nonCandidateReceiptPath,
  "--output-dir",
  join(outRoot, "non-candidate-validation")
]);

const evidenceMismatchReceiptPath = writeJson(join(outRoot, "evidence-mismatch-next-gate-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "next_gate_selected_for_manual_preparation",
  selectedNextGate: selectedGate,
  resultEvidencePaths: ["wrong-evidence.json"],
  selectedGateReviewed: true,
  resultEvidenceStillValid: true,
  teacherConfirmedNoExecution: true
});
const evidenceMismatchValidation = runJson("validate-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs", [
  "--selector",
  selector.selectorPath,
  "--receipt",
  evidenceMismatchReceiptPath,
  "--output-dir",
  join(outRoot, "evidence-mismatch-validation")
]);

const repairReceiptPath = writeJson(join(outRoot, "repair-next-gate-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  selectedNextGate: "correction_to_high_reasoning_repair",
  teacherNotes: "Teacher found a logic mismatch that must return to high-reasoning contract repair."
});
const repairValidation = runJson("validate-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs", [
  "--selector",
  selector.selectorPath,
  "--receipt",
  repairReceiptPath,
  "--output-dir",
  join(outRoot, "repair-validation")
]);

const selectorHtml = readFileSync(selector.htmlPath, "utf8");
const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL reviewed manual downstream result next-gate selector creates teacher choice receipt",
  selector.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selector_result_v1" &&
    selector.ok === true &&
    selector.status === "reviewed_manual_downstream_result_next_gate_selector_waiting_for_teacher_choice" &&
    receiptTemplate.format ===
      "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_receipt_v1" &&
    selectorPacket.candidateNextGates.some((item) => item.gate === "prepare_rag_rule_dsl_review_follow_up") &&
    selectorPacket.candidateNextGates.some((item) => item.gate === "prepare_medium_runtime_dry_run_prep") &&
    selectorPacket.locks?.selectorDoesNotExecuteNextGateTool === true &&
    existsSync(selector.htmlPath) &&
    selectorHtml.includes("does not execute tools"),
  { selectorPath: selector.selectorPath }
);
check(
  "TLCL reviewed manual downstream result next-gate validation prepares manual handoff",
  validValidation.format ===
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_validation_result_v1" &&
    validValidation.status === "reviewed_manual_downstream_result_next_gate_selected_waiting_for_manual_preparation" &&
    validValidation.readyForManualPreparation === true &&
    validValidation.manualNextGateHandoff?.format ===
      "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_manual_next_gate_handoff_v1" &&
    validValidation.manualNextGateHandoff?.selectedNextGate === selectedGate &&
    validValidation.manualNextGateHandoff?.executeNow === false &&
    validValidation.locks?.validatorDoesNotExecuteNextGateTool === true &&
    validValidation.locks?.validatorDoesNotInvokeModel === true &&
    validValidation.locks?.validatorDoesNotFetchRag === true &&
    validValidation.locks?.validatorDoesNotWriteMemory === true &&
    validValidation.locks?.validatorDoesNotEnableRule === true &&
    validValidation.locks?.validatorDoesNotUnlockPackaging === true,
  { validationPath: validValidation.validationPath }
);
check(
  "TLCL reviewed manual downstream result next-gate validation blocks forbidden execute decisions",
  forbiddenValidation.status === "blocked_for_forbidden_reviewed_manual_downstream_result_next_gate_decision" &&
    forbiddenValidation.forbiddenDecisionUsed === true &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
  { blockers: forbiddenValidation.blockers }
);
check(
  "TLCL reviewed manual downstream result next-gate validation rejects non-candidate gate",
  nonCandidateValidation.status === "needs_teacher_review_before_next_gate_selection" &&
    nonCandidateValidation.readyForManualPreparation === false &&
    nonCandidateValidation.blockers.some((blocker) => blocker.code === "selected_next_gate_not_candidate"),
  { blockers: nonCandidateValidation.blockers }
);
check(
  "TLCL reviewed manual downstream result next-gate validation rejects evidence mismatch",
  evidenceMismatchValidation.status === "needs_teacher_review_before_next_gate_selection" &&
    evidenceMismatchValidation.readyForManualPreparation === false &&
    evidenceMismatchValidation.blockers.some((blocker) => blocker.code === "result_evidence_paths_mismatch"),
  { blockers: evidenceMismatchValidation.blockers }
);
check(
  "TLCL reviewed manual downstream result next-gate validation can route correction back to high reasoning repair",
  repairValidation.status === "correction_to_high_reasoning_repair_required" &&
    repairValidation.correctionToHighReasoningRepair === true &&
    repairValidation.highReasoningRepairHandoff?.executeNow === false,
  { validationPath: repairValidation.validationPath }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_smoke_v1",
  passed,
  total: checks.length,
  checks,
  upstreamReviewedResultValidation: reviewedResultValidationPath,
  selector,
  validValidation,
  forbiddenValidation,
  nonCandidateValidation,
  evidenceMismatchValidation,
  repairValidation
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
