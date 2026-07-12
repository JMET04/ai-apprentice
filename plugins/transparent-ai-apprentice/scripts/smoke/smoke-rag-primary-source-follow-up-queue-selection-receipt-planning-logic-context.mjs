#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-follow-up-queue-selection-receipt-planning-logic-context");
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

const queueSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-audit-review-follow-up-queue-planning-logic-context.mjs"),
  []
);
const queueSmokeResult = JSON.parse(queueSmoke.stdout);
const queuePath = queueSmokeResult.queuePath;

const builderRun = runKnowledge("create-rag-follow-up-queue-selection-receipt-builder.mjs", [
  "--follow-up-queue",
  queuePath,
  "--out-dir",
  join(root, "builder")
]);
const builder = JSON.parse(builderRun.stdout);
const receipt = readJson(builder.templatePath);
const queue = readJson(queuePath);

if (!receipt.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source selection receipt should preserve upstream planning logic hints.");
}
if (!receipt.planningLogicEvidenceHash || receipt.planningLogicEvidenceHash !== queue.planningLogicEvidenceHash) {
  throw new Error("Primary-source selection receipt should preserve the planning logic evidence hash.");
}

const tamperedQueue = structuredClone(queue);
tamperedQueue.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedQueuePath = join(root, "tampered-next-review-planning-logic-queue.json");
writeJson(tamperedQueuePath, tamperedQueue);
const tamperedBuilderRun = runKnowledge(
  "create-rag-follow-up-queue-selection-receipt-builder.mjs",
  ["--follow-up-queue", tamperedQueuePath, "--out-dir", join(root, "tampered-builder")],
  false
);
if (
  !`${tamperedBuilderRun.stdout}\n${tamperedBuilderRun.stderr}`.includes(
    "FOLLOW_UP_SELECTION_BUILDER_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source selection receipt builder must reject tampered next-review planning logic evidence.");
}

const tamperedQueueHash = structuredClone(queue);
tamperedQueueHash.nextReview.planningLogicEvidenceHash = "tampered-next-review-planning-logic-evidence-hash";
const tamperedQueueHashPath = join(root, "tampered-next-review-planning-logic-hash-queue.json");
writeJson(tamperedQueueHashPath, tamperedQueueHash);
const tamperedBuilderHashRun = runKnowledge(
  "create-rag-follow-up-queue-selection-receipt-builder.mjs",
  ["--follow-up-queue", tamperedQueueHashPath, "--out-dir", join(root, "tampered-builder-hash")],
  false
);
if (
  !`${tamperedBuilderHashRun.stdout}\n${tamperedBuilderHashRun.stderr}`.includes(
    "FOLLOW_UP_SELECTION_BUILDER_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source selection receipt builder must reject tampered next-review planning logic evidence hash.");
}

receipt.decision = "teacher_selected_review_only_follow_up";
receipt.itemReviews = receipt.itemReviews.map((row) => {
  if (row.itemId === "review_primary_source_logic_evidence") {
    return {
      ...row,
      itemReviewed: true,
      noActionBoundaryReviewed: true,
      logicEvidenceReviewed: true,
      logicFitDecisionConfirmed: true,
      logicEvidenceDecision: "logic_evidence_confirmed",
      reviewerNote: "Teacher confirmed the primary-source data-to-output logic and upstream planning logic before selection."
    };
  }
  if (row.itemId === "choose_next_review_only_rag_step") {
    return {
      ...row,
      decision: "select_review_only_follow_up",
      selectedFollowUpDecision: "request_more_primary_sources",
      itemReviewed: true,
      noActionBoundaryReviewed: true,
      reviewerNote: "Teacher selected a review-only primary-source follow-up after checking planning logic context."
    };
  }
  return row;
});
const receiptPath = join(root, "teacher-selected-primary-source-follow-up-planning-logic-receipt.json");
writeJson(receiptPath, receipt);

const validationRun = runKnowledge("validate-rag-follow-up-queue-selection-receipt.mjs", [
  "--follow-up-queue",
  queuePath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validation = JSON.parse(validationRun.stdout);
const validationPacket = readJson(validation.validationPath);

if (validationPacket.status !== "ready_for_selected_review_only_rag_follow_up") {
  throw new Error("Primary-source selection planning logic validation should prepare only a selected review-only follow-up.");
}
if (!validationPacket.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source selection validation should preserve planning logic evidence hints.");
}
if (validationPacket.nextReview.planningLogicEvidenceHash !== receipt.planningLogicEvidenceHash) {
  throw new Error("Primary-source selection validation should expose the planning logic evidence hash for next review.");
}
if (validationPacket.selectedFollowUp.planningLogicEvidenceHash !== receipt.planningLogicEvidenceHash) {
  throw new Error("Primary-source selected follow-up should preserve the planning logic evidence hash.");
}
if (
  validationPacket.nextReview.mayPrepareSelectedReviewOnlyFollowUp !== true ||
  validationPacket.nextReview.mayExecuteSoftware !== false ||
  validationPacket.nextReview.mayFetchExternalSources !== false ||
  validationPacket.nextReview.mayUnlockPackaging !== false ||
  validationPacket.nextReview.mayClaimGoalComplete !== false
) {
  throw new Error("Primary-source selection planning logic validation must keep execution, fetch, packaging, and completion locked.");
}

const tamperedReceipt = structuredClone(receipt);
tamperedReceipt.planningLogicEvidence.logicExtractionHints = [];
const tamperedReceiptPath = join(root, "tampered-planning-logic-selection-receipt.json");
writeJson(tamperedReceiptPath, tamperedReceipt);
const tamperedRun = runKnowledge(
  "validate-rag-follow-up-queue-selection-receipt.mjs",
  ["--follow-up-queue", queuePath, "--receipt", tamperedReceiptPath, "--out-dir", join(root, "tampered-validation")],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("FOLLOW_UP_SELECTION_PLANNING_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source selection receipt must reject tampered planning logic evidence.");
}

const tamperedQueueValidationRun = runKnowledge(
  "validate-rag-follow-up-queue-selection-receipt.mjs",
  ["--follow-up-queue", tamperedQueuePath, "--receipt", receiptPath, "--out-dir", join(root, "tampered-queue-validation")],
  false
);
if (
  !`${tamperedQueueValidationRun.stdout}\n${tamperedQueueValidationRun.stderr}`.includes(
    "FOLLOW_UP_SELECTION_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source selection validation must reject tampered queue next-review planning logic evidence.");
}

const tamperedQueueHashValidationRun = runKnowledge(
  "validate-rag-follow-up-queue-selection-receipt.mjs",
  [
    "--follow-up-queue",
    tamperedQueueHashPath,
    "--receipt",
    receiptPath,
    "--out-dir",
    join(root, "tampered-queue-hash-validation")
  ],
  false
);
if (
  !`${tamperedQueueHashValidationRun.stdout}\n${tamperedQueueHashValidationRun.stderr}`.includes(
    "FOLLOW_UP_SELECTION_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source selection validation must reject tampered queue next-review planning logic evidence hash.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_follow_up_queue_selection_receipt_planning_logic_context_smoke_v1",
      queuePath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedBuilderNextReviewPlanningLogicEvidence: true,
      rejectedTamperedBuilderNextReviewPlanningLogicEvidenceHash: true,
      rejectedTamperedQueueNextReviewPlanningLogicEvidence: true,
      rejectedTamperedQueueNextReviewPlanningLogicEvidenceHash: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
