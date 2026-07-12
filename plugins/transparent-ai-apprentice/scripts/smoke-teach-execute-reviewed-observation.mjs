#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "..", "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const cacheSmokeRoot = join(resolve(process.env.TEMP || process.env.TMP || process.cwd()), "transparent-ai-apprentice-cache-smoke");
const outputRoot = existsSync(sourceServerScript) ? repoRoot : cacheSmokeRoot;
const serverCwd = existsSync(sourceServerScript) ? repoRoot : outputRoot;
const smokeRoot = join(outputRoot, ".transparent-apprentice", "teach-execute-reviewed-observation-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
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

async function callAdvancedTool(safeStartPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "start_teach_execute_reviewed_observation",
      arguments: {
        safeStartPath,
        goal: "Teacher confirmed read-only observation for all local software.",
        software: "all local software",
        teacherConfirmation: "I confirm read-only observation only.",
        maxProcesses: 8,
        maxInstalled: 10,
        maxCandidates: 4,
        outputDir: join(smokeRoot, "mcp-reviewed-observation")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachApprentice(safeStartPath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        safeStartPath,
        message: "我确认允许只读观察，先读取低 token 日志元数据并生成队列，不要执行软件。",
        software: "all local software",
        maxProcesses: 8,
        maxInstalled: 10,
        maxCandidates: 4,
        noWatchBaseline: true,
        outputDir: join(smokeRoot, "default-reviewed-observation")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const loop = runNodeScript("create-teach-execute-learning-loop.mjs", [
  "--goal",
  "Learn arbitrary software workflows from logs, transparent overlay sketches, dry-run receipts, and corrections.",
  "--software",
  "all local software",
  "--teacher-style",
  "mixed: logs, 2D/perspective/3D overlay, examples, corrections",
  "--output-dir",
  join(smokeRoot, "loop")
]);
const safeStart = runNodeScript("start-teach-execute-safe-run.mjs", [
  "--runbook-path",
  loop.runbookPath,
  "--goal",
  "Safely start the full goal runbook without executing software.",
  "--software",
  "all local software",
  "--output-dir",
  join(smokeRoot, "safe-start")
]);
const blocked = runNodeScript("start-teach-execute-reviewed-observation.mjs", [
  "--safe-start-path",
  safeStart.safeStartPath,
  "--goal",
  "Try observation without confirmation.",
  "--software",
  "all local software",
  "--output-dir",
  join(smokeRoot, "blocked-reviewed-observation")
]);
const direct = runNodeScript("start-teach-execute-reviewed-observation.mjs", [
  "--safe-start-path",
  safeStart.safeStartPath,
  "--goal",
  "Teacher confirmed read-only observation for all local software.",
  "--software",
  "all local software",
  "--teacher-confirmation",
  "I confirm read-only observation only.",
  "--max-processes",
  "8",
  "--max-installed",
  "10",
  "--max-candidates",
  "4",
  "--max-log-files-per-candidate",
  "2",
  "--max-files-per-candidate",
  "2",
  "--max-watch-items",
  "2",
  "--max-logs-per-item",
  "1",
  "--max-tail-lines",
  "20",
  "--max-tail-bytes",
  "8192",
  "--output-dir",
  join(smokeRoot, "direct-reviewed-observation")
]);

const directObservation = JSON.parse(readFileSync(direct.observationPath, "utf8"));
const directReceipt = JSON.parse(readFileSync(direct.receiptPath, "utf8"));
const blockedReceipt = JSON.parse(readFileSync(blocked.receiptPath, "utf8"));
const mcp = await callAdvancedTool(safeStart.safeStartPath);
const defaultCard = await callDefaultTeachApprentice(safeStart.safeStartPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Reviewed observation blocks without explicit teacher confirmation",
    pass:
      blocked.format === "transparent_ai_teach_execute_reviewed_observation_result_v1" &&
      blocked.status === "blocked_waiting_for_teacher_confirmation" &&
      blocked.didRunReadOnlyProbe === false &&
      blockedReceipt.didCreateQueue === false &&
      blockedReceipt.softwareActionsExecuted === false,
    evidence: blocked.receiptPath
  },
  {
    name: "Teacher-confirmed reviewed observation runs read-only inventory and creates queue",
    pass:
      direct.format === "transparent_ai_teach_execute_reviewed_observation_result_v1" &&
      direct.status === "waiting_for_teacher_observation_review" &&
      direct.didRunReadOnlyProbe === true &&
      direct.didCreateQueue === true &&
      existsSync(direct.reviewedInventoryPath) &&
      existsSync(direct.queuePath) &&
      direct.counts.rawCandidateCount >= direct.counts.reviewedCandidateCount &&
      direct.counts.queuedCount >= 0,
    evidence: direct.observationPath
  },
  {
    name: "Reviewed observation initializes bounded watch baseline without screenshots or execution",
    pass:
      direct.didInitializeWatchBaseline === true &&
      direct.watchCyclePath &&
      existsSync(direct.watchCyclePath) &&
      directReceipt.screenshotsCaptured === false &&
      directReceipt.fullContinuousRecording === false &&
      directReceipt.rawFullLogsRetained === false &&
      directReceipt.memoryEnabled === false &&
      directReceipt.accepted === false &&
      directReceipt.ruleEnabled === false &&
      directReceipt.packagingGated === true,
    evidence: direct.receiptPath
  },
  {
    name: "MCP advanced mode exposes and runs reviewed observation",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("start_teach_execute_reviewed_observation") &&
      mcp.result.format === "transparent_ai_teach_execute_reviewed_observation_result_v1" &&
      mcp.result.didRunReadOnlyProbe === true &&
      mcp.result.softwareActionsExecuted === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes safe-start path to reviewed observation card",
    pass:
      defaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultCard.status === "waiting_for_teach_execute_observation_review" &&
      defaultCard.teachExecuteReviewedObservation?.didRunReadOnlyProbe === true &&
      defaultCard.teachExecuteReviewedObservation?.didCreateQueue === true &&
      defaultCard.teachExecuteReviewedObservation?.didInitializeWatchBaseline === false &&
      defaultCard.teachExecuteReviewedObservation?.softwareActionsExecuted === false,
    evidence: defaultCard.teachExecuteReviewedObservation?.observationPath ?? ""
  },
  {
    name: "Reviewed observation preserves honest universal-execution boundary",
    pass:
      directObservation.locks.nativeUniversalExecution === false &&
      directObservation.locks.softwareActionsExecuted === false &&
      directObservation.lowTokenPolicy.logContentsReadByInventory === false &&
      directObservation.lowTokenPolicy.screenshotsCaptured === false &&
      directObservation.lowTokenPolicy.fullContinuousRecording === false &&
      directObservation.nextTeacherActions.some((item) => item.includes("Do not execute software actions")),
    evidence: direct.observationPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_teach_execute_reviewed_observation_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
