#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-validation-report-review-gate");
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

function createReportPacket() {
  const artifactPath = writeJson(join(smokeRoot, "source-packaging-case.json"), {
    format: "real_case_report_review_smoke_source_v1",
    objects: [{ id: "glue-1", kind: "glue_tab", width_mm: 14 }]
  });
  const rollbackDir = join(smokeRoot, "rollback");
  mkdirSync(rollbackDir, { recursive: true });
  const intake = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-pilot-intake.mjs",
      "--goal",
      "Review real-case validation report before any lifecycle candidate.",
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
  pilotReceipt.reviewedEvidenceRows = pilotReceipt.reviewedEvidenceRows.map((row) => ({ ...row, teacherReviewed: Boolean(row.present) }));
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
    reviewerNote: "Matches intended logic for report review smoke."
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
  return report.packetPath;
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const reportPacketPath = createReportPacket();
const builder = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-validation-report-review-receipt-builder.mjs",
    "--report-packet",
    reportPacketPath,
    "--out-dir",
    join(smokeRoot, "report-review-builder")
  ]).stdout
);
const template = readJson(builder.receiptTemplatePath);
check(
  "Real-case Validation Report review builder creates evidence-only receipt template",
  builder.format === "transparent_ai_real_case_validation_report_review_receipt_builder_result_v1" &&
    template.format === "transparent_ai_real_case_validation_report_review_receipt_v1" &&
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
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-validation-report-review-receipt.mjs",
    "--report-packet",
    reportPacketPath,
    "--receipt",
    confirmReceiptPath,
    "--out-dir",
    join(smokeRoot, "confirm-validation")
  ]).stdout
);
check(
  "Real-case Validation Report review prepares lifecycle candidate handoff without promotion",
  confirmValidation.status === "real_case_validation_report_review_ready_for_lifecycle_candidate_planning" &&
    confirmValidation.readyForLifecycleCandidate === true &&
    confirmValidation.lifecycleCandidateHandoff?.activePromotionAllowedHere === false &&
    confirmValidation.lifecycleCandidateHandoff?.deliveryAllowedEvidenceOnly === true &&
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
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-validation-report-review-receipt.mjs",
    "--report-packet",
    reportPacketPath,
    "--receipt",
    mismatchReceiptPath,
    "--out-dir",
    join(smokeRoot, "mismatch-validation")
  ]).stdout
);
check(
  "Real-case Validation Report review routes mismatches to high reasoning repair",
  mismatchValidation.status === "real_case_validation_report_review_routes_to_high_reasoning_repair" &&
    mismatchValidation.highReasoningRepairHandoff?.format === "transparent_ai_real_case_validation_report_high_reasoning_repair_handoff_v1" &&
    mismatchValidation.locks?.ruleEnabled === false,
  JSON.stringify(mismatchValidation.highReasoningRepairHandoff)
);

const forbiddenReceipt = { ...template, teacherDecision: "promote_rule", reportReviewed: true };
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-report-receipt.json"), forbiddenReceipt);
const forbiddenValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-validation-report-review-receipt.mjs",
    "--report-packet",
    reportPacketPath,
    "--receipt",
    forbiddenReceiptPath,
    "--out-dir",
    join(smokeRoot, "forbidden-validation")
  ]).stdout
);
check(
  "Real-case Validation Report review blocks forbidden rule promotion decisions",
  forbiddenValidation.status === "blocked_for_forbidden_real_case_validation_report_review_decision" &&
    forbiddenValidation.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.lifecyclePromotionExecuted === false,
  JSON.stringify(forbiddenValidation.blockers)
);

const summary = {
  format: "transparent_ai_real_case_validation_report_review_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
