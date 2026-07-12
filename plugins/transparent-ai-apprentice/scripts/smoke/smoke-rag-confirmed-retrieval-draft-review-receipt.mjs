#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-confirmed-retrieval-draft-review-receipt");
mkdirSync(root, { recursive: true });

function runKnowledge(script, args, expectOk = true) {
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

const queueRun = runKnowledge("create-rag-research-intake-queue.mjs", ["--out-dir", join(root, "queue")]);
const queueResult = JSON.parse(queueRun.stdout);
const builderRun = runKnowledge("create-rag-research-intake-receipt-builder.mjs", [
  "--queue",
  queueResult.queuePath,
  "--out-dir",
  join(root, "intake-builder")
]);
const builderResult = JSON.parse(builderRun.stdout);
const intakeReceipt = readJson(builderResult.templatePath);
intakeReceipt.decision = "teacher_confirms_adviser_extraction";
intakeReceipt.sourceReviews = intakeReceipt.sourceReviews.map((row) =>
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
const intakeReceiptPath = join(root, "teacher-confirmed-rag-intake-receipt.json");
writeJson(intakeReceiptPath, intakeReceipt);

const validationRun = runKnowledge("validate-rag-research-intake-receipt.mjs", [
  "--queue",
  queueResult.queuePath,
  "--receipt",
  intakeReceiptPath,
  "--out-dir",
  join(root, "intake-validation")
]);
const validationResult = JSON.parse(validationRun.stdout);
const registryRun = runKnowledge("create-rag-confirmed-source-registry-package.mjs", [
  "--validation",
  validationResult.validationPath,
  "--out-dir",
  join(root, "registry")
]);
const registryResult = JSON.parse(registryRun.stdout);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-confirmed-retrieval-draft-review",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const ingestRun = runKnowledge("run-rag-confirmed-local-ingest.mjs", [
  "--registry",
  registryResult.sourceRegistryPath,
  "--source-id",
  "adviser_wechat_rag_direction_note",
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "local-ingest")
]);
const ingestResult = JSON.parse(ingestRun.stdout);
const draftRun = runKnowledge("run-rag-confirmed-retrieval-draft.mjs", [
  "--ingest-run",
  ingestResult.runPath,
  "--query",
  "知识增强 RAG 外接知识库",
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "retrieval-draft")
]);
const draftResult = JSON.parse(draftRun.stdout);
const draftPacket = readJson(draftResult.runPath);

const reviewBuilderRun = runKnowledge("create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs", [
  "--retrieval-draft-run",
  draftResult.runPath,
  "--out-dir",
  join(root, "review-builder")
]);
const reviewBuilder = JSON.parse(reviewBuilderRun.stdout);
const reviewReceipt = readJson(reviewBuilder.templatePath);
reviewReceipt.decision = "teacher_reviewed_disabled_drafts";
reviewReceipt.retrievalReviews = reviewReceipt.retrievalReviews.map((row) =>
  row.rulePath
    ? {
        ...row,
        decision: "approve_disabled_draft_for_rule_dsl_validation",
        evidenceReviewed: true,
        ruleDraftReviewed: true,
        reviewerNote: "Teacher reviewed the retrieved chunk and confirms this disabled draft may proceed to review-only Rule DSL validation."
      }
    : row
);
const reviewReceiptPath = join(root, "teacher-reviewed-retrieval-draft-receipt.json");
writeJson(reviewReceiptPath, reviewReceipt);

const reviewValidationRun = runKnowledge("validate-rag-confirmed-retrieval-draft-review-receipt.mjs", [
  "--retrieval-draft-run",
  draftResult.runPath,
  "--receipt",
  reviewReceiptPath,
  "--out-dir",
  join(root, "review-validation")
]);
const reviewValidation = JSON.parse(reviewValidationRun.stdout);
const validationPacket = readJson(reviewValidation.validationPath);

if (validationPacket.status !== "ready_for_review_only_rule_dsl_validation") {
  throw new Error("Review receipt validation should prepare review-only Rule DSL validation.");
}
if (validationPacket.approvedDisabledDrafts.length !== 1) throw new Error("Review receipt validation should approve one disabled draft.");
if (validationPacket.locks.ruleEnabled !== false || validationPacket.locks.memoryEnabled !== false) {
  throw new Error("Review receipt validation must keep rules and memory locked.");
}

const forbiddenReceipt = structuredClone(reviewReceipt);
forbiddenReceipt.decision = "enable_rule";
const forbiddenReceiptPath = join(root, "forbidden-enable-rule-review-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const blockedRun = runKnowledge(
  "validate-rag-confirmed-retrieval-draft-review-receipt.mjs",
  ["--retrieval-draft-run", draftResult.runPath, "--receipt", forbiddenReceiptPath, "--out-dir", join(root, "forbidden-review-validation")],
  false
);
if (!blockedRun.stderr && !blockedRun.stdout.includes("FORBIDDEN_TOP_LEVEL_DECISION")) {
  throw new Error("Review receipt validation must fail closed on forbidden rule enablement.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_smoke_v1",
      draftRunPath: draftResult.runPath,
      templatePath: reviewBuilder.templatePath,
      validationPath: reviewValidation.validationPath,
      approvedDisabledDrafts: validationPacket.approvedDisabledDrafts.length,
      rejectedForbiddenEnableRule: true,
      retrievalEvidenceFound: draftPacket.evidenceFoundCount,
      locks: validationPacket.locks
    },
    null,
    2
  )
);
