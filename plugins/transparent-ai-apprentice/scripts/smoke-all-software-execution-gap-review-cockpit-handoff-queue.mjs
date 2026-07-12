#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  assert(result.status === 0, `command failed: node ${args.join(" ")}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

const tmp = mkdtempSync(join(tmpdir(), "ta-execution-gap-handoff-queue-"));
const receiptSmoke = runNode(["plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-gap-review-cockpit-receipt-validation.mjs"]);
const defaultOut = join(tmp, "default-handoff");
const reviewedOut = join(tmp, "reviewed-handoff");

const defaultQueueResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-review-cockpit-handoff-queue.mjs",
  "--validation",
  receiptSmoke.paths.defaultValidation,
  "--output-dir",
  defaultOut
]);
const defaultQueue = readJson(defaultQueueResult.queuePath);
assert(defaultQueue.format === "transparent_ai_all_software_execution_gap_review_cockpit_handoff_queue_v1", "default queue format mismatch");
assert(defaultQueue.status === "waiting_for_validated_execution_gap_review", "default validation should not create ready handoff");
assert(defaultQueue.counts.queueItems === 0, "default validation should have zero queue items");
assert(defaultQueue.locks.queueDoesNotRunDownstreamValidators === true, "queue must not run validators");
assert(defaultQueue.locks.targetSoftwareCommandsExecuted === false, "queue must not execute target software");

const reviewedQueueResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-review-cockpit-handoff-queue.mjs",
  "--validation",
  receiptSmoke.paths.reviewedValidation,
  "--output-dir",
  reviewedOut
]);
const reviewedQueue = readJson(reviewedQueueResult.queuePath);
assert(reviewedQueue.status === "ready_for_manual_downstream_validation_handoff", "reviewed validation should create ready manual handoff");
assert(reviewedQueue.counts.queueItems === 2, "reviewed validation should create two downstream handoff items");
assert(reviewedQueue.counts.readyManualCount === 2, "both downstream validators should be ready for manual handoff");
assert(reviewedQueue.queueItems.some((item) => item.handoffKind === "control_channel_receipt_validation"), "control handoff item missing");
assert(reviewedQueue.queueItems.some((item) => item.handoffKind === "action_logic_receipt_validation"), "action logic handoff item missing");
assert(
  reviewedQueue.queueItems.every((item) => item.commandExecutableNow === false && item.executesNow === false),
  "handoff queue must not execute commands"
);
assert(
  reviewedQueue.queueItems.every((item) => existsSync(item.sourceReceiptDraft) && item.missingInputs.length === 0),
  "handoff queue must point to concrete derived receipt drafts"
);
assert(reviewedQueue.locks.queueDoesNotExecuteCommands === true, "queue must not execute commands");
assert(reviewedQueue.locks.queueDoesNotRunDownstreamValidators === true, "queue must not run validators");
assert(reviewedQueue.locks.memoryWritten === false, "queue must not write memory");
assert(reviewedQueue.locks.goalComplete === false, "queue must not claim completion");

const controlItemRun = runNode([
  "plugins/transparent-ai-apprentice/scripts/run-original-goal-review-handoff-queue-item.mjs",
  "--queue",
  reviewedQueueResult.queuePath,
  "--item-number",
  "1",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--rollback-point",
  "retained-execution-gap-smoke-rollback-point",
  "--output-dir",
  join(tmp, "control-item-run")
]);
const actionLogicItemRun = runNode([
  "plugins/transparent-ai-apprentice/scripts/run-original-goal-review-handoff-queue-item.mjs",
  "--queue",
  reviewedQueueResult.queuePath,
  "--item-number",
  "2",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed original goal review handoff item",
  "--rollback-point-created",
  "--rollback-point",
  "retained-execution-gap-smoke-rollback-point",
  "--output-dir",
  join(tmp, "action-logic-item-run")
]);
const controlRun = readJson(controlItemRun.runPath);
const actionLogicRun = readJson(actionLogicItemRun.runPath);
assert(controlRun.queueKind === "execution_gap_review_cockpit", "control item must run through execution-gap queue kind");
assert(actionLogicRun.queueKind === "execution_gap_review_cockpit", "action logic item must run through execution-gap queue kind");
assert(controlRun.status === "reviewed_downstream_validation_completed", "control item should complete downstream validation");
assert(actionLogicRun.status === "reviewed_downstream_validation_completed", "action logic item should complete downstream validation");
assert(controlRun.validationScriptInvoked === true, "control item should invoke allowlisted validation script");
assert(actionLogicRun.validationScriptInvoked === true, "action logic item should invoke allowlisted validation script");
assert(existsSync(controlRun.generatedEvidence.downstreamValidationPath), "control downstream validation path must exist");
assert(existsSync(actionLogicRun.generatedEvidence.downstreamValidationPath), "action logic downstream validation path must exist");
assert(controlRun.locks.targetSoftwareCommandsExecuted === false, "control runner must not execute target software");
assert(actionLogicRun.locks.targetSoftwareCommandsExecuted === false, "action logic runner must not execute target software");
assert(controlRun.locks.memoryWritten === false && actionLogicRun.locks.memoryWritten === false, "item runner must not write memory");

const downstreamSummaryResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-downstream-validation-summary.mjs",
  "--control-item-run",
  controlItemRun.runPath,
  "--action-logic-item-run",
  actionLogicItemRun.runPath,
  "--output-dir",
  join(tmp, "downstream-summary")
]);
const downstreamSummary = readJson(downstreamSummaryResult.summaryPath);
assert(
  downstreamSummary.format === "transparent_ai_all_software_execution_gap_downstream_validation_summary_v1",
  "downstream summary format mismatch"
);
assert(downstreamSummary.lanes.control.readyCount === 1, "downstream summary should see one control-ready row");
assert(downstreamSummary.lanes.actionLogic.readyPatchRows === 1, "downstream summary should see one action-logic patch row");
assert(
  downstreamSummary.status === "validated_downstream_results_summarized_execution_still_blocked",
  "downstream summary must remain execution-blocked"
);
assert(downstreamSummary.locks.summaryDoesNotPatchMatrix === true, "summary must not patch matrix");
assert(downstreamSummary.locks.targetSoftwareCommandsExecuted === false, "summary must not execute target software");
assert(downstreamSummary.locks.memoryWritten === false, "summary must not write memory");

const currentMatrixResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-capability-matrix.mjs",
  "--goal",
  "Smoke current execution matrix for execution-gap downstream reconciliation.",
  "--action-logic-validation",
  actionLogicRun.generatedEvidence.downstreamValidationPath,
  "--output-dir",
  join(tmp, "current-execution-matrix")
]);
const currentMatrix = readJson(currentMatrixResult.matrixPath);
assert(
  currentMatrix.format === "transparent_ai_all_software_execution_capability_matrix_v1",
  "current matrix fixture format mismatch"
);

const defaultMatrixReconciliationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-matrix-reconciliation-package.mjs",
  "--downstream-summary",
  downstreamSummaryResult.summaryPath,
  "--matrix",
  currentMatrixResult.matrixPath,
  "--output-dir",
  join(tmp, "default-matrix-reconciliation")
]);
const defaultMatrixReconciliation = readJson(defaultMatrixReconciliationResult.packagePath);
assert(
  defaultMatrixReconciliation.format === "transparent_ai_all_software_execution_gap_matrix_reconciliation_package_v1",
  "matrix reconciliation package format mismatch"
);
assert(
  defaultMatrixReconciliation.status === "ready_for_teacher_matrix_reconciliation_review",
  "default matrix reconciliation should wait for teacher-reviewed flag"
);
assert(!defaultMatrixReconciliation.generated.nextMatrixPath, "default reconciliation must not generate next matrix");
assert(
  defaultMatrixReconciliation.plannedCommands.nextMatrixCommand.includes("create-all-software-execution-capability-matrix.mjs") &&
    defaultMatrixReconciliation.plannedCommands.nextMatrixCommand.includes("--action-logic-validation"),
  "matrix reconciliation must prepare a next matrix command with action-logic validation"
);
assert(defaultMatrixReconciliation.locks.matrixPatchedByDefault === false, "matrix reconciliation must not patch by default");
assert(defaultMatrixReconciliation.locks.targetSoftwareCommandsExecuted === false, "matrix reconciliation must not execute target software");
assert(defaultMatrixReconciliation.locks.memoryWritten === false, "matrix reconciliation must not write memory");

const receiptBuilderResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-matrix-reconciliation-receipt-builder.mjs",
  "--package",
  defaultMatrixReconciliationResult.packagePath,
  "--output-dir",
  join(tmp, "matrix-reconciliation-receipt-builder")
]);
const receiptBuilder = readJson(receiptBuilderResult.builderPath);
const receiptTemplate = readJson(receiptBuilderResult.receiptTemplatePath);
assert(
  receiptBuilder.format === "transparent_ai_all_software_execution_gap_matrix_reconciliation_receipt_builder_v1",
  "matrix reconciliation receipt builder format mismatch"
);
assert(receiptTemplate.teacherDecision === "needs_teacher_review", "receipt template must default to needs teacher review");
assert(receiptBuilder.locks.builderDoesNotGenerateMatrix === true, "receipt builder must not generate matrix");

const defaultReceiptValidationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs",
  "--package",
  defaultMatrixReconciliationResult.packagePath,
  "--receipt",
  receiptBuilderResult.receiptTemplatePath,
  "--output-dir",
  join(tmp, "default-matrix-reconciliation-receipt-validation")
]);
const defaultReceiptValidation = readJson(defaultReceiptValidationResult.validationPath);
assert(
  defaultReceiptValidation.status === "waiting_for_teacher_review" &&
    defaultReceiptValidation.nextReviewCommands.length === 0,
  "default receipt validation should wait and prepare no next matrix command"
);
assert(defaultReceiptValidation.locks.validationDoesNotGenerateMatrix === true, "receipt validation must not generate matrix");

const reviewedReceiptPath = join(tmp, "teacher-reviewed-matrix-reconciliation-receipt.json");
writeFileSync(
  reviewedReceiptPath,
  `${JSON.stringify(
    {
      ...receiptTemplate,
      teacherDecision: "teacher_confirmed_matrix_reconciliation",
      packageReviewed: true,
      downstreamSummaryReviewed: true,
      controlValidationReviewedAsEvidenceOnly: true,
      actionLogicPatchReviewed: true,
      currentMatrixReviewed: true,
      nextMatrixCommandReviewed: true,
      executionBoundaryReviewed: true,
      rollbackPointRetained: true,
      teacherConfirmedRegenerateNextMatrix: true,
      teacherNote: "Smoke teacher confirms next review-only matrix generation."
    },
    null,
    2
  )}\n`,
  "utf8"
);
const reviewedReceiptValidationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/validate-all-software-execution-gap-matrix-reconciliation-receipt.mjs",
  "--package",
  defaultMatrixReconciliationResult.packagePath,
  "--receipt",
  reviewedReceiptPath,
  "--output-dir",
  join(tmp, "reviewed-matrix-reconciliation-receipt-validation")
]);
const reviewedReceiptValidation = readJson(reviewedReceiptValidationResult.validationPath);
assert(
  reviewedReceiptValidation.status === "validated_ready_for_next_matrix_generation_command" &&
    reviewedReceiptValidation.nextReviewCommands.length === 1 &&
    reviewedReceiptValidation.nextReviewCommands[0].command.includes("--teacher-reviewed-reconciliation"),
  "reviewed receipt validation should prepare exactly one teacher-reviewed next matrix command"
);
assert(reviewedReceiptValidation.locks.targetSoftwareCommandsExecuted === false, "receipt validation must not execute target software");
assert(reviewedReceiptValidation.locks.memoryWritten === false, "receipt validation must not write memory");

const blockedReviewedRunnerResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/run-all-software-execution-gap-matrix-reconciliation-reviewed-runner.mjs",
  "--validation",
  reviewedReceiptValidationResult.validationPath,
  "--teacher-confirmation",
  "teacher confirmed execution-gap matrix reconciliation runner",
  "--rollback-point-created",
  "--output-dir",
  join(tmp, "blocked-matrix-reconciliation-reviewed-runner")
]);
const blockedReviewedRunner = readJson(blockedReviewedRunnerResult.packetPath);
assert(
  blockedReviewedRunner.status === "blocked_before_reviewed_matrix_generation" &&
    blockedReviewedRunner.runnerInvoked === false &&
    blockedReviewedRunner.blockers.includes("missing_run_reviewed_matrix_generation_flag"),
  "reviewed runner should block without explicit run flag"
);
assert(blockedReviewedRunner.locks.targetSoftwareCommandsExecuted === false, "blocked reviewed runner must not execute target software");

const reviewedRunnerResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/run-all-software-execution-gap-matrix-reconciliation-reviewed-runner.mjs",
  "--validation",
  reviewedReceiptValidationResult.validationPath,
  "--run-reviewed-matrix-generation",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed execution-gap matrix reconciliation runner",
  "--rollback-point-created",
  "--rollback-point",
  "retained-execution-gap-matrix-reconciliation-smoke-rollback-point",
  "--output-dir",
  join(tmp, "reviewed-matrix-reconciliation-runner")
]);
const reviewedRunner = readJson(reviewedRunnerResult.packetPath);
assert(
  reviewedRunner.status === "reviewed_next_matrix_generated_waiting_for_teacher_matrix_review" &&
    reviewedRunner.runnerInvoked === true &&
    existsSync(reviewedRunner.generatedEvidence.nextMatrixPath),
  "reviewed runner should generate next matrix after explicit teacher gate"
);
assert(
  reviewedRunner.locks.runnerDoesNotRunArbitraryShellCommand === true &&
    reviewedRunner.locks.targetSoftwareCommandsExecuted === false &&
    reviewedRunner.locks.memoryWritten === false,
  "reviewed runner locks must preserve no arbitrary shell, no target execution, and no memory writes"
);
const runnerNextMatrix = readJson(reviewedRunner.generatedEvidence.nextMatrixPath);
assert(
  runnerNextMatrix.format === "transparent_ai_all_software_execution_capability_matrix_v1" &&
    runnerNextMatrix.counts.logicSourceContractReadyForReview >= 1,
  "reviewed runner next matrix should carry reviewed action-logic patch rows"
);

