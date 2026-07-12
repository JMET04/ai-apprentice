#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-voice-numbered-teacher-console.mjs",
    "--goal",
    "Smoke voice numbered teacher console."
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  fail("voice numbered teacher console generator failed");
}

const parsed = JSON.parse(result.stdout);
if (!existsSync(parsed.consolePath)) fail("console json was not created");
if (!existsSync(parsed.htmlPath)) fail("console html was not created");
if (!existsSync(parsed.readmePath)) fail("console readme was not created");

const consoleArtifact = JSON.parse(readFileSync(parsed.consolePath, "utf8"));
if (consoleArtifact.format !== "transparent_ai_current_goal_voice_numbered_teacher_console_v1") {
  fail("unexpected console format");
}
if (consoleArtifact.status !== "voice_numbered_teacher_console_ready_for_teacher_number_receipt_not_execution") {
  fail(`unexpected console status: ${consoleArtifact.status}`);
}
if (consoleArtifact.finalLane.ready !== false) fail("voice final lane should remain blocked before teacher number receipt and real evidence");
if (consoleArtifact.capabilityState.singleNumberConfirmationRequired !== true) fail("single-number confirmation must be required");
if (consoleArtifact.capabilityState.executionLocked !== true) fail("execution must remain locked");
if (consoleArtifact.capabilityState.completionClaimAllowed !== false) fail("completion claim must remain blocked");
if (consoleArtifact.locks.reviewOnly !== true) fail("console must be review-only");
if (consoleArtifact.locks.consoleDoesNotConfirmNumber !== true) fail("console must not confirm a number");
if (consoleArtifact.locks.consoleDoesNotExecuteTargetSoftware !== true) fail("console must not execute target software");
if (consoleArtifact.locks.numberedTargetConfirmed !== false) fail("numbered target must not be confirmed by console");
if (consoleArtifact.locks.softwareActionsExecuted !== false) fail("software actions must remain false");
if (consoleArtifact.locks.goalComplete !== false) fail("console must not claim goal completion");
if (!consoleArtifact.sourceEvidence.voiceNumberedConvergenceAudit) fail("convergence audit source missing");
if (!consoleArtifact.sourceEvidence.voiceControlSession) fail("voice control session source missing");
if (consoleArtifact.teacherActionSequence.length < 4) fail("teacher action sequence incomplete");

console.log(
  JSON.stringify(
    {
      ok: true,
      consolePath: parsed.consolePath,
      status: consoleArtifact.status,
      capabilityState: consoleArtifact.capabilityState
    },
    null,
    2
  )
);
