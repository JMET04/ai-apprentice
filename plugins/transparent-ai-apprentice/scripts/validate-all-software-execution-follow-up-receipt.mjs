#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-execution-follow-up-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-execution-follow-up-receipt-validation"
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
  if (["teacher_reviewed_prepare_dry_run", "ready_for_dry_run_review", "teacher_reviewed_continue"].includes(text)) {
    return "teacher_reviewed_prepare_dry_run";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (["accepted", "execute_now", "run_execute_mode", "memory_enabled", "claim_complete", "native_universal_execution"].includes(text)) return text;
  return "needs_teacher_review";
}

function writeReadme(path, validation) {
  const lines = [
    "# All-Software Execution Follow-Up Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.rowId}: ${row.status}`),
    "",
    "Prepared next review commands:",
    ...validation.nextDryRunReviewCommands.map(
      (command, index) => `${index + 1}. ${command.rowId}: ${command.tool} ${JSON.stringify(command.arguments)}`
    ),
    "",
    "Safety boundary:",
    "- This validation does not invoke dry-run runners.",
    "- It does not execute target software, send UI events, capture screenshots, write memory, enable rules, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate all-software execution follow-up teacher receipt.");
const batchInput = readJsonInput(
  argValue("--batch", argValue("--follow-up-batch", "")),
  "--batch",
  "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1"
);
if (!batchInput.value) throw new Error("--batch is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_execution_follow_up_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-follow-up-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const batch = batchInput.value;
const receipt = receiptInput.value;
const batchRows = new Map((batch.rowResults || []).map((row) => [row.rowId, row]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "run_execute_mode",
  "memory_enabled",
  "claim_complete",
  "native_universal_execution"
]);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const batchRow = batchRows.get(receiptRow.rowId);
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const preparedDryRunCall =
    batchRow?.status === "dry_run_runner_call_prepared_waiting_for_teacher_review" &&
    batchRow?.runnerInvoked !== true &&
    batchRow?.nextCall?.tool === "run_all_software_execution_pilot_runner";
  const canPrepareDryRunReview =
    Boolean(batchRow) &&
    decision === "teacher_reviewed_prepare_dry_run" &&
    evidenceReviewed &&
    preparedDryRunCall &&
    !forbiddenDecision;
  return {
    rowId: receiptRow.rowId,
    software: batchRow?.software || receiptRow.software || "",
    lane: batchRow?.lane || "unknown",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    status: !batchRow
      ? "unknown_batch_row"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : canPrepareDryRunReview
          ? "ready_for_dry_run_runner_review"
          : decision === "blocked_needs_more_evidence"
            ? "blocked_needs_more_evidence"
            : preparedDryRunCall
              ? "needs_teacher_review_or_evidence"
              : "blocked_not_a_prepared_dry_run_call",
    canPrepareDryRunReview,
    nextDryRunReviewCommand: canPrepareDryRunReview
      ? {
          rowId: batchRow.rowId,
          tool: batchRow.nextCall.tool,
          arguments: batchRow.nextCall.arguments,
          executesNow: false,
          blockedUntil: "teacher explicitly runs a separate dry-run-only runner review command"
        }
      : null
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const readyRows = validationRows.filter((row) => row.canPrepareDryRunReview);
const waitingRows = validationRows.filter((row) => !row.canPrepareDryRunReview && row.status !== "blocked_for_forbidden_decision");
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0 && waitingRows.length === 0
    ? "all_rows_ready_for_dry_run_runner_review"
    : readyRows.length > 0
      ? "some_rows_ready_for_dry_run_runner_review"
      : "needs_teacher_review";
const status = forbiddenDecisionUsed ? "blocked" : readyRows.length > 0 ? "validated_with_ready_dry_run_review_rows" : "waiting_for_teacher_execution_follow_up_review";
const nextDryRunReviewCommands = readyRows.map((row) => row.nextDryRunReviewCommand);
const validationPath = join(validationDir, "all-software-execution-follow-up-receipt-validation.json");
const receiptPath = join(validationDir, "all-software-execution-follow-up-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_EXECUTION_FOLLOW_UP_RECEIPT_VALIDATION_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  validationDoesNotInvokeRunner: true,
  validationDoesNotExecuteTargetSoftware: true,
  validationDoesNotSendUiEvents: true,
  validationDoesNotCaptureScreenshots: true,
  validationDoesNotWriteMemory: true,
  dryRunRunnerInvoked: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false
};
const validation = {
  ok: true,
  format: "transparent_ai_all_software_execution_follow_up_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  readyRowCount: readyRows.length,
  waitingRowCount: waitingRows.length,
  validationRows,
  nextDryRunReviewCommands,
  blockedTransitions: [
    "invoke_runner_from_validation",
    "execute_target_software_from_validation",
    "send_ui_events_from_validation",
    "write_memory_from_validation",
    "claim_all_software_execution_complete_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceBatch: batchInput.path,
    sourceReceipt: receiptInput.path
  },
  locks
};
const validationReceipt = {
  format: "transparent_ai_all_software_execution_follow_up_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyRowCount: readyRows.length,
  forbiddenDecisionUsed,
  dryRunRunnerInvoked: false,
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
      format: "transparent_ai_all_software_execution_follow_up_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyRowCount: readyRows.length,
      waitingRowCount: waitingRows.length,
      forbiddenDecisionUsed,
      validationPath,
      receiptPath,
      readmePath,
      locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
