#!/usr/bin/env node
import { join, resolve } from "node:path";
import { arg, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const packagePath = resolve(arg("--rule-dsl-validation-package", ""));
const receiptPath = resolve(arg("--receipt", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-reviewed-rule-dsl-review-receipt-validation"))
);

if (!packagePath || !receiptPath) {
  throw new Error(
    "Usage: node validate-rag-reviewed-rule-dsl-review-receipt.mjs --rule-dsl-validation-package <rag-reviewed-rule-dsl-validation-package.json> --receipt <teacher-filled-receipt.json> [--out-dir <dir>]"
  );
}

const packet = readJson(packagePath);
const receipt = readJson(receiptPath);
if (packet.format !== "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1") {
  throw new Error("Expected transparent_ai_rag_reviewed_rule_dsl_validation_package_v1.");
}
if (receipt.format !== "transparent_ai_rag_reviewed_rule_dsl_review_receipt_v1") {
  throw new Error("Expected transparent_ai_rag_reviewed_rule_dsl_review_receipt_v1.");
}

const packageHash = hashText(JSON.stringify(packet));
const planningLogicEvidence = packet.planningLogicEvidence || null;
const planningLogicEvidenceHash = packet.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = packet.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = packet.nextReview?.planningLogicEvidenceHash || "";
const allowedTop = new Set(["needs_teacher_review", "teacher_reviewed_rule_dsl_validation_package", "blocked"]);
const allowedRows = new Set([
  "needs_teacher_review",
  "approve_disabled_rule_for_package_planning",
  "request_rule_rewrite",
  "blocked"
]);
const forbidden = new Set([
  "accepted",
  "enable_rule",
  "activate_rule",
  "write_memory",
  "execute_software",
  "fetch_external_source",
  "compile_active_rule_package",
  "unlock_packaging",
  "accept_technology"
]);
const errors = [];
const warnings = [];

if (packet.status !== "ready_for_teacher_rule_dsl_review_package") errors.push("PACKAGE_STATUS_NOT_READY_FOR_TEACHER_RULE_DSL_REVIEW");
if (packet.locks?.ruleEnabled !== false) errors.push("PACKAGE_RULE_LOCK_NOT_CLOSED");
if (packet.locks?.memoryEnabled !== false) errors.push("PACKAGE_MEMORY_LOCK_NOT_CLOSED");
if (packet.locks?.softwareActionsExecuted !== false) errors.push("PACKAGE_SOFTWARE_EXECUTION_LOCK_NOT_CLOSED");
if (packet.locks?.externalFetchPerformed !== false) errors.push("PACKAGE_EXTERNAL_FETCH_LOCK_NOT_CLOSED");
if (packet.locks?.packagingUnlocked !== false) errors.push("PACKAGE_PACKAGING_LOCK_NOT_CLOSED");
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  errors.push("RULE_DSL_REVIEW_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  errors.push("RULE_DSL_REVIEW_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash) {
  errors.push("RULE_DSL_REVIEW_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}

if (receipt.packageId !== packet.packageId) errors.push("PACKAGE_ID_MISMATCH");
if (receipt.packageHash !== packageHash) errors.push("PACKAGE_HASH_MISMATCH");
if ((receipt.planningLogicEvidenceHash || "") !== planningLogicEvidenceHash) {
  errors.push("RULE_DSL_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (hashText(JSON.stringify(receipt.planningLogicEvidence || null)) !== hashText(JSON.stringify(planningLogicEvidence))) {
  errors.push("RULE_DSL_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
if (!allowedTop.has(receipt.decision)) errors.push("TOP_LEVEL_DECISION_NOT_ALLOWED");
if (forbidden.has(receipt.decision)) errors.push("FORBIDDEN_TOP_LEVEL_DECISION");

const packetRows = new Map((packet.ruleValidationRows || []).map((row) => [row.rulePath, row]));
const receiptRows = Array.isArray(receipt.ruleDslReviews) ? receipt.ruleDslReviews : [];
if (receiptRows.length !== packetRows.size) errors.push("RULE_DSL_REVIEW_ROW_COUNT_MISMATCH");

const reviewedDisabledRules = [];
let forbiddenDecisionUsed = false;
for (const row of receiptRows) {
  const packetRow = packetRows.get(row.rulePath);
  if (!packetRow) {
    errors.push(`UNKNOWN_RULE_REVIEW_ROW:${row.rulePath || row.ruleId || row.sourceId}`);
    continue;
  }
  if (!allowedRows.has(row.decision)) errors.push(`ROW_DECISION_NOT_ALLOWED:${row.rulePath}`);
  if (forbidden.has(row.decision)) {
    errors.push(`FORBIDDEN_ROW_DECISION:${row.rulePath}`);
    forbiddenDecisionUsed = true;
  }
  if (row.ruleHash !== packetRow.ruleHash) errors.push(`RULE_HASH_MISMATCH:${row.rulePath}`);
  if (row.lifecycle !== packetRow.lifecycle) errors.push(`RULE_LIFECYCLE_MISMATCH:${row.rulePath}`);
  if (row.dslValidationOk !== packetRow.dslValidationOk) errors.push(`RULE_DSL_VALIDATION_RESULT_MISMATCH:${row.rulePath}`);
  if ((row.logicExtractionHint || "") !== (packetRow.logicExtractionHint || "")) {
    errors.push(`LOGIC_EXTRACTION_HINT_MISMATCH:${row.rulePath}`);
  }
  if ((row.logicFitDecision || "not_applicable") !== (packetRow.logicFitDecision || "not_applicable")) {
    errors.push(`LOGIC_FIT_DECISION_MISMATCH:${row.rulePath}`);
  }

  if (row.decision === "approve_disabled_rule_for_package_planning") {
    if (packetRow.dslValidationOk !== true) errors.push(`APPROVED_ROW_REQUIRES_DSL_VALIDATION_OK:${row.rulePath}`);
    if (packetRow.lifecycle !== "draft_disabled") errors.push(`APPROVED_ROW_REQUIRES_DRAFT_DISABLED:${row.rulePath}`);
    if (row.evidenceReviewed !== true) errors.push(`APPROVED_ROW_REQUIRES_EVIDENCE_REVIEW:${row.rulePath}`);
    if (row.ruleReviewed !== true) errors.push(`APPROVED_ROW_REQUIRES_RULE_REVIEW:${row.rulePath}`);
    if (row.dslValidationReviewed !== true) errors.push(`APPROVED_ROW_REQUIRES_DSL_VALIDATION_REVIEW:${row.rulePath}`);
    if (packetRow.logicExtractionHint) {
      if (row.logicExtractionHintReviewed !== true) errors.push(`APPROVED_ROW_REQUIRES_LOGIC_EXTRACTION_HINT_REVIEW:${row.rulePath}`);
      if (row.logicFitDecisionReviewed !== true) errors.push(`APPROVED_ROW_REQUIRES_LOGIC_FIT_DECISION_REVIEW:${row.rulePath}`);
      if (packetRow.logicFitDecision !== "matches_intended_logic") errors.push(`APPROVED_ROW_REQUIRES_MATCHING_LOGIC_FIT:${row.rulePath}`);
    }
    if (!String(row.reviewerNote || "").trim()) errors.push(`APPROVED_ROW_REQUIRES_REVIEWER_NOTE:${row.rulePath}`);
    if (!Array.isArray(row.evidenceRefs) || row.evidenceRefs.length === 0) errors.push(`APPROVED_ROW_REQUIRES_EVIDENCE_REFS:${row.rulePath}`);

    reviewedDisabledRules.push({
      sourceId: row.sourceId || packetRow.sourceId,
      rulePath: packetRow.rulePath,
      ruleHash: packetRow.ruleHash,
      ruleId: packetRow.ruleId,
      lifecycle: packetRow.lifecycle,
      evidenceRefs: packetRow.evidenceRefs || [],
      logicExtractionHint: packetRow.logicExtractionHint || "",
      logicFitDecision: packetRow.logicFitDecision || "not_applicable",
      reviewerNote: row.reviewerNote
    });
  }
  if (row.decision === "request_rule_rewrite" && packetRow.dslValidationOk === true) {
    warnings.push(`ROW_REQUESTED_REWRITE_FOR_VALID_DSL_RULE:${row.rulePath}`);
  }
}

if (receipt.decision === "teacher_reviewed_rule_dsl_validation_package" && !reviewedDisabledRules.length) {
  errors.push("TOP_LEVEL_REVIEWED_DECISION_REQUIRES_APPROVED_DISABLED_RULE");
}
if (receipt.decision === "needs_teacher_review" && reviewedDisabledRules.length) {
  errors.push("APPROVED_ROWS_REQUIRE_REVIEWED_TOP_LEVEL_DECISION");
}

const status =
  errors.length > 0 || forbiddenDecisionUsed
    ? "blocked"
    : reviewedDisabledRules.length > 0
      ? "ready_for_review_only_disabled_rule_package_planning"
      : "waiting_for_teacher_review";

const validation = {
  format: "transparent_ai_rag_reviewed_rule_dsl_review_receipt_validation_v1",
  validationId: stableId("rag_reviewed_rule_dsl_review_receipt_validation", `${packagePath}:${receiptPath}`),
  createdAt: new Date().toISOString(),
  packagePath,
  receiptPath,
  packageHash,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status,
  errors,
  warnings,
  reviewedDisabledRules,
  nextReview: {
    instruction:
      status === "ready_for_review_only_disabled_rule_package_planning"
        ? "Prepare only a review-only disabled rule package planning step. Do not enable rules or write memory."
        : status === "blocked"
          ? "Fix the teacher review receipt before any disabled rule package planning."
          : "Have the teacher review each disabled Rule Card, evidence refs, and Rule DSL validation result.",
    mayPrepareDisabledRulePackageReview: status === "ready_for_review_only_disabled_rule_package_planning",
    mayCompileActiveRulePackage: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayUnlockPackaging: false,
    logicExtractionHints: reviewedDisabledRules
      .filter((row) => row.logicExtractionHint)
      .map((row) => ({ sourceId: row.sourceId, logicExtractionHint: row.logicExtractionHint, logicFitDecision: row.logicFitDecision })),
    planningLogicEvidence,
    planningLogicEvidenceHash
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
    packagingGated: true,
    packagingUnlocked: false
  }
};

const validationDir = join(outDir, validation.validationId);
const validationPath = join(validationDir, "rag-reviewed-rule-dsl-review-receipt-validation.json");
writeJson(validationPath, validation);

console.log(
  JSON.stringify(
    {
      ok: status !== "blocked",
      status,
      validationPath,
      reviewedDisabledRules: reviewedDisabledRules.length,
      errors,
      warnings,
      locks: validation.locks
    },
    null,
    2
  )
);

if (status === "blocked") process.exit(1);
