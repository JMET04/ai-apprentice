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
  return String(value || "convergence-automatic-learning-package")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "convergence-automatic-learning-package";
}

function readJsonInput(input, label) {
  if (!input) throw new Error(`${label} is required`);
  const text = String(input).trim();
  if (existsSync(text)) return { value: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function writeUtf8Bom(path, text) {
  writeFileSync(path, `\uFEFF${text}`, "utf8");
}

function psSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
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
    longTermMemoryWritten: false,
    scheduledTaskInstalled: false,
    teacherConfirmationRequired: true
  };
}

function extractQueueJobs(convergence) {
  const jobs = [];
  const seen = new Set();
  for (const batch of convergence.batchRows || []) {
    if (batch.status !== "advanced_with_post_batch_audit") continue;
    for (const packet of batch.rolloutPackets || []) {
      const queuePath = packet.queuePath || "";
      if (!queuePath || seen.has(queuePath)) continue;
      seen.add(queuePath);
      jobs.push({
        batchId: batch.batchId,
        queuePath,
        rolloutPath: packet.rolloutPath || "",
        supervisorPath: packet.supervisorPath || "",
        plannedSoftware: batch.plannedSoftware || []
      });
    }
  }
  return jobs;
}

function runNodeScript(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 240000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

const convergenceInput = readJsonInput(argValue("--convergence", argValue("--convergence-path", "")), "--convergence");
const convergence = convergenceInput.value;
if (convergence.format !== "transparent_ai_all_software_coverage_convergence_audit_v1") {
  throw new Error("Expected transparent_ai_all_software_coverage_convergence_audit_v1");
}

const goal = argValue("--goal", "Create a reviewed multi-queue automatic low-token learning package after coverage convergence.");
const teacherReviewed = hasFlag("--teacher-reviewed") || hasFlag("--teacher-confirmed");
const runOnce = hasFlag("--run-once");
const taskName = argValue("--task-name", "TransparentAI-Apprentice-ConvergedCoverageLearning");
const intervalMinutes = Math.max(1, Number(argValue("--interval-minutes", "15")));
const runsPerQueue = Math.max(1, Number(argValue("--runs-per-queue", argValue("--runs", "1"))));
const maxItems = Math.max(1, Number(argValue("--max-items", "4")));
const maxLearningItems = Math.max(1, Number(argValue("--max-learning-items", "2")));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "convergence-automatic-learning-packages")));
mkdirSync(outputRoot, { recursive: true });
const packageId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packageDir = join(outputRoot, packageId);
mkdirSync(packageDir, { recursive: true });

const queueJobs = extractQueueJobs(convergence);
if (queueJobs.length === 0) throw new Error("No advanced_with_post_batch_audit queue jobs found in convergence audit");
const stateDir = resolve(argValue("--state-dir", join(packageDir, "persistent-learning-state")));
const runOutputDir = resolve(argValue("--run-output-dir", join(packageDir, "learning-runs")));
mkdirSync(stateDir, { recursive: true });
mkdirSync(runOutputDir, { recursive: true });

const packagePath = join(packageDir, "convergence-automatic-learning-package.json");
const receiptPath = join(packageDir, "convergence-automatic-learning-package-receipt.json");
const readmePath = join(packageDir, "CONVERGENCE_AUTOMATIC_LEARNING_PACKAGE_START_HERE.md");
const runnerPath = join(packageDir, "run-converged-coverage-learning.ps1");
const registerPath = join(packageDir, "register-converged-coverage-learning-task.ps1");
const unregisterPath = join(packageDir, "unregister-converged-coverage-learning-task.ps1");
const queueJobsPath = join(packageDir, "reviewed-converged-queue-jobs.json");
const learningRunnerScript = join(__dirname, "run-automatic-low-token-learning-runner.mjs");

writeFileSync(queueJobsPath, `${JSON.stringify({ format: "transparent_ai_converged_queue_jobs_v1", queueJobs }, null, 2)}\n`, "utf8");

