#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-rag-review-receipt-adapter-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-review-receipt-adapter-validation"
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validationLocks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotExecuteRagBuilder: true,
    validatorDoesNotAutoRunCommand: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    ragBuilderInvoked: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

function sameRows(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

const adapterInput = argValue("--adapter") || argValue("--builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-review-receipt-adapter-validation")
  )
);

const { value: adapter, path: adapterPath } = readJsonInput(adapterInput, "adapter");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!adapter || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter.mjs --adapter <adapter.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "adapter_reviewed_for_manual_rag_review_receipt_builder",
  "needs_more_package_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_rag_builder",
  "execute_now",
  "accepted",
  "enable_rule",
  "write_memory",
  "fetch_rag",
  "invoke_model",
  "unlock_packaging",
  "claim_complete"
]);

if (adapter.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_builder_v1") {
  block("adapter_format_invalid", "Adapter must be transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_builder_v1.");
}
if (adapter.ok !== true || adapter.status !== "tlcl_rag_review_receipt_adapter_waiting_for_teacher_confirmation") {
  block("adapter_not_waiting_for_teacher_confirmation", "Adapter must be ok and waiting for teacher confirmation.");
}
if (adapter.locks?.adapterDoesNotExecuteRagBuilder !== true) {
  block("adapter_execution_lock_missing", "Adapter must keep RAG builder execution locked.");
}
if (receipt.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_receipt_v1") {
  block("receipt_format_invalid", "Receipt format is invalid.");
}
if (!allowedDecisions.has(receipt.teacherDecision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(receipt.teacherDecision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${receipt.teacherDecision}`);
if (receipt.sourceAdapterId !== adapter.adapterId) block("source_adapter_id_mismatch", "Receipt sourceAdapterId must match adapter.adapterId.");
if (receipt.selectedFollowUp !== adapter.selectedFollowUp) block("selected_follow_up_mismatch", "Receipt selectedFollowUp must match adapter.");
if (receipt.packagePath !== adapter.ruleDslValidationPackage?.packagePath) block("package_path_mismatch", "Receipt packagePath must match adapter packagePath.");
if (receipt.packageHash !== adapter.ruleDslValidationPackage?.packageHash) block("package_hash_mismatch", "Receipt packageHash must match adapter packageHash.");
if (receipt.commandTemplate !== adapter.commandTemplate) block("command_template_mismatch", "Receipt commandTemplate must match adapter commandTemplate.");
if (receipt.confirmedRollbackPoint !== adapter.manualFollowUpHandoff?.confirmedRollbackPoint) {
  block("confirmed_rollback_point_mismatch", "Receipt confirmedRollbackPoint must match manual follow-up handoff.");
}
if (!sameRows(receipt.reviewedRuleValidationRows, adapter.ruleDslValidationPackage?.packagePath ? receipt.reviewedRuleValidationRows : [])) {
  warnings.push("reviewed_rule_validation_rows_present");
}

let packageStillValid = false;
try {
  const packagePacket = readJson(adapter.ruleDslValidationPackage?.packagePath || "");
  packageStillValid =
    packagePacket.format === "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1" &&
    packagePacket.status === "ready_for_teacher_rule_dsl_review_package" &&
    hashJson(packagePacket) === adapter.ruleDslValidationPackage?.packageHash &&
    packagePacket.locks?.ruleEnabled === false &&
    packagePacket.locks?.memoryEnabled === false &&
    packagePacket.locks?.softwareActionsExecuted === false &&
    packagePacket.locks?.externalFetchPerformed === false &&
    packagePacket.locks?.packagingUnlocked === false;
} catch {
  packageStillValid = false;
}
if (!packageStillValid) block("rule_dsl_validation_package_not_still_valid", "The referenced Rule DSL validation package is missing, changed, or unlocked.");

const decision = receipt.teacherDecision || "needs_teacher_review";
const ready =
  blockers.length === 0 &&
  decision === "adapter_reviewed_for_manual_rag_review_receipt_builder" &&
  receipt.packageEvidenceReviewed === true &&
  receipt.ruleValidationRowsReviewed === true &&
  receipt.commandTemplateReviewed === true &&
  receipt.teacherConfirmedNoExecution === true &&
  receipt.blockedActionsConfirmed === true;

if (decision === "adapter_reviewed_for_manual_rag_review_receipt_builder") {
  if (receipt.packageEvidenceReviewed !== true) block("package_evidence_review_required", "Teacher must review package evidence.");
  if (receipt.ruleValidationRowsReviewed !== true) block("rule_validation_rows_review_required", "Teacher must review rule validation rows.");
  if (receipt.commandTemplateReviewed !== true) block("command_template_review_required", "Teacher must review command template.");
  if (receipt.teacherConfirmedNoExecution !== true) block("teacher_no_execution_confirmation_required", "Teacher must confirm no execution.");
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
}
if ((decision === "needs_more_package_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_review_receipt_adapter_decision"
  : ready
    ? "tlcl_rag_review_receipt_builder_manual_command_ready"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_package_evidence" && blockers.length === 0
        ? "needs_more_package_evidence_before_rag_review_receipt_builder"
        : "needs_teacher_review_before_rag_review_receipt_builder";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const manualRagReviewReceiptBuilderHandoff = ready
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_review_receipt_builder_handoff_v1",
      selectedFollowUp: adapter.selectedFollowUp,
      nextTool: "knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs",
      commandTemplate: adapter.commandTemplate,
      ruleDslValidationPackagePath: adapter.ruleDslValidationPackage.packagePath,
      ruleDslValidationPackageHash: adapter.ruleDslValidationPackage.packageHash,
      confirmedRollbackPoint: adapter.manualFollowUpHandoff?.confirmedRollbackPoint || "",
      instruction: "Run this existing RAG review receipt builder manually in a separate step only if the teacher chooses to proceed.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_review_receipt_adapter",
        selectedFollowUp: "correction_to_high_reasoning_repair",
        sourceAdapterId: adapter.adapterId,
        packagePath: adapter.ruleDslValidationPackage?.packagePath || "",
        confirmedRollbackPoint: adapter.manualFollowUpHandoff?.confirmedRollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction: "Return to the high-reasoning compile layer because the RAG review receipt adapter revealed a logic, evidence, or route problem.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForManualRagReviewReceiptBuilder: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMorePackageEvidence: status === "needs_more_package_evidence_before_rag_review_receipt_builder",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    adapterPath,
    receiptPath,
    sourceFollowUpValidationPath: adapter.sourceFollowUpValidationPath || "",
    sourceFollowUpValidationId: adapter.sourceFollowUpValidationId || ""
  },
  manualRagReviewReceiptBuilderHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "execute_existing_rag_review_receipt_builder_from_adapter_validation",
    "auto_run_command_from_adapter_validation",
    "invoke_model_from_adapter_validation",
    "fetch_rag_from_adapter_validation",
    "write_memory_from_adapter_validation",
    "enable_rule_from_adapter_validation",
    "unlock_packaging_from_adapter_validation",
    "claim_completion_from_adapter_validation"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-review-receipt-adapter-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-review-receipt-adapter-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_REVIEW_RECEIPT_ADAPTER_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Review Receipt Adapter Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not execute the existing RAG review receipt builder. It only prepares a manual handoff when the teacher confirms the adapter."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_validation_result_v1",
      validationId,
      status,
      decision,
      readyForManualRagReviewReceiptBuilder: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMorePackageEvidence: validation.needsMorePackageEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      manualRagReviewReceiptBuilderHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
