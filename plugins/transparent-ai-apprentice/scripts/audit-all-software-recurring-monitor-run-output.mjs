#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "recurring-monitor-run-output-audit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "recurring-monitor-run-output-audit"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(value, label) {
  const text = String(value || "").trim();
  if (!text) return { value: null, path: "" };
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function findRunnerJournals(root, maxDirs = 2000) {
  const out = [];
  const stack = [root];
  let visited = 0;
  while (stack.length && visited < maxDirs) {
    const dir = stack.pop();
    visited += 1;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && entry.name === "automatic-low-token-learning-runner.json") out.push(path);
    }
  }
  return out;
}

function safeReadJson(path) {
  try {
    return { ok: true, value: readJson(path) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function lockMismatch(row) {
  return (
    row.fullContinuousRecording !== false ||
    row.screenshotsCaptured !== false ||
    row.rawFullLogsRetained !== false ||
    row.softwareActionsExecuted !== false ||
    row.longTermMemoryWritten !== false ||
    row.nativeUniversalExecution !== false
  );
}

function writeReadme(path, audit) {
  const lines = [
    "# Recurring Monitor Run Output Audit",
    "",
    `Status: ${audit.status}`,
    `Run output dir: ${audit.runOutputDir || ""}`,
    `Runs reviewed: ${audit.reviewedRunCount}`,
    `Compact learning events: ${audit.totals.compactLearningEvents}`,
    "",
    "This audit only reads existing automatic low-token runner journals and receipts. It does not launch the runner, register scheduled tasks, capture screenshots, execute software, or write memory.",
    "",
    "Teacher review queue:"
  ];
  for (const item of audit.teacherReviewQueue) {
    lines.push(`- ${item.runId}: ${item.status}; compactEvents=${item.compactLearningEvents}; receipt=${item.receiptPath}`);
  }
  if (!audit.teacherReviewQueue.length) lines.push("- none");
  lines.push("", "Blocked actions:");
  for (const action of audit.blockedActions) lines.push(`- ${action}`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const goal = argValue("--goal", "Audit recurring all-software low-token monitor run outputs for teacher review.");
const scheduleInput = readJsonInput(argValue("--schedule", argValue("--schedule-path", "")), "--schedule");
const runnerInput = readJsonInput(argValue("--registration-runner", argValue("--runner", argValue("--runner-path", ""))), "--registration-runner");
const statusInput = readJsonInput(argValue("--registration-status", argValue("--status", "")), "--registration-status");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-recurring-monitor-run-output-audits")));
const maxRuns = Math.max(1, Number(argValue("--max-runs", "8")));

let schedule = scheduleInput.value;
let schedulePath = scheduleInput.path;
if (!schedule && runnerInput.value?.sourceSchedulePath && existsSync(runnerInput.value.sourceSchedulePath)) {
  schedulePath = resolve(runnerInput.value.sourceSchedulePath);
  schedule = readJson(schedulePath);
}
if (!schedule && statusInput.value?.sourceSchedulePath && existsSync(statusInput.value.sourceSchedulePath)) {
  schedulePath = resolve(statusInput.value.sourceSchedulePath);
  schedule = readJson(schedulePath);
}
if (!schedule || schedule.format !== "transparent_ai_automatic_low_token_learning_schedule_v1") {
  throw new Error("--schedule or a runner/status with sourceSchedulePath must point to transparent_ai_automatic_low_token_learning_schedule_v1");
}

const runOutputDir = resolve(argValue("--run-output-dir", schedule.runOutputDir || ""));
if (!runOutputDir) throw new Error("Could not determine runOutputDir from schedule or --run-output-dir");

mkdirSync(outputRoot, { recursive: true });
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(schedule.taskName || goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });

const journalPaths = existsSync(runOutputDir)
  ? findRunnerJournals(runOutputDir)
      .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, maxRuns)
  : [];

const runRows = [];
for (const journalRef of journalPaths) {
  const journalRead = safeReadJson(journalRef.path);
  if (!journalRead.ok) {
    runRows.push({
      runId: journalRef.path,
      journalPath: journalRef.path,
      parseError: journalRead.error,
      status: "journal_parse_error",
      compactLearningEvents: 0,
      changedItems: 0,
      lockMismatch: true
    });
    continue;
  }
  const journal = journalRead.value;
  const receiptPath = join(journalRef.path.replace(/automatic-low-token-learning-runner\.json$/, ""), "automatic-low-token-learning-runner-receipt.json");
  const receiptRead = existsSync(receiptPath) ? safeReadJson(receiptPath) : { ok: false, error: "receipt_missing" };
  const receipt = receiptRead.ok ? receiptRead.value : {};
  const row = {
    runId: journal.runnerId || journalRef.path,
    journalPath: journalRef.path,
    receiptPath,
    status: journal.status || "unknown",
    runCount: Array.isArray(journal.runRecords) ? journal.runRecords.length : 0,
    compactLearningEvents: Number(journal.totals?.compactLearningEvents || 0),
    changedItems: Number(journal.totals?.changedItems || 0),
    changedLogs: Number(journal.totals?.changedLogs || 0),
    tailReadSkippedByMetadataGate: Number(journal.totals?.tailReadSkippedByMetadataGate || 0),
    screenshotRequests: Number(journal.totals?.screenshotRequests || 0),
    nextTeachingCalls: Array.isArray(journal.nextTeachingCalls) ? journal.nextTeachingCalls.slice(0, 3) : [],
    fullContinuousRecording: receipt.fullContinuousRecording === true ? true : false,
    screenshotsCaptured: receipt.screenshotsCaptured === true ? true : false,
    rawFullLogsRetained: receipt.rawFullLogsRetained === true ? true : false,
    softwareActionsExecuted: receipt.softwareActionsExecuted === true ? true : false,
    longTermMemoryWritten: receipt.longTermMemoryWritten === true ? true : false,
    nativeUniversalExecution: receipt.nativeUniversalExecution === true ? true : false,
    receiptOk: receiptRead.ok,
    receiptError: receiptRead.ok ? "" : receiptRead.error
  };
  row.lockMismatch = lockMismatch(row);
  runRows.push(row);
}

const totals = runRows.reduce(
  (acc, row) => ({
    reviewedRuns: acc.reviewedRuns + 1,
    compactLearningEvents: acc.compactLearningEvents + row.compactLearningEvents,
    changedItems: acc.changedItems + row.changedItems,
    changedLogs: acc.changedLogs + row.changedLogs,
    tailReadSkippedByMetadataGate: acc.tailReadSkippedByMetadataGate + row.tailReadSkippedByMetadataGate,
    screenshotRequests: acc.screenshotRequests + row.screenshotRequests,
    lockMismatches: acc.lockMismatches + (row.lockMismatch ? 1 : 0)
  }),
  {
    reviewedRuns: 0,
    compactLearningEvents: 0,
    changedItems: 0,
    changedLogs: 0,
    tailReadSkippedByMetadataGate: 0,
    screenshotRequests: 0,
    lockMismatches: 0
  }
);

const teacherReviewQueue = runRows
  .filter((row) => row.compactLearningEvents > 0 || row.lockMismatch || row.status === "journal_parse_error")
  .map((row) => ({
    runId: row.runId,
    status: row.lockMismatch ? "blocked_lock_mismatch_requires_teacher_review" : row.status,
    compactLearningEvents: row.compactLearningEvents,
    changedItems: row.changedItems,
    journalPath: row.journalPath,
    receiptPath: row.receiptPath,
    nextTeachingCalls: row.nextTeachingCalls,
    reviewInstruction:
      row.compactLearningEvents > 0
        ? "Review compact learning events before any memory write, screenshot, rule enablement, or packaging."
        : "Inspect lock or parse mismatch before trusting this recurring monitor output."
  }));

let status = "waiting_for_first_scheduled_run_output";
if (totals.lockMismatches > 0) status = "blocked_recurring_monitor_run_output_lock_mismatch";
else if (totals.compactLearningEvents > 0) status = "learning_events_waiting_for_teacher_review";
else if (totals.reviewedRuns > 0) status = "no_changed_learning_events_waiting_for_next_run";

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  runOutputAuditDoesNotChangeSystem: true,
  runnerLaunched: false,
  scheduledTaskRegistered: false,
  scheduledTaskUnregistered: false,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false
};

const auditPath = join(auditDir, "recurring-monitor-run-output-audit.json");
const receiptPath = join(auditDir, "recurring-monitor-run-output-audit-receipt.json");
const readmePath = join(auditDir, "RECURRING_MONITOR_RUN_OUTPUT_AUDIT_START_HERE.md");

const audit = {
  ok: true,
  format: "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  schedulePath,
  registrationRunnerPath: runnerInput.path,
  registrationStatusPath: statusInput.path,
  taskName: schedule.taskName || "",
  runOutputDir,
  reviewedRunCount: runRows.length,
  maxRuns,
  totals,
  latestRuns: runRows,
  teacherReviewQueue,
  blockedActions: [
    "launch automatic runner from this audit",
    "register or unregister a scheduled task from this audit",
    "capture screenshots from this audit",
    "read full logs from this audit",
    "write long-term memory from recurring monitor output",
    "enable rules or packaging from recurring monitor output without teacher review",
    "execute target software from recurring monitor output"
  ],
  locks,
  files: {
    audit: auditPath,
    receipt: receiptPath,
    readme: readmePath
  }
};

const receipt = {
  format: "transparent_ai_all_software_recurring_monitor_run_output_audit_receipt_v1",
  auditId,
  status,
  taskName: audit.taskName,
  runOutputDir,
  reviewedRunCount: runRows.length,
  totals,
  teacherReviewQueueCount: teacherReviewQueue.length,
  runnerLaunched: false,
  scheduledTaskRegistered: false,
  scheduledTaskUnregistered: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  locks
};

writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_recurring_monitor_run_output_audit_result_v1",
      status,
      auditId,
      auditPath,
      receiptPath,
      readmePath,
      runOutputDir,
      reviewedRunCount: runRows.length,
      teacherReviewQueueCount: teacherReviewQueue.length,
      totals,
      runnerLaunched: false,
      scheduledTaskRegistered: false,
      scheduledTaskUnregistered: false,
      locks
    },
    null,
    2
  )
);

