#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const EXPECTED_CONFIRMED_OUTCOME_REVIEW_FORMAT =
  "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

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
  if (["approve_durable_activation_gate", "approve_activation_gate", "ready_for_activation_gate", "approve"].includes(text)) {
    return "approve_durable_activation_gate";
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

function locks({ approved = false } = {}) {
  return {
    reviewOnly: true,
    confirmedOutcomeActivationGate: approved,
    noExecutionHere: true,
    targetSoftwareCommandsExecuted: false,
    targetSoftwareCommandsExecutedAgain: false,
    uiEventsSent: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    ragEvidenceTreatedAsAuthority: false,
    ruleEnabled: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateDurableActivationRunner: true,
    executeNow: false
  };
}

const reviewInput = readJsonInput(
  argValue("--outcome-review", argValue("--review", "")),
  "--outcome-review"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_confirmed_outcome_durable_activation_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-confirmed-outcome-durable-activation-gates"))
);

const review = reviewInput.value;
const receipt = receiptInput.value;
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

const decision = normalizeDecision(receipt.teacherDecision ?? receipt.decision);
const allowedReviewFormats = new Set([
  "transparent_ai_real_case_separate_real_runner_outcome_review_v1",
  "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1"
]);
if (!allowedReviewFormats.has(review.format)) {
  block(
    "unsupported_outcome_review_format",
    "Outcome review must be a real-case separate runner review or a confirmed-outcome separate runner review."
  );
}
const isConfirmedOutcomeReview = review.format === "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";
const forbiddenDecisions = new Set([
  "write_memory",
  "enable_rule",
  "activate_rule",
  "fetch_rag",
  "treat_rag_as_authority",
  "unlock_packaging",
  "accepted",
  "accept",
  "claim_complete",
  "goal_complete",
  "execute_software",
  "run_activation_now",
  "run_now"
]);

if (review.status !== "real_case_separate_real_runner_outcome_confirmed_waiting_for_memory_or_rule_gate") {
  if (review.status !== "real_case_confirmed_outcome_separate_real_runner_outcome_confirmed_waiting_for_memory_or_rule_gate") {
    block("outcome_review_not_confirmed", "Outcome review must be confirmed and waiting for a memory or rule activation gate.");
  }
}
if (
  !review.confirmedOutcomeHandoff ||
  ![
    "transparent_ai_real_case_separate_real_runner_confirmed_outcome_handoff_v1",
    "transparent_ai_real_case_confirmed_outcome_separate_real_runner_confirmed_outcome_handoff_v1"
  ].includes(review.confirmedOutcomeHandoff.format)
) {
  block("confirmed_outcome_handoff_missing", "Outcome review must contain the confirmed outcome handoff.");
}
if (isConfirmedOutcomeReview && review.confirmedOutcomeBranch !== true) {
  block("confirmed_outcome_branch_missing", "Confirmed-outcome reviews must retain confirmedOutcomeBranch=true.");
}
if (isConfirmedOutcomeReview && review.confirmedOutcomeHandoff?.confirmedOutcomeBranch !== true) {
  block("confirmed_outcome_handoff_branch_missing", "Confirmed-outcome handoff must retain confirmedOutcomeBranch=true.");
}
if (isConfirmedOutcomeReview && review.sourceReviewFormat !== EXPECTED_CONFIRMED_OUTCOME_REVIEW_FORMAT) {
  block(
    "confirmed_outcome_source_review_format_mismatch",
    "Confirmed-outcome review must retain its upstream confirmed-outcome outcome-review source format."
  );
}
if (isConfirmedOutcomeReview && (!review.sourceConfirmedOutcomeReviewId || !review.sourceConfirmedOutcomeSourceRunId || !review.sourceRunId)) {
  block(
    "confirmed_outcome_source_ids_missing",
    "Confirmed-outcome review must retain sourceConfirmedOutcomeReviewId, sourceConfirmedOutcomeSourceRunId, and sourceRunId."
  );
}
if (
  isConfirmedOutcomeReview &&
  review.confirmedOutcomeHandoff &&
  (review.confirmedOutcomeHandoff.sourceReviewFormat !== review.sourceReviewFormat ||
    review.confirmedOutcomeHandoff.sourceConfirmedOutcomeReviewId !== review.sourceConfirmedOutcomeReviewId ||
    review.confirmedOutcomeHandoff.sourceConfirmedOutcomeSourceRunId !== review.sourceConfirmedOutcomeSourceRunId ||
    review.confirmedOutcomeHandoff.sourceRunId !== review.sourceRunId)
) {
  block("confirmed_outcome_handoff_source_mismatch", "Confirmed-outcome handoff source lineage must match the review packet.");
}
if (review.confirmedOutcomeHandoff?.memoryWriteAllowedHere !== false || review.confirmedOutcomeHandoff?.ruleEnableAllowedHere !== false) {
  block("source_handoff_allows_durable_action_too_early", "Source handoff must keep memory writes and rule enablement blocked here.");
}
if (
  review.locks?.memoryWritten !== false ||
  review.locks?.ruleEnabled !== false ||
  review.locks?.packagingUnlocked !== false ||
  (isConfirmedOutcomeReview && review.locks?.confirmedOutcomeBranch !== true)
) {
  block("source_review_locks_not_closed", "Source review must keep memory, rule, and packaging locks closed.");
}
if (receipt.sourceReviewId && receipt.sourceReviewId !== review.reviewId) block("source_review_id_mismatch", "Receipt sourceReviewId does not match outcome review.");
if (isConfirmedOutcomeReview && receipt.sourceReviewFormat !== review.sourceReviewFormat) {
  block("receipt_source_review_format_mismatch", "Receipt sourceReviewFormat must match the confirmed-outcome review packet.");
}
if (isConfirmedOutcomeReview && receipt.sourceConfirmedOutcomeReviewId !== review.sourceConfirmedOutcomeReviewId) {
  block(
    "receipt_source_confirmed_outcome_review_id_mismatch",
    "Receipt sourceConfirmedOutcomeReviewId must match the confirmed-outcome review packet."
  );
}
if (isConfirmedOutcomeReview && receipt.sourceConfirmedOutcomeSourceRunId !== review.sourceConfirmedOutcomeSourceRunId) {
  block(
    "receipt_source_confirmed_outcome_source_run_id_mismatch",
    "Receipt sourceConfirmedOutcomeSourceRunId must match the confirmed-outcome review packet."
  );
}
if (isConfirmedOutcomeReview && receipt.sourceRunId !== review.sourceRunId) {
  block("receipt_source_run_id_mismatch", "Receipt sourceRunId must match the confirmed-outcome review packet sourceRunId.");
}
if (receipt.sourceReviewPath && reviewInput.path && resolve(receipt.sourceReviewPath) !== reviewInput.path) {
  block("source_review_path_mismatch", "Receipt sourceReviewPath does not match the provided outcome review path.");
}
if (receipt.sourceReviewHash && receipt.sourceReviewHash !== hashText(JSON.stringify(review))) {
  block("source_review_hash_mismatch", "Receipt sourceReviewHash does not match the outcome review packet.");
}

const outputPath = receipt.controlledOutputPath || review.confirmedOutcomeHandoff?.controlledOutputPath || review.outputPath || "";
if (!outputPath || !existsSync(outputPath)) block("controlled_output_missing", "Controlled output must still exist before durable activation planning.");
if (outputPath && existsSync(outputPath) && receipt.controlledOutputSha256 && receipt.controlledOutputSha256 !== hashFile(outputPath)) {
  block("controlled_output_hash_mismatch", "Receipt controlledOutputSha256 does not match the controlled output.");
}
if (
  outputPath &&
  existsSync(outputPath) &&
  review.confirmedOutcomeHandoff?.controlledOutputSha256 &&
  review.confirmedOutcomeHandoff.controlledOutputSha256 !== hashFile(outputPath)
) {
  block("source_handoff_output_hash_mismatch", "Source handoff controlled output hash no longer matches the file.");
}
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Teacher decision ${decision} is not allowed in this activation gate.`);

const requiredConfirmations = [
  ["outcomeReviewPacketReviewed", "outcome_review_packet_not_reviewed"],
  ["confirmedHandoffReviewed", "confirmed_handoff_not_reviewed"],
  ["controlledOutputReviewed", "controlled_output_not_reviewed"],
  ["outputHashReviewed", "output_hash_not_reviewed"],
  ["durableScopeReviewed", "durable_scope_not_reviewed"],
  ["activationBoundaryConfirmed", "activation_boundary_not_confirmed"],
  ["rollbackRetained", "rollback_not_retained"],
  ["noImmediateMemoryWriteConfirmed", "no_immediate_memory_write_not_confirmed"],
  ["noImmediateRuleEnableConfirmed", "no_immediate_rule_enable_not_confirmed"],
  ["noRagAuthorityConfirmed", "no_rag_authority_not_confirmed"],
  ["noPackagingUnlockConfirmed", "no_packaging_unlock_not_confirmed"],
  ["noAcceptanceClaimConfirmed", "no_acceptance_claim_not_confirmed"],
  ["noExecutionConfirmed", "no_execution_not_confirmed"]
];
for (const [field, code] of requiredConfirmations) {
  if (receipt[field] !== true) block(code, `${field} must be true before a durable activation request can be prepared.`);
}
if (decision === "request_high_reasoning_repair" && !String(receipt.teacherCorrection || receipt.teacherNotes || "").trim()) {
  block("repair_requires_teacher_correction", "High-reasoning repair requires teacherCorrection or teacherNotes.");
}
if (
  !["approve_durable_activation_gate", "request_high_reasoning_repair", "request_more_evidence", "blocked", "needs_teacher_review"].includes(
    decision
  ) &&
  !forbiddenDecisions.has(decision)
) {
  block("unknown_teacher_decision", `Teacher decision ${decision} is not recognized.`);
}

const approved = blockers.length === 0 && decision === "approve_durable_activation_gate";
const routesToRepair = blockers.length === 0 && decision === "request_high_reasoning_repair";
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${review.sourceRunId || "confirmed-outcome"}`;
const gateDir = join(outRoot, gateId.replace(/[\\/:*?"<>|]/g, "_"));
const gatePath = join(gateDir, "real-case-confirmed-outcome-durable-activation-gate.json");
const receiptRecordPath = join(gateDir, "real-case-confirmed-outcome-durable-activation-receipt.json");
const readmePath = join(gateDir, "REAL_CASE_CONFIRMED_OUTCOME_DURABLE_ACTIVATION_START_HERE.md");
const gateLocks = locks({ approved });
const sourceContext = {
  confirmedOutcomeBranch: isConfirmedOutcomeReview,
  sourceReviewFormat: review.format,
  sourceReviewId: review.reviewId,
  sourceRunId: review.sourceRunId,
  sourceConfirmedOutcomeReviewId: isConfirmedOutcomeReview ? review.sourceConfirmedOutcomeReviewId : "",
  sourceConfirmedOutcomeSourceRunId: isConfirmedOutcomeReview ? review.sourceConfirmedOutcomeSourceRunId : ""
};

const durableActivationRequest = approved
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_durable_activation_request_v1",
      ...sourceContext,
      controlledOutputPath: outputPath,
      controlledOutputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
      activationScope: receipt.activationScope || "memory_or_rule_candidate",
      requestedDurableArtifacts: receipt.requestedDurableArtifacts || ["memory_candidate", "rule_activation_candidate"],
      teacherNotes: receipt.teacherNotes || "",
      executeNow: false,
      requiresSeparateDurableActivationRunner: true,
      requiresFinalTeacherActivationConfirmation: true,
      memoryWriteAllowedHere: false,
      ruleEnableAllowedHere: false,
      ragFetchAllowedHere: false,
      ragEvidenceTreatedAsAuthority: false,
      packagingUnlockAllowedHere: false,
      accepted: false,
      goalComplete: false
    }
  : null;

const highReasoningRepairHandoff = routesToRepair
  ? {
      format: "transparent_ai_real_case_confirmed_outcome_activation_high_reasoning_repair_handoff_v1",
      ...sourceContext,
      controlledOutputPath: outputPath,
      controlledOutputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
      teacherCorrection: receipt.teacherCorrection || receipt.teacherNotes || "",
      requiredReasoningTier: "high",
      nextAction: "repair_durable_activation_scope_or_logic_contract_before_memory_or_rule_enablement",
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
    ? "real_case_confirmed_outcome_durable_activation_gate_blocked"
    : approved
      ? "real_case_confirmed_outcome_durable_activation_gate_ready_for_separate_activation_runner"
      : routesToRepair
        ? "real_case_confirmed_outcome_durable_activation_routes_to_high_reasoning_repair"
        : "real_case_confirmed_outcome_durable_activation_needs_teacher_follow_up";

const packet = {
  ok: blockers.length === 0,
  format: "transparent_ai_real_case_confirmed_outcome_durable_activation_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  status,
  ...sourceContext,
  decision,
  sourceReviewPath: reviewInput.path,
  sourceReviewHash: hashText(JSON.stringify(review)),
  receiptPath: receiptInput.path,
  controlledOutputPath: outputPath,
  controlledOutputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
  durableActivationRequest,
  highReasoningRepairHandoff,
  blockers,
  nextTeacherActions:
    blockers.length > 0
      ? ["Resolve blockers before durable activation planning."]
      : approved
        ? ["Use a separate durable activation runner with final teacher activation confirmation before writing memory or enabling rules."]
        : routesToRepair
          ? ["Send the activation scope and teacher correction to high-reasoning repair before any durable action."]
          : ["Collect missing teacher evidence before preparing durable activation."],
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
    "# Real-Case Confirmed Outcome Durable Activation Gate",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Source outcome review: ${reviewInput.path || review.reviewId}`,
    `Controlled output: ${outputPath || "missing"}`,
    "",
    "This gate prepares only a durable activation request after a confirmed real-case runner outcome.",
    "It does not write memory, enable rules, fetch RAG, execute software, unlock packaging, accept technology, or complete the whole apprentice objective.",
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
      format: "transparent_ai_real_case_confirmed_outcome_durable_activation_result_v1",
      status,
      gatePath,
      receiptRecordPath,
      readmePath,
      decision,
      ...sourceContext,
      controlledOutputPath: outputPath,
      controlledOutputSha256: packet.controlledOutputSha256,
      durableActivationRequest,
      highReasoningRepairHandoff,
      blockers,
      memoryWritten: false,
      ragFetched: false,
      ragEvidenceTreatedAsAuthority: false,
      accepted: false,
      ruleEnabled: false,
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
