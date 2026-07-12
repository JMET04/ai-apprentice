#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "all-software-inventory-batch-review-builder", String(Date.now()));
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const alphaLog = join(smokeRoot, "alpha.log");
const betaLog = join(smokeRoot, "beta.log");
writeFileSync(alphaLog, "alpha\n", "utf8");
writeFileSync(betaLog, "beta\n", "utf8");
const inventoryPath = join(smokeRoot, "software-observer-inventory.json");
writeFileSync(
  inventoryPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_software_observer_inventory_v1",
      discoveryScope: {
        logContentsRead: false,
        fullContinuousRecording: false,
        nativeUniversalExecution: false
      },
      softwareCandidates: [
        {
          software: "AlphaEditor",
          processName: "AlphaEditor",
          candidateLogFiles: [{ path: alphaLog, bytes: 6, lowTokenUse: "metadata_first_then_tail_on_trigger" }],
          candidateLogRoots: [smokeRoot],
          windowsEventLogs: ["Application"],
          confidence: 0.9,
          reason: "high signal editor"
        },
        {
          software: "BetaViewer",
          processName: "BetaViewer",
          candidateLogFiles: [{ path: betaLog, bytes: 5, lowTokenUse: "metadata_first_then_tail_on_trigger" }],
          candidateLogRoots: [smokeRoot],
          windowsEventLogs: ["Application"],
          confidence: 0.6,
          reason: "secondary signal viewer"
        },
        {
          software: "PrivateMessenger",
          processName: "PrivateMessenger",
          candidateLogFiles: [],
          candidateLogRoots: [],
          windowsEventLogs: ["Application"],
          confidence: 0.1,
          reason: "private app candidate"
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = runNodeScript("create-all-software-observer-inventory-batch-review-builder.mjs", [
  "--inventory",
  inventoryPath,
  "--batch-size",
  "2",
  "--output-dir",
  join(smokeRoot, "batch-builder")
]);
const builder = readJson(result.builderPath);
const template = readJson(result.receiptTemplatePath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const receiptPath = join(smokeRoot, "teacher-filled-batch-review-receipt.json");
const receipt = JSON.parse(JSON.stringify(template));
receipt.teacherConfirmationText = "teacher confirmed private exclusions and read-only observation for this batch";
receipt.teacherConfirmedPrivateAppsExcluded = true;
receipt.teacherConfirmedReadOnlyObservationOnly = true;
receipt.rows[0].decision = "priority_observe";
receipt.rows[0].teachingStyle = "silent_work_along_from_deltas";
receipt.rows[0].teacherLogSourceHint = "alpha.log metadata first";
receipt.rows[0].teacherNote = "approved first batch";
receipt.rows[0].approvedForReviewedObservation = true;
receipt.rows[1].decision = "exclude_private_or_out_of_scope";
receipt.rows[1].teacherLogSourceHint = "teacher excluded from first batch";
receipt.rows[1].teacherNote = "not in first reviewed queue";
receipt.rows[1].approvedForReviewedObservation = false;
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

const bridge = runNodeScript("create-all-software-observer-reviewed-queue-from-receipt.mjs", [
  "--inventory",
  inventoryPath,
  "--receipt",
  receiptPath,
  "--output-dir",
  join(smokeRoot, "reviewed-queue-bridge"),
  "--max-candidates",
  "5"
]);
const bridgeJson = readJson(bridge.bridgePath);
const queue = readJson(bridge.queuePath);

const checks = [
  {
    name: "Batch builder writes focused all-software review artifacts",
    pass:
      builder.format === "transparent_ai_all_software_observer_inventory_batch_review_builder_v1" &&
      existsSync(builder.paths.builder) &&
      existsSync(builder.paths.html) &&
      existsSync(builder.paths.receiptTemplate) &&
      builder.counts.inventoryCandidates === 3 &&
      builder.counts.reviewRows === 2 &&
      template.rows.length === 2,
    evidence: builder.paths
  },
  {
    name: "Batch receipt uses existing inventory review receipt format",
    pass:
      template.format === "transparent_ai_all_software_observer_inventory_review_receipt_v1" &&
      template.batchOnly === true &&
      template.rows.every((row) => row.decision === "needs_teacher_source") &&
      template.nextReviewedQueueBridgeCommandTemplate.includes("create-all-software-observer-reviewed-queue-from-receipt.mjs"),
    evidence: template
  },
  {
    name: "Existing reviewed-queue bridge accepts subset receipt and queues only approved rows",
    pass:
      bridge.status === "reviewed_inventory_queue_ready_waiting_for_metadata_delta_watch" &&
      bridge.counts.approvedRows === 1 &&
      bridge.counts.excludedRows === 1 &&
      bridge.counts.queuedCount === 1 &&
      bridgeJson.counts.ignoredRows >= 1 &&
      queue.queue?.length === 1,
    evidence: { bridge, bridgeCounts: bridgeJson.counts, queueItems: queue.queue?.length }
  },
  {
    name: "HTML README and locks preserve review-only low-token boundary",
    pass:
      html.includes("All Software Inventory Batch Review Builder") &&
      html.includes("Review only") &&
      readme.includes("small high-signal batch") &&
      builder.locks.builderDoesNotReadLogs === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.locks.goalComplete === false,
    evidence: { htmlPath: result.htmlPath, readmePath: result.readmePath, locks: builder.locks }
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

rmSync(smokeRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_all_software_observer_inventory_batch_review_builder_smoke_v1",
      checks,
      tempCleaned: true
    },
    null,
    2
  )
);