writeUtf8Bom(runnerPath, [
  "param(",
  "  [string]$RunLabel = (Get-Date -Format 'yyyyMMdd-HHmmss')",
  ")",
  "$ErrorActionPreference = 'Stop'",
  `$NodeExe = '${psSingleQuoted(process.execPath)}'`,
  `$LearningRunner = '${psSingleQuoted(learningRunnerScript)}'`,
  `$QueueJobsPath = '${psSingleQuoted(queueJobsPath)}'`,
  `$StateRoot = '${psSingleQuoted(stateDir)}'`,
  `$RunRoot = Join-Path '${psSingleQuoted(runOutputDir)}' $RunLabel`,
  "New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null",
  "$QueueJobs = (Get-Content -LiteralPath $QueueJobsPath -Raw | ConvertFrom-Json).queueJobs",
  "foreach ($Job in $QueueJobs) {",
  "  $BatchState = Join-Path $StateRoot $Job.batchId",
  "  $BatchRun = Join-Path $RunRoot $Job.batchId",
  "  New-Item -ItemType Directory -Force -Path $BatchRun | Out-Null",
  "  if (-not (Test-Path -LiteralPath $Job.queuePath)) { throw \"Reviewed queue missing: $($Job.queuePath)\" }",
  `  & $NodeExe $LearningRunner --queue $Job.queuePath --state-dir $BatchState --output-dir $BatchRun --runs '${runsPerQueue}' --max-items '${maxItems}' --max-learning-items '${maxLearningItems}'`,
  "  if ($LASTEXITCODE -ne 0) { throw \"Converged coverage queue run failed for $($Job.batchId)\" }",
  "}"
].join("\n"));

writeUtf8Bom(registerPath, [
  "param(",
  "  [switch]$TeacherConfirmed",
  ")",
  "$ErrorActionPreference = 'Stop'",
  "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed is required before registering converged coverage automatic learning.' }",
  `$TaskName = '${psSingleQuoted(taskName)}'`,
  `$Runner = '${psSingleQuoted(runnerPath)}'`,
  "$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument \"-NoProfile -ExecutionPolicy Bypass -File `\"$Runner`\"\"",
  `$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes ${intervalMinutes})`,
  "$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)",
  "Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description 'Transparent AI Apprentice converged coverage automatic low-token learning; reviewed queues only.' -Force | Out-Null",
  "Write-Output \"registered=$TaskName\""
].join("\n"));

writeUtf8Bom(unregisterPath, [
  "param(",
  "  [switch]$TeacherConfirmed",
  ")",
  "$ErrorActionPreference = 'Stop'",
  "if (-not $TeacherConfirmed) { throw 'TeacherConfirmed is required before unregistering converged coverage automatic learning.' }",
  `$TaskName = '${psSingleQuoted(taskName)}'`,
  "Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false",
  "Write-Output \"unregistered=$TaskName\""
].join("\n"));

const runOnceResults = [];
if (runOnce && teacherReviewed) {
  for (const job of queueJobs) {
    const result = runNodeScript("run-automatic-low-token-learning-runner.mjs", [
      "--queue",
      job.queuePath,
      "--state-dir",
      join(stateDir, job.batchId),
      "--output-dir",
      join(runOutputDir, "manual-run-once", job.batchId),
      "--runs",
      String(runsPerQueue),
      "--max-items",
      String(maxItems),
      "--max-learning-items",
      String(maxLearningItems)
    ], process.cwd());
    runOnceResults.push({
      batchId: job.batchId,
      queuePath: job.queuePath,
      journalPath: result.journalPath,
      receiptPath: result.receiptPath,
      status: result.status,
      totals: result.totals || {}
    });
  }
}

