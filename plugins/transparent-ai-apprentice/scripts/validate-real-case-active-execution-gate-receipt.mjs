#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
  if (["approve_controlled_execution_request", "approve_execution_request", "controlled_execution_request"].includes(decision)) {
    return "approve_controlled_execution_request";
  }
  if (["request_high_reasoning_repair", "high_reasoning_repair", "repair", "mismatch"].includes(decision)) {
    return "request_high_reasoning_repair";
  }
  if (["request_more_evidence", "needs_more_evidence", "more_evidence"].includes(decision)) return "request_more_evidence";
  if (decision === "blocked") return "blocked";
  if (
    [
      "execute_now",
      "execute_software",
      "send_ui_events",
      "enable_rule",
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
    validationOnly: true,
    activeDeliveryGateReviewed: approved,
    controlledExecutionRequestApproved: approved,
    controlledExecutionRequestCreated: approved,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateControlledRunner: true
  };
}

const gateInput = readJsonInput(
  argValue("--delivery-gate", argValue("--gate", "")),
  "--delivery-gate",
  "transparent_ai_real_case_active_validation_report_delivery_gate_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_active_execution_gate_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-active-execution-gate-validations"))
);
const gate = gateInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbidden = new Set([
  "execute_now",
  "execute_software",
  "send_ui_events",
  "enable_rule",
  "write_memory",
  "fetch_rag",
  "unlock_packaging",
  "accepted",
  "claim_complete",
  "package_release"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (receipt.sourceDeliveryGateId !== gate.gateId) block("source_delivery_gate_id_mismatch", "Receipt sourceDeliveryGateId must match gateId.");
if (receipt.sourceDeliveryGateHash !== hashText(JSON.stringify(gate))) {
  block("source_delivery_gate_hash_mismatch", "Receipt sourceDeliveryGateHash must match the active delivery gate.");
}
if (receipt.rollbackPoint && resolve(receipt.rollbackPoint) !== resolve(gate.rollbackPoint || "")) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match the active delivery gate rollbackPoint.");
}
if (receipt.executeNow !== false) block("receipt_execute_now_forbidden", "Receipt must keep executeNow=false.");
if (receipt.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt.blockedTransitionsConfirmed !== true) block("blocked_transitions_not_confirmed", "Teacher must confirm blocked transitions.");
if (forbidden.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);

if (
  gate.status !== "active_delivery_gate_closed_ready_for_teacher_execution_gate_review" ||
  gate.summary?.reportDeliveryAllowed !== true ||
  gate.summary?.gateAllowsExecution !== false ||
  gate.summary?.gateRequiresTeacherExecutionGate !== true ||
  gate.nextReview?.requiresSeparateExecutionGate !== true ||
  gate.locks?.deliveryGateOpen !== false ||
  gate.locks?.ruleEnabled !== false ||
  gate.locks?.targetSoftwareCommandsExecuted !== false ||
  gate.locks?.memoryWritten !== false ||
  gate.locks?.ragFetched !== false ||
  gate.locks?.packagingUnlocked !== false
) {
  block("source_delivery_gate_not_locked", "Source active delivery gate must be closed and locked before execution review.");
}
if (!gate.rollbackPoint || !existsSync(gate.rollbackPoint)) block("rollback_point_not_found", "Retained rollback point must still exist.");
if (!gate.compiledActiveRulePackagePath || !existsSync(gate.compiledActiveRulePackagePath)) {
  block("compiled_active_rule_package_not_found", "Compiled active Rule Package must still exist.");
}
if (!gate.validationReportPath || !existsSync(gate.validationReportPath)) {
  block("validation_report_not_found", "Validation Report must still exist.");
}

if (decision === "approve_controlled_execution_request") {
  if (receipt.deliveryGateReviewed !== true) block("delivery_gate_not_reviewed", "Teacher must review the closed active delivery gate.");
  if (receipt.validationReportReviewed !== true) block("validation_report_not_reviewed", "Teacher must review the active Validation Report.");
  if (receipt.activeRulePackageReviewed !== true) block("active_rule_package_not_reviewed", "Teacher must review the active Rule Package.");
  if (receipt.warningEvidenceReviewed !== true) block("warning_evidence_not_reviewed", "Teacher must review warning evidence, even if non-blocking.");
  if (receipt.rollbackRetained !== true) block("rollback_not_retained", "Teacher must confirm rollback point is retained.");
  if (receipt.executionScopeReviewed !== true) block("execution_scope_not_reviewed", "Teacher must review the execution scope.");
  if (receipt.controlledExecutionOnlyConfirmed !== true) {
    block("controlled_execution_only_not_confirmed", "Teacher must confirm only a controlled execution request is approved.");
  }
  if (receipt.separateRunnerRequiredConfirmed !== true) {
    block("separate_runner_not_confirmed", "Teacher must confirm a separate runner gate is required.");
  }
  if (receipt.teacherConfirmedNoImmediateExecution !== true) {
    block("no_immediate_execution_not_confirmed", "Teacher must confirm no immediate execution happens here.");
  }
  if (!String(receipt.executionScope?.operationSummary || "").trim()) {
    block("execution_scope_operation_missing", "Execution scope operationSummary is required.");
  }
  if (!String(receipt.executionScope?.targetSoftware || "").trim()) {
    block("execution_scope_target_software_missing", "Execution scope targetSoftware is required.");
  }
}
if ((decision === "request_high_reasoning_repair" || decision === "request_more_evidence") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_note_required", `${decision} requires teacherNotes.`);
}

const forbiddenDecisionUsed = forbidden.has(decision);
const readyForControlledExecutionRequest =
  decision === "approve_controlled_execution_request" && !forbiddenDecisionUsed && blockers.length === 0;
const routesToHighReasoningRepair = decision === "request_high_reasoning_repair" && !forbiddenDecisionUsed && blockers.length === 0;
const routesToMoreEvidence = decision === "request_more_evidence" && !forbiddenDecisionUsed && blockers.length === 0;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_real_case_active_execution_gate_decision"
  : readyForControlledExecutionRequest
    ? "real_case_active_execution_gate_ready_for_controlled_execution_request"
    : routesToHighReasoningRepair
      ? "real_case_active_execution_gate_routes_to_high_reasoning_repair"
      : routesToMoreEvidence
        ? "real_case_active_execution_gate_waiting_for_more_evidence"
        : "real_case_active_execution_gate_needs_teacher_review";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${decision}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "real-case-active-execution-gate-validation.json");
