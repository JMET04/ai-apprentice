#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { validateRuleCard } from "../rules/rule-dsl-core.mjs";
import {
  arg,
  draftRuleCardFromRetrieval,
  readJson,
  retrieveFromCorpus,
  stableId,
  writeJson
} from "./knowledge-core.mjs";

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: readJson(trimmed), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON file path or JSON object string`);
}

function compactText(value, max = 320) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function eventQuery(event, software = "") {
  return [
    software,
    event.classification || "",
    event.sourceType || "",
    event.compactEvidence?.retainedSnippet || "",
    event.suggestedRuleBoundary || ""
  ].filter(Boolean).join(" ");
}

function collectCompactEvents(input) {
  if (Array.isArray(input.compactLearningEvents)) return input.compactLearningEvents;
  if (Array.isArray(input.learningRuns)) {
    const events = [];
    for (const run of input.learningRuns) {
      if (!run.compactLearningEventsPath || !existsSync(run.compactLearningEventsPath)) continue;
      const packet = readJson(run.compactLearningEventsPath);
      for (const event of packet.compactLearningEvents || []) {
        events.push({ ...event, software: run.software || packet.software || input.software || "" });
      }
    }
    return events;
  }
  return [];
}

const corpusIndexPath = resolve(arg("--corpus-index", ""));
const compactEventsArg = arg("--compact-events", "");
const learningCycleArg = arg("--learning-cycle", "");
const outDir = resolve(arg("--out-dir", ".transparent-apprentice/knowledge/augmented-low-token-learning"));
const topK = Number(arg("--top-k", "2"));
const maxEvents = Number(arg("--max-events", "6"));

if (!corpusIndexPath || (!compactEventsArg && !learningCycleArg)) {
  throw new Error(
    "Usage: node augment-low-token-learning-with-retrieval.mjs --corpus-index <path> (--compact-events <packet> | --learning-cycle <cycle>) [--out-dir <dir>]"
  );
}

const sourceInput = readJsonInput(compactEventsArg || learningCycleArg, compactEventsArg ? "--compact-events" : "--learning-cycle");
const corpusIndex = readJson(corpusIndexPath);
const events = collectCompactEvents(sourceInput.value).slice(0, Math.max(1, maxEvents));
const software = sourceInput.value.software || sourceInput.value.queueId || basename(sourceInput.path || "inline-learning");
const runId = stableId("knowledge_augmented_low_token_learning", `${corpusIndex.corpus_id}:${sourceInput.path || JSON.stringify(sourceInput.value)}`);
const runDir = join(outDir, runId);
const packetsDir = join(runDir, "retrieval-packets");
const rulesDir = join(runDir, "rule-drafts");
mkdirSync(packetsDir, { recursive: true });
mkdirSync(rulesDir, { recursive: true });

const augmentedEvents = events.map((event, index) => {
  const query = eventQuery(event, event.software || software);
  const retrievalPacket = retrieveFromCorpus({ corpusIndex, query, topK });
  const retrievalPacketPath = join(packetsDir, `${String(index + 1).padStart(3, "0")}-retrieval-evidence-packet.json`);
  writeJson(retrievalPacketPath, retrievalPacket);

  const rule = draftRuleCardFromRetrieval({
    packet: retrievalPacket,
    ruleId: `knowledge.low_token.${String(index + 1).padStart(3, "0")}.review_only`,
    domain: "knowledge.low_token_learning"
  });
  rule.title = `Review-only low-token rule draft for ${event.classification || "state change"}`;
  rule.source.natural_language = [
    compactText(event.compactEvidence?.retainedSnippet || event.suggestedRuleBoundary || ""),
    rule.source.natural_language
  ].filter(Boolean).join(" | ");
  const validation = validateRuleCard(rule);
  const rulePath = join(rulesDir, `${String(index + 1).padStart(3, "0")}-retrieval-rule-draft.json`);
  writeJson(rulePath, rule);

  return {
    eventId: event.id || `event-${index + 1}`,
    sourceType: event.sourceType || "unknown",
    classification: event.classification || "state_change",
    compactEvidenceSnippet: compactText(event.compactEvidence?.retainedSnippet || ""),
    query,
    retrievalStatus: retrievalPacket.status,
    retrievedChunkCount: retrievalPacket.chunks.length,
    retrievalPacketPath,
    ruleDraftPath: rulePath,
    ruleLifecycle: rule.lifecycle,
    ruleValidationOk: validation.ok,
    sourceEvidenceRefs: rule.source.evidence_refs,
    locks: {
      evidenceOnly: true,
      ruleEnabled: false,
      accepted: false,
      packagingGated: true,
      screenshotsCaptured: false,
      fullLogRead: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      teacherReviewRequired: true
    }
  };
});

const packet = {
  format: "transparent_ai_knowledge_augmented_low_token_learning_v1",
  runId,
  createdAt: new Date().toISOString(),
  sourceLearningPath: sourceInput.path || "",
  corpusIndexPath,
  status: augmentedEvents.length ? "waiting_for_teacher_review" : "no_compact_events_to_augment",
  lowTokenStrategy:
    "Use compact learning events as retrieval queries; retrieve only small local knowledge chunks; create disabled rule drafts with provenance instead of reading full logs or executing software.",
  counts: {
    compactEventsSeen: events.length,
    augmentedEvents: augmentedEvents.length,
    retrievalPackets: augmentedEvents.length,
    ruleDrafts: augmentedEvents.length,
    rulesEnabled: 0,
    screenshotsCaptured: 0,
    softwareActionsExecuted: 0
  },
  augmentedEvents,
  locks: {
    evidenceOnly: true,
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true,
    memoryEnabled: false,
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
      "Which retrieved source chunk actually explains the compact software signal, and what counterexample should prevent overbroad reuse?",
    allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_follow_up"],
    forbiddenDecisions: ["accepted", "enable_rule", "execute_software", "unlock_packaging"]
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
  corpusIndexPath,
  sourceLearningPath: sourceInput.path || "",
  counts: packet.counts,
  locks: packet.locks,
  teacherConfirmationRequired: true
});

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_knowledge_augmented_low_token_learning_result_v1",
  runId,
  packetPath,
  receiptPath,
  augmentedEvents: packet.counts.augmentedEvents,
  ruleDrafts: packet.counts.ruleDrafts,
  rulesEnabled: 0,
  screenshotsCaptured: false,
  fullLogRead: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  status: packet.status
}, null, 2));
