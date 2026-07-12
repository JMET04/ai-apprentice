#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-spatial-minimal-"));
const rehearsalPath = join(root, "rehearsal.json");
const builderPath = join(root, "builder.json");
const requestPath = join(root, "request.json");
const receiptTemplatePath = join(root, "receipt-template.json");
const outDir = join(root, "out");

writeJson(rehearsalPath, {
  format: "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1",
  goal: "Smoke spatial minimal confirmation pack",
  status: "waiting_for_teacher_numbered_spatial_target_confirmation",
  selectedNumber: 0,
  teacherConfirmedNumber: false,
  capabilitiesRehearsed: {
    teacher2DSketchUnderstood: true,
    teacherPerspectiveSketchUnderstood: true,
    teacher3DDepthSketchUnderstood: true
  },
  paths: { html: join(root, "rehearsal.html") }
});
writeJson(builderPath, {
  format: "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1",
  reviewRows: [
    {
      rowNumber: 1,
      requirementId: "transparent_mask_exports_2d_perspective_and_3d_depth_sketch_evidence",
      requirement: "Transparent mask exports 2D perspective and 3D depth sketch evidence",
      rehearsalPass: true,
      evidence: "screen_2d + perspective_grid + depth_axis_3d",
      teacherQuestion: "Does the mask show 2D, perspective, and 3D depth?"
    },
    {
      rowNumber: 2,
      requirementId: "sketch_intent_becomes_numbered_targets_before_any_software_action",
      requirement: "Sketch intent becomes numbered targets before any software action",
      rehearsalPass: true,
      evidence: "numbered targets",
      teacherQuestion: "Is one target required?"
    },
    {
      rowNumber: 3,
      requirementId: "rehearsal_never_captures_screenshots_executes_software_writes_memory",
      requirement: "Rehearsal never captures screenshots executes software writes memory",
      rehearsalPass: true,
      evidence: "locks closed",
      teacherQuestion: "Are locks closed?"
    }
  ]
});
writeJson(requestPath, {
  format: "transparent_ai_spatial_intent_evidence_request_v1",
  transparentSketchOverlayPath: join(root, "overlay.html"),
  teacherExportedOverlayPacketPlaceholder: "<teacher-exported-transparent-sketch-packet.json>",
  spatialTargetConfirmationCommandTemplate:
    "node plugins\\transparent-ai-apprentice\\scripts\\create-spatial-target-confirmation-kit.mjs --overlay-packet \"<teacher-exported-transparent-sketch-packet.json>\""
});
writeJson(receiptTemplatePath, {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  teacherDecision: "needs_teacher_review",
  evidenceReviewed: false,
  teacherExportedOverlayPacketPath: "<teacher-exported-transparent-sketch-packet.json>"
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-spatial-intent-minimal-confirmation-pack.mjs",
  "--rehearsal",
  rehearsalPath,
  "--builder",
  builderPath,
  "--spatial-request",
  requestPath,
  "--spatial-receipt-template",
  receiptTemplatePath,
  "--output-dir",
  outDir
]);
const pack = JSON.parse(readFileSync(result.packetPath, "utf8"));
const spatialPatch = JSON.parse(readFileSync(result.spatialReceiptPatchPath, "utf8"));

const checks = [
  {
    name: "Minimal spatial pack extracts teacher confirmation rows",
    pass:
      pack.format === "transparent_ai_spatial_intent_minimal_confirmation_pack_v1" &&
      pack.counts.confirmationRows === 3 &&
      pack.counts.twoDRows >= 1 &&
      pack.counts.numberedTargetRows === 1
  },
  {
    name: "Spatial patch keeps real overlay packet and detail logic as required teacher inputs",
    pass:
      spatialPatch.teacherExportedOverlayPacketPath === "<teacher-exported-transparent-sketch-packet.json>" &&
      spatialPatch.universalDetailLogicContractPath === "<teacher-reviewed-universal-detail-logic-contract-or-kit.json>" &&
      spatialPatch.detailLogicReviewed === false
  },
  {
    name: "Minimal spatial pack keeps all side effects locked",
    pass:
      pack.locks.packDoesNotExecuteSoftware === true &&
      pack.locks.packDoesNotCaptureScreenshots === true &&
      pack.locks.packDoesNotWriteMemory === true &&
      pack.locks.goalComplete === false &&
      pack.capabilitySnapshot.formalSpatialIntentEvidencePresent === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_spatial_intent_minimal_confirmation_pack_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        packet: result.packetPath,
        html: result.htmlPath,
        readme: result.readmePath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
