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
  return String(value || "all-software-observer-bootstrap")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "all-software-observer-bootstrap";
}

function runScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

function readJsonInput(value) {
  if (!value) return null;
  if (existsSync(value)) return JSON.parse(readFileSync(value, "utf8"));
  const trimmed = String(value).trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  return null;
}

function persistInlineInventory(value, outputDir) {
  if (!value) return "";
  if (existsSync(value)) return resolve(value);
  const parsed = readJsonInput(value);
  if (!parsed) return "";
  const path = join(outputDir, "provided-software-observer-inventory.json");
  writeFileSync(path, JSON.stringify(parsed, null, 2), "utf8");
  return path;
}

const goal = argValue("--goal", "Bootstrap low-token learning from all software on this computer.");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-observer-bootstrap")));
const maxProcesses = Number(argValue("--max-processes", "80"));
const maxInstalled = Number(argValue("--max-installed", "160"));
const maxCandidates = Number(argValue("--max-candidates", "24"));
const maxFilesPerCandidate = Number(argValue("--max-files-per-candidate", "6"));
const maxLogFilesPerCandidate = Number(argValue("--max-log-files-per-candidate", String(maxFilesPerCandidate)));
const maxDepth = Number(argValue("--max-depth", "2"));
const maxEntriesPerDir = Number(argValue("--max-entries-per-dir", "180"));
const maxWatchItems = Number(argValue("--max-watch-items", "8"));
const maxLogsPerItem = Number(argValue("--max-logs-per-item", "4"));
const maxTailLines = Number(argValue("--max-tail-lines", "80"));
const maxTailBytes = Number(argValue("--max-tail-bytes", "65536"));
const inventoryInput = argValue("--inventory", argValue("--inventory-path", ""));
const initializeWatch = !hasFlag("--no-initialize-watch");
const includeSystem = hasFlag("--include-system");

mkdirSync(outputRoot, { recursive: true });
const bootstrapId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const bootstrapDir = join(outputRoot, bootstrapId);
mkdirSync(bootstrapDir, { recursive: true });

