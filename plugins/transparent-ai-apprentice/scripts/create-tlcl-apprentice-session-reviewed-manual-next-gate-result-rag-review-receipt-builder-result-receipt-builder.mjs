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
    String(value || "tlcl-rag-review-receipt-builder-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-review-receipt-builder-result"
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

function hashHex(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hashKnowledge(value) {
  return `sha256:${hashHex(value)}`;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resultLocks() {
  return {
    reviewOnly: true,
    builderResultReceiptOnly: true,
    builderDoesNotValidateRagReviewReceipt: true,
    builderDoesNotExecuteRagValidator: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    ragValidatorExecuted: false,
    commandAutoRun: false,
    modelInvoked: false,
    ragFetched: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  };
}

function loadRagBuilderPacket(inputValue, inputPath) {
  let packet = inputValue;
  let packetPath = inputPath || "";
  if (packet?.builderPath && existsSync(packet.builderPath)) {
    packetPath = resolve(packet.builderPath);
    packet = readJson(packetPath);
  }
  if (packet?.format !== "transparent_ai_rag_reviewed_rule_dsl_review_receipt_builder_v1") {
    throw new Error("Expected transparent_ai_rag_reviewed_rule_dsl_review_receipt_builder_v1 or a result with builderPath.");
  }
  return { packet, packetPath };
}

const adapterValidationInput =
  argValue("--adapter-validation") || argValue("--validation") || argValue("--adapter");
const ragBuilderInput =
  argValue("--rag-review-receipt-builder") ||
  argValue("--rag-builder") ||
  argValue("--builder-result") ||
  argValue("--builder");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-review-receipt-builder-result-receipt-builder")
  )
);

const { value: adapterValidation, path: adapterValidationPath } = readJsonInput(
  adapterValidationInput,
  "adapter validation"
);
const { value: ragBuilderInputValue, path: ragBuilderInputPath } = readJsonInput(ragBuilderInput, "RAG builder result");
if (!adapterValidation || !ragBuilderInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt-builder.mjs --adapter-validation <validation.json> --rag-review-receipt-builder <builder.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: ragBuilder, packetPath: ragBuilderPath } = loadRagBuilderPacket(ragBuilderInputValue, ragBuilderInputPath);
const handoff = adapterValidation.manualRagReviewReceiptBuilderHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (
  ![
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_validation_v1",
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_validation_result_v1"
  ].includes(adapterValidation.format)
) {
  block("adapter_validation_format_invalid", "Expected TLCL RAG review receipt adapter validation.");
}
if (adapterValidation.status !== "tlcl_rag_review_receipt_builder_manual_command_ready") {
  block("adapter_validation_status_invalid", "Adapter validation must be ready for manual RAG review receipt builder use.");
}
if (adapterValidation.readyForManualRagReviewReceiptBuilder !== true) {
  block("manual_rag_builder_not_ready", "Adapter validation must set readyForManualRagReviewReceiptBuilder=true.");
}
if (!handoff || handoff.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_review_receipt_builder_handoff_v1") {
  block("manual_rag_builder_handoff_missing", "Adapter validation must contain a manual RAG review receipt builder handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs") {
  block("handoff_next_tool_mismatch", "Handoff must point to the existing RAG review receipt builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (adapterValidation.locks?.validatorDoesNotExecuteRagBuilder !== true) {
  block("adapter_validation_execution_lock_missing", "Adapter validation must keep RAG builder execution locked.");
}

const packagePath = ragBuilder.packagePath ? resolve(ragBuilder.packagePath) : "";
let packagePacket = null;
let currentTlclPackageHash = "";
let currentKnowledgePackageHash = "";
if (!packagePath || !existsSync(packagePath)) {
  block("rag_builder_package_missing", "RAG builder packagePath is missing or does not exist.");
} else {
  packagePacket = readJson(packagePath);
  currentTlclPackageHash = hashHex(packagePacket);
  currentKnowledgePackageHash = hashKnowledge(packagePacket);
}

if (packagePath && handoff?.ruleDslValidationPackagePath && resolve(handoff.ruleDslValidationPackagePath) !== packagePath) {
  block("handoff_package_path_mismatch", "RAG builder packagePath must match the adapter handoff package path.");
}
if (handoff?.ruleDslValidationPackageHash && currentTlclPackageHash && handoff.ruleDslValidationPackageHash !== currentTlclPackageHash) {
  block("handoff_package_hash_mismatch", "Adapter handoff package hash no longer matches the current package.");
}
if (ragBuilder.packageHash && currentKnowledgePackageHash && ragBuilder.packageHash !== currentKnowledgePackageHash) {
  block("rag_builder_package_hash_mismatch", "RAG builder package hash no longer matches the current package.");
}
if (packagePacket?.format !== "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1") {
  block("package_format_invalid", "RAG builder package must be transparent_ai_rag_reviewed_rule_dsl_validation_package_v1.");
}
if (packagePacket?.status !== "ready_for_teacher_rule_dsl_review_package") {
  block("package_status_invalid", "RAG builder package must remain ready for teacher rule DSL review.");
}
if (
  packagePacket &&
  (packagePacket.locks?.ruleEnabled !== false ||
    packagePacket.locks?.memoryEnabled !== false ||
    packagePacket.locks?.softwareActionsExecuted !== false ||
    packagePacket.locks?.externalFetchPerformed !== false ||
    packagePacket.locks?.packagingUnlocked !== false)
) {
  block("package_locks_open", "RAG builder package locks must remain closed.");
}

if (!ragBuilder.builderId) block("rag_builder_id_missing", "Full RAG builder packet must contain builderId.");
if (!ragBuilder.receiptTemplatePath || !existsSync(ragBuilder.receiptTemplatePath)) {
  block("rag_receipt_template_missing", "RAG builder receiptTemplatePath is missing.");
}
if (!String(ragBuilder.validationCommand || "").includes("validate-rag-reviewed-rule-dsl-review-receipt.mjs")) {
  block("rag_validation_command_missing", "RAG builder validationCommand must point to the existing RAG review receipt validator.");
}
if (
  ragBuilder.locks?.ruleEnabled !== false ||
  ragBuilder.locks?.memoryEnabled !== false ||
  ragBuilder.locks?.softwareActionsExecuted !== false ||
  ragBuilder.locks?.externalFetchPerformed !== false ||
  ragBuilder.locks?.packagingUnlocked !== false
) {
  block("rag_builder_locks_open", "RAG builder locks must remain closed.");
}

const resultReceiptId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(ragBuilder.builderId || "rag-builder-result")}`;
const resultDir = join(outputDir, resultReceiptId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_review_receipt_builder_result_receipt_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_review_receipt_builder_result_receipt";

const receiptTemplate = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_v1",
  sourceResultReceiptBuilderId: resultReceiptId,
  sourceAdapterValidationId: adapterValidation.validationId || "",
  sourceRagReviewReceiptBuilderId: ragBuilder.builderId || "",
  sourceRagReviewReceiptBuilderPath: ragBuilderPath,
  packagePath,
  adapterPackageHash: handoff?.ruleDslValidationPackageHash || "",
  ragBuilderPackageHash: ragBuilder.packageHash || "",
  currentPackageHash: currentKnowledgePackageHash,
  receiptTemplatePath: ragBuilder.receiptTemplatePath || "",
  validationCommand: ragBuilder.validationCommand || "",
  confirmedRollbackPoint: handoff?.confirmedRollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "rag_review_receipt_builder_result_reviewed_ready_for_teacher_receipt",
    "needs_more_builder_result_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_rag_validator",
    "execute_now",
    "accepted",
    "enable_rule",
    "write_memory",
    "fetch_rag",
    "invoke_model",
    "unlock_packaging",
    "claim_complete"
  ],
  builderOutputReviewed: false,
  receiptTemplateReviewed: false,
  validationCommandReviewed: false,
  teacherConfirmedNoExecution: false,
  blockedActionsConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_builder_v1",
  resultReceiptBuilderId: resultReceiptId,
  createdAt: new Date().toISOString(),
  status,
  sourceAdapterValidationPath: adapterValidationPath,
  sourceAdapterValidationId: adapterValidation.validationId || "",
  sourceRagReviewReceiptBuilderPath: ragBuilderPath,
  sourceRagReviewReceiptBuilder: {
    builderId: ragBuilder.builderId || "",
    packagePath,
    packageHash: ragBuilder.packageHash || "",
    receiptTemplatePath: ragBuilder.receiptTemplatePath || "",
    validationCommand: ragBuilder.validationCommand || ""
  },
  handoff,
  packageEvidence: {
    packagePath,
    adapterPackageHash: handoff?.ruleDslValidationPackageHash || "",
    currentTlclPackageHash,
    currentKnowledgePackageHash
  },
  receiptTemplatePath: join(resultDir, "tlcl-rag-review-receipt-builder-result-receipt-template.json"),
  resultReceiptBuilderPath: join(resultDir, "tlcl-rag-review-receipt-builder-result-receipt-builder.json"),
  readmePath: join(resultDir, "TLCL_RAG_REVIEW_RECEIPT_BUILDER_RESULT_RECEIPT_START_HERE.md"),
  htmlPath: join(resultDir, "tlcl-rag-review-receipt-builder-result-receipt.html"),
  blockers,
  blockedActions: [
    "run_rag_review_receipt_validator_from_builder_result",
    "auto_run_rag_review_receipt_validation_command",
    "invoke_model_from_rag_builder_result_receipt",
    "fetch_rag_from_rag_builder_result_receipt",
    "write_memory_from_rag_builder_result_receipt",
    "enable_rule_from_rag_builder_result_receipt",
    "unlock_packaging_from_rag_builder_result_receipt",
    "claim_completion_from_rag_builder_result_receipt"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Review Receipt Builder Result Receipt",
    "",
    "This packet brings the existing RAG review receipt builder output back into the TLCL teacher-review loop.",
    "",
    `- Adapter validation: ${adapterValidationPath}`,
    `- Existing RAG builder: ${ragBuilderPath}`,
    `- RAG review receipt template: ${ragBuilder.receiptTemplatePath || ""}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not validate the RAG review receipt and does not execute any command. A teacher must confirm this builder result before the RAG review receipt template is filled in the next separate step."
  ].join("\n"),
  "utf8"
);
writeFileSync(
  builderPacket.htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>TLCL RAG Builder Result Receipt</title></head><body><h1>TLCL RAG Builder Result Receipt</h1><p>Status: ${htmlEscape(status)}</p><p>Existing builder: ${htmlEscape(ragBuilderPath)}</p><p>Receipt template: ${htmlEscape(ragBuilder.receiptTemplatePath || "")}</p><pre>${htmlEscape(ragBuilder.validationCommand || "")}</pre><p>This page does not run the validator.</p></body></html>`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_builder_result_v1",
      status,
      resultReceiptBuilderId: resultReceiptId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      htmlPath: builderPacket.htmlPath,
      sourceRagReviewReceiptBuilderPath: ragBuilderPath,
      packagePath,
      receiptTemplatePathFromRagBuilder: ragBuilder.receiptTemplatePath || "",
      validationCommand: ragBuilder.validationCommand || "",
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
