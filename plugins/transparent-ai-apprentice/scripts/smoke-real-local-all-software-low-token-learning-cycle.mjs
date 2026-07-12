#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "real-local-all-software-low-token-learning-cycle-smoke", String(Date.now()));
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
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function firstRealCandidate(inventory, avoid = "") {
  const candidates = Array.isArray(inventory?.softwareCandidates) ? inventory.softwareCandidates : [];
  return (
    candidates.find((row) => String(row.software || row.processName || "") !== avoid && (row.windowTitle || row.processName)) ||
    candidates.find((row) => String(row.software || row.processName || "") !== avoid) ||
    candidates[0] ||
    null
  );
}

function candidateName(candidate, fallback) {
  return String(candidate?.software || candidate?.processName || fallback);
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  "Create a real local all-software low-token learning cycle from bounded software metadata.",
  "--max-processes",
  "8",
  "--max-installed",
  "8",
  "--max-log-files-per-candidate",
  "1",
  "--output-dir",
  join(smokeRoot, "inventory-kit")
]);

const inventoryPath = join(smokeRoot, "real-local-software-observer-inventory.json");
const probe = runPowerShell([
  "-File",
  inventoryKit.readOnlyProbe,
  "-OutputPath",
  inventoryPath,
  "-MaxProcesses",
  "8",
  "-MaxInstalled",
  "8",
  "-MaxLogFilesPerCandidate",
  "1"
]);
const inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
const primaryCandidate = firstRealCandidate(inventory);
if (!primaryCandidate) throw new Error("Real local inventory returned no software candidates.");
const primarySoftware = candidateName(primaryCandidate, "real-local-software");
const secondaryCandidate = firstRealCandidate(inventory, primarySoftware) || primaryCandidate;
const secondarySoftware = candidateName(secondaryCandidate, "real-local-secondary-software");

const realQueue = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  inventoryPath,
  "--max-candidates",
  "6",
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

const realInventoryCycle = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--inventory",
  inventoryPath,
  "--state-dir",
  join(smokeRoot, "real-inventory-cycle-state"),
  "--output-dir",
  join(smokeRoot, "real-inventory-cycle"),
  "--cycles",
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
  "1"
]);
const realInventoryCycleJson = readJson(realInventoryCycle.learningCyclePath);

const voiceSession = runNodeScript("create-engineering-voice-control-session.mjs", [
  "--goal",
  `Let a non-expert control ${primarySoftware} by voice or typed text, confirm a numbered target, then use a reviewed low-token route.`,
  "--software",
  primarySoftware,
  "--process-name",
  String(primaryCandidate.processName || ""),
  "--window-title",
  String(primaryCandidate.windowTitle || ""),
  "--voice-transcript",
  "Put number one on the likely command target and wait for my confirmation before doing anything.",
  "--command",
  "Put number one on the likely command target and wait for my confirmation before doing anything.",
  "--candidate",
  "likely-command-target|likely command target|0.72|0.3|0|teacher voice command points to this possible engineering target",
  "--candidate",
  "alternate-tool-panel|alternate tool panel|0.2|0.5|0|alternate if teacher meant the side panel",
  "--no-port-scan",
  "--max-files",
  "8",
  "--max-depth",
  "0",
  "--max-registry-items",
  "0",
  "--preferred-adapter",
  "existing-cli-or-script",
  "--output-dir",
  join(smokeRoot, "voice-numbered-target-session")
]);
const voiceSessionJson = readJson(voiceSession.sessionPath);
const voiceTargetConfirmation = readJson(voiceSession.targetConfirmation);

const controlledLog = join(smokeRoot, "controlled-real-local-software.log");
writeFileSync(controlledLog, "startup complete\n", "utf8");
const controlledQueuePath = join(smokeRoot, "controlled-real-local-software-queue.json");
writeFileSync(
  controlledQueuePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      queueId: "real-local-controlled-low-token-delta",
      sourceInventoryPath: inventoryPath,
      queue: [
        {
          queueItemId: "real-local-controlled-log-candidate",
          software: primarySoftware,
          processName: String(primaryCandidate.processName || ""),
          windowTitle: String(primaryCandidate.windowTitle || ""),
          score: 0.93,
          recentLogCandidates: [{ path: controlledLog, source: "controlled_real_local_learning_delta" }],
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

const controlledStateDir = join(smokeRoot, "controlled-learning-state");
const controlledBaseline = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--queue",
  controlledQueuePath,
  "--state-dir",
  controlledStateDir,
  "--output-dir",
  join(smokeRoot, "controlled-baseline"),
  "--cycles",
  "1",
  "--max-items",
  "1",
  "--max-logs-per-item",
  "1",
  "--max-tail-bytes",
  "512",
  "--max-tail-lines",
  "12"
]);
appendFileSync(controlledLog, "ERROR teacher-reviewed operation changed after voice target confirmation\n", "utf8");
const controlledChanged = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--queue",
  controlledQueuePath,
  "--state-dir",
  controlledStateDir,
  "--output-dir",
  join(smokeRoot, "controlled-changed"),
  "--cycles",
  "2",
  "--interval-ms",
  "0",
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
  "--teacher-marker",
  "teacher confirms this changed log is the reusable learning signal"
]);
const controlledChangedJson = readJson(controlledChanged.learningCyclePath);
const controlledReceipt = readJson(controlledChanged.receiptPath);
const controlledCompact = readJson(controlledChangedJson.learningRuns[0].compactLearningEventsPath);

