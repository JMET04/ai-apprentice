#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-reviewed-rule-dsl-validation-package");
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

const reviewReceiptSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-confirmed-retrieval-draft-review-receipt.mjs"), []);
const reviewReceiptSmokeResult = JSON.parse(reviewReceiptSmoke.stdout);
const reviewValidationPath = reviewReceiptSmokeResult.validationPath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-reviewed-rule-dsl-validation-package",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const packageRun = runKnowledge("create-rag-reviewed-rule-dsl-validation-package.mjs", [
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

if (packet.format !== "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1") {
  throw new Error("RAG reviewed Rule DSL validation package should use the expected format.");
}
if (packet.status !== "ready_for_teacher_rule_dsl_review_package") {
  throw new Error("Reviewed Rule DSL validation package should be ready only for teacher rule DSL review.");
}
if (packet.validRuleCardCount !== 1 || packet.ruleValidationRows[0]?.lifecycle !== "draft_disabled") {
  throw new Error("Reviewed Rule DSL validation package must validate one draft_disabled Rule Card.");
}
if (
  packet.locks.ruleEnabled !== false ||
  packet.locks.memoryEnabled !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.packagingUnlocked !== false
) {
  throw new Error("Reviewed Rule DSL validation package must keep rule, memory, software, external fetch, and packaging locks.");
}

const notReadyValidation = readJson(reviewValidationPath);
notReadyValidation.status = "waiting_for_teacher_review";
notReadyValidation.approvedDisabledDrafts = [];
const notReadyValidationPath = join(root, "not-ready-review-validation.json");
writeJson(notReadyValidationPath, notReadyValidation);
const notReadyRun = runKnowledge(
  "create-rag-reviewed-rule-dsl-validation-package.mjs",
  ["--review-validation", notReadyValidationPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "not-ready-package")],
  false
);
if (!notReadyRun.stderr.includes("not a locked, teacher-reviewed handoff")) {
  throw new Error("Reviewed Rule DSL validation package must reject validation packets that are not ready.");
}

const activeRuleValidation = readJson(reviewValidationPath);
const activeRuleSource = readJson(activeRuleValidation.approvedDisabledDrafts[0].rulePath);
activeRuleSource.lifecycle = "active";
activeRuleSource.owner = {
  ...activeRuleSource.owner,
  reviewer_id: "teacher.local",
  approved_at: "2026-06-13T00:00:00.000Z"
};
const activeRulePath = join(root, "forbidden-active-rule.json");
writeJson(activeRulePath, activeRuleSource);
activeRuleValidation.approvedDisabledDrafts[0] = {
  ...activeRuleValidation.approvedDisabledDrafts[0],
  rulePath: activeRulePath
};
const activeRuleValidationPath = join(root, "active-rule-review-validation.json");
writeJson(activeRuleValidationPath, activeRuleValidation);
const activeRuleRun = runKnowledge(
  "create-rag-reviewed-rule-dsl-validation-package.mjs",
  ["--review-validation", activeRuleValidationPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "active-rule-package")],
  false
);
if (!activeRuleRun.stdout.includes("RULE_DRAFT_MUST_REMAIN_DRAFT_DISABLED")) {
  throw new Error("Reviewed Rule DSL validation package must reject active Rule Cards.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_reviewed_rule_dsl_validation_package_smoke_v1",
      packagePath: packageResult.packagePath,
      validRuleCardCount: packet.validRuleCardCount,
      rejectedNotReadyValidation: true,
      rejectedActiveRule: true,
      locks: packet.locks
    },
    null,
    2
  )
);
