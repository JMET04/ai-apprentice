#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "..", "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const outputRoot = existsSync(sourceServerScript) ? repoRoot : resolve(process.cwd());
const serverCwd = existsSync(sourceServerScript) ? repoRoot : outputRoot;
const smokeRoot = join(outputRoot, ".transparent-apprentice", "supervised-action-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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

async function callAdvancedTool(packetPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_supervised_software_action_kit",
      arguments: {
        goal: "Use the reviewed transparent overlay to prepare supervised UI actions.",
        software: "generic design app",
        processName: "GenericApp",
        windowTitle: "Generic App",
        overlayPacket: packetPath,
        outputDir: join(smokeRoot, "mcp-action")
      }
    });
    return {
      list,
      result: JSON.parse(result.content[0].text)
    };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachOverlayPacket(packet) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Use the teacher's transparent sketch overlay to prepare supervised software actions.",
        software: "generic design app",
        message: JSON.stringify(packet, null, 2),
        typeTexts: ["teacher reviewed label"],
        hotkeys: ["^s"]
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const samplePacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "generic design app",
  goal: "Teacher marks a target and drags an object into it.",
  overlayMode: "2d_3d",
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true
  },
  anchors: [
    { id: "target", type: "teacher_marked_region", label: "target area", box: [0.56, 0.3, 0.72, 0.46] }
  ],
  strokes: [
    {
      id: "tap-target",
      mode: "screen_2d",
      semanticLabel: "click the target first",
      points: [
        { x: 0.64, y: 0.38, t: 0, zHint: 0 },
        { x: 0.642, y: 0.381, t: 20, zHint: 0 }
      ]
    },
    {
      id: "move-object",
      mode: "depth_axis_3d",
      semanticLabel: "drag the object into the nearer plane",
      points: [
        { x: 0.2, y: 0.7, t: 0, zHint: 0.1 },
        { x: 0.67, y: 0.38, t: 90, zHint: 0.4 }
      ]
    }
  ],
  spatialIntent: {
    relationships: [{ subject: "move-object", relation: "nearer_than", object: "target" }],
    perspectiveCues: [{ strokeId: "move-object", cue: "depth_axis_3d" }]
  }
};

const packetPath = join(smokeRoot, "sample-transparent-sketch-packet.json");
writeFileSync(packetPath, JSON.stringify(samplePacket, null, 2), "utf8");

const direct = runNodeScript("create-supervised-software-action-kit.mjs", [
  "--goal",
  "Compile teacher overlay into supervised actions.",
  "--software",
  "generic design app",
  "--overlay-packet",
  packetPath,
  "--type-text",
  "teacher reviewed label",
  "--hotkey",
  "^s",
  "--output-dir",
  join(smokeRoot, "direct-action")
]);
const mcp = await callAdvancedTool(packetPath);
const defaultTeach = await callDefaultTeachOverlayPacket(samplePacket);
const plan = readJsonFile(direct.actionPlan);
const readiness = readJsonFile(direct.spatialExecutionReadinessPath);
const manifest = readJsonFile(direct.kitPath);
const preflight = readJsonFile(direct.preflight);
const receiptTemplate = readJsonFile(direct.executionReceiptTemplate);
const outcomeVerificationTemplate = readJsonFile(direct.outcomeVerificationTemplate);
const runnerText = readFileSync(direct.runner, "utf8");
const policyText = readFileSync(direct.policy, "utf8");
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const dryRun = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", direct.runner], {
  cwd: smokeRoot,
  encoding: "utf8"
});
const dryRunPreflight = existsSync(direct.preflight) ? readJsonFile(direct.preflight) : null;
const dryRunReceipt = existsSync(direct.executionReceipt) ? readJsonFile(direct.executionReceipt) : null;

