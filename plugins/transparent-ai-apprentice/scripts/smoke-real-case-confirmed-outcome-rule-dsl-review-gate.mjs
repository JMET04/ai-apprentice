#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-rule-dsl-review-gate");
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

function createDraftPrepPackage() {
  const draftPrepSmoke = JSON.parse(
    runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs"]).stdout
  );
  if (draftPrepSmoke.status !== "passed") throw new Error("Draft prep smoke must pass before review gate smoke.");
  const packagePath = draftPrepSmoke.checks[0].evidence ? JSON.parse(draftPrepSmoke.checks[0].evidence).packagePath : "";
  if (!packagePath) throw new Error("Draft prep smoke did not expose packagePath.");
  return packagePath;
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const prepPackagePath = createDraftPrepPackage();
const prepPackage = readJson(prepPackagePath);
const builder = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/create-real-case-confirmed-outcome-rule-dsl-review-receipt-builder.mjs",
    "--package",
    prepPackagePath,
    "--out-dir",
    join(smokeRoot, "builder")
  ]).stdout
);
const template = readJson(builder.receiptTemplatePath);
check(
  "Confirmed outcome Rule DSL review builder creates teacher receipt template",
  builder.format === "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_receipt_builder_result_v1" &&
    template.format === "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_receipt_v1" &&
    template.confirmedOutcomeBranch === true &&
    template.sourceReviewFormat === expectedSourceReviewFormat &&
    template.sourceConfirmedOutcomeReviewId === prepPackage.sourceConfirmedOutcomeReviewId &&
    template.sourceConfirmedOutcomeSourceRunId === prepPackage.sourceConfirmedOutcomeSourceRunId &&
    template.sourceRunId === prepPackage.sourceRunId &&
    template.reviewedCandidateRows.length === 1 &&
    template.reviewedCandidateRows[0].sourceReviewFormat === expectedSourceReviewFormat &&
    template.reviewedCandidateRows[0].sourceConfirmedOutcomeReviewId === prepPackage.sourceConfirmedOutcomeReviewId &&
    template.reviewedCandidateRows[0].sourceConfirmedOutcomeSourceRunId === prepPackage.sourceConfirmedOutcomeSourceRunId &&
    template.forbiddenTeacherDecisions.includes("compile_active_package") &&
    template.forbiddenTeacherDecisions.includes("mutate_rule_registry"),
  JSON.stringify({ builderPath: builder.builderPath, receiptTemplatePath: builder.receiptTemplatePath })
);

const matchingReceipt = {
  ...template,
  teacherDecision: "logic_matches",
  rollbackRetained: true,
  teacherConfirmedNoExecution: true,
  teacherConfirmedNoRegistryMutation: true,
  teacherConfirmedNoRuleEnablement: true,
  teacherConfirmedNoRagAuthority: true,
  reviewedCandidateRows: template.reviewedCandidateRows.map((row) => ({
    ...row,
    logicFitDecision: "matches_intended_logic",
    teacherReviewed: true,
    evidenceReviewed: true,
    lifecycleConfirmedDraftDisabled: true,
    controlledOutputHashReviewed: true,
    reviewerNote: "The draft captures the confirmed controlled output evidence and stays disabled."
  })),
  teacherNotes: "Reviewed for disabled package planning only."
};
const matchingReceiptPath = writeJson(join(smokeRoot, "matching-review-receipt.json"), matchingReceipt);
const matchingValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    matchingReceiptPath,
    "--out-dir",
    join(smokeRoot, "matching-validation")
  ]).stdout
);
check(
  "Confirmed outcome Rule DSL review validation prepares disabled package planning only after logic match",
  matchingValidation.status === "confirmed_outcome_rule_dsl_review_ready_for_disabled_package_planning" &&
    matchingValidation.readyForDisabledPackagePlanning === true &&
    matchingValidation.disabledPackagePlanningHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_rule_dsl_disabled_package_planning_handoff_v1" &&
    matchingValidation.confirmedOutcomeBranch === true &&
    matchingValidation.sourceReviewFormat === expectedSourceReviewFormat &&
    matchingValidation.sourceConfirmedOutcomeReviewId === prepPackage.sourceConfirmedOutcomeReviewId &&
    matchingValidation.sourceConfirmedOutcomeSourceRunId === prepPackage.sourceConfirmedOutcomeSourceRunId &&
    matchingValidation.sourceRunId === prepPackage.sourceRunId &&
    matchingValidation.disabledPackagePlanningHandoff?.confirmedOutcomeBranch === true &&
    matchingValidation.disabledPackagePlanningHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    matchingValidation.disabledPackagePlanningHandoff?.sourceConfirmedOutcomeReviewId === prepPackage.sourceConfirmedOutcomeReviewId &&
    matchingValidation.disabledPackagePlanningHandoff?.sourceConfirmedOutcomeSourceRunId ===
      prepPackage.sourceConfirmedOutcomeSourceRunId &&
    matchingValidation.disabledPackagePlanningHandoff?.sourceRunId === prepPackage.sourceRunId &&
    matchingValidation.disabledPackagePlanningHandoff?.activePromotionAllowed === false &&
    matchingValidation.disabledPackagePlanningHandoff?.productionRegistryMutationAllowed === false &&
    matchingValidation.locks?.activeRulePackageCompiled === false &&
    matchingValidation.locks?.ruleEnabled === false &&
    matchingValidation.locks?.productionRuleRegistryMutated === false &&
    matchingValidation.locks?.targetSoftwareCommandsExecuted === false,
  JSON.stringify(matchingValidation.disabledPackagePlanningHandoff)
);

