#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "all-software-operational-learning-post-registration-output-witness-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-operational-learning-post-registration-output-witness-runner"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label, expectedFormat = "", optional = false) {
  const text = String(value || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
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

function explicitOutputWitnessConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed post-registration output witness",
    "teacher confirmed approved post-registration output runner",
    "teacher approved triggering one reviewed scheduled runner",
    "trigger one reviewed low-token output witness",
    "i confirm post-registration output witness",
    "\u786e\u8ba4\u89e6\u53d1\u6ce8\u518c\u540e\u8f93\u51fa\u89c1\u8bc1",
    "\u5141\u8bb8\u89e6\u53d1\u4e00\u6b21\u5df2\u5ba1\u6838\u7684\u4f4e token runner",
    "\u786e\u8ba4\u8fd0\u884c\u4e00\u6b21\u5df2\u5ba1\u6838\u7684\u5468\u671f runner"
  ].some((marker) => text.includes(marker));
}

function runNodeScript(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: resolve(__dirname, "..", "..", ".."),
    encoding: "utf8",
    timeout: Math.max(120000, Number(argValue("--child-timeout-ms", "180000"))),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0 && !options.allowNonZeroJson) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  try {
    return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed: ${error.message}`);
  }
}

function powershellExe() {
  const windowsRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
  const systemPowerShell = join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return existsSync(systemPowerShell) ? systemPowerShell : "powershell.exe";
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (!value) continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function sameResolvedPath(a, b) {
  return a && b && resolve(a) === resolve(b);
}

function summarizeOperationalScope(approvedRunner, dryRunRehearsal, registrationExecuteGate, schedulePath) {
  const scope = approvedRunner?.operationalScope || registrationExecuteGate?.operationalScope || dryRunRehearsal?.operationalScope || null;
  const blockers = [];
  if (!scope) blockers.push("operational_scope_missing_from_post_registration_witness_inputs");
  if (scope && scope.teacherReviewedScope !== true) blockers.push("operational_scope_not_teacher_reviewed");
  const compared = [
    ["approved_runner", approvedRunner?.operationalScope],
    ["registration_execute_gate", registrationExecuteGate?.operationalScope],
    ["dry_run_rehearsal", dryRunRehearsal?.operationalScope]
  ].filter(([, value]) => value);
  for (const [label, value] of compared) {
    if (scope?.sourceTrialPath && value.sourceTrialPath && !sameResolvedPath(scope.sourceTrialPath, value.sourceTrialPath)) {
      blockers.push(`operational_scope_trial_mismatch_${label}`);
    }
    if (scope?.sourceSchedulePath && value.sourceSchedulePath && !sameResolvedPath(scope.sourceSchedulePath, value.sourceSchedulePath)) {
      blockers.push(`operational_scope_schedule_mismatch_${label}`);
    }
  }
  if (scope?.sourceSchedulePath && schedulePath && !sameResolvedPath(scope.sourceSchedulePath, schedulePath)) {
    blockers.push("operational_scope_schedule_mismatch_with_registration_status_schedule");
  }
  return {
    scope,
    sourceCount: compared.length,
    blockers
  };
}

function invokeReviewedScheduledRunner(schedule, runLabel, runnerPath) {
  const result = spawnSync(powershellExe(), ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", runnerPath, "-RunLabel", runLabel], {
    cwd: dirname(runnerPath),
    encoding: "utf8",
    timeout: Math.max(120000, Number(argValue("--runner-timeout-ms", "180000"))),
    maxBuffer: 20 * 1024 * 1024
  });
  return {
    triggerMode: "reviewed_scheduled_runner_direct_invocation",
    runnerPath,
    runLabel,
    expectedRunRoot: join(resolve(schedule.runOutputDir || ""), runLabel),
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    signal: result.signal || "",
    error: result.error?.message || ""
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Post-Registration Output Witness Runner",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    "",
    "This runner is the supervised bridge after read-only registration status proves the reviewed recurring monitor is registered and matches the expected runner. It directly invokes the same reviewed scheduled runner once, then reuses the existing run-output audit, teacher review packet, review replay queue, unattended-learning audit, and optional post-activation witness.",
    "",
    "Important boundary:",
    "- It does not register, unregister, start, or stop a Windows Scheduled Task.",
    "- It does not capture screenshots, read full logs by default, execute target software, write memory, enable rules, accept the technology, unlock packaging, or claim all-software completion.",
    "",
    "Evidence:",
    `- Registration status: ${packet.paths.registrationStatus}`,
    `- Operational scope: ${packet.operationalScope?.scopeKind || "unspecified"}`,
    `- Schedule: ${packet.paths.schedule}`,
    `- Reviewed runner script: ${packet.paths.reviewedScheduledRunner}`,
    `- Run-output audit: ${packet.paths.runOutputAudit || "not created"}`,
    `- Teacher review packet: ${packet.paths.teacherReviewPacket || "not created"}`,
    `- Review replay queue: ${packet.paths.reviewDecisionReplayQueue || "not created"}`,
    `- Unattended audit: ${packet.paths.unattendedAudit || "not created"}`,
    `- Optional post-activation witness: ${packet.paths.postActivationWitness || "not created"}`,
    "",
    "Blockers:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push("", "Next safe commands:", "", "```powershell", ...packet.nextSafeCommands.map((item) => item.command), "```");
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Trigger one teacher-approved post-registration all-software low-token output witness and audit the result."
);
const statusInput = readJsonInput(
  argValue("--registration-status", argValue("--status", "")),
  "--registration-status",
  "transparent_ai_all_software_recurring_monitor_registration_status_v1"
);
const approvedRunnerInput = readJsonInput(
  argValue("--registration-approved-runner", argValue("--approved-runner", "")),
  "--registration-approved-runner",
  "transparent_ai_all_software_operational_learning_registration_approved_runner_v1",
  true
);
const dryRunRehearsalInput = readJsonInput(
  argValue("--dry-run-rehearsal", argValue("--rehearsal", "")),
  "--dry-run-rehearsal",
  "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
  true
);
const registrationExecuteGateInput = readJsonInput(
  argValue("--registration-execute-gate", argValue("--execute-gate", argValue("--gate", ""))),
  "--registration-execute-gate",
  "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
  true
);

const registrationStatus = statusInput.value;
const approvedRunner = approvedRunnerInput.value;
const teacherConfirmation = argValue("--teacher-output-confirmation", argValue("--teacher-confirmation", ""));
const teacherConfirmedOutputWitness = explicitOutputWitnessConfirmation(teacherConfirmation);
const triggerReviewedOutput = hasFlag("--trigger-reviewed-output") || hasFlag("--execute-output-witness");
const allowRunnerTrigger = hasFlag("--allow-runner-trigger") || hasFlag("--allow-system-change");
const rollbackPointPath = argValue("--rollback-point", argValue("--rollback", ""));
const rollbackPointCreated = hasFlag("--rollback-point-created") || Boolean(rollbackPointPath);
const teacherStyle = argValue("--teacher-style", "ask_teacher_preference");
const teacherProfile = argValue("--teacher-method-profile", argValue("--profile", ""));
const software = argValue("--software", "");
const defaultDecision = argValue("--default-decision", "needs_teacher_review");
const runLabel = argValue("--run-label", `${new Date().toISOString().replace(/[:.]/g, "-")}-post-registration-output`);
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-post-registration-output-witness-runners")
  )
);

const schedulePath = resolve(argValue("--schedule", argValue("--schedule-path", registrationStatus.sourceSchedulePath || "")));
const schedule = schedulePath && existsSync(schedulePath) ? readJson(schedulePath) : null;
const registrationRunnerPath = resolve(
  argValue(
    "--registration-runner",
    argValue("--runner", registrationStatus.sourceRegistrationRunnerPath || approvedRunner?.paths?.invokedRegistrationRunner || approvedRunner?.paths?.sourceRegistrationRunner || "")
  )
);
const registrationRunner = registrationRunnerPath && existsSync(registrationRunnerPath) ? readJson(registrationRunnerPath) : null;
const approvalGatePath = resolve(argValue("--approval-gate", argValue("--approval", registrationRunner?.sourceApprovalGatePath || "")));
const reviewedScheduledRunnerPath = resolve(argValue("--reviewed-scheduled-runner", schedule?.files?.runner || ""));
const operationalScopeSummary = summarizeOperationalScope(
  approvedRunner,
  dryRunRehearsalInput.value,
  registrationExecuteGateInput.value,
  schedulePath
);
const operationalScope = operationalScopeSummary.scope;
const blockers = [];

if (registrationStatus.status !== "registered_and_matches_reviewed_runner") {
  blockers.push("registration_status_not_registered_and_matching_reviewed_runner");
}
if (registrationStatus.registeredMatchesExpectedRunner !== true) {
  blockers.push("registration_status_match_flag_missing");
}
if (registrationStatus.locks?.statusVerifierDoesNotChangeSystem !== true) {
  blockers.push("registration_status_query_lock_missing");
}
if (approvedRunner) {
  if (approvedRunner.postExecuteRegisteredMatchesExpectedRunner !== true) {
    blockers.push("approved_registration_runner_did_not_witness_matching_status");
  }
  if (approvedRunner.locks?.registrationRunnerInvoked !== true) {
    blockers.push("approved_registration_runner_execution_was_not_invoked");
  }
  if (approvedRunner.locks?.scheduledTaskStarted !== false) {
    blockers.push("approved_registration_runner_started_task_unexpectedly");
  }
}
for (const blocker of operationalScopeSummary.blockers) blockers.push(blocker);
if (!schedule || schedule.format !== "transparent_ai_automatic_low_token_learning_schedule_v1") {
  blockers.push("source_schedule_missing_or_format_mismatch");
}
if (schedule && schedule.schedulePolicy?.metadataGateFirst !== true) {
  blockers.push("schedule_does_not_preserve_metadata_first_low_token_policy");
}
if (schedule && schedule.locks?.scheduledTaskInstalled !== false && schedule.schedulePolicy?.scheduledTaskInstalled !== false) {
  blockers.push("source_schedule_install_lock_unclear");
}
if (!reviewedScheduledRunnerPath || !existsSync(reviewedScheduledRunnerPath)) {
  blockers.push("reviewed_scheduled_runner_script_not_found");
}
if (!schedule?.runOutputDir) blockers.push("schedule_run_output_dir_missing");
if (!triggerReviewedOutput) blockers.push("missing_trigger_reviewed_output_flag");
if (!allowRunnerTrigger) blockers.push("missing_allow_runner_trigger_flag");
if (!teacherConfirmedOutputWitness) blockers.push("missing_final_teacher_output_witness_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_output_witness_runner");

mkdirSync(outputRoot, { recursive: true });
const witnessRunId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal).slice(0, 36)}`;
const witnessRunDir = join(outputRoot, witnessRunId);
mkdirSync(witnessRunDir, { recursive: true });

let triggerResult = null;
let runOutputAuditResult = null;
let runOutputAudit = null;
let teacherReviewPacketResult = null;
let teacherReviewPacket = null;
let reviewDecisionReplayQueueResult = null;
let reviewDecisionReplayQueue = null;
let unattendedAuditResult = null;
let unattendedAudit = null;
let postActivationWitnessResult = null;

if (!blockers.length) {
  triggerResult = invokeReviewedScheduledRunner(schedule, runLabel, reviewedScheduledRunnerPath);
  if (triggerResult.status === 0) {
    runOutputAuditResult = runNodeScript("audit-all-software-recurring-monitor-run-output.mjs", [
      "--goal",
      goal,
      "--registration-status",
      statusInput.path,
      "--schedule",
      schedulePath,
      "--max-runs",
      String(Math.max(1, Number(argValue("--max-audit-runs", "8")))),
      "--output-dir",
      join(witnessRunDir, "run-output-audit")
    ]);
    runOutputAudit = readJson(runOutputAuditResult.auditPath);

    const reviewArgs = [
      "--goal",
      goal,
      "--run-output-audit",
      runOutputAuditResult.auditPath,
      "--teacher-style",
      teacherStyle,
      "--output-dir",
      join(witnessRunDir, "teacher-review-packet")
    ];
    if (teacherProfile) reviewArgs.push("--teacher-method-profile", teacherProfile);
    if (software) reviewArgs.push("--software", software);
    teacherReviewPacketResult = runNodeScript("create-all-software-recurring-monitor-teacher-review-packet.mjs", reviewArgs);
    teacherReviewPacket = readJson(teacherReviewPacketResult.packetPath);

    reviewDecisionReplayQueueResult = runNodeScript("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
      "--goal",
      goal,
      "--teacher-review-packet",
      teacherReviewPacketResult.packetPath,
      "--default-decision",
      defaultDecision,
      "--output-dir",
      join(witnessRunDir, "review-decision-replay-queue")
    ]);
    reviewDecisionReplayQueue = readJson(reviewDecisionReplayQueueResult.queuePath);

    const unattendedArgs = [
      "--goal",
      goal,
      "--schedule",
      schedulePath,
      "--registration-status",
      statusInput.path,
      "--run-output-audit",
      runOutputAuditResult.auditPath,
      "--teacher-review-packet",
      teacherReviewPacketResult.packetPath,
      "--review-decision-replay-queue",
      reviewDecisionReplayQueueResult.queuePath,
      "--output-dir",
      join(witnessRunDir, "unattended-audit")
    ];
    if (approvalGatePath && existsSync(approvalGatePath)) unattendedArgs.push("--approval-gate", approvalGatePath);
    if (registrationRunnerPath && existsSync(registrationRunnerPath)) unattendedArgs.push("--registration-runner", registrationRunnerPath);
    unattendedAuditResult = runNodeScript("create-all-software-unattended-learning-audit.mjs", unattendedArgs);
    unattendedAudit = readJson(unattendedAuditResult.auditPath);

    if (dryRunRehearsalInput.value && registrationExecuteGateInput.value) {
      postActivationWitnessResult = runNodeScript("create-all-software-operational-learning-post-activation-witness.mjs", [
        "--goal",
        goal,
        "--dry-run-rehearsal",
        dryRunRehearsalInput.path,
        "--registration-execute-gate",
        registrationExecuteGateInput.path,
        "--registration-status",
        statusInput.path,
        "--run-output-audit",
        runOutputAuditResult.auditPath,
        "--teacher-review-packet",
        teacherReviewPacketResult.packetPath,
        "--review-decision-replay-queue",
        reviewDecisionReplayQueueResult.queuePath,
        "--unattended-audit",
        unattendedAuditResult.auditPath,
        "--output-dir",
        join(witnessRunDir, "post-activation-witness")
      ]);
    }
  }
}

