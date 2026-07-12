#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-operational-learning-workbench")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-learning-workbench"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function firstPath(...values) {
  return values.find((value) => value && String(value).trim()) || "";
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function evidenceStatus(packet) {
  if (!packet.value) return "missing";
  return packet.value.status || "provided";
}

function buildLocks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    operationalWorkbenchDoesNotRegisterTask: true,
    operationalWorkbenchDoesNotLaunchRunner: true,
    operationalWorkbenchDoesNotStartTask: true,
    operationalWorkbenchDoesNotCaptureScreenshots: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false,
    teacherConfirmationRequiredBeforeSystemChanges: true,
    rollbackPointRequiredBeforeRegistration: true
  };
}

function readmeLines(packet) {
  const lines = [
    "# All-Software Operational Low-Token Learning Workbench",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    "",
    "Open these in order:",
    `1. Workbench JSON: ${packet.paths.workbench}`,
    `2. Receipt: ${packet.paths.receipt}`,
    packet.paths.readinessPackage ? `3. Readiness package: ${packet.paths.readinessPackage}` : "3. Readiness package: missing",
    packet.paths.schedule ? `4. Schedule package: ${packet.paths.schedule}` : "4. Schedule package: missing",
    packet.paths.approvalGate ? `5. Approval gate: ${packet.paths.approvalGate}` : "5. Approval gate: missing",
    packet.paths.registrationRunner ? `6. Registration runner: ${packet.paths.registrationRunner}` : "6. Registration runner: missing",
    packet.paths.registrationStatus ? `7. Registration status: ${packet.paths.registrationStatus}` : "7. Registration status: missing",
    packet.paths.runOutputAudit ? `8. Run-output audit: ${packet.paths.runOutputAudit}` : "8. Run-output audit: missing",
    packet.paths.teacherReviewPacket ? `9. Teacher review packet: ${packet.paths.teacherReviewPacket}` : "9. Teacher review packet: missing",
    packet.paths.replayQueue ? `10. Review decision replay queue: ${packet.paths.replayQueue}` : "10. Review decision replay queue: missing",
    packet.paths.unattendedAudit ? `11. Unattended learning audit: ${packet.paths.unattendedAudit}` : "11. Unattended learning audit: missing",
    "",
    "Next safe commands:",
    "",
    "```powershell"
  ];
  for (const step of packet.nextSafeCommands) lines.push(step.command);
  lines.push(
    "```",
    "",
    "Blocked actions:",
    ...packet.blockedActions.map((action) => `- ${action}`),
    "",
    "This workbench is an operations guide and evidence index. It does not register Windows Scheduled Tasks, launch runners, start tasks, capture screenshots, read full logs, execute target software, write long-term memory, enable rules, accept technology, or unlock packaging."
  );
  return lines;
}

const goal = argValue(
  "--goal",
  "Operationalize reviewed all-software low-token learning without silent system changes."
);
const readiness = readJsonInput(argValue("--readiness-package", argValue("--readiness", "")), "--readiness-package");
const schedule = readJsonInput(argValue("--schedule", readiness.value?.paths?.automaticSchedule || ""), "--schedule");
const approvalGate = readJsonInput(argValue("--approval-gate", argValue("--gate", "")), "--approval-gate");
const registrationRunner = readJsonInput(argValue("--registration-runner", argValue("--runner", "")), "--registration-runner");
const registrationStatus = readJsonInput(argValue("--registration-status", argValue("--status", "")), "--registration-status");
const runOutputAudit = readJsonInput(argValue("--run-output-audit", argValue("--output-audit", "")), "--run-output-audit");
const teacherReviewPacket = readJsonInput(argValue("--teacher-review-packet", argValue("--review-packet", "")), "--teacher-review-packet");
const replayQueue = readJsonInput(argValue("--review-decision-replay-queue", argValue("--replay-queue", "")), "--review-decision-replay-queue");
const unattendedAudit = readJsonInput(argValue("--unattended-audit", argValue("--audit", "")), "--unattended-audit");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-workbenches")));

mkdirSync(outputRoot, { recursive: true });
const workbenchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const workbenchDir = join(outputRoot, workbenchId);
mkdirSync(workbenchDir, { recursive: true });

