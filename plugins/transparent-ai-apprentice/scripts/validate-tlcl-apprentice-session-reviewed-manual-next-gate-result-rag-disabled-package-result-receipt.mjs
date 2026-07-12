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
    String(value || "tlcl-rag-disabled-package-result-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-disabled-package-result-validation"
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

function hashKnowledge(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function validationLocks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotRunValidationReportBuilder: true,
    validatorDoesNotEvaluateRulePackage: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotInvokeModel: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotUnlockPackaging: true,
    validationReportBuilderRun: false,
    validationReportCreated: false,
    softwareExecuted: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

const builderInput =
  argValue("--builder") ||
  argValue("--disabled-package-result-receipt-builder") ||
  argValue("--result-receipt-builder");
const receiptInput = argValue("--receipt") || argValue("--teacher-receipt");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-disabled-package-result-receipt-validation")
  )
);

const { value: builder, path: builderPath } = readJsonInput(builderInput, "builder");
const { value: receipt, path: receiptPath } = readJsonInput(receiptInput, "receipt");
if (!builder || !receipt) {
  throw new Error(
    "Usage: node validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt.mjs --builder <builder.json> --receipt <receipt.json> [--output-dir <dir>]"
  );
}

const blockers = [];
const warnings = [];
function block(code, message) {
  blockers.push({ code, message });
}

const allowedDecisions = new Set([
  "needs_teacher_review",
  "disabled_package_result_reviewed_ready_for_validation_report",
  "needs_more_disabled_package_evidence",
  "correction_to_high_reasoning_repair"
]);
const forbiddenDecisions = new Set([
  "run_validation_report_builder",
  "execute_now",
  "accepted",
  "enable_rule",
  "write_memory",
  "fetch_rag",
  "invoke_model",
  "unlock_packaging",
  "claim_complete"
]);

if (
  builder.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_builder_v1"
) {
  block("builder_format_invalid", "Builder must be the TLCL RAG disabled package result receipt builder.");
}
if (builder.ok !== true || builder.status !== "tlcl_rag_disabled_package_result_waiting_for_teacher_confirmation") {
  block("builder_not_waiting_for_teacher_confirmation", "Builder must be ok and waiting for teacher confirmation.");
}
if (builder.locks?.builderDoesNotRunValidationReportBuilder !== true) {
  block("builder_validation_report_lock_missing", "Builder must keep validation report builder execution locked.");
}
if (receipt.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_v1") {
  block("receipt_format_invalid", "Receipt format is invalid.");
}

const decision = receipt.teacherDecision || "needs_teacher_review";
if (!allowedDecisions.has(decision)) block("teacher_decision_not_allowed", "Teacher decision is not allowed.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (receipt.sourceDisabledPackageResultReceiptBuilderId !== builder.disabledPackageResultReceiptBuilderId) {
  block("source_disabled_package_result_receipt_builder_id_mismatch", "Receipt sourceDisabledPackageResultReceiptBuilderId must match builder.");
}
if (receipt.sourceRagDisabledPackagePath !== builder.sourceRagDisabledPackagePath) {
  block("source_rag_disabled_package_path_mismatch", "Receipt source disabled package path must match builder.");
}
if (receipt.sourceTlclValidationPath !== builder.sourceTlclValidationPath) {
  block("source_tlcl_validation_path_mismatch", "Receipt source TLCL validation path must match builder.");
}
if (receipt.disabledPackagePath !== builder.sourceRagDisabledPackagePath) {
  block("disabled_package_path_mismatch", "Receipt disabledPackagePath must match builder.");
}
if (receipt.compiledRulePackagePath !== builder.sourceRagDisabledPackage?.compiledRulePackagePath) {
  block("compiled_rule_package_path_mismatch", "Receipt compiledRulePackagePath must match builder.");
}
if (resolve(receipt.rollbackPoint || "") !== resolve(builder.sourceRagDisabledPackage?.rollbackPoint || "")) {
  block("rollback_point_mismatch", "Receipt rollbackPoint must match builder rollback point.");
}
if (receipt.executeNow !== false || receipt.reviewOnly !== true) {
  block("receipt_review_only_lock_missing", "Receipt must remain reviewOnly and executeNow=false.");
}

