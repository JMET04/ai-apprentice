#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arg, hashText, hasFlag, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const ingestRunPath = resolve(arg("--ingest-run", ""));
const learningCyclePath = resolve(arg("--learning-cycle", arg("--compact-events", "")));
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "knowledge-augmented-low-token-learning"))
);
const topK = Number(arg("--top-k", "3"));
const maxEvents = Number(arg("--max-events", "6"));
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!ingestRunPath || !learningCyclePath || !rollbackPoint) {
  throw new Error(
    "Usage: node create-knowledge-augmented-low-token-learning-from-confirmed-ingest.mjs --ingest-run <rag-confirmed-local-ingest-run.json> --learning-cycle <all-software-low-token-learning-cycle.json> --rollback-point <rollback-point-dir> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!teacherReviewed) {
  throw new Error("KNOWLEDGE_AUGMENTED_LOW_TOKEN_FROM_CONFIRMED_INGEST_REQUIRES_TEACHER_REVIEWED_FLAG");
}
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);
if (!existsSync(ingestRunPath)) throw new Error(`INGEST_RUN_NOT_FOUND: ${ingestRunPath}`);
if (!existsSync(learningCyclePath)) throw new Error(`LEARNING_CYCLE_NOT_FOUND: ${learningCyclePath}`);

const ingestRun = readJson(ingestRunPath);
const learningCycle = readJson(learningCyclePath);
if (ingestRun.format !== "transparent_ai_rag_confirmed_local_ingest_run_v1") {
  throw new Error("Expected transparent_ai_rag_confirmed_local_ingest_run_v1.");
}
if (ingestRun.teacherReviewed !== true || ingestRun.locks?.externalFetchPerformed !== false) {
  throw new Error("Confirmed ingest run must be teacher-reviewed and local-only.");
}
if (ingestRun.locks?.ruleEnabled !== false || ingestRun.locks?.memoryEnabled !== false) {
  throw new Error("Confirmed ingest run locks must keep rules and memory disabled.");
}

const eligibleRuns = (ingestRun.runs || []).filter((row) => row.indexPath && existsSync(row.indexPath));
if (!eligibleRuns.length) throw new Error("NO_CONFIRMED_LOCAL_CORPUS_INDEXES_AVAILABLE");

const runId = stableId("knowledge_augmented_low_token_from_confirmed_ingest", `${ingestRunPath}:${learningCyclePath}`);
const runDir = join(outDir, runId);
const childDir = join(runDir, "per-source-augmentation");
mkdirSync(childDir, { recursive: true });

function runAugmentation(row) {
  const sourceOutDir = join(childDir, row.sourceId || "source");
  const argv = [
    join(pluginRoot, "scripts", "knowledge", "augment-low-token-learning-with-retrieval.mjs"),
    "--corpus-index",
    row.indexPath,
    "--learning-cycle",
    learningCyclePath,
    "--out-dir",
    sourceOutDir,
    "--top-k",
    String(topK),
    "--max-events",
    String(maxEvents)
  ];
  const result = spawnSync(process.execPath, argv, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`augment-low-token-learning-with-retrieval failed for ${row.sourceId}:\n${result.stdout}\n${result.stderr}`);
  }
  const parsed = JSON.parse(result.stdout);
  const packet = readJson(parsed.packetPath);
  return {
    sourceId: row.sourceId || "",
    indexPath: row.indexPath,
    logicExtractionHint: row.logicExtractionHint || "",
    childPacketPath: parsed.packetPath,
    childReceiptPath: parsed.receiptPath,
    packet,
    executedCommand: {
      kind: "node_spawn_no_shell",
      executable: process.execPath,
      argv
    }
  };
}

const childRuns = eligibleRuns.map(runAugmentation);
const augmentedEvents = childRuns.flatMap((child) =>
  (child.packet.augmentedEvents || []).map((event) => ({
    ...event,
    confirmedSourceId: child.sourceId,
    confirmedCorpusIndexPath: child.indexPath,
    logicExtractionHint: child.logicExtractionHint,
    childKnowledgePacketPath: child.childPacketPath
  }))
);

