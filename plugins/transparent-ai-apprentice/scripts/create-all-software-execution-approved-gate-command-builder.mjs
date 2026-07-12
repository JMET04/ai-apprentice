#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "execution-approved-gate-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "execution-approved-gate-command-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
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
    if (value === true) {
      parts.push(flag);
      continue;
    }
    parts.push(flag, quote(value));
  }
  return parts.join(" ");
}

function hasPlaceholder(value) {
  const text = String(value || "");
  return /^<[^>]+>$/.test(text.trim()) || text.includes("<") || text.includes(">") || text.includes("__");
}

function gateArgsAreUsable(args) {
  return Array.isArray(args) && args.length > 0 && args.every((item) => !hasPlaceholder(item));
}

function defaultLocks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotRunApprovedGate: true,
    builderDoesNotInvokeRunner: true,
    builderDoesNotOpenGui: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotSendUiEvents: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotWriteMemory: true,
    generatedCommandRequiresTeacherConfirmation: true,
    generatedCommandRequiresRollback: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    commandsExecutedByBuilder: false,
    softwareActionsExecutedByBuilder: false,
    targetSoftwareCommandsExecutedByBuilder: false,
    uiEventsSentByBuilder: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function summarizeGate(gate, path) {
  if (!gate) {
    return {
      gatePath: "",
      gateStatus: "waiting_for_ready_gate_path",
      readyForExecuteRequest: false,
      generatedRequestTool: "",
      generatedRequestScript: "",
      generatedArgsUsable: false,
      generatedArgsIncludeExecute: false,
      selectedPilotId: "",
      selectedAdapterId: "",
      software: "",
      blockers: ["ready_real_local_execution_approval_gate_required"]
    };
  }
  const generatedRequest = gate.generatedRunnerRequest || {};
  const args = Array.isArray(generatedRequest.args) ? generatedRequest.args : [];
  const summary = {
    gatePath: path,
    gateStatus: gate.status || "",
    readyForExecuteRequest: gate.readyForExecuteRequest === true,
    generatedRequestTool: generatedRequest.tool || "",
    generatedRequestScript: generatedRequest.script || "",
    generatedArgsUsable: gateArgsAreUsable(args),
    generatedArgsIncludeExecute: args.includes("--execute"),
    selectedPilotId: gate.selectedPilotId || gate.pilotId || "",
    selectedAdapterId: gate.selectedAdapterId || gate.adapterId || "",
    software: gate.software || gate.targetSoftware || "",
    blockers: []
  };
  if (gate.status !== "ready_for_teacher_confirmed_execute_runner_request") {
    summary.blockers.push("approval_gate_status_not_ready_for_teacher_confirmed_execute_runner_request");
  }
  if (gate.readyForExecuteRequest !== true) summary.blockers.push("approval_gate_readyForExecuteRequest_not_true");
  if (generatedRequest.tool !== "run_all_software_execution_pilot_runner") {
    summary.blockers.push("approval_gate_generated_request_tool_not_pilot_runner");
  }
  if (generatedRequest.script !== "run-all-software-execution-pilot-runner.mjs") {
    summary.blockers.push("approval_gate_generated_request_script_not_pilot_runner");
  }
  if (!args.includes("--execute")) summary.blockers.push("approval_gate_generated_args_missing_execute");
  if (!gateArgsAreUsable(args)) summary.blockers.push("approval_gate_generated_args_missing_or_placeholder");
  return summary;
}

