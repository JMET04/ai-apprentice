#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
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
const root = mkdtempSync(join(tmpdir(), "ta-spatial-convergence-"));
const finalReviewPackPath = join(root, "spatial-final-review-pack.json");
const handoffPath = join(root, "current-goal-teacher-spatial-drawing-handoff.json");
const depthRehearsalPath = join(root, "transparent-sketch-depth-demonstration-rehearsal.json");
const overlayValidationPath = join(root, "transparent-sketch-overlay-packet-validation.json");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  spatialTargetConfirmationInvoked: false,
  screenshotsCaptured: false,
  logContentsRead: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  goalComplete: false
};

writeJson(finalReviewPackPath, {
  format: "transparent_ai_spatial_final_review_pack_v1",
  status: "waiting_for_teacher_spatial_detail_logic_review_before_execution",
  implementationSummary: {
    sketchDemonstrationImplemented: true,
    transparentDrawingMaskImplemented: true,
    teacher2DSketchUnderstood: true,
    teacherPerspectiveSketchUnderstood: true,
    teacher3DDepthSketchUnderstood: true,
    numberedTargetConfirmationImplemented: true,
    softwareExecutionBridgeImplemented: true
  },
  spatialEvidenceSummary: {
    has2DPositionEvidence: true,
    hasAngleOrDirectionEvidence: true,
    hasPerspectiveEvidence: true,
    has3DDepthEvidence: true
  },
  detailLogicSummary: {
    blockedRows: 13,
    fullDetailCoverageReviewed: false
  },
  locks
});
writeJson(handoffPath, {
  format: "transparent_ai_current_goal_teacher_spatial_drawing_handoff_v1",
  status: "waiting_for_teacher_exported_overlay_packet",
  realTeacherOverlayPacketProvided: false,
  implementedNow: {
    transparentDrawingMaskKitCreated: true,
    browserTransparentOverlay: true,
    windowsTopMostOverlay: true,
    exportsLowTokenOverlayPacket: true,
    numberedTargetConfirmationCommandPreparedButNotRun: true,
    targetSoftwareExecutionPreparedButNotRun: true
  },
  proofOnlySample: {
    validationPath: overlayValidationPath,
    notTeacherEvidence: true
  },
  locks: {
    ...locks,
    samplePacketIsImplementationProofOnly: true
  },
  goalComplete: false
});
writeJson(depthRehearsalPath, {
  format: "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1",
  status: "waiting_for_teacher_numbered_spatial_target_confirmation",
  capabilitiesRehearsed: {
    depthDemonstration: true,
    twoDPosition: true
  },
  locks
});
writeJson(overlayValidationPath, {
  format: "transparent_ai_transparent_sketch_overlay_packet_validation_v1",
  status: "overlay_packet_ready_for_spatial_intent_evidence_receipt",
  spatialEvidence: {
    has2DPositionEvidence: true,
    hasAngleOrDirectionEvidence: true,
    hasPerspectiveEvidence: true,
    has3DDepthEvidence: true
  },
  locks,
  goalComplete: false
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-spatial-convergence-audit.mjs"),
  "--spatial-final-review-pack",
  finalReviewPackPath,
  "--teacher-spatial-handoff",
  handoffPath,
  "--depth-rehearsal",
  depthRehearsalPath,
  "--overlay-validation",
  overlayValidationPath,
  "--output-dir",
  join(root, "audit")
]);
const audit = readJson(result.auditPath);
const receipt = readJson(result.receiptTemplatePath);
const auditDirName = basename(dirname(result.auditPath));

assert(audit.format === "transparent_ai_spatial_convergence_audit_v1", "bad audit format");
assert(!/[.\s]$/.test(auditDirName), "audit directory must not end with a Windows-hostile dot or space");
assert(audit.status === "spatial_convergence_ready_for_teacher_review_not_execution", "audit should be review-ready");
assert(audit.summary.totalChecks === 13, "check count changed unexpectedly");
assert(audit.summary.passedChecks === 13, "all checks should pass");
assert(audit.summary.teacherValidated === false, "teacher validation must remain false");
assert(audit.summary.detailLogicBlockedRows === 13, "detail logic blocker count missing");
assert(audit.capabilities.transparentDrawingMaskImplemented === true, "transparent mask missing");
assert(audit.capabilities.has2DPositionEvidence === true, "2D evidence missing");
assert(audit.capabilities.hasPerspectiveEvidence === true, "perspective evidence missing");
assert(audit.capabilities.has3DDepthEvidence === true, "3D depth evidence missing");
assert(audit.capabilities.samplePacketIsImplementationProofOnly === true, "sample boundary missing");
assert(audit.locks.auditDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(audit.locks.goalComplete === false, "goal completion lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("execute_target_software"), "execute forbidden missing");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete forbidden missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_spatial_convergence_audit_smoke_v1",
      audit: result.auditPath,
      receiptTemplate: result.receiptTemplatePath,
      summary: audit.summary,
      locks: audit.locks
    },
    null,
    2
  )
);
