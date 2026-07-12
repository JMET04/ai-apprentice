#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-rule-dsl-review-planning-logic-context");
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

const validationPackageSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-rule-dsl-validation-planning-logic-context.mjs"),
  []
);
const validationPackageSmokeResult = JSON.parse(validationPackageSmoke.stdout);
const packagePath = validationPackageSmokeResult.packagePath;
const validationPackage = readJson(packagePath);
const tamperedPackage = structuredClone(validationPackage);
tamperedPackage.planningLogicEvidence.logicExtractionHints = [];
const tamperedPackagePath = join(root, "tampered-rule-dsl-validation-package-planning-logic.json");
writeJson(tamperedPackagePath, tamperedPackage);
const tamperedBuilderRun = runKnowledge(
  "create-rag-reviewed-rule-dsl-review-receipt-builder.mjs",
  ["--rule-dsl-validation-package", tamperedPackagePath, "--out-dir", join(root, "tampered-builder")],
  false
);
if (
  !`${tamperedBuilderRun.stdout}\n${tamperedBuilderRun.stderr}`.includes(
    "RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source Rule DSL review receipt builder must reject tampered package planning logic evidence.");
}

const tamperedNextReviewPackage = structuredClone(validationPackage);
tamperedNextReviewPackage.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewPackagePath = join(root, "tampered-rule-dsl-validation-package-next-review-planning-logic.json");
writeJson(tamperedNextReviewPackagePath, tamperedNextReviewPackage);
const tamperedNextReviewBuilderRun = runKnowledge(
  "create-rag-reviewed-rule-dsl-review-receipt-builder.mjs",
  ["--rule-dsl-validation-package", tamperedNextReviewPackagePath, "--out-dir", join(root, "tampered-next-review-builder")],
  false
);
if (
  !`${tamperedNextReviewBuilderRun.stdout}\n${tamperedNextReviewBuilderRun.stderr}`.includes(
    "RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source Rule DSL review receipt builder must reject tampered next-review package planning logic evidence.");
}

const builderRun = runKnowledge("create-rag-reviewed-rule-dsl-review-receipt-builder.mjs", [
  "--rule-dsl-validation-package",
  packagePath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);

if (!validationPackage.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL validation package fixture should expose upstream planning logic hints.");
}
if (!receipt.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL review receipt should preserve upstream planning logic hints.");
}
if (receipt.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source Rule DSL review receipt should preserve confirmed planning logic evidence reviews.");
}
if (!receipt.planningLogicEvidenceHash || receipt.planningLogicEvidenceHash !== validationPackage.planningLogicEvidenceHash) {
  throw new Error("Primary-source Rule DSL review receipt should preserve the upstream planning logic evidence hash.");
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
    "Teacher reviewed the upstream planning logic evidence, primary-source logic hint, disabled Rule Card, and Rule DSL validation result."
}));
const receiptPath = join(root, "teacher-reviewed-primary-source-rule-dsl-planning-logic-receipt.json");
writeJson(receiptPath, receipt);

const tamperedPackageValidationRun = runKnowledge(
  "validate-rag-reviewed-rule-dsl-review-receipt.mjs",
  ["--rule-dsl-validation-package", tamperedPackagePath, "--receipt", receiptPath, "--out-dir", join(root, "tampered-package-validation")],
  false
);
if (!tamperedPackageValidationRun.stdout.includes("RULE_DSL_REVIEW_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source Rule DSL review validation must reject tampered package planning logic evidence.");
}

const tamperedNextReviewPackageValidationRun = runKnowledge(
  "validate-rag-reviewed-rule-dsl-review-receipt.mjs",
  [
    "--rule-dsl-validation-package",
    tamperedNextReviewPackagePath,
    "--receipt",
    receiptPath,
    "--out-dir",
    join(root, "tampered-next-review-package-validation")
  ],
  false
);
if (!tamperedNextReviewPackageValidationRun.stdout.includes("RULE_DSL_REVIEW_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source Rule DSL review validation must reject tampered next-review package planning logic evidence.");
}

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
  throw new Error("Primary-source Rule DSL review planning logic validation should prepare only disabled rule package planning.");
}
if (!validationPacket.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source Rule DSL review validation should preserve planning logic evidence hints.");
}
if (validationPacket.nextReview.planningLogicEvidenceHash !== receipt.planningLogicEvidenceHash) {
  throw new Error("Primary-source Rule DSL review validation should expose the planning logic evidence hash for next review.");
}
if (
  validationPacket.locks.ruleEnabled !== false ||
  validationPacket.locks.rulePackageCompiled !== false ||
  validationPacket.locks.memoryEnabled !== false ||
  validationPacket.locks.softwareActionsExecuted !== false ||
  validationPacket.locks.externalFetchPerformed !== false ||
  validationPacket.locks.packagingUnlocked !== false
) {
  throw new Error("Primary-source Rule DSL review planning logic validation must keep all locks closed.");
}

const tamperedReceipt = structuredClone(receipt);
tamperedReceipt.planningLogicEvidence.logicExtractionHints = [];
const tamperedReceiptPath = join(root, "tampered-planning-logic-rule-dsl-review-receipt.json");
writeJson(tamperedReceiptPath, tamperedReceipt);
const tamperedRun = runKnowledge(
  "validate-rag-reviewed-rule-dsl-review-receipt.mjs",
  ["--rule-dsl-validation-package", packagePath, "--receipt", tamperedReceiptPath, "--out-dir", join(root, "tampered-validation")],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("RULE_DSL_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source Rule DSL review validation must reject tampered planning logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_rule_dsl_review_planning_logic_context_smoke_v1",
      packagePath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedPackagePlanningLogicEvidence: true,
      rejectedTamperedNextReviewPackagePlanningLogicEvidence: true,
      rejectedTamperedPlanningLogicEvidence: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
