#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function latest(array) {
  return Array.isArray(array) && array.length ? array[array.length - 1] : null;
}

function enabledCount(rules) {
  return rules.filter((rule) => rule.enabled === true).length;
}

function disabledCount(rules) {
  return rules.filter((rule) => rule.enabled !== true).length;
}

function summarizeRule(rule) {
  return {
    id: rule.id,
    condition: rule.condition,
    action: rule.action,
    enabled: rule.enabled === true,
    reviewStatus: rule.reviewStatus ?? "needs_teacher_review",
    requiresTeacherConfirmation: rule.requiresTeacherConfirmation !== false,
    confidence: rule.confidence ?? "low",
    counterexampleCount: (rule.counterexamples ?? []).length,
    correctionCount: (rule.teacherCorrections ?? []).length
  };
}

function traceSummary(trace) {
  return {
    traceId: trace.traceId,
    stepCount: (trace.steps ?? []).length,
    lastTeacherReviewPoint: latest(trace.steps)?.teacherReviewPoint ?? ""
  };
}

const rawSessionPath = argValue("--session");
if (!rawSessionPath) {
  throw new Error("Usage: node review-teaching-session.mjs --session <session.json>");
}

const sessionPath = resolve(rawSessionPath);
if (!existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}

const session = JSON.parse(readFileSync(sessionPath, "utf8"));
const rules = session.ruleDrafts ?? [];
const replays = session.replays ?? [];
const approvals = session.memoryApprovals ?? [];
const traces = session.publicTraces ?? [];
const latestRule = latest(rules);
const latestReplay = latest(replays);
const hasApprovedRule = enabledCount(rules) > 0;
const hasReplay = replays.length > 0;

const nextTeacherActions = [];
if (!rules.length) {
  nextTeacherActions.push("Provide a demonstration artifact or teacher message so the apprentice can draft a review-only rule.");
} else if (!hasReplay) {
  nextTeacherActions.push("Replay a small future input before enabling any memory.");
} else if (!hasApprovedRule) {
  nextTeacherActions.push("Review the latest replay and either approve, correct, or narrow the draft.");
} else {
  nextTeacherActions.push("Run a learned task or save approved memory into an apprentice profile.");
}
if (rules.some((rule) => (rule.teacherCorrections ?? []).length > 0 && rule.enabled !== true)) {
  nextTeacherActions.push("Check corrected drafts and replay them before approval.");
}
if (latestReplay?.outcome === "no_rule_match") {
  nextTeacherActions.push("Decide whether the replay input is outside the taught boundary or needs another demonstration.");
}

const result = {
  ok: true,
  format: "transparent_ai_teaching_session_review_v1",
  sessionPath,
  sessionId: session.sessionId,
  apprenticeName: session.apprenticeName,
  task: session.task,
  counts: {
    demonstrations: (session.teacherDemonstrations ?? []).length,
    teachingExchanges: (session.teachingExchanges ?? []).length,
    corrections: (session.corrections ?? []).length,
    ruleDrafts: rules.length,
    disabledRuleDrafts: disabledCount(rules),
    enabledRules: enabledCount(rules),
    replays: replays.length,
    memoryApprovals: approvals.length,
    publicTraces: traces.length
  },
  latestRule: latestRule ? summarizeRule(latestRule) : null,
  latestReplay: latestReplay
    ? {
        id: latestReplay.id,
        selectedRuleDraftId: latestReplay.selectedRuleDraftId,
        outcome: latestReplay.outcome,
        matchedCueCount: (latestReplay.matchedCues ?? []).length,
        ruleEnabled: latestReplay.ruleEnabled === true,
        teacherReviewQuestion: latestReplay.teacherReviewQuestion
      }
    : null,
  ruleSummaries: rules.slice(-5).map(summarizeRule),
  traceSummaries: traces.slice(-5).map(traceSummary),
  nextTeacherActions,
  locks: {
    ruleEnabledDefault: session.lockDefaults?.ruleEnabled === true,
    privateChainOfThoughtExposed: session.lockDefaults?.privateChainOfThoughtExposed === true,
    accepted: false,
    packagingGated: true
  }
};

console.log(JSON.stringify(result, null, 2));
