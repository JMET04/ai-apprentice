#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { arg, hasFlag, hashText, readJson, stableId, writeJson } from "./knowledge/knowledge-core.mjs";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = readJson(sourcePath);
  } catch {
    try {
      parsed = JSON.parse(text);
      sourcePath = "";
    } catch {
      parsed = null;
    }
  }
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return { value: parsed, path: sourcePath };
}

function deliveryGateLocks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    activeRulePackageCompiled: true,
    activeValidationReportEvaluated: true,
    activeValidationDeliveryAllowed: true,
    deliveryGateOpen: false,
    deliveryGateOpened: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    memoryEnabled: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateExecutionGate: true
  };
}

const validationReportInput = readJsonInput(
  arg("--validation-report-packet", arg("--active-validation-report", arg("--packet", ""))),
  "--validation-report-packet",
  "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_v1"
);
const rollbackPoint = resolve(arg("--rollback-point", ""));
const outRoot = resolve(
  arg("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-active-validation-report-delivery-gates"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!teacherReviewed) throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_DELIVERY_GATE_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!rollbackPoint || !existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint || "<missing>"}`);

const packet = validationReportInput.value;
if (
  packet.status !== "ready_for_teacher_confirmed_outcome_active_validation_report_delivery_gate_review" ||
  packet.deliveryAllowed !== true ||
  packet.summary?.deliveryAllowed !== true ||
  (packet.summary?.blockingRowCount || 0) !== 0 ||
  !packet.validationReportPath ||
  !existsSync(packet.validationReportPath) ||
  !packet.compiledActiveRulePackagePath ||
  !existsSync(packet.compiledActiveRulePackagePath) ||
  packet.locks?.activeRulePackageCompiled !== true ||
  packet.locks?.activeValidationReportEvaluated !== true ||
  packet.locks?.activeValidationDeliveryAllowed !== true ||
  packet.locks?.deliveryGateOpened !== false ||
  packet.locks?.ruleEnabled !== false ||
  packet.locks?.targetSoftwareCommandsExecuted !== false ||
  packet.locks?.memoryWritten !== false ||
  packet.locks?.ragFetched !== false ||
  packet.locks?.packagingUnlocked !== false ||
  packet.locks?.requiresSeparateDeliveryGate !== true ||
  packet.locks?.requiresSeparateExecutionGate !== true
) {
  throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET");
}
if (resolve(packet.rollbackPoint || "") !== rollbackPoint) {
  throw new Error("ROLLBACK_POINT_MISMATCH_FOR_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE");
}
if (packet.confirmedOutcomeBranch !== true) {
  throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_SOURCE_BRANCH_MISSING");
}
if (packet.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_SOURCE_FORMAT_MISMATCH");
}
if (!packet.sourceConfirmedOutcomeReviewId || !packet.sourceConfirmedOutcomeSourceRunId || !packet.sourceRunId) {
  throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_SOURCE_IDS_MISSING");
}

const validationReport = readJson(packet.validationReportPath);
if (validationReport.delivery_allowed !== true) {
  throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_REJECTS_NON_DELIVERY_ALLOWED_VALIDATION_REPORT");
}
const activeBlockingRows = (validationReport.results || []).filter(
  (row) => row.lifecycle === "active" && row.severity === "blocking" && ["fail", "unknown", "error"].includes(row.status)
);
if (activeBlockingRows.length) {
  throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_REJECTS_BLOCKING_VALIDATION_ROWS");
}

const compiledPackage = readJson(packet.compiledActiveRulePackagePath);
const activeRules = (compiledPackage.rules || []).filter((rule) => rule.lifecycle === "active");
const nonActiveRules = (compiledPackage.rules || []).filter((rule) => rule.lifecycle !== "active");
if (!activeRules.length || nonActiveRules.length || activeRules.length !== packet.activeRuleCount) {
  throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_REQUIRES_MATCHING_ACTIVE_RULE_PACKAGE");
}

const gateId = stableId("real_case_confirmed_outcome_active_validation_report_delivery_gate", `${validationReportInput.path || hashText(JSON.stringify(packet))}:${rollbackPoint}`);
const gateDir = join(outRoot, gateId);
const gatePath = join(gateDir, "real-case-confirmed-outcome-active-validation-report-delivery-gate.json");
const validationReportHash = hashText(JSON.stringify(validationReport));
const packetHash = hashText(JSON.stringify(packet));
const rulePackageHash = hashText(JSON.stringify(compiledPackage));
const sourceContext = {
  confirmedOutcomeBranch: true,
  sourceReviewFormat: packet.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: packet.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: packet.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: packet.sourceRunId
};

const gate = {
  ok: true,
  format: "transparent_ai_real_case_confirmed_outcome_active_validation_report_delivery_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  status: "confirmed_outcome_active_delivery_gate_closed_ready_for_teacher_execution_gate_review",
  validationReportPacketPath: validationReportInput.path,
  validationReportPacketHash: packetHash,
  ...sourceContext,
  validationReportPath: packet.validationReportPath,
  validationReportHash,
  compiledActiveRulePackagePath: packet.compiledActiveRulePackagePath,
  compiledActiveRulePackageHash: rulePackageHash,
  activeRuleCount: activeRules.length,
  teacherReviewed,
  rollbackPoint,
  caseType: packet.caseType || "",
  decision: {
    validationReportVisibleToTeacher: true,
    deliveryAllowedOnlyMeansActiveBlockingRulesDidNotBlock: true,
    mayOpenExecutionGateHere: false,
    mayEnableRules: false,
    mayExecuteSoftware: false,
    mayWriteMemory: false,
    mayFetchRag: false,
    mayUnlockPackaging: false,
    mayClaimTechnologyAccepted: false,
    mayClaimCompletion: false
  },
  blockedTransitions: [
    "confirmed_outcome_active_validation_delivery_allowed_to_rule_enabled",
    "confirmed_outcome_active_validation_delivery_allowed_to_software_execution",
    "confirmed_outcome_active_validation_delivery_allowed_to_memory_write",
    "confirmed_outcome_active_validation_delivery_allowed_to_rag_fetch",
    "confirmed_outcome_active_validation_delivery_allowed_to_packaging_unlock",
    "confirmed_outcome_active_validation_delivery_allowed_to_technology_acceptance",
    "confirmed_outcome_active_validation_delivery_allowed_to_goal_completion"
  ],
  summary: {
    reportDeliveryAllowed: true,
    reportStatus: validationReport.status,
    activeRuleCount: activeRules.length,
    blockingRowCount: 0,
    validatorRowsEvaluated: (validationReport.results || []).length,
    warningFailRows: (validationReport.results || []).filter((row) => row.severity === "warning" && row.status === "fail").length,
    warningUnknownRows: (validationReport.results || []).filter((row) => row.severity === "warning" && row.status === "unknown").length,
    warningErrorRows: (validationReport.results || []).filter((row) => row.severity === "warning" && row.status === "error").length,
    gateAllowsExecution: false,
    gateAllowsPackaging: false,
    gateRequiresTeacherExecutionGate: true
  },
  nextReview: {
    instruction:
      "Review this closed confirmed-outcome active delivery gate before any separate execution gate. delivery_allowed is evidence only and cannot enable rules or execute target software here.",
    continueCondition:
      "Only continue to a separate execution gate if the teacher confirms the confirmed-outcome active Validation Report, rollback point, blocked transitions, and no-action locks.",
    stopCondition:
      "Stop if any active blocking row appears, the rollback point changes, or anyone treats delivery_allowed as permission to execute, write memory, fetch RAG, unlock packaging, accept technology, or complete the goal.",
    requiredNextArtifact: "teacher_active_execution_gate_receipt_or_follow_up_queue",
    requiresSeparateExecutionGate: true,
    commandTemplate:
      "No execution command is generated by this delivery gate. A future execution gate must consume this gate path, retained rollback point, and a teacher-filled receipt."
  },
  locks: deliveryGateLocks()
};
writeJson(gatePath, gate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_confirmed_outcome_active_validation_report_delivery_gate_result_v1",
      status: gate.status,
      gatePath,
      validationReportPath: gate.validationReportPath,
      validationReportPacketPath: gate.validationReportPacketPath,
      reportDeliveryAllowed: gate.summary.reportDeliveryAllowed,
      activeRuleCount: gate.activeRuleCount,
      ...sourceContext,
      gateAllowsExecution: gate.summary.gateAllowsExecution,
      gateAllowsPackaging: gate.summary.gateAllowsPackaging,
      executeNow: false,
      locks: gate.locks
    },
    null,
    2
  )
);

