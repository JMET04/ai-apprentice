#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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

const teacherFacingNames = [
  "teach_apprentice",
  "show_teaching_card",
  "run_apprentice_profile",
  "review_apprentice_profile",
  "correct_last_result"
];

const requiredAdvancedNames = [
  "continue_teaching",
  "create_plugin_health_index",
  "create_plugin_manual_test_readiness_pack",
  "create_plugin_manual_test_result_receipt_template",
  "create_plugin_manual_test_session_packet",
  "validate_plugin_manual_test_result_receipt",
  "create_tlcl_direction_operational_console",
  "create_tlcl_next_route_input_contract",
  "create_tlcl_runtime_gate",
  "create_tlcl_reasoning_budget_governor",
  "create_tlcl_rag_evidence_attachment",
  "create_real_case_pilot_intake",
  "create_packaging_design_workflow"
];

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

function parseToolJson(result) {
  const text = result?.content?.[0]?.text;
  if (!text) throw new Error("MCP tool call did not return text content");
  return JSON.parse(text);
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"]
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
    for (const request of pending.values()) {
      request.reject(new Error(stderr || "MCP server exited before replying"));
    }
    pending.clear();
  });

  child.on("error", (error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  });

  function rpc(method, params = {}, timeoutMs = 10000) {
    const id = nextId++;
    const payload = `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
    child.stdin.write(payload);
    return withTimeout(new Promise((resolve, reject) => pending.set(id, { resolve, reject })), timeoutMs, method);
  }

  async function stop() {
    if (!child.killed) child.kill();
    await withTimeout(new Promise((resolve) => child.once("exit", resolve)), 5000, "mcp-server-stop").catch(() => {});
  }

  return { rpc, stop, stderr: () => stderr };
}

async function withServer(extraEnv, fn) {
  const server = startServer(extraEnv);
  try {
    await server.rpc("initialize", {}, 10000);
    server.rpc("notifications/initialized", {}, 3000).catch(() => {});
    return await fn(server);
  } finally {
    await server.stop();
  }
}

function namesFromList(listResult) {
  return (listResult.tools || []).map((tool) => tool.name).sort();
}

const defaultList = await withServer({}, (server) => server.rpc("tools/list", {}, 10000));
const defaultNames = namesFromList(defaultList);
check(
  "Default MCP surface is teacher-facing and bounded",
  defaultList.mode === "teacher_facing" &&
    defaultNames.length === teacherFacingNames.length &&
    teacherFacingNames.every((name) => defaultNames.includes(name)),
  `mode=${defaultList.mode}; tools=${defaultNames.join(",")}`
);

check(
  "Default MCP surface hides advanced construction tools",
  !defaultNames.includes("continue_teaching") &&
    !defaultNames.includes("create_plugin_health_index") &&
    !defaultNames.includes("create_tlcl_runtime_gate"),
  `tools=${defaultNames.join(",")}`
);

const advancedList = await withServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }, (server) =>
  server.rpc("tools/list", {}, 10000)
);
const advancedNames = namesFromList(advancedList);
const missingAdvancedNames = requiredAdvancedNames.filter((name) => !advancedNames.includes(name));
check(
  "Advanced MCP surface exposes the maintainer and TLCL core tools",
  advancedList.mode === "advanced" && advancedNames.length >= 300 && missingAdvancedNames.length === 0,
  `mode=${advancedList.mode}; tools=${advancedNames.length}; missing=${missingAdvancedNames.join(",") || "none"}`
);

const defaultTeachResult = await withServer({}, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "teach_apprentice",
        arguments: {
          message:
            "Prepare a handoff-oriented manual test card for the apprentice. Do not enable rules or write long-term memory.",
          profileName: "mcp-surface-fast-smoke"
        }
      },
      15000
    )
  )
);
const serializedTeachResult = JSON.stringify(defaultTeachResult);
check(
  "Default teach_apprentice returns a teacher-readable card without exposing internal ids",
  defaultTeachResult.ok === true &&
    serializedTeachResult.includes("teacher") &&
    !serializedTeachResult.includes("traceId") &&
    !serializedTeachResult.includes("ruleId") &&
    !serializedTeachResult.includes("demonstrationId"),
  `route=${defaultTeachResult.route || "unknown"}; bytes=${serializedTeachResult.length}`
);

const healthIndexResult = await withServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "create_plugin_health_index",
        arguments: {
          goal: "Fast MCP surface smoke should prove the maintainer health index tool is callable.",
          outDir: join(repoRoot, ".ta-smoke", "mcp-tool-surface-fast", "health-index")
        }
      },
      20000
    )
  )
);
check(
  "Advanced create_plugin_health_index is callable through MCP",
  healthIndexResult.responseMode === "transparent_ai_apprentice_plugin_health_index_result_v1" &&
    healthIndexResult.status === "ready_for_plugin_maintainer_review" &&
    Boolean(healthIndexResult.indexPath),
  `status=${healthIndexResult.status}; index=${healthIndexResult.indexPath || "missing"}`
);

const packagingWorkflowResult = await withServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" }, async (server) =>
  parseToolJson(
    await server.rpc(
      "tools/call",
      {
        name: "create_packaging_design_workflow",
        arguments: {
          action: "create",
          request: "Create a reviewed tuck-lock packaging workflow",
          productType: "tuck-lock folding carton",
          length: 200,
          width: 120,
          height: 60,
          unit: "mm",
          outputDir: join(repoRoot, ".ta-smoke", "mcp-tool-surface-fast", "packaging-workflow")
        }
      },
      15000
    )
  )
);
check(
  "Advanced packaging workflow starts at deep planning and keeps release locks closed",
  packagingWorkflowResult.ok === true &&
    packagingWorkflowResult.stage === "solution_planning" &&
    packagingWorkflowResult.locks?.accepted === false &&
    packagingWorkflowResult.locks?.ruleEnabled === false &&
    packagingWorkflowResult.locks?.packagingGated === true,
  `stage=${packagingWorkflowResult.stage}; session=${packagingWorkflowResult.sessionPath || "missing"}`
);

const passed = checks.filter((item) => item.pass).length;
const output = {
  responseMode: "transparent_ai_mcp_tool_surface_fast_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  command: "npm run smoke:plugin-tool-surface",
  fullRegressionCommand: "npm run smoke:plugin-tool-surface:full",
  serverScript,
  passed,
  total: checks.length,
  checks,
  nextAction:
    passed === checks.length
      ? "Use this fast gate for handoff checks; run the full MCP tool surface smoke only for deep regression."
      : "Fix failed MCP surface checks before treating the plugin install as ready for handoff."
};

console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") {
  process.exit(1);
}
