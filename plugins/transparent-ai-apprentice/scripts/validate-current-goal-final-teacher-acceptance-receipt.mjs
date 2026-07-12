#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function slugify(value) {
  return (
    String(value || "current-goal-final-teacher-acceptance-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "current-goal-final-teacher-acceptance-receipt-validation"
  );
}

function normalizeDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (text === "accept_full_original_goal_completion") return text;
  if (["blocked", "blocked_needs_more_evidence"].includes(text)) return "blocked_needs_more_evidence";
  if (
    [
      "accepted",
      "claim_complete",
      "execute_now",
      "register_now",
      "capture_screenshot",
      "read_logs_now",
      "memory_enabled",
      "native_universal_execution",
      "delete_rollback_points",
      "unlock_packaging",
      "run_execute_mode"
    ].includes(text)
  ) {
    return text;
  }
  return "needs_teacher_review";
}

function normalizeLaneDecision(value) {
  const text = String(value || "needs_teacher_review").trim().toLowerCase();
  if (text === "confirmed") return "confirmed";
  if (["blocked", "blocked_needs_more_evidence"].includes(text)) return "blocked_needs_more_evidence";
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunFinalGate: true,
    validationDoesNotRunCommands: true,
    validationDoesNotReadLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    validationDoesNotDeleteRollbackPoints: true,
    logContentsRead: false,
    screenshotsCaptured: false,
    scheduledTaskInstalled: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Current Goal Final Teacher Acceptance Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Ready for final completion gate: ${validation.readyForFinalCompletionGate}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row) => `- ${row.laneId}: ${row.status}`),
    "",
    "Blockers:",
    ...(validation.blockers.length ? validation.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Safety boundary:",
    "- This validation only validates a teacher-filled receipt.",
    "- It does not run the final gate, execute commands, read logs, capture screenshots, execute target software, write memory, enable rules, delete rollback points, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate current goal final teacher acceptance receipt.");
