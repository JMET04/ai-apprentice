#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCorpusIndex, readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(".transparent-apprentice", "smoke", "knowledge-augmented-low-token-from-confirmed-ingest");
const sourceDir = join(root, "source");
const corpusDir = join(root, "corpus");
const outDir = join(root, "out");
const rollbackDir = join(root, "rollback-point");
mkdirSync(sourceDir, { recursive: true });
mkdirSync(corpusDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(rollbackDir, { recursive: true });

const sourcePath = join(sourceDir, "confirmed-vector-app-manual.md");
writeFileSync(
  sourcePath,
  [
    "# Confirmed Vector App Manual",
    "",
    "When a compact log says export completed, require teacher confirmation of the output path before treating it as successful output evidence.",
    "",
    "When a compact log says permission denied, stop and ask the teacher before retrying or changing software settings.",
    "",
    "Documentation is retrieval evidence only. It must not enable rules or execute software."
  ].join("\n"),
  "utf8"
);

const { indexPath } = buildCorpusIndex({
  sourcePath,
  outDir: corpusDir,
  sourceIdPrefix: "confirmed.vector_app",
  sourceType: "software_doc",
  domain: "vector_app.export"
});

const ingestRunPath = join(root, "rag-confirmed-local-ingest-run.json");
writeJson(ingestRunPath, {
  format: "transparent_ai_rag_confirmed_local_ingest_run_v1",
  runId: "smoke-confirmed-ingest-run",
  teacherReviewed: true,
  rollbackPoint: rollbackDir,
  runs: [
    {
      sourceId: "confirmed_vector_manual",
      indexPath,
      logicExtractionHint: "Bind compact export log status to teacher-reviewed output-path confirmation."
    }
  ],
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
});

const learningCyclePath = join(root, "all-software-low-token-learning-cycle.json");
writeJson(learningCyclePath, {
  format: "transparent_ai_all_software_low_token_learning_cycle_v1",
  queueId: "smoke-vector-app-cycle",
  software: "Vector App",
  compactLearningEvents: [
    {
      id: "event-export-complete",
      sourceType: "log_tail_delta",
      classification: "success_or_completion",
      compactEvidence: {
        retainedSnippet: "Export completed and saved to output folder."
      },
      suggestedRuleBoundary: "Confirm output path and format before treating completed log as success evidence."
    },
    {
      id: "event-permission-denied",
      sourceType: "log_tail_delta",
      classification: "failure_or_blocker",
      compactEvidence: {
        retainedSnippet: "Export failed because permission denied."
      },
      suggestedRuleBoundary: "Ask teacher before retrying or changing permissions."
    }
  ]
});

const run = spawnSync(
  process.execPath,
  [
    join(__dirname, "..", "knowledge", "create-knowledge-augmented-low-token-learning-from-confirmed-ingest.mjs"),
    "--ingest-run",
    ingestRunPath,
    "--learning-cycle",
    learningCyclePath,
    "--rollback-point",
    rollbackDir,
    "--teacher-reviewed",
    "--out-dir",
    outDir,
    "--top-k",
    "2"
  ],
  { cwd: process.cwd(), encoding: "utf8" }
);

if (run.status !== 0) throw new Error(run.stderr || run.stdout || "confirmed ingest knowledge augmentation smoke failed");

const result = JSON.parse(run.stdout);
const packet = readJson(result.packetPath);

if (packet.format !== "transparent_ai_knowledge_augmented_low_token_learning_v1") {
  throw new Error("Expected standard knowledge-augmented low-token learning packet format.");
}
if (packet.confirmedIngestRunPath !== ingestRunPath) throw new Error("Confirmed ingest run path was not preserved.");
if (packet.counts.augmentedEvents !== 2) throw new Error("Expected two augmented compact events.");
if (packet.counts.rulesEnabled !== 0) throw new Error("Confirmed ingest bridge must not enable rules.");
if (packet.locks.externalFetchPerformed !== false) throw new Error("Confirmed ingest bridge must not fetch external sources.");
if (packet.locks.memoryEnabled !== false) throw new Error("Confirmed ingest bridge must not write memory.");
if (packet.locks.softwareActionsExecuted !== false) throw new Error("Confirmed ingest bridge must not execute software.");
if (!packet.augmentedEvents.every((event) => event.ruleLifecycle === "draft_disabled")) {
  throw new Error("Every aggregated rule draft must stay draft_disabled.");
}
if (!packet.augmentedEvents.every((event) => event.confirmedSourceId === "confirmed_vector_manual")) {
  throw new Error("Every event should preserve confirmed source id.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_knowledge_augmented_low_token_from_confirmed_ingest_smoke_v1",
      packetPath: result.packetPath,
      readmePath: result.readmePath,
      augmentedEvents: packet.counts.augmentedEvents,
      ruleDrafts: packet.counts.ruleDrafts,
      rulesEnabled: packet.counts.rulesEnabled,
      locks: packet.locks
    },
    null,
    2
  )
);
