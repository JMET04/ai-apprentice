#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-reviewed-rule-dsl-review-receipt");
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

const packageSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-reviewed-rule-dsl-validation-package.mjs"), []);
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
receipt.decision = "teacher_reviewed_rule_dsl_validation_package";
receipt.ruleDslReviews = receipt.ruleDslReviews.map((row) => ({
  ...row,
  decision: "approve_disabled_rule_for_package_planning",
  evidenceReviewed: true,
  ruleReviewed: true,
  dslValidationReviewed: true,
  reviewerNote:
    "Teacher reviewed the retrieved evidence, disabled Rule Card, and Rule DSL validation result; this may proceed only to review-only disabled package planning."
}));
const receiptPath = join(root, "teacher-reviewed-rule-dsl-receipt.json");
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
  throw new Error("Rule DSL review receipt validation should prepare only disabled rule package planning.");
}
if (validationPacket.reviewedDisabledRules.length !== 1) {
  throw new Error("Rule DSL review receipt validation should approve one reviewed disabled rule.");
}
if (
  validationPacket.locks.ruleEnabled !== false ||
  validationPacket.locks.rulePackageCompiled !== false ||
  validationPacket.locks.memoryEnabled !== false ||
  validationPacket.locks.softwareActionsExecuted !== false ||
  validationPacket.locks.externalFetchPerformed !== false ||
  validationPacket.locks.packagingUnlocked !== false
) {
  throw new Error("Rule DSL review receipt validation must keep all rule, memory, execution, fetch, and packaging locks.");
}

const forbiddenReceipt = structuredClone(receipt);
forbiddenReceipt.decision = "enable_rule";
const forbiddenReceiptPath = join(root, "forbidden-enable-rule-dsl-review-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenRun = runKnowledge(
  "validate-rag-reviewed-rule-dsl-review-receipt.mjs",
  ["--rule-dsl-validation-package", packagePath, "--receipt", forbiddenReceiptPath, "--out-dir", join(root, "forbidden-validation")],
  false
);
if (!forbiddenRun.stdout.includes("FORBIDDEN_TOP_LEVEL_DECISION")) {
  throw new Error("Rule DSL review receipt validation must fail closed on forbidden enablement.");
}

const missingReviewReceipt = structuredClone(receipt);
missingReviewReceipt.ruleDslReviews[0].dslValidationReviewed = false;
const missingReviewReceiptPath = join(root, "missing-dsl-review-receipt.json");
writeJson(missingReviewReceiptPath, missingReviewReceipt);
const missingReviewRun = runKnowledge(
  "validate-rag-reviewed-rule-dsl-review-receipt.mjs",
  ["--rule-dsl-validation-package", packagePath, "--receipt", missingReviewReceiptPath, "--out-dir", join(root, "missing-review-validation")],
  false
);
if (!missingReviewRun.stdout.includes("APPROVED_ROW_REQUIRES_DSL_VALIDATION_REVIEW")) {
  throw new Error("Rule DSL review receipt validation must require teacher review of the DSL validation result.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_reviewed_rule_dsl_review_receipt_smoke_v1",
      packagePath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      reviewedDisabledRules: validationPacket.reviewedDisabledRules.length,
      rejectedForbiddenEnableRule: true,
      rejectedMissingDslValidationReview: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
