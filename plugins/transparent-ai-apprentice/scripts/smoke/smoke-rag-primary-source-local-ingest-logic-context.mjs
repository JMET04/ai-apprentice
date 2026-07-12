#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-local-ingest-logic-context");
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

const registrySmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-registry-logic-context.mjs"), []);
const registrySmokeResult = JSON.parse(registrySmoke.stdout);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_v1",
  rollbackId: "smoke-rag-primary-source-local-ingest-logic-context",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const ingestRun = runKnowledge("run-rag-confirmed-local-ingest.mjs", [
  "--registry",
  registrySmokeResult.sourceRegistryPath,
  "--source-id",
  "teacher_primary_source_logic_context_note",
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "ingest")
]);
const ingestResult = JSON.parse(ingestRun.stdout);
const packet = readJson(ingestResult.runPath);

if (!packet.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source local ingest should preserve upstream planning logic hints.");
}
if (packet.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source local ingest should preserve confirmed upstream logic evidence reviews.");
}
if (!packet.planningLogicEvidenceHash || packet.nextReview.planningLogicEvidenceHash !== packet.planningLogicEvidenceHash) {
  throw new Error("Primary-source local ingest should expose the planning logic evidence hash for retrieval review.");
}
if (!packet.runs[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source local ingest should preserve the selected source logic extraction hint.");
}
if (!packet.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source local ingest should expose source logic hints for next review.");
}
if (
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.ruleEnabled !== false ||
  packet.locks.memoryEnabled !== false ||
  packet.locks.packagingUnlocked !== false ||
  packet.nextReview.mayFetchExternalSources !== false ||
  packet.nextReview.mayExecuteSoftware !== false ||
  packet.nextReview.mayUnlockPackaging !== false
) {
  throw new Error("Primary-source local ingest logic context must keep fetch, execution, rules, memory, and packaging locked.");
}

const registry = readJson(registrySmokeResult.sourceRegistryPath);
const tamperedPlanningRegistry = structuredClone(registry);
tamperedPlanningRegistry.planningLogicEvidence.logicExtractionHints = [];
const tamperedPlanningRegistryPath = join(root, "tampered-registry-planning-logic.json");
writeJson(tamperedPlanningRegistryPath, tamperedPlanningRegistry);
const tamperedPlanningRun = runKnowledge(
  "run-rag-confirmed-local-ingest.mjs",
  [
    "--registry",
    tamperedPlanningRegistryPath,
    "--source-id",
    "teacher_primary_source_logic_context_note",
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-planning-ingest")
  ],
  false
);
if (!`${tamperedPlanningRun.stdout}\n${tamperedPlanningRun.stderr}`.includes("RAG_CONFIRMED_LOCAL_INGEST_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source local ingest must reject tampered registry planning logic evidence.");
}

const tamperedNextReviewRegistry = structuredClone(registry);
tamperedNextReviewRegistry.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewRegistryPath = join(root, "tampered-registry-next-review-planning-logic.json");
writeJson(tamperedNextReviewRegistryPath, tamperedNextReviewRegistry);
const tamperedNextReviewRun = runKnowledge(
  "run-rag-confirmed-local-ingest.mjs",
  [
    "--registry",
    tamperedNextReviewRegistryPath,
    "--source-id",
    "teacher_primary_source_logic_context_note",
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-next-review-ingest")
  ],
  false
);
if (!`${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`.includes("RAG_CONFIRMED_LOCAL_INGEST_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source local ingest must reject tampered registry next-review planning logic evidence.");
}

const tamperedNextReviewHashRegistry = structuredClone(registry);
tamperedNextReviewHashRegistry.nextReview.planningLogicEvidenceHash = "tampered-next-review-planning-logic-evidence-hash";
const tamperedNextReviewHashRegistryPath = join(root, "tampered-registry-next-review-planning-logic-hash.json");
writeJson(tamperedNextReviewHashRegistryPath, tamperedNextReviewHashRegistry);
const tamperedNextReviewHashRun = runKnowledge(
  "run-rag-confirmed-local-ingest.mjs",
  [
    "--registry",
    tamperedNextReviewHashRegistryPath,
    "--source-id",
    "teacher_primary_source_logic_context_note",
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-next-review-hash-ingest")
  ],
  false
);
if (
  !`${tamperedNextReviewHashRun.stdout}\n${tamperedNextReviewHashRun.stderr}`.includes(
    "RAG_CONFIRMED_LOCAL_INGEST_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH"
  )
) {
  throw new Error("Primary-source local ingest must reject tampered registry next-review planning logic evidence hash.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_local_ingest_logic_context_smoke_v1",
      registryPath: registrySmokeResult.sourceRegistryPath,
      runPath: ingestResult.runPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      preservedSourceLogicExtractionHint: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidenceHash: true,
      locks: packet.locks
    },
    null,
    2
  )
);
