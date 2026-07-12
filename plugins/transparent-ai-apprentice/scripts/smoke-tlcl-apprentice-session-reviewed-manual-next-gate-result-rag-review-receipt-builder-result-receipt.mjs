#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".transparent-apprentice", "tlcl-rag-review-receipt-builder-result-receipt-smoke");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args = [], expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 40 * 1024 * 1024
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${scriptPath} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${scriptPath} unexpectedly passed:\nSTDOUT:\n${result.stdout}`);
  }
  return result;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const adapterSmoke = JSON.parse(
  runScript(join(pluginRoot, "scripts", "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter.mjs")).stdout
);
const adapterValidationPath = adapterSmoke.validValidation.validationPath;
const ruleDslValidationPackagePath =
  adapterSmoke.validValidation.manualRagReviewReceiptBuilderHandoff.ruleDslValidationPackagePath;

const existingBuilderResult = JSON.parse(
  runScript(join(pluginRoot, "scripts", "knowledge", "create-rag-reviewed-rule-dsl-review-receipt-builder.mjs"), [
    "--rule-dsl-validation-package",
    ruleDslValidationPackagePath,
    "--out-dir",
    join(root, "manual-existing-rag-review-receipt-builder")
  ]).stdout
);

const builderResultRun = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt-builder.mjs"
    ),
    [
      "--adapter-validation",
      adapterValidationPath,
      "--rag-review-receipt-builder",
      JSON.stringify(existingBuilderResult),
      "--output-dir",
      join(root, "builder")
    ]
  ).stdout
);
const builderPacket = readJson(builderResultRun.resultReceiptBuilderPath);
const receiptTemplate = readJson(builderResultRun.receiptTemplatePath);

const validReceiptPath = writeJson(join(root, "valid-builder-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "rag_review_receipt_builder_result_reviewed_ready_for_teacher_receipt",
  builderOutputReviewed: true,
  receiptTemplateReviewed: true,
  validationCommandReviewed: true,
  teacherConfirmedNoExecution: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher confirmed the existing RAG builder result is ready for separate RAG review receipt filling."
});
const validValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt.mjs"
    ),
    ["--builder", builderResultRun.resultReceiptBuilderPath, "--receipt", validReceiptPath, "--output-dir", join(root, "valid-validation")]
  ).stdout
);

const forbiddenReceiptPath = writeJson(join(root, "forbidden-run-rag-validator-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_rag_validator",
  builderOutputReviewed: true,
  receiptTemplateReviewed: true,
  validationCommandReviewed: true,
  teacherConfirmedNoExecution: false,
  blockedActionsConfirmed: false,
  teacherNotes: "This forbidden receipt tries to run the RAG validator."
});
const forbiddenRun = runScript(
  join(
    pluginRoot,
    "scripts",
    "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt.mjs"
  ),
  ["--builder", builderResultRun.resultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);
const forbiddenValidation = JSON.parse(forbiddenRun.stdout);

const mismatchReceiptPath = writeJson(join(root, "mismatch-validation-command-receipt.json"), {
  ...receiptTemplate,
  validationCommand: "node wrong-validator.mjs --receipt <teacher-filled-receipt.json>",
  teacherDecision: "rag_review_receipt_builder_result_reviewed_ready_for_teacher_receipt",
  builderOutputReviewed: true,
  receiptTemplateReviewed: true,
  validationCommandReviewed: true,
  teacherConfirmedNoExecution: true,
  blockedActionsConfirmed: true,
  teacherNotes: "This receipt has a mismatched validation command."
});
const mismatchValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt.mjs"
    ),
    ["--builder", builderResultRun.resultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
  ).stdout
);

const evidenceReceiptPath = writeJson(join(root, "needs-more-evidence-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "needs_more_builder_result_evidence",
  teacherNotes: "Teacher wants another look at the generated RAG review receipt template before continuing."
});
const evidenceValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt.mjs"
    ),
    ["--builder", builderResultRun.resultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
  ).stdout
);

const correctionReceiptPath = writeJson(join(root, "correction-builder-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The builder result shows the review receipt is not aligned with the intended logic contract."
});
const correctionValidation = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt.mjs"
    ),
    ["--builder", builderResultRun.resultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
  ).stdout
);

const checks = [
  {
    name: "TLCL RAG builder result receipt builder consumes existing RAG builder output",
    passed:
      builderResultRun.ok === true &&
      builderResultRun.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_builder_result_v1" &&
      builderResultRun.status === "tlcl_rag_review_receipt_builder_result_receipt_waiting_for_teacher_confirmation" &&
      builderPacket.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_builder_v1" &&
      receiptTemplate.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_v1" &&
      builderResultRun.locks?.builderDoesNotExecuteRagValidator === true,
    evidence: { resultReceiptBuilderPath: builderResultRun.resultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG builder result validation prepares teacher-fill handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_review_receipt_template_ready_for_teacher_fill" &&
      validValidation.readyForRagReviewReceiptTeacherFill === true &&
      validValidation.manualRagReviewReceiptTemplateHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_review_receipt_template_handoff_v1" &&
      validValidation.manualRagReviewReceiptTemplateHandoff?.executeNow === false &&
      validValidation.locks?.validatorDoesNotExecuteRagValidator === true,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG builder result validation blocks forbidden validator runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_review_receipt_builder_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG builder result validation detects validation command mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_rag_review_receipt_template" &&
      mismatchValidation.readyForRagReviewReceiptTeacherFill === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "validation_command_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG builder result validation can request more evidence",
    passed:
      evidenceValidation.status === "needs_more_builder_result_evidence_before_rag_review_receipt" &&
      evidenceValidation.needsMoreBuilderResultEvidence === true &&
      evidenceValidation.locks?.validatorDoesNotExecuteRagValidator === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG builder result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_review_receipt_builder_result" &&
      correctionValidation.highReasoningRepairHandoff?.executeNow === false,
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  adapterValidationPath,
  existingBuilderResult,
  builderResultRun,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
