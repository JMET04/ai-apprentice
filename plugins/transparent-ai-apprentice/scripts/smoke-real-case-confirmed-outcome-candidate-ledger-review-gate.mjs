#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const runnerSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-separate-durable-activation-runner");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-candidate-ledger-review-gate");
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

function baseReceipt({ runnerPath, runner, decision, extra = {} }) {
  return {
    format: "transparent_ai_real_case_confirmed_outcome_candidate_ledger_review_receipt_v1",
    sourceActivationId: runner.activationId,
    sourceRunnerPath: runnerPath,
    sourceRunnerHash: hashText(JSON.stringify(runner)),
    sourceReviewFormat: runner.sourceReviewFormat,
    sourceConfirmedOutcomeReviewId: runner.sourceConfirmedOutcomeReviewId,
    sourceConfirmedOutcomeSourceRunId: runner.sourceConfirmedOutcomeSourceRunId,
    sourceRunId: runner.sourceRunId,
    ledgerSha256: hashFile(runner.ledgerPath),
    memoryCandidateSha256: hashFile(runner.memoryCandidatePath),
    ruleActivationCandidateSha256: hashFile(runner.ruleActivationCandidatePath),
    teacherDecision: decision,
    runnerPacketReviewed: true,
    candidateLedgerReviewed: true,
    memoryCandidateReviewed: true,
    ruleActivationCandidateReviewed: true,
    candidateHashesReviewed: true,
    rollbackRetained: true,
    lifecycleRouteReviewed: true,
    noProductionMemoryWriteConfirmed: true,
    noRuleEnableConfirmed: true,
    noRagAuthorityConfirmed: true,
    noPackagingUnlockConfirmed: true,
    noAcceptanceClaimConfirmed: true,
    noExecutionConfirmed: true,
    teacherNotes: "Teacher reviewed the candidate ledger and chooses only the next lifecycle route.",
    ...extra
  };
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}
const expectedSourceReviewFormat = "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1";

const runnerSmoke = JSON.parse(
  runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-separate-durable-activation-runner.mjs"])
    .stdout
);
const approvedRunnerPath = latestFile(
  join(runnerSmokeRoot, "approved-runner"),
  "real-case-confirmed-outcome-separate-durable-activation-runner.json"
);
const approvedRunner = readJson(approvedRunnerPath);

const memoryReceiptPath = writeJson(
  join(smokeRoot, "memory-lifecycle-review-receipt.json"),
  baseReceipt({ runnerPath: approvedRunnerPath, runner: approvedRunner, decision: "approve_memory_lifecycle_review" })
);
const memoryResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
    "--runner",
    approvedRunnerPath,
    "--receipt",
    memoryReceiptPath,
    "--out-dir",
    join(smokeRoot, "memory-lifecycle")
  ]).stdout
);
check(
  "Candidate ledger review routes reviewed memory candidate to memory lifecycle handoff only",
  memoryResult.status === "real_case_confirmed_outcome_candidate_ledger_routes_to_memory_lifecycle_gate" &&
    memoryResult.confirmedOutcomeBranch === true &&
    memoryResult.sourceReviewFormat === expectedSourceReviewFormat &&
    memoryResult.sourceConfirmedOutcomeReviewId === approvedRunner.sourceConfirmedOutcomeReviewId &&
    memoryResult.sourceConfirmedOutcomeSourceRunId === approvedRunner.sourceConfirmedOutcomeSourceRunId &&
    memoryResult.sourceRunId === approvedRunner.sourceRunId &&
    memoryResult.memoryLifecycleHandoff?.format === "transparent_ai_real_case_confirmed_outcome_memory_lifecycle_handoff_v1" &&
    memoryResult.memoryLifecycleHandoff?.confirmedOutcomeBranch === true &&
    memoryResult.memoryLifecycleHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    memoryResult.memoryLifecycleHandoff?.sourceConfirmedOutcomeReviewId === approvedRunner.sourceConfirmedOutcomeReviewId &&
    memoryResult.memoryLifecycleHandoff?.sourceConfirmedOutcomeSourceRunId === approvedRunner.sourceConfirmedOutcomeSourceRunId &&
    memoryResult.memoryLifecycleHandoff?.sourceRunId === approvedRunner.sourceRunId &&
    memoryResult.memoryLifecycleHandoff?.executeNow === false &&
    memoryResult.memoryLifecycleHandoff?.productionMemoryWriteAllowedHere === false &&
    memoryResult.ruleEnabled === false &&
    memoryResult.memoryWritten === false &&
    memoryResult.packagingUnlocked === false &&
    memoryResult.goalComplete === false,
  JSON.stringify({ reviewPath: memoryResult.reviewPath })
);

