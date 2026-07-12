#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const runsFromSourceTree = existsSync(sourceServerScript);
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;
const smokeRoot = runsFromSourceTree
  ? join(repoRoot, ".transparent-apprentice", "teach-execute-action-rehearsal-smoke", String(Date.now()))
  : join(process.env.TEMP || process.env.TMP || repoRoot, "transparent-ai-apprentice-cache-smoke", ".transparent-apprentice", "teach-execute-action-rehearsal-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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

async function callAdvanced(reviewedObservationPath, overlayPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "start_teach_execute_action_rehearsal",
      arguments: {
        reviewedObservation: reviewedObservationPath,
        overlayPacket: overlayPath,
        goal: "Action rehearsal from reviewed all-software observation and teacher depth sketch.",
        software: "generic design app",
        teacherConfirmation: "teacher confirmed action rehearsal",
        preferredAdapter: "existing-windows-ui-automation",
        outputDir: join(smokeRoot, "mcp-action-rehearsal")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefault(reviewedObservationPath, overlayPacket) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Start action rehearsal: compile overlay to action from reviewed observation before execution.",
        message: `teacher confirmed action rehearsal\n${reviewedObservationPath}`,
        reviewedObservation: reviewedObservationPath,
        overlayPacket: JSON.stringify(overlayPacket),
        software: "generic design app",
        preferredAdapter: "existing-windows-ui-automation",
        outputDir: join(smokeRoot, "default-action-rehearsal")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const reviewedObservation = {
  format: "transparent_ai_teach_execute_reviewed_observation_v1",
  observationId: "smoke-reviewed-observation",
  status: "waiting_for_teacher_observation_review",
  goal: "Observe a generic design app before acting.",
  software: "generic design app",
  evidence: { queuePath: "" },
  locks: {
    softwareActionsExecuted: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
};
const overlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "generic design app",
  goal: "Teacher draws where to click and drag in a 3D plane.",
  overlayMode: "2d_3d",
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true
  },
  anchors: [{ id: "target-plane", type: "teacher_marked_region", label: "target plane", box: [0.58, 0.28, 0.78, 0.5] }],
  strokes: [
    {
      id: "tap-target",
      mode: "screen_2d",
      semanticLabel: "click the marked target",
      points: [
        { x: 0.66, y: 0.36, t: 0, zHint: 0 },
        { x: 0.662, y: 0.361, t: 20, zHint: 0 }
      ]
    },
    {
      id: "depth-drag",
      mode: "depth_axis_3d",
      semanticLabel: "drag object forward into the nearer target plane",
      points: [
        { x: 0.2, y: 0.72, t: 0, zHint: 0.05 },
        { x: 0.68, y: 0.38, t: 100, zHint: 0.42 }
      ]
    }
  ],
  spatialIntent: {
    relationships: [{ subject: "depth-drag", relation: "nearer_than", object: "target-plane" }],
    perspectiveCues: [{ strokeId: "depth-drag", cue: "depth_axis_3d" }]
  }
};
const reviewedObservationPath = join(smokeRoot, "reviewed-observation.json");
const overlayPath = join(smokeRoot, "transparent-sketch-packet.json");
writeFileSync(reviewedObservationPath, JSON.stringify(reviewedObservation, null, 2), "utf8");
writeFileSync(overlayPath, JSON.stringify(overlayPacket, null, 2), "utf8");

const blocked = runNodeScript("start-teach-execute-action-rehearsal.mjs", [
  "--reviewed-observation",
  reviewedObservationPath,
  "--overlay-packet",
  overlayPath,
  "--output-dir",
  join(smokeRoot, "blocked")
]);
const direct = runNodeScript("start-teach-execute-action-rehearsal.mjs", [
  "--reviewed-observation",
  reviewedObservationPath,
  "--overlay-packet",
  overlayPath,
  "--goal",
  "Action rehearsal from reviewed observation and teacher 3D sketch.",
  "--software",
  "generic design app",
  "--teacher-confirmation",
  "teacher confirmed action rehearsal",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--type-text",
  "teacher reviewed label",
  "--output-dir",
  join(smokeRoot, "direct")
]);
const directRehearsal = readJson(direct.rehearsalPath);
const directReceipt = readJson(direct.receiptPath);
const actionPlan = readJson(direct.supervisedActionPlan);
const readiness = readJson(direct.spatialExecutionReadiness);
const dryRunReceipt = readJson(direct.supervisedDryRunReceipt);
const mcp = await callAdvanced(reviewedObservationPath, overlayPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const defaultCard = await callDefault(reviewedObservationPath, overlayPacket);

const checks = [
  {
    name: "Action rehearsal blocks without explicit teacher confirmation",
    pass:
      blocked.status === "blocked_waiting_for_teacher_action_rehearsal_confirmation" &&
      blocked.softwareActionsExecuted === false,
    evidence: blocked.rehearsalPath
  },
  {
    name: "Teacher-confirmed action rehearsal links observation and overlay into action evidence",
    pass:
      direct.format === "transparent_ai_teach_execute_action_rehearsal_result_v1" &&
      directRehearsal.format === "transparent_ai_teach_execute_action_rehearsal_v1" &&
      direct.didRunDryRunReceipt === true &&
      direct.didVerifyDryRunOutcome === true &&
      direct.actionKinds.includes("click") &&
      direct.actionKinds.includes("drag"),
    evidence: direct.rehearsalPath
  },
  {
    name: "Action rehearsal preserves dry-run boundary and sends no UI events",
    pass:
      direct.softwareActionsExecuted === false &&
      directReceipt.softwareActionsExecuted === false &&
      dryRunReceipt.status === "dry_run" &&
      Array.isArray(dryRunReceipt.executedActionIds) &&
      dryRunReceipt.executedActionIds.length === 0 &&
      actionPlan.executionPolicy.nativeUniversalExecution === false,
    evidence: direct.supervisedDryRunReceipt
  },
  {
    name: "Action rehearsal includes spatial depth intent, control-channel profile, and existing execution adapter",
    pass:
      actionPlan.overlayEvidence.coordinateSpace.supports3DDepthHints === true &&
      readiness.format === "transparent_ai_spatial_execution_readiness_v1" &&
      readiness.supports2DPosition === true &&
      readiness.supports3DDepthHints === true &&
      directRehearsal.generatedEvidence.spatialExecutionReadiness === direct.spatialExecutionReadiness &&
      Boolean(directRehearsal.generatedEvidence.softwareControlChannelProfile) &&
      actionPlan.spatialIntentInterpretation.strokeGeometry.some((item) => item.depthRelation === "nearer_than_start") &&
      direct.primaryAdapterId === "existing-windows-ui-automation" &&
      Boolean(direct.executionAdapterSelection),
    evidence: direct.spatialExecutionReadiness
  },
  {
    name: "MCP advanced mode exposes and runs action rehearsal",
    pass:
      advancedNames.includes("start_teach_execute_action_rehearsal") &&
      advancedNames.includes("create_software_control_channel_probe") &&
      advancedNames.includes("create_software_control_channel_profile") &&
      mcp.result.status === "waiting_for_teacher_execution_rehearsal_review" &&
      mcp.result.softwareActionsExecuted === false &&
      mcp.list.tools.length === 61,
    evidence: `mode=advanced; count=${mcp.list.tools.length}`
  },
  {
    name: "Default teach_apprentice routes reviewed observation plus overlay to action rehearsal card",
    pass:
      defaultCard.status === "waiting_for_teach_execute_action_rehearsal_review" &&
      defaultCard.teachExecuteActionRehearsal?.didRunDryRunReceipt === true &&
      defaultCard.teachExecuteActionRehearsal?.spatialExecutionReadiness &&
      defaultCard.teachExecuteActionRehearsal?.softwareActionsExecuted === false &&
      defaultCard.teachExecuteActionRehearsal?.actionKinds?.includes("drag"),
    evidence: defaultCard.teachExecuteActionRehearsal?.rehearsalPath ?? ""
  },
  {
    name: "Action rehearsal preserves honest universal-execution boundary",
    pass:
      direct.reviewLocks.nativeUniversalExecution === false &&
      direct.reviewLocks.accepted === false &&
      direct.reviewLocks.ruleEnabled === false &&
      direct.reviewLocks.packagingGated === true &&
      direct.reviewLocks.explicitExecuteStillBlocked === true,
    evidence: JSON.stringify(direct.reviewLocks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const output = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_teach_execute_action_rehearsal_smoke_v1",
  checks,
  advancedToolCount: mcp.list.tools.length
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
