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

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "execution-capability-matrix-follow-up")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-capability-matrix-follow-up"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  if (!input) throw new Error(`${label} is required`);
  const text = String(input).trim();
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 240000
  });
  if (result.status !== 0) {
    return {
      ok: false,
      status: "script_failed",
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    return {
      ok: false,
      status: "script_output_parse_failed",
      parseError: error.message,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }
}

function rowCall(row, extra = {}) {
  return {
    rowId: row.rowId,
    software: row.software,
    processName: row.processName || "",
    windowTitle: row.windowTitle || "",
    lane: row.nextActionLane,
    ...extra
  };
}

function nextTeacherQuestion(row) {
  return [
    `For ${row.software}, which safe control or observation signal should the apprentice use next?`,
    "Choose one: reviewed API/SDK/macro route, CLI/script route, file import/export route, browser/local-service route, visible-window numbered target, log/event signal, or exclude this software from the current scope.",
    "No rule is enabled and no software action is executed until you confirm the route."
  ].join(" ");
}

function writeReadme(path, batch) {
  const lines = [
    "# All-Software Execution Capability Matrix Follow-Up Batch",
    "",
    `Goal: ${batch.goal}`,
    `Matrix: ${batch.matrixPath}`,
    `Selection: start row ${batch.selection.startRow}, lane filter ${batch.selection.laneFilters.join(", ") || "none"}, action logic filter ${batch.selection.actionLogicSourceStatusFilters.join(", ") || "none"}`,
    `Selected rows: ${batch.counts.selectedRows}`,
    "",
    "Review rows:",
    ...batch.rowResults.map(
      (row, index) =>
        `${index + 1}. ${row.software} / ${row.lane} / ${row.status} / ${row.evidencePath || row.nextCall?.tool || row.teacherQuestion || ""}`
    ),
    "",
    "Locked boundaries:",
    "- Dry-run only unless a later, separate execution approval gate is satisfied.",
    "- No screenshots captured.",
    "- No UI events sent.",
    "- No target software commands executed.",
    "- No full logs or file contents read.",
    "- No memory written.",
    "- No all-software or native-universal execution claim.",
    "- No packaging unlocked.",
    "",
    "Next pass:",
    "1. Review pilot dry-run receipts first.",
    "2. For route-ready rows, confirm exactly one numbered target or exact structured route.",
    "3. For observation-ready rows, review the generated control-channel probe package.",
    "4. Rerun the control coverage, pilot queue, matrix, and this follow-up batch only after teacher review."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const matrixInput = readJsonInput(argValue("--matrix", argValue("--matrix-path", "")), "--matrix");
const matrix = matrixInput.value;
if (matrix.format !== "transparent_ai_all_software_execution_capability_matrix_v1") {
  throw new Error("--matrix must be transparent_ai_all_software_execution_capability_matrix_v1");
}

const pilotQueueInputValue = argValue("--pilot-queue", argValue("--execution-pilot-queue", matrix.sourceEvidence?.pilotQueuePath || ""));
const pilotQueueInput = pilotQueueInputValue ? readJsonInput(pilotQueueInputValue, "--pilot-queue") : null;
const maxRows = Math.max(1, Number(argValue("--max-rows", "5")));
const startRow = Math.max(1, Number(argValue("--start-row", argValue("--start-index", "1"))));
const laneFilters = [
  ...argValues("--lane-filter"),
  ...argValues("--next-action-lane"),
  ...String(argValue("--lanes", ""))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
];
const actionLogicSourceStatusFilters = [
  ...argValues("--action-logic-source-status"),
  ...argValues("--logic-source-status"),
  ...String(argValue("--logic-source-statuses", ""))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
];
const teacherReviewed = hasFlag("--teacher-reviewed");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-capability-matrix-follow-up-batches"))
);
mkdirSync(outputRoot, { recursive: true });

const batchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(matrix.goal || "execution-capability-matrix-follow-up")}`;
const batchDir = join(outputRoot, batchId);
mkdirSync(batchDir, { recursive: true });

const allRows = Array.isArray(matrix.rows) ? matrix.rows : [];
const filteredRows = allRows.filter((row) => {
  const laneOk = laneFilters.length === 0 || laneFilters.includes(row.nextActionLane || "");
  const logicOk =
    actionLogicSourceStatusFilters.length === 0 ||
    actionLogicSourceStatusFilters.includes(row.actionLogicSourceStatus || "");
  return laneOk && logicOk;
});
const rows = filteredRows.slice(startRow - 1, startRow - 1 + maxRows);
const rowResults = [];

for (const row of rows) {
  if (row.nextActionLane === "review_and_run_one_dry_run_pilot") {
    if (teacherReviewed && pilotQueueInput && row.pilotId) {
      const result = runNodeScript(
        "run-all-software-execution-pilot-runner.mjs",
        [
          "--queue",
          pilotQueueInput.path || JSON.stringify(pilotQueueInput.value),
          "--pilot-id",
          row.pilotId,
          "--output-dir",
          join(outputRoot, "pilot-runs", row.rowId)
        ],
        process.cwd()
      );
      rowResults.push(
        rowCall(row, {
          status: result.status || (result.ok === false ? "pilot_runner_failed" : "dry_run_runner_invoked_waiting_for_teacher_review"),
          actionTaken: "invoked_existing_pilot_runner_in_dry_run_mode",
          runnerInvoked: result.ok !== false,
          controlledRouteActionExecuted: Boolean(result.controlledRouteActionExecuted),
          evidencePath: result.receiptPath || result.runPath || "",
          runnerResult: {
            runPath: result.runPath || "",
            receiptPath: result.receiptPath || "",
            outcomeVerificationPath: result.outcomeVerificationPath || "",
            postActionCheckpointPath: result.postActionCheckpointPath || ""
          },
          error: result.ok === false ? result.stderr || result.stdout || result.parseError || "runner failed" : ""
        })
      );
    } else {
      rowResults.push(
        rowCall(row, {
          status: "dry_run_runner_call_prepared_waiting_for_teacher_review",
          actionTaken: "prepared_existing_pilot_runner_call_only",
          runnerInvoked: false,
          nextCall: {
            tool: "run_all_software_execution_pilot_runner",
            arguments: {
              queue: pilotQueueInput?.path || matrix.sourceEvidence?.pilotQueuePath || "<reviewed pilot queue path>",
              pilotId: row.pilotId || "<pilot id>",
              execute: false
            },
            blockedUntil: "teacherReviewed=true and one reviewed pilot row is selected"
          }
        })
      );
    }
    continue;
  }

  if (row.nextActionLane === "collect_control_channel_evidence") {
    const result = runNodeScript(
      "create-software-control-channel-probe.mjs",
      [
        "--goal",
        `Collect read-only control-channel evidence for ${row.software} before execution routing.`,
        "--software",
        row.software || "software",
        "--process-name",
        row.processName || "",
        "--window-title",
        row.windowTitle || "",
        "--output-dir",
        join(batchDir, "control-channel-probes", row.rowId)
      ],
      process.cwd()
    );
    rowResults.push(
      rowCall(row, {
        status: result.ok === false ? "control_channel_probe_package_failed" : "control_channel_probe_package_created_waiting_for_teacher_review",
        actionTaken: "created_read_only_control_channel_probe_package",
        evidencePath: result.probePlan || result.probePlanPath || result.readmePath || "",
        probeResult: {
          teacherReadme: result.teacherReadme || result.readmePath || "",
          probePlan: result.probePlan || result.probePlanPath || "",
          resultTemplate: result.probeResultTemplate || result.probeResultTemplatePath || "",
          nextProfileRequest: result.nextProfileRequest || ""
        }
      })
    );
    continue;
  }

  if (row.nextActionLane === "confirm_numbered_target_or_exact_route") {
    rowResults.push(
      rowCall(row, {
        status: "waiting_for_numbered_target_or_exact_route_confirmation",
        actionTaken: "prepared_route_confirmation_request_only",
        nextCall: {
          tool: "create_all_software_execution_pilot_queue",
          arguments: {
            coverageAudit: matrix.sourceEvidence?.coverageAuditPath || "<reviewed control-channel coverage audit>",
            createAdapterPackages: true
          },
          blockedUntil: "teacher confirms exactly one target number or exact reviewed structured route"
        }
      })
    );
    continue;
  }

  if (row.nextActionLane === "confirm_visible_window_and_numbered_target") {
    rowResults.push(
      rowCall(row, {
        status: "waiting_for_visible_window_and_numbered_target_confirmation",
        actionTaken: "prepared_visual_target_confirmation_handoff_only",
        nextCall: {
          tool: "create_visual_engineering_target_confirmation_kit",
          arguments: {
            software: row.software,
            command: "Confirm the visible target before any supervised UI fallback route.",
            visualEvidence: "<teacher-reviewed single screenshot path, if available>"
          },
          blockedUntil: "teacher supplies or approves one visual evidence file and confirms one number"
        }
      })
    );
    continue;
  }

  rowResults.push(
    rowCall(row, {
      status: "waiting_for_teacher_signal_or_exclusion",
      actionTaken: "prepared_teacher_question_only",
      teacherQuestion: nextTeacherQuestion(row),
      nextCall: {
        tool: "teach_apprentice",
        arguments: {
          message: nextTeacherQuestion(row)
        },
        blockedUntil: "teacher provides a safe signal, route, target, or exclusion"
      }
    })
  );
}

const counts = {
  totalMatrixRows: allRows.length,
  filteredMatrixRows: filteredRows.length,
  selectedRows: rows.length,
  dryRunRunnerInvocations: rowResults.filter((row) => row.runnerInvoked).length,
  preparedRunnerCalls: rowResults.filter((row) => row.status === "dry_run_runner_call_prepared_waiting_for_teacher_review").length,
  controlChannelProbePackages: rowResults.filter((row) => row.status === "control_channel_probe_package_created_waiting_for_teacher_review").length,
  routeConfirmationRequests: rowResults.filter((row) => row.status === "waiting_for_numbered_target_or_exact_route_confirmation").length,
  visualTargetConfirmationRequests: rowResults.filter((row) => row.status === "waiting_for_visible_window_and_numbered_target_confirmation").length,
  teacherSignalQuestions: rowResults.filter((row) => row.status === "waiting_for_teacher_signal_or_exclusion").length,
  controlledRouteActionsExecuted: rowResults.filter((row) => row.controlledRouteActionExecuted).length
};

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  screenshotsCapturedByThisTool: false,
  uiEventsSent: false,
  softwareActionsExecuted: counts.controlledRouteActionsExecuted > 0,
  targetSoftwareCommandsExecuted: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  logContentsRead: false,
  fileContentsRead: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  allSoftwareExecutionComplete: false,
  teacherReviewed,
  dryRunFirst: true
};

const batch = {
  ok: true,
  format: "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
  batchId,
  createdAt: new Date().toISOString(),
  goal: matrix.goal || "",
  matrixPath: matrixInput.path,
  pilotQueuePath: pilotQueueInput?.path || "",
  selection: {
    startRow,
    maxRows,
    laneFilters,
    actionLogicSourceStatusFilters,
    filteredMatrixRows: filteredRows.length
  },
  teacherReviewed,
  counts,
  rowResults,
  nextTeacherActions: [
    "Review generated dry-run receipts and probe packages before rerunning the matrix.",
    "For route-ready rows, confirm one numbered target or exact structured route before creating pilot packages.",
    "For observation-only rows, review the control-channel probe results and convert only reviewed signals into control-channel profiles.",
    "Do not accept all-software execution until every in-scope app has reviewed route evidence or teacher-approved exclusion."
  ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This follow-up batch advances the next matrix lanes in bounded dry-run or review-only form. It does not prove universal native control for every installed application."
  },
  locks
};

const batchPath = join(batchDir, "all-software-execution-capability-matrix-follow-up-batch.json");
const receiptPath = join(batchDir, "all-software-execution-capability-matrix-follow-up-batch-receipt.json");
const readmePath = join(batchDir, "ALL_SOFTWARE_EXECUTION_CAPABILITY_MATRIX_FOLLOW_UP_BATCH_START_HERE.md");
writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
writeReadme(readmePath, batch);
writeFileSync(
  receiptPath,
  `${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_receipt_v1",
      batchId,
      status: "waiting_for_teacher_review",
      batchPath,
      readmePath,
      counts,
      accepted: false,
      ruleEnabled: false,
      technologyAccepted: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      locks
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_result_v1",
      status: "waiting_for_teacher_review",
      batchPath,
      receiptPath,
      readmePath,
      counts,
      locks
    },
    null,
    2
  )
);
