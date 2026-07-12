#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-disabled-package-validation-report");
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

function createReadyReviewValidation() {
  const artifactPath = writeJson(join(smokeRoot, "source-packaging-case.json"), {
    format: "real_case_disabled_report_source_v1",
    objects: [{ id: "glue-1", kind: "glue_tab", width_mm: 14 }]
  });
  const rollbackDir = join(smokeRoot, "rollback");
  mkdirSync(rollbackDir, { recursive: true });
  const intake = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-pilot-intake.mjs",
      "--goal",
      "Create disabled validation report for reviewed packaging logic.",
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
  const builder = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-rule-dsl-review-receipt-builder.mjs",
      "--package",
      prep.packagePath,
      "--out-dir",
      join(smokeRoot, "review-builder")
    ]).stdout
  );
  const reviewReceipt = readJson(builder.receiptTemplatePath);
  reviewReceipt.teacherDecision = "logic_matches";
  reviewReceipt.rollbackRetained = true;
  reviewReceipt.teacherConfirmedNoExecution = true;
  reviewReceipt.reviewedCandidateRows = reviewReceipt.reviewedCandidateRows.map((row) => ({
    ...row,
    logicFitDecision: "matches_intended_logic",
    teacherReviewed: true,
    evidenceReviewed: true,
    lifecycleConfirmedDraftDisabled: true,
    reviewerNote: "Matches intended logic for disabled report smoke."
  }));
  const reviewReceiptPath = writeJson(join(smokeRoot, "review-receipt.json"), reviewReceipt);
  const reviewValidation = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-rule-dsl-review-receipt.mjs",
      "--package",
      prep.packagePath,
      "--receipt",
      reviewReceiptPath,
      "--out-dir",
      join(smokeRoot, "review-validation")
    ]).stdout
  );
  return { reviewValidationPath: reviewValidation.validationPath, rollbackDir };
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const { reviewValidationPath } = createReadyReviewValidation();
const reportResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-disabled-package-validation-report.mjs",
    "--review-validation",
    reviewValidationPath,
    "--teacher-reviewed",
    "--out-dir",
    join(smokeRoot, "disabled-report")
  ]).stdout
);
const packet = readJson(reportResult.packetPath);
const validationReport = readJson(reportResult.validationReportPath);
check(
  "Real-case disabled package validation report compiles only draft_disabled rules",
  reportResult.status === "ready_for_teacher_real_case_validation_report_review" &&
    packet.summary.disabledRuleCount === 1 &&
    packet.summary.lifecycleSkippedRows === 1 &&
    packet.locks.disabledRulePackageCompiled === true &&
    packet.locks.activeRulePackageCompiled === false,
  JSON.stringify(packet.summary)
);
check(
  "Real-case disabled validation report keeps delivery allowed evidence-only without packaging unlock",
  validationReport.delivery_allowed === true &&
    validationReport.results.every((row) => row.status === "skipped" || row.rule_id === "artifact-envelope") &&
    packet.nextReview.deliveryAllowedIsEvidenceOnly === true &&
    packet.locks.ruleEnabled === false &&
    packet.locks.packagingUnlocked === false,
  JSON.stringify({ delivery_allowed: validationReport.delivery_allowed, locks: packet.locks })
);

const missingFlag = runNode(
  [
    "plugins/transparent-ai-apprentice/scripts/create-real-case-disabled-package-validation-report.mjs",
    "--review-validation",
    reviewValidationPath,
    "--out-dir",
    join(smokeRoot, "missing-flag")
  ],
  { expectOk: false }
);
check(
  "Real-case disabled validation report requires explicit teacher-reviewed flag",
  /REAL_CASE_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG/.test(missingFlag.stderr || missingFlag.stdout),
  (missingFlag.stderr || missingFlag.stdout).slice(0, 220)
);

const summary = {
  format: "transparent_ai_real_case_disabled_package_validation_report_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
