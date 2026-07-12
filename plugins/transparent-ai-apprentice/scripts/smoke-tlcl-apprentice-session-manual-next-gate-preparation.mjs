#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-manual-next-gate-preparation-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function runJson(script, args = [], options = {}) {
  try {
    return JSON.parse(
      execFileSync(process.execPath, [join(scriptsRoot, script), ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 50 * 1024 * 1024
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

const upstreamSmoke = runJson("smoke-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs");
const selectedNextGateValidationPath = upstreamSmoke.validValidation.validationPath;
const repairNextGateValidationPath = upstreamSmoke.repairValidation.validationPath;

const builder = runJson("create-tlcl-apprentice-session-manual-next-gate-preparation-builder.mjs", [
  "--validation",
  selectedNextGateValidationPath,
  "--output-dir",
  join(outRoot, "builder")
]);
const receiptTemplate = readJson(builder.receiptTemplatePath);
const validReceiptPath = writeJson(join(outRoot, "valid-manual-next-gate-preparation-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_next_gate_prepared_for_separate_use",
  selectedGateReviewed: true,
  commandTemplateReviewed: true,
  requiredInputsReviewed: true,
  rollbackPointRetained: true,
  teacherConfirmedSeparateManualUse: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher reviewed the manual next gate preparation and will use it separately."
});
const validValidation = runJson("validate-tlcl-apprentice-session-manual-next-gate-preparation-receipt.mjs", [
  "--builder",
  builder.builderPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-validation")
]);

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-manual-next-gate-preparation-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_next_gate",
  selectedGateReviewed: true,
  commandTemplateReviewed: true,
  requiredInputsReviewed: true,
  rollbackPointRetained: true,
  teacherConfirmedSeparateManualUse: true
});
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-manual-next-gate-preparation-receipt.mjs",
  ["--builder", builder.builderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(outRoot, "forbidden-validation")],
  { allowFailure: true }
);

const commandMismatchReceiptPath = writeJson(join(outRoot, "command-mismatch-manual-next-gate-preparation-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_next_gate_prepared_for_separate_use",
  reviewedCommandTemplate: "node wrong-tool.mjs --execute",
  selectedGateReviewed: true,
  commandTemplateReviewed: true,
  requiredInputsReviewed: true,
  rollbackPointRetained: true,
  teacherConfirmedSeparateManualUse: true
});
const commandMismatchValidation = runJson("validate-tlcl-apprentice-session-manual-next-gate-preparation-receipt.mjs", [
  "--builder",
  builder.builderPath,
  "--receipt",
  commandMismatchReceiptPath,
  "--output-dir",
  join(outRoot, "command-mismatch-validation")
]);

const missingReviewReceiptPath = writeJson(join(outRoot, "missing-review-manual-next-gate-preparation-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_next_gate_prepared_for_separate_use",
  selectedGateReviewed: false,
  commandTemplateReviewed: true,
  requiredInputsReviewed: true,
  rollbackPointRetained: true,
  teacherConfirmedSeparateManualUse: true
});
const missingReviewValidation = runJson("validate-tlcl-apprentice-session-manual-next-gate-preparation-receipt.mjs", [
  "--builder",
  builder.builderPath,
  "--receipt",
  missingReviewReceiptPath,
  "--output-dir",
  join(outRoot, "missing-review-validation")
]);

const repairBuilder = runJson("create-tlcl-apprentice-session-manual-next-gate-preparation-builder.mjs", [
  "--validation",
  repairNextGateValidationPath,
  "--output-dir",
  join(outRoot, "repair-builder")
]);
const repairReceiptTemplate = readJson(repairBuilder.receiptTemplatePath);
const repairReceiptPath = writeJson(join(outRoot, "repair-manual-next-gate-preparation-receipt.json"), {
  ...repairReceiptTemplate,
  teacherDecision: "manual_next_gate_prepared_for_separate_use",
  selectedGateReviewed: true,
  commandTemplateReviewed: true,
  requiredInputsReviewed: true,
  rollbackPointRetained: true,
  teacherConfirmedSeparateManualUse: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher confirmed this must return to high-reasoning repair as a separate manual step."
});
const repairValidation = runJson("validate-tlcl-apprentice-session-manual-next-gate-preparation-receipt.mjs", [
  "--builder",
  repairBuilder.builderPath,
  "--receipt",
  repairReceiptPath,
  "--output-dir",
  join(outRoot, "repair-validation")
]);

const builderHtml = readFileSync(builder.htmlPath, "utf8");
const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL manual next-gate preparation builder creates reviewed RAG follow-up receipt",
  builder.format === "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_builder_result_v1" &&
    builder.ok === true &&
    builder.status === "manual_next_gate_preparation_builder_waiting_for_teacher_review" &&
    builder.selectedNextGate === "prepare_rag_rule_dsl_review_follow_up" &&
    builder.nextTool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs" &&
    receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_receipt_v1" &&
    receiptTemplate.executeNow === false &&
    existsSync(builder.htmlPath) &&
    builderHtml.includes("does not execute tools"),
  { builderPath: builder.builderPath }
);
check(
  "TLCL manual next-gate preparation validation prepares separate manual use",
  validValidation.format === "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_result_v1" &&
    validValidation.status === "manual_next_gate_prepared_waiting_for_separate_manual_use" &&
    validValidation.readyForSeparateManualNextGateUse === true &&
    validValidation.manualNextGatePreparation?.format === "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_v1" &&
    validValidation.manualNextGatePreparation?.nextTool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs" &&
    validValidation.manualNextGatePreparation?.executeNow === false &&
    validValidation.locks?.validatorDoesNotExecuteNextGateTool === true &&
    validValidation.locks?.validatorDoesNotInvokeModel === true &&
    validValidation.locks?.validatorDoesNotFetchRag === true &&
    validValidation.locks?.validatorDoesNotWriteMemory === true &&
    validValidation.locks?.validatorDoesNotEnableRule === true &&
    validValidation.locks?.validatorDoesNotUnlockPackaging === true,
  { validationPath: validValidation.validationPath }
);
check(
  "TLCL manual next-gate preparation blocks forbidden run decisions",
  forbiddenValidation.status === "blocked_for_forbidden_manual_next_gate_preparation_decision" &&
    forbiddenValidation.forbiddenDecisionUsed === true &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
  { blockers: forbiddenValidation.blockers }
);
check(
  "TLCL manual next-gate preparation rejects command template mismatch",
  commandMismatchValidation.status === "needs_teacher_review_before_manual_next_gate_use" &&
    commandMismatchValidation.readyForSeparateManualNextGateUse === false &&
    commandMismatchValidation.blockers.some((blocker) => blocker.code === "reviewed_command_template_mismatch"),
  { blockers: commandMismatchValidation.blockers }
);
check(
  "TLCL manual next-gate preparation requires selected gate review",
  missingReviewValidation.status === "needs_teacher_review_before_manual_next_gate_use" &&
    missingReviewValidation.readyForSeparateManualNextGateUse === false &&
    missingReviewValidation.blockers.some((blocker) => blocker.code === "selected_gate_not_reviewed"),
  { blockers: missingReviewValidation.blockers }
);
check(
  "TLCL manual next-gate preparation can prepare high-reasoning repair as separate manual use",
  repairBuilder.selectedNextGate === "correction_to_high_reasoning_repair" &&
    repairBuilder.nextTool === "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs" &&
    repairValidation.status === "manual_next_gate_prepared_waiting_for_separate_manual_use" &&
    repairValidation.readyForSeparateManualNextGateUse === true &&
    repairValidation.manualNextGatePreparation?.selectedNextGate === "correction_to_high_reasoning_repair" &&
    repairValidation.manualNextGatePreparation?.executeNow === false,
  { validationPath: repairValidation.validationPath }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_smoke_v1",
  passed,
  total: checks.length,
  checks,
  upstreamSelectedNextGateValidation: selectedNextGateValidationPath,
  upstreamRepairNextGateValidation: repairNextGateValidationPath,
  builder,
  validValidation,
  forbiddenValidation,
  commandMismatchValidation,
  missingReviewValidation,
  repairBuilder,
  repairValidation
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
