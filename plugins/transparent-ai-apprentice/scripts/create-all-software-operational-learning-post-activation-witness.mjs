#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-operational-learning-post-activation-witness")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-learning-post-activation-witness"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label, expectedFormat = "") {
  const text = String(value || "").trim();
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

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function evidenceRow(input, expectedFormat) {
  return {
    present: Boolean(input.value),
    path: input.path,
    format: input.value?.format || "",
    formatMatched: Boolean(input.value && input.value.format === expectedFormat),
    status: input.value?.status || ""
  };
}

function writeReadme(path, witness) {
  const lines = [
    "# All-Software Operational Learning Post-Activation Witness",
    "",
    `Status: ${witness.status}`,
    `Operational activation witness ready: ${witness.readyForTeacherOperationalReview}`,
    `Remaining gaps: ${witness.remainingGaps.length}`,
    "",
    "This witness checks the evidence chain after the registration execute gate. It does not register Windows Scheduled Tasks, start tasks, launch runners, capture screenshots, read full logs, execute target software, write memory, enable rules, or claim universal native execution.",
    "",
    "Evidence chain:",
    `- Dry-run rehearsal: ${witness.evidence.dryRunRehearsal.status || "missing"}`,
    `- Registration execute gate: ${witness.evidence.registrationExecuteGate.status || "missing"}`,
    `- Registration status: ${witness.evidence.registrationStatus.status || "missing"}`,
    `- Run-output audit: ${witness.evidence.runOutputAudit.status || "missing"}`,
    `- Teacher review packet: ${witness.evidence.teacherReviewPacket.status || "missing"}`,
    `- Review decision replay queue: ${witness.evidence.reviewDecisionReplayQueue.status || "missing"}`,
    `- Unattended audit: ${witness.evidence.unattendedAudit.status || "missing"}`,
    "",
    "Remaining gaps:",
    ...(witness.remainingGaps.length
      ? witness.remainingGaps.map((gap, index) => `${index + 1}. ${gap.kind}: ${gap.detail}`)
      : ["- none; ready for teacher operational review"]),
    "",
    "Next safe commands:",
    "",
    "```powershell",
    ...witness.nextSafeCommands.map((item) => item.command),
    "```",
    "",
    "Blocked actions:",
    ...witness.blockedActions.map((action) => `- ${action}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Witness post-activation all-software low-token learning evidence before operational claims."
);
const dryRunRehearsal = readJsonInput(
  argValue("--dry-run-rehearsal", argValue("--rehearsal", "")),
  "--dry-run-rehearsal",
  "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1"
);
const registrationExecuteGate = readJsonInput(
  argValue("--registration-execute-gate", argValue("--execute-gate", argValue("--gate", ""))),
  "--registration-execute-gate",
  "transparent_ai_all_software_operational_learning_registration_execute_gate_v1"
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
const unattendedAudit = readJsonInput(
  argValue("--unattended-audit", argValue("--audit", "")),
  "--unattended-audit",
  "transparent_ai_all_software_unattended_learning_audit_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-post-activation-witnesses"))
);

mkdirSync(outputRoot, { recursive: true });
const witnessId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const witnessDir = join(outputRoot, witnessId);
mkdirSync(witnessDir, { recursive: true });

const remainingGaps = [];
const rehearsal = dryRunRehearsal.value;
const executeGate = registrationExecuteGate.value;
const statusPacket = registrationStatus.value;
const outputAudit = runOutputAudit.value;
const reviewPacket = teacherReviewPacket.value;
const replayQueue = reviewDecisionReplayQueue.value;
const unattended = unattendedAudit.value;

if (!rehearsal) remainingGaps.push({ kind: "missing_activation_dry_run_rehearsal", detail: "No passed activation dry-run rehearsal was provided." });
else {
  if (rehearsal.status !== "passed_no_system_change") {
    remainingGaps.push({ kind: "dry_run_rehearsal_not_passed", detail: `Dry-run rehearsal status is ${rehearsal.status}.` });
  }
  if (rehearsal.locks?.activationDryRunWrapperExecuted !== true || rehearsal.locks?.wrapperExecuteFlagPassed !== false) {
    remainingGaps.push({ kind: "dry_run_rehearsal_execute_lock_missing", detail: "Dry-run rehearsal must prove wrapper execution without Execute flag." });
  }
  if (rehearsal.locks?.scheduledTaskRegistered !== false || rehearsal.locks?.targetSoftwareCommandsExecuted !== false) {
    remainingGaps.push({ kind: "dry_run_rehearsal_system_change_mismatch", detail: "Dry-run rehearsal must prove no task registration or target software command." });
  }
}

if (!executeGate) remainingGaps.push({ kind: "missing_registration_execute_gate", detail: "No registration execute gate was provided." });
else {
  if (executeGate.status !== "ready_for_teacher_registration_execute_review") {
    remainingGaps.push({ kind: "registration_execute_gate_not_ready", detail: `Execute gate status is ${executeGate.status}.` });
  }
  if (executeGate.locks?.executeRequestPrepared !== true || executeGate.locks?.executeRequestExecuted !== false) {
    remainingGaps.push({ kind: "execute_gate_prepare_lock_missing", detail: "Execute gate must prepare but not execute the registration command." });
  }
  if (executeGate.locks?.scheduledTaskRegistered !== false || executeGate.locks?.targetSoftwareCommandsExecuted !== false) {
    remainingGaps.push({ kind: "execute_gate_system_change_mismatch", detail: "Execute gate must not register tasks or execute target software." });
  }
}

if (rehearsal?.paths?.wrapper && executeGate?.paths?.wrapper && rehearsal.paths.wrapper !== executeGate.paths.wrapper) {
  remainingGaps.push({ kind: "execute_gate_wrapper_mismatch", detail: "Execute gate wrapper path differs from the rehearsed wrapper." });
}
if (rehearsal?.paths?.sourceRegistrationRunner && executeGate?.paths?.sourceRegistrationRunner && rehearsal.paths.sourceRegistrationRunner !== executeGate.paths.sourceRegistrationRunner) {
  remainingGaps.push({ kind: "execute_gate_registration_runner_mismatch", detail: "Execute gate registration runner differs from the rehearsed runner." });
}

if (!statusPacket) {
  remainingGaps.push({ kind: "missing_post_activation_registration_status", detail: "No read-only registration status verifier was provided after execute gate review." });
} else if (statusPacket.status !== "registered_and_matches_reviewed_runner") {
  remainingGaps.push({
    kind: "scheduled_task_not_registered_or_not_matching_after_execute_gate",
    detail: `Registration status is ${statusPacket.status}; recurring operation is not proven active.`
  });
}

if (!outputAudit) {
  remainingGaps.push({ kind: "missing_post_activation_run_output_audit", detail: "No recurring run-output audit was provided after registration." });
} else if ((outputAudit.reviewedRunCount || 0) < 1) {
  remainingGaps.push({ kind: "missing_post_activation_reviewed_run_output", detail: "No runner journal has been reviewed after activation." });
} else if (outputAudit.status === "blocked_recurring_monitor_run_output_lock_mismatch") {
  remainingGaps.push({ kind: "post_activation_run_output_lock_mismatch", detail: "Run-output audit reported unsafe lock evidence." });
}

if (!reviewPacket) {
  remainingGaps.push({ kind: "missing_post_activation_teacher_review_packet", detail: "No teacher review packet exists for post-activation learning events." });
}

if (!replayQueue) {
  remainingGaps.push({ kind: "missing_post_activation_review_replay", detail: "No review decision replay queue exists for post-activation learning events." });
} else {
  const replayItems = Array.isArray(replayQueue.replayItems) ? replayQueue.replayItems : [];
  const blocked = replayItems.filter((item) => item.status === "blocked").length;
  const waiting = replayItems.filter((item) => item.status === "needs_teacher_review").length;
  if (blocked > 0) remainingGaps.push({ kind: "post_activation_review_replay_blocked", detail: `${blocked} replay items remain blocked.` });
  if (waiting > 0) remainingGaps.push({ kind: "post_activation_review_replay_waiting", detail: `${waiting} replay items still need teacher review.` });
}

if (!unattended) {
  remainingGaps.push({ kind: "missing_post_activation_unattended_audit", detail: "No final unattended-learning boundary audit was provided." });
} else if (unattended.status !== "unattended_learning_ready_for_teacher_operational_review") {
  remainingGaps.push({ kind: "post_activation_unattended_audit_not_ready", detail: `Unattended audit status is ${unattended.status}.` });
}

const evidenceCounts = {
  reviewedRunCount: outputAudit?.reviewedRunCount || 0,
  compactLearningEvents: outputAudit?.totals?.compactLearningEvents || 0,
  teacherReviewItems: reviewPacket?.reviewItemCount || 0,
  replayItems: Array.isArray(replayQueue?.replayItems) ? replayQueue.replayItems.length : 0,
  readyForFollowUpItems: Array.isArray(replayQueue?.replayItems)
    ? replayQueue.replayItems.filter((item) => item.status === "ready_for_follow_up").length
    : 0
};

const registeredMatches = statusPacket?.status === "registered_and_matches_reviewed_runner";
const reviewedOutputExists = evidenceCounts.reviewedRunCount > 0;
const readyForTeacherOperationalReview = remainingGaps.length === 0 && registeredMatches && reviewedOutputExists;
const status = readyForTeacherOperationalReview
  ? "post_activation_witness_ready_for_teacher_operational_review"
  : registeredMatches
    ? "registered_waiting_for_post_activation_output_review"
    : "waiting_for_post_activation_registration_status";

const nextSafeCommands = [
  {
    label: "Verify scheduled task status after teacher-executed registration",
    command: commandLine("verify-all-software-recurring-monitor-registration-status.mjs", [
      ["--goal", goal],
      ["--registration-runner", executeGate?.paths?.sourceRegistrationRunner || rehearsal?.paths?.sourceRegistrationRunner || ""]
    ])
  },
  {
    label: "Audit recurring monitor output without launching the runner",
    command: commandLine("audit-all-software-recurring-monitor-run-output.mjs", [
      ["--goal", goal],
      ["--registration-status", registrationStatus.path],
      ["--schedule", executeGate?.paths?.sourceSchedule || ""]
    ])
  },
  {
    label: "Build teacher review packet",
    command: commandLine("create-all-software-recurring-monitor-teacher-review-packet.mjs", [
      ["--goal", goal],
      ["--run-output-audit", runOutputAudit.path]
    ])
  },
  {
    label: "Replay teacher decisions",
    command: commandLine("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
      ["--goal", goal],
      ["--teacher-review-packet", teacherReviewPacket.path]
    ])
  },
  {
    label: "Run final unattended-learning boundary audit",
    command: commandLine("create-all-software-unattended-learning-audit.mjs", [
      ["--goal", goal],
      ["--registration-status", registrationStatus.path],
      ["--run-output-audit", runOutputAudit.path],
      ["--teacher-review-packet", teacherReviewPacket.path],
      ["--review-decision-replay-queue", reviewDecisionReplayQueue.path]
    ])
  }
];

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  postActivationWitnessDoesNotChangeSystem: true,
  registerTaskCalled: false,
  unregisterTaskCalled: false,
  startTaskCalled: false,
  stopTaskCalled: false,
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
  universalNativeControlComplete: false
};

const witnessPath = join(witnessDir, "all-software-operational-learning-post-activation-witness.json");
const receiptPath = join(witnessDir, "all-software-operational-learning-post-activation-witness-receipt.json");
const readmePath = join(witnessDir, "ALL_SOFTWARE_OPERATIONAL_LEARNING_POST_ACTIVATION_WITNESS_START_HERE.md");

const witness = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_post_activation_witness_v1",
  witnessId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  readyForTeacherOperationalReview,
  purpose:
    "Tie activation dry-run rehearsal, registration execute gate, read-only registration status, recurring run output, teacher review, replay, and unattended audit into one post-activation evidence chain.",
  existingAbilitiesReused: [
    "run_all_software_operational_learning_activation_dry_run_rehearsal",
    "create_all_software_operational_learning_registration_execute_gate",
    "verify_all_software_recurring_monitor_registration_status",
    "audit_all_software_recurring_monitor_run_output",
    "create_all_software_recurring_monitor_teacher_review_packet",
    "create_all_software_recurring_monitor_review_decision_replay_queue",
    "create_all_software_unattended_learning_audit",
    "create_all_software_operational_learning_workbench"
  ],
  evidence: {
    dryRunRehearsal: evidenceRow(dryRunRehearsal, "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1"),
    registrationExecuteGate: evidenceRow(registrationExecuteGate, "transparent_ai_all_software_operational_learning_registration_execute_gate_v1"),
    registrationStatus: evidenceRow(registrationStatus, "transparent_ai_all_software_recurring_monitor_registration_status_v1"),
    runOutputAudit: evidenceRow(runOutputAudit, "transparent_ai_all_software_recurring_monitor_run_output_audit_v1"),
    teacherReviewPacket: evidenceRow(teacherReviewPacket, "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1"),
    reviewDecisionReplayQueue: evidenceRow(
      reviewDecisionReplayQueue,
      "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1"
    ),
    unattendedAudit: evidenceRow(unattendedAudit, "transparent_ai_all_software_unattended_learning_audit_v1")
  },
  evidenceCounts,
  remainingGaps,
  nextSafeCommands,
  blockedActions: [
    "register_or_unregister_windows_scheduled_task",
    "start_or_stop_windows_scheduled_task",
    "launch_automatic_runner",
    "capture_screenshot",
    "read_full_logs",
    "execute_target_software_command",
    "write_long_term_memory",
    "enable_rule",
    "claim_all_software_coverage_complete",
    "claim_universal_native_execution"
  ],
  completionBoundary: {
    canReportPostActivationWitnessReady: readyForTeacherOperationalReview,
    allSoftwareCoverageComplete: false,
    universalNativeControlComplete: false,
    goalComplete: false,
    reason:
      "This witness can prove the reviewed post-activation chain for the provided scope, but it does not prove every installed app has useful logs or universal native semantic execution."
  },
  locks,
  paths: {
    witness: witnessPath,
    receipt: receiptPath,
    readme: readmePath,
    dryRunRehearsal: dryRunRehearsal.path,
    registrationExecuteGate: registrationExecuteGate.path,
    registrationStatus: registrationStatus.path,
    runOutputAudit: runOutputAudit.path,
    teacherReviewPacket: teacherReviewPacket.path,
    reviewDecisionReplayQueue: reviewDecisionReplayQueue.path,
    unattendedAudit: unattendedAudit.path
  }
};

const receipt = {
  format: "transparent_ai_all_software_operational_learning_post_activation_witness_receipt_v1",
  witnessPath,
  status,
  readyForTeacherOperationalReview,
  remainingGapCount: remainingGaps.length,
  registerTaskCalled: false,
  unregisterTaskCalled: false,
  startTaskCalled: false,
  stopTaskCalled: false,
  runnerLaunched: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false,
  locks
};

writeFileSync(witnessPath, JSON.stringify(witness, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
writeReadme(readmePath, witness);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_learning_post_activation_witness_result_v1",
      status,
      witnessPath,
      receiptPath,
      readme: readmePath,
      readyForTeacherOperationalReview,
      remainingGapCount: remainingGaps.length
    },
    null,
    2
  )
);
