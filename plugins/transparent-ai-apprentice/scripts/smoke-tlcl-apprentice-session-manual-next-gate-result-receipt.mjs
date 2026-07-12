#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-manual-next-gate-result-receipt-smoke");

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

const upstreamSmoke = runJson("smoke-tlcl-apprentice-session-manual-next-gate-preparation.mjs");
const preparationValidationPath = upstreamSmoke.validValidation.validationPath;
const preparationValidation = readJson(preparationValidationPath);
const resultEvidencePath = writeJson(join(outRoot, "manual-next-gate-result-evidence.json"), {
  format: "fixture_manual_next_gate_result_evidence_v1",
  source: "smoke",
  result: "reviewed manual next-gate packet created"
});

const receiptBuilder = runJson("create-tlcl-apprentice-session-manual-next-gate-result-receipt-builder.mjs", [
  "--validation",
  preparationValidationPath,
  "--output-dir",
  join(outRoot, "result-receipt-builder")
]);
const receiptTemplate = readJson(receiptBuilder.receiptTemplatePath);
const validReceiptPath = writeJson(join(outRoot, "valid-manual-next-gate-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_next_gate_result_reviewed_ready_for_follow_up",
  manualNextGateUseWasSeparate: true,
  nextGateResultEvidenceReviewed: true,
  observedNextGateResultStatus: "completed_reviewed",
  observedOutputFormat: preparationValidation.manualNextGatePreparation.expectedOutputFormat,
  nextGateResultEvidencePaths: [resultEvidencePath],
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher reviewed separate manual next-gate result evidence."
});
const validValidation = runJson("validate-tlcl-apprentice-session-manual-next-gate-result-receipt.mjs", [
  "--validation",
  preparationValidationPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-result-validation")
]);

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-manual-next-gate-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_next_gate",
  manualNextGateUseWasSeparate: true,
  nextGateResultEvidenceReviewed: true,
  observedNextGateResultStatus: "completed_reviewed",
  nextGateResultEvidencePaths: [resultEvidencePath]
});
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-manual-next-gate-result-receipt.mjs",
  ["--validation", preparationValidationPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(outRoot, "forbidden-result-validation")],
  { allowFailure: true }
);

const missingEvidenceReceiptPath = writeJson(join(outRoot, "missing-evidence-manual-next-gate-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_next_gate_result_reviewed_ready_for_follow_up",
  manualNextGateUseWasSeparate: true,
  nextGateResultEvidenceReviewed: true,
  observedNextGateResultStatus: "completed_reviewed",
  nextGateResultEvidencePaths: []
});
const missingEvidenceValidation = runJson("validate-tlcl-apprentice-session-manual-next-gate-result-receipt.mjs", [
  "--validation",
  preparationValidationPath,
  "--receipt",
  missingEvidenceReceiptPath,
  "--output-dir",
  join(outRoot, "missing-evidence-result-validation")
]);

const rollbackMismatchReceiptPath = writeJson(join(outRoot, "rollback-mismatch-manual-next-gate-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_next_gate_result_reviewed_ready_for_follow_up",
  confirmedRollbackPoint: "wrong-rollback",
  manualNextGateUseWasSeparate: true,
  nextGateResultEvidenceReviewed: true,
  observedNextGateResultStatus: "completed_reviewed",
  nextGateResultEvidencePaths: [resultEvidencePath]
});
const rollbackMismatchValidation = runJson("validate-tlcl-apprentice-session-manual-next-gate-result-receipt.mjs", [
  "--validation",
  preparationValidationPath,
  "--receipt",
  rollbackMismatchReceiptPath,
  "--output-dir",
  join(outRoot, "rollback-mismatch-result-validation")
]);

const repairReceiptPath = writeJson(join(outRoot, "repair-manual-next-gate-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The manual next-gate result exposed a logic contract gap.",
  blockedActionsConfirmed: true
});
const repairValidation = runJson("validate-tlcl-apprentice-session-manual-next-gate-result-receipt.mjs", [
  "--validation",
  preparationValidationPath,
  "--receipt",
  repairReceiptPath,
  "--output-dir",
  join(outRoot, "repair-result-validation")
]);

