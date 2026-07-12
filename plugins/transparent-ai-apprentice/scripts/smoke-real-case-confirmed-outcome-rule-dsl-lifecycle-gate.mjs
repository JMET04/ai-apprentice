#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const candidateReviewSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-candidate-ledger-review-gate");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-rule-dsl-lifecycle-gate");
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

function findFiles(rootDir, fileName) {
  const output = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) stack.push(join(current, entry));
    } else if (current.endsWith(fileName)) {
      output.push(current);
    }
  }
  output.sort();
  return output;
}

function latestFile(rootDir, fileName) {
  const files = findFiles(rootDir, fileName);
  if (!files.length) throw new Error(`Missing ${fileName} under ${rootDir}`);
  files.sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs || left.localeCompare(right));
  return files[files.length - 1];
}

function baseReceipt({ reviewPath, review, decision, rollbackPoint, extra = {} }) {
  return {
    format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_receipt_v1",
    sourceReviewId: review.reviewId,
    sourceReviewFormat: review.sourceReviewFormat,
    sourceConfirmedOutcomeReviewId: review.sourceConfirmedOutcomeReviewId,
    sourceConfirmedOutcomeSourceRunId: review.sourceConfirmedOutcomeSourceRunId,
    sourceRunId: review.sourceRunId,
    sourceReviewPath: reviewPath,
    sourceReviewHash: hashText(JSON.stringify(review)),
    candidateLedgerSha256: hashFile(review.ruleDslLifecycleHandoff.candidateLedgerPath),
    ruleActivationCandidateSha256: hashFile(review.ruleDslLifecycleHandoff.ruleActivationCandidatePath),
    rollbackPoint,
    teacherDecision: decision,
    candidateLedgerReviewReviewed: true,
    ruleDslLifecycleHandoffReviewed: true,
    ruleActivationCandidateReviewed: true,
    candidateHashesReviewed: true,
    draftDisabledLifecycleConfirmed: true,
    deterministicValidatorBoundaryConfirmed: true,
    rollbackRetained: true,
    noActiveRuleEnableConfirmed: true,
    noRuleRegistryMutationConfirmed: true,
    noRagAuthorityConfirmed: true,
    noSoftwareExecutionConfirmed: true,
    noPackagingUnlockConfirmed: true,
    noCompletionClaimConfirmed: true,
    teacherNotes: "Teacher approves draft-disabled Rule DSL planning only.",
    ...extra
  };
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const candidateReviewSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-candidate-ledger-review-gate.mjs"]).stdout
);
const ruleReviewPath = latestFile(join(candidateReviewSmokeRoot, "rule-dsl-lifecycle"), "real-case-confirmed-outcome-candidate-ledger-review.json");
const ruleReview = readJson(ruleReviewPath);
const rollbackPoint = join(smokeRoot, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });

const approvedReceiptPath = writeJson(
  join(smokeRoot, "approved-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({ reviewPath: ruleReviewPath, review: ruleReview, decision: "approve_rule_dsl_draft_planning", rollbackPoint })
);
const approvedResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
    "--candidate-ledger-review",
    ruleReviewPath,
    "--receipt",
    approvedReceiptPath,
    "--out-dir",
    join(smokeRoot, "approved")
  ]).stdout
);
check(
  "Rule DSL lifecycle gate prepares draft-disabled planning handoff without enabling rules",
  approvedResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_ready_for_draft_disabled_planning" &&
    approvedResult.ruleDslDraftPlanningHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_planning_handoff_v1" &&
    approvedResult.confirmedOutcomeBranch === true &&
    approvedResult.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedResult.sourceConfirmedOutcomeReviewId === ruleReview.sourceConfirmedOutcomeReviewId &&
    approvedResult.sourceConfirmedOutcomeSourceRunId === ruleReview.sourceConfirmedOutcomeSourceRunId &&
    approvedResult.sourceRunId === ruleReview.sourceRunId &&
    approvedResult.ruleDslDraftPlanningHandoff?.confirmedOutcomeBranch === true &&
    approvedResult.ruleDslDraftPlanningHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    approvedResult.ruleDslDraftPlanningHandoff?.sourceConfirmedOutcomeReviewId === ruleReview.sourceConfirmedOutcomeReviewId &&
    approvedResult.ruleDslDraftPlanningHandoff?.sourceConfirmedOutcomeSourceRunId === ruleReview.sourceConfirmedOutcomeSourceRunId &&
    approvedResult.ruleDslDraftPlanningHandoff?.sourceRunId === ruleReview.sourceRunId &&
    approvedResult.ruleDslDraftPlanningHandoff?.proposedLifecycle === "draft_disabled" &&
    approvedResult.ruleDslDraftPlanningHandoff?.executeNow === false &&
    approvedResult.ruleDslDraftPlanningHandoff?.ruleEnableAllowedHere === false &&
    approvedResult.ruleFilesModified === false &&
    approvedResult.rulePackageCompiled === false &&
    approvedResult.ruleEnabled === false &&
    approvedResult.productionRuleRegistryMutated === false &&
    approvedResult.packagingUnlocked === false &&
    approvedResult.goalComplete === false,
  JSON.stringify({ gatePath: approvedResult.gatePath })
);

