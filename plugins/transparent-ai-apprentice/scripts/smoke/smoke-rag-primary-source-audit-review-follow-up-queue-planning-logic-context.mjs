#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-audit-review-follow-up-queue-planning-logic-context");
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

const validationSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-delivery-gate-audit-review-receipt-planning-logic-context.mjs"),
  []
);
const validationSmokeResult = JSON.parse(validationSmoke.stdout);
const validationPath = validationSmokeResult.validationPath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-audit-review-follow-up-queue-planning-logic-context",
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
const validation = readJson(validationPath);

if (!queue.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source audit follow-up queue should preserve upstream planning logic hints.");
}
if (!queue.planningLogicEvidenceHash || queue.planningLogicEvidenceHash !== validation.planningLogicEvidenceHash) {
  throw new Error("Primary-source audit follow-up queue should expose the planning logic evidence hash for next review.");
}
if (queue.nextReview?.planningLogicEvidenceHash !== queue.planningLogicEvidenceHash) {
  throw new Error("Primary-source audit follow-up queue next review should preserve the planning logic evidence hash.");
}
if (queue.counts.planningLogicEvidencePresent !== true) {
  throw new Error("Primary-source audit follow-up queue should count planning logic evidence as present.");
}
if (
  queue.nextReview.mayAcceptTechnology !== false ||
  queue.nextReview.mayEnableRules !== false ||
  queue.nextReview.mayWriteMemory !== false ||
  queue.nextReview.mayExecuteSoftware !== false ||
  queue.nextReview.mayFetchExternalSources !== false ||
  queue.nextReview.mayOpenDeliveryGate !== false ||
  queue.nextReview.mayUnlockPackaging !== false ||
  queue.nextReview.mayClaimGoalComplete !== false
) {
  throw new Error("Primary-source audit follow-up queue next review must keep all no-action permissions closed.");
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
  throw new Error("Primary-source audit follow-up queue planning logic context must keep all review-only no-action locks.");
}

const tamperedValidation = structuredClone(validation);
tamperedValidation.planningLogicEvidence.logicExtractionHints = [];
const tamperedValidationPath = join(root, "tampered-planning-logic-validation.json");
writeJson(tamperedValidationPath, tamperedValidation);
const tamperedRun = runKnowledge(
  "create-rag-audit-review-follow-up-queue.mjs",
  [
    "--audit-review-validation",
    tamperedValidationPath,
    "--rollback-point",
    rollbackPoint,
    "--out-dir",
    join(root, "tampered-queue")
  ],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("RAG_FOLLOW_UP_QUEUE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source audit follow-up queue must reject tampered planning logic evidence.");
}

const tamperedNextReviewValidation = structuredClone(validation);
tamperedNextReviewValidation.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewValidationPath = join(root, "tampered-next-review-planning-logic-validation.json");
writeJson(tamperedNextReviewValidationPath, tamperedNextReviewValidation);
const tamperedNextReviewRun = runKnowledge(
  "create-rag-audit-review-follow-up-queue.mjs",
  [
    "--audit-review-validation",
    tamperedNextReviewValidationPath,
    "--rollback-point",
    rollbackPoint,
    "--out-dir",
    join(root, "tampered-next-review-queue")
  ],
  false
);
if (
  !`${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`.includes(
    "RAG_FOLLOW_UP_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source audit follow-up queue must reject tampered next-review planning logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_audit_review_follow_up_queue_planning_logic_context_smoke_v1",
      validationPath,
      queuePath: queueResult.queuePath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      locks: queue.locks
    },
    null,
    2
  )
);
