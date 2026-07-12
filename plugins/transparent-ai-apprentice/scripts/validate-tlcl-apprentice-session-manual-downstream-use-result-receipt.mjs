#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-manual-downstream-use-result-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-manual-downstream-use-result-receipt-validation"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(resolve(text)), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sameJson(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["manual_downstream_result_reviewed_ready_for_next_gate", "ready_for_next_gate"].includes(decision)) {
    return "manual_downstream_result_reviewed_ready_for_next_gate";
  }
  if (["needs_more_evidence", "blocked_needs_more_evidence"].includes(decision)) return "needs_more_evidence";
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_logic_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (["execute_now", "accepted", "enable_rule", "write_memory", "unlock_packaging", "claim_complete", "invoke_model", "fetch_rag"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotExecuteDownstreamTool: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    downstreamToolInvoked: false,
    targetSoftwareCommandsExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const validationInput = readJsonInput(argValue("--validation", argValue("--route-request-validation", "")), "--validation");
const receiptInput = readJsonInput(argValue("--receipt", argValue("--teacher-receipt", "")), "--receipt");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue(
      "--out-dir",
      join(process.cwd(), ".transparent-apprentice", "tlcl-apprentice-session-manual-downstream-result-receipt-validations")
    )
  )
);
mkdirSync(outputRoot, { recursive: true });

