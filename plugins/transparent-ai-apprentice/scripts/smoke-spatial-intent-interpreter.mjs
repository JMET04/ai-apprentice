#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const serverScript = join(__dirname, "mcp-server.mjs");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "spatial-intent-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
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

async function callAdvancedInterpreter(packetPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "interpret_transparent_sketch_spatial_intent",
      arguments: { overlayPacket: packetPath, outputDir: join(smokeRoot, "mcp-interpretation") }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const packet = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "generic 3D layout app",
  goal: "Teacher shows that a block should move inside the target region and closer in depth.",
  overlayMode: "2d_3d",
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true
  },
  anchors: [
    { id: "target-region", type: "teacher_marked_region", label: "destination pocket", box: [0.58, 0.28, 0.76, 0.48] }
  ],
  strokes: [
    {
      id: "tap-first",
      mode: "screen_2d",
      semanticLabel: "click this source object",
      targetAnchorId: "target-region",
      points: [
        { x: 0.24, y: 0.64, t: 0, zHint: 0, planeId: "screen" },
        { x: 0.242, y: 0.642, t: 20, zHint: 0, planeId: "screen" }
      ]
    },
    {
      id: "perspective-move",
      mode: "perspective_grid",
      semanticLabel: "drag into the target perspective plane",
      targetAnchorId: "target-region",
      points: [
        { x: 0.25, y: 0.65, t: 0, zHint: 0.05, planeId: "screen" },
        { x: 0.67, y: 0.38, t: 90, zHint: 0.18, planeId: "perspective_plane" }
      ]
    },
    {
      id: "depth-move",
      mode: "depth_axis_3d",
      semanticLabel: "make it nearer than the old plane",
      targetAnchorId: "target-region",
      points: [
        { x: 0.66, y: 0.46, t: 0, zHint: 0.1, planeId: "old_depth" },
        { x: 0.66, y: 0.32, t: 90, zHint: 0.42, planeId: "near_depth" }
      ]
    }
  ],
  spatialIntent: {
    relationships: [
      { subject: "perspective-move", relation: "inside", object: "target-region" },
      { subject: "depth-move", relation: "nearer_than", object: "target-region" }
    ],
    perspectiveCues: [
      { strokeId: "perspective-move", cue: "perspective_grid" },
      { strokeId: "depth-move", cue: "depth_axis_3d" }
    ]
  }
};

const packetPath = join(smokeRoot, "transparent-sketch-packet.json");
writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

const direct = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
  "--overlay-packet",
  packetPath,
  "--output-dir",
  join(smokeRoot, "direct-interpretation")
]);
const interpretation = JSON.parse(readFileSync(direct.interpretationPath, "utf8"));
const actionKit = runNodeScript("create-supervised-software-action-kit.mjs", [
  "--goal",
  "Compile interpreted 2D, perspective, and depth intent into supervised actions.",
  "--software",
  "generic 3D layout app",
  "--overlay-packet",
  packetPath,
  "--output-dir",
  join(smokeRoot, "direct-action")
]);
const actionPlan = JSON.parse(readFileSync(actionKit.actionPlan, "utf8"));
const advanced = await callAdvancedInterpreter(packetPath);
const advancedNames = advanced.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Spatial interpreter creates a reviewable intent packet from 2D, perspective, and 3D strokes",
    pass:
      direct.format === "transparent_ai_spatial_intent_interpretation_result_v1" &&
      interpretation.format === "transparent_ai_spatial_intent_interpretation_v1" &&
      interpretation.summary?.supports2D === true &&
      interpretation.summary?.supports3DDepthHints === true &&
      interpretation.summary?.perspectiveCueCount === 2 &&
      interpretation.strokeGeometry?.length === 3,
    evidence: direct.interpretationPath
  },
  {
    name: "Spatial interpreter infers relative position, perspective, and depth relationships",
    pass:
      interpretation.inferredRelationships?.some((row) => row.relation === "moves_toward") &&
      interpretation.inferredRelationships?.some((row) => row.relation === "perspective_to") &&
      interpretation.inferredRelationships?.some((row) => row.relation === "nearer_than") &&
      interpretation.suggestedActions?.some((action) => action.kind === "click") &&
      interpretation.suggestedActions?.some((action) => action.kind === "drag"),
    evidence: `relationships=${interpretation.inferredRelationships.map((row) => row.relation).join(",")}`
  },
  {
    name: "Supervised action bridge embeds spatial intent interpretation before dry-run execution",
    pass:
      existsSync(actionKit.spatialIntentInterpretation) &&
      actionPlan.spatialIntentInterpretation?.format === "transparent_ai_spatial_intent_interpretation_v1" &&
      actionPlan.spatialExecutionReadiness?.format === "transparent_ai_spatial_execution_readiness_v1" &&
      actionPlan.spatialExecutionReadiness?.supports2DPosition === true &&
      actionPlan.spatialExecutionReadiness?.supportsPerspectiveRelationships === true &&
      actionPlan.spatialExecutionReadiness?.supports3DDepthHints === true &&
      actionPlan.spatialExecutionReadiness?.actionBinding?.some((row) => row.preservesPerspective === true) &&
      actionPlan.spatialExecutionReadiness?.actionBinding?.some((row) => row.preservesDepth === true) &&
      actionPlan.executionPolicy?.nativeUniversalExecution === false &&
      actionPlan.actions?.some((action) => action.spatialReason?.includes("depth=nearer_than_start")),
    evidence: actionKit.spatialIntentInterpretation
  },
  {
    name: "Supervised action bridge writes preflight and low-token outcome verification templates",
    pass:
      existsSync(actionKit.preflight) &&
      existsSync(actionKit.outcomeVerificationTemplate) &&
      actionKit.writesPreflight === true &&
      actionKit.writesOutcomeVerificationTemplate === true &&
      actionKit.lowTokenPostActionVerification === true &&
      actionPlan.spatialExecutionReadiness?.blockedUntil?.includes("post-action verification plan is ready"),
    evidence: actionKit.outcomeVerificationTemplate
  },
  {
    name: "MCP advanced mode exposes spatial intent interpreter",
    pass:
      advanced.list.mode === "advanced" &&
      advancedNames.includes("interpret_transparent_sketch_spatial_intent") &&
      advanced.result.format === "transparent_ai_spatial_intent_interpretation_result_v1" &&
      advanced.result.nativeUniversalExecution === false,
    evidence: `mode=${advanced.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_spatial_intent_interpreter_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