const packet = {
  format: "transparent_ai_knowledge_augmented_low_token_learning_v1",
  runId,
  createdAt: new Date().toISOString(),
  sourceLearningPath: learningCyclePath,
  corpusIndexPath: "",
  status: augmentedEvents.length ? "waiting_for_teacher_review" : "no_compact_events_to_augment",
  confirmedIngestRunPath: ingestRunPath,
  confirmedIngestRunHash: hashText(JSON.stringify(ingestRun)),
  teacherReviewed,
  rollbackPoint,
  lowTokenStrategy:
    "Use teacher-reviewed confirmed local RAG corpora as retrieval evidence for compact low-token software events; aggregate disabled rule drafts without enabling rules, writing memory, fetching external sources, reading full logs, or executing software.",
  counts: {
    confirmedCorpusIndexes: eligibleRuns.length,
    compactEventsSeen: childRuns.reduce((sum, child) => sum + Number(child.packet.counts?.compactEventsSeen || 0), 0),
    augmentedEvents: augmentedEvents.length,
    retrievalPackets: augmentedEvents.length,
    ruleDrafts: augmentedEvents.length,
    rulesEnabled: 0,
    screenshotsCaptured: 0,
    softwareActionsExecuted: 0
  },
  sourceEvidence: {
    ingestRunPath,
    learningCyclePath,
    childKnowledgePackets: childRuns.map((child) => ({
      sourceId: child.sourceId,
      indexPath: child.indexPath,
      packetPath: child.childPacketPath,
      receiptPath: child.childReceiptPath,
      logicExtractionHint: child.logicExtractionHint
    }))
  },
  augmentedEvents,
  locks: {
    evidenceOnly: true,
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true,
    memoryEnabled: false,
    externalFetchPerformed: false,
    shellCommandExecuted: false,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    fullLogRead: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    teacherConfirmationRequired: true
  },
  nextTeacherReview: {
    question:
      "Do the teacher-reviewed local source chunks actually explain the compact software signal and the intended reusable logic?",
    logicExtractionHints: childRuns
      .filter((child) => child.logicExtractionHint)
      .map((child) => ({ sourceId: child.sourceId, logicExtractionHint: child.logicExtractionHint })),
    allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
    forbiddenDecisions: ["accepted", "enable_rule", "execute_software", "write_memory", "unlock_packaging"]
  }
};

const packetPath = join(runDir, "knowledge-augmented-low-token-learning.json");
const receiptPath = join(runDir, "knowledge-augmented-low-token-learning-receipt.json");
writeJson(packetPath, packet);
writeJson(receiptPath, {
  format: "transparent_ai_knowledge_augmented_low_token_learning_receipt_v1",
  runId,
  status: packet.status,
  packetPath,
  confirmedIngestRunPath: ingestRunPath,
  sourceLearningPath: learningCyclePath,
  counts: packet.counts,
  locks: packet.locks,
  teacherConfirmationRequired: true
});

const readmePath = join(runDir, "KNOWLEDGE_AUGMENTED_LOW_TOKEN_FROM_CONFIRMED_INGEST_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# Knowledge-Augmented Low-Token Learning From Confirmed Ingest",
    "",
    `Status: ${packet.status}`,
    "",
    `- Packet: ${packetPath}`,
    `- Receipt: ${receiptPath}`,
    `- Confirmed ingest run: ${ingestRunPath}`,
    `- Low-token learning cycle: ${learningCyclePath}`,
    `- Retained rollback point: ${rollbackPoint}`,
    "",
    "## Locks",
    "",
    "- Uses only teacher-reviewed local corpus indexes from the confirmed ingest run.",
    "- Does not fetch external sources.",
    "- Does not enable rules.",
    "- Does not write long-term memory.",
    "- Does not execute target software.",
    "- Does not unlock packaging or claim final completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_knowledge_augmented_low_token_from_confirmed_ingest_result_v1",
      runId,
      packetPath,
      receiptPath,
      readmePath,
      augmentedEvents: packet.counts.augmentedEvents,
      ruleDrafts: packet.counts.ruleDrafts,
      rulesEnabled: 0,
      screenshotsCaptured: false,
      fullLogRead: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      status: packet.status,
      locks: packet.locks
    },
    null,
    2
  )
);
