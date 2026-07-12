#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-gap-action-board")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-gap-action-board"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readOptionalJson(path, label, expectedFormat = "") {
  const text = String(path || "").trim();
  if (!text) return { value: null, path: "" };
  if (!existsSync(text)) throw new Error(`${label} does not exist: ${text}`);
  const value = readJson(text);
  if (expectedFormat && value?.format !== expectedFormat) {
    throw new Error(`${label} must be ${expectedFormat}`);
  }
  return { value, path: resolve(text) };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function text(value) {
  return String(value ?? "").toLowerCase();
}

function findNextSafeAction(statusConsole, lane = {}) {
  const actions = Array.isArray(statusConsole?.nextSafeActions) ? statusConsole.nextSafeActions : [];
  const laneId = text(lane.id);
  const laneStatus = text(lane.status);
  const laneDetail = text(lane.detail);
  const haystack = `${laneId} ${laneStatus} ${laneDetail}`;
  const preferredMarkers =
    laneId.includes("activation") || laneDetail.includes("activation")
      ? ["activation", "receipt validation", "teacher confirmations"]
      : laneId.includes("coverage")
        ? ["coverage", "rollout"]
        : laneId.includes("execution")
          ? ["execution", "capability", "matrix", "pilot"]
          : laneId.includes("operational")
            ? ["operational", "workbench", "registration"]
            : laneId.includes("original_goal")
              ? ["completion-boundary", "readiness", "original goal"]
              : [];
  const byPreferredMarker = actions.find((action) => {
    const actionText = text(`${action.label} ${action.command}`);
    return preferredMarkers.some((marker) => actionText.includes(marker));
  });
  if (byPreferredMarker) return byPreferredMarker;
  return actions.find((action) => {
    const actionText = text(`${action.label} ${action.command}`);
    return haystack.split(/[^a-z0-9_]+/).some((part) => part.length > 4 && actionText.includes(part));
  });
}

function downstreamLaneForStatusLane(lane = {}) {
  const value = text(`${lane.id} ${lane.status} ${lane.detail}`);
  if (value.includes("original_goal") || value.includes("completion-boundary") || value.includes("full goal remains active")) return "current_status";
  if (value.includes("activation") || value.includes("registration")) return "automatic_learning_activation";
  if (value.includes("coverage")) return "all_software_low_token_coverage";
  if (value.includes("execution") || value.includes("native")) return "all_software_execution_capability";
  return "current_status";
}

function coverageBatchNextSafeAction(coverageConvergence, batch = {}, coverageRolloutReceiptBuilder = null) {
  const planPath = coverageConvergence?.sourceExpansionPlanPath || "";
  const auditPath = coverageConvergence?.__sourcePath || coverageConvergence?.paths?.audit || coverageConvergence?.auditPath || "";
  if (!planPath) return { label: "", command: "" };
  if (String(batch.status || "").includes("not_started") || String(batch.nextAction || "").includes("run_selected_batch")) {
    return {
      label: "Prepare this coverage batch without teacher-reviewed runner execution",
      command: commandLine("run-all-software-coverage-rollout-supervisor.mjs", [
        ["--plan", planPath],
        ["--start-batch", batch.batchId],
        ["--max-batches", "1"]
      ])
    };
  }
  if (coverageRolloutReceiptBuilder?.paths?.html || coverageRolloutReceiptBuilder?.htmlPath) {
    return {
      label: "Open existing coverage rollout receipt builder for teacher review",
      command: coverageRolloutReceiptBuilder.paths?.html || coverageRolloutReceiptBuilder.htmlPath || ""
    };
  }
  return {
    label: "Open coverage rollout receipt builder for teacher review",
    command: commandLine("create-all-software-coverage-rollout-receipt-builder.mjs", [
      ["--plan", planPath],
      ["--convergence-audit", auditPath]
    ])
  };
}

