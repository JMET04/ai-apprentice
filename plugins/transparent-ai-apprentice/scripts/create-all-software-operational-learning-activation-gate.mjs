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
    String(value || "all-software-operational-learning-activation-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "all-software-operational-learning-activation-gate"
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

function firstExistingPath(...values) {
  for (const value of values) {
    const text = String(value || "");
    if (text && existsSync(text)) return resolve(text);
  }
  return "";
}

function writeReadme(path, packet) {
  const lines = [
    "# All-Software Operational Learning Activation Gate",
    "",
    `Status: ${packet.status}`,
    `Goal: ${packet.goal}`,
    `Operational scope: ${packet.operationalScope?.scopeKind || "unspecified"}`,
    "",
    "What this gate did:",
    "- Read an operational learning trial packet.",
    "- Reused the reviewed schedule package from that trial.",
    "- Created the existing recurring-monitor approval gate.",
    "- Created the existing dry-run registration runner when enough review confirmations were supplied.",
    "- Queried scheduled-task status through the existing read-only verifier.",
    "- Rebuilt the operational workbench with the activation evidence.",
    "",
    "Open in order:",
    `1. Activation gate: ${packet.paths.activationGate}`,
    `2. Receipt: ${packet.paths.receipt}`,
    `3. Source operational trial: ${packet.paths.sourceTrial}`,
    `4. Source log-source discovery ledger: ${packet.paths.sourceLogSourceDiscoveryLedgerReadme || packet.paths.sourceLogSourceDiscoveryLedger || "not provided"}`,
    `5. Approval gate: ${packet.paths.approvalGate}`,
    `6. Registration runner: ${packet.paths.registrationRunner || "not created"}`,
    `7. Registration status: ${packet.paths.registrationStatus || "not created"}`,
    `8. Updated operational workbench: ${packet.paths.updatedOperationalWorkbench || "not created"}`,
    "",
    "Low-token source route evidence:",
    `- Ledger ready: ${packet.lowTokenSourceRouteEvidence?.ledgerReady === true}`,
    `- Ledger rows: ${packet.lowTokenSourceRouteEvidence?.counts?.logSourceDiscoveryRows ?? 0}`,
    `- Missing source rows: ${packet.lowTokenSourceRouteEvidence?.counts?.logSourceDiscoveryMissingRows ?? 0}`,
    `- Review-only: ${packet.lowTokenSourceRouteEvidence?.reviewOnly === true}`,
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary:",
    "- This activation gate does not register, start, stop, or unregister a Windows Scheduled Task.",
    "- It does not launch target software, send UI events, capture screenshots, read full logs, write long-term memory, enable rules, accept technology, or claim universal native control.",
    "- The next real system-change step remains a separate teacher-confirmed command from the dry-run registration runner."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Prepare the reviewed activation gate from a real-local all-software operational learning trial."
);
const trialInput = readJsonInput(
  argValue("--trial", argValue("--operational-trial", argValue("--trial-path", ""))),
  "--trial",
  "transparent_ai_all_software_operational_learning_trial_v1"
);
if (!trialInput.value) throw new Error("--trial is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-operational-learning-activation-gates"))
);
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--monitor-confirmation", ""));
const scopeConfirmation = argValue("--scope-confirmation", argValue("--teacher-scope-confirmation", ""));
const registrationConfirmation = argValue("--registration-confirmation", argValue("--teacher-registration-confirmation", ""));
const rollbackPointCreated = hasFlag("--rollback-point-created");
const teacherReviewedScope = hasFlag("--teacher-reviewed-scope");

mkdirSync(outputRoot, { recursive: true });
const activationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const activationDir = join(outputRoot, activationId);
mkdirSync(activationDir, { recursive: true });

const trial = trialInput.value;
const sourceSchedulePath = firstExistingPath(trial.paths?.sourceSchedule, trial.paths?.schedule, trial.paths?.schedulePackage);
if (!sourceSchedulePath) throw new Error("Operational trial must include an existing paths.sourceSchedule");
const sourceLogSourceDiscoveryLedger = firstExistingPath(trial.paths?.logSourceDiscoveryLedger);
const sourceLogSourceDiscoveryLedgerReadme = firstExistingPath(trial.paths?.logSourceDiscoveryLedgerReadme);
const trialLowTokenSourceRouteEvidence = trial.lowTokenSourceRouteEvidence || {};
const lowTokenSourceRouteEvidence = {
  ...trialLowTokenSourceRouteEvidence,
  sourceTrialPath: trialInput.path,
  sourceLogSourceDiscoveryLedger,
  sourceLogSourceDiscoveryLedgerReadme,
  counts: {
    logSourceDiscoveryRows: Number(trial.counts?.logSourceDiscoveryRows || 0),
    logSourceDiscoveryMissingRows: Number(trial.counts?.logSourceDiscoveryMissingRows || 0),
    directLogCandidatesReadyForMetadataGate: Number(trial.counts?.directLogCandidatesReadyForMetadataGate || 0),
    lowTokenFallbackRoutesReadyForReview: Number(trial.counts?.lowTokenFallbackRoutesReadyForReview || 0)
  },
  activationGateConsumesSourceRouteEvidence: true,
  gateDoesNotReadLogContents: true,
  gateDoesNotCaptureScreenshots: true,
  gateDoesNotExecuteSoftware: true
};
const lowTokenSourceRouteReady =
  lowTokenSourceRouteEvidence.ledgerReady === true &&
  lowTokenSourceRouteEvidence.reviewOnly === true &&
  lowTokenSourceRouteEvidence.logContentsRead === false &&
  lowTokenSourceRouteEvidence.screenshotsCaptured === false &&
  lowTokenSourceRouteEvidence.softwareActionsExecuted === false &&
  Boolean(sourceLogSourceDiscoveryLedger);

