#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = JSON.parse(readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (
    [
      "approve_review_only_lifecycle_candidate",
      "approve_review_only",
      "approve_lifecycle_candidate",
      "draft_disabled_to_review_only"
    ].includes(decision)
  ) {
    return "approve_review_only_lifecycle_candidate";
  }
  if (["request_high_reasoning_repair", "high_reasoning_repair", "repair", "mismatch"].includes(decision)) {
    return "request_high_reasoning_repair";
  }
  if (["request_more_evidence", "needs_more_evidence", "more_evidence"].includes(decision)) return "request_more_evidence";
  if (decision === "blocked") return "blocked";
  if (
    [
      "accepted",
      "activate_rule",
      "enable_rule",
      "promote_rule",
      "compile_active_package",
      "execute_software",
      "write_memory",
      "fetch_rag",
      "unlock_packaging",
      "claim_complete",
      "package_release"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks({ approved = false } = {}) {
  return {
    reviewOnly: true,
    validationOnly: true,
    reviewOnlyLifecycleCandidateApproved: approved,
    lifecycleTransitionExecuted: false,
    activeRulePackageCompiled: false,
    activePromotionAllowed: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const validationInput = readJsonInput(
  argValue("--review-validation", argValue("--validation", "")),
  "--review-validation",
  "transparent_ai_real_case_confirmed_outcome_validation_report_review_validation_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-lifecycle-candidate-review-validations"))
);
const validation = validationInput.value;
const receipt = receiptInput.value;
const candidate = validation.lifecycleCandidateHandoff;
const decision = normalizeDecision(receipt.teacherDecision);
const forbidden = new Set([
  "accepted",
  "activate_rule",
  "enable_rule",
  "promote_rule",
  "compile_active_package",
  "execute_software",
  "write_memory",
  "fetch_rag",
  "unlock_packaging",
  "claim_complete",
  "package_release"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (receipt.sourceValidationId !== validation.validationId) {
  block("source_validation_id_mismatch", "Receipt sourceValidationId must match validation.validationId.");
}
if (receipt.sourceReviewValidationHash !== hashText(JSON.stringify(validation))) {
  block("source_review_validation_hash_mismatch", "Receipt sourceReviewValidationHash must match the review validation.");
}
if (validation.confirmedOutcomeBranch !== true || candidate?.confirmedOutcomeBranch !== true) {
  block("source_confirmed_outcome_branch_missing", "Source validation and lifecycle candidate handoff must preserve confirmedOutcomeBranch=true.");
}
if (
  validation.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT ||
  candidate?.sourceReviewFormat !== validation.sourceReviewFormat
) {
  block("source_review_format_mismatch", "Source validation and lifecycle candidate handoff must preserve the confirmed-outcome source review format.");
}
if (
  !validation.sourceConfirmedOutcomeReviewId ||
  !validation.sourceConfirmedOutcomeSourceRunId ||
  !validation.sourceRunId ||
  candidate?.sourceConfirmedOutcomeReviewId !== validation.sourceConfirmedOutcomeReviewId ||
  candidate?.sourceConfirmedOutcomeSourceRunId !== validation.sourceConfirmedOutcomeSourceRunId ||
  candidate?.sourceRunId !== validation.sourceRunId
) {
  block("source_ids_missing_or_mismatched", "Source validation and lifecycle candidate handoff must preserve confirmed-outcome review and run ids.");
}
if (receipt.confirmedOutcomeBranch !== true) {
  block("receipt_source_confirmed_outcome_branch_missing", "Receipt must preserve confirmedOutcomeBranch=true.");
}
if (receipt.sourceReviewFormat !== validation.sourceReviewFormat) {
  block("receipt_source_review_format_mismatch", "Receipt sourceReviewFormat must match the review validation.");
}
if (receipt.sourceConfirmedOutcomeReviewId !== validation.sourceConfirmedOutcomeReviewId) {
  block("receipt_source_review_id_mismatch", "Receipt sourceConfirmedOutcomeReviewId must match the review validation.");
}
if (receipt.sourceConfirmedOutcomeSourceRunId !== validation.sourceConfirmedOutcomeSourceRunId) {
  block(
    "receipt_source_confirmed_outcome_source_run_id_mismatch",
    "Receipt sourceConfirmedOutcomeSourceRunId must match the review validation."
  );
}
if (receipt.sourceRunId !== validation.sourceRunId) {
  block("receipt_source_run_id_mismatch", "Receipt sourceRunId must match the review validation.");
}
if (receipt.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");
if (forbidden.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (
  validation.status !== "confirmed_outcome_validation_report_review_ready_for_lifecycle_candidate_planning" ||
  validation.readyForLifecycleCandidate !== true ||
  !candidate ||
  candidate.format !== "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_handoff_v1" ||
  candidate.deliveryAllowedEvidenceOnly !== true ||
  candidate.activePromotionAllowedHere !== false ||
  candidate.nextStepRequiresSeparateTeacherLifecycleGate !== true ||
  validation.locks?.ruleEnabled !== false ||
  validation.locks?.packagingUnlocked !== false
) {
  block("source_validation_not_locked_lifecycle_candidate", "Source validation must be a locked lifecycle candidate handoff.");
}

if (decision === "approve_review_only_lifecycle_candidate") {
  if (receipt.lifecycleCandidateReviewed !== true) block("lifecycle_candidate_not_reviewed", "Teacher must review lifecycle candidate.");
  if (receipt.disabledLifecycleReviewed !== true) block("disabled_lifecycle_not_reviewed", "Teacher must review disabled lifecycle rows.");
  if (receipt.draftDisabledToReviewOnlyOnlyConfirmed !== true) {
    block("review_only_transition_not_confirmed", "Teacher must confirm this is only draft_disabled to review_only planning.");
  }
  if (receipt.activePromotionStillBlockedConfirmed !== true) {
    block("active_promotion_block_not_confirmed", "Teacher must confirm active promotion remains blocked.");
  }
  if (receipt.separateActiveGateRequiredConfirmed !== true) {
    block("separate_active_gate_not_confirmed", "Teacher must confirm a separate active gate is still required.");
  }
  if (receipt.teacherConfirmedNoExecution !== true) block("no_execution_not_confirmed", "Teacher must confirm no execution now.");
  if (receipt.rollbackRetained !== true) block("rollback_not_retained", "Teacher must confirm retained rollback point.");
}
if ((decision === "request_high_reasoning_repair" || decision === "request_more_evidence") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_note_required", `${decision} requires teacherNotes.`);
}

const forbiddenDecisionUsed = forbidden.has(decision);
const readyForReviewOnlyPlanning = decision === "approve_review_only_lifecycle_candidate" && !forbiddenDecisionUsed && blockers.length === 0;
const routesToHighReasoningRepair = decision === "request_high_reasoning_repair" && !forbiddenDecisionUsed && blockers.length === 0;
const routesToMoreEvidence = decision === "request_more_evidence" && !forbiddenDecisionUsed && blockers.length === 0;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_confirmed_outcome_lifecycle_candidate_review_decision"
  : readyForReviewOnlyPlanning
    ? "confirmed_outcome_lifecycle_candidate_review_ready_for_review_only_package_planning"
    : routesToHighReasoningRepair
      ? "confirmed_outcome_lifecycle_candidate_review_routes_to_high_reasoning_repair"
      : routesToMoreEvidence
        ? "confirmed_outcome_lifecycle_candidate_review_waiting_for_more_evidence"
        : "confirmed_outcome_lifecycle_candidate_review_needs_teacher_review";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${decision}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "real-case-confirmed-outcome-lifecycle-candidate-review-validation.json");
const receiptRecordPath = join(validationDir, "real-case-confirmed-outcome-lifecycle-candidate-review-receipt.json");
const readmePath = join(validationDir, "REAL_CASE_CONFIRMED_OUTCOME_LIFECYCLE_CANDIDATE_REVIEW_VALIDATION_START_HERE.md");
const validationLocks = locks({ approved: readyForReviewOnlyPlanning });
const sourceContext = {
  confirmedOutcomeBranch: validation.confirmedOutcomeBranch === true,
  sourceReviewFormat: validation.sourceReviewFormat,
  sourceConfirmedOutcomeReviewId: validation.sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId: validation.sourceConfirmedOutcomeSourceRunId,
  sourceRunId: validation.sourceRunId
};

const reviewOnlyPackagePlanningHandoff = readyForReviewOnlyPlanning
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_review_only_lifecycle_candidate_handoff_v1",
      reportId: candidate.reportId,
      ...sourceContext,
      caseType: candidate.caseType || "",
      proposedTransition: "draft_disabled_to_review_only_candidate",
      validationReportPath: candidate.validationReportPath,
      compiledRulePackagePath: candidate.compiledRulePackagePath,
      ruleDir: candidate.ruleDir,
      disabledRuleCount: candidate.disabledRuleCount || 0,
      lifecycleSkippedRows: candidate.lifecycleSkippedRows || 0,
      deliveryAllowedEvidenceOnly: true,
      reviewOnlyLifecycleCandidateApproved: true,
      activePromotionAllowed: false,
      separateActiveGateRequired: true,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const highReasoningRepairHandoff = routesToHighReasoningRepair
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_high_reasoning_repair_handoff_v1",
      reportId: candidate?.reportId || "",
      ...sourceContext,
      teacherNotes: receipt.teacherNotes || "",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const moreEvidenceHandoff = routesToMoreEvidence
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_more_evidence_handoff_v1",
      reportId: candidate?.reportId || "",
      ...sourceContext,
      teacherNotes: receipt.teacherNotes || "",
      requestedEvidenceKinds: ["teacher_lifecycle_intent", "validation_report_row", "disabled_rule_source", "rollback_point"],
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;

const result = {
  ok: !forbiddenDecisionUsed && blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForReviewOnlyPlanning,
  routesToHighReasoningRepair,
  routesToMoreEvidence,
  forbiddenDecisionUsed,
  ...sourceContext,
  blockers,
  reviewOnlyPackagePlanningHandoff,
  highReasoningRepairHandoff,
  moreEvidenceHandoff,
  blockedActions: [
    "activate_rule_from_lifecycle_candidate_review",
    "promote_active_rule_from_lifecycle_candidate_review",
    "compile_active_package_from_lifecycle_candidate_review",
    "execute_software_from_lifecycle_candidate_review",
    "write_memory_from_lifecycle_candidate_review",
    "unlock_packaging_from_lifecycle_candidate_review",
    "claim_completion_from_lifecycle_candidate_review"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceReviewValidation: validationInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeJson(validationPath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed Outcome Lifecycle Candidate Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation can prepare only review_only lifecycle planning. It does not execute the transition, enable active rules, run software, write memory, fetch RAG, unlock packaging, or claim completion.",
    "",
    `Validation JSON: ${validationPath}`,
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: result.ok,
      format: "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_validation_result_v1",
      status,
      validationPath,
      receiptRecordPath,
      readmePath,
      readyForReviewOnlyPlanning,
      ...sourceContext,
      reviewOnlyPackagePlanningHandoff,
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
