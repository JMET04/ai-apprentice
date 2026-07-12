#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function eventText(event) {
  return String(event.tailSummary || event.text || event.note || event.reason || event.type || "");
}

function isAmbiguousEvent(event) {
  const text = `${event.type || ""} ${eventText(event)}`.toLowerCase();
  if (/(error|failed|exception|fatal|warning|solver)/.test(text)) return true;
  if (/(manual_teacher_marker|before_after)/.test(text)) return true;
  if (/(rebuild|export)/.test(text) && !/(completed normally|success|succeeded|completed successfully)/.test(text)) return true;
  return false;
}

function suggestedQuestionFor(event) {
  const type = String(event.type || "");
  if (/error|failed|warning|rebuild|solver|export/i.test(`${type} ${eventText(event)}`)) {
    return "I saw an error, warning, rebuild, solver, or export state change. What decision did you make, and should that decision become a reusable rule?";
  }
  if (/before_after/i.test(type)) {
    return "Which visible before/after state is the signal I should learn from?";
  }
  if (/manual_teacher_marker/i.test(type)) {
    return "You marked a learning checkpoint. What is the smallest rule boundary I should remember from this moment?";
  }
  return "What did I miss in this work-along moment?";
}

const manifestPath = resolve(argValue("--manifest", argValue("--kit")));
if (!manifestPath) {
  throw new Error("Usage: node finalize-workalong-observation.mjs --manifest <workalong-teaching-manifest.json>");
}
if (!existsSync(manifestPath)) throw new Error(`Work-along manifest not found: ${manifestPath}`);

const manifest = readJson(manifestPath);
const kitDir = manifest.kitDir || dirname(manifestPath);
const eventsPath = resolve(argValue("--events", join(kitDir, "workalong-events.jsonl")));
const outputPath = resolve(argValue("--output", join(kitDir, "workalong-observation.json")));
const events = readJsonl(eventsPath);
const teacherAnswerEvents = events.filter((event) => event.type === "teacher_question_answered" && event.answer);
const ambiguousEvents = events.filter(isAmbiguousEvent);
const needsTeacherQuestion = ambiguousEvents.length > 0 && teacherAnswerEvents.length === 0;
const suggestedQuestions = needsTeacherQuestion
  ? ambiguousEvents.slice(0, 3).map((event, index) => ({
      text: suggestedQuestionFor(event),
      reason: event.type || "ambiguous_workalong_event",
      order: index + 1
    }))
  : [];

const logs = events
  .filter((event) => event.path && /log_file_changed|error_or_state_keyword|error_keyword_detected|warning_or_rebuild/i.test(String(event.type || "")))
  .map((event) => ({
    path: event.path,
    trigger: event.type,
    tailSummary: event.tailSummary || eventText(event),
    tailLineCount: event.tailLineCount ?? 0
  }));

const screenEvidence = events
  .filter((event) => event.screenshotPath)
  .map((event) => ({
    path: event.screenshotPath,
    reason: event.type || "triggered_screenshot"
  }));

const questions = [
  ...suggestedQuestions,
  ...teacherAnswerEvents.map((event, index) => ({
    text: event.question || suggestedQuestionFor(event),
    reason: event.type,
    order: suggestedQuestions.length + index + 1
  }))
];

const teacherAnswers = teacherAnswerEvents.map((event, index) => ({
  text: event.answer,
  order: index + 1
}));

const locks = manifest.locks || {
  ruleEnabled: false,
  accepted: false,
  packagingGated: true,
  technologyAccepted: false
};

const observation = {
  format: "transparent_ai_workalong_observation_v1",
  kitId: manifest.kitId,
  sourceTool: `${manifest.software || "desktop software"} low-token workalong collector`,
  goal: manifest.goal,
  software: manifest.software,
  tokenPolicy: manifest.observationPolicy?.tokenBudgetStrategy || [],
  consentRequired: true,
  fullContinuousRecording: false,
  askTeacherOnlyWhen: manifest.observationPolicy?.questionPolicy?.askWhen || [],
  needsTeacherQuestion,
  suggestedQuestions,
  logs,
  screenEvidence,
  questions,
  teacherAnswers,
  events: events.map((event, index) => ({
    ...event,
    order: event.order ?? index + 1
  })),
  locks
};

writeFileSync(outputPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_workalong_observation_finalize_result_v1",
      manifestPath,
      eventsPath,
      outputPath,
      eventCount: events.length,
      ambiguousEventCount: ambiguousEvents.length,
      needsTeacherQuestion,
      suggestedQuestionCount: suggestedQuestions.length,
      teacherAnswerCount: teacherAnswers.length,
      screenEvidenceCount: screenEvidence.length,
      fullContinuousRecording: false,
      locks
    },
    null,
    2
  )
);
