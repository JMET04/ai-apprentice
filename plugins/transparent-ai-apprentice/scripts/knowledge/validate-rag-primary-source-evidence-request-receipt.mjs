#!/usr/bin/env node
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const planningPacketPath = resolve(arg("--planning-packet", arg("--packet", "")));
const receiptPath = resolve(arg("--receipt", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-primary-source-evidence-request-receipt-validation"))
);

if (!planningPacketPath || !receiptPath) {
  throw new Error(
    "Usage: node validate-rag-primary-source-evidence-request-receipt.mjs --planning-packet <rag-selected-follow-up-planning-packet.json> --receipt <teacher-filled-receipt.json> [--out-dir <dir>]"
  );
}

function normalizeLocalPath(uri) {
  if (String(uri).startsWith("file://")) return decodeURIComponent(String(uri).replace(/^file:\/+/, ""));
  if (/^[A-Za-z]:\\/.test(String(uri)) || String(uri).startsWith("/")) return String(uri);
  return "";
}

function sourceCardFromRow(row) {
  const uri = String(row.uri || "").trim();
  const localPath = normalizeLocalPath(uri);
  const isHttp = /^https?:\/\//.test(uri);
  const localReadable = localPath ? existsSync(localPath) : false;
  const supportedText = localReadable && [".md", ".markdown", ".txt", ".json"].includes(extname(localPath).toLowerCase());
  return {
    source_id: row.sourceId,
    title: row.title,
    uri,
    source_type: row.sourceType,
    domain: row.domain,
    trust_level: row.trustLevelAfterReview,
    permission: {
      status: row.permissionStatus,
      note: row.reviewerNote
    },
    review: {
      accepted: false,
      review_only: true,
      packaging_gated: true,
      evidence_reviewed: true,
      review_only_boundary_reviewed: true,
      logic_extraction_hint: row.logicExtractionHint || ""
    },
    hashes: {
      source_hash: hashText(`${row.sourceId}:${uri}:${row.title}:${row.logicExtractionHint || ""}`)
    },
    ingestStatus: supportedText
      ? "ready_for_review_only_local_corpus_ingest"
      : isHttp
        ? "external_reference_registered_no_fetch"
        : "registered_but_source_file_unavailable",
    localReadable,
    supportedText
  };
}

const packet = readJson(planningPacketPath);
const receipt = readJson(receiptPath);
if (packet.format !== "transparent_ai_rag_selected_follow_up_planning_packet_v1") {
  throw new Error("Expected transparent_ai_rag_selected_follow_up_planning_packet_v1.");
}
if (receipt.format !== "transparent_ai_rag_primary_source_evidence_request_receipt_v1") {
  throw new Error("Expected transparent_ai_rag_primary_source_evidence_request_receipt_v1.");
}

const planningHash = hashText(JSON.stringify(packet));
const fallbackPlanningLogicEvidence = {
  logicExtractionHints: Array.isArray(packet.logicExtractionHints) ? packet.logicExtractionHints : [],
  logicEvidenceReviews: Array.isArray(packet.logicEvidenceReviews) ? packet.logicEvidenceReviews : []
};
const planningLogicEvidence = packet.planningLogicEvidence ?? fallbackPlanningLogicEvidence;
const planningLogicEvidenceHash = packet.planningLogicEvidenceHash || hashText(JSON.stringify(planningLogicEvidence));
const nextReviewPlanningLogicEvidence = packet.nextReview?.planningLogicEvidence ?? null;
const nextReviewPlanningLogicEvidenceHash = packet.nextReview?.planningLogicEvidenceHash || "";
const allowedTop = new Set(["needs_teacher_review", "teacher_provided_primary_sources", "blocked"]);
const forbidden = new Set([
  "accepted",
  "accept_technology",
  "enable_rule",
  "activate_rule",
  "write_memory",
  "execute_software",
  "fetch_external_source",
  "open_delivery_gate",
  "unlock_packaging",
  "claim_goal_complete"
]);
const allowedTrust = new Set(["teacher_supplied", "primary_source", "official_standard", "research_paper", "vendor_documentation"]);
const allowedPermission = new Set(["teacher_supplied", "permitted_for_local_review", "public_reference_no_fetch", "internal_reference"]);
const errors = [];
const warnings = [];

if (packet.status !== "selected_follow_up_planning_ready_for_teacher_review") errors.push("PLANNING_PACKET_NOT_READY_FOR_SOURCE_EVIDENCE");
if (packet.selectedFollowUpDecision !== "request_more_primary_sources") errors.push("PLANNING_PACKET_NOT_PRIMARY_SOURCE_REQUEST");
if (packet.locks?.reviewOnly !== true) errors.push("PLANNING_REVIEW_ONLY_LOCK_NOT_CLOSED");
if (packet.locks?.accepted !== false) errors.push("PLANNING_ACCEPTANCE_LOCK_NOT_CLOSED");
if (packet.locks?.ruleEnabled !== false) errors.push("PLANNING_RULE_LOCK_NOT_CLOSED");
if (packet.locks?.memoryEnabled !== false) errors.push("PLANNING_MEMORY_LOCK_NOT_CLOSED");
if (packet.locks?.softwareActionsExecuted !== false) errors.push("PLANNING_SOFTWARE_EXECUTION_LOCK_NOT_CLOSED");
if (packet.locks?.externalFetchPerformed !== false) errors.push("PLANNING_EXTERNAL_FETCH_LOCK_NOT_CLOSED");
if (packet.locks?.packagingUnlocked !== false) errors.push("PLANNING_PACKAGING_LOCK_NOT_CLOSED");
if (packet.locks?.deliveryGateOpen !== false) errors.push("PLANNING_DELIVERY_GATE_LOCK_NOT_CLOSED");
if (receipt.planningId !== packet.planningId) errors.push("PLANNING_ID_MISMATCH");
if (receipt.planningHash !== planningHash) errors.push("PLANNING_HASH_MISMATCH");
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  errors.push("PRIMARY_SOURCE_PLANNING_PACKET_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (packet.planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  errors.push("PRIMARY_SOURCE_PLANNING_PACKET_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  packet.planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  errors.push("PRIMARY_SOURCE_PLANNING_PACKET_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH");
}
if (receipt.planningLogicEvidenceHash !== planningLogicEvidenceHash) {
  errors.push("PRIMARY_SOURCE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  hashText(JSON.stringify(receipt.requestContext?.planningLogicEvidence || {})) !== planningLogicEvidenceHash
) {
  errors.push("PRIMARY_SOURCE_REQUEST_CONTEXT_LOGIC_EVIDENCE_MISMATCH");
}
if (!allowedTop.has(receipt.decision)) errors.push("PRIMARY_SOURCE_TOP_LEVEL_DECISION_NOT_ALLOWED");
if (forbidden.has(receipt.decision)) errors.push("PRIMARY_SOURCE_FORBIDDEN_TOP_LEVEL_DECISION");

const rows = Array.isArray(receipt.providedSources) ? receipt.providedSources : [];
if (receipt.decision === "teacher_provided_primary_sources" && rows.length === 0) {
  errors.push("PRIMARY_SOURCE_DECISION_REQUIRES_AT_LEAST_ONE_SOURCE");
}
if (receipt.decision === "blocked" && !String(receipt.reviewerNote || "").trim()) {
  warnings.push("BLOCKED_PRIMARY_SOURCE_RECEIPT_SHOULD_INCLUDE_REVIEWER_NOTE");
}

const sourceIds = new Set();
const confirmedSources = [];
for (const row of rows) {
  const rowId = row.sourceId || row.title || "unknown";
  if (!String(row.sourceId || "").trim()) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_SOURCE_ID:${rowId}`);
  if (sourceIds.has(row.sourceId)) errors.push(`PRIMARY_SOURCE_ROW_DUPLICATE_SOURCE_ID:${row.sourceId}`);
  sourceIds.add(row.sourceId);
  if (!String(row.title || "").trim()) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_TITLE:${rowId}`);
  if (!String(row.uri || "").trim()) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_URI:${rowId}`);
  if (!String(row.sourceType || "").trim()) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_SOURCE_TYPE:${rowId}`);
  if (!String(row.domain || "").trim()) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_DOMAIN:${rowId}`);
  if (!allowedTrust.has(row.trustLevelAfterReview)) errors.push(`PRIMARY_SOURCE_ROW_TRUST_NOT_ALLOWED:${rowId}`);
  if (!allowedPermission.has(row.permissionStatus)) errors.push(`PRIMARY_SOURCE_ROW_PERMISSION_NOT_ALLOWED:${rowId}`);
  if (row.evidenceReviewed !== true) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_EVIDENCE_REVIEW:${rowId}`);
  if (row.reviewOnlyBoundaryReviewed !== true) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_REVIEW_ONLY_BOUNDARY:${rowId}`);
  if (!String(row.logicExtractionHint || "").trim()) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_LOGIC_EXTRACTION_HINT:${rowId}`);
  if (!String(row.reviewerNote || "").trim()) errors.push(`PRIMARY_SOURCE_ROW_REQUIRES_REVIEWER_NOTE:${rowId}`);
  if (!forbidden.has(row.decision || "")) confirmedSources.push(sourceCardFromRow(row));
}

