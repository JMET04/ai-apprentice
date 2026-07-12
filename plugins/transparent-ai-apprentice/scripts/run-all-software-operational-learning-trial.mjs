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
    String(value || "all-software-operational-learning-trial")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "all-software-operational-learning-trial"
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

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: Number(argValue("--child-timeout-ms", "180000"))
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    manualOperationalTrial: true,
    manualLowTokenRunnerLaunched: true,
    scheduledTaskStarted: false,
    scheduledTaskRegistered: false,
    scheduledTaskUnregistered: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    screenshotsOnlyAfterTriggerAndReview: true,
    fullContinuousRecording: false,
    storesAudio: false,
    rawFullLogsRetained: false,
    longTermMemoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    unattendedAllAppMonitoringComplete: false,
    teacherReviewRequiredBeforeMemory: true,
    teacherConfirmationRequiredBeforeScheduleRegistration: true
  };
}

function writeReadme(path, trial) {
  const lines = [
    "# All-Software Operational Learning Trial",
    "",
    `Status: ${trial.status}`,
    `Goal: ${trial.goal}`,
    "",
    "What ran:",
    "- A bounded real-local readiness package was reused or refreshed.",
    "- The existing automatic low-token learning runner was launched manually against the reviewed observer queue.",
    "- Existing run-output, unattended-boundary, and operational workbench audits indexed the result.",
    "",
    "Open in order:",
    `1. Trial JSON: ${trial.paths.trial}`,
    `2. Receipt: ${trial.paths.receipt}`,
    `3. Readiness package: ${trial.paths.readinessPackage}`,
    `4. Log-source discovery ledger: ${trial.paths.logSourceDiscoveryLedgerReadme || trial.paths.logSourceDiscoveryLedger || ""}`,
    `5. Manual runner journal: ${trial.paths.manualRunnerJournal}`,
    `6. Run-output audit: ${trial.paths.runOutputAudit}`,
    `7. Unattended audit: ${trial.paths.unattendedAudit}`,
    `8. Operational workbench: ${trial.paths.operationalWorkbench}`,
    "",
    "Low-token source route status:",
    `- Ledger status: ${trial.lowTokenSourceRouteEvidence.status || "missing"}`,
    `- Ledger rows: ${trial.counts.logSourceDiscoveryRows}`,
    `- Missing source rows: ${trial.counts.logSourceDiscoveryMissingRows}`,
    `- Direct log candidates behind metadata gate: ${trial.counts.directLogCandidatesReadyForMetadataGate}`,
    `- Reviewed low-token fallback candidates: ${trial.counts.lowTokenFallbackRoutesReadyForReview}`,
    "",
    "Operational boundary:",
    "- This trial launched only the local low-token learning runner.",
    "- It did not register or start a Windows Scheduled Task.",
    "- It did not start target software, send UI events, capture screenshots, read full logs, write memory, enable rules, accept technology, or unlock packaging.",
    "",
    "Remaining blockers:",
    ...trial.blockers.map((blocker) => `- ${blocker}`),
    "",
    "Next safe step:",
    trial.nextSafeStep
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Run a bounded real-local all-software low-token learning trial without system changes."
);
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-trials")));
const readinessInput = readJsonInput(
  argValue("--readiness-package", argValue("--readiness", "")),
  "--readiness-package",
  "transparent_ai_real_local_all_software_low_token_readiness_package_v1"
);
const skipReadinessRefresh = hasFlag("--skip-readiness-refresh") && readinessInput.value;

const runs = Math.max(1, Number(argValue("--runs", "2")));
const intervalMs = Math.max(0, Number(argValue("--interval-ms", "0")));
const maxProcesses = Math.max(1, Number(argValue("--max-processes", "8")));
const maxInstalled = Math.max(1, Number(argValue("--max-installed", "8")));
const maxLogFilesPerCandidate = Math.max(0, Number(argValue("--max-log-files-per-candidate", "1")));
const maxQueueCandidates = Math.max(1, Number(argValue("--max-queue-candidates", "6")));
const maxRunnerItems = Math.max(1, Number(argValue("--max-runner-items", "3")));
const maxLogsPerItem = Math.max(1, Number(argValue("--max-logs-per-item", "1")));
const maxTailBytes = Math.max(256, Number(argValue("--max-tail-bytes", "1024")));
const maxTailLines = Math.max(1, Number(argValue("--max-tail-lines", "16")));
const maxLearningItems = Math.max(1, Number(argValue("--max-learning-items", "2")));

mkdirSync(outputRoot, { recursive: true });
const trialId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const trialDir = join(outputRoot, trialId);
mkdirSync(trialDir, { recursive: true });

let readinessResult = null;
let readinessPath = readinessInput.path;
let readiness = readinessInput.value;
if (!skipReadinessRefresh) {
  readinessResult = runNodeScript("create-real-local-all-software-low-token-readiness-package.mjs", [
    "--goal",
    goal,
    "--max-processes",
    String(maxProcesses),
    "--max-installed",
    String(maxInstalled),
    "--max-log-files-per-candidate",
    String(maxLogFilesPerCandidate),
    "--max-queue-candidates",
    String(maxQueueCandidates),
    "--max-runner-items",
    String(maxRunnerItems),
    "--max-logs-per-item",
    String(maxLogsPerItem),
    "--max-tail-bytes",
    String(maxTailBytes),
    "--max-tail-lines",
    String(maxTailLines),
    "--max-learning-items",
    String(maxLearningItems),
    "--output-dir",
    join(trialDir, "readiness-package")
  ]);
  readinessPath = readinessResult.packagePath;
  readiness = readJson(readinessPath);
}

if (!readiness?.paths?.observerQueue) throw new Error("Readiness package must include paths.observerQueue");
if (!readiness?.paths?.automaticSchedule) throw new Error("Readiness package must include paths.automaticSchedule");
const readinessLogSourceDiscoveryLedger = readiness.paths.logSourceDiscoveryLedger || "";
const readinessLogSourceDiscoveryLedgerReadme = readiness.paths.logSourceDiscoveryLedgerReadme || "";
const logSourceDiscoveryLedger =
  readinessLogSourceDiscoveryLedger && existsSync(readinessLogSourceDiscoveryLedger)
    ? readJson(readinessLogSourceDiscoveryLedger)
    : null;
const logSourceDiscoveryLocks = logSourceDiscoveryLedger?.locks || {};
const logSourceDiscoveryReady =
  logSourceDiscoveryLedger?.format === "transparent_ai_all_software_log_source_discovery_ledger_v1" &&
  logSourceDiscoveryLocks.reviewOnly === true &&
  logSourceDiscoveryLocks.logContentsRead === false &&
  logSourceDiscoveryLocks.screenshotsCaptured === false &&
  logSourceDiscoveryLocks.softwareActionsExecuted === false;

const manualRunnerOutputDir = join(trialDir, "manual-operational-runner-output");
const manualRunner = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
  "--goal",
  goal,
  "--queue",
  readiness.paths.observerQueue,
  "--runs",
  String(runs),
  "--interval-ms",
  String(intervalMs),
  "--max-items",
  String(maxRunnerItems),
  "--max-logs-per-item",
  String(maxLogsPerItem),
  "--max-tail-bytes",
  String(maxTailBytes),
  "--max-tail-lines",
  String(maxTailLines),
  "--max-learning-items",
  String(maxLearningItems),
  "--output-dir",
  manualRunnerOutputDir
]);
const manualRunnerJournal = readJson(manualRunner.journalPath);
const manualRunnerReceipt = readJson(manualRunner.receiptPath);

