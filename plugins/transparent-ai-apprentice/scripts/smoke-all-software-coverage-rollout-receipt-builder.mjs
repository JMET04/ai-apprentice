#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-coverage-rollout-receipt-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${scriptName} was expected to fail`);
    if (!result.stdout) throw new Error(result.stderr || `${scriptName} failed without JSON output`);
    return {
      ...JSON.parse(result.stdout),
      failedAsExpected: true,
      exitStatus: result.status
    };
  }
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const planPath = join(smokeRoot, "fixture-coverage-expansion-plan.json");
writeFileSync(
  planPath,
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_coverage_expansion_plan_v1",
      planId: "coverage-rollout-receipt-smoke-plan",
      createdAt: new Date().toISOString(),
      status: "waiting_for_teacher_review",
      batches: [
        {
          batchId: "batch-001",
          status: "waiting_for_teacher_review",
          batchSize: 2,
          rows: [
            { software: "ExampleAppOne", processName: "ExampleAppOne", signalStatus: "has_log_metadata_route" },
            { software: "ExampleAppTwo", processName: "ExampleAppTwo", signalStatus: "has_log_metadata_route" }
          ]
        },
        {
          batchId: "batch-002",
          status: "waiting_for_teacher_review",
          batchSize: 1,
          rows: [{ software: "ExampleAppThree", processName: "ExampleAppThree", signalStatus: "has_log_metadata_route" }]
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        softwareActionsExecuted: false,
        memoryWritten: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const builderResult = runNodeScript("create-all-software-coverage-rollout-receipt-builder.mjs", [
  "--goal",
  "Create a teacher receipt builder before widening all-software coverage rollout.",
  "--plan",
  planPath,
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
      format: "transparent_ai_all_software_coverage_rollout_review_receipt_v1",
      builderId: builder.builderId,
      sourceExpansionPlan: planPath,
      decision: "needs_teacher_review",
      batchDecisions: builder.reviewRows.map((row) => ({
        batchId: row.batchId,
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
const defaultValidation = runNodeScript("validate-all-software-coverage-rollout-receipt.mjs", [
  "--plan",
  planPath,
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
      format: "transparent_ai_all_software_coverage_rollout_review_receipt_v1",
      builderId: builder.builderId,
      sourceExpansionPlan: planPath,
      decision: "needs_teacher_review",
      batchDecisions: [
        {
          batchId: "batch-001",
          teacherDecision: "teacher_reviewed_prepare_rollout",
          evidenceReviewed: true
        },
        {
          batchId: "batch-002",
          teacherDecision: "blocked_needs_more_evidence",
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
const reviewedValidation = runNodeScript("validate-all-software-coverage-rollout-receipt.mjs", [
  "--plan",
  planPath,
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
      format: "transparent_ai_all_software_coverage_rollout_review_receipt_v1",
      builderId: builder.builderId,
      sourceExpansionPlan: planPath,
      decision: "execute_now",
      batchDecisions: [
        {
          batchId: "batch-001",
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
const forbiddenValidation = runNodeScript("validate-all-software-coverage-rollout-receipt.mjs", [
  "--plan",
  planPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });

const checks = [
  check(
    "Coverage rollout receipt builder writes HTML and machine-readable builder without invoking rollout",
    builder.format === "transparent_ai_all_software_coverage_rollout_receipt_builder_v1" &&
      existsSync(builderResult.htmlPath) &&
      html.includes("Coverage Rollout Receipt Builder") &&
      html.includes("teacher_reviewed_prepare_rollout") &&
      builder.locks.rolloutSupervisorInvoked === false &&
      builder.locks.coverageRunnerInvoked === false,
    builderResult.builderPath
  ),
  check(
    "Default coverage rollout receipt stays waiting for teacher review",
    defaultValidation.format === "transparent_ai_all_software_coverage_rollout_receipt_validation_result_v1" &&
      defaultValidation.readyRowCount === 0 &&
      defaultValidation.status === "waiting_for_teacher_coverage_rollout_review",
    defaultValidation.validationPath
  ),
  check(
    "Reviewed batch becomes review-only rollout supervisor command without running it",
    reviewedValidation.readyRowCount === 1 &&
      reviewedValidationPacket.nextReviewCommands.length === 1 &&
      reviewedValidationPacket.nextReviewCommands[0].tool === "run_all_software_coverage_rollout_supervisor" &&
      reviewedValidationPacket.nextReviewCommands[0].commandLine.includes("--teacher-reviewed") &&
      reviewedValidationPacket.locks.rolloutSupervisorInvoked === false &&
      reviewedValidationPacket.locks.coverageRunnerInvoked === false,
    reviewedValidation.validationPath
  ),
  check(
    "Forbidden execute-now decision fails closed",
    forbiddenValidation.status === "blocked" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.locks.rolloutSupervisorInvoked === false &&
      forbiddenValidation.failedAsExpected === true &&
      forbiddenValidation.exitStatus !== 0,
    forbiddenValidation.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_coverage_rollout_receipt_builder_smoke_v1",
  smokeRoot,
  paths: {
    plan: planPath,
    builder: builderResult.builderPath,
    html: builderResult.htmlPath,
    reviewedValidation: reviewedValidation.validationPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
