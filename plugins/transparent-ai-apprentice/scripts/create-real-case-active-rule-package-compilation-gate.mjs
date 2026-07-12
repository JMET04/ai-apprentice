#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listRuleFiles, loadRuleCard, sha256Object, validateRuleCard, writeJson } from "./rules/rule-dsl-core.mjs";
import { hashText, readJson, stableId } from "./knowledge/knowledge-core.mjs";

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

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = readJson(sourcePath);
  } catch {
    try {
      parsed = JSON.parse(text);
      sourcePath = "";
    } catch {
      parsed = null;
    }
  }
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  return { value: parsed, path: sourcePath };
}

function safeFileName(value) {
  return String(value || "rule").replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 140) || "rule";
}

function activeCompilationLocks({ compiled = false, activeRuleCount = 0 } = {}) {
  return {
    reviewOnly: false,
    evidenceOnly: true,
    teacherReviewed: true,
    activeRulePackageCompiled: compiled,
    activeRuleCount,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateValidationReportGate: true,
    requiresSeparateExecutionGate: true
  };
}

const validationInput = readJsonInput(
  argValue("--active-promotion-validation", argValue("--validation", "")),
  "--active-promotion-validation"
);
const rollbackPoint = resolve(argValue("--rollback-point", ""));
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-active-rule-package-compilations"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");
const reviewerId = argValue("--reviewer-id", "teacher_active_package_compilation_gate");