const ruleReceiptPath = writeJson(
  join(smokeRoot, "rule-dsl-lifecycle-review-receipt.json"),
  baseReceipt({ runnerPath: approvedRunnerPath, runner: approvedRunner, decision: "approve_rule_dsl_lifecycle_review" })
);
const ruleResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
    "--runner",
    approvedRunnerPath,
    "--receipt",
    ruleReceiptPath,
    "--out-dir",
    join(smokeRoot, "rule-dsl-lifecycle")
  ]).stdout
);
check(
  "Candidate ledger review routes reviewed rule candidate to Rule DSL lifecycle handoff only",
  ruleResult.status === "real_case_confirmed_outcome_candidate_ledger_routes_to_rule_dsl_lifecycle_gate" &&
    ruleResult.confirmedOutcomeBranch === true &&
    ruleResult.sourceReviewFormat === expectedSourceReviewFormat &&
    ruleResult.sourceConfirmedOutcomeReviewId === approvedRunner.sourceConfirmedOutcomeReviewId &&
    ruleResult.sourceConfirmedOutcomeSourceRunId === approvedRunner.sourceConfirmedOutcomeSourceRunId &&
    ruleResult.sourceRunId === approvedRunner.sourceRunId &&
    ruleResult.ruleDslLifecycleHandoff?.format === "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_handoff_v1" &&
    ruleResult.ruleDslLifecycleHandoff?.confirmedOutcomeBranch === true &&
    ruleResult.ruleDslLifecycleHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    ruleResult.ruleDslLifecycleHandoff?.sourceConfirmedOutcomeReviewId === approvedRunner.sourceConfirmedOutcomeReviewId &&
    ruleResult.ruleDslLifecycleHandoff?.sourceConfirmedOutcomeSourceRunId === approvedRunner.sourceConfirmedOutcomeSourceRunId &&
    ruleResult.ruleDslLifecycleHandoff?.sourceRunId === approvedRunner.sourceRunId &&
    ruleResult.ruleDslLifecycleHandoff?.executeNow === false &&
    ruleResult.ruleDslLifecycleHandoff?.ruleEnableAllowedHere === false &&
    ruleResult.ruleEnabled === false &&
    ruleResult.memoryWritten === false &&
    ruleResult.packagingUnlocked === false,
  JSON.stringify({ reviewPath: ruleResult.reviewPath })
);

const repairReceiptPath = writeJson(
  join(smokeRoot, "repair-candidate-ledger-review-receipt.json"),
  baseReceipt({
    runnerPath: approvedRunnerPath,
    runner: approvedRunner,
    decision: "request_high_reasoning_repair",
    extra: { teacherCorrection: "The candidate ledger mixes memory and rule semantics; repair the lifecycle route first." }
  })
);
const repairResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
    "--runner",
    approvedRunnerPath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair")
  ]).stdout
);
check(
  "Candidate ledger review routes teacher correction to high-reasoning repair",
    repairResult.status === "real_case_confirmed_outcome_candidate_ledger_routes_to_high_reasoning_repair" &&
    repairResult.confirmedOutcomeBranch === true &&
    repairResult.sourceReviewFormat === expectedSourceReviewFormat &&
    repairResult.sourceRunId === approvedRunner.sourceRunId &&
    repairResult.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_candidate_ledger_high_reasoning_repair_handoff_v1" &&
    repairResult.highReasoningRepairHandoff?.confirmedOutcomeBranch === true &&
    repairResult.highReasoningRepairHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeReviewId === approvedRunner.sourceConfirmedOutcomeReviewId &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeSourceRunId === approvedRunner.sourceConfirmedOutcomeSourceRunId &&
    repairResult.highReasoningRepairHandoff?.sourceRunId === approvedRunner.sourceRunId &&
    repairResult.highReasoningRepairHandoff?.requiredReasoningTier === "high" &&
    repairResult.highReasoningRepairHandoff?.executeNow === false,
  JSON.stringify({ reviewPath: repairResult.reviewPath })
);

const forbiddenReceiptPath = writeJson(
  join(smokeRoot, "forbidden-candidate-ledger-review-receipt.json"),
  baseReceipt({ runnerPath: approvedRunnerPath, runner: approvedRunner, decision: "write_memory" })
);
const forbiddenResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
      "--runner",
      approvedRunnerPath,
      "--receipt",
      forbiddenReceiptPath,
      "--out-dir",
      join(smokeRoot, "forbidden")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Candidate ledger review blocks forbidden production memory write or rule enablement decisions",
  forbiddenResult.status === "real_case_confirmed_outcome_candidate_ledger_review_blocked" &&
    forbiddenResult.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenResult.memoryWritten === false &&
    forbiddenResult.ruleEnabled === false,
  JSON.stringify({ blockers: forbiddenResult.blockers })
);

const tamperedReceiptPath = writeJson(
  join(smokeRoot, "tampered-candidate-ledger-review-receipt.json"),
  baseReceipt({
    runnerPath: approvedRunnerPath,
    runner: approvedRunner,
    decision: "approve_rule_dsl_lifecycle_review",
    extra: { ledgerSha256: "0".repeat(64) }
  })
);
const tamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
      "--runner",
      approvedRunnerPath,
      "--receipt",
      tamperedReceiptPath,
      "--out-dir",
      join(smokeRoot, "tampered")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Candidate ledger review blocks candidate ledger hash mismatch",
  tamperedResult.status === "real_case_confirmed_outcome_candidate_ledger_review_blocked" &&
    tamperedResult.blockers.some((row) => row.code === "candidate_ledger_hash_mismatch"),
  JSON.stringify({ blockers: tamperedResult.blockers })
);

