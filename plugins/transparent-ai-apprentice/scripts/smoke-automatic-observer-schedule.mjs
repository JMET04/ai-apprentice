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
const smokeRoot = join(repoRoot, ".transparent-apprentice", "automatic-observer-schedule-smoke", String(Date.now()));
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

async function callAdvancedSchedule(queuePath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_automatic_observer_schedule",
      arguments: {
        goal: "Run automatic low-token observation only from a reviewed queue.",
        queue: queuePath,
        taskName: "TransparentAI-Smoke-LowTokenObserver",
        intervalMinutes: 5,
        cyclesPerRun: 1,
        maxItems: 2,
        maxLogsPerItem: 2,
        maxTailBytes: 512,
        outputDir: join(smokeRoot, "mcp-schedule")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const appLog = join(smokeRoot, "accounting-app.log");
writeFileSync(appLog, "ready\n", "utf8");
const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "automatic-schedule-smoke-queue",
  queue: [
    {
      queueItemId: "accounting-app",
      software: "AccountingApp",
      processName: "accounting.exe",
      score: 0.92,
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
writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf8");

const direct = runNodeScript("create-automatic-observer-schedule.mjs", [
  "--goal",
  "Automatically watch reviewed software queue with low token budget.",
  "--queue",
  queuePath,
  "--task-name",
  "TransparentAI-Smoke-LowTokenObserver",
  "--interval-minutes",
  "5",
  "--cycles-per-run",
  "1",
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512",
  "--output-dir",
  join(smokeRoot, "direct-schedule")
]);
const schedule = JSON.parse(readFileSync(direct.schedulePath, "utf8"));
const receipt = JSON.parse(readFileSync(direct.receiptPath, "utf8"));
const registerText = readFileSync(direct.registerPath, "utf8");
const runnerText = readFileSync(direct.runnerPath, "utf8");
const mcp = await callAdvancedSchedule(queuePath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Direct script creates a review-only automatic observer schedule package",
    pass:
      direct.format === "transparent_ai_automatic_observer_schedule_result_v1" &&
      schedule.format === "transparent_ai_automatic_observer_schedule_v1" &&
      receipt.format === "transparent_ai_automatic_observer_schedule_receipt_v1" &&
      direct.taskRegistered === false &&
      direct.scheduledTaskInstalled === false,
    evidence: direct.schedulePath
  },
  {
    name: "Schedule uses bounded supervisor runs instead of continuous recording",
    pass:
      schedule.schedulePolicy.boundedPeriodicRun === true &&
      schedule.schedulePolicy.continuousRecording === false &&
      schedule.limits.fullLogsRead === false &&
      schedule.limits.screenshotsCapturedByScheduler === false &&
      runnerText.includes("run-all-software-observer-supervisor.mjs"),
    evidence: JSON.stringify(schedule.schedulePolicy)
  },
  {
    name: "Registration script requires explicit teacher confirmation",
    pass:
      registerText.includes("TeacherConfirmed is required") &&
      registerText.includes("Register-ScheduledTask") &&
      schedule.schedulePolicy.requiresTeacherConfirmedFlag === true &&
      schedule.locks.teacherConfirmationRequired === true,
    evidence: direct.registerPath
  },
  {
    name: "Schedule preserves no native-universal-execution claim",
    pass:
      schedule.locks.nativeUniversalExecution === false &&
      schedule.locks.ruleEnabled === false &&
      schedule.locks.packagingGated === true &&
      receipt.nativeUniversalExecution === false,
    evidence: JSON.stringify(schedule.locks)
  },
  {
    name: "MCP advanced mode exposes and runs automatic observer schedule creator",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_automatic_observer_schedule") &&
      mcp.result.format === "transparent_ai_automatic_observer_schedule_result_v1" &&
      mcp.result.scheduledTaskInstalled === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_automatic_observer_schedule_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
