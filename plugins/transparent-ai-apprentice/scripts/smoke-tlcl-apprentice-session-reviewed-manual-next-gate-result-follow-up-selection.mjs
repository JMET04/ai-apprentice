#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reviewed-manual-next-gate-result-follow-up-selection-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function runJson(script, args = [], options = {}) {
  try {
    return JSON.parse(
      execFileSync(process.execPath, [join(scriptsRoot, script), ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 30 * 1024 * 1024
      })
    );
  } catch (error) {
    if (!options.allowFailure) throw error;
    const stdout = String(error.stdout || "").trim();
    return stdout
      ? JSON.parse(stdout)
      : { ok: false, status: "process_failed_without_json", stderr: String(error.stderr || ""), code: error.status };
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

const upstreamSmoke = runJson("smoke-tlcl-apprentice-session-manual-next-gate-result-receipt.mjs");
const resultValidationPath = upstreamSmoke.validValidation.validationPath;
const resultValidation = readJson(resultValidationPath);

const selector = runJson("create-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selector.mjs", [
  "--validation",
  resultValidationPath,
  "--output-dir",
  join(outRoot, "selector")
]);
const receiptTemplate = readJson(selector.receiptTemplatePath);
const validReceiptPath = writeJson(join(outRoot, "valid-follow-up-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "follow_up_selected_for_manual_preparation",
  selectedFollowUp: "prepare_rag_rule_dsl_review_receipt",
  selectedFollowUpReviewed: true,
  resultEvidenceStillValid: true,
  teacherConfirmedNoExecution: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher selected the RAG Rule DSL review receipt follow-up."
});
const validValidation = runJson("validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection.mjs", [
  "--selector",
  selector.selectorPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-validation")
]);

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-follow-up-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_follow_up",
  selectedFollowUp: "prepare_rag_rule_dsl_review_receipt",
  blockedActionsConfirmed: true
});
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection.mjs",
  ["--selector", selector.selectorPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(outRoot, "forbidden-validation")],
  { allowFailure: true }
);

const nonCandidateReceiptPath = writeJson(join(outRoot, "non-candidate-follow-up-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "follow_up_selected_for_manual_preparation",
  selectedFollowUp: "unsupported_follow_up",
  selectedFollowUpReviewed: true,
  resultEvidenceStillValid: true,
  teacherConfirmedNoExecution: true,
  blockedActionsConfirmed: true
});
const nonCandidateValidation = runJson("validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection.mjs", [
  "--selector",
  selector.selectorPath,
  "--receipt",
  nonCandidateReceiptPath,
  "--output-dir",
  join(outRoot, "non-candidate-validation")
]);

const mismatchReceiptPath = writeJson(join(outRoot, "evidence-mismatch-follow-up-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "follow_up_selected_for_manual_preparation",
  selectedFollowUp: "prepare_rag_rule_dsl_review_receipt",
  selectedFollowUpReviewed: true,
  resultEvidenceStillValid: true,
  teacherConfirmedNoExecution: true,
  nextGateResultEvidencePaths: ["wrong-evidence"],
  blockedActionsConfirmed: true
});
const mismatchValidation = runJson("validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection.mjs", [
  "--selector",
  selector.selectorPath,
  "--receipt",
  mismatchReceiptPath,
  "--output-dir",
  join(outRoot, "mismatch-validation")
]);

const repairReceiptPath = writeJson(join(outRoot, "repair-follow-up-selection-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The reviewed next-gate result shows the contract is wrong.",
  blockedActionsConfirmed: true
});
const repairValidation = runJson("validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection.mjs", [
  "--selector",
  selector.selectorPath,
  "--receipt",
  repairReceiptPath,
  "--output-dir",
  join(outRoot, "repair-validation")
]);

const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL reviewed manual next-gate result follow-up selector creates teacher choice receipt",
  selector.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selector_result_v1" &&
    selector.ok === true &&
    selector.status === "reviewed_manual_next_gate_result_follow_up_selector_waiting_for_teacher_choice" &&
    selector.candidateFollowUps.some((item) => item.followUp === "prepare_rag_rule_dsl_review_receipt") &&
    receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selection_receipt_v1" &&
    receiptTemplate.executeNow === false &&
    resultValidation.reviewedManualNextGateResult?.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_v1",
  { selectorPath: selector.selectorPath }
);
check(
  "TLCL reviewed manual next-gate result follow-up validation prepares manual follow-up handoff",
  validValidation.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selection_validation_result_v1" &&
    validValidation.status === "reviewed_manual_next_gate_result_follow_up_selected_waiting_for_manual_preparation" &&
    validValidation.readyForManualPreparation === true &&
    validValidation.manualFollowUpHandoff?.format ===
      "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_follow_up_handoff_v1" &&
    validValidation.manualFollowUpHandoff?.selectedFollowUp === "prepare_rag_rule_dsl_review_receipt" &&
    validValidation.manualFollowUpHandoff?.executeNow === false &&
    validValidation.locks?.validatorDoesNotExecuteFollowUpTool === true,
  { validationPath: validValidation.validationPath }
);
check(
  "TLCL reviewed manual next-gate result follow-up validation blocks forbidden run decisions",
  forbiddenValidation.status === "blocked_for_forbidden_reviewed_manual_next_gate_result_follow_up_decision" &&
    forbiddenValidation.forbiddenDecisionUsed === true &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
  { blockers: forbiddenValidation.blockers }
);
check(
  "TLCL reviewed manual next-gate result follow-up validation rejects non-candidate follow-up",
  nonCandidateValidation.status === "needs_teacher_review_before_follow_up_selection" &&
    nonCandidateValidation.readyForManualPreparation === false &&
    nonCandidateValidation.blockers.some((blocker) => blocker.code === "selected_follow_up_not_candidate"),
  { blockers: nonCandidateValidation.blockers }
);
check(
  "TLCL reviewed manual next-gate result follow-up validation rejects evidence mismatch",
  mismatchValidation.status === "needs_teacher_review_before_follow_up_selection" &&
    mismatchValidation.readyForManualPreparation === false &&
    mismatchValidation.blockers.some((blocker) => blocker.code === "next_gate_result_evidence_paths_mismatch"),
  { blockers: mismatchValidation.blockers }
);
check(
  "TLCL reviewed manual next-gate result follow-up validation can route correction back to high reasoning repair",
  repairValidation.status === "correction_to_high_reasoning_repair_required" &&
    repairValidation.correctionToHighReasoningRepair === true &&
    repairValidation.highReasoningRepairHandoff?.route === "high_reasoning_logic_contract_repair_after_reviewed_manual_next_gate_result" &&
    repairValidation.highReasoningRepairHandoff?.executeNow === false,
  { repairHandoff: repairValidation.highReasoningRepairHandoff }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selection_smoke_v1",
  passed,
  total: checks.length,
  checks,
  upstreamResultValidation: resultValidationPath,
  selector,
  validValidation,
  forbiddenValidation,
  nonCandidateValidation,
  mismatchValidation,
  repairValidation
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
