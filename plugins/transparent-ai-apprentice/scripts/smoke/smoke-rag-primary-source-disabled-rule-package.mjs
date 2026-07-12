#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-disabled-rule-package");
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

const reviewReceiptSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-rule-dsl-review-receipt.mjs"), []);
const reviewReceiptSmokeResult = JSON.parse(reviewReceiptSmoke.stdout);
const reviewValidationPath = reviewReceiptSmokeResult.validationPath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-disabled-rule-package",
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
  throw new Error("Primary-source disabled rule package should use the reviewed disabled Rule Package format.");
}
if (packet.status !== "ready_for_teacher_disabled_rule_package_review") {
  throw new Error("Primary-source disabled rule package should still require teacher package review.");
}
if (packet.disabledRuleCount !== 1 || compiled.rules.length !== 1) {
  throw new Error("Primary-source disabled rule package should compile exactly one reviewed disabled rule.");
}
if (!packet.stagedRules[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source disabled rule package should preserve the logic extraction hint on staged rules.");
}
if (packet.stagedRules[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source disabled rule package should preserve the logic-fit decision on staged rules.");
}
if (!packet.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source disabled rule package should expose logic hints for package review.");
}
if (compiled.rules.some((rule) => rule.lifecycle !== "draft_disabled")) {
  throw new Error("Primary-source disabled rule package must contain only draft_disabled compiled rules.");
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
  throw new Error("Primary-source disabled rule package must keep activation, memory, software, external fetch, and packaging locks.");
}

const tampered = readJson(reviewValidationPath);
tampered.reviewedDisabledRules[0].logicExtractionHint = "";
const tamperedPath = join(root, "tampered-missing-logic-hint-validation.json");
writeJson(tamperedPath, tampered);
const tamperedRun = runKnowledge("create-rag-reviewed-disabled-rule-package.mjs", [
  "--review-validation",
  tamperedPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "tampered-package")
], false);
if (!tamperedRun.stdout.includes("REVIEWED_RULE_LOGIC_EXTRACTION_HINT_MISMATCH")) {
  throw new Error("Primary-source disabled rule package must reject tampered missing logic hints.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_disabled_rule_package_smoke_v1",
      reviewValidationPath,
      packagePath: packageResult.packagePath,
      compiledRulePackagePath: packet.compiledRulePackagePath,
      disabledRuleCount: packet.disabledRuleCount,
      preservedLogicExtractionHint: true,
      preservedLogicFitDecision: true,
      rejectedTamperedMissingLogicHint: true,
      locks: packet.locks
    },
    null,
    2
  )
);
