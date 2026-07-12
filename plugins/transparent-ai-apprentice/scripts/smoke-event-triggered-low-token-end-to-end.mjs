#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const sourceRepoRoot = resolve(pluginRoot, "..", "..");
const repoRoot = existsSync(join(sourceRepoRoot, "plugins", "transparent-ai-apprentice"))
  ? sourceRepoRoot
  : resolve(process.cwd());
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "event-triggered-low-token-end-to-end", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const appLog = join(smokeRoot, "UniversalProcessTool.log");
writeFileSync(appLog, "startup complete\n", "utf8");

const queue = {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "event-triggered-low-token-end-to-end-smoke",
  goal: "Learn from any reviewed software with metadata first, compact evidence second, and visual evidence only after teacher confirmation.",
  queue: [
    {
      queueItemId: "universal-process-tool",
      software: "UniversalProcessTool",
      processName: "UniversalProcessTool.exe",
      score: 0.93,
      recentLogCandidates: [{ path: appLog, source: "reviewed_log_source_candidate" }],
      windowsEventLogs: ["Application"],
      nonLogFallbackSignals: [{ sourceType: "process_window_metadata", lowTokenUse: "metadata_only" }]
    }
  ],
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    fullContinuousRecording: false,
    nativeUniversalExecution: false
  }
};
const queuePath = join(smokeRoot, "software-observer-queue.json");
writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");

const stateDir = join(smokeRoot, "persistent-state");
const baselineRunner = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
  "--goal",
  "Initialize event-triggered low-token baseline without visual escalation.",
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--runs",
  "1",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "20",
  "--output-dir",
  join(smokeRoot, "baseline-runner")
]);
const baselineVisualQueueResult = runNodeScript("create-automatic-triggered-visual-check-queue.mjs", [
  "--runner",
  baselineRunner.journalPath,
  "--output-dir",
  join(smokeRoot, "baseline-visual-queue")
]);
const baselineVisualQueue = readJson(baselineVisualQueueResult.queuePath);

appendFileSync(appLog, "ERROR teacher marker: export failed after the user changed a spatial constraint\n", "utf8");

const changedRunner = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
  "--goal",
  "Detect event-triggered low-token evidence and defer visual escalation to teacher review.",
  "--queue",
  queuePath,
  "--state-dir",
  stateDir,
  "--runs",
  "2",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "20",
  "--max-learning-items",
  "1",
  "--teacher-marker",
  "teacher marker: request visual evidence only if compact evidence remains ambiguous",
  "--output-dir",
  join(smokeRoot, "changed-runner")
]);
const changedJournal = readJson(changedRunner.journalPath);

const changedVisualQueueResult = runNodeScript("create-automatic-triggered-visual-check-queue.mjs", [
  "--runner",
  changedRunner.journalPath,
  "--max-requests",
  "2",
  "--output-dir",
  join(smokeRoot, "changed-visual-queue")
]);
const changedVisualQueue = readJson(changedVisualQueueResult.queuePath);

const budgetPlanResult = runNodeScript("create-low-token-trigger-budget-plan.mjs", [
  "--runner",
  changedRunner.journalPath,
  "--visual-check-queue",
  changedVisualQueueResult.queuePath,
  "--token-budget",
  "4",
  "--output-dir",
  join(smokeRoot, "budget-plan")
]);
const budgetPlan = readJson(budgetPlanResult.planPath);

const policyResult = runNodeScript("create-event-triggered-low-token-observation-policy.mjs", [
  "--budget-plan",
  budgetPlanResult.planPath,
  "--goal",
  "Use event-triggered low-token observation before visual evidence or execution for any software.",
  "--output-dir",
  join(smokeRoot, "event-policy")
]);
const policy = readJson(policyResult.policyPath);

const selectedRoutes = new Set((budgetPlan.selectedActions || []).map((row) => row.route));
const policyVisualRows = (policy.triggerRows || []).filter((row) => Number(row.maxScreenshots || 0) > 0);
const policyCompactRows = (policy.triggerRows || []).filter((row) => Number(row.maxScreenshots || 0) === 0);
const allLocks = [baselineVisualQueue.locks, changedVisualQueue.locks, budgetPlan.locks, policy.locks];

