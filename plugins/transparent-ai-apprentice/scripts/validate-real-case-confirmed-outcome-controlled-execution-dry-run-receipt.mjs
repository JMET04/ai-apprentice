#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
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
  if (expectedFormat && parsed.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return { value: parsed, path: sourcePath };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["ready_for_separate_real_runner_gate", "approve_adapter_specific_runner_gate", "approve_real_runner_gate"].includes(decision)) {
    return "ready_for_separate_real_runner_gate";
  }
  if (["request_high_reasoning_repair", "repair", "high_reasoning_repair", "mismatch"].includes(decision)) {
    return "request_high_reasoning_repair";
  }
  if (["request_more_evidence", "needs_more_evidence", "more_evidence"].includes(decision)) return "request_more_evidence";
  if (decision === "blocked") return "blocked";
  if (
    [
      "execute_now",
      "invoke_adapter",
      "send_ui_events",
      "execute_software",
      "write_memory",
      "fetch_rag",
      "unlock_packaging",
      "accepted",
      "claim_complete",
      "package_release"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks({ approved = false } = {}) {
  return {
    reviewOnly: true,
    confirmedOutcomeBranch: true,
    approvalGateOnly: true,
    dryRunReviewed: approved,
    adapterSpecificGateCreated: approved,
    adapterInvocationAllowedHere: false,
    adapterInvoked: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    uiEventsSent: false,
    filesWrittenOutsideGateDir: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateRealRunner: true,
    requiresFinalTeacherExecuteConfirmation: true
  };
}

const dryRunInput = readJsonInput(
  argValue("--dry-run", argValue("--controlled-execution-dry-run", "")),
  "--dry-run",
  "transparent_ai_real_case_confirmed_outcome_controlled_execution_dry_run_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_confirmed_outcome_controlled_execution_dry_run_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-adapter-specific-runner-approval-gates")
  )
);

const dryRun = dryRunInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

const forbidden = new Set([
  "execute_now",
  "invoke_adapter",
  "send_ui_events",
  "execute_software",
  "write_memory",
  "fetch_rag",
  "unlock_packaging",
  "accepted",
  "claim_complete",
  "package_release"
]);

if (receipt.sourceDryRunId !== dryRun.dryRunId) block("source_dry_run_id_mismatch", "Receipt sourceDryRunId must match dryRunId.");
if (receipt.sourceDryRunHash !== hashText(JSON.stringify(dryRun))) {
  block("source_dry_run_hash_mismatch", "Receipt sourceDryRunHash must match the confirmed-outcome dry-run packet.");
}
if (receipt.controlledExecutionRequestHash !== dryRun.controlledExecutionRequestHash) {
  block("controlled_execution_request_hash_mismatch", "Receipt controlledExecutionRequestHash must match dry-run packet.");
}
if (dryRun.confirmedOutcomeBranch !== true) {
  block("source_confirmed_outcome_branch_missing", "Dry-run must preserve confirmedOutcomeBranch=true.");
}
if (dryRun.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  block("source_review_format_mismatch", "Dry-run must preserve the confirmed-outcome source review format.");
}
if (!dryRun.sourceConfirmedOutcomeReviewId || !dryRun.sourceConfirmedOutcomeSourceRunId || !dryRun.sourceRunId) {
  block("source_ids_missing", "Dry-run must preserve confirmed-outcome review, source run, and run ids.");
}
if (receipt.confirmedOutcomeBranch !== true) {
  block("receipt_source_confirmed_outcome_branch_missing", "Receipt must preserve confirmedOutcomeBranch=true.");
}
if (receipt.sourceReviewFormat !== dryRun.sourceReviewFormat) {
  block("receipt_source_review_format_mismatch", "Receipt sourceReviewFormat must match the dry-run packet.");
}
if (receipt.sourceConfirmedOutcomeReviewId !== dryRun.sourceConfirmedOutcomeReviewId) {
  block("receipt_source_review_id_mismatch", "Receipt sourceConfirmedOutcomeReviewId must match the dry-run packet.");
}
if (receipt.sourceConfirmedOutcomeSourceRunId !== dryRun.sourceConfirmedOutcomeSourceRunId) {
  block(
    "receipt_source_confirmed_outcome_source_run_id_mismatch",
    "Receipt sourceConfirmedOutcomeSourceRunId must match the dry-run packet."
  );
}
if (receipt.sourceRunId !== dryRun.sourceRunId) {
  block("receipt_source_run_id_mismatch", "Receipt sourceRunId must match the dry-run packet.");
}
if (receipt.executeNow !== false) block("receipt_execute_now_forbidden", "Receipt must keep executeNow=false.");
if (forbidden.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);

