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

function artifactTypeForCase(caseType) {
  if (caseType === "packaging_box") return "packaging_dieline";
  if (caseType === "cad_drawing") return "cad_drawing";
  return "engineering_case_artifact";
}

function locks({ disabledRulePackageCompiled = false } = {}) {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    disabledRulePackageCompiled,
    activeRulePackageCompiled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    externalFetchPerformed: false,
    shellCommandExecuted: false,
    packagingGated: true,
    packagingUnlocked: false,
    goalComplete: false
  };
}

const reviewValidationPath = resolve(argValue("--review-validation", argValue("--validation", "")));
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-disabled-package-validation-reports"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!reviewValidationPath) {
  throw new Error(
    "Usage: node create-real-case-disabled-package-validation-report.mjs --review-validation <real-case-rule-dsl-review-validation.json> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!existsSync(reviewValidationPath)) throw new Error(`REAL_CASE_RULE_DSL_REVIEW_VALIDATION_NOT_FOUND: ${reviewValidationPath}`);
if (!teacherReviewed) throw new Error("REAL_CASE_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG");

const reviewValidation = readJson(reviewValidationPath);
if (reviewValidation.format !== "transparent_ai_real_case_rule_dsl_review_validation_v1") {
  throw new Error("Expected transparent_ai_real_case_rule_dsl_review_validation_v1.");
}
if (
  reviewValidation.status !== "real_case_rule_dsl_review_ready_for_disabled_package_planning" ||
  reviewValidation.readyForDisabledPackagePlanning !== true ||
  !reviewValidation.disabledPackagePlanningHandoff ||
  reviewValidation.locks?.ruleEnabled !== false ||
  reviewValidation.locks?.activeRulePackageCompiled !== false ||
  reviewValidation.locks?.targetSoftwareCommandsExecuted !== false ||
  reviewValidation.locks?.packagingUnlocked !== false
) {
  throw new Error("Review validation is not a locked handoff for real-case disabled package validation reporting.");
}

const handoff = reviewValidation.disabledPackagePlanningHandoff;
if (handoff.activePromotionAllowed !== false || handoff.executeNow !== false || handoff.reviewOnly !== true) {
  throw new Error("Disabled package planning handoff must keep active promotion and execution disabled.");
}
const ruleDir = resolve(handoff.ruleDir || "");
if (!ruleDir || !existsSync(ruleDir)) throw new Error(`REAL_CASE_DRAFT_DISABLED_RULE_DIR_NOT_FOUND: ${handoff.ruleDir || ""}`);

let sourcePrep = null;
if (reviewValidation.paths?.sourcePackage && existsSync(reviewValidation.paths.sourcePackage)) {
  sourcePrep = readJson(reviewValidation.paths.sourcePackage);
}
const rollbackPoint = sourcePrep?.rollbackPoint || argValue("--rollback-point", "");
if (!rollbackPoint) throw new Error("REAL_CASE_DISABLED_REPORT_REQUIRES_ROLLBACK_POINT");

const reportId = stableId("real_case_disabled_package_validation_report", `${reviewValidationPath}:${ruleDir}`);
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
if (activeRules.length) throw new Error("REAL_CASE_DISABLED_PACKAGE_CONTAINS_ACTIVE_RULES");
if (nonDisabledRules.length) throw new Error("REAL_CASE_DISABLED_PACKAGE_CONTAINS_NON_DRAFT_DISABLED_RULES");

const artifactPath = join(reportDir, "real-case-review-only-artifact.json");
const validationReportPath = join(reportDir, "real-case-disabled-package-validation-report.json");
const artifact = {
  artifact_id: `${reportId}.artifact`,
  artifact_type: artifactTypeForCase(handoff.caseType),
  schema_version: "0.1",
  units: "review_only",
  created_at: new Date().toISOString(),
  source_refs: [
    reviewValidationPath,
    ...(Array.isArray(sourcePrep?.artifacts) ? sourcePrep.artifacts.map((item) => String(item)) : [])
  ],
  context: {
    case_type: handoff.caseType || "",
    risk_level: "high",
    approval: { teacher_confirmed: false },
    rollback_point: { exists: true, path: rollbackPoint },
    review_only: true
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
  throw new Error("REAL_CASE_DISABLED_RULES_MUST_APPEAR_AS_LIFECYCLE_SKIPPED_ROWS");
}
if (nonSkippedRuleRows.length) throw new Error("REAL_CASE_DISABLED_PACKAGE_MUST_NOT_EVALUATE_RULE_VALIDATORS");
if (report.delivery_allowed !== true) throw new Error("REAL_CASE_DISABLED_PACKAGE_REPORT_MUST_NOT_BLOCK_DELIVERY");

const packet = {
  format: "transparent_ai_real_case_disabled_package_validation_report_v1",
  reportId,
  createdAt: new Date().toISOString(),
  reviewValidationPath,
  reviewValidationHash: hashText(JSON.stringify(reviewValidation)),
  sourcePreparationPackagePath: reviewValidation.paths?.sourcePackage || "",
  sourcePreparationPackageHash: sourcePrep ? hashText(JSON.stringify(sourcePrep)) : "",
  teacherReviewed,
  rollbackPoint,
  caseType: handoff.caseType || "",
  ruleDir,
  compiledRulePackagePath: compileResult.packagePath,
  compileReportPath: compileResult.compileReportPath,
  lockPath: compileResult.lockPath,
  artifactPath,
  validationReportPath,
  status: "ready_for_teacher_real_case_validation_report_review",
  summary: {
    disabledRuleCount: (compiledRulePackage.rules || []).length,
    lifecycleSkippedRows: skippedRows.length,
    activeRulesEvaluated: 0,
    validatorRowsEvaluated: nonSkippedRuleRows.length,
    deliveryAllowed: report.delivery_allowed,
    packagingUnlocked: false
  },
  executedCommand: {
    kind: "node_spawn_no_shell",
    executable: process.execPath,
    argv: compileArgs
  },
  nextReview: {
    instruction:
      "Review this real-case Validation Report as evidence that draft_disabled rules are visible but cannot block delivery or unlock packaging.",
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
const packetPath = join(reportDir, "real-case-disabled-package-validation-report-packet.json");
writeJson(packetPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_disabled_package_validation_report_result_v1",
      status: packet.status,
      packetPath,
      compiledRulePackagePath: packet.compiledRulePackagePath,
      validationReportPath,
      disabledRuleCount: packet.summary.disabledRuleCount,
      lifecycleSkippedRows: packet.summary.lifecycleSkippedRows,
      deliveryAllowed: packet.summary.deliveryAllowed,
      executeNow: false,
      locks: packet.locks
    },
    null,
    2
  )
);
