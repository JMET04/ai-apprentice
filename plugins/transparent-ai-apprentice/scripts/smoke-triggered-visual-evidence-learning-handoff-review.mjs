#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "triggered-visual-learning-handoff-review-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runNodeScriptAllowFailure(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.stdout ? JSON.parse(result.stdout) : null
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const monitorPath = join(smokeRoot, "delta-monitor.json");
writeFileSync(monitorPath, JSON.stringify({
  format: "transparent_ai_software_observation_delta_monitor_v1",
  software: "generic non-CAD desktop app",
  processName: "GenericApp.exe",
  windowTitle: "Generic App",
  counts: { changedLogs: 1, addedLogs: 0, removedLogs: 0 },
  delta: {
    changedLogs: [
      {
        path: join(smokeRoot, "generic-app.log"),
        classification: "failure_or_blocker",
        current: { retainedSnippet: "ERROR export failed after user clicked save" }
      }
    ],
    addedLogs: [],
    removedLogs: []
  },
  screenshotPolicy: {
    screenshotRecommended: true,
    screenshotCaptured: false,
    fullContinuousRecording: false,
    reason: "cheap_signal_failure_or_blocker"
  }
}, null, 2), "utf8");

const request = runNodeScript("create-triggered-visual-check-request.mjs", [
  "--delta-monitor",
  monitorPath,
  "--software",
  "generic non-CAD desktop app",
  "--target-window-title",
  "Generic App",
  "--output-dir",
  join(smokeRoot, "request")
]);

const sourceImagePath = join(smokeRoot, "teacher-reviewed-bounded-screenshot.png");
writeFileSync(
  sourceImagePath,
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64")
);

const capture = runNodeScript("capture-triggered-visual-check.mjs", [
  "--request",
  request.packetPath,
  "--teacher-confirmed",
  "--reviewed-source-image",
  sourceImagePath,
  "--target-window-title",
  "Generic App",
  "--teacher-note",
  "teacher confirmed one bounded visual check for review-card handoff",
  "--output-dir",
  join(smokeRoot, "capture")
]);

const handoff = runNodeScript("create-triggered-visual-evidence-learning-handoff.mjs", [
  "--capture-receipt",
  capture.receiptPath,
  "--request",
  request.packetPath,
  "--goal",
  "Learn from a low-token log delta plus one teacher-confirmed bounded visual check.",
  "--output-dir",
  join(smokeRoot, "learning-handoff")
]);
const handoffPacket = readJson(handoff.handoffPath);

const review = runNodeScript("run-triggered-visual-evidence-learning-handoff-review.mjs", [
  "--handoff",
  handoff.handoffPath,
  "--output-dir",
  join(smokeRoot, "learning-handoff-review")
]);
const reviewPacket = readJson(review.reviewPath);
const learningCard = readJson(review.learningCardPath);
const receiptTemplate = readJson(review.teacherReceiptTemplatePath);
const filledReceiptPath = join(smokeRoot, "teacher-triggered-visual-learning-review-receipt.json");
writeFileSync(filledReceiptPath, JSON.stringify({
  ...receiptTemplate,
  teacherDecision: "ready_for_follow_up",
  teacherConfirmations: {
    ...receiptTemplate.teacherConfirmations,
    lowTokenTriggerReviewed: true,
    captureReceiptReviewed: true,
    exactlyOneVisualEvidenceFile: true,
    visualEvidenceUsedOnlyWithTriggerReceipt: true,
    noContinuousRecording: true,
    noSoftwareExecution: true,
    noMemoryWrite: true,
    ruleRemainsDisabled: true,
    packagingRemainsLocked: true
  },
  teacherNote: "reviewed trigger receipt, capture receipt, one image, and learning card; ready only for review-only follow-up"
}, null, 2), "utf8");
const receiptValidation = runNodeScript("validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs", [
  "--review",
  review.reviewPath,
  "--receipt",
  filledReceiptPath,
  "--output-dir",
  join(smokeRoot, "receipt-validation")
]);
const receiptValidationPacket = readJson(receiptValidation.validationPath);

const forbiddenReceiptPath = join(smokeRoot, "teacher-triggered-visual-learning-review-forbidden-receipt.json");
writeFileSync(forbiddenReceiptPath, JSON.stringify({
  ...receiptTemplate,
  teacherDecision: "accepted",
  teacherNote: "this forbidden decision must be blocked"
}, null, 2), "utf8");
const forbiddenValidation = runNodeScriptAllowFailure("validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs", [
  "--review",
  review.reviewPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-receipt-validation")
]);

