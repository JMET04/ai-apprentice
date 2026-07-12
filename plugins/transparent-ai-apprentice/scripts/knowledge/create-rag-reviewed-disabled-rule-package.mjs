#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuleCard, validateRuleCard } from "../rules/rule-dsl-core.mjs";
import { arg, hasFlag, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const reviewValidationPath = resolve(arg("--review-validation", ""));
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-reviewed-disabled-rule-package"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!reviewValidationPath || !rollbackPoint) {
  throw new Error(
    "Usage: node create-rag-reviewed-disabled-rule-package.mjs --review-validation <rag-reviewed-rule-dsl-review-receipt-validation.json> --rollback-point <rollback-point-dir> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!teacherReviewed) throw new Error("RAG_REVIEWED_DISABLED_RULE_PACKAGE_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const reviewValidation = readJson(reviewValidationPath);
if (reviewValidation.format !== "transparent_ai_rag_reviewed_rule_dsl_review_receipt_validation_v1") {
  throw new Error("Expected transparent_ai_rag_reviewed_rule_dsl_review_receipt_validation_v1.");
}
if (
  reviewValidation.status !== "ready_for_review_only_disabled_rule_package_planning" ||
  reviewValidation.nextReview?.mayPrepareDisabledRulePackageReview !== true ||
  reviewValidation.nextReview?.mayCompileActiveRulePackage !== false ||
  reviewValidation.locks?.ruleEnabled !== false ||
  reviewValidation.locks?.memoryEnabled !== false ||
  reviewValidation.locks?.softwareActionsExecuted !== false ||
  reviewValidation.locks?.externalFetchPerformed !== false ||
  reviewValidation.locks?.packagingUnlocked !== false
) {
  throw new Error("Review validation is not a locked handoff for review-only disabled rule package planning.");
}

const reviewedRules = Array.isArray(reviewValidation.reviewedDisabledRules)
  ? reviewValidation.reviewedDisabledRules
  : [];
if (!reviewedRules.length) throw new Error("NO_REVIEWED_DISABLED_RULES_FOR_RULE_PACKAGE");
const nextReviewLogicHints = new Map(
  (reviewValidation.nextReview?.logicExtractionHints || []).map((row) => [String(row.sourceId || ""), row])
);
const planningLogicEvidence = reviewValidation.planningLogicEvidence || null;
const planningLogicEvidenceHash = reviewValidation.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = reviewValidation.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = reviewValidation.nextReview?.planningLogicEvidenceHash || "";

const packageId = stableId("rag_reviewed_disabled_rule_package", `${reviewValidationPath}:${rollbackPoint}`);
const packageDir = join(outDir, packageId);
const stagingRulesDir = join(packageDir, "staged-draft-disabled-rules");
const compileOutDir = join(packageDir, "compiled-disabled-rule-package");
mkdirSync(stagingRulesDir, { recursive: true });

const stagedRules = [];
const errors = [];
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  errors.push("DISABLED_RULE_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  errors.push("DISABLED_RULE_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  errors.push("DISABLED_RULE_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
for (const reviewed of reviewedRules) {
  const rulePath = resolve(reviewed.rulePath || "");
  if (!rulePath || !existsSync(rulePath)) {
    errors.push(`REVIEWED_RULE_NOT_FOUND:${reviewed.rulePath || reviewed.ruleId}`);
    continue;
  }
  try {
    const rule = loadRuleCard(rulePath);
    const validation = validateRuleCard(rule);
    const currentHash = hashText(JSON.stringify(rule));
    if (!validation.ok) errors.push(`REVIEWED_RULE_DSL_VALIDATION_FAILED:${reviewed.ruleId || rule.rule_id}`);
    if (rule.lifecycle !== "draft_disabled") errors.push(`REVIEWED_RULE_MUST_REMAIN_DRAFT_DISABLED:${reviewed.ruleId || rule.rule_id}`);
    if (reviewed.lifecycle !== "draft_disabled") errors.push(`REVIEW_RECEIPT_RULE_NOT_DRAFT_DISABLED:${reviewed.ruleId || rule.rule_id}`);
    if (reviewed.ruleHash !== currentHash) errors.push(`REVIEWED_RULE_HASH_MISMATCH:${reviewed.ruleId || rule.rule_id}`);
    const expectedLogicHint = nextReviewLogicHints.get(String(reviewed.sourceId || ""));
    if (expectedLogicHint) {
      if ((reviewed.logicExtractionHint || "") !== (expectedLogicHint.logicExtractionHint || "")) {
        errors.push(`REVIEWED_RULE_LOGIC_EXTRACTION_HINT_MISMATCH:${reviewed.ruleId || rule.rule_id}`);
      }
      if ((reviewed.logicFitDecision || "not_applicable") !== (expectedLogicHint.logicFitDecision || "not_applicable")) {
        errors.push(`REVIEWED_RULE_LOGIC_FIT_DECISION_MISMATCH:${reviewed.ruleId || rule.rule_id}`);
      }
      if (reviewed.logicFitDecision !== "matches_intended_logic") {
        errors.push(`REVIEWED_RULE_REQUIRES_MATCHING_LOGIC_FIT:${reviewed.ruleId || rule.rule_id}`);
      }
    }
    if (!Array.isArray(rule.source?.evidence_refs) || rule.source.evidence_refs.length === 0) {
      errors.push(`REVIEWED_RULE_REQUIRES_EVIDENCE_REFS:${reviewed.ruleId || rule.rule_id}`);
    }
    const stagedPath = join(stagingRulesDir, `${String(rule.rule_id || reviewed.ruleId).replace(/[^A-Za-z0-9_.-]+/g, "_")}.json`);
    writeJson(stagedPath, rule);
    stagedRules.push({
      sourceId: reviewed.sourceId || "",
      ruleId: rule.rule_id,
      sourceRulePath: rulePath,
      stagedRulePath: stagedPath,
      ruleHash: currentHash,
      lifecycle: rule.lifecycle,
      evidenceRefs: rule.source?.evidence_refs || [],
      logicExtractionHint: reviewed.logicExtractionHint || "",
      logicFitDecision: reviewed.logicFitDecision || "not_applicable",
      reviewerNote: reviewed.reviewerNote || ""
    });
  } catch (error) {
    errors.push(`REVIEWED_RULE_LOAD_FAILED:${reviewed.rulePath || reviewed.ruleId}:${error.message}`);
  }
}

if (!stagedRules.length && !errors.length) errors.push("NO_RULES_STAGED_FOR_DISABLED_PACKAGE");
if (errors.length) {
  const blocked = {
    format: "transparent_ai_rag_reviewed_disabled_rule_package_v1",
    packageId,
    createdAt: new Date().toISOString(),
    reviewValidationPath,
    planningLogicEvidence,
    planningLogicEvidenceHash,
    status: "blocked",
    errors,
    stagedRules,
    locks: {
      reviewOnly: true,
      evidenceOnly: true,
      accepted: false,
      ruleEnabled: false,
      disabledRulePackageCompiled: false,
      activeRulePackageCompiled: false,
      memoryEnabled: false,
      softwareActionsExecuted: false,
      externalFetchPerformed: false,
      packagingGated: true,
      packagingUnlocked: false
    }
  };
  const blockedPath = join(packageDir, "rag-reviewed-disabled-rule-package.json");
  writeJson(blockedPath, blocked);
  console.log(JSON.stringify({ ok: false, status: "blocked", packagePath: blockedPath, errors, locks: blocked.locks }, null, 2));
  process.exit(1);
}

const compileArgs = [
  join(pluginRoot, "scripts", "rules", "compile-rule-package.mjs"),
  "--rules",
  stagingRulesDir,
  "--package-id",
  packageId,
  "--out-dir",
  compileOutDir
];
const compileRun = spawnSync(process.execPath, compileArgs, { cwd: repoRoot, encoding: "utf8" });
if (compileRun.status !== 0) {
  throw new Error(`compile-rule-package.mjs failed:\nSTDOUT:\n${compileRun.stdout}\nSTDERR:\n${compileRun.stderr}`);
}
const compileResult = JSON.parse(compileRun.stdout);
const compiledPackage = readJson(compileResult.packagePath);
const activeRules = (compiledPackage.rules || []).filter((rule) => rule.lifecycle === "active");
if (activeRules.length > 0) {
  throw new Error("DISABLED_RULE_PACKAGE_CONTAINS_ACTIVE_RULES");
}
const nonDisabledRules = (compiledPackage.rules || []).filter((rule) => rule.lifecycle !== "draft_disabled");
if (nonDisabledRules.length > 0) {
  throw new Error("DISABLED_RULE_PACKAGE_CONTAINS_NON_DRAFT_RULES");
}

const packet = {
  format: "transparent_ai_rag_reviewed_disabled_rule_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  reviewValidationPath,
  reviewValidationHash: hashText(JSON.stringify(reviewValidation)),
  teacherReviewed,
  rollbackPoint,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status: "ready_for_teacher_disabled_rule_package_review",
  stagedRules,
  disabledRuleCount: stagedRules.length,
  compiledRulePackagePath: compileResult.packagePath,
  compileReportPath: compileResult.compileReportPath,
  lockPath: compileResult.lockPath,
  executedCommand: {
    kind: "node_spawn_no_shell",
    executable: process.execPath,
    argv: compileArgs
  },
  nextReview: {
    instruction: "Review this disabled Rule Package before any separate lifecycle promotion or memory request.",
    mayPromoteRules: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayUnlockPackaging: false,
    logicExtractionHints: stagedRules
      .filter((row) => row.logicExtractionHint)
      .map((row) => ({ sourceId: row.sourceId, logicExtractionHint: row.logicExtractionHint, logicFitDecision: row.logicFitDecision })),
    planningLogicEvidence,
    planningLogicEvidenceHash
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    disabledRulePackageCompiled: true,
    activeRulePackageCompiled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    shellCommandExecuted: false,
    packagingGated: true,
    packagingUnlocked: false
  }
};

const packagePath = join(packageDir, "rag-reviewed-disabled-rule-package.json");
writeJson(packagePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: packet.format,
      status: packet.status,
      packagePath,
      compiledRulePackagePath: packet.compiledRulePackagePath,
      disabledRuleCount: packet.disabledRuleCount,
      locks: packet.locks
    },
    null,
    2
  )
);
