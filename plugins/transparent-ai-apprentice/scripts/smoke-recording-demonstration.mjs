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

const artifact = run("create-recording-demonstration-artifact.mjs", [
  "--goal",
  "Teach refund triage from an existing Jam recording without asking the teacher to rewrite every click.",
  "--recording-url",
  "https://jam.dev/c/example-recording",
  "--source-tool",
  "Jam",
  "--observation",
  "Watch how the teacher checks the policy note before routing the ticket.",
  "--step",
  "Open the refund ticket in the browser.",
  "--step",
  "Check whether a policy note exists.",
  "--step",
  "Route only policy-note refunds to policy review.",
  "--validation",
  "Ordinary refunds without policy notes must not route to policy review.",
  "--teacher-action",
  "Teacher recorded the refund triage workflow in Jam.",
  "--taught-behavior",
  "Route refunds to policy review only when the recording shows a policy note.",
  "--future-input",
  "Refund ticket without a policy note."
]);

const taught = run("continue-teaching.mjs", [
  "--goal",
  "Teach refund triage from a recording link.",
  "--recording-url",
  "https://jam.dev/c/example-recording",
  "--tool",
  "Jam",
  "--observation",
  "Teacher checks policy note first.",
  "--step",
  "Open refund ticket.",
  "--step",
  "Check policy note.",
  "--step",
  "Route only policy-note refunds.",
  "--teacher-action",
  "Teacher recorded the refund triage workflow in Jam.",
  "--taught-behavior",
  "Use the recorded workflow as a review-only rule draft.",
  "--future-input",
  "Refund ticket without a policy note."
]);

const checks = [
  {
    name: "Recording demonstration artifact captures an existing recording link",
    pass:
      artifact.format === "transparent_ai_recording_demonstration_artifact_result_v1" &&
      artifact.recordingUrl === "https://jam.dev/c/example-recording" &&
      artifact.sourceTool === "Jam" &&
      artifact.eventCount === 3 &&
      existsSync(artifact.artifactPath),
    evidence: `url=${artifact.recordingUrl}; events=${artifact.eventCount}; exists=${existsSync(artifact.artifactPath)}`
  },
  {
    name: "Recording demonstration artifact points back to the teaching loop",
    pass:
      artifact.nextMcpCall.tool === "teach_by_demonstration" &&
      artifact.nextMcpCall.arguments.artifact === artifact.artifactPath &&
      artifact.locks.ruleEnabled === false,
    evidence: `nextTool=${artifact.nextMcpCall.tool}; ruleEnabled=${artifact.locks.ruleEnabled}`
  },
  {
    name: "Continue teaching accepts recording links without event JSON",
    pass:
      taught.route === "teach_from_recording_link" &&
      taught.primaryResult?.taughtResult?.ruleEnabled === false &&
      taught.primaryResult?.replayResult?.outcome === "needs_teacher_review",
    evidence: `route=${taught.route}; replay=${taught.primaryResult?.replayResult?.outcome}`
  },
  {
    name: "Recording link workflow keeps product gates closed",
    pass:
      taught.locks.accepted === false &&
      taught.locks.packagingGated === true &&
      taught.locks.technologyAccepted === false,
    evidence: JSON.stringify(taught.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  artifact,
  taught,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