const locks = {
  ruleEnabled: false,
  accepted: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const inventoryKit = runScript("create-software-observer-inventory.mjs", [
  "--goal",
  goal,
  "--output-dir",
  join(bootstrapDir, "inventory-kit"),
  "--max-processes",
  String(maxProcesses),
  "--max-installed",
  String(maxInstalled),
  "--max-log-files-per-candidate",
  String(maxLogFilesPerCandidate),
  ...(includeSystem ? ["--include-system"] : [])
]);

const persistedInventoryPath = persistInlineInventory(inventoryInput, bootstrapDir);
let queueResult = null;
let watchBaseline = null;
let bootstrapMode = "inventory_probe_waiting_for_teacher_review";

if (persistedInventoryPath) {
  queueResult = runScript("create-software-observer-queue.mjs", [
    "--inventory",
    persistedInventoryPath,
    "--output-dir",
    join(bootstrapDir, "observer-queues"),
    "--max-candidates",
    String(maxCandidates),
    "--max-files-per-candidate",
    String(maxFilesPerCandidate),
    "--max-depth",
    String(maxDepth),
    "--max-entries-per-dir",
    String(maxEntriesPerDir)
  ]);
  bootstrapMode = "queue_ready_waiting_for_watch_review";

  if (initializeWatch && queueResult?.queuePath) {
    watchBaseline = runScript("run-software-observer-watch-cycle.mjs", [
      "--queue",
      queueResult.queuePath,
      "--state-dir",
      join(bootstrapDir, "watch-state"),
      "--output-dir",
      join(bootstrapDir, "watch-cycles"),
      "--max-items",
      String(maxWatchItems),
      "--max-logs-per-item",
      String(maxLogsPerItem),
      "--max-tail-lines",
      String(maxTailLines),
      "--max-tail-bytes",
      String(maxTailBytes)
    ]);
    bootstrapMode = "watch_baseline_initialized_waiting_for_next_cycle";
  }
}

const exclusionTemplatePath = join(bootstrapDir, "teacher-exclusion-and-style-template.json");
const bootstrapPath = join(bootstrapDir, "all-software-observer-bootstrap.json");
const receiptPath = join(bootstrapDir, "all-software-observer-bootstrap-receipt.json");
const readmePath = join(bootstrapDir, "ALL_SOFTWARE_OBSERVER_START_HERE.md");

const nextProbeCommand = [
  "powershell",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  `"${inventoryKit.readOnlyProbe}"`,
  "-OutputPath",
  `"${join(bootstrapDir, "software-observer-inventory.json")}"`
].join(" ");

const nextQueueCommand = [
  "node",
  `"${join(__dirname, "create-software-observer-queue.mjs")}"`,
  "--inventory",
  `"${join(bootstrapDir, "software-observer-inventory.json")}"`,
  "--output-dir",
  `"${join(bootstrapDir, "observer-queues")}"`
].join(" ");

const nextWatchCommand = [
  "node",
  `"${join(__dirname, "run-software-observer-watch-cycle.mjs")}"`,
  "--queue",
  `"${queueResult?.queuePath ?? "<path to reviewed software-observer-queue.json>"}"`,
  "--state-dir",
  `"${join(bootstrapDir, "watch-state")}"`,
  "--output-dir",
  `"${join(bootstrapDir, "watch-cycles")}"`
].join(" ");

const nextSupervisorCommand = [
  "node",
  `"${join(__dirname, "run-all-software-observer-supervisor.mjs")}"`,
  "--queue",
  `"${queueResult?.queuePath ?? "<path to reviewed software-observer-queue.json>"}"`,
  "--state-dir",
  `"${join(bootstrapDir, "watch-state")}"`,
  "--output-dir",
  `"${join(bootstrapDir, "supervisor-runs")}"`
].join(" ");

const teacherTemplate = {
  format: "transparent_ai_all_software_teacher_review_template_v1",
  bootstrapId,
  defaultDecision: "needs_teacher_review",
  privateOrExcludedSoftware: [],
  prioritySoftware: [],
  preferredTeachingStylesBySoftware: {},
  screenshotPolicy: "only_after_log_event_file_delta_or_teacher_marker_is_ambiguous",
  allowedDecisions: ["needs_teacher_review", "ready_for_queue", "ready_for_watch_cycle", "blocked"],
  blockedDecisions: ["accepted", "enable_memory", "native_universal_execution", "continuous_recording"],
  locks
};

const bootstrap = {
  format: "transparent_ai_all_software_observer_bootstrap_v1",
  bootstrapId,
  goal,
  createdAt: new Date().toISOString(),
  mode: bootstrapMode,
  inventoryKit,
  providedInventoryPath: persistedInventoryPath,
  queue: queueResult
    ? {
        queuePath: queueResult.queuePath,
        queuedCount: queueResult.queuedCount,
        topSoftware: queueResult.topSoftware
      }
    : null,
  watchBaseline: watchBaseline
    ? {
        status: watchBaseline.status,
        cyclePath: watchBaseline.watchCyclePath,
        receiptPath: watchBaseline.receiptPath,
        statePath: watchBaseline.statePath,
        scannedItems: watchBaseline.scannedItems,
        changedItems: watchBaseline.changedItems,
        screenshotRequests: watchBaseline.screenshotRequests ?? 0
      }
    : null,
  lowTokenWorkflow: [
    "create rollback point before changing observer direction",
    "collect read-only process/app/log-root/event inventory",
    "teacher excludes private apps and chooses priority software",
    "create bounded per-software observer queue",
    "initialize persisted watch baselines",
    "repeat watch cycle and inspect only changed log/event/file signals",
    "request one bounded screenshot only when cheap signals are ambiguous",
    "compress changed evidence into teacher-reviewable learning events",
    "teach_apprentice drafts disabled memory and waits for approval"
  ],
  nextCommands: {
    collectInventoryProbe: nextProbeCommand,
    createQueueAfterTeacherReview: nextQueueCommand,
    runNextWatchCycle: nextWatchCommand,
    runBoundedSupervisor: nextSupervisorCommand
  },
  nextMcpCalls: [
    "create_software_observer_inventory",
    "create_software_observer_queue",
    "run_all_software_observer_supervisor",
    "run_software_observer_watch_cycle",
    "run_software_observer_queue_item",
    "monitor_software_observation_deltas",
    "compact_universal_observation_learning_events",
    "teach_apprentice"
  ],
  teacherReviewTemplate: exclusionTemplatePath,
  limits: [
    "This bootstrap does not prove every software exposes useful logs.",
    "This bootstrap does not read full logs, capture continuous video, or enable memory.",
    "Queue and watch cycle steps remain teacher-review-only until private apps are excluded.",
    "Native universal app execution is still not proven."
  ],
  locks
};

const receipt = {
  format: "transparent_ai_all_software_observer_bootstrap_receipt_v1",
  bootstrapId,
  status: bootstrapMode,
  readOnlyInventoryKitCreated: true,
  queueCreatedFromProvidedInventory: Boolean(queueResult),
  watchBaselineInitialized: Boolean(watchBaseline),
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true,
  evidence: {
    readme: readmePath,
    bootstrap: bootstrapPath,
    teacherReviewTemplate: exclusionTemplatePath,
    receipt: receiptPath,
    inventoryReadme: inventoryKit.readme,
    inventoryProbe: inventoryKit.readOnlyProbe,
    queuePath: queueResult?.queuePath ?? "",
    watchCyclePath: watchBaseline?.watchCyclePath ?? ""
  },
  locks
};

writeFileSync(exclusionTemplatePath, JSON.stringify(teacherTemplate, null, 2), "utf8");
writeFileSync(bootstrapPath, JSON.stringify(bootstrap, null, 2), "utf8");
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
writeFileSync(readmePath, [
  "# All Software Observer Bootstrap",
  "",
  `Goal: ${goal}`,
  "",
  "This is the one-step, low-token bootstrap for learning from many software surfaces without continuous recording.",
  "",
  "Start here:",
  "",
  "1. Run the read-only inventory probe if no reviewed inventory was supplied.",
  "2. Fill `teacher-exclusion-and-style-template.json` to exclude private software and choose priority apps.",
  "3. Create or review the queue before running watch cycles.",
  "4. Run watch cycles repeatedly; they keep persisted baselines and report only changed signals.",
  "5. Use screenshots only after a meaningful log/event/file delta or teacher marker is not enough.",
  "",
  "Important locks: accepted=false, ruleEnabled=false, packagingGated=true, fullContinuousRecording=false, nativeUniversalExecution=false.",
  "",
  "Next commands:",
  "",
  "```powershell",
  nextProbeCommand,
  nextQueueCommand,
  nextWatchCommand,
  nextSupervisorCommand,
  "```"
].join("\n"), "utf8");

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_all_software_observer_bootstrap_result_v1",
  bootstrapId,
  mode: bootstrapMode,
  bootstrapDir,
  readme: readmePath,
  bootstrapPath,
  teacherReviewTemplate: exclusionTemplatePath,
  receiptPath,
  inventoryKit,
  queuePath: queueResult?.queuePath ?? "",
  watchCyclePath: watchBaseline?.watchCyclePath ?? "",
  watchStatePath: watchBaseline?.statePath ?? "",
  nextCommands: bootstrap.nextCommands,
  nextMcpCalls: bootstrap.nextMcpCalls,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  nativeUniversalExecution: false,
  locks
}, null, 2));
