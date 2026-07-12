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

const sessionTeach = runScript("teach-by-demonstration.mjs", [
  "--name",
  `correct-last-session-${Date.now()}`,
  "--task",
  "Teach from a drawing then correct the latest draft.",
  "--artifact",
  join("plugins", "transparent-ai-apprentice", "assets", "examples", "drawio-demo.drawio"),
  "--tool",
  "draw.io",
  "--taught-behavior",
  "Follow the teacher-confirmed connector direction."
]);

const sessionCorrection = runScript("correct-last-result.mjs", [
  "--session",
  sessionTeach.sessionPath,
  "--correction",
  "This connector direction was only an example; do not treat it as a rule until I confirm it.",
  "--type",
  "wrong_connector"
]);

const sessionReview = runScript("review-teaching-session.mjs", ["--session", sessionTeach.sessionPath]);

const autoSessionTeach = runScript("teach-by-demonstration.mjs", [
  "--name",
  `correct-last-auto-session-${Date.now()}`,
  "--task",
  "Teach from an event log then correct the latest draft without passing a session path.",
  "--artifact",
  join("plugins", "transparent-ai-apprentice", "assets", "examples", "screen-event-log-demo.json"),
  "--tool",
  "screen recording event export",
  "--taught-behavior",
  "Follow the demonstrated event order only after teacher review."
]);

const autoSessionCorrection = runScript("correct-last-result.mjs", [
  "--correction",
  "This event order is only valid for refund tickets that ask for photo evidence.",
  "--type",
  "too_broad"
]);

const autoSessionReview = runScript("review-teaching-session.mjs", ["--session", autoSessionTeach.sessionPath]);

const profileName = `correct-last-profile-${Date.now()}`;
const profileTeach = runScript("teach-by-demonstration.mjs", [
  "--name",
  profileName,
  "--task",
  "Teach a persisted memory and correct the latest profile result.",
  "--teacher-message",
  "When the request says weekly digest, create a weekly digest checklist.",
  "--apprentice-attempt",
  "The apprentice used the digest checklist for every summary.",
  "--teacher-correction",
  "Only weekly digest requests should use this checklist.",
  "--taught-behavior",
  "Create a weekly digest checklist only for explicit weekly digest requests.",
  "--future-input",
  "Please create a weekly digest for this project."
]);

runScript("approve-teaching-memory.mjs", [
  "--session",
  profileTeach.sessionPath,
  "--teacher-approval",
  "Approved for correct-last-result smoke."
]);

runScript("save-apprentice-memory.mjs", ["--session", profileTeach.sessionPath, "--profile-name", profileName]);
const profileRun = runScript("run-apprentice-profile.mjs", [
  "--profile-name",
  profileName,
  "--input",
  "Please create a weekly digest for this project."
]);

const profileCorrection = runScript("correct-last-result.mjs", [
  "--profile-name",
  profileName,
  "--correction",
  "This was too broad for project status summaries; disable the latest memory until I reteach the boundary."
]);

const profileReview = runScript("review-apprentice-profile.mjs", ["--profile-name", profileName]);

const checks = [
  {
    name: "Correct last session draft without rule id",
    pass:
      sessionCorrection.targetSurface === "teaching_session" &&
      sessionCorrection.correctedResult.ruleEnabled === false &&
      sessionCorrection.correctedResult.targetRuleDraftId === sessionTeach.taughtResult.ruleDraftId,
    evidence: `target=${sessionCorrection.correctedResult.targetRuleDraftId}; ruleEnabled=${sessionCorrection.correctedResult.ruleEnabled}`
  },
  {
    name: "Session review shows correction evidence",
    pass:
      sessionReview.counts.corrections === 1 &&
      sessionReview.latestRule.correctionCount === 1 &&
      sessionReview.counts.disabledRuleDrafts === 1,
    evidence: `corrections=${sessionReview.counts.corrections}; ruleCorrections=${sessionReview.latestRule.correctionCount}`
  },
  {
    name: "Correct latest session draft without session path",
    pass:
      autoSessionCorrection.targetSurface === "teaching_session" &&
      autoSessionCorrection.autoDiscoveredSession === true &&
      autoSessionCorrection.sessionPath === autoSessionTeach.sessionPath &&
      autoSessionCorrection.correctedResult.ruleEnabled === false &&
      autoSessionReview.counts.corrections === 1,
    evidence: `auto=${autoSessionCorrection.autoDiscoveredSession}; session=${autoSessionCorrection.sessionPath}`
  },
  {
    name: "Correct last profile memory without memory id",
    pass:
      profileRun.outcome === "applied_profile_memory" &&
      profileCorrection.targetSurface === "apprentice_profile" &&
      profileCorrection.correctedResult.memoryId === profileRun.selectedMemoryId &&
      profileCorrection.correctedResult.enabled === false,
    evidence: `selected=${profileRun.selectedMemoryId}; corrected=${profileCorrection.correctedResult.memoryId}; enabled=${profileCorrection.correctedResult.enabled}`
  },
  {
    name: "Profile review shows disabled corrected memory",
    pass:
      profileReview.counts.disabledMemories === 1 &&
      profileReview.counts.corrections === 1 &&
      profileReview.locks.packagingGated === true,
    evidence: `disabled=${profileReview.counts.disabledMemories}; corrections=${profileReview.counts.corrections}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  sessionCorrection,
  sessionReview,
  autoSessionCorrection,
  autoSessionReview,
  profileRun,
  profileCorrection,
  profileReview,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
