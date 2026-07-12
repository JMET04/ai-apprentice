#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

function makeSmokeRoot() {
  const id = String(Date.now());
  const candidates = [
    join(outputRoot, ".transparent-apprentice", "spatial-target-confirmation-smoke", id),
    join(tmpdir(), "transparent-ai-apprentice-smoke", "spatial-target-confirmation", id)
  ];
  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next bounded smoke directory.
    }
  }
  throw new Error("Unable to create a spatial target confirmation smoke directory.");
}

const smokeRoot = makeSmokeRoot();

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

async function callAdvancedSpatialTarget(packetPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_spatial_target_confirmation_kit",
      arguments: {
        goal: "Use the teacher sketch to choose a target before execution.",
        software: "generic engineering software",
        overlayPacket: packetPath,
        command: "Move the selected part into the pocket and closer in depth.",
        maxCandidates: 5,
        outputDir: join(smokeRoot, "mcp-spatial-target")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachApprentice(packet) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Confirm a transparent sketch spatial target with numbered candidates before execution.",
        message: "Use this transparent overlay spatial intent, mark possible positions with numbers, and wait for my confirmation of exactly one number.",
        software: "generic engineering software",
        spatialTargetConfirmation: true,
        overlayPacket: packet,
        maxCandidates: 5,
        outputDir: join(smokeRoot, "default-spatial-target")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const packet = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "generic engineering software",
  goal: "Teacher sketches a target pocket and a depth move before software execution.",
  overlayMode: "live_topmost_2d_perspective_3d",
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true
  },
  anchors: [
    { id: "target-pocket", type: "teacher_marked_region", label: "target pocket", box: [0.6, 0.28, 0.78, 0.5] }
  ],
  strokes: [
    {
      id: "move-into-pocket",
      mode: "perspective_grid",
      semanticLabel: "drag part into pocket plane",
      targetAnchorId: "target-pocket",
      points: [
        { x: 0.26, y: 0.66, t: 0, zHint: 0.05, planeId: "screen" },
        { x: 0.68, y: 0.38, t: 90, zHint: 0.18, planeId: "perspective_plane" }
      ]
    },
    {
      id: "bring-nearer",
      mode: "depth_axis_3d",
      semanticLabel: "make part nearer",
      targetAnchorId: "target-pocket",
      points: [
        { x: 0.68, y: 0.48, t: 0, zHint: 0.1, planeId: "old_depth" },
        { x: 0.68, y: 0.32, t: 90, zHint: 0.44, planeId: "near_depth" }
      ]
    }
  ],
  spatialIntent: {
    relationships: [
      { subject: "move-into-pocket", relation: "inside", object: "target-pocket" },
      { subject: "bring-nearer", relation: "nearer_than", object: "target-pocket" }
    ],
    perspectiveCues: [
      { strokeId: "move-into-pocket", cue: "perspective_grid" },
      { strokeId: "bring-nearer", cue: "depth_axis_3d" }
    ]
  }
};

const packetPath = join(smokeRoot, "transparent-sketch-packet.json");
writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

const direct = runNodeScript("create-spatial-target-confirmation-kit.mjs", [
  "--goal",
  "Convert teacher sketch into numbered target candidates before execution.",
  "--software",
  "generic engineering software",
  "--overlay-packet",
  packetPath,
  "--command",
  "Move the selected part into the pocket and closer in depth.",
  "--max-candidates",
  "5",
  "--output-dir",
  join(smokeRoot, "direct")
]);
const confirmation = readJson(direct.targetConfirmation);
const numberedOverlay = readJson(direct.overlayPacket);
const workflow = readJson(direct.spatialNumberedTargetWorkflow);
const confirmed = runNodeScript("confirm-engineering-command-target.mjs", [
  "--confirmation",
  direct.targetConfirmation,
  "--selected-number",
  "1",
  "--create-action-kit",
  "--create-execution-adapter",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--output-dir",
  join(smokeRoot, "confirmed")
]);
const confirmedOverlay = readJson(confirmed.narrowedOverlayPacket);
const actionManifest = readJson(confirmed.supervisedActionKit);
const adapterSelection = readJson(confirmed.existingExecutionAdapterSelection);
const mcp = await callAdvancedSpatialTarget(packetPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const defaultRoute = await callDefaultTeachApprentice(packet);

const checks = [
  {
    name: "Spatial target bridge derives numbered candidates from transparent overlay and spatial intent",
    pass:
      direct.format === "transparent_ai_spatial_target_confirmation_kit_result_v1" &&
      confirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      confirmation.candidates.length >= 2 &&
      confirmation.candidates.every((candidate, index) => candidate.number === index + 1) &&
      confirmation.spatialEvidenceSummary.supports2D === true &&
      confirmation.spatialEvidenceSummary.supportsPerspectiveRelationships === true &&
      confirmation.spatialEvidenceSummary.supports3DDepthHints === true,
    evidence: direct.targetConfirmation
  },
  {
    name: "Spatial target bridge writes a numbered overlay compatible with the existing confirmation bridge",
    pass:
      workflow.format === "transparent_ai_spatial_numbered_target_confirmation_workflow_v1" &&
      workflow.workflow.some((step) => step.id === "derive_numbered_spatial_candidates") &&
      numberedOverlay.overlayMode === "spatial_intent_numbered_target_confirmation" &&
      numberedOverlay.anchors.every((anchor) => anchor.type === "numbered_spatial_teacher_confirmation_candidate") &&
      numberedOverlay.spatialIntent.relationships.every((row) => row.relation === "candidate_target_for") &&
      direct.nextConfirmationBridge === "confirm_engineering_command_target",
    evidence: direct.overlayPacket
  },
  {
    name: "Confirmed spatial target reuses the single-target action and existing-adapter path",
    pass:
      confirmed.format === "transparent_ai_engineering_command_target_confirmation_result_v1" &&
      confirmed.selectedTargetOnly === true &&
      confirmedOverlay.anchors.length === 1 &&
      actionManifest.format === "transparent_ai_supervised_software_action_kit_v1" &&
      adapterSelection.format === "transparent_ai_existing_software_execution_adapter_selection_v1" &&
      adapterSelection.locks.noAutonomousExecution === true &&
      adapterSelection.locks.nativeUniversalExecution === false,
    evidence: confirmed.receipt
  },
  {
    name: "MCP advanced mode exposes and runs spatial target confirmation",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_spatial_target_confirmation_kit") &&
      mcp.result.format === "transparent_ai_spatial_target_confirmation_kit_result_v1" &&
      mcp.result.teacherConfirmationRequired === true &&
      mcp.result.softwareActionsExecuted === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes transparent sketch numbered-target requests to the spatial confirmation bridge",
    pass:
      defaultRoute.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultRoute.status === "waiting_for_spatial_target_number_confirmation" &&
      defaultRoute.spatialTargetConfirmationKit?.candidateCount >= 2 &&
      defaultRoute.spatialTargetConfirmationKit?.nextConfirmationBridge === "confirm_engineering_command_target" &&
      defaultRoute.spatialTargetConfirmationKit?.softwareActionsExecuted === false &&
      defaultRoute.spatialTargetConfirmationKit?.nativeUniversalExecution === false,
    evidence: `status=${defaultRoute.status}; candidates=${defaultRoute.spatialTargetConfirmationKit?.candidateCount ?? 0}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_spatial_target_confirmation_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
