#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "all-software-reviewed-queue-from-receipt", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 90000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const vectorLog = join(smokeRoot, "vector.log");
writeFileSync(vectorLog, "metadata only fixture\n", "utf8");

const inventoryPath = join(smokeRoot, "software-observer-inventory.json");
writeFileSync(
  inventoryPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_software_observer_inventory_v1",
      source: "smoke_fixture",
      discoveryScope: {
        logContentsRead: false,
        fullContinuousRecording: false,
        nativeUniversalExecution: false
      },
      softwareCandidates: [
        {
          software: "VectorEditor",
          processName: "VectorEditor",
          candidateLogFiles: [{ path: vectorLog, bytes: 22, lowTokenUse: "metadata_first_then_tail_on_trigger" }],
          candidateLogRoots: [smokeRoot],
          windowsEventLogs: ["Application"],
          reason: "approved_non_cad_fixture"
        },
        {
          software: "PrivateMessenger",
          processName: "PrivateMessenger",
          candidateLogFiles: [],
          candidateLogRoots: [],
          windowsEventLogs: ["Application"],
          reason: "private_app_fixture"
        },
        {
          software: "NeedsManualSource",
          processName: "NeedsManualSource",
          candidateLogFiles: [],
          candidateLogRoots: [],
          windowsEventLogs: ["Application"],
          reason: "missing_source_fixture"
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const receiptPath = join(smokeRoot, "teacher-review-receipt.json");
writeFileSync(
  receiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_observer_inventory_review_receipt_v1",
      builderId: "smoke-builder",
      status: "teacher_completed_inventory_review",
      teacherConfirmationText: "teacher confirmed private apps are excluded and read-only observation only",
      teacherConfirmedPrivateAppsExcluded: true,
      teacherConfirmedReadOnlyObservationOnly: true,
      defaultScreenshotPolicy: "only_after_log_event_file_delta_or_teacher_marker_is_ambiguous",
      rows: [
        {
          rowNumber: 1,
          rowId: "vectoreditor",
          software: "VectorEditor",
          decision: "priority_observe",
          teachingStyle: "transparent_overlay_annotations",
          teacherLogSourceHint: "use vector.log metadata before tail",
          teacherNote: "first real low-token queue row",
          approvedForReviewedObservation: true
        },
        {
          rowNumber: 2,
          rowId: "privatemessenger",
          software: "PrivateMessenger",
          decision: "exclude_private_or_out_of_scope",
          teachingStyle: "ask_teacher_when_ambiguous",
          teacherLogSourceHint: "private app",
          teacherNote: "",
          approvedForReviewedObservation: false
        },
        {
          rowNumber: 3,
          rowId: "needsmanualsource",
          software: "NeedsManualSource",
          decision: "needs_teacher_source",
          teachingStyle: "manual_teacher_markers",
          teacherLogSourceHint: "",
          teacherNote: "not queued until source is provided",
          approvedForReviewedObservation: false
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = runNodeScript("create-all-software-observer-reviewed-queue-from-receipt.mjs", [
  "--inventory",
  inventoryPath,
  "--receipt",
  receiptPath,
  "--output-dir",
  join(smokeRoot, "bridge")
]);
const bridge = readJson(result.bridgePath);
const validation = readJson(result.validationPath);
const reviewedInventory = readJson(result.reviewedInventoryPath);
const queue = readJson(result.queuePath);
const readme = readFileSync(result.readmePath, "utf8");

const blockedReceiptPath = join(smokeRoot, "blocked-receipt.json");
writeFileSync(
  blockedReceiptPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_observer_inventory_review_receipt_v1",
      teacherConfirmedPrivateAppsExcluded: false,
      teacherConfirmedReadOnlyObservationOnly: true,
      rows: []
    },
    null,
    2
  )}\n`,
  "utf8"
);
const blocked = runNodeScript("create-all-software-observer-reviewed-queue-from-receipt.mjs", [
  "--inventory",
  inventoryPath,
  "--receipt",
  blockedReceiptPath,
  "--output-dir",
  join(smokeRoot, "blocked-bridge")
]);

const checks = [
  {
    name: "Reviewed queue bridge validates teacher receipt and creates queue for approved rows only",
    pass:
      result.format === "transparent_ai_all_software_observer_reviewed_queue_bridge_result_v1" &&
      bridge.format === "transparent_ai_all_software_observer_reviewed_queue_bridge_v1" &&
      bridge.status === "reviewed_inventory_queue_ready_waiting_for_metadata_delta_watch" &&
      validation.ok === true &&
      reviewedInventory.softwareCandidates.length === 1 &&
      reviewedInventory.softwareCandidates[0].software === "VectorEditor" &&
      queue.queue.length === 1 &&
      queue.queue[0].software === "VectorEditor" &&
      bridge.counts.excludedRows === 1 &&
      bridge.counts.ignoredRows === 1,
    evidence: { result, validation, reviewed: reviewedInventory.teacherReviewedInventory }
  },
  {
    name: "Reviewed queue bridge preserves teaching style and low-token next command",
    pass:
      reviewedInventory.softwareCandidates[0].teacherReview.teachingStyle === "transparent_overlay_annotations" &&
      bridge.nextCommands.watchMetadataDeltas.includes("watch_log_source_metadata_deltas.mjs") &&
      readme.includes("no inventory probe") &&
      readme.includes("no log contents"),
    evidence: bridge.nextCommands
  },
  {
    name: "Reviewed queue bridge keeps side-effect locks closed",
    pass:
      bridge.locks.bridgeDoesNotRunInventoryProbe === true &&
      bridge.locks.bridgeDoesNotReadLogContents === true &&
      bridge.locks.bridgeDoesNotTailLogs === true &&
      bridge.locks.bridgeDoesNotCaptureScreenshots === true &&
      bridge.locks.bridgeDoesNotInitializeWatchBaseline === true &&
      bridge.locks.bridgeDoesNotExecuteTargetSoftware === true &&
      bridge.locks.bridgeDoesNotWriteMemory === true &&
      result.didRunInventoryProbe === false &&
      result.logsRead === false &&
      result.tailLogsRead === false &&
      result.screenshotsCaptured === false &&
      result.softwareActionsExecuted === false &&
      result.memoryWritten === false &&
      result.goalComplete === false,
    evidence: bridge.locks
  },
  {
    name: "Reviewed queue bridge blocks unsafe or incomplete receipts",
    pass:
      blocked.status === "blocked_waiting_for_valid_teacher_inventory_review_receipt" &&
      blocked.didCreateQueue === false &&
      existsSync(blocked.validationPath),
    evidence: blocked
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_all_software_observer_reviewed_queue_from_receipt_smoke_v1",
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
