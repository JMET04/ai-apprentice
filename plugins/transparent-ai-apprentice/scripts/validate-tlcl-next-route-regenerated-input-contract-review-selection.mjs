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

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return (
    String(value || "tlcl-next-route-regenerated-input-contract-review-selection")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-next-route-regenerated-input-contract-review-selection"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["route_selected_for_manual_preparation", "select_route", "prepare_manual_route"].includes(decision)) {
    return "route_selected_for_manual_preparation";
  }
  if (["needs_more_regeneration_result_evidence", "needs_more_evidence"].includes(decision)) {
    return "needs_more_regeneration_result_evidence";
  }
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_logic_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (
    [
      "execute_now",
      "accepted",
      "run_next_tool",
      "regenerate_input_contract",
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
    validatorDoesNotBuildInputContractReceipt: true,
    validatorDoesNotRunNextTool: true,
    validatorDoesNotRegenerateInputContract: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    inputContractReceiptBuilt: false,
    nextToolExecuted: false,
    inputContractRegenerated: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    ruleEnabled: false,
    accepted: false,
    packagingUnlocked: false,
    goalComplete: false
  };
}

const routerInput = readJsonInput(
  argValue("--router", argValue("--review-router", "")),
  "--router",
  "transparent_ai_tlcl_next_route_regenerated_input_contract_review_router_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_next_route_regenerated_input_contract_review_selection_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-next-route-regenerated-input-contract-review-selection-validations"))
);
const router = routerInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const candidateByRoute = new Map((router.candidateRoutes || []).map((candidate) => [candidate.route, candidate]));
const selectedCandidate = candidateByRoute.get(receipt.selectedRoute) || null;
const forbiddenDecisions = new Set([
  "execute_now",
  "accepted",
  "run_next_tool",
  "regenerate_input_contract",
  "invoke_model",
  "fetch_rag",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (router.status !== "regenerated_input_contract_review_router_waiting_for_teacher_selection") {
  block("router_status_not_ready", "Router must be waiting for teacher selection.");
}
if (router.ok !== true) block("router_not_ok", "Router ok must be true.");
if (receipt.sourceRouterId !== router.routerId) block("source_router_id_mismatch", "Receipt sourceRouterId must match router.routerId.");
if (receipt.sourceValidationId !== router.sourceValidationId) {
  block("source_validation_id_mismatch", "Receipt sourceValidationId must match router.sourceValidationId.");
}
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt.copyOnly !== true) block("receipt_copy_only_missing", "Receipt must keep copyOnly=true.");
if (receipt.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");
if (receipt.teacherConfirmedNoExecution !== true && decision === "route_selected_for_manual_preparation") {
  block("no_execution_not_confirmed", "Teacher must confirm no execution now.");
}
if (decision === "route_selected_for_manual_preparation") {
  if (!selectedCandidate) block("selected_route_not_allowed", "Selected route must be one of router.candidateRoutes.");
  if (receipt.selectedRouteReviewed !== true) block("selected_route_not_reviewed", "Teacher must review selected route.");
  if (receipt.sourceValidationReviewed !== true) block("source_validation_not_reviewed", "Teacher must review the source validation.");
  if (receipt.resultEvidenceStillValid !== true) block("result_evidence_not_valid", "Teacher must confirm result evidence is still valid.");
  if (
    receipt.selectedRoute === "build_input_contract_receipt_for_regenerated_contract" &&
    receipt.retainedRollbackStillAvailable !== true
  ) {
    block("retained_rollback_not_confirmed", "Teacher must confirm the retained rollback point is still available.");
  }
  if (
    receipt.selectedRoute === "build_input_contract_receipt_for_regenerated_contract" &&
    !router.reviewedRegeneratedInputContract?.inputContractPath
  ) {
    block("regenerated_input_contract_path_missing", "Router must contain reviewedRegeneratedInputContract.inputContractPath.");
  }
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_correction_note_missing", "Correction to high reasoning repair requires teacherNotes.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForManualPreparation =
  decision === "route_selected_for_manual_preparation" && selectedCandidate && blockers.length === 0;
const routesToHighReasoningCorrection = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const needsMoreEvidence = decision === "needs_more_regeneration_result_evidence" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_regenerated_contract_review_selection"
  : readyForManualPreparation
    ? "regenerated_input_contract_review_selection_ready_for_manual_preparation"
    : routesToHighReasoningCorrection
      ? "regenerated_input_contract_review_selection_routes_to_high_reasoning_correction"
      : needsMoreEvidence
        ? "regenerated_input_contract_review_selection_needs_more_evidence"
        : "regenerated_input_contract_review_selection_needs_teacher_review";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(receipt.selectedRoute || decision)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-next-route-regenerated-input-contract-review-selection-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-next-route-regenerated-input-contract-review-selection-receipt.json");
const readmePath = join(validationDir, "TLCL_NEXT_ROUTE_REGENERATED_INPUT_CONTRACT_REVIEW_SELECTION_VALIDATION_START_HERE.md");
const validationLocks = locks();

const manualPreparationHandoff = readyForManualPreparation
  ? {
      format: "transparent_ai_tlcl_next_route_regenerated_input_contract_manual_preparation_handoff_v1",
      selectedRoute: receipt.selectedRoute,
      nextTool: selectedCandidate.nextTool,
      targetReasoningTier: selectedCandidate.targetReasoningTier,
      commandTemplate: selectedCandidate.commandTemplate,
      reviewedRegeneratedInputContract: router.reviewedRegeneratedInputContract || null,
      confirmedRetainedRollbackPoint:
        router.reviewedRegeneratedInputContract?.confirmedRetainedRollbackPoint || "",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const highReasoningCorrectionHandoff =
  routesToHighReasoningCorrection || receipt.selectedRoute === "send_regeneration_result_to_high_reasoning_contract_repair"
    ? {
        format: "transparent_ai_tlcl_next_route_regenerated_input_contract_high_reasoning_correction_handoff_v1",
        route: "high_reasoning_logic_contract_repair_after_regenerated_contract_review",
        sourceRouterId: router.routerId,
        teacherNotes: receipt.teacherNotes || "",
        executeNow: false,
        copyOnly: true,
        reviewOnly: true
      }
    : null;

const result = {
  ok: !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_next_route_regenerated_input_contract_review_selection_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  selectedRoute: receipt.selectedRoute || "",
  readyForManualPreparation,
  routesToHighReasoningCorrection,
  needsMoreEvidence,
  forbiddenDecisionUsed,
  blockers,
  sourceEvidence: {
    routerPath: routerInput.path,
    receiptPath: receiptInput.path,
    sourceRouterId: router.routerId,
    sourceValidationId: router.sourceValidationId
  },
  manualPreparationHandoff,
  highReasoningCorrectionHandoff,
  blockedActions: [
    "build_input_contract_receipt_from_selection_validation",
    "run_next_tool_from_selection_validation",
    "regenerate_input_contract_from_selection_validation",
    "invoke_model_from_selection_validation",
    "fetch_rag_from_selection_validation",
    "write_memory_from_selection_validation",
    "enable_rule_from_selection_validation",
    "unlock_packaging_from_selection_validation",
    "claim_completion_from_selection_validation"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceRouter: routerInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeJson(validationPath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Regenerated Input Contract Review Selection Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Selected route: ${receipt.selectedRoute || ""}`,
    "",
    "This validation prepares a manual next gate only. It does not build the input-contract receipt, run the next tool, regenerate contracts, invoke models, fetch RAG, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((row) => `- ${row.code}: ${row.message}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      format: "transparent_ai_tlcl_next_route_regenerated_input_contract_review_selection_validation_result_v1",
      status,
      ok: result.ok,
      validationPath,
      receiptRecordPath,
      readmePath,
      selectedRoute: result.selectedRoute,
      readyForManualPreparation,
      manualPreparationHandoff,
      highReasoningCorrectionHandoff,
      blockers,
      executeNow: false,
      locks: validationLocks
    },
    null,
    2
  )
);
