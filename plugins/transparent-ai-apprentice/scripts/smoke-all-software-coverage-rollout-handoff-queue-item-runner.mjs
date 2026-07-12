#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "coverage-rollout-handoff-item-runner-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 240000,
    maxBuffer: 20 * 1024 * 1024
  });
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
  planId: "smoke-coverage-rollout-handoff-item-plan",
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
    },
    {
      batchId: "batch-002",
      batchSize: 1,
      status: "prepared_waiting_for_teacher_review",
      rows: [{ software: "SmokeApp Three", processName: "smoke-three.exe", signalStatus: "needs_teacher_signal" }]
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

const receiptPath = writeJson(join(smokeRoot, "teacher-coverage-rollout-receipt.json"), {
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
  receiptPath,
  "--goal",
  "smoke validated coverage rollout receipt",
  "--output-dir",
  join(smokeRoot, "validation")
]);
const queueResult = runNode("create-all-software-coverage-rollout-handoff-queue.mjs", [
  "--validation",
  validationResult.validationPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const queue = readJson(queueResult.queuePath);
const rewrittenCommandQueuePath = join(smokeRoot, "queue-with-display-only-command.json");
const rewrittenQueue = {
  ...queue,
  queueItems: queue.queueItems.map((item) =>
    item.kind === "reviewed_coverage_rollout_supervisor_command"
      ? { ...item, command: "Write-Output DISPLAY_ONLY_COMMAND_SHOULD_NOT_RUN" }
      : item
  )
};
writeJson(rewrittenCommandQueuePath, rewrittenQueue);

const blockedMissingFlags = runNode("run-all-software-coverage-rollout-handoff-queue-item.mjs", [
  "--queue",
  queueResult.queuePath,
  "--output-dir",
  join(smokeRoot, "blocked-missing-flags")
]);
const blockedMissingFlagsRun = readJson(blockedMissingFlags.runPath);

const multiBatchQueuePath = join(smokeRoot, "multi-batch-queue.json");
const multiBatchQueue = {
  ...queue,
  queueItems: queue.queueItems.map((item) =>
    item.kind === "reviewed_coverage_rollout_supervisor_command"
      ? { ...item, arguments: { ...item.arguments, maxBatches: 2 } }
      : item
  )
};
writeJson(multiBatchQueuePath, multiBatchQueue);
const blockedMultiBatch = runNode("run-all-software-coverage-rollout-handoff-queue-item.mjs", [
  "--queue",
  multiBatchQueuePath,
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed coverage rollout handoff item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "blocked-multi-batch")
]);
const blockedMultiBatchRun = readJson(blockedMultiBatch.runPath);

const readyResult = runNode("run-all-software-coverage-rollout-handoff-queue-item.mjs", [
  "--queue",
  rewrittenCommandQueuePath,
  "--item-number",
  "2",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed coverage rollout handoff item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyRun = readJson(readyResult.runPath);
const supervisor = readJson(readyResult.supervisorPath);

const checks = [
  {
    name: "Coverage rollout handoff item runner blocks without explicit confirmation flags",
    pass:
      blockedMissingFlags.status === "blocked_before_coverage_rollout_handoff_runner" &&
      blockedMissingFlagsRun.blockReason.includes("missing_run_reviewed_handoff_flag") &&
      blockedMissingFlagsRun.blockReason.includes("missing_teacher_coverage_rollout_handoff_confirmation") &&
      blockedMissingFlagsRun.runnerInvoked === false,
    evidence: blockedMissingFlags.runPath
  },
  {
    name: "Coverage rollout handoff item runner refuses multi-batch items",
    pass:
      blockedMultiBatch.status === "blocked_before_coverage_rollout_handoff_runner" &&
      blockedMultiBatchRun.blockReason.includes("single_item_runner_refuses_multi_batch_handoff") &&
      blockedMultiBatchRun.runnerInvoked === false,
    evidence: blockedMultiBatch.runPath
  },
  {
    name: "Coverage rollout handoff item runner advances exactly one reviewed item",
    pass:
      readyRun.status === "reviewed_coverage_rollout_handoff_item_advanced" &&
      readyRun.runnerInvoked === true &&
      readyRun.selectedItem.batchId === "batch-001" &&
      supervisor.selectedBatches.length === 1 &&
      supervisor.selectedBatches[0] === "batch-001" &&
      supervisor.completedBatchPackets === 1 &&
      (supervisor.counts?.auditPackets || supervisor.auditPackets?.length || supervisor.auditPackets || 0) === 1,
    evidence: readyResult.runPath
  },
  {
    name: "Coverage rollout handoff item runner uses structured arguments, not the display command string",
    pass:
      readyRun.selectedItem.commandUsedForDisplayOnly === "Write-Output DISPLAY_ONLY_COMMAND_SHOULD_NOT_RUN" &&
      readyRun.selectedItem.structuredArgumentsUsed.plan === planPath &&
      readyRun.generatedEvidence.supervisorPath === readyResult.supervisorPath,
    evidence: readyRun.selectedItem.commandUsedForDisplayOnly
  },
  {
    name: "Coverage rollout handoff item runner keeps completion and system-change locks closed",
    pass:
      readyRun.locks.reviewOnly === true &&
      readyRun.locks.queueItemRunnerDoesNotRunArbitraryCommandString === true &&
      readyRun.locks.queueItemRunnerConsumesOneHandoffItem === true &&
      readyRun.locks.queueItemRunnerDoesNotRegisterSchedule === true &&
      readyRun.locks.queueItemRunnerDoesNotCaptureScreenshots === true &&
      readyRun.locks.queueItemRunnerDoesNotExecuteTargetSoftware === true &&
      readyRun.locks.queueItemRunnerDoesNotWriteMemory === true &&
      readyRun.locks.memoryWritten === false &&
      readyRun.locks.nativeUniversalExecution === false &&
      readyRun.locks.allSoftwareCoverageComplete === false &&
      readyRun.locks.goalComplete === false,
    evidence: JSON.stringify(readyRun.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const output = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_coverage_rollout_handoff_queue_item_runner_smoke_v1",
  smokeRoot,
  paths: {
    queue: queueResult.queuePath,
    readyRun: readyResult.runPath,
    supervisor: readyResult.supervisorPath
  },
  passed,
  total: checks.length,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
