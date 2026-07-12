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
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-observer-supervisor-smoke", String(Date.now()));
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

async function callAdvancedSupervisor(queuePath, stateDir) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "run_all_software_observer_supervisor",
      arguments: {
        queue: queuePath,
        stateDir,
        cycles: 1,
        maxItems: 2,
        maxLogsPerItem: 2,
        maxTailBytes: 512,
        outputDir: join(smokeRoot, "mcp-supervisor")
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
  queueId: "supervisor-smoke-queue",
  queue: [
    {
      queueItemId: "browsercrm",
      software: "BrowserCRM",
      processName: "browsercrm.exe",
      score: 0.91,
      recentLogCandidates: [{ path: browserLog }],
      windowsEventLogs: ["Application"]
    },
    {
      queueItemId: "studioeditor",
      software: "StudioEditor",
      processName: "studioeditor.exe",
      score: 0.77,
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

const first = runNodeScript("run-all-software-observer-supervisor.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "supervisor-first"),
  "--cycles",
  "1",
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512"
]);

appendFileSync(browserLog, "ERROR invoice export failed because approval is missing\n", "utf8");
const second = runNodeScript("run-all-software-observer-supervisor.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "supervisor-second"),
  "--cycles",
  "3",
  "--interval-ms",
  "0",
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512"
]);
const secondPacket = JSON.parse(readFileSync(second.supervisorPath, "utf8"));
const secondReceipt = JSON.parse(readFileSync(second.receiptPath, "utf8"));
const mcp = await callAdvancedSupervisor(queuePath, stateDir);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Supervisor initializes baselines through bounded watch cycles",
    pass:
      first.format === "transparent_ai_all_software_observer_supervisor_result_v1" &&
      first.cyclesRun === 1 &&
      first.changedLogs === 0 &&
      first.fullContinuousRecording === false,
    evidence: first.supervisorPath
  },
  {
    name: "Supervisor detects meaningful later log delta and stops for teacher review",
    pass:
      secondPacket.format === "transparent_ai_all_software_observer_supervisor_v1" &&
      second.status === "waiting_for_teacher_delta_review" &&
      second.stopReason === "meaningful_delta_detected_waiting_for_teacher_review" &&
      second.cyclesRun === 1 &&
      second.changedLogs === 1 &&
      second.screenshotRequests === 1,
    evidence: JSON.stringify(secondPacket.counts)
  },
  {
    name: "Supervisor keeps periodic observation bounded and low-token",
    pass:
      secondPacket.schedulePolicy.boundedPeriodicRun === true &&
      secondPacket.schedulePolicy.backgroundTaskInstalled === false &&
      secondPacket.limits.fullLogsRead === false &&
      secondPacket.limits.screenshotsCaptured === false &&
      secondPacket.limits.fullContinuousRecording === false &&
      secondReceipt.rawFullLogsRetained === false,
    evidence: JSON.stringify(secondPacket.schedulePolicy)
  },
  {
    name: "Supervisor keeps execution, recording, and memory gates locked",
    pass:
      secondPacket.locks.ruleEnabled === false &&
      secondPacket.locks.accepted === false &&
      secondPacket.locks.packagingGated === true &&
      secondPacket.locks.nativeUniversalExecution === false &&
      secondReceipt.teacherConfirmationRequired === true,
    evidence: JSON.stringify(secondPacket.locks)
  },
  {
    name: "MCP advanced mode exposes and runs all-software observer supervisor",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("run_all_software_observer_supervisor") &&
      mcp.result.format === "transparent_ai_all_software_observer_supervisor_result_v1" &&
      mcp.result.backgroundTaskInstalled === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_observer_supervisor_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
