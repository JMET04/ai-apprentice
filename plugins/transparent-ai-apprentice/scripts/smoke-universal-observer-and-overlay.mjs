#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const serverScript = join(__dirname, "mcp-server.mjs");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "universal-overlay", String(Date.now()));
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
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  return { rpc, stop };
}

async function callAdvancedTools() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const observerResult = await server.rpc("tools/call", {
      name: "create_universal_software_observer_kit",
      arguments: {
        goal: "Learn a generic browser accounting workflow from low-token logs and events.",
        software: "generic browser app",
        processName: "chrome",
        outputDir: join(smokeRoot, "mcp-observer")
      }
    });
    const overlayResult = await server.rpc("tools/call", {
      name: "create_transparent_sketch_overlay_kit",
      arguments: {
        goal: "Teacher draws a 2D/3D spatial correction over the target app.",
        software: "generic design app",
        mode: "2d_3d",
        outputDir: join(smokeRoot, "mcp-overlay")
      }
    });
    return {
      list,
      observer: JSON.parse(observerResult.content[0].text),
      overlay: JSON.parse(overlayResult.content[0].text)
    };
  } finally {
    await server.stop();
  }
}

const observer = runNodeScript("create-universal-software-observer-kit.mjs", [
  "--goal",
  "Learn any teacher's spreadsheet workflow from logs, file deltas, and event summaries.",
  "--software",
  "generic spreadsheet app",
  "--process-name",
  "excel",
  "--log-root",
  smokeRoot,
  "--output-dir",
  join(smokeRoot, "direct-observer")
]);
const overlay = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  "Teacher explains a 3D placement correction by drawing over the screen.",
  "--software",
  "generic CAD or design app",
  "--mode",
  "2d_3d",
  "--output-dir",
  join(smokeRoot, "direct-overlay")
]);
const mcp = await callAdvancedTools();
const observerManifest = JSON.parse(readFileSync(observer.kitPath, "utf8"));
const observerPolicy = JSON.parse(readFileSync(observer.observationPolicy, "utf8"));
const overlayManifest = JSON.parse(readFileSync(overlay.kitPath, "utf8"));
const overlaySchema = JSON.parse(readFileSync(overlay.packetSchema, "utf8"));
const samplePacket = JSON.parse(readFileSync(overlay.samplePacket, "utf8"));
const overlayHtml = readFileSync(overlay.browserOverlay, "utf8");
const overlayPs = readFileSync(overlay.powershellOverlay, "utf8");
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Universal observer is not hardcoded to CAD or SolidWorks",
    pass:
      observer.format === "transparent_ai_universal_software_observer_kit_result_v1" &&
      observer.notHardcodedToSoftware === true &&
      observerManifest.sourceCatalog?.notHardcodedToSoftware === true &&
      observerManifest.sourceCatalog?.discoveryOrder?.some((item) => item.includes("process-name")) &&
      observerManifest.sourceCatalog?.windowsEventLogs?.includes("Application"),
    evidence: observer.kitPath
  },
  {
    name: "Universal observer keeps low-token trigger policy",
    pass:
      observerPolicy.format === "transparent_ai_universal_observation_policy_v1" &&
      observerPolicy.screenshotPolicy?.fullContinuousRecording === false &&
      observerPolicy.lowTokenStrategy?.some((item) => item.includes("Summarize changed file paths")) &&
      observerPolicy.teacherAdaptation?.supportsDifferentTeachingStyles?.includes("drawn overlay annotations"),
    evidence: observer.observationPolicy
  },
  {
    name: "Universal observer produces collector and evidence template",
    pass:
      existsSync(observer.collector) &&
      existsSync(observer.evidenceTemplate) &&
      readFileSync(observer.collector, "utf8").includes("transparent_ai_universal_software_observation_v1"),
    evidence: observer.collector
  },
  {
    name: "Transparent overlay kit exports spatial sketch packets",
    pass:
      overlay.format === "transparent_ai_transparent_sketch_overlay_kit_result_v1" &&
      overlay.transparentDrawingMask === true &&
      overlay.supports2DPlaneSketch === true &&
      overlay.supports3DDepthHints === true &&
      overlayManifest.capabilities?.exportsStructuredSpatialIntent === true &&
      overlayManifest.capabilities?.downloadablePacketExport === true &&
      overlayManifest.capabilities?.normalizedPowerShellCoordinates === true,
    evidence: overlay.kitPath
  },
  {
    name: "Transparent overlay browser route supports backdrop, anchor boxes, depth slider, and packet download",
    pass:
      overlayHtml.includes('id="backdropFile"') &&
      overlayHtml.includes('id="kind"') &&
      overlayHtml.includes('value="anchor"') &&
      overlayHtml.includes('id="depth"') &&
      overlayHtml.includes('transparent-sketch-packet.json') &&
      overlayHtml.includes("new Blob") &&
      overlayHtml.includes("teacher_supplied_screenshot"),
    evidence: overlay.browserOverlay
  },
  {
    name: "Transparent overlay PowerShell route exports normalized live 2D perspective and 3D depth coordinates",
    pass:
      overlayPs.includes("units=\"normalized_0_to_1\"") &&
      overlayPs.includes("D1") &&
      overlayPs.includes("D2") &&
      overlayPs.includes("D3") &&
      overlayPs.includes("Up") &&
      overlayPs.includes("Down") &&
      overlayPs.includes("perspective_grid") &&
      overlayPs.includes("depth_axis_3d") &&
      overlayPs.includes("$NormalizedStrokes") &&
      overlayPs.includes("[double]$_.x / $Width") &&
      overlayPs.includes("[double]$_.y / $Height") &&
      overlayPs.includes("zHint = $_.zHint") &&
      overlayPs.includes("perspectiveCues=$PerspectiveCues") &&
      overlayPs.includes("transparent_ai_sketch_overlay_packet_v1"),
    evidence: overlay.powershellOverlay
  },
  {
    name: "Overlay schema covers 2D, perspective, and 3D relationships",
    pass:
      overlaySchema.supportedModes?.includes("screen_2d") &&
      overlaySchema.supportedModes?.includes("perspective_grid") &&
      overlaySchema.supportedModes?.includes("depth_axis_3d") &&
      overlaySchema.relationshipFields?.includes("nearer_than") &&
      samplePacket.format === "transparent_ai_sketch_overlay_packet_v1" &&
      samplePacket.coordinateSpace?.supports3DDepthHints === true &&
      samplePacket.coordinateSpace?.supportsPerspectiveRelationships === true &&
      samplePacket.strokes?.some((stroke) => stroke.mode === "screen_2d") &&
      samplePacket.strokes?.some((stroke) => stroke.mode === "perspective_grid") &&
      samplePacket.strokes?.some((stroke) => stroke.mode === "depth_axis_3d") &&
      samplePacket.spatialIntent?.relationships?.some((row) => row.relation === "perspective_to") &&
      samplePacket.spatialIntent?.relationships?.some((row) => row.relation === "nearer_than") &&
      samplePacket.universalDetailLogicContract?.consequentialDetailRows?.some((row) => row.detailCategory === "view/depth/perspective"),
    evidence: overlay.packetSchema
  },
  {
    name: "Overlay stays teacher-review-only instead of claiming universal execution",
    pass:
      overlay.nativeSoftwareExecutionImplemented === false &&
      overlayManifest.capabilities?.nativeSoftwareExecutionImplemented === false &&
      samplePacket.proposedSoftwareAction?.executionMode === "teacher_review_only",
    evidence: JSON.stringify(overlayManifest.capabilities)
  },
  {
    name: "MCP advanced mode exposes universal observer and transparent overlay tools",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_universal_software_observer_kit") &&
      advancedNames.includes("create_transparent_sketch_overlay_kit") &&
      mcp.observer.format === "transparent_ai_universal_software_observer_kit_result_v1" &&
      mcp.overlay.format === "transparent_ai_transparent_sketch_overlay_kit_result_v1",
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_universal_observer_and_overlay_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
