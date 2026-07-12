#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "..", "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const outputRoot = existsSync(sourceServerScript) ? repoRoot : resolve(process.cwd());
const serverCwd = existsSync(sourceServerScript) ? repoRoot : outputRoot;
const smokeRoot = join(outputRoot, ".transparent-apprentice", "spatial-execution-route-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(name, payload) {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: serverCwd,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  const pending = new Map();
  let stdoutBuffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolvePromise, rejectPromise) => pending.set(id, { resolve: resolvePromise, reject: rejectPromise }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
  return { rpc, stop };
}

async function callAdvanced(packetPath, confirmationPath, profilePath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_spatial_software_execution_route_bridge",
      arguments: {
        goal: "Route the confirmed depth sketch into the software with a dry-run-first route.",
        software: "generic engineering software",
        overlayPacket: packetPath,
        targetConfirmation: confirmationPath,
        selectedNumber: 2,
        controlChannelProfile: profilePath,
        outputDir: join(smokeRoot, "mcp-route")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefault(packet, confirmation, profile) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Route this transparent 2D/3D spatial sketch to software execution routes after numbered target confirmation.",
        message: "The teacher confirmed target number 2. Bind it to a dry-run execution route for the software, but do not execute.",
        software: "generic engineering software",
        spatialSoftwareExecutionRouteBridge: true,
        overlayPacket: packet,
        targetConfirmation: confirmation,
        selectedNumber: 2,
        controlChannelProfile: profile,
        outputDir: join(smokeRoot, "default-route")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const overlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "generic engineering software",
  goal: "Teacher sketches a 3D depth move into a target pocket.",
  overlayMode: "live_topmost_2d_perspective_3d",
  coordinateSpace: { origin: "top_left", units: "normalized_0_to_1", supports2D: true, supports3DDepthHints: true },
  anchors: [
    { id: "old-part", type: "teacher_marked_region", label: "current part", box: [0.18, 0.56, 0.3, 0.68] },
    { id: "target-pocket", type: "teacher_marked_region", label: "target pocket", box: [0.62, 0.3, 0.79, 0.48] }
  ],
  strokes: [
    {
      id: "move-deeper",
      mode: "depth_axis_3d",
      semanticLabel: "move part into deeper target pocket",
      targetAnchorId: "target-pocket",
      points: [
        { x: 0.24, y: 0.62, zHint: 0.08 },
        { x: 0.7, y: 0.38, zHint: 0.42 }
      ]
    }
  ]
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
      {
        id: `${stroke.id}-view-depth-perspective-logic`,
        sourceElementId: stroke.id,
        detailCategory: "view/depth/perspective",
        classification: "constraint_or_relationship_backed",
        logicSource: "stroke mode plus zHint/depth relation",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      }
    ])
  ],
  missingDetailLogicCount: 0,
  missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
  blockedActions: [
    "execute_or_generate_output_that_only_looks_similar_without_detail_logic",
    "treat_line_or_angle_examples_as_complete_scope",
    "generate_any_consequential_detail_without_logic_source"
  ]
};

const confirmation = {
  format: "transparent_ai_numbered_target_confirmation_v1",
  goal: overlayPacket.goal,
  software: overlayPacket.software,
  candidates: [
    {
      number: 1,
      id: "old-part",
      label: "current part",
      normalizedTarget: { x: 0.24, y: 0.62, zHint: 0.08, coordinateSource: "transparent_overlay_anchor_center" },
      reason: "Teacher marked current part, but this is the source object.",
      teacherReviewRequired: true
    },
    {
      number: 2,
      id: "target-pocket",
      label: "target pocket",
      normalizedTarget: { x: 0.705, y: 0.39, zHint: 0.42, coordinateSource: "spatial_intent_suggested_action" },
      reason: "Teacher stroke moves into this deeper pocket with 3D depth hint.",
      teacherReviewRequired: true
    }
  ],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, softwareActionsExecuted: false }
};

