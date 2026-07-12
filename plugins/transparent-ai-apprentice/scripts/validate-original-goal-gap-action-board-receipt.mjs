#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-gap-action-board-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-gap-action-board-receipt-validation"
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
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) {
      parts.push(flag);
      continue;
    }
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_reviewed_continue", "ready_for_follow_up", "ready_to_continue"].includes(text)) return "teacher_reviewed_continue";
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (["accepted", "execute_now", "register_now", "memory_enabled", "claim_complete", "native_universal_execution"].includes(text)) return text;
  return "needs_teacher_review";
}

function commandSafety(command) {
  const value = String(command || "");
  const lower = value.toLowerCase();
  const forbiddenMarkers = [
    "--teacher-reviewed",
    "--teacher-confirmed",
    "--execute",
    "-teacherconfirmed",
    "-execute",
    " execute-mode ",
    " run_execute_mode "
  ];
  const matchedForbiddenMarkers = forbiddenMarkers.filter((marker) => lower.includes(marker));
  return {
    safeForValidationHandoff: matchedForbiddenMarkers.length === 0,
    matchedForbiddenMarkers,
    reason: matchedForbiddenMarkers.length
      ? "downstream command contains a direct teacher-reviewed or execute-mode marker"
      : "downstream command is a review, receipt, validation, or preparation handoff"
  };
}

