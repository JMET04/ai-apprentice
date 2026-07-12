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
  return (
    String(value || "execution-pilot-batch")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-pilot-batch"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  if (!input) throw new Error(`${label} is required`);
  const text = String(input).trim();
  if (existsSync(text)) return { value: readJson(text), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function parsePerPilot(values) {
  const global = [];
  const byPilot = new Map();
  for (const value of values) {
    const text = String(value || "");
    const separator = text.indexOf("=");
    if (separator > 0) {
      byPilot.set(text.slice(0, separator), text.slice(separator + 1));
    } else if (text) {
      global.push(text);
    }
  }
  return { global, byPilot };
}

function valueForPilot(parsed, pilotId) {
  return parsed.byPilot.get(pilotId) || parsed.global[0] || "";
}

function runNodeScript(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 240000
  });
  if (result.status !== 0) {
    return {
      ok: false,
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    return {
      ok: false,
      exitCode: result.status,
      parseError: error.message,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }
}

function runnerArgsForPilot(pilot, options) {
  const args = ["--queue", options.queuePathOrJson, "--pilot-id", pilot.pilotId];
  if (options.adapterId || pilot.primaryAdapterId) args.push("--adapter-id", options.adapterId || pilot.primaryAdapterId);
  if (options.execute) args.push("--execute");
  if (options.teacherConfirmation) args.push("--teacher-confirmation", options.teacherConfirmation);
  const reviewedCommand = valueForPilot(options.reviewedCommands, pilot.pilotId);
  const reviewedApiRequest = valueForPilot(options.reviewedApiRequests, pilot.pilotId);
  const reviewedMapping = valueForPilot(options.reviewedMappings, pilot.pilotId);
  const reviewedBrowserTarget = valueForPilot(options.reviewedBrowserTargets, pilot.pilotId);
  if (reviewedCommand) args.push("--reviewed-command", reviewedCommand);
  if (reviewedApiRequest) args.push("--reviewed-api-request", reviewedApiRequest);
  if (reviewedMapping) args.push("--reviewed-mapping", reviewedMapping);
  if (reviewedBrowserTarget) args.push("--reviewed-browser-target", reviewedBrowserTarget);
  if (options.targetWindowTitle) args.push("--target-window-title", options.targetWindowTitle);
  if (options.state) args.push("--state", options.state);
  if (options.stateDir) args.push("--state-dir", options.stateDir);
  if (options.maxItems) args.push("--max-items", options.maxItems);
  if (options.maxLogsPerItem) args.push("--max-logs-per-item", options.maxLogsPerItem);
  for (const marker of options.teacherMarkers) args.push("--teacher-marker", marker);
  args.push("--output-dir", join(options.pilotRunsDir, pilot.pilotId));
  return args;
}

const queueInput = readJsonInput(argValue("--queue", argValue("--queue-path", "")), "--queue");
const queue = queueInput.value;
if (queue.format !== "transparent_ai_all_software_execution_pilot_queue_v1") {
  throw new Error("--queue must be transparent_ai_all_software_execution_pilot_queue_v1");
}

const maxPilots = Math.max(1, Number(argValue("--max-pilots", "3")));
const execute = hasFlag("--execute");
const teacherConfirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const adapterId = argValue("--adapter-id", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "all-software-execution-pilot-batches")));
const batchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(queue.goal || "execution-pilot-batch")}`;
const batchDir = join(outputRoot, batchId);
mkdirSync(batchDir, { recursive: true });

const options = {
  queuePathOrJson: queueInput.path || JSON.stringify(queue),
  execute,
  teacherConfirmation,
  adapterId,
  targetWindowTitle: argValue("--target-window-title", ""),
  state: argValue("--state", ""),
  stateDir: argValue("--state-dir", ""),
  maxItems: argValue("--max-items", ""),
  maxLogsPerItem: argValue("--max-logs-per-item", ""),
  teacherMarkers: argValues("--teacher-marker"),
  reviewedCommands: parsePerPilot(argValues("--reviewed-command")),
  reviewedApiRequests: parsePerPilot(argValues("--reviewed-api-request")),
  reviewedMappings: parsePerPilot(argValues("--reviewed-mapping")),
  reviewedBrowserTargets: parsePerPilot(argValues("--reviewed-browser-target")),
  batchDir,
  pilotRunsDir: join(outputRoot, "pilot-runs")
};

const selectedPilots = (queue.pilots || []).slice(0, maxPilots);
const pilotResults = [];
for (const pilot of selectedPilots) {
  const result = runNodeScript("run-all-software-execution-pilot-runner.mjs", runnerArgsForPilot(pilot, options), process.cwd());
  const row = {
    pilotId: pilot.pilotId,
    software: pilot.software,
    adapterId: result.adapterId || adapterId || pilot.primaryAdapterId || "",
    status: result.status || (result.ok === false ? "runner_failed" : "unknown"),
    controlledRouteActionExecuted: Boolean(result.controlledRouteActionExecuted),
    runPath: result.runPath || "",
    receiptPath: result.receiptPath || "",
    adapterReceiptPath: result.adapterReceiptPath || "",
    outcomeVerificationPath: result.outcomeVerificationPath || "",
    postActionCheckpointPath: result.postActionCheckpointPath || "",
    error: result.ok === false ? result.stderr || result.stdout || result.parseError || "runner failed" : ""
  };
  pilotResults.push(row);
}

const counts = {
  queuedPilots: queue.pilots?.length || 0,
  selectedPilots: selectedPilots.length,
  runnerInvocations: pilotResults.length,
  completedControlledRoutes: pilotResults.filter((row) => row.controlledRouteActionExecuted).length,
  dryRuns: pilotResults.filter((row) => row.status === "dry_run_verified_no_route_action").length,
  blockedOrFailed: pilotResults.filter((row) => row.status.startsWith("blocked") || row.status === "runner_failed").length,
  outcomeVerificationCount: pilotResults.filter((row) => row.outcomeVerificationPath).length,
  postActionCheckpointCount: pilotResults.filter((row) => row.postActionCheckpointPath).length
};

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  teacherConfirmationRequired: true,
  dryRunFirst: true
};

const batchPath = join(batchDir, "all-software-execution-pilot-batch.json");
const receiptPath = join(batchDir, "all-software-execution-pilot-batch-receipt.json");
const readmePath = join(batchDir, "ALL_SOFTWARE_EXECUTION_PILOT_BATCH_START_HERE.md");
const batch = {
  ok: true,
  format: "transparent_ai_all_software_execution_pilot_batch_v1",
  batchId,
  createdAt: new Date().toISOString(),
  queuePath: queueInput.path,
  goal: queue.goal || "",
  executeRequested: execute,
  counts,
  pilotResults,
  nextTeacherActions: [
    "Review each pilot receipt independently; do not accept the batch because one pilot succeeded.",
    "For blocked pilots, add reviewed route evidence or exclude the software before the next batch.",
    "For completed controlled routes, verify visible outcome or cheap state evidence before saving memory.",
    "Run another bounded batch only after the teacher confirms this direction is correct."
  ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This batch advances multiple reviewed pilot routes, but each route remains independently teacher-reviewed and the batch does not prove universal native control across every installed app."
  },
  locks
};
const receipt = {
  ok: true,
  format: "transparent_ai_all_software_execution_pilot_batch_receipt_v1",
  batchId,
  status: counts.blockedOrFailed > 0 ? "batch_completed_with_blocked_or_failed_pilots" : "batch_completed_waiting_for_teacher_review",
  batchPath,
  counts,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  locks
};

writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# All-Software Execution Pilot Batch",
    "",
    `Goal: ${batch.goal}`,
    `Selected pilots: ${counts.selectedPilots}`,
    `Completed controlled routes: ${counts.completedControlledRoutes}`,
    `Blocked or failed: ${counts.blockedOrFailed}`,
    "",
    "Review order:",
    ...pilotResults.map((row, index) => `${index + 1}. ${row.pilotId} ${row.software} - ${row.status} - ${row.receiptPath || row.error}`),
    "",
    "Locked boundary: accepted=false, ruleEnabled=false, packagingGated=true, screenshotsCaptured=false, fullContinuousRecording=false, memoryWritten=false, nativeUniversalExecution=false, allSoftwareExecutionComplete=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_all_software_execution_pilot_batch_result_v1",
      status: receipt.status,
      batchId,
      batchDir,
      batchPath,
      receiptPath,
      readmePath,
      counts,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false
    },
    null,
    2
  )
);