const schedule = readJson(readiness.paths.automaticSchedule);
const scheduleOverlayPath = join(trialDir, "manual-trial-schedule-overlay.json");
const scheduleOverlay = {
  ...schedule,
  sourceSchedulePath: readiness.paths.automaticSchedule,
  trialOverlay: true,
  taskName: `${schedule.taskName || "TransparentAI-LowTokenLearning"}-ManualTrial`,
  runOutputDir: manualRunnerOutputDir,
  schedulePolicy: {
    ...(schedule.schedulePolicy || {}),
    scheduledTaskInstalled: false,
    manualTrialOnly: true
  },
  locks: {
    ...(schedule.locks || {}),
    scheduledTaskInstalled: false,
    scheduledTaskRegistered: false,
    runnerLaunchedBySchedule: false
  }
};
writeFileSync(scheduleOverlayPath, `${JSON.stringify(scheduleOverlay, null, 2)}\n`, "utf8");

const runOutputAudit = runNodeScript("audit-all-software-recurring-monitor-run-output.mjs", [
  "--goal",
  goal,
  "--schedule",
  scheduleOverlayPath,
  "--run-output-dir",
  manualRunnerOutputDir,
  "--max-runs",
  "4",
  "--output-dir",
  join(trialDir, "run-output-audit")
]);

