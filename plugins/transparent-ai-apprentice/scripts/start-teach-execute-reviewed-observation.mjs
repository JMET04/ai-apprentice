#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "teach-execute-reviewed-observation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "teach-execute-reviewed-observation";
}

function readOptionalJson(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  if (existsSync(text)) return JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, ""));
  if (text.startsWith("{")) return JSON.parse(text);
  return null;
}

function runNodeScript(scriptName, args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function confirmationLooksExplicit(value) {
  const text = String(value || "").toLowerCase();
  return hasFlag("--teacher-confirmed") || [
    "i confirm",
    "teacher confirmed",
    "confirmed for read-only observation",
    "allow read-only observation",
    "approve read-only observation",
    "确认",
    "我确认",
    "允许只读观察",
    "允许读取",
    "批准只读观察",
    "同意只读观察"
  ].some((marker) => text.includes(marker.toLowerCase()));
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
    nativeUniversalExecution: false,
    softwareActionsExecuted: false,
    scheduledTaskRegistered: false,
    memoryEnabled: false,
    teacherConfirmationRequired: true,
    privateChainOfThoughtExposed: false
  };
}

function writeBlocked(outDir, reason, context) {
  const observationPath = join(outDir, "teach-execute-reviewed-observation.json");
  const receiptPath = join(outDir, "teach-execute-reviewed-observation-receipt.json");
  const readmePath = join(outDir, "TEACH_EXECUTE_REVIEWED_OBSERVATION_START_HERE.md");
  const payload = {
    format: "transparent_ai_teach_execute_reviewed_observation_v1",
    observationId: context.observationId,
    createdAt: new Date().toISOString(),
    status: "blocked_waiting_for_teacher_confirmation",
    reason,
    goal: context.goal,
    software: context.software,
    safeStartPath: context.safeStartPath,
    didRunReadOnlyProbe: false,
    didCreateQueue: false,
    didInitializeWatchBaseline: false,
    nextTeacherAction:
      "Review the safe-start materials, exclude private software, then rerun with --teacher-confirmed and a confirmation phrase for read-only observation.",
    locks: locks()
  };
  const receipt = {
    format: "transparent_ai_teach_execute_reviewed_observation_receipt_v1",
    observationId: context.observationId,
    status: payload.status,
    didRunReadOnlyProbe: false,
    didCreateQueue: false,
    didInitializeWatchBaseline: false,
    softwareActionsExecuted: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    memoryEnabled: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    locks: locks()
  };
  writeFileSync(observationPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  writeFileSync(
    readmePath,
    [
      "# Teach Execute Reviewed Observation",
      "",
      "This run is blocked because explicit teacher confirmation for read-only observation is missing.",
      "",
      "No local inventory probe, queue, watch baseline, screenshot, software action, memory write, or packaging step was run.",
      "",
      "Next: review private-app exclusions, then rerun with explicit confirmation."
    ].join("\n"),
    "utf8"
  );
  return { observationPath, receiptPath, readmePath, payload };
}

function filterInventory(inventory, exclusions, priorities) {
  const lowerExclusions = exclusions.map((item) => item.toLowerCase()).filter(Boolean);
  const lowerPriorities = priorities.map((item) => item.toLowerCase()).filter(Boolean);
  const candidates = Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates : [];
  const excluded = [];
  const kept = [];
  for (const candidate of candidates) {
    const haystack = [candidate.software, candidate.processName, candidate.windowTitle, candidate.installPath]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    if (lowerExclusions.some((exclude) => haystack.includes(exclude))) {
      excluded.push(candidate);
    } else {
      kept.push(candidate);
    }
  }
  kept.sort((left, right) => {
    const leftText = [left.software, left.processName, left.windowTitle].join(" ").toLowerCase();
    const rightText = [right.software, right.processName, right.windowTitle].join(" ").toLowerCase();
    const leftPriority = lowerPriorities.some((priority) => leftText.includes(priority)) ? 1 : 0;
    const rightPriority = lowerPriorities.some((priority) => rightText.includes(priority)) ? 1 : 0;
    return rightPriority - leftPriority;
  });
  return {
    ...inventory,
    softwareCandidates: kept,
    teacherFiltered: {
      excludedCount: excluded.length,
      excludedSoftware: excluded.slice(0, 40).map((candidate) => candidate.software || candidate.processName || "unknown"),
      priorityHints: priorities,
      privateAppsExcludedBeforeQueue: true
    }
  };
}

const safeStartInput = argValue("--safe-start", argValue("--safe-start-path", ""));
const safeStart = readOptionalJson(safeStartInput);
const goal = argValue("--goal", safeStart?.goal || "Run teacher-confirmed read-only observation after teach-execute safe start.");
const software = argValue("--software", argValue("--app", safeStart?.software || "all local software"));
const confirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "teach-execute-reviewed-observations")));
const maxProcesses = Number(argValue("--max-processes", "40"));
const maxInstalled = Number(argValue("--max-installed", "80"));
const maxLogFilesPerCandidate = Number(argValue("--max-log-files-per-candidate", "3"));
const maxCandidates = Number(argValue("--max-candidates", "12"));
const maxFilesPerCandidate = Number(argValue("--max-files-per-candidate", "3"));
const maxWatchItems = Number(argValue("--max-watch-items", "4"));
const maxLogsPerItem = Number(argValue("--max-logs-per-item", "2"));
const maxTailLines = Number(argValue("--max-tail-lines", "40"));
const maxTailBytes = Number(argValue("--max-tail-bytes", "32768"));
const exclusions = [...argValues("--exclude"), ...argValues("--private-app")];
const priorities = [...argValues("--priority"), ...argValues("--priority-software")];
const skipWatchBaseline = hasFlag("--no-watch-baseline");