const profile = {
  format: "transparent_ai_software_control_channel_profile_v1",
  goal: overlayPacket.goal,
  software: overlayPacket.software,
  principle: "Prefer reviewed existing control channels before supervised UI automation.",
  channels: [
    {
      adapterId: "existing-file-import-export",
      label: "project file import/export",
      score: 18,
      evidence: ["project exports JSON geometry"],
      requiredEvidenceBeforeExecute: ["save-copy path", "dry-run diff", "schema validation"],
      blockers: ["missing_reviewed_file_import_export_mapping"]
    },
    {
      adapterId: "existing-windows-ui-automation",
      label: "supervised Windows UI fallback",
      score: 10,
      evidence: ["visible target window can receive reviewed click/drag"],
      requiredEvidenceBeforeExecute: ["target window title", "coordinate preflight"],
      blockers: ["missing_target_window_or_low_token_verifier"]
    }
  ],
  recommendedRoute: {
    primaryAdapterId: "existing-file-import-export",
    recommendedAdapters: ["existing-file-import-export", "existing-windows-ui-automation"],
    dryRunFirst: true,
    teacherConfirmationRequired: true
  },
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, softwareActionsExecuted: false }
};

const packetPath = writeJson("overlay-packet.json", overlayPacket);
const missingLogicOverlayPacket = {
  ...overlayPacket,
  universalDetailLogicContract: {
    ...overlayPacket.universalDetailLogicContract,
    consequentialDetailRows: [
      ...overlayPacket.universalDetailLogicContract.consequentialDetailRows,
      {
        id: "unmapped-perspective-angle",
        sourceElementId: "move-deeper",
        detailCategory: "angular/curvature",
        classification: "missing_evidence_blocks_execution",
        logicSource: "teacher has not confirmed whether the apparent angle is data-driven, a perspective artifact, or decorative",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      }
    ],
    missingDetailLogicRows: [
      {
        id: "unmapped-perspective-angle",
        detailCategory: "angular/curvature",
        classification: "missing_evidence_blocks_execution",
        logicSource: "teacher has not confirmed whether the apparent angle is data-driven, a perspective artifact, or decorative",
        blocksExecutionIfMissing: true
      }
    ],
    missingDetailLogicCount: 1
  }
};
const missingLogicPacketPath = writeJson("overlay-packet-missing-detail-logic.json", missingLogicOverlayPacket);
const confirmationPath = writeJson("target-confirmation.json", confirmation);
const profilePath = writeJson("control-channel-profile.json", profile);

const waiting = runNodeScript("create-spatial-software-execution-route-bridge.mjs", [
  "--goal",
  "Route only after number confirmation.",
  "--software",
  "generic engineering software",
  "--overlay-packet",
  packetPath,
  "--target-confirmation",
  confirmationPath,
  "--control-channel-profile",
  profilePath,
  "--output-dir",
  join(smokeRoot, "waiting")
]);

