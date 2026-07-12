#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
  return String(value || "triggered-visual-check")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "triggered-visual-check";
}

function readJsonInput(value, label, optional = false) {
  if (!value) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function compact(value, max = 240) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function highValueDeltaClass(classification = "") {
  return ["failure_or_blocker", "warning", "ambiguous_or_teacher_marker", "teacher_marker_on_metadata_change"].includes(classification);
}

function requestFromMonitor(monitor, monitorPath, options) {
  const policy = monitor?.screenshotPolicy || {};
  const changed = [
    ...(monitor?.delta?.changedLogs || []),
    ...(monitor?.delta?.addedLogs || [])
  ];
  const trigger = changed.find((entry) => highValueDeltaClass(entry.classification)) || changed[0] || null;
  if (!policy.screenshotRecommended && !options.force) return null;
  return {
    id: "visual-check-1",
    source: "software_observation_delta_monitor",
    sourcePath: monitorPath,
    software: monitor?.software || options.software || "selected software",
    processName: monitor?.processName || options.processName || "",
    windowTitle: options.windowTitle || monitor?.windowTitle || "",
    triggerReason: policy.reason || trigger?.classification || "teacher_requested_visual_check",
    triggerEvidence: {
      changedLogCount: monitor?.counts?.changedLogs ?? 0,
      addedLogCount: monitor?.counts?.addedLogs ?? 0,
      removedLogCount: monitor?.counts?.removedLogs ?? 0,
      triggerPath: trigger?.path || "",
      triggerClassification: trigger?.classification || "",
      retainedSnippet: compact(trigger?.current?.retainedSnippet || trigger?.current?.snippet || "")
    },
    captureInstruction:
      "After teacher review, capture exactly one bounded screenshot of the visible target window or active software area, then paste the screenshot path back with this request packet.",
    captureOnlyAfterReview: true,
    maxScreenshots: 1,
    nextTeachingCallAfterScreenshot: {
      tool: "teach_apprentice",
      arguments: {
        goal: `Teach from triggered visual evidence for ${monitor?.software || options.software || "the selected software"}.`,
        message: "<paste screenshot path plus this triggered visual check request>",
        file: "<single screenshot path>"
      }
    }
  };
}

function requestsFromMetadataGate(gate, gatePath, options) {
  const itemResults = gate?.itemResults || [];
  const changedItems = itemResults.filter((item) => (item.changedLogMetadataCount || 0) > 0);
  const markerRequested = options.teacherMarkers.some((marker) => /screenshot|screen|visual|看屏幕|看画面|截图|截屏/iu.test(marker));
  const requests = [];
  if ((options.allowMetadataScreenshot || options.force || markerRequested) && changedItems.length > 0) {
    for (const item of changedItems.slice(0, options.maxRequests)) {
      const triggerDelta = (item.deltas || []).find((delta) => delta.status === "metadata_changed" || delta.status === "new_log_seen") || null;
      requests.push({
        id: `visual-check-${requests.length + 1}`,
        source: "log_source_metadata_delta_gate",
        sourcePath: gatePath,
        software: item.software || options.software || "selected software",
        processName: item.processName || options.processName || "",
        windowTitle: options.windowTitle || "",
        triggerReason: markerRequested ? "teacher_marker_requested_visual_check_after_metadata_delta" : "metadata_delta_visual_check_requested",
        triggerEvidence: {
          changedLogMetadataCount: item.changedLogMetadataCount || 0,
          triggerPath: triggerDelta?.path || "",
          triggerClassification: triggerDelta?.classification || "",
          tailReadRecommendedFirst: true
        },
        captureInstruction:
          "Run the narrowed bounded-tail review first when possible. If the changed metadata is still ambiguous, capture exactly one bounded screenshot after teacher review.",
        captureOnlyAfterReview: true,
        maxScreenshots: 1,
        nextTailReadCall: gate.nextTailReadCall || null
      });
    }
  }
  return requests;
}

const metadataGateInput = readJsonInput(argValue("--metadata-gate", argValue("--metadata-delta", "")), "--metadata-gate", true);
const monitorInput = readJsonInput(argValue("--delta-monitor", argValue("--monitor", "")), "--delta-monitor", true);
if (!metadataGateInput.value && !monitorInput.value) throw new Error("Provide --metadata-gate or --delta-monitor");

const goal = argValue("--goal", "Request one visual check only after a meaningful low-token software signal changes.");
const software = argValue("--software", "");
const processName = argValue("--process-name", "");
const windowTitle = argValue("--window-title", argValue("--target-window-title", ""));
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "triggered-visual-check-requests")));
const teacherMarkers = argValues("--teacher-marker");
const maxRequests = Number(argValue("--max-requests", "3"));
const allowMetadataScreenshot = hasFlag("--allow-metadata-screenshot-request");
const force = hasFlag("--force-request");

