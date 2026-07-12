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
    String(value || "tlcl-rag-review-receipt-adapter")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-review-receipt-adapter"
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

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function adapterLocks() {
  return {
    reviewOnly: true,
    adapterOnly: true,
    adapterDoesNotExecuteRagBuilder: true,
    adapterDoesNotAutoRunCommand: true,
    adapterDoesNotInvokeModel: true,
    adapterDoesNotFetchRag: true,
    adapterDoesNotWriteMemory: true,
    adapterDoesNotEnableRule: true,
    adapterDoesNotUnlockPackaging: true,
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

const followUpInput =
  argValue("--follow-up-validation") ||
  argValue("--validation") ||
  argValue("--follow-up-selection-validation");
const packageInput =
  argValue("--rule-dsl-validation-package") ||
  argValue("--package") ||
  argValue("--rag-rule-dsl-validation-package");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-review-receipt-adapter-builder")
  )
);

const { value: followUpValidation, path: followUpValidationPath } = readJsonInput(
  followUpInput,
  "follow-up validation"
);
const packagePath = packageInput && existsSync(packageInput) ? resolve(packageInput) : "";
if (!followUpValidation || !packagePath) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter-builder.mjs --follow-up-validation <validation.json> --rule-dsl-validation-package <package.json> [--output-dir <dir>]"
  );
}

const ruleDslPackage = readJson(packagePath);
const handoff = followUpValidation.manualFollowUpHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (
  ![
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selection_validation_v1",
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selection_validation_result_v1"
  ].includes(followUpValidation.format)
) {
  block("follow_up_validation_format_invalid", "Expected reviewed manual next-gate result follow-up selection validation.");
}
if (followUpValidation.ok === false) block("follow_up_validation_not_ok", "Follow-up selection validation must be ok.");
if (followUpValidation.status !== "reviewed_manual_next_gate_result_follow_up_selected_waiting_for_manual_preparation") {
  block("follow_up_validation_status_invalid", "Follow-up selection must be waiting for manual preparation.");
}
if (followUpValidation.selectedFollowUp !== "prepare_rag_rule_dsl_review_receipt") {
  block("selected_follow_up_not_rag_review_receipt", "selectedFollowUp must be prepare_rag_rule_dsl_review_receipt.");
}
if (followUpValidation.readyForManualPreparation !== true) {
  block("manual_preparation_not_ready", "Follow-up validation must be readyForManualPreparation=true.");
}
if (followUpValidation.locks?.validatorDoesNotExecuteFollowUpTool !== true) {
  block("source_validator_execution_lock_missing", "Source validator must keep follow-up execution locked.");
}
if (!handoff || handoff.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_follow_up_handoff_v1") {
  block("manual_follow_up_handoff_missing", "manualFollowUpHandoff must be present.");
}
if (handoff?.nextToolHint !== "knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs") {
  block("next_tool_hint_mismatch", "nextToolHint must point to the existing RAG review receipt builder.");
}
if (handoff?.expectedOutputFormat !== "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1") {
  block("expected_output_format_mismatch", "Handoff expected output must be transparent_ai_rag_reviewed_rule_dsl_validation_package_v1.");
}
if (ruleDslPackage.format !== "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1") {
  block("rule_dsl_validation_package_format_invalid", "Rule DSL validation package format is invalid.");
}
if (ruleDslPackage.status !== "ready_for_teacher_rule_dsl_review_package") {
  block("rule_dsl_validation_package_status_invalid", "Rule DSL validation package must be ready for teacher review.");
}
if (
  ruleDslPackage.locks?.ruleEnabled !== false ||
  ruleDslPackage.locks?.memoryEnabled !== false ||
  ruleDslPackage.locks?.softwareActionsExecuted !== false ||
  ruleDslPackage.locks?.externalFetchPerformed !== false ||
  ruleDslPackage.locks?.packagingUnlocked !== false
) {
  block("rule_dsl_validation_package_locks_open", "Rule DSL validation package locks must remain closed.");
}

