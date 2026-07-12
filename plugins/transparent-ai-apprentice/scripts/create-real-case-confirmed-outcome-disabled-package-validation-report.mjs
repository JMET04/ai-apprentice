#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateRulePackage } from "./rules/evaluate-rule-package.mjs";
import { hashText, readJson, stableId, writeJson } from "./knowledge/knowledge-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function locks({ disabledRulePackageCompiled = false } = {}) {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    disabledRulePackageCompiled,
    activeRulePackageCompiled: false,
    sourceRuleFilesModified: false,
    productionRuleRegistryMutated: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    ragEvidenceTreatedAsAuthority: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    externalFetchPerformed: false,
    shellCommandExecuted: false,
    packagingGated: true,
    packagingUnlocked: false,
    goalComplete: false
  };
}

function readOptionalJson(path) {
  return path && existsSync(path) ? readJson(path) : null;
}

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

const reviewValidationPath = resolve(argValue("--review-validation", argValue("--validation", "")));
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-disabled-package-validation-reports")
  )
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!reviewValidationPath) {
  throw new Error(
    "Usage: node create-real-case-confirmed-outcome-disabled-package-validation-report.mjs --review-validation <confirmed-outcome-rule-dsl-review-validation.json> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!existsSync(reviewValidationPath)) {
  throw new Error(`CONFIRMED_OUTCOME_RULE_DSL_REVIEW_VALIDATION_NOT_FOUND: ${reviewValidationPath}`);
}
if (!teacherReviewed) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG");
}

const reviewValidation = readJson(reviewValidationPath);
if (reviewValidation.format !== "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_validation_v1") {
  throw new Error("Expected transparent_ai_real_case_confirmed_outcome_rule_dsl_review_validation_v1.");
}
if (
  reviewValidation.status !== "confirmed_outcome_rule_dsl_review_ready_for_disabled_package_planning" ||
  reviewValidation.readyForDisabledPackagePlanning !== true ||
  !reviewValidation.disabledPackagePlanningHandoff ||
  reviewValidation.locks?.ruleEnabled !== false ||
  reviewValidation.locks?.activeRulePackageCompiled !== false ||
  reviewValidation.locks?.productionRuleRegistryMutated !== false ||
  reviewValidation.locks?.targetSoftwareCommandsExecuted !== false ||
  reviewValidation.locks?.packagingUnlocked !== false
) {
  throw new Error("Confirmed-outcome review validation is not a locked handoff for disabled package validation reporting.");
}
if (reviewValidation.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_REVIEW_VALIDATION_BRANCH_MISSING");
}
if (reviewValidation.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_REVIEW_VALIDATION_SOURCE_FORMAT_MISMATCH");
}
if (!reviewValidation.sourceConfirmedOutcomeReviewId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_REVIEW_ID_MISSING");
}
if (!reviewValidation.sourceConfirmedOutcomeSourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_CONFIRMED_SOURCE_RUN_ID_MISSING");
}
if (!reviewValidation.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_SOURCE_RUN_ID_MISSING");
}

const handoff = reviewValidation.disabledPackagePlanningHandoff;
if (
  handoff.format !== "transparent_ai_real_case_confirmed_outcome_rule_dsl_disabled_package_planning_handoff_v1" ||
  handoff.activePromotionAllowed !== false ||
  handoff.productionRegistryMutationAllowed !== false ||
  handoff.executeNow !== false ||
  handoff.reviewOnly !== true
) {
  throw new Error("Confirmed-outcome disabled package planning handoff must keep active promotion, registry mutation, and execution disabled.");
}
if (handoff.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_HANDOFF_BRANCH_MISSING");
}
if (handoff.sourceReviewFormat !== reviewValidation.sourceReviewFormat) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_HANDOFF_SOURCE_FORMAT_MISMATCH");
}
if (handoff.sourceConfirmedOutcomeReviewId !== reviewValidation.sourceConfirmedOutcomeReviewId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_HANDOFF_REVIEW_ID_MISMATCH");
}
if (handoff.sourceConfirmedOutcomeSourceRunId !== reviewValidation.sourceConfirmedOutcomeSourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_HANDOFF_CONFIRMED_SOURCE_RUN_ID_MISMATCH");
}
if (handoff.sourceRunId !== reviewValidation.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_HANDOFF_RUN_ID_MISMATCH");
}
const ruleDir = resolve(handoff.ruleDir || "");
if (!ruleDir || !existsSync(ruleDir)) {
  throw new Error(`CONFIRMED_OUTCOME_DRAFT_DISABLED_RULE_DIR_NOT_FOUND: ${handoff.ruleDir || ""}`);
}

