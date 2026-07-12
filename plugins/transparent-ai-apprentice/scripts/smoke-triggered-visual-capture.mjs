#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const sourceServerScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "mcp-server.mjs");
const packagedServerScript = join(pluginRoot, "scripts", "mcp-server.mjs");
const serverScript = existsSync(sourceServerScript) ? sourceServerScript : packagedServerScript;
const outputRoot = existsSync(sourceServerScript) ? repoRoot : resolve(process.cwd());
const serverCwd = existsSync(sourceServerScript) ? repoRoot : outputRoot;
const smokeRoot = join(outputRoot, ".transparent-apprentice", "triggered-visual-capture-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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

async function callAdvancedCapture(requestPath, sourceImagePath, selectedRequestId = "") {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "capture_triggered_visual_check",
      arguments: {
        request: requestPath,
        selectedRequestId,
        teacherConfirmed: true,
        reviewedSourceImage: sourceImagePath,
        outputDir: join(smokeRoot, "mcp-capture")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const monitorPath = join(smokeRoot, "delta-monitor.json");
writeFileSync(monitorPath, JSON.stringify({
  format: "transparent_ai_software_observation_delta_monitor_v1",
  software: "generic non-CAD desktop app",
  processName: "GenericApp.exe",
  windowTitle: "Generic App",
  counts: { changedLogs: 1, addedLogs: 0, removedLogs: 0 },
  delta: {
    changedLogs: [
      {
        path: join(smokeRoot, "generic-app.log"),
        classification: "failure_or_blocker",
        current: { retainedSnippet: "ERROR export failed after user clicked save" }
      }
    ],
    addedLogs: [],
    removedLogs: []
  },
  screenshotPolicy: {
    screenshotRecommended: true,
    screenshotCaptured: false,
    fullContinuousRecording: false,
    reason: "cheap_signal_failure_or_blocker"
  }
}, null, 2), "utf8");

const request = runNodeScript("create-triggered-visual-check-request.mjs", [
  "--delta-monitor",
  monitorPath,
  "--software",
  "generic non-CAD desktop app",
  "--target-window-title",
  "Generic App",
  "--output-dir",
  join(smokeRoot, "request")
]);
const requestPacket = readJson(request.packetPath);

const dryRun = runNodeScript("capture-triggered-visual-check.mjs", [
  "--request",
  request.packetPath,
  "--output-dir",
  join(smokeRoot, "dry-run")
]);
const dryRunReceipt = readJson(dryRun.receiptPath);

const sourceImagePath = join(smokeRoot, "teacher-reviewed-bounded-screenshot.png");
writeFileSync(
  sourceImagePath,
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64")
);

const confirmed = runNodeScript("capture-triggered-visual-check.mjs", [
  "--request",
  request.packetPath,
  "--teacher-confirmed",
  "--reviewed-source-image",
  sourceImagePath,
  "--target-window-title",
  "Generic App",
  "--teacher-note",
  "teacher confirmed one bounded visual check after log delta",
  "--output-dir",
  join(smokeRoot, "confirmed")
]);
const confirmedReceipt = readJson(confirmed.receiptPath);

const automaticQueuePath = join(smokeRoot, "automatic-triggered-visual-check-queue.json");
writeFileSync(automaticQueuePath, JSON.stringify({
  format: "transparent_ai_automatic_triggered_visual_check_queue_v1",
  queueId: "automatic-triggered-visual-capture-smoke",
  status: "waiting_for_teacher_visual_check_review",
  requestCount: 1,
  requests: [
    {
      id: "automatic-visual-check-1",
      source: "automatic_low_token_learning_runner",
      software: "generic non-CAD desktop app",
      processName: "GenericApp.exe",
      triggerReason: "failure_or_blocker",
      triggerEvidence: {
        changedLogCount: 1,
        classifications: ["failure_or_blocker"],
        screenshotRequestsInCycle: 1
      },
      captureOnlyAfterReview: true,
      maxScreenshots: 1
    }
  ],
  locks: {
    reviewOnly: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    softwareActionsExecuted: false,
    longTermMemoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
}, null, 2), "utf8");

const automaticQueueCapture = runNodeScript("capture-triggered-visual-check.mjs", [
  "--request",
  automaticQueuePath,
  "--selected-request-id",
  "automatic-visual-check-1",
  "--teacher-confirmed",
  "--reviewed-source-image",
  sourceImagePath,
  "--teacher-note",
  "teacher confirmed one bounded visual check from automatic queue",
  "--output-dir",
  join(smokeRoot, "automatic-queue-capture")
]);
const automaticQueueCaptureReceipt = readJson(automaticQueueCapture.receiptPath);

const mcp = await callAdvancedCapture(automaticQueuePath, sourceImagePath, "automatic-visual-check-1");
const mcpReceipt = readJson(mcp.result.receiptPath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);

const checks = [
  {
    name: "Triggered visual capture starts from a reviewed one-screenshot request",
    pass:
      requestPacket.format === "transparent_ai_triggered_visual_check_request_v1" &&
      requestPacket.requestCount === 1 &&
      requestPacket.requests[0].maxScreenshots === 1 &&
      requestPacket.requests[0].captureOnlyAfterReview === true,
    evidence: request.packetPath
  },
  {
    name: "Capture runner dry-runs without teacher confirmation",
    pass:
      dryRun.format === "transparent_ai_triggered_visual_check_capture_result_v1" &&
      dryRun.status === "dry_run_no_screenshot_captured" &&
      dryRun.screenshotCount === 0 &&
      dryRun.screenshotsCaptured === false &&
      dryRunReceipt.locks.screenshotsCaptured === false &&
      dryRunReceipt.locks.fullContinuousRecording === false,
    evidence: dryRun.receiptPath
  },
  {
    name: "Teacher-confirmed capture stores exactly one bounded visual evidence file",
    pass:
      confirmed.status === "captured_one_bounded_visual_evidence" &&
      confirmed.captureMode === "reviewed_source_image_copy" &&
      confirmed.screenshotCount === 1 &&
      confirmed.screenshotsCaptured === true &&
      existsSync(confirmed.screenshotPath) &&
      confirmedReceipt.screenshotSha256.length === 64 &&
      confirmedReceipt.maxScreenshots === 1,
    evidence: confirmed.receiptPath
  },
  {
    name: "Capture receipt keeps continuous recording, execution, memory, acceptance, and packaging locked",
    pass:
      confirmedReceipt.locks.fullContinuousRecording === false &&
      confirmedReceipt.locks.softwareActionsExecuted === false &&
      confirmedReceipt.locks.nativeUniversalExecution === false &&
      confirmedReceipt.locks.memoryEnabled === false &&
      confirmedReceipt.locks.accepted === false &&
      confirmedReceipt.locks.ruleEnabled === false &&
      confirmedReceipt.locks.packagingGated === true,
    evidence: JSON.stringify(confirmedReceipt.locks)
  },
  {
    name: "Automatic low-token visual-check queue can be captured by selected request id",
    pass:
      automaticQueueCapture.sourceRequestFormat === "transparent_ai_automatic_triggered_visual_check_queue_v1" &&
      automaticQueueCapture.sourceRequestKind === "automatic_triggered_visual_check_queue" &&
      automaticQueueCapture.status === "captured_one_bounded_visual_evidence" &&
      automaticQueueCapture.screenshotCount === 1 &&
      automaticQueueCaptureReceipt.selectedRequestId === "automatic-visual-check-1" &&
      automaticQueueCaptureReceipt.locks.fullContinuousRecording === false &&
      automaticQueueCaptureReceipt.locks.softwareActionsExecuted === false,
    evidence: automaticQueueCapture.receiptPath
  },
  {
    name: "MCP advanced mode exposes and runs triggered visual capture",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("capture_triggered_visual_check") &&
      mcp.result.status === "captured_one_bounded_visual_evidence" &&
      mcp.result.sourceRequestFormat === "transparent_ai_automatic_triggered_visual_check_queue_v1" &&
      mcp.result.screenshotCount === 1 &&
      mcpReceipt.locks.fullContinuousRecording === false,
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_triggered_visual_capture_smoke_v1",
  smokeRoot,
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