const runnerTriggered = Boolean(triggerResult);
const directRunnerInvoked = runnerTriggered;
const directRunnerExitedZero = triggerResult?.status === 0;
let status = "blocked_before_post_registration_output_witness_runner";
if (runnerTriggered && !directRunnerExitedZero) status = "post_registration_output_trigger_failed";
else if (runnerTriggered && runOutputAudit?.status === "blocked_recurring_monitor_run_output_lock_mismatch") {
  status = "post_registration_output_audit_blocked";
} else if (runnerTriggered && (runOutputAudit?.totals?.compactLearningEvents || 0) > 0) {
  status = "post_registration_output_triggered_learning_events_waiting_for_teacher_review";
} else if (runnerTriggered && (runOutputAudit?.reviewedRunCount || 0) > 0) {
  status = "post_registration_output_triggered_no_changes_waiting_for_next_delta";
} else if (runnerTriggered) {
  status = "post_registration_output_triggered_but_no_runner_journal_reviewed";
}

const evidenceCounts = {
  reviewedRunCount: runOutputAudit?.reviewedRunCount || 0,
  compactLearningEvents: runOutputAudit?.totals?.compactLearningEvents || 0,
  teacherReviewItems: teacherReviewPacket?.reviewItemCount || 0,
  replayItems: Array.isArray(reviewDecisionReplayQueue?.replayItems) ? reviewDecisionReplayQueue.replayItems.length : 0,
  readyForFollowUpItems: Array.isArray(reviewDecisionReplayQueue?.replayItems)
    ? reviewDecisionReplayQueue.replayItems.filter((item) => item.status === "ready_for_follow_up").length
    : 0,
  unattendedRemainingGaps: unattendedAudit?.remainingGaps?.length || 0
};

