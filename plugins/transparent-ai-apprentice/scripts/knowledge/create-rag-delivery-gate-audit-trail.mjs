#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hasFlag, hashText, readJson, stableId, writeJson } from "./knowledge-core.mjs";

const deliveryGatePath = resolve(arg("--delivery-gate", ""));
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outDir = resolve(arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "rag-delivery-gate-audit-trail")));
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!deliveryGatePath || !rollbackPoint) {
  throw new Error(
    "Usage: node create-rag-delivery-gate-audit-trail.mjs --delivery-gate <rag-validation-report-delivery-gate.json> --rollback-point <rollback-point-dir> --teacher-reviewed [--out-dir <dir>]"
  );
}
if (!teacherReviewed) throw new Error("RAG_DELIVERY_GATE_AUDIT_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint}`);

const gate = readJson(deliveryGatePath);
if (gate.format !== "transparent_ai_rag_validation_report_delivery_gate_v1") {
  throw new Error("Expected transparent_ai_rag_validation_report_delivery_gate_v1.");
}
if (
  gate.status !== "review_only_delivery_gate_closed" ||
  gate.decision?.deliveryAllowedOnlyMeansDisabledRulesDidNotBlock !== true ||
  gate.summary?.gateAllowsPackaging !== false ||
  gate.summary?.gateAllowsExecution !== false ||
  gate.locks?.reviewOnly !== true ||
  gate.locks?.evidenceOnly !== true ||
  gate.locks?.accepted !== false ||
  gate.locks?.ruleEnabled !== false ||
  gate.locks?.activeRulePackageCompiled !== false ||
  gate.locks?.memoryEnabled !== false ||
  gate.locks?.softwareActionsExecuted !== false ||
  gate.locks?.externalFetchPerformed !== false ||
  gate.locks?.packagingGated !== true ||
  gate.locks?.packagingUnlocked !== false ||
  gate.locks?.deliveryGateOpen !== false
) {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_REQUIRES_CLOSED_LOCKED_GATE");
}
if (!gate.validationReportPath || !existsSync(gate.validationReportPath)) {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_VALIDATION_REPORT_NOT_FOUND");
}
if (!gate.validationReportPacketPath || !existsSync(gate.validationReportPacketPath)) {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_VALIDATION_PACKET_NOT_FOUND");
}
if (
  !Array.isArray(gate.blockedTransitions) ||
  !gate.blockedTransitions.includes("validation_report_delivery_allowed_to_packaging_unlock") ||
  !gate.blockedTransitions.includes("validation_report_delivery_allowed_to_software_execution")
) {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_REQUIRES_BLOCKED_TRANSITIONS");
}

const validationPacket = readJson(gate.validationReportPacketPath);
const validationReport = readJson(gate.validationReportPath);
if (validationPacket.format !== "transparent_ai_rag_disabled_package_validation_report_v1") {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_REQUIRES_RAG_VALIDATION_PACKET");
}
if (validationReport.delivery_allowed !== true || validationReport.status !== "skipped") {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_REQUIRES_SKIPPED_ALLOWED_REPORT");
}

const disabledRuleLogicRows = Array.isArray(gate.disabledRuleLogicRows) ? gate.disabledRuleLogicRows : [];
const nextReviewLogicHints = new Map(
  (gate.nextReview?.logicExtractionHints || []).map((row) => [String(row.sourceId || ""), row])
);
const planningLogicEvidence = gate.planningLogicEvidence || null;
const planningLogicEvidenceHash = gate.planningLogicEvidenceHash || "";
const nextReviewPlanningLogicEvidence = gate.nextReview?.planningLogicEvidence || null;
const nextReviewPlanningLogicEvidenceHash = gate.nextReview?.planningLogicEvidenceHash || "";
if (planningLogicEvidenceHash && hashText(JSON.stringify(planningLogicEvidence || null)) !== planningLogicEvidenceHash) {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (planningLogicEvidenceHash && nextReviewPlanningLogicEvidenceHash !== planningLogicEvidenceHash) {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH");
}
if (
  planningLogicEvidenceHash &&
  hashText(JSON.stringify(nextReviewPlanningLogicEvidence || null)) !== nextReviewPlanningLogicEvidenceHash
) {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH");
}
if ((gate.summary?.primarySourceLogicHintCount || 0) !== disabledRuleLogicRows.length) {
  throw new Error("RAG_DELIVERY_GATE_AUDIT_LOGIC_HINT_COUNT_MISMATCH");
}
for (const row of disabledRuleLogicRows) {
  const expected = nextReviewLogicHints.get(String(row.sourceId || ""));
  if (!expected) throw new Error(`RAG_DELIVERY_GATE_AUDIT_LOGIC_HINT_MISSING_FROM_NEXT_REVIEW:${row.ruleId || row.sourceId}`);
  if ((row.logicExtractionHint || "") !== (expected.logicExtractionHint || "")) {
    throw new Error(`RAG_DELIVERY_GATE_AUDIT_LOGIC_EXTRACTION_HINT_MISMATCH:${row.ruleId || row.sourceId}`);
  }
  if ((row.logicFitDecision || "not_applicable") !== (expected.logicFitDecision || "not_applicable")) {
    throw new Error(`RAG_DELIVERY_GATE_AUDIT_LOGIC_FIT_DECISION_MISMATCH:${row.ruleId || row.sourceId}`);
  }
  if (row.logicFitDecision !== "matches_intended_logic") {
    throw new Error(`RAG_DELIVERY_GATE_AUDIT_REQUIRES_MATCHING_LOGIC_FIT:${row.ruleId || row.sourceId}`);
  }
}

const auditId = stableId("rag_delivery_gate_audit_trail", `${deliveryGatePath}:${rollbackPoint}`);
const auditDir = join(outDir, auditId);
const evidenceChain = [
  {
    step: "rag_disabled_validation_report_packet",
    path: gate.validationReportPacketPath,
    format: validationPacket.format,
    status: validationPacket.status,
    hash: hashText(JSON.stringify(validationPacket))
  },
  {
    step: "validation_report",
    path: gate.validationReportPath,
    format: validationReport.format || "validation_report",
    status: validationReport.status,
    deliveryAllowed: validationReport.delivery_allowed,
    hash: hashText(JSON.stringify(validationReport))
  },
  {
    step: "closed_delivery_gate",
    path: deliveryGatePath,
    format: gate.format,
    status: gate.status,
    deliveryGateOpen: gate.locks.deliveryGateOpen,
    hash: hashText(JSON.stringify(gate))
  },
  ...disabledRuleLogicRows.map((row) => ({
    step: "primary_source_logic_evidence",
    sourceId: row.sourceId,
    ruleId: row.ruleId,
    logicFitDecision: row.logicFitDecision,
    logicExtractionHintHash: hashText(row.logicExtractionHint || ""),
    evidenceRefs: row.evidenceRefs || []
  })),
  ...(planningLogicEvidenceHash
    ? [
        {
          step: "primary_source_planning_logic_evidence",
          planningLogicEvidenceHash,
          confirmedLogicEvidenceReviews: planningLogicEvidence?.logicEvidenceReviews?.length || 0,
          logicExtractionHintCount: planningLogicEvidence?.logicExtractionHints?.length || 0,
          hash: hashText(JSON.stringify(planningLogicEvidence || null))
        }
      ]
    : []),
  {
    step: "retained_rollback_point",
    path: rollbackPoint,
    format: "transparent_ai_rollback_point_result_v1",
    status: "waiting_for_teacher_confirmation",
    hash: hashText(rollbackPoint)
  }
];

const audit = {
  format: "transparent_ai_rag_delivery_gate_audit_trail_v1",
  auditId,
  createdAt: new Date().toISOString(),
  teacherReviewed,
  rollbackPoint,
  status: "audit_trail_ready_for_teacher_review",
  sourceGatePath: deliveryGatePath,
  sourceGateHash: hashText(JSON.stringify(gate)),
  evidenceChain,
  planningLogicEvidence,
  planningLogicEvidenceHash,
  disabledRuleLogicRows,
  invariants: {
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
    deliveryGateOpen: false,
    privateChainOfThoughtStored: false
  },
  blockedTransitions: gate.blockedTransitions,
  replay: {
    deliveryAllowedInterpretation: "visibility_only_disabled_rules_did_not_block",
    forbiddenInterpretations: [
      "rule_activation",
      "memory_write",
      "software_execution",
      "external_fetch",
      "technology_acceptance",
      "packaging_unlock",
      "goal_completion"
    ],
    nextAllowedStep: "teacher_review_receipt_or_follow_up_queue"
  },
  nextReview: {
    instruction:
      "Use this audit trail to review which evidence supported the closed delivery gate and which transitions remain blocked.",
    continueCondition: "Continue only with a separate teacher receipt or follow-up queue.",
    stopCondition:
      "Stop if any consumer treats this audit as acceptance, rule enablement, memory write, software execution, packaging unlock, or goal completion.",
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

const auditPath = join(auditDir, "rag-delivery-gate-audit-trail.json");
writeJson(auditPath, audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: audit.format,
      status: audit.status,
      auditPath,
      sourceGatePath: deliveryGatePath,
      evidenceSteps: evidenceChain.map((entry) => entry.step),
      blockedTransitions: audit.blockedTransitions,
      locks: audit.locks
    },
    null,
    2
  )
);
