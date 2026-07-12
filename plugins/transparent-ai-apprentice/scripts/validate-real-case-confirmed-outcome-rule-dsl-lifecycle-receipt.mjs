#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function normalizeDecision(value) {
  const text = String(value || "").trim().toLowerCase();
  if (["approve_rule_dsl_draft_planning", "approve_draft_disabled_planning", "draft_planning"].includes(text)) {
    return "approve_rule_dsl_draft_planning";
  }
  if (["request_high_reasoning_repair", "repair", "teacher_correction", "correction_needed"].includes(text)) {
    return "request_high_reasoning_repair";
  }
  if (["request_more_evidence", "more_evidence", "needs_more_evidence", "needs_teacher_review"].includes(text)) {
    return "request_more_evidence";
  }
  if (["blocked", "block"].includes(text)) return "blocked";
  return text || "needs_teacher_review";
}

const EXPECTED_SOURCE_REVIEW_FORMAT = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

function locks({ reviewed = false } = {}) {
  return {
    reviewOnly: true,
    ruleDslLifecycleReviewed: reviewed,
    planningOnly: true,
    draftDisabledPlanningPrepared: reviewed,
    ruleFilesModified: false,
    rulePackageCompiled: false,
    activeRulePackageCompiled: false,
    productionRuleRegistryMutated: false,
    memoryWritten: false,
    ruleEnabled: false,
    modelInvoked: false,
    ragFetched: false,
    ragEvidenceTreatedAsAuthority: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateRuleCardPreparationOrValidationGate: true
  };
}

const reviewInput = readJsonInput(
  argValue("--candidate-ledger-review", argValue("--review", "")),
  "--candidate-ledger-review",
  "transparent_ai_real_case_confirmed_outcome_candidate_ledger_review_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-rule-dsl-lifecycle-gates"))
);

const review = reviewInput.value;
const receipt = receiptInput.value;
const handoff = review.ruleDslLifecycleHandoff;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

const decision = normalizeDecision(receipt.teacherDecision ?? receipt.decision);
const forbiddenDecisions = new Set([
  "enable_rule",
  "activate_rule",
  "compile_active_package",
  "mutate_rule_registry",
  "write_memory",
  "fetch_rag",
  "treat_rag_as_authority",
  "execute_software",
  "unlock_packaging",
  "accepted",
  "accept",
  "claim_complete",
  "goal_complete"
]);

