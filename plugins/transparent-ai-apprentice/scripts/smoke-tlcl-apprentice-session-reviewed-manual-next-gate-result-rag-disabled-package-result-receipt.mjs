#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = join(repoRoot, ".transparent-apprentice", "tlcl-rag-disabled-package-result-receipt-smoke");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args = [], expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 60 * 1024 * 1024
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

const priorSmoke = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt.mjs"
    )
  ).stdout
);
const tlclValidationPath = priorSmoke.validValidation.validationPath;
const handoff = priorSmoke.validValidation.disabledPackagePlanningHandoff;
const rollbackPoint = resolve(repoRoot, handoff.rollbackPoint);
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "tlcl-rag-disabled-package-result-smoke",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const disabledPackageResult = JSON.parse(
  runScript(join(pluginRoot, "scripts", "knowledge", "create-rag-reviewed-disabled-rule-package.mjs"), [
    "--review-validation",
    handoff.reviewValidationPath,
    "--rollback-point",
    handoff.rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "manual-existing-disabled-package")
  ]).stdout
);

const builderResult = JSON.parse(
  runScript(
    join(
      pluginRoot,
      "scripts",
      "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt-builder.mjs"
    ),
    [
      "--tlcl-disabled-package-planning-validation",
      tlclValidationPath,
      "--rag-disabled-package",
      JSON.stringify(disabledPackageResult),
      "--output-dir",
      join(root, "builder")
    ]
  ).stdout
);
const builderPacket = readJson(builderResult.disabledPackageResultReceiptBuilderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);

const validReceiptPath = writeJson(join(root, "valid-disabled-package-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "disabled_package_result_reviewed_ready_for_validation_report",
  disabledPackageResultReviewed: true,
  compiledDisabledPackageReviewed: true,
  stagedRulesReviewed: true,
  teacherConfirmedNoValidationReportRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "Teacher confirmed the disabled package result may be handed off to a separate validation report planning step."
});
const validValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt.mjs"),
    ["--builder", builderResult.disabledPackageResultReceiptBuilderPath, "--receipt", validReceiptPath, "--output-dir", join(root, "valid-validation")]
  ).stdout
);

const forbiddenReceiptPath = writeJson(join(root, "forbidden-validation-report-builder-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "run_validation_report_builder",
  disabledPackageResultReviewed: true,
  compiledDisabledPackageReviewed: true,
  stagedRulesReviewed: true,
  teacherConfirmedNoValidationReportRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "This forbidden receipt tries to run the validation report builder."
});
const forbiddenRun = runScript(
  join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt.mjs"),
  ["--builder", builderResult.disabledPackageResultReceiptBuilderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(root, "forbidden-validation")],
  false
);
const forbiddenValidation = JSON.parse(forbiddenRun.stdout);

const mismatchReceiptPath = writeJson(join(root, "mismatch-disabled-package-hash-receipt.json"), {
  ...receiptTemplate,
  disabledPackageHash: "sha256:mismatch",
  teacherDecision: "disabled_package_result_reviewed_ready_for_validation_report",
  disabledPackageResultReviewed: true,
  compiledDisabledPackageReviewed: true,
  stagedRulesReviewed: true,
  teacherConfirmedNoValidationReportRun: true,
  blockedActionsConfirmed: true,
  rollbackPointConfirmed: true,
  teacherNotes: "This receipt has a mismatched disabled package hash."
});
const mismatchValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt.mjs"),
    ["--builder", builderResult.disabledPackageResultReceiptBuilderPath, "--receipt", mismatchReceiptPath, "--output-dir", join(root, "mismatch-validation")]
  ).stdout
);

const evidenceReceiptPath = writeJson(join(root, "needs-more-disabled-package-evidence-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "needs_more_disabled_package_evidence",
  teacherNotes: "Teacher wants more evidence from the disabled package result before validation report planning."
});
const evidenceValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt.mjs"),
    ["--builder", builderResult.disabledPackageResultReceiptBuilderPath, "--receipt", evidenceReceiptPath, "--output-dir", join(root, "evidence-validation")]
  ).stdout
);

