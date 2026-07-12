#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "..", "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const outputRoot = existsSync(sourceServerScript) ? repoRoot : resolve(process.cwd());
const serverCwd = existsSync(sourceServerScript) ? repoRoot : outputRoot;
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "automatic-triggered-visual-check-queue", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
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

async function callAdvancedBridge(runnerPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_automatic_triggered_visual_check_queue",
      arguments: {
        runner: runnerPath,
        maxRequests: 2,
        outputDir: join(smokeRoot, "mcp-bridge")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const appLog = join(smokeRoot, "UniversalDesignTool.log");
writeFileSync(appLog, "startup ready\n", "utf8");
const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "automatic-triggered-visual-check-queue-smoke",
  goal: "Learn from changed software logs, then request a visual check only when useful.",
  queue: [
    {
      queueItemId: "universal-design-tool",
      software: "UniversalDesignTool",
      processName: "UniversalDesignTool.exe",
      score: 0.91,
      recentLogCandidates: [{ path: appLog }],
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
writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
const stateDir = join(smokeRoot, "persistent-state");

const baseline = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
  "--goal",
  "Automatic low-token runner baseline before visual trigger.",
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--runs",
  "1",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "40",
  "--output-dir",
  join(smokeRoot, "baseline-runner")
]);

const baselineBridge = runNodeScript("create-automatic-triggered-visual-check-queue.mjs", [
  "--runner",
  baseline.journalPath,
  "--output-dir",
  join(smokeRoot, "baseline-bridge")
]);
const baselineQueue = readJson(baselineBridge.queuePath);

appendFileSync(appLog, "ERROR automatic export failed after user changed sketch constraint\n", "utf8");
const changed = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
  "--goal",
  "Automatic low-token runner detects changed software signal before visual check.",
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--runs",
  "2",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "40",
  "--max-learning-items",
  "1",
  "--teacher-marker",
  "teacher wants a screenshot only if the automatic log change is meaningful",
  "--output-dir",
  join(smokeRoot, "changed-runner")
]);

const bridge = runNodeScript("create-automatic-triggered-visual-check-queue.mjs", [
  "--runner",
  changed.journalPath,
  "--max-requests",
  "2",
  "--output-dir",
  join(smokeRoot, "changed-bridge")
]);
const changedJournal = readJson(changed.journalPath);
const bridgeQueue = readJson(bridge.queuePath);
const mcp = await callAdvancedBridge(changed.journalPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Automatic visual bridge stays quiet when the runner only initialized a baseline",
    pass:
      baselineBridge.format === "transparent_ai_automatic_triggered_visual_check_queue_result_v1" &&
      baselineQueue.format === "transparent_ai_automatic_triggered_visual_check_queue_v1" &&
      baselineQueue.requestCount === 0 &&
      baselineQueue.status === "no_visual_check_needed_from_automatic_low_token_runner" &&
      baselineQueue.locks.screenshotsCaptured === false,
    evidence: baselineBridge.queuePath
  },
  {
    name: "Automatic runner changed signal becomes a teacher-reviewed visual check queue",
    pass:
      changed.status === "learning_events_waiting_for_teacher_review" &&
      changedJournal.totals.compactLearningEvents >= 1 &&
      bridgeQueue.requestCount >= 1 &&
      bridgeQueue.requests[0].captureOnlyAfterReview === true &&
      bridgeQueue.requests[0].maxScreenshots === 1 &&
      bridgeQueue.status === "waiting_for_teacher_visual_check_review",
    evidence: bridge.queuePath
  },
  {
    name: "Bridge preserves low-token locks and captures no screenshot by itself",
    pass:
      bridgeQueue.locks.fullContinuousRecording === false &&
      bridgeQueue.locks.screenshotsCaptured === false &&
      bridgeQueue.locks.rawFullLogsRetained === false &&
      bridgeQueue.locks.softwareActionsExecuted === false &&
      bridgeQueue.locks.longTermMemoryWritten === false &&
      bridgeQueue.locks.nativeUniversalExecution === false &&
      bridgeQueue.locks.accepted === false &&
      bridgeQueue.locks.ruleEnabled === false &&
      bridgeQueue.locks.packagingGated === true,
    evidence: JSON.stringify(bridgeQueue.locks)
  },
  {
    name: "MCP advanced mode exposes and runs automatic triggered visual check queue",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_automatic_triggered_visual_check_queue") &&
      mcp.result.format === "transparent_ai_automatic_triggered_visual_check_queue_result_v1" &&
      mcp.result.requestCount >= 1 &&
      mcp.result.screenshotsCaptured === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_automatic_triggered_visual_check_queue_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    baselineRunner: baseline.journalPath,
    changedRunner: changed.journalPath,
    bridgeQueue: bridge.queuePath
  },
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
