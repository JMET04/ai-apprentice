#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = readJson(sourcePath);
  } catch {
    try {
      parsed = JSON.parse(text);
      sourcePath = "";
    } catch {
      parsed = null;
    }
  }
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  return { value: parsed, path: sourcePath };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function normalizeExecutionGateValidation(input) {
  if (input.value.format === "transparent_ai_real_case_confirmed_outcome_active_execution_gate_validation_result_v1") {
    if (input.value.validationPath && existsSync(input.value.validationPath)) {
      return { value: readJson(input.value.validationPath), path: resolve(input.value.validationPath), sourceResult: input.value };
    }
    return { value: input.value, path: input.path, sourceResult: input.value };
  }
  return { value: input.value, path: input.path, sourceResult: null };
}

function locked({ teacherReviewed = false } = {}) {
  return {
    reviewOnly: true,
    dryRunOnly: true,
    teacherReviewed,
    controlledExecutionRequestReviewed: teacherReviewed,
    adapterSelectionSimulated: true,
    adapterInvoked: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    uiEventsSent: false,
    filesWrittenOutsideRunDir: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateRealRunnerReview: true
  };
}

const validationInput = readJsonInput(
  argValue("--execution-gate-validation", argValue("--validation", "")),
  "--execution-gate-validation"
);
const normalized = normalizeExecutionGateValidation(validationInput);
const validation = normalized.value;
const controlledRequest = validation.controlledExecutionRequest;
const teacherReviewed = hasFlag("--teacher-reviewed") || argValue("--teacher-reviewed", "") === "true";
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-controlled-execution-dry-runs"))
);

const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (
  ![
    "transparent_ai_real_case_confirmed_outcome_active_execution_gate_validation_v1",
    "transparent_ai_real_case_confirmed_outcome_active_execution_gate_validation_result_v1"
  ].includes(validation.format)
) {
  block("invalid_execution_gate_validation_format", "Input must be a real-case active execution gate validation or validation result.");
}
if (validation.status !== "real_case_confirmed_outcome_active_execution_gate_ready_for_controlled_execution_request") {
  block("execution_gate_not_ready_for_controlled_request", "Execution gate validation must be ready for controlled execution request.");
}
if (validation.readyForControlledExecutionRequest !== true) {
  block("controlled_execution_request_not_ready", "readyForControlledExecutionRequest must be true.");
}
if (!controlledRequest || controlledRequest.format !== "transparent_ai_real_case_controlled_execution_request_v1") {
  block("controlled_execution_request_missing", "controlledExecutionRequest must be present and use the expected format.");
}
if (!teacherReviewed) block("teacher_review_required", "Dry-run runner requires --teacher-reviewed.");
if (controlledRequest?.executeNow !== false) block("controlled_request_execute_now_forbidden", "controlledExecutionRequest.executeNow must remain false.");
if (controlledRequest?.requiresSeparateControlledRunner !== true) {
  block("separate_controlled_runner_not_required", "controlledExecutionRequest must require a separate controlled runner.");
}
if (controlledRequest?.runnerMayOnlyUseReviewedScope !== true) {
  block("reviewed_scope_lock_missing", "controlledExecutionRequest must lock runner to the reviewed scope.");
}
if (controlledRequest?.noMemoryWrite !== true) block("memory_write_lock_missing", "controlledExecutionRequest must forbid memory writes.");
if (controlledRequest?.noRagFetch !== true) block("rag_fetch_lock_missing", "controlledExecutionRequest must forbid RAG fetches.");
if (controlledRequest?.noPackagingUnlock !== true) {
  block("packaging_unlock_lock_missing", "controlledExecutionRequest must forbid packaging unlock.");
}
if (!String(controlledRequest?.executionScope?.targetSoftware || "").trim()) {
  block("execution_scope_target_software_missing", "executionScope.targetSoftware is required.");
}
if (!String(controlledRequest?.executionScope?.operationSummary || "").trim()) {
  block("execution_scope_operation_missing", "executionScope.operationSummary is required.");
}
if (!controlledRequest?.rollbackPoint || !existsSync(controlledRequest.rollbackPoint)) {
  block("rollback_point_not_found", "controlledExecutionRequest.rollbackPoint must still exist.");
}
if (validation.locks?.targetSoftwareCommandsExecuted !== false) {
  block("source_lock_software_execution_not_false", "Source validation must not have executed target software.");
}
if (validation.locks?.ruleEnabled !== false) block("source_lock_rule_enabled_not_false", "Source validation must not enable rules.");
if (validation.locks?.memoryWritten !== false) block("source_lock_memory_written_not_false", "Source validation must not write memory.");
if (validation.locks?.ragFetched !== false) block("source_lock_rag_fetched_not_false", "Source validation must not fetch RAG.");
if (validation.locks?.packagingUnlocked !== false) {
  block("source_lock_packaging_unlocked_not_false", "Source validation must not unlock packaging.");
}
if (validation.confirmedOutcomeBranch !== true || controlledRequest?.confirmedOutcomeBranch !== true) {
  block("confirmed_outcome_source_branch_missing", "Validation and controlled request must preserve confirmedOutcomeBranch=true.");
}
if (
  validation.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT ||
  controlledRequest?.sourceReviewFormat !== validation.sourceReviewFormat
) {
  block("confirmed_outcome_source_review_format_mismatch", "Validation and controlled request must preserve the confirmed-outcome source review format.");
}
if (
  !validation.sourceConfirmedOutcomeReviewId ||
  !validation.sourceConfirmedOutcomeSourceRunId ||
  !validation.sourceRunId ||
  controlledRequest?.sourceConfirmedOutcomeReviewId !== validation.sourceConfirmedOutcomeReviewId ||
  controlledRequest?.sourceConfirmedOutcomeSourceRunId !== validation.sourceConfirmedOutcomeSourceRunId ||
  controlledRequest?.sourceRunId !== validation.sourceRunId
) {
  block(
    "confirmed_outcome_source_ids_missing_or_mismatched",
    "Validation and controlled request must preserve confirmed-outcome review, source run, and run ids."
  );
}

