#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-rule-dsl-validation-package");
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

const reviewSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-retrieval-draft-review-receipt.mjs"), []);
const reviewSmokeResult = JSON.parse(reviewSmoke.stdout);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_v1",
  rollbackId: "smoke-rag-primary-source-rule-dsl-validation-package",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const packageRun = runKnowledge("create-rag-reviewed-rule-dsl-validation-package.mjs", [
  "--review-validation",
  reviewSmokeResult.validationPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "package")
]);
const packageResult = JSON.parse(packageRun.stdout);
const packet = readJson(packageResult.packagePath);

if (packet.format !== "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1") {
  throw new Error("Primary-source Rule DSL validation should reuse the reviewed Rule DSL validation package format.");
}
if (packet.status !== "ready_for_teacher_rule_dsl_review_package") {
  throw new Error("Primary-source Rule DSL validation package should be ready only for teacher review.");
}
if (packet.validRuleCardCount !== 1 || packet.ruleValidationRows[0].lifecycle !== "draft_disabled") {
  throw new Error("Primary-source Rule DSL validation package must validate one draft_disabled Rule Card.");
}
if (!packet.ruleValidationRows[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL validation package should preserve the logic extraction hint.");
}
if (packet.ruleValidationRows[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source Rule DSL validation package should preserve the teacher logic-fit decision.");
}
if (!packet.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL validation package should expose logic hints for next review.");
}
if (
  packet.locks.ruleEnabled !== false ||
  packet.locks.memoryEnabled !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.packagingUnlocked !== false
) {
  throw new Error("Primary-source Rule DSL validation package must keep rule, memory, software, external fetch, and packaging locks.");
}

const tampered = readJson(reviewSmokeResult.validationPath);
tampered.approvedDisabledDrafts[0].logicFitDecision = "needs_source_or_rule_correction";
const tamperedPath = join(root, "tampered-logic-fit-review-validation.json");
writeJson(tamperedPath, tampered);
const tamperedRun = runKnowledge(
  "create-rag-reviewed-rule-dsl-validation-package.mjs",
  ["--review-validation", tamperedPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "tampered-package")],
  false
);
if (!tamperedRun.stderr.includes("RULE_DSL_VALIDATION_REQUIRES_MATCHING_LOGIC_FIT")) {
  throw new Error("Primary-source Rule DSL validation package must reject non-matching logic fit.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_rule_dsl_validation_package_smoke_v1",
      reviewValidationPath: reviewSmokeResult.validationPath,
      packagePath: packageResult.packagePath,
      validRuleCardCount: packet.validRuleCardCount,
      preservedLogicExtractionHint: true,
      preservedLogicFitDecision: true,
      rejectedNonMatchingLogicFit: true,
      locks: packet.locks
    },
    null,
    2
  )
);
