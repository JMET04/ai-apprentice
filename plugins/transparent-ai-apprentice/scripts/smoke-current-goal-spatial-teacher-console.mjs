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
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-spatial-teacher-console.mjs",
    "--goal",
    "Smoke spatial teacher console."
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  fail("spatial teacher console generator failed");
}

const parsed = JSON.parse(result.stdout);
if (!existsSync(parsed.consolePath)) fail("console json was not created");
if (!existsSync(parsed.htmlPath)) fail("console html was not created");
if (!existsSync(parsed.readmePath)) fail("console readme was not created");

const consoleArtifact = JSON.parse(readFileSync(parsed.consolePath, "utf8"));
if (consoleArtifact.format !== "transparent_ai_current_goal_spatial_teacher_console_v1") {
  fail("unexpected console format");
}
if (consoleArtifact.status !== "spatial_teacher_console_ready_for_teacher_receipts_not_execution") {
  fail(`unexpected console status: ${consoleArtifact.status}`);
}
if (consoleArtifact.sketchImplementationLane.ready !== true) fail("sketch implementation lane must already be ready");
if (consoleArtifact.finalLane.ready !== false) fail("spatial teacher validation lane should remain blocked before teacher receipt");
if (consoleArtifact.capabilityState.completionClaimAllowed !== false) fail("console must not allow completion claim");
if (consoleArtifact.locks.reviewOnly !== true) fail("console must be review-only");
if (consoleArtifact.locks.consoleDoesNotFillReceipts !== true) fail("console must not fill receipts");
if (consoleArtifact.locks.consoleDoesNotExecuteTargetSoftware !== true) fail("console must not execute target software");
if (consoleArtifact.locks.softwareActionsExecuted !== false) fail("console must not execute software");
if (consoleArtifact.locks.goalComplete !== false) fail("console must not claim goal completion");
if (!consoleArtifact.sourceEvidence.overlayPacketValidation) fail("overlay packet validation source missing");
if (!consoleArtifact.sourceEvidence.depthDemonstrationRehearsal) fail("depth rehearsal source missing");
if (!consoleArtifact.sourceEvidence.spatialIntentReceiptValidation) fail("spatial receipt validation source missing");
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
