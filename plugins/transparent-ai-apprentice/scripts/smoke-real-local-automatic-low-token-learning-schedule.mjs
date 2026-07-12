#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-automatic-low-token-learning-schedule-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd = smokeRoot) {
  const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${args.join(" ")} failed`);
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function firstRealCandidate(inventory) {
  const candidates = Array.isArray(inventory?.softwareCandidates) ? inventory.softwareCandidates : [];
  return candidates.find((row) => row.processName || row.windowTitle || row.software) || candidates[0] || null;
}

function runnerJournalUnder(runRoot) {
  if (!existsSync(runRoot)) throw new Error(`Scheduled run root missing: ${runRoot}`);
  const dir = readdirSync(runRoot)
    .map((entry) => join(runRoot, entry))
    .find((entry) => statSync(entry).isDirectory() && existsSync(join(entry, "automatic-low-token-learning-runner.json")));
  if (!dir) throw new Error(`Runner journal not found under ${runRoot}`);
  return {
    dir,
    journalPath: join(dir, "automatic-low-token-learning-runner.json"),
    receiptPath: join(dir, "automatic-low-token-learning-runner-receipt.json")
  };
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Create a real local automatic low-token learning schedule from bounded software metadata.",
  "--max-processes",
  "10",
  "--max-installed",
  "10",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
runPowerShell([
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "10",
  "-MaxInstalled",
  "10",
  "-MaxLogFilesPerCandidate",
  "1"
]);
const inventory = readJson(inventoryPath);
const primaryCandidate = firstRealCandidate(inventory);
if (!primaryCandidate) throw new Error("Real local inventory returned no candidates.");
const primarySoftware = String(primaryCandidate.software || primaryCandidate.processName || "real-local-software");

const realQueue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "8",
  "--max-files-per-candidate",
  "1",
  "--max-depth",
  "0",
  "--max-entries-per-dir",
  "40",
  "--output-dir",
  join(smokeRoot, "real-queue")
]);
const realQueueJson = readJson(realQueue.queuePath);

const realSchedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Schedule real local all-software low-token learning from reviewed inventory queue.",
  "--queue",
  realQueue.queuePath,
  "--task-name",
  "TransparentAI-Smoke-RealLocal-LowTokenLearning",
  "--interval-minutes",
  "10",
  "--runs-per-launch",
  "1",
  "--max-items",
  "3",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12",
  "--max-learning-items",
  "1",
  "--output-dir",
  join(smokeRoot, "real-schedule")
]);
const realScheduleJson = readJson(realSchedule.schedulePath);
runPowerShell(["-File", realSchedule.runnerPath, "-RunLabel", "real-queue-pass"]);
const realRun = runnerJournalUnder(join(realScheduleJson.runOutputDir, "real-queue-pass"));
const realRunJournal = readJson(realRun.journalPath);
const realRunReceipt = readJson(realRun.receiptPath);

const controlledLog = join(smokeRoot, "controlled-real-local-automatic-learning.log");
writeFileSync(controlledLog, "startup complete\n", "utf8");
const controlledQueuePath = join(smokeRoot, "controlled-real-local-automatic-learning-queue.json");
writeFileSync(
  controlledQueuePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      queueId: "controlled-real-local-automatic-learning-schedule",
      sourceInventoryPath: inventoryPath,
      queue: [
        {
          queueItemId: "controlled-real-local-scheduled-learning",
          software: primarySoftware,
          processName: String(primaryCandidate.processName || ""),
          windowTitle: String(primaryCandidate.windowTitle || ""),
          score: 0.94,
          recentLogCandidates: [{ path: controlledLog, source: "controlled_real_local_schedule_delta" }],
          windowsEventLogs: ["Application", "System"]
        }
      ],
      locks: {
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        fullContinuousRecording: false,
        nativeUniversalExecution: false
      }
    },
    null,
    2
  ),
  "utf8"
);

const controlledSchedule = runNodeScript("create-automatic-low-token-learning-schedule.mjs", [
  "--goal",
  "Schedule controlled real-local low-token learning to prove baseline then changed metadata.",
  "--queue",
  controlledQueuePath,
  "--task-name",
  "TransparentAI-Smoke-Controlled-RealLocal-Learning",
  "--interval-minutes",
  "10",
  "--runs-per-launch",
  "1",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12",
  "--max-learning-items",
  "1",
  "--output-dir",
  join(smokeRoot, "controlled-schedule")
]);
const controlledScheduleJson = readJson(controlledSchedule.schedulePath);
runPowerShell(["-File", controlledSchedule.runnerPath, "-RunLabel", "controlled-baseline"]);
appendFileSync(controlledLog, "ERROR teacher-reviewed real-local scheduled learning signal changed\n", "utf8");
runPowerShell(["-File", controlledSchedule.runnerPath, "-RunLabel", "controlled-changed"]);
const controlledChangedRun = runnerJournalUnder(join(controlledScheduleJson.runOutputDir, "controlled-changed"));
const controlledChangedJournal = readJson(controlledChangedRun.journalPath);
const controlledChangedReceipt = readJson(controlledChangedRun.receiptPath);

const checks = [
  {
    name: "Real local inventory and queue feed an automatic low-token learning schedule",
    pass:
      inventory.format === "transparent_ai_software_observer_inventory_v1" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      realQueueJson.format === "transparent_ai_software_observer_queue_v1" &&
      Array.isArray(realQueueJson.queue) &&
      realQueueJson.queue.length > 0 &&
      realScheduleJson.format === "transparent_ai_automatic_low_token_learning_schedule_v1" &&
      realScheduleJson.nextMcpCall?.tool === "run_automatic_low_token_learning_runner",
    evidence: `${inventoryPath}; ${realQueue.queuePath}; ${realSchedule.schedulePath}`
  },
  {
    name: "Generated real local scheduled runner performs a bounded low-token pass without registering the task",
    pass:
      realRunJournal.format === "transparent_ai_automatic_low_token_learning_runner_v1" &&
      realRunJournal.automaticRunPolicy.metadataGateFirst === true &&
      realRunJournal.automaticRunPolicy.skipTailWhenMetadataUnchanged === true &&
      realRunReceipt.fullContinuousRecording === false &&
      realRunReceipt.screenshotsCaptured === false &&
      realRunReceipt.rawFullLogsRetained === false &&
      realRunReceipt.softwareActionsExecuted === false &&
      realRunReceipt.longTermMemoryWritten === false &&
      realRunReceipt.nativeUniversalExecution === false &&
      realScheduleJson.schedulePolicy.taskRegistered === false,
    evidence: realRun.journalPath
  },
  {
    name: "Controlled real-local scheduled runner learns only after metadata changes",
    pass:
      controlledChangedJournal.totals.changedItems >= 1 &&
      controlledChangedJournal.totals.compactLearningEvents >= 1 &&
      controlledChangedJournal.status === "learning_events_waiting_for_teacher_review" &&
      controlledChangedReceipt.longTermMemoryWritten === false &&
      controlledChangedReceipt.softwareActionsExecuted === false &&
      controlledChangedReceipt.nativeUniversalExecution === false,
    evidence: controlledChangedRun.journalPath
  },
  {
    name: "Real local automatic learning schedule keeps review, registration, memory, screenshot, execution, and native-control gates closed",
    pass:
      realScheduleJson.locks.accepted === false &&
      realScheduleJson.locks.ruleEnabled === false &&
      realScheduleJson.locks.packagingGated === true &&
      realScheduleJson.locks.scheduledTaskInstalled === false &&
      realScheduleJson.locks.teacherConfirmationRequired === true &&
      controlledScheduleJson.locks.scheduledTaskInstalled === false &&
      controlledScheduleJson.locks.longTermMemoryWritten === false &&
      controlledScheduleJson.locks.softwareActionsExecuted === false &&
      controlledScheduleJson.locks.nativeUniversalExecution === false,
    evidence: controlledSchedule.receiptPath
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_automatic_low_token_learning_schedule_smoke_v1",
  smokeRoot,
  realLocalSoftware: {
    primarySoftware,
    processName: String(primaryCandidate.processName || ""),
    windowTitle: String(primaryCandidate.windowTitle || ""),
    discoveredCandidateCount: inventory.softwareCandidates.length,
    queuedCount: realQueueJson.queue.length
  },
  paths: {
    inventory: inventoryPath,
    realQueue: realQueue.queuePath,
    realSchedule: realSchedule.schedulePath,
    realScheduleRunner: realSchedule.runnerPath,
    realScheduleRun: realRun.journalPath,
    controlledSchedule: controlledSchedule.schedulePath,
    controlledChangedRun: controlledChangedRun.journalPath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
