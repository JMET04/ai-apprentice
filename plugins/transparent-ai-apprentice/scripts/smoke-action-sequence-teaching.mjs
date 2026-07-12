#!/usr/bin/env node
import { existsSync } from "node:fs";
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

const artifact = run("create-action-sequence-artifact.mjs", [
  "--goal",
  "Teach a support triage workflow from ordered teacher actions.",
  "--tool",
  "browser workflow",
  "--step",
  "Open the customer ticket.",
  "--step",
  "Select the refund category when the user reports a broken item.",
  "--step",
  "Type a request for photo evidence.",
  "--step",
  "Verify the reply asks for the order id before saving.",
  "--future-input",
  "Triage a new broken-item refund ticket."
]);

const taught = run("teach-by-demonstration.mjs", [
  "--name",
  "action-sequence-smoke",
  "--task",
  "Teach a support triage workflow from ordered teacher actions.",
  "--artifact",
  artifact.artifactPath,
  "--tool",
  "browser workflow",
  "--teacher-action",
  "Teacher supplied ordered hands-on actions.",
  "--taught-behavior",
  "Follow the teacher-confirmed action order only after review.",
  "--future-input",
  "Triage a new broken-item refund ticket."
]);

const review = run("review-teaching-session.mjs", ["--session", taught.sessionPath]);

const continued = run("continue-teaching.mjs", [
  "--goal",
  "Teach by listing hands-on browser steps through the single entry.",
  "--tool",
  "browser workflow",
  "--step",
  "Click the customer ticket.",
  "--step",
  "Select damaged item.",
  "--step",
  "Enter the photo evidence request.",
  "--future-input",
  "Handle another damaged-item ticket."
]);

const checks = [
  {
    name: "Action sequence artifact records ordered teacher actions",
    pass:
      artifact.format === "transparent_ai_action_sequence_artifact_result_v1" &&
      existsSync(artifact.artifactPath) &&
      artifact.stepCount === 4 &&
      artifact.locks.ruleEnabled === false,
    evidence: `steps=${artifact.stepCount}; path=${artifact.artifactPath}`
  },
  {
    name: "Action sequence teaches through existing import path",
    pass:
      taught.mode === "existing_tool_artifact" &&
      taught.taughtResult.extractedCueCount > 8 &&
      taught.ruleEnabled === false &&
      taught.replayResult?.outcome === "needs_teacher_review",
    evidence: `cues=${taught.taughtResult.extractedCueCount}; outcome=${taught.replayResult?.outcome}`
  },
  {
    name: "Session review exposes disabled action-sequence memory",
    pass:
      review.counts.ruleDrafts === 1 &&
      review.counts.disabledRuleDrafts === 1 &&
      review.latestRule.condition.includes("action-sequence"),
    evidence: `rules=${review.counts.ruleDrafts}; condition=${review.latestRule.condition}`
  },
  {
    name: "Continue teaching accepts plain ordered action steps",
    pass:
      continued.route === "teach_from_action_sequence" &&
      continued.primaryResult.ruleEnabled === false &&
      continued.locks.accepted === false &&
      continued.locks.packagingGated === true,
    evidence: `route=${continued.route}; session=${continued.sessionPath}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  artifact,
  taught,
  review,
  continued,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