function latestExecutionFollowUpBatchPath(executionConvergence, explicitFollowUpBatchPath = "") {
  if (explicitFollowUpBatchPath && existsSync(explicitFollowUpBatchPath)) return resolve(explicitFollowUpBatchPath);
  const directPath =
    executionConvergence?.latestFollowUpBatchPath ||
    executionConvergence?.sourceEvidence?.latestFollowUpBatchPath ||
    executionConvergence?.sourceEvidence?.followUpBatchPath ||
    "";
  if (directPath && existsSync(directPath)) return resolve(directPath);
  const supervisorPaths = Array.isArray(executionConvergence?.sourceEvidence?.supervisorPaths)
    ? executionConvergence.sourceEvidence.supervisorPaths
    : [];
  for (const supervisorPath of [...supervisorPaths].reverse()) {
    if (!supervisorPath || !existsSync(supervisorPath)) continue;
    try {
      const supervisor = readJson(supervisorPath);
      const rounds = Array.isArray(supervisor.rounds) ? supervisor.rounds : [];
      for (const round of [...rounds].reverse()) {
        if (round.followUpBatchPath && existsSync(round.followUpBatchPath)) return resolve(round.followUpBatchPath);
      }
    } catch {
      // Ignore stale or malformed supervisor evidence; the matrix fallback below remains safe.
    }
  }
  return "";
}

function executionGapNextSafeAction(executionConvergence, gap = {}, explicitFollowUpBatchPath = "") {
  const followUpBatchPath = latestExecutionFollowUpBatchPath(executionConvergence, explicitFollowUpBatchPath);
  const gapKind = String(gap.kind || "");
  const matrixPath =
    executionConvergence?.sourceEvidence?.latestMatrixPath ||
    executionConvergence?.sourceEvidence?.initialMatrixPath ||
    executionConvergence?.latestMatrixPath ||
    "";
  if (gapKind.includes("control_channel")) {
    if (followUpBatchPath) {
      return {
        label: "Create control-channel repair receipt builder for teacher review",
        command: commandLine("create-all-software-control-channel-repair-receipt-builder.mjs", [
          ["--follow-up-batch", followUpBatchPath]
        ])
      };
    }
    if (matrixPath) {
      return {
        label: "Prepare bounded control-channel follow-up batch before repair receipt",
        command: commandLine("run-all-software-execution-capability-supervisor.mjs", [
          ["--matrix", matrixPath],
          ["--max-rounds", "1"],
          ["--max-rows", "4"],
          ["--lane-filter", "collect_control_channel_evidence"]
        ])
      };
    }
  }
  if (gapKind.includes("action_logic_source")) {
    const args = followUpBatchPath
      ? [["--batch", followUpBatchPath]]
      : matrixPath
        ? [["--matrix", matrixPath]]
        : [];
    if (args.length > 0) {
      return {
        label: "Create action logic source contract package for teacher review",
        command: commandLine("create-all-software-action-logic-source-contract-package.mjs", args)
      };
    }
  }
  if (followUpBatchPath) {
    return {
      label: "Open execution follow-up receipt builder for teacher review",
      command: commandLine("create-all-software-execution-follow-up-receipt-builder.mjs", [
        ["--batch", followUpBatchPath]
      ])
    };
  }
  if (!matrixPath) return { label: "", command: "" };
  const maxRows = String(gap.kind || "").includes("dry_run") ? "4" : "4";
  return {
    label: "Prepare bounded execution follow-up batch without teacher-reviewed runner execution",
    command: commandLine("run-all-software-execution-capability-supervisor.mjs", [
      ["--matrix", matrixPath],
      ["--max-rounds", "1"],
      ["--max-rows", maxRows]
    ])
  };
}

