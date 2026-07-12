#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-execution-follow-up-receipt-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} was expected to fail`);
    return { ...JSON.parse(result.stdout), failedAsExpected: true, exitStatus: result.status };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return { ...JSON.parse(result.stdout), exitStatus: result.status };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const batchPath = join(smokeRoot, "fixture-execution-follow-up-batch.json");
writeFileSync(
  batchPath,
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
      batchId: "fixture-batch",
      status: "waiting_for_teacher_review",
      goal: "Review prepared dry-run runner calls without executing software.",
      matrixPath: "D:\\example\\matrix.json",
      pilotQueuePath: "D:\\example\\pilot-queue.json",
      teacherReviewed: false,
      counts: {
        totalMatrixRows: 2,
        selectedRows: 2,
        dryRunRunnerInvocations: 0,
        preparedRunnerCalls: 1
      },
      rowResults: [
        {
          rowId: "row-001",
          software: "ExampleCAD",
          lane: "review_and_run_one_dry_run_pilot",
          status: "dry_run_runner_call_prepared_waiting_for_teacher_review",
          runnerInvoked: false,
          nextCall: {
            tool: "run_all_software_execution_pilot_runner",
            arguments: {
              queue: "D:\\example\\pilot-queue.json",
              pilotId: "pilot-001",
              execute: false
            },
            blockedUntil: "teacherReviewed=true and one reviewed pilot row is selected"
          }
        },
        {
          rowId: "row-002",
          software: "NeedsRoute",
          lane: "confirm_numbered_target_or_exact_route",
          status: "waiting_for_numbered_target_or_exact_route_confirmation",
          runnerInvoked: false
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        targetSoftwareCommandsExecuted: false,
        uiEventsSent: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const builderResult = runNodeScript("create-all-software-execution-follow-up-receipt-builder.mjs", [
  "--goal",
  "Create a teacher receipt builder for execution follow-up rows.",
  "--batch",
  batchPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const html = readFileSync(builderResult.htmlPath, "utf8");

const defaultReceiptPath = join(smokeRoot, "default-receipt.json");
writeFileSync(
  defaultReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_follow_up_review_receipt_v1",
      builderId: builder.builderId,
      sourceBatch: batchPath,
      decision: "needs_teacher_review",
      rowDecisions: builder.reviewRows.map((row) => ({
        rowId: row.rowId,
        software: row.software,
        teacherDecision: "needs_teacher_review",
        evidenceReviewed: false,
        teacherNote: ""
      })),
      locks: builder.locks
    },
    null,
    2
  ),
  "utf8"
);
const defaultValidation = runNodeScript("validate-all-software-execution-follow-up-receipt.mjs", [
  "--batch",
  batchPath,
  "--receipt",
  defaultReceiptPath,
  "--output-dir",
  join(smokeRoot, "default-validation")
]);

const reviewedReceiptPath = join(smokeRoot, "reviewed-receipt.json");
writeFileSync(
  reviewedReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_follow_up_review_receipt_v1",
      builderId: builder.builderId,
      sourceBatch: batchPath,
      decision: "needs_teacher_review",
      rowDecisions: [
        {
          rowId: "row-001",
          software: "ExampleCAD",
          teacherDecision: "teacher_reviewed_prepare_dry_run",
          evidenceReviewed: true,
          teacherNote: "reviewed prepared dry-run call"
        },
        {
          rowId: "row-002",
          software: "NeedsRoute",
          teacherDecision: "teacher_reviewed_prepare_dry_run",
          evidenceReviewed: true,
          teacherNote: "this row is not a prepared runner call"
        }
      ],
      locks: builder.locks
    },
    null,
    2
  ),
  "utf8"
);
const reviewedValidation = runNodeScript("validate-all-software-execution-follow-up-receipt.mjs", [
  "--batch",
  batchPath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "reviewed-validation")
]);
const reviewedValidationPacket = readJson(reviewedValidation.validationPath);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  JSON.stringify(
    {
      format: "transparent_ai_all_software_execution_follow_up_review_receipt_v1",
      builderId: builder.builderId,
      sourceBatch: batchPath,
      decision: "execute_now",
      rowDecisions: [
        {
          rowId: "row-001",
          software: "ExampleCAD",
          teacherDecision: "execute_now",
          evidenceReviewed: true
        }
      ],
      locks: builder.locks
    },
    null,
    2
  ),
  "utf8"
);
const forbiddenValidation = runNodeScript("validate-all-software-execution-follow-up-receipt.mjs", [
  "--batch",
  batchPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });

const checks = [
  check(
    "Execution follow-up receipt builder writes HTML and machine-readable builder without executing software",
    builder.format === "transparent_ai_all_software_execution_follow_up_receipt_builder_v1" &&
      existsSync(builderResult.htmlPath) &&
      html.includes("Execution Follow-Up Receipt Builder") &&
      html.includes("teacher_reviewed_prepare_dry_run") &&
      builder.locks.builderDoesNotInvokeRunner === true &&
      builder.locks.targetSoftwareCommandsExecuted === false,
    builderResult.builderPath
  ),
  check(
    "Default execution follow-up receipt stays waiting for teacher review",
    defaultValidation.format === "transparent_ai_all_software_execution_follow_up_receipt_validation_result_v1" &&
      defaultValidation.readyRowCount === 0 &&
      defaultValidation.status === "waiting_for_teacher_execution_follow_up_review",
    defaultValidation.validationPath
  ),
  check(
    "Reviewed prepared runner row becomes ready for dry-run runner review without invoking it",
    reviewedValidation.readyRowCount === 1 &&
      reviewedValidationPacket.nextDryRunReviewCommands.length === 1 &&
      reviewedValidationPacket.nextDryRunReviewCommands[0].arguments.execute === false &&
      reviewedValidationPacket.locks.dryRunRunnerInvoked === false &&
      reviewedValidationPacket.locks.targetSoftwareCommandsExecuted === false,
    reviewedValidation.validationPath
  ),
  check(
    "Forbidden execute-now decision fails closed before dry-run review commands",
    forbiddenValidation.failedAsExpected === true &&
      forbiddenValidation.exitStatus !== 0 &&
      forbiddenValidation.status === "blocked" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.locks.targetSoftwareCommandsExecuted === false,
    forbiddenValidation.validationPath
  )
];

const failed = checks.filter((item) => !item.pass);
const result = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_execution_follow_up_receipt_builder_smoke_v1",
  smokeRoot,
  paths: {
    builder: builderResult.builderPath,
    html: builderResult.htmlPath,
    defaultValidation: defaultValidation.validationPath,
    reviewedValidation: reviewedValidation.validationPath,
    forbiddenValidation: forbiddenValidation.validationPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (failed.length > 0) process.exit(1);
