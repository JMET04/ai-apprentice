#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-disabled-rule-package-planning-logic-context");
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

const reviewPlanningSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-rule-dsl-review-planning-logic-context.mjs"),
  []
);
const reviewPlanningSmokeResult = JSON.parse(reviewPlanningSmoke.stdout);
const reviewValidation = readJson(reviewPlanningSmokeResult.validationPath);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-disabled-rule-package-planning-logic-context",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const packageRun = runKnowledge("create-rag-reviewed-disabled-rule-package.mjs", [
  "--review-validation",
  reviewPlanningSmokeResult.validationPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "package")
]);
const packageResult = JSON.parse(packageRun.stdout);
const packet = readJson(packageResult.packagePath);

if (!reviewValidation.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL review validation fixture should expose upstream planning logic hints.");
}
if (!packet.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source disabled rule package should preserve upstream planning logic hints.");
}
if (packet.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source disabled rule package should preserve confirmed planning logic evidence reviews.");
}
if (!packet.planningLogicEvidenceHash || packet.planningLogicEvidenceHash !== reviewValidation.planningLogicEvidenceHash) {
  throw new Error("Primary-source disabled rule package should preserve the upstream planning logic evidence hash.");
}
if (packet.nextReview.planningLogicEvidenceHash !== packet.planningLogicEvidenceHash) {
  throw new Error("Primary-source disabled rule package should expose the planning logic evidence hash for package review.");
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
  throw new Error("Primary-source disabled rule package planning logic flow must keep activation, memory, software, external fetch, and packaging locks.");
}

const tampered = readJson(reviewPlanningSmokeResult.validationPath);
tampered.planningLogicEvidence.logicExtractionHints = [];
const tamperedPath = join(root, "tampered-planning-logic-review-validation.json");
writeJson(tamperedPath, tampered);
const tamperedRun = runKnowledge(
  "create-rag-reviewed-disabled-rule-package.mjs",
  ["--review-validation", tamperedPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "tampered-package")],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("DISABLED_RULE_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source disabled rule package must reject tampered planning logic evidence.");
}

const tamperedNextReview = readJson(reviewPlanningSmokeResult.validationPath);
tamperedNextReview.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewPath = join(root, "tampered-next-review-planning-logic-review-validation.json");
writeJson(tamperedNextReviewPath, tamperedNextReview);
const tamperedNextReviewRun = runKnowledge(
  "create-rag-reviewed-disabled-rule-package.mjs",
  [
    "--review-validation",
    tamperedNextReviewPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-next-review-package")
  ],
  false
);
if (
  !`${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`.includes(
    "DISABLED_RULE_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source disabled rule package must reject tampered next-review planning logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_disabled_rule_package_planning_logic_context_smoke_v1",
      reviewValidationPath: reviewPlanningSmokeResult.validationPath,
      packagePath: packageResult.packagePath,
      compiledRulePackagePath: packet.compiledRulePackagePath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      locks: packet.locks
    },
    null,
    2
  )
);
