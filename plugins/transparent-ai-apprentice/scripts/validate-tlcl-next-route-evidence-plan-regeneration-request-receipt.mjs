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

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (
    parsed.value?.format === "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_result_v1" &&
    parsed.value?.builderPath &&
    existsSync(parsed.value.builderPath)
  ) {
    return { value: readJson(resolve(parsed.value.builderPath)), path: resolve(parsed.value.builderPath) };
  }
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return (
    String(value || "tlcl-next-route-evidence-plan-regeneration-request-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-evidence-plan-regeneration-request-receipt-validation"
  );
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
      "teacher_reviewed_regeneration_request_ready_for_manual_use",
      "ready_for_manual_use",
      "ready_for_separate_manual_use"
    ].includes(decision)
  ) {
    return "teacher_reviewed_regeneration_request_ready_for_manual_use";
  }
  if (["needs_more_evidence", "blocked_needs_more_evidence"].includes(decision)) return "needs_more_evidence";
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_logic_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (
    [
      "execute_now",
      "accepted",
      "regenerate_input_contract",
      "run_command",
      "run_next_tool",
      "invoke_model",
      "fetch_rag",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "claim_complete"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotRegenerateInputContract: true,
    validatorDoesNotRunCommand: true,
    validatorDoesNotRunNextTool: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    accepted: false,
    ruleEnabled: false,
    packagingUnlocked: false,
    inputContractRegenerated: false,
    commandExecuted: false,
    nextToolExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    goalComplete: false
  };
}

const builderInput = readJsonInput(argValue("--builder", argValue("--command-builder", "")), "--builder");
const receiptInput = readJsonInput(argValue("--receipt", argValue("--teacher-receipt", "")), "--receipt");
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-evidence-plan-regeneration-request-receipt-validations")
  )
);