const sourcePrep = readOptionalJson(reviewValidation.paths?.sourcePackage || handoff.sourceRuleDraftPackagePath || "");
if (sourcePrep && sourcePrep.format !== "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_v1") {
  throw new Error("Confirmed-outcome source package must be a draft preparation package.");
}
if (!sourcePrep) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_SOURCE_DRAFT_PACKAGE_REQUIRED");
}
if (sourcePrep.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_SOURCE_PACKAGE_BRANCH_MISSING");
}
if (sourcePrep.sourceReviewFormat !== reviewValidation.sourceReviewFormat) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_SOURCE_PACKAGE_FORMAT_MISMATCH");
}
if (sourcePrep.sourceConfirmedOutcomeReviewId !== reviewValidation.sourceConfirmedOutcomeReviewId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_SOURCE_PACKAGE_REVIEW_ID_MISMATCH");
}
if (sourcePrep.sourceConfirmedOutcomeSourceRunId !== reviewValidation.sourceConfirmedOutcomeSourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_SOURCE_PACKAGE_CONFIRMED_SOURCE_RUN_ID_MISMATCH");
}
if (sourcePrep.sourceRunId !== reviewValidation.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_SOURCE_PACKAGE_RUN_ID_MISMATCH");
}
const sourceLifecycleGate = readOptionalJson(sourcePrep?.sourceLifecycleGatePath || handoff.sourceLifecycleGatePath || "");
const rollbackPoint =
  sourceLifecycleGate?.ruleDslDraftPlanningHandoff?.rollbackPoint ||
  sourceLifecycleGate?.rollbackPoint ||
  argValue("--rollback-point", "");
if (!rollbackPoint || !existsSync(rollbackPoint)) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_REQUIRES_RETAINED_ROLLBACK_POINT");
}

const reportId = stableId("confirmed_outcome_disabled_package_validation_report", `${reviewValidationPath}:${ruleDir}`);
const reportDir = join(outRoot, reportId);
const compileOutDir = join(reportDir, "compiled-disabled-rule-package");
mkdirSync(reportDir, { recursive: true });

const compileArgs = [
  join(pluginRoot, "scripts", "rules", "compile-rule-package.mjs"),
  "--rules",
  ruleDir,
  "--package-id",
  `${handoff.packageId}.disabled_review`,
  "--out-dir",
  compileOutDir
];
const compileRun = spawnSync(process.execPath, compileArgs, { cwd: repoRoot, encoding: "utf8" });
if (compileRun.status !== 0) {
  throw new Error(`compile-rule-package.mjs failed:\nSTDOUT:\n${compileRun.stdout}\nSTDERR:\n${compileRun.stderr}`);
}
const compileResult = JSON.parse(compileRun.stdout);
const compiledRulePackage = readJson(compileResult.packagePath);
const activeRules = (compiledRulePackage.rules || []).filter((rule) => rule.lifecycle === "active");
const nonDisabledRules = (compiledRulePackage.rules || []).filter((rule) => rule.lifecycle !== "draft_disabled");
if (activeRules.length) throw new Error("CONFIRMED_OUTCOME_DISABLED_PACKAGE_CONTAINS_ACTIVE_RULES");
if (nonDisabledRules.length) throw new Error("CONFIRMED_OUTCOME_DISABLED_PACKAGE_CONTAINS_NON_DRAFT_DISABLED_RULES");

