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
    String(value || "tlcl-rag-disabled-package-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-disabled-package-result"
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
    disabledPackageResultReceiptOnly: true,
    builderDoesNotRunValidationReportBuilder: true,
    builderDoesNotEvaluateRulePackage: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
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

const tlclValidationInput =
  argValue("--tlcl-disabled-package-planning-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const disabledPackageInput =
  argValue("--rag-disabled-package") ||
  argValue("--disabled-package") ||
  argValue("--disabled-package-result") ||
  argValue("--builder-result");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-disabled-package-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: disabledPackageInputValue, path: disabledPackageInputPath } = readJsonInput(disabledPackageInput, "RAG disabled package");
if (!tlclInputValue || !disabledPackageInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt-builder.mjs --tlcl-disabled-package-planning-validation <tlcl-validation.json-or-result.json> --rag-disabled-package <disabled-package.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL validation"
);
const { packet: disabledPackage, packetPath: disabledPackagePath } = loadFullPacket(
  disabledPackageInputValue,
  disabledPackageInputPath,
  "transparent_ai_rag_reviewed_disabled_rule_package_v1",
  ["packagePath"],
  "RAG disabled package"
);

const handoff = tlclValidation.disabledPackagePlanningHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_review_receipt_validation_ready_for_disabled_package_planning") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for disabled package planning.");
}
if (tlclValidation.readyForDisabledPackagePlanning !== true) {
  block("tlcl_disabled_package_planning_flag_missing", "TLCL validation must set readyForDisabledPackagePlanning=true.");
}
if (
  !handoff ||
  handoff.format !== "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_disabled_package_planning_handoff_v1"
) {
  block("manual_disabled_package_planning_handoff_missing", "TLCL validation must contain the manual disabled package planning handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-reviewed-disabled-rule-package.mjs") {
  block("handoff_next_tool_mismatch", "Handoff must point to the existing RAG reviewed disabled package builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunDisabledPackageBuilder !== true) {
  block("tlcl_disabled_package_execution_lock_missing", "TLCL validation must keep disabled package builder execution locked.");
}

const currentDisabledPackageHash = hashKnowledge(disabledPackage);
const reviewValidationPath = disabledPackage.reviewValidationPath ? resolve(disabledPackage.reviewValidationPath) : "";
let reviewValidation = null;
let compiledRulePackage = null;
if (!reviewValidationPath || !existsSync(reviewValidationPath)) {
  block("source_review_validation_missing", "Disabled package reviewValidationPath is missing or no longer exists.");
} else {
  reviewValidation = readJson(reviewValidationPath);
}
if (!disabledPackage.compiledRulePackagePath || !existsSync(disabledPackage.compiledRulePackagePath)) {
  block("compiled_disabled_rule_package_missing", "Disabled package compiledRulePackagePath is missing or no longer exists.");
} else {
  compiledRulePackage = readJson(disabledPackage.compiledRulePackagePath);
}

if (handoff?.reviewValidationPath && reviewValidationPath && resolve(handoff.reviewValidationPath) !== reviewValidationPath) {
  block("handoff_review_validation_path_mismatch", "Disabled package reviewValidationPath must match the TLCL handoff.");
}
if (handoff?.rollbackPoint && disabledPackage.rollbackPoint && resolve(handoff.rollbackPoint) !== resolve(disabledPackage.rollbackPoint)) {
  block("handoff_rollback_point_mismatch", "Disabled package rollbackPoint must match the TLCL handoff.");
}
if (reviewValidation && disabledPackage.reviewValidationHash !== hashKnowledge(reviewValidation)) {
  block("disabled_package_review_validation_hash_mismatch", "Disabled package reviewValidationHash no longer matches source review validation.");
}
if (disabledPackage.status !== "ready_for_teacher_disabled_rule_package_review") {
  block("disabled_package_status_invalid", "Disabled package must be ready for teacher package review.");
}
if (
  disabledPackage.locks?.ruleEnabled !== false ||
  disabledPackage.locks?.disabledRulePackageCompiled !== true ||
  disabledPackage.locks?.activeRulePackageCompiled !== false ||
  disabledPackage.locks?.memoryEnabled !== false ||
  disabledPackage.locks?.softwareActionsExecuted !== false ||
  disabledPackage.locks?.externalFetchPerformed !== false ||
  disabledPackage.locks?.packagingUnlocked !== false
) {
  block("disabled_package_locks_open", "Disabled package locks must remain closed.");
}
if (compiledRulePackage) {
  const activeRules = (compiledRulePackage.rules || []).filter((rule) => rule.lifecycle === "active");
  const nonDisabledRules = (compiledRulePackage.rules || []).filter((rule) => rule.lifecycle !== "draft_disabled");
  if (activeRules.length > 0) block("compiled_package_contains_active_rules", "Compiled disabled package must not contain active rules.");
  if (nonDisabledRules.length > 0) block("compiled_package_contains_non_draft_disabled_rules", "Compiled disabled package must contain only draft_disabled rules.");
}
if (!Array.isArray(disabledPackage.stagedRules) || disabledPackage.stagedRules.length === 0) {
  block("disabled_package_staged_rules_missing", "Disabled package must include staged disabled rules.");
}
if (disabledPackage.executedCommand?.kind !== "node_spawn_no_shell") {
  block("disabled_package_compile_command_not_no_shell", "Disabled package must have used the existing compiler through node_spawn_no_shell.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(disabledPackage.packageId || disabledPackage.status)}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_disabled_package_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_disabled_package_result_receipt";

const receiptTemplate = {
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_v1",
  sourceDisabledPackageResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagDisabledPackageId: disabledPackage.packageId || "",
  sourceRagDisabledPackagePath: disabledPackagePath,
  sourceRagDisabledPackageStatus: disabledPackage.status || "",
  disabledPackagePath,
  disabledPackageHash: currentDisabledPackageHash,
  reviewValidationPath,
  reviewValidationHash: disabledPackage.reviewValidationHash || "",
  compiledRulePackagePath: disabledPackage.compiledRulePackagePath || "",
  disabledRuleCount: disabledPackage.disabledRuleCount || 0,
  stagedRuleCount: Array.isArray(disabledPackage.stagedRules) ? disabledPackage.stagedRules.length : 0,
  rollbackPoint: disabledPackage.rollbackPoint || "",
  handoffRollbackPoint: handoff?.rollbackPoint || "",
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "disabled_package_result_reviewed_ready_for_validation_report",
    "needs_more_disabled_package_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_validation_report_builder",
    "execute_now",
    "accepted",
    "enable_rule",
    "write_memory",
    "fetch_rag",
    "invoke_model",
    "unlock_packaging",
    "claim_complete"
  ],
  disabledPackageResultReviewed: false,
  compiledDisabledPackageReviewed: false,
  stagedRulesReviewed: false,
  teacherConfirmedNoValidationReportRun: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_builder_v1",
  disabledPackageResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRagDisabledPackagePath: disabledPackagePath,
  sourceRagDisabledPackage: {
    packageId: disabledPackage.packageId || "",
    status: disabledPackage.status || "",
    disabledRuleCount: disabledPackage.disabledRuleCount || 0,
    compiledRulePackagePath: disabledPackage.compiledRulePackagePath || "",
    rollbackPoint: disabledPackage.rollbackPoint || ""
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-disabled-package-result-receipt-template.json"),
  disabledPackageResultReceiptBuilderPath: join(builderDir, "tlcl-rag-disabled-package-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_DISABLED_PACKAGE_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_validation_report_builder_from_disabled_package_result",
    "evaluate_rule_package_from_disabled_package_result",
    "invoke_model_from_disabled_package_result",
    "fetch_rag_from_disabled_package_result",
    "write_memory_from_disabled_package_result",
    "enable_rule_from_disabled_package_result",
    "unlock_packaging_from_disabled_package_result",
    "claim_completion_from_disabled_package_result"
  ],
  locks: builderLocks()
};

writeJson(builderPacket.disabledPackageResultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Disabled Package Result Receipt",
    "",
    "This packet brings the existing RAG reviewed disabled package result back into the TLCL teacher-review loop.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Disabled package: ${disabledPackagePath}`,
    `- Compiled disabled package: ${disabledPackage.compiledRulePackagePath || ""}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run the validation report builder, evaluate the package, enable rules, write memory, fetch RAG, execute software, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format: "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_builder_result_v1",
      status,
      disabledPackageResultReceiptBuilderId: builderId,
      disabledPackageResultReceiptBuilderPath: builderPacket.disabledPackageResultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRagDisabledPackagePath: disabledPackagePath,
      disabledPackageStatus: disabledPackage.status || "",
      disabledRuleCount: disabledPackage.disabledRuleCount || 0,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