const repairReceiptPath = writeJson(
  join(smokeRoot, "repair-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({
    reviewPath: ruleReviewPath,
    review: ruleReview,
    decision: "request_high_reasoning_repair",
    rollbackPoint,
    extra: { teacherCorrection: "The rule candidate does not yet describe the intended deterministic validator boundary." }
  })
);
const repairResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
    "--candidate-ledger-review",
    ruleReviewPath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair")
  ]).stdout
);
check(
  "Rule DSL lifecycle gate routes teacher correction to high-reasoning repair",
  repairResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_routes_to_high_reasoning_repair" &&
    repairResult.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_high_reasoning_repair_handoff_v1" &&
    repairResult.confirmedOutcomeBranch === true &&
    repairResult.sourceReviewFormat === expectedSourceReviewFormat &&
    repairResult.sourceConfirmedOutcomeReviewId === ruleReview.sourceConfirmedOutcomeReviewId &&
    repairResult.sourceConfirmedOutcomeSourceRunId === ruleReview.sourceConfirmedOutcomeSourceRunId &&
    repairResult.sourceRunId === ruleReview.sourceRunId &&
    repairResult.highReasoningRepairHandoff?.confirmedOutcomeBranch === true &&
    repairResult.highReasoningRepairHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeReviewId === ruleReview.sourceConfirmedOutcomeReviewId &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeSourceRunId === ruleReview.sourceConfirmedOutcomeSourceRunId &&
    repairResult.highReasoningRepairHandoff?.sourceRunId === ruleReview.sourceRunId &&
    repairResult.highReasoningRepairHandoff?.requiredReasoningTier === "high" &&
    repairResult.highReasoningRepairHandoff?.executeNow === false,
  JSON.stringify({ gatePath: repairResult.gatePath })
);

const forbiddenReceiptPath = writeJson(
  join(smokeRoot, "forbidden-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({ reviewPath: ruleReviewPath, review: ruleReview, decision: "enable_rule", rollbackPoint })
);
const forbiddenResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
      "--candidate-ledger-review",
      ruleReviewPath,
      "--receipt",
      forbiddenReceiptPath,
      "--out-dir",
      join(smokeRoot, "forbidden")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Rule DSL lifecycle gate blocks active enablement or registry mutation decisions",
  forbiddenResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_gate_blocked" &&
    forbiddenResult.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenResult.ruleEnabled === false &&
    forbiddenResult.productionRuleRegistryMutated === false,
  JSON.stringify({ blockers: forbiddenResult.blockers })
);

const tamperedReceiptPath = writeJson(
  join(smokeRoot, "tampered-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({
    reviewPath: ruleReviewPath,
    review: ruleReview,
    decision: "approve_rule_dsl_draft_planning",
    rollbackPoint,
    extra: { ruleActivationCandidateSha256: "0".repeat(64) }
  })
);
const tamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
      "--candidate-ledger-review",
      ruleReviewPath,
      "--receipt",
      tamperedReceiptPath,
      "--out-dir",
      join(smokeRoot, "tampered")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Rule DSL lifecycle gate blocks rule activation candidate hash mismatch",
  tamperedResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_gate_blocked" &&
    tamperedResult.blockers.some((row) => row.code === "rule_activation_candidate_hash_mismatch"),
  JSON.stringify({ blockers: tamperedResult.blockers })
);

const incompleteReceiptPath = writeJson(
  join(smokeRoot, "incomplete-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({
    reviewPath: ruleReviewPath,
    review: ruleReview,
    decision: "approve_rule_dsl_draft_planning",
    rollbackPoint,
    extra: { draftDisabledLifecycleConfirmed: false, noActiveRuleEnableConfirmed: false }
  })
);
const incompleteResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
      "--candidate-ledger-review",
      ruleReviewPath,
      "--receipt",
      incompleteReceiptPath,
      "--out-dir",
      join(smokeRoot, "incomplete")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Rule DSL lifecycle gate blocks incomplete draft-disabled lifecycle confirmations",
  incompleteResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_gate_blocked" &&
    incompleteResult.blockers.some((row) => row.code === "draft_disabled_lifecycle_not_confirmed") &&
    incompleteResult.blockers.some((row) => row.code === "no_active_rule_enable_not_confirmed"),
  JSON.stringify({ blockers: incompleteResult.blockers })
);

