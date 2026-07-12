#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
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
    join(repoRoot, ".transparent-apprentice", "existing-drawing-spatial-controlled-execution-smoke", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "existing-drawing-spatial-controlled-execution", id)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create an existing drawing spatial controlled execution smoke directory.");
}

const smokeRoot = makeSmokeRoot(argValue("--output-dir", argValue("--out-dir", "")));

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = repoRoot) {
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runRunner(runnerPath, extraArgs = []) {
  const extension = extname(runnerPath).toLowerCase();
  if (extension === ".ps1") return runPowerShell(["-File", runnerPath, ...extraArgs]);
  if (extension === ".mjs" || extension === ".js") {
    return spawnSync(process.execPath, [runnerPath, ...extraArgs], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 120000
    });
  }
  throw new Error(`Unsupported runner type: ${runnerPath}`);
}

function includesTargetText(candidate) {
  return /target|pocket|destination|deeper|depth/i.test(
    `${candidate.id || ""} ${candidate.label || ""} ${candidate.reason || ""}`
  );
}

const goal =
  "Let a teacher use existing drawing tools and a transparent 2D perspective 3D sketch to show where engineering software should act, then execute only a reviewed controlled route.";
const software = "generic engineering software";

const drawingTemplate = runNodeScript("create-visual-teaching-template.mjs", [
  "--goal",
  goal,
  "--tool",
  "draw.io, Excalidraw, or Mermaid",
  "--future-input",
  "Replay the same 2D perspective 3D depth move on another software view.",
  "--output-dir",
  join(smokeRoot, "existing-drawing-templates")
]);

const overlayKit = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--mode",
  "live_topmost_2d_perspective_3d",
  "--output-dir",
  join(smokeRoot, "transparent-overlay-kit")
]);

const overlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software,
  goal,
  overlayMode: "existing_drawing_plus_transparent_mask_2d_perspective_3d",
  sourceExistingDrawingTools: {
    drawio: drawingTemplate.files.drawio,
    excalidraw: drawingTemplate.files.excalidraw,
    mermaid: drawingTemplate.files.mermaid,
    transparentOverlayHtml: overlayKit.files?.browserOverlay || overlayKit.browserOverlay || "",
    transparentOverlayPowerShell: overlayKit.files?.powershellOverlay || overlayKit.powershellOverlay || ""
  },
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true,
    supportsPerspectiveRelationships: true
  },
  anchors: [
    { id: "source-part", type: "teacher_marked_region", label: "source part", box: [0.18, 0.58, 0.31, 0.7] },
    { id: "target-pocket", type: "teacher_marked_region", label: "target pocket deeper plane", box: [0.62, 0.28, 0.8, 0.48] }
  ],
  strokes: [
    {
      id: "source-click",
      mode: "screen_2d",
      semanticLabel: "select source part first",
      targetAnchorId: "source-part",
      points: [
        { x: 0.245, y: 0.64, t: 0, zHint: 0.02, planeId: "screen" },
        { x: 0.248, y: 0.642, t: 20, zHint: 0.02, planeId: "screen" }
      ]
    },
    {
      id: "perspective-drag-to-pocket",
      mode: "perspective_grid",
      semanticLabel: "drag source part into target pocket perspective plane",
      targetAnchorId: "target-pocket",
      points: [
        { x: 0.25, y: 0.64, t: 0, zHint: 0.04, planeId: "screen" },
        { x: 0.71, y: 0.39, t: 100, zHint: 0.2, planeId: "perspective_plane" }
      ]
    },
    {
      id: "depth-axis-nearer",
      mode: "depth_axis_3d",
      semanticLabel: "bring selected part nearer on the depth axis after it reaches the pocket",
      targetAnchorId: "target-pocket",
      points: [
        { x: 0.71, y: 0.48, t: 0, zHint: 0.12, planeId: "old_depth" },
        { x: 0.71, y: 0.3, t: 90, zHint: 0.46, planeId: "near_depth" }
      ]
    }
  ],
  spatialIntent: {
    relationships: [
      { subject: "perspective-drag-to-pocket", relation: "inside", object: "target-pocket" },
      { subject: "perspective-drag-to-pocket", relation: "perspective_to", object: "target-pocket" },
      { subject: "depth-axis-nearer", relation: "nearer_than", object: "source-part" }
    ],
    perspectiveCues: [
      { strokeId: "perspective-drag-to-pocket", cue: "perspective_grid" },
      { strokeId: "depth-axis-nearer", cue: "depth_axis_3d" }
    ],
    inferredTeacherIntent:
      "review_only: teacher used existing drawing files plus a transparent overlay to show a 2D source selection, perspective move, and 3D depth adjustment before execution"
  },
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    softwareActionsExecuted: false
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
      logicSource: "teacher marked normalized anchor box",
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
const overlayPacketPath = join(smokeRoot, "existing-drawing-transparent-sketch-packet.json");
writeFileSync(overlayPacketPath, `${JSON.stringify(overlayPacket, null, 2)}\n`, "utf8");

