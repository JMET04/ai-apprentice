#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
    join(repoRoot, ".transparent-apprentice", "real-local-spatial-execution-route-smoke", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "real-local-spatial-execution-route", id)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create a real local spatial execution route smoke directory.");
}

const smokeRoot = makeSmokeRoot(argValue("--output-dir", argValue("--out-dir", "")));

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function hasInventoryCandidates(inventory) {
  return (
    inventory?.format === "transparent_ai_software_observer_inventory_v1" &&
    Array.isArray(inventory.softwareCandidates) &&
    inventory.softwareCandidates.length > 0
  );
}

function latestReviewedInventoryPath() {
  const roots = [
    join(repoRoot, "artifacts", "real-local-all-software-low-token-readiness-packages"),
    join(repoRoot, "artifacts", "real-local-all-software-low-token-readiness")
  ].filter((root) => existsSync(root));
  const candidates = [];
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = join(root, entry.name, "real-local-software-observer-inventory.json");
      if (!existsSync(candidate)) continue;
      try {
        const inventory = readJson(candidate);
        if (!hasInventoryCandidates(inventory)) continue;
        candidates.push({ path: candidate, mtimeMs: statSync(candidate).mtimeMs });
      } catch {
        // Ignore malformed historical smoke artifacts.
      }
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.path || "";
}

const providedInventory = argValue("--inventory", argValue("--inventory-path", ""));
let inventoryKit = null;
let inventoryPath = providedInventory ? resolve(providedInventory) : join(smokeRoot, "real-local-software-observer-inventory.json");
let inventorySource = providedInventory ? "provided_reviewed_inventory" : "read_only_real_local_inventory_probe";
let liveProbeInventoryPath = providedInventory ? "" : inventoryPath;
let probe = { status: 0, stdout: "", stderr: "", source: inventorySource };

if (!providedInventory) {
  inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
    "--goal",
    "Bounded real local spatial execution route smoke.",
    "--max-processes",
    "6",
    "--max-installed",
    "6",
    "--max-log-files-per-candidate",
    "1",
    "--output-dir",
    join(smokeRoot, "inventory-kit")
  ]);
  probe = spawnSync("powershell", [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    inventoryKit.readOnlyProbe,
    "-OutputPath",
    inventoryPath,
    "-MaxProcesses",
    "6",
    "-MaxInstalled",
    "6",
    "-MaxLogFilesPerCandidate",
    "1"
  ], {
    cwd: smokeRoot,
    encoding: "utf8",
    timeout: 60000
  });
}

let inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
if (!providedInventory && !hasInventoryCandidates(inventory)) {
  const fallbackInventory = latestReviewedInventoryPath();
  if (fallbackInventory) {
    inventoryPath = fallbackInventory;
    inventory = readJson(inventoryPath);
    inventorySource = "existing_reviewed_inventory_fallback_after_empty_probe";
  }
}
const candidate = Array.isArray(inventory?.softwareCandidates) && inventory.softwareCandidates.length > 0
  ? inventory.softwareCandidates.find((row) => row.windowTitle || row.processName) || inventory.softwareCandidates[0]
  : null;
if (!candidate) throw new Error("Real local inventory returned no software candidates and no reviewed fallback inventory was available.");

const software = String(candidate.software || candidate.processName || "real local software");
const processName = String(candidate.processName || "");
const windowTitle = String(candidate.windowTitle || "");
const goal = `Use a transparent 2D/perspective/3D sketch to route a dry-run action for ${software}.`;

const overlayKit = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--mode",
  "screen_2d_perspective_3d",
  "--output-dir",
  join(smokeRoot, "overlay-kit")
]);

const overlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software,
  goal,
  createdAt: new Date().toISOString(),
  fullContinuousRecording: false,
  overlayMode: "real_local_2d_perspective_3d_teacher_mask",
  targetSoftwareEvidence: {
    source: inventorySource,
    inventoryPath,
    liveProbeInventoryPath,
    liveProbeStatus: probe.status,
    processName,
    windowTitle,
    software
  },
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true,
    supportsPerspectiveRelationships: true
  },
  anchors: [
    { id: "real-local-target-region", type: "teacher_marked_region", label: "target region in real local software view", box: [0.58, 0.26, 0.78, 0.48] },
    { id: "real-local-source-region", type: "teacher_marked_region", label: "source region in current view", box: [0.2, 0.58, 0.36, 0.75] }
  ],
  strokes: [
    {
      id: "screen-2d-move",
      mode: "screen_2d",
      semanticLabel: "move selected item right and upward",
      targetAnchorId: "real-local-target-region",
      color: "#ff3b30",
      width: 4,
      points: [
        { x: 0.28, y: 0.66, t: 0, zHint: 0, planeId: "screen" },
        { x: 0.64, y: 0.36, t: 80, zHint: 0, planeId: "screen" }
      ]
    },
    {
      id: "perspective-plane-align",
      mode: "perspective_grid",
      semanticLabel: "align to the target perspective plane",
      targetAnchorId: "real-local-target-region",
      color: "#ff9500",
      width: 4,
      points: [
        { x: 0.34, y: 0.7, t: 0, zHint: 0.05, planeId: "source_plane" },
        { x: 0.7, y: 0.34, t: 90, zHint: 0.16, planeId: "target_perspective_plane" }
      ]
    },
    {
      id: "depth-axis-nearer",
      mode: "depth_axis_3d",
      semanticLabel: "bring the target nearer along depth",
      targetAnchorId: "real-local-target-region",
      color: "#007aff",
      width: 4,
      points: [
        { x: 0.69, y: 0.47, t: 0, zHint: 0.05, planeId: "far_depth" },
        { x: 0.69, y: 0.31, t: 90, zHint: 0.42, planeId: "near_depth" }
      ]
    }
  ],
  spatialIntent: {
    relationships: [
      { subject: "screen-2d-move", relation: "moves_toward", object: "real-local-target-region" },
      { subject: "perspective-plane-align", relation: "perspective_to", object: "real-local-target-region" },
      { subject: "depth-axis-nearer", relation: "nearer_than", object: "real-local-target-region" }
    ],
    perspectiveCues: [
      { strokeId: "perspective-plane-align", cue: "perspective_grid" },
      { strokeId: "depth-axis-nearer", cue: "depth_axis_3d" }
    ],
    inferredTeacherIntent: "review_only: teacher wants a selected target in the real local software view moved into the marked region with perspective/depth preserved"
  },
  locks: {
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    softwareActionsExecuted: false,
    fullContinuousRecording: false
  }
};
overlayPacket.universalDetailLogicContract = {
  format: "transparent_ai_universal_detail_logic_contract_v1",
  principle: "All consequential sketch details must be logicized before execution; visual similarity alone is insufficient.",
  detailLogicScope: [
    "measurable geometry",
    "angular/curvature",
    "pattern/spacing/count",
    "position/alignment/relation",
    "view/depth/perspective",
    "tolerance/fit/clearance",
    "annotation/semantic/standard",
    "material/process/manufacturing",
    "teacher exception/design rule",
    "decorative/non-parametric"
  ],
  requiredClassifications: [
    "data_or_formula_backed",
    "constraint_or_relationship_backed",
    "teacher_exception_or_design_rule",
    "decorative_or_non_parametric",
    "missing_evidence_blocks_execution"
  ],
  consequentialDetailRows: [
    ...overlayPacket.anchors.map((anchor) => ({
      id: `${anchor.id}-region-logic`,
      sourceElementId: anchor.id,
      detailCategory: "position/alignment/relation",
      classification: "constraint_or_relationship_backed",
      logicSource: "teacher marked normalized real-local anchor box",
      teacherReviewRequired: true,
      blocksExecutionIfMissing: true
    })),
    ...overlayPacket.strokes.flatMap((stroke) => [
      {
        id: `${stroke.id}-position-logic`,
        sourceElementId: stroke.id,
        detailCategory: "position/alignment/relation",
        classification: "constraint_or_relationship_backed",
        logicSource: "teacher-provided targetAnchorId plus normalized start/end points",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      },
      {
        id: `${stroke.id}-angle-direction-logic`,
        sourceElementId: stroke.id,
        detailCategory: "angular/curvature",
        classification: "data_or_formula_backed",
        logicSource: "direction vector from first point to last point",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      },
      ...(stroke.mode === "perspective_grid" || stroke.mode === "depth_axis_3d"
        ? [
            {
              id: `${stroke.id}-view-depth-perspective-logic`,
              sourceElementId: stroke.id,
              detailCategory: "view/depth/perspective",
              classification: "constraint_or_relationship_backed",
              logicSource: "stroke mode plus zHint/depth relation",
              teacherReviewRequired: true,
              blocksExecutionIfMissing: true
            }
          ]
        : [])
    ])
  ],
  missingDetailLogicCount: 0,
  missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
  blockedActions: [
    "execute_or_generate_output_that_only_looks_similar_without_detail_logic",
    "treat_line_or_angle_examples_as_complete_scope",
    "generate_any_consequential_detail_without_logic_source"
  ],
  locks: overlayPacket.locks
};