const builder = builderInput.value;
const receipt = receiptInput.value;
const request = builder?.request || null;
const decision = normalizeDecision(receipt?.teacherDecision);
const forbiddenDecisions = new Set([
  "execute_now",
  "accepted",
  "regenerate_input_contract",
  "run_command",
  "run_next_tool",
  "invoke_model",
  "fetch_rag",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete"
]);
const allowedDecisions = new Set([
  "teacher_reviewed_regeneration_request_ready_for_manual_use",
  "needs_more_evidence",
  "correction_to_high_reasoning_repair",
  "needs_teacher_review"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (!builder) block("builder_missing", "A TLCL evidence-plan regeneration command builder is required.");
if (!receipt) block("receipt_missing", "A teacher regeneration request receipt is required.");
if (builder?.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_v1") {
  block("builder_format_invalid", "Builder must be transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_v1.");
}
if (builder?.ok !== true) block("builder_not_ok", "Builder must be ok=true.");
if (builder?.status !== "evidence_plan_regeneration_command_builder_waiting_for_teacher_copy") {
  block("builder_status_not_ready", "Builder must be waiting for teacher copy.");
}
if (!request || request.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_v1") {
  block("regeneration_request_missing_or_invalid", "Builder must contain transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_v1.");
}
if (request?.executeNow !== false || request?.copyOnly !== true || request?.reviewOnly !== true) {
  block("request_copy_only_locks_missing", "Request must keep executeNow=false, copyOnly=true, and reviewOnly=true.");
}
if (builder?.locks?.builderDoesNotRunCommand !== true || builder?.locks?.builderDoesNotRegenerateInputContract !== true) {
  block("source_builder_locks_missing", "Source builder must prove it did not run the command or regenerate the input contract.");
}
if (receipt?.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_v1") {
  block("receipt_format_invalid", "Receipt must be transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_v1.");
}
if (receipt?.sourceBuilderId !== builder?.builderId) block("source_builder_id_mismatch", "Receipt sourceBuilderId must match builder.builderId.");
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not an allowed regeneration request receipt decision.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt?.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt?.copyOnly !== true) block("receipt_copy_only_missing", "Receipt must keep copyOnly=true.");
if (receipt?.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt?.reviewedRouteId !== request?.routeId) block("reviewed_route_id_mismatch", "Receipt reviewedRouteId must match request.routeId.");
if (receipt?.reviewedNextTool !== request?.nextTool) block("reviewed_next_tool_mismatch", "Receipt reviewedNextTool must match request.nextTool.");
if (receipt?.reviewedSuggestedRegenerationCommand !== request?.suggestedRegenerationCommand) {
  block("reviewed_regeneration_command_mismatch", "Receipt reviewedSuggestedRegenerationCommand must match request.suggestedRegenerationCommand.");
}
if (!sameJson(receipt?.reviewedEvidenceRowsUsed || [], request?.evidenceRowsUsed || [])) {
  block("reviewed_evidence_rows_mismatch", "Receipt reviewedEvidenceRowsUsed must match request.evidenceRowsUsed.");
}
if (!sameJson(receipt?.reviewedNoOpLocks || {}, builder?.locks || {})) {
  block("reviewed_no_op_locks_mismatch", "Receipt reviewedNoOpLocks must match builder.locks.");
}
if (receipt?.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");

const rollbackText = String(receipt?.confirmedRetainedRollbackPoint || "").trim();
const placeholderRollback =
  !rollbackText ||
  rollbackText === "<required retained rollback point id/path>" ||
  rollbackText === "<rollback>" ||
  rollbackText === "rollback";

if (decision === "teacher_reviewed_regeneration_request_ready_for_manual_use") {
  if (receipt?.regenerationRequestReviewed !== true) block("regeneration_request_not_reviewed", "Teacher must review the regeneration request.");
  if (receipt?.commandReviewed !== true) block("command_not_reviewed", "Teacher must review the suggested regeneration command.");
  if (receipt?.evidenceRowsReviewed !== true) block("evidence_rows_not_reviewed", "Teacher must review evidence rows used by the request.");
  if (receipt?.noOpLocksReviewed !== true) block("no_op_locks_not_reviewed", "Teacher must review no-op locks.");
  if (receipt?.separateManualStepConfirmed !== true) {
    block("separate_manual_step_not_confirmed", "Teacher must confirm regeneration is a separate manual step.");
  }
  if (placeholderRollback) block("confirmed_retained_rollback_point_missing", "Teacher must provide a retained rollback point id or path.");
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt?.teacherNotes || "").trim()) {
  block("high_reasoning_repair_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForManualRegenerationUse =
  decision === "teacher_reviewed_regeneration_request_ready_for_manual_use" && blockers.length === 0;
const correctionToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_regeneration_request_receipt_decision"
  : readyForManualRegenerationUse
    ? "evidence_plan_regeneration_request_reviewed_waiting_for_separate_manual_use"
    : correctionToHighReasoningRepair
      ? "evidence_plan_regeneration_request_routes_to_high_reasoning_correction"
      : "evidence_plan_regeneration_request_needs_teacher_review_or_more_evidence";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(request?.routeId || decision)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-next-route-evidence-plan-regeneration-request-receipt-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-next-route-evidence-plan-regeneration-request-receipt-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_NEXT_ROUTE_EVIDENCE_PLAN_REGENERATION_REQUEST_RECEIPT_VALIDATION_START_HERE.md");
const validationLocks = locks();

const manualRegenerationUse = readyForManualRegenerationUse
  ? {
      format: "transparent_ai_tlcl_next_route_evidence_plan_manual_input_contract_regeneration_use_v1",
      routeId: request.routeId || "",
      nextTool: request.nextTool || "",
      suggestedRegenerationCommand: request.suggestedRegenerationCommand || "",
      evidenceRowsUsed: request.evidenceRowsUsed || [],
      confirmedRetainedRollbackPoint: rollbackText,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true,
      instruction:
        "This validation only proves teacher review. Regeneration remains a separate explicit manual step and must not be run by this validator."
    }
  : null;

const validation = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForManualRegenerationUse,
  correctionToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  sourceEvidence: {
    builderPath: builderInput.path,
    receiptPath: receiptInput.path,
    builderId: builder?.builderId || "",
    requestFormat: request?.format || ""
  },
  manualRegenerationUse,
  highReasoningCorrectionHandoff:
    correctionToHighReasoningRepair && !forbiddenDecisionUsed
      ? {
          route: "high_reasoning_logic_contract_repair",
          sourceBuilderId: builder?.builderId || "",
          teacherNotes: receipt?.teacherNotes || "",
          instruction:
            "Return to the high-reasoning compile layer to repair the TLCL request, evidence rows, no-op locks, or route before rebuilding this regeneration request."
        }
      : null,
  blockedActions: [
    "regenerate_input_contract_from_request_receipt_validation",
    "execute_regeneration_command_from_request_receipt_validation",
    "run_next_tool_from_request_receipt_validation",
    "invoke_model_from_request_receipt_validation",
    "fetch_rag_from_request_receipt_validation",
    "write_memory_from_request_receipt_validation",
    "enable_rule_from_request_receipt_validation",
    "unlock_packaging_from_request_receipt_validation",
    "claim_completion_from_request_receipt_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceBuilder: builderInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeJson(validationPath, validation);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Evidence Plan Regeneration Request Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Ready for separate manual regeneration use: ${readyForManualRegenerationUse}`,
    `Forbidden decision used: ${forbiddenDecisionUsed}`,
    "",
    "This validation never regenerates an input contract, runs a command, runs the next tool, invokes a model, fetches RAG, writes memory, enables rules, unlocks packaging, or claims completion.",
    "",
    readyForManualRegenerationUse
      ? "The request is reviewed for a separate manual step only. Keep the retained rollback point until the teacher confirms the result."
      : "The request is not ready for separate manual use. Review blockers or route corrections back to the high-reasoning repair layer."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_result_v1",
      status,
      ok: validation.ok,
      validationPath,
      receiptRecordPath,
      readmePath,
      readyForManualRegenerationUse,
      manualRegenerationUse,
      highReasoningCorrectionHandoff: validation.highReasoningCorrectionHandoff,
      blockers,
      executeNow: false,
      locks: validationLocks
    },
    null,
    2
  )
);
