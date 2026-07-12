#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-coverage-evidence-dossier-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-coverage-evidence-dossier-receipt-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJsonFile(path, value) {
  writeFileSync(path, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    validationDoesNotRunFollowUpPlan: true,
    validationDoesNotRunBatch: true,
    validationDoesNotReadLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
    followUpPlanInvoked: false,
    batchRunnerInvoked: false,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
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
  if (["teacher_reviewed_collect_metadata_follow_up", "collect_metadata", "metadata_follow_up"].includes(text)) {
    return "teacher_reviewed_collect_metadata_follow_up";
  }
  if (["teacher_reviewed_promote_to_observer_queue", "promote_to_queue", "queue_enrollment"].includes(text)) {
    return "teacher_reviewed_promote_to_observer_queue";
  }
  if (["teacher_reviewed_prepare_signal_question", "prepare_signal_question", "ask_teacher"].includes(text)) {
    return "teacher_reviewed_prepare_signal_question";
  }
  if (["teacher_reviewed_ready_coverage_row", "ready_coverage_row"].includes(text)) {
    return "teacher_reviewed_ready_coverage_row";
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
      "read_full_logs",
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

function expectedDecisionsForBucket(bucket) {
  if (bucket === "waiting_for_low_token_watch_evidence") return ["teacher_reviewed_collect_metadata_follow_up"];
  if (bucket === "waiting_for_queue_enrollment") return ["teacher_reviewed_promote_to_observer_queue"];
  if (bucket === "needs_teacher_signal_or_exclusion") {
    return ["teacher_reviewed_prepare_signal_question", "teacher_excluded_or_private"];
  }
  if (bucket === "ready_for_teacher_coverage_review") return ["teacher_reviewed_ready_coverage_row"];
  if (bucket === "teacher_excluded_or_private") return ["teacher_excluded_or_private"];
  return [];
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Low-Token Coverage Dossier Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Ready follow-up rows: ${validation.readyFollowUpRowCount}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.ledgerNumber} ${row.software}: ${row.status}`),
    "",
    "Prepared next commands:",
    ...validation.nextReviewCommands.map((command, index) => `${index + 1}. ${command.commandLine}`),
    "",
    "Safety boundary:",
    "- This validation does not run the follow-up plan or batch.",
    "- It does not read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, or claim native universal execution.",
    "- A separate teacher action is required before any next command is run."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate original-goal low-token coverage dossier teacher receipt.");
const builderInput = readJsonInput(
  argValue("--builder", argValue("--receipt-builder", "")),
  "--builder",
  "transparent_ai_original_goal_low_token_coverage_dossier_receipt_builder_v1"
);
if (!builderInput.value) throw new Error("--builder is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_low_token_coverage_dossier_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-coverage-evidence-dossier-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const builderRows = new Map((builder.reviewRows || []).map((row) => [String(row.ledgerNumber), row]));
const forbidden = new Set([
  "accepted",
  "run_now",
  "execute_now",
  "allow_bounded_tail",
  "capture_screenshot",
  "read_full_logs",
  "execute_software",
  "register_schedule",
  "write_memory",
  "claim_complete",
  "native_universal_execution",
  "unlock_packaging"
]);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const sourceRow = builderRows.get(String(receiptRow.ledgerNumber));
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const expectedDecisions = expectedDecisionsForBucket(sourceRow?.bucket || receiptRow.bucket || "");
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const decisionMatchesBucket =
    expectedDecisions.includes(decision) ||
    decision === "blocked_needs_more_evidence" ||
    decision === "needs_teacher_review";
  const canPrepareFollowUp =
    Boolean(sourceRow) &&
    evidenceReviewed &&
    !forbiddenDecision &&
    decisionMatchesBucket &&
    [
      "teacher_reviewed_collect_metadata_follow_up",
      "teacher_reviewed_promote_to_observer_queue",
      "teacher_reviewed_prepare_signal_question"
    ].includes(decision);
  return {
    ledgerNumber: receiptRow.ledgerNumber,
    software: sourceRow?.software || receiptRow.software || "",
    bucket: sourceRow?.bucket || receiptRow.bucket || "",
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    expectedDecisions,
    evidenceReviewed,
    status: !sourceRow
      ? "unknown_dossier_row"
      : forbiddenDecision
        ? "blocked_for_forbidden_decision"
        : !decisionMatchesBucket
          ? "blocked_decision_does_not_match_dossier_bucket"
          : canPrepareFollowUp
            ? "ready_for_low_token_follow_up_plan"
            : decision === "teacher_reviewed_ready_coverage_row" && evidenceReviewed
              ? "ready_coverage_row_reviewed_but_not_completion"
              : decision === "teacher_excluded_or_private"
                ? "teacher_excluded_or_private"
                : decision === "blocked_needs_more_evidence"
                  ? "blocked_needs_more_evidence"
                  : "needs_teacher_review_or_evidence",
    canPrepareFollowUp,
    locks: locks()
  };
});

const forbiddenDecisionUsed = validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const readyFollowUpRows = validationRows.filter((row) => row.canPrepareFollowUp);
const reviewedReadyRows = validationRows.filter(
  (row) => row.status === "ready_coverage_row_reviewed_but_not_completion" && row.evidenceReviewed
);
const excludedRows = validationRows.filter((row) => row.status === "teacher_excluded_or_private");
const waitingRows = validationRows.filter(
  (row) => !row.canPrepareFollowUp && !["ready_coverage_row_reviewed_but_not_completion", "teacher_excluded_or_private"].includes(row.status)
);
const ledgerPath = builder.paths?.sourceLedger || "";
const sourceLedger = ledgerPath && existsSync(ledgerPath) ? readJson(ledgerPath) : null;
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyFollowUpRows.length > 0
    ? "ready_for_review_only_low_token_follow_up_plan"
    : reviewedReadyRows.length > 0 || excludedRows.length > 0
      ? "reviewed_rows_recorded_without_completion_claim"
      : "needs_teacher_review";
const status = forbiddenDecisionUsed
  ? "blocked"
  : readyFollowUpRows.length > 0
    ? "validated_ready_for_review_only_low_token_follow_up"
    : "waiting_for_teacher_low_token_coverage_review";
const reviewedLedgerNumbers = new Set(readyFollowUpRows.map((row) => String(row.ledgerNumber)));
const reviewedFollowUpLedgerRows = Array.isArray(sourceLedger?.rows)
  ? sourceLedger.rows.filter((row) => reviewedLedgerNumbers.has(String(row.ledgerNumber)))
  : [];
const reviewedFollowUpLedgerPath =
  readyFollowUpRows.length > 0 && sourceLedger
    ? join(validationDir, "reviewed-low-token-coverage-follow-up-ledger.json")
    : "";
if (reviewedFollowUpLedgerPath) {
  writeJsonFile(reviewedFollowUpLedgerPath, {
    ...sourceLedger,
    format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
    ledgerId: `${sourceLedger.ledgerId || "source-ledger"}-teacher-reviewed-follow-up-subset`,
    sourceLedgerPath: ledgerPath,
    subsetPurpose:
      "Contains only low-token coverage rows that the teacher reviewed in the original-goal coverage dossier receipt and marked ready for metadata/queue/signal follow-up.",
    rows: reviewedFollowUpLedgerRows,
    counts: {
      ...(sourceLedger.counts || {}),
      sourceLedgerRows: Array.isArray(sourceLedger.rows) ? sourceLedger.rows.length : 0,
      reviewedFollowUpRows: reviewedFollowUpLedgerRows.length,
      unreviewedRowsExcluded: Math.max(0, (Array.isArray(sourceLedger.rows) ? sourceLedger.rows.length : 0) - reviewedFollowUpLedgerRows.length)
    },
    locks: locks()
  });
}
const followUpPlanCommand =
  readyFollowUpRows.length > 0 && reviewedFollowUpLedgerPath
    ? `node plugins\\transparent-ai-apprentice\\scripts\\create-all-software-coverage-enrollment-follow-up-plan.mjs --ledger ${quote(reviewedFollowUpLedgerPath)} --output-dir ${quote(join(validationDir, "coverage-enrollment-follow-up-plan"))}`
    : "";
const followUpReceiptBuilderCommand =
  followUpPlanCommand
    ? `node plugins\\transparent-ai-apprentice\\scripts\\create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs --plan "<coverage-enrollment-follow-up-plan.json>" --output-dir ${quote(join(validationDir, "coverage-enrollment-follow-up-receipt-builder"))}`
    : "";
const nextReviewCommands = [];
if (followUpPlanCommand) {
  nextReviewCommands.push({
    tool: "create_all_software_coverage_enrollment_follow_up_plan",
    commandLine: followUpPlanCommand,
    readyLedgerNumbers: readyFollowUpRows.map((row) => row.ledgerNumber),
    reviewedFollowUpLedgerPath,
    sourceLedgerPath: ledgerPath,
    executesNow: false,
    blockedUntil: "teacher explicitly runs this review-only follow-up plan command against the reviewed subset ledger"
  });
  nextReviewCommands.push({
    tool: "create_all_software_coverage_enrollment_follow_up_receipt_builder",
    commandLine: followUpReceiptBuilderCommand,
    executesNow: false,
    blockedUntil: "a follow-up plan exists and the teacher chooses to generate the next receipt builder"
  });
}

const lockState = locks();
const validationPath = join(validationDir, "original-goal-low-token-coverage-dossier-receipt-validation.json");
const receiptPath = join(validationDir, "original-goal-low-token-coverage-dossier-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_DOSSIER_RECEIPT_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  forbiddenDecisionUsed,
  blocked: forbiddenDecisionUsed,
  readyFollowUpRowCount: readyFollowUpRows.length,
  reviewedReadyRowCount: reviewedReadyRows.length,
  excludedRowCount: excludedRows.length,
  waitingRowCount: waitingRows.length,
  validationRows,
  nextReviewCommands,
  blockedTransitions: [
    "run_follow_up_plan_from_validation",
    "run_enrollment_follow_up_batch_from_validation",
    "read_logs_from_validation",
    "capture_screenshot_from_validation",
    "execute_target_software_from_validation",
    "register_schedule_from_validation",
    "write_memory_from_validation",
    "claim_all_software_coverage_complete_from_validation",
    "claim_goal_complete_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceBuilder: builderInput.path,
    sourceReceipt: receiptInput.path,
    sourceDossier: builder.paths?.sourceDossier || "",
    sourceLedger: ledgerPath,
    reviewedFollowUpLedger: reviewedFollowUpLedgerPath
  },
  locks: lockState
};
const validationReceipt = {
  format: "transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyFollowUpRowCount: readyFollowUpRows.length,
  forbiddenDecisionUsed,
  followUpPlanInvoked: false,
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

writeJsonFile(validationPath, validation);
writeJsonFile(receiptPath, validationReceipt);
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_result_v1",
      validationPath,
      receiptPath,
      readmePath,
      status,
      validationDecision,
      blocked: forbiddenDecisionUsed,
      readyFollowUpRowCount: readyFollowUpRows.length,
      nextReviewCommands,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
