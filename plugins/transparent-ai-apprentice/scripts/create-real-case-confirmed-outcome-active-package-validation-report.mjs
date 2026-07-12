#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateRulePackage } from "./rules/evaluate-rule-package.mjs";
import { hashText, readJson, stableId, writeJson } from "./knowledge/knowledge-core.mjs";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

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

function reportLocks({ deliveryAllowed = false, reportEvaluated = false } = {}) {
  return {
    evidenceOnly: true,
    activeRulePackageCompiled: true,
    activeValidationReportEvaluated: reportEvaluated,
    activeValidationDeliveryAllowed: deliveryAllowed,
    deliveryGateOpened: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateDeliveryGate: true,
    requiresSeparateExecutionGate: true
  };
}

const compilationInput = readJsonInput(
  argValue("--active-compilation", argValue("--compilation", "")),
  "--active-compilation",
  "transparent_ai_real_case_confirmed_outcome_active_rule_package_compilation_v1"
);
const artifactInput = readJsonInput(argValue("--artifact", ""), "--artifact");
const rollbackPoint = resolve(argValue("--rollback-point", ""));
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-active-package-validation-reports"))
);
const teacherReviewed = hasFlag("--teacher-reviewed");

if (!teacherReviewed) throw new Error("REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG");
if (!rollbackPoint || !existsSync(rollbackPoint)) throw new Error(`ROLLBACK_POINT_NOT_FOUND: ${rollbackPoint || "<missing>"}`);

const compilation = compilationInput.value;
if (
  compilation.status !== "ready_for_teacher_active_rule_package_validation_report_review" ||
  compilation.ok !== true ||
  compilation.activeRuleCount < 1 ||
  !compilation.compiledActiveRulePackagePath ||
  compilation.locks?.activeRulePackageCompiled !== true ||
  compilation.locks?.ruleEnabled !== false ||
  compilation.locks?.targetSoftwareCommandsExecuted !== false ||
  compilation.locks?.packagingUnlocked !== false ||
  compilation.locks?.requiresSeparateValidationReportGate !== true ||
  compilation.locks?.requiresSeparateExecutionGate !== true
) {
  throw new Error("Confirmed outcome active compilation packet is not a locked handoff for active Validation Report evaluation.");
}
if (resolve(compilation.rollbackPoint || "") !== rollbackPoint) {
  throw new Error("ROLLBACK_POINT_MISMATCH_FOR_CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT");
}
if (!existsSync(compilation.compiledActiveRulePackagePath)) {
  throw new Error(`COMPILED_ACTIVE_RULE_PACKAGE_NOT_FOUND: ${compilation.compiledActiveRulePackagePath}`);
}
if (compilation.confirmedOutcomeBranch !== true) {
  throw new Error("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_SOURCE_BRANCH_MISSING");
}
if (compilation.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  throw new Error("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_SOURCE_FORMAT_MISMATCH");
}
if (!compilation.sourceConfirmedOutcomeReviewId || !compilation.sourceConfirmedOutcomeSourceRunId || !compilation.sourceRunId) {
  throw new Error("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_SOURCE_IDS_MISSING");
}

const compiledPackage = readJson(compilation.compiledActiveRulePackagePath);
const activeRules = (compiledPackage.rules || []).filter((rule) => rule.lifecycle === "active");
const nonActiveRules = (compiledPackage.rules || []).filter((rule) => rule.lifecycle !== "active");
if (!activeRules.length) throw new Error("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_REQUIRES_ACTIVE_RULES");
if (nonActiveRules.length) throw new Error("CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_REJECTS_NON_ACTIVE_RULES");

const reportId = stableId(
  "real_case_confirmed_outcome_active_package_validation_report",
  `${compilationInput.path || hashText(JSON.stringify(compilation))}:${artifactInput.path || hashText(JSON.stringify(artifactInput.value))}`
);
const reportDir = join(outRoot, reportId);
mkdirSync(reportDir, { recursive: true });