mkdirSync(outputRoot, { recursive: true });
const requestId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(software || windowTitle || "triggered-visual-check")}`;
const requestDir = join(outputRoot, requestId);
mkdirSync(requestDir, { recursive: true });

const options = { goal, software, processName, windowTitle, teacherMarkers, maxRequests, allowMetadataScreenshot, force };
const requests = [];
const monitorRequest = requestFromMonitor(monitorInput.value, monitorInput.path, options);
if (monitorRequest) requests.push(monitorRequest);
if (metadataGateInput.value) requests.push(...requestsFromMetadataGate(metadataGateInput.value, metadataGateInput.path, options));
const limitedRequests = requests.slice(0, maxRequests);

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  rawFullLogsRetained: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequired: true
};

const packetPath = join(requestDir, "triggered-visual-check-request.json");
const receiptTemplatePath = join(requestDir, "triggered-visual-check-receipt-template.json");
const readmePath = join(requestDir, "TRIGGERED_VISUAL_CHECK_START_HERE.md");

const packet = {
  ok: true,
  format: "transparent_ai_triggered_visual_check_request_v1",
  requestId,
  createdAt: new Date().toISOString(),
  goal,
  lowTokenPolicy:
    "Use log metadata and bounded observation deltas first. Request at most one screenshot per changed item only after teacher review; never stream continuous recording.",
  sourceEvidence: {
    metadataGatePath: metadataGateInput.path || "",
    metadataGateFormat: metadataGateInput.value?.format || "",
    deltaMonitorPath: monitorInput.path || "",
    deltaMonitorFormat: monitorInput.value?.format || ""
  },
  requestCount: limitedRequests.length,
  status: limitedRequests.length > 0 ? "waiting_for_teacher_visual_check_review" : "no_visual_check_needed_from_current_low_token_evidence",
  requests: limitedRequests,
  skippedReason:
    limitedRequests.length > 0
      ? ""
      : metadataGateInput.value && !monitorInput.value
        ? "Metadata changed or initialized evidence should normally run bounded-tail or delta-monitor review before screenshot unless the teacher explicitly asks for a visual check."
        : "No failure, warning, ambiguous marker, teacher marker, or forced visual-check condition was found.",
  nextAllowedActions: [
    "review_request_packet",
    "optionally_capture_one_bounded_screenshot_after_teacher_confirmation",
    "paste_screenshot_path_and_request_packet_into_teach_apprentice",
    "verify_with_log_metadata_or_teacher_marker_before_learning"
  ],
  blockedActions: [
    "continuous_recording",
    "capture_screenshot_without_teacher_review",
    "capture_multiple_screenshots_by_default",
    "execute_software_actions",
    "enable_memory_or_rules_without_teacher_approval",
    "unlock_packaging"
  ],
  locks
};

const receiptTemplate = {
  format: "transparent_ai_triggered_visual_check_receipt_template_v1",
  requestId,
  defaultStatus: "not_captured_yet",
  allowedStatuses: ["not_captured_yet", "captured_one_bounded_screenshot", "teacher_declined_visual_check", "blocked_wrong_window"],
  screenshotPath: "",
  observedWindowTitle: "",
  teacherNote: "",
  mustKeep: {
    screenshotsCapturedByThisTool: false,
    fullContinuousRecording: false,
    softwareActionsExecuted: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
};

writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeFileSync(receiptTemplatePath, `${JSON.stringify(receiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# Triggered Visual Check",
    "",
    "Use this when cheap software evidence changed and the teacher needs one visual check.",
    "",
    `Status: ${packet.status}`,
    `Requests: ${packet.requestCount}`,
    "",
    "Flow:",
    "1. Review the low-token evidence path in triggered-visual-check-request.json.",
    "2. Capture at most one bounded screenshot only if the teacher agrees.",
    "3. Fill triggered-visual-check-receipt-template.json with the screenshot path or decline reason.",
    "4. Paste the screenshot path plus this request packet into teach_apprentice.",
    "",
    "Locked defaults: screenshotsCaptured=false, fullContinuousRecording=false, softwareActionsExecuted=false, nativeUniversalExecution=false, accepted=false, ruleEnabled=false, packagingGated=true."
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_triggered_visual_check_request_result_v1",
  requestId,
  packetPath,
  receiptTemplatePath,
  teacherReadme: readmePath,
  requestCount: packet.requestCount,
  status: packet.status,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false
}, null, 2));
