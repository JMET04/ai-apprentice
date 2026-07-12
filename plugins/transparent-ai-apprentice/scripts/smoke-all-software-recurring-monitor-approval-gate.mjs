#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-recurring-monitor-approval-gate-smoke", String(Date.now()));
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

const reviewedQueuePath = join(smokeRoot, "reviewed-all-software-observer-queue.json");
writeFileSync(
  reviewedQueuePath,
  `${JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      reviewedByTeacher: true,
      queue: [
        {
          id: "reviewed-app-1",
          displayName: "Reviewed App 1",
          processName: "reviewed-app-1.exe",
          candidateLogFiles: [join(smokeRoot, "reviewed-app-1.log")],
          nonLogFallbackSignals: []
        }
      ],
      exclusionsReviewed: true
    },
    null,
    2
  )}\n`,
  "utf8"
);

const schedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Run recurring all-software low-token learning only for reviewed queue rows.",
  "--queue",
  reviewedQueuePath,
  "--task-name",
  "TransparentAI-Apprentice-Recurring-Monitor-Smoke",
  "--interval-minutes",
  "30",
  "--runs-per-launch",
  "1",
  "--output-dir",
  join(smokeRoot, "schedule")
]);
const schedulePacket = readJson(schedule.schedulePath);

const blocked = runNodeScript("create-all-software-recurring-monitor-approval-gate.mjs", [
  "--goal",
  "Approve recurring all-software low-token monitor.",
  "--schedule",
  schedule.schedulePath,
  "--output-dir",
  join(smokeRoot, "blocked-gate")
]);
const blockedPacket = readJson(blocked.gatePath);

const ready = runNodeScript("create-all-software-recurring-monitor-approval-gate.mjs", [
  "--goal",
  "Approve recurring all-software low-token monitor.",
  "--schedule",
  schedule.schedulePath,
  "--teacher-confirmation",
  "teacher confirmed recurring low-token monitoring",
  "--scope-confirmation",
  "teacher reviewed monitored software scope",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-gate")
]);
const readyPacket = readJson(ready.gatePath);
const readyReceipt = readJson(ready.receiptPath);

const mcp = callMcpTool("create_all_software_recurring_monitor_approval_gate", {
  goal: "Approve recurring all-software low-token monitor through MCP.",
  schedule: schedule.schedulePath,
  teacherConfirmation: "teacher confirmed recurring low-token monitoring",
  scopeConfirmation: "teacher reviewed monitored software scope",
  rollbackPointCreated: true,
  outputDir: join(smokeRoot, "mcp-gate")
});

const checks = [
  {
    name: "Schedule package exists but does not register a recurring monitor by itself",
    pass:
      schedulePacket.format === "transparent_ai_automatic_low_token_learning_schedule_v1" &&
      schedulePacket.files?.registerTask &&
      existsSync(schedulePacket.files.registerTask) &&
      schedulePacket.schedulePolicy?.requiresTeacherConfirmedFlag === true &&
      schedulePacket.locks?.scheduledTaskInstalled === false,
    evidence: schedule.schedulePath
  },
  {
    name: "Recurring monitor approval gate blocks registration without scope, teacher confirmation, and rollback",
    pass:
      blocked.status === "blocked_before_recurring_monitor_registration_request" &&
      blockedPacket.blockers.includes("missing_explicit_teacher_recurring_monitor_confirmation") &&
      blockedPacket.blockers.includes("missing_reviewed_monitor_scope_confirmation") &&
      blockedPacket.blockers.includes("rollback_point_not_confirmed_for_recurring_monitor") &&
      blockedPacket.locks.approvalGateDoesNotRegisterTask === true,
    evidence: blocked.gatePath
  },
  {
    name: "Recurring monitor approval gate validates schedule, reviewed scope, teacher confirmation, and rollback",
    pass:
      ready.status === "ready_for_teacher_confirmed_recurring_monitor_registration_request" &&
      readyPacket.readyForRegistrationRequest === true &&
      readyPacket.teacherConfirmationMatched === true &&
      readyPacket.scopeConfirmationMatched === true &&
      readyPacket.rollbackPointCreated === true &&
      readyPacket.generatedRegistrationRequest?.args.includes("-TeacherConfirmed") &&
      readyPacket.blockers.length === 0,
    evidence: ready.gatePath
  },
  {
    name: "Approval gate produces registration request but does not install a scheduled task",
    pass:
      readyReceipt.taskRegistered === false &&
      readyReceipt.scheduledTaskInstalled === false &&
      readyReceipt.softwareActionsExecuted === false &&
      readyReceipt.longTermMemoryWritten === false &&
      readyReceipt.nativeUniversalExecution === false,
    evidence: ready.receiptPath
  },
  {
    name: "MCP advanced tool exposes the recurring monitor approval gate",
    pass:
      mcp.format === "transparent_ai_all_software_recurring_monitor_approval_gate_result_v1" &&
      mcp.status === "ready_for_teacher_confirmed_recurring_monitor_registration_request",
    evidence: mcp.gatePath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_recurring_monitor_approval_gate_smoke_v1",
  smokeRoot,
  paths: {
    schedule: schedule.schedulePath,
    blockedGate: blocked.gatePath,
    readyGate: ready.gatePath,
    mcpGate: mcp.gatePath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
