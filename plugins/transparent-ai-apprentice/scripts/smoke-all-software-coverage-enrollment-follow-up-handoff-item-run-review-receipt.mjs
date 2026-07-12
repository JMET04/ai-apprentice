#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "coverage-enrollment-follow-up-handoff-item-run-review-receipt-smoke", String(Date.now()));
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
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence ?? "") };
}

const sourceLedgerPath = writeJson(join(smokeRoot, "source-enrollment-ledger.json"), {
  format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
  ledgerId: "smoke-source-ledger",
  rows: []
});
const reviewedSubsetLedgerPath = writeJson(join(smokeRoot, "teacher-reviewed-follow-up-subset-ledger.json"), {
  format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
  ledgerId: "smoke-reviewed-subset-ledger",
  sourceLedgerPath,
  subsetPurpose: "Smoke subset containing only teacher-reviewed low-token coverage follow-up rows.",
  counts: {
    reviewedFollowUpRows: 1,
    unreviewedRowsExcluded: 12
  },
  rows: []
});

const planPath = writeJson(join(smokeRoot, "coverage-enrollment-follow-up-plan.json"), {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
  planId: "smoke-coverage-enrollment-follow-up-plan",
  status: "coverage_follow_up_plan_ready",
  goal: "Smoke one coverage enrollment handoff item review receipt.",
  reviewScope: {
    scopeKind: "teacher_reviewed_subset_ledger",
    sourceLedgerPath,
    currentLedgerPath: reviewedSubsetLedgerPath,
    subsetPurpose: "Smoke subset containing only teacher-reviewed low-token coverage follow-up rows.",
    reviewedFollowUpRows: 1,
    unreviewedRowsExcluded: 12,
    requiresTeacherReviewedSubset: false
  },
  followUpItems: [
    {
      followUpId: "enrollment-follow-up-001",
      ledgerNumber: 1,
      software: "Smoke Signal App",
      route: "ask_teacher_for_signal_or_exclusion",
      tool: "teach_apprentice",
      arguments: {
        message: "Ask the teacher which compact signal identifies useful changes for Smoke Signal App."
      },
      expectedEvidence: "teacher signal question prepared"
    }
  ],
  counts: { followUpItems: 1 },
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    allSoftwareCoverageComplete: false,
    softwareActionsExecuted: false
  }
});

const receiptPath = writeJson(join(smokeRoot, "teacher-coverage-enrollment-follow-up-receipt.json"), {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_review_receipt_v1",
  rowDecisions: [
    {
      followUpId: "enrollment-follow-up-001",
      teacherDecision: "teacher_reviewed_prepare_signal_question",
      evidenceReviewed: true,
      teacherNote: "smoke teacher reviewed first signal question"
    }
  ]
});

const validationResult = runNode("validate-all-software-coverage-enrollment-follow-up-receipt.mjs", [
  "--plan",
  planPath,
  "--receipt",
  receiptPath,
  "--goal",
  "smoke validated coverage enrollment follow-up receipt",
  "--output-dir",
  join(smokeRoot, "validation")
]);
const queueResult = runNode("create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs", [
  "--validation",
  validationResult.validationPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const queue = readJson(queueResult.queuePath);
const readyResult = runNode("run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs", [
  "--queue",
  queueResult.queuePath,
  "--item-number",
  "2",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed coverage enrollment follow-up item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready-run")
]);
const itemRun = readJson(readyResult.runPath);
const itemRunReceipt = readJson(readyResult.receiptPath);
const batch = readJson(readyResult.batchPath);

const builderResult = runNode("create-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder.mjs", [
  "--goal",
  "Smoke teacher review for one coverage enrollment follow-up handoff item run.",
  "--run",
  readyResult.runPath,
  "--run-receipt",
  readyResult.receiptPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const template = readJson(builderResult.receiptTemplatePath);

const matchedReceiptPath = writeJson(join(smokeRoot, "matched-run-review-receipt.json"), {
  ...template,
  teacherDecision: "item_run_matched_expected",
  evidenceReviewed: true,
  batchReceiptReviewed: true,
  lowTokenOutcomeReviewed: true,
  teacherMatchedExpected: true,
  rollbackPointStillRetained: true,
  preserveBlockerIfMismatch: true,
  teacherConfirmation: "teacher reviewed coverage enrollment handoff item run",
  teacherNotes: "The single low-token follow-up item produced the expected teacher signal question."
});
const matchedValidation = runNode("validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  matchedReceiptPath,
  "--output-dir",
  join(smokeRoot, "matched-validation")
]);
const matchedPacket = readJson(matchedValidation.validationPath);

const mismatchReceiptPath = writeJson(join(smokeRoot, "mismatch-run-review-receipt.json"), {
  ...template,
  teacherDecision: "item_run_mismatch_blocked",
  evidenceReviewed: true,
  batchReceiptReviewed: true,
  lowTokenOutcomeReviewed: true,
  teacherMatchedExpected: false,
  rollbackPointStillRetained: true,
  preserveBlockerIfMismatch: true,
  teacherConfirmation: "teacher blocked this coverage enrollment handoff item run"
});
const mismatchValidation = runNode("validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  mismatchReceiptPath,
  "--output-dir",
  join(smokeRoot, "mismatch-validation")
]);

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-run-review-receipt.json"), {
  ...template,
  teacherDecision: "write_memory",
  evidenceReviewed: true,
  batchReceiptReviewed: true,
  lowTokenOutcomeReviewed: true,
  teacherMatchedExpected: true,
  rollbackPointStillRetained: true,
  preserveBlockerIfMismatch: true,
  teacherConfirmation: "forbidden smoke"
});
const forbiddenValidation = runNode("validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden-validation")
], { expectFailure: true });

