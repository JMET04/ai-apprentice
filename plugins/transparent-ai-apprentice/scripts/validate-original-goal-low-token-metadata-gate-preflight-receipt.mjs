#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-metadata-gate-preflight-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-metadata-gate-preflight-receipt-validation"
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunMetadataGate: true,
    validationDoesNotReadLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
    metadataGateRunnerInvoked: false,
    allSoftwareCoverageComplete: false,
    teacherAcceptanceRequired: true,
    rollbackPointRequiredBeforeRun: true,
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
  if (["teacher_confirmed_run_low_token_metadata_gate", "ready_for_low_token_metadata_gate"].includes(text)) {
    return "teacher_confirmed_run_low_token_metadata_gate";
  }
  if (["blocked", "blocked_needs_more_evidence", "mismatch_blocked"].includes(text)) {
    return "blocked_needs_more_evidence";
  }
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

function hasTeacherConfirmation(receipt) {
  const text = String(receipt.teacherConfirmation || "").trim();
  return text.length >= 8 && /confirm|confirmed|teacher|review|approve|ok|yes|确认|同意|老师|审核|已看/i.test(text);
}

function validRollbackPoint(value) {
  const text = String(value || "").trim();
  if (!text || text.includes("<") || text.toLowerCase().includes("placeholder")) return false;
  return existsSync(text);
}

function writeReadme(path, validation) {
  const lines = [
    "# Original Goal Low-Token Metadata Gate Preflight Receipt Validation",
    "",
    `Status: ${validation.status}`,
    `Decision: ${validation.validationDecision}`,
    `Rollback point: ${validation.rollbackPoint || ""}`,
    "",
    "Validation rows:",
    ...validation.validationRows.map((row, index) => `${index + 1}. ${row.followUpId}: ${row.status}`),
    "",
    "Prepared commands:",
    ...(validation.nextPreparedCommands.length
      ? validation.nextPreparedCommands.map((command, index) => `${index + 1}. ${command.commandLine}`)
      : ["- None"]),
    "",
    "Safety boundary:",
    "- This validation prepares a next command only; it does not run the metadata gate batch.",
    "- It does not read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim completion.",
    "- Forbidden receipt decisions and missing rollback points fail closed."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher receipt for original-goal low-token metadata gate preflight.");
const preflightInput = readJsonInput(
  argValue("--preflight", argValue("--metadata-gate-preflight", "")),
  "--preflight",
  "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1"
);
if (!preflightInput.value) throw new Error("--preflight is required");
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1"
);
if (!receiptInput.value) throw new Error("--receipt is required");

const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-metadata-gate-preflight-receipt-validations")
  )
);
mkdirSync(outputRoot, { recursive: true });
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });

const preflight = preflightInput.value;
const receipt = receiptInput.value;
const lockState = locks();
const preflightRows = new Map((preflight.rows || []).map((row) => [String(row.followUpId), row]));
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
const receiptDecision = normalizeDecision(receipt.decision);
const rollbackPointCreated = receipt.rollbackPointCreated === true;
const rollbackPoint = String(receipt.rollbackPoint || "").trim();
const rollbackPointValid = rollbackPointCreated && validRollbackPoint(rollbackPoint);
const teacherConfirmationValid = hasTeacherConfirmation(receipt);
const allowCommandGeneration = receipt.allowCommandGeneration === true;
const topLevelForbidden = forbidden.has(receiptDecision);

const validationRows = (receipt.rowDecisions || []).map((receiptRow) => {
  const row = preflightRows.get(String(receiptRow.followUpId));
  const decision = normalizeDecision(receiptRow.teacherDecision);
  const forbiddenDecision = forbidden.has(decision);
  const evidenceReviewed = receiptRow.evidenceReviewed === true;
  const sourceReady = row?.readyForTeacherConfirmedMetadataGate === true;
  const canPrepareCommand =
    Boolean(row) &&
    sourceReady &&
    decision === "teacher_confirmed_run_low_token_metadata_gate" &&
    evidenceReviewed &&
    allowCommandGeneration &&
    teacherConfirmationValid &&
    rollbackPointValid &&
    !forbiddenDecision &&
    !topLevelForbidden;
  return {
    followUpId: receiptRow.followUpId,
    ledgerNumber: row?.ledgerNumber || receiptRow.ledgerNumber || "",
    software: row?.software || receiptRow.software || "",
    sourceStatus: row?.status || "",
    sourceReady,
    receiptDecision: receiptRow.teacherDecision || "",
    normalizedDecision: decision,
    evidenceReviewed,
    rollbackPointCreated,
    rollbackPointValid,
    teacherConfirmationValid,
    allowCommandGeneration,
    status: !row
      ? "unknown_preflight_row"
      : forbiddenDecision || topLevelForbidden
        ? "blocked_for_forbidden_decision"
        : !sourceReady && decision === "teacher_confirmed_run_low_token_metadata_gate"
          ? "blocked_source_row_not_ready"
          : canPrepareCommand
            ? "ready_for_prepared_low_token_metadata_gate_command"
            : decision === "blocked_needs_more_evidence"
              ? "blocked_needs_more_evidence"
              : "needs_teacher_review_or_missing_confirmation",
    canPrepareCommand,
    locks: lockState
  };
});