function writeReadme(path, builder) {
  const lines = [
    "# Execution Approved Gate Command Builder",
    "",
    `Status: ${builder.status}`,
    `Gate: ${builder.paths.sourceGate || "<ready gate path not loaded yet>"}`,
    "",
    "Use the HTML page to review one ready real-local execution approval gate, enter the teacher's final confirmation and retained rollback point, then copy the generated approved-gate runner command.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    "",
    "Safety boundary:",
    "- This builder only creates command text and a run-request JSON in the browser.",
    "- It does not run the approved gate runner, launch software, send UI events, capture screenshots, register tasks, read logs, write memory, accept rules, unlock packaging, or claim completion.",
    "- The generated command remains a separate teacher-approved execution command and must only be used after reviewing the gate, confirmation text, and rollback point."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, builder) {
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Execution Approved Gate Command Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; margin: 14px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    label { display: block; margin: 10px 0; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
    textarea { min-height: 190px; font: 13px Consolas, monospace; }
    button { border: 1px solid #174d89; background: #174d89; color: #fff; border-radius: 6px; min-height: 36px; padding: 0 12px; cursor: pointer; }
    button.secondary { background: #fff; color: #174d89; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; word-break: break-all; }
    a { color: #174d89; word-break: break-all; }
    ul { margin-top: 8px; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .lock { color: #4d5b70; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Execution Approved Gate Command Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Gate:</strong> ${builder.paths.sourceGate ? `<a href="${htmlEscape(fileHref(builder.paths.sourceGate))}">${htmlEscape(builder.paths.sourceGate)}</a>` : "<code>choose a ready gate path when generating this builder</code>"}</p>
    <p class="lock">This page only generates command text. It does not run commands, launch software, send UI events, capture screenshots, register tasks, write memory, unlock packaging, or claim completion.</p>
    <section class="panel">
      <div class="grid">
        <div><strong>Gate status</strong><br><code>${htmlEscape(builder.gate.gateStatus)}</code></div>
        <div><strong>Ready</strong><br><code>${builder.gate.readyForExecuteRequest ? "true" : "false"}</code></div>
        <div><strong>Pilot</strong><br><code>${htmlEscape(builder.gate.selectedPilotId || "unknown")}</code></div>
        <div><strong>Adapter</strong><br><code>${htmlEscape(builder.gate.selectedAdapterId || "unknown")}</code></div>
      </div>
      <p><strong>Blockers:</strong></p>
      <ul>${builder.gate.blockers.map((item) => `<li><code>${htmlEscape(item)}</code></li>`).join("") || "<li>none</li>"}</ul>
    </section>
    <section class="panel">
      <label>Ready approval gate path
        <input id="gatePath" value="${htmlEscape(builder.paths.sourceGate || "<ready-real-local-execution-approval-gate.json>")}">
      </label>
      <label>Teacher final confirmation
        <input id="teacherConfirmation" value="teacher confirmed approved execution gate runner">
      </label>
      <label>Retained rollback point
        <input id="rollbackPoint" value="<retained-rollback-point-path-or-label>">
      </label>
      <label>Output directory
        <input id="outputDir" value="${htmlEscape(builder.commandDefaults.outputDir)}">
      </label>
      <div class="controls">
        <button id="generateCommand">Generate approved-gate command</button>
        <button id="copyCommand" class="secondary">Copy command</button>
        <button id="downloadRequest" class="secondary">Download run request JSON</button>
      </div>
      <textarea id="output" spellcheck="false"></textarea>
    </section>
  </main>
  <script>
    const builder = ${jsonForScript(builder)};
    const output = document.getElementById("output");
    function q(value) { return '"' + String(value || "").replaceAll('"', '\\\\"') + '"'; }
    function makeRequest() {
      const request = {
        format: "transparent_ai_execution_approved_gate_run_request_v1",
        generatedBy: "execution_approved_gate_command_builder",
        gatePath: document.getElementById("gatePath").value.trim(),
        teacherConfirmation: document.getElementById("teacherConfirmation").value.trim(),
        rollbackPointCreated: true,
        rollbackPoint: document.getElementById("rollbackPoint").value.trim(),
        outputDir: document.getElementById("outputDir").value.trim(),
        executeApprovedGate: true,
        locks: builder.locks
      };
      request.command = [
        "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\run-all-software-execution-approved-gate-runner.mjs",
        "--gate", q(request.gatePath),
        "--execute-approved-gate",
        "--teacher-confirmation", q(request.teacherConfirmation),
        "--rollback-point-created",
        "--rollback-point", q(request.rollbackPoint),
        "--output-dir", q(request.outputDir)
      ].join(" ");
      return request;
    }
    function renderCommand() {
      output.value = makeRequest().command;
      return output.value;
    }
    document.getElementById("generateCommand").addEventListener("click", renderCommand);
    document.getElementById("copyCommand").addEventListener("click", async () => {
      await navigator.clipboard.writeText(renderCommand());
    });
    document.getElementById("downloadRequest").addEventListener("click", () => {
      const request = makeRequest();
      const blob = new Blob([JSON.stringify(request, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "execution-approved-gate-run-request.json";
      a.click();
      URL.revokeObjectURL(url);
    });
    renderCommand();
  </script>
</body>
</html>
`,
    "utf8"
  );
}

const goal = argValue("--goal", argValue("--task", "Build a teacher-facing command page for one approved execution gate."));
const gateInput = readJsonInput(
  argValue("--gate", argValue("--approval-gate", "")),
  "--gate",
  "transparent_ai_real_local_execution_approval_gate_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "execution-approved-gate-command-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const htmlPath = join(builderDir, "execution-approved-gate-command-builder.html");
const builderPath = join(builderDir, "execution-approved-gate-command-builder.json");
const readmePath = join(builderDir, "EXECUTION_APPROVED_GATE_COMMAND_BUILDER_START_HERE.md");
const gateSummary = summarizeGate(gateInput.value, gateInput.path);
const status = gateInput.value
  ? gateSummary.blockers.length
    ? "approval_gate_command_builder_waiting_for_ready_gate"
    : "approval_gate_command_builder_ready_for_teacher_final_confirmation"
  : "waiting_for_ready_gate_path";

const builder = {
  ok: true,
  format: "transparent_ai_execution_approved_gate_command_builder_v1",
  builderId,
  goal,
  status,
  gate: gateSummary,
  paths: {
    sourceGate: gateInput.path,
    builder: builderPath,
    html: htmlPath,
    readme: readmePath
  },
  commandDefaults: {
    outputDir: join(outputRoot, "approved-gate-run")
  },
  commandTemplate: commandLine("run-all-software-execution-approved-gate-runner.mjs", [
    ["--gate", gateInput.path || "<ready-real-local-execution-approval-gate.json>"],
    ["--execute-approved-gate", true],
    ["--teacher-confirmation", "<teacher-confirmed-approved-gate-runner-text>"],
    ["--rollback-point-created", true],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"],
    ["--output-dir", join(outputRoot, "approved-gate-run")]
  ]),
  forbiddenBuilderActions: [
    "run_approved_gate_runner_from_builder",
    "execute_target_software_from_builder",
    "send_ui_events_from_builder",
    "capture_screenshot_from_builder",
    "write_memory_from_builder",
    "claim_all_software_execution_complete_from_builder"
  ],
  locks: defaultLocks()
};

writeHtml(htmlPath, builder);
writeReadme(readmePath, builder);
writeFileSync(builderPath, `${JSON.stringify(builder, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_execution_approved_gate_command_builder_result_v1",
      status: builder.status,
      builderId,
      gateStatus: gateSummary.gateStatus,
      paths: builder.paths,
      commandTemplate: builder.commandTemplate,
      locks: builder.locks
    },
    null,
    2
  )
);
