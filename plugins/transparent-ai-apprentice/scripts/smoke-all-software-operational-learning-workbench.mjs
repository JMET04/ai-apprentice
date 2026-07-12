#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScript(args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, "create-all-software-operational-learning-workbench.mjs"), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "workbench script failed");
  return JSON.parse(result.stdout);
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

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-workbench-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const schedulePath = writeJson(join(smokeRoot, "schedule.json"), {
  format: "transparent_ai_automatic_low_token_learning_schedule_v1",
  status: "waiting_for_teacher_review_before_registration",
  taskName: "TransparentAI-Smoke-Operational-Workbench",
  files: {
    runner: join(smokeRoot, "run-scheduled-low-token-learning.ps1"),
    registerTask: join(smokeRoot, "register-low-token-learning-task.ps1"),
    unregisterTask: join(smokeRoot, "unregister-low-token-learning-task.ps1")
  },
  schedulePolicy: {
    metadataFirst: true,
    requiresTeacherConfirmedFlag: true,
    scheduledTaskInstalled: false
  },
  locks: {
    scheduledTaskInstalled: false,
    longTermMemoryWritten: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false
  }
});
writeFileSync(join(smokeRoot, "run-scheduled-low-token-learning.ps1"), "Write-Output 'dry-run runner'\n", "utf8");
writeFileSync(join(smokeRoot, "register-low-token-learning-task.ps1"), "param([switch]$TeacherConfirmed)\n", "utf8");
writeFileSync(join(smokeRoot, "unregister-low-token-learning-task.ps1"), "param([switch]$TeacherConfirmed)\n", "utf8");

const readinessPath = writeJson(join(smokeRoot, "readiness.json"), {
  format: "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
  status: "waiting_for_teacher_review_before_registration_or_learning_memory",
  paths: {
    automaticSchedule: schedulePath,
    scheduledRunner: join(smokeRoot, "run-scheduled-low-token-learning.ps1"),
    scheduleRegisterScript: join(smokeRoot, "register-low-token-learning-task.ps1")
  },
  counts: {
    queuedSoftware: 2,
    compactLearningEvents: 1
  },
  locks: {
    scheduledTaskInstalled: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    longTermMemoryWritten: false
  }
});
const approvalPath = writeJson(join(smokeRoot, "approval.json"), {
  format: "transparent_ai_all_software_recurring_monitor_approval_gate_v1",
  status: "ready_for_teacher_confirmed_recurring_monitor_registration_request",
  sourceSchedulePath: schedulePath,
  readyForRegistrationRequest: true,
  generatedRegistrationRequest: {
    taskName: "TransparentAI-Smoke-Operational-Workbench",
    scriptPath: join(smokeRoot, "register-low-token-learning-task.ps1")
  },
  locks: {
    approvalGateDoesNotRegisterTask: true,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false
  }
});
const runnerPath = writeJson(join(smokeRoot, "runner.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
  status: "dry_run_ready_for_teacher_review",
  sourceSchedulePath: schedulePath,
  taskName: "TransparentAI-Smoke-Operational-Workbench",
  registerCommand: {
    scriptPath: join(smokeRoot, "register-low-token-learning-task.ps1")
  },
  unregisterCommand: {
    scriptPath: join(smokeRoot, "unregister-low-token-learning-task.ps1")
  },
  locks: {
    dryRunDefault: true,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false
  }
});
const notRegisteredStatusPath = writeJson(join(smokeRoot, "status-not-registered.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "verified_not_registered_yet",
  taskRegistered: false,
  taskName: "TransparentAI-Smoke-Operational-Workbench",
  sourceSchedulePath: schedulePath,
  locks: {
    registerTaskCalled: false,
    unregisterTaskCalled: false,
    startTaskCalled: false,
    softwareActionsExecuted: false
  }
});
const registeredStatusPath = writeJson(join(smokeRoot, "status-registered.json"), {
  format: "transparent_ai_all_software_recurring_monitor_registration_status_v1",
  status: "registered_and_matches_reviewed_runner",
  taskRegistered: true,
  taskName: "TransparentAI-Smoke-Operational-Workbench",
  sourceSchedulePath: schedulePath,
  locks: {
    registerTaskCalled: false,
    unregisterTaskCalled: false,
    startTaskCalled: false,
    softwareActionsExecuted: false
  }
});
const runOutputAuditPath = writeJson(join(smokeRoot, "run-output-audit.json"), {
  format: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
  status: "learning_events_waiting_for_teacher_review",
  totals: {
    reviewedRuns: 1,
    compactLearningEvents: 1,
    lockMismatches: 0
  },
  locks: {
    runnerLaunched: false,
    scheduledTaskRegistered: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    longTermMemoryWritten: false
  }
});
const reviewPath = writeJson(join(smokeRoot, "teacher-review-packet.json"), {
  format: "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
  status: "waiting_for_teacher_review",
  reviewItems: [{ id: "event-1", route: "ready_for_teacher_teach_apprentice_review" }]
});
const replayPath = writeJson(join(smokeRoot, "replay-queue.json"), {
  format: "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
  status: "ready_for_follow_up_queue_review",
  replayRows: [{ id: "event-1", decision: "ready_for_follow_up" }]
});
const notReadyAuditPath = writeJson(join(smokeRoot, "unattended-audit-not-ready.json"), {
  format: "transparent_ai_all_software_unattended_learning_audit_v1",
  status: "unattended_learning_not_ready_remaining_gaps",
  unattendedAllAppMonitoringComplete: false,
  remainingGaps: [{ kind: "scheduled_task_not_registered_or_not_matching" }]
});
const readyAuditPath = writeJson(join(smokeRoot, "unattended-audit-ready.json"), {
  format: "transparent_ai_all_software_unattended_learning_audit_v1",
  status: "unattended_learning_ready_for_teacher_operational_review",
  unattendedAllAppMonitoringComplete: true,
  remainingGaps: []
});

