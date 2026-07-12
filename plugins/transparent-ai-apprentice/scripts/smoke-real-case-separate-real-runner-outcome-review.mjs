#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const runnerSmokeRoot = join(root, ".ta-smoke", "real-case-separate-real-runner");
const smokeRoot = join(root, ".ta-smoke", "real-case-separate-real-runner-outcome-review");
mkdirSync(smokeRoot, { recursive: true });

function runNode(args, { expectOk = true } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
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
  return files[files.length - 1];
}

function baseReceipt({ runnerPath, runner, receiptPath, decision, extra = {} }) {
  return {
    format: "transparent_ai_real_case_separate_real_runner_outcome_review_receipt_v1",
    sourceRunId: runner.runId,
    sourceRunPath: runnerPath,
    sourceRunHash: hashText(JSON.stringify(runner)),
    sourceReceiptPath: receiptPath,
    outputPath: runner.adapterRun.outputPath,
    outputSha256: hashFile(runner.adapterRun.outputPath),
    teacherDecision: decision,
    runnerPacketReviewed: true,
    runnerReceiptReviewed: true,
    controlledOutputReviewed: true,
    outputHashReviewed: true,
    rollbackRetained: true,
    locksReviewed: true,
    noMemoryWriteConfirmed: true,
    noRuleEnableConfirmed: true,
    noRagFetchConfirmed: true,
    noPackagingUnlockConfirmed: true,
    noAcceptanceClaimConfirmed: true,
    teacherNotes: "Teacher reviewed the controlled output and all lock assertions.",
    ...extra
  };
}

const checks = [];
function check(name, pass, evidence = "") {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const runnerSmoke = JSON.parse(runNode(["plugins/transparent-ai-apprentice/scripts/smoke-real-case-separate-real-runner.mjs"]).stdout);
const readyRunPath = latestFile(join(runnerSmokeRoot, "ready-run"), "real-case-separate-real-runner.json");
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
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-separate-real-runner-outcome-review-receipt.mjs",
    "--runner",
    readyRunPath,
    "--receipt",
    confirmedReceiptPath,
    "--out-dir",
    join(smokeRoot, "confirmed-review")
  ]).stdout
);
check(
  "Separate real runner outcome review confirms controlled output without unlocking memory or packaging",
  confirmedResult.status === "real_case_separate_real_runner_outcome_confirmed_waiting_for_memory_or_rule_gate" &&
    confirmedResult.confirmedOutcomeHandoff?.format ===
      "transparent_ai_real_case_separate_real_runner_confirmed_outcome_handoff_v1" &&
    confirmedResult.confirmedOutcomeHandoff?.memoryWriteAllowedHere === false &&
    confirmedResult.confirmedOutcomeHandoff?.ruleEnableAllowedHere === false &&
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
      teacherCorrection: "The controlled output used the right runner but missed a required dimension relation; return to high reasoning to repair the logic contract."
    }
  })
);
const repairResult = JSON.parse(
  runNode([
    "plugins/transparent-ai-apprentice/scripts/validate-real-case-separate-real-runner-outcome-review-receipt.mjs",
    "--runner",
    readyRunPath,
    "--receipt",
    repairReceiptPath,
    "--out-dir",
    join(smokeRoot, "repair-review")
  ]).stdout
);
check(
  "Separate real runner outcome review routes teacher correction to high-reasoning repair without execution",
  repairResult.status === "real_case_separate_real_runner_outcome_routes_to_high_reasoning_repair" &&
    repairResult.highReasoningRepairHandoff?.format ===
      "transparent_ai_real_case_separate_real_runner_high_reasoning_repair_handoff_v1" &&
    repairResult.highReasoningRepairHandoff?.requiredReasoningTier === "high" &&
    repairResult.highReasoningRepairHandoff?.executeNow === false &&
    repairResult.locks?.targetSoftwareCommandsExecutedAgain === false,
  JSON.stringify({ reviewPath: repairResult.reviewPath })
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
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-separate-real-runner-outcome-review-receipt.mjs",
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
  "Separate real runner outcome review blocks forbidden memory or acceptance decisions",
  forbiddenResult.status === "real_case_separate_real_runner_outcome_review_blocked" &&
    forbiddenResult.blockers.some((row) => row.code === "forbidden_teacher_decision") &&
    forbiddenResult.memoryWritten === false &&
    forbiddenResult.accepted === false,
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
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-separate-real-runner-outcome-review-receipt.mjs",
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
  "Separate real runner outcome review blocks controlled output hash mismatch",
  tamperedResult.status === "real_case_separate_real_runner_outcome_review_blocked" &&
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
      rollbackRetained: false
    }
  })
);
const incompleteResult = JSON.parse(
  runNode(
    [
      "plugins/transparent-ai-apprentice/scripts/validate-real-case-separate-real-runner-outcome-review-receipt.mjs",
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
  "Separate real runner outcome review blocks incomplete teacher review confirmations",
  incompleteResult.status === "real_case_separate_real_runner_outcome_review_blocked" &&
    incompleteResult.blockers.some((row) => row.code === "controlled_output_not_reviewed") &&
    incompleteResult.blockers.some((row) => row.code === "rollback_not_retained"),
  JSON.stringify({ blockers: incompleteResult.blockers })
);

const summary = {
  format: "transparent_ai_real_case_separate_real_runner_outcome_review_smoke_v1",
  status: checks.every((row) => row.pass) ? "passed" : "failed",
  passed: checks.filter((row) => row.pass).length,
  total: checks.length,
  runnerSmokeStatus: runnerSmoke.status,
  smokeRoot,
  checks
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "passed") process.exit(1);