const approvalArgs = [
  "--goal",
  goal,
  "--schedule",
  sourceSchedulePath,
  "--output-dir",
  join(activationDir, "approval-gate")
];
if (teacherConfirmation) approvalArgs.push("--teacher-confirmation", teacherConfirmation);
if (scopeConfirmation) approvalArgs.push("--scope-confirmation", scopeConfirmation);
if (teacherReviewedScope) approvalArgs.push("--teacher-reviewed-scope");
if (rollbackPointCreated) approvalArgs.push("--rollback-point-created");
const approvalGateResult = runNodeScript("create-all-software-recurring-monitor-approval-gate.mjs", approvalArgs);
const approvalGate = readJson(approvalGateResult.gatePath);

let registrationRunnerResult = null;
let registrationRunner = null;
let registrationStatusResult = null;
let registrationStatus = null;
if (approvalGateResult.gatePath) {
  const runnerArgs = [
    "--goal",
    goal,
    "--approval-gate",
    approvalGateResult.gatePath,
    "--output-dir",
    join(activationDir, "registration-runner")
  ];
  if (registrationConfirmation) runnerArgs.push("--teacher-confirmation", registrationConfirmation);
  if (rollbackPointCreated) runnerArgs.push("--rollback-point-created");
  registrationRunnerResult = runNodeScript("run-all-software-recurring-monitor-registration-runner.mjs", runnerArgs);
  registrationRunner = readJson(registrationRunnerResult.runnerPath);

  registrationStatusResult = runNodeScript("verify-all-software-recurring-monitor-registration-status.mjs", [
    "--goal",
    goal,
    "--registration-runner",
    registrationRunnerResult.runnerPath,
    "--output-dir",
    join(activationDir, "registration-status")
  ]);
  registrationStatus = readJson(registrationStatusResult.statusPath);
}

let updatedWorkbenchResult = null;
if (trial.paths?.readinessPackage && trial.paths?.runOutputAudit && trial.paths?.unattendedAudit) {
  updatedWorkbenchResult = runNodeScript("create-all-software-operational-learning-workbench.mjs", [
    "--goal",
    goal,
    "--readiness-package",
    trial.paths.readinessPackage,
    "--schedule",
    sourceSchedulePath,
    "--approval-gate",
    approvalGateResult.gatePath,
    "--registration-runner",
    registrationRunnerResult?.runnerPath || "",
    "--registration-status",
    registrationStatusResult?.statusPath || "",
    "--run-output-audit",
    trial.paths.runOutputAudit,
    "--unattended-audit",
    trial.paths.unattendedAudit,
    "--output-dir",
    join(activationDir, "updated-operational-workbench")
  ]);
}

const blockers = [];
if (trial.status === "manual_operational_trial_blocked_lock_mismatch") blockers.push("source_operational_trial_lock_mismatch");
if (trial.proofBoundary?.manualRunnerLaunched !== true) blockers.push("source_trial_did_not_launch_manual_runner");
if ((trial.counts?.reviewedRunCount || 0) < 1) blockers.push("source_trial_has_no_reviewed_runner_output");
if (!lowTokenSourceRouteReady) blockers.push("source_trial_log_source_discovery_ledger_missing_or_unreviewed");
if (!approvalGate.readyForRegistrationRequest) blockers.push(...(approvalGate.blockers || []));
if (registrationRunner && registrationRunner.status !== "dry_run_ready_for_teacher_review") blockers.push(...(registrationRunner.blockers || []));
if (registrationStatus && registrationStatus.queryResult?.queryChangedSystem !== false) blockers.push("registration_status_query_changed_system");

const dryRunReady =
  approvalGate.readyForRegistrationRequest === true &&
  registrationRunner?.status === "dry_run_ready_for_teacher_review" &&
  registrationStatus?.locks?.statusVerifierDoesNotChangeSystem === true;
const status = dryRunReady
  ? "activation_dry_run_ready_for_teacher_registration_review"
  : "waiting_for_teacher_confirmation_scope_or_rollback_review";

