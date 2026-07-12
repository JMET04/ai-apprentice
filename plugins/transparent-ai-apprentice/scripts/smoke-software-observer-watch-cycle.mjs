#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const smokeRoot = join(repoRoot, ".transparent-apprentice", "software-observer-watch-cycle-smoke", String(Date.now()));
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

async function callAdvancedWatchCycle(queuePath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "run_software_observer_watch_cycle",
      arguments: {
        queue: queuePath,
        maxItems: 2,
        maxLogsPerItem: 2,
        maxTailBytes: 512,
        outputDir: join(smokeRoot, "mcp-cycle"),
        stateDir: join(smokeRoot, "mcp-state")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const appLog = join(smokeRoot, "browsercrm.log");
const editorLog = join(smokeRoot, "studioeditor.log");
writeFileSync(appLog, "startup complete\n", "utf8");
writeFileSync(editorLog, "idle\n", "utf8");

const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "watch-cycle-smoke-queue",
  queue: [
    {
      queueItemId: "browsercrm",
      software: "BrowserCRM",
      processName: "browsercrm.exe",
      score: 0.92,
      recentLogCandidates: [{ path: appLog }],
      windowsEventLogs: ["Application"]
    },
    {
      queueItemId: "studioeditor",
      software: "StudioEditor",
      processName: "studioeditor.exe",
      score: 0.78,
      recentLogCandidates: [{ path: editorLog }],
      windowsEventLogs: ["Application"]
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
};
const queuePath = join(smokeRoot, "software-observer-queue.json");
writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf8");

const stateDir = join(smokeRoot, "state");
const first = runNodeScript("run-software-observer-watch-cycle.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "cycle-first"),
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512"
]);
appendFileSync(appLog, "ERROR export failed because policy approval is blocked\n", "utf8");
const second = runNodeScript("run-software-observer-watch-cycle.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "cycle-second"),
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512"
]);
const mcp = await callAdvancedWatchCycle(queuePath);
const firstCycle = JSON.parse(readFileSync(first.watchCyclePath, "utf8"));
const secondCycle = JSON.parse(readFileSync(second.watchCyclePath, "utf8"));
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Watch cycle initializes baselines before reporting changes",
    pass:
      first.format === "transparent_ai_software_observer_watch_cycle_result_v1" &&
      first.status === "baseline_initialized_waiting_for_next_cycle" &&
      firstCycle.baselineWasPresent === false &&
      firstCycle.counts.changedLogs === 0,
    evidence: first.watchCyclePath
  },
  {
    name: "Watch cycle scans multiple non-CAD software queue items with bounded tails",
    pass:
      secondCycle.format === "transparent_ai_software_observer_watch_cycle_v1" &&
      secondCycle.counts.scannedItems === 2 &&
      secondCycle.counts.scannedLogs === 2 &&
      secondCycle.limits.fullLogsRead === false &&
      secondCycle.limits.fullContinuousRecording === false,
    evidence: JSON.stringify(secondCycle.counts)
  },
  {
    name: "Watch cycle detects changed log and requests screenshot only on meaningful trigger",
    pass:
      second.status === "waiting_for_teacher_delta_review" &&
      secondCycle.counts.changedLogs === 1 &&
      secondCycle.screenshotRequests.length === 1 &&
      secondCycle.screenshotRequests[0].classification === "failure_or_blocker" &&
      secondCycle.screenshotRequests[0].captureOnlyAfterReview === true,
    evidence: JSON.stringify(secondCycle.screenshotRequests)
  },
  {
    name: "Watch cycle keeps execution, recording, and memory gates locked",
    pass:
      secondCycle.locks.screenshotsCaptured === false &&
      secondCycle.locks.rawFullLogsRetained === false &&
      secondCycle.locks.nativeUniversalExecution === false &&
      secondCycle.locks.ruleEnabled === false &&
      secondCycle.locks.packagingGated === true,
    evidence: JSON.stringify(secondCycle.locks)
  },
  {
    name: "MCP advanced mode exposes and runs watch cycle",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("run_software_observer_watch_cycle") &&
      mcp.result.format === "transparent_ai_software_observer_watch_cycle_result_v1" &&
      mcp.result.fullContinuousRecording === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_software_observer_watch_cycle_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
