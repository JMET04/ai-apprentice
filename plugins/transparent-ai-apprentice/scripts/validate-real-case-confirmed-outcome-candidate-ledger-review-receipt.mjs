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
  if (["approve_memory_lifecycle_review", "memory_lifecycle", "route_to_memory_lifecycle"].includes(text)) {
    return "approve_memory_lifecycle_review";
  }
  if (["approve_rule_dsl_lifecycle_review", "rule_dsl_lifecycle", "route_to_rule_dsl_lifecycle"].includes(text)) {
    return "approve_rule_dsl_lifecycle_review";
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

function locks({ reviewed = false } = {}) {
  return {
    reviewOnly: true,
    candidateLedgerReviewed: reviewed,
    noCandidateMutationHere: true,
    productionMemoryWritten: false,
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
    requiresSeparateMemoryOrRuleLifecycleGate: true
  };
}

const runnerInput = readJsonInput(
  argValue("--runner", argValue("--activation-runner", "")),
  "--runner",
  "transparent_ai_real_case_confirmed_outcome_separate_durable_activation_runner_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_confirmed_outcome_candidate_ledger_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-candidate-ledger-reviews"))
);

const runner = runnerInput.value;
const receipt = receiptInput.value;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

const decision = normalizeDecision(receipt.teacherDecision ?? receipt.decision ?? receipt.teacherReview?.nextDecision);
const forbiddenDecisions = new Set([
  "write_memory",
  "enable_rule",
  "activate_rule",
  "mutate_rule_registry",
  "fetch_rag",
  "treat_rag_as_authority",
  "execute_software",
  "unlock_packaging",
  "accepted",
  "accept",
  "claim_complete",
  "goal_complete"
]);
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

if (runner.status !== "real_case_confirmed_outcome_separate_durable_activation_runner_completed_waiting_for_lifecycle_review") {
  block("runner_not_waiting_for_lifecycle_review", "Runner must be completed and waiting for lifecycle review.");
}
if (runner.candidateLedgerWritten !== true || !runner.ledgerPath || !existsSync(runner.ledgerPath)) {
  block("candidate_ledger_missing", "Runner must have written a candidate ledger file.");
}
if (runner.confirmedOutcomeBranch !== true) {
  block("confirmed_outcome_branch_missing", "Runner must retain confirmedOutcomeBranch=true before candidate ledger review.");
}
if (runner.sourceReviewFormat !== expectedSourceReviewFormat) {
  block("source_review_format_not_confirmed_outcome", "Runner must retain the confirmed-outcome source review format.");
}
if (!runner.sourceConfirmedOutcomeReviewId || !runner.sourceConfirmedOutcomeSourceRunId) {
  block(
    "source_confirmed_outcome_ids_missing",
    "Runner must retain sourceConfirmedOutcomeReviewId and sourceConfirmedOutcomeSourceRunId."
  );
}
if (!runner.sourceRunId) {
  block("source_run_id_missing", "Runner must retain sourceRunId from the confirmed-outcome source chain.");
}
if (!runner.memoryCandidatePath || !existsSync(runner.memoryCandidatePath)) block("memory_candidate_missing", "Memory candidate file is missing.");
if (!runner.ruleActivationCandidatePath || !existsSync(runner.ruleActivationCandidatePath)) {
  block("rule_activation_candidate_missing", "Rule activation candidate file is missing.");
}
if (
  runner.locks?.productionMemoryWritten !== false ||
  runner.locks?.productionRuleRegistryMutated !== false ||
  runner.locks?.ruleEnabled !== false ||
  runner.locks?.packagingUnlocked !== false
) {
  block("source_runner_locks_not_closed", "Source runner must keep production memory, rules, and packaging locked.");
}
if (receipt.sourceActivationId && receipt.sourceActivationId !== runner.activationId) {
  block("source_activation_id_mismatch", "Receipt sourceActivationId does not match runner activationId.");
}
if (receipt.sourceRunnerPath && runnerInput.path && resolve(receipt.sourceRunnerPath) !== runnerInput.path) {
  block("source_runner_path_mismatch", "Receipt sourceRunnerPath does not match the provided runner path.");
}
if (receipt.sourceRunnerHash && receipt.sourceRunnerHash !== hashText(JSON.stringify(runner))) {
  block("source_runner_hash_mismatch", "Receipt sourceRunnerHash does not match the runner packet.");
}
if (!receipt.sourceReviewFormat || receipt.sourceReviewFormat !== runner.sourceReviewFormat) {
  block("receipt_source_review_format_mismatch", "Receipt sourceReviewFormat must match the source runner.");
}
if (!receipt.sourceConfirmedOutcomeReviewId || receipt.sourceConfirmedOutcomeReviewId !== runner.sourceConfirmedOutcomeReviewId) {
  block(
    "receipt_source_confirmed_outcome_review_id_mismatch",
    "Receipt sourceConfirmedOutcomeReviewId must match the source runner."
  );
}
if (
  !receipt.sourceConfirmedOutcomeSourceRunId ||
  receipt.sourceConfirmedOutcomeSourceRunId !== runner.sourceConfirmedOutcomeSourceRunId
) {
  block(
    "receipt_source_confirmed_outcome_source_run_id_mismatch",
    "Receipt sourceConfirmedOutcomeSourceRunId must match the source runner."
  );
}
if (!receipt.sourceRunId || receipt.sourceRunId !== runner.sourceRunId) {
  block("receipt_source_run_id_mismatch", "Receipt sourceRunId must match the source runner.");
}

