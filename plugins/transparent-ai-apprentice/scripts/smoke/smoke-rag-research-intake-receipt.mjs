#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".transparent-apprentice", "smoke", "rag-research-intake-receipt");
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
const template = readJson(builderResult.templatePath);

if (template.decision !== "needs_teacher_review") throw new Error("Receipt template must default to needs_teacher_review.");
if (!template.forbiddenDecisions.includes("cite_unverified_lead")) {
  throw new Error("Receipt template must forbid citing unverified leads.");
}

const validReceipt = structuredClone(template);
validReceipt.decision = "teacher_confirms_adviser_extraction";
validReceipt.sourceReviews = validReceipt.sourceReviews.map((row) => {
  if (row.candidateId === "adviser_wechat_rag_direction_note") {
    return {
      ...row,
      decision: "teacher_supplied_confirmed",
      evidenceReviewed: true,
      trustLevelAfterReview: "teacher_supplied",
      permissionStatus: "teacher_supplied",
      reviewerNote: "Teacher confirms the screenshot extraction is faithful."
    };
  }
  if (row.candidateId === "zhejiang_university_research_lead") {
    return {
      ...row,
      decision: "ready_for_primary_source_research",
      evidenceReviewed: false,
      reviewerNote: "Keep as a lead until primary sources are found."
    };
  }
  return row;
});
const validReceiptPath = join(root, "valid-rag-research-intake-receipt.json");
writeJson(validReceiptPath, validReceipt);

const validationRun = runNode("validate-rag-research-intake-receipt.mjs", [
  "--queue",
  queueResult.queuePath,
  "--receipt",
  validReceiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validationResult = JSON.parse(validationRun.stdout);
const validation = readJson(validationResult.validationPath);

if (validation.status !== "ready_for_review_only_confirmed_source_ingest") {
  throw new Error("Valid receipt should prepare review-only confirmed source ingest.");
}
if (validation.confirmedSources.length !== 1) throw new Error("Only the teacher-supplied adviser note should be confirmed.");
if (validation.locks.ruleEnabled !== false || validation.locks.softwareActionsExecuted !== false) {
  throw new Error("Validation must keep rule and execution locks closed.");
}

const invalidCitationReceipt = structuredClone(template);
invalidCitationReceipt.decision = "teacher_confirms_adviser_extraction";
invalidCitationReceipt.sourceReviews = invalidCitationReceipt.sourceReviews.map((row) =>
  row.candidateId === "zhejiang_university_research_lead"
    ? { ...row, decision: "verified_public_reference", evidenceReviewed: true, primarySourceUri: "", primarySourceTitle: "", primarySourceLocator: "" }
    : row
);
const invalidCitationReceiptPath = join(root, "invalid-zhejiang-citation-receipt.json");
writeJson(invalidCitationReceiptPath, invalidCitationReceipt);
const invalidCitationRun = runNode(
  "validate-rag-research-intake-receipt.mjs",
  ["--queue", queueResult.queuePath, "--receipt", invalidCitationReceiptPath, "--out-dir", join(root, "invalid-citation-validation")],
  false
);
if (!invalidCitationRun.stdout.includes("VERIFIED_REFERENCE_REQUIRES_PRIMARY_SOURCE_URI")) {
  throw new Error("Unverified Zhejiang lead should fail without a primary source URI.");
}

const forbiddenReceipt = structuredClone(template);
forbiddenReceipt.decision = "cite_unverified_lead";
const forbiddenReceiptPath = join(root, "forbidden-rag-research-intake-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenRun = runNode(
  "validate-rag-research-intake-receipt.mjs",
  ["--queue", queueResult.queuePath, "--receipt", forbiddenReceiptPath, "--out-dir", join(root, "forbidden-validation")],
  false
);
if (!forbiddenRun.stdout.includes("TOP_LEVEL_DECISION_NOT_ALLOWED") && !forbiddenRun.stdout.includes("FORBIDDEN_TOP_LEVEL_DECISION")) {
  throw new Error("Forbidden top-level decision should fail closed.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_research_intake_receipt_smoke_v1",
      queuePath: queueResult.queuePath,
      builderPath: builderResult.builderPath,
      templatePath: builderResult.templatePath,
      validationPath: validationResult.validationPath,
      confirmedSources: validation.confirmedSources.length,
      invalidCitationBlocked: true,
      forbiddenDecisionBlocked: true,
      locks: validation.locks
    },
    null,
    2
  )
);
