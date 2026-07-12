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

function slugify(value) {
  return (
    String(value || "triggered-visual-transparent-overlay-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "triggered-visual-transparent-overlay-handoff"
  );
}

function readJsonInput(value, label, optional = false) {
  const text = String(value || "").trim();
  if (!text) {
    if (optional) return { value: null, path: "" };
    throw new Error(`${label} is required`);
  }
  if (existsSync(text)) return { value: JSON.parse(readFileSync(resolve(text), "utf8").replace(/^\uFEFF/, "")), path: resolve(text) };
  if (text.startsWith("{")) return { value: JSON.parse(text), path: "" };
  throw new Error(`${label} must be a JSON path or JSON object string`);
}

function runScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function commandLine(scriptName, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${scriptName}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) {
      parts.push(flag);
      continue;
    }
    parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function normalizeVisualQueue(packet) {
  if (packet?.format === "transparent_ai_automatic_triggered_visual_check_queue_v1") {
    return {
      id: packet.queueId || "",
      format: packet.format,
      requests: Array.isArray(packet.requests) ? packet.requests : []
    };
  }
  if (packet?.format === "transparent_ai_triggered_visual_check_request_v1") {
    return {
      id: packet.requestId || "",
      format: packet.format,
      requests: Array.isArray(packet.requests) ? packet.requests : []
    };
  }
  throw new Error("--visual-check-queue must be a triggered visual request or automatic triggered visual check queue");
}

function selectRequest(requests, selectedRequestId, requestIndex) {
  if (selectedRequestId) {
    return requests.find((request) => request.id === selectedRequestId || request.requestId === selectedRequestId) || null;
  }
  return requests[requestIndex] || null;
}

function writeReadme(path, packet) {
  writeFileSync(
    path,
    [
      "# Triggered Visual Transparent Overlay Handoff",
      "",
      `Status: ${packet.status}`,
      `Software: ${packet.software}`,
      `Selected request: ${packet.selectedRequestId || "none"}`,
      "",
      "This packet connects a low-token trigger to teacher overlay drawing, spatial intent interpretation, numbered target confirmation, and later execution gates.",
      "",
      "Open in order:",
      `1. Overlay kit: ${packet.paths.overlayHtml}`,
      `2. Dry-run capture receipt: ${packet.paths.dryRunCaptureReceipt}`,
      `3. Handoff JSON: ${packet.paths.handoff}`,
      "",
      "Teacher commands:",
      "",
      "```powershell",
      packet.commandTemplates.teacherConfirmedReviewedImageCapture,
      packet.commandTemplates.teacherConfirmedOneShotScreenCapture,
      packet.commandTemplates.interpretTeacherOverlayPacket,
      packet.commandTemplates.createSpatialTargetConfirmation,
      packet.commandTemplates.createSpatialSoftwareExecutionGate,
      "```",
      "",
      "The default handoff does not capture screenshots, execute software, read full logs, write memory, enable rules, unlock packaging, or claim completion."
    ].join("\n"),
    "utf8"
  );
}

function writeHtml(path, packet) {
  const commandRows = Object.entries(packet.commandTemplates)
    .map(([name, command]) => `<tr><td>${name}</td><td><code>${String(command).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></td></tr>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Triggered Visual Transparent Overlay Handoff</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Arial, sans-serif; color: #18212f; background: #f5f7fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; margin-top: 14px; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: 0; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border-bottom: 1px solid #e6ebf2; padding: 8px; text-align: left; vertical-align: top; }
    code { word-break: break-all; background: #eef2f7; padding: 2px 4px; border-radius: 4px; }
    .lock { color: #8a4a00; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <h1>Triggered Visual Transparent Overlay Handoff</h1>
    <section>
      <p>Status: <code>${packet.status}</code></p>
      <p>Software: <code>${packet.software}</code></p>
      <p class="lock">Review-only: no screenshot capture, no software execution, no memory write, no rule enablement.</p>
    </section>
    <section>
      <h2>Selected Trigger</h2>
      <p>${String(packet.selectedRequestSummary).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
    </section>
    <section>
      <h2>Teacher Commands</h2>
      <table><thead><tr><th>Name</th><th>Command</th></tr></thead><tbody>${commandRows}</tbody></table>
    </section>
  </main>
</body>
</html>
`,
    "utf8"
  );
}

const visualInput = readJsonInput(
  argValue("--visual-check-queue", argValue("--request", "")),
  "--visual-check-queue"
);
const eventPolicyInput = readJsonInput(argValue("--event-policy", ""), "--event-policy", true);
const readinessInput = readJsonInput(argValue("--readiness-package", ""), "--readiness-package", true);
const requestIndex = Number(argValue("--request-index", "0"));
const selectedRequestId = argValue("--selected-request-id", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "triggered-visual-transparent-overlay-handoffs")));

