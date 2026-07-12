#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-unattended-learning-audit-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000
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

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const controlledLog = join(smokeRoot, "controlled-unattended-learning.log");
writeFileSync(controlledLog, "startup complete\n", "utf8");
const queuePath = join(smokeRoot, "controlled-unattended-learning-queue.json");
writeFileSync(
  queuePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      queueId: "controlled-unattended-learning-audit",
      queue: [
        {
          queueItemId: "controlled-unattended-learning",
          software: "Controlled Engineering Tool",
          processName: "controlled-engineering-tool.exe",
          score: 0.94,
          recentLogCandidates: [{ path: controlledLog, source: "controlled_unattended_learning_audit" }],
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

const taskName = `TransparentAI-Smoke-Unattended-${Date.now()}`;
const schedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Schedule controlled unattended learning audit proof.",
  "--queue",
  queuePath,
  "--task-name",
  taskName,
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

const missingAudit = runNodeScript("create-all-software-unattended-learning-audit.mjs", [
  "--goal",
  "Audit missing recurring monitor chain evidence.",
  "--schedule",
  schedule.schedulePath,
  "--output-dir",
  join(smokeRoot, "missing-audit")
]);
const missingAuditPacket = readJson(missingAudit.auditPath);

const approval = runNodeScript("create-all-software-recurring-monitor-approval-gate.mjs", [
  "--goal",
  "Approve controlled recurring low-token learning monitor.",
  "--schedule",
  schedule.schedulePath,
  "--teacher-confirmation",
  "teacher confirmed recurring low-token monitoring",
  "--scope-confirmation",
  "teacher reviewed monitored software scope",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "approval")
]);

const runner = runNodeScript("run-all-software-recurring-monitor-registration-runner.mjs", [
  "--goal",
  "Dry-run controlled recurring low-token learning registration.",
  "--approval-gate",
  approval.gatePath,
  "--teacher-confirmation",
  "teacher confirmed recurring monitor registration",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "registration-runner")
]);

const registrationStatus = runNodeScript("verify-all-software-recurring-monitor-registration-status.mjs", [
  "--goal",
  "Verify controlled recurring monitor is not registered during smoke.",
  "--registration-runner",
  runner.runnerPath,
  "--task-name",
  taskName,
  "--output-dir",
  join(smokeRoot, "registration-status")
]);

runPowerShell(["-File", schedule.runnerPath, "-RunLabel", "baseline"]);
appendFileSync(controlledLog, "ERROR teacher-reviewed unattended learning signal changed\n", "utf8");
runPowerShell(["-File", schedule.runnerPath, "-RunLabel", "changed"]);

const runOutput = runNodeScript("audit-all-software-recurring-monitor-run-output.mjs", [
  "--goal",
  "Audit controlled unattended learning run output.",
  "--schedule",
  schedule.schedulePath,
  "--registration-runner",
  runner.runnerPath,
  "--registration-status",
  registrationStatus.statusPath,
  "--output-dir",
  join(smokeRoot, "run-output-audit")
]);

const reviewPacket = runNodeScript("create-all-software-recurring-monitor-teacher-review-packet.mjs", [
  "--goal",
  "Create teacher review packet for controlled unattended learning output.",
  "--run-output-audit",
  runOutput.auditPath,
  "--teacher-style",
  "prefer compact log evidence before screenshots",
  "--output-dir",
  join(smokeRoot, "teacher-review")
]);
const packet = readJson(reviewPacket.packetPath);
const decisions = {};
for (const item of packet.reviewItems || []) decisions[item.reviewItemId] = "ready_for_follow_up";
const decisionsPath = join(smokeRoot, "review-decisions.json");
writeFileSync(decisionsPath, `${JSON.stringify(decisions, null, 2)}\n`, "utf8");

const replay = runNodeScript("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
  "--goal",
  "Replay controlled unattended learning review decisions.",
  "--teacher-review-packet",
  reviewPacket.packetPath,
  "--decisions",
  decisionsPath,
  "--output-dir",
  join(smokeRoot, "decision-replay")
]);

