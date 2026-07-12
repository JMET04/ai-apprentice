#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(sourceRepoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const runsFromSourceTree = existsSync(sourceServerScript);
const repoRoot = runsFromSourceTree ? sourceRepoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;
const outDir = join(repoRoot, ".ta-smoke", "plugin-manual-test-readiness");
const mcpOutDir = join(repoRoot, ".ta-smoke", "plugin-manual-test-readiness-mcp");

const checks = [];

function check(name, pass, evidence = "") {
  checks.push({ name, pass, evidence });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function withTimeout(promise, ms, label) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function startServer() {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }
  });
  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";
  const pending = new Map();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
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
  child.on("exit", () => {
    for (const request of pending.values()) request.reject(new Error(stderr || "MCP server exited before replying"));
    pending.clear();
  });

  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return withTimeout(new Promise((resolve, reject) => pending.set(id, { resolve, reject })), 15000, method);
  }

  async function stop() {
    if (!child.killed) child.kill();
    await withTimeout(new Promise((resolve) => child.once("exit", resolve)), 5000, "mcp-server-stop").catch(() => {});
  }

  return { rpc, stop };
}

async function callManualTestReadinessOverMcp() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const toolsResult = await server.rpc("tools/list", {});
    const callResult = await server.rpc("tools/call", {
      name: "create_plugin_manual_test_readiness_pack",
      arguments: {
        goal: "Smoke-test MCP generation of the manual test readiness pack.",
        outDir: mcpOutDir
      }
    });
    return {
      listed: toolsResult.tools || [],
      result: JSON.parse(callResult.content[0].text)
    };
  } finally {
    await server.stop();
  }
}

const result = spawnSync(
  process.execPath,
  [
    join(pluginRoot, "scripts", "create-plugin-manual-test-readiness-pack.mjs"),
    "--goal",
    "Smoke-test the manual handoff readiness pack.",
    "--out-dir",
    outDir
  ],
  { cwd: repoRoot, encoding: "utf8" }
);

if (result.status !== 0) {
  throw new Error(`Manual test readiness generation failed:\n${result.stdout}\n${result.stderr}`);
}

const generated = JSON.parse(result.stdout);
const pack = readJson(generated.packPath);

check(
  "Manual test readiness pack declares human testing readiness without product acceptance",
  generated.responseMode === "transparent_ai_apprentice_manual_test_readiness_pack_result_v1" &&
    pack.responseMode === "transparent_ai_apprentice_manual_test_readiness_pack_v1" &&
    generated.status === "ready_for_human_manual_testing" &&
    pack.manualTestStatus.readyForHumanTesting === true &&
    pack.manualTestStatus.productAcceptanceClaimed === false,
  `status=${pack.status}; scenarios=${pack.scenarios.length}`
);

check(
  "Manual test readiness pack writes JSON Markdown and HTML start files",
  existsSync(generated.packPath) && existsSync(generated.markdownPath) && existsSync(generated.htmlPath),
  `${generated.packPath}; ${generated.markdownPath}; ${generated.htmlPath}`
);

check(
  "Manual test scenarios cover teacher visual correction TLCL and real-case lanes",
  pack.scenarios.some((scenario) => scenario.id === "first_teacher_entry") &&
    pack.scenarios.some((scenario) => scenario.id === "visual_demonstration") &&
    pack.scenarios.some((scenario) => scenario.id === "correction_memory_loop") &&
    pack.scenarios.some((scenario) => scenario.id === "tlcl_direction_and_runtime_safety") &&
    pack.scenarios.some((scenario) => scenario.id === "real_case_pilot"),
  pack.scenarios.map((scenario) => scenario.id).join(",")
);

check(
  "Manual test readiness pack keeps review-only safety locks closed",
  pack.safetyBoundary.reviewOnly === true &&
    pack.safetyBoundary.invokesModels === false &&
    pack.safetyBoundary.executesTargetSoftware === false &&
    pack.safetyBoundary.writesMemory === false &&
    pack.safetyBoundary.enablesRules === false &&
    pack.safetyBoundary.unlocksPackaging === false &&
    pack.safetyBoundary.claimsProductAcceptance === false,
  JSON.stringify(pack.safetyBoundary)
);

const mcpReadiness = await callManualTestReadinessOverMcp();
check(
  "MCP advanced mode lists and calls create_plugin_manual_test_readiness_pack",
  mcpReadiness.listed.some((tool) => tool.name === "create_plugin_manual_test_readiness_pack") &&
    mcpReadiness.result.responseMode === "transparent_ai_apprentice_manual_test_readiness_pack_result_v1" &&
    mcpReadiness.result.status === "ready_for_human_manual_testing" &&
    existsSync(mcpReadiness.result.packPath),
  `listed=${mcpReadiness.listed.length}; status=${mcpReadiness.result.status}; pack=${mcpReadiness.result.packPath}`
);

const passed = checks.filter((item) => item.pass).length;
const output = {
  responseMode: "transparent_ai_apprentice_manual_test_readiness_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  command: "npm run smoke:plugin-manual-test-readiness",
  passed,
  total: checks.length,
  checks,
  nextAction:
    passed === checks.length
      ? "Use MANUAL_TEST_READINESS_START_HERE.md as the next human testing handoff."
      : "Fix failed manual readiness checks before a formal human test pass."
};

console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") {
  process.exit(1);
}