function spatialIntentNextSafeAction(spatialIntentEvidenceRequest) {
  if (!spatialIntentEvidenceRequest) return { label: "", command: "" };
  if (spatialIntentEvidenceRequest?.locks?.formalSpatialIntentEvidencePresent === true) {
    return {
      label: "Review existing formal spatial intent evidence",
      command: spatialIntentEvidenceRequest?.verifierCommandTemplate || ""
    };
  }
  return {
    label: "Open spatial intent evidence request for teacher overlay export",
    command:
      spatialIntentEvidenceRequest?.paths?.html ||
      spatialIntentEvidenceRequest?.htmlPath ||
      spatialIntentEvidenceRequest?.__htmlPath ||
      spatialIntentEvidenceRequest?.__sourcePath ||
      ""
  };
}

function safeCommandLooksRunnable(command) {
  const value = String(command || "").trim();
  if (!value) return false;
  return value.startsWith("node ") || value.endsWith(".html") || value.endsWith(".json") || existsSync(value.replace(/^"|"$/g, ""));
}

function safeActionLooksLikeExecutionHandoff(safeAction) {
  const label = text(safeAction?.label);
  const command = text(safeAction?.command);
  return (
    label.includes("execution capability") ||
    label.includes("execution follow-up") ||
    command.includes("all-software-execution") ||
    command.includes("execution-follow-up") ||
    command.includes("execution-capability")
  );
}

function actionRow(row) {
  return {
    id: row.id,
    lane: row.lane,
    downstreamLane: row.downstreamLane || row.lane,
    label: row.label,
    currentStatus: row.currentStatus || "needs_teacher_review",
    evidencePath: row.evidencePath || "",
    nextAction: row.nextAction || "",
    nextSafeActionLabel: row.nextSafeActionLabel || "",
    nextSafeCommand: row.nextSafeCommand || "",
    teacherDecision: "needs_teacher_review",
    allowedTeacherDecisions: ["needs_teacher_review", "teacher_reviewed_continue", "blocked_needs_more_evidence"],
    blockedTeacherDecisions: ["accepted", "execute_now", "register_now", "memory_enabled", "claim_complete"],
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      scheduledTaskRegistered: false,
      memoryWritten: false,
      nativeUniversalExecution: false,
      goalComplete: false
    }
  };
}