const packageHash = hashJson(ruleDslPackage);
const adapterId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(followUpValidation.selectedFollowUp || "rag-review-receipt")}`;
const adapterDir = join(outputDir, adapterId);
const commandTemplate = `node plugins/transparent-ai-apprentice/scripts/knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs --rule-dsl-validation-package "${packagePath}"`;
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_review_receipt_adapter_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_review_receipt_adapter";

const receiptTemplate = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_receipt_v1",
  sourceAdapterId: adapterId,
  sourceFollowUpValidationId: followUpValidation.validationId || "",
  selectedFollowUp: followUpValidation.selectedFollowUp || "",
  packagePath,
  packageHash,
  packageStatus: ruleDslPackage.status || "",
  reviewedRuleValidationRows: (ruleDslPackage.ruleValidationRows || []).map((row) => ({
    sourceId: row.sourceId || "",
    rulePath: row.rulePath || "",
    ruleHash: row.ruleHash || "",
    lifecycle: row.lifecycle || "",
    dslValidationOk: row.dslValidationOk === true,
    evidenceRefs: row.evidenceRefs || []
  })),
  commandTemplate,
  confirmedRollbackPoint: handoff?.confirmedRollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "adapter_reviewed_for_manual_rag_review_receipt_builder",
    "needs_more_package_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_rag_builder",
    "execute_now",
    "accepted",
    "enable_rule",
    "write_memory",
    "fetch_rag",
    "invoke_model",
    "unlock_packaging",
    "claim_complete"
  ],
  packageEvidenceReviewed: false,
  ruleValidationRowsReviewed: false,
  commandTemplateReviewed: false,
  teacherConfirmedNoExecution: false,
  blockedActionsConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const adapter = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_builder_v1",
  adapterId,
  createdAt: new Date().toISOString(),
  status,
  sourceFollowUpValidationPath: followUpValidationPath,
  sourceFollowUpValidationId: followUpValidation.validationId || "",
  selectedFollowUp: followUpValidation.selectedFollowUp || "",
  manualFollowUpHandoff: handoff,
  ruleDslValidationPackage: {
    packagePath,
    packageHash,
    packageId: ruleDslPackage.packageId || "",
    status: ruleDslPackage.status || "",
    approvedDraftCount: ruleDslPackage.approvedDraftCount || 0,
    validRuleCardCount: ruleDslPackage.validRuleCardCount || 0,
    blockedRuleCardCount: ruleDslPackage.blockedRuleCardCount || 0
  },
  commandTemplate,
  receiptTemplatePath: join(adapterDir, "tlcl-rag-review-receipt-adapter-receipt-template.json"),
  adapterPath: join(adapterDir, "tlcl-rag-review-receipt-adapter-builder.json"),
  readmePath: join(adapterDir, "TLCL_RAG_REVIEW_RECEIPT_ADAPTER_START_HERE.md"),
  htmlPath: join(adapterDir, "tlcl-rag-review-receipt-adapter.html"),
  blockers,
  blockedActions: [
    "execute_existing_rag_review_receipt_builder_from_adapter",
    "auto_run_command_from_adapter",
    "invoke_model_from_adapter",
    "fetch_rag_from_adapter",
    "write_memory_from_adapter",
    "enable_rule_from_adapter",
    "unlock_packaging_from_adapter",
    "claim_completion_from_adapter"
  ],
  locks: adapterLocks()
};

writeJson(adapter.adapterPath, adapter);
writeJson(adapter.receiptTemplatePath, receiptTemplate);
writeFileSync(
  adapter.readmePath,
  [
    "# TLCL RAG Review Receipt Adapter",
    "",
    "This adapter connects a reviewed TLCL manual next-gate result follow-up to the existing RAG Rule DSL review receipt builder.",
    "",
    `- Source follow-up validation: ${followUpValidationPath}`,
    `- RAG Rule DSL validation package: ${packagePath}`,
    `- Receipt template: ${adapter.receiptTemplatePath}`,
    "",
    "It does not run the RAG builder. A teacher must review the adapter receipt before the prepared command can be copied into a separate manual step."
  ].join("\n"),
  "utf8"
);
writeFileSync(
  adapter.htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>TLCL RAG Review Receipt Adapter</title></head><body><h1>TLCL RAG Review Receipt Adapter</h1><p>Status: ${htmlEscape(status)}</p><p>Package: ${htmlEscape(packagePath)}</p><pre>${htmlEscape(commandTemplate)}</pre><p>Receipt: ${htmlEscape(adapter.receiptTemplatePath)}</p></body></html>`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_builder_result_v1",
      status,
      adapterId,
      adapterPath: adapter.adapterPath,
      receiptTemplatePath: adapter.receiptTemplatePath,
      readmePath: adapter.readmePath,
      htmlPath: adapter.htmlPath,
      packagePath,
      packageHash,
      commandTemplate,
      blockers,
      locks: adapter.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
