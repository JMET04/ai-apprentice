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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "supervised-action-outcome-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: outputRoot,
    encoding: "utf8"
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

async function callAdvancedVerifier(receiptPath, queuePath, stateDir) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "verify_supervised_action_outcome",
      arguments: {
        receipt: receiptPath,
        queue: queuePath,
        stateDir,
        outputDir: join(smokeRoot, "mcp-verification")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

const samplePacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "generic desktop app",
  goal: "Teacher marks a target and expects a visible UI change.",
  overlayMode: "2d_3d",
  coordinateSpace: {
    origin: "top_left_screen_or_screenshot",
    units: "normalized_0_to_1",
    supports2D: true,
    supports3DDepthHints: true
  },
  anchors: [{ id: "target", type: "teacher_marked_region", label: "target area", box: [0.4, 0.3, 0.5, 0.4] }],
  strokes: [
    {
      id: "tap-target",
      mode: "screen_2d",
      semanticLabel: "click the marked target",
      points: [
        { x: 0.45, y: 0.35, t: 0, zHint: 0 },
        { x: 0.451, y: 0.351, t: 12, zHint: 0 }
      ]
    }
  ]
};

const packetPath = join(smokeRoot, "sample-transparent-sketch-packet.json");
writeFileSync(packetPath, JSON.stringify(samplePacket, null, 2), "utf8");

const kit = runNodeScript("create-supervised-software-action-kit.mjs", [
  "--goal",
  "Compile overlay for post-action verification smoke.",
  "--software",
  "generic desktop app",
  "--overlay-packet",
  packetPath,
  "--output-dir",
  join(smokeRoot, "action-kit")
]);

const dryRun = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", kit.runner], {
  cwd: smokeRoot,
  encoding: "utf8"
});
if (dryRun.status !== 0) throw new Error(dryRun.stderr || dryRun.stdout || "dry-run runner failed");
const runnerBytes = readFileSync(kit.runner);
const runnerText = runnerBytes.toString("utf8");
const runnerHasUtf8Bom = runnerBytes[0] === 0xef && runnerBytes[1] === 0xbb && runnerBytes[2] === 0xbf;
const runnerReadsPlanAsUtf8 = runnerText.includes("Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8");

const logPath = join(smokeRoot, "generic-app.log");
writeFileSync(logPath, "baseline\n", "utf8");
const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "supervised-outcome-smoke-queue",
  queue: [
    {
      queueItemId: "generic-desktop-app",
      software: "generic desktop app",
      processName: "GenericApp",
      score: 0.9,
      recentLogCandidates: [{ path: logPath, source: "smoke_log_metadata_only" }]
    }
  ],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, fullContinuousRecording: false, nativeUniversalExecution: false }
};
const queuePath = join(smokeRoot, "software-observer-queue.json");
writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf8");
const stateDir = join(smokeRoot, "metadata-state");

const baseline = runNodeScript("verify-supervised-action-outcome.mjs", [
  "--receipt",
  kit.executionReceipt,
  "--plan",
  kit.actionPlan,
  "--preflight",
  kit.preflight,
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "baseline-verification")
]);

const executedReceiptPath = join(smokeRoot, "executed-receipt.json");
const executedReceipt = {
  ...readJson(kit.executionReceipt),
  status: "teacher_confirmed_executed",
  reason: "Smoke simulates a teacher-confirmed runner receipt after visible UI action.",
  teacherConfirmed: true,
  executeSwitchPresent: true,
  preflightStatus: "execute_preflight",
  activeWindowTitleMatched: true,
  coordinateBoundsOk: true,
  executedActionIds: ["action-spatial-1-click"]
};
writeFileSync(executedReceiptPath, JSON.stringify(executedReceipt, null, 2), "utf8");
writeFileSync(logPath, "baseline\nafter action changed visible state\n", "utf8");

const changed = runNodeScript("verify-supervised-action-outcome.mjs", [
  "--receipt",
  executedReceiptPath,
  "--plan",
  kit.actionPlan,
  "--preflight",
  kit.preflight,
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--output-dir",
  join(smokeRoot, "changed-verification")
]);

const mcp = await callAdvancedVerifier(executedReceiptPath, queuePath, join(smokeRoot, "mcp-state"));
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const baselineVerification = readJson(baseline.verificationPath);
const changedVerification = readJson(changed.verificationPath);
const mcpVerification = readJson(mcp.result.verificationPath);

