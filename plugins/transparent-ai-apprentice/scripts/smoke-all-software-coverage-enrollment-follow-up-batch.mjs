#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "all-software-coverage-enrollment-follow-up-batch-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], timeout = 300000) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Build bounded real-local evidence for an enrollment follow-up batch runner.",
  "--max-processes",
  "6",
  "--max-installed",
  "6",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
const probe = spawnSync("powershell", [
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "6",
  "-MaxInstalled",
  "6",
  "-MaxLogFilesPerCandidate",
  "1"
], { cwd: smokeRoot, encoding: "utf8", timeout: 60000 });
if (probe.status !== 0) throw new Error(probe.stderr || probe.stdout || "read-only inventory probe failed");

const queue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "6",
  "--max-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "observer-queue")
]);

const audit = runNodeScript("create-all-software-observer-coverage-audit.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "coverage-audit")
]);

const ledgerResult = runNodeScript("create-all-software-coverage-enrollment-ledger.mjs", [
  "--inventory",
  inventoryPath,
  "--queue",
  queue.queuePath,
  "--coverage-audit",
  audit.auditPath,
  "--max-rows",
  "6",
  "--output-dir",
  join(smokeRoot, "ledger")
]);

const followUpResult = runNodeScript("create-all-software-coverage-enrollment-follow-up-plan.mjs", [
  "--ledger",
  ledgerResult.ledgerPath,
  "--max-items",
  "6",
  "--output-dir",
  join(smokeRoot, "follow-up-plan")
]);

const dryRunResult = runNodeScript("run-all-software-coverage-enrollment-follow-up-batch.mjs", [
  "--plan",
  followUpResult.planPath,
  "--max-items",
  "4",
  "--output-dir",
  join(smokeRoot, "dry-run-batch")
]);
const dryRunBatch = readJson(dryRunResult.batchPath);
const dryRunReceipt = readJson(dryRunResult.receiptPath);

const reviewedResult = runNodeScript("run-all-software-coverage-enrollment-follow-up-batch.mjs", [
  "--plan",
  followUpResult.planPath,
  "--teacher-reviewed",
  "--max-items",
  "4",
  "--max-queue-items",
  "4",
  "--max-logs-per-item",
  "1",
  "--output-dir",
  join(smokeRoot, "reviewed-batch")
]);
const reviewedBatch = readJson(reviewedResult.batchPath);
const reviewedReceipt = readJson(reviewedResult.receiptPath);
const mcpServerText = readFileSync(join(pluginRoot, "scripts", "mcp-server.mjs"), "utf8");

const checks = [
  {
    name: "Follow-up batch blocks actual low-token runs until teacher review",
    pass:
      dryRunBatch.format === "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1" &&
      dryRunReceipt.format === "transparent_ai_all_software_coverage_enrollment_follow_up_batch_receipt_v1" &&
      dryRunBatch.teacherReviewed === false &&
      dryRunBatch.ranToolCount === 0 &&
      dryRunBatch.runResults.every((item) => item.status === "dry_run_only"),
    evidence: dryRunResult.batchPath
  },
  {
    name: "Teacher-reviewed batch runs only low-token read-only follow-up tools",
    pass:
      reviewedBatch.teacherReviewed === true &&
      reviewedBatch.allowBoundedTail === false &&
      reviewedBatch.runResults.every((item) =>
        item.status === "metadata_gate_ran" ||
        item.status === "observer_queue_created" ||
        item.status === "teacher_signal_question_prepared" ||
        item.status === "dry_run_only"
      ) &&
      reviewedBatch.runResults.every((item) => item.status !== "bounded_tail_queue_item_ran"),
    evidence: reviewedResult.batchPath
  },
  {
    name: "Teacher-reviewed metadata gates use narrowed per-follow-up queues",
    pass:
      reviewedBatch.runResults
        .filter((item) => item.status === "metadata_gate_ran")
        .every(
          (item) =>
            item.narrowedQueuePath &&
            item.narrowedQueueMatchedCount >= 1 &&
            readJson(item.narrowedQueuePath).narrowedFor?.followUpId === item.followUpId
        ),
    evidence: JSON.stringify(
      reviewedBatch.runResults.map((item) => ({
        followUpId: item.followUpId,
        status: item.status,
        narrowedQueuePath: item.narrowedQueuePath || "",
        narrowedQueueMatchedCount: item.narrowedQueueMatchedCount
      }))
    )
  },
  {
    name: "Follow-up batch keeps screenshots execution schedules memory native control and completion locked",
    pass:
      reviewedReceipt.allSoftwareCoverageComplete === false &&
      reviewedReceipt.screenshotsCaptured === false &&
      reviewedReceipt.screenshotsCapturedByThisTool === false &&
      reviewedReceipt.fullContinuousRecording === false &&
      reviewedReceipt.rawFullLogsRetained === false &&
      reviewedReceipt.logContentsRead === false &&
      reviewedReceipt.fullLogsRead === false &&
      reviewedReceipt.softwareActionsExecuted === false &&
      reviewedReceipt.targetSoftwareCommandsExecuted === false &&
      reviewedReceipt.scheduledTaskInstalled === false &&
      reviewedReceipt.memoryWritten === false &&
      reviewedReceipt.nativeUniversalExecution === false &&
      reviewedReceipt.accepted === false &&
      reviewedReceipt.ruleEnabled === false &&
      reviewedReceipt.packagingGated === true,
    evidence: reviewedResult.receiptPath
  },
  {
    name: "Follow-up batch tells the reviewer to rerun audit and ledger before coverage claims",
    pass:
      reviewedBatch.completionBoundary.allSoftwareCoverageComplete === false &&
      reviewedBatch.completionBoundary.stillNeeded.includes("rerun coverage audit and enrollment ledger with new evidence") &&
      reviewedBatch.nextRecommendedCommand.includes("create-all-software-coverage-enrollment-ledger.mjs"),
    evidence: JSON.stringify(reviewedBatch.completionBoundary)
  },
  {
    name: "MCP advanced surface exposes enrollment follow-up batch runner",
    pass: mcpServerText.includes('name: "run_all_software_coverage_enrollment_follow_up_batch"'),
    evidence: "mcp-server.mjs contains run_all_software_coverage_enrollment_follow_up_batch"
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
