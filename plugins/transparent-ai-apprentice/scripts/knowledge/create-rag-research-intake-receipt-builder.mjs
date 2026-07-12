#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const queuePath = resolve(arg("--queue", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-research-intake-receipt-builder")));

if (!queuePath) {
  throw new Error("Usage: node create-rag-research-intake-receipt-builder.mjs --queue <rag-research-intake-queue.json> [--out-dir <dir>]");
}

const queue = readJson(queuePath);
if (queue.format !== "transparent_ai_rag_research_intake_queue_v1") {
  throw new Error("Expected transparent_ai_rag_research_intake_queue_v1.");
}

const builderId = stableId("rag_research_intake_receipt_builder", queuePath);
const builderDir = join(outDir, builderId);
mkdirSync(builderDir, { recursive: true });

const allowedDecisions = ["needs_teacher_review", "teacher_confirms_adviser_extraction", "ready_for_source_research", "blocked"];
const forbiddenDecisions = [
  "accepted",
  "enable_rule",
  "cite_unverified_lead",
  "write_memory",
  "execute_software",
  "unlock_packaging"
];
const allowedSourceDecisions = [
  "needs_teacher_review",
  "teacher_supplied_confirmed",
  "ready_for_primary_source_research",
  "verified_public_reference",
  "blocked"
];

const receiptTemplate = {
  format: "transparent_ai_rag_research_intake_receipt_v1",
  queuePath,
  queueRunId: queue.runId,
  queueHash: hashText(JSON.stringify(queue)),
  decision: "needs_teacher_review",
  allowedDecisions,
  forbiddenDecisions,
  allowedSourceDecisions,
  sourceReviews: queue.sourceCandidates.map((candidate) => ({
    candidateId: candidate.candidate_id,
    originalTrustLevel: candidate.source_card.trust_level,
    originalUri: candidate.source_card.uri,
    sourceType: candidate.source_card.source_type,
    decision: "needs_teacher_review",
    evidenceReviewed: false,
    primarySourceUri: "",
    primarySourceTitle: "",
    primarySourceLocator: "",
    permissionStatus: candidate.source_card.permission.status,
    trustLevelAfterReview: candidate.source_card.trust_level,
    reviewerNote: ""
  })),
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    packagingGated: true,
    packagingUnlocked: false
  }
};

const builder = {
  format: "transparent_ai_rag_research_intake_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  queuePath,
  queueRunId: queue.runId,
  queueHash: receiptTemplate.queueHash,
  receiptTemplate,
  validationCommandTemplate:
    `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\validate-rag-research-intake-receipt.mjs --queue "${queuePath}" --receipt <teacher-filled-receipt.json>`,
  locks: receiptTemplate.locks,
  builderDoesNot: [
    "verify_external_research",
    "cite_unverified_leads",
    "enable_rules",
    "write_memory",
    "execute_software",
    "unlock_packaging"
  ]
};

const builderPath = join(builderDir, "rag-research-intake-receipt-builder.json");
const templatePath = join(builderDir, "rag-research-intake-receipt-template.json");
const readmePath = join(builderDir, "RAG_RESEARCH_INTAKE_RECEIPT_BUILDER_START_HERE.md");

writeJson(builderPath, builder);
writeJson(templatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# RAG Research Intake Receipt Builder",
    "",
    "This builder creates a teacher/researcher receipt template for a RAG research intake queue.",
    "",
    `- Builder: ${builderPath}`,
    `- Receipt template: ${templatePath}`,
    `- Queue: ${queuePath}`,
    "",
    "## Fill-in Rule",
    "",
    "Keep unverified research leads as `ready_for_primary_source_research` or `blocked` until a primary source URI, locator, trust level, and permission status are available.",
    "",
    "## Validation",
    "",
    builder.validationCommandTemplate,
    "",
    "The builder does not verify external research, cite leads, enable rules, write memory, execute software, or unlock packaging."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: builder.format,
      builderPath,
      templatePath,
      readmePath,
      sourceReviews: receiptTemplate.sourceReviews.length,
      locks: builder.locks
    },
    null,
    2
  )
);
