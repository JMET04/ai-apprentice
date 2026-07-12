#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-follow-up-queue-selection-receipt");
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

const queueSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-audit-review-follow-up-queue.mjs"), []);
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
receipt.decision = "teacher_selected_review_only_follow_up";
receipt.itemReviews = receipt.itemReviews.map((row) =>
  row.itemId === "choose_next_review_only_rag_step"
    ? {
        ...row,
        decision: "select_review_only_follow_up",
        selectedFollowUpDecision: "request_more_primary_sources",
        itemReviewed: true,
        noActionBoundaryReviewed: true,
        reviewerNote: "Teacher selected only a review-only primary-source evidence follow-up."
      }
    : row
);
const receiptPath = join(root, "teacher-selected-follow-up-receipt.json");
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
  throw new Error("Follow-up queue selection receipt should prepare only the selected review-only RAG follow-up.");
}
if (validationPacket.selectedFollowUp?.selectedFollowUpDecision !== "request_more_primary_sources") {
  throw new Error("Follow-up queue selection receipt should preserve the teacher-selected review-only lane.");
}
if (
  validationPacket.nextReview.mayPrepareSelectedReviewOnlyFollowUp !== true ||
  validationPacket.nextReview.mayExecuteSoftware !== false ||
  validationPacket.nextReview.mayFetchExternalSources !== false ||
  validationPacket.nextReview.mayUnlockPackaging !== false ||
  validationPacket.nextReview.mayClaimGoalComplete !== false
) {
  throw new Error("Follow-up queue selection receipt must not permit execution, fetch, packaging, or completion.");
}

const forbiddenReceipt = structuredClone(receipt);
forbiddenReceipt.decision = "accepted";
const forbiddenReceiptPath = join(root, "forbidden-accepted-selection-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenRun = runKnowledge(
  "validate-rag-follow-up-queue-selection-receipt.mjs",
  ["--follow-up-queue", queuePath, "--receipt", forbiddenReceiptPath, "--out-dir", join(root, "forbidden-validation")],
  false
);
if (!forbiddenRun.stdout.includes("TOP_LEVEL_DECISION_NOT_ALLOWED") && !forbiddenRun.stdout.includes("FORBIDDEN_TOP_LEVEL_DECISION")) {
  throw new Error("Follow-up queue selection receipt must fail closed on acceptance.");
}

const multipleReceipt = structuredClone(receipt);
multipleReceipt.itemReviews = multipleReceipt.itemReviews.map((row) =>
  row.itemId === "review_forbidden_interpretations"
    ? {
        ...row,
        decision: "select_review_only_follow_up",
        selectedFollowUpDecision: "request_safety_note",
        itemReviewed: true,
        noActionBoundaryReviewed: true,
        reviewerNote: "Second selection should be rejected."
      }
    : row
);
const multipleReceiptPath = join(root, "multiple-selection-receipt.json");
writeJson(multipleReceiptPath, multipleReceipt);
const multipleRun = runKnowledge(
  "validate-rag-follow-up-queue-selection-receipt.mjs",
  ["--follow-up-queue", queuePath, "--receipt", multipleReceiptPath, "--out-dir", join(root, "multiple-validation")],
  false
);
if (!multipleRun.stdout.includes("TOP_LEVEL_SELECTION_REQUIRES_EXACTLY_ONE_SELECTED_ROW")) {
  throw new Error("Follow-up queue selection receipt must reject multiple selected rows.");
}

const missingReviewReceipt = structuredClone(receipt);
missingReviewReceipt.itemReviews = missingReviewReceipt.itemReviews.map((row) =>
  row.itemId === "choose_next_review_only_rag_step" ? { ...row, noActionBoundaryReviewed: false } : row
);
const missingReviewReceiptPath = join(root, "missing-no-action-review-receipt.json");
writeJson(missingReviewReceiptPath, missingReviewReceipt);
const missingReviewRun = runKnowledge(
  "validate-rag-follow-up-queue-selection-receipt.mjs",
  ["--follow-up-queue", queuePath, "--receipt", missingReviewReceiptPath, "--out-dir", join(root, "missing-review-validation")],
  false
);
if (!missingReviewRun.stdout.includes("SELECTED_ROW_REQUIRES_NO_ACTION_BOUNDARY_REVIEW")) {
  throw new Error("Follow-up queue selection receipt must require no-action boundary review.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_follow_up_queue_selection_receipt_smoke_v1",
      queuePath,
      templatePath: builder.templatePath,
      validationPath: validation.validationPath,
      selectedFollowUp: validationPacket.selectedFollowUp,
      rejectedForbiddenAcceptance: true,
      rejectedMultipleSelections: true,
      rejectedMissingNoActionBoundaryReview: true,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
