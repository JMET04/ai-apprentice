#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-validated-route-request-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-validated-route-request-receipt-validation"
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
  if (
    [
      "teacher_reviewed_downstream_request_ready_for_manual_use",
      "ready_for_manual_use",
      "ready_for_separate_manual_use"
    ].includes(decision)
  ) {
    return "teacher_reviewed_downstream_request_ready_for_manual_use";
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

const builderInput = readJsonInput(argValue("--builder", argValue("--command-builder", "")), "--builder");
const receiptInput = readJsonInput(argValue("--receipt", argValue("--teacher-receipt", "")), "--receipt");
const outputRoot = resolve(
  argValue(
    "--output-dir",
    argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-apprentice-session-validated-route-request-receipt-validations"))
  )
);
mkdirSync(outputRoot, { recursive: true });

const builder = builderInput.value;
const receipt = receiptInput.value;
const request = builder?.downstreamRequest || null;
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
  "teacher_reviewed_downstream_request_ready_for_manual_use",
  "needs_more_evidence",
  "correction_to_high_reasoning_repair",
  "needs_teacher_review"
]);
const blockerRows = [];
function block(code, message) {
  blockerRows.push({ code, message });
}

if (!builder) block("builder_missing", "A validated route command builder is required.");
if (!receipt) block("receipt_missing", "A teacher route request receipt is required.");
if (builder && builder.format !== "transparent_ai_tlcl_apprentice_session_validated_route_command_builder_v1") {
  block("builder_format_invalid", "Builder must be transparent_ai_tlcl_apprentice_session_validated_route_command_builder_v1.");
}
if (receipt && receipt.format !== "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_v1") {
  block("receipt_format_invalid", "Receipt must be transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_v1.");
}
if (builder && builder.ok !== true) block("builder_not_ok", "Builder must be ok=true.");
if (builder && builder.status !== "tlcl_validated_route_command_builder_waiting_for_teacher_copy") {
  block("builder_status_not_ready", "Builder status is not ready for receipt validation.");
}
if (!request) block("downstream_request_missing", "Builder must contain downstreamRequest.");
if (request?.format !== "transparent_ai_tlcl_apprentice_session_validated_route_downstream_request_v1") {
  block("downstream_request_format_invalid", "Builder downstreamRequest has the wrong format.");
}
if (request?.executeNow !== false) block("downstream_execute_lock_missing", "Builder downstreamRequest must keep executeNow=false.");
if (builder?.locks?.builderDoesNotExecuteDownstreamTool !== true) {
  block("source_builder_lock_missing", "Builder must prove it did not execute the downstream tool.");
}
if (receipt?.sourceBuilderId !== builder?.builderId) block("source_builder_id_mismatch", "Receipt sourceBuilderId must match builder.builderId.");
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not an allowed route request receipt decision.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt?.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt?.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt?.reviewedRoute !== request?.route) block("reviewed_route_mismatch", "Receipt reviewedRoute must match downstreamRequest.route.");
if (receipt?.reviewedNextTool !== request?.nextTool) block("reviewed_next_tool_mismatch", "Receipt reviewedNextTool must match downstreamRequest.nextTool.");
if (!sameJson(receipt?.reviewedArgs || {}, request?.args || {})) block("reviewed_args_mismatch", "Receipt reviewedArgs must match downstreamRequest.args.");
if (receipt?.reviewedCommandTemplate !== request?.commandTemplate) {
  block("reviewed_command_template_mismatch", "Receipt reviewedCommandTemplate must match downstreamRequest.commandTemplate.");
}
if (!sameJson(receipt?.reviewedNoOpLocks || {}, builder?.locks || {})) {
  block("reviewed_no_op_locks_mismatch", "Receipt reviewedNoOpLocks must match builder.locks.");
}
if (receipt?.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");

const rollbackText = String(receipt?.confirmedRollbackPoint || "").trim();
const placeholderRollback =
  !rollbackText ||
  rollbackText === "<required retained rollback point id/path>" ||
  rollbackText === "<rollback>" ||
  rollbackText === "rollback";

if (decision === "teacher_reviewed_downstream_request_ready_for_manual_use") {
  if (receipt?.downstreamRequestReviewed !== true) block("downstream_request_not_reviewed", "Teacher must review the downstream request.");
  if (receipt?.commandTemplateReviewed !== true) block("command_template_not_reviewed", "Teacher must review the command template.");
  if (receipt?.noOpLocksReviewed !== true) block("no_op_locks_not_reviewed", "Teacher must review the no-op locks.");
  if (receipt?.separateManualStepConfirmed !== true) {
    block("separate_manual_step_not_confirmed", "Teacher must confirm downstream use is a separate manual step.");
  }
  if (placeholderRollback) block("confirmed_rollback_point_missing", "Teacher must provide a retained rollback point id or path.");
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt?.teacherNotes || "").trim()) {
  block("high_reasoning_repair_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}

const readyForManualDownstreamUse =
  decision === "teacher_reviewed_downstream_request_ready_for_manual_use" && blockerRows.length === 0;
const correctionToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisions.has(decision);
const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_route_request_receipt_decision"
  : readyForManualDownstreamUse
    ? "tlcl_validated_route_request_reviewed_waiting_for_separate_manual_downstream_use"
    : correctionToHighReasoningRepair
      ? "correction_to_high_reasoning_repair_required"
      : "needs_teacher_review_or_more_downstream_request_evidence";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(request?.route || decision)}`;
const validationDir = join(outputRoot, validationId);
const validationPath = join(validationDir, "tlcl-apprentice-session-validated-route-request-receipt-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-apprentice-session-validated-route-request-receipt-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_VALIDATED_ROUTE_REQUEST_RECEIPT_VALIDATION_START_HERE.md");
const validationLocks = locks();

const manualDownstreamUse = readyForManualDownstreamUse
  ? {
      format: "transparent_ai_tlcl_apprentice_session_validated_route_manual_downstream_use_v1",
      route: request.route || "",
      nextTool: request.nextTool || "",
      args: request.args || {},
      commandTemplate: request.commandTemplate || "",
      commandHint: request.commandHint || "",
      confirmedRollbackPoint: rollbackText,
      executeNow: false,
      reviewOnly: true,
      instruction:
        "This validation only proves teacher review. Downstream use remains a separate explicit manual step and must not be invoked by this validator."
    }
  : null;

const validation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForManualDownstreamUse,
  correctionToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers: blockerRows,
  sourceEvidence: {
    builderPath: builderInput.path,
    receiptPath: receiptInput.path,
    builderId: builder?.builderId || "",
    downstreamRequestFormat: request?.format || ""
  },
  manualDownstreamUse,
  highReasoningRepairHandoff:
    correctionToHighReasoningRepair && !forbiddenDecisionUsed
      ? {
          route: "high_reasoning_logic_contract_repair",
          sourceBuilderId: builder?.builderId || "",
          teacherNotes: receipt?.teacherNotes || "",
          instruction:
            "Return to the high-reasoning compile layer to repair the logic contract, request evidence, no-op locks, or route before rebuilding this downstream request."
        }
      : null,
  blockedActions: [
    "execute_downstream_tool_from_route_request_receipt_validation",
    "auto_run_command_from_route_request_receipt_validation",
    "invoke_model_from_route_request_receipt_validation",
    "fetch_rag_from_route_request_receipt_validation",
    "write_memory_from_route_request_receipt_validation",
    "enable_rule_from_route_request_receipt_validation",
    "unlock_packaging_from_route_request_receipt_validation",
    "claim_completion_from_route_request_receipt_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receipt: receiptRecordPath,
    readme: readmePath,
    sourceBuilder: builderInput.path,
    sourceReceipt: receiptInput.path
  }
};
const validationReceipt = {
  format: "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForManualDownstreamUse,
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

writeJson(validationPath, validation);
writeJson(receiptRecordPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Validated Route Request Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Decision: ${decision}`,
    `- Ready for separate manual downstream use: ${readyForManualDownstreamUse}`,
    "",
    "This validation only checks the teacher-filled route request receipt. It does not run the downstream tool, auto-run commands, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForManualDownstreamUse,
      correctionToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers: blockerRows,
      validationPath,
      receiptPath: receiptRecordPath,
      readmePath,
      manualDownstreamUse,
      locks: validationLocks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
