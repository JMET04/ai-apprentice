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
const smokeRoot = join(outputRoot, ".transparent-apprentice", "observer-coverage-audit-smoke", String(Date.now()));
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

function writeJson(name, value) {
  const path = join(smokeRoot, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
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

async function callAdvanced(inventoryPath, queuePath, learningCyclePath) {
  const server = startServer({ TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" });
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const list = await server.rpc("tools/list", {});
    const result = await server.rpc("tools/call", {
      name: "create_all_software_observer_coverage_audit",
      arguments: {
        goal: "Audit local software low-token observer coverage before claiming all-software learning.",
        inventory: inventoryPath,
        queue: queuePath,
        learningCycles: [learningCyclePath],
        outputDir: join(smokeRoot, "mcp-audit")
      }
    });
    return { list, result: JSON.parse(result.content[0].text) };
  } finally {
    await server.stop();
  }
}

async function callDefault(inventory, queue) {
  const server = startServer();
  try {
    await server.rpc("initialize", {});
    server.rpc("notifications/initialized", {}).catch(() => {});
    const result = await server.rpc("tools/call", {
      name: "teach_apprentice",
      arguments: {
        whatToTeach: "Audit all software low-token observer coverage and show which apps still need log paths or fallback signals.",
        message: "Before claiming all software can be observed, check coverage for logs, Windows events, file deltas, and teacher markers.",
        allSoftwareObserverCoverageAudit: true,
        inventory,
        queue,
        outputDir: join(smokeRoot, "default-audit")
      }
    });
    return JSON.parse(result.content[0].text);
  } finally {
    await server.stop();
  }
}

const inventory = {
  format: "transparent_ai_software_observer_inventory_v1",
  inventoryId: "coverage-smoke-inventory",
  goal: "Learn from all local software using low-token evidence.",
  softwareCandidates: [
    {
      software: "BrowserApp",
      processName: "browserapp",
      windowTitle: "Browser App",
      candidateLogFiles: [{ path: "C:/logs/browserapp.log", bytes: 120, lastWriteTimeUtc: "2026-06-08T00:00:00.000Z" }],
      candidateLogRoots: ["C:/logs"],
      windowsEventLogs: ["Application"],
      reason: "has indexed log"
    },
    {
      software: "NoLogModeler",
      processName: "nologmodeler",
      windowTitle: "No Log Modeler",
      candidateLogFiles: [],
      candidateLogRoots: ["C:/modeler"],
      windowsEventLogs: ["Application", "System"],
      reason: "needs fallback"
    },
    {
      software: "UnknownPrivateApp",
      processName: "unknownprivate",
      windowTitle: "",
      candidateLogFiles: [],
      candidateLogRoots: [],
      windowsEventLogs: [],
      reason: "coverage gap"
    }
  ],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true }
};

const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "coverage-smoke-queue",
  queue: [
    {
      queueItemId: "browserapp",
      software: "BrowserApp",
      processName: "browserapp",
      recentLogCandidates: [{ path: "C:/logs/browserapp.log", bytes: 120, lastWriteTimeUtc: "2026-06-08T00:00:00.000Z" }],
      nonLogFallbackRequired: false,
      nonLogFallbackSignals: [],
      nextRunCall: { tool: "run_software_observer_queue_item", arguments: {} }
    },
    {
      queueItemId: "nologmodeler",
      software: "NoLogModeler",
      processName: "nologmodeler",
      recentLogCandidates: [],
      nonLogFallbackRequired: true,
      nonLogFallbackSignals: [
        { sourceType: "windows_event_log", sources: ["Application"], lowTokenUse: "count_and_preview_only_before_screenshot" },
        { sourceType: "manual_teacher_marker", sources: ["teacher marker text"], lowTokenUse: "short_teacher_label_without_screen_recording" }
      ],
      nextRunCall: { tool: "run_software_observer_queue_item", arguments: {} }
    }
  ],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true }
};

