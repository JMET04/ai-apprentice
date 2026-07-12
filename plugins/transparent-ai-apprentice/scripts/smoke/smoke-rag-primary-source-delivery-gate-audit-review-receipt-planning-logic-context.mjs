#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-delivery-gate-audit-review-receipt-planning-logic-context");
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

const auditSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-delivery-gate-audit-trail-planning-logic-context.mjs"),
  []
);
const auditSmokeResult = JSON.parse(auditSmoke.stdout);
const auditTrail = readJson(auditSmokeResult.auditPath);
const tamperedAuditTrail = structuredClone(auditTrail);
tamperedAuditTrail.planningLogicEvidence.logicExtractionHints = [];
const tamperedAuditTrailPath = join(root, "tampered-audit-trail-planning-logic.json");
writeJson(tamperedAuditTrailPath, tamperedAuditTrail);
const tamperedBuilderRun = runKnowledge(
  "create-rag-delivery-gate-audit-review-receipt-builder.mjs",
  ["--audit-trail", tamperedAuditTrailPath, "--out-dir", join(root, "tampered-builder")],
  false
);
if (
  !`${tamperedBuilderRun.stdout}\n${tamperedBuilderRun.stderr}`.includes(
    "RAG_AUDIT_REVIEW_BUILDER_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source audit review receipt builder must reject tampered audit planning logic evidence.");
}

const tamperedNextReviewAuditTrail = structuredClone(auditTrail);
tamperedNextReviewAuditTrail.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewAuditTrailPath = join(root, "tampered-next-review-audit-trail-planning-logic.json");
writeJson(tamperedNextReviewAuditTrailPath, tamperedNextReviewAuditTrail);
const tamperedNextReviewBuilderRun = runKnowledge(
  "create-rag-delivery-gate-audit-review-receipt-builder.mjs",
  ["--audit-trail", tamperedNextReviewAuditTrailPath, "--out-dir", join(root, "tampered-next-review-builder")],
  false
);
if (
  !`${tamperedNextReviewBuilderRun.stdout}\n${tamperedNextReviewBuilderRun.stderr}`.includes(
    "RAG_AUDIT_REVIEW_BUILDER_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source audit review receipt builder must reject tampered next-review audit planning logic evidence.");
}

const builderRun = runKnowledge("create-rag-delivery-gate-audit-review-receipt-builder.mjs", [
  "--audit-trail",
  auditSmokeResult.auditPath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);

if (!auditTrail.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit trail fixture should expose upstream planning logic hints.");
}
if (!receipt.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit review receipt should preserve upstream planning logic hints.");
}
if (receipt.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source audit review receipt should preserve confirmed planning logic evidence reviews.");
}
if (!receipt.planningLogicEvidenceHash || receipt.planningLogicEvidenceHash !== auditTrail.planningLogicEvidenceHash) {
  throw new Error("Primary-source audit review receipt should preserve the upstream planning logic evidence hash.");
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
receipt.reviewerNote =
  "Teacher reviewed the audit trail, planning logic evidence, and primary-source logic evidence; it may only prepare a review-only follow-up queue.";
const receiptPath = join(root, "teacher-reviewed-primary-source-audit-planning-logic-receipt.json");
writeJson(receiptPath, receipt);

const tamperedAuditValidationRun = runKnowledge(
  "validate-rag-delivery-gate-audit-review-receipt.mjs",
  ["--audit-trail", tamperedAuditTrailPath, "--receipt", receiptPath, "--out-dir", join(root, "tampered-audit-validation")],
  false
);
if (!tamperedAuditValidationRun.stdout.includes("AUDIT_REVIEW_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source audit review validation must reject tampered audit planning logic evidence.");
}

const tamperedNextReviewAuditValidationRun = runKnowledge(
  "validate-rag-delivery-gate-audit-review-receipt.mjs",
  [
    "--audit-trail",
    tamperedNextReviewAuditTrailPath,
    "--receipt",
    receiptPath,
    "--out-dir",
    join(root, "tampered-next-review-audit-validation")
  ],
  false
);
if (!tamperedNextReviewAuditValidationRun.stdout.includes("AUDIT_REVIEW_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source audit review validation must reject tampered next-review audit planning logic evidence.");
}

const validationRun = runKnowledge("validate-rag-delivery-gate-audit-review-receipt.mjs", [
  "--audit-trail",
  auditSmokeResult.auditPath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validation = JSON.parse(validationRun.stdout);
const validationPacket = readJson(validation.validationPath);

if (validationPacket.status !== "ready_for_review_only_follow_up_queue") {
  throw new Error("Primary-source audit review planning logic validation should prepare only a review-only follow-up queue.");
}
if (!validationPacket.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit review validation should preserve planning logic evidence hints.");
}
if (validationPacket.nextReview.planningLogicEvidenceHash !== receipt.planningLogicEvidenceHash) {
  throw new Error("Primary-source audit review validation should expose the planning logic evidence hash for next review.");
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
  throw new Error("Primary-source audit review planning logic validation must keep all no-action locks.");
}

const tamperedReceipt = structuredClone(receipt);
tamperedReceipt.planningLogicEvidence.logicExtractionHints = [];
const tamperedReceiptPath = join(root, "tampered-planning-logic-audit-review-receipt.json");
writeJson(tamperedReceiptPath, tamperedReceipt);
const tamperedRun = runKnowledge(
  "validate-rag-delivery-gate-audit-review-receipt.mjs",
  ["--audit-trail", auditSmokeResult.auditPath, "--receipt", tamperedReceiptPath, "--out-dir", join(root, "tampered-validation")],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("AUDIT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source audit review validation must reject tampered planning logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_delivery_gate_audit_review_receipt_planning_logic_context_smoke_v1",
      auditTrailPath: auditSmokeResult.auditPath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedAuditPlanningLogicEvidence: true,
      rejectedTamperedNextReviewAuditPlanningLogicEvidence: true,
      rejectedTamperedPlanningLogicEvidence: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
