#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-delivery-gate-audit-review-receipt");
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

const auditSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-delivery-gate-audit-trail.mjs"), []);
const auditSmokeResult = JSON.parse(auditSmoke.stdout);
const auditTrailPath = auditSmokeResult.auditPath;

const builderRun = runKnowledge("create-rag-delivery-gate-audit-review-receipt-builder.mjs", [
  "--audit-trail",
  auditTrailPath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);

if (!receipt.logicEvidenceReviews[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit review receipt should expose the logic extraction hint.");
}
if (receipt.logicEvidenceReviews[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source audit review receipt should expose the logic-fit decision.");
}

receipt.decision = "teacher_reviewed_audit_trail_for_follow_up";
receipt.evidenceChainReviews = receipt.evidenceChainReviews.map((row) => ({
  ...row,
  decision: "reviewed_evidence_chain_step",
  evidenceReviewed: true,
  hashReviewed: true,
  reviewerNote: "Teacher reviewed this audit evidence row and confirmed it remains review-only."
}));
receipt.logicEvidenceReviews = receipt.logicEvidenceReviews.map((row) => ({
  ...row,
  decision: "reviewed_logic_evidence",
  logicEvidenceReviewed: true,
  logicFitReviewed: true,
  reviewerNote: "Teacher reviewed the primary-source logic evidence and confirmed the intended data-to-output relationship."
}));
receipt.blockedTransitionsReviewed = true;
receipt.forbiddenInterpretationsReviewed = true;
receipt.noActionLocksReviewed = true;
receipt.rollbackPointRetained = true;
receipt.reviewerNote = "Teacher reviewed the audit trail and primary-source logic evidence; it may only prepare a review-only follow-up queue.";
const receiptPath = join(root, "teacher-reviewed-primary-source-audit-receipt.json");
writeJson(receiptPath, receipt);

const validationRun = runKnowledge("validate-rag-delivery-gate-audit-review-receipt.mjs", [
  "--audit-trail",
  auditTrailPath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validation = JSON.parse(validationRun.stdout);
const validationPacket = readJson(validation.validationPath);

if (validationPacket.status !== "ready_for_review_only_follow_up_queue") {
  throw new Error("Primary-source audit review validation should prepare only a review-only follow-up queue.");
}
if (validationPacket.reviewedLogicEvidenceRows !== 1) {
  throw new Error("Primary-source audit review validation should count one reviewed logic evidence row.");
}
if (!validationPacket.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit review validation should carry logic hints into next review.");
}
if (
  validationPacket.nextReview.mayAcceptTechnology !== false ||
  validationPacket.nextReview.mayExecuteSoftware !== false ||
  validationPacket.nextReview.mayUnlockPackaging !== false
) {
  throw new Error("Primary-source audit review validation must not permit acceptance, execution, or packaging.");
}
if (
  validationPacket.locks.ruleEnabled !== false ||
  validationPacket.locks.memoryEnabled !== false ||
  validationPacket.locks.softwareActionsExecuted !== false ||
  validationPacket.locks.externalFetchPerformed !== false ||
  validationPacket.locks.packagingUnlocked !== false ||
  validationPacket.locks.deliveryGateOpen !== false
) {
  throw new Error("Primary-source audit review validation must keep all no-action locks.");
}

const missingLogicReview = structuredClone(receipt);
missingLogicReview.logicEvidenceReviews[0].logicEvidenceReviewed = false;
const missingLogicReviewPath = join(root, "missing-logic-review-receipt.json");
writeJson(missingLogicReviewPath, missingLogicReview);
const missingLogicReviewRun = runKnowledge(
  "validate-rag-delivery-gate-audit-review-receipt.mjs",
  ["--audit-trail", auditTrailPath, "--receipt", missingLogicReviewPath, "--out-dir", join(root, "missing-logic-validation")],
  false
);
if (!missingLogicReviewRun.stdout.includes("REVIEWED_LOGIC_ROW_REQUIRES_LOGIC_EVIDENCE_REVIEW")) {
  throw new Error("Primary-source audit review validation must require logic evidence review.");
}

const tamperedLogic = structuredClone(receipt);
tamperedLogic.logicEvidenceReviews[0].logicExtractionHint = "tampered different logic";
const tamperedLogicPath = join(root, "tampered-logic-review-receipt.json");
writeJson(tamperedLogicPath, tamperedLogic);
const tamperedLogicRun = runKnowledge(
  "validate-rag-delivery-gate-audit-review-receipt.mjs",
  ["--audit-trail", auditTrailPath, "--receipt", tamperedLogicPath, "--out-dir", join(root, "tampered-logic-validation")],
  false
);
if (!tamperedLogicRun.stdout.includes("AUDIT_LOGIC_EXTRACTION_HINT_MISMATCH")) {
  throw new Error("Primary-source audit review validation must reject tampered logic hints.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_delivery_gate_audit_review_receipt_smoke_v1",
      auditTrailPath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      reviewedLogicEvidenceRows: validationPacket.reviewedLogicEvidenceRows,
      rejectedMissingLogicEvidenceReview: true,
      rejectedTamperedLogicHint: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
