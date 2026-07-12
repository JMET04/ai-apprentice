#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "automatic-low-token-learning-schedule-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowershell(scriptPath, label) {
  const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", scriptPath, "-RunLabel", label], {
    cwd: outputRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptPath} failed`);
  return result;
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

async function callAdvancedSchedule(queuePath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_automatic_low_token_learning_schedule",
      arguments: {
        goal: "Schedule automatic low-token learning smoke.",
        queue: queuePath,
        taskName: "TransparentAI-Smoke-LowTokenLearning",
        intervalMinutes: 5,
        runsPerLaunch: 1,
        maxItems: 1,
        maxLogsPerItem: 1,
        maxTailBytes: 512,
        maxTailLines: 40,
        maxLearningItems: 1,
        outputDir: join(smokeRoot, "mcp-schedule")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultSchedule(queuePath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        message: "Please create a background low-token log learning schedule for this reviewed all-software queue.",
        queue: queuePath,
        automaticLowTokenLearningSchedule: true,
        intervalMinutes: 5,
        runsPerLaunch: 1,
        maxItems: 1,
        maxLogsPerItem: 1,
        maxTailBytes: 512,
        maxTailLines: 40,
        maxLearningItems: 1,
        outputDir: join(smokeRoot, "default-schedule")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const appLog = join(smokeRoot, "UniversalPlanner.log");
writeFileSync(appLog, "startup ready\n", "utf8");
const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "automatic-low-token-learning-schedule-smoke-queue",
  goal: "Schedule automatic low-token learning from reviewed all-software logs.",
  queue: [
    {
      queueItemId: "universalplanner",
      software: "UniversalPlanner",
      processName: "universalplanner.exe",
      score: 0.95,
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

const scheduleResult = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Schedule automatic low-token learning from reviewed all-software logs.",
  "--queue",
  queuePath,
  "--task-name",
  "TransparentAI-Smoke-LowTokenLearning",
  "--interval-minutes",
  "5",
  "--runs-per-launch",
  "1",
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
  "--output-dir",
  join(smokeRoot, "schedule")
]);
const schedule = readJson(scheduleResult.schedulePath);
const receipt = readJson(scheduleResult.receiptPath);

runPowershell(scheduleResult.runnerPath, "baseline");
appendFileSync(appLog, "WARN export mapping corrected by teacher after voice command\n", "utf8");
runPowershell(scheduleResult.runnerPath, "changed");

const changedRunRoot = join(schedule.runOutputDir, "changed");
const changedRunnerDir = readdirSync(changedRunRoot)
  .map((entry) => join(changedRunRoot, entry))
  .find((entry) => statSync(entry).isDirectory() && existsSync(join(entry, "automatic-low-token-learning-runner.json")));
if (!changedRunnerDir) throw new Error(`Changed scheduled run did not write a runner journal under ${changedRunRoot}`);
const changedJournal = readJson(join(changedRunnerDir, "automatic-low-token-learning-runner.json"));
const changedReceipt = readJson(join(changedRunnerDir, "automatic-low-token-learning-runner-receipt.json"));
const mcp = await callAdvancedSchedule(queuePath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const defaultCard = await callDefaultSchedule(queuePath);

const checks = [
  {
    name: "Automatic learning schedule package calls the low-token learning runner, not only observer supervisor",
    pass:
      scheduleResult.format === "transparent_ai_automatic_low_token_learning_schedule_result_v1" &&
      schedule.format === "transparent_ai_automatic_low_token_learning_schedule_v1" &&
      schedule.nextMcpCall.tool === "run_automatic_low_token_learning_runner" &&
      readFileSync(scheduleResult.runnerPath, "utf8").includes("run-automatic-low-token-learning-runner.mjs"),
    evidence: scheduleResult.schedulePath
  },
  {
    name: "Generated scheduled runner initializes baseline then learns only after changed metadata",
    pass:
      changedJournal.format === "transparent_ai_automatic_low_token_learning_runner_v1" &&
      changedJournal.totals.changedItems >= 1 &&
      changedJournal.totals.compactLearningEvents >= 1 &&
      changedJournal.automaticRunPolicy.metadataGateFirst === true &&
      changedJournal.automaticRunPolicy.skipTailWhenMetadataUnchanged === true,
    evidence: join(changedRunnerDir, "automatic-low-token-learning-runner.json")
  },
  {
    name: "Schedule registration remains teacher-confirmed and locks screenshots, memory, execution, and native universal claims",
    pass:
      receipt.scheduledTaskInstalled === false &&
      receipt.teacherConfirmationRequired === true &&
      receipt.fullContinuousRecording === false &&
      receipt.screenshotsCaptured === false &&
      receipt.rawFullLogsRetained === false &&
      receipt.softwareActionsExecuted === false &&
      receipt.longTermMemoryWritten === false &&
      receipt.nativeUniversalExecution === false &&
      changedReceipt.longTermMemoryWritten === false &&
      changedReceipt.nativeUniversalExecution === false,
    evidence: scheduleResult.receiptPath
  },
  {
    name: "Advanced MCP exposes and creates automatic low-token learning schedules",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_automatic_low_token_learning_schedule") &&
      mcp.result.format === "transparent_ai_automatic_low_token_learning_schedule_result_v1" &&
      mcp.result.scheduledTaskInstalled === false &&
      mcp.result.advancedRunnerTool === "run_automatic_low_token_learning_runner",
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes ordinary background low-token learning requests to the schedule package",
    pass:
      defaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultCard.status === "waiting_for_automatic_low_token_learning_schedule_review" &&
      defaultCard.automaticLowTokenLearningSchedule?.schedulePath &&
      defaultCard.automaticLowTokenLearningSchedule?.runnerPath &&
      defaultCard.automaticLowTokenLearningSchedule?.scheduledTaskInstalled === false &&
      defaultCard.reviewLocks?.accepted === false &&
      defaultCard.reviewLocks?.packagingGated === true,
    evidence: defaultCard.status || "missing status"
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_automatic_low_token_learning_schedule_smoke_v1",
  smokeRoot,
  schedulePath: scheduleResult.schedulePath,
  runnerPath: scheduleResult.runnerPath,
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