let disabledPackage = null;
let sourceStillValid = false;
try {
  disabledPackage = readJson(receipt.disabledPackagePath);
  const reviewValidation = readJson(receipt.reviewValidationPath);
  const compiledRulePackage = readJson(receipt.compiledRulePackagePath);
  const activeRules = (compiledRulePackage.rules || []).filter((rule) => rule.lifecycle === "active");
  const nonDisabledRules = (compiledRulePackage.rules || []).filter((rule) => rule.lifecycle !== "draft_disabled");
  sourceStillValid =
    disabledPackage.format === "transparent_ai_rag_reviewed_disabled_rule_package_v1" &&
    disabledPackage.status === "ready_for_teacher_disabled_rule_package_review" &&
    hashKnowledge(disabledPackage) === receipt.disabledPackageHash &&
    disabledPackage.reviewValidationPath === receipt.reviewValidationPath &&
    disabledPackage.reviewValidationHash === hashKnowledge(reviewValidation) &&
    disabledPackage.compiledRulePackagePath === receipt.compiledRulePackagePath &&
    disabledPackage.disabledRuleCount === receipt.disabledRuleCount &&
    disabledPackage.locks?.ruleEnabled === false &&
    disabledPackage.locks?.disabledRulePackageCompiled === true &&
    disabledPackage.locks?.activeRulePackageCompiled === false &&
    disabledPackage.locks?.memoryEnabled === false &&
    disabledPackage.locks?.softwareActionsExecuted === false &&
    disabledPackage.locks?.externalFetchPerformed === false &&
    disabledPackage.locks?.packagingUnlocked === false &&
    activeRules.length === 0 &&
    nonDisabledRules.length === 0;
} catch {
  sourceStillValid = false;
}
if (!sourceStillValid) {
  block("rag_disabled_package_source_not_still_valid", "The referenced disabled package, review validation, or compiled package is missing, changed, or unlocked.");
}

const sourceReadyForValidationReport =
  sourceStillValid &&
  disabledPackage?.nextReview?.mayEnableRules === false &&
  disabledPackage?.nextReview?.mayWriteMemory === false &&
  disabledPackage?.nextReview?.mayExecuteSoftware === false &&
  disabledPackage?.nextReview?.mayFetchExternalSources === false &&
  disabledPackage?.nextReview?.mayUnlockPackaging === false;

if (decision === "disabled_package_result_reviewed_ready_for_validation_report") {
  if (!sourceReadyForValidationReport) {
    block("source_not_ready_for_validation_report", "Disabled package must be a locked review-only package before validation report planning.");
  }
  if (receipt.disabledPackageResultReviewed !== true) block("disabled_package_result_review_required", "Teacher must review the disabled package result.");
  if (receipt.compiledDisabledPackageReviewed !== true) block("compiled_disabled_package_review_required", "Teacher must review the compiled disabled package.");
  if (receipt.stagedRulesReviewed !== true) block("staged_rules_review_required", "Teacher must review staged disabled rules.");
  if (receipt.teacherConfirmedNoValidationReportRun !== true) {
    block("teacher_no_validation_report_confirmation_required", "Teacher must confirm no validation report builder was run here.");
  }
  if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_confirmation_required", "Teacher must confirm blocked actions.");
  if (receipt.rollbackPointConfirmed !== true) block("rollback_point_confirmation_required", "Teacher must confirm the retained rollback point.");
}
if ((decision === "needs_more_disabled_package_evidence" || decision === "correction_to_high_reasoning_repair") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_notes_required", "Teacher notes are required for evidence requests or high-reasoning repair.");
}
if (decision === "needs_teacher_review" && blockers.length === 0) warnings.push("waiting_for_teacher_review");

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const ready =
  blockers.length === 0 &&
  decision === "disabled_package_result_reviewed_ready_for_validation_report" &&
  sourceReadyForValidationReport &&
  receipt.disabledPackageResultReviewed === true &&
  receipt.compiledDisabledPackageReviewed === true &&
  receipt.stagedRulesReviewed === true &&
  receipt.teacherConfirmedNoValidationReportRun === true &&
  receipt.blockedActionsConfirmed === true &&
  receipt.rollbackPointConfirmed === true;

const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_tlcl_rag_disabled_package_result_decision"
  : ready
    ? "tlcl_rag_disabled_package_ready_for_validation_report_planning"
    : decision === "correction_to_high_reasoning_repair" && blockers.length === 0
      ? "correction_to_high_reasoning_repair_required"
      : decision === "needs_more_disabled_package_evidence" && blockers.length === 0
        ? "needs_more_disabled_package_evidence_before_validation_report"
        : "needs_teacher_review_before_validation_report";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outputDir, validationId);
