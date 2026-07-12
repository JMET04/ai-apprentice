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
  return [...new Set((value.toLowerCase().match(/[a-z0-9_\u4e00-\u9fff-]{2,}/g) ?? []).slice(0, 60))];
}

function sentenceSummary(value, fallback) {
  const firstSentence = value
    .split(/(?<=[.!?。！？])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean)[0];
  return (firstSentence || fallback).slice(0, 240);
}

const rawSessionPath = argValue("--session");
const teacherMessage = argValue("--teacher-message");

if (!rawSessionPath || !teacherMessage) {
  throw new Error(
    "Usage: node record-teacher-exchange.mjs --session <session.json> --teacher-message <teaching note> [--apprentice-attempt ...] [--teacher-correction ...] [--taught-behavior ...]"
  );
}

const sessionPath = resolve(rawSessionPath);
const apprenticeAttempt = argValue("--apprentice-attempt");
const teacherCorrection = argValue("--teacher-correction");
const taughtBehavior =
  argValue("--taught-behavior") ||
  sentenceSummary(teacherCorrection || teacherMessage, "Apply the teacher's demonstrated preference after review.");
const channel = argValue("--channel", "conversation");

if (!existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}

let output;
withFileLock(sessionPath, () => {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const exchangeId = `exchange-${Date.now()}`;
  const traceId = `trace-${Date.now()}-exchange`;
  const ruleId = `rule-draft-${Date.now()}-exchange`;
  const correctionId = teacherCorrection ? `correction-${Date.now()}-exchange` : "";
  const cueSource = [teacherMessage, apprenticeAttempt, teacherCorrection].filter(Boolean).join("\n");
  const cues = wordsFromText(cueSource);

  const exchange = {
    format: "transparent_ai_teacher_exchange_v1",
    id: exchangeId,
    channel,
    teacherMessage,
    apprenticeAttempt,
    teacherCorrection,
    taughtBehavior,
    extractedCues: cues,
    reviewStatus: "needs_teacher_review",
    ruleEnabled: false,
    requiresTeacherConfirmation: true
  };

  const ruleDraft = {
    format: "transparent_ai_rule_memory_draft_v1",
    id: ruleId,
    condition: cues.length
      ? `When future input matches teacher-confirmed conversational cues: ${cues.slice(0, 10).join(", ")}`
      : "When the teacher later confirms the conversational teaching boundary",
    action: taughtBehavior,
    counterexamples: teacherCorrection
      ? [
          teacherCorrection,
          "Do not apply this draft to similar wording until the teacher confirms the same intent."
        ]
      : ["Do not apply this draft until the teacher supplies or confirms a concrete correction example."],
    sourceEvidence: [exchangeId, traceId],
    confidence: teacherCorrection ? "medium" : "low",
    enabled: false,
    requiresTeacherConfirmation: true,
    reviewStatus: "needs_teacher_review"
  };

  const correctionRecord = teacherCorrection
    ? {
        format: "transparent_ai_teacher_correction_v1",
        id: correctionId,
        targetRuleDraftId: ruleId,
        correctionType: "teacher_exchange",
        teacherCorrection,
        previousCondition: "new conversational teaching exchange",
        revisedCondition: ruleDraft.condition,
        previousAction: apprenticeAttempt || "no apprentice attempt recorded",
        revisedAction: ruleDraft.action,
        ruleEnabled: false,
        requiresTeacherConfirmation: true,
        reviewStatus: "needs_teacher_review"
      }
    : null;

  const publicTrace = {
    format: "transparent_ai_public_trace_v1",
    traceId,
    sourceExchangeId: exchangeId,
    steps: [
      {
        step: "capture teacher exchange",
        inputObserved: JSON.stringify({ teacherMessage, channel }).slice(0, 1200),
        ruleCandidates: [],
        actionProposed: "Treat the teacher's natural-language instruction as review evidence.",
        confidence: "medium",
        validation: "teacher message recorded",
        teacherReviewPoint: "Confirm this captures what you were trying to teach.",
        memoryEffect: "none"
      },
      {
        step: "compare apprentice attempt with correction",
        inputObserved: JSON.stringify({ apprenticeAttempt, teacherCorrection }).slice(0, 1200),
        ruleCandidates: [],
        actionProposed: "Extract a reusable boundary from the correction without activating it.",
        confidence: teacherCorrection ? "medium" : "low",
        validation: `correctionProvided=${Boolean(teacherCorrection)}`,
        teacherReviewPoint: "Add a concrete counterexample if this rule is still too broad.",
        memoryEffect: "candidate only"
      },
      {
        step: "draft conversational rule",
        inputObserved: JSON.stringify({ cues: cues.slice(0, 20), taughtBehavior }).slice(0, 1200),
        ruleCandidates: [ruleId],
        actionProposed: "Save a disabled rule draft that can be replayed on a future input.",
        confidence: ruleDraft.confidence,
        validation: "ruleEnabled=false; requiresTeacherConfirmation=true",
        teacherReviewPoint: "Replay before accepting this memory.",
        memoryEffect: "disabled draft"
      }
    ]
  };

  session.teachingExchanges = [...(session.teachingExchanges ?? []), exchange];
  session.publicTraces = [...(session.publicTraces ?? []), publicTrace];
  session.ruleDrafts = [...(session.ruleDrafts ?? []), ruleDraft];
  if (correctionRecord) {
    session.corrections = [...(session.corrections ?? []), correctionRecord];
  }
  session.nextReplayPlan = [
    ...(session.nextReplayPlan ?? []),
    {
      sourceExchangeId: exchangeId,
      sourceRuleDraftId: ruleId,
      action: "Replay a small future input against this conversational draft before enabling any memory.",
      ruleEnabled: false,
      requiresTeacherConfirmation: true
    }
  ];

  writeJsonAtomic(sessionPath, session);
  output = {
    ok: true,
    sessionPath,
    exchangeId,
    traceId,
    ruleDraftId: ruleId,
    correctionId,
    extractedCueCount: cues.length,
    ruleEnabled: false,
    requiresTeacherConfirmation: true,
    reviewStatus: "needs_teacher_review"
  };
});

console.log(JSON.stringify(output, null, 2));