const incompleteReceiptPath = writeJson(join(smokeRoot, "incomplete-run-review-receipt.json"), {
  ...template,
  teacherDecision: "item_run_matched_expected",
  evidenceReviewed: true,
  batchReceiptReviewed: false,
  lowTokenOutcomeReviewed: true,
  teacherMatchedExpected: true,
  rollbackPointStillRetained: true,
  preserveBlockerIfMismatch: true,
  teacherConfirmation: "teacher reviewed but missed the batch receipt"
});
const incompleteValidation = runNode("validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs", [
  "--builder",
  builderResult.builderPath,
  "--receipt",
  incompleteReceiptPath,
  "--output-dir",
  join(smokeRoot, "incomplete-validation")
]);
const incompletePacket = readJson(incompleteValidation.validationPath);

const checks = [
  check(
    "Coverage enrollment handoff item run review builder creates teacher receipt template from a real one-item run",
    builder.format === "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_builder_v1" &&
      template.format === "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_v1" &&
      builder.runSummary.selectedFollowUpId === "enrollment-follow-up-001" &&
      builder.runSummary.runnerInvoked === true &&
      readFileSync(builderResult.htmlPath, "utf8").includes("Coverage Enrollment Handoff Item Run Review"),
    builderResult.builderPath
  ),
  check(
    "Coverage enrollment handoff item review preserves teacher-reviewed subset ledger scope end to end",
    validationResult.reviewScope?.scopeKind === "teacher_reviewed_subset_ledger" &&
      queue.reviewScope?.currentLedgerPath === reviewedSubsetLedgerPath &&
      itemRun.reviewScope?.currentLedgerPath === reviewedSubsetLedgerPath &&
      itemRunReceipt.reviewScope?.currentLedgerPath === reviewedSubsetLedgerPath &&
      batch.reviewScope?.currentLedgerPath === reviewedSubsetLedgerPath &&
      builder.reviewScope?.currentLedgerPath === reviewedSubsetLedgerPath &&
      template.reviewScope?.currentLedgerPath === reviewedSubsetLedgerPath &&
      matchedPacket.reviewScope?.currentLedgerPath === reviewedSubsetLedgerPath &&
      matchedPacket.reviewScopeVerified === true &&
      Boolean(matchedPacket.nextReviewCommands[0]?.command || "") &&
      matchedPacket.nextReviewCommands[0].command.includes(`--ledger "${reviewedSubsetLedgerPath.replace(/"/g, '\\"')}"`),
    matchedPacket.nextReviewCommands[0]?.command || "missing reconciliation command"
  ),
  check(
    "Matched teacher review prepares reconciliation command template only",
    matchedValidation.status === "validated_ready_for_review_only_reconciliation" &&
      matchedPacket.validationDecision === "coverage_enrollment_handoff_item_run_reviewed_for_reconciliation" &&
      matchedPacket.nextReviewCommands.length === 1 &&
      matchedPacket.nextReviewCommands[0].command.includes("reconcile-all-software-coverage-enrollment-follow-up-batch.mjs") &&
      matchedPacket.nextReviewCommands[0].executesNow === false &&
      matchedPacket.locks.validationDoesNotRunCommands === true &&
      matchedPacket.locks.validationDoesNotReadLogs === true &&
      matchedPacket.locks.validationDoesNotWriteMemory === true,
    matchedValidation.validationPath
  ),
  check(
    "Mismatched teacher review blocks follow-up without reconciliation command",
    mismatchValidation.status === "blocked" &&
      mismatchValidation.validationDecision === "blocked_by_teacher_mismatch" &&
      mismatchValidation.nextReviewCommandCount === 0,
    mismatchValidation.receiptPath
  ),
  check(
    "Forbidden memory or completion decision fails closed",
    forbiddenValidation.status === "blocked" &&
      forbiddenValidation.validationDecision === "blocked_for_forbidden_decision" &&
      forbiddenValidation.nextReviewCommandCount === 0 &&
      forbiddenValidation.failedAsExpected === true &&
      forbiddenValidation.exitStatus !== 0,
    forbiddenValidation.receiptPath
  ),
  check(
    "Matched decision without complete evidence review stays waiting",
    incompleteValidation.status === "waiting_for_teacher_review" &&
      incompletePacket.validationRows.some((row) => row.name === "batch_receipt_reviewed" && row.status === "needs_teacher_review") &&
      incompleteValidation.nextReviewCommandCount === 0,
    incompleteValidation.validationPath
  ),
  check(
    "Coverage enrollment handoff item run review keeps all completion and system-change locks closed",
    matchedPacket.locks.reviewOnly === true &&
      matchedPacket.locks.validationDoesNotRerunItem === true &&
      matchedPacket.locks.validationDoesNotCaptureScreenshots === true &&
      matchedPacket.locks.validationDoesNotExecuteTargetSoftware === true &&
      matchedPacket.locks.accepted === false &&
      matchedPacket.locks.ruleEnabled === false &&
      matchedPacket.locks.packagingGated === true &&
      matchedPacket.locks.memoryWritten === false &&
      matchedPacket.locks.nativeUniversalExecution === false &&
      matchedPacket.locks.allSoftwareCoverageComplete === false &&
      matchedPacket.locks.goalComplete === false,
    JSON.stringify(matchedPacket.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const output = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_smoke_v1",
  smokeRoot,
  passed,
  total: checks.length,
  paths: {
    itemRun: readyResult.runPath,
    itemRunReceipt: readyResult.receiptPath,
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
