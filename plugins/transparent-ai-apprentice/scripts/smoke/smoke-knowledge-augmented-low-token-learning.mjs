#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildCorpusIndex, readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const root = resolve(".transparent-apprentice", "smoke", "knowledge-augmented-low-token-learning");
const sourceDir = join(root, "knowledge-source");
const outDir = join(root, "out");
mkdirSync(sourceDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const sourcePath = join(sourceDir, "vector-app-manual.md");
writeFileSync(
  sourcePath,
  [
    "# Vector App Operations Manual",
    "",
    "When export logs say completed or saved, treat the event as successful export evidence only after the teacher confirms the file path and intended output format.",
    "",
    "When export logs say failed, denied, timeout, or blocked, stop and ask the teacher before retrying. Do not execute software automatically from retrieved knowledge.",
    "",
    "All retrieved documentation is evidence only. Rule drafts must remain disabled until teacher review."
  ].join("\n"),
  "utf8"
);

const { index, indexPath } = buildCorpusIndex({
  sourcePath: sourceDir,
  outDir,
  sourceIdPrefix: "smoke.vector_app",
  sourceType: "software_doc",
  domain: "vector_app.export"
});

const compactPacket = {
  format: "transparent_ai_compact_learning_events_from_universal_observation_v1",
  packetId: "smoke-vector-app-compact-events",
  software: "Vector App",
  status: "waiting_for_teacher_review",
  compactLearningEvents: [
    {
      id: "log-1",
      sourceType: "log_tail_delta",
      classification: "success_or_completion",
      confidence: "medium",
      compactEvidence: {
        retainedSnippet: "Export completed and saved to teacher-selected output folder."
      },
      suggestedRuleBoundary:
        "Ask the teacher whether completed export logs mean the output format and file path are correct."
    },
    {
      id: "log-2",
      sourceType: "log_tail_delta",
      classification: "failure_or_blocker",
      confidence: "medium",
      compactEvidence: {
        retainedSnippet: "Export failed because permission denied."
      },
      suggestedRuleBoundary:
        "Ask the teacher before retrying or changing permissions."
    }
  ],
  reviewLocks: {
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    fullContinuousRecording: false
  }
};
const compactPacketPath = join(outDir, "compact-learning-events.json");
writeJson(compactPacketPath, compactPacket);

const bridgeOutDir = join(outDir, "bridge");
const bridgeRun = spawnSync(process.execPath, [
  join(__dirname, "..", "knowledge", "augment-low-token-learning-with-retrieval.mjs"),
  "--corpus-index",
  indexPath,
  "--compact-events",
  compactPacketPath,
  "--out-dir",
  bridgeOutDir,
  "--top-k",
  "2"
], {
  cwd: process.cwd(),
  encoding: "utf8"
});

if (bridgeRun.status !== 0) throw new Error(bridgeRun.stderr || bridgeRun.stdout || "Knowledge augmentation bridge failed.");

const bridgeResult = JSON.parse(bridgeRun.stdout);
const resultPacketPath = bridgeResult.packetPath;
const resultPacket = readJson(resultPacketPath);

if (resultPacket.counts.rulesEnabled !== 0) throw new Error("RAG must not enable rules.");
if (resultPacket.locks.fullLogRead !== false) throw new Error("Bridge must not read full logs.");
if (resultPacket.locks.softwareActionsExecuted !== false) throw new Error("Bridge must not execute software.");
if (!resultPacket.augmentedEvents.every((event) => event.ruleLifecycle === "draft_disabled")) {
  throw new Error("Every knowledge-augmented low-token rule draft must stay disabled.");
}
if (!resultPacket.augmentedEvents.every((event) => event.retrievalStatus === "evidence_found")) {
  throw new Error("Expected retrieval evidence for each compact event.");
}

console.log(JSON.stringify({
  ok: true,
  smoke: "transparent_ai_knowledge_augmented_low_token_learning_smoke_v1",
  indexPath,
  compactPacketPath,
  resultPacketPath,
  bridgeResultFormat: bridgeResult.format,
  bridgeStatus: bridgeResult.status,
  bridgeReceiptPath: bridgeResult.receiptPath,
  augmentedEvents: resultPacket.counts.augmentedEvents,
  ruleDrafts: resultPacket.counts.ruleDrafts,
  rulesEnabled: resultPacket.counts.rulesEnabled,
  locks: resultPacket.locks
}, null, 2));