const gateInput = readJsonInput(
  argValue("--final-convergence-readiness-gate", argValue("--gate", "")),
  "--final-convergence-readiness-gate",
  "transparent_ai_current_goal_final_convergence_readiness_gate_v1"
);
if (!gateInput.value) throw new Error("--final-convergence-readiness-gate is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_current_goal_final_teacher_acceptance_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), "artifacts", "current-goal-final-teacher-acceptance-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const gate = gateInput.value;
const receipt = receiptInput.value;
const lanes = Array.isArray(gate.lanes) ? gate.lanes : [];
const receiptRows = Array.isArray(receipt.laneReviews) ? receipt.laneReviews : [];
const receiptRowMap = new Map(receiptRows.map((row) => [row.laneId, row]));
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisionUsed = [
  "accepted",
  "claim_complete",
  "execute_now",
  "register_now",
  "capture_screenshot",
  "read_logs_now",
  "memory_enabled",
  "native_universal_execution",
  "delete_rollback_points",
  "unlock_packaging",
  "run_execute_mode"
].includes(decision);

const totalLanes = Number(gate.summary?.totalLanes ?? lanes.length);
const reviewEvidenceReadyLanes = Number(gate.summary?.reviewEvidenceReadyLanes ?? lanes.filter((lane) => lane.reviewEvidenceReady).length);
const validationRows = lanes.map((lane) => {
  const row = receiptRowMap.get(lane.laneId);
  const laneDecision = normalizeLaneDecision(row?.teacherDecision);
  const canConfirmLane = lane.laneId === "explicit_final_teacher_acceptance" || lane.reviewEvidenceReady === true;
  return {
    laneId: lane.laneId,
    sourceReviewEvidenceReady: lane.reviewEvidenceReady === true,
    sourceCompletionReady: lane.completionReady === true,
    canConfirmLane,
    teacherReviewed: row?.teacherReviewed === true,
    teacherDecision: laneDecision,
    teacherNote: row?.teacherNote || "",
    status: !row
      ? "blocked_missing_teacher_lane_review"
      : !canConfirmLane
        ? "blocked_lane_not_ready_for_teacher_final_acceptance"
        : row.teacherReviewed !== true
          ? "blocked_teacher_did_not_review_lane"
          : laneDecision !== "confirmed"
            ? `blocked_teacher_lane_decision_${laneDecision}`
            : "teacher_confirmed_lane"
  };
});

const blockers = [];
if (gate.status !== "convergence_evidence_ready_for_final_teacher_review_not_completion") {
  blockers.push("source_convergence_gate_not_ready_for_final_teacher_review");
}
if (totalLanes <= 0) blockers.push("source_convergence_gate_has_no_lanes");
if (reviewEvidenceReadyLanes !== totalLanes - 1) {
  blockers.push(`source_convergence_gate_not_only_missing_final_teacher_acceptance:${reviewEvidenceReadyLanes}/${totalLanes}`);
}
if (Number(gate.summary?.completionReadyLanes ?? 0) !== 0) blockers.push("source_convergence_gate_unexpected_completion_ready_lanes");
if (gate.summary?.finalGoalCompletionAllowed !== false) blockers.push("source_convergence_gate_allows_completion_unexpectedly");
if (gate.locks?.goalComplete === true) blockers.push("source_convergence_gate_claims_goal_complete");
if (decision !== "accept_full_original_goal_completion") blockers.push(`teacher_decision_not_acceptance:${decision}`);
if (receipt.teacherConfirmedFullOriginalScope !== true) blockers.push("teacher_full_original_scope_confirmation_missing");
if (receipt.teacherReviewedEveryEvidenceLane !== true) blockers.push("teacher_every_evidence_lane_review_missing");
if (receipt.teacherAcceptsReviewOnlyBoundary !== true) blockers.push("teacher_review_only_boundary_acceptance_missing");
if (receipt.teacherAcceptsRemainingCompletionBoundary !== true) blockers.push("teacher_remaining_completion_boundary_acceptance_missing");
if (receipt.forbiddenAutomationRequested === true) blockers.push("teacher_receipt_requested_forbidden_automation");
if (forbiddenDecisionUsed) blockers.push(`forbidden_teacher_decision:${decision}`);
const blockedRows = validationRows.filter((row) => row.status !== "teacher_confirmed_lane");
if (blockedRows.length > 0) blockers.push(`teacher_lane_confirmations_incomplete:${blockedRows.length}`);

const readyForFinalCompletionGate = blockers.length === 0;
const status = readyForFinalCompletionGate
  ? "validated_ready_for_final_completion_gate"
  : forbiddenDecisionUsed
    ? "blocked_for_forbidden_final_teacher_decision"
    : "blocked_before_final_completion_gate";
const validationDecision = readyForFinalCompletionGate
  ? "teacher_acceptance_ready_for_final_completion_gate"
  : "needs_more_teacher_evidence_before_final_completion_gate";
const lockState = locks();
const validationPath = join(validationDir, "current-goal-final-teacher-acceptance-receipt-validation.json");
const legacyValidationPath = join(validationDir, "original-goal-final-teacher-acceptance-receipt-validation.json");
const receiptPath = join(validationDir, "current-goal-final-teacher-acceptance-receipt-validation-receipt.json");
const readmePath = join(validationDir, "CURRENT_GOAL_FINAL_TEACHER_ACCEPTANCE_RECEIPT_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  readyForFinalCompletionGate,
  sourceEvidence: {
    finalConvergenceReadinessGate: gateInput.path,
    teacherReceipt: receiptInput.path
  },
  receiptDecision: decision,
  validationRows,
  blockers,
  blockedTransitions: [
    "run_final_completion_gate_from_current_goal_teacher_validation",
    "claim_goal_complete_from_current_goal_teacher_validation",
    "execute_target_software_from_current_goal_teacher_validation",
    "read_logs_from_current_goal_teacher_validation",
    "capture_screenshots_from_current_goal_teacher_validation",
    "register_schedule_from_current_goal_teacher_validation",
    "write_memory_from_current_goal_teacher_validation",
    "enable_rule_from_current_goal_teacher_validation",
    "delete_rollback_points_from_current_goal_teacher_validation",
    "unlock_packaging_from_current_goal_teacher_validation"
  ],
  locks: lockState
};
const validationReceipt = {
  format: "transparent_ai_current_goal_final_teacher_acceptance_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyForFinalCompletionGate,
  validationPath,
  legacyValidationPath,
  readmePath,
  blockers,
  locks: lockState
};

writeJson(validationPath, validation);
writeJson(legacyValidationPath, validation);
writeJson(receiptPath, validationReceipt);
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_final_teacher_acceptance_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyForFinalCompletionGate,
      validationPath,
      legacyValidationPath,
      receiptPath,
      readmePath,
      blockers,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
