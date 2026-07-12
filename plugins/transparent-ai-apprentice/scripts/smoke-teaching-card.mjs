#!/usr/bin/env node
import { spawnSync } from "node:child_process";

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

const taught = run("continue-teaching.mjs", [
  "--goal",
  "Teach a teacher-facing learning card from ordered steps.",
  "--tool",
  "browser workflow",
  "--step",
  "Open the support ticket.",
  "--step",
  "Select the refund category.",
  "--step",
  "Verify the response asks for photo evidence.",
  "--future-input",
  "Handle another refund ticket."
]);

const card = run("show-teaching-card.mjs", ["--session", taught.sessionPath]);
const latestCard = run("show-teaching-card.mjs", []);
const serializedCard = JSON.stringify(card);

const checks = [
  {
    name: "Teaching card summarizes the latest learning state",
    pass:
      card.format === "transparent_ai_teacher_learning_card_v1" &&
      card.status === "waiting_for_teacher_review" &&
      card.evidence.length >= 1 &&
      card.learnedDraft?.status === "needs_teacher_review",
    evidence: `status=${card.status}; evidence=${card.evidence.length}`
  },
  {
    name: "Teaching card hides internal rule and trace ids",
    pass:
      card.hidesInternalIds === true &&
      !serializedCard.includes("rule-draft-") &&
      !serializedCard.includes("trace-") &&
      !serializedCard.includes("demo-"),
    evidence: `hidesInternalIds=${card.hidesInternalIds}`
  },
  {
    name: "Teaching card exposes public trace fields only",
    pass:
      card.publicTraceCard.length > 0 &&
      card.publicTraceCard.every((step) => step.step && step.validation && step.teacherReviewPoint),
    evidence: `traceSteps=${card.publicTraceCard.length}`
  },
  {
    name: "Teaching card gives teacher-facing next actions and locked gates",
    pass:
      card.nextTeacherActions.length >= 1 &&
      card.locks.accepted === false &&
      card.locks.packagingGated === true &&
      card.locks.privateChainOfThoughtExposed === false,
    evidence: JSON.stringify(card.locks)
  },
  {
    name: "Teaching card can discover the latest session without a path",
    pass:
      latestCard.autoDiscoveredSession === true &&
      latestCard.sessionPath === taught.sessionPath &&
      latestCard.hidesInternalIds === true,
    evidence: `auto=${latestCard.autoDiscoveredSession}; latest=${latestCard.sessionPath}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  sessionPath: taught.sessionPath,
  card,
  latestCard,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