const locks = {
  reviewOnly: !runnerTriggered || evidenceCounts.compactLearningEvents > 0,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  finalTeacherOutputWitnessConfirmationRequired: true,
  rollbackPointRequiredBeforeRunnerTrigger: true,
  allowRunnerTriggerRequired: true,
  triggerReviewedOutputRequired: true,
  registrationStatusMatchedBeforeRun: registrationStatus.status === "registered_and_matches_reviewed_runner",
  runnerTriggered,
  directRunnerInvoked,
  directRunnerExitedZero,
  reviewedScheduledRunnerDirectlyInvoked: directRunnerInvoked,
  scheduledTaskRegisteredBeforeRun: registrationStatus.taskRegistered === true,
  scheduledTaskRegistrationChangedByThisRunner: false,
  scheduledTaskRegisteredByThisRunner: false,
  scheduledTaskStarted: false,
  scheduledTaskStopped: false,
  scheduledTaskUnregistered: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  longTermMemoryWritten: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  unattendedAllAppMonitoringComplete: false,
  goalComplete: false
};

const runnerPath = join(witnessRunDir, "all-software-operational-learning-post-registration-output-witness-runner.json");
const receiptPath = join(witnessRunDir, "all-software-operational-learning-post-registration-output-witness-runner-receipt.json");
const readmePath = join(witnessRunDir, "ALL_SOFTWARE_OPERATIONAL_LEARNING_POST_REGISTRATION_OUTPUT_WITNESS_RUNNER_START_HERE.md");