function buildRows({
  statusConsole,
  activationValidation,
  coverageConvergence,
  coverageRolloutReceiptBuilder,
  executionConvergence,
  executionFollowUpBatchPath,
  spatialIntentEvidenceRequest
}) {
  const rows = [];

  for (const lane of statusConsole?.lanes || []) {
    if (String(lane.status || "").includes("missing") || String(lane.status || "").includes("waiting") || String(lane.status || "").includes("not_")) {
      const downstreamLane = downstreamLaneForStatusLane(lane);
      let safeAction = findNextSafeAction(statusConsole, lane);
      if (
        downstreamLane === "all_software_execution_capability" &&
        (!safeCommandLooksRunnable(safeAction?.command) ||
          !safeActionLooksLikeExecutionHandoff(safeAction) ||
          String(safeAction?.command || "").includes("--teacher-reviewed"))
      ) {
        const executionSafeAction = executionGapNextSafeAction(executionConvergence, { kind: lane.id }, executionFollowUpBatchPath);
        if (executionSafeAction.command) safeAction = executionSafeAction;
      }
      rows.push(
        actionRow({
          id: `status_lane_${lane.id}`,
          lane: "current_status",
          downstreamLane,
          label: `${lane.id}: ${lane.detail || lane.status}`,
          currentStatus: lane.status,
          evidencePath: statusConsole?.paths?.console || "",
          nextAction:
            safeAction?.label ||
            (downstreamLane === "current_status"
              ? "Review this lane before claiming completion or advancing gates."
              : `Review this lane, then route through ${downstreamLane} before any downstream action.`),
          nextSafeActionLabel: safeAction?.label || "",
          nextSafeCommand: safeAction?.command || ""
        })
      );
    }
  }

  for (const validationRow of activationValidation?.validationRows || []) {
    if (!validationRow.canAdvance) {
      rows.push(
        actionRow({
          id: `activation_${validationRow.id}`,
          lane: "automatic_learning_activation",
          label: `${validationRow.id}: requires ${validationRow.requiredPhrase}`,
          currentStatus: validationRow.status,
          evidencePath: activationValidation?.paths?.validation || "",
          nextAction: "Teacher may confirm this row in the activation receipt builder, then rerun receipt validation."
        })
      );
    }
  }

  for (const batch of coverageConvergence?.remainingBatches || coverageConvergence?.batchRows || []) {
    const nextSafe = coverageBatchNextSafeAction(coverageConvergence, batch, coverageRolloutReceiptBuilder);
    rows.push(
      actionRow({
        id: `coverage_${batch.batchId}`,
        lane: "all_software_low_token_coverage",
        label: `${batch.batchId}: ${batch.plannedRows || batch.plannedSoftware?.length || 0} software rows`,
        currentStatus: batch.status,
        evidencePath:
          coverageRolloutReceiptBuilder?.paths?.builder ||
          coverageRolloutReceiptBuilder?.builderPath ||
          coverageConvergence?.sourceExpansionPlanPath ||
          "",
        nextAction: batch.nextAction || coverageConvergence?.nextCommand || "",
        nextSafeActionLabel: nextSafe.label,
        nextSafeCommand: nextSafe.command
      })
    );
  }

  for (const gap of executionConvergence?.remainingReviewGaps || []) {
    const nextSafe = executionGapNextSafeAction(executionConvergence, gap, executionFollowUpBatchPath);
    rows.push(
      actionRow({
        id: `execution_${gap.kind}`,
        lane: "all_software_execution_capability",
        label: `${gap.kind}: ${gap.detail}`,
        currentStatus: "remaining_review_gap",
        evidencePath: executionConvergence?.sourceEvidence?.latestMatrixPath || "",
        nextAction: executionConvergence?.nextCommand || "Review latest matrix gaps, confirm routes, then rerun a bounded supervisor pass.",
        nextSafeActionLabel: nextSafe.label,
        nextSafeCommand: nextSafe.command
      })
    );
  }

  if (
    spatialIntentEvidenceRequest &&
    spatialIntentEvidenceRequest?.locks?.formalSpatialIntentEvidencePresent !== true
  ) {
    const nextSafe = spatialIntentNextSafeAction(spatialIntentEvidenceRequest);
    rows.push(
      actionRow({
        id: "spatial_spatial_intent_evidence_missing",
        lane: "transparent_spatial_intent",
        downstreamLane: "transparent_spatial_intent",
        label:
          "spatial_intent_evidence_missing: teacher-exported transparent sketch packet is required before claiming 2D/perspective/3D intent understanding.",
        currentStatus: spatialIntentEvidenceRequest.status || "waiting_for_teacher_exported_overlay_packet",
        evidencePath: spatialIntentEvidenceRequest.__sourcePath || "",
        nextAction:
          "Open the spatial intent evidence request, collect a real teacher-exported overlay packet, validate the teacher receipt, then create numbered spatial target confirmation.",
        nextSafeActionLabel: nextSafe.label,
        nextSafeCommand: nextSafe.command
      })
    );
  }

  return rows;
}

