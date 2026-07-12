#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-recurring-monitor-run-output-audit-smoke", String(Date.now()));
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

const controlledLog = join(smokeRoot, "controlled-recurring-monitor-output.log");
writeFileSync(controlledLog, "startup complete\n", "utf8");
const controlledQueuePath = join(smokeRoot, "controlled-recurring-monitor-output-queue.json");
writeFileSync(
  controlledQueuePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      queueId: "controlled-recurring-monitor-output-audit",
      queue: [
        {
          queueItemId: "controlled-recurring-output",
          software: "Controlled Engineering Tool",
          processName: "controlled-engineering-tool.exe",
          score: 0.94,
          recentLogCandidates: [{ path: controlledLog, source: "controlled_recurring_monitor_output" }],
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
    },
    null,
    2
  ),
  "utf8"
);

const schedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Schedule controlled recurring monitor output audit proof.",
  "--queue",
  controlledQueuePath,
  "--task-name",
  `TransparentAI-Smoke-RunOutput-${Date.now()}`,
  "--interval-minutes",
  "10",
  "--runs-per-launch",
  "1",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12",
  "--max-learning-items",
  "1",
  "--output-dir",
  join(smokeRoot, "schedule")
]);
const schedulePacket = readJson(schedule.schedulePath);

const emptyAudit = runNodeScript("audit-all-software-recurring-monitor-run-output.mjs", [
  "--goal",
  "Audit before the recurring monitor has produced output.",
  "--schedule",
  schedule.schedulePath,
  "--output-dir",
  join(smokeRoot, "empty-audit")
]);
const emptyAuditPacket = readJson(emptyAudit.auditPath);

runPowerShell(["-File", schedule.runnerPath, "-RunLabel", "baseline"]);
appendFileSync(controlledLog, "ERROR teacher-reviewed recurring monitor signal changed\n", "utf8");
runPowerShell(["-File", schedule.runnerPath, "-RunLabel", "changed"]);

const changedAudit = runNodeScript("audit-all-software-recurring-monitor-run-output.mjs", [
  "--goal",
  "Audit recurring monitor output after changed low-token signal.",
  "--schedule",
  schedule.schedulePath,
  "--output-dir",
  join(smokeRoot, "changed-audit")
]);
const changedAuditPacket = readJson(changedAudit.auditPath);
const changedAuditReceipt = readJson(changedAudit.receiptPath);

const mcp = callMcpTool("audit_all_software_recurring_monitor_run_output", {
  goal: "Audit recurring monitor output through MCP.",
  schedule: schedule.schedulePath,
  outputDir: join(smokeRoot, "mcp-audit")
});

const checks = [
  {
    name: "Run-output audit reports no scheduled output before any runner launch",
    pass:
      emptyAudit.format === "transparent_ai_all_software_recurring_monitor_run_output_audit_result_v1" &&
      emptyAudit.status === "waiting_for_first_scheduled_run_output" &&
      emptyAudit.reviewedRunCount === 0 &&
      emptyAuditPacket.locks?.runOutputAuditDoesNotChangeSystem === true,
    evidence: emptyAudit.auditPath
  },
  {
    name: "Manual scheduled runner output becomes teacher-review recurring monitor learning events",
    pass:
      changedAudit.status === "learning_events_waiting_for_teacher_review" &&
      changedAudit.reviewedRunCount >= 1 &&
      changedAudit.totals.compactLearningEvents >= 1 &&
      changedAudit.teacherReviewQueueCount >= 1 &&
      changedAuditPacket.teacherReviewQueue?.[0]?.reviewInstruction.includes("Review compact learning events"),
    evidence: changedAudit.auditPath
  },
  {
    name: "Run-output audit remains read-only and preserves all safety locks",
    pass:
      changedAuditReceipt.runnerLaunched === false &&
      changedAuditReceipt.scheduledTaskRegistered === false &&
      changedAuditReceipt.scheduledTaskUnregistered === false &&
      changedAuditReceipt.screenshotsCaptured === false &&
      changedAuditReceipt.rawFullLogsRetained === false &&
      changedAuditReceipt.softwareActionsExecuted === false &&
      changedAuditReceipt.targetSoftwareCommandsExecuted === false &&
      changedAuditReceipt.longTermMemoryWritten === false &&
      changedAuditReceipt.nativeUniversalExecution === false &&
      changedAuditReceipt.locks?.packagingGated === true,
    evidence: changedAudit.receiptPath
  },
  {
    name: "MCP advanced tool exposes recurring monitor run-output audit",
    pass:
      mcp.format === "transparent_ai_all_software_recurring_monitor_run_output_audit_result_v1" &&
      mcp.status === "learning_events_waiting_for_teacher_review" &&
      mcp.runnerLaunched === false &&
      mcp.scheduledTaskRegistered === false,
    evidence: mcp.auditPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_recurring_monitor_run_output_audit_smoke_v1",
  smokeRoot,
  paths: {
    schedule: schedule.schedulePath,
    emptyAudit: emptyAudit.auditPath,
    changedAudit: changedAudit.auditPath,
    mcpAudit: mcp.auditPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);

