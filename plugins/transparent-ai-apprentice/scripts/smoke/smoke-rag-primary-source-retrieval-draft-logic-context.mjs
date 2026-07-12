#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-retrieval-draft-logic-context");
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

const ingestSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-local-ingest-logic-context.mjs"), []);
const ingestSmokeResult = JSON.parse(ingestSmoke.stdout);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_v1",
  rollbackId: "smoke-rag-primary-source-retrieval-draft-logic-context",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const draftRun = runKnowledge("run-rag-confirmed-retrieval-draft.mjs", [
  "--ingest-run",
  ingestSmokeResult.runPath,
  "--query",
  "confirmed data-to-output relationship planning packet",
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "retrieval-draft")
]);
const draftResult = JSON.parse(draftRun.stdout);
const packet = readJson(draftResult.runPath);

if (!packet.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source retrieval draft should preserve upstream planning logic hints.");
}
if (packet.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source retrieval draft should preserve confirmed upstream logic evidence reviews.");
}
if (!packet.planningLogicEvidenceHash || packet.nextReview.planningLogicEvidenceHash !== packet.planningLogicEvidenceHash) {
  throw new Error("Primary-source retrieval draft should expose the planning logic evidence hash for review.");
}
if (!packet.retrievals[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source retrieval draft should preserve the source logic extraction hint.");
}
if (packet.retrievals[0].ruleDraft.lifecycle !== "draft_disabled") {
  throw new Error("Primary-source retrieval draft must keep Rule Cards draft_disabled.");
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
  throw new Error("Primary-source retrieval draft logic context must keep fetch, execution, rules, memory, and packaging locked.");
}

const ingestRun = readJson(ingestSmokeResult.runPath);
const tamperedPlanningIngestRun = structuredClone(ingestRun);
tamperedPlanningIngestRun.planningLogicEvidence.logicExtractionHints = [];
const tamperedPlanningIngestRunPath = join(root, "tampered-ingest-run-planning-logic.json");
writeJson(tamperedPlanningIngestRunPath, tamperedPlanningIngestRun);
const tamperedPlanningRun = runKnowledge(
  "run-rag-confirmed-retrieval-draft.mjs",
  [
    "--ingest-run",
    tamperedPlanningIngestRunPath,
    "--query",
    "confirmed data-to-output relationship planning packet",
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-planning-retrieval-draft")
  ],
  false
);
const tamperedPlanningOutput = `${tamperedPlanningRun.stdout}\n${tamperedPlanningRun.stderr}`;
if (!tamperedPlanningOutput.includes("RAG_CONFIRMED_RETRIEVAL_DRAFT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source retrieval draft must reject tampered ingest planning logic evidence.");
}

const tamperedNextReviewIngestRun = structuredClone(ingestRun);
tamperedNextReviewIngestRun.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewIngestRunPath = join(root, "tampered-ingest-run-next-review-planning-logic.json");
writeJson(tamperedNextReviewIngestRunPath, tamperedNextReviewIngestRun);
const tamperedNextReviewRun = runKnowledge(
  "run-rag-confirmed-retrieval-draft.mjs",
  [
    "--ingest-run",
    tamperedNextReviewIngestRunPath,
    "--query",
    "confirmed data-to-output relationship planning packet",
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-next-review-retrieval-draft")
  ],
  false
);
const tamperedNextReviewOutput = `${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`;
if (!tamperedNextReviewOutput.includes("RAG_CONFIRMED_RETRIEVAL_DRAFT_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH")) {
  throw new Error("Primary-source retrieval draft must reject tampered ingest next-review planning logic evidence.");
}

const tamperedNextReviewHashIngestRun = structuredClone(ingestRun);
tamperedNextReviewHashIngestRun.nextReview.planningLogicEvidenceHash = "tampered-next-review-planning-logic-evidence-hash";
const tamperedNextReviewHashIngestRunPath = join(root, "tampered-ingest-run-next-review-planning-logic-hash.json");
writeJson(tamperedNextReviewHashIngestRunPath, tamperedNextReviewHashIngestRun);
const tamperedNextReviewHashRun = runKnowledge(
  "run-rag-confirmed-retrieval-draft.mjs",
  [
    "--ingest-run",
    tamperedNextReviewHashIngestRunPath,
    "--query",
    "confirmed data-to-output relationship planning packet",
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-next-review-hash-retrieval-draft")
  ],
  false
);
const tamperedNextReviewHashOutput = `${tamperedNextReviewHashRun.stdout}\n${tamperedNextReviewHashRun.stderr}`;
if (!tamperedNextReviewHashOutput.includes("RAG_CONFIRMED_RETRIEVAL_DRAFT_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source retrieval draft must reject tampered ingest next-review planning logic evidence hash.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_retrieval_draft_logic_context_smoke_v1",
      ingestRunPath: ingestSmokeResult.runPath,
      runPath: draftResult.runPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidenceHash: true,
      preservedSourceLogicExtractionHint: true,
      locks: packet.locks
    },
    null,
    2
  )
);