const reviewedAudit = runNodeScript("create-all-software-unattended-learning-audit.mjs", [
  "--goal",
  "Audit controlled unattended low-token learning chain.",
  "--schedule",
  schedule.schedulePath,
  "--approval-gate",
  approval.gatePath,
  "--registration-runner",
  runner.runnerPath,
  "--registration-status",
  registrationStatus.statusPath,
  "--run-output-audit",
  runOutput.auditPath,
  "--teacher-review-packet",
  reviewPacket.packetPath,
  "--review-decision-replay-queue",
  replay.queuePath,
  "--output-dir",
  join(smokeRoot, "reviewed-audit")
]);
const reviewedAuditPacket = readJson(reviewedAudit.auditPath);
const reviewedReceipt = readJson(reviewedAudit.receiptPath);

const checks = [
  check(
    "Unattended learning audit detects missing chain evidence before completion",
    missingAuditPacket.format === "transparent_ai_all_software_unattended_learning_audit_v1" &&
      missingAuditPacket.status === "unattended_learning_not_ready_remaining_gaps" &&
      missingAuditPacket.remainingGaps.some((gap) => gap.kind === "missing_recurring_monitor_approval_gate") &&
      missingAuditPacket.unattendedAllAppMonitoringComplete === false,
    missingAudit.auditPath
  ),
  check(
    "Unattended learning audit aggregates schedule approval runner status output review and replay evidence",
    reviewedAuditPacket.evidence.schedule.present === true &&
      reviewedAuditPacket.evidence.approvalGate.present === true &&
      reviewedAuditPacket.evidence.registrationRunner.present === true &&
      reviewedAuditPacket.evidence.registrationStatus.present === true &&
      reviewedAuditPacket.evidence.runOutputAudit.present === true &&
      reviewedAuditPacket.evidence.teacherReviewPacket.present === true &&
      reviewedAuditPacket.evidence.reviewDecisionReplayQueue.present === true &&
      reviewedAuditPacket.evidenceCounts.reviewedRunCount >= 1 &&
      reviewedAuditPacket.evidenceCounts.compactLearningEvents >= 1,
    JSON.stringify(reviewedAuditPacket.evidenceCounts)
  ),
  check(
    "Unattended learning audit keeps operational completion unclaimed when task is not registered",
    reviewedAuditPacket.status === "unattended_learning_not_ready_remaining_gaps" &&
      reviewedAuditPacket.remainingGaps.some((gap) => gap.kind === "scheduled_task_not_registered_or_not_matching") &&
      reviewedAuditPacket.unattendedAllAppMonitoringComplete === false &&
      reviewedAuditPacket.completionBoundary.unattendedAllAppMonitoringComplete === false,
    reviewedAudit.auditPath
  ),
  check(
    "Unattended learning audit preserves schedule runner screenshots memory execution and packaging locks",
    reviewedReceipt.format === "transparent_ai_all_software_unattended_learning_audit_receipt_v1" &&
      reviewedReceipt.scheduledTaskRegistered === false &&
      reviewedReceipt.runnerLaunched === false &&
      reviewedReceipt.screenshotsCaptured === false &&
      reviewedReceipt.rawFullLogsRetained === false &&
      reviewedReceipt.logContentsRead === false &&
      reviewedReceipt.softwareActionsExecuted === false &&
      reviewedReceipt.targetSoftwareCommandsExecuted === false &&
      reviewedReceipt.longTermMemoryWritten === false &&
      reviewedReceipt.nativeUniversalExecution === false &&
      reviewedReceipt.packagingGated === true,
    reviewedAudit.receiptPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_unattended_learning_audit_smoke_v1",
  smokeRoot,
  paths: {
    schedule: schedule.schedulePath,
    approvalGate: approval.gatePath,
    registrationRunner: runner.runnerPath,
    registrationStatus: registrationStatus.statusPath,
    runOutputAudit: runOutput.auditPath,
    teacherReviewPacket: reviewPacket.packetPath,
    replayQueue: replay.queuePath,
    reviewedAudit: reviewedAudit.auditPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
