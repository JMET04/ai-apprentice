#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "software-observer-queue-smoke", String(Date.now()));
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

const fakeRoot = join(smokeRoot, "fake-appdata");
const browserRoot = join(fakeRoot, "BrowserCRM");
const editorRoot = join(fakeRoot, "StudioEditor");
const noLogRoot = join(fakeRoot, "NoLogPlanner");
mkdirSync(browserRoot, { recursive: true });
mkdirSync(editorRoot, { recursive: true });
mkdirSync(noLogRoot, { recursive: true });
writeFileSync(join(browserRoot, "BrowserCRM-service.log"), "saved customer case\nwarning: missing tag\n", "utf8");
writeFileSync(join(editorRoot, "StudioEditor-export.jsonl"), "{\"event\":\"exported\"}\n", "utf8");

const inventoryPath = join(smokeRoot, "software-observer-inventory.json");
writeFileSync(inventoryPath, JSON.stringify({
  format: "transparent_ai_software_observer_inventory_v1",
  inventoryId: "smoke-inventory",
  goal: "Learn across all local software using low-token evidence.",
  softwareCandidates: [
    {
      software: "BrowserCRM",
      processName: "BrowserCRM",
      windowTitle: "Browser CRM - customer queue",
      candidateLogRoots: [browserRoot],
      candidateLogFiles: [
        {
          path: join(browserRoot, "BrowserCRM-service.log"),
          bytes: 42,
          lastWriteTimeUtc: new Date().toISOString(),
          extension: ".log",
          lowTokenUse: "metadata_first_then_tail_on_trigger"
        }
      ],
      windowsEventLogs: ["Application"],
      confidence: 0.72,
      reason: "running_process_metadata"
    },
    {
      software: "StudioEditor",
      processName: "StudioEditor",
      candidateLogRoots: [editorRoot],
      windowsEventLogs: ["Application", "System"],
      confidence: 0.58,
      reason: "installed_application_registry"
    },
    {
      software: "NoLogPlanner",
      processName: "NoLogPlanner",
      windowTitle: "No Log Planner",
      candidateLogRoots: [noLogRoot],
      windowsEventLogs: ["Application", "System"],
      confidence: 0.55,
      reason: "running_process_without_log_candidate"
    }
  ],
  locks: {
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
}, null, 2), "utf8");

async function callAdvancedTool() {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_software_observer_queue",
      arguments: {
        inventory: inventoryPath,
        outputDir: join(smokeRoot, "mcp-queue"),
        maxCandidates: 5,
        maxFilesPerCandidate: 4
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const direct = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--output-dir",
  join(smokeRoot, "direct-queue"),
  "--max-candidates",
  "5",
  "--max-files-per-candidate",
  "4"
]);
const mcp = await callAdvancedTool();
const queue = JSON.parse(readFileSync(direct.queuePath, "utf8"));
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const browserQueue = queue.queue.find((item) => item.software === "BrowserCRM");
const noLogQueue = queue.queue.find((item) => item.software === "NoLogPlanner");
const checks = [
  {
    name: "Queue turns all-software inventory into per-software observer next steps",
    pass:
      direct.format === "transparent_ai_software_observer_queue_result_v1" &&
      queue.format === "transparent_ai_software_observer_queue_v1" &&
      queue.queue.length === 3 &&
      browserQueue?.nextObserverCall?.tool === "create_universal_software_observer_kit" &&
      browserQueue?.nextRunCall?.tool === "run_software_observer_queue_item" &&
      browserQueue?.nextDeltaMonitorCall?.tool === "monitor_software_observation_deltas" &&
      browserQueue?.nextProfileCall?.tool === "create_software_capability_profile",
    evidence: direct.queuePath
  },
  {
    name: "Queue finds bounded log candidates without reading full logs",
    pass:
      queue.boundedScan.fullLogsRead === false &&
      queue.boundedScan.logContentsRead === false &&
      queue.boundedScan.fullContinuousRecording === false &&
      browserQueue?.indexedLogCandidateCount === 1 &&
      browserQueue?.recentLogCandidates?.some((log) => log.path.endsWith("BrowserCRM-service.log")),
    evidence: JSON.stringify(queue.boundedScan)
  },
  {
    name: "Queue supports non-CAD apps and keeps native execution locked",
    pass:
      queue.queue.some((item) => item.software === "BrowserCRM") &&
      queue.queue.some((item) => item.software === "StudioEditor") &&
      queue.queue.some((item) => item.software === "NoLogPlanner") &&
      queue.locks.nativeUniversalExecution === false &&
      queue.locks.packagingGated === true,
    evidence: queue.queue.map((item) => item.software).join(",")
  },
  {
    name: "Queue creates non-log fallback route when no candidate logs are found",
    pass:
      noLogQueue?.logAvailability === "no_candidate_logs_found" &&
      noLogQueue?.nonLogFallbackRequired === true &&
      noLogQueue?.nonLogFallbackSignals?.some((signal) => signal.sourceType === "windows_event_log") &&
      noLogQueue?.nonLogFallbackSignals?.some((signal) => signal.sourceType === "file_modified_time_deltas") &&
      noLogQueue?.nextNonLogFallbackRunCall?.tool === "run_software_observer_queue_item" &&
      direct.noLogFallbackCount >= 1,
    evidence: JSON.stringify({
      logAvailability: noLogQueue?.logAvailability,
      fallbackSignals: noLogQueue?.nonLogFallbackSignals?.map((signal) => signal.sourceType) ?? []
    })
  },
  {
    name: "Queue routes observations into compact learning before teach_apprentice",
    pass:
      queue.defaultNextToolOrder.includes("compact_universal_observation_learning_events") &&
      queue.defaultNextToolOrder.includes("run_software_observer_queue_item") &&
      queue.defaultNextToolOrder.includes("monitor_software_observation_deltas") &&
      browserQueue?.nextCompactLearningTool === "compact_universal_observation_learning_events",
    evidence: queue.defaultNextToolOrder.join(" -> ")
  },
  {
    name: "MCP advanced mode exposes software observer queue",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("create_software_observer_queue") &&
      mcp.result.format === "transparent_ai_software_observer_queue_result_v1",
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_software_observer_queue_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