const routed = runNodeScript("create-spatial-software-execution-route-bridge.mjs", [
  "--goal",
  "Route confirmed spatial target into software execution planning.",
  "--software",
  "generic engineering software",
  "--overlay-packet",
  packetPath,
  "--target-confirmation",
  confirmationPath,
  "--selected-number",
  "2",
  "--control-channel-profile",
  profilePath,
  "--output-dir",
  join(smokeRoot, "routed")
]);
const blockedMissingLogic = runNodeScript("create-spatial-software-execution-route-bridge.mjs", [
  "--goal",
  "Block visually similar route until every detail has logic.",
  "--software",
  "generic engineering software",
  "--overlay-packet",
  missingLogicPacketPath,
  "--target-confirmation",
  confirmationPath,
  "--selected-number",
  "2",
  "--control-channel-profile",
  profilePath,
  "--output-dir",
  join(smokeRoot, "blocked-missing-detail-logic")
]);
const bridge = readJson(routed.bridgePath);
const blockedBridge = readJson(blockedMissingLogic.bridgePath);
const routeReceipt = readJson(routed.receiptPath);
const selectedTarget = readJson(routed.selectedTargetPath);
const mcp = await callAdvanced(packetPath, confirmationPath, profilePath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const defaultRoute = await callDefault(overlayPacket, confirmation, profile);

const checks = [
  {
    name: "Bridge blocks route planning until a numbered spatial target is confirmed",
    pass:
      waiting.status === "waiting_for_numbered_spatial_target_confirmation" &&
      waiting.routeCandidateCount === 0 &&
      waiting.reviewLocks.softwareActionsExecuted === false &&
      waiting.reviewLocks.nativeUniversalExecution === false,
    evidence: waiting.bridgePath
  },
  {
    name: "Confirmed spatial target binds exactly one 2D/3D sketch target to execution route candidates",
    pass:
      bridge.format === "transparent_ai_spatial_software_execution_route_bridge_v1" &&
      routed.status === "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review" &&
      selectedTarget.format === "transparent_ai_selected_spatial_execution_target_v1" &&
      selectedTarget.selectedNumber === 2 &&
      selectedTarget.selectedTargetOnly === true &&
      bridge.routeCandidates.length >= 2 &&
      bridge.routeCandidates[0].adapterId === "existing-file-import-export" &&
      bridge.detailLogicGate.ready === true &&
      bridge.detailLogicGate.missingDetailLogicCount === 0,
    evidence: routed.bridgePath
  },
  {
    name: "Bridge blocks visually similar routes when consequential detail logic is missing",
    pass:
      blockedMissingLogic.status === "blocked_missing_detail_logic_before_execution_route" &&
      blockedMissingLogic.detailLogicGateReady === false &&
      blockedMissingLogic.routeCandidateCount === 0 &&
      blockedBridge.detailLogicGate.missingDetailLogicCount === 1 &&
      blockedBridge.blockedActions.includes("create_dry_run_route_with_missing_detail_logic") &&
      blockedBridge.nextTeacherActions.some((action) => action.includes("missingDetailLogicRows")),
    evidence: blockedMissingLogic.bridgePath
  },
  {
    name: "Route candidates hand off to existing dry-run adapter and post-action evidence checkpoint",
    pass:
      bridge.routeCandidates.every((route) => route.dryRunHandoff.tool === "create_existing_software_execution_adapter") &&
      bridge.routeCandidates.every((route) => route.verificationHandoff.tool === "create_post_action_evidence_checkpoint") &&
      bridge.blockedActions.includes("execute_without_dry_run_receipt") &&
      bridge.locks.softwareActionsExecuted === false &&
      bridge.locks.targetSoftwareCommandsExecuted === false &&
      bridge.locks.screenshotsCaptured === false &&
      bridge.locks.memoryWritten === false &&
      bridge.locks.packagingGated === true,
    evidence: routed.receiptPath
  },
  {
    name: "Spatial route bridge hands off to real-local execution approval gate without creating or running it",
    pass:
      bridge.nextExecutionGateHandoff?.format === "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
      bridge.nextExecutionGateHandoff?.objectiveRequirementId === "execute_in_target_software_after_teacher_confirmation" &&
      bridge.nextExecutionGateHandoff?.completionBlockerLane === "universal_native_execution_control_channel" &&
      bridge.nextExecutionGateHandoff?.nextGate === "create_real_local_execution_approval_gate" &&
      bridge.nextExecutionGateHandoff?.prerequisiteGate === "create_real_local_execution_pilot_selector" &&
      bridge.nextExecutionGateHandoff?.nextGateAfterReadyGate === "create_all_software_execution_approved_gate_command_builder" &&
      bridge.nextExecutionGateHandoff?.finalRunnerGate === "run_all_software_execution_approved_gate_runner" &&
      bridge.nextExecutionGateHandoff?.readyForExecutionApprovalGatePrep === true &&
      bridge.nextExecutionGateHandoff?.returnToCompletionBlockerMatrixAfterNextGate === true &&
      bridge.nextExecutionGateHandoff?.requiredEvidenceBeforeManualUse.includes("retained rollback point for this execute attempt") &&
      bridge.nextExecutionGateHandoff?.blockedActions.includes("run_approved_gate_runner_from_route_bridge") &&
      bridge.nextExecutionGateHandoff?.locks.routeBridgeDoesNotCreateApprovalGate === true &&
      bridge.nextExecutionGateHandoff?.locks.routeBridgeDoesNotRunApprovedGateRunner === true &&
      bridge.nextExecutionGateHandoff?.locks.routeBridgeDoesNotInvokeAdapter === true &&
      routeReceipt.nextExecutionGateHandoffFormat === "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
      routeReceipt.nextExecutionGate === "create_real_local_execution_approval_gate" &&
      routeReceipt.nextExecutionGateReadyForApprovalPrep === true &&
      routeReceipt.routeBridgeDoesNotCreateApprovalGate === true &&
      routeReceipt.routeBridgeDoesNotRunApprovedGateRunner === true &&
      routed.nextExecutionGateHandoffFormat === "transparent_ai_spatial_route_to_execution_approval_handoff_v1" &&
      routed.nextExecutionGate === "create_real_local_execution_approval_gate" &&
      routed.nextExecutionGateAfterReadyGate === "create_all_software_execution_approved_gate_command_builder" &&
      routed.finalRunnerGate === "run_all_software_execution_approved_gate_runner" &&
      routed.routeBridgeDoesNotCreateApprovalGate === true &&
      routed.routeBridgeDoesNotRunApprovedGateRunner === true,
    evidence: routed.bridgePath
  },
  {
    name: "MCP advanced exposes and runs spatial software execution route bridge",
    pass:
      advancedNames.includes("create_spatial_software_execution_route_bridge") &&
      mcp.result.format === "transparent_ai_spatial_software_execution_route_bridge_result_v1" &&
      mcp.result.routeCandidateCount >= 2 &&
      mcp.result.detailLogicGateReady === true &&
      mcp.result.nextExecutionGate === "create_real_local_execution_approval_gate" &&
      mcp.result.routeBridgeDoesNotRunApprovedGateRunner === true &&
      mcp.result.softwareActionsExecuted === false,
    evidence: mcp.result.bridgePath
  },
  {
    name: "Default teach_apprentice routes explicit spatial execution route requests to the bridge card",
    pass:
      defaultRoute.status === "waiting_for_spatial_execution_route_review" &&
      defaultRoute.spatialSoftwareExecutionRouteBridge?.routeCandidateCount >= 2 &&
      defaultRoute.spatialSoftwareExecutionRouteBridge?.nextBridge === "create_existing_software_execution_adapter" &&
      defaultRoute.spatialSoftwareExecutionRouteBridge?.nextExecutionApprovalGate === "create_real_local_execution_approval_gate" &&
      defaultRoute.spatialSoftwareExecutionRouteBridge?.nextApprovedGateCommandBuilder === "create_all_software_execution_approved_gate_command_builder" &&
      defaultRoute.spatialSoftwareExecutionRouteBridge?.finalRunnerGate === "run_all_software_execution_approved_gate_runner" &&
      defaultRoute.spatialSoftwareExecutionRouteBridge?.routeBridgeDoesNotRunApprovedGateRunner === true &&
      defaultRoute.spatialSoftwareExecutionRouteBridge?.nextVerificationBridge === "create_post_action_evidence_checkpoint" &&
      defaultRoute.reviewLocks.packagingGated === true,
    evidence: defaultRoute.spatialSoftwareExecutionRouteBridge?.bridgePath || ""
  },
  {
    name: "Route receipt keeps execution, recording, memory, acceptance, and packaging locks closed",
    pass:
      routeReceipt.format === "transparent_ai_spatial_software_execution_route_receipt_v1" &&
      routeReceipt.selectedTargetOnly === true &&
      routeReceipt.softwareActionsExecuted === false &&
      routeReceipt.targetSoftwareCommandsExecuted === false &&
      routeReceipt.screenshotsCaptured === false &&
      routeReceipt.fullContinuousRecording === false &&
      routeReceipt.memoryWritten === false &&
      routeReceipt.accepted === false &&
      routeReceipt.ruleEnabled === false &&
      routeReceipt.packagingGated === true,
    evidence: routed.receiptPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  format: "transparent_ai_spatial_software_execution_route_bridge_smoke_v1",
  smokeRoot,
  checks,
  passed: checks.length - failed.length,
  total: checks.length,
  status: failed.length === 0 ? "passed" : "failed"
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
