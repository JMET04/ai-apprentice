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
const runsFromSourceTree = existsSync(sourceServerScript);
const outputRoot = runsFromSourceTree ? repoRoot : resolve(process.cwd());
const serverScript = runsFromSourceTree ? sourceServerScript : packagedServerScript;
const smokeRoot = join(outputRoot, ".transparent-apprentice", "post-action-evidence-checkpoint-smoke", String(Date.now()));
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
    cwd: outputRoot,
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

async function callAdvancedCheckpoint(receiptPath, beforeStatePath, watchedFile, queuePath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_post_action_evidence_checkpoint",
      arguments: {
        receipt: receiptPath,
        beforeState: beforeStatePath,
        files: [watchedFile],
        queue: queuePath,
        software: "Generic non-CAD desktop app",
        outputDir: join(smokeRoot, "mcp")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefaultTeachApprentice(receiptPath, beforeStatePath, watchedFile) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        message: "请用低token证据检查这次软件动作执行后是否真的改变了状态，不要截图除非必要。",
        postActionEvidenceCheckpoint: true,
        executionReceipt: receiptPath,
        beforeState: beforeStatePath,
        files: [watchedFile],
        software: "Generic non-CAD desktop app",
        outputDir: join(smokeRoot, "default-route")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const watchedFile = join(smokeRoot, "project-output.dat");
const logPath = join(smokeRoot, "generic-app.log");
writeFileSync(watchedFile, "baseline-visible-state\n", "utf8");
writeFileSync(logPath, "baseline\n", "utf8");

const before = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--phase",
  "before",
  "--software",
  "Generic non-CAD desktop app",
  "--file",
  watchedFile,
  "--output-dir",
  join(smokeRoot, "before")
]);

const dryRunReceiptPath = join(smokeRoot, "dry-run-receipt.json");
writeFileSync(
  dryRunReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_supervised_software_action_execution_receipt_v1",
      status: "dry_run",
      mode: "dry_run",
      teacherConfirmed: false,
      executeSwitchPresent: false,
      uiEventsSent: false,
      executedActionIds: []
    },
    null,
    2
  ),
  "utf8"
);

const dryRunCheckpoint = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--receipt",
  dryRunReceiptPath,
  "--before-state",
  before.statePath,
  "--file",
  watchedFile,
  "--software",
  "Generic non-CAD desktop app",
  "--output-dir",
  join(smokeRoot, "dry-run")
]);

writeFileSync(watchedFile, "baseline-visible-state\nafter-action-visible-delta\n", "utf8");
writeFileSync(logPath, "baseline\nafter-action-log-delta\n", "utf8");
const executedReceiptPath = join(smokeRoot, "executed-receipt.json");
writeFileSync(
  executedReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_supervised_software_action_execution_receipt_v1",
      status: "teacher_confirmed_executed",
      mode: "execute",
      teacherConfirmed: true,
      executeSwitchPresent: true,
      uiEventsSent: true,
      executedActionIds: ["action-1"]
    },
    null,
    2
  ),
  "utf8"
);

const queuePath = join(smokeRoot, "software-observer-queue.json");
writeFileSync(
  queuePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      queueId: "post-action-checkpoint-smoke-queue",
      queue: [
        {
          queueItemId: "generic-desktop-app",
          software: "Generic non-CAD desktop app",
          processName: "GenericApp",
          recentLogCandidates: [{ path: logPath, source: "smoke_log_metadata_only" }]
        }
      ],
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        fullContinuousRecording: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const changedCheckpoint = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--receipt",
  executedReceiptPath,
  "--before-state",
  before.statePath,
  "--file",
  watchedFile,
  "--queue",
  queuePath,
  "--state-dir",
  join(smokeRoot, "metadata-state"),
  "--software",
  "Generic non-CAD desktop app",
  "--output-dir",
  join(smokeRoot, "changed")
]);

