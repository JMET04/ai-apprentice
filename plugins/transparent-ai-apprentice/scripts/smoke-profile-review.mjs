#!/usr/bin/env node
import { spawnSync } from "node:child_process";

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

const profileName = `profile-review-smoke-${Date.now()}`;
const teach = runScript("teach-by-demonstration.mjs", [
  "--name",
  profileName,
  "--task",
  "Teach a durable apprentice profile memory.",
  "--teacher-message",
  "When the request mentions archive handoff, prepare an archive handoff checklist.",
  "--apprentice-attempt",
  "The apprentice treated every handoff as archive handoff.",
  "--teacher-correction",
  "Only archive handoff requests should use this behavior.",
  "--taught-behavior",
  "Prepare an archive handoff checklist only for explicit archive handoff requests.",
  "--future-input",
  "Please make an archive handoff for this work."
]);

const approval = runScript("approve-teaching-memory.mjs", [
  "--session",
  teach.sessionPath,
  "--teacher-approval",
  "Approved after replay for profile review smoke."
]);

const save = runScript("save-apprentice-memory.mjs", [
  "--session",
  teach.sessionPath,
  "--profile-name",
  profileName
]);

const run = runScript("run-apprentice-profile.mjs", [
  "--profile-name",
  profileName,
  "--input",
  "Please make an archive handoff for this work."
]);

const review = runScript("review-apprentice-profile.mjs", ["--profile-name", profileName]);

const checks = [
  {
    name: "Profile review summarizes enabled approved memory",
    pass:
      review.counts.approvedMemories === 1 &&
      review.counts.enabledMemories === 1 &&
      review.enabledMemorySummaries.length === 1,
    evidence: `approved=${review.counts.approvedMemories}; enabled=${review.counts.enabledMemories}`
  },
  {
    name: "Profile review includes recent execution outcome",
    pass:
      review.counts.executionRuns === 1 &&
      review.latestRun?.outcome === "applied_profile_memory" &&
      review.latestRun.selectedMemoryId === save.memoryId,
    evidence: `runs=${review.counts.executionRuns}; outcome=${review.latestRun?.outcome}`
  },
  {
    name: "Profile review exposes memory policy and next teacher action",
    pass:
      review.memoryPolicy.conflictBehavior === "ask_teacher" &&
      review.nextTeacherActions.length > 0,
    evidence: `conflictBehavior=${review.memoryPolicy.conflictBehavior}; next=${review.nextTeacherActions[0]}`
  },
  {
    name: "Profile review keeps product gates locked",
    pass:
      review.locks.packagingGated === true &&
      review.locks.technologyAccepted === false &&
      review.locks.accepted === false,
    evidence: JSON.stringify(review.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  teach,
  approval,
  save,
  run,
  review,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
