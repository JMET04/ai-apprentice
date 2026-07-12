#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluateRulePackage } from "../rules/evaluate-rule-package.mjs";
import { arg, hasFlag, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const disabledPackagePath = resolve(arg("--disabled-rule-package", ""));
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-disabled-package-validation-report"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!disabledPackagePath || !rollbackPoint) {
  throw new Error(
    "Usage: node create-rag-disabled-package-validation-report.mjs --disabled-rule-package <rag-reviewed-disabled-rule-package.json> --rollback-point <rollback-point-dir> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!teacherReviewed) throw new Error("RAG_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const disabledPackage = readJson(disabledPackagePath);
if (disabledPackage.format !== "transparent_ai_rag_reviewed_disabled_rule_package_v1") {
  throw new Error("Expected transparent_ai_rag_reviewed_disabled_rule_package_v1.");
}
if (
  disabledPackage.status !== "ready_for_teacher_disabled_rule_package_review" ||
  disabledPackage.locks?.ruleEnabled !== false ||
  disabledPackage.locks?.disabledRulePackageCompiled !== true ||
  disabledPackage.locks?.activeRulePackageCompiled !== false ||
  disabledPackage.locks?.memoryEnabled !== false ||
  disabledPackage.locks?.softwareActionsExecuted !== false ||
  disabledPackage.locks?.externalFetchPerformed !== false ||
  disabledPackage.locks?.packagingUnlocked !== false
) {
  throw new Error("Disabled Rule Package is not a locked review-only package.");
}
if (!disabledPackage.compiledRulePackagePath || !existsSync(disabledPackage.compiledRulePackagePath)) {
  throw new Error("COMPILED_DISABLED_RULE_PACKAGE_NOT_FOUND");
}

const stagedLogicRows = Array.isArray(disabledPackage.stagedRules)
  ? disabledPackage.stagedRules
      .filter((row) => row.logicExtractionHint)
      .map((row) => ({
        sourceId: row.sourceId || "",
        ruleId: row.ruleId || "",
        logicExtractionHint: row.logicExtractionHint || "",
        logicFitDecision: row.logicFitDecision || "not_applicable",
        evidenceRefs: row.evidenceRefs || []
      }))
  : [];
const nextReviewLogicHints = new Map(
  (disabledPackage.nextReview?.logicExtractionHints || []).map((row) => [String(row.sourceId || ""), row])
);
const planningLogicEvidence = disabledPackage.planningLogicEvidence || null;
const planningLogicEvidenceHash = disabledPackage.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = disabledPackage.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = disabledPackage.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("VALIDATION_REPORT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("VALIDATION_REPORT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("VALIDATION_REPORT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
for (const row of stagedLogicRows) {
  const expected = nextReviewLogicHints.get(String(row.sourceId || ""));
  if (!expected) throw new Error(`VALIDATION_REPORT_LOGIC_HINT_MISSING_FROM_NEXT_REVIEW:${row.ruleId || row.sourceId}`);
  if ((row.logicExtractionHint || "") !== (expected.logicExtractionHint || "")) {
    throw new Error(`VALIDATION_REPORT_LOGIC_EXTRACTION_HINT_MISMATCH:${row.ruleId || row.sourceId}`);
  }
  if ((row.logicFitDecision || "not_applicable") !== (expected.logicFitDecision || "not_applicable")) {
    throw new Error(`VALIDATION_REPORT_LOGIC_FIT_DECISION_MISMATCH:${row.ruleId || row.sourceId}`);
  }
  if (row.logicFitDecision !== "matches_intended_logic") {
    throw new Error(`VALIDATION_REPORT_REQUIRES_MATCHING_LOGIC_FIT:${row.ruleId || row.sourceId}`);
  }
}

const compiledRulePackage = readJson(disabledPackage.compiledRulePackagePath);
const activeRules = (compiledRulePackage.rules || []).filter((rule) => rule.lifecycle === "active");
if (activeRules.length) throw new Error("VALIDATION_REPORT_REHEARSAL_REJECTS_ACTIVE_RULES");
const nonDisabledRules = (compiledRulePackage.rules || []).filter((rule) => rule.lifecycle !== "draft_disabled");
if (nonDisabledRules.length) throw new Error("VALIDATION_REPORT_REHEARSAL_REQUIRES_DRAFT_DISABLED_RULES");

const reportId = stableId("rag_disabled_package_validation_report", `${disabledPackagePath}:${rollbackPoint}`);
const reportDir = join(outDir, reportId);
const artifactPath = join(reportDir, "review-only-execution-plan-artifact.json");
const reportPath = join(reportDir, "rag-disabled-package-validation-report.json");
const artifact = {
  artifact_id: `${reportId}.artifact`,
  artifact_type: "execution_plan",
  schema_version: "0.1",
  units: "review_only",
  created_at: new Date().toISOString(),
  source_refs: [disabledPackagePath],
  context: {
    risk_level: "high",
    approval: { teacher_confirmed: false },
    rollback_point: { exists: true, path: rollbackPoint },
    review_only: true
  },
  objects: []
};
writeJson(artifactPath, artifact);

const report = await evaluateRulePackage({
  rulesPath: resolve(disabledPackage.compiledRulePackagePath),
  artifactPath,
  outPath: reportPath
});

const skippedRows = (report.results || []).filter((row) => row.status === "skipped" && row.validator === "lifecycle-gate");
const nonSkippedRuleRows = (report.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped");
if (skippedRows.length !== (compiledRulePackage.rules || []).length) {
  throw new Error("DISABLED_RULES_MUST_APPEAR_AS_LIFECYCLE_SKIPPED_ROWS");
}
if (nonSkippedRuleRows.length) {
  throw new Error("DISABLED_RULE_PACKAGE_MUST_NOT_EVALUATE_RULE_VALIDATORS");
}
if (report.delivery_allowed !== true) {
  throw new Error("DISABLED_RULE_PACKAGE_REPORT_MUST_NOT_BLOCK_DELIVERY");
}

const packet = {
  format: "transparent_ai_rag_disabled_package_validation_report_v1",
  reportId,
  createdAt: new Date().toISOString(),
  disabledPackagePath,
  disabledPackageHash: hashText(JSON.stringify(disabledPackage)),
  compiledRulePackagePath: disabledPackage.compiledRulePackagePath,
  artifactPath,
  validationReportPath: reportPath,
  teacherReviewed,
  rollbackPoint,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status: "ready_for_teacher_validation_report_review",
  summary: {
    disabledRuleCount: (compiledRulePackage.rules || []).length,
    lifecycleSkippedRows: skippedRows.length,
    activeRulesEvaluated: 0,
    validatorRowsEvaluated: nonSkippedRuleRows.length,
    deliveryAllowed: report.delivery_allowed,
    primarySourceLogicHintCount: stagedLogicRows.length
  },
  disabledRuleLogicRows: stagedLogicRows,
  nextReview: {
    instruction: "Review this Validation Report as evidence that disabled rules appear in reports but do not block delivery.",
    mayPromoteRules: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayUnlockPackaging: false,
    logicExtractionHints: stagedLogicRows.map((row) => ({
      sourceId: row.sourceId,
      ruleId: row.ruleId,
      logicExtractionHint: row.logicExtractionHint,
      logicFitDecision: row.logicFitDecision
    })),
    planningLogicEvidence,
    planningLogicEvidenceHash
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    activeRulePackageCompiled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false
  }
};

const packetPath = join(reportDir, "rag-disabled-package-validation-report-packet.json");
writeJson(packetPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: packet.format,
      status: packet.status,
      packetPath,
      validationReportPath: reportPath,
      disabledRuleCount: packet.summary.disabledRuleCount,
      lifecycleSkippedRows: packet.summary.lifecycleSkippedRows,
      deliveryAllowed: packet.summary.deliveryAllowed,
      locks: packet.locks
    },
    null,
    2
  )
);
