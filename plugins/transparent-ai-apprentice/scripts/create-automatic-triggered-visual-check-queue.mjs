#!/usr/bin/env node
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
  return String(value || "automatic-triggered-visual-check-queue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "automatic-triggered-visual-check-queue";
}

function readJsonInput(value, label, optional = false) {
  if (!value) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function compact(value, max = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function classificationNeedsVisual(classification = "") {
  return /failure|error|blocker|warning|ambiguous|teacher/i.test(String(classification));
}

function cyclePathsFromRunner(runner = {}) {
  return ((runner || {}).runRecords || [])
    .map((record) => record.learningCyclePath)
    .filter(Boolean);
}

function visualRequestsFromCycle(cycle, cyclePath, options) {
  const requests = [];
  for (const watchRun of cycle.watchRuns || []) {
    for (const changedItem of watchRun.changedItems || []) {
      const classifications = changedItem.classifications || [];
      const needsVisual = changedItem.screenshotRecommended === true || classifications.some(classificationNeedsVisual) || options.force;
      if (!needsVisual) continue;
      requests.push({
        id: `automatic-visual-check-${requests.length + 1}`,
        source: "automatic_low_token_learning_runner",
        sourcePath: options.runnerPath || cyclePath,
        learningCyclePath: cyclePath,
        watchCyclePath: watchRun.watchCyclePath || "",
        software: changedItem.software || options.software || "changed software item",
        processName: changedItem.processName || options.processName || "",
        queueItemId: changedItem.queueItemId || "",
        triggerReason: classifications.find(classificationNeedsVisual) || "changed_low_token_signal",
        triggerEvidence: {
          changedLogCount: changedItem.changedLogCount || 0,
          classifications,
          compactLearningEventsInCycle: cycle.counts?.compactLearningEvents || 0,
          screenshotRequestsInCycle: cycle.counts?.screenshotRequests || 0
        },
        captureInstruction:
          "After teacher review, capture at most one bounded screenshot of the target software state; do not start continuous recording.",
        captureOnlyAfterReview: true,
        maxScreenshots: 1,
        nextCaptureCall: {
          tool: "capture_triggered_visual_check",
          arguments: {
            request: "<this automatic-triggered-visual-check-queue.json>",
            selectedRequestId: `automatic-visual-check-${requests.length + 1}`,
            teacherConfirmed: true,
            maxScreenshots: 1
          }
        },
        nextTeachingCallAfterCapture: {
          tool: "teach_apprentice",
          arguments: {
            goal: `Teach from one triggered visual check for ${changedItem.software || options.software || "the changed software item"}.`,
            message: "<paste the single screenshot path plus this queue packet>"
          }
        }
      });
    }
  }

  for (const metadataRun of cycle.metadataGateRuns || []) {
    if ((metadataRun.changedLogMetadata || 0) <= 0) continue;
    if (!options.allowMetadataVisual && !options.force) continue;
    requests.push({
      id: `automatic-visual-check-${requests.length + 1}`,
      source: "automatic_low_token_learning_metadata_gate",
      sourcePath: options.runnerPath || cyclePath,
      learningCyclePath: cyclePath,
      metadataGatePath: metadataRun.gatePath || "",
      software: metadataRun.software || options.software || "metadata-changed software item",
      processName: metadataRun.processName || options.processName || "",
      triggerReason: "metadata_changed_teacher_allowed_visual_check",
      triggerEvidence: {
        changedLogMetadata: metadataRun.changedLogMetadata || 0,
        scannedLogMetadata: metadataRun.scannedLogMetadata || 0,
        tailReadRecommendedFirst: true
      },
      captureInstruction:
        "Prefer the narrowed bounded-tail review first. If still ambiguous and the teacher confirms, capture at most one bounded screenshot.",
      captureOnlyAfterReview: true,
      maxScreenshots: 1
    });
  }

  for (const learningRun of cycle.learningRuns || []) {
    const classifications = learningRun.classifications || [];
    const needsVisual = classifications.some(classificationNeedsVisual) || options.force;
    const alreadyQueued = requests.some((request) => request.queueItemId && request.queueItemId === learningRun.queueItemId);
    if (!needsVisual || alreadyQueued) continue;
    requests.push({
      id: `automatic-visual-check-${requests.length + 1}`,
      source: "automatic_low_token_compact_learning_event",
      sourcePath: options.runnerPath || cyclePath,
      learningCyclePath: cyclePath,
      compactLearningEventsPath: learningRun.compactLearningEventsPath || "",
      observationPath: learningRun.observationPath || "",
      software: learningRun.software || options.software || "changed software item",
      processName: options.processName || "",
      queueItemId: learningRun.queueItemId || "",
      triggerReason: classifications.find(classificationNeedsVisual) || "compact_learning_event_needs_visual_review",
      triggerEvidence: {
        compactEventCount: learningRun.compactEventCount || 0,
        classifications,
        reviewPrompt: learningRun.reviewPrompt || ""
      },
      captureInstruction:
        "A compact learning event was created from the changed signal. If the teacher needs visual grounding, capture at most one bounded screenshot after review.",
      captureOnlyAfterReview: true,
      maxScreenshots: 1,
      nextTeachingCallAfterCapture: {
        tool: "teach_apprentice",
        arguments: {
          goal: `Teach from compact changed evidence plus one visual check for ${learningRun.software || options.software || "the changed software item"}.`,
          message: "<paste the compact learning event path, the single screenshot path, and this queue packet>"
        }
      }
    });
  }

  return requests;
}

const runnerInput = readJsonInput(argValue("--runner", argValue("--runner-journal", "")), "--runner", true);
const cycleInput = readJsonInput(argValue("--learning-cycle", argValue("--cycle", "")), "--learning-cycle", true);
const hasSourceEvidence = Boolean(runnerInput.value || cycleInput.value);

const goal = argValue("--goal", "Create a teacher-reviewed visual-check queue only after automatic low-token learning detects meaningful changes.");
const software = argValue("--software", "");
const processName = argValue("--process-name", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "automatic-triggered-visual-check-queues")));
const maxRequests = Math.max(1, Number(argValue("--max-requests", "5")));
const allowMetadataVisual = hasFlag("--allow-metadata-visual-check");
const force = hasFlag("--force-request");

