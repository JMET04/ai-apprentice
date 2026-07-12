#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "all-software-inventory-review-builder", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

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
          software: "TextEditor",
          processName: "TextEditor",
          candidateLogFiles: [{ path: join(smokeRoot, "texteditor.log"), bytes: 10, lowTokenUse: "metadata_first_then_tail_on_trigger" }],
          candidateLogRoots: [smokeRoot],
          windowsEventLogs: ["Application"],
          reason: "running_process_metadata_with_log_source_index"
        },
        {
          software: "PrivateChat",
          processName: "PrivateChat",
          candidateLogFiles: [],
          candidateLogRoots: [],
          windowsEventLogs: ["Application"],
          reason: "installed_application_registry_with_log_source_index"
        }
      ]
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = runNodeScript("create-all-software-observer-inventory-review-builder.mjs", [
  "--inventory",
  inventoryPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(result.builderPath);
const receiptTemplate = readJson(result.receiptTemplatePath);
const html = readFileSync(result.htmlPath, "utf8");

const checks = [
  {
    name: "Inventory review builder writes JSON HTML README and receipt template",
    pass:
      result.format === "transparent_ai_all_software_observer_inventory_review_builder_result_v1" &&
      builder.format === "transparent_ai_all_software_observer_inventory_review_builder_v1" &&
      receiptTemplate.format === "transparent_ai_all_software_observer_inventory_review_receipt_v1" &&
      existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      builder.counts.reviewRows === 2,
    evidence: result
  },
  {
    name: "Inventory review builder exposes decisions teaching styles and reviewed observation command",
    pass:
      html.includes("priority_observe") &&
      html.includes("exclude_private_or_out_of_scope") &&
      html.includes("transparent_overlay_annotations") &&
      html.includes("downloadReceipt") &&
      html.includes("copyReceipt") &&
      html.includes("receiptFileName") &&
      html.includes("searchText") &&
      html.includes("decisionFilter") &&
      html.includes("styleFilter") &&
      html.includes("logFilter") &&
      html.includes("visibleCount") &&
      html.includes("rowMatchesFilters") &&
      html.includes("Mark filtered priority") &&
      builder.nextReviewedObservationCommandTemplate.includes("start-teach-execute-reviewed-observation.mjs") &&
      builder.nextReviewedQueueBridgeCommandTemplate.includes(
        "create-all-software-observer-reviewed-queue-from-receipt.mjs"
      ) &&
      builder.nextReviewedQueueBridgeCommandTemplate.includes(inventoryPath) &&
      receiptTemplate.nextReviewedQueueBridgeCommandTemplate.includes(
        "<teacher-filled-all-software-observer-inventory-review-receipt.json>"
      ) &&
      receiptTemplate.allowedDecisions.includes("needs_teacher_source"),
    evidence: {
      reviewedObservation: builder.nextReviewedObservationCommandTemplate,
      reviewedQueueBridge: builder.nextReviewedQueueBridgeCommandTemplate
    }
  },
  {
    name: "Inventory review builder keeps observation execution and learning locks closed",
    pass:
      builder.locks.builderDoesNotReadLogs === true &&
      builder.locks.builderDoesNotTailLogs === true &&
      builder.locks.builderDoesNotCaptureScreenshots === true &&
      builder.locks.builderDoesNotCreateQueue === true &&
      builder.locks.builderDoesNotInitializeWatchBaseline === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.builderDoesNotWriteMemory === true &&
      builder.goalComplete === false &&
      result.logsRead === false &&
      result.screenshotsCaptured === false &&
      result.queueCreated === false,
    evidence: builder.locks
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_all_software_observer_inventory_review_builder_smoke_v1",
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
