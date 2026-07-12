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
  ? join(repoRoot, ".transparent-apprentice", "teach-execute-supervised-execution-smoke", String(Date.now()))
  : join(process.env.TEMP || process.env.TMP || repoRoot, "transparent-ai-apprentice-cache-smoke", ".transparent-apprentice", "teach-execute-supervised-execution-smoke", String(Date.now()));
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

async function callAdvanced(actionRehearsalPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "start_teach_execute_supervised_execution",
      arguments: {
        actionRehearsal: actionRehearsalPath,
        goal: "Supervised execution gate dry-run after action rehearsal.",
        software: "generic design app",
        teacherConfirmation: "teacher confirmed supervised execution",
        outputDir: join(smokeRoot, "mcp-supervised-execution")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefault(actionRehearsalPath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Start supervised execution gate after action rehearsal.",
        message: `teacher confirmed supervised execution\nPlease run supervised execution gate in dry run.\n${actionRehearsalPath}`,
        actionRehearsal: actionRehearsalPath,
        software: "generic design app",
        outputDir: join(smokeRoot, "default-supervised-execution")
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

const rehearsal = runNodeScript("start-teach-execute-action-rehearsal.mjs", [
  "--reviewed-observation",
  reviewedObservationPath,
  "--overlay-packet",
  overlayPath,
  "--goal",
  "Action rehearsal before supervised execution gate.",
  "--software",
  "generic design app",
  "--teacher-confirmation",
  "teacher confirmed action rehearsal",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--output-dir",
  join(smokeRoot, "action-rehearsal")
]);
const windowTitledRehearsal = runNodeScript("start-teach-execute-action-rehearsal.mjs", [
  "--reviewed-observation",
  reviewedObservationPath,
  "--overlay-packet",
  overlayPath,
  "--goal",
  "Execute readiness gate.",
  "--software",
  "generic design app",
  "--window-title",
  "Generic Design App",
  "--teacher-confirmation",
  "teacher confirmed action rehearsal",
  "--preferred-adapter",
  "existing-windows-ui-automation",
  "--output-dir",
  join(smokeRoot, "ready")
]);

const blocked = runNodeScript("start-teach-execute-supervised-execution.mjs", [
  "--action-rehearsal",
  rehearsal.rehearsalPath,
  "--output-dir",
  join(smokeRoot, "blocked")
]);
const dryRun = runNodeScript("start-teach-execute-supervised-execution.mjs", [
  "--action-rehearsal",
  rehearsal.rehearsalPath,
  "--goal",
  "Supervised execution gate dry-run after action rehearsal.",
  "--software",
  "generic design app",
  "--teacher-confirmation",
  "teacher confirmed supervised execution",
  "--teacher-marker",
  "teacher has not requested real execution",
  "--output-dir",
  join(smokeRoot, "dry-run")
]);
const executeBlocked = runNodeScript("start-teach-execute-supervised-execution.mjs", [
  "--action-rehearsal",
  rehearsal.rehearsalPath,
  "--teacher-confirmation",
  "teacher confirmed supervised execution",
  "--execute",
  "--output-dir",
  join(smokeRoot, "execute-blocked")
]);
const spatialReadinessBlocked = runNodeScript("start-teach-execute-supervised-execution.mjs", [
  "--action-rehearsal",
  windowTitledRehearsal.rehearsalPath,
  "--teacher-confirmation",
  "teacher confirmed supervised execution",
  "--execute",
  "--target-window-title",
  "Generic Design App",
  "--output-dir",
  join(smokeRoot, "execute-spatial-readiness-blocked")
]);
const dryRunPacket = readJson(dryRun.executionPath);
const dryRunReceipt = readJson(dryRun.executionReceipt);
const mcp = await callAdvanced(rehearsal.rehearsalPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const defaultCard = await callDefault(rehearsal.rehearsalPath);

const checks = [
  {
    name: "Supervised execution gate blocks without explicit teacher confirmation",
    pass:
      blocked.status === "blocked_waiting_for_teacher_supervised_execution_confirmation" &&
      blocked.softwareActionsExecuted === false,
    evidence: blocked.executionPath
  },
  {
    name: "Teacher-confirmed supervised execution gate defaults to dry-run",
    pass:
      dryRun.format === "transparent_ai_teach_execute_supervised_execution_result_v1" &&
      dryRun.status === "dry_run_verified_no_ui_events" &&
      dryRun.didRunRunner === true &&
      dryRun.didVerifyOutcome === true &&
      dryRun.softwareActionsExecuted === false &&
      dryRunReceipt.status === "dry_run" &&
      dryRunPacket.generatedEvidence.spatialExecutionReadiness &&
      dryRunPacket.spatialExecutionReadinessReview.requiredForExecute === true,
    evidence: dryRun.executionPath
  },
  {
    name: "Execute request blocks before runner when target window title is missing",
    pass:
      executeBlocked.status === "blocked_missing_target_window_title" &&
      executeBlocked.softwareActionsExecuted === false,
    evidence: executeBlocked.executionPath
  },
  {
    name: "Execute request blocks before runner when spatial readiness is not teacher-confirmed",
    pass:
      spatialReadinessBlocked.status === "blocked_spatial_execution_readiness_not_confirmed" &&
      spatialReadinessBlocked.softwareActionsExecuted === false,
    evidence: spatialReadinessBlocked.executionPath
  },
  {
    name: "Supervised execution gate preserves low-token and review locks",
    pass:
      dryRunPacket.lowTokenPolicy.runnerReceiptBeforeScreenshots === true &&
      dryRunPacket.lowTokenPolicy.metadataDeltaBeforeScreenshots === true &&
      dryRun.reviewLocks.accepted === false &&
      dryRun.reviewLocks.ruleEnabled === false &&
      dryRun.reviewLocks.packagingGated === true &&
      dryRun.reviewLocks.nativeUniversalExecution === false,
    evidence: JSON.stringify(dryRun.reviewLocks)
  },
  {
    name: "MCP advanced mode exposes and runs supervised execution gate",
    pass:
      advancedNames.includes("start_teach_execute_supervised_execution") &&
      advancedNames.includes("create_software_control_channel_probe") &&
      advancedNames.includes("create_software_control_channel_profile") &&
      mcp.result.status === "dry_run_verified_no_ui_events" &&
      mcp.result.softwareActionsExecuted === false &&
      mcp.list.tools.length === 61,
    evidence: `mode=advanced; count=${mcp.list.tools.length}`
  },
  {
    name: "Default teach_apprentice routes action rehearsal to supervised execution gate card",
    pass:
      defaultCard.status === "waiting_for_teach_execute_supervised_execution_review" &&
      defaultCard.teachExecuteSupervisedExecution?.didRunRunner === true &&
      defaultCard.teachExecuteSupervisedExecution?.softwareActionsExecuted === false &&
      defaultCard.teachExecuteSupervisedExecution?.runnerReceiptStatus === "dry_run",
    evidence: defaultCard.teachExecuteSupervisedExecution?.executionPath ?? ""
  },
  {
    name: "Supervised execution gate does not accept memory or unlock packaging",
    pass:
      dryRun.reviewLocks.accepted === false &&
      dryRun.reviewLocks.ruleEnabled === false &&
      dryRun.reviewLocks.packagingGated === true &&
      dryRun.memoryEnabled === false,
    evidence: JSON.stringify(dryRun.reviewLocks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const output = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_teach_execute_supervised_execution_smoke_v1",
  checks,
  advancedToolCount: mcp.list.tools.length
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
