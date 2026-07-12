#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "coverage-enrollment-follow-up-handoff-queue-smoke",
  String(Date.now())
);
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
    format: "transparent_ai_all_software_coverage_enrollment_follow_up_receipt_validation_v1",
    validationId: "smoke-validation",
    status: "validated_with_ready_enrollment_follow_up_rows",
    validationDecision: "some_rows_can_prepare_reviewed_enrollment_batch",
    readyRowCount: 2,
    waitingRowCount: 0,
    nextBatchReviewCommands: [
      {
        tool: "run_all_software_coverage_enrollment_follow_up_batch",
        arguments: {
          plan: "D:\\example\\follow-up-plan.json",
          teacherReviewed: true,
          maxItems: 2
        },
        readyFollowUpIds: ["follow-up-001", "follow-up-002"],
        commandLine:
          'node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-enrollment-follow-up-batch.mjs --plan "D:\\example\\follow-up-plan.json" --teacher-reviewed --max-items 2 --max-queue-items 2 --max-logs-per-item 1 --max-tail-lines 16 --max-tail-bytes 1024',
        executesNow: false,
        blockedUntil: "teacher explicitly runs the reviewed enrollment follow-up batch command"
      }
    ],
    paths: {
      validation: "D:\\example\\validation.json",
      readme: join(smokeRoot, "VALIDATION_START_HERE.md"),
      sourceFollowUpPlan: "D:\\example\\follow-up-plan.json"
    },
    locks: {
      reviewOnly: true,
      validationDoesNotRunBatch: true,
      batchRunnerInvoked: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      goalComplete: false
    },
    ...overrides
  };
}

writeFileSync(join(smokeRoot, "VALIDATION_START_HERE.md"), "# smoke validation\n", "utf8");

const safeValidationPath = writeJson(join(smokeRoot, "safe-validation.json"), validationFixture());
const safeResult = runNode("create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs", [
  "--goal",
  "smoke coverage enrollment handoff queue",
  "--validation",
  safeValidationPath,
  "--output-dir",
  join(smokeRoot, "safe-output")
]);
const safeQueue = readJson(safeResult.queuePath);

const placeholderValidationPath = writeJson(
  join(smokeRoot, "placeholder-validation.json"),
  validationFixture({
    nextBatchReviewCommands: [
      {
        tool: "run_all_software_coverage_enrollment_follow_up_batch",
        arguments: {},
        readyFollowUpIds: ["follow-up-placeholder"],
        commandLine:
          'node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-enrollment-follow-up-batch.mjs --plan "<teacher-reviewed-follow-up-plan.json>" --teacher-reviewed --max-items 1',
        executesNow: false
      }
    ]
  })
);
const placeholderResult = runNode("create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs", [
  "--validation",
  placeholderValidationPath,
  "--output-dir",
  join(smokeRoot, "placeholder-output")
]);
const placeholderQueue = readJson(placeholderResult.queuePath);

const unsafeValidationPath = writeJson(
  join(smokeRoot, "unsafe-validation.json"),
  validationFixture({
    nextBatchReviewCommands: [
      {
        tool: "run_all_software_coverage_enrollment_follow_up_batch",
        arguments: {},
        readyFollowUpIds: ["follow-up-unsafe"],
        commandLine:
          "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-enrollment-follow-up-batch.mjs --teacher-reviewed --execute --capture-screenshot",
        executesNow: false
      }
    ]
  })
);
const unsafeResult = runNode("create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs", [
  "--validation",
  unsafeValidationPath,
  "--output-dir",
  join(smokeRoot, "unsafe-output")
]);
const unsafeQueue = readJson(unsafeResult.queuePath);

const emptyValidationPath = writeJson(
  join(smokeRoot, "empty-validation.json"),
  validationFixture({
    status: "waiting_for_teacher_enrollment_follow_up_review",
    validationDecision: "needs_teacher_review",
    readyRowCount: 0,
    nextBatchReviewCommands: []
  })
);
const emptyResult = runNode("create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs", [
  "--validation",
  emptyValidationPath,
  "--output-dir",
  join(smokeRoot, "empty-output")
]);
const emptyQueue = readJson(emptyResult.queuePath);

const checks = [
  {
    name: "Coverage enrollment follow-up handoff queue classifies safe reviewed batch commands",
    pass:
      safeQueue.format === "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_v1" &&
      safeQueue.queueDecision === "manual_low_token_batch_handoffs_ready" &&
      safeQueue.queueItems.some((item) => item.kind === "reviewed_low_token_batch_command") &&
      safeQueue.queueItems.every((item) => item.safeForManualReviewHandoff === true),
    evidence: safeResult.queuePath
  },
  {
    name: "Coverage enrollment follow-up handoff queue writes visible start files",
    pass:
      Boolean(safeResult.htmlPath) &&
      Boolean(safeResult.readmePath) &&
      readFileSync(safeResult.htmlPath, "utf8").includes("Coverage Enrollment Follow-Up Handoff Queue") &&
      readFileSync(safeResult.readmePath, "utf8").includes("does not run the enrollment follow-up batch"),
    evidence: safeResult.htmlPath
  },
  {
    name: "Coverage enrollment follow-up handoff queue waits for placeholder resolution",
    pass:
      placeholderQueue.queueDecision === "waiting_for_teacher_placeholder_resolution" &&
      placeholderQueue.counts.placeholderItems === 1 &&
      placeholderQueue.queueItems.some((item) => item.placeholders.includes("<teacher-reviewed-follow-up-plan.json>")),
    evidence: placeholderResult.queuePath
  },
  {
    name: "Coverage enrollment follow-up handoff queue blocks unsafe commands",
    pass:
      unsafeQueue.queueDecision === "blocked_until_unsafe_handoffs_are_removed" &&
      unsafeQueue.counts.unsafeItems === 1 &&
      unsafeQueue.queueItems.some((item) => item.matchedForbiddenMarkers.includes("--execute")),
    evidence: unsafeResult.queuePath
  },
  {
    name: "Coverage enrollment follow-up handoff queue waits when validation has no ready rows",
    pass:
      emptyQueue.queueDecision === "waiting_for_teacher_enrollment_follow_up_review" &&
      emptyQueue.counts.readyFollowUpRows === 0 &&
      emptyQueue.locks.queueDoesNotRunBatch === true,
    evidence: emptyResult.queuePath
  },
  {
    name: "Coverage enrollment follow-up handoff queue keeps system-change locks closed",
    pass:
      safeQueue.locks.reviewOnly === true &&
      safeQueue.locks.queueDoesNotRunBatch === true &&
      safeQueue.locks.queueDoesNotReadLogs === true &&
      safeQueue.locks.queueDoesNotCaptureScreenshots === true &&
      safeQueue.locks.queueDoesNotExecuteTargetSoftware === true &&
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
  smoke: "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_smoke_v1",
  passed,
  total: checks.length,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
