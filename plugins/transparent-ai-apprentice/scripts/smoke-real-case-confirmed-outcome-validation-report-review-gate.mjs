#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-validation-report-review-gate");
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

function createReportPacket() {
  const reviewSmoke = JSON.parse(
    runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-rule-dsl-review-gate.mjs"]).stdout
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
    reviewerNote: "Confirmed-outcome validation report review smoke confirms draft logic as evidence-only."
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
  return report.packetPath;
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const reportPacketPath = createReportPacket();
const reportPacket = readJson(reportPacketPath);
const builder = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-validation-report-review-receipt-builder.mjs",
    "--report-packet",
    reportPacketPath,
    "--out-dir",
    join(smokeRoot, "report-review-builder")
  ]).stdout
);
const template = readJson(builder.receiptTemplatePath);
check(
  "Real-case confirmed outcome Validation Report review builder creates evidence-only receipt template",
  builder.format === "transparent_ai_real_case_confirmed_outcome_validation_report_review_receipt_builder_result_v1" &&
    template.format === "transparent_ai_real_case_confirmed_outcome_validation_report_review_receipt_v1" &&
    builder.confirmedOutcomeBranch === true &&
    builder.sourceReviewFormat === expectedSourceReviewFormat &&
    builder.sourceConfirmedOutcomeReviewId === reportPacket.sourceConfirmedOutcomeReviewId &&
    builder.sourceConfirmedOutcomeSourceRunId === reportPacket.sourceConfirmedOutcomeSourceRunId &&
    builder.sourceRunId === reportPacket.sourceRunId &&
    template.confirmedOutcomeBranch === true &&
    template.sourceReviewFormat === expectedSourceReviewFormat &&
    template.sourceConfirmedOutcomeReviewId === builder.sourceConfirmedOutcomeReviewId &&
    template.sourceConfirmedOutcomeSourceRunId === builder.sourceConfirmedOutcomeSourceRunId &&
    template.sourceRunId === builder.sourceRunId &&
    template.forbiddenTeacherDecisions.includes("promote_rule") &&
    template.deliveryAllowedEvidenceOnlyConfirmed === false,
  JSON.stringify({ builderPath: builder.builderPath, receiptTemplatePath: builder.receiptTemplatePath })
);

const confirmReceipt = {
  ...template,
  teacherDecision: "report_confirms_disabled_evidence",
  reportReviewed: true,
  lifecycleSkippedRowsReviewed: true,
  deliveryAllowedEvidenceOnlyConfirmed: true,
  rollbackRetained: true,
  teacherConfirmedNoExecution: true,
  teacherNotes: "Report can become lifecycle candidate evidence only."
};
const confirmReceiptPath = writeJson(join(smokeRoot, "confirm-report-receipt.json"), confirmReceipt);
const confirmValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs",
    "--report-packet",
    reportPacketPath,
    "--receipt",
    confirmReceiptPath,
    "--out-dir",
    join(smokeRoot, "confirm-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome Validation Report review prepares lifecycle candidate handoff without promotion",
  confirmValidation.status === "confirmed_outcome_validation_report_review_ready_for_lifecycle_candidate_planning" &&
    confirmValidation.readyForLifecycleCandidate === true &&
    confirmValidation.confirmedOutcomeBranch === true &&
    confirmValidation.sourceReviewFormat === expectedSourceReviewFormat &&
    confirmValidation.sourceConfirmedOutcomeReviewId === builder.sourceConfirmedOutcomeReviewId &&
    confirmValidation.sourceConfirmedOutcomeSourceRunId === builder.sourceConfirmedOutcomeSourceRunId &&
    confirmValidation.sourceRunId === builder.sourceRunId &&
    confirmValidation.lifecycleCandidateHandoff?.activePromotionAllowedHere === false &&
    confirmValidation.lifecycleCandidateHandoff?.deliveryAllowedEvidenceOnly === true &&
    confirmValidation.lifecycleCandidateHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    confirmValidation.lifecycleCandidateHandoff?.sourceConfirmedOutcomeReviewId === builder.sourceConfirmedOutcomeReviewId &&
    confirmValidation.lifecycleCandidateHandoff?.sourceConfirmedOutcomeSourceRunId === builder.sourceConfirmedOutcomeSourceRunId &&
    confirmValidation.lifecycleCandidateHandoff?.sourceRunId === builder.sourceRunId &&
    confirmValidation.locks?.lifecyclePromotionExecuted === false &&
    confirmValidation.locks?.ruleEnabled === false &&
    confirmValidation.locks?.packagingUnlocked === false,
  JSON.stringify(confirmValidation.lifecycleCandidateHandoff)
);