const reviewedMatrixReconciliationResult = runNode([
  "plugins/transparent-ai-apprentice/scripts/create-all-software-execution-gap-matrix-reconciliation-package.mjs",
  "--downstream-summary",
  downstreamSummaryResult.summaryPath,
  "--matrix",
  currentMatrixResult.matrixPath,
  "--teacher-reviewed-reconciliation",
  "--output-dir",
  join(tmp, "reviewed-matrix-reconciliation")
]);
const reviewedMatrixReconciliation = readJson(reviewedMatrixReconciliationResult.packagePath);
assert(
  reviewedMatrixReconciliation.status === "teacher_reviewed_matrix_reconciliation_generated_next_matrix_execution_still_blocked",
  "teacher-reviewed reconciliation should generate next matrix while keeping execution blocked"
);
assert(existsSync(reviewedMatrixReconciliation.generated.nextMatrixPath), "reviewed reconciliation must generate a next matrix path");
const nextMatrix = readJson(reviewedMatrixReconciliation.generated.nextMatrixPath);
assert(
  nextMatrix.format === "transparent_ai_all_software_execution_capability_matrix_v1" &&
    nextMatrix.counts.logicSourceContractReadyForReview >= 1,
  "next matrix should carry reviewed action-logic patch rows"
);
assert(
  reviewedMatrixReconciliation.locks.matrixPatchedOnlyAfterTeacherReviewedReconciliation === true &&
    reviewedMatrixReconciliation.locks.targetSoftwareCommandsExecuted === false &&
    reviewedMatrixReconciliation.locks.memoryWritten === false,
  "reviewed reconciliation locks must preserve no execution and no memory writes"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_all_software_execution_gap_review_cockpit_handoff_queue_smoke_v1",
      paths: {
        defaultQueue: defaultQueueResult.queuePath,
        reviewedQueue: reviewedQueueResult.queuePath,
        reviewedQueueHtml: reviewedQueueResult.htmlPath,
        reviewedQueueReadme: reviewedQueueResult.readmePath,
        controlItemRun: controlItemRun.runPath,
        actionLogicItemRun: actionLogicItemRun.runPath,
        controlDownstreamValidation: controlRun.generatedEvidence.downstreamValidationPath,
        actionLogicDownstreamValidation: actionLogicRun.generatedEvidence.downstreamValidationPath,
        downstreamSummary: downstreamSummaryResult.summaryPath,
        downstreamSummaryHtml: downstreamSummaryResult.htmlPath,
        defaultMatrixReconciliation: defaultMatrixReconciliationResult.packagePath,
        matrixReconciliationReceiptBuilder: receiptBuilderResult.builderPath,
        matrixReconciliationReceiptValidation: reviewedReceiptValidationResult.validationPath,
        blockedMatrixReconciliationReviewedRunner: blockedReviewedRunnerResult.packetPath,
        matrixReconciliationReviewedRunner: reviewedRunnerResult.packetPath,
        reviewedRunnerNextMatrix: reviewedRunner.generatedEvidence.nextMatrixPath,
        reviewedMatrixReconciliation: reviewedMatrixReconciliationResult.packagePath,
        nextMatrix: reviewedMatrixReconciliation.generated.nextMatrixPath
      },
      checks: [
        "default execution-gap validation creates no downstream handoff",
        "teacher-reviewed execution-gap validation creates exactly two manual downstream validation handoff items",
        "handoff items point to concrete derived control-channel and action-logic receipts",
        "generic handoff item runner can invoke both allowlisted downstream validators after teacher confirmation and rollback evidence",
        "downstream validation summary distinguishes control-channel review readiness from action-logic matrix patch readiness",
        "matrix reconciliation package converts downstream summary into a teacher-gated next matrix command",
        "matrix reconciliation receipt builder and validator require teacher review before preparing the next matrix command",
        "matrix reconciliation reviewed runner blocks without explicit run flag and uses fixed script invocation after teacher confirmation",
        "teacher-reviewed matrix reconciliation can generate the next review-only matrix without executing target software",
        "queue and item runner never run probes, target software, memory writes, rules, medium runtime, or completion"
      ]
    },
    null,
    2
  )
);
