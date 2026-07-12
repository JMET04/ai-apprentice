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
  return (
    String(value || "real-local-execution-readiness")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "real-local-execution-readiness"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNodeScript(scriptName, args, cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 240000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function runPowerShell(args, cwd) {
  return spawnSync("powershell", ["-ExecutionPolicy", "Bypass", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 180000
  });
}

function writeReadme(path, packet) {
  writeFileSync(
    path,
    [
      "# Real-Local All-Software Execution Readiness Batch",
      "",
      `Goal: ${packet.goal}`,
      "",
      "This packet starts from a real local read-only software inventory, maps control-channel coverage, creates reviewed execution pilots, and runs only dry-run pilot batches.",
      "",
      `Inventory candidates: ${packet.counts.inventoryCandidates}`,
      `Coverage rows: ${packet.counts.coverageRows}`,
      `Pilot items: ${packet.counts.pilotItems}`,
      `Selected pilots: ${packet.counts.selectedPilots}`,
      `Dry-run receipts: ${packet.counts.dryRuns}`,
      `Post-action checkpoints: ${packet.counts.postActionCheckpointCount}`,
      "",
      "Review order:",
      "1. Review the real local inventory source before widening scope.",
      "2. Review control-channel coverage rows and excluded/private software.",
      "3. Review each pilot action plan and adapter package.",
      "4. Treat dry-run receipts as readiness only; do not claim real software execution.",
      "5. Execute only after a teacher confirms one target or exact route and a rollback path exists.",
      "",
      "Locked boundary: accepted=false, ruleEnabled=false, packagingGated=true, screenshotsCaptured=false, fullContinuousRecording=false, memoryWritten=false, targetSoftwareCommandsExecuted=false, nativeUniversalExecution=false, allSoftwareExecutionComplete=false."
    ].join("\n") + "\n",
    "utf8"
  );
}

const goal = argValue(
  "--goal",
  argValue(
    "--task",
    "Run a real-local all-software execution readiness batch from inventory to dry-run pilot receipts."
  )
);
const maxProcesses = argValue("--max-processes", "8");
const maxInstalled = argValue("--max-installed", "8");
const maxSoftware = argValue("--max-software", "8");
const maxPilots = argValue("--max-pilots", "3");
const maxLogFilesPerCandidate = argValue("--max-log-files-per-candidate", "1");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "real-local-all-software-execution-readiness-batches"))
);
const innerGoal = "Real-local execution readiness dry run.";

if (hasFlag("--execute")) {
  throw new Error("This real-local readiness batch is dry-run only. Use reviewed pilot runners separately for teacher-confirmed execute mode.");
}

mkdirSync(outputRoot, { recursive: true });
const batchId = `${new Date().toISOString().replace(/[:.]/g, "-")}-real-local-execution-readiness`;
const batchDir = join(outputRoot, batchId);
const workRoot = join(process.cwd(), ".transparent-apprentice", "rl-exec-work", String(Date.now()));
mkdirSync(batchDir, { recursive: true });
mkdirSync(workRoot, { recursive: true });

const inventoryKit = runNodeScript("create-software-observer-inventory.mjs", [
  "--goal",
  innerGoal,
  "--max-processes",
  maxProcesses,
  "--max-installed",
  maxInstalled,
  "--max-log-files-per-candidate",
  maxLogFilesPerCandidate,
  "--output-dir",
  join(workRoot, "inv-kit")
]);

const inventoryPath = join(workRoot, "inventory.json");
const probe = runPowerShell(
  [
    "-File",
    inventoryKit.readOnlyProbe,
    "-OutputPath",
    inventoryPath,
    "-MaxProcesses",
    maxProcesses,
    "-MaxInstalled",
    maxInstalled,
    "-MaxLogFilesPerCandidate",
    maxLogFilesPerCandidate
  ],
  batchDir
);
if (probe.status !== 0 || !existsSync(inventoryPath)) {
  throw new Error(probe.stderr || probe.stdout || "real local inventory probe failed");
}

const coverage = runNodeScript("create-all-software-control-channel-coverage-audit.mjs", [
  "--goal",
  innerGoal,
  "--inventory",
  inventoryPath,
  "--max-software",
  maxSoftware,
  "--create-profiles",
  "--output-dir",
  join(workRoot, "cc")
]);