const validation = validationInput.value;
const receipt = receiptInput.value;
const manualDownstreamUse = validation?.manualDownstreamUse || null;
const decision = normalizeDecision(receipt?.teacherDecision);
const forbiddenDecisions = new Set([
  "execute_now",
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete",
  "invoke_model",
  "fetch_rag"
]);
const allowedDecisions = new Set([
  "manual_downstream_result_reviewed_ready_for_next_gate",
  "needs_more_evidence",
  "correction_to_high_reasoning_repair",
  "needs_teacher_review"
]);
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!validation) block("validation_missing", "A validated route request receipt validation is required.");
if (!receipt) block("receipt_missing", "A manual downstream use result receipt is required.");
if (
  validation &&
  ![
    "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_v1",
    "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_result_v1"
  ].includes(validation.format)
) {
  block("validation_format_invalid", "Validation must be a TLCL validated route request receipt validation packet or result.");
}
if (receipt && receipt.format !== "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_v1") {
  block("receipt_format_invalid", "Receipt must be transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_v1.");
}
if (validation && validation.readyForManualDownstreamUse !== true) {
  block("manual_downstream_use_not_ready", "Validation must be readyForManualDownstreamUse=true.");
}
if (validation && validation.status !== "tlcl_validated_route_request_reviewed_waiting_for_separate_manual_downstream_use") {
  block("validation_status_not_ready", "Validation status is not waiting for separate manual downstream use.");
}
if (!manualDownstreamUse) block("manual_downstream_use_missing", "Validation must contain manualDownstreamUse.");
if (manualDownstreamUse?.executeNow !== false) block("manual_downstream_execute_lock_missing", "manualDownstreamUse must keep executeNow=false.");
if (validation?.locks?.validatorDoesNotExecuteDownstreamTool !== true) {
  block("source_validation_lock_missing", "Source validation must prove it did not execute the downstream tool.");
}
if (receipt?.sourceValidationId !== validation?.validationId) {
  block("source_validation_id_mismatch", "Receipt sourceValidationId must match validation.validationId.");
}
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt?.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt?.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt?.reviewedRoute !== manualDownstreamUse?.route) block("reviewed_route_mismatch", "Receipt reviewedRoute must match manualDownstreamUse.route.");
if (receipt?.reviewedNextTool !== manualDownstreamUse?.nextTool) {
  block("reviewed_next_tool_mismatch", "Receipt reviewedNextTool must match manualDownstreamUse.nextTool.");
}
if (!sameJson(receipt?.reviewedArgs || {}, manualDownstreamUse?.args || {})) {
  block("reviewed_args_mismatch", "Receipt reviewedArgs must match manualDownstreamUse.args.");
}
if (receipt?.reviewedCommandTemplate !== manualDownstreamUse?.commandTemplate) {
  block("reviewed_command_template_mismatch", "Receipt reviewedCommandTemplate must match manualDownstreamUse.commandTemplate.");
}
if (receipt?.confirmedRollbackPoint !== manualDownstreamUse?.confirmedRollbackPoint) {
  block("rollback_point_mismatch", "Receipt confirmedRollbackPoint must match manualDownstreamUse.confirmedRollbackPoint.");
}
if (receipt?.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");

const resultEvidencePaths = Array.isArray(receipt?.resultEvidencePaths)
  ? receipt.resultEvidencePaths.map((item) => String(item || "").trim()).filter(Boolean)
  : [];
const observedStatus = String(receipt?.observedResultStatus || "").trim();
const observedStatusAllowed = new Set(["completed_reviewed", "completed_with_warnings", "blocked_needs_more_evidence"]);

if (decision === "manual_downstream_result_reviewed_ready_for_next_gate") {
  if (receipt?.manualDownstreamUseWasSeparate !== true) {
    block("manual_downstream_step_not_confirmed_separate", "Teacher must confirm the downstream step was separate.");
  }
  if (receipt?.downstreamResultEvidenceReviewed !== true) {
    block("downstream_result_evidence_not_reviewed", "Teacher must review downstream result evidence.");
  }
  if (!observedStatusAllowed.has(observedStatus)) {
    block("observed_result_status_not_allowed", "Observed result status must be completed_reviewed, completed_with_warnings, or blocked_needs_more_evidence.");
  }
  if (resultEvidencePaths.length === 0) {
    block("result_evidence_missing", "At least one result evidence path or summary is required.");
  }
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt?.teacherNotes || "").trim()) {
  block("high_reasoning_repair_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForNextGate = decision === "manual_downstream_result_reviewed_ready_for_next_gate" && blockerRows.length === 0;
const correctionToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_manual_downstream_result_decision"
  : readyForNextGate
    ? "manual_downstream_result_reviewed_waiting_for_next_tlcl_gate_selection"
    : correctionToHighReasoningRepair
      ? "correction_to_high_reasoning_repair_required"
      : "needs_teacher_review_or_more_downstream_result_evidence";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(manualDownstreamUse?.route || decision)}`;
const validationDir = join(outputRoot, validationId);
const resultValidationPath = join(validationDir, "tlcl-apprentice-session-manual-downstream-use-result-receipt-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-apprentice-session-manual-downstream-use-result-receipt-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_MANUAL_DOWNSTREAM_USE_RESULT_RECEIPT_VALIDATION_START_HERE.md");
const validationLocks = locks();

const reviewedDownstreamResult = readyForNextGate
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_v1",
      sourceRouteRequestValidationId: validation?.validationId || "",
      route: manualDownstreamUse.route || "",
      nextTool: manualDownstreamUse.nextTool || "",
      args: manualDownstreamUse.args || {},
      commandTemplate: manualDownstreamUse.commandTemplate || "",
      observedResultStatus: observedStatus,
      resultEvidencePaths,
      confirmedRollbackPoint: manualDownstreamUse.confirmedRollbackPoint || "",
      nextGate: "teacher_selects_next_tlcl_gate_from_reviewed_manual_downstream_result",
      executeNow: false,
      reviewOnly: true
    }
  : null;

const resultValidation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForNextGate,
  correctionToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers: blockerRows,
  sourceEvidence: {
    routeRequestValidationPath: validationInput.path,
    receiptPath: receiptInput.path,
    sourceRouteRequestValidationId: validation?.validationId || ""
  },
  reviewedDownstreamResult,
  highReasoningRepairHandoff:
    correctionToHighReasoningRepair && !forbiddenDecisionUsed
      ? {
          route: "high_reasoning_logic_contract_repair_after_manual_downstream_result",
          sourceValidationId: validation?.validationId || "",
          teacherNotes: receipt?.teacherNotes || "",
          instruction:
            "Return to the high-reasoning compile layer because the manual downstream result revealed a logic, evidence, or route problem."
        }
      : null,
  blockedActions: [
    "execute_downstream_tool_from_manual_downstream_result_validation",
    "auto_run_command_from_manual_downstream_result_validation",
    "invoke_model_from_manual_downstream_result_validation",
    "fetch_rag_from_manual_downstream_result_validation",
    "write_memory_from_manual_downstream_result_validation",
    "enable_rule_from_manual_downstream_result_validation",
    "unlock_packaging_from_manual_downstream_result_validation",
    "claim_completion_from_manual_downstream_result_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: resultValidationPath,
    receipt: receiptRecordPath,
    readme: readmePath,
    sourceValidation: validationInput.path,
    sourceReceipt: receiptInput.path
  }
};
const validationReceipt = {
  format: "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForNextGate,
  correctionToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers: blockerRows,
  downstreamToolInvoked: false,
  targetSoftwareCommandsExecuted: false,
  modelInvoked: false,
  ragFetched: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: validationLocks
};

writeJson(resultValidationPath, resultValidation);
writeJson(receiptRecordPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Manual Downstream Use Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Decision: ${decision}`,
    `- Ready for next TLCL gate selection: ${readyForNextGate}`,
    "",
    "This validation only checks teacher-reviewed result evidence from a separate manual downstream step. It does not run the downstream tool, auto-run commands, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockerRows.length ? blockerRows.map((row) => `- ${row.code}: ${row.message}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: !forbiddenDecisionUsed,
      format: "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForNextGate,
      correctionToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers: blockerRows,
      validationPath: resultValidationPath,
      receiptPath: receiptRecordPath,
      readmePath,
      reviewedDownstreamResult,
      locks: validationLocks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
