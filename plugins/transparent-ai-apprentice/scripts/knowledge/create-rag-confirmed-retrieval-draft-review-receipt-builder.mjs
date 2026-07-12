#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const runPath = resolve(arg("--retrieval-draft-run", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-confirmed-retrieval-draft-review-receipt-builder")));

if (!runPath) {
  throw new Error("Usage: node create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs --retrieval-draft-run <rag-confirmed-retrieval-draft-run.json> [--out-dir <dir>]");
}

const run = readJson(runPath);
if (run.format !== "transparent_ai_rag_confirmed_retrieval_draft_run_v1") {
  throw new Error("Expected transparent_ai_rag_confirmed_retrieval_draft_run_v1.");
}
if (run.locks?.ruleEnabled !== false || run.locks?.memoryEnabled !== false || run.locks?.externalFetchPerformed !== false) {
  throw new Error("Retrieval draft run is missing closed review-only locks.");
}

const runHash = hashText(JSON.stringify(run));
const planningLogicEvidence = run.planningLogicEvidence || null;
const planningLogicEvidenceHash = run.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = run.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = run.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash) {
  throw new Error("RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH");
}
const builderId = stableId("rag_confirmed_retrieval_draft_review_receipt_builder", runPath);
const builderDir = join(outDir, builderId);
mkdirSync(builderDir, { recursive: true });

const receiptTemplate = {
  format: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_v1",
  runId: run.runId,
  runPath,
  runHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  decision: "needs_teacher_review",
  allowedTopLevelDecisions: ["needs_teacher_review", "teacher_reviewed_disabled_drafts", "blocked"],
  forbiddenDecisions: [
    "accepted",
    "enable_rule",
    "write_memory",
    "execute_software",
    "fetch_external_source",
    "unlock_packaging",
    "accept_technology",
    "cite_unreviewed_evidence"
  ],
  retrievalReviews: (run.retrievals || []).map((row) => ({
    sourceId: row.sourceId,
    retrievalPath: row.retrievalPath,
    retrievalStatus: row.retrievalStatus,
    chunkCount: row.chunkCount,
    logicExtractionHint: row.logicExtractionHint || "",
    logicExtractionHintReviewed: false,
    logicFitDecision: row.logicExtractionHint ? "needs_teacher_review" : "not_applicable",
    allowedLogicFitDecisions: row.logicExtractionHint
      ? ["needs_teacher_review", "matches_intended_logic", "needs_source_or_rule_correction", "blocked"]
      : ["not_applicable"],
    rulePath: row.ruleDraft?.rulePath || "",
    ruleLifecycle: row.ruleDraft?.lifecycle || "",
    evidenceRefs: row.ruleDraft?.evidenceRefs || [],
    decision: row.ruleDraft ? "needs_teacher_review" : "no_evidence_found",
    allowedDecisions: row.ruleDraft
      ? ["needs_teacher_review", "approve_disabled_draft_for_rule_dsl_validation", "request_source_correction", "blocked"]
      : ["no_evidence_found", "request_source_correction", "blocked"],
    evidenceReviewed: false,
    ruleDraftReviewed: false,
    reviewerNote: ""
  })),
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

const builderPacket = {
  format: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  runPath,
  runHash,
  receiptTemplatePath: join(builderDir, "rag-confirmed-retrieval-draft-review-receipt-template.json"),
  validationCommand: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\validate-rag-confirmed-retrieval-draft-review-receipt.mjs --retrieval-draft-run "${runPath}" --receipt <teacher-filled-receipt.json>`,
  locks: receiptTemplate.locks
};

writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeJson(join(builderDir, "rag-confirmed-retrieval-draft-review-receipt-builder.json"), builderPacket);

const readmePath = join(builderDir, "RAG_CONFIRMED_RETRIEVAL_DRAFT_REVIEW_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Confirmed Retrieval Draft Review",
    "",
    "Fill the receipt template after reviewing every retrieved chunk and every disabled Rule Card draft.",
    "",
    `- Retrieval draft run: ${runPath}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "Allowed row decisions do not enable rules or write memory. They only mark a disabled draft as ready for the next review-only validation step, ask for source correction, or block."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: builderPacket.format,
      builderPath: join(builderDir, "rag-confirmed-retrieval-draft-review-receipt-builder.json"),
      templatePath: builderPacket.receiptTemplatePath,
      readmePath,
      reviewRows: receiptTemplate.retrievalReviews.length,
      locks: builderPacket.locks
    },
    null,
    2
  )
);