const pilotQueue = runNodeScript("create-all-software-execution-pilot-queue.mjs", [
  "--goal",
  innerGoal,
  "--coverage-audit",
  coverage.auditPath,
  "--max-pilots",
  maxPilots,
  "--create-adapter-packages",
  "--output-dir",
  join(workRoot, "pq")
]);

const dryRunBatch = runNodeScript("run-all-software-execution-pilot-batch.mjs", [
  "--queue",
  pilotQueue.queuePath,
  "--max-pilots",
  maxPilots,
  "--teacher-marker",
  "real local dry-run readiness only",
  "--output-dir",
  join(workRoot, "pb")
]);

const inventory = readJson(inventoryPath);
const audit = readJson(coverage.auditPath);
const queue = readJson(pilotQueue.queuePath);
const batch = readJson(dryRunBatch.batchPath);
const batchReceipt = readJson(dryRunBatch.receiptPath);
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  memoryWritten: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  teacherConfirmationRequiredBeforeExecute: true,
  dryRunOnly: true
};

const packetPath = join(batchDir, "real-local-all-software-execution-readiness-batch.json");
const receiptPath = join(batchDir, "real-local-all-software-execution-readiness-batch-receipt.json");
const readmePath = join(batchDir, "REAL_LOCAL_ALL_SOFTWARE_EXECUTION_READINESS_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_real_local_all_software_execution_readiness_batch_v1",
  batchId,
  createdAt: new Date().toISOString(),
  goal,
  productIntent:
    "Move from real local software inventory to dry-run execution readiness receipts, without executing target software or claiming universal native control.",
  counts: {
    inventoryCandidates: Array.isArray(inventory.softwareCandidates) ? inventory.softwareCandidates.length : 0,
    coverageRows: audit.counts?.totalRows || audit.rows?.length || 0,
    structuredControlRouteReviewable: audit.counts?.structuredControlRouteReviewable || 0,
    supervisedUiFallbackReviewable: audit.counts?.supervisedUiFallbackReviewable || 0,
    pilotItems: queue.counts?.pilotItems || queue.pilots?.length || 0,
    selectedPilots: batch.counts?.selectedPilots || 0,
    dryRuns: batch.counts?.dryRuns || 0,
    completedControlledRoutes: batch.counts?.completedControlledRoutes || 0,
    blockedOrFailed: batch.counts?.blockedOrFailed || 0,
    outcomeVerificationCount: batch.counts?.outcomeVerificationCount || 0,
    postActionCheckpointCount: batch.counts?.postActionCheckpointCount || 0
  },
  generatedEvidence: {
    inventoryKit: inventoryKit.inventoryPath || "",
    inventoryProbe: inventoryKit.readOnlyProbe || "",
    shortWorkRoot: workRoot,
    realLocalInventory: inventoryPath,
    controlChannelCoverageAudit: coverage.auditPath,
    controlChannelRepairQueue: coverage.repairQueuePath,
    executionPilotQueue: pilotQueue.queuePath,
    executionPilotDryRunBatch: dryRunBatch.batchPath,
    executionPilotDryRunBatchReceipt: dryRunBatch.receiptPath,
    readme: readmePath
  },
  dryRunPilotResults: batch.pilotResults || [],
  nextTeacherActions: [
    "Review coverage rows that are observation-only or missing teacher evidence.",
    "For each dry-run pilot, confirm whether the chosen adapter route is plausible for the real local app.",
    "Add exact reviewed command/API/file/browser/target-window evidence before any execute-mode runner.",
    "Keep using post-action checkpoints and metadata deltas before screenshots or memory."
  ],
  completionBoundary: {
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This proves real local inventory can flow into dry-run execution readiness. It does not prove teacher-confirmed execute mode for every installed application."
  },
  locks
};
const receipt = {
  ok: true,
  format: "transparent_ai_real_local_all_software_execution_readiness_batch_receipt_v1",
  batchId,
  status:
    packet.counts.selectedPilots > 0 && packet.counts.dryRuns === packet.counts.selectedPilots
      ? "real_local_dry_run_readiness_batch_completed"
      : "real_local_readiness_batch_needs_teacher_review",
  packetPath,
  counts: packet.counts,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  targetSoftwareCommandsExecuted: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  locks
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_real_local_all_software_execution_readiness_batch_result_v1",
      status: receipt.status,
      batchId,
      packetPath,
      receiptPath,
      readmePath,
      counts: packet.counts,
      generatedEvidence: packet.generatedEvidence,
      locks
    },
    null,
    2
  )
);