const missing = runScript(["--goal", "smoke missing evidence", "--output-dir", join(smokeRoot, "missing")], process.cwd());
const missingPacket = readJson(missing.workbenchPath);
const notRegistered = runScript(
  [
    "--goal",
    "smoke not registered evidence",
    "--readiness-package",
    readinessPath,
    "--approval-gate",
    approvalPath,
    "--registration-runner",
    runnerPath,
    "--registration-status",
    notRegisteredStatusPath,
    "--run-output-audit",
    runOutputAuditPath,
    "--teacher-review-packet",
    reviewPath,
    "--review-decision-replay-queue",
    replayPath,
    "--unattended-audit",
    notReadyAuditPath,
    "--output-dir",
    join(smokeRoot, "not-registered")
  ],
  process.cwd()
);
const notRegisteredPacket = readJson(notRegistered.workbenchPath);
const ready = runScript(
  [
    "--goal",
    "smoke ready evidence",
    "--readiness-package",
    readinessPath,
    "--approval-gate",
    approvalPath,
    "--registration-runner",
    runnerPath,
    "--registration-status",
    registeredStatusPath,
    "--run-output-audit",
    runOutputAuditPath,
    "--teacher-review-packet",
    reviewPath,
    "--review-decision-replay-queue",
    replayPath,
    "--unattended-audit",
    readyAuditPath,
    "--output-dir",
    join(smokeRoot, "ready")
  ],
  process.cwd()
);
const readyPacket = readJson(ready.workbenchPath);
const readme = readFileSync(ready.readme, "utf8");

const checks = [
  check(
    "Operational workbench reports missing evidence instead of claiming automatic learning",
    missingPacket.status === "waiting_for_teacher_registration_or_manual_runner" &&
      missingPacket.operationalProof.remainingGaps.includes("missing_real_local_readiness_package"),
    missing.workbenchPath
  ),
  check(
    "Operational workbench keeps unregistered scheduled task as the next real blocker",
    notRegisteredPacket.operationalProof.remainingGaps.includes("scheduled_task_not_registered_or_not_matching") &&
      notRegisteredPacket.status === "waiting_for_teacher_registration_or_manual_runner",
    JSON.stringify(notRegisteredPacket.operationalProof)
  ),
  check(
    "Operational workbench can reach teacher operational review only from ready audit evidence",
    readyPacket.status === "ready_for_teacher_operational_review" &&
      readyPacket.operationalProof.unattendedReadyForTeacherOperationalReview === true &&
      readyPacket.operationalProof.remainingGaps.length === 0,
    ready.workbenchPath
  ),
  check(
    "Operational workbench reuses existing tools and preserves no-op safety locks",
    readyPacket.existingAbilitiesReused.includes("create_all_software_unattended_learning_audit") &&
      readyPacket.locks.operationalWorkbenchDoesNotRegisterTask === true &&
      readyPacket.locks.operationalWorkbenchDoesNotLaunchRunner === true &&
      readyPacket.locks.operationalWorkbenchDoesNotCaptureScreenshots === true &&
      readyPacket.locks.softwareActionsExecuted === false &&
      readyPacket.locks.longTermMemoryWritten === false &&
      readme.includes("Next safe commands:"),
    ready.receiptPath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_all_software_operational_learning_workbench_smoke_v1",
  smokeRoot,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
