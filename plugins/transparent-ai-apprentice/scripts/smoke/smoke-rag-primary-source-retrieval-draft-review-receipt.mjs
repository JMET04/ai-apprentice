#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-retrieval-draft-review-receipt");
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

const draftSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-retrieval-draft-follow-up.mjs"), []);
const draftSmokeResult = JSON.parse(draftSmoke.stdout);
const draftPacket = readJson(draftSmokeResult.runPath);

const builderRun = runKnowledge("create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs", [
  "--retrieval-draft-run",
  draftSmokeResult.runPath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);

if (!receipt.retrievalReviews[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source review receipt should expose the logic extraction hint.");
}

receipt.decision = "teacher_reviewed_disabled_drafts";
receipt.retrievalReviews = receipt.retrievalReviews.map((row) =>
  row.rulePath
    ? {
        ...row,
        decision: "approve_disabled_draft_for_rule_dsl_validation",
        evidenceReviewed: true,
        ruleDraftReviewed: true,
        logicExtractionHintReviewed: true,
        logicFitDecision: "matches_intended_logic",
        reviewerNote: "Teacher reviewed the evidence, draft rule, and confirms it matches the intended data-to-geometry logic."
      }
    : row
);
const receiptPath = join(root, "teacher-reviewed-primary-source-retrieval-draft-receipt.json");
writeJson(receiptPath, receipt);

const validationRun = runKnowledge("validate-rag-confirmed-retrieval-draft-review-receipt.mjs", [
  "--retrieval-draft-run",
  draftSmokeResult.runPath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validationResult = JSON.parse(validationRun.stdout);
const validation = readJson(validationResult.validationPath);

if (validation.status !== "ready_for_review_only_rule_dsl_validation") {
  throw new Error("Primary-source review receipt should prepare review-only Rule DSL validation.");
}
if (!validation.approvedDisabledDrafts[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source review validation should preserve the logic extraction hint.");
}
if (validation.approvedDisabledDrafts[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source review validation should preserve the teacher logic-fit decision.");
}
if (!validation.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source review validation should expose logic hints for next review.");
}
if (validation.locks.ruleEnabled !== false || validation.locks.memoryEnabled !== false || validation.locks.packagingUnlocked !== false) {
  throw new Error("Primary-source review validation must keep rules, memory, and packaging locked.");
}

const missingLogicReview = structuredClone(receipt);
missingLogicReview.retrievalReviews[0].logicExtractionHintReviewed = false;
const missingLogicPath = join(root, "missing-logic-review-receipt.json");
writeJson(missingLogicPath, missingLogicReview);
const missingLogicRun = runKnowledge(
  "validate-rag-confirmed-retrieval-draft-review-receipt.mjs",
  ["--retrieval-draft-run", draftSmokeResult.runPath, "--receipt", missingLogicPath, "--out-dir", join(root, "missing-logic-validation")],
  false
);
if (!missingLogicRun.stdout.includes("APPROVED_ROW_REQUIRES_LOGIC_EXTRACTION_HINT_REVIEW")) {
  throw new Error("Primary-source review validation must require logic hint review.");
}

const wrongFit = structuredClone(receipt);
wrongFit.retrievalReviews[0].logicFitDecision = "needs_source_or_rule_correction";
const wrongFitPath = join(root, "wrong-logic-fit-review-receipt.json");
writeJson(wrongFitPath, wrongFit);
const wrongFitRun = runKnowledge(
  "validate-rag-confirmed-retrieval-draft-review-receipt.mjs",
  ["--retrieval-draft-run", draftSmokeResult.runPath, "--receipt", wrongFitPath, "--out-dir", join(root, "wrong-fit-validation")],
  false
);
if (!wrongFitRun.stdout.includes("APPROVED_ROW_REQUIRES_MATCHING_LOGIC_FIT")) {
  throw new Error("Primary-source review validation must require matching logic fit.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_retrieval_draft_review_receipt_smoke_v1",
      draftRunPath: draftSmokeResult.runPath,
      templatePath: builder.templatePath,
      validationPath: validationResult.validationPath,
      approvedDisabledDrafts: validation.approvedDisabledDrafts.length,
      retrievalEvidenceFound: draftPacket.evidenceFoundCount,
      preservedLogicExtractionHint: true,
      rejectedMissingLogicReview: true,
      rejectedWrongLogicFit: true,
      locks: validation.locks
    },
    null,
    2
  )
);
