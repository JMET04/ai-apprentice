#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

const root = mkdtempSync(join(tmpdir(), "ta-spatial-entrypoint-"));
const requestPath = join(root, "spatial-intent-evidence-request.json");
const builderPath = join(root, "spatial-intent-evidence-receipt-builder.json");
const rehearsalPath = join(root, "transparent-sketch-depth-demonstration-rehearsal.json");
const refreshPath = join(root, "original-goal-current-status-refresh.json");
const outDir = join(root, "out");

writeJson(requestPath, {
  format: "transparent_ai_spatial_intent_evidence_request_v1",
  status: "waiting_for_teacher_exported_overlay_packet",
  expectedPacketFormat: "transparent_ai_sketch_overlay_packet_v1",
  teacherExportedOverlayPacketPlaceholder: "<teacher-exported-transparent-sketch-packet.json>",
  teacherHandoffSteps: ["export overlay packet", "fill receipt", "run validator"]
});

writeJson(builderPath, {
  format: "transparent_ai_spatial_intent_evidence_receipt_builder_v1",
  status: "spatial_intent_evidence_receipt_builder_ready_for_teacher_use",
  paths: { sourceRequest: requestPath }
});

writeJson(rehearsalPath, {
  format: "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1",
  status: "review_only_rehearsal_ready",
  goal: "Smoke transparent sketch depth demonstration"
});

writeJson(refreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Smoke transparent sketch spatial evidence",
  paths: {
    spatialIntentEvidenceRequest: requestPath,
    spatialIntentEvidenceReceiptBuilder: builderPath,
    transparentSketchDepthDemonstrationRehearsal: rehearsalPath
  }
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-spatial-intent-formal-evidence-entrypoint.mjs",
  "--refresh",
  refreshPath,
  "--output-dir",
  outDir
]);
const entrypoint = JSON.parse(readFileSync(result.entrypointPath, "utf8"));
const demoPacket = JSON.parse(readFileSync(result.demoOverlayPacketPath, "utf8"));
const template = JSON.parse(readFileSync(result.teacherReceiptTemplatePath, "utf8"));

const checks = [
  {
    name: "Entrypoint produces a machine-checkable overlay packet with all spatial dimensions",
    pass:
      entrypoint.format === "transparent_ai_spatial_intent_formal_evidence_entrypoint_v1" &&
      entrypoint.dimensionCheck.ready === true &&
      entrypoint.dimensionCheck.has2DPositionEvidence === true &&
      entrypoint.dimensionCheck.hasAngleOrDirectionEvidence === true &&
      entrypoint.dimensionCheck.hasPerspectiveEvidence === true &&
      entrypoint.dimensionCheck.has3DDepthEvidence === true &&
      demoPacket.format === "transparent_ai_sketch_overlay_packet_v1"
  },
  {
    name: "Demo packet is explicitly not teacher evidence",
    pass:
      entrypoint.teacherEvidenceStatus === "missing_teacher_exported_overlay_packet" &&
      demoPacket.evidenceClass === "demo_structure_not_teacher_evidence" &&
      template.demoPacketIsNotTeacherEvidence === true
  },
  {
    name: "Teacher receipt template requires review and blocks execution shortcuts",
    pass:
      template.teacherDecision === "needs_teacher_review" &&
      template.evidenceReviewed === false &&
      template.teacherExportedOverlayPacketPath === "<teacher-exported-transparent-sketch-packet.json>" &&
      template.blockedTeacherDecisions.includes("execute_now") &&
      template.blockedTeacherDecisions.includes("claim_complete")
  },
  {
    name: "Entrypoint keeps all side-effect locks closed",
    pass:
      entrypoint.locks.entrypointDoesNotValidateReceipt === true &&
      entrypoint.locks.entrypointDoesNotRunSpatialTargetConfirmation === true &&
      entrypoint.locks.entrypointDoesNotExecuteSoftware === true &&
      entrypoint.locks.entrypointDoesNotCaptureScreenshots === true &&
      entrypoint.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_spatial_intent_formal_evidence_entrypoint_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        entrypoint: result.entrypointPath,
        demoOverlayPacket: result.demoOverlayPacketPath,
        teacherReceiptTemplate: result.teacherReceiptTemplatePath,
        html: result.htmlPath,
        readme: result.readmePath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
