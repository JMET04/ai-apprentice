#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-registry-follow-up");

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

const primarySourceSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-evidence-request-receipt.mjs"), []);
const primarySourceResult = JSON.parse(primarySourceSmoke.stdout);

const registryRun = runKnowledge("create-rag-confirmed-source-registry-package.mjs", [
  "--validation",
  primarySourceResult.validationPath,
  "--out-dir",
  root
]);
const registryResult = JSON.parse(registryRun.stdout);
const registry = readJson(registryResult.sourceRegistryPath);
const cards = readJson(registryResult.confirmedSourceCardsPath);

if (registry.format !== "transparent_ai_rag_confirmed_source_registry_package_v1") {
  throw new Error("Primary-source registry follow-up should reuse the confirmed source registry package format.");
}
if (registry.validationFormat !== "transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1") {
  throw new Error("Primary-source registry follow-up should preserve the primary-source validation format.");
}
if (registry.sourceRegistryFollowUpKind !== "primary_source_evidence_follow_up") {
  throw new Error("Primary-source registry follow-up should mark the follow-up kind.");
}
if (registry.sourceCount !== 1 || registry.readyLocalIngestCount !== 1) {
  throw new Error("Primary-source registry follow-up should prepare one local ingest-ready source.");
}
if (!registry.sourceRows[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source registry follow-up should preserve the logic extraction hint on source rows.");
}
if (!cards[0].review.logic_extraction_hint.includes("data-to-geometry")) {
  throw new Error("Primary-source registry follow-up should preserve the logic extraction hint on source cards.");
}
if (!registry.sourceRows[0].ingestCommand.includes("ingest-local-corpus.mjs")) {
  throw new Error("Primary-source registry follow-up should prepare the existing local corpus ingest command.");
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
  throw new Error("Primary-source registry follow-up must keep fetch, execution, rules, memory, and packaging locked.");
}

const unlockedValidation = structuredClone(readJson(primarySourceResult.validationPath));
unlockedValidation.locks.packagingUnlocked = true;
const unlockedPath = join(root, "unlocked-primary-source-validation.json");
await import("../knowledge/knowledge-core.mjs").then(({ writeJson }) => writeJson(unlockedPath, unlockedValidation));
const unlockedRun = runKnowledge(
  "create-rag-confirmed-source-registry-package.mjs",
  ["--validation", unlockedPath, "--out-dir", join(root, "unlocked-registry")],
  false
);
if (!unlockedRun.stderr.includes("Confirmed source registry package requires locked review-only validation")) {
  throw new Error("Primary-source registry follow-up must reject unlocked validation.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_registry_follow_up_smoke_v1",
      validationPath: primarySourceResult.validationPath,
      sourceRegistryPath: registryResult.sourceRegistryPath,
      confirmedSourceCardsPath: registryResult.confirmedSourceCardsPath,
      sourceRegistryFollowUpKind: registry.sourceRegistryFollowUpKind,
      readyLocalIngestCount: registry.readyLocalIngestCount,
      preservedLogicExtractionHint: true,
      rejectedUnlockedValidation: true,
      locks: registry.locks
    },
    null,
    2
  )
);