const builderHtml = readFileSync(receiptBuilder.htmlPath, "utf8");
const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL manual next-gate result receipt builder creates teacher result evidence template",
  receiptBuilder.format === "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_builder_result_v1" &&
    receiptBuilder.ok === true &&
    receiptBuilder.status === "manual_next_gate_result_receipt_builder_waiting_for_teacher_result_evidence" &&
    receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_v1" &&
    receiptTemplate.reviewedNextTool === preparationValidation.manualNextGatePreparation.nextTool &&
    receiptTemplate.executeNow === false &&
    existsSync(receiptBuilder.htmlPath) &&
    builderHtml.includes("does not execute tools"),
  { receiptBuilderPath: receiptBuilder.builderPath }
);
check(
  "TLCL manual next-gate result receipt validation prepares reviewed result for follow-up",
  validValidation.format === "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_validation_result_v1" &&
    validValidation.status === "manual_next_gate_result_reviewed_waiting_for_tlcl_follow_up" &&
    validValidation.readyForFollowUp === true &&
    validValidation.reviewedManualNextGateResult?.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_v1" &&
    validValidation.reviewedManualNextGateResult?.executeNow === false &&
    validValidation.reviewedManualNextGateResult?.nextGateResultEvidencePaths?.includes(resultEvidencePath) &&
    validValidation.locks?.validatorDoesNotExecuteNextGateTool === true &&
    validValidation.locks?.validatorDoesNotInvokeModel === true &&
    validValidation.locks?.validatorDoesNotFetchRag === true &&
    validValidation.locks?.validatorDoesNotWriteMemory === true &&
    validValidation.locks?.validatorDoesNotEnableRule === true &&
    validValidation.locks?.validatorDoesNotUnlockPackaging === true,
  { validationPath: validValidation.validationPath }
);
check(
  "TLCL manual next-gate result receipt blocks forbidden run decisions",
  forbiddenValidation.status === "blocked_for_forbidden_manual_next_gate_result_decision" &&
    forbiddenValidation.forbiddenDecisionUsed === true &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
  { blockers: forbiddenValidation.blockers }
);
check(
  "TLCL manual next-gate result receipt requires result evidence",
  missingEvidenceValidation.status === "needs_teacher_review_or_more_manual_next_gate_result_evidence" &&
    missingEvidenceValidation.readyForFollowUp === false &&
    missingEvidenceValidation.blockers.some((blocker) => blocker.code === "next_gate_result_evidence_missing"),
  { blockers: missingEvidenceValidation.blockers }
);
check(
  "TLCL manual next-gate result receipt rejects rollback mismatch",
  rollbackMismatchValidation.status === "needs_teacher_review_or_more_manual_next_gate_result_evidence" &&
    rollbackMismatchValidation.readyForFollowUp === false &&
    rollbackMismatchValidation.blockers.some((blocker) => blocker.code === "rollback_point_mismatch"),
  { blockers: rollbackMismatchValidation.blockers }
);
check(
  "TLCL manual next-gate result receipt can route correction back to high reasoning repair",
  repairValidation.status === "correction_to_high_reasoning_repair_required" &&
    repairValidation.correctionToHighReasoningRepair === true &&
    repairValidation.highReasoningRepairHandoff?.route === "high_reasoning_logic_contract_repair_after_manual_next_gate_result" &&
    repairValidation.highReasoningRepairHandoff?.executeNow === false,
  { repairHandoff: repairValidation.highReasoningRepairHandoff }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  upstreamPreparationValidation: preparationValidationPath,
  receiptBuilder,
  validValidation,
  forbiddenValidation,
  missingEvidenceValidation,
  rollbackMismatchValidation,
  repairValidation
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
