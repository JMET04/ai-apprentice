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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "compact-learning-events-smoke", String(Date.now()));
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

async function callAdvancedTool(observationPath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "compact_universal_observation_learning_events",
      arguments: {
        observation: observationPath,
        teacherStyle: "concise_step_by_step",
        teacherMarkers: ["teacher says the export completed message is the success signal"],
        outputDir: join(smokeRoot, "mcp-compact")
      }
    });
    return {
      list,
      result: JSON.parse(result.content[0].text)
    };
  } finally {
    await server.stop();
  }
}

const observation = {
  format: "transparent_ai_universal_software_observation_v1",
  kitId: "smoke-kit",
  software: "generic spreadsheet app",
  processName: "spreadsheet",
  windowTitle: "Quarterly export",
  createdAt: new Date().toISOString(),
  fullContinuousRecording: false,
  logSummaries: [
    {
      path: "C:\\Temp\\spreadsheet-export.log",
      lastWriteTimeUtc: new Date().toISOString(),
      bytes: 2048,
      tailLineCount: 20,
      interestingLineCount: 2,
      interestingTail: ["export completed for Q4", "saved workbook to reviewed folder"]
    },
    {
      path: "C:\\Temp\\spreadsheet-warning.log",
      lastWriteTimeUtc: new Date().toISOString(),
      bytes: 1024,
      tailLineCount: 12,
      interestingLineCount: 1,
      interestingTail: ["warning: pivot table cache refreshed"]
    }
  ],
  eventSummaries: [
    {
      logName: "Application",
      recentCount: 1,
      latest: [
        {
          provider: "SpreadsheetApp",
          id: 1001,
          level: "Information",
          timeCreatedUtc: new Date().toISOString(),
          messagePreview: "Export completed successfully"
        }
      ]
    }
  ],
  teacherNotes: ["This success signal means the apprentice can proceed to review."],
  needsTeacherQuestion: true,
  locks: {
    ruleEnabled: false,
    accepted: false,
    technologyAccepted: false,
    packagingGated: true
  }
};

const observationPath = join(smokeRoot, "universal-observation-summary.json");
writeFileSync(observationPath, JSON.stringify(observation, null, 2), "utf8");

const direct = runNodeScript("compact-universal-observation-learning-events.mjs", [
  "--observation",
  observationPath,
  "--teacher-style",
  "concise_step_by_step",
  "--teacher-marker",
  "teacher marks export completed as success",
  "--output-dir",
  join(smokeRoot, "direct-compact")
]);
const mcp = await callAdvancedTool(observationPath);
const packet = JSON.parse(readFileSync(direct.packetPath, "utf8"));
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Direct compressor turns universal observation into compact learning events",
    pass:
      direct.format === "transparent_ai_compact_learning_events_result_v1" &&
      packet.format === "transparent_ai_compact_learning_events_from_universal_observation_v1" &&
      packet.sourceObservationFormat === "transparent_ai_universal_software_observation_v1" &&
      packet.compactLearningEvents.length >= 4,
    evidence: direct.packetPath
  },
  {
    name: "Compact events classify success, warning, Windows event, and teacher marker signals",
    pass:
      packet.compactLearningEvents.some((event) => event.classification === "success_or_completion") &&
      packet.compactLearningEvents.some((event) => event.classification === "warning") &&
      packet.compactLearningEvents.some((event) => event.sourceType === "windows_event_log") &&
      packet.compactLearningEvents.some((event) => event.sourceType === "manual_teacher_marker"),
    evidence: packet.compactLearningEvents.map((event) => `${event.sourceType}:${event.classification}`).join(",")
  },
  {
    name: "Compressor keeps low-token limits and avoids continuous screenshots",
    pass:
      packet.lowTokenCompression.fullContinuousRecording === false &&
      packet.lowTokenCompression.rawFullLogsRetained === false &&
      packet.lowTokenCompression.screenshotRequiredByDefault === false &&
      packet.reviewLocks.fullContinuousRecording === false &&
      packet.reviewLocks.nativeUniversalExecution === false,
    evidence: JSON.stringify(packet.lowTokenCompression)
  },
  {
    name: "Teacher adaptation asks for rule boundary and counterexample",
    pass:
      packet.teacherAdaptation.teacherStyle === "concise_step_by_step" &&
      packet.teacherAdaptation.supportsTeachingMethods.includes("transparent overlay sketch") &&
      packet.teacherAdaptation.askNext.includes("counterexample") &&
      packet.nextTeachingCall.tool === "teach_apprentice",
    evidence: packet.teacherAdaptation.askNext
  },
  {
    name: "MCP advanced mode exposes compact learning event compressor",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("compact_universal_observation_learning_events") &&
      mcp.result.format === "transparent_ai_compact_learning_events_result_v1" &&
      mcp.result.compactEventCount >= 4,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_compact_universal_learning_events_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
