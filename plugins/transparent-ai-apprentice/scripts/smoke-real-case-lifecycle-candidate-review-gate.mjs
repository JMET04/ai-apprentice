#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-lifecycle-candidate-review-gate");
mkdirSync(smokeRoot, { recursive: true });

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
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
  const artifactPath = writeJson(join(smokeRoot, "source-packaging-case.json"), {
    format: "real_case_lifecycle_candidate_smoke_source_v1",
    objects: [{ id: "glue-1", kind: "glue_tab", width_mm: 14 }]
  });
  const rollbackDir = join(smokeRoot, "rollback");
  mkdirSync(rollbackDir, { recursive: true });
  const intake = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-pilot-intake.mjs",
      "--goal",
      "Review real-case lifecycle candidate before review-only planning.",
      "--case-type",
      "packaging_box",
      "--software",
      "draw.io",
      "--artifact",
      artifactPath,
      "--knowledge-source",
      "local packaging production note",
      "--constraint",
      "Glue tab width must follow board thickness and production minimum.",
      "--rollback-point",
      rollbackDir,
      "--out-dir",
      join(smokeRoot, "intake")
    ]).stdout
  );
  const pilotReceipt = readJson(intake.receiptTemplatePath);
  pilotReceipt.teacherDecision = "pilot_route_selected_for_manual_preparation";
  pilotReceipt.selectedRoute = "prepare_universal_detail_logic";
  pilotReceipt.selectedRouteReviewed = true;
  pilotReceipt.rollbackRetained = true;
  pilotReceipt.teacherConfirmedNoExecution = true;
  pilotReceipt.reviewedEvidenceRows = pilotReceipt.reviewedEvidenceRows.map((row) => ({
    ...row,
    teacherReviewed: Boolean(row.present)
  }));
  const pilotReceiptPath = writeJson(join(smokeRoot, "pilot-receipt.json"), pilotReceipt);
  const pilotValidation = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-pilot-intake-receipt.mjs",
      "--intake",
      intake.intakePath,
      "--receipt",
      pilotReceiptPath,
      "--out-dir",
      join(smokeRoot, "pilot-validation")
    ]).stdout
  );
  const prep = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-rule-dsl-preparation-package.mjs",
      "--pilot-validation",
      pilotValidation.validationPath,
      "--teacher-reviewed",
      "--out-dir",
      join(smokeRoot, "prep")
    ]).stdout
  );
  const ruleReviewBuilder = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-rule-dsl-review-receipt-builder.mjs",
      "--package",
      prep.packagePath,
      "--out-dir",
      join(smokeRoot, "rule-review-builder")
    ]).stdout
  );
  const ruleReviewReceipt = readJson(ruleReviewBuilder.receiptTemplatePath);
  ruleReviewReceipt.teacherDecision = "logic_matches";
  ruleReviewReceipt.rollbackRetained = true;
  ruleReviewReceipt.teacherConfirmedNoExecution = true;
  ruleReviewReceipt.reviewedCandidateRows = ruleReviewReceipt.reviewedCandidateRows.map((row) => ({
    ...row,
    logicFitDecision: "matches_intended_logic",
    teacherReviewed: true,
    evidenceReviewed: true,
    lifecycleConfirmedDraftDisabled: true,
    reviewerNote: "Matches intended logic for lifecycle candidate smoke."
  }));
  const ruleReviewReceiptPath = writeJson(join(smokeRoot, "rule-review-receipt.json"), ruleReviewReceipt);
  const ruleReviewValidation = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-rule-dsl-review-receipt.mjs",
      "--package",
      prep.packagePath,
      "--receipt",
      ruleReviewReceiptPath,
      "--out-dir",
      join(smokeRoot, "rule-review-validation")
    ]).stdout
  );
  const report = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-disabled-package-validation-report.mjs",
      "--review-validation",
      ruleReviewValidation.validationPath,
      "--teacher-reviewed",
      "--out-dir",
      join(smokeRoot, "disabled-report")
    ]).stdout
  );
  const reportReviewBuilder = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-validation-report-review-receipt-builder.mjs",
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
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-validation-report-review-receipt.mjs",
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
const builder = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-lifecycle-candidate-review-receipt-builder.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--out-dir",
    join(smokeRoot, "lifecycle-candidate-builder")
  ]).stdout
);
const template = readJson(builder.receiptTemplatePath);
check(
  "Real-case lifecycle candidate review builder creates review-only receipt template",
  builder.format === "transparent_ai_real_case_lifecycle_candidate_review_receipt_builder_result_v1" &&
    builder.status === "ready_for_teacher_real_case_lifecycle_candidate_review" &&
    template.format === "transparent_ai_real_case_lifecycle_candidate_review_receipt_v1" &&
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
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-lifecycle-candidate-review-receipt.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--receipt",
    approveReceiptPath,
    "--out-dir",
    join(smokeRoot, "approve-validation")
  ]).stdout
);
check(
  "Real-case lifecycle candidate review prepares review-only package planning without active promotion",
  approveValidation.status === "real_case_lifecycle_candidate_review_ready_for_review_only_package_planning" &&
    approveValidation.readyForReviewOnlyPlanning === true &&
    approveValidation.reviewOnlyPackagePlanningHandoff?.format ===
      "transparent_ai_real_case_review_only_lifecycle_candidate_handoff_v1" &&
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
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-lifecycle-candidate-review-receipt.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair-validation")
  ]).stdout
);
check(
  "Real-case lifecycle candidate review routes corrections to high reasoning repair",
  repairValidation.status === "real_case_lifecycle_candidate_review_routes_to_high_reasoning_repair" &&
    repairValidation.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_lifecycle_candidate_high_reasoning_repair_handoff_v1" &&
    repairValidation.locks?.ruleEnabled === false,
  JSON.stringify(repairValidation.highReasoningRepairHandoff)
);

const forbiddenReceipt = { ...template, teacherDecision: "activate_rule", lifecycleCandidateReviewed: true };
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-lifecycle-candidate-receipt.json"), forbiddenReceipt);
const forbiddenValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-lifecycle-candidate-review-receipt.mjs",
    "--review-validation",
    reportReviewValidationPath,
    "--receipt",
    forbiddenReceiptPath,
    "--out-dir",
    join(smokeRoot, "forbidden-validation")
  ]).stdout
);
check(
  "Real-case lifecycle candidate review blocks active rule activation decisions",
  forbiddenValidation.status === "blocked_for_forbidden_real_case_lifecycle_candidate_review_decision" &&
    forbiddenValidation.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.activePromotionAllowed === false,
  JSON.stringify(forbiddenValidation.blockers)
);

const summary = {
  format: "transparent_ai_real_case_lifecycle_candidate_review_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
