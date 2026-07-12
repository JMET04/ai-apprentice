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
    String(value || "tlcl-rag-review-receipt-validation-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-review-receipt-validation-result"
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

function loadFullPacket(inputValue, inputPath, expectedFormat, pathFields, label) {
  let packet = inputValue;
  let packetPath = inputPath || "";
  for (const field of pathFields) {
    if (packet?.[field] && existsSync(packet[field])) {
      packetPath = resolve(packet[field]);
      packet = readJson(packetPath);
      break;
    }
  }
  if (packet?.format !== expectedFormat) {
    throw new Error(`Expected ${expectedFormat} or a ${label} result with ${pathFields.join(" / ")}.`);
  }
  return { packet, packetPath };
}

function builderLocks() {
  return {
    reviewOnly: true,
    validationResultReceiptOnly: true,
    builderDoesNotRunDisabledPackageBuilder: true,
    builderDoesNotCompileRulePackage: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    disabledPackageBuilderRun: false,
    rulePackageCompiled: false,
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

const tlclValidationInput =
  argValue("--tlcl-builder-result-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--builder-result-validation") ||
  argValue("--validation");
const ragValidationInput =
  argValue("--rag-review-receipt-validation") ||
  argValue("--rag-validation") ||
  argValue("--review-validation") ||
  argValue("--builder-result");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-review-receipt-validation-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: ragInputValue, path: ragInputPath } = readJsonInput(ragValidationInput, "RAG review receipt validation");
if (!tlclInputValue || !ragInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt-builder.mjs --tlcl-builder-result-validation <tlcl-validation.json-or-result.json> --rag-review-receipt-validation <rag-review-validation.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL validation"
);
const { packet: ragValidation, packetPath: ragValidationPath } = loadFullPacket(
  ragInputValue,
  ragInputPath,
  "transparent_ai_rag_reviewed_rule_dsl_review_receipt_validation_v1",
  ["validationPath"],
  "RAG review receipt validation"
);

const handoff = tlclValidation.manualRagReviewReceiptTemplateHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_review_receipt_template_ready_for_teacher_fill") {
  block("tlcl_validation_status_invalid", "TLCL builder-result validation must be ready for teacher RAG receipt filling.");
}
if (tlclValidation.readyForRagReviewReceiptTeacherFill !== true) {
  block("tlcl_teacher_fill_flag_missing", "TLCL validation must set readyForRagReviewReceiptTeacherFill=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_review_receipt_template_handoff_v1"
) {
  block("manual_rag_review_receipt_template_handoff_missing", "TLCL validation must contain the manual RAG review receipt template handoff.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Manual RAG review receipt handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotExecuteRagValidator !== true) {
  block("tlcl_rag_validator_execution_lock_missing", "TLCL validation must keep the RAG validator execution locked.");
}

const packagePath = ragValidation.packagePath ? resolve(ragValidation.packagePath) : "";
const receiptPath = ragValidation.receiptPath ? resolve(ragValidation.receiptPath) : "";
let packagePacket = null;
let receiptPacket = null;
let currentPackageHash = "";
if (!packagePath || !existsSync(packagePath)) {
  block("rag_validation_package_missing", "RAG validation packagePath is missing or no longer exists.");
} else {
  packagePacket = readJson(packagePath);
  currentPackageHash = hashKnowledge(packagePacket);
}
if (!receiptPath || !existsSync(receiptPath)) {
  block("rag_validation_receipt_missing", "RAG validation receiptPath is missing or no longer exists.");
} else {
  receiptPacket = readJson(receiptPath);
}

if (handoff?.packagePath && packagePath && resolve(handoff.packagePath) !== packagePath) {
  block("handoff_package_path_mismatch", "RAG validation packagePath must match the TLCL handoff packagePath.");
}
if (handoff?.packageHash && currentPackageHash && handoff.packageHash !== currentPackageHash) {
  block("handoff_package_hash_mismatch", "TLCL handoff packageHash no longer matches the current package.");
}
if (ragValidation.packageHash && currentPackageHash && ragValidation.packageHash !== currentPackageHash) {
  block("rag_validation_package_hash_mismatch", "RAG validation packageHash no longer matches the current package.");
}
if (packagePacket?.format !== "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1") {
  block("package_format_invalid", "RAG validation package must remain transparent_ai_rag_reviewed_rule_dsl_validation_package_v1.");
}
if (packagePacket?.status !== "ready_for_teacher_rule_dsl_review_package") {
  block("package_status_invalid", "RAG validation package must remain ready for teacher Rule DSL review.");
}
if (
  packagePacket &&
  (packagePacket.locks?.ruleEnabled !== false ||
    packagePacket.locks?.memoryEnabled !== false ||
    packagePacket.locks?.softwareActionsExecuted !== false ||
    packagePacket.locks?.externalFetchPerformed !== false ||
    packagePacket.locks?.packagingUnlocked !== false)
) {
  block("package_locks_open", "RAG validation package locks must remain closed.");
}
if (receiptPacket?.format !== "transparent_ai_rag_reviewed_rule_dsl_review_receipt_v1") {
  block("rag_review_receipt_format_invalid", "RAG review receipt must remain transparent_ai_rag_reviewed_rule_dsl_review_receipt_v1.");
}
if (receiptPacket?.packageHash && currentPackageHash && receiptPacket.packageHash !== currentPackageHash) {
  block("rag_review_receipt_package_hash_mismatch", "Teacher-filled RAG receipt packageHash must match the current package.");
}
if (receiptPacket?.packagePath && packagePath && resolve(receiptPacket.packagePath) !== packagePath) {
  block("rag_review_receipt_package_path_mismatch", "Teacher-filled RAG receipt packagePath must match the RAG validation packagePath.");
}
if (!String(handoff?.validationCommand || "").includes("validate-rag-reviewed-rule-dsl-review-receipt.mjs")) {
  block("handoff_validation_command_invalid", "TLCL handoff validationCommand must point to the existing RAG review receipt validator.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(ragValidation.validationId || ragValidation.status)}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_review_receipt_validation_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_review_receipt_validation_result_receipt";
const reviewedDisabledRuleCount = Array.isArray(ragValidation.reviewedDisabledRules) ? ragValidation.reviewedDisabledRules.length : 0;
const sourceReadyForDisabledPackagePlanning =
  ragValidation.status === "ready_for_review_only_disabled_rule_package_planning" &&
  ragValidation.nextReview?.mayPrepareDisabledRulePackageReview === true &&
  reviewedDisabledRuleCount > 0 &&
  ragValidation.locks?.ruleEnabled === false &&
  ragValidation.locks?.memoryEnabled === false &&
  ragValidation.locks?.softwareActionsExecuted === false &&
  ragValidation.locks?.externalFetchPerformed === false &&
  ragValidation.locks?.packagingUnlocked === false;

const receiptTemplate = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_v1",
  sourceValidationResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagReviewReceiptValidationId: ragValidation.validationId || "",
  sourceRagReviewReceiptValidationPath: ragValidationPath,
  sourceRagReviewReceiptValidationStatus: ragValidation.status || "",
  sourceReadyForDisabledPackagePlanning,
  reviewedDisabledRuleCount,
  packagePath,
  packageHash: currentPackageHash,
  ragValidationPackageHash: ragValidation.packageHash || "",
  ragReviewReceiptPath: receiptPath,
  ragReviewReceiptTemplatePath: handoff?.receiptTemplatePath || "",
  validationCommand: handoff?.validationCommand || "",
  confirmedRollbackPoint: handoff?.confirmedRollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "rag_review_receipt_validation_result_reviewed_ready_for_disabled_package_planning",
    "needs_more_rag_review_validation_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_disabled_package_builder",
    "execute_now",
    "accepted",
    "enable_rule",
    "write_memory",
    "fetch_rag",
    "invoke_model",
    "unlock_packaging",
    "claim_complete"
  ],
  ragReviewReceiptValidationReviewed: false,
  readyStatusReviewed: false,
  reviewedDisabledRulesReviewed: false,
  teacherConfirmedNoDisabledPackageBuilderRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_builder_v1",
  validationResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagReviewReceiptValidationPath: ragValidationPath,
  sourceRagReviewReceiptValidation: {
    validationId: ragValidation.validationId || "",
    status: ragValidation.status || "",
    packagePath,
    receiptPath,
    reviewedDisabledRuleCount,
    sourceReadyForDisabledPackagePlanning
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-review-receipt-validation-result-receipt-template.json"),
  validationResultReceiptBuilderPath: join(builderDir, "tlcl-rag-review-receipt-validation-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_REVIEW_RECEIPT_VALIDATION_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_disabled_package_builder_from_rag_review_receipt_validation_result",
    "compile_rule_package_from_rag_review_receipt_validation_result",
    "invoke_model_from_rag_review_receipt_validation_result",
    "fetch_rag_from_rag_review_receipt_validation_result",
    "write_memory_from_rag_review_receipt_validation_result",
    "enable_rule_from_rag_review_receipt_validation_result",
    "unlock_packaging_from_rag_review_receipt_validation_result",
    "claim_completion_from_rag_review_receipt_validation_result"
  ],
  locks: builderLocks()
};

writeJson(builderPacket.validationResultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Review Receipt Validation Result Receipt",
    "",
    "This packet brings the existing RAG review receipt validation result back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- RAG review receipt validation: ${ragValidationPath}`,
    `- Source RAG validation status: ${ragValidation.status || ""}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the disabled package builder, compile rules, enable rules, write memory, fetch RAG, or unlock packaging. A teacher must confirm the validation result before a separate disabled-package planning handoff is prepared."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_builder_result_v1",
      status,
      validationResultReceiptBuilderId: builderId,
      validationResultReceiptBuilderPath: builderPacket.validationResultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagReviewReceiptValidationPath: ragValidationPath,
      sourceRagReviewReceiptValidationStatus: ragValidation.status || "",
      sourceReadyForDisabledPackagePlanning,
      reviewedDisabledRuleCount,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
