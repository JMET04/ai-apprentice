#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-rule-dsl-review-receipt");
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

const packageSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-rule-dsl-validation-package.mjs"), []);
const packageSmokeResult = JSON.parse(packageSmoke.stdout);
const packagePath = packageSmokeResult.packagePath;

const builderRun = runKnowledge("create-rag-reviewed-rule-dsl-review-receipt-builder.mjs", [
  "--rule-dsl-validation-package",
  packagePath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);

if (!receipt.ruleDslReviews[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL review receipt template should preserve the logic extraction hint.");
}
if (receipt.ruleDslReviews[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source Rule DSL review receipt template should preserve the logic-fit decision.");
}

receipt.decision = "teacher_reviewed_rule_dsl_validation_package";
receipt.ruleDslReviews = receipt.ruleDslReviews.map((row) => ({
  ...row,
  decision: "approve_disabled_rule_for_package_planning",
  evidenceReviewed: true,
  ruleReviewed: true,
  dslValidationReviewed: true,
  logicExtractionHintReviewed: true,
  logicFitDecisionReviewed: true,
  reviewerNote:
    "Teacher reviewed the primary-source logic hint, matching logic-fit decision, disabled Rule Card, and Rule DSL validation result."
}));
const receiptPath = join(root, "teacher-reviewed-primary-source-rule-dsl-receipt.json");
writeJson(receiptPath, receipt);

const validationRun = runKnowledge("validate-rag-reviewed-rule-dsl-review-receipt.mjs", [
  "--rule-dsl-validation-package",
  packagePath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validation = JSON.parse(validationRun.stdout);
const validationPacket = readJson(validation.validationPath);

if (validationPacket.status !== "ready_for_review_only_disabled_rule_package_planning") {
  throw new Error("Primary-source Rule DSL review receipt validation should prepare only disabled rule package planning.");
}
if (!validationPacket.reviewedDisabledRules[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL review receipt validation should preserve the reviewed logic extraction hint.");
}
if (validationPacket.reviewedDisabledRules[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source Rule DSL review receipt validation should preserve the reviewed logic-fit decision.");
}
if (!validationPacket.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL review receipt validation should expose logic hints for next review.");
}
if (
  validationPacket.locks.ruleEnabled !== false ||
  validationPacket.locks.rulePackageCompiled !== false ||
  validationPacket.locks.memoryEnabled !== false ||
  validationPacket.locks.softwareActionsExecuted !== false ||
  validationPacket.locks.externalFetchPerformed !== false ||
  validationPacket.locks.packagingUnlocked !== false
) {
  throw new Error("Primary-source Rule DSL review receipt validation must keep all locks closed.");
}

const missingLogicReview = structuredClone(receipt);
missingLogicReview.ruleDslReviews[0].logicExtractionHintReviewed = false;
const missingLogicReviewPath = join(root, "missing-logic-review-receipt.json");
writeJson(missingLogicReviewPath, missingLogicReview);
const missingLogicReviewRun = runKnowledge(
  "validate-rag-reviewed-rule-dsl-review-receipt.mjs",
  ["--rule-dsl-validation-package", packagePath, "--receipt", missingLogicReviewPath, "--out-dir", join(root, "missing-logic-validation")],
  false
);
if (!missingLogicReviewRun.stdout.includes("APPROVED_ROW_REQUIRES_LOGIC_EXTRACTION_HINT_REVIEW")) {
  throw new Error("Primary-source Rule DSL review receipt validation must require teacher review of the logic extraction hint.");
}

const tamperedLogicFit = structuredClone(receipt);
tamperedLogicFit.ruleDslReviews[0].logicFitDecision = "needs_source_or_rule_correction";
const tamperedLogicFitPath = join(root, "tampered-logic-fit-receipt.json");
writeJson(tamperedLogicFitPath, tamperedLogicFit);
const tamperedLogicFitRun = runKnowledge(
  "validate-rag-reviewed-rule-dsl-review-receipt.mjs",
  ["--rule-dsl-validation-package", packagePath, "--receipt", tamperedLogicFitPath, "--out-dir", join(root, "tampered-logic-fit-validation")],
  false
);
if (!tamperedLogicFitRun.stdout.includes("LOGIC_FIT_DECISION_MISMATCH")) {
  throw new Error("Primary-source Rule DSL review receipt validation must reject tampered logic-fit decisions.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_rule_dsl_review_receipt_smoke_v1",
      packagePath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      reviewedDisabledRules: validationPacket.reviewedDisabledRules.length,
      preservedLogicExtractionHint: true,
      preservedLogicFitDecision: true,
      rejectedMissingLogicReview: true,
      rejectedTamperedLogicFit: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
