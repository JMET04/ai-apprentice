#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "triggered-visual-learning-review-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "triggered-visual-learning-review-receipt-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
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
  if (["correct", "correction", "correct_learning_card", "teacher_correction"].includes(text)) return "correct_learning_card";
  if (["ready", "ready_for_follow_up", "follow_up"].includes(text)) return "ready_for_follow_up";
  if (
    [
      "accepted",
      "accept",
      "approve",
      "approved",
      "enable_rule",
      "rule_enabled",
      "write_memory",
      "save_memory",
      "execute_software",
      "run_software",
      "capture_more",
      "continuous_recording",
      "unlock_packaging",
      "claim_complete"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteSoftware: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Triggered Visual Learning Review Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.normalizedDecision}`,
    `Ready for review-only follow-up: ${validation.readyForReviewOnlyFollowUp}`,
    "",
    "Checks:",
    ...validation.checks.map((check) => `- ${check.name}: ${check.pass ? "pass" : "fail"}`),
    "",
    "Safety boundary:",
    "- This validation only reviews the teacher receipt for a triggered visual learning card.",
    "- It does not capture screenshots, execute target software, read full logs, write memory, enable rules, unlock packaging, or claim completion.",
    "- Even ready_for_follow_up means review-only follow-up, not acceptance."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const reviewInput = readJsonInput(
  argValue("--review", argValue("--handoff-review", "")),
  "--review",
  "transparent_ai_triggered_visual_evidence_learning_handoff_review_result_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_triggered_visual_evidence_learning_handoff_review_receipt_v1"
);

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "triggered-visual-learning-review-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify("triggered visual learning review receipt")}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const review = reviewInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision || receipt.defaultDecision);
const forbiddenDecision = new Set([
  "accepted",
  "accept",
  "approve",
  "approved",
  "enable_rule",
  "rule_enabled",
  "write_memory",
  "save_memory",
  "execute_software",
  "run_software",
  "capture_more",
  "continuous_recording",
  "unlock_packaging",
  "claim_complete"
]).has(decision);
const confirmations = receipt.teacherConfirmations || {};
const mustKeep = receipt.mustKeep || {};
const reviewLocks = review.locks || {};
const evidenceFiles = Array.isArray(review.evidenceFiles) ? review.evidenceFiles : [];
const missingEvidenceFiles = evidenceFiles.filter((file) => !existsSync(file));

const confirmationChecks = [
  ["lowTokenTriggerReviewed", confirmations.lowTokenTriggerReviewed === true],
  ["captureReceiptReviewed", confirmations.captureReceiptReviewed === true],
  ["exactlyOneVisualEvidenceFile", confirmations.exactlyOneVisualEvidenceFile === true],
  ["visualEvidenceUsedOnlyWithTriggerReceipt", confirmations.visualEvidenceUsedOnlyWithTriggerReceipt === true],
  ["noContinuousRecording", confirmations.noContinuousRecording === true],
  ["noSoftwareExecution", confirmations.noSoftwareExecution === true],
  ["noMemoryWrite", confirmations.noMemoryWrite === true],
  ["ruleRemainsDisabled", confirmations.ruleRemainsDisabled === true],
  ["packagingRemainsLocked", confirmations.packagingRemainsLocked === true]
];

const checks = [
  {
    name: "review ids and paths match",
    pass: receipt.reviewId === review.reviewId && (!receipt.reviewPath || resolve(receipt.reviewPath) === reviewInput.path)
  },
  {
    name: "review card is ready for teacher review",
    pass: review.status === "waiting_for_teacher_review" && review.learningCardStatus === "waiting_for_teacher_review"
  },
  {
    name: "combined low-token request receipt and one visual evidence are present",
    pass: evidenceFiles.length >= 3 && missingEvidenceFiles.length === 0
  },
  {
    name: "review locks keep screenshots execution memory rules and packaging closed",
    pass:
      reviewLocks.handoffReviewDoesNotCaptureScreenshots === true &&
      reviewLocks.handoffReviewDoesNotExecuteSoftware === true &&
      reviewLocks.handoffReviewDoesNotWriteMemory === true &&
      reviewLocks.handoffReviewDoesNotEnableRules === true &&
      reviewLocks.screenshotsCaptured === false &&
      reviewLocks.softwareActionsExecuted === false &&
      reviewLocks.memoryWritten === false &&
      reviewLocks.accepted === false &&
      reviewLocks.packagingGated === true
  },
  {
    name: "teacher receipt keeps locked defaults",
    pass:
      mustKeep.reviewOnly === true &&
      mustKeep.accepted === false &&
      mustKeep.ruleEnabled === false &&
      mustKeep.packagingGated === true &&
      mustKeep.screenshotsCapturedByReview === false &&
      mustKeep.softwareActionsExecuted === false &&
      mustKeep.memoryWritten === false
  },
  {
    name: "teacher decision is review-only",
    pass: ["needs_teacher_review", "correct_learning_card", "ready_for_follow_up"].includes(decision) && !forbiddenDecision
  },
  {
    name: "ready follow-up has all teacher confirmations",
    pass: decision !== "ready_for_follow_up" || confirmationChecks.every(([, pass]) => pass)
  }
];

const failedChecks = checks.filter((check) => !check.pass);
const readyForReviewOnlyFollowUp =
  decision === "ready_for_follow_up" && failedChecks.length === 0 && confirmationChecks.every(([, pass]) => pass);

const status = forbiddenDecision
  ? "blocked_forbidden_teacher_decision"
  : failedChecks.length > 0
    ? "blocked_missing_or_mismatched_triggered_visual_review_evidence"
    : decision === "correct_learning_card"
      ? "ready_for_teacher_correction_follow_up"
      : readyForReviewOnlyFollowUp
        ? "ready_for_review_only_follow_up_not_memory"
        : "waiting_for_teacher_review";

const validationPath = join(validationDir, "triggered-visual-learning-review-receipt-validation.json");
const readmePath = join(validationDir, "TRIGGERED_VISUAL_LEARNING_REVIEW_RECEIPT_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_triggered_visual_evidence_learning_handoff_review_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  normalizedDecision: decision,
  reviewPath: reviewInput.path,
  receiptPath: receiptInput.path,
  readyForReviewOnlyFollowUp,
  canWriteMemory: false,
  canEnableRules: false,
  canExecuteSoftware: false,
  canUnlockPackaging: false,
  missingEvidenceFiles,
  confirmationChecks: confirmationChecks.map(([name, pass]) => ({ name, pass })),
  checks,
  nextAllowedActions:
    status === "ready_for_review_only_follow_up_not_memory"
      ? ["prepare_review_only_follow_up", "ask_teacher_for_explicit_memory_approval_in_separate_gate"]
      : status === "ready_for_teacher_correction_follow_up"
        ? ["apply_teacher_correction_to_learning_card_review_only", "rerun_receipt_validation_after_correction"]
        : ["repair_or_continue_teacher_review"],
  blockedActions: [
    "accept_visual_learning_from_this_receipt",
    "write_memory_from_this_receipt",
    "enable_rule_from_this_receipt",
    "capture_additional_screenshots",
    "execute_target_software",
    "unlock_packaging",
    "claim_original_goal_complete"
  ],
  locks: locks()
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(JSON.stringify({
  ok: true,
  format: validation.format,
  validationId,
  validationPath,
  teacherReadme: readmePath,
  status,
  normalizedDecision: decision,
  readyForReviewOnlyFollowUp,
  canWriteMemory: false,
  canEnableRules: false,
  canExecuteSoftware: false,
  canUnlockPackaging: false,
  failedChecks: failedChecks.map((check) => check.name)
}, null, 2));

if (forbiddenDecision || failedChecks.length > 0) process.exitCode = 1;
