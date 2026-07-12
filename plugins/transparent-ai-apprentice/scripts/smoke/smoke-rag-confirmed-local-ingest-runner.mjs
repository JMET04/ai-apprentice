#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-confirmed-local-ingest-runner");
mkdirSync(root, { recursive: true });

function runNode(script, args, expectOk = true) {
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

const queueRun = runNode("create-rag-research-intake-queue.mjs", ["--out-dir", join(root, "queue")]);
const queueResult = JSON.parse(queueRun.stdout);
const builderRun = runNode("create-rag-research-intake-receipt-builder.mjs", [
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

const validationRun = runNode("validate-rag-research-intake-receipt.mjs", [
  "--queue",
  queueResult.queuePath,
  "--receipt",
  receiptPath,
  "--out-dir",
  join(root, "validation")
]);
const validationResult = JSON.parse(validationRun.stdout);
const registryRun = runNode("create-rag-confirmed-source-registry-package.mjs", [
  "--validation",
  validationResult.validationPath,
  "--out-dir",
  join(root, "registry")
]);
const registryResult = JSON.parse(registryRun.stdout);
const registry = readJson(registryResult.sourceRegistryPath);
registry.sourceRows.push({
  sourceId: "external_primary_source_lead",
  title: "External primary-source lead",
  uri: "https://example.invalid/research-lead",
  sourceType: "public_primary_source_lead",
  domain: "knowledge_augmented_rag",
  trustLevel: "unverified_until_primary_source_review",
  permissionStatus: "unknown",
  reviewOnly: true,
  accepted: false,
  packagingGated: true,
  localReadable: false,
  supportedText: false,
  ingestStatus: "external_reference_registered_no_fetch",
  ingestCommand: "",
  blockedReason: "External source registered only. Fetching or quoting it requires a separate teacher/research approval step."
});
registry.externalReferenceCount = 1;
const extendedRegistryPath = join(root, "registry-with-external-lead.json");
writeJson(extendedRegistryPath, registry);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-confirmed-local-ingest",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const blockedRun = runNode(
  "run-rag-confirmed-local-ingest.mjs",
  [
    "--registry",
    extendedRegistryPath,
    "--source-id",
    "adviser_wechat_rag_direction_note",
    "--rollback-point",
    rollbackPoint,
    "--out-dir",
    join(root, "blocked-run")
  ],
  false
);
if (!blockedRun.stderr.includes("RAG_CONFIRMED_LOCAL_INGEST_REQUIRES_TEACHER_REVIEWED_FLAG")) {
  throw new Error("Confirmed local ingest runner must reject missing teacher-reviewed flag.");
}

const run = runNode("run-rag-confirmed-local-ingest.mjs", [
  "--registry",
  extendedRegistryPath,
  "--source-id",
  "adviser_wechat_rag_direction_note",
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "runner")
]);
const result = JSON.parse(run.stdout);
const packet = readJson(result.runPath);

if (packet.format !== "transparent_ai_rag_confirmed_local_ingest_run_v1") throw new Error("Unexpected local ingest run format.");
if (packet.ingestedCount !== 1) throw new Error("Confirmed local ingest runner should ingest exactly one local source.");
if (packet.runs[0].chunkCount < 1) throw new Error("Confirmed local ingest runner should create at least one corpus chunk.");
if (!packet.runs[0].executedCommand.argv[0].endsWith("ingest-local-corpus.mjs")) {
  throw new Error("Confirmed local ingest runner must call the existing ingest-local-corpus script.");
}
if (packet.runs[0].executedCommand.kind !== "node_spawn_no_shell") {
  throw new Error("Confirmed local ingest runner must use no-shell structured spawn.");
}
if (packet.locks.externalFetchPerformed !== false || packet.locks.ruleEnabled !== false || packet.locks.memoryEnabled !== false) {
  throw new Error("Confirmed local ingest runner must keep external fetch, rules, and memory locked.");
}
if (registry.externalReferenceCount < 1 && packet.skippedNonLocalCount < 1) {
  throw new Error("Smoke should preserve non-local sources as skipped or externally registered.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_confirmed_local_ingest_runner_smoke_v1",
      registryPath: extendedRegistryPath,
      runPath: result.runPath,
      ingestedCount: packet.ingestedCount,
      rejectedMissingTeacherReview: true,
      noShell: packet.runs[0].executedCommand.kind === "node_spawn_no_shell",
      locks: packet.locks
    },
    null,
    2
  )
);
