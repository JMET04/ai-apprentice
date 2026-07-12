#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const queuePath = resolve(arg("--follow-up-queue", arg("--queue", "")));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-follow-up-queue-selection-receipt-builder"))
);

if (!queuePath) {
  throw new Error(
    "Usage: node create-rag-follow-up-queue-selection-receipt-builder.mjs --follow-up-queue <rag-audit-review-follow-up-queue.json> [--out-dir <dir>]"
  );
}

const queue = readJson(queuePath);
if (queue.format !== "transparent_ai_rag_audit_review_follow_up_queue_v1") {
  throw new Error("Expected transparent_ai_rag_audit_review_follow_up_queue_v1.");
}
if (
  queue.status !== "waiting_for_teacher_reviewed_follow_up_selection" ||
  queue.queueDecision !== "manual_review_only_follow_up_queue_ready" ||
  queue.locks?.reviewOnly !== true ||
  queue.locks?.accepted !== false ||
  queue.locks?.ruleEnabled !== false ||
  queue.locks?.memoryEnabled !== false ||
  queue.locks?.softwareActionsExecuted !== false ||
  queue.locks?.externalFetchPerformed !== false ||
  queue.locks?.packagingUnlocked !== false ||
  queue.locks?.deliveryGateOpen !== false ||
  queue.locks?.queueDoesNotRunCommands !== true ||
  queue.locks?.queueDoesNotOpenFiles !== true ||
  queue.locks?.queueDoesNotFetchSources !== true ||
  queue.locks?.queueDoesNotClaimCompletion !== true
) {
  throw new Error("Follow-up queue is not a locked review-only queue.");
}

const queueHash = hashText(JSON.stringify(queue));
const builderId = stableId("rag_follow_up_queue_selection_receipt_builder", queuePath);
const builderDir = join(outDir, builderId);
mkdirSync(builderDir, { recursive: true });
const logicExtractionHints = Array.isArray(queue.logicExtractionHints) ? queue.logicExtractionHints : [];
const planningLogicEvidence = queue.planningLogicEvidence || null;
const planningLogicEvidenceHash = queue.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = queue.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = queue.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("FOLLOW_UP_SELECTION_BUILDER_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("FOLLOW_UP_SELECTION_BUILDER_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("FOLLOW_UP_SELECTION_BUILDER_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}

const receiptTemplate = {
  format: "transparent_ai_rag_follow_up_queue_selection_receipt_v1",
  queueId: queue.queueId,
  queuePath,
  queueHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  decision: "needs_teacher_review",
  allowedTopLevelDecisions: ["needs_teacher_review", "teacher_selected_review_only_follow_up", "blocked"],
  forbiddenDecisions: [
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
  ],
  itemReviews: (queue.queueItems || []).map((item) => ({
    itemId: item.itemId,
    order: item.order,
    kind: item.kind,
    sourceHash: item.sourceHash,
    queueStatus: item.status,
    decision: "needs_teacher_review",
    allowedDecisions: ["needs_teacher_review", "select_review_only_follow_up", "request_more_detail", "blocked"],
    selectedFollowUpDecision: "needs_teacher_review",
    allowedFollowUpDecisions: item.allowedNextDecisions || [],
    itemReviewed: false,
    noActionBoundaryReviewed: false,
    rollbackStillRetained: item.itemId === "confirm_rollback_retained" ? false : null,
    logicEvidenceReviewed: item.itemId === "review_primary_source_logic_evidence" ? false : null,
    logicFitDecisionConfirmed: item.itemId === "review_primary_source_logic_evidence" ? false : null,
    logicEvidenceDecision:
      item.itemId === "review_primary_source_logic_evidence" ? "needs_teacher_review" : null,
    allowedLogicEvidenceDecisions:
      item.itemId === "review_primary_source_logic_evidence"
        ? ["needs_teacher_review", "logic_evidence_confirmed", "request_logic_recheck", "request_more_primary_sources", "blocked"]
        : [],
    logicExtractionHints: item.itemId === "review_primary_source_logic_evidence" ? logicExtractionHints : [],
    reviewerNote: ""
  })),
  logicExtractionHints,
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

const builderPacket = {
  format: "transparent_ai_rag_follow_up_queue_selection_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  queuePath,
  queueHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  receiptTemplatePath: join(builderDir, "rag-follow-up-queue-selection-receipt-template.json"),
  validationCommand: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\validate-rag-follow-up-queue-selection-receipt.mjs --follow-up-queue "${queuePath}" --receipt <teacher-filled-receipt.json>`,
  locks: receiptTemplate.locks
};

writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeJson(join(builderDir, "rag-follow-up-queue-selection-receipt-builder.json"), builderPacket);

const readmePath = join(builderDir, "RAG_FOLLOW_UP_QUEUE_SELECTION_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Follow-Up Queue Selection",
    "",
    "Fill this receipt after choosing exactly one review-only follow-up lane from the queue.",
    "",
    `- Follow-up queue: ${queuePath}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "Allowed selections can only prepare a downstream review-only planning packet. They cannot execute commands, open files, fetch sources, enable rules, write memory, open the delivery gate, unlock packaging, accept technology, or claim completion."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: builderPacket.format,
      builderPath: join(builderDir, "rag-follow-up-queue-selection-receipt-builder.json"),
      templatePath: builderPacket.receiptTemplatePath,
      readmePath,
      itemReviewRows: receiptTemplate.itemReviews.length,
      locks: builderPacket.locks
    },
    null,
    2
  )
);