const interpretation = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
  "--overlay-packet",
  overlayPacketPath,
  "--output-dir",
  join(smokeRoot, "spatial-interpretation")
]);
const interpretationJson = readJson(interpretation.interpretationPath);

const spatialTarget = runNodeScript("create-spatial-target-confirmation-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  overlayPacketPath,
  "--spatial-intent",
  interpretation.interpretationPath,
  "--command",
  "Move the source part into the target pocket and bring it nearer in depth.",
  "--max-candidates",
  "6",
  "--output-dir",
  join(smokeRoot, "spatial-target-confirmation")
]);
const targetConfirmation = readJson(spatialTarget.targetConfirmation);
const selectedCandidate =
  targetConfirmation.candidates.find((candidate) => /target|pocket|destination|deeper/i.test(`${candidate.id || ""} ${candidate.label || ""}`)) ||
  targetConfirmation.candidates.find((candidate) => includesTargetText(candidate)) ||
  targetConfirmation.candidates[0];
if (!selectedCandidate?.number) throw new Error("No numbered target candidate was generated from the drawing sketch.");

const capabilityProfilePath = join(smokeRoot, "drawing-controlled-cli-capability-profile.json");
writeFileSync(
  capabilityProfilePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_control_channel_profile_v1",
      goal,
      software,
      principle: "Prefer reviewed existing control channels before supervised UI automation.",
      channels: [
        {
          adapterId: "existing-cli-or-script",
          label: "teacher-reviewed script route for drawing-derived command",
          score: 30,
          evidence: ["reviewed drawing packet", "numbered target confirmation", "hash-checked reviewed script"],
          requiredEvidenceBeforeExecute: ["reviewed command manifest", "script sha256", "post-action file checkpoint"],
          blockers: []
        },
        {
          adapterId: "existing-windows-ui-automation",
          label: "supervised Windows UI fallback",
          score: 8,
          evidence: ["transparent overlay coordinates can become reviewed UI preflight"],
          requiredEvidenceBeforeExecute: ["target window title", "coordinate preflight"],
          blockers: ["missing_target_window_or_low_token_verifier"]
        }
      ],
      recommendedRoute: {
        primaryAdapterId: "existing-cli-or-script",
        recommendedAdapters: ["existing-cli-or-script", "existing-windows-ui-automation"],
        dryRunFirst: true,
        teacherConfirmationRequired: true
      },
      locks: { accepted: false, ruleEnabled: false, packagingGated: true, softwareActionsExecuted: false, nativeUniversalExecution: false }
    },
    null,
    2
  ),
  "utf8"
);