const validationReportPath = join(reportDir, "real-case-confirmed-outcome-active-package-validation-report.json");
const packetPath = join(reportDir, "real-case-confirmed-outcome-active-package-validation-report-packet.json");
const artifactPathForEvaluation = artifactInput.path || join(reportDir, "input-artifact.json");
if (!artifactInput.path) writeJson(artifactPathForEvaluation, artifactInput.value);
const report = await evaluateRulePackage({
  rulesPath: resolve(compilation.compiledActiveRulePackagePath),
  artifactPath: resolve(artifactPathForEvaluation),
  outPath: validationReportPath
});

const summary = report.summary || {};
const deliveryAllowed = report.delivery_allowed === true;
const blockingRows = (report.results || []).filter(
  (row) => row.lifecycle === "active" && row.severity === "blocking" && ["fail", "unknown", "error"].includes(row.status)
);
const sourceContext = {
  confirmedOutcomeBranch: true,
  sourceReviewFormat: compilation.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: compilation.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: compilation.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: compilation.sourceRunId
};
const status = deliveryAllowed
  ? "ready_for_teacher_confirmed_outcome_active_validation_report_delivery_gate_review"
  : "confirmed_outcome_active_validation_report_blocks_delivery_pending_teacher_repair_review";

const packet = {
  ok: true,
  format: "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_v1",
  reportId,
  createdAt: new Date().toISOString(),
  status,
  compilationPath: compilationInput.path,
  compilationHash: hashText(JSON.stringify(compilation)),
  ...sourceContext,
  compiledActiveRulePackagePath: compilation.compiledActiveRulePackagePath,
  activeRuleCount: activeRules.length,
  artifactPath: artifactPathForEvaluation,
  artifactHash: hashText(JSON.stringify(artifactInput.value)),
  validationReportPath,
  deliveryAllowed,
  reportStatus: report.status,
  summary: {
    pass: summary.pass || 0,
    fail: summary.fail || 0,
    unknown: summary.unknown || 0,
    skipped: summary.skipped || 0,
    error: summary.error || 0,
    blockingRowCount: blockingRows.length,
    deliveryAllowed
  },
  blockingRows,
  teacherReviewed,
  rollbackPoint,
  caseType: compilation.caseType || "",
  nextReview: {
    instruction: deliveryAllowed
      ? "Review this confirmed-outcome active Validation Report before a separate delivery or execution gate. delivery_allowed is evidence only here."
      : "Review blocking confirmed-outcome active Validation Report rows and route repair before any delivery or execution gate.",
    mayOpenDeliveryGateHere: false,
    mayEnableRules: false,
    mayExecuteSoftware: false,
    mayFetchRag: false,
    mayWriteMemory: false,
    mayUnlockPackaging: false,
    deliveryAllowedIsEvidenceOnly: true,
    requiresSeparateDeliveryGate: true,
    requiresSeparateExecutionGate: true
  },
  blockedActions: [
    "open_delivery_gate_from_confirmed_outcome_active_validation_report",
    "enable_rule_from_confirmed_outcome_active_validation_report",
    "execute_software_from_confirmed_outcome_active_validation_report",
    "write_memory_from_confirmed_outcome_active_validation_report",
    "fetch_rag_from_confirmed_outcome_active_validation_report",
    "unlock_packaging_from_confirmed_outcome_active_validation_report",
    "claim_completion_from_confirmed_outcome_active_validation_report"
  ],
  locks: reportLocks({ deliveryAllowed, reportEvaluated: true })
};
writeJson(packetPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_result_v1",
      status,
      packetPath,
      validationReportPath,
      deliveryAllowed,
      reportStatus: report.status,
      activeRuleCount: activeRules.length,
      blockingRowCount: blockingRows.length,
      ...sourceContext,
      executeNow: false,
      locks: packet.locks
    },
    null,
    2
  )
);

