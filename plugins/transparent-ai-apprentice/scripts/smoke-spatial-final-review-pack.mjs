#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(repoRoot, args) {
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "command failed");
  return JSON.parse(result.stdout);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const root = mkdtempSync(join(tmpdir(), "ta-spatial-final-review-pack-"));
const sketchAuditPath = join(root, "sketch-demonstration-implementation-audit.json");
const spatialResolutionPath = join(root, "spatial-first-blocker-overlay-resolution.json");
const spatialValidationPath = join(root, "spatial-intent-evidence-receipt-validation.json");
const detailValidationPath = join(root, "parametric-drawing-logic-receipt-validation.json");
const finalGatePath = join(root, "original-goal-final-completion-gate.json");

writeJson(sketchAuditPath, {
  format: "transparent_ai_sketch_demonstration_implementation_audit_package_v1",
  status: "sketch_demonstration_implemented_waiting_for_teacher_real_overlay_review",
  requirementSummary: {
    transparentDrawingMaskImplemented: true,
    teacher2DSketchUnderstood: true,
    teacherPerspectiveSketchUnderstood: true,
    teacher3DDepthSketchUnderstood: true,
    numberedTargetConfirmationImplemented: true,
    softwareExecutionBridgeImplemented: true
  }
});
writeJson(spatialResolutionPath, {
  format: "transparent_ai_spatial_first_blocker_overlay_resolution_v1",
  status: "waiting_for_teacher_receipt_review_or_detail_logic_evidence",
  overlayReadyForReceipt: true,
  receiptValidationStatus: "blocked",
  paths: {
    readme: join(root, "SPATIAL_FIRST_BLOCKER_OVERLAY_RESOLUTION_START_HERE.md"),
    overlayPacket: join(root, "sample-transparent-sketch-packet.json"),
    overlayValidation: join(root, "transparent-sketch-overlay-packet-validation.json")
  },
  locks: {
    reviewOnly: true,
    spatialTargetConfirmationInvoked: false,
    softwareActionsExecuted: false,
    goalComplete: false
  }
});
writeJson(spatialValidationPath, {
  format: "transparent_ai_spatial_intent_evidence_receipt_validation_v1",
  status: "blocked",
  validationDecision: "blocked_missing_universal_detail_logic_review",
  validationRow: {
    hasSpatialEvidence: true,
    overlayPacketExists: true,
    overlayPacketFormatOk: true,
    spatialEvidence: {
      has2DPositionEvidence: true,
      hasAngleOrDirectionEvidence: true,
      hasPerspectiveEvidence: true,
      has3DDepthEvidence: true
    },
    canPrepareSpatialConfirmation: false
  },
  paths: {
    readme: join(root, "SPATIAL_INTENT_EVIDENCE_RECEIPT_VALIDATION_START_HERE.md"),
    sourceRequest: join(root, "spatial-intent-evidence-request.json")
  },
  locks: {
    reviewOnly: true,
    spatialTargetConfirmationInvoked: false,
    softwareActionsExecuted: false,
    goalComplete: false
  }
});
writeJson(detailValidationPath, {
  format: "transparent_ai_parametric_drawing_logic_receipt_validation_v1",
  status: "blocked_until_teacher_reviews_every_consequential_detail_logic_row",
  decision: "needs_teacher_review",
  counts: {
    relationshipRows: 4,
    universalDetailLogicRows: 4,
    transferValidationRows: 4,
    blockedRows: 13
  },
  requirementGates: {
    fullDetailCoverageReviewed: false,
    implicitHiddenDerivedDetailCoverageReviewed: false
  },
  blockedRows: [
    {
      relationshipId: "relationship-1",
      status: "relationship_logic_needs_teacher_review",
      blocker: "Teacher must review evidence."
    },
    {
      relationshipId: "relationship-2",
      status: "universal_detail_logic_needs_teacher_review",
      blocker: "Teacher must review detail logic."
    }
  ],
  paths: {
    readme: join(root, "PARAMETRIC_DRAWING_LOGIC_RECEIPT_VALIDATION_START_HERE.md"),
    sourceKit: join(root, "parametric-drawing-logic-learning-kit.json")
  },
  locks: {
    reviewOnly: true,
    validationDoesNotExecuteSoftware: true,
    softwareActionsExecuted: false,
    goalComplete: false
  }
});
writeJson(finalGatePath, {
  format: "transparent_ai_original_goal_final_completion_gate_v1",
  lanes: [
    {
      id: "transparent_2d_perspective_3d_sketch_implementation",
      status: "ready_for_final_teacher_acceptance_review",
      ready: true
    },
    {
      id: "teacher_validated_spatial_intent_and_detail_logic",
      status: "blocked_before_goal_completion_claim",
      ready: false,
      evidence: "blocked_missing_universal_detail_logic_review"
    }
  ]
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-spatial-final-review-pack.mjs"),
  "--sketch-audit",
  sketchAuditPath,
  "--spatial-resolution",
  spatialResolutionPath,
  "--spatial-receipt-validation",
  spatialValidationPath,
  "--detail-logic-validation",
  detailValidationPath,
  "--final-completion-gate",
  finalGatePath,
  "--output-dir",
  join(root, "review-pack")
]);
const pack = readJson(result.packPath);
const receipt = readJson(result.receiptTemplatePath);

