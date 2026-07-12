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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "teach-execute-safe-start-smoke", String(Date.now()));
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

async function callAdvancedTool(runbookPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "start_teach_execute_safe_run",
      arguments: {
        runbookPath,
        goal: "Safely start a runbook without executing software.",
        software: "generic desktop app",
        teacherStyle: "logs, overlay sketches, corrections, and dry-run receipts",
        outputDir: join(smokeRoot, "mcp-safe-start")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachApprentice(runbookPath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        goal: "安全启动这个 runbook，不要执行软件，只生成审查材料",
        runbookPath,
        software: "generic desktop app",
        outputDir: join(smokeRoot, "default-safe-start")
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
  "generic desktop app",
  "--teacher-style",
  "mixed: logs, 2D/perspective/3D overlay, examples, corrections",
  "--output-dir",
  join(smokeRoot, "loop")
]);

const direct = runNodeScript("start-teach-execute-safe-run.mjs", [
  "--runbook-path",
  loop.runbookPath,
  "--goal",
  "Safely start the full goal runbook without executing software.",
  "--software",
  "generic desktop app",
  "--teacher-style",
  "mixed: logs, overlay, corrections, dry-run receipts",
  "--output-dir",
  join(smokeRoot, "direct-safe-start")
]);

const safeStart = JSON.parse(readFileSync(direct.safeStartPath, "utf8"));
const receipt = JSON.parse(readFileSync(direct.receiptPath, "utf8"));
const blockedActions = JSON.parse(readFileSync(direct.blockedActionsPath, "utf8"));
const mcp = await callAdvancedTool(loop.runbookPath);
const defaultCard = await callDefaultTeachApprentice(loop.runbookPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const stageIds = safeStart.stageResults.map((stage) => stage.stageId);

const checks = [
  {
    name: "Direct safe start generates review-only starter materials from a runbook",
    pass:
      direct.format === "transparent_ai_teach_execute_safe_start_result_v1" &&
      safeStart.format === "transparent_ai_teach_execute_safe_start_v1" &&
      receipt.format === "transparent_ai_teach_execute_safe_start_receipt_v1" &&
      stageIds.includes("teacher_method_profile") &&
      stageIds.includes("all_software_observer_bootstrap") &&
      stageIds.includes("transparent_overlay") &&
      stageIds.includes("execution_adapter_selection"),
    evidence: direct.safeStartPath
  },
  {
    name: "Safe start reuses existing tools instead of building a separate automation stack",
    pass:
      safeStart.stageResults.some((stage) => stage.scriptName === "create-teacher-learning-method-profile.mjs") &&
      safeStart.stageResults.some((stage) => stage.scriptName === "create-all-software-observer-bootstrap.mjs") &&
      safeStart.stageResults.some((stage) => stage.scriptName === "create-transparent-sketch-overlay-kit.mjs") &&
      safeStart.stageResults.some((stage) => stage.scriptName === "create-existing-software-execution-adapter.mjs"),
    evidence: safeStart.stageResults.map((stage) => stage.scriptName).join(",")
  },
  {
    name: "Safe start keeps all execution and learning locks closed",
    pass:
      receipt.softwareActionsExecuted === false &&
      receipt.screenshotsCaptured === false &&
      receipt.fullContinuousRecording === false &&
      receipt.rawFullLogsRetained === false &&
      receipt.scheduledTaskRegistered === false &&
      receipt.memoryEnabled === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true &&
      safeStart.locks.nativeUniversalExecution === false,
    evidence: direct.receiptPath
  },
  {
    name: "Safe start creates transparent drawing mask, control-channel profile, and existing execution adapter materials",
    pass:
      existsSync(safeStart.evidence.transparentOverlayBrowser) &&
      existsSync(safeStart.evidence.transparentOverlayPowerShell) &&
      existsSync(safeStart.evidence.sampleSketchPacket) &&
      existsSync(safeStart.evidence.softwareControlChannelProfile) &&
      existsSync(safeStart.evidence.softwareControlChannelAdapterRequest) &&
      existsSync(safeStart.evidence.executionAdapterSelection) &&
      existsSync(safeStart.evidence.executionPackage) &&
      blockedActions.blocked.includes("do not execute generated runners"),
    evidence: safeStart.evidence.transparentOverlayManifest
  },
  {
    name: "MCP advanced mode exposes and runs safe start",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("start_teach_execute_safe_run") &&
      mcp.result.format === "transparent_ai_teach_execute_safe_start_result_v1" &&
      mcp.result.softwareActionsExecuted === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes a runbook path to safe start card",
    pass:
      defaultCard.format === "transparent_ai_teach_apprentice_card_v1" &&
      defaultCard.status === "waiting_for_teach_execute_safe_start_review" &&
      defaultCard.teachExecuteSafeStart?.softwareActionsExecuted === false &&
      defaultCard.teachExecuteSafeStart?.scheduledTaskRegistered === false,
    evidence: defaultCard.teachExecuteSafeStart?.safeStartPath ?? ""
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_teach_execute_safe_start_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