if (review.status !== "real_case_confirmed_outcome_candidate_ledger_routes_to_rule_dsl_lifecycle_gate") {
  block("candidate_ledger_review_not_rule_dsl_route", "Candidate ledger review must route to the Rule DSL lifecycle gate.");
}
if (!handoff || handoff.format !== "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_handoff_v1") {
  block("rule_dsl_lifecycle_handoff_missing", "Candidate ledger review must contain a Rule DSL lifecycle handoff.");
}
if (review.confirmedOutcomeBranch !== true) {
  block("source_review_confirmed_outcome_branch_missing", "Candidate ledger review must preserve confirmedOutcomeBranch=true.");
}
if (review.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  block("source_review_format_not_confirmed_outcome", "Candidate ledger review must preserve the confirmed-outcome source review format.");
}
if (!review.sourceConfirmedOutcomeReviewId) {
  block("source_confirmed_outcome_review_id_missing", "Candidate ledger review must preserve sourceConfirmedOutcomeReviewId.");
}
if (!review.sourceConfirmedOutcomeSourceRunId) {
  block("source_confirmed_outcome_source_run_id_missing", "Candidate ledger review must preserve sourceConfirmedOutcomeSourceRunId.");
}
if (!review.sourceRunId) {
  block("source_run_id_missing", "Candidate ledger review must preserve sourceRunId.");
}
if (handoff && handoff.confirmedOutcomeBranch !== true) {
  block("source_handoff_confirmed_outcome_branch_missing", "Rule DSL lifecycle handoff must preserve confirmedOutcomeBranch=true.");
}
if (handoff && handoff.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  block("source_handoff_source_review_format_mismatch", "Rule DSL lifecycle handoff must preserve the confirmed-outcome source review format.");
}
if (handoff && handoff.sourceConfirmedOutcomeReviewId !== review.sourceConfirmedOutcomeReviewId) {
  block("source_handoff_confirmed_outcome_review_id_mismatch", "Rule DSL lifecycle handoff must preserve the confirmed outcome review id.");
}
if (handoff && handoff.sourceConfirmedOutcomeSourceRunId !== review.sourceConfirmedOutcomeSourceRunId) {
  block("source_handoff_confirmed_outcome_source_run_id_mismatch", "Rule DSL lifecycle handoff must preserve the confirmed outcome source run id.");
}
if (handoff && handoff.sourceRunId !== review.sourceRunId) {
  block("source_handoff_source_run_id_mismatch", "Rule DSL lifecycle handoff must preserve sourceRunId.");
}
if (handoff?.executeNow !== false || handoff?.ruleEnableAllowedHere !== false) {
  block("source_handoff_allows_rule_action_too_early", "Source handoff must keep executeNow and rule enablement blocked.");
}
if (review.locks?.ruleEnabled !== false || review.locks?.productionRuleRegistryMutated !== false || review.locks?.packagingUnlocked !== false) {
  block("source_review_locks_not_closed", "Source review must keep rule, registry, and packaging locks closed.");
}
if (receipt.sourceReviewId && receipt.sourceReviewId !== review.reviewId) block("source_review_id_mismatch", "Receipt sourceReviewId does not match review.");
if (receipt.sourceReviewPath && reviewInput.path && resolve(receipt.sourceReviewPath) !== reviewInput.path) {
  block("source_review_path_mismatch", "Receipt sourceReviewPath does not match the provided review path.");
}
if (receipt.sourceReviewHash && receipt.sourceReviewHash !== hashText(JSON.stringify(review))) {
  block("source_review_hash_mismatch", "Receipt sourceReviewHash does not match the candidate ledger review packet.");
}
if (!receipt.sourceReviewFormat || receipt.sourceReviewFormat !== review.sourceReviewFormat) {
  block("receipt_source_review_format_mismatch", "Receipt sourceReviewFormat must match the candidate ledger review source format.");
}
if (!receipt.sourceConfirmedOutcomeReviewId || receipt.sourceConfirmedOutcomeReviewId !== review.sourceConfirmedOutcomeReviewId) {
  block(
    "receipt_source_confirmed_outcome_review_id_mismatch",
    "Receipt sourceConfirmedOutcomeReviewId must match the candidate ledger review confirmed outcome review id."
  );
}
if (!receipt.sourceConfirmedOutcomeSourceRunId || receipt.sourceConfirmedOutcomeSourceRunId !== review.sourceConfirmedOutcomeSourceRunId) {
  block(
    "receipt_source_confirmed_outcome_source_run_id_mismatch",
    "Receipt sourceConfirmedOutcomeSourceRunId must match the candidate ledger review confirmed outcome source run id."
  );
}
if (!receipt.sourceRunId || receipt.sourceRunId !== review.sourceRunId) {
  block("receipt_source_run_id_mismatch", "Receipt sourceRunId must match the candidate ledger review sourceRunId.");
}

