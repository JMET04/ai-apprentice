#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "all-software-coverage-enrollment-follow-up-receipt-validation-smoke",
  String(Date.now())
);
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

const planPath = join(smokeRoot, "fixture-enrollment-follow-up-plan.json");
writeFileSync(
  planPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
      planId: "fixture-enrollment-plan",
      status: "coverage_follow_up_plan_ready",
      sourceLedgerPath: join(smokeRoot, "fixture-ledger.json"),
      followUpItems: [
        {
          followUpId: "enrollment-follow-up-001",
          ledgerNumber: 7,
          software: "Example Log App",
          route: "collect_watch_or_queue_item_evidence",
          tool: "watch_log_source_metadata_deltas",
          instruction: "Run metadata gate after teacher review.",
          expectedEvidence: "metadata gate receipt"
        },
        {
          followUpId: "enrollment-follow-up-002",
          ledgerNumber: 8,
          software: "Example Signal App",
          route: "ask_teacher_for_signal_or_exclusion",
          tool: "teach_apprentice",
          instruction: "Prepare a short teacher signal question.",
          expectedEvidence: "teacher signal or exclusion"
        }
      ],
      counts: { followUpItems: 2 },
      locks: {
        reviewOnly: true,
        accepted: false,
        softwareActionsExecuted: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const defaultReceiptPath = join(smokeRoot, "default-receipt.json");
writeFileSync(
  defaultReceiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1",
      decision: "needs_teacher_review",
      allowBoundedTail: false,
      rowDecisions: [
        {
          followUpId: "enrollment-follow-up-001",
          ledgerNumber: 7,
          software: "Example Log App",
          teacherDecision: "needs_teacher_review",
          evidenceReviewed: false
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const reviewedReceiptPath = join(smokeRoot, "reviewed-receipt.json");
writeFileSync(
  reviewedReceiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1",
      decision: "needs_teacher_review",
      allowBoundedTail: false,
      rowDecisions: [
        {
          followUpId: "enrollment-follow-up-001",
          ledgerNumber: 7,
          software: "Example Log App",
          teacherDecision: "teacher_reviewed_run_metadata_gate",
          evidenceReviewed: true
        },
        {
          followUpId: "enrollment-follow-up-002",
          ledgerNumber: 8,
          software: "Example Signal App",
          teacherDecision: "teacher_reviewed_prepare_signal_question",
          evidenceReviewed: true
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeFileSync(
  forbiddenReceiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1",
      decision: "accepted",
      allowBoundedTail: true,
      rowDecisions: [
        {
          followUpId: "enrollment-follow-up-001",
          ledgerNumber: 7,
          software: "Example Log App",
          teacherDecision: "allow_bounded_tail",
          evidenceReviewed: true
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const defaultResult = runNodeScript("validate-all-software-coverage-enrollment-follow-up-receipt.mjs", [
  "--plan",
  planPath,
  "--receipt",
  defaultReceiptPath,
  "--output-dir",
  join(smokeRoot, "default-validation")
]);
const defaultValidation = readJson(defaultResult.validationPath);
const reviewedResult = runNodeScript("validate-all-software-coverage-enrollment-follow-up-receipt.mjs", [
  "--plan",
  planPath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(smokeRoot, "reviewed-validation")
]);
const reviewedValidation = readJson(reviewedResult.validationPath);
const forbiddenResult = runNodeScript("validate-all-software-coverage-enrollment-follow-up-receipt.mjs", [
  "--plan",
  planPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });
const forbiddenValidation = readJson(forbiddenResult.validationPath);
const validationReadme = readFileSync(reviewedResult.readmePath, "utf8");
const mcpServerText = readFileSync(join(pluginRoot, "scripts", "mcp-server.mjs"), "utf8");

const checks = [
  check(
    "Default enrollment receipt validation waits for teacher review",
    defaultValidation.format === "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_v1" &&
      defaultValidation.status === "waiting_for_teacher_enrollment_follow_up_review" &&
      defaultValidation.validationDecision === "needs_teacher_review" &&
      defaultValidation.readyRowCount === 0 &&
      defaultValidation.nextBatchReviewCommands.length === 0 &&
      defaultValidation.locks.validationDoesNotRunBatch === true &&
      defaultValidation.locks.batchRunnerInvoked === false,
    defaultResult.validationPath
  ),
  check(
    "Reviewed enrollment receipt prepares only a separate reviewed batch command",
    reviewedValidation.status === "validated_with_ready_enrollment_follow_up_rows" &&
      reviewedValidation.validationDecision === "all_ready_rows_can_prepare_reviewed_enrollment_batch" &&
      reviewedValidation.readyRowCount === 2 &&
      reviewedValidation.nextBatchReviewCommands.length === 1 &&
      reviewedValidation.nextBatchReviewCommands[0].commandLine.includes("run-all-software-coverage-enrollment-follow-up-batch.mjs") &&
      reviewedValidation.nextBatchReviewCommands[0].commandLine.includes("--teacher-reviewed") &&
      reviewedValidation.nextBatchReviewCommands[0].arguments.allowBoundedTail === false &&
      reviewedValidation.nextBatchReviewCommands[0].executesNow === false &&
      reviewedValidation.locks.validationDoesNotReadLogs === true &&
      reviewedValidation.locks.softwareActionsExecuted === false &&
      validationReadme.includes("does not run the enrollment follow-up batch"),
    reviewedResult.validationPath
  ),
  check(
    "Enrollment receipt validation fails closed on forbidden decisions",
    forbiddenValidation.status === "blocked" &&
      forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.readyRowCount === 0 &&
      forbiddenValidation.nextBatchReviewCommands.length === 0 &&
      forbiddenValidation.validationRows[0].status === "blocked_for_forbidden_decision" &&
      forbiddenValidation.blockedTransitions.includes("allow_bounded_tail_from_validation") &&
      forbiddenValidation.locks.screenshotsCapturedByThisTool === false &&
      forbiddenValidation.locks.targetSoftwareCommandsExecuted === false &&
      forbiddenValidation.locks.nativeUniversalExecution === false &&
      forbiddenResult.failedAsExpected === true &&
      forbiddenResult.exitStatus !== 0,
    forbiddenResult.validationPath
  ),
  check(
    "MCP advanced surface exposes enrollment follow-up receipt validation",
    mcpServerText.includes("validate_all_software_coverage_enrollment_follow_up_receipt") &&
      mcpServerText.includes("validate-all-software-coverage-enrollment-follow-up-receipt.mjs"),
    "mcp-server.mjs contains validate_all_software_coverage_enrollment_follow_up_receipt"
  )
];

const failed = checks.filter((item) => !item.pass);
const result = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_smoke_v1",
  smokeRoot,
  paths: {
    defaultValidation: defaultResult.validationPath,
    reviewedValidation: reviewedResult.validationPath,
    forbiddenValidation: forbiddenResult.validationPath
  },
  checks
};

console.log(JSON.stringify(result, null, 2));
if (failed.length > 0) process.exit(1);
