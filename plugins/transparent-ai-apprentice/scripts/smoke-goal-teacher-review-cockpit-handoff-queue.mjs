#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence };
}

const smokeRoot = resolve(
  process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : join(process.cwd(), ".transparent-apprentice", "goal-teacher-review-cockpit-handoff-queue-smoke", String(Date.now()))
);
mkdirSync(smokeRoot, { recursive: true });

const reviewFilePath = join(smokeRoot, "coverage-review-start-here.md");
writeFileSync(reviewFilePath, "# Coverage Review\n\nFixture review file.\n", "utf8");

const validationPath = writeJson(join(smokeRoot, "validation", "cockpit-receipt-validation.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_validation_v1",
  validationId: "smoke-cockpit-receipt-validation",
  validationDecision: "some_rows_ready_for_downstream_review",
  status: "validated_with_reviewed_cockpit_rows",
  paths: {
    sourceCockpit: "fixture-cockpit.json",
    sourceReceipt: "fixture-receipt.json"
  },
  nextSafeCommands: [
    {
      id: "review_coverage_rollout_receipt",
      itemId: "coverage_rollout_receipt",
      title: "Coverage rollout receipt",
      command:
        "node plugins\\transparent-ai-apprentice\\scripts\\validate-all-software-coverage-rollout-receipt.mjs --receipt <teacher-filled-coverage-rollout-receipt.json>",
      executesNow: false
    },
    {
      id: "review_open_file",
      itemId: "coverage_review_file",
      title: "Open coverage review file",
      command: reviewFilePath,
      executesNow: false
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const unsafeValidationPath = writeJson(join(smokeRoot, "validation", "unsafe-cockpit-receipt-validation.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_validation_v1",
  validationId: "smoke-cockpit-receipt-validation-unsafe",
  validationDecision: "some_rows_ready_for_downstream_review",
  status: "validated_with_reviewed_cockpit_rows",
  nextSafeCommands: [
    {
      id: "review_unsafe_execute",
      itemId: "unsafe_execute",
      title: "Unsafe execute handoff",
      command: "node plugins\\transparent-ai-apprentice\\scripts\\run-all-software-execution-pilot-runner.mjs --teacher-reviewed --execute",
      executesNow: false
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const emptyValidationPath = writeJson(join(smokeRoot, "validation", "empty-cockpit-receipt-validation.json"), {
  format: "transparent_ai_goal_teacher_review_cockpit_receipt_validation_v1",
  validationId: "smoke-cockpit-receipt-validation-empty",
  validationDecision: "needs_teacher_review",
  status: "waiting_for_teacher_review",
  nextSafeCommands: [],
  locks: {
    reviewOnly: true,
    accepted: false,
    packagingGated: true,
    goalComplete: false
  }
});

const queueResult = runScript("create-goal-teacher-review-cockpit-handoff-queue.mjs", [
  "--goal",
  "smoke cockpit handoff queue",
  "--validation",
  validationPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const queue = readJson(queueResult.queuePath);
const html = readFileSync(queueResult.htmlPath, "utf8");
const readme = readFileSync(queueResult.readmePath, "utf8");

const unsafeResult = runScript("create-goal-teacher-review-cockpit-handoff-queue.mjs", [
  "--validation",
  unsafeValidationPath,
  "--output-dir",
  join(smokeRoot, "unsafe-queue")
]);
const unsafeQueue = readJson(unsafeResult.queuePath);

const emptyResult = runScript("create-goal-teacher-review-cockpit-handoff-queue.mjs", [
  "--validation",
  emptyValidationPath,
  "--output-dir",
  join(smokeRoot, "empty-queue")
]);
const emptyQueue = readJson(emptyResult.queuePath);

const checks = [
  check(
    "Goal teacher review cockpit handoff queue classifies validated safe commands",
    queue.format === "transparent_ai_goal_teacher_review_cockpit_handoff_queue_v1" &&
      queue.status === "waiting_for_teacher_downstream_receipts" &&
      queue.counts.queueItems === 2 &&
      queue.queueItems.some(
        (item) =>
          item.handoffKind === "downstream_receipt_validation" &&
          item.missingInputs.includes("<teacher-filled-coverage-rollout-receipt.json>") &&
          item.commandExecutableNow === false
      ) &&
      queue.queueItems.some(
        (item) =>
          item.handoffKind === "open_review_entry" &&
          item.command === reviewFilePath &&
          item.commandLooksLikeFile === true &&
          item.status === "ready_for_manual_review_handoff"
      ),
    queueResult.queuePath
  ),
  check(
    "Goal teacher review cockpit handoff queue writes visible start files",
    existsSync(queueResult.htmlPath) &&
      existsSync(queueResult.readmePath) &&
      html.includes("Goal Teacher Review Cockpit Handoff Queue") &&
      readme.includes("does not execute commands"),
    queueResult.htmlPath
  ),
  check(
    "Goal teacher review cockpit handoff queue blocks unsafe execute commands",
    unsafeQueue.status === "blocked" &&
      unsafeQueue.queueDecision === "blocked_until_unsafe_handoffs_are_removed" &&
      unsafeQueue.counts.blockedCount === 1 &&
      unsafeQueue.queueItems[0].safety.matchedForbiddenMarkers.includes("--execute") &&
      unsafeQueue.locks.goalComplete === false,
    unsafeResult.queuePath
  ),
  check(
    "Goal teacher review cockpit handoff queue waits when validation has no next safe commands",
    emptyQueue.status === "waiting_for_validated_cockpit_receipt" &&
      emptyQueue.queueDecision === "waiting_for_validated_cockpit_receipt_commands" &&
      emptyQueue.counts.queueItems === 0,
    emptyResult.queuePath
  ),
  check(
    "Goal teacher review cockpit handoff queue keeps all system-change locks closed",
    queue.locks.queueDoesNotExecuteCommands === true &&
      queue.locks.queueDoesNotValidateDownstreamReceipts === true &&
      queue.locks.queueDoesNotExecuteTargetSoftware === true &&
      queue.locks.queueDoesNotCaptureScreenshots === true &&
      queue.locks.queueDoesNotWriteMemory === true &&
      queue.locks.nativeUniversalExecution === false,
    JSON.stringify(queue.locks)
  )
];

const failed = checks.filter((item) => !item.pass);
const output = {
  status: failed.length ? "failed" : "passed",
  smoke: "transparent_ai_goal_teacher_review_cockpit_handoff_queue_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    queue: queueResult.queuePath,
    unsafeQueue: unsafeResult.queuePath,
    emptyQueue: emptyResult.queuePath
  }
};

console.log(JSON.stringify(output, null, 2));
if (failed.length) process.exit(1);