const workbenchPath = join(workbenchDir, "all-software-operational-learning-workbench.json");
const receiptPath = join(workbenchDir, "all-software-operational-learning-workbench-receipt.json");
const readmePath = join(workbenchDir, "ALL_SOFTWARE_OPERATIONAL_LEARNING_WORKBENCH_START_HERE.md");

const taskRegistered = registrationStatus.value?.status === "registered_and_matches_reviewed_runner";
const reviewedOutputReady =
  runOutputAudit.value?.status === "learning_events_waiting_for_teacher_review" ||
  Number(runOutputAudit.value?.totals?.compactLearningEvents || 0) > 0;
const reviewReplayed = Boolean(replayQueue.value);
const unattendedReady = unattendedAudit.value?.status === "unattended_learning_ready_for_teacher_operational_review";
const remainingGaps = [];
if (!readiness.value) remainingGaps.push("missing_real_local_readiness_package");
if (!schedule.value) remainingGaps.push("missing_automatic_low_token_schedule");
if (!approvalGate.value) remainingGaps.push("missing_recurring_monitor_approval_gate");
if (!registrationRunner.value) remainingGaps.push("missing_registration_runner");
if (!registrationStatus.value) remainingGaps.push("missing_registration_status_verifier");
if (registrationStatus.value && !taskRegistered) remainingGaps.push("scheduled_task_not_registered_or_not_matching");
if (!runOutputAudit.value) remainingGaps.push("missing_recurring_run_output_audit");
if (runOutputAudit.value && !reviewedOutputReady) remainingGaps.push("waiting_for_compact_learning_run_output");
if (!teacherReviewPacket.value) remainingGaps.push("missing_teacher_review_packet");
if (!reviewReplayed) remainingGaps.push("missing_review_decision_replay_queue");
if (!unattendedAudit.value) remainingGaps.push("missing_unattended_completion_audit");
if (unattendedAudit.value && !unattendedReady) remainingGaps.push("unattended_audit_not_ready_for_operational_review");

const status = unattendedReady && remainingGaps.length === 0
  ? "ready_for_teacher_operational_review"
  : taskRegistered
    ? "registered_waiting_for_reviewed_learning_output_or_audit"
    : "waiting_for_teacher_registration_or_manual_runner";

const schedulePath = schedule.path || readiness.value?.paths?.automaticSchedule || "";
const approvalGatePath = approvalGate.path || "";
const registrationRunnerPath = registrationRunner.path || "";
const registrationStatusPath = registrationStatus.path || "";
const runOutputAuditPath = runOutputAudit.path || "";
const teacherReviewPacketPath = teacherReviewPacket.path || "";
const replayQueuePath = replayQueue.path || "";
const unattendedAuditPath = unattendedAudit.path || "";

const nextSafeCommands = [
  {
    label: "Create or refresh readiness package",
    command: commandLine("create-real-local-all-software-low-token-readiness-package.mjs", [["--goal", goal]])
  },
  {
    label: "Create approval gate from reviewed schedule",
    command: commandLine("create-all-software-recurring-monitor-approval-gate.mjs", [
      ["--goal", goal],
      ["--schedule", schedulePath]
    ])
  },
  {
    label: "Create dry-run-first registration runner after rollback review",
    command: commandLine("run-all-software-recurring-monitor-registration-runner.mjs", [
      ["--goal", goal],
      ["--approval-gate", approvalGatePath]
    ])
  },
  {
    label: "Verify scheduled task status without changing it",
    command: commandLine("verify-all-software-recurring-monitor-registration-status.mjs", [
      ["--goal", goal],
      ["--registration-runner", registrationRunnerPath]
    ])
  },
  {
    label: "Audit existing scheduled or manual runner output",
    command: commandLine("audit-all-software-recurring-monitor-run-output.mjs", [
      ["--goal", goal],
      ["--registration-status", registrationStatusPath],
      ["--schedule", schedulePath]
    ])
  },
  {
    label: "Build teacher review packet",
    command: commandLine("create-all-software-recurring-monitor-teacher-review-packet.mjs", [
      ["--goal", goal],
      ["--run-output-audit", runOutputAuditPath]
    ])
  },
  {
    label: "Replay teacher decisions into next queue",
    command: commandLine("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
      ["--goal", goal],
      ["--teacher-review-packet", teacherReviewPacketPath]
    ])
  },
  {
    label: "Run completion-boundary audit before any operational claim",
    command: commandLine("create-all-software-unattended-learning-audit.mjs", [
      ["--goal", goal],
      ["--schedule", schedulePath],
      ["--approval-gate", approvalGatePath],
      ["--registration-runner", registrationRunnerPath],
      ["--registration-status", registrationStatusPath],
      ["--run-output-audit", runOutputAuditPath],
      ["--teacher-review-packet", teacherReviewPacketPath],
      ["--review-decision-replay-queue", replayQueuePath]
    ])
  }
];

