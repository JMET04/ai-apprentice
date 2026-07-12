#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "teachable-apprentice";
}

function latest(array) {
  return Array.isArray(array) && array.length ? array[array.length - 1] : null;
}

function memorySummary(memory) {
  return {
    id: memory.id,
    action: memory.action,
    condition: memory.condition,
    enabled: memory.enabled === true,
    reviewStatus: memory.reviewStatus ?? "",
    cueCount: (memory.cues ?? []).length,
    counterexampleCount: (memory.counterexamples ?? []).length,
    correctionCount: (memory.teacherCorrections ?? []).length,
    confidence: memory.confidence ?? "low"
  };
}

const rawProfilePath = argValue("--profile");
const profileName = argValue("--profile-name", "teachable-apprentice");
const profilePath = rawProfilePath
  ? resolve(rawProfilePath)
  : join(process.cwd(), ".transparent-apprentice", "apprentices", `${slugify(profileName)}.json`);

if (!existsSync(profilePath)) {
  throw new Error(`Apprentice profile not found: ${profilePath}`);
}

const profile = JSON.parse(readFileSync(profilePath, "utf8"));
const memories = profile.approvedMemories ?? [];
const enabledMemories = memories.filter((memory) => memory.enabled === true);
const disabledMemories = memories.filter((memory) => memory.enabled !== true);
const runs = profile.executionHistory ?? [];
const latestRun = latest(runs);
const conflicts = runs.filter((run) => run.outcome === "needs_teacher_review_conflict");
const noMatches = runs.filter((run) => run.outcome === "no_profile_memory_match");
const corrections = profile.profileCorrections ?? [];

const nextTeacherActions = [];
if (enabledMemories.length === 0) {
  nextTeacherActions.push("Teach and approve at least one memory before expecting this apprentice profile to act.");
}
if (disabledMemories.length > 0) {
  nextTeacherActions.push("Review disabled memories and decide whether to reteach, narrow, or leave them off.");
}
if (conflicts.length > 0) {
  nextTeacherActions.push("Resolve memory conflicts by choosing, disabling, narrowing, or reteaching the competing memories.");
}
if (latestRun?.outcome === "no_profile_memory_match") {
  nextTeacherActions.push("Add a demonstration or correction for the latest unmatched task.");
}
if (enabledMemories.length > 0 && !nextTeacherActions.length) {
  nextTeacherActions.push("Run another future task and correct the apprentice if the memory is too broad, stale, or wrong.");
}

const result = {
  ok: true,
  format: "transparent_ai_apprentice_profile_review_v1",
  profilePath,
  apprenticeName: profile.apprenticeName,
  teacherGoal: profile.teacherGoal,
  knownSkills: profile.knownSkills ?? [],
  knownLimits: profile.knownLimits ?? [],
  counts: {
    approvedMemories: memories.length,
    enabledMemories: enabledMemories.length,
    disabledMemories: disabledMemories.length,
    executionRuns: runs.length,
    conflictRuns: conflicts.length,
    noMatchRuns: noMatches.length,
    corrections: corrections.length,
    publicTraces: (profile.publicTraces ?? []).length
  },
  enabledMemorySummaries: enabledMemories.slice(-8).map(memorySummary),
  disabledMemorySummaries: disabledMemories.slice(-8).map(memorySummary),
  latestRun: latestRun
    ? {
        id: latestRun.id,
        outcome: latestRun.outcome,
        selectedMemoryId: latestRun.selectedMemoryId ?? "",
        conflictMemoryIds: latestRun.conflictMemoryIds ?? [],
        actionTaken: latestRun.actionTaken
      }
    : null,
  memoryPolicy: {
    defaultRuleEnabled: profile.memoryPolicy?.defaultRuleEnabled === true,
    requiresTeacherConfirmation: profile.memoryPolicy?.requiresTeacherConfirmation !== false,
    conflictBehavior: profile.memoryPolicy?.conflictBehavior ?? "ask_teacher"
  },
  nextTeacherActions,
  locks: {
    packagingGated: profile.locks?.packagingGated !== false,
    technologyAccepted: profile.locks?.technologyAccepted === true,
    accepted: false
  }
};

console.log(JSON.stringify(result, null, 2));
