#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(scriptName, args, options = {}) {
  const result = spawnSync(process.execPath, [join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: options.timeout ?? 180000,
    maxBuffer: 40 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function assertCheck(checks, name, pass, evidence) {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const outputRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-request-runner-smoke", String(Date.now()))
);
mkdirSync(outputRoot, { recursive: true });

const safeRequestPath = join(outputRoot, "safe-lane-request.json");
const safeRequest = {
  format: "transparent_ai_original_goal_completion_blocker_lane_command_request_v1",
  generatedBy: "smoke",
  queuePath: join(outputRoot, "queue.json"),
  lane: "rollback_evidence_before_system_change",
  itemNumber: 1,
  status: "ready_for_review_only_manual_follow_up",
  nextSafeAction: "Create a rollback point before any next change.",
  commandTemplate:
    'node plugins\\transparent-ai-apprentice\\scripts\\create-rollback-point.mjs --label "smoke-completion-blocker-lane-runner" --path "package.json"',
  command:
    'node plugins\\transparent-ai-apprentice\\scripts\\create-rollback-point.mjs --label "smoke-completion-blocker-lane-runner" --path "package.json"',
  missingInputs: [],
  replacements: {},
  teacherNote: "teacher confirmed completion blocker lane for smoke",
  rollbackPoint: "smoke-retained-rollback-point",
  gated: false,
  evidenceLinks: [],
  blockedClaims: [],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
};
writeFileSync(safeRequestPath, `${JSON.stringify(safeRequest, null, 2)}\n`, "utf8");

const coverageLedgerPath = join(outputRoot, "coverage-enrollment-ledger.json");
writeFileSync(
  coverageLedgerPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
      counts: { totalInventoryRows: 2 },
      rows: [
        {
          ledgerNumber: 1,
          software: "ExampleCAD",
          processName: "examplecad.exe",
          status: "waiting_for_watch_evidence",
          candidateLogFileCount: 1,
          watchEvidenceCount: 0
        },
        {
          ledgerNumber: 2,
          software: "ExampleCAM",
          processName: "examplecam.exe",
          status: "with_watch_evidence",
          readyForTeacherCoverageReview: true,
          candidateLogFileCount: 1,
          watchEvidenceCount: 1
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);
const coverageRefreshPath = join(outputRoot, "coverage-status-refresh.json");
writeFileSync(
  coverageRefreshPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_current_status_refresh_v1",
      goal: "fixture all software low-token coverage status",
      paths: {
        coverageEnrollmentLedger: coverageLedgerPath
      },
      discoveredEvidence: {},
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const coverageRequestPath = join(outputRoot, "low-token-coverage-dossier-lane-request.json");
const coverageRequest = {
  ...safeRequest,
  lane: "all_software_low_token_coverage_evidence",
  itemNumber: 2,
  status: "ready_for_review_only_manual_follow_up",
  nextSafeAction: "Open the low-token coverage evidence dossier and review waiting rows.",
  commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\create-original-goal-low-token-coverage-evidence-dossier.mjs --status-refresh "${coverageRefreshPath}"`,
  command: `node plugins\\transparent-ai-apprentice\\scripts\\create-original-goal-low-token-coverage-evidence-dossier.mjs --status-refresh "${coverageRefreshPath}"`,
  teacherNote: "teacher confirmed completion blocker lane for low-token coverage dossier",
  blockedClaims: ["claim_all_software_low_token_coverage_complete"],
  gated: false
};
writeFileSync(coverageRequestPath, `${JSON.stringify(coverageRequest, null, 2)}\n`, "utf8");

const monitorRegistrationRunnerPath = join(outputRoot, "recurring-monitor-registration-runner.json");
const monitorTaskName = `TransparentAiCompletionBlockerRunnerSmoke-${Date.now()}`;
writeFileSync(
  monitorRegistrationRunnerPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
      status: "smoke_runner_not_registered",
      taskName: monitorTaskName,
      expectedScheduledRunnerPath: join(outputRoot, "not-registered-recurring-monitor-runner.ps1"),
      registerCommand: {
        scriptPath: join(outputRoot, "not-run-register-recurring-monitor.ps1")
      },
      unregisterCommand: {
        scriptPath: join(outputRoot, "not-run-unregister-recurring-monitor.ps1")
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        scheduledTaskRegistered: false,
        runnerLaunched: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
const monitorRequestPath = join(outputRoot, "unattended-monitor-status-lane-request.json");
const monitorRequest = {
  ...safeRequest,
  lane: "unattended_operational_monitor_evidence",
  itemNumber: 3,
  status: "ready_for_review_only_manual_follow_up",
  nextSafeAction: "Verify a teacher-reviewed recurring monitor registration runner without changing Scheduled Tasks.",
  commandTemplate:
    'node plugins\\transparent-ai-apprentice\\scripts\\verify-all-software-recurring-monitor-registration-status.mjs --registration-runner "<teacher-reviewed-recurring-monitor-registration-runner.json>"',
  command: `node plugins\\transparent-ai-apprentice\\scripts\\verify-all-software-recurring-monitor-registration-status.mjs --registration-runner "${monitorRegistrationRunnerPath}"`,
  teacherNote: "teacher confirmed completion blocker lane for recurring monitor status verifier",
  blockedClaims: ["claim_unattended_learning_operational"],
  gated: false
};
writeFileSync(monitorRequestPath, `${JSON.stringify(monitorRequest, null, 2)}\n`, "utf8");

const deliveryGateSmoke = runScript(join("smoke", "smoke-rag-validation-report-delivery-gate.mjs"), []);
const ragDeliveryGatePath = deliveryGateSmoke.gatePath;
const ragAuditRollbackPoint = join(outputRoot, "rag-audit-retained-rollback-point");
mkdirSync(ragAuditRollbackPoint, { recursive: true });
writeFileSync(
  join(ragAuditRollbackPoint, "rollback-point.json"),
  `${JSON.stringify(
    {
      format: "transparent_ai_rollback_point_result_v1",
      rollbackId: "completion-blocker-lane-rag-audit-smoke",
      status: "waiting_for_teacher_confirmation",
      deleteOnlyAfterTeacherConfirmation: true
    },
    null,
    2
  )}\n`,
  "utf8"
);
const ragAuditRequestPath = join(outputRoot, "rule-dsl-delivery-gate-audit-lane-request.json");
const ragAuditRequest = {
  ...safeRequest,
  lane: "rule_dsl_delivery_gate_audit",
  itemNumber: 4,
  status: "ready_for_review_only_manual_follow_up",
  nextSafeAction: "Create the RAG delivery-gate audit trail after teacher-reviewed closed gate and rollback evidence.",
  commandTemplate:
    'node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-trail.mjs --delivery-gate "<rag-validation-report-delivery-gate.json>" --rollback-point "<retained-rollback-point-dir>" --teacher-reviewed',
  command: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-trail.mjs --delivery-gate "${ragDeliveryGatePath}" --rollback-point "${ragAuditRollbackPoint}" --teacher-reviewed`,
  teacherNote: "teacher confirmed completion blocker lane for rule DSL delivery gate audit",
  blockedClaims: [
    "claim_rule_dsl_delivery_gate_audit_ready_without_audit_trail",
    "claim_rag_research_acceptance_from_delivery_allowed",
    "claim_original_goal_complete"
  ],
  gated: false
};
writeFileSync(ragAuditRequestPath, `${JSON.stringify(ragAuditRequest, null, 2)}\n`, "utf8");

const missingRagAuditRequestPath = join(outputRoot, "missing-rule-dsl-delivery-gate-audit-lane-request.json");
const missingRagAuditRequest = {
  ...ragAuditRequest,
  commandTemplate:
    'node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-trail.mjs --delivery-gate "<rag-validation-report-delivery-gate.json>" --rollback-point "<retained-rollback-point-dir>" --teacher-reviewed',
  command:
    'node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-trail.mjs --delivery-gate "<rag-validation-report-delivery-gate.json>" --rollback-point "<retained-rollback-point-dir>" --teacher-reviewed',
  missingInputs: ["<rag-validation-report-delivery-gate.json>", "<retained-rollback-point-dir>"],
  hasPlaceholders: true,
  placeholderReplacementRequired: true
};
writeFileSync(missingRagAuditRequestPath, `${JSON.stringify(missingRagAuditRequest, null, 2)}\n`, "utf8");

const missingMonitorRequestPath = join(outputRoot, "missing-monitor-status-lane-request.json");
const missingMonitorRequest = {
  ...monitorRequest,
  commandTemplate:
    "node plugins\\transparent-ai-apprentice\\scripts\\verify-all-software-recurring-monitor-registration-status.mjs",
  command: "node plugins\\transparent-ai-apprentice\\scripts\\verify-all-software-recurring-monitor-registration-status.mjs",
  missingInputs: ["<teacher-reviewed-recurring-monitor-registration-runner.json>"]
};
writeFileSync(missingMonitorRequestPath, `${JSON.stringify(missingMonitorRequest, null, 2)}\n`, "utf8");

const gatedRequestPath = join(outputRoot, "gated-lane-request.json");
const gatedRequest = {
  ...safeRequest,
  lane: "teacher_reviewed_triggered_visual_evidence_path",
  itemNumber: 3,
  status: "gated_until_teacher_receipt_and_rollback",
  commandTemplate:
    'node plugins\\transparent-ai-apprentice\\scripts\\capture-triggered-visual-check.mjs --selected-request-id "<teacher-reviewed-automatic-visual-check-id>"',
  command:
    'node plugins\\transparent-ai-apprentice\\scripts\\capture-triggered-visual-check.mjs --selected-request-id "<teacher-reviewed-automatic-visual-check-id>"',
  missingInputs: ["<teacher-reviewed-automatic-visual-check-id>"],
  gated: true
};
writeFileSync(gatedRequestPath, `${JSON.stringify(gatedRequest, null, 2)}\n`, "utf8");

const numberedPlaceholderRequestPath = join(outputRoot, "numbered-placeholder-lane-request.json");
const numberedPlaceholderRequest = {
  ...safeRequest,
  lane: "voice_text_numbered_confirmation_supervised_execution_gate",
  itemNumber: 5,
  status: "waiting_for_placeholder_replacement",
  commandTemplate:
    "node plugins\\transparent-ai-apprentice\\scripts\\confirm-engineering-command-target.mjs --confirmation \"numbered-target-confirmation.json\" --selected-number \"__SELECTED_NUMBER__\"",
  command:
    "node plugins\\transparent-ai-apprentice\\scripts\\confirm-engineering-command-target.mjs --confirmation \"numbered-target-confirmation.json\" --selected-number \"__SELECTED_NUMBER__\"",
  missingInputs: ["__SELECTED_NUMBER__"],
  hasPlaceholders: true,
  placeholderReplacementRequired: true,
  gated: false
};
writeFileSync(numberedPlaceholderRequestPath, `${JSON.stringify(numberedPlaceholderRequest, null, 2)}\n`, "utf8");

const safeRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  safeRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--teacher-confirmation",
  "teacher confirmed completion blocker lane",
  "--rollback-point-created",
  "--rollback-point",
  "smoke-retained-rollback-point",
  "--output-dir",
  join(outputRoot, "safe-run")
]);
const safeRunPacket = readJson(safeRun.runPath);
const safeReceipt = readJson(safeRun.receiptPath);

const coverageRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  coverageRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--teacher-confirmation",
  "teacher confirmed completion blocker lane",
  "--rollback-point-created",
  "--rollback-point",
  "smoke-retained-rollback-point",
  "--output-dir",
  join(outputRoot, "coverage-dossier-run")
]);
const coverageRunPacket = readJson(coverageRun.runPath);
const coverageChildResult = readJson(coverageRun.generatedEvidence.safeScriptResultPath);

const monitorRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  monitorRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--teacher-confirmation",
  "teacher confirmed completion blocker lane",
  "--rollback-point-created",
  "--rollback-point",
  "smoke-retained-rollback-point",
  "--output-dir",
  join(outputRoot, "unattended-monitor-status-run")
]);
const monitorRunPacket = readJson(monitorRun.runPath);
const monitorChildResult = readJson(monitorRun.generatedEvidence.safeScriptResultPath);

const ragAuditRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  ragAuditRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--teacher-confirmation",
  "teacher confirmed completion blocker lane",
  "--rollback-point-created",
  "--rollback-point",
  ragAuditRollbackPoint,
  "--output-dir",
  join(outputRoot, "rule-dsl-delivery-gate-audit-run")
]);
const ragAuditRunPacket = readJson(ragAuditRun.runPath);
const ragAuditChildResult = readJson(ragAuditRun.generatedEvidence.safeScriptResultPath);

const missingMonitorRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  missingMonitorRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--teacher-confirmation",
  "teacher confirmed completion blocker lane",
  "--rollback-point-created",
  "--rollback-point",
  "smoke-retained-rollback-point",
  "--output-dir",
  join(outputRoot, "missing-unattended-monitor-status-run")
]);

const missingRagAuditRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  missingRagAuditRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--teacher-confirmation",
  "teacher confirmed completion blocker lane",
  "--rollback-point-created",
  "--rollback-point",
  "smoke-retained-rollback-point",
  "--output-dir",
  join(outputRoot, "missing-rule-dsl-delivery-gate-audit-run")
]);

const gatedRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  gatedRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--teacher-confirmation",
  "teacher confirmed completion blocker lane",
  "--rollback-point-created",
  "--rollback-point",
  "smoke-retained-rollback-point",
  "--output-dir",
  join(outputRoot, "gated-run")
]);

const numberedPlaceholderRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  numberedPlaceholderRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--teacher-confirmation",
  "teacher confirmed completion blocker lane",
  "--rollback-point-created",
  "--rollback-point",
  "smoke-retained-rollback-point",
  "--output-dir",
  join(outputRoot, "numbered-placeholder-run")
]);

const missingConfirmationRun = runScript("run-original-goal-completion-blocker-lane-request.mjs", [
  "--request",
  safeRequestPath,
  "--run-reviewed-lane",
  "--allow-safe-lane-runner",
  "--output-dir",
  join(outputRoot, "missing-confirmation-run")
]);

const checks = [];
assertCheck(
  checks,
  "Completion blocker lane request runner invokes one allowlisted safe lane",
  safeRun.status === "completed_review_only_completion_blocker_lane_safe_step" &&
    safeRun.safeScriptInvoked === true &&
    existsSync(safeRun.generatedEvidence.safeScriptResultPath || "") &&
    safeRun.selectedLane.lane === "rollback_evidence_before_system_change",
  JSON.stringify({ runPath: safeRun.runPath, receiptPath: safeRun.receiptPath })
);
assertCheck(
  checks,
  "Completion blocker lane request runner invokes low-token coverage dossier lane",
  coverageRun.status === "completed_review_only_completion_blocker_lane_safe_step" &&
    coverageRun.safeScriptInvoked === true &&
    coverageRun.selectedLane.lane === "all_software_low_token_coverage_evidence" &&
    coverageRun.generatedEvidence.childFormat ===
      "transparent_ai_original_goal_low_token_coverage_evidence_dossier_result_v1" &&
    existsSync(coverageRun.generatedEvidence.childPath || "") &&
    coverageChildResult.locks?.dossierDoesNotRunCoverageTools === true &&
    coverageChildResult.locks?.dossierDoesNotExecuteTargetSoftware === true &&
    coverageChildResult.locks?.dossierDoesNotWriteMemory === true &&
    coverageRunPacket.locks.goalComplete === false,
  JSON.stringify({
    runPath: coverageRun.runPath,
    dossierPath: coverageRun.generatedEvidence.childPath
  })
);
assertCheck(
  checks,
  "Completion blocker lane request runner invokes read-only recurring monitor registration status verifier",
  monitorRun.status === "completed_review_only_completion_blocker_lane_safe_step" &&
    monitorRun.safeScriptInvoked === true &&
    monitorRun.selectedLane.lane === "unattended_operational_monitor_evidence" &&
    monitorRun.generatedEvidence.childFormat ===
      "transparent_ai_all_software_recurring_monitor_registration_status_result_v1" &&
    existsSync(monitorRun.generatedEvidence.childPath || "") &&
    monitorChildResult.status === "verified_not_registered_yet" &&
    monitorChildResult.locks?.statusVerifierDoesNotChangeSystem === true &&
    monitorChildResult.locks?.scheduledTaskQueryOnly === true &&
    monitorChildResult.locks?.registerTaskCalled === false &&
    monitorChildResult.locks?.startTaskCalled === false &&
    monitorRunPacket.locks.laneRunnerDoesNotRegisterSchedule === true &&
    monitorRunPacket.locks.goalComplete === false,
  JSON.stringify({
    runPath: monitorRun.runPath,
    statusPath: monitorRun.generatedEvidence.childPath,
    taskName: monitorTaskName
  })
);
assertCheck(
  checks,
  "Completion blocker lane request runner invokes Rule DSL delivery-gate audit trail lane",
  ragAuditRun.status === "completed_review_only_completion_blocker_lane_safe_step" &&
    ragAuditRun.safeScriptInvoked === true &&
    ragAuditRun.selectedLane.lane === "rule_dsl_delivery_gate_audit" &&
    ragAuditRun.generatedEvidence.childFormat === "transparent_ai_rag_delivery_gate_audit_trail_v1" &&
    existsSync(ragAuditRun.generatedEvidence.childPath || "") &&
    ragAuditChildResult.status === "audit_trail_ready_for_teacher_review" &&
    ragAuditChildResult.locks?.ruleEnabled === false &&
    ragAuditChildResult.locks?.softwareActionsExecuted === false &&
    ragAuditChildResult.locks?.externalFetchPerformed === false &&
    ragAuditChildResult.locks?.packagingUnlocked === false &&
    ragAuditRunPacket.locks.laneRunnerDoesNotExecuteTargetSoftware === true &&
    ragAuditRunPacket.locks.laneRunnerDoesNotWriteMemory === true &&
    ragAuditRunPacket.locks.goalComplete === false,
  JSON.stringify({
    runPath: ragAuditRun.runPath,
    auditPath: ragAuditRun.generatedEvidence.childPath
  })
);
assertCheck(
  checks,
  "Completion blocker lane request runner blocks Rule DSL delivery-gate audit placeholders",
  missingRagAuditRun.status === "blocked_before_completion_blocker_lane_runner" &&
    missingRagAuditRun.blockReason.includes("request_placeholder_replacement_required") &&
    missingRagAuditRun.blockReason.includes("request_command_contains_unresolved_placeholders") &&
    missingRagAuditRun.blockReason.includes("missing_rag_delivery_gate_for_rule_dsl_audit_runner") &&
    missingRagAuditRun.blockReason.includes("missing_retained_rollback_point_for_rule_dsl_audit_runner") &&
    missingRagAuditRun.safeScriptInvoked === false,
  JSON.stringify(missingRagAuditRun.blockReason)
);
assertCheck(
  checks,
  "Completion blocker lane request runner blocks recurring monitor status verifier without runner evidence",
  missingMonitorRun.status === "blocked_before_completion_blocker_lane_runner" &&
    missingMonitorRun.blockReason.includes("missing_registration_runner_for_recurring_monitor_status_verifier") &&
    missingMonitorRun.safeScriptInvoked === false,
  JSON.stringify(missingMonitorRun.blockReason)
);
assertCheck(
  checks,
  "Completion blocker lane request runner writes locked receipt evidence",
  safeRunPacket.locks.laneRunnerDoesNotRunArbitraryCommandString === true &&
    safeRunPacket.locks.laneRunnerWhitelistOnly === true &&
    safeRunPacket.locks.laneRunnerDoesNotExecuteTargetSoftware === true &&
    safeRunPacket.locks.laneRunnerDoesNotWriteMemory === true &&
    safeRunPacket.locks.goalComplete === false &&
    safeReceipt.goalComplete === false &&
    safeReceipt.memoryWritten === false,
  JSON.stringify(safeReceipt).slice(0, 800)
);
assertCheck(
  checks,
  "Completion blocker lane request runner blocks gated or unresolved visual lanes",
  gatedRun.status === "blocked_before_completion_blocker_lane_runner" &&
    gatedRun.blockReason.includes("selected_completion_blocker_lane_is_gated_until_teacher_receipt_and_rollback") &&
    gatedRun.blockReason.includes("unresolved_placeholders") &&
    gatedRun.safeScriptInvoked === false,
  JSON.stringify(gatedRun.blockReason)
);
assertCheck(
  checks,
  "Completion blocker lane request runner blocks numbered confirmation placeholders before safe script invocation",
  numberedPlaceholderRun.status === "blocked_before_completion_blocker_lane_runner" &&
    numberedPlaceholderRun.blockReason.includes("request_placeholder_replacement_required") &&
    numberedPlaceholderRun.blockReason.includes("request_declares_unresolved_placeholders") &&
    numberedPlaceholderRun.blockReason.includes("request_missing_inputs_not_resolved") &&
    numberedPlaceholderRun.blockReason.includes("request_command_contains_unresolved_placeholders") &&
    numberedPlaceholderRun.safeScriptInvoked === false,
  JSON.stringify(numberedPlaceholderRun.blockReason)
);
assertCheck(
  checks,
  "Completion blocker lane request runner requires teacher confirmation and rollback evidence",
  missingConfirmationRun.status === "blocked_before_completion_blocker_lane_runner" &&
    missingConfirmationRun.blockReason.includes("missing_teacher_completion_blocker_lane_confirmation") &&
    missingConfirmationRun.blockReason.includes("rollback_point_not_confirmed_for_completion_blocker_lane") &&
    missingConfirmationRun.safeScriptInvoked === false,
  JSON.stringify(missingConfirmationRun.blockReason)
);

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      passed: checks.length - failed.length,
      total: checks.length,
      outputRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
