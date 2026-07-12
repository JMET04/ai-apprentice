#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-unattended-learning-audit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-unattended-learning-audit"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) {
    throw new Error(`${label} must be ${expectedFormat}`);
  }
  return parsed;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    auditDoesNotChangeSystem: true,
    scheduledTaskRegistered: false,
    scheduledTaskUnregistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    unattendedAllAppMonitoringComplete: false
  };
}

function row(path, packet, format) {
  return {
    present: Boolean(packet),
    path,
    format: packet?.format || "",
    formatMatched: Boolean(packet && packet.format === format),
    status: packet?.status || ""
  };
}

function writeReadme(path, audit) {
  const lines = [
    "# All-Software Unattended Learning Audit",
    "",
    `Status: ${audit.status}`,
    `Unattended monitoring complete: ${audit.unattendedAllAppMonitoringComplete}`,
    `Remaining gaps: ${audit.remainingGaps.length}`,
    "",
    "This audit checks whether the recurring low-token learning chain is operational enough for teacher review. It does not register scheduled tasks, launch runners, read full logs, capture screenshots, write memory, execute target software, or claim universal native control.",
    "",
    "Evidence chain:",
    `- Schedule: ${audit.evidence.schedule.status || "missing"}`,
    `- Approval gate: ${audit.evidence.approvalGate.status || "missing"}`,
    `- Registration runner: ${audit.evidence.registrationRunner.status || "missing"}`,
    `- Registration status: ${audit.evidence.registrationStatus.status || "missing"}`,
    `- Run-output audit: ${audit.evidence.runOutputAudit.status || "missing"}`,
    `- Teacher review packet: ${audit.evidence.teacherReviewPacket.status || "missing"}`,
    `- Decision replay queue: ${audit.evidence.reviewDecisionReplayQueue.status || "missing"}`,
    "",
    "Remaining gaps:",
    ...audit.remainingGaps.map((gap, index) => `${index + 1}. ${gap.kind}: ${gap.detail}`),
    "",
    "Next safest action:",
    audit.nextAction
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Audit unattended all-software low-token learning readiness.");
const schedule = readJsonInput(
  argValue("--schedule", argValue("--schedule-path", "")),
  "--schedule",
  "transparent_ai_automatic_low_token_learning_schedule_v1"
);
const approvalGate = readJsonInput(
  argValue("--approval-gate", argValue("--gate", "")),
  "--approval-gate",
  "transparent_ai_all_software_recurring_monitor_approval_gate_v1"
);
const registrationRunner = readJsonInput(
  argValue("--registration-runner", argValue("--runner", "")),
  "--registration-runner",
  "transparent_ai_all_software_recurring_monitor_registration_runner_v1"
);
const registrationStatus = readJsonInput(
  argValue("--registration-status", argValue("--status", "")),
  "--registration-status",
  "transparent_ai_all_software_recurring_monitor_registration_status_v1"
);
const runOutputAudit = readJsonInput(
  argValue("--run-output-audit", argValue("--output-audit", "")),
  "--run-output-audit",
  "transparent_ai_all_software_recurring_monitor_run_output_audit_v1"
);
const teacherReviewPacket = readJsonInput(
  argValue("--teacher-review-packet", argValue("--review-packet", "")),
  "--teacher-review-packet",
  "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1"
);
const reviewDecisionReplayQueue = readJsonInput(
  argValue("--review-decision-replay-queue", argValue("--replay-queue", "")),
  "--review-decision-replay-queue",
  "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1"
);

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-unattended-learning-audits"))
);
mkdirSync(outputRoot, { recursive: true });
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });

const evidence = {
  schedule: row(schedule.path, schedule.value, "transparent_ai_automatic_low_token_learning_schedule_v1"),
  approvalGate: row(approvalGate.path, approvalGate.value, "transparent_ai_all_software_recurring_monitor_approval_gate_v1"),
  registrationRunner: row(registrationRunner.path, registrationRunner.value, "transparent_ai_all_software_recurring_monitor_registration_runner_v1"),
  registrationStatus: row(registrationStatus.path, registrationStatus.value, "transparent_ai_all_software_recurring_monitor_registration_status_v1"),
  runOutputAudit: row(runOutputAudit.path, runOutputAudit.value, "transparent_ai_all_software_recurring_monitor_run_output_audit_v1"),
  teacherReviewPacket: row(teacherReviewPacket.path, teacherReviewPacket.value, "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1"),
  reviewDecisionReplayQueue: row(
    reviewDecisionReplayQueue.path,
    reviewDecisionReplayQueue.value,
    "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1"
  )
};

const remainingGaps = [];
if (!schedule.value) remainingGaps.push({ kind: "missing_schedule", detail: "No automatic low-token learning schedule package was provided." });
else {
  if (schedule.value.schedulePolicy?.metadataGateFirst !== true) {
    remainingGaps.push({ kind: "schedule_not_metadata_first", detail: "Schedule does not prove metadata-first low-token learning." });
  }
  if (schedule.value.schedulePolicy?.scheduledTaskInstalled !== false || schedule.value.locks?.scheduledTaskInstalled !== false) {
    remainingGaps.push({ kind: "schedule_install_state_unclear", detail: "Schedule package must start uninstalled and teacher-confirmed." });
  }
}

if (!approvalGate.value) remainingGaps.push({ kind: "missing_recurring_monitor_approval_gate", detail: "No recurring monitor approval gate was provided." });
else if (approvalGate.value.readyForRegistrationRequest !== true) {
  remainingGaps.push({
    kind: "approval_gate_not_ready",
    detail: `Approval gate still blocks registration: ${(approvalGate.value.blockers || []).join(", ") || "unknown blocker"}`
  });
}

if (!registrationRunner.value) {
  remainingGaps.push({ kind: "missing_registration_runner", detail: "No dry-run-first recurring monitor registration runner was provided." });
} else if (!["dry_run_ready_for_teacher_review", "ready_to_execute_teacher_confirmed_registration"].includes(registrationRunner.value.status)) {
  remainingGaps.push({ kind: "registration_runner_not_ready", detail: `Registration runner status is ${registrationRunner.value.status}.` });
}

if (!registrationStatus.value) {
  remainingGaps.push({ kind: "missing_registration_status", detail: "No read-only scheduled task registration status verifier was provided." });
} else if (registrationStatus.value.status !== "registered_and_matches_reviewed_runner") {
  remainingGaps.push({
    kind: "scheduled_task_not_registered_or_not_matching",
    detail: `Registration status is ${registrationStatus.value.status}; unattended monitoring is not yet proven operational.`
  });
}

if (!runOutputAudit.value) {
  remainingGaps.push({ kind: "missing_run_output_audit", detail: "No recurring monitor run-output audit was provided." });
} else if ((runOutputAudit.value.reviewedRunCount || 0) < 1) {
  remainingGaps.push({ kind: "missing_recurring_run_output", detail: "No recurring monitor output has been reviewed yet." });
} else if (runOutputAudit.value.status === "blocked_recurring_monitor_run_output_lock_mismatch") {
  remainingGaps.push({ kind: "run_output_lock_mismatch", detail: "Run-output audit reported a lock mismatch." });
}

if (!teacherReviewPacket.value) {
  remainingGaps.push({ kind: "missing_teacher_review_packet", detail: "No teacher review packet was provided for recurring monitor learning events." });
} else if ((teacherReviewPacket.value.reviewItemCount || 0) > 0 && !reviewDecisionReplayQueue.value) {
  remainingGaps.push({ kind: "teacher_review_decisions_missing", detail: "Learning events exist but no review decision replay queue was provided." });
}

