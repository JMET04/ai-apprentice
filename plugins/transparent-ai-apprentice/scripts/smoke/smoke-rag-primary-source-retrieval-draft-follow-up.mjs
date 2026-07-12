#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-retrieval-draft-follow-up");
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

const ingestSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-local-ingest-follow-up.mjs"), []);
const ingestSmokeResult = JSON.parse(ingestSmoke.stdout);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_v1",
  rollbackId: "smoke-rag-primary-source-retrieval-draft-follow-up",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const missingReviewRun = runKnowledge(
  "run-rag-confirmed-retrieval-draft.mjs",
  [
    "--ingest-run",
    ingestSmokeResult.runPath,
    "--query",
    "dimensions angles relationships geometry",
    "--rollback-point",
    rollbackPoint,
    "--out-dir",
    join(root, "missing-review")
  ],
  false
);
if (!missingReviewRun.stderr.includes("RAG_CONFIRMED_RETRIEVAL_DRAFT_REQUIRES_TEACHER_REVIEWED_FLAG")) {
  throw new Error("Primary-source retrieval draft must reject missing teacher-reviewed flag.");
}

const draftRun = runKnowledge("run-rag-confirmed-retrieval-draft.mjs", [
  "--ingest-run",
  ingestSmokeResult.runPath,
  "--query",
  "dimensions angles relationships geometry",
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "retrieval-draft")
]);
const draftResult = JSON.parse(draftRun.stdout);
const packet = readJson(draftResult.runPath);

if (packet.format !== "transparent_ai_rag_confirmed_retrieval_draft_run_v1") {
  throw new Error("Primary-source retrieval draft should reuse the confirmed retrieval draft format.");
}
if (packet.evidenceFoundCount !== 1 || packet.ruleDraftCount !== 1) {
  throw new Error("Primary-source retrieval draft should find evidence and create one disabled rule draft.");
}
if (!packet.retrievals[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source retrieval draft should preserve the source logic extraction hint.");
}
if (!packet.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source retrieval draft should expose logic extraction hints for next review.");
}
if (packet.retrievals[0].ruleDraft.lifecycle !== "draft_disabled") {
  throw new Error("Primary-source retrieval draft must keep Rule Cards draft_disabled.");
}
if (packet.retrievals[0].executedCommand.kind !== "node_spawn_no_shell") {
  throw new Error("Primary-source retrieval draft must use no-shell retrieval spawn.");
}
if (packet.retrievals[0].ruleDraft.executedCommand.kind !== "node_spawn_no_shell") {
  throw new Error("Primary-source retrieval draft must use no-shell rule draft spawn.");
}
if (
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.ruleEnabled !== false ||
  packet.locks.memoryEnabled !== false ||
  packet.locks.packagingUnlocked !== false
) {
  throw new Error("Primary-source retrieval draft must keep fetch, execution, rules, memory, and packaging locked.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_retrieval_draft_follow_up_smoke_v1",
      ingestRunPath: ingestSmokeResult.runPath,
      runPath: draftResult.runPath,
      evidenceFoundCount: packet.evidenceFoundCount,
      ruleDraftCount: packet.ruleDraftCount,
      preservedLogicExtractionHint: true,
      rejectedMissingTeacherReview: true,
      noShell: true,
      locks: packet.locks
    },
    null,
    2
  )
);
