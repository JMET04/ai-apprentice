#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-disabled-package-validation-report");
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";
mkdirSync(smokeRoot, { recursive: true });

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

function latestReadyReviewValidationPath() {
  const reviewSmoke = JSON.parse(
    runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-rule-dsl-review-gate.mjs"]).stdout
  );
  const readyCheck = reviewSmoke.checks.find((row) =>
    String(row.name).includes("prepares disabled package planning only after logic match")
  );
  if (!readyCheck) throw new Error("READY_CONFIRMED_OUTCOME_REVIEW_VALIDATION_CHECK_NOT_FOUND");
  const evidence = JSON.parse(readyCheck.evidence);
  const sourcePackagePath = evidence.sourceRuleDraftPackagePath;
  const reviewValidationDir = join(
    smokeRoot,
    "review-validation-ready"
  );
  mkdirSync(reviewValidationDir, { recursive: true });
  const reviewBuilder = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-review-receipt-builder.mjs",
      "--package",
      sourcePackagePath,
      "--out-dir",
      join(smokeRoot, "review-builder")
    ]).stdout
  );
  const receipt = readJson(reviewBuilder.receiptTemplatePath);
  receipt.teacherDecision = "logic_matches";
  receipt.rollbackRetained = true;
  receipt.teacherConfirmedNoExecution = true;
  receipt.teacherConfirmedNoRegistryMutation = true;
  receipt.teacherConfirmedNoRuleEnablement = true;
  receipt.teacherConfirmedNoRagAuthority = true;
  receipt.reviewedCandidateRows = receipt.reviewedCandidateRows.map((row) => ({
    ...row,
    logicFitDecision: "matches_intended_logic",
    teacherReviewed: true,
    evidenceReviewed: true,
    lifecycleConfirmedDraftDisabled: true,
    controlledOutputHashReviewed: true,
    reviewerNote: "Confirmed-outcome disabled report smoke confirms draft logic as evidence-only."
  }));
  const receiptPath = writeJson(join(smokeRoot, "ready-review-receipt.json"), receipt);
  const validation = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
      "--package",
      sourcePackagePath,
      "--receipt",
      receiptPath,
      "--out-dir",
      reviewValidationDir
    ]).stdout
  );
  return validation.validationPath;
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const reviewValidationPath = latestReadyReviewValidationPath();
const reviewValidation = readJson(reviewValidationPath);
const reportResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-disabled-package-validation-report.mjs",
    "--review-validation",
    reviewValidationPath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "disabled-report")
  ]).stdout
);
const packet = readJson(reportResult.packetPath);
const validationReport = readJson(reportResult.validationReportPath);
const artifact = readJson(packet.artifactPath);
check(
  "Confirmed outcome disabled package validation report compiles only draft_disabled rules",
  reportResult.status === "ready_for_teacher_confirmed_outcome_validation_report_review" &&
    packet.format === "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_v1" &&
    packet.confirmedOutcomeBranch === true &&
    packet.sourceReviewFormat === expectedSourceReviewFormat &&
    packet.sourceConfirmedOutcomeReviewId === reviewValidation.sourceConfirmedOutcomeReviewId &&
    packet.sourceConfirmedOutcomeSourceRunId === reviewValidation.sourceConfirmedOutcomeSourceRunId &&
    packet.sourceRunId === reviewValidation.sourceRunId &&
    reportResult.sourceReviewFormat === expectedSourceReviewFormat &&
    reportResult.sourceConfirmedOutcomeReviewId === reviewValidation.sourceConfirmedOutcomeReviewId &&
    reportResult.sourceConfirmedOutcomeSourceRunId === reviewValidation.sourceConfirmedOutcomeSourceRunId &&
    reportResult.sourceRunId === reviewValidation.sourceRunId &&
    artifact.context?.confirmed_outcome_branch === true &&
    artifact.context?.source_review_format === expectedSourceReviewFormat &&
    artifact.context?.source_confirmed_outcome_review_id === reviewValidation.sourceConfirmedOutcomeReviewId &&
    artifact.context?.source_confirmed_outcome_source_run_id === reviewValidation.sourceConfirmedOutcomeSourceRunId &&
    artifact.context?.source_run_id === reviewValidation.sourceRunId &&
    artifact.source_refs.some((ref) => String(ref).startsWith("confirmed_outcome_review://")) &&
    artifact.source_refs.some((ref) => String(ref).startsWith("confirmed_outcome_source_run://")) &&
    packet.summary.disabledRuleCount === 1 &&
    packet.summary.lifecycleSkippedRows === 1 &&
    packet.locks.disabledRulePackageCompiled === true &&
    packet.locks.activeRulePackageCompiled === false &&
    packet.locks.productionRuleRegistryMutated === false,
  JSON.stringify(packet.summary)
);
check(
  "Confirmed outcome disabled validation report keeps delivery allowed evidence-only without packaging unlock",
  validationReport.delivery_allowed === true &&
    validationReport.results.every((row) => row.status === "skipped" || row.rule_id === "artifact-envelope") &&
    packet.nextReview.deliveryAllowedIsEvidenceOnly === true &&
    packet.locks.ruleEnabled === false &&
    packet.locks.targetSoftwareCommandsExecuted === false &&
    packet.locks.packagingUnlocked === false &&
    packet.locks.goalComplete === false,
  JSON.stringify({ delivery_allowed: validationReport.delivery_allowed, locks: packet.locks })
);

