#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(scriptName, args, options = {}) {
  const result = spawnSync(process.execPath, [join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: options.timeout ?? 180000,
    maxBuffer: 40 * 1024 * 1024
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} unexpectedly succeeded`);
    const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
    return { ...parsed, failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

function assertCheck(checks, name, pass, evidence) {
  checks.push({ name, pass: Boolean(pass), evidence });
}

const outputRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-lane-run-review-receipt-smoke", String(Date.now()))
);
mkdirSync(outputRoot, { recursive: true });

const runPath = join(outputRoot, "lane-run.json");
const runReceiptPath = join(outputRoot, "lane-run-receipt.json");
const run = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_lane_request_run_v1",
  runId: "smoke-lane-run",
  createdAt: new Date().toISOString(),
  status: "completed_review_only_completion_blocker_lane_safe_step",
  requestPath: join(outputRoot, "request.json"),
  selectedLane: {
    lane: "rollback_evidence_before_system_change",
    itemNumber: 1,
    scriptName: "create-rollback-point.mjs"
  },
  teacherConfirmed: true,
  rollbackPointCreated: true,
  rollbackPoint: "smoke-retained-rollback-point",
  safeScriptInvoked: true,
  generatedEvidence: {
    safeScriptResultPath: join(outputRoot, "safe-script-result.json"),
    childFormat: "transparent_ai_rollback_point_v1",
    childStatus: "waiting_for_teacher_confirmation",
    childPath: join(outputRoot, "rollback-point.json")
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    laneRunnerDoesNotExecuteTargetSoftware: true,
    laneRunnerDoesNotWriteMemory: true,
    goalComplete: false
  }
};
const runReceipt = {
  format: "transparent_ai_original_goal_completion_blocker_lane_request_run_receipt_v1",
  runId: run.runId,
  status: run.status,
  selectedLane: run.selectedLane,
  teacherConfirmed: true,
  rollbackPointCreated: true,
  safeScriptInvoked: true,
  safeScriptResultPath: run.generatedEvidence.safeScriptResultPath,
  commandsExecuted: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  goalComplete: false,
  locks: run.locks
};
writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
writeFileSync(runReceiptPath, `${JSON.stringify(runReceipt, null, 2)}\n`, "utf8");
writeFileSync(run.generatedEvidence.safeScriptResultPath, `${JSON.stringify({ ok: true }, null, 2)}\n`, "utf8");

const builder = runScript("create-original-goal-completion-blocker-lane-run-review-receipt-builder.mjs", [
  "--run",
  runPath,
  "--run-receipt",
  runReceiptPath,
  "--output-dir",
  join(outputRoot, "builder")
]);
const template = readJson(builder.paths.receiptTemplate);

const blockedReceiptPath = join(outputRoot, "blocked-receipt.json");
writeFileSync(blockedReceiptPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
const blockedValidation = runScript("validate-original-goal-completion-blocker-lane-run-review-receipt.mjs", [
  "--builder",
  builder.paths.builder,
  "--receipt",
  blockedReceiptPath,
  "--output-dir",
  join(outputRoot, "blocked-validation")
]);

const reviewedReceiptPath = join(outputRoot, "reviewed-receipt.json");
writeFileSync(
  reviewedReceiptPath,
  `${JSON.stringify(
    {
      ...template,
      teacherDecision: "lane_run_reviewed",
      evidenceReviewed: true,
      runOutcomeMatchesExpectedLane: true,
      rollbackPointStillRetained: true,
      preserveBlockerIfMismatch: true,
      teacherConfirmation: "teacher reviewed completion blocker lane run"
    },
    null,
    2
  )}\n`,
  "utf8"
);
const reviewedValidation = runScript("validate-original-goal-completion-blocker-lane-run-review-receipt.mjs", [
  "--builder",
  builder.paths.builder,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(outputRoot, "reviewed-validation")
]);

const forbiddenReceiptPath = join(outputRoot, "forbidden-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  `${JSON.stringify(
    {
      ...template,
      teacherDecision: "claim_complete",
      evidenceReviewed: true,
      runOutcomeMatchesExpectedLane: true,
      rollbackPointStillRetained: true,
      teacherConfirmation: "teacher reviewed completion blocker lane run"
    },
    null,
    2
  )}\n`,
  "utf8"
);
const forbiddenValidation = runScript("validate-original-goal-completion-blocker-lane-run-review-receipt.mjs", [
  "--builder",
  builder.paths.builder,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(outputRoot, "forbidden-validation")
], { expectFailure: true });

const checks = [];
assertCheck(
  checks,
  "Completion blocker lane run review receipt builder writes HTML and template",
  builder.format === "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_builder_v1" &&
    builder.runSummary.lane === "rollback_evidence_before_system_change" &&
    existsSync(builder.paths.html) &&
    existsSync(builder.paths.receiptTemplate) &&
    builder.locks.builderDoesNotRerunLane === true &&
    builder.locks.builderDoesNotWriteMemory === true,
  builder.paths.html
);
assertCheck(
  checks,
  "Completion blocker lane run review validation blocks default unreviewed receipt",
  blockedValidation.status === "blocked_until_teacher_reviews_completion_blocker_lane_run" &&
    blockedValidation.validationDecision === "needs_teacher_review_or_missing_evidence" &&
    !blockedValidation.nextStatusRefreshCommand,
  blockedValidation.paths.validation
);
assertCheck(
  checks,
  "Completion blocker lane run review validation prepares only review-only status refresh after teacher review",
  reviewedValidation.status === "completion_blocker_lane_run_reviewed_waiting_for_current_status_refresh" &&
    reviewedValidation.validationDecision === "completion_blocker_lane_run_reviewed_for_next_status_refresh" &&
    reviewedValidation.nextStatusRefreshCommand.includes("create-original-goal-current-status-refresh.mjs") &&
    reviewedValidation.locks.validationDoesNotRerunLane === true &&
    reviewedValidation.locks.validationDoesNotExecuteTargetSoftware === true &&
    reviewedValidation.locks.goalComplete === false,
  reviewedValidation.paths.validation
);
assertCheck(
  checks,
  "Completion blocker lane run review validation blocks forbidden completion decisions",
  forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
    forbiddenValidation.status === "blocked_until_teacher_reviews_completion_blocker_lane_run" &&
    forbiddenValidation.failedAsExpected === true &&
    forbiddenValidation.exitStatus !== 0 &&
    forbiddenValidation.nextStatusRefreshCommand === "",
  forbiddenValidation.paths.validation
);

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_smoke_v1",
      passed: checks.length - failed.length,
      total: checks.length,
      outputRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