const confirmed = runNodeScript("confirm-engineering-command-target.mjs", [
  "--confirmation",
  spatialTarget.targetConfirmation,
  "--selected-number",
  String(selectedCandidate.number),
  "--goal",
  goal,
  "--software",
  software,
  "--create-action-kit",
  "--create-execution-adapter",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--capability-profile",
  capabilityProfilePath,
  "--output-dir",
  join(smokeRoot, "confirmed-spatial-target"),
  "--action-output-dir",
  join(smokeRoot, "confirmed-spatial-target", "supervised-action-kits"),
  "--execution-adapter-output-dir",
  join(smokeRoot, "confirmed-spatial-target", "execution-adapter-selections")
]);
const confirmationReceipt = readJson(confirmed.receipt);
const actionManifest = readJson(confirmed.supervisedActionKit);
const actionPlan = readJson(actionManifest.files.actionPlan);
const spatialExecutionReadiness = readJson(actionManifest.files.spatialExecutionReadiness);
const executionPackage = readJson(confirmed.existingExecutionPackage);
const cliRunner = executionPackage.runnerEntries.find((entry) => entry.adapterId === "existing-cli-or-script");
if (!cliRunner?.runnerPath) throw new Error("Missing controlled CLI runner for drawing-derived spatial target.");

const routeBridge = runNodeScript("create-spatial-software-execution-route-bridge.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  overlayPacketPath,
  "--spatial-intent",
  interpretation.interpretationPath,
  "--target-confirmation",
  spatialTarget.targetConfirmation,
  "--selected-number",
  String(selectedCandidate.number),
  "--control-channel-profile",
  capabilityProfilePath,
  "--preferred-adapter",
  "existing-cli-or-script",
  "--output-dir",
  join(smokeRoot, "spatial-route-bridge")
]);
const routeBridgeJson = readJson(routeBridge.bridgePath);

const dryRun = runRunner(cliRunner.runnerPath);
if (dryRun.status !== 0) throw new Error(dryRun.stderr || dryRun.stdout || "drawing-derived CLI dry-run failed");
const dryRunReceipt = readJson(cliRunner.receiptPath);

const reviewedScriptPath = join(smokeRoot, "teacher-reviewed-drawing-spatial-command.mjs");
writeFileSync(
  reviewedScriptPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "if (!outputPath) process.exit(2);",
    "writeFileSync(outputPath, JSON.stringify({",
    "  ok: true,",
    "  route: 'existing-cli-or-script',",
    "  action: 'teacher-reviewed-drawing-spatial-controlled-command',",
    `  selectedNumber: ${Number(selectedCandidate.number)},`,
    "  preserves2D: true,",
    "  preservesPerspective: true,",
    "  preservesDepth: true,",
    "  controlledOutputOnly: true",
    "}, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);
const targetOutputFileName = "teacher-reviewed-drawing-spatial-command-output.json";
const reviewedCommandPath = join(smokeRoot, "reviewed-drawing-spatial-cli-command.json");
writeFileSync(
  reviewedCommandPath,
  JSON.stringify(
    {
      format: "transparent_ai_reviewed_cli_command_manifest_v1",
      teacherReviewed: true,
      commandKind: "node-script",
      scriptSourceFile: reviewedScriptPath,
      targetOutputFileName,
      expectedScriptSha256: sha256(reviewedScriptPath),
      rollbackRequired: true,
      sourceDrawingTemplates: drawingTemplate.files,
      sourceTransparentOverlayPacket: overlayPacketPath,
      sourceSpatialTargetConfirmation: spatialTarget.targetConfirmation,
      selectedCandidateNumber: selectedCandidate.number
    },
    null,
    2
  ),
  "utf8"
);

const executionPackageDir = dirname(cliRunner.runnerPath);
const expectedOutputPath = join(executionPackageDir, "cli-output", targetOutputFileName);
const dryRunOutputAbsent = !existsSync(expectedOutputPath);
const before = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--phase",
  "before",
  "--goal",
  goal,
  "--software",
  software,
  "--file",
  expectedOutputPath,
  "--output-dir",
  join(smokeRoot, "post-action-before")
]);

const executeRun = runRunner(cliRunner.runnerPath, ["-TeacherConfirmed", "-Execute", "-ReviewedCommand", reviewedCommandPath]);
if (executeRun.status !== 0) throw new Error(executeRun.stderr || executeRun.stdout || "drawing-derived controlled CLI execute failed");
const executeReceipt = readJson(cliRunner.receiptPath);
const controlledOutput = executeReceipt.cliOutputPath ? readJson(executeReceipt.cliOutputPath) : null;

