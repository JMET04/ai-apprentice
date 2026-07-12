#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuleCard, sha256Object, validateRuleCard, writeJson } from "./rules/rule-dsl-core.mjs";
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

function safeFileName(value) {
  return String(value || "rule").replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 140) || "rule";
}

function transitionLocks({ transitionedCopies = 0, compiled = false } = {}) {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    teacherReviewed: true,
    transitionedCopyCount: transitionedCopies,
    reviewOnlyTransitionAppliedToCopies: transitionedCopies > 0,
    sourceRuleFilesModified: false,
    reviewOnlyRulePackageCompiled: compiled,
    activeRulePackageCompiled: false,
    activePromotionAllowed: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const planningPacketPath = resolve(argValue("--planning-packet", argValue("--packet", "")));
const rollbackPoint = resolve(argValue("--rollback-point", ""));
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-review-only-transition-packages"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!planningPacketPath || !existsSync(planningPacketPath)) {
  throw new Error(`REAL_CASE_REVIEW_ONLY_PLANNING_PACKET_NOT_FOUND: ${planningPacketPath || "<missing>"}`);
}
if (!teacherReviewed) throw new Error("REAL_CASE_REVIEW_ONLY_TRANSITION_PACKAGE_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!rollbackPoint || !existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint || "<missing>"}`);

const planningPacket = readJson(planningPacketPath);
if (planningPacket.format !== "transparent_ai_real_case_review_only_package_planning_packet_v1") {
  throw new Error("Expected transparent_ai_real_case_review_only_package_planning_packet_v1.");
}
if (
  planningPacket.status !== "ready_for_teacher_review_only_package_plan_review" ||
  planningPacket.ok !== true ||
  planningPacket.transitionApplied !== false ||
  planningPacket.nextReview?.requiresSeparateReviewOnlyTransitionGate !== true ||
  planningPacket.nextReview?.requiresSeparateActiveGate !== true ||
  planningPacket.nextReview?.mayPromoteActiveRules !== false ||
  planningPacket.nextReview?.mayCompileActiveRulePackage !== false ||
  planningPacket.locks?.ruleFilesModified !== false ||
  planningPacket.locks?.reviewOnlyRulePackageCompiled !== false ||
  planningPacket.locks?.activeRulePackageCompiled !== false ||
  planningPacket.locks?.ruleEnabled !== false ||
  planningPacket.locks?.packagingUnlocked !== false
) {
  throw new Error("Planning packet is not a locked review_only transition handoff.");
}
if (resolve(planningPacket.rollbackPoint || "") !== rollbackPoint) {
  throw new Error("ROLLBACK_POINT_MISMATCH_FOR_REVIEW_ONLY_TRANSITION_PACKAGE");
}

const candidateRules = Array.isArray(planningPacket.candidateRules) ? planningPacket.candidateRules : [];
if (!candidateRules.length) throw new Error("NO_CANDIDATE_RULES_FOR_REVIEW_ONLY_TRANSITION_PACKAGE");

const transitionId = stableId("real_case_review_only_transition_package", `${planningPacketPath}:${rollbackPoint}`);
const transitionDir = join(outRoot, transitionId);
const stagedRulesDir = join(transitionDir, "staged-review-only-rule-cards");
const compileOutDir = join(transitionDir, "compiled-review-only-rule-package");
mkdirSync(stagedRulesDir, { recursive: true });

const stagedRules = [];
const errors = [];
for (const candidate of candidateRules) {
  const sourceRulePath = resolve(candidate.sourceRulePath || "");
  if (!sourceRulePath || !existsSync(sourceRulePath)) {
    errors.push(`SOURCE_RULE_NOT_FOUND:${candidate.ruleId || sourceRulePath}`);
    continue;
  }
  try {
    const sourceRule = loadRuleCard(sourceRulePath);
    const sourceHash = sha256Object(sourceRule);
    if (sourceHash !== candidate.sourceRuleHash) {
      errors.push(`SOURCE_RULE_HASH_MISMATCH:${candidate.ruleId || sourceRule.rule_id}`);
    }
    if (sourceRule.lifecycle !== "draft_disabled" || candidate.sourceLifecycle !== "draft_disabled") {
      errors.push(`SOURCE_RULE_MUST_STILL_BE_DRAFT_DISABLED:${candidate.ruleId || sourceRule.rule_id}`);
    }
    if (candidate.proposedLifecycle !== "review_only") {
      errors.push(`CANDIDATE_PROPOSED_LIFECYCLE_NOT_REVIEW_ONLY:${candidate.ruleId || sourceRule.rule_id}`);
    }
    const sourceValidation = validateRuleCard(sourceRule);
    if (!sourceValidation.ok) {
      errors.push(`SOURCE_RULE_DSL_VALIDATION_FAILED:${candidate.ruleId || sourceRule.rule_id}`);
    }

    const reviewOnlyRule = {
      ...sourceRule,
      lifecycle: "review_only",
      owner: {
        ...sourceRule.owner,
        reviewer_id: sourceRule.owner?.reviewer_id || "teacher_review_only_transition_gate",
        approved_at: null
      },
      audit: {
        ...sourceRule.audit,
        updated_at: new Date().toISOString()
      }
    };
    const reviewOnlyValidation = validateRuleCard(reviewOnlyRule);
    if (!reviewOnlyValidation.ok) {
      errors.push(`REVIEW_ONLY_RULE_DSL_VALIDATION_FAILED:${candidate.ruleId || reviewOnlyRule.rule_id}`);
    }
    const stagedRulePath = join(stagedRulesDir, `${safeFileName(reviewOnlyRule.rule_id)}.json`);
    writeJson(stagedRulePath, reviewOnlyRule);
    stagedRules.push({
      ruleId: reviewOnlyRule.rule_id,
      sourceRulePath,
      stagedRulePath,
      sourceRuleHash: sourceHash,
      stagedRuleHash: sha256Object(reviewOnlyRule),
      sourceLifecycle: sourceRule.lifecycle,
      stagedLifecycle: reviewOnlyRule.lifecycle,
      sourceRuleStillDraftDisabled: sourceRule.lifecycle === "draft_disabled",
      transitionAppliedToCopyOnly: true,
      activePromotionAllowed: false,
      requiresSeparateActiveGate: true,
      evidenceRefs: reviewOnlyRule.source?.evidence_refs || [],
      validatorType: reviewOnlyRule.constraint?.type || ""
    });
  } catch (error) {
    errors.push(`RULE_TRANSITION_FAILED:${candidate.ruleId || sourceRulePath}:${error.message}`);
  }
}

if (!stagedRules.length && !errors.length) errors.push("NO_RULES_STAGED_FOR_REVIEW_ONLY_TRANSITION_PACKAGE");
if (errors.length) {
  const blocked = {
    ok: false,
    format: "transparent_ai_real_case_review_only_transition_package_v1",
    transitionId,
    createdAt: new Date().toISOString(),
    status: "blocked_real_case_review_only_transition_package",
    planningPacketPath,
    planningPacketHash: hashText(JSON.stringify(planningPacket)),
    teacherReviewed,
    rollbackPoint,
    stagedRules,
    errors,
    locks: transitionLocks({ transitionedCopies: stagedRules.length, compiled: false })
  };
  const blockedPath = join(transitionDir, "real-case-review-only-transition-package.json");
  writeJson(blockedPath, blocked);
  console.log(JSON.stringify({ ok: false, status: blocked.status, packagePath: blockedPath, errors, locks: blocked.locks }, null, 2));
  process.exit(1);
}

const compileArgs = [
  join(pluginRoot, "scripts", "rules", "compile-rule-package.mjs"),
  "--rules",
  stagedRulesDir,
  "--package-id",
  `${transitionId}.review_only`,
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
const activeRules = compiledRules.filter((rule) => rule.lifecycle === "active");
const nonReviewOnlyRules = compiledRules.filter((rule) => rule.lifecycle !== "review_only");
if (activeRules.length) throw new Error("REAL_CASE_REVIEW_ONLY_PACKAGE_CONTAINS_ACTIVE_RULES");
if (nonReviewOnlyRules.length) throw new Error("REAL_CASE_REVIEW_ONLY_PACKAGE_CONTAINS_NON_REVIEW_ONLY_RULES");

const packet = {
  ok: true,
  format: "transparent_ai_real_case_review_only_transition_package_v1",
  transitionId,
  createdAt: new Date().toISOString(),
  status: "ready_for_teacher_review_only_transition_package_review",
  planningPacketPath,
  planningPacketHash: hashText(JSON.stringify(planningPacket)),
  sourceLifecycleCandidateReviewValidationPath: planningPacket.sourceLifecycleCandidateReviewValidationPath || "",
  teacherReviewed,
  rollbackPoint,
  reportId: planningPacket.reportId || "",
  caseType: planningPacket.caseType || "",
  appliedTransitionScope: "staged_rule_copies_only",
  sourceRuleFilesModified: false,
  stagedRulesDir,
  stagedRules,
  reviewOnlyRuleCount: stagedRules.length,
  compiledReviewOnlyRulePackagePath: compileResult.packagePath,
  compileReportPath: compileResult.compileReportPath,
  lockPath: compileResult.lockPath,
  executedCommand: {
    kind: "node_spawn_no_shell",
    executable: process.execPath,
    argv: compileArgs
  },
  nextReview: {
    instruction:
      "Review this review_only transition package before any separate active promotion, execution, memory, or packaging request.",
    mayPromoteActiveRules: false,
    mayEnableRules: false,
    mayCompileActiveRulePackage: false,
    mayExecuteSoftware: false,
    mayFetchRag: false,
    mayWriteMemory: false,
    mayUnlockPackaging: false,
    requiresSeparateActiveGate: true
  },
  blockedActions: [
    "activate_rule_from_review_only_transition_package",
    "compile_active_package_from_review_only_transition_package",
    "execute_software_from_review_only_transition_package",
    "write_memory_from_review_only_transition_package",
    "fetch_rag_from_review_only_transition_package",
    "unlock_packaging_from_review_only_transition_package",
    "claim_completion_from_review_only_transition_package"
  ],
  locks: transitionLocks({ transitionedCopies: stagedRules.length, compiled: true })
};
const packetPath = join(transitionDir, "real-case-review-only-transition-package.json");
writeJson(packetPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_review_only_transition_package_result_v1",
      status: packet.status,
      packagePath: packetPath,
      stagedRulesDir,
      compiledReviewOnlyRulePackagePath: packet.compiledReviewOnlyRulePackagePath,
      reviewOnlyRuleCount: packet.reviewOnlyRuleCount,
      sourceRuleFilesModified: false,
      executeNow: false,
      locks: packet.locks
    },
    null,
    2
  )
);
