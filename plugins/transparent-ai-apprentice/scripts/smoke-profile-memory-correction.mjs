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

const profileName = `profile-correction-smoke-${Date.now()}`;

const teachResult = run("teach-by-demonstration.mjs", [
  "--name",
  profileName,
  "--task",
  "Correct persisted apprentice memory",
  "--teacher-message",
  "When the user says archive, save a handoff note before stopping.",
  "--apprentice-attempt",
  "The apprentice applied the archive behavior to every mention of old files.",
  "--teacher-correction",
  "Only apply archive behavior when the user explicitly asks to archive this conversation or thread.",
  "--taught-behavior",
  "Prepare an archive handoff only for explicit archive requests.",
  "--future-input",
  "Please archive this conversation after saving a handoff note."
]);

run("approve-teaching-memory.mjs", [
  "--session",
  teachResult.sessionPath,
  "--teacher-approval",
  "I approve this archive rule for profile testing."
]);

const saveResult = run("save-apprentice-memory.mjs", [
  "--session",
  teachResult.sessionPath,
  "--profile-name",
  profileName
]);

const firstRun = run("run-apprentice-profile.mjs", [
  "--profile",
  saveResult.profilePath,
  "--input",
  "Please archive this conversation after saving a handoff note."
]);

const correctionResult = run("correct-apprentice-memory.mjs", [
  "--profile",
  saveResult.profilePath,
  "--memory-id",
  saveResult.memoryId,
  "--teacher-correction",
  "This profile memory is too broad; disable it until I reteach the archive workflow.",
  "--decision",
  "disable"
]);

const secondRun = run("run-apprentice-profile.mjs", [
  "--profile",
  saveResult.profilePath,
  "--input",
  "Please archive this conversation after saving a handoff note."
]);

const profile = JSON.parse(readFileSync(saveResult.profilePath, "utf8"));
const correctedMemory = profile.approvedMemories?.find((memory) => memory.id === saveResult.memoryId);

const checks = [
  {
    name: "Profile memory applies before correction",
    pass: firstRun.outcome === "applied_profile_memory" && firstRun.selectedMemoryId === saveResult.memoryId,
    evidence: `firstOutcome=${firstRun.outcome}; selected=${firstRun.selectedMemoryId}`
  },
  {
    name: "Teacher correction disables persisted memory",
    pass:
      correctionResult.enabled === false &&
      correctionResult.reviewStatus === "disabled_by_teacher" &&
      correctedMemory?.enabled === false,
    evidence: `enabled=${correctionResult.enabled}; reviewStatus=${correctionResult.reviewStatus}`
  },
  {
    name: "Profile memory no longer applies after correction",
    pass: secondRun.outcome === "no_profile_memory_match" && secondRun.selectedMemoryId === "",
    evidence: `secondOutcome=${secondRun.outcome}; selected=${secondRun.selectedMemoryId}`
  },
  {
    name: "Correction trace and limits are saved",
    pass:
      (profile.profileCorrections?.length ?? 0) >= 1 &&
      profile.publicTraces?.some((trace) => trace.sourceProfileCorrectionId === correctionResult.correctionId) &&
      (profile.knownLimits?.length ?? 0) >= 1,
    evidence: `corrections=${profile.profileCorrections?.length ?? 0}; limits=${profile.knownLimits?.length ?? 0}`
  },
  {
    name: "Product gates remain locked",
    pass: correctionResult.packagingGated === true && correctionResult.technologyAccepted === false,
    evidence: `packagingGated=${correctionResult.packagingGated}; technologyAccepted=${correctionResult.technologyAccepted}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  saveResult,
  firstRun,
  correctionResult,
  secondRun,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
