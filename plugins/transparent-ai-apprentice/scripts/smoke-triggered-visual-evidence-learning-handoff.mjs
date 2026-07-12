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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "triggered-visual-learning-handoff-smoke", String(Date.now()));
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

function startServer() {
  const child = spawn(process.execPath, [serverScript], {
    cwd: serverCwd,
    env: { ...process.env },
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

async function callTeachApprentice(files, goal) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        goal,
        tool: "low-token triggered visual evidence",
        files,
        teacherMessage:
          "The log metadata changed first, then I approved exactly one bounded visual check. Use the visual evidence only as review-only teaching material.",
        futureInput: "A future software run has the same log delta and visual state."
      }
    });
    return JSON.parse(result.content[0].text);
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

const sourceImagePath = join(smokeRoot, "teacher-reviewed-bounded-screenshot.png");
writeFileSync(
  sourceImagePath,
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64")
);

const capture = runNodeScript("capture-triggered-visual-check.mjs", [
  "--request",
  request.packetPath,
  "--teacher-confirmed",
  "--reviewed-source-image",
  sourceImagePath,
  "--target-window-title",
  "Generic App",
  "--teacher-note",
  "teacher confirmed one bounded visual check for learning handoff",
  "--output-dir",
  join(smokeRoot, "capture")
]);
const captureReceipt = readJson(capture.receiptPath);

const handoff = runNodeScript("create-triggered-visual-evidence-learning-handoff.mjs", [
  "--capture-receipt",
  capture.receiptPath,
  "--request",
  request.packetPath,
  "--goal",
  "Learn from a low-token log delta plus one teacher-confirmed bounded visual check.",
  "--output-dir",
  join(smokeRoot, "learning-handoff")
]);
const handoffPacket = readJson(handoff.handoffPath);

const evidenceFiles = handoffPacket.evidenceFiles;
const card = await callTeachApprentice(
  evidenceFiles,
  "Learn from a low-token log delta plus one teacher-confirmed bounded visual check."
);

const checks = [
  {
    name: "Low-token trigger creates a reviewed one-screenshot request",
    pass:
      requestPacket.format === "transparent_ai_triggered_visual_check_request_v1" &&
      requestPacket.requestCount === 1 &&
      requestPacket.requests[0].maxScreenshots === 1 &&
      requestPacket.requests[0].captureOnlyAfterReview === true,
    evidence: request.packetPath
  },
  {
    name: "Teacher-confirmed capture produces exactly one bounded visual evidence receipt",
    pass:
      captureReceipt.format === "transparent_ai_triggered_visual_check_capture_receipt_v1" &&
      captureReceipt.status === "captured_one_bounded_visual_evidence" &&
      captureReceipt.screenshotCount === 1 &&
      captureReceipt.screenshotSha256.length === 64 &&
      captureReceipt.nextLearningHandoffCommand?.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      Array.isArray(captureReceipt.nextTeachingCallAfterCapture?.arguments?.files) &&
      captureReceipt.locks.fullContinuousRecording === false &&
      captureReceipt.locks.softwareActionsExecuted === false,
    evidence: capture.receiptPath
  },
  {
    name: "Captured visual evidence becomes a complete learning handoff packet",
    pass:
      handoffPacket.format === "transparent_ai_triggered_visual_evidence_learning_handoff_v1" &&
      handoffPacket.status === "waiting_for_teacher_learning_review" &&
      handoffPacket.evidenceFiles.includes(request.packetPath) &&
      handoffPacket.evidenceFiles.includes(capture.receiptPath) &&
      handoffPacket.evidenceFiles.includes(capture.screenshotPath) &&
      handoffPacket.teachApprenticeCall?.arguments?.files?.length === 3 &&
      handoffPacket.nextLearningCardReviewCommand?.includes("run-triggered-visual-evidence-learning-handoff-review.mjs") &&
      handoffPacket.locks.handoffDoesNotCaptureScreenshots === true &&
      handoffPacket.locks.handoffDoesNotExecuteSoftware === true &&
      handoffPacket.locks.handoffDoesNotWriteMemory === true,
    evidence: handoff.handoffPath
  },
  {
    name: "Default teach_apprentice accepts request receipt and image as one review-only learning handoff",
    pass:
      card.format === "transparent_ai_teach_apprentice_card_v1" &&
      card.status === "waiting_for_teacher_review" &&
      card.teachingEvidence?.some((item) => item.kind === "file_capture") &&
      card.learnedDraft?.draftCreated === true &&
      card.learnedDraft?.ruleEnabledForSession === false,
    evidence: `status=${card.status}; evidence=${card.teachingEvidence?.length ?? 0}; replay=${card.learnedDraft?.replayOutcome ?? ""}`
  },
  {
    name: "Learning handoff keeps memory approval and packaging locked",
    pass:
      card.teacherCanReplyWith?.some((reply) => reply.includes("explicit approval")) &&
      card.learnedDraft?.savedToProfile === false &&
      card.learnedDraft?.ruleEnabledForSession === false &&
      card.reviewLocks?.accepted === false &&
      card.reviewLocks?.packagingGated === true &&
      card.reviewLocks?.technologyAccepted === false,
    evidence: JSON.stringify(card.reviewLocks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_triggered_visual_evidence_learning_handoff_smoke_v1",
  smokeRoot,
  paths: {
    request: request.packetPath,
    captureReceipt: capture.receiptPath,
    learningHandoff: handoff.handoffPath,
    visualEvidence: capture.screenshotPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