let ledger = null;
let memoryCandidate = null;
let ruleCandidate = null;
try {
  if (runner.ledgerPath && existsSync(runner.ledgerPath)) ledger = readJson(runner.ledgerPath);
  if (runner.memoryCandidatePath && existsSync(runner.memoryCandidatePath)) memoryCandidate = readJson(runner.memoryCandidatePath);
  if (runner.ruleActivationCandidatePath && existsSync(runner.ruleActivationCandidatePath)) ruleCandidate = readJson(runner.ruleActivationCandidatePath);
} catch (error) {
  block("candidate_file_parse_error", error?.message || String(error));
}

if (ledger && ledger.format !== "transparent_ai_real_case_confirmed_outcome_durable_activation_ledger_v1") {
  block("candidate_ledger_format_mismatch", "Candidate ledger format is not recognized.");
}
if (memoryCandidate && memoryCandidate.format !== "transparent_ai_real_case_confirmed_outcome_memory_candidate_v1") {
  block("memory_candidate_format_mismatch", "Memory candidate format is not recognized.");
}
if (ruleCandidate && ruleCandidate.format !== "transparent_ai_real_case_confirmed_outcome_rule_activation_candidate_v1") {
  block("rule_candidate_format_mismatch", "Rule activation candidate format is not recognized.");
}
if (ledger && ledger.confirmedOutcomeBranch !== true) {
  block("candidate_ledger_confirmed_outcome_branch_missing", "Candidate ledger must retain confirmedOutcomeBranch=true.");
}
if (ledger && ledger.sourceReviewFormat !== expectedSourceReviewFormat) {
  block("candidate_ledger_source_review_format_mismatch", "Candidate ledger must retain the confirmed-outcome source review format.");
}
if (
  ledger &&
  (ledger.sourceConfirmedOutcomeReviewId !== runner.sourceConfirmedOutcomeReviewId ||
    ledger.sourceConfirmedOutcomeSourceRunId !== runner.sourceConfirmedOutcomeSourceRunId ||
    ledger.sourceRunId !== runner.sourceRunId)
) {
  block("candidate_ledger_source_ids_mismatch", "Candidate ledger source ids and sourceRunId must match the source runner.");
}
if (memoryCandidate && memoryCandidate.confirmedOutcomeBranch !== true) {
  block("memory_candidate_confirmed_outcome_branch_missing", "Memory candidate must retain confirmedOutcomeBranch=true.");
}
if (memoryCandidate && memoryCandidate.sourceReviewFormat !== expectedSourceReviewFormat) {
  block("memory_candidate_source_review_format_mismatch", "Memory candidate must retain the confirmed-outcome source review format.");
}
if (
  memoryCandidate &&
  (memoryCandidate.sourceConfirmedOutcomeReviewId !== runner.sourceConfirmedOutcomeReviewId ||
    memoryCandidate.sourceConfirmedOutcomeSourceRunId !== runner.sourceConfirmedOutcomeSourceRunId ||
    memoryCandidate.sourceRunId !== runner.sourceRunId)
) {
  block("memory_candidate_source_ids_mismatch", "Memory candidate source ids and sourceRunId must match the source runner.");
}
if (ruleCandidate && ruleCandidate.confirmedOutcomeBranch !== true) {
  block("rule_candidate_confirmed_outcome_branch_missing", "Rule activation candidate must retain confirmedOutcomeBranch=true.");
}
if (ruleCandidate && ruleCandidate.sourceReviewFormat !== expectedSourceReviewFormat) {
  block("rule_candidate_source_review_format_mismatch", "Rule activation candidate must retain the confirmed-outcome source review format.");
}
if (
  ruleCandidate &&
  (ruleCandidate.sourceConfirmedOutcomeReviewId !== runner.sourceConfirmedOutcomeReviewId ||
    ruleCandidate.sourceConfirmedOutcomeSourceRunId !== runner.sourceConfirmedOutcomeSourceRunId ||
    ruleCandidate.sourceRunId !== runner.sourceRunId)
) {
  block("rule_candidate_source_ids_mismatch", "Rule activation candidate source ids and sourceRunId must match the source runner.");
}
if (runner.ledgerPath && existsSync(runner.ledgerPath) && receipt.ledgerSha256 && receipt.ledgerSha256 !== hashFile(runner.ledgerPath)) {
  block("candidate_ledger_hash_mismatch", "Receipt ledgerSha256 does not match the candidate ledger.");
}
if (
  runner.memoryCandidatePath &&
  existsSync(runner.memoryCandidatePath) &&
  receipt.memoryCandidateSha256 &&
  receipt.memoryCandidateSha256 !== hashFile(runner.memoryCandidatePath)
) {
  block("memory_candidate_hash_mismatch", "Receipt memoryCandidateSha256 does not match the memory candidate.");
}
if (
  runner.ruleActivationCandidatePath &&
  existsSync(runner.ruleActivationCandidatePath) &&
  receipt.ruleActivationCandidateSha256 &&
  receipt.ruleActivationCandidateSha256 !== hashFile(runner.ruleActivationCandidatePath)
) {
  block("rule_activation_candidate_hash_mismatch", "Receipt ruleActivationCandidateSha256 does not match the rule activation candidate.");
}
if (memoryCandidate?.enabled !== false || memoryCandidate?.productionMemoryWritten !== false) {
  block("memory_candidate_not_disabled", "Memory candidate must remain disabled and not production-written.");
}
if (ruleCandidate?.ruleEnabled !== false || ruleCandidate?.productionRuleRegistryMutated !== false) {
  block("rule_candidate_not_disabled", "Rule activation candidate must remain disabled and must not mutate the production rule registry.");
}
if (ledger?.memoryWritten !== false || ledger?.ruleEnabled !== false || ledger?.ragEvidenceTreatedAsAuthority !== false) {
  block("ledger_locks_not_closed", "Candidate ledger must keep memory, rule, and RAG-authority locks closed.");
}
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Teacher decision ${decision} is not allowed in this review gate.`);

const requiredConfirmations = [
  ["runnerPacketReviewed", "runner_packet_not_reviewed"],
  ["candidateLedgerReviewed", "candidate_ledger_not_reviewed"],
  ["memoryCandidateReviewed", "memory_candidate_not_reviewed"],
  ["ruleActivationCandidateReviewed", "rule_activation_candidate_not_reviewed"],
  ["candidateHashesReviewed", "candidate_hashes_not_reviewed"],
  ["rollbackRetained", "rollback_not_retained"],
  ["lifecycleRouteReviewed", "lifecycle_route_not_reviewed"],
  ["noProductionMemoryWriteConfirmed", "no_production_memory_write_not_confirmed"],
  ["noRuleEnableConfirmed", "no_rule_enable_not_confirmed"],
  ["noRagAuthorityConfirmed", "no_rag_authority_not_confirmed"],
  ["noPackagingUnlockConfirmed", "no_packaging_unlock_not_confirmed"],
  ["noAcceptanceClaimConfirmed", "no_acceptance_claim_not_confirmed"],
  ["noExecutionConfirmed", "no_execution_not_confirmed"]
];
for (const [field, code] of requiredConfirmations) {
  if (receipt[field] !== true) block(code, `${field} must be true before candidate lifecycle routing.`);
}
if (decision === "request_high_reasoning_repair" && !String(receipt.teacherCorrection || receipt.teacherNotes || "").trim()) {
  block("repair_requires_teacher_correction", "High-reasoning repair requires teacherCorrection or teacherNotes.");
}
if (
  ![
    "approve_memory_lifecycle_review",
    "approve_rule_dsl_lifecycle_review",
    "request_high_reasoning_repair",
    "request_more_evidence",
    "blocked",
    "needs_teacher_review"
  ].includes(decision) &&
  !forbiddenDecisions.has(decision)
) {
  block("unknown_teacher_decision", `Teacher decision ${decision} is not recognized.`);
}

const reviewed = blockers.length === 0;
const confirmedOutcomeBranch = runner.confirmedOutcomeBranch === true;
const sourceReviewFormat = runner.sourceReviewFormat || "";
const sourceReviewId = ledger?.sourceReviewId || runner.durableActivationRequest?.sourceReviewId || "";
const sourceRunId = runner.sourceRunId || ledger?.sourceRunId || runner.durableActivationRequest?.sourceRunId || "";
const sourceConfirmedOutcomeReviewId = runner.sourceConfirmedOutcomeReviewId || "";
const sourceConfirmedOutcomeSourceRunId = runner.sourceConfirmedOutcomeSourceRunId || "";
const sourceContext = {
  confirmedOutcomeBranch,
  sourceReviewFormat,
  sourceReviewId,
  sourceRunId,
  sourceConfirmedOutcomeReviewId,
  sourceConfirmedOutcomeSourceRunId
};
const reviewId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${runner.activationId || "candidate-ledger-review"}`;
const reviewDir = join(outRoot, reviewId.replace(/[\\/:*?"<>|]/g, "_"));
const reviewPath = join(reviewDir, "real-case-confirmed-outcome-candidate-ledger-review.json");
const receiptRecordPath = join(reviewDir, "teacher-candidate-ledger-review-receipt.json");
const readmePath = join(reviewDir, "REAL_CASE_CONFIRMED_OUTCOME_CANDIDATE_LEDGER_REVIEW_START_HERE.md");
const reviewLocks = locks({ reviewed });

const memoryLifecycleHandoff =
  reviewed && decision === "approve_memory_lifecycle_review"
    ? {
        format: "transparent_ai_real_case_confirmed_outcome_memory_lifecycle_handoff_v1",
        ...sourceContext,
        sourceActivationId: runner.activationId,
        sourceRunnerPath: runnerInput.path,
        candidateLedgerPath: runner.ledgerPath,
        candidateLedgerSha256: runner.ledgerPath && existsSync(runner.ledgerPath) ? hashFile(runner.ledgerPath) : "",
        memoryCandidatePath: runner.memoryCandidatePath,
        memoryCandidateSha256:
          runner.memoryCandidatePath && existsSync(runner.memoryCandidatePath) ? hashFile(runner.memoryCandidatePath) : "",
        teacherNotes: receipt.teacherNotes || "",
        nextRequiredGate: "memory_candidate_lifecycle_gate",
        executeNow: false,
        productionMemoryWriteAllowedHere: false,
        ruleEnableAllowedHere: false,
        ragFetchAllowedHere: false,
        packagingUnlockAllowedHere: false,
        accepted: false,
        goalComplete: false
      }
    : null;

const ruleDslLifecycleHandoff =
  reviewed && decision === "approve_rule_dsl_lifecycle_review"
    ? {
        format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_handoff_v1",
        ...sourceContext,
        sourceActivationId: runner.activationId,
        sourceRunnerPath: runnerInput.path,
        candidateLedgerPath: runner.ledgerPath,
        candidateLedgerSha256: runner.ledgerPath && existsSync(runner.ledgerPath) ? hashFile(runner.ledgerPath) : "",
        ruleActivationCandidatePath: runner.ruleActivationCandidatePath,
        ruleActivationCandidateSha256:
          runner.ruleActivationCandidatePath && existsSync(runner.ruleActivationCandidatePath)
            ? hashFile(runner.ruleActivationCandidatePath)
            : "",
        teacherNotes: receipt.teacherNotes || "",
        nextRequiredGate: "rule_dsl_lifecycle_gate",
        executeNow: false,
        memoryWriteAllowedHere: false,
        ruleEnableAllowedHere: false,
        ragFetchAllowedHere: false,
        packagingUnlockAllowedHere: false,
        accepted: false,
        goalComplete: false
      }
    : null;

const highReasoningRepairHandoff =
  reviewed && decision === "request_high_reasoning_repair"
    ? {
        format: "transparent_ai_real_case_confirmed_outcome_candidate_ledger_high_reasoning_repair_handoff_v1",
        ...sourceContext,
        sourceActivationId: runner.activationId,
        sourceRunnerPath: runnerInput.path,
        candidateLedgerPath: runner.ledgerPath,
        memoryCandidatePath: runner.memoryCandidatePath,
        ruleActivationCandidatePath: runner.ruleActivationCandidatePath,
        teacherCorrection: receipt.teacherCorrection || receipt.teacherNotes || "",
        requiredReasoningTier: "high",
        nextAction: "repair_candidate_ledger_lifecycle_route_or_durable_logic_contract",
        executeNow: false,
        memoryWriteAllowedHere: false,
        ruleEnableAllowedHere: false,
        ragFetchAllowedHere: false,
        packagingUnlockAllowedHere: false,
        accepted: false,
        goalComplete: false
      }
    : null;

const status =
  blockers.length > 0
    ? "real_case_confirmed_outcome_candidate_ledger_review_blocked"
    : decision === "approve_memory_lifecycle_review"
      ? "real_case_confirmed_outcome_candidate_ledger_routes_to_memory_lifecycle_gate"
      : decision === "approve_rule_dsl_lifecycle_review"
        ? "real_case_confirmed_outcome_candidate_ledger_routes_to_rule_dsl_lifecycle_gate"
        : decision === "request_high_reasoning_repair"
          ? "real_case_confirmed_outcome_candidate_ledger_routes_to_high_reasoning_repair"
          : "real_case_confirmed_outcome_candidate_ledger_review_needs_teacher_follow_up";

const packet = {
  ok: blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_candidate_ledger_review_v1",
  reviewId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  ...sourceContext,
  sourceActivationId: runner.activationId,
  sourceRunnerPath: runnerInput.path,
  sourceRunnerHash: hashText(JSON.stringify(runner)),
  receiptPath: receiptInput.path,
  candidateLedgerPath: runner.ledgerPath || "",
  candidateLedgerSha256: runner.ledgerPath && existsSync(runner.ledgerPath) ? hashFile(runner.ledgerPath) : "",
  memoryCandidatePath: runner.memoryCandidatePath || "",
  memoryCandidateSha256: runner.memoryCandidatePath && existsSync(runner.memoryCandidatePath) ? hashFile(runner.memoryCandidatePath) : "",
  ruleActivationCandidatePath: runner.ruleActivationCandidatePath || "",
  ruleActivationCandidateSha256:
    runner.ruleActivationCandidatePath && existsSync(runner.ruleActivationCandidatePath)
      ? hashFile(runner.ruleActivationCandidatePath)
      : "",
  memoryLifecycleHandoff,
  ruleDslLifecycleHandoff,
  highReasoningRepairHandoff,
  blockers,
  nextTeacherActions:
    blockers.length > 0
      ? ["Resolve blockers before routing candidate ledger evidence."]
      : decision === "approve_memory_lifecycle_review"
        ? ["Use the memory lifecycle gate with this handoff; do not write production memory from this review gate."]
        : decision === "approve_rule_dsl_lifecycle_review"
          ? ["Use the Rule DSL lifecycle gate with this handoff; do not enable rules from this review gate."]
          : decision === "request_high_reasoning_repair"
            ? ["Send the candidate ledger route or durable logic contract to high-reasoning repair."]
            : ["Collect missing teacher evidence before lifecycle routing."],
  locks: reviewLocks,
  paths: {
    review: reviewPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath
  }
};

writeJson(reviewPath, packet);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real-Case Confirmed Outcome Candidate Ledger Review",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Source runner: ${runnerInput.path || runner.activationId}`,
    `Candidate ledger: ${runner.ledgerPath || "missing"}`,
    "",
    "This gate reviews durable candidate ledger files and routes them to a later memory lifecycle gate, Rule DSL lifecycle gate, or high-reasoning repair.",
    "It does not write production memory, enable rules, fetch RAG, execute target software, unlock packaging, accept technology, or complete the whole apprentice objective.",
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
      format: "transparent_ai_real_case_confirmed_outcome_candidate_ledger_review_result_v1",
      status,
      reviewPath,
      receiptRecordPath,
      readmePath,
      decision,
      ...sourceContext,
      sourceActivationId: runner.activationId,
      candidateLedgerPath: packet.candidateLedgerPath,
      candidateLedgerSha256: packet.candidateLedgerSha256,
      memoryLifecycleHandoff,
      ruleDslLifecycleHandoff,
      highReasoningRepairHandoff,
      blockers,
      productionMemoryWritten: false,
      productionRuleRegistryMutated: false,
      memoryWritten: false,
      ruleEnabled: false,
      ragFetched: false,
      ragEvidenceTreatedAsAuthority: false,
      accepted: false,
      packagingGated: true,
      packagingUnlocked: false,
      goalComplete: false,
      locks: reviewLocks
    },
    null,
    2
  )
);

if (!packet.ok) process.exitCode = 1;
