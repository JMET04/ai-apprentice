#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-recurring-monitor-review-decision-replay-queue-smoke", String(Date.now()));
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
  return JSON.parse(call?.result?.content?.[0]?.text || "{}");
}

const packetPath = join(smokeRoot, "teacher-review-packet.json");
writeFileSync(
  packetPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
      packetId: "smoke-recurring-monitor-review-packet",
      status: "compact_learning_events_waiting_for_teacher_review",
      reviewItems: [
        {
          reviewItemId: "recurring-monitor-review-001",
          runId: "run-direct",
          nextReviewAction: "ready_for_teacher_teach_apprentice_review",
          recommendedTool: "teach_apprentice",
          reason: "Compact evidence is ready for teacher review.",
          evidencePaths: {
            journalPath: join(smokeRoot, "direct-runner.json"),
            receiptPath: join(smokeRoot, "direct-receipt.json")
          },
          nextMcpCall: {
            tool: "teach_apprentice",
            arguments: {
              goal: "Review direct compact recurring monitor evidence.",
              message: "Journal and receipt are ready for review."
            },
            blockedUntil: "teacher approves or corrects replay"
          }
        },
        {
          reviewItemId: "recurring-monitor-review-002",
          runId: "run-visual",
          nextReviewAction: "needs_triggered_visual_check_review",
          recommendedTool: "create_automatic_triggered_visual_check_queue",
          reason: "Teacher method asks for visual grounding after a log trigger.",
          evidencePaths: {
            journalPath: join(smokeRoot, "visual-runner.json"),
            receiptPath: join(smokeRoot, "visual-receipt.json")
          },
          nextMcpCall: {
            tool: "create_automatic_triggered_visual_check_queue",
            arguments: {
              goal: "Create one triggered visual check request.",
              runner: join(smokeRoot, "visual-runner.json"),
              maxRequests: 1,
              forceRequest: true
            },
            blockedUntil: "teacher confirms bounded visual check"
          }
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true
      }
    },
    null,
    2
  ),
  "utf8"
);

const defaultReplay = runNodeScript("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
  "--teacher-review-packet",
  packetPath,
  "--output-dir",
  join(smokeRoot, "default-replay")
]);
const defaultQueue = readJson(defaultReplay.queuePath);

const mixedDecisionsPath = join(smokeRoot, "mixed-decisions.json");
writeFileSync(
  mixedDecisionsPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_recurring_monitor_review_decisions_v1",
      decisions: [
        { reviewItemId: "recurring-monitor-review-001", decision: "ready_for_follow_up", note: "compact evidence looks ready" },
        { reviewItemId: "recurring-monitor-review-002", decision: "blocked", note: "need a clearer software window before visual check" }
      ]
    },
    null,
    2
  ),
  "utf8"
);
const mixedReplay = runNodeScript("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
  "--teacher-review-packet",
  packetPath,
  "--decisions",
  mixedDecisionsPath,
  "--output-dir",
  join(smokeRoot, "mixed-replay")
]);
const mixedQueue = readJson(mixedReplay.queuePath);
const mixedReceipt = readJson(mixedReplay.receiptPath);

const invalidReplay = runNodeScript("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
  "--teacher-review-packet",
  packetPath,
  "--decision",
  "recurring-monitor-review-001=accepted",
  "--output-dir",
  join(smokeRoot, "invalid-replay")
]);
const invalidQueue = readJson(invalidReplay.queuePath);
const invalidReceipt = readJson(invalidReplay.receiptPath);

const mcpReplay = callMcpTool("create_all_software_recurring_monitor_review_decision_replay_queue", {
  goal: "Replay recurring monitor teacher review decisions through MCP.",
  teacherReviewPacket: packetPath,
  decisions: mixedDecisionsPath,
  outputDir: join(smokeRoot, "mcp-replay")
});

const checks = [
  {
    name: "Default replay keeps all recurring monitor review rows waiting for teacher evidence",
    pass:
      defaultReplay.format === "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_result_v1" &&
      defaultReplay.status === "teacher_review_decisions_waiting_for_more_evidence" &&
      defaultQueue.replayItems.every((item) => item.lane === "teacher_evidence_still_needed"),
    evidence: defaultReplay.queuePath
  },
  {
    name: "Mixed decisions replay queues follow-up while preserving blockers",
    pass:
      mixedReplay.status === "follow_up_actions_waiting_for_teacher_review" &&
      mixedQueue.replayItems.some((item) => item.lane === "compact_teaching_follow_up_ready" && item.nextMcpCall?.tool === "teach_apprentice") &&
      mixedQueue.replayItems.some((item) => item.lane === "blocker_preserved") &&
      mixedReceipt.followUpCount === 1 &&
      mixedReceipt.blockerCount === 1,
    evidence: mixedReplay.queuePath
  },
  {
    name: "Accepted decisions are explicitly blocked and do not enable memory or rules",
    pass:
      invalidReplay.status === "blocked_invalid_review_decisions" &&
      invalidQueue.replayItems.some((item) => item.lane === "blocked_invalid_acceptance_decision") &&
      invalidReceipt.acceptedDecisionBlocked === true &&
      invalidReceipt.locks?.accepted === false &&
      invalidReceipt.locks?.ruleEnabled === false,
    evidence: invalidReplay.queuePath
  },
  {
    name: "Decision replay remains read-only and keeps screenshots, execution, schedules, memory, and packaging locked",
    pass:
      mixedReceipt.runnerLaunched === false &&
      mixedReceipt.scheduledTaskRegistered === false &&
      mixedReceipt.scheduledTaskUnregistered === false &&
      mixedReceipt.screenshotsCaptured === false &&
      mixedReceipt.softwareActionsExecuted === false &&
      mixedReceipt.targetSoftwareCommandsExecuted === false &&
      mixedReceipt.longTermMemoryWritten === false &&
      mixedReceipt.nativeUniversalExecution === false &&
      mixedReceipt.locks?.packagingGated === true,
    evidence: mixedReplay.receiptPath
  },
  {
    name: "MCP advanced tool exposes recurring monitor review decision replay queue",
    pass:
      mcpReplay.format === "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_result_v1" &&
      mcpReplay.followUpCount === 1 &&
      mcpReplay.runnerLaunched === false &&
      mcpReplay.scheduledTaskRegistered === false,
    evidence: mcpReplay.queuePath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_smoke_v1",
  smokeRoot,
  paths: {
    packet: packetPath,
    defaultReplay: defaultReplay.queuePath,
    mixedReplay: mixedReplay.queuePath,
    invalidReplay: invalidReplay.queuePath,
    mcpReplay: mcpReplay.queuePath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
