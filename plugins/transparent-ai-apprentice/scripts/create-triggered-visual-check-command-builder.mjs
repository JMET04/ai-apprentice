#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "triggered-visual-check-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "triggered-visual-check-command-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label) {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  return parsed;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(flag, quote(value));
  }
  return parts.join(" ");
}

function requestPacketKind(packet) {
  if (packet?.format === "transparent_ai_automatic_triggered_visual_check_queue_v1") return "automatic_triggered_visual_check_queue";
  if (packet?.format === "transparent_ai_triggered_visual_check_request_v1") return "triggered_visual_check_request";
  if (!packet) return "queue_not_loaded_yet";
  return "unsupported";
}

function packetRequests(packet) {
  if (Array.isArray(packet?.requests)) return packet.requests;
  return [];
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotRunCapture: true,
    builderDoesNotInvokeCaptureScript: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadScreen: true,
    builderDoesNotOpenGui: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotWriteMemory: true,
    builderDoesNotEnableRules: true,
    captureRequiresSeparateTeacherConfirmedCommand: true,
    maxOneScreenshotPerGeneratedCaptureCommand: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function normalizedRequests(packet) {
  const requests = packetRequests(packet);
  if (!requests.length) {
    return [
      {
        id: "placeholder_visual_check_001",
        number: 1,
        software: "changed software item",
        processName: "",
        source: "placeholder",
        triggerReason: "waiting_for_visual_check_queue",
        status: "waiting_for_queue_path",
        captureInstruction: "Load an automatic-triggered-visual-check queue before generating a capture command.",
        sourcePath: "",
        learningCyclePath: "",
        missingInputs: ["<automatic-triggered-visual-check-queue.json>"]
      }
    ];
  }
  return requests.map((request, index) => ({
    id: request.id || request.requestId || `visual_check_${String(index + 1).padStart(3, "0")}`,
    number: index + 1,
    software: request.software || "changed software item",
    processName: request.processName || "",
    source: request.source || "",
    triggerReason: request.triggerReason || "",
    status: request.captureOnlyAfterReview === false ? "review_needed_before_capture" : "waiting_for_teacher_capture_review",
    captureInstruction: request.captureInstruction || "Capture at most one bounded visual evidence file after teacher review.",
    sourcePath: request.sourcePath || "",
    learningCyclePath: request.learningCyclePath || "",
    missingInputs: []
  }));
}

function writeReadme(path, builder) {
  const lines = [
    "# Triggered Visual Check Command Builder",
    "",
    `Status: ${builder.status}`,
    `Request kind: ${builder.requestKind}`,
    `Queue/request: ${builder.paths.sourceRequest || "<visual-check queue path not loaded yet>"}`,
    "",
    "Use the HTML page to pick exactly one low-token-triggered visual-check request, choose reviewed-source-image or active-screen one-shot mode, and copy the generated capture command.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    "",
    "Safety boundary:",
    "- This builder only creates command text and a browser request JSON.",
    "- It does not run capture-triggered-visual-check.mjs, read the screen, capture screenshots, execute target software, write memory, enable rules, unlock packaging, or claim completion.",
    "- A generated capture command is still a separate teacher-confirmed action and is limited to one bounded visual evidence file."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  const rows = builder.requests
    .map(
      (request) => `<tr>
        <td><input type="radio" name="request" value="${htmlEscape(request.id)}" ${request.number === 1 ? "checked" : ""}></td>
        <td>${htmlEscape(request.number)}</td>
        <td><code>${htmlEscape(request.id)}</code></td>
        <td>${htmlEscape(request.status)}</td>
        <td>${htmlEscape(request.software)}</td>
        <td>${htmlEscape(request.triggerReason)}</td>
        <td>${request.sourcePath ? `<a href="${htmlEscape(fileHref(request.sourcePath))}">${htmlEscape(basename(request.sourcePath))}</a>` : ""}</td>
        <td>${htmlEscape(request.captureInstruction)}</td>
      </tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Triggered Visual Check Command Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1240px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #e7edf5; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef3f9; color: #2d4058; }
    label { display: block; margin: 10px 0; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
    input[type="radio"] { width: 18px; height: 18px; }
    textarea { min-height: 220px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Triggered Visual Check Command Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Request kind:</strong> <code>${htmlEscape(builder.requestKind)}</code></p>
    <p><strong>Queue/request:</strong> ${builder.paths.sourceRequest ? `<a href="${htmlEscape(fileHref(builder.paths.sourceRequest))}">${htmlEscape(builder.paths.sourceRequest)}</a>` : "<code>choose a visual-check queue path when generating this builder</code>"}</p>
    <p class="lock">This page only generates command text. It does not run capture scripts, read the screen, capture screenshots, execute target software, write memory, unlock packaging, or claim completion.</p>
    <section class="panel">
      <label>Visual-check queue/request path
        <input id="requestPath" value="${htmlEscape(builder.paths.sourceRequest || "<automatic-triggered-visual-check-queue.json>")}">
      </label>
      <label>Capture mode
        <select id="captureMode">
          <option value="reviewed-source-image" selected>Use teacher-reviewed image path</option>
          <option value="active-screen">Generate one-shot active-screen capture command</option>
        </select>
      </label>
      <label>Teacher-reviewed image path, used by the default mode
        <input id="reviewedSourceImage" value="<teacher-reviewed-single-screenshot-path.png>">
      </label>
      <label>Observed or target window title
        <input id="targetWindowTitle" value="<teacher-confirmed-target-window-title>">
      </label>
      <label>Teacher note
        <input id="teacherNote" value="teacher confirmed one bounded visual check after low-token change">
      </label>
      <label>Output directory for capture receipt
        <input id="captureOutputDir" value="${htmlEscape(builder.defaultCaptureOutputDir)}">
      </label>
      <label>Output directory for learning handoff
        <input id="handoffOutputDir" value="${htmlEscape(builder.defaultLearningHandoffOutputDir)}">
      </label>
      <label>Teacher voice/text command for optional visual-grounded workbench
        <input id="teacherCommand" value="<teacher voice transcript or typed command>">
      </label>
      <div class="controls">
        <button id="generateCapture">Generate capture command</button>
        <button id="generateHandoff" class="secondary">Generate learning handoff command</button>
        <button id="generateWorkbench" class="secondary">Generate voice-control workbench command</button>
        <button id="copyCommand" class="secondary">Copy command</button>
        <button id="downloadRequest" class="secondary">Download visual check command request JSON</button>
      </div>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
    <table>
      <thead><tr><th>Pick</th><th>#</th><th>Request ID</th><th>Status</th><th>Software</th><th>Trigger</th><th>Source</th><th>Instruction</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const output = document.getElementById("output");
    let lastRequest = null;
    function selectedRequest() {
      const id = document.querySelector('input[name="request"]:checked')?.value || builder.requests[0]?.id || "";
      return builder.requests.find((request) => request.id === id) || builder.requests[0] || {};
    }
    function q(value) {
      return '"' + String(value || "").replaceAll('"', '\\\\"') + '"';
    }
    function commandPartsBase() {
      return {
        request: selectedRequest(),
        requestPath: document.getElementById("requestPath").value.trim(),
        reviewedSourceImage: document.getElementById("reviewedSourceImage").value.trim(),
        targetWindowTitle: document.getElementById("targetWindowTitle").value.trim(),
        teacherNote: document.getElementById("teacherNote").value.trim(),
        captureOutputDir: document.getElementById("captureOutputDir").value.trim(),
        handoffOutputDir: document.getElementById("handoffOutputDir").value.trim(),
        teacherCommand: document.getElementById("teacherCommand").value.trim(),
        captureMode: document.getElementById("captureMode").value
      };
    }
    function show(request) {
      lastRequest = request;
      output.value = request.command + "\\n\\n" + JSON.stringify(request, null, 2);
      return request;
    }
    function makeCaptureCommand() {
      const values = commandPartsBase();
      const parts = [
        "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\capture-triggered-visual-check.mjs",
        "--request", q(values.requestPath),
        "--selected-request-id", q(values.request.id || ""),
        "--teacher-confirmed", q("true"),
        "--target-window-title", q(values.targetWindowTitle),
        "--teacher-note", q(values.teacherNote),
        "--output-dir", q(values.captureOutputDir)
      ];
      if (values.captureMode === "active-screen") {
        parts.push("--capture-active-screen");
      } else {
        parts.push("--reviewed-source-image", q(values.reviewedSourceImage));
      }
      return show({
        format: "transparent_ai_triggered_visual_check_capture_command_request_v1",
        generatedBy: "triggered_visual_check_command_builder",
        selectedRequestId: values.request.id || "",
        captureMode: values.captureMode,
        commandKind: "capture_one_bounded_visual_check",
        command: parts.join(" "),
        locks: builder.locks
      });
    }
    function makeHandoffCommand() {
      const values = commandPartsBase();
      return show({
        format: "transparent_ai_triggered_visual_check_learning_handoff_command_request_v1",
        generatedBy: "triggered_visual_check_command_builder",
        selectedRequestId: values.request.id || "",
        commandKind: "create_learning_handoff_after_capture",
        command: [
          "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\create-triggered-visual-evidence-learning-handoff.mjs",
          "--capture-receipt", q("<triggered-visual-check-capture-receipt.json>"),
          "--request", q(values.requestPath),
          "--screenshot", q("<captured-or-reviewed-single-screenshot-path.png>"),
          "--goal", q("Teach from low-token changed evidence plus one teacher-confirmed visual check before memory or execution."),
          "--output-dir", q(values.handoffOutputDir)
        ].join(" "),
        locks: builder.locks
      });
    }
    function makeWorkbenchCommand() {
      const values = commandPartsBase();
      return show({
        format: "transparent_ai_triggered_visual_check_voice_workbench_command_request_v1",
        generatedBy: "triggered_visual_check_command_builder",
        selectedRequestId: values.request.id || "",
        commandKind: "create_visual_grounded_voice_control_workbench_after_handoff",
        command: [
          "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\create-triggered-visual-evidence-voice-control-workbench.mjs",
          "--handoff", q("<triggered-visual-evidence-learning-handoff.json>"),
          "--software", q(values.request.software || "selected target software"),
          "--command", q(values.teacherCommand),
          "--output-dir", q(builder.defaultVoiceWorkbenchOutputDir)
        ].join(" "),
        locks: builder.locks
      });
    }
    document.getElementById("generateCapture").addEventListener("click", makeCaptureCommand);
    document.getElementById("generateHandoff").addEventListener("click", makeHandoffCommand);
    document.getElementById("generateWorkbench").addEventListener("click", makeWorkbenchCommand);
    document.getElementById("copyCommand").addEventListener("click", async () => {
      const request = lastRequest || makeCaptureCommand();
      if (navigator.clipboard) await navigator.clipboard.writeText(request.command);
    });
    document.getElementById("downloadRequest").addEventListener("click", () => {
      const request = lastRequest || makeCaptureCommand();
      const blob = new Blob([JSON.stringify(request, null, 2) + "\\n"], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "triggered-visual-check-command-request.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
    makeCaptureCommand();
  </script>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", "Build a teacher-facing command page for one low-token-triggered visual check.");
const requestInput = readJsonInput(argValue("--queue", argValue("--request", argValue("--visual-check-queue", ""))), "--queue");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "triggered-visual-check-command-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const requestPacket = requestInput.value;
const requestKind = requestPacketKind(requestPacket);
const requests = normalizedRequests(requestPacket);
const builderPath = join(builderDir, "triggered-visual-check-command-builder.json");
const htmlPath = join(builderDir, "triggered-visual-check-command-builder.html");
const readmePath = join(builderDir, "TRIGGERED_VISUAL_CHECK_COMMAND_BUILDER_START_HERE.md");
const builderLocks = locks();
const defaultCaptureOutputDir = join(builderDir, "triggered-visual-capture");
const defaultLearningHandoffOutputDir = join(builderDir, "triggered-visual-learning-handoff");
const defaultVoiceWorkbenchOutputDir = join(builderDir, "triggered-visual-voice-control-workbench");

const builder = {
  ok: true,
  format: "transparent_ai_triggered_visual_check_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: requestPacket
    ? requests.length > 0 && requestKind !== "unsupported"
      ? "waiting_for_teacher_single_visual_check_command_generation"
      : "blocked_no_supported_visual_check_requests"
    : "waiting_for_teacher_visual_check_queue_path",
  requestKind,
  requestSupported: ["automatic_triggered_visual_check_queue", "triggered_visual_check_request"].includes(requestKind),
  counts: {
    requests: requests.length,
    realRequests: requests.filter((request) => request.source !== "placeholder").length
  },
  requests,
  defaultCaptureOutputDir,
  defaultLearningHandoffOutputDir,
  defaultVoiceWorkbenchOutputDir,
  commandTemplates: {
    captureReviewedSourceImage: commandLine("capture-triggered-visual-check.mjs", [
      ["--request", requestInput.path || "<automatic-triggered-visual-check-queue.json>"],
      ["--selected-request-id", "<teacher-reviewed-visual-check-id>"],
      ["--teacher-confirmed", "true"],
      ["--reviewed-source-image", "<teacher-reviewed-single-screenshot-path.png>"],
      ["--teacher-note", "<teacher-confirmed-one-bounded-visual-check-after-low-token-change>"],
      ["--output-dir", defaultCaptureOutputDir]
    ]),
    captureActiveScreenOnce: [
      commandLine("capture-triggered-visual-check.mjs", [
        ["--request", requestInput.path || "<automatic-triggered-visual-check-queue.json>"],
        ["--selected-request-id", "<teacher-reviewed-visual-check-id>"],
        ["--teacher-confirmed", "true"],
        ["--teacher-note", "<teacher-confirmed-one-bounded-visual-check-after-low-token-change>"],
        ["--output-dir", defaultCaptureOutputDir]
      ]),
      "--capture-active-screen"
    ].join(" "),
    learningHandoffAfterCapture: commandLine("create-triggered-visual-evidence-learning-handoff.mjs", [
      ["--capture-receipt", "<triggered-visual-check-capture-receipt.json>"],
      ["--request", requestInput.path || "<automatic-triggered-visual-check-queue.json>"],
      ["--screenshot", "<captured-or-reviewed-single-screenshot-path.png>"],
      ["--goal", "Teach from low-token changed evidence plus one teacher-confirmed visual check before memory or execution."],
      ["--output-dir", defaultLearningHandoffOutputDir]
    ]),
    voiceWorkbenchAfterHandoff: commandLine("create-triggered-visual-evidence-voice-control-workbench.mjs", [
      ["--handoff", "<triggered-visual-evidence-learning-handoff.json>"],
      ["--software", "<selected target software>"],
      ["--command", "<teacher voice transcript or typed command>"],
      ["--output-dir", defaultVoiceWorkbenchOutputDir]
    ])
  },
  blockedActions: [
    "run_capture_from_command_builder",
    "read_screen_from_command_builder",
    "capture_screenshot_from_command_builder",
    "execute_target_software_from_command_builder",
    "write_memory_from_command_builder",
    "enable_rule_from_command_builder",
    "claim_goal_complete_from_command_builder"
  ],
  locks: builderLocks,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath,
    sourceRequest: requestInput.path
  }
};

writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");
writeReadme(readmePath, builder);
writeHtml(htmlPath, builder);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_triggered_visual_check_command_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      status: builder.status,
      requestKind: builder.requestKind,
      requestCount: builder.counts.requests,
      commandTemplates: builder.commandTemplates,
      locks: builderLocks
    },
    null,
    2
  )
);