function writeReadme(path, board) {
  const lines = [
    "# Original Goal Gap Action Board",
    "",
    `Status: ${board.status}`,
    `Goal: ${board.goal}`,
    "",
    "This board collects the current blockers that still keep the original goal from being honestly complete.",
    "",
    `- Board HTML: ${board.paths.html}`,
    `- Board JSON: ${board.paths.board}`,
    `- Receipt template: ${board.paths.receiptTemplate}`,
    `- Action rows: ${board.actionRows.length}`,
    "",
    `Next validation command: ${board.nextValidationCommand}`,
    "",
    "Safety boundary:",
    "- This board does not register scheduled tasks.",
    "- It does not launch runners, execute wrappers, execute target software, capture screenshots, write memory, enable rules, or claim completion.",
    "- Teacher decisions generated by the page must still go through the specific downstream validation or approval gate."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue(
  "--goal",
  "Resolve original goal gaps without claiming completion: all-software low-token coverage, activation confirmation, and execution capability."
);
const statusConsoleInput = readOptionalJson(
  argValue("--status-console", ""),
  "--status-console",
  "transparent_ai_all_software_operational_status_console_v1"
);
const activationValidationInput = readOptionalJson(
  argValue("--activation-receipt-validation", argValue("--activation-validation", "")),
  "--activation-receipt-validation",
  "transparent_ai_all_software_operational_activation_review_receipt_validation_v1"
);
const coverageConvergenceInput = readOptionalJson(
  argValue("--coverage-convergence", ""),
  "--coverage-convergence",
  "transparent_ai_all_software_coverage_convergence_audit_v1"
);
const coverageRolloutReceiptBuilderInput = readOptionalJson(
  argValue("--coverage-rollout-receipt-builder", argValue("--coverage-receipt-builder", "")),
  "--coverage-rollout-receipt-builder",
  "transparent_ai_all_software_coverage_rollout_receipt_builder_v1"
);
const executionConvergenceInput = readOptionalJson(
  argValue("--execution-convergence", ""),
  "--execution-convergence",
  "transparent_ai_all_software_execution_capability_convergence_audit_v1"
);
const executionFollowUpBatchInput = readOptionalJson(
  argValue("--execution-follow-up-batch", argValue("--execution-capability-follow-up-batch", "")),
  "--execution-follow-up-batch",
  "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1"
);
const spatialIntentEvidenceRequestInput = readOptionalJson(
  argValue("--spatial-intent-evidence-request", argValue("--spatial-intent-request", "")),
  "--spatial-intent-evidence-request",
  "transparent_ai_spatial_intent_evidence_request_v1"
);

if (
  !statusConsoleInput.value &&
  !activationValidationInput.value &&
  !coverageConvergenceInput.value &&
  !executionConvergenceInput.value &&
  !executionFollowUpBatchInput.value &&
  !spatialIntentEvidenceRequestInput.value
) {
  throw new Error("Provide at least one current evidence path: --status-console, --activation-receipt-validation, --coverage-convergence, --execution-convergence, or --spatial-intent-evidence-request");
}

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-gap-action-boards")));
mkdirSync(outputRoot, { recursive: true });
const boardId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const boardDir = join(outputRoot, boardId);
mkdirSync(boardDir, { recursive: true });

const boardPath = join(boardDir, "original-goal-gap-action-board.json");
const htmlPath = join(boardDir, "original-goal-gap-action-board.html");
const receiptTemplatePath = join(boardDir, "original-goal-gap-action-board-receipt-template.json");
const readmePath = join(boardDir, "ORIGINAL_GOAL_GAP_ACTION_BOARD_START_HERE.md");
const coverageConvergenceValue = coverageConvergenceInput.value
  ? { ...coverageConvergenceInput.value, __sourcePath: coverageConvergenceInput.path }
  : null;
const executionConvergenceValue = executionConvergenceInput.value
  ? { ...executionConvergenceInput.value, __sourcePath: executionConvergenceInput.path }
  : null;
const spatialIntentEvidenceRequestValue = spatialIntentEvidenceRequestInput.value
  ? {
      ...spatialIntentEvidenceRequestInput.value,
      __sourcePath: spatialIntentEvidenceRequestInput.path,
      __htmlPath:
        spatialIntentEvidenceRequestInput.value?.paths?.html ||
        spatialIntentEvidenceRequestInput.path.replace(/spatial-intent-evidence-request\.json$/, "spatial-intent-evidence-request.html")
    }
  : null;
const actionRows = buildRows({
  statusConsole: statusConsoleInput.value,
  activationValidation: activationValidationInput.value,
  coverageConvergence: coverageConvergenceValue,
  coverageRolloutReceiptBuilder: coverageRolloutReceiptBuilderInput.value,
  executionConvergence: executionConvergenceValue,
  executionFollowUpBatchPath: executionFollowUpBatchInput.path,
  spatialIntentEvidenceRequest: spatialIntentEvidenceRequestValue
});

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  boardDoesNotRegisterTask: true,
  boardDoesNotLaunchRunner: true,
  boardDoesNotExecuteWrapper: true,
  boardDoesNotExecuteTargetSoftware: true,
  boardDoesNotCaptureScreenshots: true,
  boardDoesNotWriteMemory: true,
  scheduledTaskRegistered: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false
};

const generatedReceiptTemplate = {
  format: "transparent_ai_original_goal_gap_action_board_receipt_v1",
  boardId,
  defaultDecision: "needs_teacher_review",
  rowDecisions: actionRows.map((row) => ({
    id: row.id,
    teacherDecision: "needs_teacher_review",
    teacherNote: "",
    evidenceReviewed: false
  }))
};
const nextValidationCommand = commandLine("validate-original-goal-gap-action-board-receipt.mjs", [
  ["--board", boardPath],
  ["--receipt", receiptTemplatePath],
  ["--goal", goal]
]);

const board = {
  ok: true,
  format: "transparent_ai_original_goal_gap_action_board_v1",
  boardId,
  createdAt: new Date().toISOString(),
  goal,
  status: actionRows.length ? "waiting_for_teacher_gap_review" : "no_gap_rows_found_from_supplied_evidence",
  purpose:
    "A teacher-facing action board that turns current original-goal blockers into explicit review rows before any activation, coverage rollout, execution pilot, memory write, or completion claim.",
  sourceEvidence: {
    statusConsole: statusConsoleInput.path,
    activationReceiptValidation: activationValidationInput.path,
    coverageConvergence: coverageConvergenceInput.path,
    coverageRolloutReceiptBuilder: coverageRolloutReceiptBuilderInput.path,
    executionConvergence: executionConvergenceInput.path,
    executionFollowUpBatch: executionFollowUpBatchInput.path,
    spatialIntentEvidenceRequest: spatialIntentEvidenceRequestInput.path
  },
  counts: {
    actionRows: actionRows.length,
    activationRows: actionRows.filter((row) => row.lane === "automatic_learning_activation").length,
    coverageRows: actionRows.filter((row) => row.lane === "all_software_low_token_coverage").length,
    executionRows: actionRows.filter((row) => row.lane === "all_software_execution_capability").length,
    spatialRows: actionRows.filter((row) => row.lane === "transparent_spatial_intent").length,
    statusRows: actionRows.filter((row) => row.lane === "current_status").length
  },
  actionRows,
  generatedReceiptTemplate,
  nextValidationRule:
    "Use each downstream gate for the chosen lane: activation receipt validation for activation rows, coverage rollout supervisor/audit for coverage rows, and execution capability supervisor or pilot dry-run gates for execution rows.",
  nextValidationCommand,
  blockedActions: [
    "register_scheduled_task_from_gap_board",
    "start_runner_from_gap_board",
    "execute_target_software_from_gap_board",
    "write_memory_from_gap_board",
    "enable_rules_from_gap_board",
    "claim_original_goal_complete_from_gap_board"
  ],
  paths: {
    board: boardPath,
    html: htmlPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath
  },
  locks
};

writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(generatedReceiptTemplate, null, 2)}\n`, "utf8");
writeReadme(readmePath, board);
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Gap Action Board</title>
  <style>
    :root { font-family: "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f8fb; }
    body { margin: 0; padding: 24px; }
    main { max-width: 1180px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .subtle { color: #55606d; }
    .bar { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; }
    .pill { border: 1px solid #c8d1dc; border-radius: 999px; padding: 7px 10px; background: #fff; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 14px; }
    .row { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; }
    .row h2 { font-size: 16px; margin: 0 0 8px; }
    label, select, textarea { display: block; width: 100%; }
    select, textarea { box-sizing: border-box; border: 1px solid #c8d1dc; border-radius: 6px; padding: 8px; background: #fff; }
    textarea { min-height: 72px; resize: vertical; }
    code { overflow-wrap: anywhere; }
    button { border: 1px solid #1f6feb; background: #1f6feb; color: #fff; border-radius: 6px; padding: 10px 12px; cursor: pointer; }
    pre { white-space: pre-wrap; background: #111827; color: #dbeafe; border-radius: 8px; padding: 14px; overflow: auto; }
  </style>
</head>
<body>
  <main>
    <h1>Original Goal Gap Action Board</h1>
    <p class="subtle">${htmlEscape(board.purpose)}</p>
    <div class="bar">
      <span class="pill">Status: ${htmlEscape(board.status)}</span>
      <span class="pill">Rows: ${board.actionRows.length}</span>
      <span class="pill">Activation: ${board.counts.activationRows}</span>
      <span class="pill">Coverage: ${board.counts.coverageRows}</span>
      <span class="pill">Execution: ${board.counts.executionRows}</span>
      <span class="pill">No execution from this page</span>
    </div>
    <section class="grid" id="rows"></section>
    <p><strong>Next validation:</strong> <code>${htmlEscape(nextValidationCommand)}</code></p>
    <p><button id="generate">Generate Review Receipt JSON</button></p>
    <pre id="output"></pre>
  </main>
  <script>
    const board = ${jsonForScript(board)};
    const rowsEl = document.getElementById('rows');
    for (const row of board.actionRows) {
      const card = document.createElement('article');
      card.className = 'row';
      card.innerHTML = \`
        <h2>\${row.id}</h2>
        <p><strong>Lane:</strong> \${row.lane}</p>
        <p>\${row.label}</p>
        <p><strong>Status:</strong> \${row.currentStatus}</p>
        <p><strong>Evidence:</strong> <code>\${row.evidencePath || 'not supplied'}</code></p>
        <p><strong>Next:</strong> \${row.nextAction || 'review evidence and choose a downstream gate'}</p>
        <label>Decision
          <select data-row-id="\${row.id}" data-field="teacherDecision">
            <option value="needs_teacher_review">needs_teacher_review</option>
            <option value="teacher_reviewed_continue">teacher_reviewed_continue</option>
            <option value="blocked_needs_more_evidence">blocked_needs_more_evidence</option>
          </select>
        </label>
        <label>Teacher note
          <textarea data-row-id="\${row.id}" data-field="teacherNote"></textarea>
        </label>
        <label><input type="checkbox" data-row-id="\${row.id}" data-field="evidenceReviewed"> evidence reviewed</label>
      \`;
      rowsEl.appendChild(card);
    }
    function generateReceipt() {
      const receipt = structuredClone(board.generatedReceiptTemplate);
      receipt.createdAt = new Date().toISOString();
      receipt.rowDecisions = receipt.rowDecisions.map((row) => {
        const decision = document.querySelector(\`[data-row-id="\${row.id}"][data-field="teacherDecision"]\`)?.value || row.teacherDecision;
        const note = document.querySelector(\`[data-row-id="\${row.id}"][data-field="teacherNote"]\`)?.value || '';
        const evidenceReviewed = Boolean(document.querySelector(\`[data-row-id="\${row.id}"][data-field="evidenceReviewed"]\`)?.checked);
        return { ...row, teacherDecision: decision, teacherNote: note, evidenceReviewed };
      });
      receipt.locks = board.locks;
      receipt.blockedActions = board.blockedActions;
      receipt.nextValidationRule = board.nextValidationRule;
      document.getElementById('output').textContent = JSON.stringify(receipt, null, 2);
      navigator.clipboard?.writeText(JSON.stringify(receipt, null, 2)).catch(() => {});
    }
    document.getElementById('generate').addEventListener('click', generateReceipt);
    generateReceipt();
  </script>
</body>
</html>
`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_gap_action_board_result_v1",
      status: board.status,
      boardId,
      boardPath,
      htmlPath,
      receiptTemplatePath,
      readmePath,
      counts: board.counts,
      locks
    },
    null,
    2
  )
);