const mismatchReceipt = {
  ...template,
  teacherDecision: "logic_mismatch_repair",
  teacherConfirmedNoExecution: true,
  teacherConfirmedNoRegistryMutation: true,
  teacherConfirmedNoRuleEnablement: true,
  reviewedCandidateRows: template.reviewedCandidateRows.map((row) => ({
    ...row,
    logicFitDecision: "logic_mismatch_repair",
    teacherReviewed: true,
    reviewerNote: "The rule is too hash-bound and needs a more semantic condition."
  })),
  teacherNotes: "Repair the rule with high reasoning so it captures reusable logic, not just the output hash."
};
const mismatchReceiptPath = writeJson(join(smokeRoot, "mismatch-review-receipt.json"), mismatchReceipt);
const mismatchValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    mismatchReceiptPath,
    "--out-dir",
    join(smokeRoot, "mismatch-validation")
  ]).stdout
);
check(
  "Confirmed outcome Rule DSL review validation routes mismatches to high reasoning repair",
  mismatchValidation.status === "confirmed_outcome_rule_dsl_review_routes_to_high_reasoning_repair" &&
    mismatchValidation.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_rule_dsl_high_reasoning_repair_handoff_v1" &&
    mismatchValidation.highReasoningRepairHandoff?.confirmedOutcomeBranch === true &&
    mismatchValidation.highReasoningRepairHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    mismatchValidation.highReasoningRepairHandoff?.sourceConfirmedOutcomeReviewId === prepPackage.sourceConfirmedOutcomeReviewId &&
    mismatchValidation.highReasoningRepairHandoff?.sourceConfirmedOutcomeSourceRunId === prepPackage.sourceConfirmedOutcomeSourceRunId &&
    mismatchValidation.highReasoningRepairHandoff?.requiredReasoningTier === "high" &&
    mismatchValidation.locks?.ruleEnabled === false,
  JSON.stringify(mismatchValidation.highReasoningRepairHandoff)
);

const forbiddenReceipt = {
  ...template,
  teacherDecision: "compile_active_package",
  teacherConfirmedNoExecution: true,
  teacherConfirmedNoRegistryMutation: true,
  teacherConfirmedNoRuleEnablement: true
};
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-review-receipt.json"), forbiddenReceipt);
const forbiddenValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    forbiddenReceiptPath,
    "--out-dir",
    join(smokeRoot, "forbidden-validation")
  ]).stdout
);
check(
  "Confirmed outcome Rule DSL review validation blocks forbidden active compilation decisions",
  forbiddenValidation.status === "blocked_for_forbidden_confirmed_outcome_rule_dsl_review_decision" &&
    forbiddenValidation.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenValidation.locks?.activeRulePackageCompiled === false,
  JSON.stringify(forbiddenValidation.blockers)
);

const tamperedReceipt = {
  ...matchingReceipt,
  reviewedCandidateRows: matchingReceipt.reviewedCandidateRows.map((row) => ({
    ...row,
    candidateRuleHash: "tampered"
  }))
};
const tamperedReceiptPath = writeJson(join(smokeRoot, "tampered-review-receipt.json"), tamperedReceipt);
const tamperedValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    tamperedReceiptPath,
    "--out-dir",
    join(smokeRoot, "tampered-validation")
  ]).stdout
);
check(
  "Confirmed outcome Rule DSL review validation blocks candidate hash mismatch",
  tamperedValidation.status === "confirmed_outcome_rule_dsl_review_needs_teacher_review" &&
    tamperedValidation.blockers.some((row) => String(row.code).startsWith("candidate_hash_mismatch")),
  JSON.stringify(tamperedValidation.blockers)
);

