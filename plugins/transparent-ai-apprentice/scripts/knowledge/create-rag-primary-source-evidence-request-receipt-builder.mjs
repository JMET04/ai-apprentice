#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const planningPacketPath = resolve(arg("--planning-packet", arg("--packet", "")));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-primary-source-evidence-request-receipt-builder"))
);

if (!planningPacketPath) {
  throw new Error(
    "Usage: node create-rag-primary-source-evidence-request-receipt-builder.mjs --planning-packet <rag-selected-follow-up-planning-packet.json> [--out-dir <dir>]"
  );
}

const packet = readJson(planningPacketPath);
if (packet.format !== "transparent_ai_rag_selected_follow_up_planning_packet_v1") {
  throw new Error("Expected transparent_ai_rag_selected_follow_up_planning_packet_v1.");
}
if (
  packet.status !== "selected_follow_up_planning_ready_for_teacher_review" ||
  packet.selectedFollowUpDecision !== "request_more_primary_sources" ||
  packet.locks?.reviewOnly !== true ||
  packet.locks?.accepted !== false ||
  packet.locks?.ruleEnabled !== false ||
  packet.locks?.memoryEnabled !== false ||
  packet.locks?.softwareActionsExecuted !== false ||
  packet.locks?.externalFetchPerformed !== false ||
  packet.locks?.packagingUnlocked !== false ||
  packet.locks?.deliveryGateOpen !== false ||
  packet.locks?.rollbackRetained !== true
) {
  throw new Error("RAG_PRIMARY_SOURCE_EVIDENCE_RECEIPT_REQUIRES_LOCKED_PRIMARY_SOURCE_PLANNING_PACKET");
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
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (packet.planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  packet.planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH");
}
const builderId = stableId("rag_primary_source_evidence_request_receipt_builder", `${planningPacketPath}:${planningHash}`);
const builderDir = join(outDir, builderId);
mkdirSync(builderDir, { recursive: true });

const receiptTemplate = {
  format: "transparent_ai_rag_primary_source_evidence_request_receipt_v1",
  planningId: packet.planningId,
  planningPacketPath,
  planningHash,
  planningLogicEvidenceHash,
  decision: "needs_teacher_review",
  allowedTopLevelDecisions: ["needs_teacher_review", "teacher_provided_primary_sources", "blocked"],
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
  requestContext: {
    selectedFollowUpDecision: packet.selectedFollowUpDecision,
    selectedFollowUp: packet.selectedFollowUp,
    planningLogicEvidence,
    planningLogicEvidenceHash,
    plannedItems: packet.plannedItems.map((item) => ({
      itemId: item.itemId,
      kind: item.kind,
      instruction: item.instruction,
      expectedTeacherInput: item.expectedTeacherInput,
      executesNow: false
    }))
  },
  providedSources: [
    {
      sourceId: "",
      title: "",
      uri: "",
      sourceType: "manual",
      domain: "generic",
      trustLevelAfterReview: "teacher_supplied",
      permissionStatus: "teacher_supplied",
      evidenceReviewed: false,
      reviewOnlyBoundaryReviewed: false,
      logicExtractionHint: "",
      reviewerNote: ""
    }
  ],
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

const templatePath = join(builderDir, "rag-primary-source-evidence-request-receipt-template.json");
const builderPath = join(builderDir, "rag-primary-source-evidence-request-receipt-builder.json");
const builderPacket = {
  format: "transparent_ai_rag_primary_source_evidence_request_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  planningPacketPath,
  planningHash,
  templatePath,
  validationCommand: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\validate-rag-primary-source-evidence-request-receipt.mjs --planning-packet "${planningPacketPath}" --receipt <teacher-filled-receipt.json>`,
  locks: receiptTemplate.locks
};

writeJson(templatePath, receiptTemplate);
writeJson(builderPath, builderPacket);

const readmePath = join(builderDir, "RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Primary Source Evidence Request",
    "",
    "Fill this receipt only after the teacher provides primary-source evidence for the selected RAG follow-up.",
    "",
    `- Planning packet: ${planningPacketPath}`,
    `- Receipt template: ${templatePath}`,
    "",
    "The teacher can register local files or external references, but this builder does not fetch, execute, enable rules, write memory, accept technology, open delivery gates, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: builderPacket.format,
      builderPath,
      templatePath,
      readmePath,
      locks: builderPacket.locks
    },
    null,
    2
  )
);