mkdirSync(outputRoot, { recursive: true });
const observationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const observationDir = join(outputRoot, observationId);
mkdirSync(observationDir, { recursive: true });

const context = { observationId, goal, software, safeStartPath: safeStartInput && existsSync(safeStartInput) ? resolve(safeStartInput) : "" };
if (!confirmationLooksExplicit(confirmation)) {
  const blocked = writeBlocked(observationDir, "explicit teacher confirmation is required before local read-only observation", context);
  console.log(
    JSON.stringify(
      {
        ok: true,
        format: "transparent_ai_teach_execute_reviewed_observation_result_v1",
        observationId,
        status: blocked.payload.status,
        observationPath: blocked.observationPath,
        receiptPath: blocked.receiptPath,
        readme: blocked.readmePath,
        didRunReadOnlyProbe: false,
        didCreateQueue: false,
        didInitializeWatchBaseline: false,
        softwareActionsExecuted: false,
        screenshotsCaptured: false,
        fullContinuousRecording: false,
        nativeUniversalExecution: false,
        reviewLocks: locks()
      },
      null,
      2
    )
  );
  process.exit(0);
}

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  goal,
  "--output-dir",
  join(observationDir, "inventory-kit"),
  "--max-processes",
  String(maxProcesses),
  "--max-installed",
  String(maxInstalled),
  "--max-log-files-per-candidate",
  String(maxLogFilesPerCandidate)
]);
const inventoryPath = join(observationDir, "software-observer-inventory.json");
const probe = spawnSync(
  "powershell",
  [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    inventoryKit.readOnlyProbe,
    "-OutputPath",
    inventoryPath,
    "-MaxProcesses",
    String(maxProcesses),
    "-MaxInstalled",
    String(maxInstalled),
    "-MaxLogFilesPerCandidate",
    String(maxLogFilesPerCandidate)
  ],
  { cwd: process.cwd(), encoding: "utf8" }
);
if (probe.status !== 0) {
  throw new Error(probe.stderr || probe.stdout || "read-only inventory probe failed");
}

const rawInventory = JSON.parse(readFileSync(inventoryPath, "utf8").replace(/^\uFEFF/, ""));
const filteredInventory = filterInventory(rawInventory, exclusions, priorities);
const filteredInventoryPath = join(observationDir, "software-observer-inventory-reviewed.json");
writeFileSync(filteredInventoryPath, `${JSON.stringify(filteredInventory, null, 2)}\n`, "utf8");

const queueResult = runNodeScript("create-software-observer-queue.mjs", [
  "--inventory",
  filteredInventoryPath,
  "--output-dir",
  join(observationDir, "observer-queue"),
  "--max-candidates",
  String(maxCandidates),
  "--max-files-per-candidate",
  String(maxFilesPerCandidate)
]);

let watchBaseline = null;
if (!skipWatchBaseline && queueResult.queuePath) {
  watchBaseline = runNodeScript("run-software-observer-watch-cycle.mjs", [
    "--queue",
    queueResult.queuePath,
    "--state-dir",
    join(observationDir, "watch-state"),
    "--output-dir",
    join(observationDir, "watch-baseline"),
    "--max-items",
    String(maxWatchItems),
    "--max-logs-per-item",
    String(maxLogsPerItem),
    "--max-tail-lines",
    String(maxTailLines),
    "--max-tail-bytes",
    String(maxTailBytes)
  ]);
}

