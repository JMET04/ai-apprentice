#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "all-software-coverage-rollout-batch")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-rollout-batch";
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const text = String(value).trim();
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    memoryWritten: false,
    scheduledTaskInstalled: false,
    teacherConfirmationRequired: true
  };
}

function findBatch(plan, selector) {
  const batches = Array.isArray(plan.batches) ? plan.batches : [];
  if (batches.length === 0) throw new Error("Expansion plan has no batches");
  const wanted = String(selector || "batch-001").trim();
  const byId = batches.find((batch) => String(batch.batchId) === wanted);
  if (byId) return byId;
  const index = Math.max(1, Number(wanted || "1"));
  return batches[index - 1] || batches[0];
}

function batchInventory(batch, plan) {
  return {
    format: "transparent_ai_software_observer_inventory_v1",
    inventoryId: slugify(`rollout-${plan.planId || "plan"}-${batch.batchId}`),
    goal: `Reviewed rollout batch ${batch.batchId} from all-software coverage expansion plan.`,
    sourceExpansionPlanId: plan.planId || "",
    sourceBatchId: batch.batchId,
    softwareCandidates: (batch.rows || []).map((row, index) => ({
      software: row.software || `software-${index + 1}`,
      processName: row.processName || "",
      windowTitle: row.windowTitle || "",
      candidateLogRoots: [],
      candidateLogFiles: [],
      windowsEventLogs: ["Application", "System"],
      confidence: row.signalStatus === "has_log_metadata_route" ? 0.72 : 0.48,
      reason: `coverage_rollout_${row.signalStatus || "needs_review"}`
    })),
    locks: locks()
  };
}

const planInput = readJsonInput(argValue("--plan", argValue("--plan-path", "")), "--plan");
const plan = planInput.value;
if (plan.format !== "transparent_ai_all_software_coverage_expansion_plan_v1") {
  throw new Error("Expected transparent_ai_all_software_coverage_expansion_plan_v1");
}

const batch = findBatch(plan, argValue("--batch", argValue("--batch-id", "batch-001")));
const teacherReviewed = hasFlag("--teacher-reviewed") || hasFlag("--teacher-confirmed");
const goal = argValue("--goal", `Run reviewed low-token rollout batch ${batch.batchId}.`);
const runs = Math.max(1, Number(argValue("--runs", "1")));
const maxItems = Math.max(1, Number(argValue("--max-items", String(batch.rows?.length || 4))));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-rollout-batches")));
mkdirSync(outputRoot, { recursive: true });
const rolloutId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${batch.batchId}-${goal}`)}`;
const rolloutDir = join(outputRoot, rolloutId);
mkdirSync(rolloutDir, { recursive: true });

const inventoryPath = join(rolloutDir, "reviewed-rollout-batch-inventory.json");
writeFileSync(inventoryPath, `${JSON.stringify(batchInventory(batch, plan), null, 2)}\n`, "utf8");

const queueResult = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  String(maxItems),
  "--max-files-per-candidate",
  String(Math.max(1, Number(argValue("--max-files-per-candidate", "2")))),
  "--output-dir",
  join(rolloutDir, "observer-queue")
]);

let automaticRunnerResult = null;
if (teacherReviewed) {
  automaticRunnerResult = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
    "--queue",
    queueResult.queuePath,
    "--runs",
    String(runs),
    "--max-items",
    String(maxItems),
    "--state-dir",
    join(rolloutDir, "persistent-state"),
    "--output-dir",
    join(rolloutDir, "automatic-runner"),
    "--cycle-output-dir",
    join(rolloutDir, "learning-cycles"),
    "--max-learning-items",
    String(Math.max(1, Number(argValue("--max-learning-items", "2"))))
  ]);
}

const queue = JSON.parse(readFileSync(queueResult.queuePath, "utf8").replace(/^\uFEFF/, ""));
const runnerJournal = automaticRunnerResult?.journalPath
  ? JSON.parse(readFileSync(automaticRunnerResult.journalPath, "utf8").replace(/^\uFEFF/, ""))
  : null;
