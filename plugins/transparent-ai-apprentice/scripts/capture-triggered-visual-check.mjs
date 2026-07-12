#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return String(value || "triggered-visual-capture")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "triggered-visual-capture";
}

function readJsonInput(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const trimmed = String(value).trim();
  if (existsSync(trimmed)) return { value: JSON.parse(readFileSync(trimmed, "utf8").replace(/^\uFEFF/, "")), path: resolve(trimmed) };
  if (trimmed.startsWith("{")) return { value: JSON.parse(trimmed), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function normalizeRequestPacket(packet) {
  if (packet.format === "transparent_ai_triggered_visual_check_request_v1") {
    return {
      packet,
      packetId: packet.requestId,
      sourceFormat: packet.format,
      sourceKind: "triggered_visual_check_request",
      requests: Array.isArray(packet.requests) ? packet.requests : []
    };
  }
  if (packet.format === "transparent_ai_automatic_triggered_visual_check_queue_v1") {
    return {
      packet,
      packetId: packet.queueId,
      sourceFormat: packet.format,
      sourceKind: "automatic_triggered_visual_check_queue",
      requests: Array.isArray(packet.requests) ? packet.requests : []
    };
  }
  throw new Error(
    "--request must be transparent_ai_triggered_visual_check_request_v1 or transparent_ai_automatic_triggered_visual_check_queue_v1"
  );
}

function selectRequest(requests, selectedRequestId, requestIndex) {
  if (selectedRequestId) {
    return requests.find((request) => request.id === selectedRequestId || request.requestId === selectedRequestId) || null;
  }
  return requests[requestIndex] || null;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeOneShotCaptureScript(scriptPath) {
  writeFileSync(
    scriptPath,
    [
      "param(",
      "  [Parameter(Mandatory=$true)][string]$OutputPath",
      ")",
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      "$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
      "$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height",
      "$graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
      "try {",
      "  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)",
      "  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)",
      "} finally {",
      "  $graphics.Dispose()",
      "  $bitmap.Dispose()",
      "}",
      "[pscustomobject]@{",
      "  ok = $true",
      "  format = 'transparent_ai_one_shot_screen_capture_result_v1'",
      "  outputPath = $OutputPath",
      "  width = $bounds.Width",
      "  height = $bounds.Height",
      "  maxScreenshots = 1",
      "  fullContinuousRecording = $false",
      "  softwareActionsExecuted = $false",
      "} | ConvertTo-Json -Depth 4"
    ].join("\n"),
    "utf8"
  );
}

const requestInput = readJsonInput(argValue("--request", argValue("--triggered-visual-check", "")), "--request");
const requestPacket = requestInput.value;
const normalizedRequest = normalizeRequestPacket(requestPacket);

const requestIndex = Number(argValue("--request-index", "0"));
const selectedRequestId = argValue("--selected-request-id", argValue("--selectedRequestId", ""));
const selectedRequest = selectRequest(normalizedRequest.requests, selectedRequestId, requestIndex);
const teacherConfirmed = hasFlag("--teacher-confirmed") || hasFlag("--teacher-confirmed-capture");
const reviewedSourceImage = argValue("--reviewed-source-image", argValue("--screenshot", ""));
const captureActiveScreen = hasFlag("--capture-active-screen");
const targetWindowTitle = argValue("--target-window-title", argValue("--window-title", selectedRequest?.windowTitle || ""));
const teacherNote = argValue("--teacher-note", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "triggered-visual-captures")));
mkdirSync(outputRoot, { recursive: true });

const captureId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(selectedRequest?.software || requestPacket.requestId)}`;
const captureDir = join(outputRoot, captureId);
mkdirSync(captureDir, { recursive: true });

const receiptPath = join(captureDir, "triggered-visual-check-capture-receipt.json");
const startHerePath = join(captureDir, "TRIGGERED_VISUAL_CAPTURE_START_HERE.md");
const oneShotScriptPath = join(captureDir, "capture-active-screen-once.ps1");

const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false,
  memoryEnabled: false,
  teacherConfirmationRequired: true,
  maxScreenshots: 1
};

let status = "dry_run_no_screenshot_captured";
let screenshotPath = "";
let screenshotSha256 = "";
let captureMode = "dry_run";
let captureError = "";
let screenshotCount = 0;

writeOneShotCaptureScript(oneShotScriptPath);

if (!selectedRequest) {
  status = "blocked_no_visual_check_request";
} else if (!teacherConfirmed) {
  status = "dry_run_no_screenshot_captured";
} else if (reviewedSourceImage) {
  const source = resolve(reviewedSourceImage);
  if (!existsSync(source)) {
    status = "blocked_reviewed_source_image_missing";
    captureError = `Reviewed source image does not exist: ${source}`;
  } else {
    const extension = extname(source) || ".png";
    screenshotPath = join(captureDir, `bounded-triggered-visual-evidence${extension}`);
    copyFileSync(source, screenshotPath);
    screenshotSha256 = sha256(screenshotPath);
    captureMode = "reviewed_source_image_copy";
    screenshotCount = 1;
    status = "captured_one_bounded_visual_evidence";
  }
} else if (captureActiveScreen) {
  screenshotPath = join(captureDir, "bounded-active-screen-capture.png");
  const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", oneShotScriptPath, "-OutputPath", screenshotPath], {
    cwd: captureDir,
    encoding: "utf8",
    timeout: 30000
  });
  if (result.status === 0 && existsSync(screenshotPath)) {
    screenshotSha256 = sha256(screenshotPath);
    captureMode = "active_screen_one_shot";
    screenshotCount = 1;
    status = "captured_one_bounded_visual_evidence";
  } else {
    status = "blocked_active_screen_capture_failed";
    captureError = result.stderr || result.stdout || "Active screen capture failed.";
    screenshotPath = "";
  }
} else {
  status = "blocked_missing_reviewed_visual_source";
  captureError = "Teacher-confirmed capture requires --reviewed-source-image or --capture-active-screen.";
}

const receipt = {
  ok: true,
  format: "transparent_ai_triggered_visual_check_capture_receipt_v1",
  captureId,
  requestId: normalizedRequest.packetId,
  sourceRequestFormat: normalizedRequest.sourceFormat,
  sourceRequestKind: normalizedRequest.sourceKind,
  requestPath: requestInput.path,
  requestIndex,
  selectedRequestId: selectedRequest?.id || selectedRequest?.requestId || selectedRequestId,
  createdAt: new Date().toISOString(),
  status,
  captureMode,
  software: selectedRequest?.software || "",
  processName: selectedRequest?.processName || "",
  requestedWindowTitle: selectedRequest?.windowTitle || "",
  observedWindowTitle: targetWindowTitle,
  triggerReason: selectedRequest?.triggerReason || "",
  triggerEvidence: selectedRequest?.triggerEvidence || null,
  screenshotPath,
  screenshotSha256,
  screenshotCount,
  maxScreenshots: 1,
  captureError,
  teacherNote,
  nextLearningHandoffCommand:
    screenshotCount === 1
      ? [
          "node plugins\\transparent-ai-apprentice\\scripts\\create-triggered-visual-evidence-learning-handoff.mjs",
          `--capture-receipt "${receiptPath}"`,
          requestInput.path ? `--request "${requestInput.path}"` : "",
          `--screenshot "${screenshotPath}"`,
          `--goal "Teach from low-token changed evidence plus one teacher-confirmed visual check for ${selectedRequest?.software || "the selected software"}."`,
          `--output-dir "${join(captureDir, "learning-handoff")}"`
        ].filter(Boolean).join(" ")
      : null,
  oneShotCaptureScript: oneShotScriptPath,
  nextTeachingCallAfterCapture:
    screenshotCount === 1
      ? {
          tool: "teach_apprentice",
          arguments: {
            goal: `Teach from one triggered visual check for ${selectedRequest?.software || "the selected software"}.`,
            message: "Use the triggered visual request and one bounded screenshot evidence; compare with log metadata before learning.",
            file: screenshotPath,
            files: [requestInput.path, receiptPath, screenshotPath].filter(Boolean)
          }
        }
      : null,
  blockedActions: [
    "continuous_recording",
    "capture_more_than_one_screenshot",
    "capture_without_teacher_confirmation",
    "execute_software_actions",
    "enable_memory_or_rules_without_teacher_approval",
    "unlock_packaging"
  ],
  locks: {
    ...locks,
    screenshotsCaptured: screenshotCount === 1
  }
};

writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeFileSync(
  startHerePath,
  [
    "# Triggered Visual Capture",
    "",
    `Status: ${status}`,
    `Capture mode: ${captureMode}`,
    `Screenshot count: ${screenshotCount}`,
    "",
    "Use this receipt only after a low-token trigger and teacher review. The receipt allows at most one bounded visual evidence file and keeps continuous recording, software execution, memory, acceptance, and packaging locked.",
    "",
    screenshotPath ? `Evidence: ${screenshotPath}` : "Evidence: not captured",
    "",
    `Receipt: ${receiptPath}`
  ].join("\n"),
  "utf8"
);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_triggered_visual_check_capture_result_v1",
  captureId,
  sourceRequestFormat: normalizedRequest.sourceFormat,
  sourceRequestKind: normalizedRequest.sourceKind,
  receiptPath,
  teacherReadme: startHerePath,
  oneShotCaptureScript: oneShotScriptPath,
  status,
  captureMode,
  screenshotPath,
  screenshotCount,
  screenshotsCaptured: screenshotCount === 1,
  fullContinuousRecording: false,
  softwareActionsExecuted: false,
  nativeUniversalExecution: false
}, null, 2));
