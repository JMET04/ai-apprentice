#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "transparent-sketch-depth-rehearsal-review-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "transparent-sketch-depth-rehearsal-review-receipt-validation"
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
    validationDoesNotRunRouteBridge: true,
    validationDoesNotRunTargetConfirmation: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteSoftware: true,
    validationDoesNotSendUiEvents: true,
    validationDoesNotWriteMemory: true,
    teacherAcceptanceRequired: true,
    routeBridgeInvoked: false,
    targetConfirmationInvoked: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["confirm", "confirmed", "teacher_confirms_understanding"].includes(text)) return "teacher_confirms_understanding";
  if (["ambiguous", "teacher_marks_ambiguous"].includes(text)) return "teacher_marks_ambiguous";
  if (["correction", "teacher_requests_correction", "needs_correction"].includes(text)) return "teacher_requests_correction";
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) return "blocked_needs_more_evidence";
  if (
    [
      "accepted",
      "execute_now",
      "run_now",
      "capture_screenshot",
      "send_ui_events",
      "write_memory",
      "enable_rule",
      "claim_depth_mastered",
      "native_universal_execution",
      "unlock_packaging"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function writeReadme(path, validation) {
  const lines = [
    "# Transparent Sketch Depth Rehearsal Review Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Confirmed rows: ${validation.confirmedRowCount}/${validation.totalRows}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row) => `${row.rowNumber}. ${row.requirementId}: ${row.status}`),
    "",
    "Prepared next review commands:",
    ...validation.nextReviewCommands.map((row, index) => `${index + 1}. ${row.commandLine}`),
    "",
    "Safety boundary:",
    "- This validation does not execute target software, send UI events, capture screenshots, write memory, enable rules, accept technology, unlock packaging, or claim native universal execution.",
    "- Even all-confirmed rows remain a teacher-reviewed rehearsal result, not final objective completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher review of transparent sketch depth rehearsal.");
const builderInput = readJsonInput(
  argValue("--builder", argValue("--receipt-builder", "")),
  "--builder",
  "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1"
);
if (!builderInput.value) throw new Error("--builder is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "transparent-sketch-depth-rehearsal-review-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const builderRows = new Map((builder.reviewRows || []).map((row) => [row.requirementId, row]));
const forbidden = new Set([
  "accepted",
  "execute_now",
  "run_now",
  "capture_screenshot",
  "send_ui_events",
  "write_memory",
  "enable_rule",
  "claim_depth_mastered",
  "native_universal_execution",
  "unlock_packaging"
]);

const validationRows = (receipt.rowDecisions || []).map((row) => {
  const source = builderRows.get(row.requirementId);
  const decision = normalizeDecision(row.teacherDecision);
  const evidenceReviewed = row.evidenceReviewed === true;
  const forbiddenDecision = forbidden.has(decision);
  const sourcePass = source?.rehearsalPass === true;
  const confirmed = Boolean(source) && sourcePass && evidenceReviewed && decision === "teacher_confirms_understanding";
  const ambiguousOrCorrection =
    Boolean(source) &&
    evidenceReviewed &&
    ["teacher_marks_ambiguous", "teacher_requests_correction", "blocked_needs_more_evidence"].includes(decision);
  const status = !source
    ? "unknown_requirement_row"
    : forbiddenDecision
      ? "blocked_forbidden_teacher_decision"
      : !evidenceReviewed
        ? "needs_teacher_review_or_evidence"
        : confirmed
          ? "teacher_confirmed_rehearsal_understanding"
          : ambiguousOrCorrection
            ? "teacher_review_requires_correction_or_more_evidence"
            : "needs_teacher_review";
  return {
    rowNumber: row.rowNumber || source?.rowNumber || 0,
    requirementId: row.requirementId || "",
    teacherDecision: decision,
    evidenceReviewed,
    sourceRehearsalPass: sourcePass,
    forbiddenDecision,
    correctionRequest: row.correctionRequest || "",
    teacherNote: row.teacherNote || "",
    status
  };
});

const unknownRows = validationRows.filter((row) => row.status === "unknown_requirement_row").length;
const forbiddenRows = validationRows.filter((row) => row.forbiddenDecision).length;
const confirmedRowCount = validationRows.filter((row) => row.status === "teacher_confirmed_rehearsal_understanding").length;
const correctionRows = validationRows.filter((row) => row.status === "teacher_review_requires_correction_or_more_evidence").length;
const missingReviewRows = validationRows.filter((row) => row.status === "needs_teacher_review_or_evidence").length;
const expectedRowCount = builder.reviewRows?.length || 0;
const allRowsPresent = validationRows.length === expectedRowCount;
const allConfirmed = allRowsPresent && expectedRowCount > 0 && confirmedRowCount === expectedRowCount;
const validationDecision =
  forbiddenRows > 0 || unknownRows > 0
    ? "blocked_invalid_receipt"
    : allConfirmed
      ? "teacher_confirmed_depth_rehearsal_review_only"
      : correctionRows > 0
        ? "teacher_correction_required_before_route_review"
        : "needs_teacher_review";

const nextReviewCommands = [];
if (allConfirmed && builder.sourceTeacherConfirmedNumber === true) {
  nextReviewCommands.push({
    label: "Review existing dry-run route bridge before any execute request",
    commandLine: builder.paths?.sourceRehearsal || "",
    allowedAfter: "teacher may inspect rehearsal route evidence only; this validation does not execute it"
  });
} else if (allConfirmed) {
  nextReviewCommands.push({
    label: "Confirm exactly one numbered spatial target before route review",
    commandLine: "node plugins\\transparent-ai-apprentice\\scripts\\create-spatial-target-confirmation-kit.mjs --overlay-packet \"<teacher-exported-transparent-sketch-packet.json>\" --goal " + quote(goal),
    allowedAfter: "teacher must choose one number; no route execution is allowed by this validation"
  });
}
if (correctionRows > 0 || missingReviewRows > 0) {
  nextReviewCommands.push({
    label: "Return to transparent sketch overlay or spatial intent evidence request for correction",
    commandLine: builder.paths?.sourceRehearsalHtml || builder.paths?.sourceRehearsal || "",
    allowedAfter: "teacher correction must be reviewed before another rehearsal"
  });
}

const validationPath = join(validationDir, "transparent-sketch-depth-rehearsal-review-receipt-validation.json");
const reviewReceiptPath = join(validationDir, "transparent-sketch-depth-rehearsal-review-receipt-validation-receipt.json");
const readmePath = join(validationDir, "TRANSPARENT_SKETCH_DEPTH_REHEARSAL_REVIEW_RECEIPT_VALIDATION_START_HERE.md");
const lockState = locks();
const validation = {
  ok: forbiddenRows === 0 && unknownRows === 0,
  format: "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status:
    validationDecision === "teacher_confirmed_depth_rehearsal_review_only"
      ? "teacher_confirmed_depth_rehearsal_waiting_for_next_review_gate"
      : validationDecision,
  validationDecision,
  goal,
  sourceBuilder: builderInput.path,
  sourceReceipt: receiptInput.path,
  totalRows: expectedRowCount,
  confirmedRowCount,
  correctionRowCount: correctionRows,
  missingReviewRowCount: missingReviewRows,
  forbiddenRowCount: forbiddenRows,
  allConfirmed,
  accepted: false,
  ruleEnabled: false,
  readyForExecution: false,
  nativeUniversalExecution: false,
  goalComplete: false,
  validationRows,
  nextReviewCommands,
  paths: {
    validation: validationPath,
    reviewReceipt: reviewReceiptPath,
    readme: readmePath
  },
  locks: lockState
};

const reviewReceipt = {
  format: "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_receipt_v1",
  validationId,
  reviewed: false,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_follow_up_review", "blocked_needs_more_evidence"],
  blockedTeacherDecisions: Array.from(forbidden),
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: lockState
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(reviewReceiptPath, `${JSON.stringify(reviewReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(JSON.stringify(validation, null, 2));
if (forbiddenRows > 0 || unknownRows > 0) process.exit(1);
