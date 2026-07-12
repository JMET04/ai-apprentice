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

function latestSelectedMemoryId(profile) {
  const latestRun = [...(profile.executionHistory ?? [])].reverse().find((run) => run.selectedMemoryId);
  return latestRun?.selectedMemoryId ?? "";
}

const rawProfilePath = argValue("--profile");
const profileName = argValue("--profile-name", "teachable-apprentice");
const teacherCorrection = argValue("--teacher-correction");
const decision = argValue("--decision", "disable");
const revisedCondition = argValue("--revised-condition");
const revisedAction = argValue("--revised-action");
const memoryIdArg = argValue("--memory-id");

if (!teacherCorrection) {
  throw new Error(
    "Usage: node correct-apprentice-memory.mjs --profile <profile.json> --teacher-correction <correction> [--memory-id <id>] [--decision disable|narrow|revise]"
  );
}

if (!["disable", "narrow", "revise"].includes(decision)) {
  throw new Error(`Unsupported decision: ${decision}. Use disable, narrow, or revise.`);
}

const profilePath = rawProfilePath
  ? resolve(rawProfilePath)
  : join(process.cwd(), ".transparent-apprentice", "apprentices", `${slugify(profileName)}.json`);

if (!existsSync(profilePath)) throw new Error(`Apprentice profile not found: ${profilePath}`);

let output;
withFileLock(profilePath, () => {
  const profile = JSON.parse(readFileSync(profilePath, "utf8"));
  const memoryId = memoryIdArg || latestSelectedMemoryId(profile);
  const memory = (profile.approvedMemories ?? []).find((item) => item.id === memoryId);
  if (!memory) {
    throw new Error("No target apprentice memory found. Pass --memory-id or run the profile once so the latest selected memory is known.");
  }

  const correctionId = `profile-correction-${Date.now()}`;
  const traceId = `trace-${Date.now()}-profile-correction`;
  const before = {
    condition: memory.condition,
    action: memory.action,
    enabled: memory.enabled,
    reviewStatus: memory.reviewStatus
  };

  const correctionRecord = {
    format: "transparent_ai_profile_memory_correction_v1",
    id: correctionId,
    memoryId: memory.id,
    teacherCorrection,
    decision,
    previousCondition: memory.condition,
    previousAction: memory.action,
    previousEnabled: memory.enabled,
    packagingGated: true,
    technologyAccepted: false,
    correctedAt: new Date().toISOString()
  };

  memory.teacherCorrections = [...(memory.teacherCorrections ?? []), correctionRecord];
  memory.counterexamples = [...(memory.counterexamples ?? []), teacherCorrection];

  if (decision === "disable") {
    memory.enabled = false;
    memory.reviewStatus = "disabled_by_teacher";
    memory.disabledReason = teacherCorrection;
  } else if (decision === "narrow") {
    memory.condition = revisedCondition || `${memory.condition}; do not apply when teacher correction says: ${teacherCorrection}`;
    memory.reviewStatus = "needs_profile_replay";
    memory.enabled = false;
  } else {
    if (revisedCondition) memory.condition = revisedCondition;
    if (revisedAction) memory.action = revisedAction;
    memory.reviewStatus = "needs_profile_replay";
    memory.enabled = false;
  }

  const publicTrace = {
    format: "transparent_ai_public_trace_v1",
    traceId,
    sourceProfileCorrectionId: correctionId,
    steps: [
      {
        step: "capture teacher correction for profile memory",
        inputObserved: teacherCorrection,
        ruleCandidates: [memory.id],
        actionProposed: `Apply profile memory decision: ${decision}.`,
        confidence: "high",
        validation: `targetMemory=${memory.id}; previousEnabled=${before.enabled}`,
        teacherReviewPoint: "Confirm whether this memory should stay disabled, be narrowed, or be retaught.",
        memoryEffect: "profile memory corrected"
      },
      {
        step: "update persisted memory safely",
        inputObserved: JSON.stringify({ before, after: { condition: memory.condition, action: memory.action, enabled: memory.enabled, reviewStatus: memory.reviewStatus } }).slice(0, 1200),
        ruleCandidates: [memory.id],
        actionProposed: decision === "disable" ? "Disable this persisted memory." : "Require replay before this memory can be used again.",
        confidence: "high",
        validation: "packagingGated=true; technologyAccepted=false",
        teacherReviewPoint: "Run the profile again or reteach the case to verify the correction.",
        memoryEffect: decision === "disable" ? "profile memory disabled" : "profile memory requires replay"
      }
    ]
  };

  profile.profileCorrections = [...(profile.profileCorrections ?? []), correctionRecord];
  profile.publicTraces = [...(profile.publicTraces ?? []), publicTrace];
  profile.knownLimits = [...new Set([...(profile.knownLimits ?? []), teacherCorrection])].slice(0, 50);
  profile.locks = { packagingGated: true, technologyAccepted: false };
  writeJsonAtomic(profilePath, profile);

  output = {
    ok: true,
    profilePath,
    correctionId,
    traceId,
    memoryId: memory.id,
    decision,
    enabled: memory.enabled,
    reviewStatus: memory.reviewStatus,
    packagingGated: true,
    technologyAccepted: false
  };
});

console.log(JSON.stringify(output, null, 2));