function downstreamCommand(row, board) {
  const lane = row.downstreamLane || row.lane;
  const reviewedCommand = row.nextSafeCommand || row.nextAction || "";
  if (lane === "automatic_learning_activation") {
    return {
      id: `validate_activation_receipt_for_${row.id}`,
      label: "Validate activation receipt before rerunning activation gate",
      command:
        reviewedCommand ||
        board.sourceEvidence?.activationReceiptValidation ||
        "Open the activation receipt builder, generate the activation receipt, then run validate-all-software-operational-activation-review-receipt.mjs.",
      executesNow: false
    };
  }
  if (lane === "all_software_low_token_coverage") {
    return {
      id: `review_coverage_rollout_for_${row.id}`,
      label: "Advance reviewed low-token coverage through rollout supervisor only after teacher review",
      command: reviewedCommand || "Run the bounded coverage rollout supervisor with teacher-reviewed evidence.",
      executesNow: false
    };
  }
  if (lane === "all_software_execution_capability") {
    return {
      id: `review_execution_capability_for_${row.id}`,
      label: "Advance execution capability through route confirmation or dry-run pilot gates",
      command: reviewedCommand || "Review matrix gaps, confirm routes or targets, then rerun the bounded execution capability supervisor.",
      executesNow: false
    };
  }
  return {
    id: `review_status_lane_for_${row.id}`,
    label: "Review status lane before advancing any completion claim",
    command: reviewedCommand || "Review evidence and route to the matching downstream gate.",
    executesNow: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Gap Action Board Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.status}`),
    "",
    "Next safe commands:",
    ...validation.nextSafeCommands.map((command, index) => `${index + 1}. ${command.label}: ${command.command}`),
    "",
    "Safety boundary:",
    "- This validation does not execute generated commands.",
    "- It does not register scheduled tasks, launch runners, execute target software, capture screenshots, write memory, enable rules, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate original goal gap action board teacher receipt.");
const boardInput = readJsonInput(
  argValue("--board", argValue("--gap-board", "")),
  "--board",
  "transparent_ai_original_goal_gap_action_board_v1"
);
if (!boardInput.value) throw new Error("--board is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_gap_action_board_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-gap-action-board-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const board = boardInput.value;
const receipt = receiptInput.value;
const boardRows = new Map((board.actionRows || []).map((row) => [row.id, row]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "register_now",
  "memory_enabled",
  "claim_complete",
  "native_universal_execution",
  ...(board.blockedActions || []),
  ...(receipt.blockedActions || [])
]);
const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const boardRow = boardRows.get(receiptRow.id);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const nextCommand = boardRow ? downstreamCommand(boardRow, board) : null;
  const nextCommandSafety = commandSafety(nextCommand?.command || "");
  const unsafeDownstreamCommand = Boolean(boardRow) && decision === "teacher_reviewed_continue" && !nextCommandSafety.safeForValidationHandoff;
  const canAdvance =
    Boolean(boardRow) &&
    decision === "teacher_reviewed_continue" &&
    evidenceReviewed &&
    !forbiddenDecision &&
    !unsafeDownstreamCommand;
  return {
    id: receiptRow.id,
    lane: boardRow?.lane || "unknown",
    downstreamLane: boardRow?.downstreamLane || boardRow?.lane || "unknown",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    status: !boardRow
      ? "unknown_board_row"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : unsafeDownstreamCommand
          ? "blocked_for_unsafe_downstream_command"
        : canAdvance
          ? "ready_for_downstream_gate_review"
          : decision === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : "needs_teacher_review_or_evidence",
    canAdvance,
    nextCommand: canAdvance ? nextCommand : null,
    nextCommandSafety
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const unsafeDownstreamCommandUsed = validationRows.some((row) => row.status === "blocked_for_unsafe_downstream_command");
const unknownRows = validationRows.filter((row) => row.status === "unknown_board_row");
const readyRows = validationRows.filter((row) => row.canAdvance);
const waitingRows = validationRows.filter((row) => !row.canAdvance && row.status !== "blocked_for_forbidden_decision");
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : unsafeDownstreamCommandUsed
    ? "blocked_for_unsafe_downstream_command"
    : readyRows.length > 0 && waitingRows.length === 0
      ? "all_rows_ready_for_downstream_gate_review"
      : readyRows.length > 0
        ? "some_rows_ready_for_downstream_gate_review"
        : "needs_teacher_review";
const status = forbiddenDecisionUsed || unsafeDownstreamCommandUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_reviewed_follow_up_rows"
    : "waiting_for_teacher_gap_review";
const nextSafeCommands = readyRows.map((row) => row.nextCommand);
const validationPath = join(validationDir, "original-goal-gap-action-board-receipt-validation.json");
const receiptPath = join(validationDir, "original-goal-gap-action-board-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_GAP_ACTION_BOARD_RECEIPT_VALIDATION_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotExecuteCommands: true,
  validationDoesNotRegisterTask: true,
  validationDoesNotLaunchRunner: true,
  validationDoesNotExecuteTargetSoftware: true,
  validationDoesNotCaptureScreenshots: true,
  validationDoesNotWriteMemory: true,
  scheduledTaskRegistered: false,
  runnerLaunched: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  goalComplete: false
};
const validation = {
  ok: true,
  format: "transparent_ai_original_goal_gap_action_board_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  unsafeDownstreamCommandUsed,
  readyRowCount: readyRows.length,
  waitingRowCount: waitingRows.length,
  unknownRowCount: unknownRows.length,
  validationRows,
  nextSafeCommands,
  blockedTransitions: [
    "execute_downstream_command_from_gap_validation",
    "handoff_direct_teacher_reviewed_or_execute_mode_command_from_gap_validation",
    "register_scheduled_task_from_gap_validation",
    "execute_target_software_from_gap_validation",
    "write_memory_from_gap_validation",
    "claim_original_goal_complete_from_gap_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceBoard: boardInput.path,
    sourceReceipt: receiptInput.path
  },
  locks
};
const validationReceipt = {
  format: "transparent_ai_original_goal_gap_action_board_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyRowCount: readyRows.length,
  forbiddenDecisionUsed,
  unsafeDownstreamCommandUsed,
  commandsExecuted: false,
  scheduledTaskRegistered: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  goalComplete: false,
  locks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_gap_action_board_receipt_validation_result_v1",
      status,
      validationDecision,
      validationPath,
      receiptPath,
      readmePath,
      readyRowCount: readyRows.length,
      forbiddenDecisionUsed,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed || unsafeDownstreamCommandUsed) process.exit(1);