const badSourceRuleCandidate = readJson(ruleReview.ruleDslLifecycleHandoff.ruleActivationCandidatePath);
badSourceRuleCandidate.sourceReviewFormat = "transparent_ai_real_case_unconfirmed_outcome_review_v1";
badSourceRuleCandidate.sourceConfirmedOutcomeReviewId = "lost-confirmed-outcome-review-id";
badSourceRuleCandidate.sourceConfirmedOutcomeSourceRunId = "lost-confirmed-outcome-source-run-id";
badSourceRuleCandidate.sourceRunId = "lost-source-run-id";
const badSourceRuleCandidatePath = writeJson(join(smokeRoot, "bad-source-rule-activation-candidate.json"), badSourceRuleCandidate);
const badSourceReview = JSON.parse(JSON.stringify(ruleReview));
badSourceReview.ruleDslLifecycleHandoff.ruleActivationCandidatePath = badSourceRuleCandidatePath;
badSourceReview.ruleActivationCandidatePath = badSourceRuleCandidatePath;
const badSourceReviewPath = writeJson(join(smokeRoot, "bad-source-rule-dsl-lifecycle-review.json"), badSourceReview);
const badSourceReceiptPath = writeJson(
  join(smokeRoot, "bad-source-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({
    reviewPath: badSourceReviewPath,
    review: badSourceReview,
    decision: "approve_rule_dsl_draft_planning",
    rollbackPoint
  })
);
const badSourceResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
      "--candidate-ledger-review",
      badSourceReviewPath,
      "--receipt",
      badSourceReceiptPath,
      "--out-dir",
      join(smokeRoot, "bad-source")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Rule DSL lifecycle gate blocks lost confirmed-outcome source continuity",
  badSourceResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_gate_blocked" &&
    badSourceResult.blockers.some((row) => row.code === "rule_activation_candidate_source_review_format_mismatch") &&
    badSourceResult.blockers.some((row) => row.code === "rule_activation_candidate_confirmed_outcome_review_id_mismatch") &&
    badSourceResult.blockers.some((row) => row.code === "rule_activation_candidate_confirmed_outcome_source_run_id_mismatch") &&
    badSourceResult.blockers.some((row) => row.code === "rule_activation_candidate_source_run_id_mismatch") &&
    badSourceResult.ruleEnabled === false &&
    badSourceResult.packagingUnlocked === false,
  JSON.stringify({ blockers: badSourceResult.blockers })
);

const mismatchedReceiptSourcePath = writeJson(
  join(smokeRoot, "mismatched-source-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({
    reviewPath: ruleReviewPath,
    review: ruleReview,
    decision: "approve_rule_dsl_draft_planning",
    rollbackPoint,
    extra: { sourceConfirmedOutcomeReviewId: "wrong-confirmed-outcome-review-id" }
  })
);
const mismatchedReceiptSourceResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
      "--candidate-ledger-review",
      ruleReviewPath,
      "--receipt",
      mismatchedReceiptSourcePath,
      "--out-dir",
      join(smokeRoot, "mismatched-source")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Rule DSL lifecycle gate blocks receipt confirmed-outcome source id mismatch",
  mismatchedReceiptSourceResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_gate_blocked" &&
    mismatchedReceiptSourceResult.blockers.some((row) => row.code === "receipt_source_confirmed_outcome_review_id_mismatch") &&
    mismatchedReceiptSourceResult.ruleEnabled === false &&
    mismatchedReceiptSourceResult.packagingUnlocked === false,
  JSON.stringify({ blockers: mismatchedReceiptSourceResult.blockers })
);

const mismatchedReceiptSourceRunIdPath = writeJson(
  join(smokeRoot, "mismatched-source-run-id-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({
    reviewPath: ruleReviewPath,
    review: ruleReview,
    decision: "approve_rule_dsl_draft_planning",
    rollbackPoint,
    extra: { sourceRunId: "wrong-source-run-id" }
  })
);
const mismatchedReceiptSourceRunIdResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
      "--candidate-ledger-review",
      ruleReviewPath,
      "--receipt",
      mismatchedReceiptSourceRunIdPath,
      "--out-dir",
      join(smokeRoot, "mismatched-source-run-id")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Rule DSL lifecycle gate blocks receipt sourceRunId mismatch",
  mismatchedReceiptSourceRunIdResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_gate_blocked" &&
    mismatchedReceiptSourceRunIdResult.blockers.some((row) => row.code === "receipt_source_run_id_mismatch") &&
    mismatchedReceiptSourceRunIdResult.ruleEnabled === false &&
    mismatchedReceiptSourceRunIdResult.packagingUnlocked === false,
  JSON.stringify({ blockers: mismatchedReceiptSourceRunIdResult.blockers })
);

const missingRollbackReceiptPath = writeJson(
  join(smokeRoot, "missing-rollback-rule-dsl-lifecycle-receipt.json"),
  baseReceipt({
    reviewPath: ruleReviewPath,
    review: ruleReview,
    decision: "approve_rule_dsl_draft_planning",
    rollbackPoint: join(smokeRoot, "missing-rollback-point-does-not-exist", "rollback")
  })
);
const missingRollbackResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs",
      "--candidate-ledger-review",
      ruleReviewPath,
      "--receipt",
      missingRollbackReceiptPath,
      "--out-dir",
      join(smokeRoot, "missing-rollback-output")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Rule DSL lifecycle gate blocks missing retained rollback point",
  missingRollbackResult.status === "real_case_confirmed_outcome_rule_dsl_lifecycle_gate_blocked" &&
    missingRollbackResult.blockers.some((row) => row.code === "rollback_point_not_found"),
  JSON.stringify({ blockers: missingRollbackResult.blockers })
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  candidateReviewSmokeStatus: candidateReviewSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