assert(pack.format === "transparent_ai_spatial_final_review_pack_v1", "bad pack format");
assert(pack.status === "waiting_for_teacher_spatial_detail_logic_review_before_execution", "pack should wait for teacher review");
assert(pack.implementationSummary.transparentDrawingMaskImplemented === true, "transparent mask implementation missing");
assert(pack.spatialEvidenceSummary.has2DPositionEvidence === true, "2D evidence missing");
assert(pack.spatialEvidenceSummary.hasPerspectiveEvidence === true, "perspective evidence missing");
assert(pack.spatialEvidenceSummary.has3DDepthEvidence === true, "3D depth evidence missing");
assert(pack.spatialEvidenceSummary.canPrepareSpatialConfirmation === false, "spatial confirmation must stay blocked");
assert(pack.detailLogicSummary.blockedRows === 13, "blocked detail row count missing");
assert(pack.completionBoundary.spatialExecutionReady === false, "execution readiness must stay false");
assert(pack.locks.packDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(pack.locks.spatialTargetConfirmationInvoked === false, "spatial confirmation lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("execute_now"), "execute must be forbidden");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete must be forbidden");

const unsafeValidationPath = join(root, "unsafe-spatial-validation.json");
writeJson(unsafeValidationPath, {
  ...readJson(spatialValidationPath),
  locks: {
    reviewOnly: true,
    spatialTargetConfirmationInvoked: true
  }
});
const blockedResult = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-spatial-final-review-pack.mjs"),
  "--sketch-audit",
  sketchAuditPath,
  "--spatial-resolution",
  spatialResolutionPath,
  "--spatial-receipt-validation",
  unsafeValidationPath,
  "--detail-logic-validation",
  detailValidationPath,
  "--final-completion-gate",
  finalGatePath,
  "--output-dir",
  join(root, "blocked-review-pack")
]);
const blockedPack = readJson(blockedResult.packPath);
assert(blockedPack.status === "blocked_waiting_for_valid_spatial_review_inputs", "unsafe spatial validation should block");
assert(blockedPack.blockers.includes("spatial_validation_confirmation_lock_missing"), "missing confirmation lock blocker");
assert(blockedPack.locks.goalComplete === false, "blocked pack must not complete goal");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_spatial_final_review_pack_smoke_v1",
      pack: result.packPath,
      receiptTemplate: result.receiptTemplatePath,
      blockedPack: blockedResult.packPath,
      spatialEvidenceSummary: pack.spatialEvidenceSummary,
      detailLogicSummary: pack.detailLogicSummary,
      locks: pack.locks
    },
    null,
    2
  )
);
