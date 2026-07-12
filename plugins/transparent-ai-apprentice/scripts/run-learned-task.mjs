#!/usr/bin/env node
import { closeSync, existsSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function withFileLock(targetPath, operation) {
  const lockPath = `${targetPath}.lock`;
  let handle;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      handle = openSync(lockPath, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      sleep(50);
    }
  }
  if (handle === undefined) {
    throw new Error(`Could not acquire session lock: ${lockPath}`);
  }

  try {
    return operation();
  } finally {
    closeSync(handle);
    rmSync(lockPath, { force: true });
  }
}

function writeJsonAtomic(path, value) {
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

function wordsFromText(value) {
  return [...new Set((value.toLowerCase().match(/[a-z0-9_\u4e00-\u9fff-]{2,}/g) ?? []).slice(0, 80))];
}

function sourceDemonstrationForRule(session, rule) {
  const evidenceIds = rule.sourceEvidence ?? [];
  return (session.teacherDemonstrations ?? []).find((demo) => evidenceIds.includes(demo.id));
}

function sourceExchangeForRule(session, rule) {
  const evidenceIds = rule.sourceEvidence ?? [];
  return (session.teachingExchanges ?? []).find((exchange) => evidenceIds.includes(exchange.id));
}

function cuesForRule(session, rule) {
  const sourceDemo = sourceDemonstrationForRule(session, rule);
  const sourceExchange = sourceExchangeForRule(session, rule);
  return sourceDemo?.extractedSignals?.cues ?? sourceExchange?.extractedCues ?? wordsFromText(rule.condition);
}

function matchedCuesForInput(input, cues) {
  const normalized = input.toLowerCase();
  return (cues ?? []).filter((cue) => normalized.includes(String(cue).toLowerCase()));
}

const rawSessionPath = argValue("--session");
const taskInput = argValue("--input");

if (!rawSessionPath || !taskInput) {
  throw new Error("Usage: node run-learned-task.mjs --session <session.json> --input <future task>");
}

const sessionPath = resolve(rawSessionPath);

if (!existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}

let output;
withFileLock(sessionPath, () => {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const enabledRules = (session.ruleDrafts ?? []).filter((rule) => rule.enabled === true);
  const scoredRules = enabledRules
    .map((rule) => {
      const cues = cuesForRule(session, rule);
      return {
        rule,
        cues,
        matchedCues: matchedCuesForInput(taskInput, cues)
      };
    })
    .sort((a, b) => b.matchedCues.length - a.matchedCues.length);
  const selected = scoredRules.find((candidate) => candidate.matchedCues.length > 0);
  const attemptId = `attempt-${Date.now()}`;
  const traceId = `trace-${Date.now()}-learned-run`;
  const outcome = selected ? "applied_enabled_memory" : "no_enabled_memory_match";

  const attempt = {
    format: "transparent_ai_learned_task_attempt_v1",
    id: attemptId,
    input: taskInput,
    selectedRuleDraftId: selected?.rule.id ?? "",
    matchedCues: selected?.matchedCues ?? [],
    actionTaken: selected
      ? selected.rule.action
      : "No enabled session memory matched this input. Ask the teacher for a demonstration or correction.",
    outcome,
    ruleEnabled: Boolean(selected),
    packagingGated: true,
    technologyAccepted: false
  };

  const publicTrace = {
    format: "transparent_ai_public_trace_v1",
    traceId,
    sourceAttemptId: attemptId,
    steps: [
      {
        step: "search enabled session memory",
        inputObserved: taskInput,
        ruleCandidates: enabledRules.map((rule) => rule.id),
        actionProposed: selected ? `Use approved rule ${selected.rule.id}.` : "No approved rule matched; request more teaching.",
        confidence: selected && selected.matchedCues.length > 2 ? "medium" : "low",
        validation: `enabledRules=${enabledRules.length}; matchedCues=${selected?.matchedCues.length ?? 0}`,
        teacherReviewPoint: selected
          ? "Confirm this learned behavior still matches your intent."
          : "Teach or approve a memory before expecting changed behavior.",
        memoryEffect: selected ? "enabled memory changed this run" : "none"
      },
      {
        step: "execute with transparent memory provenance",
        inputObserved: JSON.stringify({
          selectedRuleDraftId: attempt.selectedRuleDraftId,
          matchedCues: attempt.matchedCues,
          actionTaken: attempt.actionTaken
        }).slice(0, 1200),
        ruleCandidates: selected ? [selected.rule.id] : [],
        actionProposed: attempt.actionTaken,
        confidence: selected ? selected.rule.confidence ?? "medium" : "low",
        validation: `outcome=${outcome}; packagingGated=true; technologyAccepted=false`,
        teacherReviewPoint: "Correct the result if the approved memory was too broad or stale.",
        memoryEffect: selected ? "approved session memory applied" : "none"
      }
    ]
  };

  session.executionAttempts = [...(session.executionAttempts ?? []), attempt];
  session.publicTraces = [...(session.publicTraces ?? []), publicTrace];
  writeJsonAtomic(sessionPath, session);

  output = {
    ok: true,
    sessionPath,
    attemptId,
    traceId,
    outcome,
    selectedRuleDraftId: attempt.selectedRuleDraftId,
    matchedCueCount: attempt.matchedCues.length,
    actionTaken: attempt.actionTaken,
    ruleEnabled: Boolean(selected),
    packagingGated: true,
    technologyAccepted: false
  };
});

console.log(JSON.stringify(output, null, 2));