const noLogQueuePath = join(smokeRoot, "controlled-real-local-no-log-fallback-queue.json");
writeFileSync(
  noLogQueuePath,
  JSON.stringify(
    {
      format: "transparent_ai_software_observer_queue_v1",
      queueId: "real-local-controlled-no-log-fallback",
      sourceInventoryPath: inventoryPath,
      queue: [
        {
          queueItemId: "real-local-controlled-no-log-candidate",
          software: secondarySoftware,
          processName: String(secondaryCandidate.processName || ""),
          windowTitle: String(secondaryCandidate.windowTitle || ""),
          score: 0.71,
          recentLogCandidates: [],
          logAvailability: "no_candidate_logs_found",
          nonLogFallbackRequired: true,
          nonLogFallbackSignals: [
            {
              sourceType: "windows_event_log",
              sources: ["Application", "System"],
              lowTokenUse: "count_and_preview_only_before_screenshot",
              reviewQuestion: "Are recent Windows events relevant to the teacher command?"
            },
            {
              sourceType: "process_window_metadata",
              sources: [String(secondaryCandidate.processName || ""), String(secondaryCandidate.windowTitle || "")].filter(Boolean),
              lowTokenUse: "process_and_window_title_metadata_only",
              reviewQuestion: "Does process or window metadata prove the command state?"
            },
            {
              sourceType: "manual_teacher_marker",
              sources: ["short voice/text teacher marker"],
              lowTokenUse: "short_teacher_label_without_screen_recording",
              reviewQuestion: "What short marker should label this no-log software state?"
            }
          ],
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
const noLogFallback = runNodeScript("run-all-software-low-token-learning-cycle.mjs", [
  "--queue",
  noLogQueuePath,
  "--state-dir",
  join(smokeRoot, "no-log-learning-state"),
  "--output-dir",
  join(smokeRoot, "no-log-fallback-cycle"),
  "--cycles",
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
  "1"
]);
const noLogFallbackJson = readJson(noLogFallback.learningCyclePath);
const noLogCompact = readJson(noLogFallbackJson.learningRuns[0].compactLearningEventsPath);

const checks = [
  {
    name: "Real local inventory probe discovers bounded all-software candidates without reading log contents",
    pass:
      probe.status === 0 &&
      inventory?.format === "transparent_ai_software_observer_inventory_v1" &&
      inventory?.source === "read_only_local_probe" &&
      Array.isArray(inventory.softwareCandidates) &&
      inventory.softwareCandidates.length > 0 &&
      inventory.discoveryScope?.logContentsRead === false &&
      inventory.discoveryScope?.fullContinuousRecording === false &&
      inventory.discoveryScope?.nativeUniversalExecution === false,
    evidence: `candidates=${inventory?.softwareCandidates?.length ?? 0}; path=${inventoryPath}`
  },
  {
    name: "Real local inventory becomes an all-software observer queue with log and non-log routes",
    pass:
      realQueue.format === "transparent_ai_software_observer_queue_result_v1" &&
      realQueueJson.format === "transparent_ai_software_observer_queue_v1" &&
      Array.isArray(realQueueJson.queue) &&
      realQueueJson.queue.length > 0 &&
      realQueueJson.boundedScan.fullLogsRead === false &&
      realQueueJson.boundedScan.screenshotsCaptured === false &&
      realQueueJson.boundedScan.fullContinuousRecording === false &&
      realQueueJson.queue.some((item) => Array.isArray(item.lowTokenSignals) && item.lowTokenSignals.includes("non-log fallback when no candidate logs exist")),
    evidence: realQueue.queuePath
  },
  {
    name: "Learning cycle can generate a low-token queue directly from real local inventory",
    pass:
      realInventoryCycle.format === "transparent_ai_all_software_low_token_learning_cycle_result_v1" &&
      realInventoryCycle.generatedQueueFromInventory?.queuePath &&
      realInventoryCycleJson.generatedQueueFromInventory?.fullLogsRead === false &&
      realInventoryCycleJson.limits.metadataDeltaGateEnabled === true &&
      realInventoryCycleJson.limits.fullLogsRead === false &&
      realInventoryCycleJson.limits.screenshotsCaptured === false &&
      realInventoryCycleJson.limits.fullContinuousRecording === false &&
      realInventoryCycleJson.limits.softwareActionsExecuted === false,
    evidence: realInventoryCycle.generatedQueueFromInventory?.queuePath || ""
  },
  {
    name: "Voice or typed engineering command creates numbered targets before low-token execution learning",
    pass:
      voiceSessionJson.format === "transparent_ai_engineering_voice_control_session_v1" &&
      voiceSessionJson.software === primarySoftware &&
      voiceSessionJson.locks.numberedTargetConfirmationRequired === true &&
      voiceSessionJson.locks.fullContinuousRecording === false &&
      voiceSessionJson.locks.screenshotsCaptured === false &&
      voiceTargetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
      voiceTargetConfirmation.candidates.length === 2 &&
      voiceTargetConfirmation.candidates.every((candidate) => Number.isInteger(candidate.number)),
    evidence: voiceSession.targetConfirmation
  },
  {
    name: "Metadata gate initializes baseline and skips tail reads before any learning event",
    pass:
      controlledBaseline.format === "transparent_ai_all_software_low_token_learning_cycle_result_v1" &&
      controlledBaseline.status === "baseline_initialized_waiting_for_next_cycle" &&
      controlledBaseline.metadataDeltaGateEnabled === true &&
      controlledBaseline.watchCyclesRun === 0 &&
      controlledBaseline.tailReadSkippedByMetadataGate >= 1 &&
      controlledBaseline.compactLearningEvents === 0 &&
      controlledBaseline.softwareActionsExecuted === false,
    evidence: controlledBaseline.learningCyclePath
  },
  {
    name: "Changed metadata narrows the real local software candidate before bounded compact learning",
    pass:
      controlledChanged.status === "learning_events_waiting_for_teacher_review" &&
      controlledChanged.metadataDeltaGateEnabled === true &&
      controlledChanged.changedItems === 1 &&
      controlledChanged.processedLearningItems === 1 &&
      controlledChanged.compactLearningEvents > 0 &&
      controlledChangedJson.metadataGateRuns[0].logContentsRead === false &&
      controlledChangedJson.learningRuns[0].sourceQueuePath.includes("metadata-changed-software-observer-queue.json") &&
      controlledCompact.compactLearningEvents.length > 0,
    evidence: controlledChangedJson.learningRuns[0].compactLearningEventsPath
  },
  {
    name: "No-log real local candidate routes to non-log low-token learning instead of continuous recording",
    pass:
      noLogFallback.status === "learning_events_waiting_for_teacher_review" &&
      noLogFallback.nonLogFallbackItems >= 1 &&
      noLogFallbackJson.learningRuns[0].nonLogFallbackUsed === true &&
      noLogCompact.compactLearningEvents.some((event) => event.sourceType === "non_log_low_token_fallback") &&
      noLogCompact.lowTokenCompression.nonLogFallbackEventCount >= 1 &&
      noLogFallback.screenshotsCaptured === false &&
      noLogFallback.softwareActionsExecuted === false,
    evidence: JSON.stringify({
      nonLogFallbackItems: noLogFallback.nonLogFallbackItems,
      sourceTypes: noLogCompact.compactLearningEvents.map((event) => event.sourceType)
    })
  },
  {
    name: "Real local all-software learning stays review-only, low-token, and gated",
    pass:
      controlledReceipt.rawFullLogsRetained === false &&
      controlledReceipt.softwareActionsExecuted === false &&
      controlledReceipt.longTermMemoryWritten === false &&
      controlledReceipt.screenshotsCaptured === false &&
      controlledReceipt.fullContinuousRecording === false &&
      controlledReceipt.nativeUniversalExecution === false &&
      controlledReceipt.locks.accepted === false &&
      controlledReceipt.locks.ruleEnabled === false &&
      controlledReceipt.locks.packagingGated === true,
    evidence: JSON.stringify(controlledReceipt.locks)
  }
];

const failed = checks.filter((check) => !check.pass);
const summary = {
  status: failed.length === 0 ? "passed" : "failed",
  smoke: "transparent_ai_real_local_all_software_low_token_learning_cycle_smoke_v1",
  smokeRoot,
  realLocalSoftware: {
    primarySoftware,
    secondarySoftware,
    discoveredCandidateCount: inventory.softwareCandidates.length
  },
  paths: {
    inventory: inventoryPath,
    realQueue: realQueue.queuePath,
    realInventoryCycle: realInventoryCycle.learningCyclePath,
    voiceSession: voiceSession.sessionPath,
    voiceTargetConfirmation: voiceSession.targetConfirmation,
    controlledQueue: controlledQueuePath,
    controlledBaseline: controlledBaseline.learningCyclePath,
    controlledChanged: controlledChanged.learningCyclePath,
    noLogFallback: noLogFallback.learningCyclePath
  },
  checks
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) process.exit(1);
