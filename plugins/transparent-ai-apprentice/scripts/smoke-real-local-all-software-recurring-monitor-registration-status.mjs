#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-recurring-monitor-registration-status-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = smokeRoot) {
  const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${args.join(" ")} failed`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function callMcpTool(name, args = {}) {
  const request = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "1" } } }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } })
  ].join("\n");
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", "mcp-server.mjs")], {
    cwd: repoRoot,
    env: { ...process.env, TRANSPARENT_AI_APPRENTICE_EXPOSE_ADVANCED_TOOLS: "1" },
    input: `${request}\n`,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `MCP ${name} failed`);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const call = lines.find((line) => line.id === 2);
  const text = call?.result?.content?.[0]?.text || "";
  return JSON.parse(text);
}

const taskName = `TransparentAI-Smoke-Status-${Date.now()}`;

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Prepare a real local recurring monitor registration status smoke.",
  "--max-processes",
  "6",
  "--max-installed",
  "6",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
runPowerShell([
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "6",
  "-MaxInstalled",
  "6",
  "-MaxLogFilesPerCandidate",
  "1"
]);
const inventory = readJson(inventoryPath);

const queue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "4",
  "--max-files-per-candidate",
  "1",
  "--max-depth",
  "0",
  "--max-entries-per-dir",
  "24",
  "--output-dir",
  join(smokeRoot, "real-queue")
]);
const queuePacket = readJson(queue.queuePath);

const schedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Create a real local recurring monitor registration status schedule package.",
  "--queue",
  queue.queuePath,
  "--task-name",
  taskName,
  "--interval-minutes",
  "25",
  "--runs-per-launch",
  "1",
  "--max-items",
  "2",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "1024",
  "--max-tail-lines",
  "20",
  "--max-learning-items",
  "1",
  "--output-dir",
  join(smokeRoot, "real-schedule")
]);
const schedulePacket = readJson(schedule.schedulePath);

const gate = runNodeScript("create-all-software-recurring-monitor-approval-gate.mjs", [
  "--goal",
  "Approve the real local recurring monitor registration status smoke.",
  "--schedule",
  schedule.schedulePath,
  "--teacher-confirmation",
  "teacher confirmed all-software recurring monitoring",
  "--scope-confirmation",
  "teacher reviewed monitored software scope",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-gate")
]);
const gatePacket = readJson(gate.gatePath);

const runner = runNodeScript("run-all-software-recurring-monitor-registration-runner.mjs", [
  "--goal",
  "Dry-run registration runner for status verification smoke.",
  "--approval-gate",
  gate.gatePath,
  "--teacher-confirmation",
  "teacher confirmed recurring monitor registration",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "dry-runner")
]);
const runnerPacket = readJson(runner.runnerPath);

const status = runNodeScript("verify-all-software-recurring-monitor-registration-status.mjs", [
  "--goal",
  "Verify status for a not-yet-registered recurring monitor smoke.",
  "--registration-runner",
  runner.runnerPath,
  "--output-dir",
  join(smokeRoot, "status-verifier")
]);
const statusPacket = readJson(status.statusPath);
const statusReceipt = readJson(status.receiptPath);

const mcp = callMcpTool("verify_all_software_recurring_monitor_registration_status", {
  goal: "Verify status through MCP.",
  registrationRunner: runner.runnerPath,
  outputDir: join(smokeRoot, "mcp-status-verifier")
});

const checks = [
  {
    name: "Real local runner evidence feeds a read-only scheduled task status verifier",
    pass:
      inventory.format === "transparent_ai_software_observer_inventory_v1" &&
      queuePacket.format === "transparent_ai_software_observer_queue_v1" &&
      schedulePacket.format === "transparent_ai_automatic_low_token_learning_schedule_v1" &&
      gatePacket.readyForRegistrationRequest === true &&
      runnerPacket.format === "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
    evidence: `${inventoryPath}; ${queue.queuePath}; ${schedule.schedulePath}; ${gate.gatePath}; ${runner.runnerPath}`
  },
  {
    name: "Status verifier detects the unique smoke task is not registered without changing the system",
    pass:
      status.format === "transparent_ai_all_software_recurring_monitor_registration_status_result_v1" &&
      status.status === "verified_not_registered_yet" &&
      status.taskRegistered === false &&
      status.scheduledTaskInstalled === false &&
      status.queryChangedSystem === false &&
      statusPacket.queryResult?.queryChangedSystem === false,
    evidence: status.statusPath
  },
  {
    name: "Status verifier preserves unregister handoff and all safety locks",
    pass:
      Boolean(status.unregisterCommand?.scriptPath) &&
      statusReceipt.registerTaskCalled === false &&
      statusReceipt.unregisterTaskCalled === false &&
      statusReceipt.startTaskCalled === false &&
      statusReceipt.softwareActionsExecuted === false &&
      statusReceipt.targetSoftwareCommandsExecuted === false &&
      statusReceipt.longTermMemoryWritten === false &&
      statusReceipt.nativeUniversalExecution === false &&
      statusReceipt.locks?.packagingGated === true &&
      statusReceipt.locks?.accepted === false &&
      statusReceipt.locks?.ruleEnabled === false,
    evidence: status.receiptPath
  },
  {
    name: "MCP advanced tool exposes the read-only registration status verifier",
    pass:
      mcp.format === "transparent_ai_all_software_recurring_monitor_registration_status_result_v1" &&
      mcp.status === "verified_not_registered_yet" &&
      mcp.taskRegistered === false &&
      mcp.queryChangedSystem === false,
    evidence: mcp.statusPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_recurring_monitor_registration_status_smoke_v1",
  smokeRoot,
  counts: {
    inventoryCandidates: inventory.softwareCandidates?.length ?? 0,
    queueItems: queuePacket.queue?.length ?? 0
  },
  paths: {
    inventory: inventoryPath,
    queue: queue.queuePath,
    schedule: schedule.schedulePath,
    approvalGate: gate.gatePath,
    runner: runner.runnerPath,
    status: status.statusPath,
    mcpStatus: mcp.statusPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);

