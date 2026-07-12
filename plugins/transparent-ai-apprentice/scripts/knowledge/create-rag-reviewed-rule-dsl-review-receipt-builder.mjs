#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const packagePath = resolve(arg("--rule-dsl-validation-package", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-reviewed-rule-dsl-review-receipt-builder"))
);

if (!packagePath) {
  throw new Error(
    "Usage: node create-rag-reviewed-rule-dsl-review-receipt-builder.mjs --rule-dsl-validation-package <rag-reviewed-rule-dsl-validation-package.json> [--out-dir <dir>]"
  );
}

const packet = readJson(packagePath);
if (packet.format !== "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1") {
  throw new Error("Expected transparent_ai_rag_reviewed_rule_dsl_validation_package_v1.");
}
if (
  packet.status !== "ready_for_teacher_rule_dsl_review_package" ||
  packet.locks?.ruleEnabled !== false ||
  packet.locks?.memoryEnabled !== false ||
  packet.locks?.softwareActionsExecuted !== false ||
  packet.locks?.externalFetchPerformed !== false ||
  packet.locks?.packagingUnlocked !== false
) {
  throw new Error("Rule DSL validation package is not a locked review-only package.");
}

const packageHash = hashText(JSON.stringify(packet));
const planningLogicEvidence = packet.planningLogicEvidence || null;
const planningLogicEvidenceHash = packet.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = packet.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = packet.nextReview?.planningLogicEvidenceHash || "";

if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash) {
  throw new Error("RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}

const builderId = stableId("rag_reviewed_rule_dsl_review_receipt_builder", packagePath);
const builderDir = join(outDir, builderId);
mkdirSync(builderDir, { recursive: true });

const receiptTemplate = {
  format: "transparent_ai_rag_reviewed_rule_dsl_review_receipt_v1",
  packageId: packet.packageId,
  packagePath,
  packageHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  decision: "needs_teacher_review",
  allowedTopLevelDecisions: ["needs_teacher_review", "teacher_reviewed_rule_dsl_validation_package", "blocked"],
  forbiddenDecisions: [
    "accepted",
    "enable_rule",
    "activate_rule",
    "write_memory",
    "execute_software",
    "fetch_external_source",
    "compile_active_rule_package",
    "unlock_packaging",
    "accept_technology"
  ],
  ruleDslReviews: (packet.ruleValidationRows || []).map((row) => ({
    sourceId: row.sourceId,
    rulePath: row.rulePath,
    ruleHash: row.ruleHash,
    ruleId: row.ruleId,
    lifecycle: row.lifecycle,
    dslValidationOk: row.dslValidationOk,
    evidenceRefs: row.evidenceRefs || [],
    logicExtractionHint: row.logicExtractionHint || "",
    logicFitDecision: row.logicFitDecision || "not_applicable",
    logicExtractionHintReviewed: false,
    logicFitDecisionReviewed: false,
    decision: row.dslValidationOk ? "needs_teacher_review" : "blocked",
    allowedDecisions: row.dslValidationOk
      ? ["needs_teacher_review", "approve_disabled_rule_for_package_planning", "request_rule_rewrite", "blocked"]
      : ["request_rule_rewrite", "blocked"],
    evidenceReviewed: false,
    ruleReviewed: false,
    dslValidationReviewed: false,
    reviewerNote: ""
  })),
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    rulePackageCompiled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false
  }
};

const builderPacket = {
  format: "transparent_ai_rag_reviewed_rule_dsl_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  packagePath,
  packageHash,
  receiptTemplatePath: join(builderDir, "rag-reviewed-rule-dsl-review-receipt-template.json"),
  validationCommand: `node plugins\\transparent-ai-apprentice\\scripts\\knowledge\\validate-rag-reviewed-rule-dsl-review-receipt.mjs --rule-dsl-validation-package "${packagePath}" --receipt <teacher-filled-receipt.json>`,
  locks: receiptTemplate.locks
};

writeJson(builderPacket.receiptTemplatePath, receiptTemplate);
writeJson(join(builderDir, "rag-reviewed-rule-dsl-review-receipt-builder.json"), builderPacket);

const readmePath = join(builderDir, "RAG_REVIEWED_RULE_DSL_REVIEW_START_HERE.md");
writeFileSync(
  readmePath,
  [
    "# RAG Reviewed Rule DSL Review",
    "",
    "Fill this receipt after reviewing every disabled Rule Card, its evidence refs, and its Rule DSL validation result.",
    "",
    `- Rule DSL validation package: ${packagePath}`,
    `- Receipt template: ${builderPacket.receiptTemplatePath}`,
    "",
    "Allowed row decisions do not enable rules, write memory, execute software, fetch sources, compile active packages, or unlock packaging. They only mark disabled rules as ready for the next review-only disabled package planning step, request a rewrite, or block."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: builderPacket.format,
      builderPath: join(builderDir, "rag-reviewed-rule-dsl-review-receipt-builder.json"),
      templatePath: builderPacket.receiptTemplatePath,
      readmePath,
      reviewRows: receiptTemplate.ruleDslReviews.length,
      locks: builderPacket.locks
    },
    null,
    2
  )
);
