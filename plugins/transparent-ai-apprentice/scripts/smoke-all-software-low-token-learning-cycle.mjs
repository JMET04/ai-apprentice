#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "..", "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const outputRoot = existsSync(sourceServerScript) ? repoRoot : resolve(process.cwd());
const serverCwd = existsSync(sourceServerScript) ? repoRoot : outputRoot;
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "all-software-low-token-learning-cycle", String(Date.now()));
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

async function callAdvancedLearningCycle(queuePath, stateDir) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "run_all_software_low_token_learning_cycle",
      arguments: {
        queue: queuePath,
        stateDir,
        cycles: 1,
        maxItems: 2,
        maxLogsPerItem: 2,
        maxTailBytes: 512,
        maxTailLines: 40,
        maxLearningItems: 1,
        teacherMarkers: ["teacher says only changed app logs should become learning events"],
        outputDir: join(smokeRoot, "mcp-learning-cycle")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callAdvancedLearningCycleFromInventory(inventoryPath, stateDir) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "run_all_software_low_token_learning_cycle",
      arguments: {
        inventory: inventoryPath,
        stateDir,
        cycles: 1,
        maxItems: 2,
        maxLogsPerItem: 2,
        maxTailBytes: 512,
        maxTailLines: 40,
        maxLearningItems: 1,
        teacherMarkers: ["teacher wants inventory generated queues to learn only from changed logs"],
        outputDir: join(smokeRoot, "mcp-inventory-learning-cycle")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachLearningCycle(queuePath, stateDir) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        goal: "让电脑上所有软件用日志变动进行低 token 自动学习",
        message: `Run an all software low-token learning cycle from this queue: ${queuePath}`,
        queue: queuePath,
        stateDir,
        allSoftwareLearningCycle: true,
        cycles: 1,
        maxItems: 2,
        maxLogsPerItem: 2,
        maxTailBytes: 512,
        maxTailLines: 40,
        maxLearningItems: 1,
        outputDir: join(smokeRoot, "default-learning-cycle")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const browserLog = join(smokeRoot, "BrowserCRM-service.log");
const editorLog = join(smokeRoot, "StudioEditor-export.log");
writeFileSync(browserLog, "startup complete\n", "utf8");
writeFileSync(editorLog, "ready\n", "utf8");

const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "low-token-learning-cycle-smoke-queue",
  goal: "Learn from all software logs with low-token deltas.",
  queue: [
    {
      queueItemId: "browsercrm",
      software: "BrowserCRM",
      processName: "browsercrm.exe",
      score: 0.91,
      recentLogCandidates: [{ path: browserLog }],
      windowsEventLogs: ["Application"]
    },
    {
      queueItemId: "studioeditor",
      software: "StudioEditor",
      processName: "studioeditor.exe",
      score: 0.77,
      recentLogCandidates: [{ path: editorLog }],
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
const stateDir = join(smokeRoot, "state");
const inventory = {
  format: "transparent_ai_software_observer_inventory_v1",
  inventoryId: "low-token-learning-cycle-smoke-inventory",
  goal: "Learn from all software logs with low-token inventory-to-queue automation.",
  softwareCandidates: queue.queue.map((item) => ({
    software: item.software,
    processName: item.processName,
    confidence: item.score,
    candidateLogFiles: item.recentLogCandidates,
    windowsEventLogs: item.windowsEventLogs,
    reason: "smoke_inventory_candidate"
  })),
  locks: queue.locks
};
const inventoryPath = join(smokeRoot, "software-observer-inventory.json");
writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2), "utf8");

const baseline = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "baseline"),
  "--cycles",
  "1",
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "40"
]);

appendFileSync(browserLog, "ERROR invoice export failed because policy approval is missing\n", "utf8");

const changed = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "changed"),
  "--cycles",
  "2",
  "--interval-ms",
  "0",
  "--max-items",
  "2",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "40",
  "--max-learning-items",
  "1",
  "--teacher-marker",
  "teacher labels missing approval as blocker"
]);

const changedPacket = JSON.parse(readFileSync(changed.learningCyclePath, "utf8"));
const changedReceipt = JSON.parse(readFileSync(changed.receiptPath, "utf8"));
const compactPacket = JSON.parse(readFileSync(changedPacket.learningRuns[0].compactLearningEventsPath, "utf8"));

