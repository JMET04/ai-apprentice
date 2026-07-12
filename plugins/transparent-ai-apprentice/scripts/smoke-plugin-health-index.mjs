#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const outDir = join(repoRoot, ".ta-smoke", "plugin-health-index");
const mcpOutDir = join(repoRoot, ".ta-smoke", "plugin-health-index-mcp");
const serverScript = "plugins/transparent-ai-apprentice/scripts/mcp-server.mjs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass, evidence });
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
  const pending = new Map();
  let stdoutBuffer = "";
  let stderr = "";

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
    for (const request of pending.values()) {
      request.reject(new Error(stderr || "MCP server exited before replying"));
    }
    pending.clear();
  });

  function rpc(method, params = {}) {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return withTimeout(new Promise((resolve, reject) => pending.set(id, { resolve, reject })), 10000, method);
  }

  async function stop() {
    if (!child.killed) child.kill();
    await withTimeout(new Promise((resolve) => child.once("exit", resolve)), 5000, "mcp-server-stop").catch(() => {});
  }

  return { rpc, stop, stderr: () => stderr };
}

async function callHealthIndexOverMcp() {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const toolsResult = await server.rpc("tools/list", {});
    const callResult = await server.rpc("tools/call", {
      name: "create_plugin_health_index",
      arguments: {
        goal: "Smoke-test the MCP-exposed plugin health index tool.",
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
    join(pluginRoot, "scripts", "create-plugin-health-index.mjs"),
    "--goal",
    "Smoke-test the plugin health index maintainer entrypoint.",
    "--out-dir",
    outDir
  ],
  { cwd: repoRoot, encoding: "utf8" }
);

if (result.status !== 0) {
  throw new Error(`Health index generation failed:\n${result.stdout}\n${result.stderr}`);
}

const generated = JSON.parse(result.stdout);
const index = readJson(generated.indexPath);

check(
  "Plugin health index maps manifest MCP skills scripts and package commands",
  generated.responseMode === "transparent_ai_apprentice_plugin_health_index_result_v1" &&
    index.responseMode === "transparent_ai_apprentice_plugin_health_index_v1" &&
    generated.status === "ready_for_plugin_maintainer_review" &&
    index.status === "ready_for_plugin_maintainer_review",
  `status=${index.status}; checks=${generated.passed}/${generated.total}`
);

check(
  "Health index writes readable JSON and Markdown artifacts",
  existsSync(generated.indexPath) && existsSync(generated.markdownPath),
  `${generated.indexPath}; ${generated.markdownPath}`
);

check(
  "Health index captures the large plugin surface without running it",
  index.counts.pluginFiles >= 500 &&
    index.counts.scriptFiles >= 300 &&
    index.counts.smokeScripts >= 100 &&
    index.counts.mcpTools >= 50,
  `files=${index.counts.pluginFiles}; scripts=${index.counts.scriptFiles}; smoke=${index.counts.smokeScripts}; tools=${index.counts.mcpTools}`
);

check(
  "Health index keeps review-only safety locks closed",
  index.safetyBoundary.reviewOnly === true &&
    index.safetyBoundary.invokesModels === false &&
    index.safetyBoundary.executesTargetSoftware === false &&
    index.safetyBoundary.writesMemory === false &&
    index.safetyBoundary.enablesRules === false &&
    index.safetyBoundary.unlocksPackaging === false &&
    index.safetyBoundary.claimsCompletion === false,
  JSON.stringify(index.safetyBoundary)
);

check(
  "Health index exposes a short maintainer route before broad verify",
  index.primaryRoutes.some((route) => route.command === "npm run build:plugin-health-index") &&
    index.primaryRoutes.some((route) => route.command === "npm run smoke:plugin-health-index") &&
    index.primaryRoutes.some((route) => route.command === "npm run smoke:plugin-tool-surface") &&
    index.primaryRoutes.some((route) => route.command === "npm run smoke:plugin-manual-test-readiness") &&
    index.primaryRoutes.some((route) => route.command === "npm run smoke:plugin-manual-test-result-receipt") &&
    index.primaryRoutes.some((route) => route.command === "npm run smoke:plugin-manual-test-session-packet") &&
    index.primaryRoutes.some((route) => route.command === "npm run verify:plugin"),
  index.primaryRoutes.map((route) => route.command).join(" -> ")
);

check(
  "Health index requires the new package command contract",
    index.commandContract.missingPackageScripts.length === 0 &&
    index.commandContract.requiredPackageScripts.some((script) => script.name === "build:plugin-health-index" && script.present) &&
    index.commandContract.requiredPackageScripts.some((script) => script.name === "smoke:plugin-health-index" && script.present) &&
    index.commandContract.requiredPackageScripts.some(
      (script) => script.name === "build:plugin-manual-test-readiness" && script.present
    ) &&
    index.commandContract.requiredPackageScripts.some(
      (script) => script.name === "smoke:plugin-manual-test-readiness" && script.present
    ) &&
    index.commandContract.requiredPackageScripts.some(
      (script) => script.name === "build:plugin-manual-test-result-receipt-template" && script.present
    ) &&
    index.commandContract.requiredPackageScripts.some(
      (script) => script.name === "smoke:plugin-manual-test-result-receipt" && script.present
    ) &&
    index.commandContract.requiredPackageScripts.some(
      (script) => script.name === "build:plugin-manual-test-session-packet" && script.present
    ) &&
    index.commandContract.requiredPackageScripts.some(
      (script) => script.name === "smoke:plugin-manual-test-session-packet" && script.present
    ) &&
    index.commandContract.requiredPackageScripts.some((script) => script.name === "smoke:plugin-tool-surface" && script.present) &&
    index.commandContract.requiredPackageScripts.some((script) => script.name === "smoke:plugin-tool-surface:full" && script.present),
  `missing=${index.commandContract.missingPackageScripts.join(",") || "none"}`
);

check(
  "Health index MCP core list includes teacher and TLCL entry tools",
    index.mcpSurface.coreTools.every((tool) => tool.present) &&
    index.mcpSurface.coreTools.some((tool) => tool.name === "continue_teaching") &&
    index.mcpSurface.coreTools.some((tool) => tool.name === "create_plugin_health_index") &&
    index.mcpSurface.coreTools.some((tool) => tool.name === "create_plugin_manual_test_readiness_pack") &&
    index.mcpSurface.coreTools.some((tool) => tool.name === "create_plugin_manual_test_result_receipt_template") &&
    index.mcpSurface.coreTools.some((tool) => tool.name === "create_plugin_manual_test_session_packet") &&
    index.mcpSurface.coreTools.some((tool) => tool.name === "validate_plugin_manual_test_result_receipt"),
  index.mcpSurface.coreTools.map((tool) => `${tool.name}:${tool.present}`).join(",")
);

const mcpHealth = await callHealthIndexOverMcp();
check(
  "MCP advanced mode lists and calls create_plugin_health_index",
  mcpHealth.listed.some((tool) => tool.name === "create_plugin_health_index") &&
    mcpHealth.result.responseMode === "transparent_ai_apprentice_plugin_health_index_result_v1" &&
    mcpHealth.result.status === "ready_for_plugin_maintainer_review" &&
    existsSync(mcpHealth.result.indexPath),
  `listed=${mcpHealth.listed.length}; status=${mcpHealth.result.status}; index=${mcpHealth.result.indexPath}`
);

const passed = checks.filter((item) => item.pass).length;
const output = {
  responseMode: "transparent_ai_apprentice_plugin_health_index_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  command: "npm run smoke:plugin-health-index",
  passed,
  total: checks.length,
  checks,
  nextAction:
    passed === checks.length
      ? "Use the generated plugin health index before choosing the next deep optimization lane."
      : "Fix failed health index checks before adding more plugin surfaces."
};

console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") {
  process.exit(1);
}
