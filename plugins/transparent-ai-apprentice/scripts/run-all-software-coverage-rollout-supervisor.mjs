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
  return String(value || "all-software-coverage-rollout-supervisor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-coverage-rollout-supervisor";
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const text = String(value).trim();
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 240000
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

function selectedBatches(plan, { startBatch, maxBatches }) {
  const batches = Array.isArray(plan.batches) ? plan.batches : [];
  if (batches.length === 0) throw new Error("Expansion plan has no batches");
  const start = String(startBatch || "1").trim();
  const startIndex =
    start.startsWith("batch-")
      ? Math.max(0, batches.findIndex((batch) => String(batch.batchId) === start))
      : Math.max(0, Number(start || "1") - 1);
  return batches.slice(startIndex, startIndex + maxBatches);
}

function auditArgsFromRollout(rollout, outputDir, maxRows) {
  const call = rollout.nextCoverageAuditCall?.arguments || {};
  const args = [];
  if (call.inventory) args.push("--inventory", call.inventory);
  if (call.queue) args.push("--queue", call.queue);
  for (const learningCycle of call.learningCycles || []) {
    args.push("--learning-cycle", learningCycle);
  }
  args.push("--max-rows", String(maxRows));
  args.push("--output-dir", outputDir);
  return args;
}

const planInput = readJsonInput(argValue("--plan", argValue("--plan-path", "")), "--plan");
const plan = planInput.value;
if (plan.format !== "transparent_ai_all_software_coverage_expansion_plan_v1") {
  throw new Error("Expected transparent_ai_all_software_coverage_expansion_plan_v1");
}

const teacherReviewed = hasFlag("--teacher-reviewed") || hasFlag("--teacher-confirmed");
const goal = argValue("--goal", "Advance reviewed all-software coverage rollout batches with audit handoffs.");
const maxBatches = Math.max(1, Number(argValue("--max-batches", "3")));
const startBatch = argValue("--start-batch", argValue("--batch", "1"));
const runsPerBatch = Math.max(1, Number(argValue("--runs-per-batch", argValue("--runs", "1"))));
const maxItems = Math.max(1, Number(argValue("--max-items", "4")));
const maxLearningItems = Math.max(1, Number(argValue("--max-learning-items", "2")));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-coverage-rollout-supervisors")));
mkdirSync(outputRoot, { recursive: true });
const supervisorId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const supervisorDir = join(outputRoot, supervisorId);
mkdirSync(supervisorDir, { recursive: true });

const batches = selectedBatches(plan, { startBatch, maxBatches });
const batchPackets = [];
const auditPackets = [];

for (const batch of batches) {
  const batchArgs = [
    "--plan",
    planInput.path || JSON.stringify(plan),
    "--batch",
    String(batch.batchId),
    "--runs",
    String(runsPerBatch),
    "--max-items",
    String(Math.min(maxItems, Math.max(1, batch.rows?.length || maxItems))),
    "--max-learning-items",
    String(maxLearningItems),
    "--output-dir",
    join(supervisorDir, "batches")
  ];
  if (teacherReviewed) batchArgs.push("--teacher-reviewed");
  const batchResult = runNodeScript("run-all-software-coverage-rollout-batch.mjs", batchArgs);
  const rollout = readJson(batchResult.rolloutPath);
  const auditResult = runNodeScript(
    "create-all-software-observer-coverage-audit.mjs",
    auditArgsFromRollout(rollout, join(supervisorDir, "post-batch-coverage-audits", batch.batchId), maxItems)
  );
  const audit = readJson(auditResult.auditPath);
  batchPackets.push({
    batchId: batch.batchId,
    status: batchResult.status,
    rolloutPath: batchResult.rolloutPath,
    receiptPath: batchResult.receiptPath,
    queuePath: batchResult.queuePath,
    runnerJournalPath: batchResult.runnerJournalPath || "",
    queuedCount: batchResult.queuedCount || 0,
    teacherReviewed: batchResult.teacherReviewed === true,
    allSoftwareCoverageComplete: false,
    usesExistingBatchRunner: true
  });
  auditPackets.push({
    batchId: batch.batchId,
    auditPath: auditResult.auditPath,
    receiptPath: auditResult.receiptPath,
    repairPlanPath: auditResult.repairPlanPath,
    status: auditResult.status,
    totalAudited: audit.counts?.totalAudited || 0,
    coverageAuditRerunAfterBatch: true
  });
}

const runnerRuns = batchPackets.reduce((total, packet) => {
  if (!packet.runnerJournalPath) return total;
  const journal = readJson(packet.runnerJournalPath);
  return total + (Array.isArray(journal.runRecords) ? journal.runRecords.length : 0);
}, 0);
const compactLearningEvents = batchPackets.reduce((total, packet) => {
  if (!packet.runnerJournalPath) return total;
  const journal = readJson(packet.runnerJournalPath);
  return total + (journal.totals?.compactLearningEvents || 0);
}, 0);
const queuedSoftware = batchPackets.reduce((total, packet) => total + packet.queuedCount, 0);
const status = teacherReviewed
  ? "reviewed_batches_advanced_with_post_batch_audits"
  : "prepared_batches_waiting_for_teacher_review_before_runner";

const supervisorPath = join(supervisorDir, "all-software-coverage-rollout-supervisor.json");
const receiptPath = join(supervisorDir, "all-software-coverage-rollout-supervisor-receipt.json");
const readmePath = join(supervisorDir, "ALL_SOFTWARE_COVERAGE_ROLLOUT_SUPERVISOR_START_HERE.md");

const supervisor = {
  format: "transparent_ai_all_software_coverage_rollout_supervisor_v1",
  supervisorId,
  createdAt: new Date().toISOString(),
  status,
  goal,
  sourceExpansionPlanPath: planInput.path,
  sourceExpansionPlanId: plan.planId || "",
  teacherReviewed,
  plannedBatches: Array.isArray(plan.batches) ? plan.batches.length : 0,
  selectedBatches: batches.map((batch) => batch.batchId),
  completedBatchPackets: batchPackets.length,
  auditPackets: auditPackets.length,
  batchPackets,
  auditPackets,
  counts: {
    plannedBatches: Array.isArray(plan.batches) ? plan.batches.length : 0,
    selectedBatches: batches.length,
    completedBatchPackets: batchPackets.length,
    auditPackets: auditPackets.length,
    queuedSoftware,
    runnerRuns,
    compactLearningEvents
  },
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason: "The supervisor advances only a bounded selected set of reviewed expansion batches; it is not proof that every installed app is covered or safe for unattended native control.",
    stillNeeded: [
      "teacher reviews or excludes every remaining expansion batch",
      "post-batch coverage audits match expected locked results for each batch",
      "private software exclusions are preserved",
      "teacher confirms broad coverage completion"
    ]
  },
  safetyPolicy: {
    defaultWithoutTeacherReviewed: "prepare_batch_packets_and_post_batch_audits_without_running_automatic_learning",
    reviewedMode: "reuse_existing_run_all_software_coverage_rollout_batch_runner_per_batch",
    auditBetweenBatches: true,
    noNewMonitoringTechnology: true
  },
  locks: locks()
};