const checks = [
  {
    name: "Supervised bridge creates a reviewable action plan from overlay evidence",
    pass:
      direct.format === "transparent_ai_supervised_software_action_kit_result_v1" &&
      plan.format === "transparent_ai_supervised_software_action_plan_v1" &&
      plan.overlayEvidence.strokeCount === 2 &&
      plan.spatialInterpretation.length >= 2,
    evidence: direct.actionPlan
  },
  {
    name: "Action plan includes click, drag, type, and hotkey candidates without claiming native universal execution",
    pass:
      plan.actions.some((action) => action.kind === "click") &&
      plan.actions.some((action) => action.kind === "drag") &&
      plan.actions.some((action) => action.kind === "type_text") &&
      plan.actions.some((action) => action.kind === "hotkey") &&
      plan.executionPolicy.nativeUniversalExecution === false,
    evidence: `kinds=${plan.actions.map((action) => action.kind).join(",")}`
  },
  {
    name: "Action kit writes standalone spatial execution readiness for 2D perspective and depth review",
    pass:
      direct.spatialExecutionReadiness === true &&
      direct.spatialExecutionReadinessFormat === "transparent_ai_spatial_execution_readiness_v1" &&
      existsSync(direct.spatialExecutionReadinessPath) &&
      readiness.format === "transparent_ai_spatial_execution_readiness_v1" &&
      readiness.supports2DPosition === true &&
      readiness.supports3DDepthHints === true &&
      readiness.actionBinding?.some((row) => row.preservesDepth === true) &&
      manifest.files?.spatialExecutionReadiness === direct.spatialExecutionReadinessPath,
    evidence: direct.spatialExecutionReadinessPath
  },
  {
    name: "Runner defaults to dry run and requires teacher confirmation plus execute switch",
    pass:
      existsSync(direct.runner) &&
      runnerText.includes("TeacherConfirmed") &&
      runnerText.includes("Execute") &&
      runnerText.includes("dry_run") &&
      runnerText.includes("Write-Preflight") &&
      runnerText.includes("transparent_ai_supervised_software_action_preflight_v1") &&
      runnerText.includes("active window title mismatch") &&
      runnerText.includes("blocked_by_preflight") &&
      runnerText.includes("Write-ExecutionReceipt") &&
      runnerText.includes("transparent_ai_supervised_software_action_execution_receipt_v1") &&
      runnerText.includes("supervised-action-execution-receipt.json") &&
      runnerText.includes("Set-Content") &&
      runnerText.includes("SetCursorPos") &&
      runnerText.includes("SendKeys") &&
      runnerText.includes("nativeUniversalExecution = $false"),
    evidence: direct.runner
  },
  {
    name: "Manifest and policy keep software execution supervised instead of hidden",
    pass:
      manifest.capabilities?.teacherConfirmationRequired === true &&
      manifest.capabilities?.requiresActiveTargetWindow === true &&
      manifest.capabilities?.writesPreflight === true &&
      manifest.capabilities?.blocksOnTargetWindowMismatch === true &&
      manifest.capabilities?.writesExecutionReceipt === true &&
      manifest.capabilities?.writesOutcomeVerificationTemplate === true &&
      manifest.capabilities?.lowTokenPostActionVerification === true &&
      manifest.capabilities?.nativeUniversalExecution === false &&
      manifest.files?.preflight === direct.preflight &&
      manifest.files?.executionReceiptTemplate === direct.executionReceiptTemplate &&
      manifest.files?.outcomeVerificationTemplate === direct.outcomeVerificationTemplate &&
      policyText.includes("transparent_ai_supervised_software_action_policy_v1") &&
      policyText.includes("hidden background execution") &&
      policyText.includes("preflightRequired") &&
      policyText.includes("foreground window title mismatch"),
    evidence: direct.policy
  },
  {
    name: "Preflight packet checks active window, coordinate bounds, and action risk before execution",
    pass:
      direct.writesPreflight === true &&
      direct.blocksOnTargetWindowMismatch === true &&
      preflight.format === "transparent_ai_supervised_software_action_preflight_v1" &&
      preflight.status === "not_run_yet" &&
      preflight.activeWindowCheck?.required === true &&
      preflight.activeWindowCheck?.blockOnTitleMismatchWhenProvided === true &&
      preflight.coordinateSystem?.coordinateBoundsOk === true &&
      preflight.riskReview?.manualTeacherConfirmationRequired === true &&
      preflight.lowTokenPostActionVerification?.preferredSignals?.includes("runner receipt status and executed action ids"),
    evidence: direct.preflight
  },
  {
    name: "Generated runner writes dry-run preflight and receipt without sending UI events",
    pass:
      dryRun.status === 0 &&
      dryRunPreflight?.format === "transparent_ai_supervised_software_action_preflight_v1" &&
      dryRunPreflight?.status === "dry_run_preflight" &&
      dryRunPreflight?.executeAllowed === false &&
      dryRunPreflight?.blockReasons?.includes("missing TeacherConfirmed switch") &&
      dryRunPreflight?.blockReasons?.includes("missing Execute switch") &&
      dryRunReceipt?.format === "transparent_ai_supervised_software_action_execution_receipt_v1" &&
      dryRunReceipt?.status === "dry_run" &&
      dryRunReceipt?.preflightStatus === "dry_run_preflight" &&
      dryRunReceipt?.executedActionIds?.length === 0,
    evidence: `status=${dryRun.status}; preflight=${direct.preflight}; receipt=${direct.executionReceipt}`
  },
  {
    name: "Execution receipt template supports low-token post-action verification",
    pass:
      direct.writesExecutionReceipt === true &&
      direct.lowTokenPostActionVerification === true &&
      receiptTemplate.format === "transparent_ai_supervised_software_action_execution_receipt_v1" &&
      receiptTemplate.status === "not_run_yet" &&
      receiptTemplate.lowTokenPostActionVerification?.preferredSignals?.includes("target software log delta or event count") &&
      receiptTemplate.lowTokenPostActionVerification?.preferredSignals?.some((signal) => signal.includes("triggered screenshot only")) &&
      receiptTemplate.lowTokenPostActionVerification?.nextSuggestedTools?.includes("verify_supervised_action_outcome") &&
      receiptTemplate.locks?.nativeUniversalExecution === false &&
      receiptTemplate.locks?.fullContinuousRecording === false,
    evidence: direct.executionReceiptTemplate
  },
  {
    name: "Action kit writes outcome verification template for post-action low-token review",
    pass:
      direct.writesOutcomeVerificationTemplate === true &&
      outcomeVerificationTemplate.format === "transparent_ai_supervised_action_outcome_verification_template_v1" &&
      outcomeVerificationTemplate.defaultTool === "verify_supervised_action_outcome" &&
      outcomeVerificationTemplate.expectedOutput === "transparent_ai_supervised_action_outcome_verification_v1" &&
      outcomeVerificationTemplate.defaultArguments?.receipt === direct.executionReceipt &&
      outcomeVerificationTemplate.defaultArguments?.preflight === direct.preflight &&
      outcomeVerificationTemplate.locks?.screenshotsCaptured === false &&
      outcomeVerificationTemplate.locks?.logContentsRead === false,
    evidence: direct.outcomeVerificationTemplate
  },
  {
    name: "MCP advanced mode exposes supervised software action bridge",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_supervised_software_action_kit") &&
      mcp.result.format === "transparent_ai_supervised_software_action_kit_result_v1" &&
      mcp.result.nativeUniversalExecution === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes pasted transparent overlay packets to the supervised bridge",
    pass:
      defaultTeach.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultTeach.status === "waiting_for_supervised_action_review" &&
      defaultTeach.supervisedActionKit?.defaultMode === "dry_run" &&
      defaultTeach.supervisedActionKit?.spatialExecutionReadiness &&
      defaultTeach.supervisedActionKit?.preflight &&
      defaultTeach.supervisedActionKit?.outcomeVerificationTemplate &&
      defaultTeach.supervisedActionKit?.writesPreflight === true &&
      defaultTeach.supervisedActionKit?.writesOutcomeVerificationTemplate === true &&
      defaultTeach.supervisedActionKit?.blocksOnTargetWindowMismatch === true &&
      defaultTeach.supervisedActionKit?.teacherConfirmationRequired === true &&
      defaultTeach.supervisedActionKit?.nativeUniversalExecution === false &&
      defaultTeach.firstLesson?.steps?.some((step) => step.includes("supervised-action-preflight.json")) &&
      defaultTeach.teacherCanReplyWith?.some((reply) => reply.includes("supervised-action-preflight.json")),
    evidence: defaultTeach.supervisedActionKit?.actionPlan ?? "missing supervisedActionKit"
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_supervised_software_action_bridge_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
