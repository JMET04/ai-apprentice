#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { hashText, writeJson } from "./knowledge/knowledge-core.mjs";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function slug(value) {
  return (
    String(value || "real-case-confirmed-outcome-validation-report-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "real-case-confirmed-outcome-validation-report-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["report_confirms_disabled_evidence", "confirm_report", "ready_for_lifecycle_candidate"].includes(decision)) {
    return "report_confirms_disabled_evidence";
  }
  if (["report_mismatch_repair", "mismatch", "repair"].includes(decision)) return "report_mismatch_repair";
  if (["request_more_evidence", "needs_more_evidence", "more_evidence"].includes(decision)) return "request_more_evidence";
  if (["accepted", "enable_rule", "promote_rule", "compile_active_package", "execute_software", "write_memory", "fetch_rag", "unlock_packaging", "claim_complete"].includes(decision)) return decision;
  if (decision === "blocked") return "blocked";
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    validatorDoesNotPromoteRule: true,
    validatorDoesNotCompileActivePackage: true,
    validatorDoesNotEnableRule: true,
    validatorDoesNotExecuteSoftware: true,
    validatorDoesNotFetchRag: true,
    validatorDoesNotWriteMemory: true,
    validatorDoesNotUnlockPackaging: true,
    deliveryAllowedEvidenceOnly: true,
    lifecyclePromotionExecuted: false,
    activeRulePackageCompiled: false,
    ruleEnabled: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    targetSoftwareCommandsExecuted: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const packetInput = readJsonInput(
  argValue("--report-packet", argValue("--validation-report-packet", "")),
  "--report-packet",
  "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_confirmed_outcome_validation_report_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-validation-report-review-validations"))
);
const packet = packetInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbidden = new Set([
  "accepted",
  "enable_rule",
  "promote_rule",
  "compile_active_package",
  "execute_software",
  "write_memory",
  "fetch_rag",
  "unlock_packaging",
  "claim_complete"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (receipt.sourceReportId !== packet.reportId) block("source_report_id_mismatch", "Receipt sourceReportId must match packet.reportId.");
if (receipt.sourceReportPacketHash !== hashText(JSON.stringify(packet))) {
  block("source_report_packet_hash_mismatch", "Receipt sourceReportPacketHash must match the report packet.");
}
if (packet.confirmedOutcomeBranch !== true) {
  block("source_confirmed_outcome_branch_missing", "Report packet must preserve confirmedOutcomeBranch=true.");
}
if (packet.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  block("source_review_format_mismatch", "Report packet must preserve the confirmed-outcome source review format.");
}
if (!packet.sourceConfirmedOutcomeReviewId || !packet.sourceConfirmedOutcomeSourceRunId || !packet.sourceRunId) {
  block("source_ids_missing", "Report packet must preserve confirmed-outcome review and run ids.");
}
if (receipt.confirmedOutcomeBranch !== true) {
  block("receipt_source_confirmed_outcome_branch_missing", "Receipt must preserve confirmedOutcomeBranch=true.");
}
if (receipt.sourceReviewFormat !== packet.sourceReviewFormat) {
  block("receipt_source_review_format_mismatch", "Receipt sourceReviewFormat must match the report packet.");
}
if (receipt.sourceConfirmedOutcomeReviewId !== packet.sourceConfirmedOutcomeReviewId) {
  block("receipt_source_review_id_mismatch", "Receipt sourceConfirmedOutcomeReviewId must match the report packet.");
}
if (receipt.sourceConfirmedOutcomeSourceRunId !== packet.sourceConfirmedOutcomeSourceRunId) {
  block("receipt_source_confirmed_outcome_source_run_id_mismatch", "Receipt sourceConfirmedOutcomeSourceRunId must match the report packet.");
}
if (receipt.sourceRunId !== packet.sourceRunId) {
  block("receipt_source_run_id_mismatch", "Receipt sourceRunId must match the report packet.");
}
if (receipt.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");
if (forbidden.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (
  packet.status !== "ready_for_teacher_confirmed_outcome_validation_report_review" ||
  packet.summary?.disabledRuleCount !== packet.summary?.lifecycleSkippedRows ||
  packet.summary?.validatorRowsEvaluated !== 0 ||
  packet.summary?.deliveryAllowed !== true ||
  packet.nextReview?.deliveryAllowedIsEvidenceOnly !== true ||
  packet.locks?.ruleEnabled !== false ||
  packet.locks?.activeRulePackageCompiled !== false ||
  packet.locks?.targetSoftwareCommandsExecuted !== false ||
  packet.locks?.packagingUnlocked !== false
) {
  block("report_packet_not_locked_evidence_only", "Report packet must remain locked and evidence-only.");
}
if (!packet.validationReportPath || !existsSync(packet.validationReportPath)) block("validation_report_missing", "Validation report path must exist.");
if (!packet.compiledRulePackagePath || !existsSync(packet.compiledRulePackagePath)) {
  block("compiled_rule_package_missing", "Compiled disabled Rule Package path must exist.");
}

if (decision === "report_confirms_disabled_evidence") {
  if (receipt.reportReviewed !== true) block("report_not_reviewed", "Teacher must review the Validation Report.");
  if (receipt.lifecycleSkippedRowsReviewed !== true) {
    block("lifecycle_skipped_rows_not_reviewed", "Teacher must review lifecycle skipped rows.");
  }
  if (receipt.deliveryAllowedEvidenceOnlyConfirmed !== true) {
    block("delivery_allowed_not_confirmed_evidence_only", "Teacher must confirm delivery_allowed is evidence only.");
  }
  if (receipt.rollbackRetained !== true) block("rollback_not_retained", "Teacher must confirm retained rollback point.");
  if (receipt.teacherConfirmedNoExecution !== true) block("no_execution_not_confirmed", "Teacher must confirm no execution now.");
}
if ((decision === "report_mismatch_repair" || decision === "request_more_evidence") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_note_required", `${decision} requires teacherNotes.`);
}

const forbiddenDecisionUsed = forbidden.has(decision);
const readyForLifecycleCandidate = decision === "report_confirms_disabled_evidence" && blockers.length === 0;
const routesToHighReasoningRepair = decision === "report_mismatch_repair" && !forbiddenDecisionUsed && blockers.length === 0;
const routesToMoreEvidence = decision === "request_more_evidence" && !forbiddenDecisionUsed && blockers.length === 0;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_confirmed_outcome_validation_report_review_decision"
  : readyForLifecycleCandidate
    ? "confirmed_outcome_validation_report_review_ready_for_lifecycle_candidate_planning"
    : routesToHighReasoningRepair
      ? "confirmed_outcome_validation_report_review_routes_to_high_reasoning_repair"
      : routesToMoreEvidence
        ? "confirmed_outcome_validation_report_review_waiting_for_more_evidence"
        : "confirmed_outcome_validation_report_review_needs_teacher_review";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(decision)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "real-case-confirmed-outcome-validation-report-review-validation.json");
const receiptRecordPath = join(validationDir, "real-case-confirmed-outcome-validation-report-review-receipt.json");
const readmePath = join(validationDir, "REAL_CASE_CONFIRMED_OUTCOME_VALIDATION_REPORT_REVIEW_VALIDATION_START_HERE.md");
const validationLocks = locks();
const sourceContext = {
  confirmedOutcomeBranch: packet.confirmedOutcomeBranch === true,
  sourceReviewFormat: packet.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: packet.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: packet.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: packet.sourceRunId
};
const lifecycleCandidateHandoff = readyForLifecycleCandidate
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_handoff_v1",
      reportId: packet.reportId,
      ...sourceContext,
      caseType: packet.caseType || "",
      validationReportPath: packet.validationReportPath,
      compiledRulePackagePath: packet.compiledRulePackagePath,
      ruleDir: packet.ruleDir,
      disabledRuleCount: packet.summary?.disabledRuleCount || 0,
      lifecycleSkippedRows: packet.summary?.lifecycleSkippedRows || 0,
      deliveryAllowedEvidenceOnly: true,
      activePromotionAllowedHere: false,
      nextStepRequiresSeparateTeacherLifecycleGate: true,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const highReasoningRepairHandoff = routesToHighReasoningRepair
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_validation_report_high_reasoning_repair_handoff_v1",
      reportId: packet.reportId,
      ...sourceContext,
      teacherNotes: receipt.teacherNotes || "",
      validationReportPath: packet.validationReportPath,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const moreEvidenceHandoff = routesToMoreEvidence
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_validation_report_more_evidence_handoff_v1",
      reportId: packet.reportId,
      ...sourceContext,
      teacherNotes: receipt.teacherNotes || "",
      requestedEvidenceKinds: ["validation_report_row", "disabled_rule_source", "logic_fit_note", "rollback_point", "source_artifact"],
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;

const result = {
  ok: !forbiddenDecisionUsed && blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_validation_report_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForLifecycleCandidate,
  routesToHighReasoningRepair,
  routesToMoreEvidence,
  forbiddenDecisionUsed,
  ...sourceContext,
  blockers,
  lifecycleCandidateHandoff,
  highReasoningRepairHandoff,
  moreEvidenceHandoff,
  blockedActions: [
    "promote_rule_from_validation_report_review",
    "compile_active_package_from_validation_report_review",
    "enable_rule_from_validation_report_review",
    "execute_software_from_validation_report_review",
    "write_memory_from_validation_report_review",
    "unlock_packaging_from_validation_report_review",
    "claim_completion_from_validation_report_review"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceReportPacket: packetInput.path,
    sourceReceipt: receiptInput.path
  }
};

mkdirSync(dirname(validationPath), { recursive: true });
writeJson(validationPath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real Case Confirmed Outcome Validation Report Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation only prepares the selected next-review handoff. It does not promote rules, compile active packages, enable rules, execute software, write memory, unlock packaging, accept technology, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((row) => `- ${row.code}: ${row.message}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: result.ok,
      format: "transparent_ai_real_case_confirmed_outcome_validation_report_review_validation_result_v1",
      status,
      validationPath,
      receiptRecordPath,
      readmePath,
      readyForLifecycleCandidate,
      ...sourceContext,
      lifecycleCandidateHandoff,
      highReasoningRepairHandoff,
      moreEvidenceHandoff,
      blockers,
      executeNow: false,
      locks: validationLocks
    },
    null,
    2
  )
);
