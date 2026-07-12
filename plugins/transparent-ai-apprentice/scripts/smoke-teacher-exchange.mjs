#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(script, args) {
  const result = spawnSync(process.execPath, [`plugins/transparent-ai-apprentice/scripts/${script}`, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  return JSON.parse(result.stdout);
}

const sessionResult = run("create-teaching-session.mjs", [
  "--name",
  "teacher-exchange-smoke",
  "--task",
  "Learn from conversational teacher feedback"
]);

const exchangeResult = run("record-teacher-exchange.mjs", [
  "--session",
  sessionResult.sessionPath,
  "--teacher-message",
  "When a user says the task is for early feasibility, reuse existing tools before building a custom UI.",
  "--apprentice-attempt",
  "The apprentice proposed a standalone canvas app first.",
  "--teacher-correction",
  "Do not build a separate drawing app yet; prefer draw.io, Excalidraw, screenshots, and exported artifacts.",
  "--taught-behavior",
  "Choose an existing-tool teaching route before proposing custom software."
]);

const replayResult = run("replay-teaching-session.mjs", [
  "--session",
  sessionResult.sessionPath,
  "--input",
  "For this feasibility task, use Excalidraw or draw.io export and do not build a new custom UI first."
]);

const session = JSON.parse(readFileSync(sessionResult.sessionPath, "utf8"));
const exchange = session.teachingExchanges?.[0];
const rule = session.ruleDrafts?.find((draft) => draft.id === exchangeResult.ruleDraftId);
const exchangeTrace = session.publicTraces?.find((trace) => trace.traceId === exchangeResult.traceId);

const checks = [
  {
    name: "Teacher exchange recorded",
    pass: Boolean(exchange) && exchange.reviewStatus === "needs_teacher_review",
    evidence: `exchanges=${session.teachingExchanges?.length ?? 0}`
  },
  {
    name: "Conversational rule draft remains disabled",
    pass: Boolean(rule) && rule.enabled === false && rule.requiresTeacherConfirmation === true,
    evidence: `enabled=${rule?.enabled}; requiresTeacherConfirmation=${rule?.requiresTeacherConfirmation}`
  },
  {
    name: "Exchange correction is review-only",
    pass:
      session.corrections?.some(
        (correction) =>
          correction.id === exchangeResult.correctionId &&
          correction.reviewStatus === "needs_teacher_review" &&
          correction.ruleEnabled === false
      ) === true,
    evidence: `corrections=${session.corrections?.length ?? 0}`
  },
  {
    name: "Replay detects conversational cues",
    pass: replayResult.outcome === "needs_teacher_review" && replayResult.matchedCueCount > 0,
    evidence: `outcome=${replayResult.outcome}; matchedCueCount=${replayResult.matchedCueCount}`
  },
  {
    name: "Public exchange trace created",
    pass: Boolean(exchangeTrace) && exchangeTrace.steps?.length === 3,
    evidence: `traceSteps=${exchangeTrace?.steps?.length ?? 0}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  sessionPath: sessionResult.sessionPath,
  exchangeResult,
  replayResult,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
