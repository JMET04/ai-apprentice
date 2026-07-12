#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const runnerSmokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-separate-real-runner");
const smokeRoot = join(root, ".ta-smoke", "real-case-confirmed-outcome-separate-real-runner-outcome-review");
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

function baseReceipt({ runnerPath, runner, receiptPath, decision, extra = {} }) {
  return {
    format: "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_receipt_v1",
    sourceRunId: runner.runId,
    sourceRunPath: runnerPath,
    sourceRunHash: hashText(JSON.stringify(runner)),
    sourceReviewFormat: runner.sourceReviewFormat,
    sourceConfirmedOutcomeReviewId: runner.sourceConfirmedOutcomeReviewId,
    sourceConfirmedOutcomeSourceRunId: runner.sourceConfirmedOutcomeSourceRunId,
    sourceReceiptPath: receiptPath,
    outputPath: runner.adapterRun.outputPath,
    outputSha256: hashFile(runner.adapterRun.outputPath),
    teacherDecision: decision,
    runnerPacketReviewed: true,
    runnerReceiptReviewed: true,
    controlledOutputReviewed: true,
    outputHashReviewed: true,
    confirmedOutcomeBranchReviewed: true,
    rollbackRetained: true,
    locksReviewed: true,
    noMemoryWriteConfirmed: true,
    noRuleEnableConfirmed: true,
    noRagFetchConfirmed: true,
    noPackagingUnlockConfirmed: true,
    noAcceptanceClaimConfirmed: true,
    noGoalCompletionClaimConfirmed: true,
    teacherNotes: "Teacher reviewed the confirmed-outcome controlled output and all lock assertions.",
    ...extra
  };
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const runnerSmoke = JSON.parse(runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-separate-real-runner.mjs"]).stdout);
const readyRunPath = latestFile(join(runnerSmokeRoot, "ready-run"), "real-case-confirmed-outcome-separate-real-runner.json");
const runner = readJson(readyRunPath);
const runnerReceiptPath = runner.paths.receipt;

const confirmedReceiptPath = writeJson(
  join(smokeRoot, "confirmed-outcome-review-receipt.json"),
  baseReceipt({
    runnerPath: readyRunPath,
    runner,
    receiptPath: runnerReceiptPath,
    decision: "confirm_controlled_output_matches_intent"
  })
);
const confirmedResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs",
    "--runner",
    readyRunPath,
    "--receipt",
    confirmedReceiptPath,
    "--out-dir",
    join(smokeRoot, "confirmed-review")
  ]).stdout
);
check(
  "Confirmed outcome separate real runner outcome review confirms controlled output without durable side effects",
  confirmedResult.status ===
    "real_case_confirmed_outcome_separate_real_runner_outcome_confirmed_waiting_for_memory_or_rule_gate" &&
    confirmedResult.confirmedOutcomeHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_separate_real_runner_confirmed_outcome_handoff_v1" &&
    confirmedResult.confirmedOutcomeHandoff?.confirmedOutcomeBranch === true &&
    confirmedResult.sourceReviewFormat === expectedSourceReviewFormat &&
    confirmedResult.sourceConfirmedOutcomeReviewId === runner.sourceConfirmedOutcomeReviewId &&
    confirmedResult.sourceConfirmedOutcomeSourceRunId === runner.sourceConfirmedOutcomeSourceRunId &&
    confirmedResult.sourceRunId === runner.runId &&
    confirmedResult.confirmedOutcomeHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    confirmedResult.confirmedOutcomeHandoff?.sourceConfirmedOutcomeReviewId === runner.sourceConfirmedOutcomeReviewId &&
    confirmedResult.confirmedOutcomeHandoff?.sourceConfirmedOutcomeSourceRunId === runner.sourceConfirmedOutcomeSourceRunId &&
    confirmedResult.confirmedOutcomeHandoff?.sourceRunId === runner.runId &&
    confirmedResult.confirmedOutcomeHandoff?.memoryWriteAllowedHere === false &&
    confirmedResult.confirmedOutcomeHandoff?.ruleEnableAllowedHere === false &&
    confirmedResult.productionRuleRegistryMutated === false &&
    confirmedResult.durableActivationWritten === false &&
    confirmedResult.memoryWritten === false &&
    confirmedResult.ragFetched === false &&
    confirmedResult.packagingUnlocked === false &&
    confirmedResult.goalComplete === false,
  JSON.stringify({ reviewPath: confirmedResult.reviewPath })
);

