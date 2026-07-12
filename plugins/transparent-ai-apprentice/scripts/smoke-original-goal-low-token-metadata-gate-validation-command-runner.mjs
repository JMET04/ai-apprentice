#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 180000,
    ...options
  });
}

function must(condition, message) {
  if (!condition) throw new Error(message);
}

function parseOutput(result) {
  return result.stdout ? JSON.parse(result.stdout) : {};
}

const root = resolve(".transparent-apprentice", "smoke", "original-goal-low-token-metadata-gate-validation-command-runner");
const fixtureDir = join(root, "fixtures");
const outputDir = join(root, "out");
const rollbackPoint = join(root, "rollback-point-retained");
mkdirSync(fixtureDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });
mkdirSync(rollbackPoint, { recursive: true });

const logPath = join(fixtureDir, "alpha-app.log");
writeFileSync(logPath, "baseline export completed\n", "utf8");

const queuePath = join(fixtureDir, "software-observer-queue.json");
writeJson(queuePath, {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "smoke-metadata-gate-validation-command-runner-queue",
  queue: [
    {
      queueItemId: "alpha-app-alpha",
      software: "Alpha App",
      processName: "alpha",
      score: 10,
      recentLogCandidates: [
        {
          path: logPath,
          source: "smoke_fixture_log"
        }
      ],
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true
      }
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    softwareActionsExecuted: false
  }
});

const planPath = join(fixtureDir, "coverage-enrollment-follow-up-plan.json");
const batchOut = join(outputDir, "batch");
writeJson(planPath, {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
  planId: "smoke-metadata-gate-validation-command-runner-plan",
  goal: "Smoke metadata gate validation command runner",
  reviewScope: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true
  },
  followUpItems: [
    {
      followUpId: "enrollment-follow-up-001",
      ledgerNumber: 1,
      software: "Alpha App",
      processName: "alpha",
      route: "collect_watch_or_queue_item_evidence",
      tool: "watch_log_source_metadata_deltas",
      arguments: {
        queue: queuePath,
        item: "alpha-app-alpha"
      }
    }
  ],
  nextLedgerCommand: "",
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

function validationFixture({ tool = "run_all_software_coverage_enrollment_follow_up_batch", extraCommandArgs = "", fileName = "validation.json" } = {}) {
  const commandLine = [
    "node",
    `"${resolve("plugins", "transparent-ai-apprentice", "scripts", "run-all-software-coverage-enrollment-follow-up-batch.mjs")}"`,
    "--plan",
    `"${planPath}"`,
    "--teacher-reviewed",
    "--max-items",
    "1",
    "--max-queue-items",
    "1",
    "--max-logs-per-item",
    "1",
    "--max-tail-lines",
    "16",
    "--max-tail-bytes",
    "1024",
    "--output-dir",
    `"${batchOut}"`,
    extraCommandArgs
  ]
    .filter(Boolean)
    .join(" ");
  const validationPath = join(fixtureDir, fileName);
  writeJson(validationPath, {
    ok: true,
    format: "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_validation_v1",
    goal: "Smoke metadata gate validation command runner",
    status: "validated_with_prepared_metadata_gate_command",
    rollbackPoint,
    nextPreparedCommands: [
      {
        tool,
        readyFollowUpIds: ["enrollment-follow-up-001"],
        commandLine,
        rollbackPoint
      }
    ],
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    }
  });
  return validationPath;
}

const runnerScript = resolve("plugins", "transparent-ai-apprentice", "scripts", "run-original-goal-low-token-metadata-gate-validation-command.mjs");
const validationPath = validationFixture();
const runnerOut = join(outputDir, "runner");
const success = runNode([
  runnerScript,
  "--validation",
  validationPath,
  "--run-reviewed-command",
  "--allow-validation-command-runner",
  "--teacher-confirmation",
  "老师已审核并确认运行这个 metadata gate validation command",
  "--rollback-point",
  rollbackPoint,
  "--output-dir",
  runnerOut
]);
if (success.status !== 0) throw new Error(success.stderr || success.stdout || "Validation command runner should pass.");
const successResult = parseOutput(success);
const runPacket = readJson(successResult.runPath);
const batchRun = readJson(successResult.batchRun);
must(successResult.format === "transparent_ai_original_goal_low_token_metadata_gate_validation_command_run_result_v1", "Unexpected runner result format.");
must(runPacket.format === "transparent_ai_original_goal_low_token_metadata_gate_validation_command_run_v1", "Unexpected run packet format.");
must(runPacket.preparedCommand.executedViaShell === false, "Runner must not execute through shell.");
must(runPacket.preparedCommand.executedScript === "run-all-software-coverage-enrollment-follow-up-batch.mjs", "Runner must execute only allowlisted batch script.");
must(runPacket.locks.runsOnlyPreparedValidationCommand === true, "Runner must only run the prepared validation command.");
must(runPacket.locks.shellCommandExecution === false, "Runner shell execution lock must stay false.");
must(runPacket.locks.metadataGateBatchRunnerInvoked === true, "Runner should invoke metadata gate batch runner.");
must(runPacket.locks.softwareActionsExecuted === false, "Runner must not execute target software.");
must(runPacket.locks.fullLogsRead === false, "Runner must not read full logs.");
must(runPacket.completionBoundary.goalComplete === false, "Runner must not claim goal completion.");
must(
  runPacket.nextPreparedCommands?.[0]?.tool === "reconcile_all_software_coverage_enrollment_follow_up_batch",
  "Runner should prepare the next review-only reconciliation command."
);
must(runPacket.nextPreparedCommands[0].executesNow === false, "Next reconciliation command must not execute from the runner.");
must(
  runPacket.nextPreparedCommands[0].requiresTeacherReviewOfBatchReceipt === true,
  "Next reconciliation must require teacher review of the batch receipt."
);
must(successResult.nextReconciliationExecutesNow === false, "Runner stdout must keep reconciliation execution false.");
must(batchRun.format === "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1", "Unexpected batch run format.");
must(batchRun.teacherReviewed === true, "Batch must receive teacher-reviewed flag.");
must(batchRun.ranToolCount === 1, "Batch should run exactly one metadata gate tool.");
must(batchRun.locks.fullLogsRead === false, "Batch must keep full log reads locked.");
must(batchRun.locks.softwareActionsExecuted === false, "Batch must not execute software.");

