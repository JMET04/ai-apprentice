#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-recurring-monitor-teacher-review-packet-smoke", String(Date.now()));
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

const controlledLog = join(smokeRoot, "controlled-recurring-monitor-review-packet.log");
writeFileSync(controlledLog, "startup complete\n", "utf8");
const controlledQueuePath = join(smokeRoot, "controlled-recurring-monitor-review-packet-queue.json");
writeFileSync(
  controlledQueuePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      queueId: "controlled-recurring-monitor-review-packet",
      queue: [
        {
          queueItemId: "controlled-recurring-review-packet",
          software: "Controlled Engineering Review Tool",
          processName: "controlled-engineering-review-tool.exe",
          score: 0.96,
          recentLogCandidates: [{ path: controlledLog, source: "controlled_recurring_monitor_review_packet" }],
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
  "Schedule controlled recurring monitor teacher review packet proof.",
  "--queue",
  controlledQueuePath,
  "--task-name",
  `TransparentAI-Smoke-TeacherReviewPacket-${Date.now()}`,
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

runPowerShell(["-File", schedule.runnerPath, "-RunLabel", "baseline"]);
appendFileSync(controlledLog, "ERROR teacher-reviewed recurring monitor review packet signal changed\n", "utf8");
runPowerShell(["-File", schedule.runnerPath, "-RunLabel", "changed"]);

const changedAudit = runNodeScript("audit-all-software-recurring-monitor-run-output.mjs", [
  "--goal",
  "Audit recurring monitor output before creating teacher review packet.",
  "--schedule",
  schedule.schedulePath,
  "--output-dir",
  join(smokeRoot, "changed-audit")
]);
const changedAuditPacket = readJson(changedAudit.auditPath);

const directPacket = runNodeScript("create-all-software-recurring-monitor-teacher-review-packet.mjs", [
  "--goal",
  "Create direct teacher review packet from recurring monitor output.",
  "--run-output-audit",
  changedAudit.auditPath,
  "--teacher-style",
  "low token logs first, direct teacher review",
  "--output-dir",
  join(smokeRoot, "direct-packet")
]);
const directPacketJson = readJson(directPacket.packetPath);
const directReceipt = readJson(directPacket.receiptPath);

const teacherProfile = runNodeScript("create-teacher-learning-method-profile.mjs", [
  "--goal",
  "Teacher prefers transparent sketch and visual confirmation after log changes.",
  "--software",
  "Controlled Engineering Review Tool",
  "--teacher-style",
  "transparent overlay sketch, screenshot only after log trigger, visual confirmation",
  "--output-dir",
  join(smokeRoot, "teacher-profile")
]);

const visualPacket = runNodeScript("create-all-software-recurring-monitor-teacher-review-packet.mjs", [
  "--goal",
  "Create visual teacher review packet from recurring monitor output.",
  "--run-output-audit",
  changedAudit.auditPath,
  "--teacher-method-profile",
  teacherProfile.profilePath,
  "--output-dir",
  join(smokeRoot, "visual-packet")
]);
const visualPacketJson = readJson(visualPacket.packetPath);
const visualReceipt = readJson(visualPacket.receiptPath);

const mcpPacket = callMcpTool("create_all_software_recurring_monitor_teacher_review_packet", {
  goal: "Create recurring monitor teacher review packet through MCP.",
  runOutputAudit: changedAudit.auditPath,
  teacherStyle: "low token logs first",
  outputDir: join(smokeRoot, "mcp-packet")
});

const directFirst = directPacketJson.reviewItems[0] || {};
const visualFirst = visualPacketJson.reviewItems[0] || {};
const checks = [
  {
    name: "Run-output audit gives compact recurring monitor learning events to packet builder",
    pass:
      changedAuditPacket.format === "transparent_ai_all_software_recurring_monitor_run_output_audit_v1" &&
      changedAuditPacket.teacherReviewQueue?.length >= 1 &&
      changedAuditPacket.totals?.compactLearningEvents >= 1,
    evidence: changedAudit.auditPath
  },
  {
    name: "Direct teacher-review packet routes compact evidence to teach_apprentice",
    pass:
      directPacket.format === "transparent_ai_all_software_recurring_monitor_teacher_review_packet_result_v1" &&
      directPacket.reviewItemCount >= 1 &&
      directFirst.recommendedTool === "teach_apprentice" &&
      directFirst.nextReviewAction === "ready_for_teacher_teach_apprentice_review",
    evidence: directPacket.packetPath
  },
  {
    name: "Visual teacher-method packet routes changed evidence to triggered visual-check request only",
    pass:
      visualPacket.reviewItemCount >= 1 &&
      visualFirst.recommendedTool === "create_automatic_triggered_visual_check_queue" &&
      visualFirst.nextReviewAction === "needs_triggered_visual_check_review" &&
      visualPacketJson.teacherMethodInfluence.prefersVisual === true &&
      visualReceipt.screenshotsCaptured === false,
    evidence: visualPacket.packetPath
  },
  {
    name: "Teacher review packet remains read-only and keeps memory, screenshots, execution, and packaging locked",
    pass:
      directReceipt.runnerLaunched === false &&
      directReceipt.scheduledTaskRegistered === false &&
      directReceipt.scheduledTaskUnregistered === false &&
      directReceipt.screenshotsCaptured === false &&
      directReceipt.softwareActionsExecuted === false &&
      directReceipt.targetSoftwareCommandsExecuted === false &&
      directReceipt.longTermMemoryWritten === false &&
      directReceipt.nativeUniversalExecution === false &&
      directReceipt.locks?.packagingGated === true,
    evidence: directPacket.receiptPath
  },
  {
    name: "MCP advanced tool exposes recurring monitor teacher review packet",
    pass:
      mcpPacket.format === "transparent_ai_all_software_recurring_monitor_teacher_review_packet_result_v1" &&
      mcpPacket.reviewItemCount >= 1 &&
      mcpPacket.runnerLaunched === false &&
      mcpPacket.scheduledTaskRegistered === false,
    evidence: mcpPacket.packetPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_recurring_monitor_teacher_review_packet_smoke_v1",
  smokeRoot,
  paths: {
    schedule: schedule.schedulePath,
    audit: changedAudit.auditPath,
    directPacket: directPacket.packetPath,
    visualPacket: visualPacket.packetPath,
    mcpPacket: mcpPacket.packetPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
