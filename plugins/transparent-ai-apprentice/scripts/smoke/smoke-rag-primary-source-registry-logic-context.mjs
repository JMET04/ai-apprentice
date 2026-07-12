#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-registry-logic-context");

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

const logicContextSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-evidence-request-logic-context.mjs"), []);
const logicContextResult = JSON.parse(logicContextSmoke.stdout);

const registryRun = runKnowledge("create-rag-confirmed-source-registry-package.mjs", [
  "--validation",
  logicContextResult.validationPath,
  "--out-dir",
  root
]);
const registryResult = JSON.parse(registryRun.stdout);
const registry = readJson(registryResult.sourceRegistryPath);

if (registry.sourceRegistryFollowUpKind !== "primary_source_evidence_follow_up") {
  throw new Error("Primary-source registry logic context should keep the primary-source follow-up kind.");
}
if (!registry.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source registry should preserve upstream planning logic hints.");
}
if (registry.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source registry should preserve confirmed upstream logic evidence reviews.");
}
if (!registry.planningLogicEvidenceHash || registry.nextReview.planningLogicEvidenceHash !== registry.planningLogicEvidenceHash) {
  throw new Error("Primary-source registry should expose the planning logic evidence hash for next review.");
}
if (!registry.sourceRows[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source registry should still preserve the new source logic extraction hint.");
}
if (
  registry.locks.externalFetchPerformed !== false ||
  registry.locks.softwareActionsExecuted !== false ||
  registry.locks.ruleEnabled !== false ||
  registry.locks.memoryEnabled !== false ||
  registry.locks.packagingUnlocked !== false ||
  registry.nextReview.mayFetchExternalSources !== false ||
  registry.nextReview.mayExecuteSoftware !== false ||
  registry.nextReview.mayUnlockPackaging !== false
) {
  throw new Error("Primary-source registry logic context must keep fetch, execution, rules, memory, and packaging locked.");
}

const validation = readJson(logicContextResult.validationPath);
const tamperedValidation = structuredClone(validation);
tamperedValidation.planningLogicEvidence.logicExtractionHints = [];
const tamperedValidationPath = join(root, "tampered-primary-source-validation-planning-logic.json");
writeJson(tamperedValidationPath, tamperedValidation);
const tamperedRun = runKnowledge(
  "create-rag-confirmed-source-registry-package.mjs",
  ["--validation", tamperedValidationPath, "--out-dir", join(root, "tampered-registry")],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("RAG_CONFIRMED_SOURCE_REGISTRY_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source registry must reject tampered validation planning logic evidence.");
}

const tamperedNextReviewValidation = structuredClone(validation);
tamperedNextReviewValidation.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewValidationPath = join(root, "tampered-primary-source-validation-next-review-planning-logic.json");
writeJson(tamperedNextReviewValidationPath, tamperedNextReviewValidation);
const tamperedNextReviewRun = runKnowledge(
  "create-rag-confirmed-source-registry-package.mjs",
  ["--validation", tamperedNextReviewValidationPath, "--out-dir", join(root, "tampered-next-review-registry")],
  false
);
if (
  !`${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`.includes(
    "RAG_CONFIRMED_SOURCE_REGISTRY_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source registry must reject tampered validation next-review planning logic evidence.");
}

const tamperedNextReviewHashValidation = structuredClone(validation);
tamperedNextReviewHashValidation.nextReview.planningLogicEvidenceHash = "tampered-next-review-planning-logic-evidence-hash";
const tamperedNextReviewHashValidationPath = join(root, "tampered-primary-source-validation-next-review-planning-logic-hash.json");
writeJson(tamperedNextReviewHashValidationPath, tamperedNextReviewHashValidation);
const tamperedNextReviewHashRun = runKnowledge(
  "create-rag-confirmed-source-registry-package.mjs",
  ["--validation", tamperedNextReviewHashValidationPath, "--out-dir", join(root, "tampered-next-review-hash-registry")],
  false
);
if (
  !`${tamperedNextReviewHashRun.stdout}\n${tamperedNextReviewHashRun.stderr}`.includes(
    "RAG_CONFIRMED_SOURCE_REGISTRY_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source registry must reject tampered validation next-review planning logic evidence hash.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_registry_logic_context_smoke_v1",
      validationPath: logicContextResult.validationPath,
      sourceRegistryPath: registryResult.sourceRegistryPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      preservedSourceLogicExtractionHint: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidenceHash: true,
      locks: registry.locks
    },
    null,
    2
  )
);