const adapterSelection = runNodeScript("create-existing-software-execution-adapter.mjs", [
  "--goal",
  "Verify an existing browser automation dry-run receipt before learning.",
  "--software",
  "Chrome browser web CRM",
  "--action-plan",
  kit.actionPlan,
  "--preferred-adapter",
  "existing-browser-automation",
  "--output-dir",
  join(smokeRoot, "existing-adapter")
]);
const existingPackage = readJson(adapterSelection.executionPackagePath);
const existingBrowserRunner = existingPackage.runnerEntries.find((entry) => entry.adapterId === "existing-browser-automation");
if (!existingBrowserRunner) throw new Error("existing browser runner missing");
const existingDryRun = spawnSync(process.execPath, [existingBrowserRunner.runnerPath], {
  cwd: smokeRoot,
  encoding: "utf8"
});
if (existingDryRun.status !== 0) throw new Error(existingDryRun.stderr || existingDryRun.stdout || "existing browser dry-run runner failed");
const existingVerification = runNodeScript("verify-supervised-action-outcome.mjs", [
  "--receipt",
  existingBrowserRunner.receiptPath,
  "--output-dir",
  join(smokeRoot, "existing-receipt-verification")
]);
const existingVerificationJson = readJson(existingVerification.verificationPath);

const checks = [
  {
    name: "Outcome verifier accepts dry-run receipt and proves no UI events were sent",
    pass:
      baseline.format === "transparent_ai_supervised_action_outcome_verification_result_v1" &&
      baseline.status === "dry_run_verified_no_ui_events" &&
      baselineVerification.executionReceipt.status === "dry_run" &&
      baselineVerification.result.outcomeAccepted === false &&
      baselineVerification.locks.screenshotsCaptured === false,
    evidence: baseline.verificationPath
  },
  {
    name: "Outcome verifier uses metadata-only gate after simulated execution",
    pass:
      changed.status === "post_action_metadata_changed_waiting_for_teacher_review" &&
      changedVerification.metadataGate?.changedLogMetadata === 1 &&
      changedVerification.metadataGate?.narrowedQueuePath &&
      changedVerification.locks.logContentsRead === false &&
      changedVerification.locks.fullContinuousRecording === false,
    evidence: changed.verificationPath
  },
  {
    name: "Outcome verifier keeps learning and packaging locked until teacher review",
    pass:
      changedVerification.result.canSaveRule === false &&
      changedVerification.result.canUnlockPackaging === false &&
      changedVerification.result.teacherReviewRequired === true &&
      changedVerification.locks.ruleEnabled === false &&
      changedVerification.locks.accepted === false &&
      changedVerification.locks.packagingGated === true &&
      changedVerification.nextCalls.some((call) => call.tool === "teach_apprentice"),
    evidence: JSON.stringify(changedVerification.result)
  },
  {
    name: "Generated supervised PowerShell runner is UTF-8 safe for Chinese Windows paths",
    pass: runnerHasUtf8Bom && runnerReadsPlanAsUtf8,
    evidence: `bom=${runnerHasUtf8Bom}; readsPlanUtf8=${runnerReadsPlanAsUtf8}`
  },
  {
    name: "Outcome verifier accepts existing execution package dry-run receipts",
    pass:
      existingVerification.format === "transparent_ai_supervised_action_outcome_verification_result_v1" &&
      existingVerification.status === "existing_execution_dry_run_verified_no_events" &&
      existingVerificationJson.receiptFamily === "existing_software_execution" &&
      existingVerificationJson.executionReceipt.format === "transparent_ai_existing_software_execution_receipt_v1" &&
      existingVerificationJson.executionReceipt.browserAutomationAttempted === false &&
      existingVerificationJson.locks.nativeUniversalExecution === false &&
      existingVerificationJson.result.canSaveRule === false,
    evidence: existingVerification.verificationPath
  },
  {
    name: "MCP advanced mode exposes and runs verify_supervised_action_outcome",
    pass:
      mcp.list.mode === "advanced" &&
      advancedNames.includes("verify_supervised_action_outcome") &&
      mcp.result.format === "transparent_ai_supervised_action_outcome_verification_result_v1" &&
      mcpVerification.format === "transparent_ai_supervised_action_outcome_verification_v1",
    evidence: `mode=${mcp.list.mode}; count=${advancedNames.length}`
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_supervised_action_outcome_verifier_smoke_v1",
  checks,
  advancedToolCount: advancedNames.length
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
