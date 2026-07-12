#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "goal-teacher-review-cockpit-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "goal-teacher-review-cockpit-receipt-validation"
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
  if (["teacher_reviewed_continue", "ready_for_follow_up", "ready_to_continue"].includes(text)) return "teacher_reviewed_continue";
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (["accepted", "execute_now", "register_schedule", "enable_memory", "claim_complete", "unlock_packaging"].includes(text)) return text;
  return "needs_teacher_review";
}

function writeReadme(path, validation) {
  const lines = [
    "# Goal Teacher Review Cockpit Receipt Validation",
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
    "- This validation only prepares downstream commands.",
    "- It does not execute commands, validate downstream receipts, register schedules, launch runners, capture screenshots, write memory, enable rules, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher review cockpit receipt without executing follow-up commands.");
const cockpitInput = readJsonInput(
  argValue("--cockpit", argValue("--teacher-review-cockpit", "")),
  "--cockpit",
  "transparent_ai_goal_teacher_review_cockpit_v1"
);
if (!cockpitInput.value) throw new Error("--cockpit is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_goal_teacher_review_cockpit_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "goal-teacher-review-cockpit-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const cockpit = cockpitInput.value;
const receipt = receiptInput.value;
const reviewItems = new Map((cockpit.reviewItems || []).map((item) => [item.id, item]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "register_schedule",
  "enable_memory",
  "claim_complete",
  "unlock_packaging",
  ...(cockpit.blockedActions || []),
  ...(receipt.blockedActions || [])
]);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const item = reviewItems.get(receiptRow.id);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const canAdvance = Boolean(item) && decision === "teacher_reviewed_continue" && evidenceReviewed && !forbiddenDecision;
  return {
    id: receiptRow.id,
    title: item?.title || "",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    status: !item
      ? "unknown_cockpit_item"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : canAdvance
          ? "ready_for_downstream_receipt_or_gate_review"
          : decision === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : "needs_teacher_review_or_evidence",
    canAdvance,
    nextSafeCommand: canAdvance && item.command
      ? {
          id: `review_${item.id}`,
          itemId: item.id,
          title: item.title,
          command: item.command,
          executesNow: false,
          blockedUntil: "teacher runs the copied downstream validation command separately with its required receipt"
        }
      : null
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const unknownRows = validationRows.filter((row) => row.status === "unknown_cockpit_item");
const readyRows = validationRows.filter((row) => row.canAdvance);
const waitingRows = validationRows.filter((row) => !row.canAdvance && row.status !== "blocked_for_forbidden_decision");
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0 && waitingRows.length === 0
    ? "all_rows_ready_for_downstream_review"
    : readyRows.length > 0
      ? "some_rows_ready_for_downstream_review"
      : "needs_teacher_review";
const status = forbiddenDecisionUsed ? "blocked" : readyRows.length > 0 ? "validated_with_reviewed_cockpit_rows" : "waiting_for_teacher_review";
const nextSafeCommands = readyRows.map((row) => row.nextSafeCommand).filter(Boolean);

const validationPath = join(validationDir, "goal-teacher-review-cockpit-receipt-validation.json");
const receiptPath = join(validationDir, "goal-teacher-review-cockpit-receipt-validation-receipt.json");
const readmePath = join(validationDir, "GOAL_TEACHER_REVIEW_COCKPIT_RECEIPT_VALIDATION_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotExecuteCommands: true,
  validationDoesNotValidateDownstreamReceipts: true,
  validationDoesNotRegisterTask: true,
  validationDoesNotLaunchRunner: true,
  validationDoesNotCaptureScreenshots: true,
  validationDoesNotWriteMemory: true,
  commandsExecuted: false,
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
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  readyRowCount: readyRows.length,
  waitingRowCount: waitingRows.length,
  unknownRowCount: unknownRows.length,
  validationRows,
  nextSafeCommands,
  blockedTransitions: [
    "execute_downstream_command_from_cockpit_validation",
    "register_schedule_from_cockpit_validation",
    "validate_downstream_receipt_from_cockpit_validation",
    "write_memory_from_cockpit_validation",
    "claim_goal_complete_from_cockpit_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceCockpit: cockpitInput.path,
    sourceReceipt: receiptInput.path
  },
  locks
};

const validationReceipt = {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyRowCount: readyRows.length,
  forbiddenDecisionUsed,
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
      status,
      format: "transparent_ai_goal_teacher_review_cockpit_receipt_validation_result_v1",
      validationId,
      validationPath,
      receiptPath,
      readmePath,
      readyRowCount: readyRows.length,
      waitingRowCount: waitingRows.length,
      forbiddenDecisionUsed,
      nextSafeCommandCount: nextSafeCommands.length,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
