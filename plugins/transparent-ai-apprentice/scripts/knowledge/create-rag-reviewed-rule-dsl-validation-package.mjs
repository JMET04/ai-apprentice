#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadRuleCard, validateRuleCard } from "../rules/rule-dsl-core.mjs";
import { arg, hasFlag, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const reviewValidationPath = resolve(arg("--review-validation", ""));
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-reviewed-rule-dsl-validation-package"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!reviewValidationPath || !rollbackPoint) {
  throw new Error(
    "Usage: node create-rag-reviewed-rule-dsl-validation-package.mjs --review-validation <rag-confirmed-retrieval-draft-review-receipt-validation.json> --rollback-point <rollback-point-dir> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!teacherReviewed) throw new Error("RAG_REVIEWED_RULE_DSL_VALIDATION_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const reviewValidation = readJson(reviewValidationPath);
if (reviewValidation.format !== "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1") {
  throw new Error("Expected transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1.");
}

const sourceLocks = reviewValidation.locks || {};
if (
  reviewValidation.status !== "ready_for_review_only_rule_dsl_validation" ||
  sourceLocks.ruleEnabled !== false ||
  sourceLocks.memoryEnabled !== false ||
  sourceLocks.softwareActionsExecuted !== false ||
  sourceLocks.externalFetchPerformed !== false ||
  sourceLocks.packagingUnlocked !== false
) {
  throw new Error("Review validation is not a locked, teacher-reviewed handoff for review-only Rule DSL validation.");
}

const approvedDrafts = Array.isArray(reviewValidation.approvedDisabledDrafts)
  ? reviewValidation.approvedDisabledDrafts
  : [];
if (!approvedDrafts.length) throw new Error("NO_APPROVED_DISABLED_DRAFTS_FOR_RULE_DSL_VALIDATION");
for (const draft of approvedDrafts) {
  if (draft.logicExtractionHint && draft.logicFitDecision !== "matches_intended_logic") {
    throw new Error(`RULE_DSL_VALIDATION_REQUIRES_MATCHING_LOGIC_FIT:${draft.sourceId || draft.rulePath || "unknown"}`);
  }
}

const planningLogicEvidence = reviewValidation.planningLogicEvidence || null;
const planningLogicEvidenceHash = reviewValidation.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = reviewValidation.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = reviewValidation.nextReview?.planningLogicEvidenceHash || "";
const packageId = stableId("rag_reviewed_rule_dsl_validation_package", `${reviewValidationPath}:${rollbackPoint}`);
const ruleValidationRows = [];
const errors = [];

if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  errors.push("RULE_DSL_VALIDATION_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  errors.push("RULE_DSL_VALIDATION_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  errors.push("RULE_DSL_VALIDATION_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}

for (const draft of approvedDrafts) {
  const rulePath = resolve(draft.rulePath || "");
  const rowErrors = [];
  let rule = null;
  let validation = { ok: false, errors: [{ error_code: "RULE_NOT_LOADED", path: "rulePath" }] };

  if (!rulePath || !existsSync(rulePath)) {
    rowErrors.push(`RULE_DRAFT_NOT_FOUND:${draft.sourceId || rulePath}`);
  } else {
    try {
      rule = loadRuleCard(rulePath);
      validation = validateRuleCard(rule);
      if (!validation.ok) rowErrors.push(`RULE_DSL_VALIDATION_FAILED:${draft.sourceId || rulePath}`);
      if (rule.lifecycle !== "draft_disabled") rowErrors.push(`RULE_DRAFT_MUST_REMAIN_DRAFT_DISABLED:${draft.sourceId || rulePath}`);
      if (draft.ruleLifecycle !== "draft_disabled") rowErrors.push(`REVIEW_VALIDATION_ROW_NOT_DRAFT_DISABLED:${draft.sourceId || rulePath}`);
      const ruleRefs = new Set(rule.source?.evidence_refs || []);
      for (const evidenceRef of draft.evidenceRefs || []) {
        if (!ruleRefs.has(evidenceRef)) rowErrors.push(`RULE_MISSING_REVIEWED_EVIDENCE_REF:${draft.sourceId || evidenceRef}`);
      }
      if ((rule.source?.evidence_refs || []).length === 0) rowErrors.push(`RULE_REQUIRES_EVIDENCE_REFS:${draft.sourceId || rulePath}`);
    } catch (error) {
      rowErrors.push(`RULE_DRAFT_LOAD_FAILED:${draft.sourceId || rulePath}:${error.message}`);
    }
  }

  errors.push(...rowErrors);
  ruleValidationRows.push({
    sourceId: draft.sourceId || "",
    rulePath,
    ruleHash: rule ? hashText(JSON.stringify(rule)) : "",
    ruleId: rule?.rule_id || "",
    lifecycle: rule?.lifecycle || "",
    dslValidationOk: validation.ok && rowErrors.length === 0,
    dslValidationErrors: validation.errors || [],
    bridgeErrors: rowErrors,
    evidenceRefs: rule?.source?.evidence_refs || [],
    logicExtractionHint: draft.logicExtractionHint || "",
    logicFitDecision: draft.logicFitDecision || "not_applicable",
    reviewerNote: draft.reviewerNote || "",
    reviewOnly: true,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingUnlocked: false
  });
}

const status = errors.length ? "blocked" : "ready_for_teacher_rule_dsl_review_package";
const packet = {
  format: "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  reviewValidationPath,
  reviewValidationHash: hashText(JSON.stringify(reviewValidation)),
  teacherReviewed,
  rollbackPoint,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status,
  approvedDraftCount: approvedDrafts.length,
  validRuleCardCount: ruleValidationRows.filter((row) => row.dslValidationOk).length,
  blockedRuleCardCount: ruleValidationRows.filter((row) => !row.dslValidationOk).length,
  errors,
  ruleValidationRows,
  nextReview: {
    instruction:
      status === "ready_for_teacher_rule_dsl_review_package"
        ? "A teacher or reviewer can inspect these validated draft_disabled Rule Cards before any separate lifecycle change request."
        : "Fix the review validation or Rule Card drafts before any rule package review.",
    logicExtractionHints: ruleValidationRows
      .filter((row) => row.logicExtractionHint)
      .map((row) => ({ sourceId: row.sourceId, logicExtractionHint: row.logicExtractionHint, logicFitDecision: row.logicFitDecision })),
    planningLogicEvidence,
    planningLogicEvidenceHash,
    mayEnableRules: false,
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
    rulePackageCompiled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    shellCommandExecuted: false,
    packagingGated: true,
    packagingUnlocked: false
  }
};

const packageDir = join(outDir, packageId);
const packagePath = join(packageDir, "rag-reviewed-rule-dsl-validation-package.json");
writeJson(packagePath, packet);

console.log(
  JSON.stringify(
    {
      ok: status !== "blocked",
      format: packet.format,
      status,
      packagePath,
      approvedDraftCount: packet.approvedDraftCount,
      validRuleCardCount: packet.validRuleCardCount,
      blockedRuleCardCount: packet.blockedRuleCardCount,
      errors,
      locks: packet.locks
    },
    null,
    2
  )
);

if (status === "blocked") process.exit(1);