const requestHash = controlledRequest ? hashText(JSON.stringify(controlledRequest)) : "";
const dryRunId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${controlledRequest?.executionScope?.targetSoftware || "unknown"}`;
const dryRunDir = join(outRoot, dryRunId.replace(/[\\/:*?"<>|]/g, "_"));
const dryRunPath = join(dryRunDir, "real-case-confirmed-outcome-controlled-execution-dry-run.json");
const receiptTemplatePath = join(dryRunDir, "real-case-confirmed-outcome-controlled-execution-dry-run-receipt-template.json");
const readmePath = join(dryRunDir, "REAL_CASE_CONFIRMED_OUTCOME_CONTROLLED_EXECUTION_DRY_RUN_START_HERE.md");
const ok = blockers.length === 0;
const status = ok
  ? "real_case_confirmed_outcome_controlled_execution_dry_run_ready_for_teacher_runner_review"
  : "real_case_confirmed_outcome_controlled_execution_dry_run_blocked";
const locks = locked({ teacherReviewed });
const executionScope = controlledRequest?.executionScope || {};
const sourceContext = {
  confirmedOutcomeBranch: validation.confirmedOutcomeBranch === true,
  sourceReviewFormat: validation.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: validation.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: validation.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: validation.sourceRunId
};

const plannedNoOpRunnerSteps = [
  {
    step: "load_reviewed_controlled_execution_request",
    expectedEvidence: "controlledExecutionRequest hash matches this dry-run packet",
    noOp: true
  },
  {
    step: "resolve_target_software_and_control_channel_as_text_only",
    expectedEvidence: `${executionScope.targetSoftware || "unknown"} / ${
      executionScope.allowedControlChannel || "not_specified"
    }`,
    noOp: true
  },
  {
    step: "assert_retained_rollback_point_exists",
    expectedEvidence: controlledRequest?.rollbackPoint || "",
    noOp: true
  },
  {
    step: "simulate_adapter_selection_without_invocation",
    expectedEvidence: "adapterInvoked=false and uiEventsSent=false",
    noOp: true
  },
  {
    step: "stop_before_any_target_software_command",
    expectedEvidence: "requires separate real-runner review after teacher receipt",
    noOp: true
  }
];

const blockedActions = [
  "invoke_adapter_from_dry_run",
  "execute_target_software_command_from_dry_run",
  "send_ui_events_from_dry_run",
  "write_files_outside_dry_run_directory",
  "enable_rule_from_dry_run",
  "write_memory_from_dry_run",
  "fetch_rag_from_dry_run",
  "unlock_packaging_from_dry_run",
  "claim_acceptance_from_dry_run",
  "claim_goal_completion_from_dry_run"
];

const dryRun = {
  ok,
  format: "transparent_ai_real_case_confirmed_outcome_controlled_execution_dry_run_v1",
  dryRunId,
  createdAt: new Date().toISOString(),
  status,
  sourceExecutionGateValidationPath: normalized.path,
  sourceExecutionGateValidationHash: hashText(JSON.stringify(validation)),
  ...sourceContext,
  controlledExecutionRequestHash: requestHash,
  controlledExecutionRequest: controlledRequest || null,
  executionScope,
  rollbackPoint: controlledRequest?.rollbackPoint || "",
  teacherReviewed,
  dryRunOnly: true,
  executeNow: false,
  adapterInvocationAllowedHere: false,
  plannedNoOpRunnerSteps,
  blockers,
  blockedActions,
  locks,
  nextReview: {
    requiredDecision: "teacher_runner_review_required_before_real_execution",
    allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_separate_real_runner_gate"],
    forbiddenDecisions: ["execute_now", "accepted", "unlock_packaging", "write_memory", "fetch_rag"],
    requiresNewRollbackConfirmation: true,
    requiresAdapterSpecificGate: true
  },
  paths: {
    dryRun: dryRunPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceExecutionGateValidation: normalized.path
  }
};

const receiptTemplate = {
  format: "transparent_ai_real_case_confirmed_outcome_controlled_execution_dry_run_receipt_v1",
  sourceDryRunId: dryRunId,
  sourceDryRunPath: dryRunPath,
  sourceDryRunHash: hashText(JSON.stringify(dryRun)),
  ...sourceContext,
  controlledExecutionRequestHash: requestHash,
  teacherDecision: "needs_teacher_review",
  dryRunReviewed: false,
  rollbackPointReviewed: false,
  executionScopeReviewed: false,
  adapterSelectionReviewed: false,
  adapterSelection: {
    adapterId: "",
    adapterKind: "existing_tool_adapter",
    controlChannel: executionScope.allowedControlChannel || "",
    targetSoftware: executionScope.targetSoftware || "",
    allowedOperationSummary: executionScope.operationSummary || "",
    allowedArtifacts: executionScope.allowedArtifacts || [],
    forbiddenActions: executionScope.forbiddenActions || []
  },
  noOpLocksReviewed: false,
  blockedActionsConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  locks
};

writeJson(dryRunPath, dryRun);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed-Outcome Controlled Execution Dry-Run",
    "",
    `Status: ${status}`,
    `Dry-run only: ${dryRun.dryRunOnly}`,
    `Execute now: ${dryRun.executeNow}`,
    "",
    "This runner gate simulates adapter selection and execution planning only. It must not invoke adapters, send UI events, execute target software, write long-term memory, fetch RAG, unlock packaging, accept technology, or claim completion.",
    "",
    `Dry-run JSON: ${dryRunPath}`,
    `Receipt template: ${receiptTemplatePath}`,
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format: "transparent_ai_real_case_confirmed_outcome_controlled_execution_dry_run_result_v1",
      status,
      dryRunPath,
      receiptTemplatePath,
      readmePath,
      controlledExecutionRequestHash: requestHash,
      sourceExecutionGateValidationPath: normalized.path,
      ...sourceContext,
      rollbackPoint: controlledRequest?.rollbackPoint || "",
      dryRunOnly: true,
      executeNow: false,
      adapterInvoked: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      blockers,
      locks
    },
    null,
    2
  )
);

if (!ok) process.exitCode = 1;
