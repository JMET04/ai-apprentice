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
    "plugins/transparent-ai-apprentice/scripts/create-current-goal-teacher-method-reuse-proof-bridge.mjs",
    "--goal",
    "Smoke current teacher-method reuse proof bridge."
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  fail("bridge generator failed");
}

const parsed = JSON.parse(result.stdout);
if (!existsSync(parsed.bridgePath)) fail("bridge json was not created");
if (!existsSync(parsed.htmlPath)) fail("bridge html was not created");
if (!existsSync(parsed.readmePath)) fail("bridge readme was not created");

const bridge = JSON.parse(readFileSync(parsed.bridgePath, "utf8"));
if (bridge.format !== "transparent_ai_current_goal_teacher_method_reuse_proof_bridge_v1") {
  fail("unexpected bridge format");
}
if (bridge.locks.reviewOnly !== true) fail("bridge must remain review-only");
if (bridge.locks.accepted !== false) fail("bridge must not accept technology");
if (bridge.locks.ruleEnabled !== false) fail("bridge must not enable rules");
if (bridge.locks.packagingGated !== true) fail("bridge must remain packaging gated");
if (bridge.locks.mediumRuntimeReuseEnabled !== false) fail("bridge must not enable medium-runtime reuse");
if (bridge.locks.goalComplete !== false) fail("bridge must not claim goal completion");
if (bridge.finalLane.id !== "teacher_method_adaptation_reuse_result_proof") {
  fail("bridge is not bound to the teacher-method final lane");
}
if (!bridge.sourceEvidence.finalCompletionGate) fail("missing final completion gate source");
if (!bridge.sourceEvidence.reuseResultBuilder) fail("missing reuse-result builder source");
if (!bridge.sourceEvidence.teacherMethodFinalReviewPack) fail("missing teacher-method final review pack source");
if (!bridge.sourceEvidence.rollbackPoint) fail("missing rollback point source");
if (!bridge.nextValidationCommand.includes("validate-teacher-method-reuse-result-proof-receipt.mjs")) {
  fail("missing next validation command");
}
if (!Array.isArray(bridge.teacherReviewSteps) || bridge.teacherReviewSteps.length < 3) {
  fail("teacher review steps are incomplete");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      bridgePath: parsed.bridgePath,
      status: bridge.status,
      blockers: bridge.blockers.length,
      finalLaneReady: bridge.finalLane.ready,
      readyForMediumRuntimeReuseGate: bridge.latestEvidenceStatus.readyForMediumRuntimeReuseGate
    },
    null,
    2
  )
);
