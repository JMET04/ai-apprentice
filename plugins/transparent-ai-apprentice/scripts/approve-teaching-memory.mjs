#!/usr/bin/env node
import { closeSync, existsSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { discoverSessionPath, markActiveSession } from "./session-state.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
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
  if (handle === undefined) {
    throw new Error(`Could not acquire session lock: ${lockPath}`);
  }

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

function latestRuleDraft(session) {
  const drafts = session.ruleDrafts ?? [];
  return drafts[drafts.length - 1];
}

function latestReplayForRule(session, ruleId) {
  return [...(session.replays ?? [])].reverse().find((replay) => replay.selectedRuleDraftId === ruleId);
}

const rawSessionPath = argValue("--session");
const teacherApproval = argValue("--teacher-approval");

if (!teacherApproval) {
  throw new Error(
    "Usage: node approve-teaching-memory.mjs [--session <session.json>] --teacher-approval <explicit approval> [--rule-id <id>]"
  );
}

const sessionDiscovery = discoverSessionPath(rawSessionPath);
const autoDiscoveredSession = sessionDiscovery.autoDiscoveredSession;
const discoveredSessionPath = sessionDiscovery.sessionPath;
const targetRuleId = argValue("--rule-id");

if (!discoveredSessionPath) {
  throw new Error("No teaching session found. Teach and replay a demonstration before approving memory.");
}
const sessionPath = resolve(discoveredSessionPath);
if (!existsSync(sessionPath)) {
  throw new Error(`Teaching session not found: ${sessionPath}`);
}
markActiveSession(sessionPath, rawSessionPath ? "approve_teaching_memory_explicit" : "approve_teaching_memory_auto");

let output;
withFileLock(sessionPath, () => {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  const targetRule = targetRuleId
    ? (session.ruleDrafts ?? []).find((rule) => rule.id === targetRuleId)
    : latestRuleDraft(session);

  if (!targetRule) {
    throw new Error("No rule draft found. Teach and replay a demonstration before approving memory.");
  }

  const replay = latestReplayForRule(session, targetRule.id);
  if (!replay || replay.outcome !== "needs_teacher_review") {
    throw new Error("Memory approval requires a prior replay with outcome=needs_teacher_review.");
  }

  const approvalId = `approval-${Date.now()}`;
  const traceId = `trace-${Date.now()}-approval`;
  targetRule.enabled = true;
  targetRule.requiresTeacherConfirmation = false;
  targetRule.reviewStatus = "approved_for_session";
  targetRule.teacherApproval = {
    id: approvalId,
    teacherApproval,
    approvedAt: new Date().toISOString(),
    sourceReplayId: replay.id,
    scope: "this_teaching_session_only",
    packagingGated: true,
    technologyAccepted: false
  };

  const approval = {
    format: "transparent_ai_memory_approval_v1",
    id: approvalId,
    targetRuleDraftId: targetRule.id,
    teacherApproval,
    sourceReplayId: replay.id,
    enabled: true,
    reviewStatus: "approved_for_session",
    scope: "this_teaching_session_only",
    packagingGated: true,
    technologyAccepted: false
  };

  const publicTrace = {
    format: "transparent_ai_public_trace_v1",
    traceId,
    sourceApprovalId: approvalId,
    steps: [
      {
        step: "confirm explicit teacher approval",
        inputObserved: teacherApproval,
        ruleCandidates: [targetRule.id],
        actionProposed: "Enable this rule only inside the current teaching session.",
        confidence: "high",
        validation: `sourceReplayId=${replay.id}; outcome=${replay.outcome}`,
        teacherReviewPoint: "This approves session memory, not product packaging or technology acceptance.",
        memoryEffect: "session memory enabled"
      },
      {
        step: "preserve packaging gate",
        inputObserved: JSON.stringify({ packagingGated: true, technologyAccepted: false }),
        ruleCandidates: [targetRule.id],
        actionProposed: "Keep release, wrapping, and packaging gates locked.",
        confidence: "high",
        validation: "packagingGated=true; technologyAccepted=false",
        teacherReviewPoint: "Use enabled memory in a future run, but do not treat it as final product acceptance.",
        memoryEffect: "rule enabled for session only"
      }
    ]
  };

  session.memoryApprovals = [...(session.memoryApprovals ?? []), approval];
  session.publicTraces = [...(session.publicTraces ?? []), publicTrace];
  writeJsonAtomic(sessionPath, session);

  output = {
    ok: true,
    sessionPath,
    autoDiscoveredSession,
    sessionDiscoverySource: sessionDiscovery.discoverySource,
    approvalId,
    traceId,
    targetRuleDraftId: targetRule.id,
    sourceReplayId: replay.id,
    ruleEnabled: true,
    requiresTeacherConfirmation: false,
    reviewStatus: "approved_for_session",
    packagingGated: true,
    technologyAccepted: false
  };
});

console.log(JSON.stringify(output, null, 2));
