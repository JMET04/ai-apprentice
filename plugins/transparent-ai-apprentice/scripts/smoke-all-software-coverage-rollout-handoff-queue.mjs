#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "coverage-rollout-handoff-queue-smoke", String(Date.now()));
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
    format: "transparent_ai_all_software_coverage_rollout_receipt_validation_v1",
    validationId: "smoke-validation",
    status: "validated_with_ready_coverage_rollout_rows",
    validationDecision: "some_rows_ready_for_reviewed_coverage_rollout",
    readyRowCount: 1,
    waitingRowCount: 0,
    nextReviewCommands: [
      {
        batchId: "batch-001",
        tool: "run_all_software_coverage_rollout_supervisor",
        arguments: {
          plan: "D:\\example\\coverage-expansion-plan.json",
          teacherReviewed: true,
          startBatch: "batch-001",
          maxBatches: 1
        },
        commandLine:
          'node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-rollout-supervisor.mjs --plan "D:\\example\\coverage-expansion-plan.json" --teacher-reviewed --start-batch batch-001 --max-batches 1',
        executesNow: false,
        blockedUntil: "teacher explicitly runs the reviewed rollout command"
      }
    ],
    paths: {
      validation: "D:\\example\\validation.json",
      readme: join(smokeRoot, "VALIDATION_START_HERE.md"),
      sourceExpansionPlan: "D:\\example\\coverage-expansion-plan.json"
    },
    locks: {
      reviewOnly: true,
      validationDoesNotInvokeRolloutSupervisor: true,
      rolloutSupervisorInvoked: false,
      coverageRunnerInvoked: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false,
      goalComplete: false
    },
    ...overrides
  };
}

writeFileSync(join(smokeRoot, "VALIDATION_START_HERE.md"), "# smoke coverage rollout validation\n", "utf8");

const safeValidationPath = writeJson(join(smokeRoot, "safe-validation.json"), validationFixture());
const safeResult = runNode("create-all-software-coverage-rollout-handoff-queue.mjs", [
  "--goal",
  "smoke coverage rollout handoff queue",
  "--validation",
  safeValidationPath,
  "--output-dir",
  join(smokeRoot, "safe-output")
]);
const safeQueue = readJson(safeResult.queuePath);

const placeholderValidationPath = writeJson(
  join(smokeRoot, "placeholder-validation.json"),
  validationFixture({
    nextReviewCommands: [
      {
        batchId: "batch-placeholder",
        tool: "run_all_software_coverage_rollout_supervisor",
        arguments: {},
        commandLine:
          'node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-rollout-supervisor.mjs --plan "<teacher-reviewed-coverage-expansion-plan.json>" --teacher-reviewed --start-batch batch-001 --max-batches 1',
        executesNow: false
      }
    ]
  })
);
const placeholderResult = runNode("create-all-software-coverage-rollout-handoff-queue.mjs", [
  "--validation",
  placeholderValidationPath,
  "--output-dir",
  join(smokeRoot, "placeholder-output")
]);
const placeholderQueue = readJson(placeholderResult.queuePath);

const unsafeValidationPath = writeJson(
  join(smokeRoot, "unsafe-validation.json"),
  validationFixture({
    nextReviewCommands: [
      {
        batchId: "batch-unsafe",
        tool: "run_all_software_coverage_rollout_supervisor",
        arguments: {},
        commandLine:
          "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-coverage-rollout-supervisor.mjs --teacher-reviewed --execute --capture-screenshot",
        executesNow: false
      }
    ]
  })
);
const unsafeResult = runNode("create-all-software-coverage-rollout-handoff-queue.mjs", [
  "--validation",
  unsafeValidationPath,
  "--output-dir",
  join(smokeRoot, "unsafe-output")
]);
const unsafeQueue = readJson(unsafeResult.queuePath);

const emptyValidationPath = writeJson(
  join(smokeRoot, "empty-validation.json"),
  validationFixture({
    status: "waiting_for_teacher_coverage_rollout_review",
    validationDecision: "needs_teacher_review",
    readyRowCount: 0,
    nextReviewCommands: []
  })
);
const emptyResult = runNode("create-all-software-coverage-rollout-handoff-queue.mjs", [
  "--validation",
  emptyValidationPath,
  "--output-dir",
  join(smokeRoot, "empty-output")
]);
const emptyQueue = readJson(emptyResult.queuePath);

const checks = [
  {
    name: "Coverage rollout handoff queue classifies safe reviewed rollout commands",
    pass:
      safeQueue.format === "transparent_ai_all_software_coverage_rollout_handoff_queue_v1" &&
      safeQueue.queueDecision === "manual_coverage_rollout_handoffs_ready" &&
      safeQueue.queueItems.some((item) => item.kind === "reviewed_coverage_rollout_supervisor_command") &&
      safeQueue.queueItems.every((item) => item.safeForManualReviewHandoff === true),
    evidence: safeResult.queuePath
  },
  {
    name: "Coverage rollout handoff queue writes visible start files",
    pass:
      Boolean(safeResult.htmlPath) &&
      Boolean(safeResult.readmePath) &&
      readFileSync(safeResult.htmlPath, "utf8").includes("All-Software Coverage Rollout Handoff Queue") &&
      readFileSync(safeResult.readmePath, "utf8").includes("does not run the coverage rollout supervisor"),
    evidence: safeResult.htmlPath
  },
  {
    name: "Coverage rollout handoff queue waits for placeholder resolution",
    pass:
      placeholderQueue.queueDecision === "waiting_for_teacher_placeholder_resolution" &&
      placeholderQueue.counts.placeholderItems === 1 &&
      placeholderQueue.queueItems.some((item) => item.placeholders.includes("<teacher-reviewed-coverage-expansion-plan.json>")),
    evidence: placeholderResult.queuePath
  },
  {
    name: "Coverage rollout handoff queue blocks unsafe commands",
    pass:
      unsafeQueue.queueDecision === "blocked_until_unsafe_handoffs_are_removed" &&
      unsafeQueue.counts.unsafeItems === 1 &&
      unsafeQueue.queueItems.some((item) => item.matchedForbiddenMarkers.includes("--execute")),
    evidence: unsafeResult.queuePath
  },
  {
    name: "Coverage rollout handoff queue waits when validation has no ready rows",
    pass:
      emptyQueue.queueDecision === "waiting_for_teacher_coverage_rollout_review" &&
      emptyQueue.counts.readyRolloutRows === 0 &&
      emptyQueue.locks.queueDoesNotRunRolloutSupervisor === true,
    evidence: emptyResult.queuePath
  },
  {
    name: "Coverage rollout handoff queue keeps system-change locks closed",
    pass:
      safeQueue.locks.reviewOnly === true &&
      safeQueue.locks.queueDoesNotRunRolloutSupervisor === true &&
      safeQueue.locks.queueDoesNotRunCoverageRunner === true &&
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
  smoke: "transparent_ai_all_software_coverage_rollout_handoff_queue_smoke_v1",
  passed,
  total: checks.length,
  checks
};
console.log(JSON.stringify(output, null, 2));
if (output.status !== "passed") process.exit(1);
