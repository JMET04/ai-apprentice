#!/usr/bin/env node
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const queuePath = resolve(arg("--queue", ""));
const receiptPath = resolve(arg("--receipt", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-research-intake-receipt-validation")));

if (!queuePath || !receiptPath) {
  throw new Error("Usage: node validate-rag-research-intake-receipt.mjs --queue <queue.json> --receipt <receipt.json> [--out-dir <dir>]");
}

const queue = readJson(queuePath);
const receipt = readJson(receiptPath);
if (queue.format !== "transparent_ai_rag_research_intake_queue_v1") throw new Error("Expected RAG research intake queue.");
if (receipt.format !== "transparent_ai_rag_research_intake_receipt_v1") throw new Error("Expected RAG research intake receipt.");

const allowedDecisions = new Set(["needs_teacher_review", "teacher_confirms_adviser_extraction", "ready_for_source_research", "blocked"]);
const forbiddenDecisions = new Set(["accepted", "enable_rule", "cite_unverified_lead", "write_memory", "execute_software", "unlock_packaging"]);
const allowedSourceDecisions = new Set([
  "needs_teacher_review",
  "teacher_supplied_confirmed",
  "ready_for_primary_source_research",
  "verified_public_reference",
  "blocked"
]);

const queueHash = hashText(JSON.stringify(queue));
const candidateById = new Map(queue.sourceCandidates.map((candidate) => [candidate.candidate_id, candidate]));
const errors = [];
const validationRows = [];
const confirmedSources = [];

if (receipt.queueRunId !== queue.runId) errors.push("QUEUE_RUN_ID_MISMATCH");
if (receipt.queueHash !== queueHash) errors.push("QUEUE_HASH_MISMATCH");
if (!allowedDecisions.has(receipt.decision)) errors.push("TOP_LEVEL_DECISION_NOT_ALLOWED");
if (forbiddenDecisions.has(receipt.decision)) errors.push("FORBIDDEN_TOP_LEVEL_DECISION");

for (const row of receipt.sourceReviews || []) {
  const candidate = candidateById.get(row.candidateId);
  const rowErrors = [];
  if (!candidate) rowErrors.push("UNKNOWN_CANDIDATE");
  if (!allowedSourceDecisions.has(row.decision)) rowErrors.push("SOURCE_DECISION_NOT_ALLOWED");
  if (forbiddenDecisions.has(row.decision)) rowErrors.push("FORBIDDEN_SOURCE_DECISION");
  if (row.decision === "teacher_supplied_confirmed") {
    if (candidate?.source_card.trust_level !== "teacher_supplied") rowErrors.push("ONLY_TEACHER_SUPPLIED_CAN_BE_CONFIRMED_WITHOUT_PRIMARY_SOURCE");
    if (row.evidenceReviewed !== true) rowErrors.push("TEACHER_SUPPLIED_CONFIRMATION_REQUIRES_EVIDENCE_REVIEW");
  }
  if (row.decision === "verified_public_reference") {
    if (row.evidenceReviewed !== true) rowErrors.push("VERIFIED_REFERENCE_REQUIRES_EVIDENCE_REVIEW");
    if (!String(row.primarySourceUri || "").match(/^(https?:\/\/|file:|[A-Za-z]:\\|\/)/)) {
      rowErrors.push("VERIFIED_REFERENCE_REQUIRES_PRIMARY_SOURCE_URI");
    }
    if (!String(row.primarySourceTitle || "").trim()) rowErrors.push("VERIFIED_REFERENCE_REQUIRES_TITLE");
    if (!String(row.primarySourceLocator || "").trim()) rowErrors.push("VERIFIED_REFERENCE_REQUIRES_LOCATOR");
    if (!["public_reference", "teacher_supplied", "internal_review_only"].includes(row.permissionStatus)) {
      rowErrors.push("VERIFIED_REFERENCE_REQUIRES_PERMISSION_STATUS");
    }
    if (!["authoritative", "reference", "teacher_supplied"].includes(row.trustLevelAfterReview)) {
      rowErrors.push("VERIFIED_REFERENCE_REQUIRES_TRUST_LEVEL");
    }
  }
  if (row.decision === "ready_for_primary_source_research" && row.evidenceReviewed === true) {
    rowErrors.push("READY_FOR_RESEARCH_SHOULD_NOT_PRETEND_EVIDENCE_REVIEWED");
  }

  const canPromote =
    rowErrors.length === 0 &&
    (row.decision === "teacher_supplied_confirmed" || row.decision === "verified_public_reference");
  if (canPromote && candidate) {
    const sourceCard = structuredClone(candidate.source_card);
    sourceCard.trust_level = row.trustLevelAfterReview || sourceCard.trust_level;
    sourceCard.uri = row.primarySourceUri || sourceCard.uri;
    sourceCard.title = row.primarySourceTitle || sourceCard.title;
    sourceCard.permission.status = row.permissionStatus || sourceCard.permission.status;
    sourceCard.permission.note = row.reviewerNote || sourceCard.permission.note;
    sourceCard.review = {
      accepted: false,
      review_only: true,
      packaging_gated: true,
      reviewer_id: "teacher.or.researcher.review",
      reviewed_at: new Date().toISOString()
    };
    sourceCard.hashes = {
      ...sourceCard.hashes,
      review_hash: hashText(JSON.stringify(row))
    };
    confirmedSources.push(sourceCard);
  }

  validationRows.push({
    candidateId: row.candidateId,
    decision: row.decision,
    status: rowErrors.length ? "blocked" : canPromote ? "ready_as_review_only_source_card" : "waiting_for_follow_up",
    canPromote,
    errors: rowErrors
  });
  errors.push(...rowErrors.map((error) => `${row.candidateId}:${error}`));
}

const forbiddenDecisionUsed =
  forbiddenDecisions.has(receipt.decision) ||
  (receipt.sourceReviews || []).some((row) => forbiddenDecisions.has(row.decision));
const status = errors.length
  ? "blocked"
  : confirmedSources.length
    ? "ready_for_review_only_confirmed_source_ingest"
    : "waiting_for_teacher_review";

const validation = {
  format: "transparent_ai_rag_research_intake_receipt_validation_v1",
  validationId: stableId("rag_research_intake_receipt_validation", `${queuePath}:${receiptPath}`),
  createdAt: new Date().toISOString(),
  queuePath,
  receiptPath,
  status,
  forbiddenDecisionUsed,
  errors,
  validationRows,
  confirmedSources,
  nextReview: {
    action:
      status === "ready_for_review_only_confirmed_source_ingest"
        ? "Ingest confirmed source cards into a review-only local corpus; keep rules disabled."
        : status === "blocked"
          ? "Fix the receipt before using any research source."
          : "Keep reviewing the adviser extraction and primary-source leads.",
    mayEnableRules: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayWriteMemory: false,
    mayUnlockPackaging: false
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
    packagingUnlocked: false
  }
};

const validationDir = join(outDir, validation.validationId);
const validationPath = join(validationDir, "rag-research-intake-receipt-validation.json");
writeJson(validationPath, validation);

console.log(JSON.stringify({ ok: status !== "blocked", validationPath, status, confirmedSources: confirmedSources.length, errors }, null, 2));

if (status === "blocked" || forbiddenDecisionUsed) process.exit(1);
