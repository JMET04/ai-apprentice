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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "software-observer-queue-runner-smoke", String(Date.now()));
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
const longNoise = Array.from({ length: 180 }, (_, index) => `noise line ${index}`).join("\n");
writeFileSync(join(browserRoot, "BrowserCRM-service.log"), `${longNoise}\nwarning: customer tag missing\nsaved customer case\n`, "utf8");
writeFileSync(join(editorRoot, "StudioEditor-export.jsonl"), "{\"event\":\"exported\"}\n", "utf8");

const inventoryPath = join(smokeRoot, "software-observer-inventory.json");
writeFileSync(inventoryPath, JSON.stringify({
  format: "transparent_ai_software_observer_inventory_v1",
  inventoryId: "runner-smoke-inventory",
  goal: "Run low-token observation from a reviewed all-software queue.",
  softwareCandidates: [
    {
      software: "BrowserCRM",
      processName: "BrowserCRM",
      windowTitle: "Browser CRM - customer queue",
      candidateLogRoots: [browserRoot],
      windowsEventLogs: ["Application"],
      confidence: 0.74,
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
      confidence: 0.56,
      reason: "running_process_without_log_candidate"
    }
  ],
  locks: {
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
}, null, 2), "utf8");

async function callAdvancedRunner(queuePath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "run_software_observer_queue_item",
      arguments: {
        queue: queuePath,
        item: "BrowserCRM",
        maxTailBytes: 512,
        maxTailLines: 40,
        outputDir: join(smokeRoot, "mcp-run")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachQueue(queuePath) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        goal: "Run the reviewed queue item before teaching memory.",
        message: queuePath,
        software: "BrowserCRM",
        maxTailBytes: 512,
        maxTailLines: 40,
        outputDir: join(smokeRoot, "default-teach-run")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const queueResult = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--output-dir",
  join(smokeRoot, "direct-queue"),
  "--max-candidates",
  "5",
  "--max-files-per-candidate",
  "4"
]);
const directRun = runNodeScript("run-software-observer-queue-item.mjs", [
  "--queue",
  queueResult.queuePath,
  "--item",
  "BrowserCRM",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "40",
  "--output-dir",
  join(smokeRoot, "direct-run")
]);
const observation = JSON.parse(readFileSync(directRun.observationPath, "utf8"));
const compact = JSON.parse(readFileSync(directRun.compactLearningEventsPath, "utf8"));
const receipt = JSON.parse(readFileSync(directRun.receiptPath, "utf8"));
const noLogRun = runNodeScript("run-software-observer-queue-item.mjs", [
  "--queue",
  queueResult.queuePath,
  "--item",
  "NoLogPlanner",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "40",
  "--output-dir",
  join(smokeRoot, "no-log-run")
]);
const noLogObservation = JSON.parse(readFileSync(noLogRun.observationPath, "utf8"));
const noLogCompact = JSON.parse(readFileSync(noLogRun.compactLearningEventsPath, "utf8"));
const noLogReceipt = JSON.parse(readFileSync(noLogRun.receiptPath, "utf8"));
const mcp = await callAdvancedRunner(queueResult.queuePath);
const defaultTeach = await callDefaultTeachQueue(queueResult.queuePath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const firstLog = observation.logSummaries[0] || {};

const checks = [
  {
    name: "Queue runner consumes one reviewed non-CAD software item",
    pass:
      directRun.format === "transparent_ai_software_observer_queue_item_run_result_v1" &&
      directRun.software === "BrowserCRM" &&
      observation.source === "software_observer_queue_item_runner" &&
      observation.software === "BrowserCRM",
    evidence: directRun.receiptPath
  },
  {
    name: "Queue runner reads only bounded selected log tails",
    pass:
      observation.rawFullLogsRetained === false &&
      observation.fullContinuousRecording === false &&
      observation.screenshotsCaptured === false &&
      observation.logContentsRead === "bounded_tail_only_for_selected_candidate_logs" &&
      firstLog.fullLogRead === false &&
      firstLog.tailBytesRead <= 512,
    evidence: JSON.stringify(receipt.lowTokenProof)
  },
  {
    name: "Queue runner creates compact learning events for teach_apprentice",
    pass:
      compact.format === "transparent_ai_compact_learning_events_from_universal_observation_v1" &&
      compact.compactLearningEvents?.length > 0 &&
      receipt.nextTeachingCall?.tool === "teach_apprentice" &&
      receipt.nextDeltaMonitorCall?.tool === "monitor_software_observation_deltas",
    evidence: directRun.compactLearningEventsPath
  },
  {
    name: "Queue runner creates non-log fallback compact events when no logs exist",
    pass:
      noLogRun.software === "NoLogPlanner" &&
      noLogObservation.logAvailability === "no_candidate_logs_non_log_fallback" &&
      noLogObservation.logContentsRead === "none_no_candidate_logs" &&
      noLogObservation.nonLogFallbackSummaries?.length >= 3 &&
      noLogReceipt.lowTokenProof.nonLogFallbackUsed === true &&
      noLogCompact.compactLearningEvents?.some((event) => event.sourceType === "non_log_low_token_fallback") &&
      noLogCompact.lowTokenCompression.nonLogFallbackEventCount >= 1,
    evidence: JSON.stringify({
      fallbackSignals: noLogObservation.nonLogFallbackSummaries?.map((signal) => signal.sourceType) ?? [],
      compactEvents: noLogCompact.compactLearningEvents?.map((event) => event.sourceType) ?? []
    })
  },
  {
    name: "Queue runner keeps execution and memory gates locked",
    pass:
      receipt.locks.nativeUniversalExecution === false &&
      receipt.locks.ruleEnabled === false &&
      receipt.locks.packagingGated === true &&
      directRun.status === "waiting_for_teacher_review",
    evidence: JSON.stringify(receipt.locks)
  },
  {
    name: "MCP advanced mode exposes and runs queue item runner",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("run_software_observer_queue_item") &&
      mcp.result.format === "transparent_ai_software_observer_queue_item_run_result_v1" &&
      mcp.result.nativeUniversalExecution === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Default teach_apprentice routes pasted queue paths to queue item runner",
    pass:
      defaultTeach.status === "waiting_for_observer_queue_run_review" &&
      defaultTeach.softwareObserverQueueRun?.software === "BrowserCRM" &&
      defaultTeach.softwareObserverQueueRun?.compactEventCount > 0 &&
      defaultTeach.softwareObserverQueueRun?.nativeUniversalExecution === false,
    evidence: defaultTeach.softwareObserverQueueRun?.receiptPath || ""
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_software_observer_queue_runner_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
