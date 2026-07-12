#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-durable-activation-gate");
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";
mkdirSync(smokeRoot, { recursive: true });

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (expectOk && result.status !== 0) throw new Error(result.stderr || result.stdout || args.join(" "));
  if (!expectOk && result.status === 0) throw new Error(`Expected failure: ${args.join(" ")}`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function baseReceipt({ reviewPath, review, decision, extra = {} }) {
  return {
    format: "transparent_ai_real_case_confirmed_outcome_durable_activation_receipt_v1",
    sourceReviewId: review.reviewId,
    sourceReviewPath: reviewPath,
    sourceReviewHash: hashText(JSON.stringify(review)),
    sourceReviewFormat: review.sourceReviewFormat,
    sourceConfirmedOutcomeReviewId: review.sourceConfirmedOutcomeReviewId,
    sourceConfirmedOutcomeSourceRunId: review.sourceConfirmedOutcomeSourceRunId,
    sourceRunId: review.sourceRunId,
    controlledOutputPath: review.confirmedOutcomeHandoff.controlledOutputPath,
    controlledOutputSha256: hashFile(review.confirmedOutcomeHandoff.controlledOutputPath),
    teacherDecision: decision,
    activationScope: "memory_or_rule_candidate",
    requestedDurableArtifacts: ["memory_candidate", "rule_activation_candidate"],
    outcomeReviewPacketReviewed: true,
    confirmedHandoffReviewed: true,
    controlledOutputReviewed: true,
    outputHashReviewed: true,
    durableScopeReviewed: true,
    activationBoundaryConfirmed: true,
    rollbackRetained: true,
    noImmediateMemoryWriteConfirmed: true,
    noImmediateRuleEnableConfirmed: true,
    noRagAuthorityConfirmed: true,
    noPackagingUnlockConfirmed: true,
    noAcceptanceClaimConfirmed: true,
    noExecutionConfirmed: true,
    teacherNotes: "Teacher confirms only a separate durable activation gate request; no memory or rule is activated here.",
    ...extra
  };
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const fixtureRoot = join(smokeRoot, "source-review-fixture");
const controlledOutputPath = writeJson(join(fixtureRoot, "controlled-confirmed-outcome-output.json"), {
  format: "transparent_ai_real_case_confirmed_outcome_controlled_output_v1",
  operation: "confirmed_outcome_packaging_dieline_update_proof",
  ok: true
});
const confirmedReview = {
  ok: true,
  format: "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1",
  reviewId: "smoke-confirmed-outcome-durable-activation-source-review",
  sourceReviewFormat: expectedSourceReviewFormat,
  sourceConfirmedOutcomeReviewId: "smoke-confirmed-outcome-runner-outcome-review",
  sourceConfirmedOutcomeSourceRunId: "smoke-confirmed-outcome-upstream-runner",
  sourceRunId: "smoke-confirmed-outcome-separate-real-runner",
  status: "real_case_confirmed_outcome_separate_real_runner_outcome_confirmed_waiting_for_memory_or_rule_gate",
  confirmedOutcomeBranch: true,
  outputPath: controlledOutputPath,
  confirmedOutcomeHandoff: {
    format: "transparent_ai_real_case_confirmed_outcome_separate_real_runner_confirmed_outcome_handoff_v1",
    confirmedOutcomeBranch: true,
    sourceReviewFormat: expectedSourceReviewFormat,
    sourceConfirmedOutcomeReviewId: "smoke-confirmed-outcome-runner-outcome-review",
    sourceConfirmedOutcomeSourceRunId: "smoke-confirmed-outcome-upstream-runner",
    sourceRunId: "smoke-confirmed-outcome-separate-real-runner",
    controlledOutputPath,
    controlledOutputSha256: hashFile(controlledOutputPath),
    memoryWriteAllowedHere: false,
    ruleEnableAllowedHere: false,
    ragFetchAllowedHere: false,
    packagingUnlockAllowedHere: false,
    accepted: false,
    goalComplete: false
  },
  locks: {
    confirmedOutcomeBranch: true,
    targetSoftwareCommandsExecutedAgain: false,
    memoryWritten: false,
    ruleEnabled: false,
    ragFetched: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  }
};
const confirmedReviewPath = writeJson(
  join(fixtureRoot, "real-case-confirmed-outcome-separate-real-runner-outcome-review.json"),
  confirmedReview
);

const approvedReceiptPath = writeJson(
  join(smokeRoot, "approved-durable-activation-receipt.json"),
  baseReceipt({
    reviewPath: confirmedReviewPath,
    review: confirmedReview,
    decision: "approve_durable_activation_gate"
  })
);
const approvedResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-durable-activation-receipt.mjs",
    "--outcome-review",
    confirmedReviewPath,
    "--receipt",
    approvedReceiptPath,
    "--out-dir",
    join(smokeRoot, "approved-gate")
  ]).stdout
);
check(
  "Confirmed outcome durable activation gate prepares request without writing memory or enabling rules",
  approvedResult.status === "real_case_confirmed_outcome_durable_activation_gate_ready_for_separate_activation_runner" &&
    approvedResult.durableActivationRequest?.format ===
      "transparent_ai_real_case_confirmed_outcome_durable_activation_request_v1" &&
    approvedResult.durableActivationRequest?.confirmedOutcomeBranch === true &&
    approvedResult.sourceReviewFormat === "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1" &&
    approvedResult.sourceConfirmedOutcomeReviewId === confirmedReview.sourceConfirmedOutcomeReviewId &&
    approvedResult.sourceConfirmedOutcomeSourceRunId === confirmedReview.sourceConfirmedOutcomeSourceRunId &&
    approvedResult.sourceRunId === confirmedReview.sourceRunId &&
    approvedResult.durableActivationRequest?.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedResult.durableActivationRequest?.sourceConfirmedOutcomeReviewId === confirmedReview.sourceConfirmedOutcomeReviewId &&
    approvedResult.durableActivationRequest?.sourceConfirmedOutcomeSourceRunId ===
      confirmedReview.sourceConfirmedOutcomeSourceRunId &&
    approvedResult.durableActivationRequest?.sourceRunId === confirmedReview.sourceRunId &&
    approvedResult.durableActivationRequest?.executeNow === false &&
    approvedResult.durableActivationRequest?.requiresSeparateDurableActivationRunner === true &&
    approvedResult.memoryWritten === false &&
    approvedResult.ruleEnabled === false &&
    approvedResult.ragFetched === false &&
    approvedResult.packagingUnlocked === false &&
    approvedResult.goalComplete === false,
  JSON.stringify({ gatePath: approvedResult.gatePath })
);

