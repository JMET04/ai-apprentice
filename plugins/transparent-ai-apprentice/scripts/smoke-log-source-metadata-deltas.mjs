#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
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
const smokeRoot = join(repoRoot, ".transparent-apprentice", "log-source-metadata-delta-smoke", String(Date.now()));
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

async function callAdvancedMetadataGate(queuePath, stateDir) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "watch_log_source_metadata_deltas",
      arguments: {
        queue: queuePath,
        stateDir,
        maxItems: 2,
        maxLogsPerItem: 2,
        outputDir: join(smokeRoot, "mcp-metadata-gate")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const browserLog = join(smokeRoot, "browsercrm.log");
const editorLog = join(smokeRoot, "studioeditor.log");
writeFileSync(browserLog, "startup complete\n", "utf8");
writeFileSync(editorLog, "ready\n", "utf8");

const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "metadata-delta-smoke-queue",
  queue: [
    {
      queueItemId: "browsercrm",
      software: "BrowserCRM",
      processName: "browsercrm.exe",
      score: 0.91,
      recentLogCandidates: [{ path: browserLog, source: "inventory_log_source_index" }]
    },
    {
      queueItemId: "studioeditor",
      software: "StudioEditor",
      processName: "studioeditor.exe",
      score: 0.77,
      recentLogCandidates: [{ path: editorLog, source: "inventory_log_source_index" }]
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

const first = runNodeScript("watch-log-source-metadata-deltas.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "first"),
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2"
]);

appendFileSync(browserLog, "ERROR invoice export failed because approval is missing\n", "utf8");
const second = runNodeScript("watch-log-source-metadata-deltas.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "second"),
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2"
]);
const secondGate = JSON.parse(readFileSync(second.gatePath, "utf8"));
const narrowedQueue = JSON.parse(readFileSync(second.narrowedQueuePath, "utf8"));
const mcp = await callAdvancedMetadataGate(queuePath, stateDir);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Metadata gate initializes a no-content log metadata baseline",
    pass:
      first.format === "transparent_ai_log_source_metadata_delta_watch_result_v1" &&
      first.status === "baseline_initialized_waiting_for_metadata_delta" &&
      first.logContentsRead === false &&
      first.fullLogsRead === false &&
      first.screenshotsCaptured === false,
    evidence: first.gatePath
  },
  {
    name: "Metadata gate detects changed log before tail reads or screenshots",
    pass:
      second.status === "metadata_delta_waiting_for_tail_review" &&
      second.changedLogMetadata === 1 &&
      second.logContentsRead === false &&
      second.fullLogsRead === false &&
      second.screenshotsCaptured === false &&
      secondGate.counts.changedLogMetadata === 1,
    evidence: JSON.stringify(secondGate.counts)
  },
  {
    name: "Metadata gate narrows the queue to changed log candidates only",
    pass:
      narrowedQueue.narrowedBy === "transparent_ai_log_source_metadata_delta_watch_v1" &&
      narrowedQueue.queue.length === 1 &&
      narrowedQueue.queue[0].software === "BrowserCRM" &&
      narrowedQueue.queue[0].recentLogCandidates.length === 1,
    evidence: second.narrowedQueuePath
  },
  {
    name: "Metadata gate suggests tail watch only after metadata changed",
    pass:
      secondGate.nextTailReadCall?.tool === "run_software_observer_watch_cycle" &&
      secondGate.locks.fullContinuousRecording === false &&
      secondGate.locks.nativeUniversalExecution === false &&
      secondGate.locks.packagingGated === true,
    evidence: JSON.stringify(secondGate.nextTailReadCall)
  },
  {
    name: "MCP advanced mode exposes and runs metadata delta gate",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("watch_log_source_metadata_deltas") &&
      mcp.result.format === "transparent_ai_log_source_metadata_delta_watch_result_v1" &&
      mcp.result.logContentsRead === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_log_source_metadata_delta_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
