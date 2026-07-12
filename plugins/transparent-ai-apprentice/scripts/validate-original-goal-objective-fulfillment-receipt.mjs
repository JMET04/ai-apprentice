#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-objective-fulfillment-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-objective-fulfillment-receipt-validation"
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
  if (["teacher_confirms_audit_status", "confirmed_audit_status"].includes(text)) return "teacher_confirms_audit_status";
  if (["teacher_requests_correction", "correction", "request_correction"].includes(text)) return "teacher_requests_correction";
  if (["teacher_selects_next_lane", "select_next_lane", "ready_for_next_lane"].includes(text)) return "teacher_selects_next_lane";
  if (
    [
      "accepted",
      "claim_complete",
      "execute_now",
      "register_now",
      "write_memory",
      "enable_rule",
      "unlock_packaging",
      "native_universal_execution"
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
    validationDoesNotRunCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotReadLogs: true,
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
}

function nextActionFor(requirementId) {
  const map = {
    all_software_low_token_learning:
      "Open the low-token coverage waiting-row cockpit or fallback-route evidence pack, then validate the teacher-filled coverage receipt before any runner or registration.",
    adapt_any_teacher_learning_method:
      "Create or review the teacher learning method profile, then validate a teacher correction or profile receipt before reuse.",
    transparent_mask_2d_perspective_3d_depth_understanding:
      "Open the transparent sketch depth rehearsal receipt template, have the teacher confirm or correct the 2D/perspective/3D rows, then validate it before route follow-up.",
    execute_in_target_software_after_confirmation:
      "Prepare exactly one teacher-confirmed execution gate with a retained rollback point, then run only the approved runner and review the post-action evidence."
  };
  return map[requirementId] || "Review this objective lane and route corrections back to the current-status teacher action router.";
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Objective Fulfillment Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    "",
    "Selected next lanes:",
    ...validation.nextLaneQueue.map((row, index) => `${index + 1}. ${row.requirementId}: ${row.nextTeacherAction}`),
    "",
    "Safety boundary:",
    "- This validation writes only a validation packet and next-lane queue.",
    "- It does not run commands, register tasks, launch runners, execute target software, capture screenshots, read logs, write memory, enable rules, unlock packaging, accept technology, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const auditInput = readJsonInput(
  argValue("--audit", argValue("--objective-audit", "")),
  "--audit",
  "transparent_ai_original_goal_objective_fulfillment_audit_v1"
);
if (!auditInput.value) throw new Error("--audit is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_objective_fulfillment_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const audit = auditInput.value;
const receipt = receiptInput.value;
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-objective-fulfillment-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(audit.auditId || "objective-fulfillment")}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const requirements = new Map((audit.requirements || []).map((row) => [row.id, row]));
const forbidden = new Set([
  "accepted",
  "claim_complete",
  "execute_now",
  "register_now",
  "write_memory",
  "enable_rule",
  "unlock_packaging",
  "native_universal_execution"
]);
const receiptRows = Array.isArray(receipt.rowDecisions) ? receipt.rowDecisions : [];
const validationRows = receiptRows.map((row) => {
  const source = requirements.get(row.id);
  const decision = normalizeDecision(row.teacherDecision);
  const errors = [];
  if (!source) errors.push("UNKNOWN_REQUIREMENT_ID");
  if (forbidden.has(decision)) errors.push("FORBIDDEN_DECISION");
  if (decision !== "needs_teacher_review" && row.auditRowReviewed !== true) errors.push("AUDIT_ROW_NOT_REVIEWED");
  if (decision === "teacher_requests_correction" && !String(row.correctionRequest || "").trim()) {
    errors.push("CORRECTION_REQUEST_REQUIRED");
  }
  return {
    id: row.id,
    teacherDecision: decision,
    auditRowReviewed: row.auditRowReviewed === true,
    teacherNote: row.teacherNote || "",
    correctionRequest: row.correctionRequest || "",
    status: errors.length ? "invalid" : "valid_review_only_decision",
    errors,
    sourceStatus: source?.status || "",
    sourceProvenNow: source?.provenNow === true
  };
});

const selected = validationRows.filter((row) => row.teacherDecision === "teacher_selects_next_lane" && row.errors.length === 0);
const corrections = validationRows.filter((row) => row.teacherDecision === "teacher_requests_correction" && row.errors.length === 0);
const invalidRows = validationRows.filter((row) => row.errors.length > 0);
const errors = [];
if (selected.length > 1) errors.push("SELECT_EXACTLY_ZERO_OR_ONE_NEXT_LANE");
if (invalidRows.length > 0) errors.push("INVALID_RECEIPT_ROWS_PRESENT");
const nextLaneQueue = selected.map((row) => ({
  id: `objective_fulfillment_next_lane_${row.id}`,
  requirementId: row.id,
  sourceAuditPath: auditInput.path,
  teacherNote: row.teacherNote,
  nextTeacherAction: nextActionFor(row.id),
  executeNow: false,
  registerNow: false,
  writeMemoryNow: false,
  claimCompleteNow: false,
  status: "ready_for_manual_review_only_next_lane"
}));
const validationDecision = errors.length
  ? "blocked_invalid_objective_fulfillment_receipt"
  : selected.length === 1
    ? "one_next_lane_selected_for_review_only_follow_up"
    : corrections.length > 0
      ? "teacher_correction_requested_for_objective_audit"
      : "objective_audit_status_reviewed_waiting_for_next_lane";

const validation = {
  ok: errors.length === 0,
  format: "transparent_ai_original_goal_objective_fulfillment_receipt_validation_v1",
  validationId,
  status: validationDecision,
  validationDecision,
  sourceAuditPath: auditInput.path,
  sourceReceiptPath: receiptInput.path,
  completionAllowedByValidation: false,
  readyForExecution: false,
  readyForRegistration: false,
  readyForMemoryWrite: false,
  nextLaneQueue,
  correctionQueue: corrections.map((row) => ({
    id: `objective_fulfillment_correction_${row.id}`,
    requirementId: row.id,
    correctionRequest: row.correctionRequest,
    teacherNote: row.teacherNote,
    status: "route_to_high_reasoning_audit_or_current_status_repair"
  })),
  validationRows,
  errors,
  locks: locks()
};
const validationPath = join(validationDir, "original-goal-objective-fulfillment-receipt-validation.json");
const nextLaneQueuePath = join(validationDir, "original-goal-objective-fulfillment-next-lane-queue.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_OBJECTIVE_FULFILLMENT_RECEIPT_VALIDATION_START_HERE.md");
writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(nextLaneQueuePath, `${JSON.stringify({ format: "transparent_ai_original_goal_objective_fulfillment_next_lane_queue_v1", items: nextLaneQueue, locks: locks() }, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_original_goal_objective_fulfillment_receipt_validation_result_v1",
      validationPath,
      nextLaneQueuePath,
      readmePath,
      status: validation.status,
      validationDecision: validation.validationDecision,
      errors
    },
    null,
    2
  )
);
if (!validation.ok) process.exit(1);