const repairReceiptPath = writeJson(
  join(smokeRoot, "repair-durable-activation-receipt.json"),
  baseReceipt({
    reviewPath: confirmedReviewPath,
    review: confirmedReview,
    decision: "request_high_reasoning_repair",
    extra: {
      teacherCorrection: "The output is correct, but the durable activation scope should not include a reusable rule yet; repair the contract first."
    }
  })
);
const repairResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-durable-activation-receipt.mjs",
    "--outcome-review",
    confirmedReviewPath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair-gate")
  ]).stdout
);
check(
  "Confirmed outcome durable activation gate routes activation-scope correction to high-reasoning repair",
  repairResult.status === "real_case_confirmed_outcome_durable_activation_routes_to_high_reasoning_repair" &&
    repairResult.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_activation_high_reasoning_repair_handoff_v1" &&
    repairResult.highReasoningRepairHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeReviewId === confirmedReview.sourceConfirmedOutcomeReviewId &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeSourceRunId ===
      confirmedReview.sourceConfirmedOutcomeSourceRunId &&
    repairResult.highReasoningRepairHandoff?.sourceRunId === confirmedReview.sourceRunId &&
    repairResult.highReasoningRepairHandoff?.requiredReasoningTier === "high" &&
    repairResult.highReasoningRepairHandoff?.executeNow === false &&
    repairResult.locks?.memoryWritten === false,
  JSON.stringify({ gatePath: repairResult.gatePath })
);

const sourceTamperedReview = {
  ...confirmedReview,
  sourceRunId: "tampered-source-run-id",
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
  confirmedOutcomeHandoff: {
    ...confirmedReview.confirmedOutcomeHandoff,
    sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
    sourceRunId: "different-tampered-source-run-id"
  }
};
const sourceTamperedReviewPath = writeJson(
  join(smokeRoot, "source-tampered-confirmed-outcome-review.json"),
  sourceTamperedReview
);
const sourceTamperedReceiptPath = writeJson(
  join(smokeRoot, "source-tampered-durable-activation-receipt.json"),
  baseReceipt({
    reviewPath: sourceTamperedReviewPath,
    review: sourceTamperedReview,
    decision: "approve_durable_activation_gate"
  })
);
const sourceTamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-durable-activation-receipt.mjs",
      "--outcome-review",
      sourceTamperedReviewPath,
      "--receipt",
      sourceTamperedReceiptPath,
      "--out-dir",
      join(smokeRoot, "source-tampered-gate")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome durable activation gate blocks lost confirmed-outcome source continuity",
  sourceTamperedResult.status === "real_case_confirmed_outcome_durable_activation_gate_blocked" &&
    sourceTamperedResult.blockers.some((row) => row.code === "confirmed_outcome_source_review_format_mismatch") &&
    sourceTamperedResult.blockers.some((row) => row.code === "confirmed_outcome_handoff_source_mismatch") &&
    sourceTamperedResult.memoryWritten === false &&
    sourceTamperedResult.ruleEnabled === false &&
    sourceTamperedResult.ragFetched === false,
  JSON.stringify({ blockers: sourceTamperedResult.blockers })
);

