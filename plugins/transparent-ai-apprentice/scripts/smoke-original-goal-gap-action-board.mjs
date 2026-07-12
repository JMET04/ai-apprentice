#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function runScript(args) {
  const result = spawnSync(process.execPath, [join(__dirname, "create-original-goal-gap-action-board.mjs"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "goal gap action board script failed");
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-gap-action-board-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const statusConsolePath = writeJson(join(smokeRoot, "status", "all-software-operational-status-console.json"), {
  format: "transparent_ai_all_software_operational_status_console_v1",
  lanes: [
    {
      id: "coverage_convergence",
      status: "coverage_still_bounded_or_missing",
      detail: "coverage_rollout_still_has_remaining_batches_or_audit_gaps"
    },
    {
      id: "execution_capability",
      status: "execution_capability_still_bounded_or_missing",
      detail: "execution_capability_still_has_remaining_lanes_or_review_gaps"
    },
    {
      id: "original_goal_boundary",
      status: "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven",
      detail: "full goal remains active until all in-scope apps and native control evidence are proven"
    }
  ],
  paths: {
    console: "D:\\example\\status.json"
  },
  nextSafeActions: [
    {
      label: "Validate teacher-filled coverage rollout receipt",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-coverage-rollout-receipt.mjs --plan D:\\example\\coverage-plan.json --receipt <teacher-filled-coverage-rollout-receipt.json>"
    },
    {
      label: "Review execution capability matrix gaps",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-execution-capability-supervisor.mjs --matrix D:\\example\\matrix.json --teacher-reviewed"
    }
  ]
});

const activationValidationPath = writeJson(join(smokeRoot, "activation", "validation.json"), {
  format: "transparent_ai_all_software_operational_activation_review_receipt_validation_v1",
  status: "receipt_validation_waiting_for_teacher_confirmation",
  validationRows: [
    {
      id: "recurring_monitor_teacher_confirmation",
      requiredPhrase: "teacher_confirmed_recurring_low_token_monitor_review",
      status: "missing_teacher_confirmation",
      canAdvance: false
    }
  ],
  paths: {
    validation: "D:\\example\\activation-validation.json"
  }
});

const coverageConvergencePath = writeJson(join(smokeRoot, "coverage", "convergence.json"), {
  format: "transparent_ai_all_software_coverage_convergence_audit_v1",
  status: "coverage_rollout_still_has_remaining_batches_or_audit_gaps",
  sourceExpansionPlanPath: "D:\\example\\coverage-plan.json",
  remainingBatches: [
    {
      batchId: "batch-001",
      status: "prepared_waiting_for_teacher_review",
      plannedRows: 8,
      nextAction: "teacher_review_required_before_runner"
    }
  ],
  nextCommand: "node run-all-software-coverage-rollout-supervisor.mjs"
});
const coverageReceiptBuilderHtmlPath = join(smokeRoot, "coverage-builder", "all-software-coverage-rollout-receipt-builder.html");
mkdirSync(dirname(coverageReceiptBuilderHtmlPath), { recursive: true });
writeFileSync(coverageReceiptBuilderHtmlPath, "<!doctype html><title>Coverage receipt builder fixture</title>\n", "utf8");
const coverageReceiptBuilderPath = writeJson(join(smokeRoot, "coverage-builder", "all-software-coverage-rollout-receipt-builder.json"), {
  format: "transparent_ai_all_software_coverage_rollout_receipt_builder_v1",
  status: "coverage_rollout_receipt_builder_ready_for_teacher_use",
  paths: {
    builder: join(smokeRoot, "coverage-builder", "all-software-coverage-rollout-receipt-builder.json"),
    html: coverageReceiptBuilderHtmlPath,
    sourceExpansionPlan: "D:\\example\\coverage-plan.json",
    sourceConvergenceAudit: coverageConvergencePath
  },
  reviewRows: [
    {
      batchId: "batch-001",
      status: "prepared_waiting_for_teacher_review",
      defaultDecision: "needs_teacher_review"
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const executionConvergencePath = writeJson(join(smokeRoot, "execution", "convergence.json"), {
  format: "transparent_ai_all_software_execution_capability_convergence_audit_v1",
  status: "execution_capability_still_has_remaining_lanes_or_review_gaps",
  sourceEvidence: {
    latestMatrixPath: "D:\\example\\matrix.json"
  },
  remainingReviewGaps: [
    {
      kind: "control_channel_evidence_missing",
      detail: "4 latest matrix rows have low-token observation but no reviewed control route."
    },
    {
      kind: "dry_run_receipts_missing",
      detail: "4 rows are dry-run-pilot candidates but only 0 dry-run runner invocations are aggregated."
    },
    {
      kind: "action_logic_source_missing",
      detail: "4 latest matrix rows still lack an action-level logic-source contract."
    }
  ],
  nextCommand: "Review latest matrix gaps, confirm routes, then rerun a bounded supervisor pass."
});
const explicitExecutionFollowUpBatchPath = writeJson(
  join(smokeRoot, "execution", "explicit-current-follow-up", "all-software-execution-capability-matrix-follow-up-batch.json"),
  {
    ok: true,
    format: "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
    batchId: "explicit-current-follow-up-batch",
    goal: "Use the newest explicit follow-up batch for teacher review.",
    counts: {
      selectedRows: 1,
      dryRunPilotRows: 0,
      controlChannelProbeRows: 1,
      routeConfirmationRows: 0,
      teacherSignalQuestionRows: 0
    },
    rowResults: [
      {
        rowId: "software-001",
        nextLane: "control_channel_probe_review",
        status: "waiting_for_teacher_review"
      }
    ],
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      nativeUniversalExecution: false,
      goalComplete: false
    }
  }
);
const spatialIntentRequestPath = writeJson(join(smokeRoot, "spatial", "spatial-intent-evidence-request.json"), {
  ok: true,
  format: "transparent_ai_spatial_intent_evidence_request_v1",
  status: "waiting_for_teacher_exported_overlay_packet",
  purpose: "Request real teacher spatial intent before numbered target confirmation.",
  transparentSketchOverlayPath: "D:\\example\\transparent-sketch-overlay.html",
  teacherExportedOverlayPacketPlaceholder: "<teacher-exported-transparent-sketch-packet.json>",
  verifierCommandTemplate:
    "node plugins\\transparent-ai-apprentice\\scripts\\create-spatial-target-confirmation-kit.mjs --overlay-packet \"<teacher-exported-transparent-sketch-packet.json>\"",
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    formalSpatialIntentEvidencePresent: false,
    doesNotInterpretWithoutTeacherPacket: true,
    doesNotExecuteSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true
  }
});

const result = runScript([
  "--goal",
  "smoke original goal gap action board",
  "--status-console",
  statusConsolePath,
  "--activation-receipt-validation",
  activationValidationPath,
  "--coverage-convergence",
  coverageConvergencePath,
  "--coverage-rollout-receipt-builder",
  coverageReceiptBuilderPath,
  "--execution-convergence",
  executionConvergencePath,
  "--execution-follow-up-batch",
  explicitExecutionFollowUpBatchPath,
  "--spatial-intent-evidence-request",
  spatialIntentRequestPath,
  "--output-dir",
  join(smokeRoot, "board")
]);

const board = readJson(result.boardPath);
const receiptTemplate = readJson(result.receiptTemplatePath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");
const coverageStatusRow = board.actionRows.find((row) => row.id === "status_lane_coverage_convergence");
const executionStatusRow = board.actionRows.find((row) => row.id === "status_lane_execution_capability");
const controlChannelGapRow = board.actionRows.find((row) => row.id === "execution_control_channel_evidence_missing");
const executionGapRow = board.actionRows.find((row) => row.id === "execution_dry_run_receipts_missing");
const actionLogicSourceGapRow = board.actionRows.find((row) => row.id === "execution_action_logic_source_missing");
const spatialIntentRow = board.actionRows.find((row) => row.id === "spatial_spatial_intent_evidence_missing");
const boundaryStatusRow = board.actionRows.find((row) => row.id === "status_lane_original_goal_boundary");

const checks = [
  check(
    "Goal gap action board collects status, activation, coverage, and execution rows",
    board.format === "transparent_ai_original_goal_gap_action_board_v1" &&
      board.status === "waiting_for_teacher_gap_review" &&
      board.counts.activationRows === 1 &&
      board.counts.coverageRows === 1 &&
      board.counts.executionRows === 3 &&
      board.counts.spatialRows === 1 &&
      board.counts.statusRows === 3 &&
      board.paths.receiptTemplate === result.receiptTemplatePath &&
      board.nextValidationCommand.includes("validate-original-goal-gap-action-board-receipt.mjs"),
    result.boardPath
  ),
  check(
    "Goal gap action board routes status lanes to concrete next safe commands",
      coverageStatusRow?.downstreamLane === "all_software_low_token_coverage" &&
      coverageStatusRow?.nextSafeCommand.includes("validate-all-software-coverage-rollout-receipt.mjs") &&
      executionStatusRow?.downstreamLane === "all_software_execution_capability" &&
      executionStatusRow?.nextSafeCommand.includes("create-all-software-execution-follow-up-receipt-builder.mjs") &&
      executionStatusRow?.nextSafeCommand.includes(explicitExecutionFollowUpBatchPath) &&
      !executionStatusRow?.nextSafeCommand.includes("--teacher-reviewed") &&
      boundaryStatusRow?.downstreamLane === "current_status",
    JSON.stringify({
      coverage: coverageStatusRow?.nextSafeCommand,
      execution: executionStatusRow?.nextSafeCommand
    })
  ),
  check(
    "Goal gap action board opens existing coverage receipt builder when prepared batches already have one",
    board.sourceEvidence?.coverageRolloutReceiptBuilder === coverageReceiptBuilderPath &&
      board.actionRows.some(
        (row) =>
          row.id === "coverage_batch-001" &&
          row.nextSafeCommand === coverageReceiptBuilderHtmlPath &&
          row.nextSafeActionLabel.includes("existing coverage rollout receipt builder") &&
          row.evidencePath === coverageReceiptBuilderPath
      ),
    coverageReceiptBuilderHtmlPath
  ),
  check(
    "Goal gap action board prefers explicit current execution follow-up batch over stale convergence fallbacks",
    board.sourceEvidence?.executionFollowUpBatch === explicitExecutionFollowUpBatchPath &&
      executionGapRow?.nextSafeCommand.includes("create-all-software-execution-follow-up-receipt-builder.mjs") &&
      executionGapRow?.nextSafeCommand.includes(explicitExecutionFollowUpBatchPath) &&
      !executionGapRow?.nextSafeCommand.includes("--teacher-reviewed"),
    executionGapRow?.nextSafeCommand || "missing execution gap row"
  ),
  check(
    "Goal gap action board routes control-channel evidence gaps to repair receipt builder",
    controlChannelGapRow?.nextSafeActionLabel.includes("control-channel repair receipt builder") &&
      controlChannelGapRow?.nextSafeCommand.includes("create-all-software-control-channel-repair-receipt-builder.mjs") &&
      controlChannelGapRow?.nextSafeCommand.includes("--follow-up-batch") &&
      controlChannelGapRow?.nextSafeCommand.includes(explicitExecutionFollowUpBatchPath) &&
      !controlChannelGapRow?.nextSafeCommand.includes("--teacher-reviewed") &&
      controlChannelGapRow?.locks?.reviewOnly === true &&
      controlChannelGapRow?.locks?.targetSoftwareCommandsExecuted === false,
    controlChannelGapRow?.nextSafeCommand || "missing control-channel gap row"
  ),
  check(
    "Goal gap action board routes action logic source gaps to the contract package before dry-run reuse",
    actionLogicSourceGapRow?.nextSafeActionLabel.includes("action logic source contract package") &&
      actionLogicSourceGapRow?.nextSafeCommand.includes("create-all-software-action-logic-source-contract-package.mjs") &&
      actionLogicSourceGapRow?.nextSafeCommand.includes("--batch") &&
      actionLogicSourceGapRow?.nextSafeCommand.includes(explicitExecutionFollowUpBatchPath) &&
      !actionLogicSourceGapRow?.nextSafeCommand.includes("create-all-software-execution-follow-up-receipt-builder.mjs") &&
      actionLogicSourceGapRow?.locks?.reviewOnly === true &&
      actionLogicSourceGapRow?.locks?.targetSoftwareCommandsExecuted === false,
    actionLogicSourceGapRow?.nextSafeCommand || "missing action logic source gap row"
  ),
  check(
    "Goal gap action board turns missing teacher spatial intent evidence into a review row",
    board.sourceEvidence?.spatialIntentEvidenceRequest === spatialIntentRequestPath &&
      spatialIntentRow?.lane === "transparent_spatial_intent" &&
      spatialIntentRow?.currentStatus === "waiting_for_teacher_exported_overlay_packet" &&
      spatialIntentRow?.nextSafeCommand.includes("spatial-intent-evidence-request.html") &&
      spatialIntentRow?.locks?.reviewOnly === true &&
      spatialIntentRow?.locks?.softwareActionsExecuted === false &&
      spatialIntentRow?.blockedTeacherDecisions.includes("accepted"),
    spatialIntentRow?.nextSafeCommand || "missing spatial intent row"
  ),
  check(
    "Goal gap action board HTML generates review receipt JSON without executing actions",
      html.includes("Original Goal Gap Action Board") &&
      html.includes("Generate Review Receipt JSON") &&
      html.includes("data-row-id") &&
      html.includes("navigator.clipboard") &&
      html.includes("claim_complete") &&
      html.includes("nextSafeCommand") &&
      html.includes("validate-original-goal-gap-action-board-receipt.mjs"),
    result.htmlPath
  ),
  check(
    "Goal gap action board writes a reusable receipt template for validation",
    receiptTemplate.format === "transparent_ai_original_goal_gap_action_board_receipt_v1" &&
      receiptTemplate.defaultDecision === "needs_teacher_review" &&
      receiptTemplate.rowDecisions.length === board.actionRows.length,
    result.receiptTemplatePath
  ),
  check(
    "Goal gap action board keeps completion and system-change locks closed",
    board.locks.boardDoesNotRegisterTask === true &&
      board.locks.boardDoesNotExecuteTargetSoftware === true &&
      board.locks.memoryWritten === false &&
      board.locks.nativeUniversalExecution === false &&
      board.locks.goalComplete === false &&
      board.blockedActions.includes("claim_original_goal_complete_from_gap_board"),
    result.boardPath
  ),
  check(
    "Goal gap action board documents downstream validation requirement",
    readme.includes("must still go through the specific downstream validation or approval gate") &&
      readme.includes("does not register scheduled tasks") &&
      readme.includes("Next validation command:"),
    result.readmePath
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_original_goal_gap_action_board_smoke_v1",
  smokeRoot,
  checks
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
