#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 120000 });
  if (result.status !== 0) throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-spatial-overlay-resolution-"));
const out = join(root, "out");
mkdirSync(out, { recursive: true });

const requestPath = writeJson(join(root, "spatial-intent-request.json"), {
  format: "transparent_ai_spatial_intent_evidence_request_v1",
  status: "waiting_for_teacher_exported_overlay_packet",
  goal: "Smoke first blocker overlay resolution.",
  software: "ExampleCAD",
  transparentSketchOverlayPath: join(root, "transparent-sketch-overlay.html"),
  teacherExportedOverlayPacketPlaceholder: "<teacher-exported-transparent-sketch-packet.json>",
  expectedPacketFormat: "transparent_ai_sketch_overlay_packet_v1",
  spatialTargetConfirmationCommandTemplate:
    'node plugins\\transparent-ai-apprentice\\scripts\\create-spatial-target-confirmation-kit.mjs --overlay-packet "<teacher-exported-transparent-sketch-packet.json>" --goal "Smoke first blocker overlay resolution." --software "ExampleCAD" --output-dir "out" --create-action-kit "true"',
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});
const refreshPath = writeJson(join(root, "current-status-refresh.json"), {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Smoke first blocker overlay resolution.",
  paths: {
    spatialIntentEvidenceRequest: requestPath
  }
});
const detailLogicContractPath = writeJson(join(root, "universal-detail-logic-contract.json"), {
  format: "transparent_ai_universal_detail_logic_contract_v1",
  surfaceSimilarityOnlyRejected: true,
  rows: [
    {
      featureId: "target-face-position",
      featureType: "position_relation",
      detailCategory: "position_alignment_relation",
      logicSourceStatus: "logic_source_supplied_waiting_for_teacher_review"
    },
    {
      featureId: "teacher-depth-arrow-angle",
      featureType: "angle",
      detailCategory: "angular_or_direction_logic",
      logicSourceStatus: "logic_source_supplied_waiting_for_teacher_review"
    },
    {
      featureId: "teacher-depth-arrow",
      featureType: "depth_or_perspective_relation",
      detailCategory: "view_depth_or_perspective_relation",
      logicSourceStatus: "logic_source_supplied_waiting_for_teacher_review"
    }
  ],
  counts: {
    totalDetails: 3,
    missingLogicSource: 0,
    blockedDetails: 0
  },
  logicCompletenessGate: {
    requiredBeforeTargetSoftwareAction: true,
    visualSimilarityCanNeverOverrideMissingLogic: true
  }
});
const detailLogicValidationPath = writeJson(join(root, "passed-parametric-drawing-logic-receipt-validation.json"), {
  format: "transparent_ai_parametric_drawing_logic_receipt_validation_v1",
  status: "ready_for_review_only_dry_run_generation_plan",
  decision: "ready_for_review_only_dry_run",
  counts: {
    blockedRows: 0
  },
  requirementGates: {
    everyRelationshipLogicReviewed: true,
    everyUniversalDetailLogicReviewed: true,
    everyTransferValidationReviewed: true,
    visualSimilarityStillSecondaryOnly: true
  },
  locks: {
    validationDoesNotGenerateOutput: true,
    validationDoesNotExecuteSoftware: true,
    softwareActionsExecuted: false,
    memoryWritten: false
  }
});
const overlayPacketPath = writeJson(join(root, "teacher-exported-transparent-sketch-packet.json"), {
  format: "transparent_ai_sketch_overlay_packet_v1",
  overlayMode: "teacher_review_only",
  coordinateSpace: {
    supports2D: true,
    supportsPerspectiveRelationships: true,
    supports3DDepthHints: true
  },
  anchors: [
    {
      id: "target-face",
      label: "target face",
      box: [0.34, 0.42, 0.18, 0.2],
      normalizedTarget: { x: 0.43, y: 0.52, zHint: 0.35 }
    }
  ],
  strokes: [
    {
      id: "screen-anchor",
      mode: "screen_2d",
      semanticLabel: "start here",
      points: [
        { x: 0.42, y: 0.58, zHint: 0.35 },
        { x: 0.48, y: 0.54, zHint: 0.35 }
      ]
    },
    {
      id: "perspective-depth-arrow",
      mode: "depth_axis_3d",
      semanticLabel: "push inward in perspective",
      points: [
        { x: 0.42, y: 0.58, zHint: 0.35 },
        { x: 0.56, y: 0.47, zHint: 0.78 }
      ]
    },
    {
      id: "perspective-grid",
      mode: "perspective_grid",
      points: [
        { x: 0.28, y: 0.68, zHint: 0.2 },
        { x: 0.78, y: 0.34, zHint: 0.85 }
      ]
    }
  ],
  spatialIntent: {
    supports2DPosition: true,
    supportsPerspectiveRelationships: true,
    supports3DDepthHints: true,
    relationships: [
      { subject: "perspective-depth-arrow", relation: "nearer_than", object: "target-face" },
      { subject: "perspective-depth-arrow", relation: "perspective_to", object: "target-face" }
    ],
    perspectiveCues: [{ strokeId: "perspective-depth-arrow", cue: "depth_axis_3d" }]
  },
  universalDetailLogicContract: {
    consequentialDetailRows: [
      { id: "position-row", detailCategory: "position_alignment_relation", classification: "teacher_reviewed_data_field_or_variable" },
      { id: "angle-row", detailCategory: "angular_or_direction_logic", classification: "teacher_reviewed_formula_or_constraint" },
      { id: "depth-row", detailCategory: "view_depth_or_perspective_relation", classification: "teacher_reviewed_reference_or_datum_relationship" }
    ]
  },
  locks: {
    accepted: false,
    ruleEnabled: false
  }
});