const firstCandidate = Array.isArray(sourcePrep?.candidateRows) ? sourcePrep.candidateRows[0] : null;
if (firstCandidate?.sourceReviewFormat !== reviewValidation.sourceReviewFormat) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_CANDIDATE_SOURCE_FORMAT_MISMATCH");
}
if (firstCandidate?.sourceConfirmedOutcomeReviewId !== reviewValidation.sourceConfirmedOutcomeReviewId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_CANDIDATE_REVIEW_ID_MISMATCH");
}
if (firstCandidate?.sourceConfirmedOutcomeSourceRunId !== reviewValidation.sourceConfirmedOutcomeSourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_CANDIDATE_CONFIRMED_SOURCE_RUN_ID_MISMATCH");
}
if (firstCandidate?.sourceRunId !== reviewValidation.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_REPORT_CANDIDATE_RUN_ID_MISMATCH");
}
const sourceContext = {
  confirmedOutcomeBranch: reviewValidation.confirmedOutcomeBranch === true,
  sourceReviewFormat: reviewValidation.sourceReviewFormat || "",
  sourceConfirmedOutcomeReviewId: reviewValidation.sourceConfirmedOutcomeReviewId || "",
  sourceConfirmedOutcomeSourceRunId: reviewValidation.sourceConfirmedOutcomeSourceRunId || "",
  sourceRunId: reviewValidation.sourceRunId || ""
};
const artifactPath = join(reportDir, "confirmed-outcome-review-only-artifact.json");
const validationReportPath = join(reportDir, "confirmed-outcome-disabled-package-validation-report.json");
const artifact = {
  artifact_id: `${reportId}.artifact`,
  artifact_type: "confirmed_real_case_outcome",
  schema_version: "0.1",
  units: "review_only",
  created_at: new Date().toISOString(),
  source_refs: [
    `confirmed_outcome_review://${sourceContext.sourceConfirmedOutcomeReviewId}`,
    `confirmed_outcome_source_run://${sourceContext.sourceConfirmedOutcomeSourceRunId}`,
    `current_review_source_run://${sourceContext.sourceRunId}`,
    reviewValidationPath,
    reviewValidation.paths?.sourcePackage || handoff.sourceRuleDraftPackagePath || "",
    sourcePrep?.sourceLifecycleGatePath || handoff.sourceLifecycleGatePath || "",
    ...(Array.isArray(firstCandidate?.sourceEvidenceRefs) ? firstCandidate.sourceEvidenceRefs : [])
  ].filter(Boolean),
  context: {
    confirmed_outcome_branch: sourceContext.confirmedOutcomeBranch,
    source_review_format: sourceContext.sourceReviewFormat,
    source_confirmed_outcome_review_id: sourceContext.sourceConfirmedOutcomeReviewId,
    source_confirmed_outcome_source_run_id: sourceContext.sourceConfirmedOutcomeSourceRunId,
    source_run_id: sourceContext.sourceRunId,
    teacher_reviewed: true,
    controlled_output_sha256: firstCandidate?.controlledOutputSha256 || "",
    lifecycle_gate_id: sourceLifecycleGate?.gateId || "",
    rollback_point: { exists: true, path: rollbackPoint },
    review_only: true,
    confirmed_outcome_review_validation_status: reviewValidation.status
  },
  objects: []
};
writeJson(artifactPath, artifact);

