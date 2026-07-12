#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-local-ingest-follow-up");
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

const registrySmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-registry-follow-up.mjs"), []);
const registrySmokeResult = JSON.parse(registrySmoke.stdout);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_v1",
  rollbackId: "smoke-rag-primary-source-local-ingest-follow-up",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const missingReviewRun = runKnowledge(
  "run-rag-confirmed-local-ingest.mjs",
  [
    "--registry",
    registrySmokeResult.sourceRegistryPath,
    "--source-id",
    "teacher_primary_source_logic_note",
    "--rollback-point",
    rollbackPoint,
    "--out-dir",
    join(root, "missing-review")
  ],
  false
);
if (!missingReviewRun.stderr.includes("RAG_CONFIRMED_LOCAL_INGEST_REQUIRES_TEACHER_REVIEWED_FLAG")) {
  throw new Error("Primary-source local ingest must reject missing teacher-reviewed flag.");
}

const ingestRun = runKnowledge("run-rag-confirmed-local-ingest.mjs", [
  "--registry",
  registrySmokeResult.sourceRegistryPath,
  "--source-id",
  "teacher_primary_source_logic_note",
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "ingest")
]);
const ingestResult = JSON.parse(ingestRun.stdout);
const packet = readJson(ingestResult.runPath);

if (packet.format !== "transparent_ai_rag_confirmed_local_ingest_run_v1") {
  throw new Error("Primary-source local ingest should reuse the confirmed local ingest run format.");
}
if (packet.ingestedCount !== 1 || packet.runs[0].sourceId !== "teacher_primary_source_logic_note") {
  throw new Error("Primary-source local ingest should ingest exactly the selected teacher source.");
}
if (!packet.runs[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source local ingest should preserve the source logic extraction hint.");
}
if (!packet.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source local ingest should expose logic extraction hints for next review.");
}
if (packet.runs[0].chunkCount < 1) {
  throw new Error("Primary-source local ingest should create corpus chunks.");
}
if (packet.runs[0].executedCommand.kind !== "node_spawn_no_shell") {
  throw new Error("Primary-source local ingest must use no-shell structured spawn.");
}
if (
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.ruleEnabled !== false ||
  packet.locks.memoryEnabled !== false ||
  packet.locks.packagingUnlocked !== false
) {
  throw new Error("Primary-source local ingest must keep fetch, execution, rules, memory, and packaging locked.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_local_ingest_follow_up_smoke_v1",
      registryPath: registrySmokeResult.sourceRegistryPath,
      runPath: ingestResult.runPath,
      ingestedCount: packet.ingestedCount,
      preservedLogicExtractionHint: true,
      rejectedMissingTeacherReview: true,
      noShell: packet.runs[0].executedCommand.kind === "node_spawn_no_shell",
      locks: packet.locks
    },
    null,
    2
  )
);
