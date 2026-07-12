#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-lifecycle-candidate-review-gate");
mkdirSync(smokeRoot, { recursive: true });
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (expectOk && result.status !== 0) throw new Error(result.stderr || result.stdout || args.join(" "));
  if (!expectOk && result.status === 0) throw new Error(`Expected failure: ${args.join(" ")}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function createReportReviewValidation() {
  const reviewSmoke = JSON.parse(
    runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-rule-dsl-review-gate.mjs"])
      .stdout
  );
  const readyCheck = reviewSmoke.checks.find((row) =>
    String(row.name).includes("prepares disabled package planning only after logic match")
  );
  if (!readyCheck) throw new Error("READY_CONFIRMED_OUTCOME_REVIEW_VALIDATION_CHECK_NOT_FOUND");
  const evidence = JSON.parse(readyCheck.evidence);
  const sourcePackagePath = evidence.sourceRuleDraftPackagePath;
  if (!sourcePackagePath) throw new Error("CONFIRMED_OUTCOME_SOURCE_PACKAGE_PATH_NOT_FOUND");
  const ruleReviewBuilder = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-review-receipt-builder.mjs",
      "--package",
      sourcePackagePath,
      "--out-dir",
      join(smokeRoot, "rule-review-builder")
    ]).stdout
  );
  const ruleReviewReceipt = readJson(ruleReviewBuilder.receiptTemplatePath);
  ruleReviewReceipt.teacherDecision = "logic_matches";
  ruleReviewReceipt.rollbackRetained = true;
  ruleReviewReceipt.teacherConfirmedNoExecution = true;
  ruleReviewReceipt.teacherConfirmedNoRegistryMutation = true;
  ruleReviewReceipt.teacherConfirmedNoRuleEnablement = true;
  ruleReviewReceipt.teacherConfirmedNoRagAuthority = true;
  ruleReviewReceipt.reviewedCandidateRows = ruleReviewReceipt.reviewedCandidateRows.map((row) => ({
    ...row,
    logicFitDecision: "matches_intended_logic",
    teacherReviewed: true,
    evidenceReviewed: true,
    lifecycleConfirmedDraftDisabled: true,
    controlledOutputHashReviewed: true,
    reviewerNote: "Confirmed-outcome lifecycle candidate smoke confirms draft logic as evidence-only."
  }));
  const ruleReviewReceiptPath = writeJson(join(smokeRoot, "rule-review-receipt.json"), ruleReviewReceipt);
  const ruleReviewValidation = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
      "--package",
      sourcePackagePath,
      "--receipt",
      ruleReviewReceiptPath,
      "--out-dir",
      join(smokeRoot, "rule-review-validation")
    ]).stdout
  );
  const report = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-disabled-package-validation-report.mjs",
      "--review-validation",
      ruleReviewValidation.validationPath,
      "--teacher-reviewed",
      "--out-dir",
      join(smokeRoot, "disabled-report")
    ]).stdout
  );
  const reportReviewBuilder = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-validation-report-review-receipt-builder.mjs",
      "--report-packet",
      report.packetPath,
      "--out-dir",
      join(smokeRoot, "report-review-builder")
    ]).stdout
  );
  const reportReviewReceipt = readJson(reportReviewBuilder.receiptTemplatePath);
  reportReviewReceipt.teacherDecision = "report_confirms_disabled_evidence";
  reportReviewReceipt.reportReviewed = true;
  reportReviewReceipt.lifecycleSkippedRowsReviewed = true;
  reportReviewReceipt.deliveryAllowedEvidenceOnlyConfirmed = true;
  reportReviewReceipt.rollbackRetained = true;
  reportReviewReceipt.teacherConfirmedNoExecution = true;
  reportReviewReceipt.teacherNotes = "Report can become lifecycle candidate evidence only.";
  const reportReviewReceiptPath = writeJson(join(smokeRoot, "report-review-receipt.json"), reportReviewReceipt);
  const reportReviewValidation = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs",
      "--report-packet",
      report.packetPath,
      "--receipt",
      reportReviewReceiptPath,
      "--out-dir",
      join(smokeRoot, "report-review-validation")
    ]).stdout
  );
  return reportReviewValidation.validationPath;
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const reportReviewValidationPath = createReportReviewValidation();
const reportReviewValidation = readJson(reportReviewValidationPath);
const builder = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-lifecycle-candidate-review-receipt-builder.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--out-dir",
    join(smokeRoot, "lifecycle-candidate-builder")
  ]).stdout
);
const template = readJson(builder.receiptTemplatePath);
check(
  "Real-case confirmed outcome lifecycle candidate review builder creates review-only receipt template",
  builder.format === "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_builder_result_v1" &&
    builder.status === "ready_for_teacher_confirmed_outcome_lifecycle_candidate_review" &&
    builder.confirmedOutcomeBranch === true &&
    builder.sourceReviewFormat === expectedSourceReviewFormat &&
    builder.sourceConfirmedOutcomeReviewId === reportReviewValidation.sourceConfirmedOutcomeReviewId &&
    builder.sourceConfirmedOutcomeSourceRunId === reportReviewValidation.sourceConfirmedOutcomeSourceRunId &&
    builder.sourceRunId === reportReviewValidation.sourceRunId &&
    template.format === "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_v1" &&
    template.confirmedOutcomeBranch === true &&
    template.sourceReviewFormat === expectedSourceReviewFormat &&
    template.sourceConfirmedOutcomeReviewId === builder.sourceConfirmedOutcomeReviewId &&
    template.sourceConfirmedOutcomeSourceRunId === builder.sourceConfirmedOutcomeSourceRunId &&
    template.sourceRunId === builder.sourceRunId &&
    template.proposedTransition === "draft_disabled_to_review_only_candidate" &&
    template.forbiddenTeacherDecisions.includes("activate_rule"),
  JSON.stringify({ builderPath: builder.builderPath, receiptTemplatePath: builder.receiptTemplatePath })
);

const approveReceipt = {
  ...template,
  teacherDecision: "approve_review_only_lifecycle_candidate",
  lifecycleCandidateReviewed: true,
  disabledLifecycleReviewed: true,
  draftDisabledToReviewOnlyOnlyConfirmed: true,
  activePromotionStillBlockedConfirmed: true,
  separateActiveGateRequiredConfirmed: true,
  teacherConfirmedNoExecution: true,
  rollbackRetained: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Approve review_only planning only."
};
const approveReceiptPath = writeJson(join(smokeRoot, "approve-lifecycle-candidate-receipt.json"), approveReceipt);
const approveValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--receipt",
    approveReceiptPath,
    "--out-dir",
    join(smokeRoot, "approve-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome lifecycle candidate review prepares review-only package planning without active promotion",
  approveValidation.status === "confirmed_outcome_lifecycle_candidate_review_ready_for_review_only_package_planning" &&
    approveValidation.readyForReviewOnlyPlanning === true &&
    approveValidation.confirmedOutcomeBranch === true &&
    approveValidation.sourceReviewFormat === expectedSourceReviewFormat &&
    approveValidation.sourceConfirmedOutcomeReviewId === builder.sourceConfirmedOutcomeReviewId &&
    approveValidation.sourceConfirmedOutcomeSourceRunId === builder.sourceConfirmedOutcomeSourceRunId &&
    approveValidation.sourceRunId === builder.sourceRunId &&
    approveValidation.reviewOnlyPackagePlanningHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_review_only_lifecycle_candidate_handoff_v1" &&
    approveValidation.reviewOnlyPackagePlanningHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    approveValidation.reviewOnlyPackagePlanningHandoff?.sourceConfirmedOutcomeReviewId === builder.sourceConfirmedOutcomeReviewId &&
    approveValidation.reviewOnlyPackagePlanningHandoff?.sourceConfirmedOutcomeSourceRunId === builder.sourceConfirmedOutcomeSourceRunId &&
    approveValidation.reviewOnlyPackagePlanningHandoff?.sourceRunId === builder.sourceRunId &&
    approveValidation.reviewOnlyPackagePlanningHandoff?.activePromotionAllowed === false &&
    approveValidation.reviewOnlyPackagePlanningHandoff?.separateActiveGateRequired === true &&
    approveValidation.locks?.activeRulePackageCompiled === false &&
    approveValidation.locks?.ruleEnabled === false &&
    approveValidation.locks?.packagingUnlocked === false,
  JSON.stringify(approveValidation.reviewOnlyPackagePlanningHandoff)
);

const repairReceipt = {
  ...template,
  teacherDecision: "request_high_reasoning_repair",
  lifecycleCandidateReviewed: true,
  teacherNotes: "The lifecycle candidate does not cover a teacher exception."
};
const repairReceiptPath = writeJson(join(smokeRoot, "repair-lifecycle-candidate-receipt.json"), repairReceipt);
const repairValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome lifecycle candidate review routes corrections to high reasoning repair",
  repairValidation.status === "confirmed_outcome_lifecycle_candidate_review_routes_to_high_reasoning_repair" &&
    repairValidation.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_high_reasoning_repair_handoff_v1" &&
    repairValidation.highReasoningRepairHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    repairValidation.highReasoningRepairHandoff?.sourceConfirmedOutcomeReviewId === builder.sourceConfirmedOutcomeReviewId &&
    repairValidation.highReasoningRepairHandoff?.sourceConfirmedOutcomeSourceRunId === builder.sourceConfirmedOutcomeSourceRunId &&
    repairValidation.highReasoningRepairHandoff?.sourceRunId === builder.sourceRunId &&
    repairValidation.locks?.ruleEnabled === false,
  JSON.stringify(repairValidation.highReasoningRepairHandoff)
);

const sourceTamperReceipt = {
  ...approveReceipt,
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
  sourceConfirmedOutcomeSourceRunId: "lost-confirmed-outcome-source-run-id"
};
const sourceTamperReceiptPath = writeJson(join(smokeRoot, "source-tamper-lifecycle-candidate-receipt.json"), sourceTamperReceipt);
const sourceTamperValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--receipt",
    sourceTamperReceiptPath,
    "--out-dir",
    join(smokeRoot, "source-tamper-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome lifecycle candidate review blocks lost confirmed-outcome source continuity",
  sourceTamperValidation.ok === false &&
    sourceTamperValidation.status === "confirmed_outcome_lifecycle_candidate_review_needs_teacher_review" &&
    sourceTamperValidation.blockers.some((row) => row.code === "receipt_source_review_format_mismatch") &&
    sourceTamperValidation.blockers.some((row) => row.code === "receipt_source_confirmed_outcome_source_run_id_mismatch") &&
    sourceTamperValidation.locks?.ruleEnabled === false &&
    sourceTamperValidation.locks?.packagingUnlocked === false,
  JSON.stringify(sourceTamperValidation.blockers)
);

const missingSourceRunValidationInput = {
  ...reportReviewValidation,
  sourceConfirmedOutcomeSourceRunId: "",
  lifecycleCandidateHandoff: {
    ...reportReviewValidation.lifecycleCandidateHandoff,
    sourceConfirmedOutcomeSourceRunId: ""
  }
};
const missingSourceRunValidationPath = writeJson(
  join(smokeRoot, "missing-source-run-report-review-validation.json"),
  missingSourceRunValidationInput
);
const missingSourceRunValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs",
    "--review-validation",
    missingSourceRunValidationPath,
    "--receipt",
    approveReceiptPath,
    "--out-dir",
    join(smokeRoot, "missing-source-run-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome lifecycle candidate review blocks missing confirmed-outcome source run id",
  missingSourceRunValidation.ok === false &&
    missingSourceRunValidation.status === "confirmed_outcome_lifecycle_candidate_review_needs_teacher_review" &&
    missingSourceRunValidation.blockers.some((row) => row.code === "source_ids_missing_or_mismatched"),
  JSON.stringify(missingSourceRunValidation.blockers)
);

const forbiddenReceipt = { ...template, teacherDecision: "activate_rule", lifecycleCandidateReviewed: true };
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-lifecycle-candidate-receipt.json"), forbiddenReceipt);
const forbiddenValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--receipt",
    forbiddenReceiptPath,
    "--out-dir",
    join(smokeRoot, "forbidden-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome lifecycle candidate review blocks active rule activation decisions",
  forbiddenValidation.status === "blocked_for_forbidden_confirmed_outcome_lifecycle_candidate_review_decision" &&
    forbiddenValidation.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.activePromotionAllowed === false,
  JSON.stringify(forbiddenValidation.blockers)
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