const status =
  errors.length > 0
    ? "blocked"
    : receipt.decision === "teacher_provided_primary_sources"
      ? "ready_for_review_only_primary_source_registry_follow_up"
      : receipt.decision === "blocked"
        ? "blocked"
        : "waiting_for_teacher_review";

const validation = {
  format: "transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1",
  validationId: stableId("rag_primary_source_evidence_request_receipt_validation", `${planningPacketPath}:${receiptPath}`),
  createdAt: new Date().toISOString(),
  planningPacketPath,
  receiptPath,
  planningHash,
  status,
  errors,
  warnings,
  confirmedSources: status === "ready_for_review_only_primary_source_registry_follow_up" ? confirmedSources : [],
  planningLogicEvidence,
  planningLogicEvidenceHash,
  nextReview: {
    instruction:
      status === "ready_for_review_only_primary_source_registry_follow_up"
        ? "Prepare a review-only source registry follow-up from these confirmed primary sources. Do not fetch external references."
        : status === "blocked"
          ? "Fix the primary-source evidence receipt before any registry follow-up."
          : "Have the teacher provide and review at least one primary source.",
    mayPrepareSourceRegistryFollowUp: status === "ready_for_review_only_primary_source_registry_follow_up",
    mayFetchExternalSources: false,
    mayExecuteSoftware: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayOpenDeliveryGate: false,
    mayUnlockPackaging: false,
    mayClaimGoalComplete: false,
    planningLogicEvidence,
    planningLogicEvidenceHash
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    deliveryGateOpen: false
  }
};

const validationDir = join(outDir, validation.validationId);
const validationPath = join(validationDir, "rag-primary-source-evidence-request-receipt-validation.json");
writeJson(validationPath, validation);

console.log(
  JSON.stringify(
    {
      ok: status !== "blocked",
      status,
      validationPath,
      confirmedSourceCount: validation.confirmedSources.length,
      errors,
      warnings,
      locks: validation.locks
    },
    null,
    2
  )
);

if (status === "blocked") process.exit(1);
