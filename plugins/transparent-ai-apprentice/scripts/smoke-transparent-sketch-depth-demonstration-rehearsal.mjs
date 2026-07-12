#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
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
    join(repoRoot, ".transparent-apprentice", "transparent-sketch-depth-demonstration-rehearsal-smoke", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "transparent-sketch-depth-demonstration-rehearsal", id)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create a transparent sketch depth demonstration rehearsal smoke directory.");
}

const smokeRoot = makeSmokeRoot(argValue("--output-dir", argValue("--out-dir", "")));

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const waiting = runNodeScript("create-transparent-sketch-depth-demonstration-rehearsal.mjs", [
  "--goal",
  "Smoke waiting gate for transparent 2D perspective 3D sketch rehearsal.",
  "--software",
  "target engineering software",
  "--output-dir",
  join(smokeRoot, "waiting-rehearsal")
]);
const waitingJson = readJson(waiting.rehearsalPath);
const waitingRoute = readJson(waiting.routeBridge);
const waitingReceipt = readJson(waiting.routeReceipt);

const selected = runNodeScript("create-transparent-sketch-depth-demonstration-rehearsal.mjs", [
  "--goal",
  "Smoke selected target bridge for transparent 2D perspective 3D sketch rehearsal.",
  "--software",
  "target engineering software",
  "--selected-number",
  "1",
  "--teacher-confirmed-number",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--output-dir",
  join(smokeRoot, "selected-rehearsal")
]);
const selectedJson = readJson(selected.rehearsalPath);
const overlayPacket = readJson(selected.overlayPacket);
const spatialIntent = readJson(selected.spatialIntent);
const targetConfirmation = readJson(selected.targetConfirmation);
const routeBridge = readJson(selected.routeBridge);
const routeReceipt = readJson(selected.routeReceipt);

const checks = [
  {
    name: "Default rehearsal waits for exactly one teacher-confirmed number",
    pass:
      waiting.status === "waiting_for_teacher_numbered_spatial_target_confirmation" &&
      waitingRoute.status === "waiting_for_numbered_spatial_target_confirmation" &&
      waitingReceipt.nextRequiredGate === "teacher_numbered_target_confirmation" &&
      waitingJson.locks.softwareActionsExecuted === false,
    evidence: waiting.rehearsalPath
  },
  {
    name: "Selected rehearsal reuses transparent overlay spatial interpreter numbered target and route bridge",
    pass:
      selectedJson.reusedTools.includes("create-transparent-sketch-overlay-kit.mjs") &&
      selectedJson.reusedTools.includes("interpret-transparent-sketch-spatial-intent.mjs") &&
      selectedJson.reusedTools.includes("create-spatial-target-confirmation-kit.mjs") &&
      selectedJson.reusedTools.includes("create-spatial-software-execution-route-bridge.mjs") &&
      selectedJson.status === "depth_demonstration_rehearsed_waiting_for_dry_run_route_review",
    evidence: selected.rehearsalPath
  },
  {
    name: "Transparent sketch packet carries 2D perspective and 3D depth strokes",
    pass:
      overlayPacket.format === "transparent_ai_sketch_overlay_packet_v1" &&
      overlayPacket.coordinateSpace.supports2D === true &&
      overlayPacket.coordinateSpace.supportsPerspectiveRelationships === true &&
      overlayPacket.coordinateSpace.supports3DDepthHints === true &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "screen_2d") &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "perspective_grid") &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "depth_axis_3d"),
    evidence: selected.overlayPacket
  },
  {
    name: "Spatial interpretation logicizes position angle perspective and depth before route planning",
    pass:
      spatialIntent.format === "transparent_ai_spatial_intent_interpretation_v1" &&
      spatialIntent.summary.supports2D === true &&
      spatialIntent.summary.supports3DDepthHints === true &&
      spatialIntent.inferredRelationships.some((row) => row.relation === "perspective_to") &&
      spatialIntent.inferredRelationships.some((row) => row.relation === "nearer_than") &&
      spatialIntent.detailLogicContract.consequentialDetailRows.some((row) => row.detailCategory === "position/alignment/relation") &&
      spatialIntent.detailLogicContract.consequentialDetailRows.some((row) => row.detailCategory === "angular/curvature") &&
      spatialIntent.detailLogicContract.consequentialDetailRows.some((row) => row.detailCategory === "view/depth/perspective") &&
      spatialIntent.detailLogicContract.missingLogicSourceBehavior === "block_execute_and_route_to_teacher_review",
    evidence: selected.spatialIntent
  },
  {
    name: "Numbered target confirmation and selected target route remain dry-run-first",
    pass:
      targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmation.candidates.length >= 2 &&
      routeBridge.status === "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review" &&
      routeBridge.selectedTarget.selectedTargetOnly === true &&
      routeBridge.routeCandidates.every((candidate) => candidate.dryRunHandoff.tool === "create_existing_software_execution_adapter") &&
      routeBridge.routeCandidates.every((candidate) => candidate.verificationHandoff.tool === "create_post_action_evidence_checkpoint"),
    evidence: selected.routeBridge
  },
  {
    name: "Rehearsal keeps screenshot execution UI memory rule packaging and native execution locks closed",
    pass:
      selectedJson.locks.rehearsalDoesNotCaptureScreenshots === true &&
      selectedJson.locks.rehearsalDoesNotExecuteSoftware === true &&
      selectedJson.locks.rehearsalDoesNotSendUiEvents === true &&
      selectedJson.locks.rehearsalDoesNotWriteMemory === true &&
      selectedJson.locks.rehearsalDoesNotEnableRules === true &&
      routeReceipt.softwareActionsExecuted === false &&
      routeReceipt.targetSoftwareCommandsExecuted === false &&
      routeReceipt.screenshotsCaptured === false &&
      routeReceipt.memoryWritten === false &&
      routeReceipt.accepted === false &&
      routeReceipt.ruleEnabled === false &&
      routeReceipt.packagingGated === true &&
      routeReceipt.locks.nativeUniversalExecution === false,
    evidence: selected.routeReceipt
  },
  {
    name: "Teacher-facing HTML and readme are generated for the depth demonstration rehearsal",
    pass: existsSync(selected.htmlPath) && existsSync(selected.readmePath) && readFileSync(selected.htmlPath, "utf8").includes("Transparent Sketch Depth Demonstration Rehearsal"),
    evidence: selected.htmlPath
  },
  {
    name: "Standalone depth rehearsal smoke evidence is durable by default",
    pass: !smokeRoot.toLowerCase().includes("\\windows\\temp\\"),
    evidence: smokeRoot
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_smoke_v1",
  smokeRoot,
  selectedRehearsal: selected.rehearsalPath,
  waitingRehearsal: waiting.rehearsalPath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
