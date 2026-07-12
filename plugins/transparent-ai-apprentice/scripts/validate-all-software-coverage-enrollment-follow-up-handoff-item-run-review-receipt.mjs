#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "coverage-enrollment-handoff-item-run-review-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "coverage-enrollment-handoff-item-run-review-receipt-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonOptional(path) {
  if (!path || !existsSync(path)) return null;
  return readJson(path);
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
  if (["item_run_matched_expected", "matched_expected", "ready_for_reconciliation", "reviewed_for_reconciliation"].includes(text)) {
    return "item_run_matched_expected";
  }
  if (["item_run_mismatch_blocked", "mismatch_blocked", "blocked", "blocked_needs_more_evidence"].includes(text)) {
    return "item_run_mismatch_blocked";
  }
  if (
    [
      "accepted",
      "execute_now",
      "read_full_logs",
      "capture_screenshot_now",
      "write_memory",
      "claim_coverage_complete",
      "native_universal_execution",
      "unlock_packaging"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function q(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, q(value));
  }
  return parts.join(" ");
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRerunItem: true,
    validationDoesNotRunCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotReadLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Coverage Enrollment Handoff Item Run Review Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Selected follow-up: ${validation.selectedFollowUpId || ""}`,
    `Review scope: ${validation.reviewScope?.scopeKind || "unspecified"}`,
    "",
    "Validation checks:",
    ...validation.validationRows.map((row) => `- ${row.name}: ${row.status}`),
    "",
    "Prepared next review commands:",
    ...(validation.nextReviewCommands.length
      ? validation.nextReviewCommands.map((command, index) => `${index + 1}. ${command.label}: ${command.command}`)
      : ["- <none>"]),
    "",
    "Safety boundary:",
    "- This validation only checks the teacher review receipt for one coverage enrollment handoff item run.",
    "- It does not rerun the item, execute commands, register tasks, launch runners, read logs, capture screenshots, write memory, accept coverage, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher review for one coverage enrollment follow-up handoff item run.");
const builderInput = readJsonInput(
  argValue("--builder", argValue("--run-review-builder", "")),
  "--builder",
  "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_builder_v1"
);
if (!builderInput.value) throw new Error("--builder is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const runSummary = builder.runSummary || {};
const reviewScope = builder.reviewScope || runSummary.reviewScope || null;
const receiptReviewScope = receipt.reviewScope || null;
const batch = readJsonOptional(runSummary.batchPath);
const batchReceipt = readJsonOptional(runSummary.batchReceiptPath);
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecision = [
  "accepted",
  "execute_now",
  "read_full_logs",
  "capture_screenshot_now",
  "write_memory",
  "claim_coverage_complete",
  "native_universal_execution",
  "unlock_packaging"
].includes(decision);
const followUpMatches = String(receipt.selectedFollowUpId || "") === String(runSummary.selectedFollowUpId || "");
const runStatusMatches = String(receipt.itemRunStatus || "") === String(runSummary.status || "");
const evidenceReviewed = receipt.evidenceReviewed === true;
const batchReceiptReviewed = receipt.batchReceiptReviewed === true;
const lowTokenOutcomeReviewed = receipt.lowTokenOutcomeReviewed === true;
const matchedExpected = receipt.teacherMatchedExpected === true && decision === "item_run_matched_expected";
const rollbackRetained = receipt.rollbackPointStillRetained === true;
const preserveBlockerIfMismatch = receipt.preserveBlockerIfMismatch !== false;
const teacherConfirmation = String(receipt.teacherConfirmation || "").trim();
const reviewScopeVerified =
  !reviewScope ||
  (receiptReviewScope &&
    String(receiptReviewScope.scopeKind || "") === String(reviewScope.scopeKind || "") &&
    String(receiptReviewScope.currentLedgerPath || "") === String(reviewScope.currentLedgerPath || "") &&
    String(receiptReviewScope.sourceLedgerPath || "") === String(reviewScope.sourceLedgerPath || ""));
const runEvidencePresent =
  runSummary.runnerInvoked === true &&
  runSummary.status === "reviewed_coverage_enrollment_follow_up_handoff_item_advanced" &&
  Boolean(runSummary.batchPath) &&
  batch?.format === "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1" &&
  (batchReceipt === null || batchReceipt?.format === "transparent_ai_all_software_coverage_enrollment_follow_up_batch_receipt_v1");
const reviewed =
  !forbiddenDecision &&
  matchedExpected &&
  followUpMatches &&
  runStatusMatches &&
  evidenceReviewed &&
  batchReceiptReviewed &&
  lowTokenOutcomeReviewed &&
  rollbackRetained &&
  preserveBlockerIfMismatch &&
  reviewScopeVerified &&
  Boolean(teacherConfirmation) &&
  runEvidencePresent;

const validationRows = [
  { name: "decision", status: forbiddenDecision ? "blocked_for_forbidden_decision" : decision },
  { name: "selected_follow_up_matches_builder", status: followUpMatches ? "matched" : "blocked_for_follow_up_mismatch" },
  { name: "run_status_matches_builder", status: runStatusMatches ? "matched" : "blocked_for_run_status_mismatch" },
  { name: "run_evidence_present", status: runEvidencePresent ? "present" : "blocked_for_missing_run_evidence" },
  { name: "evidence_reviewed", status: evidenceReviewed ? "reviewed" : "needs_teacher_review" },
  { name: "batch_receipt_reviewed", status: batchReceiptReviewed ? "reviewed" : "needs_teacher_review" },
  { name: "low_token_outcome_reviewed", status: lowTokenOutcomeReviewed ? "reviewed" : "needs_teacher_review" },
  { name: "teacher_matched_expected", status: matchedExpected ? "matched" : "needs_teacher_review_or_mismatch" },
  { name: "rollback_point_still_retained", status: rollbackRetained ? "retained" : "blocked_for_missing_rollback" },
  { name: "preserve_blocker_if_mismatch", status: preserveBlockerIfMismatch ? "preserved" : "blocked_for_unlocked_mismatch" },
  { name: "review_scope_verified", status: reviewScopeVerified ? "verified" : "blocked_for_review_scope_mismatch" },
  { name: "teacher_confirmation", status: teacherConfirmation ? "present" : "blocked_for_missing_confirmation" }
];
const reconciliationCommand = reviewed
  ? commandLine("reconcile-all-software-coverage-enrollment-follow-up-batch.mjs", [
      ["--batch", runSummary.batchPath],
      ["--plan", runSummary.planPath],
      ["--ledger", reviewScope?.currentLedgerPath || ""],
      ["--queue", runSummary.queuePath],
      ["--teacher-reviewed-rerun", "true"],
      ["--output-dir", join(validationDir, "coverage-enrollment-follow-up-reconciliation")]
    ])
  : "";
const nextReviewCommands = reconciliationCommand
  ? [
      {
        label: "Review-only reconciliation after matched coverage enrollment handoff item run",
        tool: "reconcile_all_software_coverage_enrollment_follow_up_batch",
        command: reconciliationCommand,
        executesNow: false,
        blockedUntil: "teacher confirms the run review receipt remains accurate and rollback evidence is retained"
      }
    ]
  : [];
const validationDecision = forbiddenDecision
  ? "blocked_for_forbidden_decision"
  : reviewed
    ? "coverage_enrollment_handoff_item_run_reviewed_for_reconciliation"
    : decision === "item_run_mismatch_blocked"
      ? "blocked_by_teacher_mismatch"
      : "needs_teacher_review_or_missing_evidence";
const status = reviewed
  ? "validated_ready_for_review_only_reconciliation"
  : forbiddenDecision || decision === "item_run_mismatch_blocked"
    ? "blocked"
    : "waiting_for_teacher_review";
const validationPath = join(validationDir, "coverage-enrollment-handoff-item-run-review-receipt-validation.json");
const receiptPath = join(validationDir, "coverage-enrollment-handoff-item-run-review-receipt-validation-receipt.json");
const readmePath = join(validationDir, "COVERAGE_ENROLLMENT_HANDOFF_ITEM_RUN_REVIEW_RECEIPT_VALIDATION_START_HERE.md");
const reviewLocks = locks();
const validation = {
  ok: true,
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  selectedFollowUpId: runSummary.selectedFollowUpId || "",
  sourceBuilder: builderInput.path,
  sourceReceipt: receiptInput.path,
  reviewScope,
  reviewScopeVerified,
  validationRows,
  nextReviewCommands,
  blockedTransitions: [
    "rerun_coverage_enrollment_handoff_item_from_validation",
    "run_reconciliation_from_validation",
    "read_logs_from_validation",
    "capture_screenshot_from_validation",
    "execute_target_software_from_validation",
    "write_memory_from_validation",
    "claim_all_software_coverage_complete_from_validation",
    "claim_native_universal_execution_from_validation",
    "unlock_packaging_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceBuilder: builderInput.path,
    sourceTeacherReceipt: receiptInput.path,
    batch: runSummary.batchPath || "",
    batchReceipt: runSummary.batchReceiptPath || "",
    validationDir
  },
  locks: reviewLocks
};
const validationReceipt = {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  reviewScope,
  reviewScopeVerified,
  nextReviewCommandCount: nextReviewCommands.length,
  scheduledTaskRegistered: false,
  runnerLaunched: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  goalComplete: false,
  locks: reviewLocks
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);
console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      selectedFollowUpId: validation.selectedFollowUpId,
      reviewScope,
      reviewScopeVerified,
      validationPath,
      receiptPath,
      readmePath,
      nextReviewCommandCount: nextReviewCommands.length,
      scheduledTaskRegistered: false,
      runnerLaunched: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareCoverageComplete: false,
      goalComplete: false,
      locks: reviewLocks
    },
    null,
    2
  )
);

if (forbiddenDecision) process.exit(1);
