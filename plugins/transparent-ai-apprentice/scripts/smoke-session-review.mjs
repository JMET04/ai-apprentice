#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function runScript(scriptName, args) {
  const result = spawnSync(process.execPath, [`plugins/transparent-ai-apprentice/scripts/${scriptName}`, ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

const teach = runScript("teach-by-demonstration.mjs", [
  "--name",
  `session-review-smoke-${Date.now()}`,
  "--task",
  "Teach from a drawing and inspect the learning state.",
  "--artifact",
  join("plugins", "transparent-ai-apprentice", "assets", "examples", "drawing-demo.svg"),
  "--tool",
  "draw.io",
  "--taught-behavior",
  "Follow the teacher-confirmed drawing sequence.",
  "--future-input",
  "Use the drawing sequence on another workflow."
]);

const review = runScript("review-teaching-session.mjs", ["--session", teach.sessionPath]);

const checks = [
  {
    name: "Review summarizes captured teaching evidence",
    pass:
      review.counts.demonstrations === 1 &&
      review.counts.ruleDrafts === 1 &&
      review.counts.publicTraces >= 2,
    evidence: `demonstrations=${review.counts.demonstrations}; rules=${review.counts.ruleDrafts}; traces=${review.counts.publicTraces}`
  },
  {
    name: "Review shows latest replay status",
    pass:
      ["needs_teacher_review", "no_rule_match"].includes(review.latestReplay?.outcome) &&
      review.latestReplay.matchedCueCount >= 0 &&
      review.latestReplay.ruleEnabled === false,
    evidence: `outcome=${review.latestReplay?.outcome}; ruleEnabled=${review.latestReplay?.ruleEnabled}`
  },
  {
    name: "Review keeps draft memory disabled by default",
    pass:
      review.counts.disabledRuleDrafts === 1 &&
      review.counts.enabledRules === 0 &&
      review.latestRule?.requiresTeacherConfirmation === true,
    evidence: `disabled=${review.counts.disabledRuleDrafts}; enabled=${review.counts.enabledRules}`
  },
  {
    name: "Review tells the teacher the next useful action",
    pass:
      review.nextTeacherActions.some((action) => action.includes("approve") || action.includes("correct") || action.includes("narrow")) &&
      review.locks.privateChainOfThoughtExposed === false &&
      review.locks.packagingGated === true,
    evidence: review.nextTeacherActions.join(" | ")
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  teach,
  review,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