const overlayPath = join(smokeRoot, "real-local-transparent-sketch-packet.json");
writeFileSync(overlayPath, `${JSON.stringify(overlayPacket, null, 2)}\n`, "utf8");

const spatialIntent = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
  "--overlay-packet",
  overlayPath,
  "--output-dir",
  join(smokeRoot, "spatial-intent")
]);
const spatialIntentJson = readJson(spatialIntent.interpretationPath);

const targetConfirmation = runNodeScript("create-spatial-target-confirmation-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--process-name",
  processName,
  "--window-title",
  windowTitle,
  "--overlay-packet",
  overlayPath,
  "--spatial-intent",
  spatialIntent.interpretationPath,
  "--command",
  "Apply the teacher sketch to the marked target, preserving position, perspective, and depth.",
  "--max-candidates",
  "5",
  "--output-dir",
  join(smokeRoot, "target-confirmation")
]);
const targetConfirmationJson = readJson(targetConfirmation.targetConfirmation);

const confirmed = runNodeScript("confirm-engineering-command-target.mjs", [
  "--confirmation",
  targetConfirmation.targetConfirmation,
  "--selected-number",
  "1",
  "--output-dir",
  join(smokeRoot, "confirmed-target")
]);
const confirmationReceipt = readJson(confirmed.receipt);

const controlProfile = runNodeScript("create-software-control-channel-profile.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--process-name",
  processName,
  "--window-title",
  windowTitle,
  "--overlay-packet",
  overlayPath,
  "--spatial-intent",
  spatialIntent.interpretationPath,
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--output-dir",
  join(smokeRoot, "control-channel-profile")
]);
const controlProfileJson = readJson(controlProfile.profilePath);

const routeBridge = runNodeScript("create-spatial-software-execution-route-bridge.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  overlayPath,
  "--spatial-intent",
  spatialIntent.interpretationPath,
  "--target-confirmation",
  targetConfirmation.targetConfirmation,
  "--confirmation-receipt",
  confirmed.receipt,
  "--control-channel-profile",
  controlProfile.profilePath,
  "--selected-number",
  "1",
  "--preferred-adapter",
  controlProfile.primaryAdapterId || "existing-windows-ui-automation",
  "--output-dir",
  join(smokeRoot, "spatial-route")
]);
const routeBridgeJson = readJson(routeBridge.bridgePath);
const routeReceipt = readJson(routeBridge.receiptPath);

