#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return JSON.parse(readFileSync(trimmed, "utf8"));
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  throw new Error(`${label} was not a JSON file path or JSON object`);
}

function slugify(value) {
  return String(value || "compact-learning-events")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "compact-learning-events";
}

function classifyText(text) {
  const value = String(text || "");
  if (/(error|exception|failed|blocked|denied|timeout|crash|fatal|失败|错误|阻塞|拒绝|超时)/iu.test(value)) {
    return "failure_or_blocker";
  }
  if (/(warning|warn|caution|警告)/iu.test(value)) return "warning";
  if (/(saved|exported|completed|success|done|finished|保存|导出|完成|成功)/iu.test(value)) {
    return "success_or_completion";
  }
  return "state_change";
}

function confidenceFor(kind, text) {
  if (kind === "failure_or_blocker" || kind === "success_or_completion") return "medium";
  if (/(teacher|manual|marker|老师|标记)/iu.test(String(text || ""))) return "medium";
  return "low";
}

function compactText(value, max = 360) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function eventFromLogSummary(summary, index) {
  const interestingTail = Array.isArray(summary.interestingTail) ? summary.interestingTail : [];
  const joined = interestingTail.join("\n") || `${summary.path || "log"} changed`;
  const classification = classifyText(joined);
  return {
    id: `log-${index + 1}`,
    sourceType: "log_tail_delta",
    source: summary.path || "unknown log",
    classification,
    confidence: confidenceFor(classification, joined),
    compactEvidence: {
      lastWriteTimeUtc: summary.lastWriteTimeUtc || null,
      bytes: summary.bytes ?? null,
      tailLineCount: summary.tailLineCount ?? null,
      interestingLineCount: summary.interestingLineCount ?? interestingTail.length,
      retainedSnippet: compactText(joined)
    },
    suggestedRuleBoundary: "Ask the teacher whether this log signal means success, failure, normal progress, or a condition that should change future behavior.",
    needsTeacherReview: true
  };
}

function eventFromEventLog(summary, latest, index) {
  const text = `${latest?.provider || summary.logName || "event log"} ${latest?.level || ""} ${latest?.messagePreview || ""}`;
  const classification = classifyText(text);
  return {
    id: `windows-event-${index + 1}`,
    sourceType: "windows_event_log",
    source: summary.logName || "Windows Event Log",
    classification,
    confidence: confidenceFor(classification, text),
    compactEvidence: {
      provider: latest?.provider || null,
      eventId: latest?.id ?? null,
      level: latest?.level || null,
      timeCreatedUtc: latest?.timeCreatedUtc || null,
      retainedSnippet: compactText(latest?.messagePreview || "")
    },
    suggestedRuleBoundary: "Ask the teacher whether this Windows event is relevant to the demonstrated task or only background noise.",
    needsTeacherReview: true
  };
}

function eventFromTeacherMarker(marker, index) {
  const text = typeof marker === "string" ? marker : JSON.stringify(marker);
  const classification = classifyText(text);
  return {
    id: `teacher-marker-${index + 1}`,
    sourceType: "manual_teacher_marker",
    source: "teacher",
    classification,
    confidence: "medium",
    compactEvidence: { retainedSnippet: compactText(text) },
    suggestedRuleBoundary: "Use this teacher marker as the primary label unless later correction narrows it.",
    needsTeacherReview: true
  };
}

function eventFromNonLogFallback(summary, index) {
  const text = `${summary.sourceType || "non_log_fallback"} ${(summary.sources || []).join(" ")} ${summary.reviewQuestion || ""}`;
  return {
    id: `non-log-fallback-${index + 1}`,
    sourceType: "non_log_low_token_fallback",
    source: summary.sourceType || "non-log fallback",
    classification: "needs_teacher_review",
    confidence: "low",
    compactEvidence: {
      originalSourceType: summary.sourceType || null,
      sources: Array.isArray(summary.sources) ? summary.sources.slice(0, 8) : [],
      lowTokenUse: summary.lowTokenUse || "metadata_only_before_screenshot",
      retainedSnippet: compactText(text)
    },
    suggestedRuleBoundary:
      "No candidate log was available. Ask the teacher which non-log signal should label the task before creating reusable memory.",
    needsTeacherReview: true
  };
}

const observationInput = argValue("--observation", argValue("--observation-json", ""));
const teacherStyle = argValue("--teacher-style", argValue("--style", "ask_teacher_preference"));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "compact-learning-events")));
const teacherMarkers = argValues("--teacher-marker");
mkdirSync(outputRoot, { recursive: true });

