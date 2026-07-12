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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "triggered-visual-check-smoke", String(Date.now()));
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

const monitorPath = join(smokeRoot, "delta-monitor.json");
const metadataGatePath = join(smokeRoot, "metadata-gate.json");
writeFileSync(monitorPath, JSON.stringify({
  format: "transparent_ai_software_observation_delta_monitor_v1",
  software: "generic non-CAD desktop app",
  processName: "GenericApp.exe",
  windowTitle: "Generic App",
  counts: { changedLogs: 1, addedLogs: 0, removedLogs: 0 },
  delta: {
    changedLogs: [
      {
        path: join(smokeRoot, "generic-app.log"),
        classification: "failure_or_blocker",
        current: { retainedSnippet: "ERROR export failed after user clicked save" }
      }
    ],
    addedLogs: [],
    removedLogs: []
  },
  screenshotPolicy: {
    screenshotRecommended: true,
    screenshotCaptured: false,
    fullContinuousRecording: false,
    reason: "cheap_signal_failure_or_blocker"
  }
}, null, 2), "utf8");

writeFileSync(metadataGatePath, JSON.stringify({
  format: "transparent_ai_log_source_metadata_delta_watch_v1",
  counts: { changedItems: 1, changedLogMetadata: 1 },
  nextTailReadCall: { tool: "run_software_observer_watch_cycle", arguments: { queue: "metadata-changed-queue.json" } },
  itemResults: [
    {
      queueItemId: "generic-app",
      software: "generic non-CAD desktop app",
      processName: "GenericApp.exe",
      changedLogMetadataCount: 1,
      deltas: [
        {
          path: join(smokeRoot, "generic-app.log"),
          status: "metadata_changed",
          classification: "log_grew"
        }
      ]
    }
  ]
}, null, 2), "utf8");

async function callAdvancedTool() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_triggered_visual_check_request",
      arguments: {
        deltaMonitor: monitorPath,
        software: "generic non-CAD desktop app",
        windowTitle: "Generic App",
        outputDir: join(smokeRoot, "mcp")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultRoute() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        triggeredVisualCheck: true,
        message: "日志变化后只在必要时截图看看发生了什么，不要一直录屏。",
        deltaMonitor: monitorPath,
        software: "generic non-CAD desktop app",
        windowTitle: "Generic App"
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const direct = runNodeScript("create-triggered-visual-check-request.mjs", [
  "--delta-monitor",
  monitorPath,
  "--software",
  "generic non-CAD desktop app",
  "--target-window-title",
  "Generic App",
  "--output-dir",
  join(smokeRoot, "direct")
]);
const directPacket = readJson(direct.packetPath);

const metadataOnly = runNodeScript("create-triggered-visual-check-request.mjs", [
  "--metadata-gate",
  metadataGatePath,
  "--software",
  "generic non-CAD desktop app",
  "--output-dir",
  join(smokeRoot, "metadata-only")
]);
const metadataPacket = readJson(metadataOnly.packetPath);

const mcp = await callAdvancedTool();
const defaultRoute = await callDefaultRoute();
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Triggered visual check creates one bounded screenshot request after meaningful delta",
    pass:
      direct.format === "transparent_ai_triggered_visual_check_request_result_v1" &&
      directPacket.format === "transparent_ai_triggered_visual_check_request_v1" &&
      directPacket.requestCount === 1 &&
      directPacket.requests[0].captureOnlyAfterReview === true &&
      directPacket.requests[0].maxScreenshots === 1 &&
      directPacket.requests[0].triggerEvidence.triggerClassification === "failure_or_blocker",
    evidence: direct.packetPath
  },
  {
    name: "Metadata-only gate does not jump straight to screenshots by default",
    pass:
      metadataPacket.requestCount === 0 &&
      metadataPacket.status === "no_visual_check_needed_from_current_low_token_evidence" &&
      metadataPacket.skippedReason.includes("bounded-tail") &&
      metadataPacket.locks.screenshotsCaptured === false &&
      metadataPacket.locks.fullContinuousRecording === false,
    evidence: metadataOnly.packetPath
  },
  {
    name: "Triggered visual check keeps recording, execution, memory, and packaging locked",
    pass:
      directPacket.locks.screenshotsCaptured === false &&
      directPacket.locks.fullContinuousRecording === false &&
      directPacket.locks.softwareActionsExecuted === false &&
      directPacket.locks.nativeUniversalExecution === false &&
      directPacket.locks.accepted === false &&
      directPacket.locks.ruleEnabled === false &&
      directPacket.locks.packagingGated === true,
    evidence: JSON.stringify(directPacket.locks)
  },
  {
    name: "MCP advanced mode exposes and runs triggered visual check request",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_triggered_visual_check_request") &&
      mcp.result.format === "transparent_ai_triggered_visual_check_request_result_v1" &&
      mcp.result.requestCount === 1 &&
      mcp.result.screenshotsCaptured === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes log-change screenshot intent to triggered visual check card",
    pass:
      defaultRoute.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultRoute.status === "waiting_for_triggered_visual_check_review" &&
      defaultRoute.triggeredVisualCheck?.requestCount === 1 &&
      defaultRoute.triggeredVisualCheck?.screenshotsCaptured === false &&
      defaultRoute.triggeredVisualCheck?.fullContinuousRecording === false,
    evidence: `status=${defaultRoute.status}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_triggered_visual_check_request_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
