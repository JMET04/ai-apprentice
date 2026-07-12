#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "oprow", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function runPowerShell(args, cwd = smokeRoot) {
  const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${args.join(" ")} failed`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const controlledLog = join(smokeRoot, "controlled-post-registration-output.log");
writeFileSync(controlledLog, "startup complete\n", "utf8");
const queuePath = writeJson(join(smokeRoot, "controlled-queue.json"), {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "controlled-post-registration-output-witness",
  queue: [
    {
      queueItemId: "controlled-post-registration-output",
      software: "Controlled Engineering Tool",
      processName: "controlled-engineering-tool.exe",
      score: 0.96,
      recentLogCandidates: [{ path: controlledLog, source: "controlled_post_registration_output" }],
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
});

const schedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Schedule controlled post-registration output witness proof.",
  "--queue",
  queuePath,
  "--task-name",
  `TransparentAI-Smoke-PostRegistrationOutput-${Date.now()}`,
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
const operationalScope = {
  scopeKind: "teacher_reviewed_operational_low_token_monitor_scope",
  sourceTrialPath: join(smokeRoot, "operational-trial.json"),
  sourceSchedulePath: schedule.schedulePath,
  sourceReviewedRunCount: 1,
  teacherReviewedScope: true,
  rollbackPointCreated: true
};

const approvalGatePath = writeJson(join(smokeRoot, "approval-gate.json"), {
  format: "transparent_ai_all_software_recurring_monitor_approval_gate_v1",
  status: "ready_for_registration_request",
  readyForRegistrationRequest: true,
  sourceSchedulePath: schedule.schedulePath,
  generatedRegistrationRequest: {
    scriptPath: schedulePacket.files.registerTask,
    taskName: schedulePacket.taskName
  },
  schedule: {
    sourceSchedulePath: schedule.schedulePath,
    taskName: schedulePacket.taskName
  },
  locks: {
    approvalGateDoesNotRegisterTask: true,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false
  }
});
const registrationRunnerPath = writeJson(join(smokeRoot, "registration-runner.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
  status: "dry_run_ready_for_teacher_review",
  sourceApprovalGatePath: approvalGatePath,
  sourceSchedulePath: schedule.schedulePath,
  taskName: schedulePacket.taskName,
  locks: {
    dryRunDefault: true,
    targetSoftwareCommandsExecuted: false,
    nativeUniversalExecution: false
  }
});
const registeredStatusPath = writeJson(join(smokeRoot, "registered-status.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "registered_and_matches_reviewed_runner",
  sourceRegistrationRunnerPath: registrationRunnerPath,
  sourceSchedulePath: schedule.schedulePath,
  taskName: schedulePacket.taskName,
  taskRegistered: true,
  scheduledTaskInstalled: true,
  registeredMatchesExpectedRunner: true,
  locks: {
    statusVerifierDoesNotChangeSystem: true,
    startTaskCalled: false,
    stopTaskCalled: false,
    targetSoftwareCommandsExecuted: false
  }
});
const mismatchStatusPath = writeJson(join(smokeRoot, "mismatch-status.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "registered_but_mismatch_blocked",
  sourceRegistrationRunnerPath: registrationRunnerPath,
  sourceSchedulePath: schedule.schedulePath,
  taskName: schedulePacket.taskName,
  taskRegistered: true,
  registeredMatchesExpectedRunner: false,
  locks: {
    statusVerifierDoesNotChangeSystem: true
  }
});
const approvedRunnerPath = writeJson(join(smokeRoot, "approved-registration-runner.json"), {
  format: "transparent_ai_all_software_operational_learning_registration_approved_runner_v1",
  status: "registration_execute_completed_and_status_matched",
  postExecuteRegisteredMatchesExpectedRunner: true,
  operationalScope,
  paths: {
    invokedRegistrationRunner: registrationRunnerPath,
    sourceRegistrationRunner: registrationRunnerPath,
    postExecuteRegistrationStatus: registeredStatusPath
  },
  locks: {
    registrationRunnerInvoked: true,
    scheduledTaskStarted: false,
    packagingGated: true
  }
});

const wrapperPath = join(smokeRoot, "registration-wrapper.ps1");
writeFileSync(wrapperPath, "# smoke wrapper\n", "utf8");
const rehearsalPath = writeJson(join(smokeRoot, "dry-run-rehearsal.json"), {
  format: "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
  status: "passed_no_system_change",
  operationalScope,
  paths: {
    wrapper: wrapperPath,
    sourceRegistrationRunner: registrationRunnerPath,
    sourceSchedule: schedule.schedulePath
  },
  locks: {
    activationDryRunWrapperExecuted: true,
    wrapperExecuteFlagPassed: false,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});
const executeGatePath = writeJson(join(smokeRoot, "registration-execute-gate.json"), {
  format: "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
  status: "ready_for_teacher_registration_execute_review",
  readyForTeacherRegistrationExecuteReview: true,
  operationalScope,
  paths: {
    wrapper: wrapperPath,
    sourceRegistrationRunner: registrationRunnerPath,
    sourceSchedule: schedule.schedulePath
  },
  locks: {
    executeRequestPrepared: true,
    executeRequestExecuted: false,
    scheduledTaskRegistered: false,
    targetSoftwareCommandsExecuted: false
  }
});

const missingFlag = runNodeScript("run-all-software-operational-learning-post-registration-output-witness-runner.mjs", [
  "--goal",
  "Missing trigger flag should block post-registration output witness.",
  "--registration-status",
  registeredStatusPath,
  "--registration-approved-runner",
  approvedRunnerPath,
  "--teacher-confirmation",
  "teacher confirmed post-registration output witness",
  "--rollback-point-created",
  "--allow-runner-trigger",
  "--output-dir",
  join(smokeRoot, "missing-trigger-flag")
]);
const mismatch = runNodeScript("run-all-software-operational-learning-post-registration-output-witness-runner.mjs", [
  "--goal",
  "Mismatched registration status should block post-registration output witness.",
  "--registration-status",
  mismatchStatusPath,
  "--teacher-confirmation",
  "teacher confirmed post-registration output witness",
  "--rollback-point-created",
  "--trigger-reviewed-output",
  "--allow-runner-trigger",
  "--output-dir",
  join(smokeRoot, "mismatch-status")
]);

runPowerShell(["-File", schedule.runnerPath, "-RunLabel", "baseline"], dirname(schedule.runnerPath));
appendFileSync(controlledLog, "ERROR teacher-reviewed post-registration signal changed\n", "utf8");

const ready = runNodeScript("run-all-software-operational-learning-post-registration-output-witness-runner.mjs", [
  "--goal",
  "Trigger one controlled post-registration output witness and audit the review chain.",
  "--registration-status",
  registeredStatusPath,
  "--registration-approved-runner",
  approvedRunnerPath,
  "--dry-run-rehearsal",
  rehearsalPath,
  "--registration-execute-gate",
  executeGatePath,
  "--teacher-confirmation",
  "teacher confirmed post-registration output witness",
  "--rollback-point-created",
  "--trigger-reviewed-output",
  "--allow-runner-trigger",
  "--run-label",
  "changed",
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyPacket = readJson(ready.runnerPath);
const readyReceipt = readJson(ready.receiptPath);
const readyAudit = readJson(ready.runOutputAuditPath);
const readyReviewPacket = readJson(ready.teacherReviewPacketPath);
const readyReplayQueue = readJson(ready.reviewDecisionReplayQueuePath);
const readyUnattendedAudit = readJson(ready.unattendedAuditPath);

const checks = [
  check(
    "Post-registration output witness runner blocks without explicit trigger flag",
    missingFlag.status === "blocked_before_post_registration_output_witness_runner" &&
      missingFlag.runnerTriggered === false &&
      missingFlag.blockers.includes("missing_trigger_reviewed_output_flag"),
    JSON.stringify(missingFlag.blockers)
  ),
  check(
    "Post-registration output witness runner blocks when read-only registration status is mismatched",
    mismatch.status === "blocked_before_post_registration_output_witness_runner" &&
      mismatch.runnerTriggered === false &&
      mismatch.blockers.includes("registration_status_not_registered_and_matching_reviewed_runner") &&
      mismatch.blockers.includes("registration_status_match_flag_missing"),
    JSON.stringify(mismatch.blockers)
  ),
  check(
    "Ready runner directly invokes the reviewed scheduled runner once after matching registration evidence",
    ready.runnerTriggered === true &&
      ready.directRunnerInvoked === true &&
      ready.directRunnerExitedZero === true &&
      readyPacket.triggerResult?.triggerMode === "reviewed_scheduled_runner_direct_invocation" &&
      readyPacket.paths.registrationStatus === registeredStatusPath &&
      readyPacket.operationalScope?.sourceSchedulePath === schedule.schedulePath &&
      readyPacket.paths.reviewedScheduledRunner === schedule.runnerPath,
    JSON.stringify({ trigger: readyPacket.triggerResult, paths: readyPacket.paths })
  ),
  check(
    "Triggered output is immediately audited into compact teacher-review learning events",
    ready.status === "post_registration_output_triggered_learning_events_waiting_for_teacher_review" &&
      ready.reviewedRunCount >= 1 &&
      ready.compactLearningEvents >= 1 &&
      readyAudit.status === "learning_events_waiting_for_teacher_review" &&
      readyReviewPacket.reviewItemCount >= 1 &&
      readyReplayQueue.replayItems?.some((item) => item.status === "needs_teacher_review"),
    JSON.stringify({
      status: ready.status,
      audit: readyAudit.status,
      compactLearningEvents: ready.compactLearningEvents,
      reviewItems: readyReviewPacket.reviewItemCount
    })
  ),
  check(
    "Unattended audit remains gated because teacher review is still needed",
    readyUnattendedAudit.status === "unattended_learning_not_ready_remaining_gaps" &&
      readyUnattendedAudit.remainingGaps.some((gap) => gap.kind === "review_replay_waiting_for_teacher"),
    JSON.stringify(readyUnattendedAudit.remainingGaps)
  ),
  check(
    "Post-registration output witness preserves teacher-reviewed operational monitor scope",
    readyPacket.operationalScope?.scopeKind === "teacher_reviewed_operational_low_token_monitor_scope" &&
      readyPacket.operationalScope?.teacherReviewedScope === true &&
      readyReceipt.operationalScope?.sourceTrialPath === operationalScope.sourceTrialPath &&
      readyPacket.operationalScopeSummary?.sourceCount >= 3,
    JSON.stringify(readyPacket.operationalScopeSummary)
  ),
  check(
    "Post-registration output witness keeps schedule, screenshot, target execution, memory, packaging, and completion locks closed",
    readyReceipt.runnerTriggered === true &&
      readyReceipt.scheduledTaskRegistrationChangedByThisRunner === false &&
      readyReceipt.scheduledTaskStarted === false &&
      readyReceipt.scheduledTaskStopped === false &&
      readyReceipt.scheduledTaskUnregistered === false &&
      readyReceipt.screenshotsCaptured === false &&
      readyReceipt.rawFullLogsRetained === false &&
      readyReceipt.softwareActionsExecuted === false &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.longTermMemoryWritten === false &&
      readyReceipt.nativeUniversalExecution === false &&
      readyReceipt.goalComplete === false &&
      readyReceipt.locks?.packagingGated === true,
    JSON.stringify(readyReceipt.locks)
  ),
  check(
    "Post-registration output witness writes teacher-readable start-here evidence",
    existsSync(ready.readmePath) &&
      readFileSync(ready.readmePath, "utf8").includes("Post-Registration Output Witness Runner") &&
      readFileSync(ready.readmePath, "utf8").includes("directly invokes the same reviewed scheduled runner once"),
    ready.readmePath
  )
];

const failed = checks.filter((item) => !item.pass);
const summary = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_smoke_v1",
  smokeRoot,
  paths: {
    schedule: schedule.schedulePath,
    registrationStatus: registeredStatusPath,
    readyRunner: ready.runnerPath,
    readyAudit: ready.runOutputAuditPath,
    readyReviewPacket: ready.teacherReviewPacketPath,
    readyReplayQueue: ready.reviewDecisionReplayQueuePath,
    readyUnattendedAudit: ready.unattendedAuditPath,
    readyPostActivationWitness: ready.postActivationWitnessPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exit(1);
