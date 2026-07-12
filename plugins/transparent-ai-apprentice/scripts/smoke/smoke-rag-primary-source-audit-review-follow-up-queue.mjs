#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-audit-review-follow-up-queue");
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

const validationSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-delivery-gate-audit-review-receipt.mjs"), []);
const validationSmokeResult = JSON.parse(validationSmoke.stdout);
const validationPath = validationSmokeResult.validationPath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-audit-review-follow-up-queue",
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
  throw new Error("Primary-source audit follow-up queue should use the existing queue format.");
}
if (queue.queueItems.length !== 5) {
  throw new Error("Primary-source audit follow-up queue should add one logic evidence review item.");
}
const logicItem = queue.queueItems.find((item) => item.itemId === "review_primary_source_logic_evidence");
if (!logicItem) {
  throw new Error("Primary-source audit follow-up queue should include a logic evidence review item.");
}
if (!logicItem.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit follow-up queue should preserve logic extraction hints.");
}
if (logicItem.logicExtractionHints[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source audit follow-up queue should preserve logic-fit decisions.");
}
if (!logicItem.blockedActions.includes("execute_software") || !logicItem.blockedActions.includes("unlock_packaging")) {
  throw new Error("Primary-source audit follow-up queue logic item must block execution and packaging.");
}
if (queue.counts.primarySourceLogicHintItems !== 1) {
  throw new Error("Primary-source audit follow-up queue should count one logic hint item.");
}
if (!queue.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit follow-up queue should expose top-level logic hints.");
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
  throw new Error("Primary-source audit follow-up queue must keep all review-only no-action locks.");
}

const strippedValidation = readJson(validationPath);
strippedValidation.nextReview.logicExtractionHints = [];
const strippedValidationPath = join(root, "stripped-logic-validation.json");
writeJson(strippedValidationPath, strippedValidation);
const strippedQueueRun = runKnowledge("create-rag-audit-review-follow-up-queue.mjs", [
  "--audit-review-validation",
  strippedValidationPath,
  "--rollback-point",
  rollbackPoint,
  "--out-dir",
  join(root, "stripped-queue")
]);
const strippedQueueResult = JSON.parse(strippedQueueRun.stdout);
const strippedQueue = readJson(strippedQueueResult.queuePath);
if (strippedQueue.queueItems.some((item) => item.itemId === "review_primary_source_logic_evidence")) {
  throw new Error("Audit follow-up queue should not invent logic evidence items when validation has no logic hints.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_audit_review_follow_up_queue_smoke_v1",
      queuePath: queueResult.queuePath,
      queueItems: queue.queueItems.length,
      logicEvidenceItemPresent: true,
      preservedLogicExtractionHint: true,
      preservedLogicFitDecision: true,
      strippedValidationDidNotInventLogicItem: true,
      locks: queue.locks
    },
    null,
    2
  )
);