const mismatchReceipt = {
  ...template,
  teacherDecision: "report_mismatch_repair",
  reportReviewed: true,
  teacherNotes: "Report did not cover the missing offset logic."
};
const mismatchReceiptPath = writeJson(join(smokeRoot, "mismatch-report-receipt.json"), mismatchReceipt);
const mismatchValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs",
    "--report-packet",
    reportPacketPath,
    "--receipt",
    mismatchReceiptPath,
    "--out-dir",
    join(smokeRoot, "mismatch-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome Validation Report review routes mismatches to high reasoning repair",
  mismatchValidation.status === "confirmed_outcome_validation_report_review_routes_to_high_reasoning_repair" &&
    mismatchValidation.highReasoningRepairHandoff?.format === "transparent_ai_real_case_confirmed_outcome_validation_report_high_reasoning_repair_handoff_v1" &&
    mismatchValidation.highReasoningRepairHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    mismatchValidation.highReasoningRepairHandoff?.sourceConfirmedOutcomeReviewId === builder.sourceConfirmedOutcomeReviewId &&
    mismatchValidation.highReasoningRepairHandoff?.sourceConfirmedOutcomeSourceRunId === builder.sourceConfirmedOutcomeSourceRunId &&
    mismatchValidation.highReasoningRepairHandoff?.sourceRunId === builder.sourceRunId &&
    mismatchValidation.locks?.ruleEnabled === false,
  JSON.stringify(mismatchValidation.highReasoningRepairHandoff)
);

const sourceTamperReceipt = {
  ...confirmReceipt,
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
  sourceConfirmedOutcomeSourceRunId: "lost-confirmed-outcome-source-run-id"
};
const sourceTamperReceiptPath = writeJson(join(smokeRoot, "source-tamper-report-receipt.json"), sourceTamperReceipt);
const sourceTamperValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs",
    "--report-packet",
    reportPacketPath,
    "--receipt",
    sourceTamperReceiptPath,
    "--out-dir",
    join(smokeRoot, "source-tamper-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome Validation Report review blocks lost confirmed-outcome source continuity",
  sourceTamperValidation.ok === false &&
    sourceTamperValidation.status === "confirmed_outcome_validation_report_review_needs_teacher_review" &&
    sourceTamperValidation.blockers.some((row) => row.code === "receipt_source_review_format_mismatch") &&
    sourceTamperValidation.blockers.some((row) => row.code === "receipt_source_confirmed_outcome_source_run_id_mismatch") &&
    sourceTamperValidation.locks?.ruleEnabled === false &&
    sourceTamperValidation.locks?.packagingUnlocked === false,
  JSON.stringify(sourceTamperValidation.blockers)
);

const missingSourceRunPacket = {
  ...reportPacket,
  sourceConfirmedOutcomeSourceRunId: ""
};
const missingSourceRunPacketPath = writeJson(join(smokeRoot, "missing-source-run-report-packet.json"), missingSourceRunPacket);
const missingSourceRunValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs",
    "--report-packet",
    missingSourceRunPacketPath,
    "--receipt",
    confirmReceiptPath,
    "--out-dir",
    join(smokeRoot, "missing-source-run-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome Validation Report review blocks missing confirmed-outcome source run id",
  missingSourceRunValidation.ok === false &&
    missingSourceRunValidation.status === "confirmed_outcome_validation_report_review_needs_teacher_review" &&
    missingSourceRunValidation.blockers.some((row) => row.code === "source_ids_missing"),
  JSON.stringify(missingSourceRunValidation.blockers)
);

const forbiddenReceipt = { ...template, teacherDecision: "promote_rule", reportReviewed: true };
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-report-receipt.json"), forbiddenReceipt);
const forbiddenValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs",
    "--report-packet",
    reportPacketPath,
    "--receipt",
    forbiddenReceiptPath,
    "--out-dir",
    join(smokeRoot, "forbidden-validation")
  ]).stdout
);
check(
  "Real-case confirmed outcome Validation Report review blocks forbidden rule promotion decisions",
  forbiddenValidation.status === "blocked_for_forbidden_confirmed_outcome_validation_report_review_decision" &&
    forbiddenValidation.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.lifecyclePromotionExecuted === false,
  JSON.stringify(forbiddenValidation.blockers)
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_validation_report_review_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
