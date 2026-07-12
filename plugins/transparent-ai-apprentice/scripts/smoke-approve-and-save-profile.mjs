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

const profileName = `approval-save-smoke-${Date.now()}`;

const seed = run("continue-teaching.mjs", [
  "--goal",
  "Teach reusable support refund triage from a direct demonstration.",
  "--tool",
  "browser",
  "--step",
  "Open a refund ticket with a policy note.",
  "--step",
  "Check policy note before choosing a queue.",
  "--step",
  "Route policy-note refunds to policy review.",
  "--teacher-action",
  "Teacher demonstrated policy-note refund routing.",
  "--taught-behavior",
  "Route policy-note refunds to policy review.",
  "--future-input",
  "Refund ticket with policy note that should route to policy review."
]);

const approvedAndSaved = run("continue-teaching.mjs", [
  "--session",
  seed.sessionPath,
  "--teacher-response",
  "Approved, remember this for next time.",
  "--profile-name",
  profileName
]);

const profileRun = run("run-apprentice-profile.mjs", [
  "--profile-name",
  profileName,
  "--input",
  "New refund ticket with policy note that should route to policy review."
]);

const checks = [
  {
    name: "Continue teaching seeds a replayed rule before profile save",
    pass:
      seed.route === "teach_from_action_sequence" &&
      seed.primaryResult?.taughtResult?.ruleEnabled === false &&
      seed.primaryResult?.replayResult?.outcome === "needs_teacher_review",
    evidence: `route=${seed.route}; replay=${seed.primaryResult?.replayResult?.outcome}`
  },
  {
    name: "Plain teacher approval can approve and save profile memory",
    pass:
      approvedAndSaved.route === "teacher_response_approves_and_saves_profile_memory" &&
      approvedAndSaved.primaryResult?.ruleEnabled === true &&
      approvedAndSaved.primaryResult?.profileSaveResult?.reviewStatus === "approved_for_profile" &&
      approvedAndSaved.primaryResult?.profileSaveResult?.approvedMemoryCount >= 1,
    evidence: `route=${approvedAndSaved.route}; memory=${approvedAndSaved.primaryResult?.profileSaveResult?.memoryId}`
  },
  {
    name: "Saved apprentice profile memory applies to a future task",
    pass:
      profileRun.outcome === "applied_profile_memory" &&
      profileRun.matchedCueCount > 0 &&
      profileRun.packagingGated === true &&
      profileRun.technologyAccepted === false,
    evidence: `outcome=${profileRun.outcome}; matched=${profileRun.matchedCueCount}`
  },
  {
    name: "Approve and save keeps product gates closed",
    pass:
      approvedAndSaved.locks.accepted === false &&
      approvedAndSaved.locks.packagingGated === true &&
      approvedAndSaved.locks.technologyAccepted === false &&
      approvedAndSaved.locks.requiresTeacherConfirmation === false,
    evidence: JSON.stringify(approvedAndSaved.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  profileName,
  seed,
  approvedAndSaved,
  profileRun,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
