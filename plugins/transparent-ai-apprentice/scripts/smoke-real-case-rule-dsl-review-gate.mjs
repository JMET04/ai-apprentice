#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-rule-dsl-review-gate");
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

function createPrepPackage() {
  const artifactPath = writeJson(join(smokeRoot, "source-packaging-case.json"), {
    format: "real_case_rule_review_smoke_source_v1",
    objects: [{ id: "glue-1", kind: "glue_tab", width_mm: 14 }]
  });
  const rollbackDir = join(smokeRoot, "rollback");
  mkdirSync(rollbackDir, { recursive: true });
  const intake = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/create-real-case-pilot-intake.mjs",
      "--goal",
      "Review packaging rule logic before any similar output generation.",
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
  const receipt = readJson(intake.receiptTemplatePath);
  receipt.teacherDecision = "pilot_route_selected_for_manual_preparation";
  receipt.selectedRoute = "prepare_universal_detail_logic";
  receipt.selectedRouteReviewed = true;
  receipt.rollbackRetained = true;
  receipt.teacherConfirmedNoExecution = true;
  receipt.reviewedEvidenceRows = receipt.reviewedEvidenceRows.map((row) => ({ ...row, teacherReviewed: Boolean(row.present) }));
  const receiptPath = writeJson(join(smokeRoot, "pilot-receipt.json"), receipt);
  const pilotValidation = JSON.parse(
    runNode([
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-pilot-intake-receipt.mjs",
      "--intake",
      intake.intakePath,
      "--receipt",
      receiptPath,
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
  return prep.packagePath;
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const prepPackagePath = createPrepPackage();
const builder = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-rule-dsl-review-receipt-builder.mjs",
    "--package",
    prepPackagePath,
    "--out-dir",
    join(smokeRoot, "builder")
  ]).stdout
);
const template = readJson(builder.receiptTemplatePath);
check(
  "Real-case Rule DSL review builder creates teacher receipt template",
  builder.format === "transparent_ai_real_case_rule_dsl_review_receipt_builder_result_v1" &&
    template.format === "transparent_ai_real_case_rule_dsl_review_receipt_v1" &&
    template.reviewedCandidateRows.length === 1 &&
    template.forbiddenTeacherDecisions.includes("compile_active_package"),
  JSON.stringify({ builderPath: builder.builderPath, receiptTemplatePath: builder.receiptTemplatePath })
);

const matchingReceipt = {
  ...template,
  teacherDecision: "logic_matches",
  rollbackRetained: true,
  teacherConfirmedNoExecution: true,
  reviewedCandidateRows: template.reviewedCandidateRows.map((row) => ({
    ...row,
    logicFitDecision: "matches_intended_logic",
    teacherReviewed: true,
    evidenceReviewed: true,
    lifecycleConfirmedDraftDisabled: true,
    reviewerNote: "The candidate captures the intended glue tab production logic."
  })),
  teacherNotes: "Reviewed for disabled package planning only."
};
const matchingReceiptPath = writeJson(join(smokeRoot, "matching-review-receipt.json"), matchingReceipt);
const matchingValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    matchingReceiptPath,
    "--out-dir",
    join(smokeRoot, "matching-validation")
  ]).stdout
);
check(
  "Real-case Rule DSL review validation prepares disabled package planning only after logic match",
  matchingValidation.status === "real_case_rule_dsl_review_ready_for_disabled_package_planning" &&
    matchingValidation.readyForDisabledPackagePlanning === true &&
    matchingValidation.disabledPackagePlanningHandoff?.activePromotionAllowed === false &&
    matchingValidation.locks?.activeRulePackageCompiled === false &&
    matchingValidation.locks?.ruleEnabled === false &&
    matchingValidation.locks?.targetSoftwareCommandsExecuted === false,
  JSON.stringify(matchingValidation.disabledPackagePlanningHandoff)
);

const mismatchReceipt = {
  ...template,
  teacherDecision: "logic_mismatch_repair",
  teacherConfirmedNoExecution: true,
  reviewedCandidateRows: template.reviewedCandidateRows.map((row) => ({
    ...row,
    logicFitDecision: "logic_mismatch_repair",
    teacherReviewed: true,
    reviewerNote: "The rule missed an offset relationship."
  })),
  teacherNotes: "Repair the missing offset relationship with high reasoning."
};
const mismatchReceiptPath = writeJson(join(smokeRoot, "mismatch-review-receipt.json"), mismatchReceipt);
const mismatchValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    mismatchReceiptPath,
    "--out-dir",
    join(smokeRoot, "mismatch-validation")
  ]).stdout
);
check(
  "Real-case Rule DSL review validation routes mismatches to high reasoning repair",
  mismatchValidation.status === "real_case_rule_dsl_review_routes_to_high_reasoning_repair" &&
    mismatchValidation.highReasoningRepairHandoff?.format === "transparent_ai_real_case_rule_dsl_high_reasoning_repair_handoff_v1" &&
    mismatchValidation.locks?.ruleEnabled === false,
  JSON.stringify(mismatchValidation.highReasoningRepairHandoff)
);

const forbiddenReceipt = { ...template, teacherDecision: "compile_active_package", teacherConfirmedNoExecution: true };
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-review-receipt.json"), forbiddenReceipt);
const forbiddenValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    forbiddenReceiptPath,
    "--out-dir",
    join(smokeRoot, "forbidden-validation")
  ]).stdout
);
check(
  "Real-case Rule DSL review validation blocks forbidden active compilation decisions",
  forbiddenValidation.status === "blocked_for_forbidden_real_case_rule_dsl_review_decision" &&
    forbiddenValidation.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.activeRulePackageCompiled === false,
  JSON.stringify(forbiddenValidation.blockers)
);

const summary = {
  format: "transparent_ai_real_case_rule_dsl_review_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
