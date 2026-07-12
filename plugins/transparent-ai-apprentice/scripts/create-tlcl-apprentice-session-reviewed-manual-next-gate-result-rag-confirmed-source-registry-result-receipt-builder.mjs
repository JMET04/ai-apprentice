#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-rag-confirmed-source-registry-result")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-confirmed-source-registry-result"
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashKnowledge(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function isRetainedRollbackPoint(path) {
  if (!path || !existsSync(path)) return false;
  const stat = statSync(path);
  const manifestPath = stat.isDirectory() ? join(path, "rollback-point.json") : path;
  if (!existsSync(manifestPath)) return false;
  const manifest = readJson(manifestPath);
  return (
    (manifest.format === "transparent_ai_rollback_point_v1" ||
      manifest.format === "transparent_ai_rollback_point_result_v1") &&
    manifest.status === "waiting_for_teacher_confirmation" &&
    manifest.deleteOnlyAfterTeacherConfirmation === true
  );
}

function resultLocks() {
  return {
    reviewOnly: true,
    confirmedSourceRegistryResultReceiptOnly: true,
    builderDoesNotRunLocalIngest: true,
    builderDoesNotAutoRunCommand: true,
    builderDoesNotFetchExternalSources: true,
    builderDoesNotExecuteSoftware: true,
    builderDoesNotInvokeModel: true,
    builderDoesNotFetchRag: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRule: true,
    builderDoesNotUnlockPackaging: true,
    localIngestRun: false,
    commandAutoRun: false,
    externalSourcesFetched: false,
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
  argValue("--tlcl-confirmed-source-registry-handoff-validation") ||
  argValue("--tlcl-primary-source-evidence-request-result-validation") ||
  argValue("--tlcl-validation") ||
  argValue("--validation");
const registryInput =
  argValue("--rag-confirmed-source-registry-package") ||
  argValue("--confirmed-source-registry-package") ||
  argValue("--source-registry") ||
  argValue("--registry");
const outputDir = resolve(
  argValue(
    "--output-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-confirmed-source-registry-result-receipt-builder")
  )
);

const { value: tlclInputValue, path: tlclInputPath } = readJsonInput(tlclValidationInput, "TLCL validation");
const { value: registryInputValue, path: registryInputPath } = readJsonInput(registryInput, "RAG confirmed source registry package");
if (!tlclInputValue || !registryInputValue) {
  throw new Error(
    "Usage: node create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt-builder.mjs --tlcl-confirmed-source-registry-handoff-validation <tlcl-validation.json-or-result.json> --rag-confirmed-source-registry-package <registry.json-or-result.json> [--output-dir <dir>]"
  );
}

const { packet: tlclValidation, packetPath: tlclValidationPath } = loadFullPacket(
  tlclInputValue,
  tlclInputPath,
  "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_validation_v1",
  ["validationPath"],
  "TLCL confirmed source registry handoff validation"
);
const { packet: registry, packetPath: registryPath } = loadFullPacket(
  registryInputValue,
  registryInputPath,
  "transparent_ai_rag_confirmed_source_registry_package_v1",
  ["sourceRegistryPath"],
  "RAG confirmed source registry package"
);

const handoff = tlclValidation.manualConfirmedSourceRegistryFollowUpHandoff || null;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (tlclValidation.status !== "tlcl_rag_primary_source_evidence_request_ready_for_confirmed_source_registry_follow_up") {
  block("tlcl_validation_status_invalid", "TLCL validation must be ready for manual confirmed source registry follow-up.");
}
if (tlclValidation.readyForConfirmedSourceRegistryFollowUp !== true) {
  block("tlcl_source_registry_ready_flag_missing", "TLCL validation must set readyForConfirmedSourceRegistryFollowUp=true.");
}
if (
  !handoff ||
  handoff.format !==
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_confirmed_source_registry_follow_up_handoff_v1"
) {
  block("manual_source_registry_handoff_missing", "TLCL validation must contain the manual confirmed source registry handoff.");
}
if (handoff?.nextTool !== "knowledge/create-rag-confirmed-source-registry-package.mjs") {
  block("manual_source_registry_handoff_next_tool_invalid", "TLCL handoff must target the existing confirmed source registry package builder.");
}
if (handoff?.executeNow !== false || handoff?.reviewOnly !== true) {
  block("handoff_review_only_lock_missing", "Handoff must remain review-only and executeNow=false.");
}
if (tlclValidation.locks?.validatorDoesNotRunConfirmedSourceRegistryPackage !== true) {
  block("tlcl_source_registry_execution_lock_missing", "Prior TLCL validation must keep source registry package execution locked.");
}
if (tlclValidation.locks?.validatorDoesNotFetchRag !== true || tlclValidation.locks?.validatorDoesNotWriteMemory !== true) {
  block("tlcl_result_lock_missing", "Prior TLCL validation must keep RAG fetch and memory writes locked.");
}

if (registry.sourceRegistryFollowUpKind !== "primary_source_evidence_follow_up") {
  block("registry_follow_up_kind_invalid", "Registry package must come from a primary-source evidence follow-up.");
}
if (handoff?.sourceRagPrimarySourceEvidenceRequestValidationPath) {
  if (resolve(registry.validationPath || "") !== resolve(handoff.sourceRagPrimarySourceEvidenceRequestValidationPath)) {
    block("registry_validation_path_mismatch", "Registry validationPath must match the TLCL handoff source validation.");
  }
}
if (registry.validationHash !== handoff?.primarySourceValidationHash) {
  block("registry_validation_hash_mismatch", "Registry validationHash must match the TLCL handoff primary-source validation hash.");
}
if (!Array.isArray(registry.sourceRows) || registry.sourceRows.length === 0) {
  block("registry_source_rows_missing", "Registry package must include sourceRows.");
}
if (!registry.sourceRegistryPath || resolve(registry.sourceRegistryPath) !== resolve(registryPath)) {
  block("registry_path_mismatch", "Registry sourceRegistryPath must point to the loaded registry package.");
}
if (registry.readyLocalIngestCount < 1) {
  block("registry_no_ready_local_ingest_rows", "Registry package must contain at least one ready local ingest row before local ingest follow-up.");
}
if (handoff?.rollbackPoint && !isRetainedRollbackPoint(handoff.rollbackPoint)) {
  block("rollback_point_not_retained", "TLCL handoff rollback point must still be retained.");
}
if (
  registry.planningLogicEvidenceHash &&
  hashKnowledge(registry.planningLogicEvidence || null) !== registry.planningLogicEvidenceHash
) {
  block("registry_planning_logic_evidence_hash_mismatch", "Registry planning logic evidence hash no longer matches.");
}
if (
  registry.nextReview?.planningLogicEvidenceHash &&
  registry.nextReview.planningLogicEvidenceHash !== registry.planningLogicEvidenceHash
) {
  block("registry_next_review_planning_logic_hash_mismatch", "Registry nextReview planning logic hash must match.");
}
for (const row of registry.sourceRows || []) {
  const id = row.sourceId || "unknown";
  if (row.reviewOnly !== true) block(`registry_row_review_only_missing:${id}`, "Registry rows must remain review-only.");
  if (row.accepted !== false) block(`registry_row_acceptance_lock_open:${id}`, "Registry rows must not be accepted.");
  if (row.packagingGated !== true) block(`registry_row_packaging_gate_missing:${id}`, "Registry rows must remain packaging gated.");
  if (row.ingestStatus === "ready_for_review_only_local_corpus_ingest" && !String(row.logicExtractionHint || "").trim()) {
    block(`registry_row_logic_hint_missing:${id}`, "Ready local ingest rows must carry a logic extraction hint.");
  }
}
if (
  registry.locks?.reviewOnly !== true ||
  registry.locks?.evidenceOnly !== true ||
  registry.locks?.accepted !== false ||
  registry.locks?.ruleEnabled !== false ||
  registry.locks?.memoryEnabled !== false ||
  registry.locks?.softwareActionsExecuted !== false ||
  registry.locks?.externalFetchPerformed !== false ||
  registry.locks?.packagingUnlocked !== false ||
  registry.nextReview?.mayFetchExternalSources !== false ||
  registry.nextReview?.mayExecuteSoftware !== false ||
  registry.nextReview?.mayEnableRules !== false ||
  registry.nextReview?.mayWriteMemory !== false ||
  registry.nextReview?.mayUnlockPackaging !== false
) {
  block("registry_locks_open", "Registry package must remain locked and review-only.");
}

const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(registry.packageId || "confirmed-source-registry")}`;
const builderDir = join(outputDir, builderId);
const ok = blockers.length === 0;
const status = ok
  ? "tlcl_rag_confirmed_source_registry_result_waiting_for_teacher_confirmation"
  : "blocked_before_tlcl_rag_confirmed_source_registry_result_receipt";
const registryHash = hashKnowledge(registry);
const readyLocalSourceIds = (registry.sourceRows || [])
  .filter((row) => row.ingestStatus === "ready_for_review_only_local_corpus_ingest")
  .map((row) => row.sourceId);

const receipt = {
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_v1",
  sourceConfirmedSourceRegistryResultReceiptBuilderId: builderId,
  sourceTlclValidationId: tlclValidation.validationId || "",
  sourceTlclValidationPath: tlclValidationPath,
  sourceRegistryPackageId: registry.packageId || "",
  sourceRegistryPath: registryPath,
  sourceRegistryHash: registryHash,
  sourceRagPrimarySourceEvidenceRequestValidationPath: registry.validationPath || "",
  primarySourceValidationHash: registry.validationHash || "",
  planningLogicEvidenceHash: registry.planningLogicEvidenceHash || "",
  rollbackPoint: handoff?.rollbackPoint || "",
  sourceRows: registry.sourceRows || [],
  readyLocalSourceIds,
  teacherDecision: "needs_teacher_review",
  allowedDecisions: [
    "needs_teacher_review",
    "confirmed_source_registry_result_reviewed_ready_for_local_ingest_follow_up",
    "needs_more_source_registry_evidence",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenDecisions: [
    "run_local_ingest",
    "execute_ingest_command",
    "fetch_external_sources",
    "execute_now",
    "accepted",
    "enable_rule",
    "write_memory",
    "fetch_rag",
    "invoke_model",
    "unlock_packaging",
    "claim_complete"
  ],
  sourceRegistryReviewed: false,
  sourceRowsReviewed: false,
  localIngestCommandsReviewed: false,
  logicExtractionHintsReviewed: false,
  blockedExternalReferencesReviewed: false,
  teacherConfirmedNoLocalIngestRun: false,
  teacherConfirmedNoExternalFetch: false,
  teacherConfirmedNoMemoryOrRuleWrite: false,
  blockedActionsConfirmed: false,
  rollbackPointConfirmed: false,
  teacherNotes: "",
  executeNow: false,
  reviewOnly: true
};

const builderPacket = {
  ok,
  format:
    "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_builder_v1",
  confirmedSourceRegistryResultReceiptBuilderId: builderId,
  createdAt: new Date().toISOString(),
  status,
  sourceTlclValidationPath: tlclValidationPath,
  sourceRegistryPath: registryPath,
  sourceRegistry: {
    packageId: registry.packageId || "",
    registryHash,
    validationPath: registry.validationPath || "",
    validationHash: registry.validationHash || "",
    sourceRegistryFollowUpKind: registry.sourceRegistryFollowUpKind || "",
    sourceCount: registry.sourceCount || 0,
    readyLocalIngestCount: registry.readyLocalIngestCount || 0,
    externalReferenceCount: registry.externalReferenceCount || 0,
    readyLocalSourceIds,
    planningLogicEvidenceHash: registry.planningLogicEvidenceHash || ""
  },
  handoff,
  receiptTemplatePath: join(builderDir, "tlcl-rag-confirmed-source-registry-result-receipt-template.json"),
  resultReceiptBuilderPath: join(builderDir, "tlcl-rag-confirmed-source-registry-result-receipt-builder.json"),
  readmePath: join(builderDir, "TLCL_RAG_CONFIRMED_SOURCE_REGISTRY_RESULT_RECEIPT_START_HERE.md"),
  blockers,
  blockedActions: [
    "run_local_ingest_from_registry_package",
    "auto_run_local_ingest_command",
    "fetch_external_sources_from_registry_package",
    "invoke_model_from_registry_package",
    "write_memory_from_registry_package",
    "enable_rule_from_registry_package",
    "unlock_packaging_from_registry_package",
    "claim_completion_from_registry_package"
  ],
  locks: resultLocks()
};

writeJson(builderPacket.resultReceiptBuilderPath, builderPacket);
writeJson(builderPacket.receiptTemplatePath, receipt);
writeFileSync(
  builderPacket.readmePath,
  [
    "# TLCL RAG Confirmed Source Registry Result Receipt",
    "",
    "This packet brings the separately created confirmed source registry package back into the TLCL teacher-review loop before local ingest.",
    "",
    `- TLCL validation: ${tlclValidationPath}`,
    `- Existing RAG confirmed source registry: ${registryPath}`,
    `- TLCL receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "It does not run local ingest, execute prepared commands, fetch external sources, invoke a model, write memory, enable rules, unlock packaging, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok,
      format:
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_builder_result_v1",
      status,
      confirmedSourceRegistryResultReceiptBuilderId: builderId,
      resultReceiptBuilderPath: builderPacket.resultReceiptBuilderPath,
      receiptTemplatePath: builderPacket.receiptTemplatePath,
      readmePath: builderPacket.readmePath,
      sourceRegistryPath: registryPath,
      blockers,
      locks: builderPacket.locks
    },
    null,
    2
  )
);

if (!ok) process.exit(1);
