#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

const profileName = `profile-conflict-smoke-${Date.now()}`;
const profilePath = join(process.cwd(), ".transparent-apprentice", "apprentices", `${profileName}.json`);
mkdirSync(dirname(profilePath), { recursive: true });

const profile = {
  format: "transparent_ai_apprentice_profile_v1",
  apprenticeName: profileName,
  approvedMemories: [
    {
      format: "transparent_ai_profile_memory_v1",
      id: "memory-conflict-a",
      condition: "When task mentions shared cue and export.",
      action: "Use export workflow.",
      cues: ["shared", "cue", "export"],
      enabled: true,
      reviewStatus: "approved_for_profile",
      confidence: "medium",
      packagingGated: true,
      technologyAccepted: false
    },
    {
      format: "transparent_ai_profile_memory_v1",
      id: "memory-conflict-b",
      condition: "When task mentions shared cue and export.",
      action: "Use archive workflow.",
      cues: ["shared", "cue", "export"],
      enabled: true,
      reviewStatus: "approved_for_profile",
      confidence: "medium",
      packagingGated: true,
      technologyAccepted: false
    }
  ],
  publicTraces: [],
  executionHistory: [],
  memoryPolicy: {
    defaultRuleEnabled: false,
    requiresTeacherConfirmation: true,
    conflictBehavior: "ask_teacher"
  },
  locks: {
    packagingGated: true,
    technologyAccepted: false
  }
};

writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");

const runResult = run("run-apprentice-profile.mjs", [
  "--profile",
  profilePath,
  "--input",
  "This task has shared cue export."
]);

const updatedProfile = JSON.parse(readFileSync(profilePath, "utf8"));
const runRecord = updatedProfile.executionHistory?.find((run) => run.id === runResult.runId);
const trace = updatedProfile.publicTraces?.find((item) => item.traceId === runResult.traceId);

const checks = [
  {
    name: "Profile run pauses on equal memory conflict",
    pass:
      runResult.outcome === "needs_teacher_review_conflict" &&
      runResult.selectedMemoryId === "" &&
      runResult.conflictMemoryIds?.length === 2,
    evidence: `outcome=${runResult.outcome}; conflicts=${runResult.conflictMemoryIds?.length ?? 0}`
  },
  {
    name: "No conflicting memory is applied",
    pass: runResult.actionTaken.includes("Multiple approved profile memories") && runRecord?.selectedMemoryId === "",
    evidence: `actionTaken=${runResult.actionTaken}`
  },
  {
    name: "Conflict trace asks teacher to resolve",
    pass:
      trace?.steps?.some((step) => String(step.teacherReviewPoint).includes("Choose the correct memory")) &&
      trace?.steps?.some((step) => String(step.memoryEffect).includes("conflict")),
    evidence: `traceSteps=${trace?.steps?.length ?? 0}`
  },
  {
    name: "Product gates remain locked",
    pass: runResult.packagingGated === true && runResult.technologyAccepted === false,
    evidence: `packagingGated=${runResult.packagingGated}; technologyAccepted=${runResult.technologyAccepted}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  runResult,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}
