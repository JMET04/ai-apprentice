#!/usr/bin/env node
import { closeSync, existsSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function withFileLock(targetPath, operation) {
  const lockPath = `${targetPath}.lock`;
  let handle;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      handle = openSync(lockPath, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      sleep(50);
    }
  }
  if (handle === undefined) throw new Error(`Could not acquire lock: ${lockPath}`);
  try {
    return operation();
  } finally {
    closeSync(handle);
    rmSync(lockPath, { force: true });
  }
}

function writeJsonAtomic(path, value) {
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

function matchedCuesForInput(input, cues) {
  const normalized = input.toLowerCase();
  return (cues ?? []).filter((cue) => normalized.includes(String(cue).toLowerCase()));
}

const rawProfilePath = argValue("--profile");
const profileName = argValue("--profile-name", "teachable-apprentice");
const taskInput = argValue("--input");

if (!taskInput) {
  throw new Error("Usage: node run-apprentice-profile.mjs --profile <profile.json> --input <future task>");
}

const profilePath = rawProfilePath
  ? resolve(rawProfilePath)
  : join(process.cwd(), ".transparent-apprentice", "apprentices", `${slugify(profileName)}.json`);

if (!existsSync(profilePath)) throw new Error(`Apprentice profile not found: ${profilePath}`);

let output;
withFileLock(profilePath, () => {
  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  const enabledMemories = (profile.approvedMemories ?? []).filter((memory) => memory.enabled === true);
  const scored = enabledMemories
    .map((memory) => ({ memory, matchedCues: matchedCuesForInput(taskInput, memory.cues) }))
    .sort((a, b) => b.matchedCues.length - a.matchedCues.length);
  const topScore = scored[0]?.matchedCues.length ?? 0;
  const topCandidates = topScore > 0 ? scored.filter((candidate) => candidate.matchedCues.length === topScore) : [];
  const hasConflict = topCandidates.length > 1;
  const selected = hasConflict ? null : scored.find((candidate) => candidate.matchedCues.length > 0);
  const runId = `profile-run-${Date.now()}`;
  const traceId = `trace-${Date.now()}-profile-run`;
  const outcome = hasConflict ? "needs_teacher_review_conflict" : selected ? "applied_profile_memory" : "no_profile_memory_match";
  const actionTaken = hasConflict
    ? "Multiple approved profile memories matched equally. Ask the teacher which memory should apply."
    : selected
    ? selected.memory.action
    : "No approved apprentice profile memory matched this input. Teach or correct the apprentice.";

  const run = {
    format: "transparent_ai_apprentice_profile_run_v1",
    id: runId,
    input: taskInput,
    selectedMemoryId: selected?.memory.id ?? "",
    sourceRuleDraftId: selected?.memory.sourceRuleDraftId ?? "",
    matchedCues: selected?.matchedCues ?? [],
    conflictMemoryIds: hasConflict ? topCandidates.map((candidate) => candidate.memory.id) : [],
    conflictMatchedCueCount: hasConflict ? topScore : 0,
    actionTaken,
    outcome,
    packagingGated: true,
    technologyAccepted: false
  };

  const publicTrace = {
    format: "transparent_ai_public_trace_v1",
    traceId,
    sourceProfileRunId: runId,
    steps: [
      {
        step: "search apprentice profile memory",
        inputObserved: taskInput,
        ruleCandidates: enabledMemories.map((memory) => memory.id),
        actionProposed: hasConflict
          ? "Pause and ask the teacher to resolve the matching memory conflict."
          : selected
          ? `Use profile memory ${selected.memory.id}.`
          : "No profile memory matched.",
        confidence: hasConflict ? "low" : selected && selected.matchedCues.length > 2 ? "medium" : "low",
        validation: `enabledMemories=${enabledMemories.length}; matchedCues=${selected?.matchedCues.length ?? topScore}; conflict=${hasConflict}`,
        teacherReviewPoint: hasConflict
          ? "Choose the correct memory, disable one memory, or reteach the distinction."
          : selected
          ? "Confirm the persisted memory still applies."
          : "Teach this case or add a correction.",
        memoryEffect: hasConflict ? "conflict review required" : selected ? "profile memory changed this run" : "none"
      },
      {
        step: "execute with persisted memory provenance",
        inputObserved: JSON.stringify({
          selectedMemoryId: run.selectedMemoryId,
          sourceRuleDraftId: run.sourceRuleDraftId,
          matchedCues: run.matchedCues,
          conflictMemoryIds: run.conflictMemoryIds,
          actionTaken
        }).slice(0, 1200),
        ruleCandidates: hasConflict ? topCandidates.map((candidate) => candidate.memory.id) : selected ? [selected.memory.id] : [],
        actionProposed: actionTaken,
        confidence: hasConflict ? "low" : selected ? selected.memory.confidence ?? "medium" : "low",
        validation: `outcome=${outcome}; packagingGated=true; technologyAccepted=false`,
        teacherReviewPoint: hasConflict
          ? "Resolve the conflict before applying profile memory."
          : "Correct this run if the profile memory is too broad, stale, or wrong.",
        memoryEffect: hasConflict ? "no memory applied because of conflict" : selected ? "approved profile memory applied" : "none"
      }
    ]
  };

  profile.executionHistory = [...(profile.executionHistory ?? []), run];
  profile.publicTraces = [...(profile.publicTraces ?? []), publicTrace];
  profile.locks = { packagingGated: true, technologyAccepted: false };
  writeJsonAtomic(profilePath, profile);

  output = {
    ok: true,
    profilePath,
    runId,
    traceId,
    outcome,
    selectedMemoryId: run.selectedMemoryId,
    sourceRuleDraftId: run.sourceRuleDraftId,
    matchedCueCount: run.matchedCues.length,
    conflictMemoryIds: run.conflictMemoryIds,
    conflictMatchedCueCount: run.conflictMatchedCueCount,
    actionTaken,
    packagingGated: true,
    technologyAccepted: false
  };
});

console.log(JSON.stringify(output, null, 2));
