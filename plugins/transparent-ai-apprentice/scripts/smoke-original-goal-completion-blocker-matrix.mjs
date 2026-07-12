#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-matrix-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const statusConsolePath = writeJson(join(smokeRoot, "status", "all-software-operational-status-console.json"), {
  format: "transparent_ai_all_software_operational_status_console_v1",
  status: "all_software_status_waiting_for_registration_or_manual_runner_evidence",
  rows: [],
  locks: {
    statusConsoleReadOnly: true,
    goalComplete: false
  }
});

const gapBoardPath = writeJson(join(smokeRoot, "gap", "original-goal-gap-action-board.json"), {
  format: "transparent_ai_original_goal_gap_action_board_v1",
  status: "waiting_for_teacher_gap_review",
  actionRows: [],
  locks: {
    boardDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
});

const triagePath = writeJson(join(smokeRoot, "triage", "original-goal-next-action-triage.json"), {
  format: "transparent_ai_original_goal_next_action_triage_v1",
  status: "waiting_for_teacher_reviewed_next_action",
  rows: [],
  locks: {
    goalComplete: false
  }
});

const budgetPlanPath = writeJson(join(smokeRoot, "budget", "low-token-trigger-budget-plan.json"), {
  format: "transparent_ai_low_token_trigger_budget_plan_v1",
  status: "waiting_for_teacher_low_token_trigger_budget_review",
  selectedActionCount: 0,
  selectedEstimatedTokenCost: 0,
  selectedActions: [],
  locks: {
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    longTermMemoryWritten: false
  }
});

const visualBuilderPath = writeJson(join(smokeRoot, "visual", "triggered-visual-check-command-builder.json"), {
  format: "transparent_ai_triggered_visual_check_command_builder_v1",
  status: "waiting_for_teacher_visual_check_queue_path",
  requestKind: "queue_not_loaded_yet",
  requestCount: 0,
  locks: {
    builderDoesNotRunCapture: true,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false
  }
});

const spatialRehearsalPath = writeJson(join(smokeRoot, "spatial", "transparent-sketch-depth-demonstration-rehearsal.json"), {
  format: "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1",
  status: "waiting_for_teacher_numbered_spatial_target_confirmation",
  reviewLocks: {
    rehearsalDoesNotExecuteSoftware: true,
    rehearsalDoesNotCaptureScreenshots: true,
    rehearsalDoesNotWriteMemory: true
  }
});

const voiceCapabilityPath = writeJson(join(smokeRoot, "voice", "non-expert-engineering-voice-control-capability.json"), {
  format: "transparent_ai_non_expert_engineering_voice_control_capability_v1",
  status: "waiting_for_teacher_numbered_target_confirmation"
});

const rollbackPath = writeJson(join(smokeRoot, "rollback", "rollback-point.json"), {
  format: "transparent_ai_rollback_point_v1",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const lowTokenCoverageDossierPath = writeJson(join(smokeRoot, "coverage", "original-goal-low-token-coverage-evidence-dossier.json"), {
  format: "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1",
  status: "waiting_for_teacher_low_token_coverage_review",
  counts: {
    ledgerRows: 3,
    readyForTeacherCoverageReview: 1,
    waitingForLowTokenEvidence: 2,
    nextReviewRows: 2
  },
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    dossierDoesNotRunCoverageTools: true,
    dossierDoesNotExecuteTargetSoftware: true,
    dossierDoesNotCaptureScreenshots: true,
    dossierDoesNotWriteMemory: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const refreshPath = writeJson(join(smokeRoot, "refresh", "original-goal-current-status-refresh.json"), {
  ok: true,
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  refreshId: "smoke-completion-blocker-matrix",
  goal: "Smoke original-goal completion blocker matrix.",
  completionDecision: "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven",
  nextSafeAction: "Open original-goal-teacher-action-router.html and follow the shortest teacher-action route before any downstream action.",
  paths: {
    refresh: "",
    operationalStatusConsole: statusConsolePath,
    gapActionBoard: gapBoardPath,
    nextActionTriage: triagePath,
    lowTokenTriggerBudgetPlan: budgetPlanPath,
    originalGoalLowTokenCoverageEvidenceDossier: lowTokenCoverageDossierPath,
    triggeredVisualCheckCommandBuilder: visualBuilderPath,
    transparentSketchDepthDemonstrationRehearsal: spatialRehearsalPath,
    nonExpertEngineeringVoiceControlCapability: voiceCapabilityPath,
    spatialIntentEvidenceRequest: join(smokeRoot, "spatial", "spatial-intent-evidence-request.json"),
    spatialIntentEvidenceReceiptBuilder: join(smokeRoot, "spatial", "spatial-intent-evidence-receipt-builder.json"),
    rollbackPointManifest: rollbackPath,
    numberedTargetConfirmCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\confirm-engineering-command-target.mjs --selection __SELECTED_NUMBER__"
  },
  refreshedEvidence: {
    statusConsoleStatus: "all_software_status_waiting_for_registration_or_manual_runner_evidence",
    gapActionRows: 0,
    nextActionTriageRows: 0,
    lowTokenTriggerBudgetPlanSelectedActionCount: 0,
    nonExpertNumberedTargetConfirmationReady: false,
    nonExpertExecutionStillRequiresTeacherConfirmedNumber: true,
    formalSpatialIntentEvidencePresent: false
  },
  discoveredEvidence: {
    triggeredVisualCaptureCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\capture-triggered-visual-check.mjs --request \"<automatic-triggered-visual-check-queue.json>\" --selected-request-id \"<teacher-reviewed-id>\" --teacher-confirmed \"true\"",
    spatialIntentEvidenceReceiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --request \"<spatial-intent-evidence-request.json>\" --receipt \"<teacher-filled-spatial-intent-evidence-receipt.json>\"",
    executionApprovedGateRunnerCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-execution-approved-gate-runner.mjs --gate \"<ready-real-local-execution-approval-gate.json>\" --execute-approved-gate \"true\""
  },
  blockedClaims: ["claim_original_goal_complete_from_current_status_refresh"],
  locks: {
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const result = runScript("create-original-goal-completion-blocker-matrix.mjs", [
  "--status-refresh",
  refreshPath,
  "--output-dir",
  join(smokeRoot, "matrix")
]);
const matrix = readJson(result.matrixPath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");
const lowTokenCoverageLane = matrix.rows.find((row) => row.lane === "all_software_low_token_coverage_evidence");
const unattendedLane = matrix.rows.find((row) => row.lane === "unattended_operational_monitor_evidence");
const visualLane = matrix.rows.find((row) => row.lane === "teacher_reviewed_triggered_visual_evidence_path");
const spatialLane = matrix.rows.find((row) => row.lane === "transparent_sketch_spatial_intent_teacher_export");
const voiceLane = matrix.rows.find((row) => row.lane === "voice_text_numbered_confirmation_supervised_execution_gate");
const executionLane = matrix.rows.find((row) => row.lane === "universal_native_execution_control_channel");
const ruleDslAuditLane = matrix.rows.find((row) => row.lane === "rule_dsl_delivery_gate_audit");

const readyAuditPath = writeJson(join(smokeRoot, "rag", "rag-delivery-gate-audit-trail.json"), {
  format: "transparent_ai_rag_delivery_gate_audit_trail_v1",
  status: "audit_trail_ready_for_teacher_review",
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    softwareActionsExecuted: false,
    packagingUnlocked: false
  }
});
const readyRefresh = readJson(refreshPath);
readyRefresh.paths.ruleDslDeliveryGateAudit = readyAuditPath;
readyRefresh.refreshedEvidence.ruleDslDeliveryGateAuditReady = true;
readyRefresh.refreshedEvidence.ruleDslDeliveryGateAuditStatus = "audit_trail_ready_for_teacher_review";
const readyRefreshPath = writeJson(join(smokeRoot, "refresh", "original-goal-current-status-refresh-with-rag-audit.json"), readyRefresh);
const readyResult = runScript("create-original-goal-completion-blocker-matrix.mjs", [
  "--status-refresh",
  readyRefreshPath,
  "--output-dir",
  join(smokeRoot, "ready-matrix")
]);
const readyMatrix = readJson(readyResult.matrixPath);
const readyRuleDslAuditLane = readyMatrix.rows.find((row) => row.lane === "rule_dsl_delivery_gate_audit");

const requiredLanes = [
  "all_software_low_token_coverage_evidence",
  "unattended_operational_monitor_evidence",
  "universal_native_execution_control_channel",
  "teacher_reviewed_triggered_visual_evidence_path",
  "transparent_sketch_spatial_intent_teacher_export",
  "voice_text_numbered_confirmation_supervised_execution_gate",
  "rule_dsl_delivery_gate_audit",
  "rollback_evidence_before_system_change"
];

const checks = [
  check(
    "Completion blocker matrix creates explicit lanes even when gap board has zero rows",
    result.format === "transparent_ai_original_goal_completion_blocker_matrix_result_v1" &&
      matrix.format === "transparent_ai_original_goal_completion_blocker_matrix_v1" &&
      matrix.status === "waiting_for_teacher_completion_blocker_review" &&
      requiredLanes.every((lane) => matrix.rows.some((row) => row.lane === lane)) &&
      matrix.counts.rows === requiredLanes.length &&
      matrix.counts.gapRows === 0 &&
      matrix.counts.triageRows === 0,
    result.matrixPath
  ),
  check(
    "Completion blocker matrix preserves review-only and no-system-change locks",
    matrix.locks.matrixDoesNotRegisterTask === true &&
      matrix.locks.matrixDoesNotLaunchRunner === true &&
      matrix.locks.matrixDoesNotExecuteTargetSoftware === true &&
      matrix.locks.matrixDoesNotCaptureScreenshots === true &&
      matrix.locks.matrixDoesNotWriteMemory === true &&
      matrix.locks.goalComplete === false &&
      matrix.rows.every(
        (row) =>
          row.locks.accepted === false &&
          row.locks.ruleEnabled === false &&
          row.locks.technologyAccepted === false &&
          row.locks.packagingGated === true &&
          row.locks.goalComplete === false
      ),
    JSON.stringify(matrix.locks)
  ),
  check(
    "Completion blocker matrix routes low-token coverage lane through the evidence dossier",
    lowTokenCoverageLane?.currentEvidence?.includes("coverageDossier=waiting_for_teacher_low_token_coverage_review") &&
      lowTokenCoverageLane?.currentEvidence?.includes("waitingRows=2") &&
      lowTokenCoverageLane?.nextSafeAction?.includes("Open the log-source discovery ledger") &&
      lowTokenCoverageLane?.nextSafeAction?.includes("low-token coverage evidence dossier") &&
      lowTokenCoverageLane?.verifierCommand?.includes("create-original-goal-low-token-coverage-evidence-dossier.mjs") &&
      lowTokenCoverageLane?.sourcePaths?.includes(lowTokenCoverageDossierPath),
    JSON.stringify(lowTokenCoverageLane)
  ),
  check(
    "Completion blocker matrix keeps recurring monitor status verifier waiting for teacher-reviewed runner evidence",
    unattendedLane?.verifierCommand?.includes("verify-all-software-recurring-monitor-registration-status.mjs") &&
      unattendedLane?.verifierCommand?.includes("--registration-runner") &&
      unattendedLane?.verifierCommand?.includes("<teacher-reviewed-recurring-monitor-registration-runner.json>") &&
      unattendedLane?.locks?.matrixDoesNotRegisterTask === true &&
      unattendedLane?.locks?.matrixDoesNotLaunchRunner === true,
    JSON.stringify(unattendedLane)
  ),
  check(
    "Completion blocker matrix reuses current-status command templates from paths or discovered evidence",
    visualLane?.verifierCommand?.includes("capture-triggered-visual-check.mjs") &&
      visualLane?.verifierCommand?.includes("--selected-request-id") &&
      spatialLane?.verifierCommand?.includes("validate-spatial-intent-evidence-receipt.mjs") &&
      spatialLane?.verifierCommand?.includes("<teacher-filled-spatial-intent-evidence-receipt.json>") &&
      voiceLane?.verifierCommand?.includes("confirm-engineering-command-target.mjs") &&
      voiceLane?.verifierCommand?.includes("__SELECTED_NUMBER__") &&
      executionLane?.verifierCommand?.includes("run-all-software-execution-approved-gate-runner.mjs") &&
      executionLane?.verifierCommand?.includes("--execute-approved-gate"),
    JSON.stringify({
      visual: visualLane?.verifierCommand,
      spatial: spatialLane?.verifierCommand,
      voice: voiceLane?.verifierCommand,
      execution: executionLane?.verifierCommand
    })
  ),
  check(
    "Completion blocker matrix routes Rule DSL delivery-gate audit through the RAG audit trail builder",
    ruleDslAuditLane?.currentEvidence?.includes("auditStatus=missing_rule_dsl_delivery_gate_audit_trail") &&
      ruleDslAuditLane?.verifierCommand?.includes("knowledge\\create-rag-delivery-gate-audit-trail.mjs") &&
      ruleDslAuditLane?.verifierCommand?.includes("--delivery-gate") &&
      ruleDslAuditLane?.verifierCommand?.includes("<rag-validation-report-delivery-gate.json>") &&
      ruleDslAuditLane?.verifierCommand?.includes("--teacher-reviewed") &&
      ruleDslAuditLane?.blockedClaims?.includes("claim_rule_dsl_delivery_gate_audit_ready_without_audit_trail") &&
      ruleDslAuditLane?.locks?.matrixDoesNotEnableRules === true &&
      ruleDslAuditLane?.locks?.matrixDoesNotExecuteTargetSoftware === true,
    JSON.stringify(ruleDslAuditLane)
  ),
  check(
    "Completion blocker matrix routes ready Rule DSL delivery-gate audit into audit review receipt builder",
    readyRuleDslAuditLane?.currentEvidence?.includes("auditStatus=audit_trail_ready_for_teacher_review") &&
      readyRuleDslAuditLane?.currentEvidence?.includes("auditReady=true") &&
      readyRuleDslAuditLane?.missingProof?.includes("teacher review receipt") &&
      readyRuleDslAuditLane?.nextSafeAction?.includes("audit review receipt builder") &&
      readyRuleDslAuditLane?.verifierCommand?.includes("knowledge\\create-rag-delivery-gate-audit-review-receipt-builder.mjs") &&
      readyRuleDslAuditLane?.verifierCommand?.includes("--audit-trail") &&
      readyRuleDslAuditLane?.verifierCommand?.includes(readyAuditPath) &&
      !readyRuleDslAuditLane?.verifierCommand?.includes("<rag-validation-report-delivery-gate.json>") &&
      !readyRuleDslAuditLane?.verifierCommand?.includes("<retained-rollback-point-dir>"),
    JSON.stringify(readyRuleDslAuditLane)
  ),
  check(
    "Completion blocker matrix produces teacher-readable HTML and README",
    existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      html.includes("Original Goal Completion Blocker Matrix") &&
      html.includes("all_software_low_token_coverage_evidence") &&
      html.includes("rule_dsl_delivery_gate_audit") &&
      html.includes("does not register tasks") &&
      readme.includes("cannot be used as acceptance"),
    result.htmlPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const summary = {
  ok: passed === checks.length,
  format: "transparent_ai_original_goal_completion_blocker_matrix_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  matrixPath: result.matrixPath,
  htmlPath: result.htmlPath,
  readmePath: result.readmePath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