const ambiguousFile = join(smokeRoot, "ambiguous-output.dat");
writeFileSync(ambiguousFile, "same\n", "utf8");
const ambiguousBefore = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--phase",
  "before",
  "--software",
  "Generic non-CAD desktop app",
  "--file",
  ambiguousFile,
  "--output-dir",
  join(smokeRoot, "ambiguous-before")
]);
const ambiguousCheckpoint = runNodeScript("create-post-action-evidence-checkpoint.mjs", [
  "--receipt",
  executedReceiptPath,
  "--before-state",
  ambiguousBefore.statePath,
  "--file",
  ambiguousFile,
  "--software",
  "Generic non-CAD desktop app",
  "--output-dir",
  join(smokeRoot, "ambiguous")
]);

const mcp = await callAdvancedCheckpoint(executedReceiptPath, before.statePath, watchedFile, queuePath);
const defaultCard = await callDefaultTeachApprentice(executedReceiptPath, before.statePath, watchedFile);

const dryRunJson = readJson(dryRunCheckpoint.checkpointPath);
const changedJson = readJson(changedCheckpoint.checkpointPath);
const ambiguousJson = readJson(ambiguousCheckpoint.checkpointPath);
const mcpJson = readJson(mcp.result.checkpointPath);

const checks = [
  {
    name: "Checkpoint captures before state without reading file contents",
    pass:
      before.format === "transparent_ai_post_action_low_token_evidence_checkpoint_result_v1" &&
      readJson(before.statePath).format === "transparent_ai_post_action_low_token_state_snapshot_v1" &&
      readJson(before.statePath).items[0].contentRead === false,
    evidence: before.statePath
  },
  {
    name: "Dry-run receipt stays verified as no software events",
    pass:
      dryRunCheckpoint.status === "dry_run_checkpoint_verified_no_software_events" &&
      dryRunJson.executionReceipt.status === "dry_run" &&
      dryRunJson.result.outcomeAccepted === false &&
      dryRunJson.locks.softwareActionsExecuted === false,
    evidence: dryRunCheckpoint.checkpointPath
  },
  {
    name: "Executed receipt plus changed metadata waits for teacher review",
    pass:
      changedCheckpoint.status === "post_action_changed_waiting_for_teacher_review" &&
      changedJson.stateComparison.changedItemCount === 1 &&
      changedJson.result.canSaveRule === false &&
      changedJson.locks.fileContentsRead === false &&
      changedJson.locks.screenshotsCaptured === false,
    evidence: changedCheckpoint.checkpointPath
  },
  {
    name: "No cheap post-action change recommends only one reviewed visual check",
    pass:
      ambiguousCheckpoint.status === "post_action_no_cheap_change_waiting_for_teacher_or_visual_check" &&
      ambiguousJson.result.screenshotRecommended === true &&
      ambiguousJson.result.maxScreenshots === 1 &&
      ambiguousJson.nextCalls.some((call) => call.tool === "create_triggered_visual_check_request"),
    evidence: ambiguousCheckpoint.checkpointPath
  },
  {
    name: "MCP advanced mode exposes and runs post-action evidence checkpoint",
    pass:
      mcp.list.tools.some((tool) => tool.name === "create_post_action_evidence_checkpoint") &&
      mcp.list.tools.length === 66 &&
      mcp.result.status === "post_action_changed_waiting_for_teacher_review" &&
      mcpJson.locks.nativeUniversalExecution === false,
    evidence: `mode=advanced; count=${mcp.list.tools.length}`
  },
  {
    name: "Default teach_apprentice routes explicit post-action evidence requests to checkpoint card",
    pass:
      defaultCard.status === "waiting_for_post_action_evidence_review" &&
      defaultCard.postActionEvidenceCheckpoint?.status === "post_action_changed_waiting_for_teacher_review" &&
      defaultCard.postActionEvidenceCheckpoint.softwareActionsExecuted === false,
    evidence: defaultCard.status
  }
];

const passed = checks.filter((check) => check.pass).length;
console.log(
  JSON.stringify(
    {
      status: passed === checks.length ? "passed" : "failed",
      smoke: "transparent_ai_post_action_evidence_checkpoint_smoke_v1",
      checks,
      advancedToolCount: mcp.list.tools.length
    },
    null,
    2
  )
);
if (passed !== checks.length) process.exit(1);
