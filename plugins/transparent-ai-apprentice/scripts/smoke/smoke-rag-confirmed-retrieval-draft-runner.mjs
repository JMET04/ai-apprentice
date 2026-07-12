#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-confirmed-retrieval-draft-runner");
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
  join(root, "builder")
]);
const builderResult = JSON.parse(builderRun.stdout);
const receipt = readJson(builderResult.templatePath);
receipt.decision = "teacher_confirms_adviser_extraction";
receipt.sourceReviews = receipt.sourceReviews.map((row) =>
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
const receiptPath = join(root, "teacher-confirmed-rag-intake-receipt.json");
writeJson(receiptPath, receipt);

const validationRun = runKnowledge("validate-rag-research-intake-receipt.mjs", [
  "--queue",
  queueResult.queuePath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
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
  rollbackId: "smoke-rag-confirmed-retrieval-draft",
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

const blockedRun = runKnowledge(
  "run-rag-confirmed-retrieval-draft.mjs",
  [
    "--ingest-run",
    ingestResult.runPath,
    "--query",
    "知识增强 RAG 外接知识库",
    "--rollback-point",
    rollbackPoint,
    "--out-dir",
    join(root, "blocked-retrieval-draft")
  ],
  false
);
if (!blockedRun.stderr.includes("RAG_CONFIRMED_RETRIEVAL_DRAFT_REQUIRES_TEACHER_REVIEWED_FLAG")) {
  throw new Error("Confirmed retrieval draft runner must reject missing teacher-reviewed flag.");
}

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
const packet = readJson(draftResult.runPath);

if (packet.format !== "transparent_ai_rag_confirmed_retrieval_draft_run_v1") throw new Error("Unexpected retrieval draft format.");
if (packet.evidenceFoundCount !== 1) throw new Error("Confirmed retrieval draft runner should find evidence in the confirmed local corpus.");
if (packet.ruleDraftCount !== 1) throw new Error("Confirmed retrieval draft runner should create exactly one disabled rule draft.");
if (packet.retrievals[0].executedCommand.kind !== "node_spawn_no_shell") {
  throw new Error("Confirmed retrieval draft runner must use no-shell retrieval spawn.");
}
if (packet.retrievals[0].ruleDraft.executedCommand.kind !== "node_spawn_no_shell") {
  throw new Error("Confirmed retrieval draft runner must use no-shell rule draft spawn.");
}
if (packet.retrievals[0].ruleDraft.lifecycle !== "draft_disabled") {
  throw new Error("Confirmed retrieval draft runner must keep Rule Cards draft_disabled.");
}
if (packet.locks.externalFetchPerformed !== false || packet.locks.ruleEnabled !== false || packet.locks.memoryEnabled !== false) {
  throw new Error("Confirmed retrieval draft runner must keep external fetch, rules, and memory locked.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_confirmed_retrieval_draft_runner_smoke_v1",
      ingestRunPath: ingestResult.runPath,
      runPath: draftResult.runPath,
      evidenceFoundCount: packet.evidenceFoundCount,
      ruleDraftCount: packet.ruleDraftCount,
      rejectedMissingTeacherReview: true,
      noShell: true,
      locks: packet.locks
    },
    null,
    2
  )
);
