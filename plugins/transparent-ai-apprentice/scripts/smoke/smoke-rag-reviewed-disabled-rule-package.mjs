#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-reviewed-disabled-rule-package");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args, expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${scriptPath} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${scriptPath} unexpectedly passed:\nSTDOUT:\n${result.stdout}`);
  }
  return result;
}

function runKnowledge(script, args, expectOk = true) {
  return runScript(join(pluginRoot, "scripts", "knowledge", script), args, expectOk);
}

const reviewReceiptSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-reviewed-rule-dsl-review-receipt.mjs"), []);
const reviewReceiptSmokeResult = JSON.parse(reviewReceiptSmoke.stdout);
const reviewValidationPath = reviewReceiptSmokeResult.validationPath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-reviewed-disabled-rule-package",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const packageRun = runKnowledge("create-rag-reviewed-disabled-rule-package.mjs", [
  "--review-validation",
  reviewValidationPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "package")
]);
const packageResult = JSON.parse(packageRun.stdout);
const packet = readJson(packageResult.packagePath);
const compiled = readJson(packet.compiledRulePackagePath);

if (packet.format !== "transparent_ai_rag_reviewed_disabled_rule_package_v1") {
  throw new Error("Reviewed disabled rule package should use the expected format.");
}
if (packet.status !== "ready_for_teacher_disabled_rule_package_review") {
  throw new Error("Reviewed disabled rule package should require teacher package review.");
}
if (packet.disabledRuleCount !== 1 || compiled.rules.length !== 1) {
  throw new Error("Reviewed disabled rule package should compile exactly one reviewed rule.");
}
if (compiled.rules.some((rule) => rule.lifecycle !== "draft_disabled")) {
  throw new Error("Reviewed disabled rule package must contain only draft_disabled rules.");
}
if (
  packet.locks.ruleEnabled !== false ||
  packet.locks.disabledRulePackageCompiled !== true ||
  packet.locks.activeRulePackageCompiled !== false ||
  packet.locks.memoryEnabled !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.packagingUnlocked !== false
) {
  throw new Error("Reviewed disabled rule package must keep activation, memory, software, external fetch, and packaging locks.");
}
if (packet.executedCommand.kind !== "node_spawn_no_shell") {
  throw new Error("Reviewed disabled rule package must use no-shell existing compiler invocation.");
}

const noTeacherRun = runKnowledge(
  "create-rag-reviewed-disabled-rule-package.mjs",
  ["--review-validation", reviewValidationPath, "--rollback-point", rollbackPoint, "--out-dir", join(root, "no-teacher-package")],
  false
);
if (!noTeacherRun.stderr.includes("RAG_REVIEWED_DISABLED_RULE_PACKAGE_REQUIRES_TEACHER_REVIEWED_FLAG")) {
  throw new Error("Reviewed disabled rule package must reject missing teacher-reviewed flag.");
}

const notReadyValidation = readJson(reviewValidationPath);
notReadyValidation.status = "waiting_for_teacher_review";
notReadyValidation.reviewedDisabledRules = [];
const notReadyValidationPath = join(root, "not-ready-rule-dsl-review-validation.json");
writeJson(notReadyValidationPath, notReadyValidation);
const notReadyRun = runKnowledge(
  "create-rag-reviewed-disabled-rule-package.mjs",
  ["--review-validation", notReadyValidationPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "not-ready-package")],
  false
);
if (!notReadyRun.stderr.includes("not a locked handoff")) {
  throw new Error("Reviewed disabled rule package must reject non-ready review validation.");
}

const activeRuleValidation = readJson(reviewValidationPath);
const activeRule = readJson(activeRuleValidation.reviewedDisabledRules[0].rulePath);
activeRule.lifecycle = "active";
activeRule.owner = { ...activeRule.owner, reviewer_id: "teacher.local", approved_at: "2026-06-13T00:00:00.000Z" };
const activeRulePath = join(root, "forbidden-active-reviewed-rule.json");
writeJson(activeRulePath, activeRule);
activeRuleValidation.reviewedDisabledRules[0] = {
  ...activeRuleValidation.reviewedDisabledRules[0],
  rulePath: activeRulePath
};
const activeRuleValidationPath = join(root, "active-rule-review-validation.json");
writeJson(activeRuleValidationPath, activeRuleValidation);
const activeRuleRun = runKnowledge(
  "create-rag-reviewed-disabled-rule-package.mjs",
  ["--review-validation", activeRuleValidationPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "active-rule-package")],
  false
);
if (!activeRuleRun.stdout.includes("REVIEWED_RULE_MUST_REMAIN_DRAFT_DISABLED")) {
  throw new Error("Reviewed disabled rule package must reject active rules.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_reviewed_disabled_rule_package_smoke_v1",
      packagePath: packageResult.packagePath,
      compiledRulePackagePath: packet.compiledRulePackagePath,
      disabledRuleCount: packet.disabledRuleCount,
      rejectedMissingTeacherReviewedFlag: true,
      rejectedNotReadyValidation: true,
      rejectedActiveRule: true,
      locks: packet.locks
    },
    null,
    2
  )
);