const checks = [
  {
    name: "Baseline run initializes metadata state without visual escalation",
    pass:
      baselineRunner.status === "baseline_initialized_waiting_for_next_automatic_run" &&
      baselineVisualQueue.requestCount === 0 &&
      baselineVisualQueue.status === "no_visual_check_needed_from_automatic_low_token_runner" &&
      baselineVisualQueue.locks.screenshotsCaptured === false,
    evidence: baselineRunner.journalPath
  },
  {
    name: "Changed log metadata becomes compact learning evidence before screenshots",
    pass:
      changedRunner.status === "learning_events_waiting_for_teacher_review" &&
      changedJournal.totals.metadataGateRuns >= 1 &&
      changedJournal.totals.compactLearningEvents >= 1 &&
      changedJournal.totals.screenshotRequests === 0 &&
      changedJournal.locks.screenshotsCaptured === false &&
      changedJournal.locks.longTermMemoryWritten === false,
    evidence: changedRunner.journalPath
  },
  {
    name: "Meaningful changed signal creates only a teacher-reviewed visual-check queue",
    pass:
      changedVisualQueue.requestCount >= 1 &&
      changedVisualQueue.status === "waiting_for_teacher_visual_check_review" &&
      changedVisualQueue.requests.every((request) => request.captureOnlyAfterReview === true && request.maxScreenshots === 1) &&
      changedVisualQueue.locks.teacherConfirmationRequiredBeforeCapture === true &&
      changedVisualQueue.locks.screenshotsCaptured === false,
    evidence: changedVisualQueueResult.queuePath
  },
  {
    name: "Trigger budget spends on compact evidence before screenshot-heavy follow-up",
    pass:
      budgetPlan.status === "waiting_for_teacher_low_token_trigger_budget_review" &&
      budgetPlan.selectedEstimatedTokenCost <= budgetPlan.tokenBudget &&
      (selectedRoutes.has("bounded_tail_review_before_visual_check") ||
        selectedRoutes.has("compact_learning_review_only") ||
        selectedRoutes.has("compact_learning_then_optional_visual_check")) &&
      budgetPlan.locks.teacherConfirmationRequiredBeforeCapture === true &&
      budgetPlan.locks.screenshotsCaptured === false,
    evidence: budgetPlanResult.planPath
  },
  {
    name: "Event policy converts the budget into metadata-first trigger rows",
    pass:
      policy.status === "waiting_for_teacher_event_trigger_policy_review" &&
      policy.triggerRows.length >= 1 &&
      policyCompactRows.length >= 1 &&
      policyVisualRows.every((row) => row.screenshotAllowedNow === false && row.maxScreenshots === 1) &&
      policy.locks.metadataFirst === true &&
      policy.locks.eventTriggeredOnly === true &&
      policy.locks.screenshotAllowedWithoutTeacher === false,
    evidence: policyResult.policyPath
  },
  {
    name: "End-to-end chain keeps low-token safety locks closed",
    pass: allLocks.every(
      (locks) =>
        locks &&
        locks.accepted === false &&
        locks.ruleEnabled === false &&
        locks.packagingGated === true &&
        locks.fullContinuousRecording === false &&
        locks.screenshotsCaptured === false &&
        locks.nativeUniversalExecution === false
    ),
    evidence: JSON.stringify({
      visualQueue: changedVisualQueue.locks,
      budget: budgetPlan.locks,
      policy: policy.locks
    })
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_event_triggered_low_token_end_to_end_smoke_v1",
  smokeRoot,
  checks,
  paths: {
    baselineRunner: baselineRunner.journalPath,
    changedRunner: changedRunner.journalPath,
    changedVisualQueue: changedVisualQueueResult.queuePath,
    budgetPlan: budgetPlanResult.planPath,
    eventPolicy: policyResult.policyPath
  }
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
