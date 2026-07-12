#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-audit-review-follow-up-queue");
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

const validationSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-delivery-gate-audit-review-receipt.mjs"), []);
const validationSmokeResult = JSON.parse(validationSmoke.stdout);
const validationPath = validationSmokeResult.validationPath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-audit-review-follow-up-queue",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const queueRun = runKnowledge("create-rag-audit-review-follow-up-queue.mjs", [
  "--audit-review-validation",
  validationPath,
  "--rollback-point",
  rollbackPoint,
  "--out-dir",
  join(root, "queue")
]);
const queueResult = JSON.parse(queueRun.stdout);
const queue = readJson(queueResult.queuePath);

if (queue.format !== "transparent_ai_rag_audit_review_follow_up_queue_v1") {
  throw new Error("RAG audit review follow-up queue should use the expected format.");
}
if (queue.queueDecision !== "manual_review_only_follow_up_queue_ready" || queue.queueItems.length !== 4) {
  throw new Error("RAG audit review follow-up queue should prepare four manual review items.");
}
if (!queue.queueItems.some((item) => item.itemId === "confirm_rollback_retained")) {
  throw new Error("RAG audit review follow-up queue should require rollback retention review.");
}
if (!queue.queueItems.some((item) => item.itemId === "review_forbidden_interpretations")) {
  throw new Error("RAG audit review follow-up queue should require forbidden interpretation review.");
}
if (queue.counts.executableItems !== 0) {
  throw new Error("RAG audit review follow-up queue must not contain executable items.");
}
if (
  queue.locks.queueDoesNotRunCommands !== true ||
  queue.locks.queueDoesNotOpenFiles !== true ||
  queue.locks.queueDoesNotFetchSources !== true ||
  queue.locks.ruleEnabled !== false ||
  queue.locks.memoryEnabled !== false ||
  queue.locks.softwareActionsExecuted !== false ||
  queue.locks.externalFetchPerformed !== false ||
  queue.locks.packagingUnlocked !== false ||
  queue.locks.deliveryGateOpen !== false
) {
  throw new Error("RAG audit review follow-up queue must keep all review-only no-action locks.");
}

const waitingValidation = readJson(validationPath);
waitingValidation.status = "waiting_for_teacher_review";
const waitingValidationPath = join(root, "waiting-validation.json");
writeJson(waitingValidationPath, waitingValidation);
const waitingRun = runKnowledge(
  "create-rag-audit-review-follow-up-queue.mjs",
  ["--audit-review-validation", waitingValidationPath, "--rollback-point", rollbackPoint, "--out-dir", join(root, "waiting-queue")],
  false
);
if (!waitingRun.stderr.includes("RAG_FOLLOW_UP_QUEUE_REQUIRES_READY_AUDIT_REVIEW_VALIDATION")) {
  throw new Error("RAG audit review follow-up queue must reject non-ready validation.");
}

const unlockedValidation = readJson(validationPath);
unlockedValidation.locks.packagingUnlocked = true;
const unlockedValidationPath = join(root, "unlocked-validation.json");
writeJson(unlockedValidationPath, unlockedValidation);
const unlockedRun = runKnowledge(
  "create-rag-audit-review-follow-up-queue.mjs",
  ["--audit-review-validation", unlockedValidationPath, "--rollback-point", rollbackPoint, "--out-dir", join(root, "unlocked-queue")],
  false
);
if (!unlockedRun.stderr.includes("RAG_FOLLOW_UP_QUEUE_REQUIRES_LOCKED_AUDIT_REVIEW_VALIDATION")) {
  throw new Error("RAG audit review follow-up queue must reject unlocked validation.");
}

const missingRollbackRun = runKnowledge(
  "create-rag-audit-review-follow-up-queue.mjs",
  ["--audit-review-validation", validationPath, "--rollback-point", join(root, "missing-rollback"), "--out-dir", join(root, "missing-rollback-queue")],
  false
);
if (!missingRollbackRun.stderr.includes("ROLLBACK_POINT_NOT_FOUND")) {
  throw new Error("RAG audit review follow-up queue must require a retained rollback point.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_audit_review_follow_up_queue_smoke_v1",
      queuePath: queueResult.queuePath,
      readmePath: queueResult.readmePath,
      queueItems: queue.queueItems.length,
      rejectedNonReadyValidation: true,
      rejectedUnlockedValidation: true,
      rejectedMissingRollbackPoint: true,
      locks: queue.locks
    },
    null,
    2
  )
);
