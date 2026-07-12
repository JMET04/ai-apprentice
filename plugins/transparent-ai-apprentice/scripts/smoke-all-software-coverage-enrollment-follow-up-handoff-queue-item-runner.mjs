#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "coverage-enrollment-follow-up-handoff-item-runner-smoke",
  String(Date.now())
);
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

const planPath = writeJson(join(smokeRoot, "coverage-enrollment-follow-up-plan.json"), {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
  planId: "smoke-coverage-enrollment-follow-up-plan",
  status: "coverage_follow_up_plan_ready",
  goal: "Smoke one coverage enrollment handoff item.",
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
    },
    {
      followUpId: "enrollment-follow-up-002",
      ledgerNumber: 2,
      software: "Smoke Later App",
      route: "ask_teacher_for_signal_or_exclusion",
      tool: "teach_apprentice",
      arguments: {
        message: "Ask the teacher which compact signal identifies useful changes for Smoke Later App."
      },
      expectedEvidence: "teacher signal question prepared"
    }
  ],
  counts: { followUpItems: 2 },
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
    },
    {
      followUpId: "enrollment-follow-up-002",
      teacherDecision: "needs_teacher_review",
      evidenceReviewed: false
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
const rewrittenCommandQueuePath = join(smokeRoot, "queue-with-display-only-command.json");
const rewrittenQueue = {
  ...queue,
  queueItems: queue.queueItems.map((item) =>
    item.kind === "reviewed_low_token_batch_command"
      ? { ...item, command: "Write-Output DISPLAY_ONLY_COMMAND_SHOULD_NOT_RUN" }
      : item
  )
};
writeJson(rewrittenCommandQueuePath, rewrittenQueue);

const blockedMissingFlags = runNode("run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs", [
  "--queue",
  queueResult.queuePath,
  "--output-dir",
  join(smokeRoot, "blocked-missing-flags")
]);
const blockedMissingFlagsRun = readJson(blockedMissingFlags.runPath);

const readyResult = runNode("run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs", [
  "--queue",
  rewrittenCommandQueuePath,
  "--item-number",
  "2",
  "--run-reviewed-handoff",
  "--allow-runner",
  "--teacher-confirmation",
  "teacher confirmed coverage enrollment follow-up item",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyRun = readJson(readyResult.runPath);
const batch = readJson(readyResult.batchPath);

const checks = [
  {
    name: "Coverage enrollment follow-up handoff item runner blocks without explicit confirmation flags",
    pass:
      blockedMissingFlags.status === "blocked_before_coverage_enrollment_follow_up_handoff_runner" &&
      blockedMissingFlagsRun.blockReason.includes("missing_run_reviewed_handoff_flag") &&
      blockedMissingFlagsRun.blockReason.includes("missing_teacher_coverage_enrollment_follow_up_confirmation") &&
      blockedMissingFlagsRun.runnerInvoked === false,
    evidence: blockedMissingFlags.runPath
  },
  {
    name: "Coverage enrollment follow-up handoff item runner advances exactly one reviewed item",
    pass:
      readyRun.status === "reviewed_coverage_enrollment_follow_up_handoff_item_advanced" &&
      readyRun.runnerInvoked === true &&
      readyRun.selectedItem.selectedFollowUpId === "enrollment-follow-up-001" &&
      batch.selectedItemCount === 1 &&
      batch.selectedFollowUpId === "enrollment-follow-up-001" &&
      batch.runResults.length === 1 &&
      batch.runResults[0].status === "teacher_signal_question_prepared",
    evidence: readyResult.runPath
  },
  {
    name: "Coverage enrollment follow-up handoff item runner uses structured arguments, not the display command string",
    pass:
      readyRun.selectedItem.commandUsedForDisplayOnly === "Write-Output DISPLAY_ONLY_COMMAND_SHOULD_NOT_RUN" &&
      readyRun.selectedItem.structuredArgumentsUsed.plan === planPath &&
      readyRun.generatedEvidence.batchPath === readyResult.batchPath,
    evidence: readyRun.selectedItem.commandUsedForDisplayOnly
  },
  {
    name: "Coverage enrollment follow-up handoff item runner keeps completion and system-change locks closed",
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
  smoke: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_runner_smoke_v1",
  smokeRoot,
  paths: {
    queue: queueResult.queuePath,
    readyRun: readyResult.runPath,
    batch: readyResult.batchPath
  },
  passed,
  total: checks.length,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