const inventoryPath = writeJson("inventory.json", inventory);
const queuePath = writeJson("queue.json", queue);
const learningCyclePath = writeJson("learning-cycle.json", {
  format: "transparent_ai_all_software_low_token_learning_cycle_v1",
  status: "learning_events_waiting_for_teacher_review",
  learningRuns: [
    {
      queueItemId: "nologmodeler",
      software: "NoLogModeler",
      status: "waiting_for_teacher_review",
      nonLogFallbackUsed: true,
      compactEventCount: 2
    }
  ],
  locks: {
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    memoryWritten: false
  }
});
const direct = runNodeScript("create-all-software-observer-coverage-audit.mjs", [
  "--goal",
  "Audit all software observer coverage.",
  "--inventory",
  inventoryPath,
  "--queue",
  queuePath,
  "--learning-cycle",
  learningCyclePath,
  "--output-dir",
  join(smokeRoot, "direct")
]);
const audit = readJson(direct.auditPath);
const receipt = readJson(direct.receiptPath);
const repair = readJson(direct.repairPlanPath);
const mcp = await callAdvanced(inventoryPath, queuePath, learningCyclePath);
const advancedNames = mcp.list.tools.map((tool) => tool.name);
const defaultRoute = await callDefault(inventory, queue);

const browserRow = audit.coverageRows.find((row) => row.software === "BrowserApp");
const fallbackRow = audit.coverageRows.find((row) => row.software === "NoLogModeler");
const gapRow = audit.coverageRows.find((row) => row.software === "UnknownPrivateApp");

const checks = [
  {
    name: "Coverage audit distinguishes log routes, non-log fallbacks, and gaps",
    pass:
      audit.format === "transparent_ai_all_software_observer_coverage_audit_v1" &&
      browserRow.coverageStatus === "covered_with_log_metadata_route" &&
      fallbackRow.coverageStatus === "covered_with_non_log_fallback_and_watch_evidence" &&
      fallbackRow.watchEvidenceCount === 1 &&
      audit.counts.withWatchEvidence === 1 &&
      gapRow.coverageStatus === "needs_teacher_review_or_manual_signal" &&
      audit.counts.totalAudited === 3,
    evidence: direct.auditPath
  },
  {
    name: "Coverage audit creates repair plan for missing queue items and missing signals",
    pass:
      repair.format === "transparent_ai_all_software_observer_coverage_repair_plan_v1" &&
      repair.repairItems.some((item) => item.software === "UnknownPrivateApp") &&
      repair.blockedActions.includes("claim_all_software_covered_without_audit") &&
      gapRow.gaps.includes("missing_observer_queue_item") &&
      gapRow.gaps.includes("missing_log_or_non_log_signal"),
    evidence: direct.repairPlanPath
  },
  {
    name: "Coverage audit reads no log or file contents and keeps screenshots/execution/memory locked",
    pass:
      receipt.format === "transparent_ai_all_software_observer_coverage_audit_receipt_v1" &&
      receipt.logContentsRead === false &&
      receipt.fullLogsRead === false &&
      receipt.fileContentsRead === false &&
      receipt.screenshotsCaptured === false &&
      receipt.fullContinuousRecording === false &&
      receipt.softwareActionsExecuted === false &&
      receipt.memoryWritten === false &&
      receipt.accepted === false &&
      receipt.ruleEnabled === false &&
      receipt.packagingGated === true,
    evidence: direct.receiptPath
  },
  {
    name: "MCP advanced exposes and runs all-software observer coverage audit",
    pass:
      advancedNames.includes("create_all_software_observer_coverage_audit") &&
      advancedNames.length >= 66 &&
      mcp.result.format === "transparent_ai_all_software_observer_coverage_audit_result_v1" &&
      mcp.result.counts.totalAudited === 3 &&
      mcp.result.counts.withWatchEvidence === 1,
    evidence: mcp.result.auditPath
  },
  {
    name: "Default teach_apprentice routes explicit coverage-audit requests to the audit card",
    pass:
      defaultRoute.status === "waiting_for_all_software_observer_coverage_review" &&
      defaultRoute.allSoftwareObserverCoverageAudit?.totalAudited === 3 &&
      defaultRoute.allSoftwareObserverCoverageAudit?.needsTeacherReviewOrManualSignal === 1 &&
      defaultRoute.reviewLocks.packagingGated === true,
    evidence: defaultRoute.allSoftwareObserverCoverageAudit?.auditPath || ""
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  format: "transparent_ai_all_software_observer_coverage_audit_smoke_v1",
  smokeRoot,
  checks,
  passed: checks.length - failed.length,
  total: checks.length,
  status: failed.length === 0 ? "passed" : "failed"
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