const observation = readJsonInput(observationInput, "--observation");
const software = observation.software || "unknown software";
const packetId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(software)}`;
const packetDir = join(outputRoot, packetId);
mkdirSync(packetDir, { recursive: true });

const logEvents = (Array.isArray(observation.logSummaries) ? observation.logSummaries : [])
  .filter((summary) => (summary?.interestingLineCount ?? 0) > 0 || Array.isArray(summary?.interestingTail))
  .slice(0, 40)
  .map(eventFromLogSummary);

const eventLogEvents = [];
for (const summary of Array.isArray(observation.eventSummaries) ? observation.eventSummaries : []) {
  const latest = Array.isArray(summary?.latest) ? summary.latest.slice(0, 5) : [];
  for (const event of latest) eventLogEvents.push(eventFromEventLog(summary, event, eventLogEvents.length));
}

const markerEvents = [
  ...teacherMarkers,
  ...(Array.isArray(observation.teacherNotes) ? observation.teacherNotes : []),
  ...(Array.isArray(observation.teacherMarkers) ? observation.teacherMarkers : [])
].map(eventFromTeacherMarker);

const nonLogFallbackEvents = (Array.isArray(observation.nonLogFallbackSummaries)
  ? observation.nonLogFallbackSummaries
  : []
).slice(0, 20).map(eventFromNonLogFallback);

const events = [...logEvents, ...eventLogEvents.slice(0, 40), ...nonLogFallbackEvents, ...markerEvents.slice(0, 20)];
const needsTeacherQuestion =
  Boolean(observation.needsTeacherQuestion) ||
  nonLogFallbackEvents.length > 0 ||
  events.some((event) => event.classification === "failure_or_blocker" || event.confidence === "low");

const locks = {
  ...(observation.locks || {}),
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  nativeUniversalExecution: false
};

const packet = {
  format: "transparent_ai_compact_learning_events_from_universal_observation_v1",
  packetId,
  sourceObservationFormat: observation.format || "unknown",
  sourceKitId: observation.kitId || null,
  software,
  processName: observation.processName || "",
  windowTitle: observation.windowTitle || "",
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_review",
  lowTokenCompression: {
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    screenshotRequiredByDefault: false,
    logSummaryCount: Array.isArray(observation.logSummaries) ? observation.logSummaries.length : 0,
    eventSummaryCount: Array.isArray(observation.eventSummaries) ? observation.eventSummaries.length : 0,
    nonLogFallbackEventCount: nonLogFallbackEvents.length,
    compactEventCount: events.length,
    retainedSnippetLimit: 360
  },
  teacherAdaptation: {
    teacherStyle,
    supportsTeachingMethods: [
      "step narration",
      "before/after examples",
      "transparent overlay sketch",
      "voice explanation",
      "screen event export",
      "software logs",
      "manual teacher markers"
    ],
    askNext:
      "Which compact event should become a reusable rule, and what counterexample should keep the rule from overgeneralizing?"
  },
  compactLearningEvents: events,
  suggestedTeacherQuestions: needsTeacherQuestion
    ? [
        "Which event is the actual teaching signal?",
        "Is the signal a success, warning, failure, or normal state change?",
        "When should the apprentice act, and when should it ask first?",
        "What counterexample would make this rule wrong?"
      ]
    : ["Can these compact events be used as positive examples for replay, or should they stay as context only?"],
  nextTeachingCall: {
    tool: "teach_apprentice",
    message: "Paste this compact learning event packet and describe the rule boundary the teacher wants."
  },
  reviewLocks: locks
};

const packetPath = join(packetDir, "compact-learning-events.json");
const readmePath = join(packetDir, "COMPACT_LEARNING_EVENTS_START_HERE.md");
writeFileSync(packetPath, JSON.stringify(packet, null, 2), "utf8");
writeFileSync(readmePath, [
  "# Compact Learning Events",
  "",
  `Source software: ${software}`,
  `Source observation: ${observationInput && existsSync(observationInput) ? basename(observationInput) : "inline JSON"}`,
  "",
  "This packet compresses universal software observation into teacher-reviewable learning events.",
  "",
  "Use this when the apprentice should learn from low-token evidence without pasting full logs or streaming screenshots.",
  "",
  "Next step: paste `compact-learning-events.json` into `teach_apprentice`, then answer which event is the actual reusable rule boundary.",
  "",
  "Locked defaults: ruleEnabled=false, accepted=false, technologyAccepted=false, packagingGated=true, fullContinuousRecording=false."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_compact_learning_events_result_v1",
  packetPath,
  teacherReadme: readmePath,
  compactEventCount: events.length,
  needsTeacherQuestion,
  fullContinuousRecording: false,
  nativeUniversalExecution: false,
  status: packet.status,
  reviewLocks: locks
}, null, 2));