const unattendedAudit = runNodeScript("create-all-software-unattended-learning-audit.mjs", [
  "--goal",
  goal,
  "--schedule",
  scheduleOverlayPath,
  "--run-output-audit",
  runOutputAudit.auditPath,
  "--output-dir",
  join(trialDir, "unattended-audit")
]);

const operationalWorkbench = runNodeScript("create-all-software-operational-learning-workbench.mjs", [
  "--goal",
  goal,
  "--readiness-package",
  readinessPath,
  "--schedule",
  scheduleOverlayPath,
  "--run-output-audit",
  runOutputAudit.auditPath,
  "--unattended-audit",
  unattendedAudit.auditPath,
  "--output-dir",
  join(trialDir, "operational-workbench")
]);

const runOutputAuditJson = readJson(runOutputAudit.auditPath);
const unattendedAuditJson = readJson(unattendedAudit.auditPath);
const workbenchJson = readJson(operationalWorkbench.workbenchPath);
const lockState = locks();
const lockMismatch =
  manualRunnerReceipt.fullContinuousRecording !== false ||
  manualRunnerReceipt.screenshotsCaptured !== false ||
  manualRunnerReceipt.rawFullLogsRetained !== false ||
  manualRunnerReceipt.softwareActionsExecuted !== false ||
  manualRunnerReceipt.longTermMemoryWritten !== false ||
  manualRunnerReceipt.nativeUniversalExecution !== false;

const blockers = [
  "scheduled_task_not_registered_or_not_matching",
  "teacher_review_packet_missing_or_not_replayed",
  "long_term_memory_still_requires_teacher_review",
  "unattended_all_app_monitoring_not_proven_complete",
  "native_universal_execution_not_claimed"
];
if (lockMismatch) blockers.unshift("manual_runner_lock_mismatch_requires_review");
if (!logSourceDiscoveryReady) blockers.unshift("log_source_discovery_ledger_missing_or_unreviewed");

const status = lockMismatch
  ? "manual_operational_trial_blocked_lock_mismatch"
  : runOutputAuditJson.reviewedRunCount > 0
    ? "manual_operational_trial_completed_waiting_for_registration_and_teacher_review"
    : "manual_operational_trial_completed_waiting_for_next_delta";

const trialPath = join(trialDir, "all-software-operational-learning-trial.json");
const receiptPath = join(trialDir, "all-software-operational-learning-trial-receipt.json");
const readmePath = join(trialDir, "ALL_SOFTWARE_OPERATIONAL_LEARNING_TRIAL_START_HERE.md");