const report = await evaluateRulePackage({
  rulesPath: resolve(compileResult.packagePath),
  artifactPath,
  outPath: validationReportPath
});
const skippedRows = (report.results || []).filter((row) => row.status === "skipped" && row.validator === "lifecycle-gate");
const nonSkippedRuleRows = (report.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped");
if (skippedRows.length !== (compiledRulePackage.rules || []).length) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_RULES_MUST_APPEAR_AS_LIFECYCLE_SKIPPED_ROWS");
}
if (nonSkippedRuleRows.length) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_PACKAGE_MUST_NOT_EVALUATE_RULE_VALIDATORS");
}
if (report.delivery_allowed !== true) {
  throw new Error("CONFIRMED_OUTCOME_DISABLED_PACKAGE_REPORT_MUST_NOT_BLOCK_DELIVERY");
}

const packet = {
  format: "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_v1",
  reportId,
  createdAt: new Date().toISOString(),
  reviewValidationPath,
  reviewValidationHash: hashText(JSON.stringify(reviewValidation)),
  confirmedOutcomeBranch: sourceContext.confirmedOutcomeBranch,
  sourceReviewFormat: sourceContext.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: sourceContext.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: sourceContext.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: sourceContext.sourceRunId,
  sourceDraftPreparationPackagePath: reviewValidation.paths?.sourcePackage || handoff.sourceRuleDraftPackagePath || "",
  sourceDraftPreparationPackageHash: sourcePrep ? hashText(JSON.stringify(sourcePrep)) : "",
  sourceLifecycleGatePath: sourcePrep?.sourceLifecycleGatePath || handoff.sourceLifecycleGatePath || "",
  sourceLifecycleGateHash: sourceLifecycleGate ? hashText(JSON.stringify(sourceLifecycleGate)) : "",
  teacherReviewed,
  rollbackPoint,
  ruleDir,
  compiledRulePackagePath: compileResult.packagePath,
  compileReportPath: compileResult.compileReportPath,
  lockPath: compileResult.lockPath,
  artifactPath,
  validationReportPath,
  status: "ready_for_teacher_confirmed_outcome_validation_report_review",
  summary: {
    disabledRuleCount: (compiledRulePackage.rules || []).length,
    lifecycleSkippedRows: skippedRows.length,
    activeRulesEvaluated: 0,
    validatorRowsEvaluated: nonSkippedRuleRows.length,
    deliveryAllowed: report.delivery_allowed,
    deliveryAllowedIsEvidenceOnly: true,
    packagingUnlocked: false
  },
  executedCommand: {
    kind: "node_spawn_no_shell",
    executable: process.execPath,
    argv: compileArgs
  },
  nextReview: {
    instruction:
      "Review this confirmed-outcome Validation Report as evidence that draft_disabled rules are visible but cannot block delivery, enable rules, execute software, or unlock packaging.",
    mayPromoteRules: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayUnlockPackaging: false,
    deliveryAllowedIsEvidenceOnly: true
  },
  locks: locks({ disabledRulePackageCompiled: true })
};
const packetPath = join(reportDir, "real-case-confirmed-outcome-disabled-package-validation-report-packet.json");
writeJson(packetPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_result_v1",
      status: packet.status,
      packetPath,
      confirmedOutcomeBranch: packet.confirmedOutcomeBranch,
      sourceReviewFormat: packet.sourceReviewFormat,
      sourceConfirmedOutcomeReviewId: packet.sourceConfirmedOutcomeReviewId,
      sourceConfirmedOutcomeSourceRunId: packet.sourceConfirmedOutcomeSourceRunId,
      sourceRunId: packet.sourceRunId,
      compiledRulePackagePath: packet.compiledRulePackagePath,
      validationReportPath,
      disabledRuleCount: packet.summary.disabledRuleCount,
      lifecycleSkippedRows: packet.summary.lifecycleSkippedRows,
      deliveryAllowed: packet.summary.deliveryAllowed,
      deliveryAllowedIsEvidenceOnly: packet.summary.deliveryAllowedIsEvidenceOnly,
      executeNow: false,
      locks: packet.locks
    },
    null,
    2
  )
);
