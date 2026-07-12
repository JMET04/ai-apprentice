#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".transparent-apprentice", "tlcl-rag-review-receipt-adapter-smoke");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args = [], expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
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

const followUpSmoke = JSON.parse(
  runScript(join(pluginRoot, "scripts", "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection.mjs")).stdout
);
const followUpValidationPath = followUpSmoke.validValidation.validationPath;

const ruleDslPackageSmoke = JSON.parse(
  runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-reviewed-rule-dsl-validation-package.mjs")).stdout
);
const ruleDslValidationPackagePath = ruleDslPackageSmoke.packagePath;

const builderRun = runScript(join(pluginRoot, "scripts", "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter-builder.mjs"), [
  "--follow-up-validation",
  followUpValidationPath,
  "--rule-dsl-validation-package",
  ruleDslValidationPackagePath,
  "--output-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receiptTemplate = readJson(builder.receiptTemplatePath);

const validReceiptPath = writeJson(join(root, "valid-adapter-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "adapter_reviewed_for_manual_rag_review_receipt_builder",
  packageEvidenceReviewed: true,
  ruleValidationRowsReviewed: true,
  commandTemplateReviewed: true,
  teacherConfirmedNoExecution: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher confirmed the adapter only prepares the existing RAG review receipt builder command."
});
const validValidation = JSON.parse(
  runScript(join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter.mjs"), [
    "--adapter",
    builder.adapterPath,
    "--receipt",
    validReceiptPath,
    "--output-dir",
    join(root, "valid-validation")
  ]).stdout
);

const forbiddenReceiptPath = writeJson(join(root, "forbidden-run-adapter-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_rag_builder",
  packageEvidenceReviewed: true,
  ruleValidationRowsReviewed: true,
  commandTemplateReviewed: true,
  teacherConfirmedNoExecution: false,
  blockedActionsConfirmed: false,
  teacherNotes: "This forbidden receipt tries to run the builder."
});
const forbiddenRun = runScript(
  join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter.mjs"),
  ["--adapter", builder.adapterPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);
const forbiddenValidation = JSON.parse(forbiddenRun.stdout);

const mismatchReceiptPath = writeJson(join(root, "mismatch-package-hash-adapter-receipt.json"), {
  ...receiptTemplate,
  packageHash: "wrong-package-hash",
  teacherDecision: "adapter_reviewed_for_manual_rag_review_receipt_builder",
  packageEvidenceReviewed: true,
  ruleValidationRowsReviewed: true,
  commandTemplateReviewed: true,
  teacherConfirmedNoExecution: true,
  blockedActionsConfirmed: true,
  teacherNotes: "This receipt has a mismatched package hash."
});
const mismatchValidation = JSON.parse(
  runScript(join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter.mjs"), [
    "--adapter",
    builder.adapterPath,
    "--receipt",
    mismatchReceiptPath,
    "--output-dir",
    join(root, "mismatch-validation")
  ]).stdout
);

const correctionReceiptPath = writeJson(join(root, "correction-adapter-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The adapter revealed that the RAG validation package does not match the intended logic."
});
const correctionValidation = JSON.parse(
  runScript(join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter.mjs"), [
    "--adapter",
    builder.adapterPath,
    "--receipt",
    correctionReceiptPath,
    "--output-dir",
    join(root, "correction-validation")
  ]).stdout
);

const checks = [
  {
    name: "TLCL RAG review receipt adapter builder creates teacher confirmation template",
    passed:
      builder.ok === true &&
      builder.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_builder_result_v1" &&
      builder.status === "tlcl_rag_review_receipt_adapter_waiting_for_teacher_confirmation" &&
      builder.commandTemplate.includes("create-rag-reviewed-rule-dsl-review-receipt-builder.mjs") &&
      receiptTemplate.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_receipt_v1" &&
      builder.locks?.adapterDoesNotExecuteRagBuilder === true,
    evidence: { adapterPath: builder.adapterPath }
  },
  {
    name: "TLCL RAG review receipt adapter validation prepares manual existing-builder handoff",
    passed:
      validValidation.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_validation_result_v1" &&
      validValidation.status === "tlcl_rag_review_receipt_builder_manual_command_ready" &&
      validValidation.readyForManualRagReviewReceiptBuilder === true &&
      validValidation.manualRagReviewReceiptBuilderHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_review_receipt_builder_handoff_v1" &&
      validValidation.manualRagReviewReceiptBuilderHandoff?.executeNow === false &&
      validValidation.locks?.validatorDoesNotExecuteRagBuilder === true,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG review receipt adapter blocks forbidden run decisions",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_review_receipt_adapter_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG review receipt adapter rejects package hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_rag_review_receipt_builder" &&
      mismatchValidation.readyForManualRagReviewReceiptBuilder === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "package_hash_mismatch"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG review receipt adapter can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route ===
        "high_reasoning_logic_contract_repair_after_tlcl_rag_review_receipt_adapter" &&
      correctionValidation.highReasoningRepairHandoff?.executeNow === false,
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_smoke_v1",
  passed,
  total: checks.length,
  checks,
  followUpValidationPath,
  ruleDslValidationPackagePath,
  builder,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  correctionValidation
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