mkdirSync(outputRoot, { recursive: true });
const queueId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const queueDir = join(outputRoot, queueId);
mkdirSync(queueDir, { recursive: true });

const cyclePaths = [
  ...(cycleInput.path ? [cycleInput.path] : []),
  ...cyclePathsFromRunner(runnerInput.value)
];
const uniqueCyclePaths = [...new Set(cyclePaths)];
const cycles = cycleInput.value && !cycleInput.path
  ? [{ value: cycleInput.value, path: "" }]
  : uniqueCyclePaths.filter((path) => existsSync(path)).map((path) => ({ value: readJsonFile(path), path }));

const options = {
  goal,
  software,
  processName,
  runnerPath: runnerInput.path || "",
  allowMetadataVisual,
  force
};
const requests = cycles.flatMap((entry) => visualRequestsFromCycle(entry.value, entry.path, options)).slice(0, maxRequests);

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeCapture: true,
  maxOneScreenshotPerRequest: true
};

const queuePath = join(queueDir, "automatic-triggered-visual-check-queue.json");
const receiptTemplatePath = join(queueDir, "automatic-triggered-visual-check-receipt-template.json");
const readmePath = join(queueDir, "AUTOMATIC_TRIGGERED_VISUAL_CHECK_QUEUE_START_HERE.md");

const queue = {
  ok: true,
  format: "transparent_ai_automatic_triggered_visual_check_queue_v1",
  queueId,
  createdAt: new Date().toISOString(),
  goal,
  status: !hasSourceEvidence
    ? "blocked_waiting_for_automatic_runner_or_learning_cycle"
    : requests.length > 0
      ? "waiting_for_teacher_visual_check_review"
      : "no_visual_check_needed_from_automatic_low_token_runner",
  lowTokenBridge:
    "Read automatic low-token learning runner/cycle evidence, create visual-check requests only for meaningful changed signals, and leave screenshot capture behind teacher confirmation.",
  sourceEvidence: {
    runnerPath: runnerInput.path || "",
    runnerFormat: runnerInput.value?.format || "",
    learningCyclePath: cycleInput.path || "",
    learningCycleFormat: cycleInput.value?.format || "",
    inspectedCycleCount: cycles.length
  },
  requestCount: requests.length,
  requests,
  skippedReason:
    !hasSourceEvidence
      ? "Provide a transparent_ai_automatic_low_token_learning_runner_v1 journal or transparent_ai_all_software_low_token_learning_cycle_v1 evidence packet first."
      : requests.length > 0
      ? ""
      : "No changed automatic low-token learning item had failure, warning, blocker, ambiguity, teacher marker, screenshot recommendation, or forced visual-check condition.",
  nextAllowedActions: [
    "review_automatic_visual_check_queue",
    "capture_at_most_one_bounded_screenshot_after_teacher_confirmation",
    "teach_from_the_single_screenshot_plus_queue_packet",
    "verify_outcome_or_teacher_marker_before_memory"
  ],
  blockedActions: [
    "continuous_recording",
    "screenshot_without_teacher_confirmation",
    "bulk_screenshot_collection",
    "software_execution",
    "long_term_memory_write",
    "rule_enablement",
    "packaging_unlock"
  ],
  locks
};

const receiptTemplate = {
  format: "transparent_ai_automatic_triggered_visual_check_receipt_template_v1",
  queueId,
  defaultStatus: "not_captured_yet",
  allowedStatuses: ["not_captured_yet", "captured_one_bounded_screenshot", "teacher_declined_visual_check", "blocked_wrong_window"],
  selectedRequestId: "",
  screenshotPath: "",
  observedWindowTitle: "",
  teacherNote: "",
  mustKeep: {
    screenshotsCapturedByThisTool: false,
    fullContinuousRecording: false,
    softwareActionsExecuted: false,
    longTermMemoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
};

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Automatic Triggered Visual Check Queue",
    "",
    "This bridge connects automatic low-token learning to teacher-reviewed visual checks.",
    "",
    `Status: ${queue.status}`,
    `Requests: ${queue.requestCount}`,
    `Inspected cycles: ${queue.sourceEvidence.inspectedCycleCount}`,
    "",
    "Flow:",
    "1. Review automatic-triggered-visual-check-queue.json.",
    "2. Capture at most one bounded screenshot only after teacher confirmation.",
    "3. Teach from the single screenshot plus this queue packet.",
    "4. Verify the outcome before memory, rule enablement, packaging, or further automation.",
    "",
    `Skipped reason: ${compact(queue.skippedReason, 500)}`,
    "",
    "Locked defaults: screenshotsCaptured=false, fullContinuousRecording=false, softwareActionsExecuted=false, longTermMemoryWritten=false, nativeUniversalExecution=false, accepted=false, ruleEnabled=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_automatic_triggered_visual_check_queue_result_v1",
  queueId,
  queuePath,
  receiptTemplatePath,
  teacherReadme: readmePath,
  requestCount: queue.requestCount,
  status: queue.status,
  inspectedCycleCount: queue.sourceEvidence.inspectedCycleCount,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false
}, null, 2));