if (reviewDecisionReplayQueue.value) {
  const replayItems = Array.isArray(reviewDecisionReplayQueue.value.replayItems) ? reviewDecisionReplayQueue.value.replayItems : [];
  const blocked = replayItems.filter((item) => item.status === "blocked").length;
  const waiting = replayItems.filter((item) => item.status === "needs_teacher_review").length;
  if (blocked > 0) remainingGaps.push({ kind: "review_replay_blocked_items", detail: `${blocked} replay items remain blocked.` });
  if (waiting > 0) remainingGaps.push({ kind: "review_replay_waiting_for_teacher", detail: `${waiting} replay items still need teacher review.` });
}

const evidenceCounts = {
  reviewedRunCount: runOutputAudit.value?.reviewedRunCount || 0,
  compactLearningEvents: runOutputAudit.value?.totals?.compactLearningEvents || 0,
  teacherReviewItems: teacherReviewPacket.value?.reviewItemCount || 0,
  replayItems: Array.isArray(reviewDecisionReplayQueue.value?.replayItems) ? reviewDecisionReplayQueue.value.replayItems.length : 0,
  readyForFollowUpItems: Array.isArray(reviewDecisionReplayQueue.value?.replayItems)
    ? reviewDecisionReplayQueue.value.replayItems.filter((item) => item.status === "ready_for_follow_up").length
    : 0
};

const unattendedAllAppMonitoringComplete =
  remainingGaps.length === 0 &&
  registrationStatus.value?.status === "registered_and_matches_reviewed_runner" &&
  evidenceCounts.reviewedRunCount > 0;
const status = unattendedAllAppMonitoringComplete
  ? "unattended_learning_ready_for_teacher_operational_review"
  : "unattended_learning_not_ready_remaining_gaps";
const nextAction = remainingGaps.some((gap) => gap.kind === "scheduled_task_not_registered_or_not_matching")
  ? "Review the approval gate and registration runner, then only after explicit teacher confirmation register the reviewed recurring monitor and rerun registration status."
  : remainingGaps.some((gap) => gap.kind.includes("teacher_review") || gap.kind.includes("replay"))
    ? "Review recurring monitor learning events, replay allowed decisions, and keep memory/rules disabled until teacher approval."
    : remainingGaps.length > 0
      ? "Create the missing schedule, approval, runner, status, output audit, review packet, or replay evidence in that order."
      : "Teacher can review operational evidence before any long-term memory, rule enablement, or completion claim.";

const lockState = locks();
const auditPath = join(auditDir, "all-software-unattended-learning-audit.json");
const receiptPath = join(auditDir, "all-software-unattended-learning-audit-receipt.json");
const readmePath = join(auditDir, "ALL_SOFTWARE_UNATTENDED_LEARNING_AUDIT_START_HERE.md");
const audit = {
  ok: true,
  format: "transparent_ai_all_software_unattended_learning_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  unattendedAllAppMonitoringComplete,
  evidence,
  evidenceCounts,
  remainingGaps,
  nextAction,
  completionBoundary: {
    unattendedAllAppMonitoringComplete: false,
    allSoftwareCoverageComplete: false,
    nativeUniversalExecution: false,
    reason: unattendedAllAppMonitoringComplete
      ? "The provided recurring monitor evidence is ready for teacher operational review, but this audit still does not write memory, enable rules, or claim universal native execution."
      : "The unattended all-software learning chain still lacks registered matching schedule evidence, reviewed run output, teacher decisions, or another required proof packet."
  },
  locks: lockState
};
const receipt = {
  ok: true,
  format: "transparent_ai_all_software_unattended_learning_audit_receipt_v1",
  auditId,
  status,
  auditPath,
  readmePath,
  unattendedAllAppMonitoringComplete,
  evidenceCounts,
  remainingGaps: remainingGaps.length,
  scheduledTaskRegistered: false,
  scheduledTaskUnregistered: false,
  runnerLaunched: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: lockState
};

writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_unattended_learning_audit_result_v1",
      auditId,
      status,
      auditPath,
      receiptPath,
      readmePath,
      evidenceCounts,
      remainingGaps: remainingGaps.length,
      unattendedAllAppMonitoringComplete,
      locks: lockState
    },
    null,
    2
  )
);