const badSourceReceipt = {
  ...matchingReceipt,
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
  sourceConfirmedOutcomeReviewId: "lost-confirmed-outcome-review-id",
  sourceConfirmedOutcomeSourceRunId: "lost-confirmed-outcome-source-run-id",
  reviewedCandidateRows: matchingReceipt.reviewedCandidateRows.map((row) => ({
    ...row,
    sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
    sourceConfirmedOutcomeReviewId: "lost-confirmed-outcome-review-id",
    sourceConfirmedOutcomeSourceRunId: "lost-confirmed-outcome-source-run-id"
  }))
};
const badSourceReceiptPath = writeJson(join(smokeRoot, "bad-source-review-receipt.json"), badSourceReceipt);
const badSourceValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    badSourceReceiptPath,
    "--out-dir",
    join(smokeRoot, "bad-source-validation")
  ]).stdout
);
check(
  "Confirmed outcome Rule DSL review validation blocks lost confirmed-outcome source continuity",
  badSourceValidation.status === "confirmed_outcome_rule_dsl_review_needs_teacher_review" &&
    badSourceValidation.blockers.some((row) => row.code === "receipt_source_review_format_mismatch") &&
    badSourceValidation.blockers.some((row) => row.code === "receipt_confirmed_outcome_review_id_mismatch") &&
    badSourceValidation.blockers.some((row) => row.code === "receipt_confirmed_outcome_source_run_id_mismatch") &&
    badSourceValidation.blockers.some((row) => String(row.code).startsWith("candidate_receipt_source_review_format_mismatch")) &&
    badSourceValidation.blockers.some((row) => String(row.code).startsWith("candidate_receipt_confirmed_outcome_source_run_id_mismatch")),
  JSON.stringify(badSourceValidation.blockers)
);

const missingSourceRunPackage = {
  ...prepPackage,
  sourceConfirmedOutcomeSourceRunId: "",
  candidateRows: prepPackage.candidateRows.map((row) => ({
    ...row,
    sourceConfirmedOutcomeSourceRunId: ""
  }))
};
const missingSourceRunPackagePath = writeJson(join(smokeRoot, "missing-source-run-prep-package.json"), missingSourceRunPackage);
const missingSourceRunValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
    "--package",
    missingSourceRunPackagePath,
    "--receipt",
    matchingReceiptPath,
    "--out-dir",
    join(smokeRoot, "missing-source-run-validation")
  ]).stdout
);
check(
  "Confirmed outcome Rule DSL review validation blocks missing confirmed-outcome source run id",
  missingSourceRunValidation.status === "confirmed_outcome_rule_dsl_review_needs_teacher_review" &&
    missingSourceRunValidation.blockers.some((row) => row.code === "source_package_confirmed_outcome_source_run_id_missing") &&
    missingSourceRunValidation.blockers.some((row) => String(row.code).startsWith("candidate_confirmed_outcome_source_run_id_missing")),
  JSON.stringify(missingSourceRunValidation.blockers)
);

const incompleteReceipt = {
  ...matchingReceipt,
  rollbackRetained: false,
  teacherConfirmedNoRuleEnablement: false,
  reviewedCandidateRows: matchingReceipt.reviewedCandidateRows.map((row) => ({
    ...row,
    controlledOutputHashReviewed: false
  }))
};
const incompleteReceiptPath = writeJson(join(smokeRoot, "incomplete-review-receipt.json"), incompleteReceipt);
const incompleteValidation = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs",
    "--package",
    prepPackagePath,
    "--receipt",
    incompleteReceiptPath,
    "--out-dir",
    join(smokeRoot, "incomplete-validation")
  ]).stdout
);
check(
  "Confirmed outcome Rule DSL review validation blocks incomplete teacher confirmations",
  incompleteValidation.status === "confirmed_outcome_rule_dsl_review_needs_teacher_review" &&
    incompleteValidation.blockers.some((row) => row.code === "rollback_not_retained") &&
    incompleteValidation.blockers.some((row) => row.code === "no_rule_enablement_not_confirmed") &&
    incompleteValidation.blockers.some((row) => String(row.code).startsWith("controlled_output_hash_not_reviewed")),
  JSON.stringify(incompleteValidation.blockers)
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
