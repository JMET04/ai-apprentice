#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function makeSmokeRoot(preferredRoot = "") {
  const id = String(Date.now());
  const candidates = [
    preferredRoot ? join(resolve(preferredRoot), id) : "",
    join(repoRoot, ".transparent-apprentice", "sketch-demonstration-implementation-audit", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "sketch-demonstration-implementation-audit", id)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create a sketch demonstration implementation audit smoke directory.");
}

const smokeRoot = makeSmokeRoot(argValue("--output-dir", argValue("--out-dir", "")));

function runSmoke(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function lockStateIsClosed(payload) {
  const locks = payload?.locks || payload?.reviewLocks || payload || {};
  return (
    locks.accepted === false &&
    locks.ruleEnabled === false &&
    locks.packagingGated === true &&
    (locks.nativeUniversalExecution === false || locks.nativeUniversalExecution === undefined) &&
    (locks.softwareActionsExecuted === false || locks.softwareActionsExecuted === undefined) &&
    (locks.screenshotsCaptured === false || locks.screenshotsCaptured === undefined) &&
    (locks.memoryWritten === false || locks.memoryWritten === undefined)
  );
}

function checkByName(summary, name) {
  return Array.isArray(summary.checks) && summary.checks.some((check) => check.name === name && check.pass === true);
}

function isUnder(child, parent) {
  const normalizedChild = resolve(child).toLowerCase();
  const normalizedParent = resolve(parent).toLowerCase();
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}\\`);
}

const sourceSmokeRoot = join(smokeRoot, "source-smokes");
const inventoryInput = argValue("--inventory", argValue("--inventory-path", ""));
const existingDrawing = runSmoke("smoke-existing-drawing-spatial-controlled-execution.mjs", [
  "--output-dir",
  join(sourceSmokeRoot, "existing-drawing-spatial-controlled-execution")
]);
const realLocalRouteArgs = [
  "--output-dir",
  join(sourceSmokeRoot, "real-local-spatial-execution-route")
];
if (inventoryInput) realLocalRouteArgs.push("--inventory", inventoryInput);
const realLocalRoute = runSmoke("smoke-real-local-spatial-execution-route.mjs", realLocalRouteArgs);

const existingOverlay = readJson(existingDrawing.paths.overlayPacket);
const existingInterpretation = readJson(existingDrawing.paths.spatialInterpretation);
const existingConfirmation = readJson(existingDrawing.paths.targetConfirmation);
const existingRouteBridge = readJson(existingDrawing.paths.routeBridge);
const existingExecuteReceipt = readJson(existingDrawing.paths.executeReceipt);
const existingCheckpoint = readJson(existingDrawing.paths.postActionCheckpoint);

const realLocalOverlay = readJson(realLocalRoute.paths.overlay);
const realLocalInterpretation = readJson(realLocalRoute.paths.spatialIntent);
const realLocalConfirmation = readJson(realLocalRoute.paths.targetConfirmation);
const realLocalRouteBridge = readJson(realLocalRoute.paths.routeBridge);
const realLocalReceipt = readJson(realLocalRoute.paths.routeReceipt);

const checks = [
  {
    name: "Existing drawing software is reused before transparent mask execution planning",
    pass:
      existingDrawing.status === "passed" &&
      checkByName(existingDrawing, "Existing drawing templates and transparent overlay kit are reused before execution") &&
      Boolean(existingOverlay.sourceExistingDrawingTools?.drawio) &&
      Boolean(existingOverlay.sourceExistingDrawingTools?.excalidraw) &&
      Boolean(existingOverlay.sourceExistingDrawingTools?.mermaid),
    evidence: existingDrawing.paths.drawingTemplateManifest
  },
  {
    name: "Teacher sketch packet carries 2D position perspective and 3D depth strokes",
    pass:
      existingOverlay.coordinateSpace.supports2D === true &&
      existingOverlay.coordinateSpace.supportsPerspectiveRelationships === true &&
      existingOverlay.coordinateSpace.supports3DDepthHints === true &&
      existingOverlay.strokes.some((stroke) => stroke.mode === "screen_2d") &&
      existingOverlay.strokes.some((stroke) => stroke.mode === "perspective_grid") &&
      existingOverlay.strokes.some((stroke) => stroke.mode === "depth_axis_3d") &&
      realLocalOverlay.coordinateSpace.supports2D === true &&
      realLocalOverlay.coordinateSpace.supportsPerspectiveRelationships === true &&
      realLocalOverlay.coordinateSpace.supports3DDepthHints === true,
    evidence: `${existingDrawing.paths.overlayPacket}; ${realLocalRoute.paths.overlay}`
  },
  {
    name: "Teacher sketch packet carries universal detail logic contract beyond line examples",
    pass:
      existingOverlay.universalDetailLogicContract?.format === "transparent_ai_universal_detail_logic_contract_v1" &&
      existingOverlay.universalDetailLogicContract?.principle?.includes("visual similarity alone is insufficient") &&
      existingOverlay.universalDetailLogicContract?.detailLogicScope?.includes("angular/curvature") &&
      existingOverlay.universalDetailLogicContract?.detailLogicScope?.includes("view/depth/perspective") &&
      existingOverlay.universalDetailLogicContract?.detailLogicScope?.includes("position/alignment/relation") &&
      existingOverlay.universalDetailLogicContract?.blockedActions?.includes("execute_or_generate_output_that_only_looks_similar_without_detail_logic") &&
      realLocalOverlay.universalDetailLogicContract?.format === "transparent_ai_universal_detail_logic_contract_v1" &&
      realLocalOverlay.universalDetailLogicContract?.blockedActions?.includes("generate_any_consequential_detail_without_logic_source"),
    evidence: `${existingDrawing.paths.overlayPacket}; ${realLocalRoute.paths.overlay}`
  },
  {
    name: "Spatial interpreter derives position perspective and depth relationships from the sketch",
    pass:
      existingInterpretation.format === "transparent_ai_spatial_intent_interpretation_v1" &&
      existingInterpretation.summary.supports2D === true &&
      existingInterpretation.summary.supports3DDepthHints === true &&
      existingInterpretation.inferredRelationships.some((row) => row.relation === "perspective_to") &&
      existingInterpretation.inferredRelationships.some((row) => row.relation === "nearer_than") &&
      realLocalInterpretation.summary.supports2D === true &&
      realLocalInterpretation.summary.supports3DDepthHints === true &&
      realLocalInterpretation.inferredRelationships.some((row) => row.relation === "perspective_to") &&
      realLocalInterpretation.inferredRelationships.some((row) => row.relation === "nearer_than"),
    evidence: `${existingDrawing.paths.spatialInterpretation}; ${realLocalRoute.paths.spatialIntent}`
  },
  {
    name: "Spatial interpreter logicizes stroke position angle perspective and depth details",
    pass:
      existingInterpretation.detailLogicContract?.format === "transparent_ai_universal_detail_logic_contract_v1" &&
      existingInterpretation.detailLogicContract?.missingLogicSourceBehavior === "block_execute_and_route_to_teacher_review" &&
      existingInterpretation.detailLogicContract?.consequentialDetailRows?.some((row) => row.detailCategory === "position/alignment/relation") &&
      existingInterpretation.detailLogicContract?.consequentialDetailRows?.some((row) => row.detailCategory === "angular/curvature") &&
      existingInterpretation.detailLogicContract?.consequentialDetailRows?.some((row) => row.detailCategory === "view/depth/perspective") &&
      existingInterpretation.detailLogicContract?.blockedActions?.includes("execute_or_generate_output_that_only_looks_similar_without_detail_logic") &&
      realLocalInterpretation.detailLogicContract?.consequentialDetailRows?.some((row) => row.logicSource?.includes("normalized")) &&
      realLocalInterpretation.summary.detailLogicItemCount > 0,
    evidence: `${existingDrawing.paths.spatialInterpretation}; ${realLocalRoute.paths.spatialIntent}`
  },
  {
    name: "Sketch targets are converted into numbered teacher confirmation candidates",
    pass:
      existingConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      existingConfirmation.candidates.length >= 2 &&
      realLocalConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      realLocalConfirmation.candidates.length >= 2 &&
      checkByName(existingDrawing, "Drawing-derived spatial target is numbered and teacher-confirmed before route selection") &&
      checkByName(realLocalRoute, "Numbered target confirmation requires one teacher-selected real local spatial target"),
    evidence: `${existingDrawing.paths.targetConfirmation}; ${realLocalRoute.paths.targetConfirmation}`
  },
  {
    name: "Confirmed sketch intent bridges to dry-run-first software execution routes",
    pass:
      existingRouteBridge.format === "transparent_ai_spatial_software_execution_route_bridge_v1" &&
      existingRouteBridge.routeCandidates.some((route) => route.dryRunHandoff?.tool === "create_existing_software_execution_adapter") &&
      realLocalRouteBridge.format === "transparent_ai_spatial_software_execution_route_bridge_v1" &&
      realLocalRouteBridge.routeCandidates.every((route) => route.dryRunHandoff?.tool === "create_existing_software_execution_adapter") &&
      realLocalRouteBridge.routeCandidates.every((route) => route.verificationHandoff?.tool === "create_post_action_evidence_checkpoint") &&
      checkByName(existingDrawing, "Confirmed drawing target creates action readiness and dry-run-first execution routes") &&
      checkByName(realLocalRoute, "Real local confirmed spatial target binds to dry-run route candidates only"),
    evidence: `${existingDrawing.paths.routeBridge}; ${realLocalRoute.paths.routeBridge}`
  },
  {
    name: "Controlled proof executes only a reviewed package-local route and then verifies low-token outcome",
    pass:
      existingExecuteReceipt.status === "teacher_confirmed_cli_script_executed" &&
      existingExecuteReceipt.teacherConfirmed === true &&
      existingExecuteReceipt.commandExecuted === true &&
      existingExecuteReceipt.cliOutputPath.includes("cli-output") &&
      existingCheckpoint.format === "transparent_ai_post_action_low_token_evidence_checkpoint_v1" &&
      existingCheckpoint.result.status === "post_action_changed_waiting_for_teacher_review" &&
      existingCheckpoint.locks.screenshotsCaptured === false &&
      existingCheckpoint.locks.memoryWritten === false,
    evidence: `${existingDrawing.paths.executeReceipt}; ${existingDrawing.paths.postActionCheckpoint}`
  },
  {
    name: "Real local proof remains review-only without screenshot memory or native universal execution",
    pass:
      realLocalRoute.status === "passed" &&
      lockStateIsClosed(realLocalReceipt) &&
      realLocalReceipt.softwareActionsExecuted === false &&
      realLocalReceipt.screenshotsCaptured === false &&
      realLocalReceipt.memoryWritten === false,
    evidence: realLocalRoute.paths.routeReceipt
  },
  {
    name: "Audit source evidence is durable under the requested audit directory",
    pass:
      isUnder(existingDrawing.smokeRoot, sourceSmokeRoot) &&
      isUnder(realLocalRoute.smokeRoot, sourceSmokeRoot) &&
      !existingDrawing.smokeRoot.toLowerCase().includes("\\windows\\temp\\") &&
      !realLocalRoute.smokeRoot.toLowerCase().includes("\\windows\\temp\\"),
    evidence: `${existingDrawing.smokeRoot}; ${realLocalRoute.smokeRoot}`
  }
];

const failed = checks.filter((check) => !check.pass);
const audit = {
  format: "transparent_ai_sketch_demonstration_implementation_audit_v1",
  status: failed.length === 0 ? "passed" : "failed",
  createdAt: new Date().toISOString(),
  smokeRoot,
  sourceSmokeRoot,
  requirementSummary: {
    transparentDrawingMaskImplemented: true,
    existingDrawingSoftwareReused: true,
    teacher2DSketchUnderstood: true,
    teacherPerspectiveSketchUnderstood: true,
    teacher3DDepthSketchUnderstood: true,
    universalDetailLogicContractImplemented: true,
    visualSimilarityRejectedWithoutDetailLogic: true,
    numberedTargetConfirmationImplemented: true,
    softwareExecutionBridgeImplemented: true,
    realLocalSoftwareContextProven: true,
    unattendedNativeUniversalExecutionProven: false
  },
  sourceSmokes: {
    existingDrawingSpatialControlledExecution: {
      smoke: existingDrawing.smoke,
      status: existingDrawing.status,
      smokeRoot: existingDrawing.smokeRoot,
      selectedCandidateNumber: existingDrawing.selectedCandidateNumber
    },
    realLocalSpatialExecutionRoute: {
      smoke: realLocalRoute.smoke,
      status: realLocalRoute.status,
      smokeRoot: realLocalRoute.smokeRoot,
      realLocalSoftware: realLocalRoute.realLocalSoftware
    }
  },
  paths: {
    existingDrawingOverlay: existingDrawing.paths.overlayPacket,
    existingDrawingSpatialInterpretation: existingDrawing.paths.spatialInterpretation,
    existingDrawingTargetConfirmation: existingDrawing.paths.targetConfirmation,
    existingDrawingRouteBridge: existingDrawing.paths.routeBridge,
    existingDrawingExecuteReceipt: existingDrawing.paths.executeReceipt,
    existingDrawingPostActionCheckpoint: existingDrawing.paths.postActionCheckpoint,
    realLocalOverlay: realLocalRoute.paths.overlay,
    realLocalSpatialIntent: realLocalRoute.paths.spatialIntent,
    realLocalTargetConfirmation: realLocalRoute.paths.targetConfirmation,
    realLocalRouteBridge: realLocalRoute.paths.routeBridge,
    realLocalRouteReceipt: realLocalRoute.paths.routeReceipt
  },
  checks,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    screenshotsCapturedByDefault: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    nativeUniversalExecution: false
  }
};

const auditPath = join(smokeRoot, "sketch-demonstration-implementation-audit.json");
writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: audit.status,
  smoke: "transparent_ai_sketch_demonstration_implementation_audit_smoke_v1",
  smokeRoot,
  auditPath,
  requirementSummary: audit.requirementSummary,
  checks
}, null, 2));

if (failed.length > 0) process.exit(1);
