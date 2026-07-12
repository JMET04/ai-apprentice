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
  if (["confirm_controlled_output_matches_intent", "confirmed", "confirm", "matched", "ok"].includes(text)) {
    return "confirm_controlled_output_matches_intent";
  }
  if (["request_high_reasoning_repair", "repair", "correct", "correction_needed", "needs_repair"].includes(text)) {
    return "request_high_reasoning_repair";
  }
  if (["blocked", "block"].includes(text)) return "blocked";
  if (["request_more_evidence", "more_evidence", "needs_more_evidence", "needs_teacher_review"].includes(text)) {
    return "request_more_evidence";
  }
  return text || "needs_teacher_review";
}

function reviewLocks({ reviewed = false } = {}) {
  return {
    reviewOnly: true,
    runnerOutcomeReviewed: reviewed,
    noExecutionHere: true,
    targetSoftwareCommandsExecutedAgain: false,
    uiEventsSent: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    ruleEnabled: false,
    packagingGated: true,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false,
    requiresSeparateMemoryOrRuleActivationGate: true
  };
}

const runnerInput = readJsonInput(
  argValue("--runner", argValue("--run", "")),
  "--runner",
  "transparent_ai_real_case_separate_real_runner_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_separate_real_runner_outcome_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-separate-real-runner-outcome-reviews"))
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
  "fetch_rag",
  "unlock_packaging",
  "accepted",
  "accept",
  "claim_complete",
  "goal_complete",
  "execute_again",
  "rerun_now",
  "run_again"
]);

if (runner.status !== "real_case_separate_real_runner_completed_waiting_for_teacher_outcome_review") {
  block("runner_not_waiting_for_outcome_review", "Runner must have completed one controlled attempt and be waiting for teacher outcome review.");
}
if (runner.runnerInvoked !== true || runner.controlledRouteActionExecuted !== true) {
  block("runner_did_not_execute_controlled_route", "Source runner must contain one controlled route action execution.");
}
if (runner.locks?.memoryWritten !== false || runner.locks?.ragFetched !== false || runner.locks?.packagingUnlocked !== false) {
  block("source_runner_locks_not_closed", "Source runner must keep memory, RAG, and packaging locks closed.");
}
if (receipt.sourceRunId && receipt.sourceRunId !== runner.runId) block("source_run_id_mismatch", "Receipt sourceRunId does not match runner runId.");
if (receipt.runId && receipt.runId !== runner.runId) block("run_id_mismatch", "Receipt runId does not match runner runId.");
if (receipt.sourceRunHash && receipt.sourceRunHash !== hashText(JSON.stringify(runner))) {
  block("source_run_hash_mismatch", "Receipt sourceRunHash does not match the runner packet.");
}
if (receipt.sourceRunPath && runnerInput.path && resolve(receipt.sourceRunPath) !== runnerInput.path) {
  block("source_run_path_mismatch", "Receipt sourceRunPath does not match the provided runner path.");
}

const outputPath = receipt.outputPath || runner.adapterRun?.outputPath || "";
if (!outputPath || !existsSync(outputPath)) block("controlled_output_missing", "Controlled output file must exist for teacher outcome review.");
if (outputPath && existsSync(outputPath) && receipt.outputSha256 && String(receipt.outputSha256).toLowerCase() !== hashFile(outputPath)) {
  block("controlled_output_hash_mismatch", "Receipt outputSha256 does not match the controlled output file.");
}
if (outputPath && existsSync(outputPath) && runner.adapterRun?.outputSha256 && String(runner.adapterRun.outputSha256).toLowerCase() !== hashFile(outputPath)) {
  block("runner_output_hash_mismatch", "Runner adapter output hash no longer matches the controlled output file.");
}
if (forbiddenDecisions.has(decision)) block("forbidden_teacher_decision", `Teacher decision ${decision} is not allowed in this review gate.`);

const requiredConfirmations = [
  ["runnerPacketReviewed", "runner_packet_not_reviewed"],
  ["runnerReceiptReviewed", "runner_receipt_not_reviewed"],
  ["controlledOutputReviewed", "controlled_output_not_reviewed"],
  ["outputHashReviewed", "output_hash_not_reviewed"],
  ["rollbackRetained", "rollback_not_retained"],
  ["locksReviewed", "locks_not_reviewed"],
  ["noMemoryWriteConfirmed", "no_memory_write_not_confirmed"],
  ["noRuleEnableConfirmed", "no_rule_enable_not_confirmed"],
  ["noRagFetchConfirmed", "no_rag_fetch_not_confirmed"],
  ["noPackagingUnlockConfirmed", "no_packaging_unlock_not_confirmed"],
  ["noAcceptanceClaimConfirmed", "no_acceptance_claim_not_confirmed"]
];
for (const [field, code] of requiredConfirmations) {
  if (receipt[field] !== true) block(code, `${field} must be true before outcome review can route forward.`);
}
if (decision === "request_high_reasoning_repair" && !String(receipt.teacherCorrection || receipt.teacherNotes || "").trim()) {
  block("repair_requires_teacher_correction", "High-reasoning repair routing requires teacherCorrection or teacherNotes.");
}
if (
  ![
    "confirm_controlled_output_matches_intent",
    "request_high_reasoning_repair",
    "blocked",
    "request_more_evidence",
    "needs_teacher_review"
  ].includes(decision) &&
  !forbiddenDecisions.has(decision)
) {
  block("unknown_teacher_decision", `Teacher decision ${decision} is not recognized.`);
}