const receiptRecordPath = join(validationDir, "real-case-active-execution-gate-receipt.json");
const readmePath = join(validationDir, "REAL_CASE_ACTIVE_EXECUTION_GATE_VALIDATION_START_HERE.md");
const validationLocks = locks({ approved: readyForControlledExecutionRequest });

const controlledExecutionRequest = readyForControlledExecutionRequest
  ? {
      format: "transparent_ai_real_case_controlled_execution_request_v1",
      sourceDeliveryGateId: gate.gateId,
      sourceDeliveryGatePath: gateInput.path,
      sourceDeliveryGateHash: hashText(JSON.stringify(gate)),
      validationReportPath: gate.validationReportPath,
      compiledActiveRulePackagePath: gate.compiledActiveRulePackagePath,
      rollbackPoint: gate.rollbackPoint,
      caseType: gate.caseType || "",
      activeRuleCount: gate.activeRuleCount,
      executionScope: receipt.executionScope,
      approvedByTeacher: true,
      executeNow: false,
      requiresSeparateControlledRunner: true,
      runnerMayOnlyUseReviewedScope: true,
      noBackgroundAutonomy: true,
      noPackagingUnlock: true,
      noMemoryWrite: true,
      noRagFetch: true
    }
  : null;
const highReasoningRepairHandoff = routesToHighReasoningRepair
  ? {
      format: "transparent_ai_real_case_active_execution_gate_high_reasoning_repair_handoff_v1",
      sourceDeliveryGateId: gate.gateId,
      teacherNotes: receipt.teacherNotes || "",
      executeNow: false,
      reviewOnly: true
    }
  : null;
const moreEvidenceHandoff = routesToMoreEvidence
  ? {
      format: "transparent_ai_real_case_active_execution_gate_more_evidence_handoff_v1",
      sourceDeliveryGateId: gate.gateId,
      teacherNotes: receipt.teacherNotes || "",
      requestedEvidenceKinds: ["execution_scope", "rollback_point", "control_channel", "active_validation_report", "active_rule_package"],
      executeNow: false,
      reviewOnly: true
    }
  : null;

const result = {
  ok: !forbiddenDecisionUsed && blockers.length === 0,
  format: "transparent_ai_real_case_active_execution_gate_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForControlledExecutionRequest,
  routesToHighReasoningRepair,
  routesToMoreEvidence,
  forbiddenDecisionUsed,
  blockers,
  controlledExecutionRequest,
  highReasoningRepairHandoff,
  moreEvidenceHandoff,
  blockedActions: [
    "execute_software_from_execution_gate_validation",
    "send_ui_events_from_execution_gate_validation",
    "enable_rule_from_execution_gate_validation",
    "write_memory_from_execution_gate_validation",
    "fetch_rag_from_execution_gate_validation",
    "unlock_packaging_from_execution_gate_validation",
    "claim_completion_from_execution_gate_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceDeliveryGate: gateInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeJson(validationPath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real-Case Active Execution Gate Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation may approve only a controlled execution request for a later separate runner. It does not execute software, enable rules, write memory, fetch RAG, unlock packaging, accept technology, or claim completion.",
    "",
    `Validation JSON: ${validationPath}`,
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: result.ok,
      format: "transparent_ai_real_case_active_execution_gate_validation_result_v1",
      status,
      validationPath,
      receiptRecordPath,
      readmePath,
      readyForControlledExecutionRequest,
      controlledExecutionRequest,
      highReasoningRepairHandoff,
      moreEvidenceHandoff,
      blockers,
      executeNow: false,
      locks: validationLocks
    },
    null,
    2
  )
);