if (
  dryRun.status !== "real_case_confirmed_outcome_controlled_execution_dry_run_ready_for_teacher_runner_review" ||
  dryRun.dryRunOnly !== true ||
  dryRun.executeNow !== false ||
  dryRun.adapterInvocationAllowedHere !== false ||
  dryRun.locks?.adapterInvoked !== false ||
  dryRun.locks?.targetSoftwareCommandsExecuted !== false ||
  dryRun.locks?.uiEventsSent !== false ||
  dryRun.locks?.memoryWritten !== false ||
  dryRun.locks?.ragFetched !== false ||
  dryRun.locks?.packagingUnlocked !== false
) {
  block("source_dry_run_not_locked_ready", "Source confirmed-outcome dry-run must be ready, dry-run-only, and no-op locked.");
}
if (!dryRun.rollbackPoint || !existsSync(dryRun.rollbackPoint)) block("rollback_point_not_found", "Dry-run rollback point must still exist.");
if (!String(dryRun.executionScope?.targetSoftware || "").trim()) {
  block("dry_run_target_software_missing", "Dry-run executionScope.targetSoftware is required.");
}
if (!String(dryRun.executionScope?.operationSummary || "").trim()) {
  block("dry_run_operation_summary_missing", "Dry-run executionScope.operationSummary is required.");
}

if (decision === "ready_for_separate_real_runner_gate") {
  if (receipt.dryRunReviewed !== true) block("dry_run_not_reviewed", "Teacher must review the confirmed-outcome controlled execution dry-run.");
  if (receipt.rollbackPointReviewed !== true) block("rollback_not_reviewed", "Teacher must review the retained rollback point.");
  if (receipt.executionScopeReviewed !== true) block("execution_scope_not_reviewed", "Teacher must review the execution scope.");
  if (receipt.adapterSelectionReviewed !== true) block("adapter_selection_not_reviewed", "Teacher must review adapter selection.");
  if (receipt.noOpLocksReviewed !== true) block("no_op_locks_not_reviewed", "Teacher must review no-op locks.");
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");
  if (!String(receipt.adapterSelection?.adapterId || "").trim()) block("adapter_id_missing", "adapterSelection.adapterId is required.");
  if (!String(receipt.adapterSelection?.controlChannel || "").trim()) {
    block("adapter_control_channel_missing", "adapterSelection.controlChannel is required.");
  }
  if (receipt.adapterSelection?.targetSoftware !== dryRun.executionScope?.targetSoftware) {
    block("adapter_target_software_mismatch", "adapterSelection.targetSoftware must match dry-run execution scope.");
  }
  if (receipt.adapterSelection?.allowedOperationSummary !== dryRun.executionScope?.operationSummary) {
    block("adapter_operation_summary_mismatch", "adapterSelection.allowedOperationSummary must match dry-run execution scope.");
  }
}
if ((decision === "request_high_reasoning_repair" || decision === "request_more_evidence") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_note_required", `${decision} requires teacherNotes.`);
}

