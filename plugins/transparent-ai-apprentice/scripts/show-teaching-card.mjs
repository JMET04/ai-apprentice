#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { discoverSessionPath, markActiveSession } from "./session-state.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function latest(array) {
  return Array.isArray(array) && array.length ? array[array.length - 1] : null;
}

function shortText(value = "", max = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function evidenceSummary(session) {
  const demonstrations = (session.teacherDemonstrations ?? []).map((demo) => ({
    kind: demo.extractedSignals?.type ?? "artifact",
    source: demo.tool ?? "existing-tool",
    summary: shortText(demo.teacherAction || demo.artifactName || "Teacher supplied demonstration evidence."),
    visibleCueCount: (demo.extractedSignals?.cues ?? []).length,
    reviewStatus: demo.reviewStatus ?? "needs_teacher_review"
  }));
  const exchanges = (session.teachingExchanges ?? []).map((exchange) => ({
    kind: "conversation",
    source: exchange.channel ?? "conversation",
    summary: shortText(exchange.teacherMessage || "Teacher explained the behavior in conversation."),
    visibleCueCount: (exchange.extractedCues ?? []).length,
    reviewStatus: exchange.reviewStatus ?? "needs_teacher_review"
  }));
  return [...demonstrations, ...exchanges].slice(-6);
}

function learningStatus(session) {
  const rules = session.ruleDrafts ?? [];
  const replays = session.replays ?? [];
  const enabledRules = rules.filter((rule) => rule.enabled === true);
  if (!rules.length) return "needs_demonstration";
  if (!replays.length) return "needs_replay";
  if (!enabledRules.length) return "waiting_for_teacher_review";
  return "session_memory_enabled";
}

function latestRuleSummary(session) {
  const rule = latest(session.ruleDrafts ?? []);
  if (!rule) return null;
  return {
    proposedWhen: shortText(rule.condition),
    proposedAction: shortText(rule.action),
    confidence: rule.confidence ?? "low",
    status: rule.enabled === true ? "enabled_for_this_session" : rule.reviewStatus ?? "needs_teacher_review",
    stillNeedsTeacher: rule.requiresTeacherConfirmation !== false,
    boundaries: (rule.counterexamples ?? []).slice(-3).map((item) => shortText(item)),
    correctionCount: (rule.teacherCorrections ?? []).length
  };
}

function latestReplaySummary(session) {
  const replay = latest(session.replays ?? []);
  if (!replay) return null;
  return {
    outcome: replay.outcome,
    matchedCueCount: (replay.matchedCues ?? []).length,
    proposedAction: shortText(replay.proposedAction),
    teacherQuestion: shortText(replay.teacherReviewQuestion),
    ruleEnabled: replay.ruleEnabled === true
  };
}

function traceCard(trace) {
  const steps = (trace.steps ?? []).slice(-3);
  return steps.map((step) => ({
    step: shortText(step.step, 80),
    observed: shortText(step.inputObserved),
    proposed: shortText(step.actionProposed),
    confidence: step.confidence ?? "low",
    validation: shortText(step.validation, 120),
    teacherReviewPoint: shortText(step.teacherReviewPoint),
    memoryEffect: shortText(step.memoryEffect ?? "none", 120)
  }));
}

function nextActionsFor(status, latestReplay) {
  if (status === "needs_demonstration") {
    return [
      "Show an example, list action steps, provide before/after examples, or attach an existing file.",
      "Use continue_teaching with the simplest evidence you have."
    ];
  }
  if (status === "needs_replay") {
    return ["Give one future input so the apprentice can replay the draft before any memory is enabled."];
  }
  if (latestReplay?.outcome === "no_rule_match") {
    return ["Say whether this future input is outside the lesson, or provide another demonstration that should cover it."];
  }
  if (status === "waiting_for_teacher_review") {
    return [
      "Say what is wrong if the replay is too broad, too narrow, or misordered.",
      "Say explicit approval only if this replay matches what you meant to teach."
    ];
  }
  return ["Run a learned task, save this memory to an apprentice profile, or correct it if it fails later."];
}

const explicitSessionPath = argValue("--session");
const sessionDiscovery = discoverSessionPath(explicitSessionPath);
if (!sessionDiscovery.sessionPath) {
  throw new Error("No teaching session found. Use continue_teaching first, or pass --session <session.json>.");
}

const sessionPath = resolve(sessionDiscovery.sessionPath);
if (!existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}
markActiveSession(sessionPath, explicitSessionPath ? "show_teaching_card_explicit" : "show_teaching_card_auto");

const session = JSON.parse(readFileSync(sessionPath, "utf8"));
const status = learningStatus(session);
const latestTrace = latest(session.publicTraces ?? []);
const replaySummary = latestReplaySummary(session);

const card = {
  ok: true,
  format: "transparent_ai_teacher_learning_card_v1",
  sessionPath,
  autoDiscoveredSession: sessionDiscovery.autoDiscoveredSession,
  sessionDiscoverySource: sessionDiscovery.discoverySource,
  title: `${session.apprenticeName || "Apprentice"} learning card`,
  task: session.task ?? "",
  status,
  teacherFacingSummary:
    status === "session_memory_enabled"
      ? "The teacher has approved one rule for this teaching session. Product acceptance and packaging are still locked."
      : "The apprentice has a review-only learning draft. It is not approved until the teacher says so after replay.",
  evidence: evidenceSummary(session),
  learnedDraft: latestRuleSummary(session),
  latestReplay: replaySummary,
  publicTraceCard: latestTrace ? traceCard(latestTrace) : [],
  nextTeacherActions: nextActionsFor(status, replaySummary),
  hidesInternalIds: true,
  locks: {
    ruleEnabledByDefault: session.lockDefaults?.ruleEnabled === true,
    privateChainOfThoughtExposed: false,
    accepted: false,
    packagingGated: true
  }
};

console.log(JSON.stringify(card, null, 2));
