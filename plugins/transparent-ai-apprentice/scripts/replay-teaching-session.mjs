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

function latestRuleDraft(session) {
  const drafts = session.ruleDrafts ?? [];
  return drafts[drafts.length - 1];
}

function sourceDemonstrationForRule(session, rule) {
  const evidenceIds = rule.sourceEvidence ?? [];
  return (session.teacherDemonstrations ?? []).find((demo) => evidenceIds.includes(demo.id));
}

function sourceExchangeForRule(session, rule) {
  const evidenceIds = rule.sourceEvidence ?? [];
  return (session.teachingExchanges ?? []).find((exchange) => evidenceIds.includes(exchange.id));
}

function matchedCuesForInput(input, cues) {
  const normalized = input.toLowerCase();
  return (cues ?? []).filter((cue) => normalized.includes(String(cue).toLowerCase()));
}

const rawSessionPath = argValue("--session");
const replayInput = argValue("--input");

if (!rawSessionPath || !replayInput) {
  throw new Error("Usage: node replay-teaching-session.mjs --session <session.json> --input <future input> [--rule-id <id>]");
}

const sessionPath = resolve(rawSessionPath);
const targetRuleId = argValue("--rule-id");

if (!existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}

let output;
withFileLock(sessionPath, () => {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const targetRule = targetRuleId
    ? (session.ruleDrafts ?? []).find((rule) => rule.id === targetRuleId)
    : latestRuleDraft(session);

  if (!targetRule) {
    throw new Error("No rule draft found. Import and correct a demonstration before replay.");
  }

  const sourceDemo = sourceDemonstrationForRule(session, targetRule);
  const sourceExchange = sourceExchangeForRule(session, targetRule);
  const sourceCues = sourceDemo?.extractedSignals?.cues ?? sourceExchange?.extractedCues ?? [];
  const inputWords = wordsFromText(replayInput);
  const matchedCues = matchedCuesForInput(replayInput, sourceCues);
  const hasTeacherCorrections = (targetRule.teacherCorrections ?? []).length > 0;
  const replayId = `replay-${Date.now()}`;
  const traceId = `trace-${Date.now()}-replay`;
  const wouldUseDraft = matchedCues.length > 0;
  const outcome = wouldUseDraft ? "needs_teacher_review" : "no_rule_match";

  const replay = {
    format: "transparent_ai_replay_preview_v1",
    id: replayId,
    input: replayInput,
    inputWords,
    selectedRuleDraftId: targetRule.id,
    sourceDemonstrationId: sourceDemo?.id ?? "",
    sourceExchangeId: sourceExchange?.id ?? "",
    matchedCues,
    proposedAction: wouldUseDraft
      ? `Would consider draft action after teacher confirmation: ${targetRule.action}`
      : "No draft action proposed because the future input did not match extracted teacher cues.",
    blockedByTeacherBoundary: targetRule.enabled === false || hasTeacherCorrections,
    ruleEnabled: false,
    requiresTeacherConfirmation: true,
    outcome,
    teacherReviewQuestion: wouldUseDraft
      ? "Does this replay show the behavior you meant to teach, or should the rule be narrowed again?"
      : "Should this future input be connected to the demonstration, or is it outside the taught boundary?"
  };

  const publicTrace = {
    format: "transparent_ai_public_trace_v1",
    traceId,
    sourceReplayId: replayId,
    steps: [
      {
        step: "compare future input with disabled rule draft",
        inputObserved: replayInput,
        ruleCandidates: [targetRule.id],
        actionProposed: replay.proposedAction,
        confidence: matchedCues.length > 1 ? "medium" : "low",
        validation: `matchedCues=${matchedCues.length}; ruleEnabled=false`,
        teacherReviewPoint: replay.teacherReviewQuestion,
        memoryEffect: wouldUseDraft ? "draft would affect future behavior after review" : "none"
      },
      {
        step: "keep replay review-only",
        inputObserved: JSON.stringify({
          hasTeacherCorrections,
          blockedByTeacherBoundary: replay.blockedByTeacherBoundary,
          requiresTeacherConfirmation: replay.requiresTeacherConfirmation
        }),
        ruleCandidates: [targetRule.id],
        actionProposed: "Do not enable the rule from replay. Wait for explicit teacher acceptance.",
        confidence: "high",
        validation: "ruleEnabled=false; no memory activation",
        teacherReviewPoint: "Teacher may refine, add counterexample, or explicitly approve in a later workflow.",
        memoryEffect: "preview only"
      }
    ]
  };

  session.replays = [...(session.replays ?? []), replay];
  session.publicTraces = [...(session.publicTraces ?? []), publicTrace];
  writeJsonAtomic(sessionPath, session);

  output = {
    ok: true,
    sessionPath,
    replayId,
    traceId,
    selectedRuleDraftId: targetRule.id,
    matchedCueCount: matchedCues.length,
    blockedByTeacherBoundary: replay.blockedByTeacherBoundary,
    outcome,
    ruleEnabled: false,
    requiresTeacherConfirmation: true
  };
});

console.log(JSON.stringify(output, null, 2));