const noLogQueue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "low-token-learning-cycle-no-log-fallback-queue",
  goal: "Learn from software without useful logs using low-token fallback signals.",
  queue: [
    {
      queueItemId: "nologplanner",
      software: "NoLogPlanner",
      processName: "nologplanner.exe",
      windowTitle: "No Log Planner",
      score: 0.68,
      recentLogCandidates: [],
      logAvailability: "no_candidate_logs_found",
      nonLogFallbackRequired: true,
      nonLogFallbackSignals: [
        {
          sourceType: "windows_event_log",
          sources: ["Application", "System"],
          lowTokenUse: "count_and_preview_only_before_screenshot",
          reviewQuestion: "Are Windows events relevant to the planner action?"
        },
        {
          sourceType: "process_window_metadata",
          sources: ["nologplanner.exe", "No Log Planner"],
          lowTokenUse: "process_and_window_title_metadata_only",
          reviewQuestion: "Does the active window title prove the task state?"
        },
        {
          sourceType: "manual_teacher_marker",
          sources: ["teacher marker text"],
          lowTokenUse: "short_teacher_label_without_screen_recording",
          reviewQuestion: "What short teacher marker should label this no-log state?"
        }
      ],
      windowsEventLogs: ["Application", "System"]
    }
  ],
  locks: queue.locks
};
const noLogQueuePath = join(smokeRoot, "software-observer-queue-no-log.json");
writeFileSync(noLogQueuePath, JSON.stringify(noLogQueue, null, 2), "utf8");
const noLogFallback = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--queue",
  noLogQueuePath,
  "--state-dir",
  join(smokeRoot, "no-log-state"),
  "--output-dir",
  join(smokeRoot, "no-log-fallback"),
  "--cycles",
  "1",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "2",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "40",
  "--max-learning-items",
  "1"
]);
const noLogFallbackPacket = JSON.parse(readFileSync(noLogFallback.learningCyclePath, "utf8"));
const noLogFallbackCompact = JSON.parse(readFileSync(noLogFallbackPacket.learningRuns[0].compactLearningEventsPath, "utf8"));

