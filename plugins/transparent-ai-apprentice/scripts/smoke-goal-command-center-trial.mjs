#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "goal-command-center-trial-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [join(pluginRoot, "scripts", "mcp-server.mjs")], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let id = 1;
  const pending = new Map();
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    const lines = stdout.split(/\r?\n/);
    stdout = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
    }
  });
  function rpc(method, params = {}) {
    const requestId = id++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })}\n`);
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
  }
  async function stop() {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  return { rpc, stop };
}

function parseTextResult(result) {
  return JSON.parse(result.content[0].text);
}

const commonGoal =
  "Run one bounded command-center low-token trial for all local software without screenshots, software execution, or memory writes.";

const blocked = runNodeScript("run-goal-command-center-trial.mjs", [
  "--goal",
  commonGoal,
  "--software",
  "all local software",
  "--command",
  "Observe what changed, but do not execute anything.",
  "--no-port-scan",
  "--max-processes",
  "4",
  "--max-installed",
  "4",
  "--max-candidates",
  "3",
  "--output-dir",
  join(smokeRoot, "blocked")
]);
const blockedTrial = readJson(blocked.trialPath);
const blockedReceipt = readJson(blocked.receiptPath);

const reviewed = runNodeScript("run-goal-command-center-trial.mjs", [
  "--goal",
  commonGoal,
  "--software",
  "all local software",
  "--command",
  "Observe what changed, but do not execute anything.",
  "--teacher-reviewed",
  "--no-port-scan",
  "--max-processes",
  "4",
  "--max-installed",
  "4",
  "--max-candidates",
  "3",
  "--max-items",
  "3",
  "--max-log-files-per-candidate",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-lines",
  "8",
  "--max-tail-bytes",
  "2048",
  "--output-dir",
  join(smokeRoot, "reviewed")
]);
const reviewedTrial = readJson(reviewed.trialPath);
const reviewedReceipt = readJson(reviewed.receiptPath);
const learningReceipt = readJson(reviewed.learningReceiptPath);

const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
let toolList;
let mcp;
try {
  await server.rpc("initialize", {});
  server.rpc("notifications/initialized", {}).catch(() => {});
  toolList = await server.rpc("tools/list", {});
  mcp = parseTextResult(await server.rpc("tools/call", {
    name: "run_goal_command_center_trial",
    arguments: {
      goal: commonGoal,
      software: "all local software",
      command: "Prepare the trial receipt, but wait for teacher review.",
      maxProcesses: 4,
      maxInstalled: 4,
      maxCandidates: 3,
      noPortScan: true,
      outputDir: join(smokeRoot, "mcp")
    }
  }));
} finally {
  await server.stop();
}

const advancedNames = toolList.tools.map((tool) => tool.name);
const mcpTrial = readJson(mcp.trialPath);

const checks = [
  {
    name: "Trial blocks before teacher review and does not run inventory or learning",
    pass:
      blocked.format === "transparent_ai_goal_command_center_trial_result_v1" &&
      blocked.status === "blocked_waiting_for_teacher_review" &&
      blocked.trialRan === false &&
      blockedTrial.trialRan === false &&
      blockedTrial.paths.inventory === "" &&
      blockedReceipt.blockedDecisions.includes("execute_now") &&
      blockedTrial.locks.softwareActionsExecuted === false &&
      blockedTrial.locks.screenshotsCaptured === false,
    evidence: blocked.trialPath
  },
  {
    name: "Teacher-reviewed trial runs bounded read-only inventory and metadata-first low-token cycle",
    pass:
      reviewed.trialRan === true &&
      existsSync(reviewed.inventoryPath) &&
      existsSync(reviewed.learningCyclePath) &&
      existsSync(reviewed.learningReceiptPath) &&
      reviewedTrial.counts.inventorySoftwareCandidates <= 8 &&
      learningReceipt.metadataDeltaGateEnabled === true &&
      learningReceipt.softwareActionsExecuted === false &&
      learningReceipt.screenshotsCaptured === false &&
      learningReceipt.longTermMemoryWritten === false,
    evidence: `${reviewed.inventoryPath}; ${reviewed.learningReceiptPath}`
  },
  {
    name: "Trial receipt keeps acceptance, memory, native execution, and packaging locked",
    pass:
      reviewedReceipt.defaultDecision === "needs_teacher_review" &&
      reviewedReceipt.blockedDecisions.includes("accepted") &&
      reviewedReceipt.blockedDecisions.includes("enable_memory") &&
      reviewedReceipt.blockedDecisions.includes("native_universal_execution") &&
      reviewedReceipt.blockedDecisions.includes("unlock_packaging") &&
      reviewedTrial.locks.memoryWritten === false &&
      reviewedTrial.locks.nativeUniversalExecution === false &&
      reviewedTrial.locks.packagingGated === true,
    evidence: reviewed.receiptPath
  },
  {
    name: "MCP advanced tool exposes blocked command-center trial entry",
    pass:
      advancedNames.includes("run_goal_command_center_trial") &&
      mcp.format === "transparent_ai_goal_command_center_trial_result_v1" &&
      mcp.status === "blocked_waiting_for_teacher_review" &&
      mcpTrial.locks.teacherConfirmationRequiredBeforeTrial === true,
    evidence: mcp.trialPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_goal_command_center_trial_smoke_v1",
  smokeRoot,
  paths: {
    blockedTrial: blocked.trialPath,
    reviewedTrial: reviewed.trialPath,
    inventory: reviewed.inventoryPath,
    learningReceipt: reviewed.learningReceiptPath,
    mcpTrial: mcp.trialPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
