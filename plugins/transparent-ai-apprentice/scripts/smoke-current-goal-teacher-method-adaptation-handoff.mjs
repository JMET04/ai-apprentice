#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-teacher-method-adaptation-handoff", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const result = runNodeScript("create-current-goal-teacher-method-adaptation-handoff.mjs", [
  "--goal",
  "Smoke current goal teacher method adaptation across all software low-token learning and transparent 2D perspective 3D sketch execution gates.",
  "--software",
  "all local software",
  "--teacher-message",
  "I may teach by steps, examples, voice, corrections, transparent overlay sketches, perspective depth marks, and log metadata changes. Ask less during routine work but stop at rule, memory, execution, and ambiguous target boundaries.",
  "--output-dir",
  smokeRoot
]);
const packet = readJson(result.handoffPath);
const profile = readJson(packet.paths.teacherLearningMethodProfile);
const laneIds = new Set(packet.supportedMethodLanes.map((lane) => lane.id));
const inferredModes = new Set(packet.inferredTeacherModes);

const expectedLanes = [
  "ordered_steps",
  "before_after_examples",
  "transparent_overlay_sketch",
  "spatial_intent_review",
  "voice_explanation",
  "software_log_deltas",
  "correction_first",
  "silent_workalong_until_trigger",
  "triggered_screenshot"
];

const checks = [
  {
    name: "Handoff creates a current-goal teacher method profile and route",
    pass:
      packet.format === "transparent_ai_current_goal_teacher_method_adaptation_handoff_v1" &&
      profile.format === "transparent_ai_teacher_learning_method_profile_v1" &&
      existsSync(packet.paths.teacherLearningMethodProfile) &&
      existsSync(packet.paths.teacherLearningMethodRoute) &&
      existsSync(packet.paths.html),
    evidence: result.handoffPath
  },
  {
    name: "Supported method lanes cover different teacher styles instead of only CAD or SolidWorks",
    pass:
      expectedLanes.every((lane) => laneIds.has(lane)) &&
      packet.supportedMethodLanes.length >= expectedLanes.length &&
      packet.supportedMethodLanes.every((lane) => lane.lowTokenEvidence && lane.route),
    evidence: packet.supportedMethodLanes.map((lane) => lane.id)
  },
  {
    name: "Inferred current profile routes overlay sketches log deltas corrections voice and ask-less behavior",
    pass:
      inferredModes.has("transparent_overlay_sketch") &&
      inferredModes.has("spatial_intent_review") &&
      inferredModes.has("software_log_deltas") &&
      inferredModes.has("correction_first") &&
      inferredModes.has("voice_explanation") &&
      inferredModes.has("silent_workalong_until_trigger") &&
      profile.locks.fullContinuousRecording === false &&
      profile.locks.nativeUniversalExecution === false,
    evidence: packet.inferredTeacherModes
  },
  {
    name: "Handoff links current low-token and spatial evidence without treating either as completion",
    pass:
      packet.currentGoalEvidence.lowTokenAllRowsHaveReviewableRoute === true &&
      packet.currentGoalEvidence.spatial2D3DDepthValidationAvailable === true &&
      packet.currentGoalEvidence.spatialLogicContractRuleDraftPrepared === true &&
      packet.paths.allSoftwareLowTokenHandoff &&
      packet.paths.teacherSpatialDrawingHandoff &&
      packet.goalComplete === false,
    evidence: packet.currentGoalEvidence
  },
  {
    name: "High-to-medium reasoning policy is represented but medium runtime reuse remains locked",
    pass:
      packet.reasoningTierPolicy.highReasoningUseCases.length >= 3 &&
      packet.reasoningTierPolicy.mediumReasoningUseCases.length >= 2 &&
      packet.reasoningTierPolicy.downgradeAllowedOnlyAfter.includes("teacher-reviewed method contract") &&
      packet.locks.mediumRuntimeReuseEnabled === false &&
      packet.blockedActions.includes("downgrade_to_medium_runtime_from_teacher_method_handoff"),
    evidence: packet.reasoningTierPolicy
  },
  {
    name: "Handoff does not execute software read logs capture screenshots write memory enable rules or claim completion",
    pass:
      packet.locks.handoffDoesNotExecuteTargetSoftware === true &&
      packet.locks.handoffDoesNotReadLogs === true &&
      packet.locks.handoffDoesNotReadFullLogs === true &&
      packet.locks.handoffDoesNotCaptureScreenshots === true &&
      packet.locks.handoffDoesNotWriteMemory === true &&
      packet.locks.handoffDoesNotEnableRules === true &&
      packet.locks.goalComplete === false,
    evidence: packet.locks
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_teacher_method_adaptation_handoff_smoke_v1",
      smokeRoot,
      checks,
      artifact: result.handoffPath
    },
    null,
    2
  )
);
