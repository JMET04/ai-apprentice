#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-follow-up-queue-selection-receipt");
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

const queueSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-audit-review-follow-up-queue.mjs"), []);
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
const logicRow = receipt.itemReviews.find((row) => row.itemId === "review_primary_source_logic_evidence");
if (!logicRow) {
  throw new Error("Primary-source selection receipt template should include a logic evidence review row.");
}
if (!logicRow.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source selection receipt should preserve logic extraction hints.");
}
if (!logicRow.allowedLogicEvidenceDecisions.includes("logic_evidence_confirmed")) {
  throw new Error("Primary-source selection receipt should expose a logic evidence confirmation decision.");
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
      reviewerNote: "Teacher confirmed the primary-source data-to-output logic before selecting the next lane."
    };
  }
  if (row.itemId === "choose_next_review_only_rag_step") {
    return {
      ...row,
      decision: "select_review_only_follow_up",
      selectedFollowUpDecision: "request_more_primary_sources",
      itemReviewed: true,
      noActionBoundaryReviewed: true,
      reviewerNote: "Teacher selected a review-only primary-source follow-up after confirming logic evidence."
    };
  }
  return row;
});
const receiptPath = join(root, "teacher-selected-primary-source-follow-up-receipt.json");
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
  throw new Error("Primary-source selection receipt should prepare only the selected review-only follow-up.");
}
if (validationPacket.selectedFollowUp?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source selection validation should preserve confirmed logic evidence review.");
}
if (!validationPacket.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source selection validation should carry logic extraction hints forward.");
}
if (
  validationPacket.nextReview.mayPrepareSelectedReviewOnlyFollowUp !== true ||
  validationPacket.nextReview.mayExecuteSoftware !== false ||
  validationPacket.nextReview.mayFetchExternalSources !== false ||
  validationPacket.nextReview.mayUnlockPackaging !== false ||
  validationPacket.nextReview.mayClaimGoalComplete !== false
) {
  throw new Error("Primary-source selection receipt must keep execution, fetch, packaging, and completion locked.");
}

const missingLogicReceipt = structuredClone(receipt);
missingLogicReceipt.itemReviews = missingLogicReceipt.itemReviews.map((row) =>
  row.itemId === "review_primary_source_logic_evidence"
    ? { ...row, logicEvidenceDecision: "needs_teacher_review", logicEvidenceReviewed: false }
    : row
);
const missingLogicReceiptPath = join(root, "missing-logic-confirmation-receipt.json");
writeJson(missingLogicReceiptPath, missingLogicReceipt);
const missingLogicRun = runKnowledge(
  "validate-rag-follow-up-queue-selection-receipt.mjs",
  ["--follow-up-queue", queuePath, "--receipt", missingLogicReceiptPath, "--out-dir", join(root, "missing-logic-validation")],
  false
);
if (
  !missingLogicRun.stdout.includes("SELECTION_REQUIRES_CONFIRMED_PRIMARY_SOURCE_LOGIC_EVIDENCE") ||
  !missingLogicRun.stdout.includes("SELECTION_REQUIRES_REVIEWED_PRIMARY_SOURCE_LOGIC_EVIDENCE")
) {
  throw new Error("Primary-source selection receipt must fail closed until logic evidence is confirmed.");
}

const mismatchedLogicReceipt = structuredClone(receipt);
mismatchedLogicReceipt.itemReviews = mismatchedLogicReceipt.itemReviews.map((row) =>
  row.itemId === "review_primary_source_logic_evidence" ? { ...row, logicExtractionHints: [] } : row
);
const mismatchedLogicReceiptPath = join(root, "mismatched-logic-hints-receipt.json");
writeJson(mismatchedLogicReceiptPath, mismatchedLogicReceipt);
const mismatchedLogicRun = runKnowledge(
  "validate-rag-follow-up-queue-selection-receipt.mjs",
  ["--follow-up-queue", queuePath, "--receipt", mismatchedLogicReceiptPath, "--out-dir", join(root, "mismatched-logic-validation")],
  false
);
if (!mismatchedLogicRun.stdout.includes("LOGIC_EVIDENCE_HINTS_MISMATCH")) {
  throw new Error("Primary-source selection receipt must reject mismatched logic evidence hints.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_follow_up_queue_selection_receipt_smoke_v1",
      queuePath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      preservedLogicExtractionHint: true,
      confirmedLogicEvidenceBeforeLaneSelection: true,
      rejectedMissingLogicEvidenceConfirmation: true,
      rejectedMismatchedLogicHints: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
