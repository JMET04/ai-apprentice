#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "all-software-coverage-enrollment-follow-up-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "all-software-coverage-enrollment-follow-up-receipt-validation"
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

function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunBatch: true,
    validationDoesNotReadLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
    batchRunnerInvoked: false,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    screenshotsCapturedByThisTool: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_reviewed_run_metadata_gate", "ready_for_metadata_gate"].includes(text)) {
    return "teacher_reviewed_run_metadata_gate";
  }
  if (["teacher_reviewed_prepare_signal_question", "ready_for_signal_question"].includes(text)) {
    return "teacher_reviewed_prepare_signal_question";
  }
  if (["teacher_excluded_or_private", "excluded", "private"].includes(text)) return "teacher_excluded_or_private";
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (
    [
      "accepted",
      "run_now",
      "execute_now",
      "allow_bounded_tail",
      "capture_screenshot",
      "execute_software",
      "register_schedule",
      "write_memory",
      "claim_complete",
      "native_universal_execution",
      "unlock_packaging"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function expectedDecisionForRoute(route) {
  if (route === "collect_watch_or_queue_item_evidence" || route === "promote_inventory_row_to_observer_queue") {
    return "teacher_reviewed_run_metadata_gate";
  }
  if (route === "ask_teacher_for_signal_or_exclusion") return "teacher_reviewed_prepare_signal_question";
  if (route === "preserve_teacher_exclusion") return "teacher_excluded_or_private";
  return "";
}

function writeReadme(path, validation) {
  const lines = [
    "# All-Software Coverage Enrollment Follow-Up Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Review scope: ${validation.reviewScope?.scopeKind || "unspecified"}`,
    `Batch scope: ${validation.reviewBatchScope?.mode || "unspecified"} (${validation.reviewBatchScope?.includedRows ?? 0} of ${validation.reviewBatchScope?.totalFollowUpRows ?? 0} rows)`,
    validation.reviewBatchScope?.omittedRows
      ? `Omitted rows still waiting for later review: ${validation.reviewBatchScope.omittedRows}`
      : "",
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.followUpId}: ${row.status}`),
    "",
    "Prepared next review commands:",
    ...validation.nextBatchReviewCommands.map((command, index) => `${index + 1}. ${command.commandLine}`),
    "",
    "Safety boundary:",
    "- This validation does not run the enrollment follow-up batch.",
    "- It does not read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, or claim native universal execution.",
    "- A separate teacher action is required before any `--teacher-reviewed` batch command is run."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate all-software coverage enrollment follow-up teacher receipt.");
const planInput = readJsonInput(
  argValue("--plan", argValue("--follow-up-plan", "")),
  "--plan",
  "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1"
);
if (!planInput.value) throw new Error("--plan is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const plan = planInput.value;
const receipt = receiptInput.value;
const reviewScope = plan.reviewScope || null;
const planItems = new Map((plan.followUpItems || []).map((item) => [String(item.followUpId), item]));
const reviewBatchScope = {
  mode: receipt.reviewBatchScope?.mode || "full_enrollment_follow_up_review",
  totalFollowUpRows: receipt.reviewBatchScope?.totalFollowUpRows ?? (plan.followUpItems || []).length,
  includedRows: receipt.reviewBatchScope?.includedRows ?? (receipt.rowDecisions || []).length,
  omittedRows:
    receipt.reviewBatchScope?.omittedRows ??
    Math.max(0, (plan.followUpItems || []).length - (receipt.rowDecisions || []).length),
  offsetRows: receipt.reviewBatchScope?.offsetRows ?? 0,
  maxRows: receipt.reviewBatchScope?.maxRows ?? null,
  teacherMustReviewOnlyIncludedRows: true,
  omittedRowsRemainWaitingForLaterReview:
    receipt.reviewBatchScope?.omittedRowsRemainWaitingForLaterReview === true ||
    Math.max(0, (plan.followUpItems || []).length - (receipt.rowDecisions || []).length) > 0
};
const forbidden = new Set([
  "accepted",
  "run_now",
  "execute_now",
  "allow_bounded_tail",
  "capture_screenshot",
  "execute_software",
  "register_schedule",
  "write_memory",
  "claim_complete",
  "native_universal_execution",
  "unlock_packaging"
]);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const item = planItems.get(String(receiptRow.followUpId));
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const expectedDecision = expectedDecisionForRoute(item?.route || "");
  const decisionMatchesRoute =
    decision === expectedDecision ||
    decision === "blocked_needs_more_evidence" ||
    decision === "teacher_excluded_or_private" ||
    decision === "needs_teacher_review";
  const canPrepareBatch =
    Boolean(item) &&
    evidenceReviewed &&
    !forbiddenDecision &&
    decisionMatchesRoute &&
    ["teacher_reviewed_run_metadata_gate", "teacher_reviewed_prepare_signal_question"].includes(decision);
  return {
    followUpId: receiptRow.followUpId,
    ledgerNumber: item?.ledgerNumber || receiptRow.ledgerNumber || "",
    software: item?.software || receiptRow.software || "",
    route: item?.route || "",
    tool: item?.tool || "",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    expectedDecision,
    evidenceReviewed,
    status: !item
      ? "unknown_plan_follow_up_item"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : !decisionMatchesRoute
          ? "blocked_decision_does_not_match_follow_up_route"
          : canPrepareBatch
            ? "ready_for_reviewed_enrollment_follow_up_batch_command"
            : decision === "blocked_needs_more_evidence"
              ? "blocked_needs_more_evidence"
              : decision === "teacher_excluded_or_private"
                ? "teacher_excluded_or_private"
                : "needs_teacher_review_or_evidence",
    canPrepareBatch,
    locks: locks()
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const readyRows = validationRows.filter((row) => row.canPrepareBatch);
const waitingRows = validationRows.filter((row) => !row.canPrepareBatch && row.status !== "blocked_for_forbidden_decision");
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyRows.length > 0 && waitingRows.length === 0
    ? "all_ready_rows_can_prepare_reviewed_enrollment_batch"
    : readyRows.length > 0
      ? "some_rows_can_prepare_reviewed_enrollment_batch"
      : "needs_teacher_review";
const status = forbiddenDecisionUsed
  ? "blocked"
  : readyRows.length > 0
    ? "validated_with_ready_enrollment_follow_up_rows"
    : "waiting_for_teacher_enrollment_follow_up_review";
const maxItems = Math.max(1, readyRows.length || 1);
const commandLine =
  readyRows.length > 0
    ? `node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-enrollment-follow-up-batch.mjs --plan ${quote(planInput.path || "<follow-up-plan.json>")} --teacher-reviewed --max-items ${maxItems} --max-queue-items ${maxItems} --max-logs-per-item 1 --max-tail-lines 16 --max-tail-bytes 1024`
    : "";
const nextBatchReviewCommands =
  readyRows.length > 0
    ? [
        {
          tool: "run_all_software_coverage_enrollment_follow_up_batch",
          arguments: {
            plan: planInput.path,
            teacherReviewed: true,
            reviewScope,
            maxItems,
            maxQueueItems: maxItems,
            maxLogsPerItem: 1,
            maxTailLines: 16,
            maxTailBytes: 1024,
            allowBoundedTail: false,
            executeNow: false
          },
          readyFollowUpIds: readyRows.map((row) => row.followUpId),
          commandLine,
          executesNow: false,
          blockedUntil: "teacher explicitly runs the reviewed enrollment follow-up batch command"
        }
      ]
    : [];

const validationPath = join(validationDir, "all-software-coverage-enrollment-follow-up-receipt-validation.json");
const receiptPath = join(validationDir, "all-software-coverage-enrollment-follow-up-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ALL_SOFTWARE_COVERAGE_ENROLLMENT_FOLLOW_UP_RECEIPT_VALIDATION_START_HERE.md");
const lockState = locks();
const validation = {
  ok: true,
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  readyRowCount: readyRows.length,
  waitingRowCount: waitingRows.length,
  omittedRowCount: reviewBatchScope.omittedRows,
  reviewScope,
  reviewBatchScope,
  validationRows,
  nextBatchReviewCommands,
  blockedTransitions: [
    "run_enrollment_follow_up_batch_from_validation",
    "allow_bounded_tail_from_validation",
    "capture_screenshot_from_validation",
    "execute_target_software_from_validation",
    "register_schedule_from_validation",
    "write_memory_from_validation",
    "claim_all_software_coverage_complete_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceFollowUpPlan: planInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: lockState
};
const validationReceipt = {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyRowCount: readyRows.length,
  waitingRowCount: waitingRows.length,
  omittedRowCount: reviewBatchScope.omittedRows,
  forbiddenDecisionUsed,
  reviewScope,
  reviewBatchScope,
  batchRunnerInvoked: false,
  screenshotsCaptured: false,
  targetSoftwareCommandsExecuted: false,
  scheduledTaskInstalled: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false,
  locks: lockState
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyRowCount: readyRows.length,
      waitingRowCount: waitingRows.length,
      omittedRowCount: reviewBatchScope.omittedRows,
      forbiddenDecisionUsed,
      reviewScope,
      reviewBatchScope,
      validationPath,
      receiptPath,
      readmePath,
      nextBatchReviewCommands,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