const repairReceiptPath = writeJson(
  join(smokeRoot, "repair-outcome-review-receipt.json"),
  baseReceipt({
    runnerPath: readyRunPath,
    runner,
    receiptPath: runnerReceiptPath,
    decision: "request_high_reasoning_repair",
    extra: {
      teacherCorrection:
        "The confirmed-outcome runner used the right adapter but missed a strict dimension relation; repair the logic contract before another execution.",
      affectedLogicFields: ["dimension_relation", "controlled_output"]
    }
  })
);
const repairResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs",
    "--runner",
    readyRunPath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair-review")
  ]).stdout
);
check(
  "Confirmed outcome separate real runner outcome review routes teacher correction to high-reasoning repair",
  repairResult.status === "real_case_confirmed_outcome_separate_real_runner_outcome_routes_to_high_reasoning_repair" &&
    repairResult.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_confirmed_outcome_separate_real_runner_high_reasoning_repair_handoff_v1" &&
    repairResult.highReasoningRepairHandoff?.sourceReviewFormat === expectedSourceReviewFormat &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeReviewId === runner.sourceConfirmedOutcomeReviewId &&
    repairResult.highReasoningRepairHandoff?.sourceConfirmedOutcomeSourceRunId === runner.sourceConfirmedOutcomeSourceRunId &&
    repairResult.highReasoningRepairHandoff?.sourceRunId === runner.runId &&
    repairResult.highReasoningRepairHandoff?.requiredReasoningTier === "high" &&
    repairResult.highReasoningRepairHandoff?.executeNow === false &&
    repairResult.locks?.targetSoftwareCommandsExecutedAgain === false,
  JSON.stringify({ reviewPath: repairResult.reviewPath })
);

const sourceTamperedRunnerPath = writeJson(join(smokeRoot, "source-tampered-runner.json"), {
  ...runner,
  sourceReviewFormat: "transparent_ai_real_case_unconfirmed_outcome_review_v1",
  sourceConfirmedOutcomeSourceRunId: "tampered-source-run-id"
});
const sourceTamperedRunner = readJson(sourceTamperedRunnerPath);
const sourceTamperedReceiptPath = writeJson(
  join(smokeRoot, "source-tampered-outcome-review-receipt.json"),
  baseReceipt({
    runnerPath: sourceTamperedRunnerPath,
    runner: sourceTamperedRunner,
    receiptPath: runnerReceiptPath,
    decision: "confirm_controlled_output_matches_intent",
    extra: {
      sourceConfirmedOutcomeSourceRunId: "receipt-different-tampered-source-run-id",
      sourceRunId: "different-runner-run-id"
    }
  })
);
const sourceTamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs",
      "--runner",
      sourceTamperedRunnerPath,
      "--receipt",
      sourceTamperedReceiptPath,
      "--out-dir",
      join(smokeRoot, "source-tampered-review")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome separate real runner outcome review blocks lost confirmed-outcome source continuity",
    sourceTamperedResult.status === "real_case_confirmed_outcome_separate_real_runner_outcome_review_blocked" &&
    sourceTamperedResult.blockers.some((row) => row.code === "runner_source_review_format_mismatch") &&
    sourceTamperedResult.blockers.some((row) => row.code === "receipt_source_confirmed_outcome_source_run_id_mismatch") &&
    sourceTamperedResult.blockers.some((row) => row.code === "source_run_id_mismatch") &&
    sourceTamperedResult.memoryWritten === false &&
    sourceTamperedResult.ragFetched === false &&
    sourceTamperedResult.ruleEnabled === false,
  JSON.stringify({ blockers: sourceTamperedResult.blockers })
);

const missingSourceRunRunnerPath = writeJson(join(smokeRoot, "missing-source-run-runner.json"), {
  ...runner,
  sourceConfirmedOutcomeSourceRunId: ""
});
const missingSourceRunReceiptPath = writeJson(
  join(smokeRoot, "missing-source-run-outcome-review-receipt.json"),
  baseReceipt({
    runnerPath: missingSourceRunRunnerPath,
    runner: readJson(missingSourceRunRunnerPath),
    receiptPath: runnerReceiptPath,
    decision: "confirm_controlled_output_matches_intent"
  })
);
const missingSourceRunResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs",
      "--runner",
      missingSourceRunRunnerPath,
      "--receipt",
      missingSourceRunReceiptPath,
      "--out-dir",
      join(smokeRoot, "missing-source-run-review")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome separate real runner outcome review blocks missing source run continuity",
  missingSourceRunResult.status === "real_case_confirmed_outcome_separate_real_runner_outcome_review_blocked" &&
    missingSourceRunResult.blockers.some((row) => row.code === "runner_confirmed_outcome_source_ids_missing") &&
    missingSourceRunResult.memoryWritten === false &&
    missingSourceRunResult.ragFetched === false &&
    missingSourceRunResult.ruleEnabled === false,
  JSON.stringify({ blockers: missingSourceRunResult.blockers })
);

