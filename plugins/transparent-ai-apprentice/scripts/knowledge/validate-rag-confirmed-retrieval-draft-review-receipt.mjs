#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const runPath = resolve(arg("--retrieval-draft-run", ""));
const receiptPath = resolve(arg("--receipt", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-confirmed-retrieval-draft-review-receipt-validation")));

if (!runPath || !receiptPath) {
  throw new Error("Usage: node validate-rag-confirmed-retrieval-draft-review-receipt.mjs --retrieval-draft-run <rag-confirmed-retrieval-draft-run.json> --receipt <teacher-filled-receipt.json> [--out-dir <dir>]");
}

const run = readJson(runPath);
const receipt = readJson(receiptPath);
if (run.format !== "transparent_ai_rag_confirmed_retrieval_draft_run_v1") throw new Error("Expected retrieval draft run packet.");
if (receipt.format !== "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_v1") throw new Error("Expected retrieval draft review receipt.");

const runHash = hashText(JSON.stringify(run));
const planningLogicEvidence = run.planningLogicEvidence || null;
const planningLogicEvidenceHash = run.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = run.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = run.nextReview?.planningLogicEvidenceHash || "";
const allowedTop = new Set(["needs_teacher_review", "teacher_reviewed_disabled_drafts", "blocked"]);
const allowedRows = new Set(["needs_teacher_review", "approve_disabled_draft_for_rule_dsl_validation", "request_source_correction", "no_evidence_found", "blocked"]);
const forbidden = new Set([
  "accepted",
  "enable_rule",
  "write_memory",
  "execute_software",
  "fetch_external_source",
  "unlock_packaging",
  "accept_technology",
  "cite_unreviewed_evidence"
]);
const errors = [];
const warnings = [];

if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  errors.push("RETRIEVAL_REVIEW_RUN_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  errors.push("RETRIEVAL_REVIEW_RUN_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash) {
  errors.push("RETRIEVAL_REVIEW_RUN_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH");
}
if (receipt.runId !== run.runId) errors.push("RUN_ID_MISMATCH");
if (receipt.runHash !== runHash) errors.push("RUN_HASH_MISMATCH");
if ((receipt.planningLogicEvidenceHash || "") !== planningLogicEvidenceHash) {
  errors.push("RETRIEVAL_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (hashText(JSON.stringify(receipt.planningLogicEvidence || null)) !== hashText(JSON.stringify(planningLogicEvidence))) {
  errors.push("RETRIEVAL_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
if (!allowedTop.has(receipt.decision)) errors.push("TOP_LEVEL_DECISION_NOT_ALLOWED");
if (forbidden.has(receipt.decision)) errors.push("FORBIDDEN_TOP_LEVEL_DECISION");

const runRows = new Map((run.retrievals || []).map((row) => [row.sourceId, row]));
const receiptRows = Array.isArray(receipt.retrievalReviews) ? receipt.retrievalReviews : [];
if (receiptRows.length !== runRows.size) errors.push("RETRIEVAL_REVIEW_ROW_COUNT_MISMATCH");

const approvedDisabledDrafts = [];
let forbiddenDecisionUsed = false;
for (const row of receiptRows) {
  const runRow = runRows.get(row.sourceId);
  if (!runRow) {
    errors.push(`UNKNOWN_SOURCE_ROW:${row.sourceId}`);
    continue;
  }
  if (!allowedRows.has(row.decision)) errors.push(`ROW_DECISION_NOT_ALLOWED:${row.sourceId}`);
  if (forbidden.has(row.decision)) {
    errors.push(`FORBIDDEN_ROW_DECISION:${row.sourceId}`);
    forbiddenDecisionUsed = true;
  }
  if (row.retrievalPath !== runRow.retrievalPath) errors.push(`RETRIEVAL_PATH_MISMATCH:${row.sourceId}`);
  if (row.rulePath !== (runRow.ruleDraft?.rulePath || "")) errors.push(`RULE_PATH_MISMATCH:${row.sourceId}`);
  if ((row.logicExtractionHint || "") !== (runRow.logicExtractionHint || "")) errors.push(`LOGIC_EXTRACTION_HINT_MISMATCH:${row.sourceId}`);

  if (row.decision === "approve_disabled_draft_for_rule_dsl_validation") {
    if (runRow.retrievalStatus !== "evidence_found") errors.push(`APPROVED_ROW_REQUIRES_EVIDENCE_FOUND:${row.sourceId}`);
    if (!runRow.ruleDraft?.rulePath || !existsSync(runRow.ruleDraft.rulePath)) errors.push(`APPROVED_ROW_REQUIRES_EXISTING_RULE_DRAFT:${row.sourceId}`);
    if (runRow.ruleDraft?.lifecycle !== "draft_disabled") errors.push(`APPROVED_ROW_REQUIRES_DRAFT_DISABLED:${row.sourceId}`);
    if (row.evidenceReviewed !== true) errors.push(`APPROVED_ROW_REQUIRES_EVIDENCE_REVIEW:${row.sourceId}`);
    if (row.ruleDraftReviewed !== true) errors.push(`APPROVED_ROW_REQUIRES_RULE_DRAFT_REVIEW:${row.sourceId}`);
    if (runRow.logicExtractionHint) {
      if (row.logicExtractionHintReviewed !== true) errors.push(`APPROVED_ROW_REQUIRES_LOGIC_EXTRACTION_HINT_REVIEW:${row.sourceId}`);
      if (row.logicFitDecision !== "matches_intended_logic") errors.push(`APPROVED_ROW_REQUIRES_MATCHING_LOGIC_FIT:${row.sourceId}`);
    }
    if (!String(row.reviewerNote || "").trim()) errors.push(`APPROVED_ROW_REQUIRES_REVIEWER_NOTE:${row.sourceId}`);
    if (!Array.isArray(row.evidenceRefs) || row.evidenceRefs.length === 0) errors.push(`APPROVED_ROW_REQUIRES_EVIDENCE_REFS:${row.sourceId}`);
    approvedDisabledDrafts.push({
      sourceId: row.sourceId,
      retrievalPath: runRow.retrievalPath,
      rulePath: runRow.ruleDraft?.rulePath || "",
      ruleLifecycle: runRow.ruleDraft?.lifecycle || "",
      logicExtractionHint: runRow.logicExtractionHint || "",
      logicFitDecision: row.logicFitDecision || "not_applicable",
      evidenceRefs: runRow.ruleDraft?.evidenceRefs || [],
      reviewerNote: row.reviewerNote
    });
  }
  if (row.decision === "no_evidence_found" && runRow.retrievalStatus === "evidence_found") {
    warnings.push(`ROW_MARKED_NO_EVIDENCE_BUT_EVIDENCE_EXISTS:${row.sourceId}`);
  }
}

if (receipt.decision === "teacher_reviewed_disabled_drafts" && !approvedDisabledDrafts.length) {
  errors.push("TOP_LEVEL_REVIEWED_DECISION_REQUIRES_APPROVED_DISABLED_DRAFT");
}
if (receipt.decision === "needs_teacher_review" && approvedDisabledDrafts.length) {
  errors.push("APPROVED_ROWS_REQUIRE_REVIEWED_TOP_LEVEL_DECISION");
}

const status =
  errors.length > 0 || forbiddenDecisionUsed
    ? "blocked"
    : approvedDisabledDrafts.length > 0
      ? "ready_for_review_only_rule_dsl_validation"
      : "waiting_for_teacher_review";

const validation = {
  format: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
  validationId: stableId("rag_confirmed_retrieval_draft_review_receipt_validation", `${runPath}:${receiptPath}`),
  createdAt: new Date().toISOString(),
  runPath,
  receiptPath,
  runHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status,
  errors,
  warnings,
  approvedDisabledDrafts,
  nextReview: {
    instruction:
      status === "ready_for_review_only_rule_dsl_validation"
        ? "Review the approved disabled Rule Card drafts with the Rule DSL validation layer before any lifecycle or memory change."
        : status === "blocked"
          ? "Fix the review receipt before using any retrieved evidence or rule draft."
          : "Have the teacher review retrieval chunks and disabled Rule Card drafts.",
    mayEnableRules: false,
    logicExtractionHints: approvedDisabledDrafts
      .filter((row) => row.logicExtractionHint)
      .map((row) => ({ sourceId: row.sourceId, logicExtractionHint: row.logicExtractionHint, logicFitDecision: row.logicFitDecision })),
    planningLogicEvidence,
    planningLogicEvidenceHash,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
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
const validationPath = join(validationDir, "rag-confirmed-retrieval-draft-review-receipt-validation.json");
writeJson(validationPath, validation);
console.log(
  JSON.stringify(
    {
      ok: status !== "blocked",
      status,
      validationPath,
      approvedDisabledDrafts: approvedDisabledDrafts.length,
      errors,
      warnings,
      locks: validation.locks
    },
    null,
    2
  )
);
if (status === "blocked") process.exit(1);