const observationPath = join(observationDir, "teach-execute-reviewed-observation.json");
const receiptPath = join(observationDir, "teach-execute-reviewed-observation-receipt.json");
const readmePath = join(observationDir, "TEACH_EXECUTE_REVIEWED_OBSERVATION_START_HERE.md");
const reviewedLocks = locks();
const observation = {
  format: "transparent_ai_teach_execute_reviewed_observation_v1",
  observationId,
  createdAt: new Date().toISOString(),
  status: "waiting_for_teacher_observation_review",
  goal,
  software,
  safeStartPath: context.safeStartPath,
  teacherConfirmation: "explicit_confirmation_recorded",
  exclusions,
  priorities,
  evidence: {
    inventoryKitReadme: inventoryKit.readme,
    inventoryProbe: inventoryKit.readOnlyProbe,
    rawInventoryPath: inventoryPath,
    reviewedInventoryPath: filteredInventoryPath,
    queuePath: queueResult.queuePath,
    queueReadme: queueResult.teacherReadme,
    watchCyclePath: watchBaseline?.watchCyclePath || "",
    watchReceiptPath: watchBaseline?.receiptPath || "",
    watchStatePath: watchBaseline?.statePath || "",
    readme: readmePath,
    receipt: receiptPath
  },
  counts: {
    rawCandidateCount: Array.isArray(rawInventory.softwareCandidates) ? rawInventory.softwareCandidates.length : 0,
    reviewedCandidateCount: Array.isArray(filteredInventory.softwareCandidates) ? filteredInventory.softwareCandidates.length : 0,
    excludedCandidateCount: filteredInventory.teacherFiltered.excludedCount,
    queuedCount: queueResult.queuedCount || 0,
    watchScannedItems: watchBaseline?.scannedItems || 0,
    watchChangedLogs: watchBaseline?.changedLogs || 0,
    watchScreenshotRequests: watchBaseline?.screenshotRequests || 0
  },
  lowTokenPolicy: {
    inventoryProbeReadOnly: true,
    logContentsReadByInventory: false,
    queueUsesMetadataScanning: true,
    watchBaselineReadsBoundedTailOnly: Boolean(watchBaseline),
    maxTailLines,
    maxTailBytes,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false
  },
  nextTeacherActions: [
    "Review reviewed inventory and queue.",
    "Remove private software before any next watch cycle.",
    "Run another watch cycle after the teacher or software changes state.",
    "Use compact learning events only after teacher identifies the reusable signal.",
    "Do not execute software actions until spatial intent, adapter selection, dry run, receipt, and outcome verification pass."
  ],
  locks: reviewedLocks
};
const receipt = {
  format: "transparent_ai_teach_execute_reviewed_observation_receipt_v1",
  observationId,
  status: observation.status,
  didRunReadOnlyProbe: true,
  didCreateQueue: true,
  didInitializeWatchBaseline: Boolean(watchBaseline),
  softwareActionsExecuted: false,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  scheduledTaskRegistered: false,
  memoryEnabled: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  evidence: observation.evidence,
  counts: observation.counts,
  locks: reviewedLocks
};

writeFileSync(observationPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Teach Execute Reviewed Observation",
    "",
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "This packet is the teacher-confirmed read-only observation start after safe start.",
    "",
    `Raw candidates: ${observation.counts.rawCandidateCount}`,
    `Reviewed candidates after exclusions: ${observation.counts.reviewedCandidateCount}`,
    `Queued apps: ${observation.counts.queuedCount}`,
    `Watch baseline initialized: ${Boolean(watchBaseline)}`,
    "",
    "Generated files:",
    `- ${basename(filteredInventoryPath)}`,
    `- ${queueResult.queuePath}`,
    watchBaseline?.watchCyclePath ? `- ${watchBaseline.watchCyclePath}` : "- watch baseline skipped",
    "",
    "Locked defaults: softwareActionsExecuted=false, screenshotsCaptured=false, fullContinuousRecording=false, rawFullLogsRetained=false, memoryEnabled=false, accepted=false, ruleEnabled=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_teach_execute_reviewed_observation_result_v1",
      observationId,
      status: observation.status,
      observationDir,
      observationPath,
      receiptPath,
      readme: readmePath,
      reviewedInventoryPath: filteredInventoryPath,
      queuePath: queueResult.queuePath,
      watchCyclePath: watchBaseline?.watchCyclePath || "",
      didRunReadOnlyProbe: true,
      didCreateQueue: true,
      didInitializeWatchBaseline: Boolean(watchBaseline),
      counts: observation.counts,
      softwareActionsExecuted: false,
      screenshotsCaptured: false,
      fullContinuousRecording: false,
      rawFullLogsRetained: false,
      scheduledTaskRegistered: false,
      memoryEnabled: false,
      nativeUniversalExecution: false,
      reviewLocks: reviewedLocks
    },
    null,
    2
  )
);
