#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-spatial-execution-gate-"));
const entryRoot = join(root, "entrypoints", "latest");
mkdirSync(entryRoot, { recursive: true });
const entrypointPath = join(entryRoot, "spatial-intent-formal-evidence-entrypoint.json");
const validationPath = join(root, "spatial-validation.json");
const rehearsalValidationPath = join(root, "rehearsal-validation.json");
const rehearsalPath = join(root, "rehearsal.json");
const physicalGroundingPath = join(root, "physical-grounding.json");
const refreshPath = join(root, "original-goal-current-status-refresh.json");
const outDir = join(root, "out");

writeJson(entrypointPath, {
  format: "transparent_ai_spatial_intent_formal_evidence_entrypoint_v1",
  status: "ready_for_teacher_exported_overlay_packet",
  goal: "Smoke spatial software execution gate",
  dimensionCheck: {
    ready: true,
    has2DPositionEvidence: true,
    hasAngleOrDirectionEvidence: true,
    hasPerspectiveEvidence: true,
    has3DDepthEvidence: true
  },
  locks: { goalComplete: false }
});

writeJson(validationPath, {
  format: "transparent_ai_spatial_intent_evidence_receipt_validation_v1",
  status: "blocked",
  validationDecision: "blocked_placeholder_is_not_teacher_evidence",
  locks: { validationDoesNotRunSpatialTargetConfirmation: true, goalComplete: false }
});

writeJson(rehearsalValidationPath, {
  format: "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1",
  status: "needs_teacher_review",
  decision: "needs_teacher_review",
  readyForExecution: false,
  locks: { validationDoesNotRunRouteBridge: true, goalComplete: false }
});

writeJson(rehearsalPath, {
  format: "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1",
  status: "waiting_for_teacher_numbered_spatial_target_confirmation",
  software: "RealLocalAllSoftware",
  locks: { softwareActionsExecuted: false, goalComplete: false }
});

writeJson(physicalGroundingPath, {
  format: "transparent_ai_physical_world_spatial_grounding_pack_v1",
  status: "source_project_grounding_ready_for_transparent_overlay_review",
  counts: {
    evidenceRows: 7,
    presentEvidenceRows: 7,
    missingEvidenceRows: 0
  },
  transparentOverlayHandoffRows: [
    { overlayNeed: "2D anchor/region selection" },
    { overlayNeed: "Perspective plane or face alignment" },
    { overlayNeed: "3D depth / near-far intent" },
    { overlayNeed: "Angle, fold, rotation, or direction" }
  ],
  locks: {
    noTargetSoftwareExecution: true,
    noRealWorldAuthorityClaim: true,
    goalComplete: false
  }
});

writeJson(refreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Smoke spatial software execution gate",
  paths: {
    physicalWorldSpatialGroundingPack: physicalGroundingPath,
    spatialIntentEvidenceReceiptValidation: validationPath,
    transparentSketchDepthRehearsalReviewReceiptValidation: rehearsalValidationPath,
    transparentSketchDepthDemonstrationRehearsal: rehearsalPath,
    spatialIntentEvidenceRequest: join(root, "request.json")
  }
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-spatial-to-software-execution-gate-package.mjs",
  "--refresh",
  refreshPath,
  "--entrypoint-root",
  join(root, "entrypoints"),
  "--output-dir",
  outDir
]);
const packet = JSON.parse(readFileSync(result.gatePath, "utf8"));
const checks = [
  {
    name: "Gate package combines all six spatial-to-execution gates including physical grounding",
    pass:
      packet.format === "transparent_ai_spatial_to_software_execution_gate_package_v1" &&
      packet.gates.length === 6 &&
      packet.gates[0].id === "formal_spatial_entrypoint" &&
      packet.gates[1].id === "physical_world_spatial_grounding" &&
      packet.gates[1].ready === true
  },
  {
    name: "Placeholder teacher evidence blocks execution route",
    pass:
      packet.status === "blocked_before_spatial_software_execution" &&
      packet.readyForDryRunRouteBridge === false &&
      packet.firstBlocker.id === "teacher_exported_overlay_validation" &&
      packet.firstBlocker.blocker === "blocked_placeholder_is_not_teacher_evidence"
  },
  {
    name: "Next commands are templates only and not allowed in this package",
    pass: packet.nextCommands.length === 3 && packet.nextCommands.every((entry) => entry.allowedInThisPackage === false)
  },
  {
    name: "Gate package keeps all execution side effects closed",
    pass:
      packet.locks.packageDoesNotRunSpatialTargetConfirmation === true &&
      packet.locks.packageDoesNotRunRouteBridge === true &&
      packet.locks.packageDoesNotExecuteSoftware === true &&
      packet.locks.packageDoesNotCaptureScreenshots === true &&
      packet.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_spatial_to_software_execution_gate_package_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        gatePackage: result.gatePath,
        readme: result.readmePath,
        html: result.htmlPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
