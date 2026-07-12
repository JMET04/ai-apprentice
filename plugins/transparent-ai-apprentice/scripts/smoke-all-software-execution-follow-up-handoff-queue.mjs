#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "execution-follow-up-handoff-queue-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
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

function validationFixture(overrides = {}) {
  return {
    ok: true,
    format: "transparent_ai_all_software_execution_follow_up_receipt_validation_v1",
    validationId: "smoke-execution-validation",
    status: "validated_with_ready_dry_run_review_rows",
    validationDecision: "some_rows_ready_for_dry_run_runner_review",
    readyRowCount: 1,
    waitingRowCount: 0,
    nextDryRunReviewCommands: [
      {
        rowId: "row-001",
        tool: "run_all_software_execution_pilot_runner",
        arguments: {
          queue: "D:\\example\\execution-pilot-queue.json",
          pilotId: "pilot-001",
          execute: false,
          maxItems: 1,
          maxLogsPerItem: 1
        },
        executesNow: false,
        blockedUntil: "teacher explicitly runs a separate dry-run-only runner review command"
      }
    ],
    paths: {
      validation: "D:\\example\\validation.json",
      readme: join(smokeRoot, "EXECUTION_VALIDATION_START_HERE.md"),
      sourceBatch: "D:\\example\\execution-follow-up-batch.json"
    },
    locks: {
      reviewOnly: true,
      validationDoesNotInvokeRunner: true,
      dryRunRunnerInvoked: false,
      screenshotsCaptured: false,
      targetSoftwareCommandsExecuted: false,
      nativeUniversalExecution: false,
      goalComplete: false
    },
    ...overrides
  };
}

writeFileSync(join(smokeRoot, "EXECUTION_VALIDATION_START_HERE.md"), "# smoke execution validation\n", "utf8");

const safeValidationPath = writeJson(join(smokeRoot, "safe-validation.json"), validationFixture());
const safeResult = runNode("create-all-software-execution-follow-up-handoff-queue.mjs", [
  "--goal",
  "smoke execution follow-up handoff queue",
  "--validation",
  safeValidationPath,
  "--output-dir",
  join(smokeRoot, "safe-output")
]);
const safeQueue = readJson(safeResult.queuePath);

const placeholderValidationPath = writeJson(
  join(smokeRoot, "placeholder-validation.json"),
  validationFixture({
    nextDryRunReviewCommands: [
      {
        rowId: "row-placeholder",
        tool: "run_all_software_execution_pilot_runner",
        arguments: {
          queue: "<teacher-reviewed-execution-pilot-queue.json>",
          pilotId: "pilot-placeholder",
          execute: false
        },
        executesNow: false
      }
    ]
  })
);
const placeholderResult = runNode("create-all-software-execution-follow-up-handoff-queue.mjs", [
  "--validation",
  placeholderValidationPath,
  "--output-dir",
  join(smokeRoot, "placeholder-output")
]);
const placeholderQueue = readJson(placeholderResult.queuePath);

const unsafeValidationPath = writeJson(
  join(smokeRoot, "unsafe-validation.json"),
  validationFixture({
    nextDryRunReviewCommands: [
      {
        rowId: "row-unsafe",
        tool: "run_all_software_execution_pilot_runner",
        arguments: {
          queue: "D:\\example\\execution-pilot-queue.json",
          pilotId: "pilot-unsafe",
          execute: true
        },
        executesNow: false
      }
    ]
  })
);
const unsafeResult = runNode("create-all-software-execution-follow-up-handoff-queue.mjs", [
  "--validation",
  unsafeValidationPath,
  "--output-dir",
  join(smokeRoot, "unsafe-output")
]);
const unsafeQueue = readJson(unsafeResult.queuePath);

const emptyValidationPath = writeJson(
  join(smokeRoot, "empty-validation.json"),
  validationFixture({
    status: "waiting_for_teacher_execution_follow_up_review",
    validationDecision: "needs_teacher_review",
    readyRowCount: 0,
    nextDryRunReviewCommands: []
  })
);
const emptyResult = runNode("create-all-software-execution-follow-up-handoff-queue.mjs", [
  "--validation",
  emptyValidationPath,
  "--output-dir",
  join(smokeRoot, "empty-output")
]);
const emptyQueue = readJson(emptyResult.queuePath);

const checks = [
  {
    name: "Execution follow-up handoff queue classifies safe dry-run runner commands",
    pass:
      safeQueue.format === "transparent_ai_all_software_execution_follow_up_handoff_queue_v1" &&
      safeQueue.queueDecision === "manual_dry_run_runner_handoffs_ready" &&
      safeQueue.queueItems.some((item) => item.kind === "reviewed_dry_run_runner_command") &&
      safeQueue.queueItems.some((item) => item.command.includes("run-all-software-execution-pilot-runner.mjs")) &&
      safeQueue.queueItems.every((item) => item.safeForManualReviewHandoff === true),
    evidence: safeResult.queuePath
  },
  {
    name: "Execution follow-up handoff queue writes visible start files",
    pass:
      Boolean(safeResult.htmlPath) &&
      Boolean(safeResult.readmePath) &&
      readFileSync(safeResult.htmlPath, "utf8").includes("Execution Follow-Up Handoff Queue") &&
      readFileSync(safeResult.readmePath, "utf8").includes("does not invoke execution pilot runners"),
    evidence: safeResult.htmlPath
  },
  {
    name: "Execution follow-up handoff queue waits for placeholder resolution",
    pass:
      placeholderQueue.queueDecision === "waiting_for_teacher_placeholder_resolution" &&
      placeholderQueue.counts.placeholderItems === 1 &&
      placeholderQueue.queueItems.some((item) => item.placeholders.includes("<teacher-reviewed-execution-pilot-queue.json>")),
    evidence: placeholderResult.queuePath
  },
  {
    name: "Execution follow-up handoff queue blocks unsafe execute commands",
    pass:
      unsafeQueue.queueDecision === "blocked_until_unsafe_handoffs_are_removed" &&
      unsafeQueue.counts.unsafeItems === 1 &&
      unsafeQueue.queueItems.some((item) => item.matchedForbiddenMarkers.includes("--execute")),
    evidence: unsafeResult.queuePath
  },
  {
    name: "Execution follow-up handoff queue waits when validation has no ready dry-run rows",
    pass:
      emptyQueue.queueDecision === "waiting_for_teacher_execution_follow_up_review" &&
      emptyQueue.counts.readyDryRunRows === 0 &&
      emptyQueue.locks.queueDoesNotInvokeRunner === true,
    evidence: emptyResult.queuePath
  },
  {
    name: "Execution follow-up handoff queue keeps system-change locks closed",
    pass:
      safeQueue.locks.reviewOnly === true &&
      safeQueue.locks.queueDoesNotInvokeRunner === true &&
      safeQueue.locks.queueDoesNotExecuteTargetSoftware === true &&
      safeQueue.locks.queueDoesNotSendUiEvents === true &&
      safeQueue.locks.queueDoesNotReadLogs === true &&
      safeQueue.locks.queueDoesNotCaptureScreenshots === true &&
      safeQueue.locks.queueDoesNotRegisterSchedule === true &&
      safeQueue.locks.queueDoesNotWriteMemory === true &&
      safeQueue.locks.nativeUniversalExecution === false &&
      safeQueue.locks.goalComplete === false,
    evidence: JSON.stringify(safeQueue.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const output = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_all_software_execution_follow_up_handoff_queue_smoke_v1",
  passed,
  total: checks.length,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