const checks = [
  {
    name: "Real local software candidate is discovered before transparent sketch routing",
    pass:
      (providedInventory || inventorySource === "existing_reviewed_inventory_fallback_after_empty_probe" || probe.status === 0) &&
      inventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      Boolean(software),
    evidence: `source=${inventorySource}; liveProbeStatus=${probe.status}; candidates=${inventory?.softwareCandidates?.length ?? 0}; software=${software}; inventory=${inventoryPath}`
  },
  {
    name: "Transparent sketch overlay kit is reused for real local software context",
    pass:
      overlayKit.format === "transparent_ai_transparent_sketch_overlay_kit_result_v1" &&
      existsSync(overlayKit.browserOverlay || overlayKit.files?.browserOverlay || "") &&
      ["read_only_real_local_inventory_probe", "provided_reviewed_inventory", "existing_reviewed_inventory_fallback_after_empty_probe"].includes(
        overlayPacket.targetSoftwareEvidence.source
      ) &&
      overlayPacket.coordinateSpace.supports2D === true &&
      overlayPacket.coordinateSpace.supportsPerspectiveRelationships === true &&
      overlayPacket.coordinateSpace.supports3DDepthHints === true,
    evidence: overlayKit.kitPath || overlayKit.manifestPath || ""
  },
  {
    name: "Spatial interpreter preserves 2D, perspective, and 3D depth relations for real local software",
    pass:
      spatialIntentJson.format === "transparent_ai_spatial_intent_interpretation_v1" &&
      spatialIntentJson.software === software &&
      spatialIntentJson.summary.supports2D === true &&
      spatialIntentJson.coordinateSpace.supportsPerspectiveRelationships === true &&
      spatialIntentJson.summary.perspectiveCueCount >= 1 &&
      spatialIntentJson.summary.supports3DDepthHints === true &&
      spatialIntentJson.inferredRelationships.some((row) => row.relation === "perspective_to") &&
      spatialIntentJson.inferredRelationships.some((row) => row.relation === "nearer_than"),
    evidence: spatialIntent.interpretationPath
  },
  {
    name: "Numbered target confirmation requires one teacher-selected real local spatial target",
    pass:
      targetConfirmationJson.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmationJson.software === software &&
      targetConfirmationJson.candidates.length >= 2 &&
      targetConfirmationJson.spatialEvidenceSummary.supports2D === true &&
      targetConfirmationJson.spatialEvidenceSummary.supportsPerspectiveRelationships === true &&
      targetConfirmationJson.spatialEvidenceSummary.supports3DDepthHints === true &&
      targetConfirmationJson.locks.softwareActionsExecuted === false,
    evidence: targetConfirmation.targetConfirmation
  },
  {
    name: "Confirmed number narrows the real local sketch route to one selected target",
    pass:
      confirmationReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmationReceipt.selectedCandidateNumber === 1 &&
      confirmationReceipt.evidence.selectedTargetOnly === true &&
      confirmationReceipt.evidence.narrowedOverlayAnchorCount === 1 &&
      confirmationReceipt.locks.softwareActionsExecuted === false &&
      confirmationReceipt.locks.nativeUniversalExecution === false,
    evidence: confirmed.receipt
  },
  {
    name: "Control-channel profile ranks existing routes before any real local software execution",
    pass:
      controlProfileJson.format === "transparent_ai_software_control_channel_profile_v1" &&
      controlProfileJson.software === software &&
      controlProfileJson.recommendedRoute.dryRunFirst === true &&
      controlProfileJson.lowTokenPolicy.preferReceiptsBeforeScreenshots === true &&
      controlProfileJson.locks.softwareActionsExecuted === false &&
      controlProfileJson.locks.nativeUniversalExecution === false,
    evidence: controlProfile.profilePath
  },
  {
    name: "Real local confirmed spatial target binds to dry-run route candidates only",
    pass:
      routeBridgeJson.format === "transparent_ai_spatial_software_execution_route_bridge_v1" &&
      routeBridgeJson.software === software &&
      routeBridgeJson.status === "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review" &&
      routeBridgeJson.selectedTarget.selectedTargetOnly === true &&
      routeBridgeJson.routeCandidates.length > 0 &&
      routeBridgeJson.routeCandidates.every((candidateRoute) => candidateRoute.dryRunHandoff?.tool === "create_existing_software_execution_adapter") &&
      routeBridgeJson.routeCandidates.every((candidateRoute) => candidateRoute.verificationHandoff?.tool === "create_post_action_evidence_checkpoint"),
    evidence: routeBridge.bridgePath
  },
  {
    name: "Real local spatial route keeps screenshots, execution, memory, acceptance, and native universal execution locked",
    pass:
      routeReceipt.format === "transparent_ai_spatial_software_execution_route_receipt_v1" &&
      routeReceipt.softwareActionsExecuted === false &&
      routeReceipt.targetSoftwareCommandsExecuted === false &&
      routeReceipt.screenshotsCaptured === false &&
      routeReceipt.fullContinuousRecording === false &&
      routeReceipt.memoryWritten === false &&
      routeReceipt.accepted === false &&
      routeReceipt.ruleEnabled === false &&
      routeReceipt.packagingGated === true &&
      routeReceipt.locks.nativeUniversalExecution === false,
    evidence: routeBridge.receiptPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_spatial_execution_route_smoke_v1",
  smokeRoot,
  realLocalSoftware: { software, processName, windowTitle, inventorySource },
  paths: {
    inventory: inventoryPath,
    liveProbeInventory: liveProbeInventoryPath,
    overlay: overlayPath,
    spatialIntent: spatialIntent.interpretationPath,
    targetConfirmation: targetConfirmation.targetConfirmation,
    confirmationReceipt: confirmed.receipt,
    controlChannelProfile: controlProfile.profilePath,
    routeBridge: routeBridge.bridgePath,
    routeReceipt: routeBridge.receiptPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