const totals = runOnceResults.reduce(
  (acc, result) => ({
    runnerRuns: acc.runnerRuns + (result.totals?.runsCompleted || 1),
    compactLearningEvents: acc.compactLearningEvents + (result.totals?.compactLearningEvents || 0),
    changedItems: acc.changedItems + (result.totals?.changedItems || 0)
  }),
  { runnerRuns: 0, compactLearningEvents: 0, changedItems: 0 }
);

const pkg = {
  format: "transparent_ai_convergence_automatic_learning_package_v1",
  packageId,
  createdAt: new Date().toISOString(),
  status: runOnceResults.length > 0
    ? "manual_reviewed_run_once_completed_waiting_for_teacher_schedule_confirmation"
    : "waiting_for_teacher_schedule_confirmation",
  goal,
  sourceConvergenceAuditPath: convergenceInput.path,
  coverageConvergedForTeacherReview: convergence.coverageConvergedForTeacherReview === true,
  allSoftwareCoverageComplete: false,
  queueJobs,
  queueJobsPath,
  stateDir,
  runOutputDir,
  files: {
    runner: runnerPath,
    registerTask: registerPath,
    unregisterTask: unregisterPath,
    receipt: receiptPath,
    readme: readmePath
  },
  schedulePolicy: {
    taskName,
    intervalMinutes,
    runsPerQueue,
    maxItems,
    maxLearningItems,
    taskRegistered: false,
    scheduledTaskInstalled: false,
    requiresTeacherConfirmedFlag: true,
    reviewedConvergenceRequired: true,
    metadataGateFirst: true,
    fullContinuousRecording: false,
    screenshotsCapturedByScheduler: false,
    targetSoftwareExecution: false,
    memoryRequiresTeacherReview: true
  },
  runOnce: {
    requested: runOnce,
    teacherReviewed,
    results: runOnceResults,
    totals
  },
  completionBoundary: {
    allSoftwareCoverageComplete: false,
    reason: "This package can automatically launch bounded learning passes over reviewed converged queues, but schedule registration, memory acceptance, and universal native execution remain teacher-gated.",
    stillNeeded: [
      "teacher confirms schedule registration",
      "teacher reviews compact learning events before memory",
      "private or excluded software remains out of scope",
      "native universal execution remains separately unproven"
    ]
  },
  locks: locks()
};

const receipt = {
  format: "transparent_ai_convergence_automatic_learning_package_receipt_v1",
  packageId,
  status: pkg.status,
  packagePath,
  queueJobsPath,
  queueCount: queueJobs.length,
  runOnceResults: runOnceResults.length,
  runnerRuns: totals.runnerRuns,
  compactLearningEvents: totals.compactLearningEvents,
  taskRegistered: false,
  scheduledTaskInstalled: false,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  memoryWritten: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareCoverageComplete: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(readmePath, [
  "# Convergence Automatic Learning Package",
  "",
  `Status: ${pkg.status}`,
  `Reviewed queues: ${queueJobs.length}`,
  `Run-once results: ${runOnceResults.length}`,
  "",
  "This package launches bounded automatic low-token learning over reviewed queues from a convergence audit.",
  "",
  "Safety defaults:",
  "",
  "- The scheduled task is not registered by default.",
  "- Registering requires `-TeacherConfirmed`.",
  "- Runs use the existing automatic low-token learning runner.",
  "- Screenshots, target software execution, long-term memory writes, acceptance, packaging, and universal native execution remain locked.",
  "",
  "Manual one-shot runner:",
  "",
  runnerPath
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_convergence_automatic_learning_package_result_v1",
  packageId,
  status: pkg.status,
  packagePath,
  receiptPath,
  readmePath,
  queueJobsPath,
  runnerPath,
  registerPath,
  unregisterPath,
  queueCount: queueJobs.length,
  runOnceResults: runOnceResults.length,
  runnerRuns: totals.runnerRuns,
  compactLearningEvents: totals.compactLearningEvents,
  allSoftwareCoverageComplete: false,
  scheduledTaskInstalled: false,
  locks: receipt.locks
}, null, 2));