const normalized = normalizeVisualQueue(visualInput.value);
const selectedRequest = selectRequest(normalized.requests, selectedRequestId, requestIndex);
const software = argValue("--software", selectedRequest?.software || "target software");
const goal = argValue(
  "--goal",
  `Let the teacher draw transparent overlay intent for ${software} after a low-token visual trigger.`
);
const teacherCommand = argValue(
  "--teacher-command",
  "Use teacher voice or text to describe the intended change, then mark numbered possible targets before any execution."
);

mkdirSync(outputRoot, { recursive: true });
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const handoffDir = join(outputRoot, handoffId);
mkdirSync(handoffDir, { recursive: true });

const overlay = runScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--mode",
  "2d_3d",
  "--output-dir",
  join(handoffDir, "transparent-overlay-kit")
]);
const dryRunCapture = runScript("capture-triggered-visual-check.mjs", [
  "--request",
  visualInput.path,
  "--request-index",
  String(requestIndex),
  "--selected-request-id",
  selectedRequestId,
  "--target-window-title",
  selectedRequest?.windowTitle || selectedRequest?.requestedWindowTitle || "",
  "--teacher-note",
  "dry-run only: teacher confirmation is required before any screenshot",
  "--output-dir",
  join(handoffDir, "dry-run-triggered-visual-capture")
]);

const selectedRequestSummary = selectedRequest
  ? `${selectedRequest.software || software}: ${selectedRequest.triggerReason || "visual trigger"}; compact evidence path=${selectedRequest.compactLearningEventsPath || selectedRequest.learningCyclePath || selectedRequest.sourcePath || ""}`
  : "No selected request was available; teacher must provide or regenerate a visual check queue.";

