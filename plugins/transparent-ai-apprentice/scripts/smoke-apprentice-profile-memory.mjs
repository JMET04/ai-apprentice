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

const profileName = `profile-memory-smoke-${Date.now()}`;

const teachResult = run("teach-by-demonstration.mjs", [
  "--name",
  profileName,
  "--task",
  "Persist approved apprentice memory across sessions",
  "--teacher-message",
  "When the teacher says profile memory, save approved lessons to the apprentice profile.",
  "--apprentice-attempt",
  "The apprentice only used session memory.",
  "--teacher-correction",
  "After explicit approval, persist the lesson into the apprentice profile so future sessions can use it.",
  "--taught-behavior",
  "Persist approved lessons into the apprentice profile for future sessions.",
  "--future-input",
  "Profile memory should save approved lessons for future sessions."
]);

const approvalResult = run("approve-teaching-memory.mjs", [
  "--session",
  teachResult.sessionPath,
  "--teacher-approval",
  "I approve this lesson for the apprentice profile after replay."
]);

const saveResult = run("save-apprentice-memory.mjs", [
  "--session",
  teachResult.sessionPath,
  "--profile-name",
  profileName
]);

const profileRunResult = run("run-apprentice-profile.mjs", [
  "--profile",
  saveResult.profilePath,
  "--input",
  "Please use profile memory and persist approved lessons for future sessions."
]);

const profile = JSON.parse(readFileSync(saveResult.profilePath, "utf8"));

const checks = [
  {
    name: "Approved memory saved to apprentice profile",
    pass:
      saveResult.reviewStatus === "approved_for_profile" &&
      saveResult.approvedMemoryCount >= 1 &&
      profile.approvedMemories?.some((memory) => memory.id === saveResult.memoryId && memory.enabled === true),
    evidence: `approvedMemoryCount=${saveResult.approvedMemoryCount}; reviewStatus=${saveResult.reviewStatus}`
  },
  {
    name: "Profile run applies persisted memory",
    pass:
      profileRunResult.outcome === "applied_profile_memory" &&
      profileRunResult.selectedMemoryId === saveResult.memoryId &&
      profileRunResult.matchedCueCount > 0,
    evidence: `outcome=${profileRunResult.outcome}; matchedCueCount=${profileRunResult.matchedCueCount}`
  },
  {
    name: "Profile records public traces and run history",
    pass: (profile.publicTraces?.length ?? 0) >= 2 && (profile.executionHistory?.length ?? 0) >= 1,
    evidence: `traces=${profile.publicTraces?.length ?? 0}; runs=${profile.executionHistory?.length ?? 0}`
  },
  {
    name: "Profile memory keeps product gates locked",
    pass:
      saveResult.packagingGated === true &&
      profileRunResult.packagingGated === true &&
      profile.locks?.technologyAccepted === false,
    evidence: `packagingGated=${profileRunResult.packagingGated}; technologyAccepted=${profile.locks?.technologyAccepted}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  teachResult,
  approvalResult,
  saveResult,
  profileRunResult,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
