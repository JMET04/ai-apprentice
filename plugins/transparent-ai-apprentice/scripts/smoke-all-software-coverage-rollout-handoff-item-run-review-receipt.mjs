#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "coverage-rollout-handoff-item-run-review-receipt-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = [], options = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (options.expectFailure) {
    if (result.status === 0) throw new Error(`${script} was expected to fail`);
    if (!result.stdout) throw new Error(`${script} failed without JSON output\nSTDERR:\n${result.stderr}`);
    return {
      ...JSON.parse(result.stdout),
      failedAsExpected: true,
      exitStatus: result.status
    };
  }
  if (result.status !== 0) {
    throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const planPath = writeJson(join(smokeRoot, "coverage-expansion-plan.json"), {
  format: "transparent_ai_all_software_coverage_expansion_plan_v1",
  planId: "smoke-coverage-rollout-run-review-plan",
  status: "waiting_for_teacher_review",
  batches: [
    {
      batchId: "batch-001",
      batchSize: 2,
      status: "prepared_waiting_for_teacher_review",
      rows: [
        { software: "SmokeApp One", processName: "smoke-one.exe", signalStatus: "has_log_metadata_route" },
        { software: "SmokeApp Two", processName: "smoke-two.exe", signalStatus: "needs_observer_queue" }
      ]
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    allSoftwareCoverageComplete: false
  }
});

const rolloutReceiptPath = writeJson(join(smokeRoot, "teacher-coverage-rollout-receipt.json"), {
  format: "transparent_ai_all_software_coverage_rollout_review_receipt_v1",
  batchDecisions: [
    {
      batchId: "batch-001",
      teacherDecision: "teacher_reviewed_prepare_rollout",
      evidenceReviewed: true,
      teacherNote: "smoke teacher reviewed first batch"
    }
  ]
});

const validationResult = runNode("validate-all-software-coverage-rollout-receipt.mjs", [
  "--plan",
  planPath,
  "--receipt",
  rolloutReceiptPath,
  "--goal",
  "smoke validated coverage rollout receipt for run review",
  "--output-dir",
  join(smokeRoot, "validation")
]);
const queueResult = runNode("create-all-software-coverage-rollout-handoff-queue.mjs", [
  "--validation",
  validationResult.validationPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const itemRunResult = runNode("run-all-software-coverage-rollout-handoff-queue-item.mjs", [
  "--queue",
  queueResult.queuePath,
  "--item-number",
  "2",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed coverage rollout handoff item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-run")
]);
const itemRun = readJson(itemRunResult.runPath);

const builderResult = runNode("create-all-software-coverage-rollout-handoff-item-run-review-receipt-builder.mjs", [
  "--run",
  itemRunResult.runPath,
  "--run-receipt",
  itemRunResult.receiptPath,
  "--goal",
  "smoke teacher review for one coverage rollout handoff item run",
  "--output-dir",
  join(smokeRoot, "builder")
]);
const template = readJson(builderResult.receiptTemplatePath);
const matchedReceiptPath = writeJson(join(smokeRoot, "matched-teacher-receipt.json"), {
  ...template,
  teacherDecision: "item_run_matched_expected",
  evidenceReviewed: true,
  supervisorReceiptReviewed: true,
  postBatchAuditReviewed: true,
  lowTokenOutcomeReviewed: true,
  teacherMatchedExpected: true,
  rollbackPointStillRetained: true,
  teacherConfirmation: "teacher reviewed rollout handoff item run evidence and rollback point remains retained",
  teacherNotes: "smoke matched receipt"
});
const mismatchReceiptPath = writeJson(join(smokeRoot, "mismatch-teacher-receipt.json"), {
  ...template,
  teacherDecision: "item_run_mismatch_blocked",
  evidenceReviewed: true,
  supervisorReceiptReviewed: true,
  postBatchAuditReviewed: true,
  lowTokenOutcomeReviewed: true,
  teacherMatchedExpected: false,
  rollbackPointStillRetained: true,
  teacherConfirmation: "teacher found mismatch"
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-teacher-receipt.json"), {
  ...template,
  teacherDecision: "claim_coverage_complete",
  evidenceReviewed: true,
  supervisorReceiptReviewed: true,
  postBatchAuditReviewed: true,
  lowTokenOutcomeReviewed: true,
  teacherMatchedExpected: true,
  rollbackPointStillRetained: true,
  teacherConfirmation: "teacher tried forbidden decision"
});
const incompleteReceiptPath = writeJson(join(smokeRoot, "incomplete-teacher-receipt.json"), {
  ...template,
  teacherDecision: "item_run_matched_expected",
  evidenceReviewed: true,
  supervisorReceiptReviewed: false,
  postBatchAuditReviewed: false,
  lowTokenOutcomeReviewed: true,
  teacherMatchedExpected: true,
  rollbackPointStillRetained: true,
  teacherConfirmation: "teacher skipped some evidence"
});

const matchedValidation = runNode("validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  matchedReceiptPath,
  "--output-dir",
  join(smokeRoot, "matched-validation")
]);
const mismatchValidation = runNode("validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  mismatchReceiptPath,
  "--output-dir",
  join(smokeRoot, "mismatch-validation")
]);
const forbiddenValidation = runNode("validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });
const incompleteValidation = runNode("validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  incompleteReceiptPath,
  "--output-dir",
  join(smokeRoot, "incomplete-validation")
]);

const matched = readJson(matchedValidation.validationPath);
const mismatch = readJson(mismatchValidation.validationPath);
const forbidden = readJson(forbiddenValidation.validationPath);
const incomplete = readJson(incompleteValidation.validationPath);

const checks = [
  {
    name: "Coverage rollout handoff item run review builder creates teacher receipt template from a real one-item run",
    pass:
      builderResult.status === "coverage_rollout_handoff_item_run_review_receipt_builder_ready" &&
      builderResult.selectedBatchId === "batch-001" &&
      itemRun.status === "reviewed_coverage_rollout_handoff_item_advanced",
    evidence: builderResult.builderPath
  },
  {
    name: "Matched teacher review prepares convergence audit command template only",
    pass:
      matchedValidation.status === "validated_ready_for_review_only_convergence_audit" &&
      matched.validationDecision === "coverage_rollout_handoff_item_run_reviewed_for_convergence_audit" &&
      matched.nextReviewCommands.length === 1 &&
      matched.nextReviewCommands[0].command.includes("create-all-software-coverage-convergence-audit.mjs") &&
      matched.nextReviewCommands[0].executesNow === false,
    evidence: matchedValidation.validationPath
  },
  {
    name: "Mismatched teacher review blocks follow-up without convergence command",
    pass:
      mismatchValidation.status === "blocked" &&
      mismatch.validationDecision === "blocked_by_teacher_mismatch" &&
      mismatch.nextReviewCommands.length === 0,
    evidence: mismatchValidation.receiptPath
  },
  {
    name: "Forbidden coverage completion decision fails closed",
    pass:
      forbiddenValidation.status === "blocked" &&
      forbidden.validationDecision === "blocked_for_forbidden_decision" &&
      forbidden.nextReviewCommands.length === 0 &&
      forbiddenValidation.failedAsExpected === true &&
      forbiddenValidation.exitStatus !== 0,
    evidence: forbiddenValidation.receiptPath
  },
  {
    name: "Matched decision without complete supervisor and audit review stays waiting",
    pass:
      incompleteValidation.status === "waiting_for_teacher_review" &&
      incomplete.validationDecision === "needs_teacher_review_or_missing_evidence" &&
      incomplete.nextReviewCommands.length === 0,
    evidence: incompleteValidation.validationPath
  },
  {
    name: "Coverage rollout handoff item run review keeps all completion and system-change locks closed",
    pass:
      matched.locks.reviewOnly === true &&
      matched.locks.validationDoesNotRerunItem === true &&
      matched.locks.validationDoesNotRunCommands === true &&
      matched.locks.validationDoesNotReadLogs === true &&
      matched.locks.validationDoesNotCaptureScreenshots === true &&
      matched.locks.validationDoesNotExecuteTargetSoftware === true &&
      matched.locks.validationDoesNotWriteMemory === true &&
      matched.locks.allSoftwareCoverageComplete === false &&
      matched.locks.nativeUniversalExecution === false &&
      matched.locks.goalComplete === false,
    evidence: JSON.stringify(matched.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const output = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_smoke_v1",
  smokeRoot,
  passed,
  total: checks.length,
  paths: {
    itemRun: itemRunResult.runPath,
    itemRunReceipt: itemRunResult.receiptPath,
    builder: builderResult.builderPath,
    receiptTemplate: builderResult.receiptTemplatePath,
    matchedValidation: matchedValidation.validationPath,
    mismatchValidation: mismatchValidation.validationPath,
    forbiddenValidation: forbiddenValidation.validationPath,
    incompleteValidation: incompleteValidation.validationPath
  },
  checks
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
