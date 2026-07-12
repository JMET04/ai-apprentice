#!/usr/bin/env node
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
  mkdirSync(dirname(targetPath), { recursive: true });
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
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

function latestApprovedRule(session) {
  return [...(session.ruleDrafts ?? [])].reverse().find((rule) => rule.enabled === true);
}

function sourceDemonstrationForRule(session, rule) {
  const evidenceIds = rule.sourceEvidence ?? [];
  return (session.teacherDemonstrations ?? []).find((demo) => evidenceIds.includes(demo.id));
}

function sourceExchangeForRule(session, rule) {
  const evidenceIds = rule.sourceEvidence ?? [];
  return (session.teachingExchanges ?? []).find((exchange) => evidenceIds.includes(exchange.id));
}

function cuesForRule(session, rule) {
  const sourceDemo = sourceDemonstrationForRule(session, rule);
  const sourceExchange = sourceExchangeForRule(session, rule);
  return sourceDemo?.extractedSignals?.cues ?? sourceExchange?.extractedCues ?? [];
}

function defaultProfile(name) {
  return {
    format: "transparent_ai_apprentice_profile_v1",
    apprenticeName: name,
    domain: "",
    teacherGoal: "Train through direct demonstration, correction, replay, and explicit approval.",
    knownSkills: [],
    knownLimits: [],
    approvedMemories: [],
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
}

const rawSessionPath = argValue("--session");
const profileName = argValue("--profile-name", "teachable-apprentice");
const rawProfilePath = argValue("--profile");
const targetRuleId = argValue("--rule-id");

if (!rawSessionPath) {
  throw new Error("Usage: node save-apprentice-memory.mjs --session <session.json> [--profile-name <name>] [--rule-id <id>]");
}

const sessionPath = resolve(rawSessionPath);
if (!existsSync(sessionPath)) throw new Error(`Teaching session not found: ${sessionPath}`);

const profilePath = rawProfilePath
  ? resolve(rawProfilePath)
  : join(process.cwd(), ".transparent-apprentice", "apprentices", `${slugify(profileName)}.json`);

const session = JSON.parse(readFileSync(sessionPath, "utf8"));
const rule = targetRuleId
  ? (session.ruleDrafts ?? []).find((draft) => draft.id === targetRuleId)
  : latestApprovedRule(session);

if (!rule) throw new Error("No approved rule found. Approve a replayed rule before saving apprentice memory.");
if (rule.enabled !== true || rule.reviewStatus !== "approved_for_session") {
  throw new Error(`Rule is not approved for session memory: ${rule.id}`);
}

let output;
withFileLock(profilePath, () => {
  const profile = existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, "utf8")) : defaultProfile(profileName);
  const memoryId = `memory-${Date.now()}`;
  const traceId = `trace-${Date.now()}-profile-save`;
  const existingIndex = (profile.approvedMemories ?? []).findIndex((memory) => memory.sourceRuleDraftId === rule.id);
  const memory = {
    format: "transparent_ai_profile_memory_v1",
    id: existingIndex >= 0 ? profile.approvedMemories[existingIndex].id : memoryId,
    sourceSessionPath: sessionPath,
    sourceRuleDraftId: rule.id,
    condition: rule.condition,
    action: rule.action,
    counterexamples: rule.counterexamples ?? [],
    cues: cuesForRule(session, rule),
    confidence: rule.confidence ?? "medium",
    enabled: true,
    teacherApproval: rule.teacherApproval ?? {},
    reviewStatus: "approved_for_profile",
    savedAt: new Date().toISOString(),
    packagingGated: true,
    technologyAccepted: false
  };

  profile.approvedMemories = [...(profile.approvedMemories ?? [])];
  if (existingIndex >= 0) {
    profile.approvedMemories[existingIndex] = memory;
  } else {
    profile.approvedMemories.push(memory);
  }
  profile.knownSkills = [...new Set([...(profile.knownSkills ?? []), rule.action])].slice(0, 50);
  profile.locks = { packagingGated: true, technologyAccepted: false };
  profile.publicTraces = [
    ...(profile.publicTraces ?? []),
    {
      format: "transparent_ai_public_trace_v1",
      traceId,
      sourceMemoryId: memory.id,
      steps: [
        {
          step: "save approved memory to apprentice profile",
          inputObserved: JSON.stringify({ sourceSessionPath: sessionPath, sourceRuleDraftId: rule.id }).slice(0, 1200),
          ruleCandidates: [rule.id],
          actionProposed: "Persist this approved rule as reusable apprentice memory.",
          confidence: "high",
          validation: "ruleEnabled=true; reviewStatus=approved_for_session",
          teacherReviewPoint: "This memory can be used by the apprentice profile until corrected or removed.",
          memoryEffect: "profile memory saved"
        },
        {
          step: "keep product gates separate",
          inputObserved: JSON.stringify({ packagingGated: true, technologyAccepted: false }),
          ruleCandidates: [rule.id],
          actionProposed: "Save training memory without claiming product acceptance.",
          confidence: "high",
          validation: "packagingGated=true; technologyAccepted=false",
          teacherReviewPoint: "Profile memory is not packaging or release approval.",
          memoryEffect: "profile memory only"
        }
      ]
    }
  ];

  writeJsonAtomic(profilePath, profile);
  output = {
    ok: true,
    profilePath,
    memoryId: memory.id,
    traceId,
    sourceRuleDraftId: rule.id,
    approvedMemoryCount: profile.approvedMemories.length,
    enabled: true,
    reviewStatus: "approved_for_profile",
    packagingGated: true,
    technologyAccepted: false
  };
});

console.log(JSON.stringify(output, null, 2));