const activationPath = join(activationDir, "all-software-operational-learning-activation-gate.json");
const receiptPath = join(activationDir, "all-software-operational-learning-activation-gate-receipt.json");
const readmePath = join(activationDir, "ALL_SOFTWARE_OPERATIONAL_LEARNING_ACTIVATION_GATE_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  activationGateDoesNotRegisterTask: true,
  approvalGateCreated: true,
  registrationRunnerDryRunOnly: true,
  registrationStatusQueryOnly: true,
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  scheduledTaskUnregistered: false,
  targetSoftwareCommandsExecuted: false,
  softwareActionsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  unattendedAllAppMonitoringComplete: false,
  teacherConfirmationRequiredBeforeSystemChange: true
};
const operationalScope = {
  scopeKind: "teacher_reviewed_operational_low_token_monitor_scope",
  sourceTrialPath: trialInput.path,
  sourceSchedulePath,
  sourceReadinessPackage: trial.paths?.readinessPackage || "",
  sourceRunOutputAudit: trial.paths?.runOutputAudit || "",
  sourceUnattendedAudit: trial.paths?.unattendedAudit || "",
  sourceLogSourceDiscoveryLedger,
  sourceLogSourceDiscoveryLedgerReadme,
  sourceLogSourceDiscoveryRows: lowTokenSourceRouteEvidence.counts.logSourceDiscoveryRows,
  sourceLogSourceDiscoveryMissingRows: lowTokenSourceRouteEvidence.counts.logSourceDiscoveryMissingRows,
  sourceReviewedRunCount: Number(trial.counts?.reviewedRunCount || 0),
  sourceTrialStatus: trial.status || "",
  teacherReviewedScope,
  scopeConfirmationPhrase: scopeConfirmation || "",
  rollbackPointCreated,
  requiresTeacherReviewedScope: teacherReviewedScope
    ? false
    : "Teacher must review the monitored software scope before dry-run registration review."
};

const packet = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_activation_gate_v1",
  activationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  readyForTeacherRegistrationReview: dryRunReady,
  operationalScope,
  sourceTrialStatus: trial.status,
  sourceTrialCounts: trial.counts || {},
  lowTokenSourceRouteEvidence,
  existingAbilitiesReused: [
    "run_all_software_operational_learning_trial",
    "create_all_software_log_source_discovery_ledger",
    "create_all_software_recurring_monitor_approval_gate",
    "run_all_software_recurring_monitor_registration_runner",
    "verify_all_software_recurring_monitor_registration_status",
    "create_all_software_operational_learning_workbench"
  ],
  confirmations: {
    teacherConfirmationMatched: approvalGate.teacherConfirmationMatched === true,
    scopeConfirmationMatched: approvalGate.scopeConfirmationMatched === true,
    registrationConfirmationMatched: registrationRunner?.teacherConfirmedRegistration === true,
    rollbackPointCreated
  },
  paths: {
    activationGate: activationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceTrial: trialInput.path,
    sourceSchedule: sourceSchedulePath,
    sourceLogSourceDiscoveryLedger,
    sourceLogSourceDiscoveryLedgerReadme,
    approvalGate: approvalGateResult.gatePath,
    approvalGateReceipt: approvalGateResult.receiptPath,
    registrationRunner: registrationRunnerResult?.runnerPath || "",
    registrationRunnerReceipt: registrationRunnerResult?.receiptPath || "",
    registrationStatus: registrationStatusResult?.statusPath || "",
    registrationStatusReceipt: registrationStatusResult?.receiptPath || "",
    updatedOperationalWorkbench: updatedWorkbenchResult?.workbenchPath || "",
    updatedOperationalWorkbenchReadme: updatedWorkbenchResult?.readme || ""
  },
  nextSafeStep: dryRunReady
    ? "Review the dry-run registration runner and status verifier. Only after explicit teacher approval may the separate runner wrapper be executed with -Execute."
    : "Supply teacher scope confirmation, recurring monitor confirmation, registration confirmation, and a kept rollback point before any dry-run registration review.",
  blockers: [...new Set(blockers)],
  locks
};

const receipt = {
  ok: true,
  format: "transparent_ai_all_software_operational_learning_activation_gate_receipt_v1",
  activationId,
  status,
  readyForTeacherRegistrationReview: dryRunReady,
  operationalScope,
  lowTokenSourceRouteEvidence,
  sourceTrial: trialInput.path,
  approvalGateCreated: true,
  registrationRunnerCreated: Boolean(registrationRunnerResult?.runnerPath),
  registrationStatusQueried: Boolean(registrationStatusResult?.statusPath),
  scheduledTaskRegistered: false,
  scheduledTaskStarted: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  blockers: packet.blockers,
  locks
};

writeFileSync(activationPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_operational_learning_activation_gate_result_v1",
      activationId,
      status,
      readyForTeacherRegistrationReview: dryRunReady,
      operationalScope,
      activationGatePath: activationPath,
      receiptPath,
      readme: readmePath,
      approvalGatePath: approvalGateResult.gatePath,
      registrationRunnerPath: registrationRunnerResult?.runnerPath || "",
      registrationStatusPath: registrationStatusResult?.statusPath || "",
      updatedOperationalWorkbenchPath: updatedWorkbenchResult?.workbenchPath || "",
      blockers: packet.blockers.length,
      scheduledTaskRegistered: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      longTermMemoryWritten: false,
      nativeUniversalExecution: false,
      locks
    },
    null,
    2
  )
);