const locks = buildLocks();
const packet = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_workbench_v1",
  workbenchId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  purpose:
    "A single teacher-facing operations index for moving from reviewed readiness evidence to scheduled low-token learning, run-output review, decision replay, and a final unattended-learning audit.",
  existingAbilitiesReused: [
    "create_real_local_all_software_low_token_readiness_package",
    "create_automatic_low_token_learning_schedule",
    "create_all_software_recurring_monitor_approval_gate",
    "run_all_software_recurring_monitor_registration_runner",
    "verify_all_software_recurring_monitor_registration_status",
    "audit_all_software_recurring_monitor_run_output",
    "create_all_software_recurring_monitor_teacher_review_packet",
    "create_all_software_recurring_monitor_review_decision_replay_queue",
    "create_all_software_unattended_learning_audit"
  ],
  evidenceStatus: {
    readinessPackage: evidenceStatus(readiness),
    schedule: evidenceStatus(schedule),
    approvalGate: evidenceStatus(approvalGate),
    registrationRunner: evidenceStatus(registrationRunner),
    registrationStatus: evidenceStatus(registrationStatus),
    runOutputAudit: evidenceStatus(runOutputAudit),
    teacherReviewPacket: evidenceStatus(teacherReviewPacket),
    reviewDecisionReplayQueue: evidenceStatus(replayQueue),
    unattendedAudit: evidenceStatus(unattendedAudit)
  },
  paths: {
    workbench: workbenchPath,
    receipt: receiptPath,
    readme: readmePath,
    readinessPackage: readiness.path,
    schedule: schedulePath,
    approvalGate: approvalGatePath,
    registrationRunner: registrationRunnerPath,
    registrationStatus: registrationStatusPath,
    runOutputAudit: runOutputAuditPath,
    teacherReviewPacket: teacherReviewPacketPath,
    replayQueue: replayQueuePath,
    unattendedAudit: unattendedAuditPath,
    scheduledRunner: firstPath(readiness.value?.paths?.scheduledRunner, schedule.value?.files?.runner),
    registerScript: firstPath(readiness.value?.paths?.scheduleRegisterScript, schedule.value?.files?.registerTask),
    unregisterScript: firstPath(schedule.value?.files?.unregisterTask, registrationRunner.value?.unregisterCommand?.scriptPath)
  },
  operationalProof: {
    taskRegistered,
    reviewedOutputReady,
    reviewReplayed,
    unattendedReadyForTeacherOperationalReview: unattendedReady,
    remainingGaps
  },
  nextSafeCommands,
  blockedActions: [
    "register_scheduled_task_without_teacher_confirmation",
    "start_or_launch_runner_from_workbench",
    "capture_screenshots_without_trigger_and_teacher_review",
    "read_raw_full_logs",
    "execute_target_software_commands",
    "write_long_term_memory_unattended",
    "claim_all_software_learning_complete_without_unattended_audit"
  ],
  locks
};

const receipt = {
  format: "transparent_ai_all_software_operational_learning_workbench_receipt_v1",
  workbenchId,
  status,
  evidenceStatus: packet.evidenceStatus,
  operationalProof: packet.operationalProof,
  paths: packet.paths,
  locks
};

writeFileSync(workbenchPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(readmePath, `${readmeLines(packet).join("\n")}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_learning_workbench_result_v1",
      workbenchId,
      status,
      workbenchPath,
      receiptPath,
      readme: readmePath,
      remainingGaps: remainingGaps.length,
      nextSafeCommands: nextSafeCommands.length,
      locks
    },
    null,
    2
  )
);