const missingFlag = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-disabled-package-validation-report.mjs",
    "--review-validation",
    reviewValidationPath,
    "--out-dir",
    join(smokeRoot, "missing-flag")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome disabled validation report requires explicit teacher-reviewed flag",
  /CONFIRMED_OUTCOME_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG/.test(
    missingFlag.stderr || missingFlag.stdout
  ),
  (missingFlag.stderr || missingFlag.stdout).slice(0, 220)
);

const nonReady = readJson(reviewValidationPath);
nonReady.status = "confirmed_outcome_rule_dsl_review_needs_teacher_review";
nonReady.readyForDisabledPackagePlanning = false;
const nonReadyPath = writeJson(join(smokeRoot, "non-ready-review-validation.json"), nonReady);
const nonReadyRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-disabled-package-validation-report.mjs",
    "--review-validation",
    nonReadyPath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "non-ready")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome disabled validation report rejects non-ready review validations",
  /not a locked handoff for disabled package validation reporting/.test(nonReadyRun.stderr || nonReadyRun.stdout),
  (nonReadyRun.stderr || nonReadyRun.stdout).slice(0, 220)
);

const badSource = readJson(reviewValidationPath);
badSource.sourceReviewFormat = "transparent_ai_real_case_unconfirmed_outcome_review_v1";
badSource.sourceConfirmedOutcomeSourceRunId = "lost-confirmed-outcome-source-run-id";
badSource.disabledPackagePlanningHandoff.sourceReviewFormat = "transparent_ai_real_case_unconfirmed_outcome_review_v1";
badSource.disabledPackagePlanningHandoff.sourceConfirmedOutcomeSourceRunId = "lost-confirmed-outcome-source-run-id";
const badSourcePath = writeJson(join(smokeRoot, "bad-source-review-validation.json"), badSource);
const badSourceRun = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-disabled-package-validation-report.mjs",
    "--review-validation",
    badSourcePath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "bad-source")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome disabled validation report blocks lost confirmed-outcome source continuity",
  /CONFIRMED_OUTCOME_DISABLED_REPORT_REVIEW_VALIDATION_SOURCE_FORMAT_MISMATCH/.test(
    badSourceRun.stderr || badSourceRun.stdout
  ),
  (badSourceRun.stderr || badSourceRun.stdout).slice(0, 220)
);

const missingConfirmedSourceRun = readJson(reviewValidationPath);
missingConfirmedSourceRun.sourceConfirmedOutcomeSourceRunId = "";
missingConfirmedSourceRun.disabledPackagePlanningHandoff.sourceConfirmedOutcomeSourceRunId = "";
const missingConfirmedSourceRunPath = writeJson(join(smokeRoot, "missing-confirmed-source-run-review-validation.json"), missingConfirmedSourceRun);
const missingConfirmedSourceRunResult = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-disabled-package-validation-report.mjs",
    "--review-validation",
    missingConfirmedSourceRunPath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "missing-confirmed-source-run")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome disabled validation report blocks missing confirmed-outcome source run id",
  /CONFIRMED_OUTCOME_DISABLED_REPORT_CONFIRMED_SOURCE_RUN_ID_MISSING/.test(
    missingConfirmedSourceRunResult.stderr || missingConfirmedSourceRunResult.stdout
  ),
  (missingConfirmedSourceRunResult.stderr || missingConfirmedSourceRunResult.stdout).slice(0, 220)
);

const badHandoffSourceRun = readJson(reviewValidationPath);
badHandoffSourceRun.disabledPackagePlanningHandoff.sourceRunId = "wrong-source-run-id";
const badHandoffSourceRunPath = writeJson(join(smokeRoot, "bad-source-run-review-validation.json"), badHandoffSourceRun);
const badHandoffSourceRunResult = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-disabled-package-validation-report.mjs",
    "--review-validation",
    badHandoffSourceRunPath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "bad-source-run")
  ],
  { expectOk: false }
);
check(
  "Confirmed outcome disabled validation report blocks handoff sourceRunId mismatch",
  /CONFIRMED_OUTCOME_DISABLED_REPORT_HANDOFF_RUN_ID_MISMATCH/.test(
    badHandoffSourceRunResult.stderr || badHandoffSourceRunResult.stdout
  ),
  (badHandoffSourceRunResult.stderr || badHandoffSourceRunResult.stdout).slice(0, 220)
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
