#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-recurring-monitor-registration-runner-smoke", String(Date.now()));
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

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Prepare a real local recurring monitor registration runner smoke.",
  "--max-processes",
  "8",
  "--max-installed",
  "8",
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
  "8",
  "-MaxInstalled",
  "8",
  "-MaxLogFilesPerCandidate",
  "1"
]);
const inventory = readJson(inventoryPath);

const queue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "6",
  "--max-files-per-candidate",
  "1",
  "--max-depth",
  "0",
  "--max-entries-per-dir",
  "32",
  "--output-dir",
  join(smokeRoot, "real-queue")
]);
const queuePacket = readJson(queue.queuePath);

const schedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Create a real local recurring monitor registration runner schedule package.",
  "--queue",
  queue.queuePath,
  "--task-name",
  "TransparentAI-Smoke-Registration-Runner",
  "--interval-minutes",
  "25",
  "--runs-per-launch",
  "1",
  "--max-items",
  "3",
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
  "Approve the real local recurring monitor registration runner smoke.",
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

const blockedRunner = runNodeScript("run-all-software-recurring-monitor-registration-runner.mjs", [
  "--goal",
  "Blocked registration runner smoke.",
  "--approval-gate",
  gate.gatePath,
  "--output-dir",
  join(smokeRoot, "blocked-runner")
]);
const blockedPacket = readJson(blockedRunner.runnerPath);

const dryRunRunner = runNodeScript("run-all-software-recurring-monitor-registration-runner.mjs", [
  "--goal",
  "Dry-run registration runner smoke.",
  "--approval-gate",
  gate.gatePath,
  "--teacher-confirmation",
  "teacher confirmed recurring monitor registration",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "dry-runner")
]);
const dryRunPacket = readJson(dryRunRunner.runnerPath);
const dryRunReceipt = readJson(dryRunRunner.receiptPath);

const executeBlockedRunner = runNodeScript("run-all-software-recurring-monitor-registration-runner.mjs", [
  "--goal",
  "Execute mode remains blocked without system-change allow flag.",
  "--approval-gate",
  gate.gatePath,
  "--teacher-confirmation",
  "teacher confirmed recurring monitor registration",
  "--rollback-point-created",
  "--execute",
  "--output-dir",
  join(smokeRoot, "execute-blocked-runner")
]);
const executeBlockedPacket = readJson(executeBlockedRunner.runnerPath);

const mcp = callMcpTool("run_all_software_recurring_monitor_registration_runner", {
  goal: "Dry-run registration runner through MCP.",
  approvalGate: gate.gatePath,
  teacherConfirmation: "teacher confirmed recurring monitor registration",
  rollbackPointCreated: true,
  outputDir: join(smokeRoot, "mcp-runner")
});

const checks = [
  {
    name: "Real local schedule and approval gate provide a reviewed registration request",
    pass:
      inventory.format === "transparent_ai_software_observer_inventory_v1" &&
      inventory.softwareCandidates?.length > 0 &&
      queuePacket.format === "transparent_ai_software_observer_queue_v1" &&
      queuePacket.queue?.length > 0 &&
      schedulePacket.format === "transparent_ai_automatic_low_token_learning_schedule_v1" &&
      existsSync(schedulePacket.files?.registerTask || "") &&
      existsSync(schedulePacket.files?.unregisterTask || "") &&
      gatePacket.readyForRegistrationRequest === true,
    evidence: `${inventoryPath}; ${queue.queuePath}; ${schedule.schedulePath}; ${gate.gatePath}`
  },
  {
    name: "Registration runner blocks without explicit registration confirmation and rollback",
    pass:
      blockedRunner.status === "blocked_before_recurring_monitor_registration_runner" &&
      blockedPacket.blockers.includes("missing_explicit_teacher_registration_confirmation") &&
      blockedPacket.blockers.includes("rollback_point_not_confirmed_for_registration_runner") &&
      blockedRunner.taskRegistered === false,
    evidence: blockedRunner.runnerPath
  },
  {
    name: "Registration runner dry-run creates register and unregister commands without installing a task",
    pass:
      dryRunRunner.status === "dry_run_ready_for_teacher_review" &&
      dryRunPacket.dryRunOnly === true &&
      dryRunPacket.executeRequested === false &&
      dryRunPacket.registerCommand?.args.includes("-TeacherConfirmed") &&
      dryRunPacket.unregisterCommand?.args.includes("-TeacherConfirmed") &&
      existsSync(dryRunPacket.files?.wrapper || "") &&
      dryRunReceipt.taskRegistered === false &&
      dryRunReceipt.scheduledTaskInstalled === false,
    evidence: dryRunRunner.receiptPath
  },
  {
    name: "Execute mode remains blocked unless the system-change allow flag is explicit",
    pass:
      executeBlockedRunner.status === "blocked_before_recurring_monitor_registration_runner" &&
      executeBlockedPacket.blockers.includes("execute_requested_without_allow_system_change") &&
      executeBlockedRunner.taskRegistered === false &&
      executeBlockedRunner.scheduledTaskInstalled === false,
    evidence: executeBlockedRunner.runnerPath
  },
  {
    name: "Registration runner keeps screenshots memory software execution and native control locked in dry-run",
    pass:
      dryRunReceipt.screenshotsCaptured === false &&
      dryRunReceipt.rawFullLogsRetained === false &&
      dryRunReceipt.longTermMemoryWritten === false &&
      dryRunReceipt.softwareActionsExecuted === false &&
      dryRunReceipt.targetSoftwareCommandsExecuted === false &&
      dryRunReceipt.nativeUniversalExecution === false,
    evidence: dryRunRunner.receiptPath
  },
  {
    name: "MCP advanced tool exposes the registration runner dry-run path",
    pass:
      mcp.format === "transparent_ai_all_software_recurring_monitor_registration_runner_result_v1" &&
      mcp.status === "dry_run_ready_for_teacher_review" &&
      mcp.taskRegistered === false,
    evidence: mcp.runnerPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_recurring_monitor_registration_runner_smoke_v1",
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
    blockedRunner: blockedRunner.runnerPath,
    dryRunRunner: dryRunRunner.runnerPath,
    executeBlockedRunner: executeBlockedRunner.runnerPath,
    mcpRunner: mcp.runnerPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