const validationReportHandoff = ready
  ? {
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_validation_report_handoff_v1",
      nextTool: "knowledge/create-rag-disabled-package-validation-report.mjs",
      disabledPackagePath: receipt.disabledPackagePath,
      disabledPackageHash: receipt.disabledPackageHash,
      reviewValidationPath: receipt.reviewValidationPath,
      compiledRulePackagePath: receipt.compiledRulePackagePath,
      disabledRuleCount: receipt.disabledRuleCount,
      rollbackPoint: receipt.rollbackPoint,
      requiredFlags: ["--teacher-reviewed"],
      commandTemplate: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-disabled-package-validation-report.mjs --disabled-rule-package "${receipt.disabledPackagePath}" --rollback-point "${receipt.rollbackPoint}" --teacher-reviewed`,
      instruction:
        "Run this validation report command only as a separate teacher-approved step. It proves disabled rules appear as lifecycle-skipped report rows; it must not enable rules, write memory, execute software, fetch RAG, or unlock packaging.",
      executeNow: false,
      reviewOnly: true,
      teacherNotes: receipt.teacherNotes || ""
    }
  : null;
const highReasoningRepairHandoff =
  status === "correction_to_high_reasoning_repair_required"
    ? {
        route: "high_reasoning_logic_contract_repair_after_tlcl_rag_disabled_package_result",
        sourceDisabledPackageResultReceiptBuilderId: builder.disabledPackageResultReceiptBuilderId || "",
        sourceRagDisabledPackagePath: receipt.disabledPackagePath || "",
        confirmedRollbackPoint: receipt.rollbackPoint || "",
        teacherNotes: receipt.teacherNotes || "",
        instruction:
          "Return to the high-reasoning logic-contract repair layer because the disabled package result did not fit the intended logic contract.",
        executeNow: false,
        reviewOnly: true
      }
    : null;

const validation = {
  ok: blockers.length === 0 && !forbiddenDecisionUsed,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForValidationReportPlanning: ready,
  correctionToHighReasoningRepair: status === "correction_to_high_reasoning_repair_required",
  needsMoreDisabledPackageEvidence: status === "needs_more_disabled_package_evidence_before_validation_report",
  forbiddenDecisionUsed,
  blockers,
  warnings,
  sourceEvidence: {
    builderPath,
    receiptPath,
    sourceTlclValidationPath: receipt.sourceTlclValidationPath || "",
    sourceRagDisabledPackagePath: receipt.disabledPackagePath || ""
  },
  validationReportHandoff,
  highReasoningRepairHandoff,
  blockedActions: [
    "run_validation_report_builder_from_tlcl_disabled_package_result",
    "evaluate_rule_package_from_tlcl_disabled_package_result",
    "invoke_model_from_tlcl_disabled_package_result",
    "fetch_rag_from_tlcl_disabled_package_result",
    "write_memory_from_tlcl_disabled_package_result",
    "enable_rule_from_tlcl_disabled_package_result",
    "unlock_packaging_from_tlcl_disabled_package_result",
    "claim_completion_from_tlcl_disabled_package_result"
  ],
  locks: validationLocks()
};

const validationPath = join(validationDir, "tlcl-rag-disabled-package-result-receipt-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-disabled-package-result-receipt-validation-receipt.json");
writeJson(validationPath, validation);
writeJson(validationReceiptPath, receipt);
writeFileSync(
  join(validationDir, "TLCL_RAG_DISABLED_PACKAGE_RESULT_RECEIPT_VALIDATION_START_HERE.md"),
  [
    "# TLCL RAG Disabled Package Result Receipt Validation",
    "",
    `- Status: ${status}`,
    `- Validation: ${validationPath}`,
    "",
    "This validation does not run the validation report builder. It only prepares a manual validation report handoff when the teacher confirms the existing disabled package result."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: validation.ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForValidationReportPlanning: ready,
      correctionToHighReasoningRepair: validation.correctionToHighReasoningRepair,
      needsMoreDisabledPackageEvidence: validation.needsMoreDisabledPackageEvidence,
      forbiddenDecisionUsed,
      blockers,
      warnings,
      validationPath,
      receiptPath: validationReceiptPath,
      validationReportHandoff,
      highReasoningRepairHandoff,
      locks: validation.locks
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