const handoffPath = join(handoffDir, "triggered-visual-transparent-overlay-handoff.json");
const htmlPath = join(handoffDir, "triggered-visual-transparent-overlay-handoff.html");
const readmePath = join(handoffDir, "TRIGGERED_VISUAL_TRANSPARENT_OVERLAY_HANDOFF_START_HERE.md");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  handoffDoesNotCaptureScreenshots: true,
  handoffDoesNotExecuteSoftware: true,
  handoffDoesNotReadFullLogs: true,
  handoffDoesNotWriteMemory: true,
  handoffDoesNotEnableRules: true,
  fullContinuousRecording: false,
  screenshotsCaptured: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  longTermMemoryWritten: false,
  nativeUniversalExecution: false,
  teacherConfirmationRequiredBeforeCapture: true,
  teacherConfirmationRequiredBeforeExecution: true,
  teacherExportedOverlayPacketRequired: true,
  numberedTargetConfirmationRequired: true
};
const commandTemplates = {
  teacherConfirmedReviewedImageCapture: commandLine("capture-triggered-visual-check.mjs", [
    ["--request", visualInput.path],
    ["--selected-request-id", selectedRequest?.id || selectedRequest?.requestId || "<selected-request-id>"],
    ["--teacher-confirmed", true],
    ["--reviewed-source-image", "<teacher-reviewed-source-image.png>"],
    ["--output-dir", join(handoffDir, "teacher-confirmed-triggered-visual-capture")]
  ]),
  teacherConfirmedOneShotScreenCapture: commandLine("capture-triggered-visual-check.mjs", [
    ["--request", visualInput.path],
    ["--selected-request-id", selectedRequest?.id || selectedRequest?.requestId || "<selected-request-id>"],
    ["--teacher-confirmed", true],
    ["--capture-active-screen", true],
    ["--output-dir", join(handoffDir, "teacher-confirmed-one-shot-screen-capture")]
  ]),
  interpretTeacherOverlayPacket: commandLine("interpret-transparent-sketch-spatial-intent.mjs", [
    ["--goal", goal],
    ["--software", software],
    ["--overlay-packet", "<teacher-exported-transparent-sketch-packet.json>"],
    ["--output-dir", join(handoffDir, "teacher-overlay-spatial-intent")]
  ]),
  createSpatialTargetConfirmation: commandLine("create-spatial-target-confirmation-kit.mjs", [
    ["--spatial-intent", "<teacher-reviewed-spatial-intent-interpretation.json>"],
    ["--teacher-command", teacherCommand],
    ["--output-dir", join(handoffDir, "spatial-target-confirmation")]
  ]),
  createSpatialSoftwareExecutionGate: commandLine("create-spatial-to-software-execution-gate-package.mjs", [
    ["--goal", goal],
    ["--spatial-entrypoint", "<spatial-intent-formal-evidence-entrypoint.json>"],
    ["--spatial-intent-receipt", "<teacher-filled-spatial-intent-evidence-receipt.json>"],
    ["--depth-rehearsal", "<teacher-reviewed-transparent-sketch-depth-rehearsal.json>"],
    ["--target-confirmation", "<teacher-confirmed-numbered-target.json>"],
    ["--route-bridge", "<spatial-software-execution-route-bridge.json>"],
    ["--output-dir", join(handoffDir, "spatial-to-software-execution-gate")]
  ])
};
const handoff = {
  ok: true,
  format: "transparent_ai_triggered_visual_transparent_overlay_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  status: selectedRequest
    ? "waiting_for_teacher_transparent_overlay_capture_or_export"
    : "blocked_no_triggered_visual_request_selected",
  goal,
  software,
  teacherCommand,
  selectedRequestId: selectedRequest?.id || selectedRequest?.requestId || "",
  selectedRequestSummary,
  sourceEvidence: {
    visualCheckQueuePath: visualInput.path,
    visualCheckQueueFormat: normalized.format,
    eventPolicyPath: eventPolicyInput.path,
    eventPolicyStatus: eventPolicyInput.value?.status || "",
    readinessPackagePath: readinessInput.path,
    readinessPackageStatus: readinessInput.value?.status || ""
  },
  existingAbilitiesReused: [
    "create-transparent-sketch-overlay-kit.mjs",
    "capture-triggered-visual-check.mjs",
    "interpret-transparent-sketch-spatial-intent.mjs",
    "create-spatial-target-confirmation-kit.mjs",
    "create-spatial-to-software-execution-gate-package.mjs"
  ],
  teacherReviewOrder: [
    "Review the low-token trigger and decide whether visual grounding is actually needed.",
    "Open the transparent overlay and draw only the intent needed for this request.",
    "Export a transparent_ai_sketch_overlay_packet_v1 packet or provide one teacher-reviewed source image.",
    "Interpret the packet into 2D position, angle, perspective, and 3D depth logic.",
    "Confirm exactly one numbered target or correct the candidate list.",
    "Only after a retained rollback point and successful execution gate may a separate runner execute software."
  ],
  commandTemplates,
  blockedActions: [
    "continuous_recording",
    "screenshot_without_teacher_confirmation",
    "execute_from_overlay_without_numbered_target_confirmation",
    "execute_target_software_from_this_handoff",
    "write_memory_from_this_handoff",
    "enable_rules_from_this_handoff",
    "claim_goal_complete_from_this_handoff"
  ],
  paths: {
    handoff: handoffPath,
    html: htmlPath,
    readme: readmePath,
    overlayManifest: overlay.kitPath || overlay.manifestPath || overlay.manifest || "",
    overlayHtml: overlay.browserOverlay || overlay.browserOverlayPath || overlay.html || "",
    overlayReadme: overlay.teacherReadme || overlay.readmePath || overlay.readme || "",
    sampleOverlayPacket: overlay.samplePacket || overlay.samplePacketPath || "",
    dryRunCaptureReceipt: dryRunCapture.receiptPath || ""
  },
  locks
};

writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
writeReadme(readmePath, handoff);
writeHtml(htmlPath, handoff);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_triggered_visual_transparent_overlay_handoff_result_v1",
      handoffId,
      status: handoff.status,
      handoffPath,
      htmlPath,
      readmePath,
      overlayHtml: handoff.paths.overlayHtml,
      dryRunCaptureReceipt: handoff.paths.dryRunCaptureReceipt,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      memoryWritten: false,
      ruleEnabled: false,
      packagingGated: true
    },
    null,
    2
  )
);