const trial = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_trial_v1",
  trialId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  existingAbilitiesReused: [
    "create_real_local_all_software_low_token_readiness_package",
    "create_all_software_log_source_discovery_ledger",
    "run_automatic_low_token_learning_runner",
    "audit_all_software_recurring_monitor_run_output",
    "create_all_software_unattended_learning_audit",
    "create_all_software_operational_learning_workbench"
  ],
  counts: {
    readinessCandidates: readiness.counts?.realLocalCandidates || 0,
    queuedSoftware: readiness.counts?.queuedSoftware || 0,
    logSourceDiscoveryRows:
      logSourceDiscoveryLedger?.counts?.ledgerRows ||
      readiness.counts?.logSourceDiscoveryRows ||
      (Array.isArray(logSourceDiscoveryLedger?.rows) ? logSourceDiscoveryLedger.rows.length : 0),
    logSourceDiscoveryMissingRows:
      logSourceDiscoveryLedger?.counts?.needsTeacherLogSourceOrExclusion ||
      readiness.counts?.logSourceDiscoveryMissingRows ||
      0,
    directLogCandidatesReadyForMetadataGate:
      logSourceDiscoveryLedger?.counts?.directLogCandidatesReadyForMetadataGate ||
      readiness.counts?.directLogCandidatesReadyForMetadataGate ||
      0,
    lowTokenFallbackRoutesReadyForReview:
      (logSourceDiscoveryLedger?.counts?.nonLogLowTokenFallbackReadyForReview || 0) +
      (logSourceDiscoveryLedger?.counts?.windowsEventLogFallbackReadyForReview || 0) ||
      readiness.counts?.lowTokenFallbackRoutesReadyForReview ||
      0,
    manualRunnerRuns: manualRunnerJournal.runRecords?.length || 0,
    reviewedRunCount: runOutputAuditJson.reviewedRunCount || 0,
    metadataGateRuns: manualRunnerJournal.totals?.metadataGateRuns || 0,
    tailReadSkippedByMetadataGate: manualRunnerJournal.totals?.tailReadSkippedByMetadataGate || 0,
    changedItems: manualRunnerJournal.totals?.changedItems || 0,
    compactLearningEvents: manualRunnerJournal.totals?.compactLearningEvents || 0,
    runOutputTeacherReviewItems: runOutputAuditJson.teacherReviewQueue?.length || 0,
    unattendedRemainingGaps: unattendedAuditJson.remainingGaps?.length || 0,
    workbenchRemainingGaps: workbenchJson.operationalProof?.remainingGaps?.length || 0
  },
  paths: {
    trial: trialPath,
    receipt: receiptPath,
    readme: readmePath,
    readinessPackage: readinessPath,
    logSourceDiscoveryLedger: readinessLogSourceDiscoveryLedger,
    logSourceDiscoveryLedgerReadme: readinessLogSourceDiscoveryLedgerReadme,
    observerQueue: readiness.paths.observerQueue,
    sourceSchedule: readiness.paths.automaticSchedule,
    scheduleOverlay: scheduleOverlayPath,
    manualRunnerOutputDir,
    manualRunnerJournal: manualRunner.journalPath,
    manualRunnerReceipt: manualRunner.receiptPath,
    runOutputAudit: runOutputAudit.auditPath,
    runOutputAuditReceipt: runOutputAudit.receiptPath,
    unattendedAudit: unattendedAudit.auditPath,
    operationalWorkbench: operationalWorkbench.workbenchPath,
    operationalWorkbenchReadme: operationalWorkbench.readme
  },
  proofBoundary: {
    manualRunnerLaunched: true,
    logSourceDiscoveryLedgerReady: logSourceDiscoveryReady,
    logSourceDiscoveryComplete: logSourceDiscoveryLedger?.status === "all_log_sources_mapped_waiting_for_coverage_review",
    allRowsHaveLogSourceRoute: logSourceDiscoveryLedger?.allRowsHaveSourceRoute === true,
    scheduledTaskRegistered: false,
    scheduledTaskStarted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    longTermMemoryWritten: false,
    operationalUnattendedComplete: false,
    reason:
      "This is a bounded manual operational trial of the existing low-token learning chain. It proves local runner/audit/workbench plumbing, not unattended scheduled operation or universal native execution."
  },
  lowTokenSourceRouteEvidence: {
    ledgerReady: logSourceDiscoveryReady,
    status: logSourceDiscoveryLedger?.status || "",
    allRowsHaveSourceRoute: logSourceDiscoveryLedger?.allRowsHaveSourceRoute === true,
    reviewOnly: logSourceDiscoveryLocks.reviewOnly === true,
    logContentsRead: logSourceDiscoveryLocks.logContentsRead === true,
    screenshotsCaptured: logSourceDiscoveryLocks.screenshotsCaptured === true,
    softwareActionsExecuted: logSourceDiscoveryLocks.softwareActionsExecuted === true,
    nextReviewQueueCount: logSourceDiscoveryLedger?.nextReviewQueue?.length || 0
  },
  blockers,
  nextSafeStep:
    "Review the log-source discovery ledger and this trial, then create the teacher review packet and replay queue. Register a schedule only after explicit teacher confirmation and a kept rollback point.",
  locks: lockState
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_trial_receipt_v1",
  trialId,
  status,
  counts: trial.counts,
  paths: trial.paths,
  lowTokenSourceRouteEvidence: trial.lowTokenSourceRouteEvidence,
  blockers,
  manualLowTokenRunnerLaunched: true,
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks: lockState
};

writeFileSync(trialPath, `${JSON.stringify(trial, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, trial);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_learning_trial_result_v1",
      trialId,
      status,
      trialPath,
      receiptPath,
      readme: readmePath,
      counts: trial.counts,
      blockers: blockers.length,
      manualLowTokenRunnerLaunched: true,
      scheduledTaskRegistered: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      longTermMemoryWritten: false,
      nativeUniversalExecution: false,
      locks: lockState
    },
    null,
    2
  )
);