const approved = decision === "ready_for_separate_real_runner_gate" && blockers.length === 0;
const routesToHighReasoningRepair = decision === "request_high_reasoning_repair" && blockers.length === 0;
const routesToMoreEvidence = decision === "request_more_evidence" && blockers.length === 0;
const status = forbidden.has(decision)
  ? "blocked_for_forbidden_confirmed_outcome_runner_gate_decision"
  : approved
    ? "real_case_confirmed_outcome_adapter_specific_runner_approval_gate_ready_for_separate_real_runner"
    : routesToHighReasoningRepair
      ? "real_case_confirmed_outcome_adapter_specific_runner_gate_routes_to_high_reasoning_repair"
      : routesToMoreEvidence
        ? "real_case_confirmed_outcome_adapter_specific_runner_gate_waiting_for_more_evidence"
        : "real_case_confirmed_outcome_adapter_specific_runner_gate_needs_teacher_review";
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${receipt.adapterSelection?.adapterId || decision}`;
const gateDir = join(outRoot, gateId.replace(/[\\/:*?"<>|]/g, "_"));
const gatePath = join(gateDir, "real-case-confirmed-outcome-adapter-specific-runner-approval-gate.json");
const receiptRecordPath = join(gateDir, "real-case-confirmed-outcome-controlled-execution-dry-run-receipt.json");
const readmePath = join(gateDir, "REAL_CASE_CONFIRMED_OUTCOME_ADAPTER_SPECIFIC_RUNNER_APPROVAL_GATE_START_HERE.md");
const gateLocks = locks({ approved });
const sourceContext = {
  confirmedOutcomeBranch: dryRun.confirmedOutcomeBranch === true,
  sourceReviewFormat: dryRun.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: dryRun.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: dryRun.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: dryRun.sourceRunId
};

const separateRealRunnerRequest = approved
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_separate_real_runner_request_v1",
      sourceDryRunId: dryRun.dryRunId,
      sourceDryRunPath: dryRunInput.path,
      sourceDryRunHash: hashText(JSON.stringify(dryRun)),
      ...sourceContext,
      controlledExecutionRequestHash: dryRun.controlledExecutionRequestHash,
      rollbackPoint: dryRun.rollbackPoint,
      executionScope: dryRun.executionScope,
      adapterSelection: receipt.adapterSelection,
      executeNow: false,
      requiresFinalTeacherExecuteConfirmation: true,
      requiresFreshRollbackPointBeforeRun: true,
      runnerMayOnlyUseReviewedScope: true,
      oneControlledAttemptOnly: true,
      noBackgroundAutonomy: true,
      noMemoryWrite: true,
      noRagFetch: true,
      noPackagingUnlock: true,
      confirmedOutcomeBranch: true
    }
  : null;

const result = {
  ok: !forbidden.has(decision) && blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_adapter_specific_runner_approval_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  approvedForSeparateRealRunner: approved,
  routesToHighReasoningRepair,
  routesToMoreEvidence,
  blockers,
  sourceDryRunPath: dryRunInput.path,
  sourceDryRunHash: hashText(JSON.stringify(dryRun)),
  ...sourceContext,
  controlledExecutionRequestHash: dryRun.controlledExecutionRequestHash,
  rollbackPoint: dryRun.rollbackPoint,
  executionScope: dryRun.executionScope,
  adapterSelection: receipt.adapterSelection || null,
  separateRealRunnerRequest,
  blockedActions: [
    "invoke_adapter_from_confirmed_outcome_approval_gate",
    "execute_target_software_command_from_confirmed_outcome_approval_gate",
    "send_ui_events_from_confirmed_outcome_approval_gate",
    "write_memory_from_confirmed_outcome_approval_gate",
    "fetch_rag_from_confirmed_outcome_approval_gate",
    "unlock_packaging_from_confirmed_outcome_approval_gate",
    "claim_acceptance_from_confirmed_outcome_approval_gate",
    "claim_completion_from_confirmed_outcome_approval_gate"
  ],
  nextReview: {
    requiredDecision: approved ? "confirmed_outcome_separate_real_runner_requires_final_teacher_execute_confirmation" : "teacher_review_required",
    allowedDecisions: ["needs_teacher_review", "blocked", "ready_for_final_execute_confirmation"],
    forbiddenDecisions: ["execute_now_from_gate", "accepted", "unlock_packaging", "write_memory", "fetch_rag"],
    requiresFreshRollbackPointBeforeRun: true,
    requiresAdapterSpecificRunner: true,
    confirmedOutcomeBranch: true
  },
  locks: gateLocks,
  paths: {
    gate: gatePath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceDryRun: dryRunInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeJson(gatePath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed-Outcome Adapter-Specific Runner Approval Gate",
    "",
    `Status: ${status}`,
    `Approved for separate real runner: ${approved}`,
    "",
    "This gate approves only a confirmed-outcome separate real-runner request with executeNow=false. It does not invoke adapters, send UI events, execute target software, write memory, fetch RAG, unlock packaging, accept technology, or claim completion.",
    "",
    `Gate JSON: ${gatePath}`,
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: result.ok,
      format: "transparent_ai_real_case_confirmed_outcome_adapter_specific_runner_approval_gate_result_v1",
      status,
      gatePath,
      receiptRecordPath,
      readmePath,
      approvedForSeparateRealRunner: approved,
      ...sourceContext,
      separateRealRunnerRequest,
      blockers,
      executeNow: false,
      adapterInvoked: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      locks: gateLocks
    },
    null,
    2
  )
);

if (!result.ok) process.exitCode = 1;
