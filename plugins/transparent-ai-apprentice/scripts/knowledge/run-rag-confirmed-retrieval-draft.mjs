#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arg, hashText, hasFlag, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const ingestRunPath = resolve(arg("--ingest-run", ""));
const query = arg("--query", "");
const topK = Number(arg("--top-k", "3"));
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-confirmed-retrieval-draft")));
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!ingestRunPath || !query || !rollbackPoint) {
  throw new Error(
    "Usage: node run-rag-confirmed-retrieval-draft.mjs --ingest-run <rag-confirmed-local-ingest-run.json> --query <text> --rollback-point <rollback-point-dir> --teacher-reviewed [--top-k <n>] [--out-dir <dir>]"
  );
}
if (!teacherReviewed) throw new Error("RAG_CONFIRMED_RETRIEVAL_DRAFT_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const ingestRun = readJson(ingestRunPath);
if (ingestRun.format !== "transparent_ai_rag_confirmed_local_ingest_run_v1") {
  throw new Error("Expected transparent_ai_rag_confirmed_local_ingest_run_v1.");
}
if (ingestRun.teacherReviewed !== true || ingestRun.locks?.ruleEnabled !== false || ingestRun.locks?.externalFetchPerformed !== false) {
  throw new Error("Ingest run is not a teacher-reviewed locked local RAG ingest packet.");
}
const planningLogicEvidence = ingestRun.planningLogicEvidence || null;
const planningLogicEvidenceHash = ingestRun.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = ingestRun.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = ingestRun.nextReview?.planningLogicEvidenceHash || "";

if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_CONFIRMED_RETRIEVAL_DRAFT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_CONFIRMED_RETRIEVAL_DRAFT_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash) {
  throw new Error("RAG_CONFIRMED_RETRIEVAL_DRAFT_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH");
}

const eligibleRuns = (ingestRun.runs || []).filter((row) => row.indexPath && existsSync(row.indexPath));
if (!eligibleRuns.length) throw new Error("NO_LOCAL_CORPUS_INDEXES_AVAILABLE_FOR_RETRIEVAL");

const runId = stableId("rag_confirmed_retrieval_draft", `${ingestRunPath}:${query}:${rollbackPoint}`);
const runDir = join(outDir, runId);
mkdirSync(runDir, { recursive: true });

function runKnowledgeScript(script, args) {
  const argv = [join(pluginRoot, "scripts", "knowledge", script), ...args];
  const result = spawnSync(process.execPath, argv, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${script} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return { parsed: JSON.parse(result.stdout), argv };
}

function safeRuleId(sourceId) {
  return `knowledge.confirmed.${String(sourceId).replace(/[^A-Za-z0-9_.-]+/g, "_")}.draft`;
}

const retrievals = [];
for (const row of eligibleRuns) {
  const sourceDir = join(runDir, "retrieval", row.sourceId);
  const retrievalPath = join(sourceDir, "retrieval-evidence-packet.json");
  const retrieval = runKnowledgeScript("retrieve-local-knowledge.mjs", [
    "--corpus-index",
    row.indexPath,
    "--query",
    query,
    "--top-k",
    String(topK),
    "--out",
    retrievalPath
  ]);
  const packet = readJson(retrievalPath);
  let draft = null;
  if (packet.status === "evidence_found" && packet.chunks.length > 0) {
    const rulePath = join(sourceDir, "retrieval-rule-draft.json");
    const draftRun = runKnowledgeScript("draft-rule-card-from-retrieval.mjs", [
      "--retrieval-packet",
      retrievalPath,
      "--out",
      rulePath,
      "--rule-id",
      safeRuleId(row.sourceId),
      "--domain",
      "knowledge.confirmed_rag_source"
    ]);
    const rule = readJson(rulePath);
    draft = {
      rulePath,
      lifecycle: rule.lifecycle,
      evidenceRefs: rule.source?.evidence_refs || [],
      executedCommand: {
        kind: "node_spawn_no_shell",
        executable: process.execPath,
        argv: draftRun.argv
      }
    };
  }
  retrievals.push({
    sourceId: row.sourceId,
    indexPath: row.indexPath,
    logicExtractionHint: row.logicExtractionHint || "",
    retrievalPath,
    retrievalStatus: packet.status,
    chunkCount: packet.chunks.length,
    ruleDraft: draft,
    executedCommand: {
      kind: "node_spawn_no_shell",
      executable: process.execPath,
      argv: retrieval.argv
    }
  });
}

const packet = {
  format: "transparent_ai_rag_confirmed_retrieval_draft_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  ingestRunPath,
  ingestRunHash: hashText(JSON.stringify(ingestRun)),
  planningLogicEvidence,
  planningLogicEvidenceHash,
  query,
  topK,
  teacherReviewed,
  rollbackPoint,
  retrievalCount: retrievals.length,
  evidenceFoundCount: retrievals.filter((row) => row.retrievalStatus === "evidence_found").length,
  ruleDraftCount: retrievals.filter((row) => row.ruleDraft).length,
  retrievals,
  nextReview: {
    instruction: "Review retrieval chunks and disabled Rule Card drafts before any rule lifecycle change.",
    logicExtractionHints: retrievals
      .filter((row) => row.logicExtractionHint)
      .map((row) => ({ sourceId: row.sourceId, logicExtractionHint: row.logicExtractionHint })),
    planningLogicEvidence,
    planningLogicEvidenceHash,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayUnlockPackaging: false
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    shellCommandExecuted: false,
    packagingGated: true,
    packagingUnlocked: false
  }
};

const runPath = join(runDir, "rag-confirmed-retrieval-draft-run.json");
writeJson(runPath, packet);
const readmePath = join(runDir, "RAG_CONFIRMED_RETRIEVAL_DRAFT_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Confirmed Retrieval Draft",
    "",
    "This package retrieves from teacher-reviewed confirmed local corpora and drafts disabled Rule Cards for review.",
    "",
    `- Ingest run: ${ingestRunPath}`,
    `- Retrieval draft run: ${runPath}`,
    `- Retained rollback point: ${rollbackPoint}`,
    "",
    "## Review Boundary",
    "",
    "The runner used Node spawn with structured argv. It did not fetch external sources, enable rules, write memory, execute target software, or unlock packaging.",
    "",
    "Review every retrieved chunk and every `draft_disabled` Rule Card before any lifecycle or memory change."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: packet.format,
      runPath,
      readmePath,
      evidenceFoundCount: packet.evidenceFoundCount,
      ruleDraftCount: packet.ruleDraftCount,
      locks: packet.locks
    },
    null,
    2
  )
);
