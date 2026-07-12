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
    : join(process.cwd(), "artifacts", "original-goal-unlock-action-package-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const existing = {
  teacherContract: writeJson(join(smokeRoot, "teacher-method-execution-learning-contract.json"), {
    format: "fixture_teacher_method_contract_v1"
  }),
  cockpit: writeJson(join(smokeRoot, "original-goal-low-token-coverage-waiting-row-cockpit.json"), {
    format: "fixture_waiting_row_cockpit_v1"
  }),
  sketch: writeJson(join(smokeRoot, "transparent-sketch-depth-demonstration-rehearsal.json"), {
    format: "fixture_transparent_sketch_depth_rehearsal_v1"
  }),
  monitor: writeJson(join(smokeRoot, "recurring-monitor-teacher-confirmation-package.json"), {
    format: "fixture_recurring_monitor_teacher_confirmation_v1"
  }),
  executionCockpit: writeJson(join(smokeRoot, "all-software-execution-gap-review-cockpit.json"), {
    format: "fixture_execution_gap_review_cockpit_v1"
  })
};

const refreshPath = writeJson(join(smokeRoot, "original-goal-current-status-refresh.json"), {
  ok: true,
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  refreshId: "smoke-original-goal-unlock-action-package",
  goal: "Smoke original goal unlock action package.",
  completionDecision:
    "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven",
  refreshedEvidence: {
    teacherMethodExecutionLearningContractStatus: "ready_for_teacher_method_execution_learning_contract_review",
    teacherMethodExecutionLearningContractRouteCount: 8,
    teacherMethodContractLowTokenMetadataFirst: true,
    teacherMethodContractTransparentOverlaySpatialIntent: true,
    teacherMethodContractCorrectionBoundaryCounterexample: true,
    teacherMethodContractHighToMediumModelTierPolicy: true,
    originalGoalLowTokenCoverageLedgerRows: 211,
    originalGoalLowTokenCoverageWaitingRows: 13,
    originalGoalLowTokenFallbackRouteEvidencePackCandidateRoutes: 64,
    transparentSketch2DPerspective3DImplemented: true,
    formalSpatialIntentEvidencePresent: false,
    spatialIntentEvidenceReceiptValidationStatus: "blocked",
    allSoftwareUnattendedLearningAuditRemainingGaps: 5,
    allSoftwareUnattendedLearningAuditStatus: "unattended_learning_not_ready_remaining_gaps",
    unattendedAllAppMonitoringComplete: false,
    executionGapReviewCockpitRowsWithBothReviews: 10,
    executionCapabilityConvergenceRemainingGaps: [{ kind: "control_channel_evidence_missing" }]
  },
  paths: {
    teacherMethodExecutionLearningContract: existing.teacherContract,
    teacherMethodExecutionLearningContractCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\create-teacher-method-execution-learning-contract.mjs --profile \"profile.json\"",
    originalGoalLowTokenCoverageWaitingRowCockpit: existing.cockpit,
    originalGoalLowTokenCoverageWaitingRowCockpitHtml: existing.cockpit,
    originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate: existing.cockpit,
    originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs --receipt \"<teacher-filled-low-token-waiting-row-cockpit-receipt.json>\"",
    transparentSketchDepthDemonstrationRehearsal: existing.sketch,
    transparentSketchDepthDemonstrationRehearsalHtml: existing.sketch,
    transparentSketchDepthRehearsalReviewReceiptTemplate: existing.sketch,
    transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-transparent-sketch-depth-rehearsal-review-receipt.mjs --receipt \"<teacher-filled-transparent-sketch-depth-rehearsal-review-receipt.json>\"",
    recurringMonitorTeacherConfirmationPackage: existing.monitor,
    recurringMonitorTeacherConfirmationPackageHtml: existing.monitor,
    recurringMonitorTeacherConfirmationReceiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-recurring-monitor-teacher-confirmation-receipt.mjs --receipt \"<teacher-filled-recurring-monitor-teacher-confirmation-receipt.json>\"",
    executionGapReviewCockpit: existing.executionCockpit,
    executionGapReviewCockpitHtml: existing.executionCockpit,
    executionGapReviewCockpitReceiptTemplate: existing.executionCockpit,
    executionGapReviewCockpitReceiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-execution-gap-review-cockpit-receipt.mjs --receipt \"<teacher-filled-execution-gap-review-cockpit-receipt.json>\"",
    executionApprovedGateRunnerCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-execution-approved-gate-runner.mjs --execute-approved-gate true --teacher-confirmation \"<teacher-confirmed-approved-gate-runner-text>\""
  },
  locks: {
    nativeUniversalExecution: false
  }
});

const result = runScript("create-original-goal-unlock-action-package.mjs", [
  "--refresh",
  refreshPath,
  "--output-dir",
  join(smokeRoot, "package")
]);
const packet = readJson(result.packagePath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");
const lowTokenItem = packet.actionItems.find((item) => item.id === "low_token_waiting_rows_review");
const spatialItem = packet.actionItems.find((item) => item.id === "transparent_sketch_spatial_evidence_review");
const executionItem = packet.actionItems.find((item) => item.id === "native_execution_control_channel_gate");

const checks = [
  check(
    "Unlock package creates a five-lane review-only action order from current status refresh",
    result.format === "transparent_ai_original_goal_unlock_action_package_result_v1" &&
      packet.format === "transparent_ai_original_goal_unlock_action_package_v1" &&
      packet.status === "waiting_for_teacher_reviewed_unlock_actions" &&
      packet.counts.actionItems === 5 &&
      packet.actionItems[0]?.id === "teacher_method_contract_review",
    result.packagePath
  ),
  check(
    "Unlock package preserves low-token and spatial blockers as teacher receipt work",
    lowTokenItem?.status === "waiting_for_teacher_filled_receipt" &&
      lowTokenItem?.currentEvidence.includes("waitingRows=13") &&
      spatialItem?.status === "waiting_for_teacher_filled_receipt" &&
      spatialItem?.currentEvidence.includes("formalEvidence=false"),
    JSON.stringify({ lowTokenStatus: lowTokenItem?.status, spatialStatus: spatialItem?.status })
  ),
  check(
    "Unlock package gates native execution and keeps completion locks closed",
    executionItem?.status === "gated_until_teacher_receipt_and_rollback" &&
      executionItem?.risk?.matchedHighRiskMarkers?.includes("--execute-approved-gate") &&
      packet.locks.packageDoesNotExecuteTargetSoftware === true &&
      packet.locks.packageDoesNotCaptureScreenshots === true &&
      packet.locks.packageDoesNotWriteMemory === true &&
      packet.locks.goalComplete === false,
    JSON.stringify({ executionStatus: executionItem?.status, locks: packet.locks })
  ),
  check(
    "Unlock package writes readable HTML and README handoff artifacts",
    existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      html.includes("Original Goal Unlock Action Package") &&
      html.includes("does not validate receipts, run commands") &&
      readme.includes("Use this as the shortest next-review route"),
    result.htmlPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const summary = {
  ok: passed === checks.length,
  format: "transparent_ai_original_goal_unlock_action_package_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  packagePath: result.packagePath,
  htmlPath: result.htmlPath,
  readmePath: result.readmePath,
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