const ruleCandidatePath = handoff?.ruleActivationCandidatePath || review.ruleActivationCandidatePath || "";
if (!ruleCandidatePath || !existsSync(ruleCandidatePath)) block("rule_activation_candidate_missing", "Rule activation candidate must exist.");
let ruleCandidate = null;
try {
  if (ruleCandidatePath && existsSync(ruleCandidatePath)) ruleCandidate = readJson(ruleCandidatePath);
} catch (error) {
  block("rule_activation_candidate_parse_error", error?.message || String(error));
}
if (ruleCandidate && ruleCandidate.format !== "transparent_ai_real_case_confirmed_outcome_rule_activation_candidate_v1") {
  block("rule_activation_candidate_format_mismatch", "Rule activation candidate format is not recognized.");
}
if (ruleCandidate && ruleCandidate.confirmedOutcomeBranch !== true) {
  block("rule_activation_candidate_confirmed_outcome_branch_missing", "Rule activation candidate must preserve confirmedOutcomeBranch=true.");
}
if (ruleCandidate && ruleCandidate.sourceReviewFormat !== EXPECTED_SOURCE_REVIEW_FORMAT) {
  block("rule_activation_candidate_source_review_format_mismatch", "Rule activation candidate must preserve the confirmed-outcome source review format.");
}
if (ruleCandidate && ruleCandidate.sourceConfirmedOutcomeReviewId !== review.sourceConfirmedOutcomeReviewId) {
  block(
    "rule_activation_candidate_confirmed_outcome_review_id_mismatch",
    "Rule activation candidate must preserve the confirmed outcome review id."
  );
}
if (ruleCandidate && ruleCandidate.sourceConfirmedOutcomeSourceRunId !== review.sourceConfirmedOutcomeSourceRunId) {
  block(
    "rule_activation_candidate_confirmed_outcome_source_run_id_mismatch",
    "Rule activation candidate must preserve the confirmed outcome source run id."
  );
}
if (ruleCandidate && ruleCandidate.sourceRunId !== review.sourceRunId) {
  block("rule_activation_candidate_source_run_id_mismatch", "Rule activation candidate must preserve sourceRunId.");
}
if (ruleCandidate?.ruleEnabled !== false || ruleCandidate?.productionRuleRegistryMutated !== false) {
  block("rule_activation_candidate_not_disabled", "Rule activation candidate must remain disabled and must not mutate the production rule registry.");
}
if (ruleCandidatePath && existsSync(ruleCandidatePath) && receipt.ruleActivationCandidateSha256 && receipt.ruleActivationCandidateSha256 !== hashFile(ruleCandidatePath)) {
  block("rule_activation_candidate_hash_mismatch", "Receipt ruleActivationCandidateSha256 does not match the rule activation candidate.");
}
const candidateLedgerPath = handoff?.candidateLedgerPath || review.candidateLedgerPath || "";
if (candidateLedgerPath && existsSync(candidateLedgerPath) && receipt.candidateLedgerSha256 && receipt.candidateLedgerSha256 !== hashFile(candidateLedgerPath)) {
  block("candidate_ledger_hash_mismatch", "Receipt candidateLedgerSha256 does not match the candidate ledger.");
}
const rollbackPoint = receipt.rollbackPoint ? resolve(receipt.rollbackPoint) : "";
if (!rollbackPoint || !existsSync(rollbackPoint)) block("rollback_point_not_found", "Receipt must provide an existing rollbackPoint.");
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Teacher decision ${decision} is not allowed in this Rule DSL lifecycle gate.`);

const requiredConfirmations = [
  ["candidateLedgerReviewReviewed", "candidate_ledger_review_not_reviewed"],
  ["ruleDslLifecycleHandoffReviewed", "rule_dsl_lifecycle_handoff_not_reviewed"],
  ["ruleActivationCandidateReviewed", "rule_activation_candidate_not_reviewed"],
  ["candidateHashesReviewed", "candidate_hashes_not_reviewed"],
  ["draftDisabledLifecycleConfirmed", "draft_disabled_lifecycle_not_confirmed"],
  ["deterministicValidatorBoundaryConfirmed", "deterministic_validator_boundary_not_confirmed"],
  ["rollbackRetained", "rollback_not_retained"],
  ["noActiveRuleEnableConfirmed", "no_active_rule_enable_not_confirmed"],
  ["noRuleRegistryMutationConfirmed", "no_rule_registry_mutation_not_confirmed"],
  ["noRagAuthorityConfirmed", "no_rag_authority_not_confirmed"],
  ["noSoftwareExecutionConfirmed", "no_software_execution_not_confirmed"],
  ["noPackagingUnlockConfirmed", "no_packaging_unlock_not_confirmed"],
  ["noCompletionClaimConfirmed", "no_completion_claim_not_confirmed"]
];
for (const [field, code] of requiredConfirmations) {
  if (receipt[field] !== true) block(code, `${field} must be true before Rule DSL lifecycle planning.`);
}
if (decision === "request_high_reasoning_repair" && !String(receipt.teacherCorrection || receipt.teacherNotes || "").trim()) {
  block("repair_requires_teacher_correction", "High-reasoning repair requires teacherCorrection or teacherNotes.");
}
if (
  !["approve_rule_dsl_draft_planning", "request_high_reasoning_repair", "request_more_evidence", "blocked", "needs_teacher_review"].includes(
    decision
  ) &&
  !forbiddenDecisions.has(decision)
) {
  block("unknown_teacher_decision", `Teacher decision ${decision} is not recognized.`);
}

const reviewed = blockers.length === 0;
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${review.sourceActivationId || "rule-dsl-lifecycle"}`;
const gateDir = join(outRoot, gateId.replace(/[\\/:*?"<>|]/g, "_"));
const gatePath = join(gateDir, "real-case-confirmed-outcome-rule-dsl-lifecycle-gate.json");
const receiptRecordPath = join(gateDir, "teacher-rule-dsl-lifecycle-receipt.json");
const readmePath = join(gateDir, "REAL_CASE_CONFIRMED_OUTCOME_RULE_DSL_LIFECYCLE_START_HERE.md");
const gateLocks = locks({ reviewed });
const confirmedOutcomeBranch =
  review.confirmedOutcomeBranch === true && handoff?.confirmedOutcomeBranch === true && ruleCandidate?.confirmedOutcomeBranch === true;
const sourceReviewFormat = review.sourceReviewFormat || handoff?.sourceReviewFormat || ruleCandidate?.sourceReviewFormat || "";
const sourceConfirmedOutcomeReviewId = review.sourceConfirmedOutcomeReviewId || "";
const sourceConfirmedOutcomeSourceRunId = review.sourceConfirmedOutcomeSourceRunId || "";
const sourceRunId = review.sourceRunId || handoff?.sourceRunId || ruleCandidate?.sourceRunId || review.sourceActivationId || "";

const ruleDslDraftPlanningHandoff =
  reviewed && decision === "approve_rule_dsl_draft_planning"
    ? {
        format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_planning_handoff_v1",
        confirmedOutcomeBranch,
        sourceReviewFormat,
        sourceConfirmedOutcomeReviewId,
        sourceConfirmedOutcomeSourceRunId,
        sourceRunId,
        sourceReviewId: review.reviewId,
        sourceActivationId: review.sourceActivationId,
        candidateLedgerReviewPath: reviewInput.path,
        candidateLedgerReviewSha256: hashText(JSON.stringify(review)),
        candidateLedgerPath,
        candidateLedgerSha256: candidateLedgerPath && existsSync(candidateLedgerPath) ? hashFile(candidateLedgerPath) : "",
        ruleActivationCandidatePath: ruleCandidatePath,
        ruleActivationCandidateSha256: ruleCandidatePath && existsSync(ruleCandidatePath) ? hashFile(ruleCandidatePath) : "",
        proposedLifecycle: "draft_disabled",
        ruleCardPreparationMode: "teacher_reviewed_draft_disabled_planning_only",
        deterministicValidatorRequired: true,
        validatorMayCallModel: false,
        validatorMayUseNetwork: false,
        validatorMayWriteFiles: false,
        nextRequiredGate: "draft_disabled_rule_card_preparation_or_rule_dsl_validation_gate",
        rollbackPoint,
        teacherNotes: receipt.teacherNotes || "",
        executeNow: false,
        ruleFilesModifiedHere: false,
        rulePackageCompiledHere: false,
        ruleEnableAllowedHere: false,
        productionRuleRegistryMutationAllowedHere: false,
        memoryWriteAllowedHere: false,
        ragFetchAllowedHere: false,
        ragEvidenceTreatedAsAuthority: false,
        packagingUnlockAllowedHere: false,
        accepted: false,
        goalComplete: false
      }
    : null;

const highReasoningRepairHandoff =
  reviewed && decision === "request_high_reasoning_repair"
    ? {
        format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_high_reasoning_repair_handoff_v1",
        confirmedOutcomeBranch,
        sourceReviewFormat,
        sourceConfirmedOutcomeReviewId,
        sourceConfirmedOutcomeSourceRunId,
        sourceRunId,
        sourceReviewId: review.reviewId,
        sourceActivationId: review.sourceActivationId,
        candidateLedgerReviewPath: reviewInput.path,
        ruleActivationCandidatePath: ruleCandidatePath,
        teacherCorrection: receipt.teacherCorrection || receipt.teacherNotes || "",
        requiredReasoningTier: "high",
        nextAction: "repair_rule_dsl_lifecycle_plan_or_candidate_logic_before_draft_planning",
        executeNow: false,
        ruleEnableAllowedHere: false,
        productionRuleRegistryMutationAllowedHere: false,
        memoryWriteAllowedHere: false,
        ragFetchAllowedHere: false,
        packagingUnlockAllowedHere: false,
        accepted: false,
        goalComplete: false
      }
    : null;

const status =
  blockers.length > 0
    ? "real_case_confirmed_outcome_rule_dsl_lifecycle_gate_blocked"
    : decision === "approve_rule_dsl_draft_planning"
      ? "real_case_confirmed_outcome_rule_dsl_lifecycle_ready_for_draft_disabled_planning"
      : decision === "request_high_reasoning_repair"
        ? "real_case_confirmed_outcome_rule_dsl_lifecycle_routes_to_high_reasoning_repair"
        : "real_case_confirmed_outcome_rule_dsl_lifecycle_needs_teacher_follow_up";

const packet = {
  ok: blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  confirmedOutcomeBranch,
  sourceReviewFormat,
  sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId,
  sourceRunId,
  sourceReviewId: review.reviewId,
  sourceReviewPath: reviewInput.path,
  sourceReviewHash: hashText(JSON.stringify(review)),
  receiptPath: receiptInput.path,
  ruleActivationCandidatePath: ruleCandidatePath,
  ruleActivationCandidateSha256: ruleCandidatePath && existsSync(ruleCandidatePath) ? hashFile(ruleCandidatePath) : "",
  ruleDslDraftPlanningHandoff,
  highReasoningRepairHandoff,
  blockers,
  nextTeacherActions:
    blockers.length > 0
      ? ["Resolve blockers before Rule DSL lifecycle planning."]
      : decision === "approve_rule_dsl_draft_planning"
        ? ["Use the draft-disabled Rule DSL planning handoff in a separate rule-card preparation or validation gate."]
        : decision === "request_high_reasoning_repair"
          ? ["Send the Rule DSL lifecycle route and teacher correction to high-reasoning repair."]
          : ["Collect missing teacher evidence before Rule DSL lifecycle planning."],
  locks: gateLocks,
  paths: {
    gate: gatePath,
    receiptRecord: receiptRecordPath,
    readme: readmePath
  }
};

writeJson(gatePath, packet);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed Outcome Rule DSL Lifecycle Gate",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Source candidate-ledger review: ${reviewInput.path || review.reviewId}`,
    `Rule activation candidate: ${ruleCandidatePath || "missing"}`,
    "",
    "This gate prepares only draft-disabled Rule DSL planning or high-reasoning repair.",
    "It does not modify rule files, compile packages, enable rules, write memory, fetch RAG, execute software, unlock packaging, accept technology, or complete the whole apprentice objective.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((row) => `- ${row.code}: ${row.message}`) : ["- none"]),
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: packet.ok,
      format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_gate_result_v1",
      status,
      gatePath,
      receiptRecordPath,
      readmePath,
      decision,
      confirmedOutcomeBranch,
      sourceReviewFormat,
      sourceConfirmedOutcomeReviewId,
      sourceConfirmedOutcomeSourceRunId,
      sourceRunId,
      sourceReviewId: review.reviewId,
      ruleDslDraftPlanningHandoff,
      highReasoningRepairHandoff,
      blockers,
      ruleFilesModified: false,
      rulePackageCompiled: false,
      productionRuleRegistryMutated: false,
      memoryWritten: false,
      ruleEnabled: false,
      ragFetched: false,
      ragEvidenceTreatedAsAuthority: false,
      accepted: false,
      packagingGated: true,
      packagingUnlocked: false,
      goalComplete: false,
      locks: gateLocks
    },
    null,
    2
  )
);

if (!packet.ok) process.exitCode = 1;