const reviewed = blockers.length === 0;
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${runner.runId || "runner-outcome-review"}`;
const reviewDir = join(outRoot, runId.replace(/[\\/:*?"<>|]/g, "_"));
const reviewPath = join(reviewDir, "real-case-separate-real-runner-outcome-review.json");
const receiptRecordPath = join(reviewDir, "teacher-outcome-review-receipt.json");
const readmePath = join(reviewDir, "REAL_CASE_SEPARATE_REAL_RUNNER_OUTCOME_REVIEW_START_HERE.md");
const locks = reviewLocks({ reviewed });

const status =
  blockers.length > 0
    ? "real_case_separate_real_runner_outcome_review_blocked"
    : decision === "confirm_controlled_output_matches_intent"
      ? "real_case_separate_real_runner_outcome_confirmed_waiting_for_memory_or_rule_gate"
      : decision === "request_high_reasoning_repair"
        ? "real_case_separate_real_runner_outcome_routes_to_high_reasoning_repair"
        : "real_case_separate_real_runner_outcome_review_needs_teacher_follow_up";

const confirmedOutcomeHandoff =
  blockers.length === 0 && decision === "confirm_controlled_output_matches_intent"
    ? {
        format: "transparent_ai_real_case_separate_real_runner_confirmed_outcome_handoff_v1",
        sourceRunId: runner.runId,
        sourceRunPath: runnerInput.path,
        controlledOutputPath: outputPath,
        controlledOutputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
        teacherNotes: receipt.teacherNotes || "",
        nextGateRequired: "memory_or_rule_activation_gate",
        memoryWriteAllowedHere: false,
        ruleEnableAllowedHere: false,
        ragFetchAllowedHere: false,
        packagingUnlockAllowedHere: false,
        accepted: false,
        goalComplete: false
      }
    : null;

const highReasoningRepairHandoff =
  blockers.length === 0 && decision === "request_high_reasoning_repair"
    ? {
        format: "transparent_ai_real_case_separate_real_runner_high_reasoning_repair_handoff_v1",
        sourceRunId: runner.runId,
        sourceRunPath: runnerInput.path,
        sourceReceiptPath: receipt.sourceReceiptPath || "",
        controlledOutputPath: outputPath,
        controlledOutputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
        teacherCorrection: receipt.teacherCorrection || receipt.teacherNotes || "",
        requiredReasoningTier: "high",
        nextAction: "repair_logic_contract_or_runner_plan_before_any_new_execution",
        executeNow: false,
        memoryWriteAllowedHere: false,
        ruleEnableAllowedHere: false,
        ragFetchAllowedHere: false,
        packagingUnlockAllowedHere: false,
        accepted: false,
        goalComplete: false
      }
    : null;

const packet = {
  ok: blockers.length === 0,
  format: "transparent_ai_real_case_separate_real_runner_outcome_review_v1",
  reviewId: runId,
  createdAt: new Date().toISOString(),
  status,
  sourceRunId: runner.runId,
  sourceRunPath: runnerInput.path,
  sourceRunHash: hashText(JSON.stringify(runner)),
  receiptPath: receiptInput.path,
  decision,
  outputPath,
  outputSha256: outputPath && existsSync(outputPath) ? hashFile(outputPath) : "",
  confirmedOutcomeHandoff,
  highReasoningRepairHandoff,
  blockers,
  nextTeacherActions:
    blockers.length > 0
      ? ["Resolve the blockers before routing the outcome forward."]
      : decision === "confirm_controlled_output_matches_intent"
        ? ["Use a separate memory or rule activation gate if this outcome should become durable apprentice behavior."]
        : decision === "request_high_reasoning_repair"
          ? ["Send the handoff to a high-reasoning repair pass before any new execution."]
          : ["Collect the missing teacher evidence before outcome routing."],
  locks,
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
    "# Real-Case Separate Real Runner Outcome Review",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Source run: ${runnerInput.path || runner.runId}`,
    `Controlled output: ${outputPath || "missing"}`,
    "",
    "This gate reviews the result of one final teacher-confirmed runner attempt.",
    "It does not execute software again, write memory, fetch RAG, enable rules, unlock packaging, accept technology, or complete the whole apprentice objective.",
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
      format: "transparent_ai_real_case_separate_real_runner_outcome_review_result_v1",
      status,
      reviewPath,
      receiptRecordPath,
      readmePath,
      decision,
      sourceRunId: runner.runId,
      outputPath,
      outputSha256: packet.outputSha256,
      confirmedOutcomeHandoff,
      highReasoningRepairHandoff,
      blockers,
      memoryWritten: false,
      ragFetched: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false,
      goalComplete: false,
      locks
    },
    null,
    2
  )
);

if (!packet.ok) process.exitCode = 1;
