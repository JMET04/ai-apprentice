#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "spatial-intent-evidence-receipt-validation-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runScript(args, options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", "validate-spatial-intent-evidence-receipt.mjs"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error("validate-spatial-intent-evidence-receipt was expected to fail");
    return { ...JSON.parse(result.stdout), failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "validate-spatial-intent-evidence-receipt failed");
  return { ...JSON.parse(result.stdout), exitStatus: result.status };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const requestPath = writeJson(join(smokeRoot, "request.json"), {
  format: "transparent_ai_spatial_intent_evidence_request_v1",
  status: "waiting_for_teacher_exported_overlay_packet",
  goal: "Smoke spatial intent receipt validation.",
  software: "ExampleCAD",
  transparentSketchOverlayPath: join(smokeRoot, "transparent-sketch-overlay.html"),
  teacherExportedOverlayPacketPlaceholder: "<teacher-exported-transparent-sketch-packet.json>",
  expectedPacketFormat: "transparent_ai_sketch_overlay_packet_v1",
  spatialTargetConfirmationCommandTemplate:
    'node plugins\\transparent-ai-apprentice\\scripts\\create-spatial-target-confirmation-kit.mjs --overlay-packet "<teacher-exported-transparent-sketch-packet.json>" --goal "Smoke spatial intent receipt validation." --software "ExampleCAD" --output-dir "out" --create-action-kit "true"',
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  },
  blockedActions: ["fabricate_spatial_intent_without_teacher_exported_packet"]
});
const teacherPacketPath = writeJson(join(smokeRoot, "teacher-exported-transparent-sketch-packet.json"), {
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
      normalizedTarget: { x: 0.42, y: 0.58, zHint: 0.35 }
    }
  ],
  strokes: [
    {
      id: "teacher-depth-arrow",
      mode: "depth_axis_3d",
      semanticLabel: "extrude this face inward",
      points: [
        { x: 0.42, y: 0.58, zHint: 0.35 },
        { x: 0.52, y: 0.49, zHint: 0.7 }
      ]
    }
  ],
  spatialIntent: {
    supports2DPosition: true,
    supportsPerspectiveRelationships: true,
    supports3DDepthHints: true,
    relationships: [
      { subject: "teacher-depth-arrow", relation: "nearer_than", object: "target-face" },
      { subject: "teacher-depth-arrow", relation: "perspective_to", object: "target-face" }
    ],
    perspectiveCues: [{ strokeId: "teacher-depth-arrow", cue: "depth_axis_3d" }]
  }
});
const incompleteSpatialPacketPath = writeJson(join(smokeRoot, "incomplete-spatial-packet.json"), {
  format: "transparent_ai_sketch_overlay_packet_v1",
  overlayMode: "teacher_review_only",
  coordinateSpace: {
    supports2D: true,
    supportsPerspectiveRelationships: false,
    supports3DDepthHints: false
  },
  strokes: [
    {
      id: "plain-2d-arrow",
      mode: "screen_2d",
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 }
      ]
    }
  ],
  spatialIntent: {
    supports2DPosition: true,
    supportsPerspectiveRelationships: false,
    supports3DDepthHints: false
  }
});
const universalDetailLogicContractPath = writeJson(join(smokeRoot, "universal-detail-logic-contract.json"), {
  format: "transparent_ai_universal_detail_logic_contract_v1",
  surfaceSimilarityOnlyRejected: true,
  rows: [
    {
      featureId: "target-face",
      featureType: "depth_or_perspective_relation",
      detailCategory: "view_depth_or_perspective_relation",
      logicSourceStatus: "logic_source_supplied_waiting_for_teacher_review",
      blockedIfMissing: false
    },
    {
      featureId: "teacher-depth-arrow",
      featureType: "angle",
      detailCategory: "angular_or_curvature_logic",
      logicSourceStatus: "logic_source_supplied_waiting_for_teacher_review",
      blockedIfMissing: false
    },
    {
      featureId: "target-face-position",
      featureType: "position_relation",
      detailCategory: "position_alignment_relation",
      logicSourceStatus: "logic_source_supplied_waiting_for_teacher_review",
      blockedIfMissing: false
    }
  ],
  counts: {
    totalDetails: 2,
    missingLogicSource: 0,
    blockedDetails: 0
  },
  logicCompletenessGate: {
    requiredBeforeTargetSoftwareAction: true,
    visualSimilarityCanNeverOverrideMissingLogic: true
  }
});
const passedDetailLogicValidationPath = writeJson(join(smokeRoot, "passed-parametric-drawing-logic-receipt-validation.json"), {
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

const placeholderReceiptPath = writeJson(join(smokeRoot, "placeholder-receipt.json"), {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  teacherDecision: "teacher_reviewed_prepare_spatial_confirmation",
  evidenceReviewed: true,
  teacherExportedOverlayPacketPath: "<teacher-exported-transparent-sketch-packet.json>"
});
const readyReceiptPath = writeJson(join(smokeRoot, "ready-receipt.json"), {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  teacherDecision: "teacher_reviewed_prepare_spatial_confirmation",
  evidenceReviewed: true,
  teacherExportedOverlayPacketPath: teacherPacketPath,
  detailLogicReviewed: true,
  universalDetailLogicContractPath,
  universalDetailLogicReceiptValidationPath: passedDetailLogicValidationPath
});
const missingDetailLogicReceiptPath = writeJson(join(smokeRoot, "missing-detail-logic-receipt.json"), {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  teacherDecision: "teacher_reviewed_prepare_spatial_confirmation",
  evidenceReviewed: true,
  teacherExportedOverlayPacketPath: teacherPacketPath,
  detailLogicReviewed: false,
  universalDetailLogicContractPath: "<teacher-reviewed-universal-detail-logic-contract-or-kit.json>"
});
const missingDetailLogicValidationReceiptPath = writeJson(join(smokeRoot, "missing-detail-logic-validation-receipt.json"), {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  teacherDecision: "teacher_reviewed_prepare_spatial_confirmation",
  evidenceReviewed: true,
  teacherExportedOverlayPacketPath: teacherPacketPath,
  detailLogicReviewed: true,
  universalDetailLogicContractPath,
  universalDetailLogicReceiptValidationPath: "<passed-parametric-drawing-logic-receipt-validation.json>"
});
const incompleteSpatialReceiptPath = writeJson(join(smokeRoot, "incomplete-spatial-receipt.json"), {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  teacherDecision: "teacher_reviewed_prepare_spatial_confirmation",
  evidenceReviewed: true,
  teacherExportedOverlayPacketPath: incompleteSpatialPacketPath,
  detailLogicReviewed: true,
  universalDetailLogicContractPath,
  universalDetailLogicReceiptValidationPath: passedDetailLogicValidationPath
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  teacherDecision: "execute_now",
  evidenceReviewed: true,
  teacherExportedOverlayPacketPath: teacherPacketPath,
  detailLogicReviewed: true,
  universalDetailLogicContractPath,
  universalDetailLogicReceiptValidationPath: passedDetailLogicValidationPath
});

const placeholder = runScript(["--request", requestPath, "--receipt", placeholderReceiptPath, "--output-dir", join(smokeRoot, "placeholder")]);
const ready = runScript(["--request", requestPath, "--receipt", readyReceiptPath, "--output-dir", join(smokeRoot, "ready")]);
const missingDetailLogic = runScript([
  "--request",
  requestPath,
  "--receipt",
  missingDetailLogicReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-detail-logic")
]);
const missingDetailLogicValidationRun = runScript([
  "--request",
  requestPath,
  "--receipt",
  missingDetailLogicValidationReceiptPath,
  "--output-dir",
  join(smokeRoot, "missing-detail-logic-validation")
]);
const incompleteSpatial = runScript([
  "--request",
  requestPath,
  "--receipt",
  incompleteSpatialReceiptPath,
  "--output-dir",
  join(smokeRoot, "incomplete-spatial")
]);
const forbidden = runScript(
  ["--request", requestPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(smokeRoot, "forbidden")],
  { expectFailure: true }
);
const placeholderValidation = readJson(placeholder.validationPath);
const readyValidation = readJson(ready.validationPath);
const missingDetailLogicValidation = readJson(missingDetailLogic.validationPath);
const missingDetailLogicValidationGate = readJson(missingDetailLogicValidationRun.validationPath);
const incompleteSpatialValidation = readJson(incompleteSpatial.validationPath);
const forbiddenValidation = readJson(forbidden.validationPath);

const checks = [
  {
    name: "Placeholder overlay path is blocked as non-evidence",
    pass:
      placeholderValidation.status === "blocked" &&
      placeholderValidation.validationDecision === "blocked_placeholder_is_not_teacher_evidence" &&
      placeholderValidation.validationRow.placeholderUsed === true &&
      placeholderValidation.locks.spatialTargetConfirmationInvoked === false,
    evidence: placeholder.validationPath
  },
  {
    name: "Teacher-exported overlay packet can prepare spatial target confirmation command without running it",
    pass:
      readyValidation.status === "validated_with_ready_spatial_target_confirmation" &&
      readyValidation.validationDecision === "ready_for_reviewed_spatial_target_confirmation" &&
      readyValidation.validationRow.overlayPacketFormatOk === true &&
      readyValidation.validationRow.hasSpatialEvidence === true &&
      readyValidation.validationRow.spatialEvidence.ready === true &&
      readyValidation.validationRow.spatialEvidence.has2DPositionEvidence === true &&
      readyValidation.validationRow.spatialEvidence.hasAngleOrDirectionEvidence === true &&
      readyValidation.validationRow.spatialEvidence.hasPerspectiveEvidence === true &&
      readyValidation.validationRow.spatialEvidence.has3DDepthEvidence === true &&
      readyValidation.validationRow.detailLogicReadyForAction === true &&
      readyValidation.validationRow.detailLogicHasPositionRelationLogic === true &&
      readyValidation.validationRow.detailLogicHasAngularOrDirectionLogic === true &&
      readyValidation.validationRow.detailLogicHasDepthPerspectiveLogic === true &&
      readyValidation.validationRow.detailLogicMissingSourceCount === 0 &&
      readyValidation.validationRow.detailLogicValidationReadyForAction === true &&
      readyValidation.validationRow.detailLogicValidationBlockedRows === 0 &&
      readyValidation.nextReviewCommand.commandLine.includes(teacherPacketPath) &&
      !readyValidation.nextReviewCommand.commandLine.includes("<teacher-exported-transparent-sketch-packet.json>") &&
      readyValidation.locks.validationDoesNotRunSpatialTargetConfirmation === true &&
      readyValidation.locks.targetSoftwareCommandsExecuted === false,
    evidence: ready.validationPath
  },
  {
    name: "Spatial confirmation is blocked when exported packet lacks perspective and 3D depth evidence",
    pass:
      incompleteSpatialValidation.status === "blocked" &&
      incompleteSpatialValidation.validationDecision.includes("blocked_missing_spatial_dimensions") &&
      incompleteSpatialValidation.validationRow.spatialEvidence.has2DPositionEvidence === true &&
      incompleteSpatialValidation.validationRow.spatialEvidence.hasAngleOrDirectionEvidence === true &&
      incompleteSpatialValidation.validationRow.spatialEvidence.hasPerspectiveEvidence === false &&
      incompleteSpatialValidation.validationRow.spatialEvidence.has3DDepthEvidence === false &&
      incompleteSpatialValidation.validationRow.canPrepareSpatialConfirmation === false,
    evidence: incompleteSpatial.validationPath
  },
  {
    name: "Spatial confirmation is blocked until universal detail logic is reviewed",
    pass:
      missingDetailLogicValidation.status === "blocked" &&
      missingDetailLogicValidation.validationDecision === "blocked_missing_universal_detail_logic_review" &&
      missingDetailLogicValidation.validationRow.detailLogicReviewed === false &&
      missingDetailLogicValidation.validationRow.canPrepareSpatialConfirmation === false &&
      missingDetailLogicValidation.locks.softwareActionsExecuted === false,
    evidence: missingDetailLogic.validationPath
  },
  {
    name: "Spatial confirmation is blocked until detail logic receipt validation passes",
    pass:
      missingDetailLogicValidationGate.status === "blocked" &&
      missingDetailLogicValidationGate.validationDecision === "blocked_missing_universal_detail_logic_receipt_validation" &&
      missingDetailLogicValidationGate.validationRow.detailLogicReviewed === true &&
      missingDetailLogicValidationGate.validationRow.detailLogicValidationReadyForAction === false &&
      missingDetailLogicValidationGate.validationRow.canPrepareSpatialConfirmation === false &&
      missingDetailLogicValidationGate.locks.softwareActionsExecuted === false,
    evidence: missingDetailLogicValidationRun.validationPath
  },
  {
    name: "Forbidden execute-now decision fails closed before spatial confirmation",
    pass:
      forbidden.failedAsExpected === true &&
      forbidden.exitStatus !== 0 &&
      forbiddenValidation.status === "blocked" &&
      forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.locks.softwareActionsExecuted === false,
    evidence: forbidden.validationPath
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ status: "failed", failed }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      smoke: "transparent_ai_spatial_intent_evidence_receipt_validation_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
