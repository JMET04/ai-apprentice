#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".transparent-apprentice", "smoke", "rag-confirmed-source-registry-package");
mkdirSync(root, { recursive: true });

function runNode(script, args, expectOk = true) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", "knowledge", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${script} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${script} unexpectedly passed:\nSTDOUT:\n${result.stdout}`);
  }
  return result;
}

const queueRun = runNode("create-rag-research-intake-queue.mjs", ["--out-dir", join(root, "queue")]);
const queueResult = JSON.parse(queueRun.stdout);
const builderRun = runNode("create-rag-research-intake-receipt-builder.mjs", [
  "--queue",
  queueResult.queuePath,
  "--out-dir",
  join(root, "builder")
]);
const builderResult = JSON.parse(builderRun.stdout);
const receipt = readJson(builderResult.templatePath);
receipt.decision = "teacher_confirms_adviser_extraction";
receipt.sourceReviews = receipt.sourceReviews.map((row) =>
  row.candidateId === "adviser_wechat_rag_direction_note"
    ? {
        ...row,
        decision: "teacher_supplied_confirmed",
        evidenceReviewed: true,
        trustLevelAfterReview: "teacher_supplied",
        permissionStatus: "teacher_supplied",
        reviewerNote: "Teacher confirms this adviser extraction as a seed source."
      }
    : row
);
const receiptPath = join(root, "teacher-confirmed-rag-intake-receipt.json");
writeJson(receiptPath, receipt);

const validationRun = runNode("validate-rag-research-intake-receipt.mjs", [
  "--queue",
  queueResult.queuePath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validationResult = JSON.parse(validationRun.stdout);
const registryRun = runNode("create-rag-confirmed-source-registry-package.mjs", [
  "--validation",
  validationResult.validationPath,
  "--out-dir",
  join(root, "registry")
]);
const registryResult = JSON.parse(registryRun.stdout);
const registry = readJson(registryResult.sourceRegistryPath);
const cards = readJson(registryResult.confirmedSourceCardsPath);

if (registry.format !== "transparent_ai_rag_confirmed_source_registry_package_v1") {
  throw new Error("Unexpected registry package format.");
}
if (cards.length !== 1) throw new Error("Registry package should contain exactly one confirmed adviser source card.");
if (registry.readyLocalIngestCount !== 1) throw new Error("Confirmed local adviser note should be ready for local corpus ingest.");
if (!registry.sourceRows[0].ingestCommand.includes("ingest-local-corpus.mjs")) {
  throw new Error("Registry package should prepare the existing local corpus ingest command.");
}
if (registry.locks.externalFetchPerformed !== false || registry.locks.ruleEnabled !== false || registry.locks.packagingUnlocked !== false) {
  throw new Error("Registry package must keep external fetch, rules, and packaging locked.");
}

const waitingValidation = structuredClone(readJson(validationResult.validationPath));
waitingValidation.status = "waiting_for_teacher_review";
waitingValidation.confirmedSources = [];
const waitingValidationPath = join(root, "waiting-validation.json");
writeJson(waitingValidationPath, waitingValidation);
const blockedRun = runNode(
  "create-rag-confirmed-source-registry-package.mjs",
  ["--validation", waitingValidationPath, "--out-dir", join(root, "blocked-registry")],
  false
);
if (!blockedRun.stderr.includes("not ready for confirmed source ingest")) {
  throw new Error("Registry package must reject validation that is not ready.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_confirmed_source_registry_package_smoke_v1",
      validationPath: validationResult.validationPath,
      sourceRegistryPath: registryResult.sourceRegistryPath,
      confirmedSourceCardsPath: registryResult.confirmedSourceCardsPath,
      readyLocalIngestCount: registry.readyLocalIngestCount,
      rejectedWaitingValidation: true,
      locks: registry.locks
    },
    null,
    2
  )
);