const status = teacherReviewed
  ? `runner_${automaticRunnerResult.status}`
  : "waiting_for_teacher_review_before_runner";

const rolloutPath = join(rolloutDir, "all-software-coverage-rollout-batch-run.json");
const receiptPath = join(rolloutDir, "all-software-coverage-rollout-batch-receipt.json");
const readmePath = join(rolloutDir, "ALL_SOFTWARE_COVERAGE_ROLLOUT_BATCH_START_HERE.md");

const rollout = {
  format: "transparent_ai_all_software_coverage_rollout_batch_run_v1",
  rolloutId,
  createdAt: new Date().toISOString(),
  status,
  goal,
  sourceExpansionPlanPath: planInput.path,
  sourceExpansionPlanId: plan.planId || "",
  sourceBatchId: batch.batchId,
  teacherReviewed,
  batchRows: batch.rows || [],
  batchInventoryPath: inventoryPath,
  queuePath: queueResult.queuePath,
  queuedCount: queue.queue.length,
  automaticRunner: automaticRunnerResult
    ? {
        journalPath: automaticRunnerResult.journalPath,
        receiptPath: automaticRunnerResult.receiptPath,
        statusPath: automaticRunnerResult.statusPath,
        status: automaticRunnerResult.status,
        totals: automaticRunnerResult.totals
      }
    : {
        status: "not_run_waiting_for_teacher_review",
        nextCommand: `node ${join(__dirname, "run-all-software-coverage-rollout-batch.mjs")} --plan "${planInput.path || "<plan json>"}" --batch ${batch.batchId} --teacher-reviewed`
      },
  nextCoverageAuditCall: {
    tool: "create_all_software_observer_coverage_audit",
    arguments: {
      inventory: inventoryPath,
      queue: queueResult.queuePath,
      learningCycles: runnerJournal?.runRecords?.map((record) => record.learningCyclePath) || [],
      maxRows: maxItems
    }
  },
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason: "A rollout batch advances reviewed coverage state for one bounded batch only; it is not proof that every installed app is covered.",
    stillNeeded: [
      "teacher reviews or excludes every expansion batch",
      "coverage audit is rerun after each batch",
      "recurring low-token runner state covers reviewed in-scope software",
      "teacher confirms completion"
    ]
  },
  locks: locks()
};

const receipt = {
  format: "transparent_ai_all_software_coverage_rollout_batch_receipt_v1",
  rolloutId,
  status,
  rolloutPath,
  queuePath: queueResult.queuePath,
  runnerJournalPath: automaticRunnerResult?.journalPath || "",
  teacherReviewed,
  queuedCount: queue.queue.length,
  runnerTotals: automaticRunnerResult?.totals || null,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  memoryWritten: false,
  scheduledTaskInstalled: false,
  nativeUniversalExecution: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeFileSync(rolloutPath, `${JSON.stringify(rollout, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(readmePath, [
  "# All-Software Coverage Rollout Batch",
  "",
  `Status: ${status}`,
  `Batch: ${batch.batchId}`,
  `Queued software: ${queue.queue.length}`,
  "",
  "This package turns one teacher-reviewed coverage-expansion batch into a bounded low-token runner state.",
  "",
  "Safety defaults:",
  "",
  "- No runner pass starts unless `--teacher-reviewed` is supplied.",
  "- The automatic runner uses metadata gates before bounded tail reads.",
  "- Screenshots, software actions, memory writes, schedules, acceptance, and packaging remain locked.",
  "- After the batch, run the provided coverage audit call before widening to the next batch."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_all_software_coverage_rollout_batch_result_v1",
  rolloutId,
  status,
  rolloutPath,
  receiptPath,
  readmePath,
  queuePath: queueResult.queuePath,
  runnerJournalPath: automaticRunnerResult?.journalPath || "",
  queuedCount: queue.queue.length,
  teacherReviewed,
  allSoftwareCoverageComplete: false,
  locks: receipt.locks
}, null, 2));
