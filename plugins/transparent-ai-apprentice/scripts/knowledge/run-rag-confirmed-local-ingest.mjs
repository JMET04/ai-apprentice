#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arg, hashText, hasFlag, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const registryPath = resolve(arg("--registry", ""));
const sourceId = arg("--source-id", "");
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-confirmed-local-ingest")));
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!registryPath || !sourceId || !rollbackPoint) {
  throw new Error(
    "Usage: node run-rag-confirmed-local-ingest.mjs --registry <rag-confirmed-source-registry.json> --source-id <source-id|all> --rollback-point <rollback-point-dir> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!teacherReviewed) throw new Error("RAG_CONFIRMED_LOCAL_INGEST_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const registry = readJson(registryPath);
if (registry.format !== "transparent_ai_rag_confirmed_source_registry_package_v1") {
  throw new Error("Expected transparent_ai_rag_confirmed_source_registry_package_v1.");
}
if (registry.locks?.externalFetchPerformed !== false || registry.locks?.ruleEnabled !== false || registry.locks?.packagingUnlocked !== false) {
  throw new Error("Registry locks are not closed for review-only local ingest.");
}
const planningLogicEvidence = registry.planningLogicEvidence || null;
const planningLogicEvidenceHash = registry.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = registry.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = registry.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_CONFIRMED_LOCAL_INGEST_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_CONFIRMED_LOCAL_INGEST_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("RAG_CONFIRMED_LOCAL_INGEST_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH");
}

const supportedExtensions = new Set([".md", ".markdown", ".txt", ".json"]);
const selectedRows =
  sourceId === "all"
    ? (registry.sourceRows || []).filter((row) => row.ingestStatus === "ready_for_review_only_local_corpus_ingest")
    : (registry.sourceRows || []).filter((row) => row.sourceId === sourceId);

if (!selectedRows.length) throw new Error(`NO_READY_SOURCE_ROWS_SELECTED: ${sourceId}`);
if (sourceId !== "all" && selectedRows[0].ingestStatus !== "ready_for_review_only_local_corpus_ingest") {
  throw new Error(`SELECTED_SOURCE_NOT_READY_FOR_LOCAL_INGEST: ${selectedRows[0].sourceId}`);
}

const blockedRows = (registry.sourceRows || []).filter((row) => row.ingestStatus !== "ready_for_review_only_local_corpus_ingest");
const runId = stableId("rag_confirmed_local_ingest", `${registryPath}:${sourceId}:${rollbackPoint}`);
const runDir = join(outDir, runId);
mkdirSync(runDir, { recursive: true });

function assertSafeLocalRow(row) {
  if (!row.localReadable || !row.supportedText) throw new Error(`SOURCE_ROW_NOT_LOCAL_SUPPORTED_TEXT: ${row.sourceId}`);
  if (!row.uri || /^https?:\/\//.test(String(row.uri))) throw new Error(`EXTERNAL_SOURCE_FETCH_BLOCKED: ${row.sourceId}`);
  const sourcePath = resolve(String(row.uri));
  if (!existsSync(sourcePath)) throw new Error(`SOURCE_FILE_NOT_FOUND: ${sourcePath}`);
  if (!supportedExtensions.has(extname(sourcePath).toLowerCase())) throw new Error(`UNSUPPORTED_SOURCE_EXTENSION: ${sourcePath}`);
  return sourcePath;
}

const runs = [];
for (const row of selectedRows) {
  const sourcePath = assertSafeLocalRow(row);
  const sourceOutDir = join(runDir, "corpus", row.sourceId);
  const argv = [
    join(pluginRoot, "scripts", "knowledge", "ingest-local-corpus.mjs"),
    "--source",
    sourcePath,
    "--out-dir",
    sourceOutDir,
    "--source-id-prefix",
    `confirmed.${row.sourceId}`,
    "--source-type",
    row.sourceType,
    "--domain",
    row.domain
  ];
  const result = spawnSync(process.execPath, argv, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`ingest-local-corpus failed for ${row.sourceId}:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  const parsed = JSON.parse(result.stdout);
  runs.push({
    sourceId: row.sourceId,
    sourcePath,
    sourceOutDir,
    indexPath: parsed.indexPath,
    logicExtractionHint: row.logicExtractionHint || "",
    sourceCount: parsed.sourceCount,
    chunkCount: parsed.chunkCount,
    executedCommand: {
      kind: "node_spawn_no_shell",
      executable: process.execPath,
      argv
    }
  });
}

const packet = {
  format: "transparent_ai_rag_confirmed_local_ingest_run_v1",
  runId,
  createdAt: new Date().toISOString(),
  registryPath,
  registryHash: hashText(JSON.stringify(registry)),
  planningLogicEvidence,
  planningLogicEvidenceHash,
  sourceId,
  teacherReviewed,
  rollbackPoint,
  selectedCount: selectedRows.length,
  ingestedCount: runs.length,
  skippedNonLocalCount: blockedRows.length,
  runs,
  skippedRows: blockedRows.map((row) => ({
    sourceId: row.sourceId,
    ingestStatus: row.ingestStatus,
    blockedReason: row.blockedReason || "Not a ready local supported text source."
  })),
  nextReview: {
    instruction: "Review the generated local corpus indexes before retrieval or disabled rule drafting.",
    logicExtractionHints: runs
      .filter((run) => run.logicExtractionHint)
      .map((run) => ({ sourceId: run.sourceId, logicExtractionHint: run.logicExtractionHint })),
    planningLogicEvidence,
    planningLogicEvidenceHash,
    mayRetrieve: true,
    mayDraftDisabledRules: true,
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

const runPath = join(runDir, "rag-confirmed-local-ingest-run.json");
writeJson(runPath, packet);
const readmePath = join(runDir, "RAG_CONFIRMED_LOCAL_INGEST_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Confirmed Local Ingest",
    "",
    "This run ingested teacher/researcher-confirmed local text sources through the allowlisted local corpus ingester.",
    "",
    `- Registry: ${registryPath}`,
    `- Run packet: ${runPath}`,
    `- Retained rollback point: ${rollbackPoint}`,
    "",
    "## Review Boundary",
    "",
    "The runner used Node spawn with structured argv, not a copied shell command. It did not fetch external sources, enable rules, write memory, execute target software, or unlock packaging.",
    "",
    "Review the generated corpus indexes before retrieval or disabled rule drafting."
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
      ingestedCount: packet.ingestedCount,
      skippedNonLocalCount: packet.skippedNonLocalCount,
      locks: packet.locks
    },
    null,
    2
  )
);
