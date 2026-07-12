#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "current-goal-next-teacher-confirmation-cockpit-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "current-goal-next-teacher-confirmation-cockpit-receipt-validation"
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

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_reviewed_continue", "ready_for_follow_up", "ready_to_continue"].includes(text)) {
    return "teacher_reviewed_continue";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) {
    return "blocked";
  }
  if (["accepted", "execute_now", "create_queue", "read_logs", "capture_screenshot", "enable_rule", "write_memory", "delete_rollback_point", "claim_complete"].includes(text)) {
    return text;
  }
  return "needs_teacher_review";
}

function writeReadme(path, validation) {
  const lines = [
    "# Current Goal Next Teacher Confirmation Cockpit Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.id}: ${row.status}`),
    "",
    "Next safe commands:",
    ...validation.nextSafeCommands.map((command, index) => `${index + 1}. ${command.id}: ${command.command}`),
    "",
    "Safety boundary:",
    "- This validation only prepares copyable downstream commands.",
    "- It does not execute commands, create queues, read logs, capture screenshots, write memory, delete rollback points, enable rules, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate current-goal teacher confirmation cockpit receipt without running follow-up commands.");
const cockpitInput = readJsonInput(
  argValue("--cockpit", argValue("--teacher-confirmation-cockpit", "")),
  "--cockpit",
  "transparent_ai_current_goal_next_teacher_confirmation_cockpit_v1"
);
if (!cockpitInput.value) throw new Error("--cockpit is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), "artifacts", "current-goal-next-teacher-confirmation-cockpit-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const cockpit = cockpitInput.value;
const receipt = receiptInput.value;
const cards = new Map((cockpit.reviewCards || []).map((item) => [item.id, item]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "create_queue",
  "read_logs",
  "capture_screenshot",
  "enable_rule",
  "write_memory",
  "delete_rollback_point",
  "claim_complete",
  ...(cockpit.blockedActions || []),
  ...(receipt.blockedActions || [])
]);
const blockedActionsConfirmed = receipt.blockedActionsConfirmed === true;

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const card = cards.get(receiptRow.id);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const hasCommand = Boolean(card?.nextCommandAfterTeacherReview);
  const canAdvance =
    Boolean(card) &&
    decision === "teacher_reviewed_continue" &&
    evidenceReviewed &&
    hasCommand &&
    blockedActionsConfirmed &&
    !forbiddenDecision;
  return {
    id: receiptRow.id,
    title: card?.title || "",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    blockedActionsConfirmed,
    status: !card
      ? "unknown_cockpit_card"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : !blockedActionsConfirmed
          ? "blocked_until_teacher_confirms_forbidden_actions_remain_blocked"
          : canAdvance
            ? "ready_for_copy_only_downstream_command"
            : decision === "blocked"
              ? "blocked_by_teacher"
              : "needs_teacher_review_or_evidence",
    canAdvance,
    nextSafeCommand: canAdvance
      ? {
          id: `review_${card.id}`,
          cardId: card.id,
          title: card.title,
          command: card.nextCommandAfterTeacherReview,
          executesNow: false,
          blockedUntil: "teacher runs or routes the copied downstream command separately with its required receipt"
        }
      : null
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const readyRows = validationRows.filter((row) => row.canAdvance);
const waitingRows = validationRows.filter((row) => !row.canAdvance && row.status !== "blocked_for_forbidden_decision");
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0 && waitingRows.length === 0
    ? "all_rows_ready_for_copy_only_downstream_commands"
    : readyRows.length > 0
      ? "some_rows_ready_for_copy_only_downstream_commands"
      : "needs_teacher_review";
const status = forbiddenDecisionUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_reviewed_current_goal_confirmation_rows"
    : "waiting_for_teacher_review";
const nextSafeCommands = readyRows.map((row) => row.nextSafeCommand).filter(Boolean);

const validationPath = join(validationDir, "current-goal-next-teacher-confirmation-cockpit-receipt-validation.json");
const receiptPath = join(validationDir, "current-goal-next-teacher-confirmation-cockpit-receipt-validation-receipt.json");
const readmePath = join(validationDir, "CURRENT_GOAL_NEXT_TEACHER_CONFIRMATION_COCKPIT_RECEIPT_VALIDATION.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotExecuteCommands: true,
  validationDoesNotCreateQueues: true,
  validationDoesNotReadLogs: true,
  validationDoesNotCaptureScreenshots: true,
  validationDoesNotWriteMemory: true,
  validationDoesNotDeleteRollbackPoints: true,
  validationDoesNotClaimCompletion: true,
  commandsExecuted: false,
  queuesCreated: false,
  logsRead: false,
  screenshotsCaptured: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  rollbackPointsDeleted: false,
  goalComplete: false
};

const validation = {
  ok: true,
  format: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  blockedActionsConfirmed,
  counts: {
    readyRows: readyRows.length,
    waitingRows: waitingRows.length,
    totalRows: validationRows.length,
    nextSafeCommands: nextSafeCommands.length
  },
  validationRows,
  nextSafeCommands,
  blockedTransitions: [
    "execute_downstream_command_from_current_goal_cockpit_validation",
    "create_queue_from_current_goal_cockpit_validation",
    "read_logs_from_current_goal_cockpit_validation",
    "capture_screenshot_from_current_goal_cockpit_validation",
    "write_memory_from_current_goal_cockpit_validation",
    "delete_rollback_point_from_current_goal_cockpit_validation",
    "claim_goal_complete_from_current_goal_cockpit_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceCockpit: cockpitInput.path,
    sourceReceipt: receiptInput.path
  },
  locks,
  goalComplete: false
};

const validationReceipt = {
  format: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyRows: readyRows.length,
  commandsExecuted: false,
  queuesCreated: false,
  logsRead: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  rollbackPointsDeleted: false,
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
      format: "transparent_ai_current_goal_next_teacher_confirmation_cockpit_receipt_validation_result_v1",
      status,
      validationId,
      validationPath,
      receiptPath,
      readmePath,
      readyRowCount: readyRows.length,
      waitingRowCount: waitingRows.length,
      forbiddenDecisionUsed,
      nextSafeCommandCount: nextSafeCommands.length,
      goalComplete: false,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