const correctionReceiptPath = writeJson(join(root, "correction-disabled-package-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherNotes: "The disabled package result shows the logic contract should be repaired by the high-reasoning layer."
});
const correctionValidation = JSON.parse(
  runScript(
    join(pluginRoot, "scripts", "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt.mjs"),
    ["--builder", builderResult.disabledPackageResultReceiptBuilderPath, "--receipt", correctionReceiptPath, "--output-dir", join(root, "correction-validation")]
  ).stdout
);

const checks = [
  {
    name: "TLCL RAG disabled package result receipt builder consumes existing disabled package",
    passed:
      builderResult.ok === true &&
      builderResult.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_builder_result_v1" &&
      builderResult.status === "tlcl_rag_disabled_package_result_waiting_for_teacher_confirmation" &&
      builderPacket.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_builder_v1" &&
      receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_v1" &&
      builderResult.disabledRuleCount === 1 &&
      builderResult.locks?.builderDoesNotRunValidationReportBuilder === true,
    evidence: { disabledPackageResultReceiptBuilderPath: builderResult.disabledPackageResultReceiptBuilderPath }
  },
  {
    name: "TLCL RAG disabled package result validation prepares manual validation report handoff",
    passed:
      validValidation.format === "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_validation_result_v1" &&
      validValidation.status === "tlcl_rag_disabled_package_ready_for_validation_report_planning" &&
      validValidation.readyForValidationReportPlanning === true &&
      validValidation.validationReportHandoff?.format ===
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_validation_report_handoff_v1" &&
      validValidation.validationReportHandoff?.nextTool === "knowledge/create-rag-disabled-package-validation-report.mjs" &&
      validValidation.validationReportHandoff?.executeNow === false &&
      validValidation.locks?.validatorDoesNotRunValidationReportBuilder === true,
    evidence: { validationPath: validValidation.validationPath }
  },
  {
    name: "TLCL RAG disabled package result validation blocks forbidden validation report runs",
    passed:
      forbiddenValidation.status === "blocked_for_forbidden_tlcl_rag_disabled_package_result_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
    evidence: { blockers: forbiddenValidation.blockers }
  },
  {
    name: "TLCL RAG disabled package result validation detects disabled package hash mismatch",
    passed:
      mismatchValidation.status === "needs_teacher_review_before_validation_report" &&
      mismatchValidation.readyForValidationReportPlanning === false &&
      mismatchValidation.blockers.some((blocker) => blocker.code === "rag_disabled_package_source_not_still_valid"),
    evidence: { blockers: mismatchValidation.blockers }
  },
  {
    name: "TLCL RAG disabled package result validation can request more evidence",
    passed:
      evidenceValidation.status === "needs_more_disabled_package_evidence_before_validation_report" &&
      evidenceValidation.needsMoreDisabledPackageEvidence === true &&
      evidenceValidation.locks?.validatorDoesNotRunValidationReportBuilder === true,
    evidence: { validationPath: evidenceValidation.validationPath }
  },
  {
    name: "TLCL RAG disabled package result validation can route correction back to high reasoning repair",
    passed:
      correctionValidation.status === "correction_to_high_reasoning_repair_required" &&
      correctionValidation.highReasoningRepairHandoff?.route === "high_reasoning_logic_contract_repair_after_tlcl_rag_disabled_package_result" &&
      correctionValidation.highReasoningRepairHandoff?.executeNow === false,
    evidence: { repairHandoff: correctionValidation.highReasoningRepairHandoff }
  }
];

const passed = checks.filter((check) => check.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  tlclValidationPath,
  disabledPackagePath: disabledPackageResult.packagePath,
  builderResult,
  validValidation,
  forbiddenValidation,
  mismatchValidation,
  evidenceValidation,
  correctionValidation
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