if (!teacherReviewed) throw new Error("REAL_CASE_ACTIVE_RULE_PACKAGE_COMPILATION_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!rollbackPoint || !existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint || "<missing>"}`);

const validation = validationInput.value;
const validationFormat = validation.format;
if (
  validationFormat !== "transparent_ai_real_case_active_promotion_review_validation_v1" &&
  validationFormat !== "transparent_ai_real_case_active_promotion_review_validation_result_v1"
) {
  throw new Error("Expected transparent_ai_real_case_active_promotion_review_validation_v1 or result_v1.");
}
if (
  validation.status !== "real_case_active_promotion_review_ready_for_active_package_planning" ||
  validation.readyForActivePromotionPlanning !== true ||
  validation.activePromotionPlanningHandoff?.format !== "transparent_ai_real_case_active_promotion_planning_handoff_v1" ||
  validation.activePromotionPlanningHandoff?.activePackageCompilationAllowedHere !== false ||
  validation.activePromotionPlanningHandoff?.requiresSeparateActiveCompilationGate !== true ||
  validation.activePromotionPlanningHandoff?.requiresSeparateExecutionGate !== true ||
  validation.locks?.activeRulePackageCompiled !== false ||
  validation.locks?.ruleEnabled !== false ||
  validation.locks?.targetSoftwareCommandsExecuted !== false ||
  validation.locks?.packagingUnlocked !== false
) {
  throw new Error("Active promotion validation is not a locked planning handoff for the separate active compilation gate.");
}

const handoff = validation.activePromotionPlanningHandoff;
const transitionPackagePath = resolve(handoff.transitionPackagePath || validation.paths?.sourceTransitionPackage || "");
if (!transitionPackagePath || !existsSync(transitionPackagePath)) {
  throw new Error(`TRANSITION_PACKAGE_NOT_FOUND: ${transitionPackagePath || "<missing>"}`);
}
const transitionPackage = readJson(transitionPackagePath);
if (transitionPackage.format !== "transparent_ai_real_case_review_only_transition_package_v1") {
  throw new Error("Expected transparent_ai_real_case_review_only_transition_package_v1.");
}
if (
  transitionPackage.status !== "ready_for_teacher_review_only_transition_package_review" ||
  transitionPackage.ok !== true ||
  transitionPackage.appliedTransitionScope !== "staged_rule_copies_only" ||
  transitionPackage.sourceRuleFilesModified !== false ||
  transitionPackage.reviewOnlyRuleCount < 1 ||
  transitionPackage.locks?.reviewOnlyRulePackageCompiled !== true ||
  transitionPackage.locks?.activeRulePackageCompiled !== false ||
  transitionPackage.locks?.ruleEnabled !== false ||
  transitionPackage.locks?.packagingUnlocked !== false
) {
  throw new Error("Transition package is not a locked review_only package ready for active compilation review.");
}
if (resolve(transitionPackage.rollbackPoint || "") !== rollbackPoint) {
  throw new Error("ROLLBACK_POINT_MISMATCH_FOR_ACTIVE_RULE_PACKAGE_COMPILATION");
}
if (transitionPackage.transitionId !== handoff.transitionId) {
  throw new Error("TRANSITION_ID_MISMATCH_FOR_ACTIVE_RULE_PACKAGE_COMPILATION");
}

const compilationId = stableId("real_case_active_rule_package_compilation", `${validationInput.path || hashText(JSON.stringify(validation))}:${rollbackPoint}`);
const compilationDir = join(outRoot, compilationId);
const activeRulesDir = join(compilationDir, "staged-active-rule-cards");
const compileOutDir = join(compilationDir, "compiled-active-rule-package");
mkdirSync(activeRulesDir, { recursive: true });

const sourceRulesDir = resolve(handoff.stagedRulesDir || transitionPackage.stagedRulesDir || "");
if (!sourceRulesDir || !existsSync(sourceRulesDir)) throw new Error(`STAGED_REVIEW_ONLY_RULES_DIR_NOT_FOUND: ${sourceRulesDir}`);

const errors = [];
const activeRows = [];
for (const reviewOnlyRulePath of listRuleFiles(sourceRulesDir)) {
  try {
    const reviewOnlyRule = loadRuleCard(reviewOnlyRulePath);
    const reviewOnlyValidation = validateRuleCard(reviewOnlyRule);
    if (!reviewOnlyValidation.ok) errors.push(`REVIEW_ONLY_RULE_DSL_VALIDATION_FAILED:${reviewOnlyRule.rule_id}`);
    if (reviewOnlyRule.lifecycle !== "review_only") errors.push(`SOURCE_RULE_COPY_MUST_BE_REVIEW_ONLY:${reviewOnlyRule.rule_id}`);

    const activeRule = {
      ...reviewOnlyRule,
      lifecycle: "active",
      owner: {
        ...reviewOnlyRule.owner,
        reviewer_id: reviewerId,
        approved_at: new Date().toISOString()
      },
      audit: {
        ...reviewOnlyRule.audit,
        updated_at: new Date().toISOString()
      }
    };
    const activeValidation = validateRuleCard(activeRule);
    if (!activeValidation.ok) {
      errors.push(`ACTIVE_RULE_DSL_VALIDATION_FAILED:${reviewOnlyRule.rule_id}:${activeValidation.errors.map((row) => row.error_code).join(",")}`);
    }
    const activeRulePath = join(activeRulesDir, `${safeFileName(activeRule.rule_id)}.json`);
    writeJson(activeRulePath, activeRule);
    activeRows.push({
      ruleId: activeRule.rule_id,
      reviewOnlyRulePath,
      activeRulePath,
      reviewOnlyRuleHash: sha256Object(reviewOnlyRule),
      activeRuleHash: sha256Object(activeRule),
      sourceLifecycle: reviewOnlyRule.lifecycle,
      compiledLifecycle: activeRule.lifecycle,
      activePackageCompilationOnly: true,
      ruleEnabled: false,
      requiresSeparateValidationReportGate: true,
      requiresSeparateExecutionGate: true,
      validatorType: activeRule.constraint?.type || "",
      severity: activeRule.severity || ""
    });
  } catch (error) {
    errors.push(`ACTIVE_RULE_STAGING_FAILED:${reviewOnlyRulePath}:${error.message}`);
  }
}

if (!activeRows.length && !errors.length) errors.push("NO_REVIEW_ONLY_RULES_STAGED_FOR_ACTIVE_COMPILATION");
if (errors.length) {
  const blocked = {
    ok: false,
    format: "transparent_ai_real_case_active_rule_package_compilation_v1",
    compilationId,
    createdAt: new Date().toISOString(),
    status: "blocked_real_case_active_rule_package_compilation",
    validationPath: validationInput.path,
    transitionPackagePath,
    teacherReviewed,
    rollbackPoint,
    activeRulesDir,
    activeRows,
    errors,
    locks: activeCompilationLocks({ compiled: false, activeRuleCount: activeRows.length })
  };
  const blockedPath = join(compilationDir, "real-case-active-rule-package-compilation.json");
  writeJson(blockedPath, blocked);
  console.log(JSON.stringify({ ok: false, status: blocked.status, compilationPath: blockedPath, errors, locks: blocked.locks }, null, 2));
  process.exit(1);
}

const compileArgs = [
  join(pluginRoot, "scripts", "rules", "compile-rule-package.mjs"),
  "--rules",
  activeRulesDir,
  "--package-id",
  `${compilationId}.active`,
  "--out-dir",
  compileOutDir
];
const compileRun = spawnSync(process.execPath, compileArgs, { cwd: repoRoot, encoding: "utf8" });
if (compileRun.status !== 0) {
  throw new Error(`compile-rule-package.mjs failed:\nSTDOUT:\n${compileRun.stdout}\nSTDERR:\n${compileRun.stderr}`);
}
const compileResult = JSON.parse(compileRun.stdout);
const compiledPackage = readJson(compileResult.packagePath);
const compiledRules = Array.isArray(compiledPackage.rules) ? compiledPackage.rules : [];
const nonActiveRules = compiledRules.filter((rule) => rule.lifecycle !== "active");
if (!compiledRules.length) throw new Error("REAL_CASE_ACTIVE_RULE_PACKAGE_HAS_NO_RULES");
if (nonActiveRules.length) throw new Error("REAL_CASE_ACTIVE_RULE_PACKAGE_CONTAINS_NON_ACTIVE_RULES");

const packet = {
  ok: true,
  format: "transparent_ai_real_case_active_rule_package_compilation_v1",
  compilationId,
  createdAt: new Date().toISOString(),
  status: "ready_for_teacher_active_rule_package_validation_report_review",
  validationPath: validationInput.path,
  validationHash: hashText(JSON.stringify(validation)),
  transitionPackagePath,
  transitionPackageHash: hashText(JSON.stringify(transitionPackage)),
  compiledReviewOnlyRulePackagePath: handoff.compiledReviewOnlyRulePackagePath || transitionPackage.compiledReviewOnlyRulePackagePath,
  teacherReviewed,
  reviewerId,
  rollbackPoint,
  caseType: handoff.caseType || transitionPackage.caseType || "",
  activeRulesDir,
  activeRows,
  activeRuleCount: activeRows.length,
  compiledActiveRulePackagePath: compileResult.packagePath,
  compileReportPath: compileResult.compileReportPath,
  lockPath: compileResult.lockPath,
  executedCommand: {
    kind: "node_spawn_no_shell",
    executable: process.execPath,
    argv: compileArgs
  },
  nextReview: {
    instruction:
      "Review the compiled active Rule Package with a separate Validation Report gate before any delivery, execution, memory, or packaging request.",
    mayEnableRules: false,
    mayExecuteSoftware: false,
    mayFetchRag: false,
    mayWriteMemory: false,
    mayUnlockPackaging: false,
    requiresSeparateValidationReportGate: true,
    requiresSeparateExecutionGate: true
  },
  blockedActions: [
    "enable_rule_from_active_package_compilation",
    "execute_software_from_active_package_compilation",
    "write_memory_from_active_package_compilation",
    "fetch_rag_from_active_package_compilation",
    "unlock_packaging_from_active_package_compilation",
    "claim_completion_from_active_package_compilation"
  ],
  locks: activeCompilationLocks({ compiled: true, activeRuleCount: activeRows.length })
};
const packetPath = join(compilationDir, "real-case-active-rule-package-compilation.json");
writeJson(packetPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_active_rule_package_compilation_result_v1",
      status: packet.status,
      compilationPath: packetPath,
      activeRulesDir,
      compiledActiveRulePackagePath: packet.compiledActiveRulePackagePath,
      activeRuleCount: packet.activeRuleCount,
      executeNow: false,
      locks: packet.locks
    },
    null,
    2
  )
);
