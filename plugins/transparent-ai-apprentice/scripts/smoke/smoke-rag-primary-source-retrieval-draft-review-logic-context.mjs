#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-retrieval-draft-review-logic-context");
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

const draftSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-retrieval-draft-logic-context.mjs"), []);
const draftSmokeResult = JSON.parse(draftSmoke.stdout);
const draftPacket = readJson(draftSmokeResult.runPath);
const tamperedDraftRun = structuredClone(draftPacket);
tamperedDraftRun.planningLogicEvidence.logicExtractionHints = [];
const tamperedDraftRunPath = join(root, "tampered-retrieval-draft-run-planning-logic.json");
writeJson(tamperedDraftRunPath, tamperedDraftRun);
const tamperedBuilderRun = runKnowledge(
  "create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs",
  ["--retrieval-draft-run", tamperedDraftRunPath, "--out-dir", join(root, "tampered-builder")],
  false
);
if (!`${tamperedBuilderRun.stdout}\n${tamperedBuilderRun.stderr}`.includes("RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source retrieval review receipt builder must reject tampered run planning logic evidence.");
}

const tamperedNextReviewDraftRun = structuredClone(draftPacket);
tamperedNextReviewDraftRun.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewDraftRunPath = join(root, "tampered-retrieval-draft-run-next-review-planning-logic.json");
writeJson(tamperedNextReviewDraftRunPath, tamperedNextReviewDraftRun);
const tamperedNextReviewBuilderRun = runKnowledge(
  "create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs",
  ["--retrieval-draft-run", tamperedNextReviewDraftRunPath, "--out-dir", join(root, "tampered-next-review-builder")],
  false
);
if (!`${tamperedNextReviewBuilderRun.stdout}\n${tamperedNextReviewBuilderRun.stderr}`.includes("RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source retrieval review receipt builder must reject tampered run next-review planning logic evidence.");
}

const tamperedNextReviewHashDraftRun = structuredClone(draftPacket);
tamperedNextReviewHashDraftRun.nextReview.planningLogicEvidenceHash = "tampered-next-review-planning-logic-evidence-hash";
const tamperedNextReviewHashDraftRunPath = join(root, "tampered-retrieval-draft-run-next-review-planning-logic-hash.json");
writeJson(tamperedNextReviewHashDraftRunPath, tamperedNextReviewHashDraftRun);
const tamperedNextReviewHashBuilderRun = runKnowledge(
  "create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs",
  ["--retrieval-draft-run", tamperedNextReviewHashDraftRunPath, "--out-dir", join(root, "tampered-next-review-hash-builder")],
  false
);
if (
  !`${tamperedNextReviewHashBuilderRun.stdout}\n${tamperedNextReviewHashBuilderRun.stderr}`.includes(
    "RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source retrieval review receipt builder must reject tampered run next-review planning logic evidence hash.");
}

const builderRun = runKnowledge("create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs", [
  "--retrieval-draft-run",
  draftSmokeResult.runPath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);

if (!receipt.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source retrieval review receipt should expose upstream planning logic hints.");
}
if (receipt.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source retrieval review receipt should expose confirmed upstream logic evidence reviews.");
}
if (!receipt.planningLogicEvidenceHash) {
  throw new Error("Primary-source retrieval review receipt should expose a planning logic evidence hash.");
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
        reviewerNote: "Teacher confirmed the disabled draft matches both source hints and upstream planning logic evidence."
      }
    : row
);
const receiptPath = join(root, "teacher-reviewed-retrieval-draft-logic-context-receipt.json");
writeJson(receiptPath, receipt);

const tamperedValidationRun = runKnowledge(
  "validate-rag-confirmed-retrieval-draft-review-receipt.mjs",
  ["--retrieval-draft-run", tamperedDraftRunPath, "--receipt", receiptPath, "--out-dir", join(root, "tampered-run-validation")],
  false
);
if (!tamperedValidationRun.stdout.includes("RETRIEVAL_REVIEW_RUN_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source retrieval review validation must reject tampered run planning logic evidence.");
}

const tamperedNextReviewValidationRun = runKnowledge(
  "validate-rag-confirmed-retrieval-draft-review-receipt.mjs",
  [
    "--retrieval-draft-run",
    tamperedNextReviewDraftRunPath,
    "--receipt",
    receiptPath,
    "--out-dir",
    join(root, "tampered-next-review-run-validation")
  ],
  false
);
if (!tamperedNextReviewValidationRun.stdout.includes("RETRIEVAL_REVIEW_RUN_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source retrieval review validation must reject tampered run next-review planning logic evidence.");
}

const tamperedNextReviewHashValidationRun = runKnowledge(
  "validate-rag-confirmed-retrieval-draft-review-receipt.mjs",
  [
    "--retrieval-draft-run",
    tamperedNextReviewHashDraftRunPath,
    "--receipt",
    receiptPath,
    "--out-dir",
    join(root, "tampered-next-review-hash-run-validation")
  ],
  false
);
if (!tamperedNextReviewHashValidationRun.stdout.includes("RETRIEVAL_REVIEW_RUN_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source retrieval review validation must reject tampered run next-review planning logic evidence hash.");
}

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
  throw new Error("Primary-source retrieval review logic context should prepare review-only Rule DSL validation.");
}
if (!validation.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source retrieval review validation should preserve planning logic evidence hints.");
}
if (validation.nextReview.planningLogicEvidenceHash !== receipt.planningLogicEvidenceHash) {
  throw new Error("Primary-source retrieval review validation should preserve planning logic evidence hash.");
}

const tamperedReceipt = structuredClone(receipt);
tamperedReceipt.planningLogicEvidence.logicExtractionHints = [];
const tamperedReceiptPath = join(root, "tampered-retrieval-review-logic-context-receipt.json");
writeJson(tamperedReceiptPath, tamperedReceipt);
const tamperedRun = runKnowledge(
  "validate-rag-confirmed-retrieval-draft-review-receipt.mjs",
  ["--retrieval-draft-run", draftSmokeResult.runPath, "--receipt", tamperedReceiptPath, "--out-dir", join(root, "tampered-validation")],
  false
);
if (!tamperedRun.stdout.includes("RETRIEVAL_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source retrieval review validation must reject tampered planning logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_retrieval_draft_review_logic_context_smoke_v1",
      draftRunPath: draftSmokeResult.runPath,
      templatePath: builder.templatePath,
      validationPath: validationResult.validationPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedRunPlanningLogicEvidence: true,
      rejectedTamperedRunNextReviewPlanningLogicEvidence: true,
      rejectedTamperedRunNextReviewPlanningLogicEvidenceHash: true,
      rejectedTamperedPlanningLogicEvidence: true,
      locks: validation.locks
    },
    null,
    2
  )
);