const incompleteReceiptPath = writeJson(
  join(smokeRoot, "incomplete-candidate-ledger-review-receipt.json"),
  baseReceipt({
    runnerPath: approvedRunnerPath,
    runner: approvedRunner,
    decision: "approve_rule_dsl_lifecycle_review",
    extra: { lifecycleRouteReviewed: false, noRuleEnableConfirmed: false }
  })
);
const incompleteResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
      "--runner",
      approvedRunnerPath,
      "--receipt",
      incompleteReceiptPath,
      "--out-dir",
      join(smokeRoot, "incomplete")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Candidate ledger review blocks incomplete lifecycle confirmations",
  incompleteResult.status === "real_case_confirmed_outcome_candidate_ledger_review_blocked" &&
    incompleteResult.blockers.some((row) => row.code === "lifecycle_route_not_reviewed") &&
    incompleteResult.blockers.some((row) => row.code === "no_rule_enable_not_confirmed"),
  JSON.stringify({ blockers: incompleteResult.blockers })
);

const wrongSourceRunner = {
  ...approvedRunner,
  sourceReviewFormat: "transparent_ai_wrong_source_review_format_v1"
};
const wrongSourceRunnerPath = writeJson(join(smokeRoot, "wrong-source-review-format-runner.json"), wrongSourceRunner);
const wrongSourceReceiptPath = writeJson(
  join(smokeRoot, "wrong-source-review-format-receipt.json"),
  baseReceipt({
    runnerPath: wrongSourceRunnerPath,
    runner: wrongSourceRunner,
    decision: "approve_rule_dsl_lifecycle_review"
  })
);
const wrongSourceResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
      "--runner",
      wrongSourceRunnerPath,
      "--receipt",
      wrongSourceReceiptPath,
      "--out-dir",
      join(smokeRoot, "wrong-source-review-format")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Candidate ledger review blocks lost confirmed-outcome source continuity",
  wrongSourceResult.status === "real_case_confirmed_outcome_candidate_ledger_review_blocked" &&
    wrongSourceResult.blockers.some((row) => row.code === "source_review_format_not_confirmed_outcome"),
  JSON.stringify({ blockers: wrongSourceResult.blockers })
);

const wrongSourceIdsRunner = {
  ...approvedRunner,
  sourceConfirmedOutcomeReviewId: ""
};
const wrongSourceIdsRunnerPath = writeJson(join(smokeRoot, "wrong-source-ids-runner.json"), wrongSourceIdsRunner);
const wrongSourceIdsReceiptPath = writeJson(
  join(smokeRoot, "wrong-source-ids-receipt.json"),
  baseReceipt({
    runnerPath: wrongSourceIdsRunnerPath,
    runner: wrongSourceIdsRunner,
    decision: "approve_rule_dsl_lifecycle_review"
  })
);
const wrongSourceIdsResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
      "--runner",
      wrongSourceIdsRunnerPath,
      "--receipt",
      wrongSourceIdsReceiptPath,
      "--out-dir",
      join(smokeRoot, "wrong-source-ids")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Candidate ledger review blocks missing confirmed-outcome source ids",
  wrongSourceIdsResult.status === "real_case_confirmed_outcome_candidate_ledger_review_blocked" &&
    wrongSourceIdsResult.blockers.some((row) => row.code === "source_confirmed_outcome_ids_missing"),
  JSON.stringify({ blockers: wrongSourceIdsResult.blockers })
);

const wrongReceiptSourceRunIdPath = writeJson(
  join(smokeRoot, "wrong-receipt-source-run-id-receipt.json"),
  baseReceipt({
    runnerPath: approvedRunnerPath,
    runner: approvedRunner,
    decision: "approve_rule_dsl_lifecycle_review",
    extra: { sourceRunId: "wrong-source-run-id" }
  })
);
const wrongReceiptSourceRunIdResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs",
      "--runner",
      approvedRunnerPath,
      "--receipt",
      wrongReceiptSourceRunIdPath,
      "--out-dir",
      join(smokeRoot, "wrong-receipt-source-run-id")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Candidate ledger review blocks receipt sourceRunId mismatch",
  wrongReceiptSourceRunIdResult.status === "real_case_confirmed_outcome_candidate_ledger_review_blocked" &&
    wrongReceiptSourceRunIdResult.blockers.some((row) => row.code === "receipt_source_run_id_mismatch"),
  JSON.stringify({ blockers: wrongReceiptSourceRunIdResult.blockers })
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_candidate_ledger_review_gate_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  runnerSmokeStatus: runnerSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
