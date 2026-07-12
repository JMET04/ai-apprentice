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
const smokeRoot = join(repoRoot, ".transparent-apprentice", "software-observation-delta-monitor-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function startServer() {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" },
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

async function callAdvancedTool(baselinePath, currentPath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "monitor_software_observation_deltas",
      arguments: {
        baseline: baselinePath,
        current: currentPath,
        teacherMarkers: ["teacher marker: only inspect screenshot when failure or ambiguity remains"],
        outputDir: join(smokeRoot, "mcp")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const baselineObservation = {
  format: "transparent_ai_universal_software_observation_v1",
  software: "generic ERP",
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  logSummaries: [
    {
      path: join(smokeRoot, "erp.log"),
      bytes: 24,
      lastWriteTimeUtc: "2026-06-06T00:00:00.000Z",
      interestingLineCount: 0,
      retainedSnippet: "startup complete",
      fullLogRead: false
    }
  ]
};
const currentObservation = {
  ...baselineObservation,
  createdAt: "2026-06-06T00:01:00.000Z",
  logSummaries: [
    {
      path: join(smokeRoot, "erp.log"),
      bytes: 92,
      lastWriteTimeUtc: "2026-06-06T00:01:00.000Z",
      interestingLineCount: 1,
      interestingTail: ["ERROR export failed because approval state is blocked"],
      retainedSnippet: "ERROR export failed because approval state is blocked",
      fullLogRead: false
    }
  ]
};
const baselinePath = join(smokeRoot, "baseline-observation.json");
const currentPath = join(smokeRoot, "current-observation.json");
writeFileSync(baselinePath, JSON.stringify(baselineObservation, null, 2), "utf8");
writeFileSync(currentPath, JSON.stringify(currentObservation, null, 2), "utf8");

const direct = runNodeScript("monitor-software-observation-deltas.mjs", [
  "--baseline",
  baselinePath,
  "--current",
  currentPath,
  "--teacher-marker",
  "鑰佸笀鏍囪: 鍑虹幇 failed 鏃跺厛璇锋眰涓€娆℃埅鍥?review",
  "--output-dir",
  join(smokeRoot, "direct")
]);
const mcp = await callAdvancedTool(baselinePath, currentPath);
const monitor = JSON.parse(readFileSync(direct.monitorPath, "utf8"));
const receipt = JSON.parse(readFileSync(direct.receiptPath, "utf8"));
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Delta monitor compares baseline/current compact observations",
    pass:
      direct.format === "transparent_ai_software_observation_delta_monitor_result_v1" &&
      monitor.format === "transparent_ai_software_observation_delta_monitor_v1" &&
      monitor.counts.changedLogs === 1 &&
      monitor.delta.changedLogs[0].classification === "failure_or_blocker",
    evidence: direct.monitorPath
  },
  {
    name: "Delta monitor requests screenshot only after meaningful trigger",
    pass:
      monitor.screenshotPolicy.screenshotRequiredByDefault === false &&
      monitor.screenshotPolicy.screenshotRecommended === true &&
      monitor.screenshotPolicy.request.captureOnlyAfterReview === true &&
      receipt.status === "waiting_for_triggered_screenshot_review",
    evidence: JSON.stringify(monitor.screenshotPolicy)
  },
  {
    name: "Delta monitor keeps low-token locks closed",
    pass:
      receipt.lowTokenProof.fullContinuousRecording === false &&
      receipt.lowTokenProof.screenshotsCaptured === false &&
      receipt.lowTokenProof.rawFullLogsRetained === false &&
      monitor.locks.nativeUniversalExecution === false &&
      monitor.locks.packagingGated === true,
    evidence: JSON.stringify(receipt.lowTokenProof)
  },
  {
    name: "MCP advanced mode exposes delta monitor",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("monitor_software_observation_deltas") &&
      mcp.result.format === "transparent_ai_software_observation_delta_monitor_result_v1" &&
      mcp.result.screenshotRecommended === true,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_software_observation_delta_monitor_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