appendFileSync(browserLog, "WARNING retry still blocked by policy\n", "utf8");
let mcp;
try {
  mcp = await callAdvancedLearningCycle(queuePath, stateDir);
} catch (error) {
  error.message = `advanced queue learning cycle failed: ${error.message}`;
  throw error;
}
appendFileSync(browserLog, "ERROR export blocked until teacher reviews policy\n", "utf8");
const inventoryStateDir = join(smokeRoot, "inventory-state");
try {
  await callAdvancedLearningCycleFromInventory(inventoryPath, inventoryStateDir);
} catch (error) {
  error.message = `advanced inventory baseline failed: ${error.message}`;
  throw error;
}
appendFileSync(browserLog, "ERROR inventory route export blocked until teacher reviews policy\n", "utf8");
let mcpInventory;
try {
  mcpInventory = await callAdvancedLearningCycleFromInventory(inventoryPath, inventoryStateDir);
} catch (error) {
  error.message = `advanced inventory learning cycle failed: ${error.message}`;
  throw error;
}
appendFileSync(browserLog, "ERROR final policy blocker still present\n", "utf8");
let defaultTeach;
try {
  defaultTeach = await callDefaultTeachLearningCycle(queuePath, stateDir);
} catch (error) {
  error.message = `default teach_apprentice learning cycle failed: ${error.message}`;
  throw error;
}
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Learning cycle initializes metadata baseline without tail reads or learning events",
    pass:
      baseline.format === "transparent_ai_all_software_low_token_learning_cycle_result_v1" &&
      baseline.status === "baseline_initialized_waiting_for_next_cycle" &&
      baseline.metadataDeltaGateEnabled === true &&
      baseline.metadataGateRuns >= 1 &&
      baseline.watchCyclesRun === 0 &&
      baseline.tailReadSkippedByMetadataGate > 0 &&
      baseline.compactLearningEvents === 0 &&
      baseline.fullContinuousRecording === false,
    evidence: baseline.learningCyclePath
  },
  {
    name: "Learning cycle uses metadata gate to narrow changed logs before bounded tail reads",
    pass:
      changedPacket.limits.metadataDeltaGateEnabled === true &&
      changedPacket.counts.metadataGateRuns >= 1 &&
      changedPacket.counts.metadataChangedLogMetadata >= 1 &&
      changedPacket.watchRuns.length === 0 &&
      changedPacket.metadataGateRuns[0].logContentsRead === false &&
      changedPacket.learningRuns[0].metadataGatePath &&
      changedPacket.learningRuns[0].sourceQueuePath.includes("metadata-changed-software-observer-queue.json"),
    evidence: JSON.stringify({
      metadataGateRuns: changedPacket.counts.metadataGateRuns,
      changedLogMetadata: changedPacket.counts.metadataChangedLogMetadata,
      sourceQueuePath: changedPacket.learningRuns[0].sourceQueuePath
    })
  },
  {
    name: "Learning cycle converts only changed reviewed software into compact learning events",
    pass:
      changedPacket.format === "transparent_ai_all_software_low_token_learning_cycle_v1" &&
      changed.status === "learning_events_waiting_for_teacher_review" &&
      changed.changedItems === 1 &&
      changed.processedLearningItems === 1 &&
      changed.compactLearningEvents > 0 &&
      changedPacket.learningRuns[0].software === "BrowserCRM",
    evidence: JSON.stringify(changedPacket.counts)
  },
  {
    name: "Learning cycle keeps low-token, review-only, no-execution locks",
    pass:
      changedPacket.limits.fullLogsRead === false &&
      changedPacket.limits.screenshotsCaptured === false &&
      changedPacket.limits.fullContinuousRecording === false &&
      changedPacket.limits.longTermMemoryWritten === false &&
      changedPacket.limits.softwareActionsExecuted === false &&
      changedReceipt.rawFullLogsRetained === false &&
      changedReceipt.softwareActionsExecuted === false &&
      changedReceipt.longTermMemoryWritten === false &&
      changedReceipt.locks.packagingGated === true,
    evidence: JSON.stringify(changedPacket.limits)
  },
  {
    name: "Learning cycle routes no-log software into non-log fallback instead of stalling",
    pass:
      noLogFallback.status === "learning_events_waiting_for_teacher_review" &&
      noLogFallback.nonLogFallbackItems >= 1 &&
      noLogFallbackPacket.nonLogFallbackQueuePath &&
      noLogFallbackPacket.counts.nonLogFallbackItems >= 1 &&
      noLogFallbackPacket.learningRuns[0].nonLogFallbackUsed === true &&
      noLogFallbackCompact.compactLearningEvents.some((event) => event.sourceType === "non_log_low_token_fallback") &&
      noLogFallbackCompact.lowTokenCompression.nonLogFallbackEventCount >= 1 &&
      noLogFallback.softwareActionsExecuted === false,
    evidence: JSON.stringify({
      nonLogFallbackItems: noLogFallback.nonLogFallbackItems,
      sourceTypes: noLogFallbackCompact.compactLearningEvents.map((event) => event.sourceType)
    })
  },
  {
    name: "Compact event packet asks teacher for rule boundary and counterexample",
    pass:
      compactPacket.format === "transparent_ai_compact_learning_events_from_universal_observation_v1" &&
      compactPacket.compactLearningEvents.length > 0 &&
      compactPacket.teacherAdaptation.askNext.includes("counterexample") &&
      compactPacket.reviewLocks.ruleEnabled === false &&
      compactPacket.reviewLocks.accepted === false,
    evidence: changedPacket.learningRuns[0].compactLearningEventsPath
  },
  {
    name: "MCP advanced mode exposes and runs all-software low-token learning cycle",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("run_all_software_low_token_learning_cycle") &&
      mcp.result.format === "transparent_ai_all_software_low_token_learning_cycle_result_v1" &&
      mcp.result.compactLearningEvents > 0 &&
      mcp.result.softwareActionsExecuted === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  },
  {
    name: "Learning cycle can generate a bounded observer queue directly from inventory",
    pass:
      mcpInventory.list.mode === "advanced" &&
      mcpInventory.result.format === "transparent_ai_all_software_low_token_learning_cycle_result_v1" &&
      mcpInventory.result.generatedQueueFromInventory?.queuePath &&
      mcpInventory.result.generatedQueueFromInventory?.fullLogsRead === false &&
      mcpInventory.result.compactLearningEvents > 0 &&
      mcpInventory.result.softwareActionsExecuted === false,
    evidence: mcpInventory.result.generatedQueueFromInventory?.queuePath || ""
  },
  {
    name: "Default teach_apprentice routes explicit all-software learning-cycle intent to new cycle",
    pass:
      defaultTeach.status === "waiting_for_all_software_learning_cycle_review" &&
      defaultTeach.allSoftwareLearningCycle?.metadataDeltaGateEnabled === true &&
      defaultTeach.allSoftwareLearningCycle?.metadataGateRuns >= 1 &&
      defaultTeach.allSoftwareLearningCycle?.compactLearningEvents > 0 &&
      defaultTeach.allSoftwareLearningCycle?.softwareActionsExecuted === false &&
      defaultTeach.allSoftwareLearningCycle?.longTermMemoryWritten === false,
    evidence: defaultTeach.allSoftwareLearningCycle?.receiptPath || ""
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_low_token_learning_cycle_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
