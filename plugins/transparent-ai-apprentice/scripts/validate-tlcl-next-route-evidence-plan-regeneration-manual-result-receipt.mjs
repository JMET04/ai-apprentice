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
    parsed.value?.format === "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_result_v1" &&
    parsed.value?.validationPath &&
    existsSync(parsed.value.validationPath)
  ) {
    return { value: readJson(resolve(parsed.value.validationPath)), path: resolve(parsed.value.validationPath) };
  }
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return (
    String(value || "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-validation"
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
      "manual_regeneration_result_reviewed_ready_for_next_route_contract_review",
      "ready_for_next_route_contract_review",
      "ready_for_next_contract_review"
    ].includes(decision)
  ) {
    return "manual_regeneration_result_reviewed_ready_for_next_route_contract_review";
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

const validationInput = readJsonInput(argValue("--validation", argValue("--request-receipt-validation", "")), "--validation");
const receiptInput = readJsonInput(argValue("--receipt", argValue("--teacher-receipt", "")), "--receipt");
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-validations")
  )
);
const validation = validationInput.value;
const receipt = receiptInput.value;
const manualRegenerationUse = validation?.manualRegenerationUse || null;
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
  "manual_regeneration_result_reviewed_ready_for_next_route_contract_review",
  "needs_more_evidence",
  "correction_to_high_reasoning_repair",
  "needs_teacher_review"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (validation.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_v1") {
  block("validation_format_invalid", "Validation must be transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_v1.");
}
if (receipt.format !== "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_v1") {
  block("receipt_format_invalid", "Receipt must be transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_v1.");
}
if (validation.status !== "evidence_plan_regeneration_request_reviewed_waiting_for_separate_manual_use") {
  block("validation_status_not_ready", "Validation must be waiting for separate manual regeneration use.");
}
if (validation.readyForManualRegenerationUse !== true) block("manual_regeneration_use_not_ready", "readyForManualRegenerationUse must be true.");
if (!manualRegenerationUse) block("manual_regeneration_use_missing", "Validation must contain manualRegenerationUse.");
if (manualRegenerationUse?.executeNow !== false || manualRegenerationUse?.copyOnly !== true || manualRegenerationUse?.reviewOnly !== true) {
  block("manual_regeneration_use_locks_missing", "manualRegenerationUse must keep executeNow=false, copyOnly=true, and reviewOnly=true.");
}
if (validation?.locks?.validatorDoesNotRegenerateInputContract !== true || validation?.locks?.validatorDoesNotRunCommand !== true) {
  block("source_validation_locks_missing", "Source validation must prove it did not regenerate the input contract or run the command.");
}
if (receipt?.sourceValidationId !== validation?.validationId) block("source_validation_id_mismatch", "Receipt sourceValidationId must match validation.validationId.");
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt?.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt?.copyOnly !== true) block("receipt_copy_only_missing", "Receipt must keep copyOnly=true.");
if (receipt?.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt?.reviewedRouteId !== manualRegenerationUse?.routeId) block("reviewed_route_id_mismatch", "Receipt reviewedRouteId must match manualRegenerationUse.routeId.");
if (receipt?.reviewedNextTool !== manualRegenerationUse?.nextTool) block("reviewed_next_tool_mismatch", "Receipt reviewedNextTool must match manualRegenerationUse.nextTool.");
if (receipt?.reviewedSuggestedRegenerationCommand !== manualRegenerationUse?.suggestedRegenerationCommand) {
  block("reviewed_regeneration_command_mismatch", "Receipt reviewedSuggestedRegenerationCommand must match manualRegenerationUse.suggestedRegenerationCommand.");
}
if (!sameJson(receipt?.reviewedEvidenceRowsUsed || [], manualRegenerationUse?.evidenceRowsUsed || [])) {
  block("reviewed_evidence_rows_mismatch", "Receipt reviewedEvidenceRowsUsed must match manualRegenerationUse.evidenceRowsUsed.");
}
if (receipt?.confirmedRetainedRollbackPoint !== manualRegenerationUse?.confirmedRetainedRollbackPoint) {
  block("retained_rollback_point_mismatch", "Receipt confirmedRetainedRollbackPoint must match manualRegenerationUse.confirmedRetainedRollbackPoint.");
}
if (receipt?.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");

const resultEvidencePaths = Array.isArray(receipt?.resultEvidencePaths)
  ? receipt.resultEvidencePaths.map((item) => String(item || "").trim()).filter(Boolean)
  : [];
const regeneratedInputContractPath = String(receipt?.regeneratedInputContractPath || "").trim();
const resolvedRegeneratedInputContractPath = regeneratedInputContractPath ? resolve(regeneratedInputContractPath) : "";
let regeneratedInputContract = null;
if (regeneratedInputContractPath && existsSync(resolvedRegeneratedInputContractPath)) {
  try {
    regeneratedInputContract = readJson(resolvedRegeneratedInputContractPath);
  } catch {
    block("regenerated_input_contract_json_invalid", "Regenerated input contract path exists but is not valid JSON.");
  }
}

if (decision === "manual_regeneration_result_reviewed_ready_for_next_route_contract_review") {
  if (receipt?.manualRegenerationWasSeparate !== true) {
    block("manual_regeneration_not_confirmed_separate", "Teacher must confirm the regeneration step was separate.");
  }
  if (receipt?.regeneratedInputContractReviewed !== true) {
    block("regenerated_input_contract_not_reviewed", "Teacher must review the regenerated input contract.");
  }
  if (receipt?.regeneratedInputContractReadyForNextTool !== true) {
    block("regenerated_input_contract_ready_flag_missing", "Teacher must confirm the regenerated contract is ready for the next tool.");
  }
  if (receipt?.resultEvidenceReviewed !== true) block("result_evidence_not_reviewed", "Teacher must review result evidence.");
  if (!regeneratedInputContractPath) block("regenerated_input_contract_path_missing", "A regenerated input contract path is required.");
  if (regeneratedInputContractPath && !existsSync(resolvedRegeneratedInputContractPath)) {
    block("regenerated_input_contract_path_not_found", "Regenerated input contract path must exist.");
  }
  if (regeneratedInputContract && regeneratedInputContract.format !== "transparent_ai_tlcl_next_route_input_contract_v1") {
    block("regenerated_input_contract_format_invalid", "Regenerated contract must be transparent_ai_tlcl_next_route_input_contract_v1.");
  }
  if (regeneratedInputContract && regeneratedInputContract.routeId !== manualRegenerationUse?.routeId) {
    block("regenerated_input_contract_route_mismatch", "Regenerated contract routeId must match manualRegenerationUse.routeId.");
  }
  if (regeneratedInputContract && regeneratedInputContract.nextTool !== manualRegenerationUse?.nextTool) {
    block("regenerated_input_contract_next_tool_mismatch", "Regenerated contract nextTool must match manualRegenerationUse.nextTool.");
  }
  if (regeneratedInputContract && regeneratedInputContract.readyForNextTool !== true) {
    block("regenerated_input_contract_not_ready_for_next_tool", "Regenerated contract must keep readyForNextTool=true.");
  }
  if (resultEvidencePaths.length === 0) block("result_evidence_missing", "At least one result evidence path or summary is required.");
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt?.teacherNotes || "").trim()) {
  block("high_reasoning_repair_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForNextRouteContractReview =
  decision === "manual_regeneration_result_reviewed_ready_for_next_route_contract_review" && blockers.length === 0;
const correctionToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_regeneration_manual_result_decision"
  : readyForNextRouteContractReview
    ? "regeneration_manual_result_reviewed_waiting_for_next_route_contract_review"
    : correctionToHighReasoningRepair
      ? "regeneration_manual_result_routes_to_high_reasoning_correction"
      : "regeneration_manual_result_needs_teacher_review_or_more_evidence";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(manualRegenerationUse?.routeId || decision)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_NEXT_ROUTE_EVIDENCE_PLAN_REGENERATION_MANUAL_RESULT_RECEIPT_VALIDATION_START_HERE.md");
const validationLocks = locks();
const reviewedRegeneratedInputContract = readyForNextRouteContractReview
  ? {
      format: "transparent_ai_tlcl_next_route_reviewed_regenerated_input_contract_v1",
      sourceValidationId: validation?.validationId || "",
      routeId: manualRegenerationUse.routeId || "",
      nextTool: manualRegenerationUse.nextTool || "",
      inputContractPath: resolvedRegeneratedInputContractPath,
      inputContractReadyForNextTool: regeneratedInputContract?.readyForNextTool === true,
      status: regeneratedInputContract?.status || "",
      resultEvidencePaths,
      confirmedRetainedRollbackPoint: manualRegenerationUse.confirmedRetainedRollbackPoint || "",
      nextGate: "review_regenerated_input_contract_before_manual_next_route_use",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;

const result = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForNextRouteContractReview,
  correctionToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  sourceEvidence: {
    requestReceiptValidationPath: validationInput.path,
    receiptPath: receiptInput.path,
    sourceValidationId: validation?.validationId || "",
    regeneratedInputContractPath: resolvedRegeneratedInputContractPath
  },
  reviewedRegeneratedInputContract,
  highReasoningCorrectionHandoff:
    correctionToHighReasoningRepair && !forbiddenDecisionUsed
      ? {
          route: "high_reasoning_logic_contract_repair_after_regeneration_result",
          sourceValidationId: validation?.validationId || "",
          teacherNotes: receipt?.teacherNotes || "",
          instruction:
            "Return to the high-reasoning compile layer because the manual input-contract regeneration result revealed a logic, evidence, or route problem."
        }
      : null,
  blockedActions: [
    "regenerate_input_contract_from_manual_result_validation",
    "execute_regeneration_command_from_manual_result_validation",
    "run_next_tool_from_manual_result_validation",
    "invoke_model_from_manual_result_validation",
    "fetch_rag_from_manual_result_validation",
    "write_memory_from_manual_result_validation",
    "enable_rule_from_manual_result_validation",
    "unlock_packaging_from_manual_result_validation",
    "claim_completion_from_manual_result_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceValidation: validationInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeJson(validationPath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Evidence Plan Regeneration Manual Result Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Ready for next route contract review: ${readyForNextRouteContractReview}`,
    `Forbidden decision used: ${forbiddenDecisionUsed}`,
    "",
    "This validation checks teacher-reviewed evidence from a separate manual input-contract regeneration result. It does not regenerate contracts, run commands, run next tools, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((row) => `- ${row.code}: ${row.message}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_validation_result_v1",
      status,
      ok: result.ok,
      validationPath,
      receiptRecordPath,
      readmePath,
      readyForNextRouteContractReview,
      reviewedRegeneratedInputContract,
      highReasoningCorrectionHandoff: result.highReasoningCorrectionHandoff,
      blockers,
      executeNow: false,
      locks: validationLocks
    },
    null,
    2
  )
);