const reconciliation = runNode([
  resolve("plugins", "transparent-ai-apprentice", "scripts", "reconcile-all-software-coverage-enrollment-follow-up-batch.mjs"),
  "--batch",
  successResult.batchRun,
  "--output-dir",
  join(outputDir, "reconciliation")
]);
if (reconciliation.status !== 0) throw new Error(reconciliation.stderr || reconciliation.stdout || "Reconciliation handoff should pass.");
const reconciliationResult = parseOutput(reconciliation);
const reconciliationPacket = readJson(reconciliationResult.reconciliationPath);
must(
  reconciliationResult.format === "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_result_v1",
  "Unexpected reconciliation result format."
);
must(
  reconciliationPacket.status === "ready_for_next_coverage_audit_and_enrollment_ledger",
  "Reconciliation should classify the reviewed batch evidence as ready for next audit/ledger review."
);
must(reconciliationPacket.locks.softwareActionsExecuted === false, "Reconciliation must not execute target software.");
must(reconciliationPacket.locks.fullLogsRead === false, "Reconciliation must not read full logs.");
must(reconciliationPacket.completionBoundary.allSoftwareCoverageComplete === false, "Reconciliation must not claim all-software coverage.");

const missingFlags = runNode([runnerScript, "--validation", validationPath, "--teacher-confirmation", "老师已确认", "--rollback-point", rollbackPoint, "--output-dir", join(outputDir, "missing-flags")]);
must(missingFlags.status !== 0, "Missing run flags must fail closed.");
must(parseOutput(missingFlags).blockedReason === "runner_requires_explicit_run_flags", "Missing flags should report runner_requires_explicit_run_flags.");

const boundedTailValidation = validationFixture({
  extraCommandArgs: "--allow-bounded-tail",
  fileName: "validation-bounded-tail.json"
});
const boundedTail = runNode([
  runnerScript,
  "--validation",
  boundedTailValidation,
  "--run-reviewed-command",
  "--allow-validation-command-runner",
  "--teacher-confirmation",
  "老师已审核并确认运行这个 bounded-tail rejection probe",
  "--rollback-point",
  rollbackPoint,
  "--output-dir",
  join(outputDir, "bounded-tail")
]);
must(boundedTail.status !== 0, "Bounded tail command must fail closed.");
must(
  parseOutput(boundedTail).blockedReason === "prepared_command_must_not_enable_bounded_tail_from_validation_runner",
  "Bounded tail rejection reason should be explicit."
);

const wrongToolValidation = validationFixture({
  tool: "teach_apprentice",
  fileName: "validation-wrong-tool.json"
});
const wrongTool = runNode([
  runnerScript,
  "--validation",
  wrongToolValidation,
  "--run-reviewed-command",
  "--allow-validation-command-runner",
  "--teacher-confirmation",
  "老师已审核并确认运行这个 wrong-tool rejection probe",
  "--rollback-point",
  rollbackPoint,
  "--output-dir",
  join(outputDir, "wrong-tool")
]);
must(wrongTool.status !== 0, "Wrong tool command must fail closed.");
must(parseOutput(wrongTool).blockedReason === "prepared_command_tool_not_allowlisted", "Wrong tool should report allowlist rejection.");

const missingValidation = runNode([runnerScript, "--output-dir", join(outputDir, "missing-validation")]);
must(missingValidation.status !== 0, "Missing validation must fail closed.");
must(parseOutput(missingValidation).blockedReason === "validation_json_is_required", "Missing validation should report validation_json_is_required.");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_original_goal_low_token_metadata_gate_validation_command_runner_smoke_v1",
      checks: [
        "Runner executes only allowlisted validation command without shell",
        "Runner prepares review-only reconciliation handoff after batch",
        "Missing run flags fail closed",
        "Bounded tail command is rejected",
        "Wrong prepared command tool is rejected",
        "Missing validation JSON fails closed"
      ],
      validationPath,
      runPath: successResult.runPath,
      batchRun: successResult.batchRun,
      batchReceipt: successResult.batchReceipt,
      nextReconciliationCommand: successResult.nextReconciliationCommand,
      reconciliationPath: reconciliationResult.reconciliationPath,
      locks: runPacket.locks
    },
    null,
    2
  )
);