const runIntentUsed =
  receiptDecision === "teacher_confirmed_run_low_token_metadata_gate" ||
  allowCommandGeneration ||
  validationRows.some((row) => row.normalizedDecision === "teacher_confirmed_run_low_token_metadata_gate");
const forbiddenDecisionUsed = topLevelForbidden || validationRows.some((row) => row.status === "blocked_for_forbidden_decision");
const missingGlobalGate = runIntentUsed && (!allowCommandGeneration || !teacherConfirmationValid || !rollbackPointValid);
const readyRows = validationRows.filter((row) => row.canPrepareCommand);
const waitingRows = validationRows.filter((row) => !row.canPrepareCommand && row.status !== "blocked_for_forbidden_decision");
const sourceCommand = preflight.commands?.[0]?.commandLine || "";
const validationDecision = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : missingGlobalGate
    ? "blocked_missing_teacher_confirmation_or_retained_rollback_point"
    : readyRows.length > 0 && waitingRows.length === 0
      ? "all_ready_rows_can_prepare_metadata_gate_command"
      : readyRows.length > 0
        ? "some_rows_can_prepare_metadata_gate_command"
        : "needs_teacher_review";
const status =
  forbiddenDecisionUsed || missingGlobalGate
    ? "blocked"
    : readyRows.length > 0 && sourceCommand
      ? "validated_with_prepared_metadata_gate_command"
      : "waiting_for_teacher_metadata_gate_preflight_review";
const nextPreparedCommands =
  readyRows.length > 0 && sourceCommand && !forbiddenDecisionUsed && !missingGlobalGate
    ? [
        {
          tool: "run_all_software_coverage_enrollment_follow_up_batch",
          commandLine: sourceCommand,
          executesNow: false,
          requiresTeacherConfirmation: true,
          teacherConfirmation: receipt.teacherConfirmation,
          requiresRollbackPoint: true,
          rollbackPoint,
          readyFollowUpIds: readyRows.map((row) => row.followUpId),
          blockedUntil: "human explicitly runs this prepared command after retaining the rollback point"
        }
      ]
    : [];

const validationPath = join(validationDir, "original-goal-low-token-metadata-gate-preflight-receipt-validation.json");
const readmePath = join(validationDir, "ORIGINAL_GOAL_LOW_TOKEN_METADATA_GATE_PREFLIGHT_RECEIPT_VALIDATION_START_HERE.md");
const validation = {
  ok: !forbiddenDecisionUsed && !missingGlobalGate,
  format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  validationDecision,
  sourceEvidence: {
    preflight: preflightInput.path,
    receipt: receiptInput.path
  },
  counts: {
    receiptRows: validationRows.length,
    readyRows: readyRows.length,
    waitingRows: waitingRows.length,
    commands: nextPreparedCommands.length
  },
  receiptGate: {
    decision: receipt.decision || "",
    normalizedDecision: receiptDecision,
    teacherConfirmationValid,
    rollbackPointCreated,
    rollbackPointValid,
    allowCommandGeneration
  },
  rollbackPoint,
  validationRows,
  nextPreparedCommands,
  blockedTransitions: [
    "run_metadata_gate_from_validation",
    "read_logs_from_validation",
    "capture_screenshot_from_validation",
    "execute_target_software_from_validation",
    "register_schedule_from_validation",
    "write_memory_from_validation",
    "claim_all_software_coverage_complete_from_validation",
    "claim_original_goal_complete_from_validation"
  ],
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    goalComplete: false,
    reason:
      "Receipt validation only prepares a command after teacher confirmation and rollback verification. Running, reconciling, auditing, and teacher review remain separate."
  },
  paths: {
    validation: validationPath,
    readme: readmePath,
    sourcePreflight: preflightInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: lockState
};

writeJsonFile(validationPath, validation);
writeReadme(readmePath, validation);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_validation_result_v1",
      validationPath,
      readmePath,
      status,
      validationDecision,
      counts: validation.counts,
      nextPreparedCommands,
      locks: lockState
    },
    null,
    2
  )
);
if (!validation.ok) process.exit(1);