const missingCurrentSourceRunRunnerPath = writeJson(join(smokeRoot, "missing-current-source-run-runner.json"), {
  ...runner,
  sourceRunId: ""
});
const missingCurrentSourceRunReceiptPath = writeJson(
  join(smokeRoot, "missing-current-source-run-outcome-review-receipt.json"),
  baseReceipt({
    runnerPath: missingCurrentSourceRunRunnerPath,
    runner: readJson(missingCurrentSourceRunRunnerPath),
    receiptPath: runnerReceiptPath,
    decision: "confirm_controlled_output_matches_intent"
  })
);
const missingCurrentSourceRunResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs",
      "--runner",
      missingCurrentSourceRunRunnerPath,
      "--receipt",
      missingCurrentSourceRunReceiptPath,
      "--out-dir",
      join(smokeRoot, "missing-current-source-run-review")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome separate real runner outcome review blocks missing current sourceRunId",
  missingCurrentSourceRunResult.status === "real_case_confirmed_outcome_separate_real_runner_outcome_review_blocked" &&
    missingCurrentSourceRunResult.blockers.some((row) => row.code === "runner_confirmed_outcome_source_ids_missing") &&
    missingCurrentSourceRunResult.memoryWritten === false &&
    missingCurrentSourceRunResult.ragFetched === false &&
    missingCurrentSourceRunResult.ruleEnabled === false,
  JSON.stringify({ blockers: missingCurrentSourceRunResult.blockers })
);

const forbiddenReceiptPath = writeJson(
  join(smokeRoot, "forbidden-outcome-review-receipt.json"),
  baseReceipt({
    runnerPath: readyRunPath,
    runner,
    receiptPath: runnerReceiptPath,
    decision: "write_memory"
  })
);
const forbiddenResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs",
      "--runner",
      readyRunPath,
      "--receipt",
      forbiddenReceiptPath,
      "--out-dir",
      join(smokeRoot, "forbidden-review")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome separate real runner outcome review blocks forbidden durable or acceptance decisions",
  forbiddenResult.status === "real_case_confirmed_outcome_separate_real_runner_outcome_review_blocked" &&
    forbiddenResult.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenResult.memoryWritten === false &&
    forbiddenResult.accepted === false &&
    forbiddenResult.durableActivationWritten === false,
  JSON.stringify({ blockers: forbiddenResult.blockers })
);

const tamperedReceiptPath = writeJson(
  join(smokeRoot, "tampered-hash-outcome-review-receipt.json"),
  baseReceipt({
    runnerPath: readyRunPath,
    runner,
    receiptPath: runnerReceiptPath,
    decision: "confirm_controlled_output_matches_intent",
    extra: { outputSha256: "0".repeat(64) }
  })
);
const tamperedResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs",
      "--runner",
      readyRunPath,
      "--receipt",
      tamperedReceiptPath,
      "--out-dir",
      join(smokeRoot, "tampered-review")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome separate real runner outcome review blocks controlled output hash mismatch",
  tamperedResult.status === "real_case_confirmed_outcome_separate_real_runner_outcome_review_blocked" &&
    tamperedResult.blockers.some((row) => row.code === "controlled_output_hash_mismatch"),
  JSON.stringify({ blockers: tamperedResult.blockers })
);

const incompleteReceiptPath = writeJson(
  join(smokeRoot, "incomplete-outcome-review-receipt.json"),
  baseReceipt({
    runnerPath: readyRunPath,
    runner,
    receiptPath: runnerReceiptPath,
    decision: "confirm_controlled_output_matches_intent",
    extra: {
      controlledOutputReviewed: false,
      confirmedOutcomeBranchReviewed: false,
      rollbackRetained: false
    }
  })
);
const incompleteResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs",
      "--runner",
      readyRunPath,
      "--receipt",
      incompleteReceiptPath,
      "--out-dir",
      join(smokeRoot, "incomplete-review")
    ],
    { expectOk: false }
  ).stdout
);
check(
  "Confirmed outcome separate real runner outcome review blocks incomplete teacher review confirmations",
  incompleteResult.status === "real_case_confirmed_outcome_separate_real_runner_outcome_review_blocked" &&
    incompleteResult.blockers.some((row) => row.code === "controlled_output_not_reviewed") &&
    incompleteResult.blockers.some((row) => row.code === "confirmed_outcome_branch_not_reviewed") &&
    incompleteResult.blockers.some((row) => row.code === "rollback_not_retained"),
  JSON.stringify({ blockers: incompleteResult.blockers })
);

const summary = {
  format: "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  runnerSmokeStatus: runnerSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