const receipt = {
  format: "transparent_ai_all_software_coverage_rollout_supervisor_receipt_v1",
  supervisorId,
  status,
  supervisorPath,
  selectedBatches: batches.map((batch) => batch.batchId),
  completedBatchPackets: batchPackets.length,
  auditPackets: auditPackets.length,
  queuedSoftware,
  runnerRuns,
  compactLearningEvents,
  teacherReviewed,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  memoryWritten: false,
  scheduledTaskInstalled: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeFileSync(supervisorPath, `${JSON.stringify(supervisor, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(readmePath, [
  "# All-Software Coverage Rollout Supervisor",
  "",
  `Status: ${status}`,
  `Selected batches: ${batches.map((batch) => batch.batchId).join(", ")}`,
  `Completed batch packets: ${batchPackets.length}`,
  `Post-batch audit packets: ${auditPackets.length}`,
  "",
  "This supervisor reuses the existing single-batch rollout runner for each selected expansion batch, then reruns coverage audit before widening.",
  "",
  "Safety defaults:",
  "",
  "- Without `--teacher-reviewed`, batch packets are prepared but automatic learning does not run.",
  "- With `--teacher-reviewed`, only the existing low-token runner is reused per selected batch.",
  "- Every batch is followed by a coverage audit packet.",
  "- Screenshots, software actions, memory writes, schedules, acceptance, packaging, and universal native execution remain locked.",
  "- Broad all-software coverage remains unclaimed until every batch is reviewed and teacher-confirmed."
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_all_software_coverage_rollout_supervisor_result_v1",
  supervisorId,
  status,
  supervisorPath,
  receiptPath,
  readmePath,
  selectedBatches: batches.map((batch) => batch.batchId),
  completedBatchPackets: batchPackets.length,
  auditPackets: auditPackets.length,
  queuedSoftware,
  runnerRuns,
  compactLearningEvents,
  teacherReviewed,
  allSoftwareCoverageComplete: false,
  locks: receipt.locks
}, null, 2));