const packet = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_v1",
  witnessRunId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  triggerReviewedOutput,
  allowRunnerTrigger,
  teacherConfirmedOutputWitness,
  rollbackPointCreated,
  runnerTriggered,
  directRunnerInvoked,
  directRunnerExitedZero,
  operationalScope,
  operationalScopeSummary,
  triggerResult,
  evidenceCounts,
  defaultDecision,
  existingAbilitiesReused: [
    "verify_all_software_recurring_monitor_registration_status",
    "run_automatic_low_token_learning_runner",
    "audit_all_software_recurring_monitor_run_output",
    "create_all_software_recurring_monitor_teacher_review_packet",
    "create_all_software_recurring_monitor_review_decision_replay_queue",
    "create_all_software_unattended_learning_audit",
    "create_all_software_operational_learning_post_activation_witness"
  ],
  paths: {
    runner: runnerPath,
    receipt: receiptPath,
    readme: readmePath,
    registrationStatus: statusInput.path,
    registrationApprovedRunner: approvedRunnerInput.path,
    schedule: schedulePath,
    registrationRunner: registrationRunnerPath,
    approvalGate: approvalGatePath,
    reviewedScheduledRunner: reviewedScheduledRunnerPath,
    rollbackPoint: rollbackPointPath,
    runOutputAudit: runOutputAuditResult?.auditPath || "",
    runOutputAuditReceipt: runOutputAuditResult?.receiptPath || "",
    teacherReviewPacket: teacherReviewPacketResult?.packetPath || "",
    reviewDecisionReplayQueue: reviewDecisionReplayQueueResult?.queuePath || "",
    unattendedAudit: unattendedAuditResult?.auditPath || "",
    postActivationWitness: postActivationWitnessResult?.witnessPath || ""
  },
  nextSafeCommands: [
    {
      label: "Audit output again without launching the runner",
      command: commandLine("audit-all-software-recurring-monitor-run-output.mjs", [
        ["--goal", goal],
        ["--registration-status", statusInput.path],
        ["--schedule", schedulePath]
      ])
    },
    {
      label: "Review compact learning events before memory or screenshots",
      command: commandLine("create-all-software-recurring-monitor-teacher-review-packet.mjs", [
        ["--goal", goal],
        ["--run-output-audit", runOutputAuditResult?.auditPath || ""]
      ])
    },
    {
      label: "Replay teacher decisions with review-only defaults",
      command: commandLine("create-all-software-recurring-monitor-review-decision-replay-queue.mjs", [
        ["--goal", goal],
        ["--teacher-review-packet", teacherReviewPacketResult?.packetPath || ""]
      ])
    }
  ],
  blockedActions: [
    "trigger reviewed output without matching registration status",
    "trigger reviewed output without final teacher confirmation",
    "trigger reviewed output without rollback point evidence",
    "trigger reviewed output without explicit allow-runner-trigger",
    "start or stop Windows Scheduled Tasks from this runner",
    "register or unregister Windows Scheduled Tasks from this runner",
    "capture screenshots from this runner",
    "read full logs by default",
    "execute target software commands",
    "write long-term memory",
    "enable rules or accept technology",
    "unlock packaging or claim all-software completion"
  ],
  blockers: [...new Set(blockers)],
  completionBoundary: {
    canReportPostRegistrationOutputWitness: runnerTriggered && directRunnerExitedZero && evidenceCounts.reviewedRunCount > 0,
    allSoftwareCoverageComplete: false,
    universalNativeControlComplete: false,
    goalComplete: false,
    reason:
      "This proves only one teacher-approved post-registration runner output witness for the provided reviewed schedule. It does not prove every installed app has useful logs or universal native software execution."
  },
  locks
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_receipt_v1",
  witnessRunId,
  status,
  runnerPath,
  operationalScope,
  runnerTriggered,
  directRunnerInvoked,
  directRunnerExitedZero,
  reviewedRunCount: evidenceCounts.reviewedRunCount,
  compactLearningEvents: evidenceCounts.compactLearningEvents,
  teacherReviewItems: evidenceCounts.teacherReviewItems,
  replayItems: evidenceCounts.replayItems,
  scheduledTaskRegisteredBeforeRun: locks.scheduledTaskRegisteredBeforeRun,
  scheduledTaskRegistrationChangedByThisRunner: false,
  scheduledTaskRegisteredByThisRunner: false,
  scheduledTaskStarted: false,
  scheduledTaskStopped: false,
  scheduledTaskUnregistered: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  unattendedAllAppMonitoringComplete: false,
  goalComplete: false,
  blockers: packet.blockers,
  locks
};

writeFileSync(runnerPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_result_v1",
      status,
      witnessRunId,
      runnerPath,
      receiptPath,
      readmePath,
      runnerTriggered,
      directRunnerInvoked,
      directRunnerExitedZero,
      reviewedRunCount: evidenceCounts.reviewedRunCount,
      compactLearningEvents: evidenceCounts.compactLearningEvents,
      teacherReviewItems: evidenceCounts.teacherReviewItems,
      runOutputAuditPath: runOutputAuditResult?.auditPath || "",
      teacherReviewPacketPath: teacherReviewPacketResult?.packetPath || "",
      reviewDecisionReplayQueuePath: reviewDecisionReplayQueueResult?.queuePath || "",
      unattendedAuditPath: unattendedAuditResult?.auditPath || "",
      postActivationWitnessPath: postActivationWitnessResult?.witnessPath || "",
      blockers: packet.blockers,
      locks
    },
    null,
    2
  )
);