const checks = [
  {
    name: "Triggered visual evidence handoff is complete before review-card automation",
    pass:
      handoffPacket.format === "transparent_ai_triggered_visual_evidence_learning_handoff_v1" &&
      handoffPacket.status === "waiting_for_teacher_learning_review" &&
      handoffPacket.evidenceFiles.length === 3 &&
      handoffPacket.locks.handoffDoesNotCaptureScreenshots === true &&
      handoffPacket.locks.handoffDoesNotWriteMemory === true,
    evidence: handoff.handoffPath
  },
  {
    name: "Review runner automatically reuses the existing teaching engine",
    pass:
      reviewPacket.format === "transparent_ai_triggered_visual_evidence_learning_handoff_review_result_v1" &&
      reviewPacket.status === "waiting_for_teacher_review" &&
      reviewPacket.usedExistingTeachingEngine === true &&
      reviewPacket.invokedScripts.includes("continue-teaching.mjs") &&
      reviewPacket.invokedScripts.includes("show-teaching-card.mjs") &&
      Boolean(reviewPacket.teachingSessionPath) &&
      Boolean(reviewPacket.learningCardPath) &&
      Boolean(reviewPacket.teacherReceiptTemplatePath) &&
      reviewPacket.teacherReceiptValidationCommand.includes("validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs"),
    evidence: review.reviewPath
  },
  {
    name: "Handoff review creates a teacher-facing learning card",
    pass:
      learningCard.format === "transparent_ai_teacher_learning_card_v1" &&
      learningCard.status === "waiting_for_teacher_review" &&
      learningCard.learnedDraft?.status === "needs_teacher_review" &&
      learningCard.latestReplay?.ruleEnabled === false &&
      learningCard.hidesInternalIds === true,
    evidence: `card=${review.learningCardPath}; status=${learningCard.status}`
  },
  {
    name: "Learning card evidence came from the combined request receipt and image, not an isolated screenshot",
    pass:
      reviewPacket.evidenceFiles.includes(request.packetPath) &&
      reviewPacket.evidenceFiles.includes(capture.receiptPath) &&
      reviewPacket.evidenceFiles.includes(capture.screenshotPath) &&
      reviewPacket.blockedActions.includes("learn_from_visual_evidence_without_trigger_receipt") &&
      Array.isArray(learningCard.evidence) &&
      learningCard.evidence.some((item) => item.source === "low-token triggered visual evidence handoff"),
    evidence: JSON.stringify(reviewPacket.evidenceFiles)
  },
  {
    name: "Review runner keeps screenshots execution memory rules and packaging locked",
    pass:
      reviewPacket.locks.handoffReviewDoesNotCaptureScreenshots === true &&
      reviewPacket.locks.handoffReviewDoesNotExecuteSoftware === true &&
      reviewPacket.locks.handoffReviewDoesNotWriteMemory === true &&
      reviewPacket.locks.handoffReviewDoesNotEnableRules === true &&
      reviewPacket.locks.screenshotsCaptured === false &&
      reviewPacket.locks.softwareActionsExecuted === false &&
      reviewPacket.locks.memoryWritten === false &&
      reviewPacket.locks.accepted === false &&
      reviewPacket.locks.packagingGated === true,
    evidence: JSON.stringify(reviewPacket.locks)
  },
  {
    name: "Teacher receipt validation allows only review-only follow-up after full evidence confirmation",
    pass:
      receiptValidationPacket.format ===
        "transparent_ai_triggered_visual_evidence_learning_handoff_review_receipt_validation_v1" &&
      receiptValidationPacket.status === "ready_for_review_only_follow_up_not_memory" &&
      receiptValidationPacket.readyForReviewOnlyFollowUp === true &&
      receiptValidationPacket.canWriteMemory === false &&
      receiptValidationPacket.canEnableRules === false &&
      receiptValidationPacket.canExecuteSoftware === false &&
      receiptValidationPacket.locks.validationDoesNotCaptureScreenshots === true &&
      receiptValidationPacket.locks.validationDoesNotWriteMemory === true &&
      receiptValidationPacket.locks.accepted === false &&
      receiptValidationPacket.locks.packagingGated === true,
    evidence: receiptValidation.validationPath
  },
  {
    name: "Teacher receipt validation blocks acceptance or memory-like decisions",
    pass:
      forbiddenValidation.status !== 0 &&
      forbiddenValidation.json?.status === "blocked_forbidden_teacher_decision" &&
      forbiddenValidation.json?.canWriteMemory === false &&
      forbiddenValidation.json?.canEnableRules === false,
    evidence: forbiddenValidation.json?.validationPath || forbiddenValidation.stderr
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_triggered_visual_evidence_learning_handoff_review_smoke_v1",
  smokeRoot,
  paths: {
    request: request.packetPath,
    captureReceipt: capture.receiptPath,
    learningHandoff: handoff.handoffPath,
    learningHandoffReview: review.reviewPath,
    teacherLearningCard: review.learningCardPath,
    receiptTemplate: review.teacherReceiptTemplatePath,
    receiptValidation: receiptValidation.validationPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