const missingCurrentSourceRunReview = {
  ...confirmedReview,
  sourceRunId: "",
  confirmedOutcomeHandoff: {
    ...confirmedReview.confirmedOutcomeHandoff,
    sourceRunId: ""
  }
};
const missingCurrentSourceRunReviewPath = writeJson(
  join(smokeRoot, "missing-current-source-run-confirmed-outcome-review.json"),
  missingCurrentSourceRunReview
);
const missingCurrentSourceRunReceiptPath = writeJson(
  join(smokeRoot, "missing-current-source-run-durable-activation-receipt.json"),
  baseReceipt({
    reviewPath: missingCurrentSourceRunReviewPath,
    review: missingCurrentSourceRunReview,
    decision: "approve_durable_activation_gate"
  })
);
const missingCurrentSourceRunResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-durable-activation-receipt.mjs",
      "--outcome-review",
      missingCurrentSourceRunReviewPath,
      "--receipt",
      missingCurrentSourceRunReceiptPath,
      "--out-dir",
      join(smokeRoot, "missing-current-source-run-gate")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome durable activation gate blocks missing current sourceRunId",
  missingCurrentSourceRunResult.status === "real_case_confirmed_outcome_durable_activation_gate_blocked" &&
    missingCurrentSourceRunResult.blockers.some((row) => row.code === "confirmed_outcome_source_ids_missing") &&
    missingCurrentSourceRunResult.memoryWritten === false &&
    missingCurrentSourceRunResult.ruleEnabled === false &&
    missingCurrentSourceRunResult.ragFetched === false,
  JSON.stringify({ blockers: missingCurrentSourceRunResult.blockers })
);

const forbiddenReceiptPath = writeJson(
  join(smokeRoot, "forbidden-durable-activation-receipt.json"),
  baseReceipt({
    reviewPath: confirmedReviewPath,
    review: confirmedReview,
    decision: "enable_rule"
  })
);
const forbiddenResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-durable-activation-receipt.mjs",
      "--outcome-review",
      confirmedReviewPath,
      "--receipt",
      forbiddenReceiptPath,
      "--out-dir",
      join(smokeRoot, "forbidden-gate")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome durable activation gate blocks direct memory or rule activation decisions",
  forbiddenResult.status === "real_case_confirmed_outcome_durable_activation_gate_blocked" &&
    forbiddenResult.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenResult.memoryWritten === false &&
    forbiddenResult.ruleEnabled === false,
  JSON.stringify({ blockers: forbiddenResult.blockers })
);

const tamperedReceiptPath = writeJson(
  join(smokeRoot, "tampered-durable-activation-receipt.json"),
  baseReceipt({
    reviewPath: confirmedReviewPath,
    review: confirmedReview,
    decision: "approve_durable_activation_gate",
    extra: { controlledOutputSha256: "0".repeat(64) }
  })
);
const tamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-durable-activation-receipt.mjs",
      "--outcome-review",
      confirmedReviewPath,
      "--receipt",
      tamperedReceiptPath,
      "--out-dir",
      join(smokeRoot, "tampered-gate")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome durable activation gate blocks controlled output hash mismatch",
  tamperedResult.status === "real_case_confirmed_outcome_durable_activation_gate_blocked" &&
    tamperedResult.blockers.some((row) => row.code === "controlled_output_hash_mismatch"),
  JSON.stringify({ blockers: tamperedResult.blockers })
);

const incompleteReceiptPath = writeJson(
  join(smokeRoot, "incomplete-durable-activation-receipt.json"),
  baseReceipt({
    reviewPath: confirmedReviewPath,
    review: confirmedReview,
    decision: "approve_durable_activation_gate",
    extra: {
      durableScopeReviewed: false,
      noImmediateRuleEnableConfirmed: false
    }
  })
);
const incompleteResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-durable-activation-receipt.mjs",
      "--outcome-review",
      confirmedReviewPath,
      "--receipt",
      incompleteReceiptPath,
      "--out-dir",
      join(smokeRoot, "incomplete-gate")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome durable activation gate blocks incomplete activation confirmations",
  incompleteResult.status === "real_case_confirmed_outcome_durable_activation_gate_blocked" &&
    incompleteResult.blockers.some((row) => row.code === "durable_scope_not_reviewed") &&
    incompleteResult.blockers.some((row) => row.code === "no_immediate_rule_enable_not_confirmed"),
  JSON.stringify({ blockers: incompleteResult.blockers })
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_durable_activation_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  outcomeSmokeStatus: "fixture_confirmed_review_packet",
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
