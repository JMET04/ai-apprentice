#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-delivery-gate-audit-review-receipt");
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

const auditSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-delivery-gate-audit-trail.mjs"), []);
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
receipt.decision = "teacher_reviewed_audit_trail_for_follow_up";
receipt.evidenceChainReviews = receipt.evidenceChainReviews.map((row) => ({
  ...row,
  decision: "reviewed_evidence_chain_step",
  evidenceReviewed: true,
  hashReviewed: true,
  reviewerNote: "Teacher reviewed this audit evidence row and confirmed it remains review-only."
}));
receipt.blockedTransitionsReviewed = true;
receipt.forbiddenInterpretationsReviewed = true;
receipt.noActionLocksReviewed = true;
receipt.rollbackPointRetained = true;
receipt.reviewerNote = "Teacher reviewed the audit trail; it may only prepare a review-only follow-up queue.";
const receiptPath = join(root, "teacher-reviewed-audit-trail-receipt.json");
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
  throw new Error("Audit review receipt validation should prepare only a review-only follow-up queue.");
}
if (validationPacket.reviewedEvidenceRows !== receipt.evidenceChainReviews.length) {
  throw new Error("Audit review receipt validation should review every evidence chain row.");
}
if (
  validationPacket.nextReview.mayPrepareReviewOnlyFollowUpQueue !== true ||
  validationPacket.nextReview.mayAcceptTechnology !== false ||
  validationPacket.nextReview.mayExecuteSoftware !== false ||
  validationPacket.nextReview.mayUnlockPackaging !== false
) {
  throw new Error("Audit review receipt validation must not permit acceptance, execution, or packaging.");
}
if (
  validationPacket.locks.ruleEnabled !== false ||
  validationPacket.locks.memoryEnabled !== false ||
  validationPacket.locks.softwareActionsExecuted !== false ||
  validationPacket.locks.externalFetchPerformed !== false ||
  validationPacket.locks.packagingUnlocked !== false ||
  validationPacket.locks.deliveryGateOpen !== false
) {
  throw new Error("Audit review receipt validation must keep all no-action locks.");
}

const forbiddenReceipt = structuredClone(receipt);
forbiddenReceipt.decision = "accepted";
const forbiddenReceiptPath = join(root, "forbidden-accepted-audit-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenRun = runKnowledge(
  "validate-rag-delivery-gate-audit-review-receipt.mjs",
  ["--audit-trail", auditTrailPath, "--receipt", forbiddenReceiptPath, "--out-dir", join(root, "forbidden-validation")],
  false
);
if (!forbiddenRun.stdout.includes("TOP_LEVEL_DECISION_NOT_ALLOWED") && !forbiddenRun.stdout.includes("FORBIDDEN_TOP_LEVEL_DECISION")) {
  throw new Error("Audit review receipt validation must fail closed on acceptance.");
}

const missingForbiddenReview = structuredClone(receipt);
missingForbiddenReview.forbiddenInterpretationsReviewed = false;
const missingForbiddenReviewPath = join(root, "missing-forbidden-interpretations-review.json");
writeJson(missingForbiddenReviewPath, missingForbiddenReview);
const missingForbiddenRun = runKnowledge(
  "validate-rag-delivery-gate-audit-review-receipt.mjs",
  ["--audit-trail", auditTrailPath, "--receipt", missingForbiddenReviewPath, "--out-dir", join(root, "missing-forbidden-validation")],
  false
);
if (!missingForbiddenRun.stdout.includes("FOLLOW_UP_DECISION_REQUIRES_FORBIDDEN_INTERPRETATIONS_REVIEW")) {
  throw new Error("Audit review receipt validation must require forbidden interpretation review.");
}

const missingRollbackReview = structuredClone(receipt);
missingRollbackReview.rollbackPointRetained = false;
const missingRollbackReviewPath = join(root, "missing-rollback-review.json");
writeJson(missingRollbackReviewPath, missingRollbackReview);
const missingRollbackRun = runKnowledge(
  "validate-rag-delivery-gate-audit-review-receipt.mjs",
  ["--audit-trail", auditTrailPath, "--receipt", missingRollbackReviewPath, "--out-dir", join(root, "missing-rollback-validation")],
  false
);
if (!missingRollbackRun.stdout.includes("FOLLOW_UP_DECISION_REQUIRES_RETAINED_ROLLBACK_POINT")) {
  throw new Error("Audit review receipt validation must require retained rollback review.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_delivery_gate_audit_review_receipt_smoke_v1",
      auditTrailPath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      reviewedEvidenceRows: validationPacket.reviewedEvidenceRows,
      rejectedForbiddenAcceptance: true,
      rejectedMissingForbiddenInterpretationsReview: true,
      rejectedMissingRollbackReview: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