const draftResult = run([
  "plugins/transparent-ai-apprentice/scripts/resolve-spatial-first-blocker-overlay-packet.mjs",
  "--refresh",
  refreshPath,
  "--overlay-packet",
  overlayPacketPath,
  "--output-dir",
  out
]);
const draft = readJson(draftResult.resolutionPath);
const readyResult = run([
  "plugins/transparent-ai-apprentice/scripts/resolve-spatial-first-blocker-overlay-packet.mjs",
  "--refresh",
  refreshPath,
  "--overlay-packet",
  overlayPacketPath,
  "--detail-logic-contract",
  detailLogicContractPath,
  "--detail-logic-validation",
  detailLogicValidationPath,
  "--teacher-reviewed-spatial-intent",
  "true",
  "--output-dir",
  out
]);
const ready = readJson(readyResult.resolutionPath);

const checks = [
  {
    name: "Resolver validates exported overlay and pre-fills receipt without treating export as teacher approval",
    pass:
      draft.format === "transparent_ai_spatial_first_blocker_overlay_resolution_v1" &&
      draft.overlayReadyForReceipt === true &&
      draft.prefilledReceipt.teacherDecision === "needs_teacher_review" &&
      draft.prefilledReceipt.evidenceReviewed === false &&
      draft.readyForNextSpatialConfirmation === false &&
      draft.locks.resolverDoesNotExecuteSoftware === true
  },
  {
    name: "Resolver can advance to numbered spatial target confirmation command only with explicit teacher review and detail logic evidence",
    pass:
      ready.readyForNextSpatialConfirmation === true &&
      ready.receiptValidationDecision === "ready_for_reviewed_spatial_target_confirmation" &&
      ready.prefilledReceipt.teacherDecision === "teacher_reviewed_prepare_spatial_confirmation" &&
      ready.nextTeacherActions.some((item) => item.id === "review_numbered_spatial_target_confirmation_command") &&
      ready.locks.spatialTargetConfirmationInvoked === false &&
      ready.locks.softwareActionsExecuted === false
  },
  {
    name: "Resolver writes teacher-facing artifacts",
    pass: existsSync(draft.paths.html) && existsSync(draft.paths.readme) && existsSync(draft.paths.prefilledReceipt)
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_spatial_first_blocker_overlay_resolution_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        draft: draftResult.resolutionPath,
        ready: readyResult.resolutionPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
