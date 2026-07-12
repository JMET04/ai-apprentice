#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hasFlag, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const validationReportPacketPath = resolve(arg("--validation-report-packet", ""));
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-validation-report-delivery-gate"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!validationReportPacketPath || !rollbackPoint) {
  throw new Error(
    "Usage: node create-rag-validation-report-delivery-gate.mjs --validation-report-packet <rag-disabled-package-validation-report-packet.json> --rollback-point <rollback-point-dir> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!teacherReviewed) throw new Error("RAG_DELIVERY_GATE_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const packet = readJson(validationReportPacketPath);
if (packet.format !== "transparent_ai_rag_disabled_package_validation_report_v1") {
  throw new Error("Expected transparent_ai_rag_disabled_package_validation_report_v1.");
}
if (
  packet.status !== "ready_for_teacher_validation_report_review" ||
  packet.locks?.reviewOnly !== true ||
  packet.locks?.evidenceOnly !== true ||
  packet.locks?.accepted !== false ||
  packet.locks?.ruleEnabled !== false ||
  packet.locks?.activeRulePackageCompiled !== false ||
  packet.locks?.memoryEnabled !== false ||
  packet.locks?.softwareActionsExecuted !== false ||
  packet.locks?.externalFetchPerformed !== false ||
  packet.locks?.packagingGated !== true ||
  packet.locks?.packagingUnlocked !== false
) {
  throw new Error("RAG_DELIVERY_GATE_REQUIRES_LOCKED_VALIDATION_PACKET");
}
if (!packet.validationReportPath || !existsSync(packet.validationReportPath)) {
  throw new Error("RAG_DELIVERY_GATE_VALIDATION_REPORT_NOT_FOUND");
}

const report = readJson(packet.validationReportPath);
if (report.delivery_allowed !== true || report.status !== "skipped") {
  throw new Error("RAG_DELIVERY_GATE_REJECTS_NON_ALLOWED_OR_NON_SKIPPED_REPORT");
}
const activeRows = (report.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped");
if (activeRows.length || packet.summary?.activeRulesEvaluated !== 0 || packet.summary?.validatorRowsEvaluated !== 0) {
  throw new Error("RAG_DELIVERY_GATE_REJECTS_ACTIVE_VALIDATOR_ROWS");
}

const disabledRuleLogicRows = Array.isArray(packet.disabledRuleLogicRows) ? packet.disabledRuleLogicRows : [];
const nextReviewLogicHints = new Map(
  (packet.nextReview?.logicExtractionHints || []).map((row) => [String(row.sourceId || ""), row])
);
const planningLogicEvidence = packet.planningLogicEvidence || null;
const planningLogicEvidenceHash = packet.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = packet.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = packet.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_DELIVERY_GATE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_DELIVERY_GATE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("RAG_DELIVERY_GATE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
if ((packet.summary?.primarySourceLogicHintCount || 0) !== disabledRuleLogicRows.length) {
  throw new Error("RAG_DELIVERY_GATE_LOGIC_HINT_COUNT_MISMATCH");
}
for (const row of disabledRuleLogicRows) {
  const expected = nextReviewLogicHints.get(String(row.sourceId || ""));
  if (!expected) throw new Error(`RAG_DELIVERY_GATE_LOGIC_HINT_MISSING_FROM_NEXT_REVIEW:${row.ruleId || row.sourceId}`);
  if ((row.logicExtractionHint || "") !== (expected.logicExtractionHint || "")) {
    throw new Error(`RAG_DELIVERY_GATE_LOGIC_EXTRACTION_HINT_MISMATCH:${row.ruleId || row.sourceId}`);
  }
  if ((row.logicFitDecision || "not_applicable") !== (expected.logicFitDecision || "not_applicable")) {
    throw new Error(`RAG_DELIVERY_GATE_LOGIC_FIT_DECISION_MISMATCH:${row.ruleId || row.sourceId}`);
  }
  if (row.logicFitDecision !== "matches_intended_logic") {
    throw new Error(`RAG_DELIVERY_GATE_REQUIRES_MATCHING_LOGIC_FIT:${row.ruleId || row.sourceId}`);
  }
}

const gateId = stableId("rag_validation_report_delivery_gate", `${validationReportPacketPath}:${rollbackPoint}`);
const gateDir = join(outDir, gateId);
const gate = {
  format: "transparent_ai_rag_validation_report_delivery_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  validationReportPacketPath,
  validationReportPacketHash: hashText(JSON.stringify(packet)),
  validationReportPath: packet.validationReportPath,
  validationReportHash: hashText(JSON.stringify(report)),
  teacherReviewed,
  rollbackPoint,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  status: "review_only_delivery_gate_closed",
  decision: {
    validationReportVisibleToTeacher: true,
    deliveryAllowedOnlyMeansDisabledRulesDidNotBlock: true,
    mayPromoteRules: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteSoftware: false,
    mayFetchExternalSources: false,
    mayUnlockPackaging: false,
    mayClaimTechnologyAccepted: false
  },
  blockedTransitions: [
    "validation_report_delivery_allowed_to_rule_enabled",
    "validation_report_delivery_allowed_to_memory_write",
    "validation_report_delivery_allowed_to_software_execution",
    "validation_report_delivery_allowed_to_external_fetch",
    "validation_report_delivery_allowed_to_packaging_unlock",
    "validation_report_delivery_allowed_to_technology_acceptance"
  ],
  summary: {
    reportDeliveryAllowed: report.delivery_allowed,
    reportStatus: report.status,
    disabledRuleCount: packet.summary?.disabledRuleCount ?? 0,
    lifecycleSkippedRows: packet.summary?.lifecycleSkippedRows ?? 0,
    activeValidatorRows: activeRows.length,
    primarySourceLogicHintCount: disabledRuleLogicRows.length,
    gateAllowsPackaging: false,
    gateAllowsExecution: false,
    gateRequiresTeacherAcceptance: true
  },
  disabledRuleLogicRows,
  nextReview: {
    instruction:
      "Review this delivery gate as proof that a RAG disabled Validation Report can be shown to the teacher without unlocking packaging, execution, memory, or rule activation.",
    continueCondition:
      "Only continue if the teacher explicitly asks for a separate follow-up review step; do not treat this gate as acceptance.",
    stopCondition:
      "Stop if anyone tries to infer rule enablement, software execution, packaging unlock, or technology acceptance from delivery_allowed.",
    requiredNextArtifact: "teacher_review_receipt_or_follow_up_queue",
    logicExtractionHints: disabledRuleLogicRows.map((row) => ({
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
    packagingUnlocked: false,
    deliveryGateOpen: false
  }
};

const gatePath = join(gateDir, "rag-validation-report-delivery-gate.json");
writeJson(gatePath, gate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: gate.format,
      status: gate.status,
      gatePath,
      validationReportPath: gate.validationReportPath,
      reportDeliveryAllowed: gate.summary.reportDeliveryAllowed,
      gateAllowsPackaging: gate.summary.gateAllowsPackaging,
      gateAllowsExecution: gate.summary.gateAllowsExecution,
      blockedTransitions: gate.blockedTransitions,
      locks: gate.locks
    },
    null,
    2
  )
);