const outcome = runNodeScript("verify-supervised-action-outcome.mjs", [
  "--receipt",
  cliRunner.receiptPath,
  "--output-dir",
  join(smokeRoot, "outcome-verification")
]);
const outcomeJson = readJson(outcome.verificationPath);

const checkpoint = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--receipt",
  cliRunner.receiptPath,
  "--before-state",
  before.statePath,
  "--file",
  expectedOutputPath,
  "--output-dir",
  join(smokeRoot, "post-action-after")
]);
const checkpointJson = readJson(checkpoint.checkpointPath);

const outputInsidePackage =
  Boolean(executeReceipt.cliOutputPath) &&
  resolve(executeReceipt.cliOutputPath).startsWith(resolve(executionPackageDir));

const checks = [
  {
    name: "Existing drawing templates and transparent overlay kit are reused before execution",
    pass:
      drawingTemplate.format === "transparent_ai_visual_teaching_template_result_v1" &&
      existsSync(drawingTemplate.files.drawio) &&
      existsSync(drawingTemplate.files.excalidraw) &&
      existsSync(drawingTemplate.files.mermaid) &&
      overlayKit.format === "transparent_ai_transparent_sketch_overlay_kit_result_v1" &&
      existsSync(overlayKit.files?.browserOverlay || overlayKit.browserOverlay) &&
      existsSync(overlayKit.files?.powershellOverlay || overlayKit.powershellOverlay),
    evidence: `drawio=${drawingTemplate.files.drawio}; overlay=${overlayKit.files?.browserOverlay || overlayKit.browserOverlay}`
  },
  {
    name: "Teacher drawing packet preserves 2D position, perspective, and 3D depth evidence",
    pass:
      overlayPacket.format === "transparent_ai_sketch_overlay_packet_v1" &&
      overlayPacket.sourceExistingDrawingTools.drawio === drawingTemplate.files.drawio &&
      overlayPacket.coordinateSpace.supports2D === true &&
      overlayPacket.coordinateSpace.supportsPerspectiveRelationships === true &&
      overlayPacket.coordinateSpace.supports3DDepthHints === true &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "screen_2d") &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "perspective_grid") &&
      overlayPacket.strokes.some((stroke) => stroke.mode === "depth_axis_3d"),
    evidence: overlayPacketPath
  },
  {
    name: "Spatial interpreter reads drawing-derived 2D perspective and depth intent before execution",
    pass:
      interpretationJson.format === "transparent_ai_spatial_intent_interpretation_v1" &&
      interpretationJson.summary.supports2D === true &&
      interpretationJson.summary.supports3DDepthHints === true &&
      interpretationJson.summary.perspectiveCueCount >= 2 &&
      interpretationJson.inferredRelationships.some((row) => row.relation === "perspective_to") &&
      interpretationJson.inferredRelationships.some((row) => row.relation === "nearer_than"),
    evidence: interpretation.interpretationPath
  },
  {
    name: "Drawing-derived spatial target is numbered and teacher-confirmed before route selection",
    pass:
      targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      targetConfirmation.candidates.length >= 2 &&
      confirmationReceipt.format === "transparent_ai_engineering_command_target_confirmation_receipt_v1" &&
      confirmationReceipt.selectedCandidateNumber === selectedCandidate.number &&
      confirmationReceipt.evidence.selectedTargetOnly === true &&
      confirmationReceipt.evidence.narrowedOverlayAnchorCount === 1,
    evidence: confirmed.receipt
  },
  {
    name: "Confirmed drawing target creates action readiness and dry-run-first execution routes",
    pass:
      actionManifest.format === "transparent_ai_supervised_software_action_kit_v1" &&
      actionPlan.format === "transparent_ai_supervised_software_action_plan_v1" &&
      spatialExecutionReadiness.format === "transparent_ai_spatial_execution_readiness_v1" &&
      spatialExecutionReadiness.supports2DPosition === true &&
      actionPlan.executionPolicy.nativeUniversalExecution === false &&
      executionPackage.format === "transparent_ai_existing_software_execution_package_v1" &&
      cliRunner.adapterId === "existing-cli-or-script" &&
      cliRunner.defaultMode === "dry_run" &&
      routeBridgeJson.format === "transparent_ai_spatial_software_execution_route_bridge_v1" &&
      routeBridgeJson.inputEvidence.spatialIntentFormat === "transparent_ai_spatial_intent_interpretation_v1" &&
      routeBridgeJson.routeCandidates.some((route) => route.adapterId === "existing-cli-or-script"),
    evidence: confirmed.existingExecutionPackage
  },
  {
    name: "Dry-run drawing-controlled execution writes no output and executes no command",
    pass:
      dryRunReceipt.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      dryRunReceipt.status === "dry_run_no_command_executed" &&
      dryRunReceipt.commandExecuted === false &&
      dryRunOutputAbsent &&
      dryRunReceipt.locks.nativeUniversalExecution === false,
    evidence: cliRunner.receiptPath
  },
  {
    name: "Teacher-confirmed drawing-controlled CLI route writes only inside the execution package",
    pass:
      executeReceipt.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      executeReceipt.status === "teacher_confirmed_cli_script_executed" &&
      executeReceipt.commandExecuted === true &&
      executeReceipt.teacherConfirmed === true &&
      executeReceipt.execute === true &&
      outputInsidePackage &&
      controlledOutput?.action === "teacher-reviewed-drawing-spatial-controlled-command" &&
      controlledOutput?.preserves2D === true &&
      controlledOutput?.preservesPerspective === true &&
      controlledOutput?.preservesDepth === true &&
      executeReceipt.locks.accepted === false,
    evidence: executeReceipt.cliOutputPath
  },
  {
    name: "Drawing-controlled execution receipt flows into outcome verification and post-action checkpoint",
    pass:
      outcomeJson.format === "transparent_ai_supervised_action_outcome_verification_v1" &&
      outcomeJson.receiptFamily === "existing_software_execution" &&
      outcomeJson.result.status === "execution_receipt_waiting_for_teacher_review" &&
      checkpointJson.format === "transparent_ai_post_action_low_token_evidence_checkpoint_v1" &&
      checkpointJson.result.status === "post_action_changed_waiting_for_teacher_review" &&
      checkpointJson.stateComparison.changedItemCount >= 1 &&
      checkpointJson.locks.screenshotsCaptured === false &&
      checkpointJson.locks.memoryWritten === false,
    evidence: `${outcome.verificationPath}; ${checkpoint.checkpointPath}`
  },
  {
    name: "Drawing spatial controlled execution keeps screenshots, memory, acceptance, packaging, and native universal execution locked",
    pass:
      overlayPacket.locks.nativeUniversalExecution === false &&
      confirmationReceipt.locks.nativeUniversalExecution === false &&
      routeBridgeJson.locks.nativeUniversalExecution === false &&
      executeReceipt.locks.nativeUniversalExecution === false &&
      outcomeJson.locks.nativeUniversalExecution === false &&
      checkpointJson.locks.nativeUniversalExecution === false &&
      checkpointJson.locks.ruleEnabled === false &&
      checkpointJson.locks.packagingGated === true,
    evidence: JSON.stringify({ overlay: overlayPacket.locks, receipt: executeReceipt.locks, checkpoint: checkpointJson.locks })
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_existing_drawing_spatial_controlled_execution_smoke_v1",
  smokeRoot,
  selectedCandidateNumber: selectedCandidate.number,
  paths: {
    drawingTemplateManifest: drawingTemplate.manifestPath,
    transparentOverlayManifest: overlayKit.manifestPath,
    overlayPacket: overlayPacketPath,
    spatialInterpretation: interpretation.interpretationPath,
    targetConfirmation: spatialTarget.targetConfirmation,
    confirmedTargetReceipt: confirmed.receipt,
    actionKit: confirmed.supervisedActionKit,
    executionPackage: confirmed.existingExecutionPackage,
    routeBridge: routeBridge.bridgePath,
    dryRunReceipt: cliRunner.receiptPath,
    reviewedCommand: reviewedCommandPath,
    executeReceipt: cliRunner.receiptPath,
    controlledOutput: executeReceipt.cliOutputPath,
    outcomeVerification: outcome.verificationPath,
    postActionCheckpoint: checkpoint.checkpointPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
