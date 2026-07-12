#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-final-teacher-acceptance-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-final-teacher-acceptance-receipt-validation"
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
  if (text === "accept_full_original_goal_completion") return text;
  if (["blocked", "blocked_needs_more_evidence"].includes(text)) return "blocked_needs_more_evidence";
  if (
    [
      "accepted",
      "claim_complete",
      "execute_now",
      "register_now",
      "capture_screenshot",
      "memory_enabled",
      "native_universal_execution",
      "unlock_packaging",
      "run_execute_mode"
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
    validationDoesNotRunFinalGate: true,
    validationDoesNotRunCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotReadLogs: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotSendUiEvents: true,
    validationDoesNotWriteMemory: true,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Final Teacher Acceptance Receipt Validation",
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
    `Next final gate command: ${validation.nextFinalGateCommand}`,
    "",
    "Safety boundary:",
    "- This validation only validates a teacher-filled final acceptance receipt.",
    "- It does not run the final gate, execute commands, register tasks, capture screenshots, execute target software, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

const goal = argValue("--goal", "Validate original-goal final teacher acceptance receipt.");
const gateInput = readJsonInput(
  argValue("--final-completion-gate", argValue("--gate", "")),
  "--final-completion-gate",
  "transparent_ai_original_goal_final_completion_gate_v1"
);
if (!gateInput.value) throw new Error("--final-completion-gate is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_final_teacher_acceptance_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-final-teacher-acceptance-receipt-validations"))
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const gate = gateInput.value;
const receipt = receiptInput.value;
const gateLanes = Array.isArray(gate.lanes) ? gate.lanes : [];
const receiptRows = Array.isArray(receipt.evidenceLaneReviews) ? receipt.evidenceLaneReviews : [];
const receiptRowMap = new Map(receiptRows.map((row) => [row.laneId, row]));
const nonTeacherBlockers = (gate.blockers || []).filter((id) => id !== "explicit_final_teacher_acceptance");
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisionUsed = [
  "accepted",
  "claim_complete",
  "execute_now",
  "register_now",
  "capture_screenshot",
  "memory_enabled",
  "native_universal_execution",
  "unlock_packaging",
  "run_execute_mode"
].includes(decision);

const validationRows = gateLanes.map((lane) => {
  const receiptRow = receiptRowMap.get(lane.id);
  const canConfirmLane = lane.id === "explicit_final_teacher_acceptance" || lane.ready === true;
  const teacherConfirmed = receiptRow?.teacherConfirmed === true;
  return {
    laneId: lane.id,
    laneReadyInGate: lane.ready === true,
    canConfirmLane,
    teacherConfirmed,
    teacherNote: receiptRow?.teacherNote || "",
    status: !receiptRow
      ? "blocked_missing_teacher_lane_review"
      : !canConfirmLane
        ? "blocked_lane_not_ready_in_final_gate"
        : !teacherConfirmed
          ? "blocked_teacher_did_not_confirm_lane"
          : "teacher_confirmed_lane"
  };
});

const blockers = [];
if (gate.status !== "blocked_before_original_goal_completion_claim") {
  blockers.push("source_final_gate_must_be_pre_acceptance_blocked_gate");
}
if (nonTeacherBlockers.length > 0) {
  blockers.push(`source_final_gate_has_non_teacher_blockers:${nonTeacherBlockers.join(",")}`);
}
if (!(gate.blockers || []).includes("explicit_final_teacher_acceptance")) {
  blockers.push("source_final_gate_not_waiting_for_explicit_teacher_acceptance");
}
if (decision !== "accept_full_original_goal_completion") blockers.push(`teacher_decision_not_acceptance:${decision}`);
if (receipt.teacherConfirmedFullScope !== true) blockers.push("teacher_full_scope_confirmation_missing");
if (receipt.reviewedEvidenceBundle !== true) blockers.push("teacher_evidence_bundle_review_missing");
if (receipt.acceptsRemainingBoundaries !== true) blockers.push("teacher_remaining_boundaries_acceptance_missing");
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
const validationPath = join(validationDir, "original-goal-final-teacher-acceptance-receipt-validation.json");
const receiptPath = join(validationDir, "original-goal-final-teacher-acceptance-receipt-validation-receipt.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_FINAL_TEACHER_ACCEPTANCE_RECEIPT_VALIDATION_START_HERE.md");
const nextFinalGateCommand = readyForFinalCompletionGate
  ? commandLine("validate-original-goal-final-completion-gate.mjs", [
      ["--completion-blocker-matrix", "<same-completion-blocker-matrix.json>"],
      ["--low-token-coverage-gate", "<same-low-token-coverage-gate.json>"],
      ["--unattended-audit", "<same-unattended-audit.json>"],
      ["--sketch-implementation-audit", "<same-sketch-implementation-audit.json>"],
      ["--spatial-intent-receipt-validation", "<same-spatial-intent-receipt-validation.json>"],
      ["--execution-convergence-audit", "<same-execution-convergence-audit.json>"],
      ["--final-teacher-receipt-validation", validationPath]
    ])
  : "";
const lockState = locks();
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
    finalCompletionGate: gateInput.path,
    teacherReceipt: receiptInput.path
  },
  receiptDecision: decision,
  validationRows,
  blockers,
  nextFinalGateCommand,
  blockedTransitions: [
    "run_final_completion_gate_from_receipt_validation",
    "claim_goal_complete_from_receipt_validation",
    "execute_target_software_from_receipt_validation",
    "register_task_from_receipt_validation",
    "capture_screenshot_from_receipt_validation",
    "write_memory_from_receipt_validation",
    "enable_rule_from_receipt_validation",
    "unlock_packaging_from_receipt_validation"
  ],
  locks: lockState
};
const validationReceipt = {
  format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_receipt_v1",
  validationId,
  status,
  validationDecision,
  readyForFinalCompletionGate,
  validationPath,
  readmePath,
  blockers,
  locks: lockState
};

writeFileSync(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(validationReceipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_result_v1",
      validationId,
      status,
      validationDecision,
      readyForFinalCompletionGate,
      validationPath,
      receiptPath,
      readmePath,
      blockers,
      nextFinalGateCommand,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
