#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "automatic-low-token-learning-runner-smoke", String(Date.now()));
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

async function callAdvancedRunner(queuePath, stateDir) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "run_automatic_low_token_learning_runner",
      arguments: {
        goal: "Automatically learn from reviewed queue metadata deltas.",
        queue: queuePath,
        stateDir,
        runs: 1,
        maxItems: 2,
        maxLogsPerItem: 2,
        maxTailBytes: 512,
        maxTailLines: 40,
        maxLearningItems: 1,
        teacherMarkers: ["advanced runner smoke marker"],
        outputDir: join(smokeRoot, "mcp-runner")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const appLog = join(smokeRoot, "DesignPlanner.log");
writeFileSync(appLog, "startup ready\n", "utf8");
const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "automatic-low-token-learning-runner-smoke-queue",
  goal: "Automatically learn from reviewed all-software logs with low tokens.",
  queue: [
    {
      queueItemId: "designplanner",
      software: "DesignPlanner",
      processName: "designplanner.exe",
      score: 0.94,
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
const stateDir = join(smokeRoot, "persistent-state");

const baseline = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
  "--goal",
  "Automatically learn from reviewed all-software logs with low tokens.",
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

appendFileSync(appLog, "ERROR sketch constraint failed after imported DXF changed\n", "utf8");

const changed = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
  "--goal",
  "Automatically learn from reviewed all-software logs with low tokens.",
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
  "teacher labels imported DXF constraint failure as reusable signal",
  "--output-dir",
  join(smokeRoot, "changed-runner")
]);

const baselineJournal = readJson(baseline.journalPath);
const changedJournal = readJson(changed.journalPath);
const changedReceipt = readJson(changed.receiptPath);
const compactPath = changedJournal.runRecords.find((record) => record.compactLearningEvents > 0)?.nextTeachingCall?.arguments?.message || "";
const mcp = await callAdvancedRunner(queuePath, stateDir);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Automatic runner initializes persistent baseline without learning from unchanged startup state",
    pass:
      baseline.format === "transparent_ai_automatic_low_token_learning_runner_result_v1" &&
      baselineJournal.format === "transparent_ai_automatic_low_token_learning_runner_v1" &&
      baselineJournal.status === "baseline_initialized_waiting_for_next_automatic_run" &&
      baselineJournal.totals.compactLearningEvents === 0 &&
      baselineJournal.automaticRunPolicy.metadataGateFirst === true,
    evidence: baseline.journalPath
  },
  {
    name: "Automatic runner detects changed log metadata and creates compact learning events",
    pass:
      changed.status === "learning_events_waiting_for_teacher_review" &&
      changedJournal.totals.changedItems >= 1 &&
      changedJournal.totals.compactLearningEvents >= 1 &&
      changedJournal.nextTeachingCalls.length >= 1 &&
      String(compactPath).includes("learning-cycle receipt"),
    evidence: changed.journalPath
  },
  {
    name: "Automatic runner preserves low-token and review-only locks across runs",
    pass:
      changedReceipt.fullContinuousRecording === false &&
      changedReceipt.screenshotsCaptured === false &&
      changedReceipt.rawFullLogsRetained === false &&
      changedReceipt.softwareActionsExecuted === false &&
      changedReceipt.longTermMemoryWritten === false &&
      changedReceipt.nativeUniversalExecution === false &&
      changedJournal.locks.memoryEnabled === false &&
      changedJournal.locks.packagingGated === true,
    evidence: changed.receiptPath
  },
  {
    name: "Automatic runner can be called through advanced MCP",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("run_automatic_low_token_learning_runner") &&
      mcp.result.format === "transparent_ai_automatic_low_token_learning_runner_result_v1" &&
      mcp.result.fullContinuousRecording === false &&
      mcp.result.longTermMemoryWritten === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_automatic_low_token_learning_runner_smoke_v1",
  smokeRoot,
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
