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
    String(value || "operational-registration-approved-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "operational-registration-approved-command-builder"
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

function defaultLocks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    builderDoesNotRunRegistration: true,
    builderDoesNotInvokeRunner: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotStartScheduledTask: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotWriteMemory: true,
    generatedCommandRequiresTeacherRegistrationConfirmation: true,
    generatedCommandRequiresRollback: true,
    generatedCommandRequiresAllowSystemChange: true,
    generatedCommandRequiresExecuteApprovedRegistration: true,
    scheduledTaskRegistered: false,
    scheduledTaskStarted: false,
    runnerLaunched: false,
    commandsExecutedByBuilder: false,
    systemChangePerformedByBuilder: false,
    targetSoftwareCommandsExecutedByBuilder: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareUnattendedCoverageProven: false,
    goalComplete: false
  };
}

function summarizeGate(gate, path) {
  if (!gate) {
    return {
      gatePath: "",
      gateStatus: "waiting_for_ready_registration_execute_gate_path",
      readyForTeacherRegistrationExecuteReview: false,
      preparedButNotExecuted: false,
      sourceRegistrationRunner: "",
      sourceApprovalGate: "",
      operationalScope: null,
      blockers: ["ready_operational_registration_execute_gate_required"]
    };
  }
  const sourceRegistrationRunner = gate.paths?.sourceRegistrationRunner || "";
  const summary = {
    gatePath: path,
    gateStatus: gate.status || "",
    readyForTeacherRegistrationExecuteReview: gate.readyForTeacherRegistrationExecuteReview === true,
    preparedButNotExecuted: gate.executeRequest?.preparedButNotExecuted === true,
    sourceRegistrationRunner,
    sourceApprovalGate: "",
    operationalScope: gate.operationalScope || null,
    blockers: []
  };
  if (sourceRegistrationRunner && existsSync(sourceRegistrationRunner)) {
    try {
      const sourceRunner = readJson(sourceRegistrationRunner);
      summary.sourceApprovalGate = sourceRunner.sourceApprovalGatePath || "";
    } catch {
      summary.blockers.push("source_registration_runner_unreadable");
    }
  }
  if (gate.status !== "ready_for_teacher_registration_execute_review") {
    summary.blockers.push("registration_execute_gate_status_not_ready_for_teacher_review");
  }
  if (gate.readyForTeacherRegistrationExecuteReview !== true) {
    summary.blockers.push("registration_execute_gate_ready_flag_missing");
  }
  if (gate.executeRequest?.preparedButNotExecuted !== true) {
    summary.blockers.push("registration_execute_gate_missing_prepared_execute_request");
  }
  if (gate.locks?.executeRequestExecuted !== false) summary.blockers.push("registration_execute_gate_already_executed");
  if (gate.locks?.scheduledTaskRegistered !== false) summary.blockers.push("registration_execute_gate_claims_task_registered");
  if (Array.isArray(gate.blockers) && gate.blockers.length) summary.blockers.push("registration_execute_gate_has_blockers");
  if (!gate.operationalScope) summary.blockers.push("registration_execute_gate_missing_operational_scope");
  if (gate.operationalScope && gate.operationalScope.teacherReviewedScope !== true) {
    summary.blockers.push("registration_execute_gate_operational_scope_not_teacher_reviewed");
  }
  if (!sourceRegistrationRunner || !existsSync(sourceRegistrationRunner)) {
    summary.blockers.push("source_registration_runner_not_found");
  }
  return summary;
}

function writeReadme(path, builder) {
  const lines = [
    "# Operational Registration Approved Command Builder",
    "",
    `Status: ${builder.status}`,
    `Registration execute gate: ${builder.paths.sourceRegistrationExecuteGate || "<ready gate path not loaded yet>"}`,
    `Operational scope: ${builder.operationalScope?.scopeKind || "unspecified"}`,
    "",
    "Use the HTML page to review one ready operational registration execute gate, enter the teacher's final registration confirmation and retained rollback point, then copy the generated registration approved-runner command.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    "",
    "Safety boundary:",
    "- This builder only creates command text and a run-request JSON in the browser.",
    "- It does not run the registration approved runner, register Scheduled Tasks, start Scheduled Tasks, execute target software, capture screenshots, write memory, accept rules, unlock packaging, or claim all-software unattended coverage.",
    "- The generated command remains a separate teacher-approved system-change command and must only be used after reviewing the gate, confirmation text, and rollback point."
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
  <title>Operational Registration Approved Command Builder</title>
  <style>
    :root { color: #17202a; background: #f7f8fb; font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    p { line-height: 1.5; }
    .panel { background: #fff; border: 1px solid #d9e1ec; border-radius: 8px; padding: 14px; margin: 14px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
    label { display: block; margin: 10px 0; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e4; border-radius: 6px; padding: 8px; font: 14px "Segoe UI", Arial, sans-serif; }
    textarea { min-height: 200px; font: 13px Consolas, monospace; }
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
    <h1>Operational Registration Approved Command Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Gate:</strong> ${builder.paths.sourceRegistrationExecuteGate ? `<a href="${htmlEscape(fileHref(builder.paths.sourceRegistrationExecuteGate))}">${htmlEscape(builder.paths.sourceRegistrationExecuteGate)}</a>` : "<code>choose a ready registration execute gate when generating this builder</code>"}</p>
    <p class="lock">This page only generates command text. It does not register Scheduled Tasks, start tasks, run commands, execute target software, capture screenshots, write memory, unlock packaging, or claim completion.</p>
    <section class="panel">
      <div class="grid">
        <div><strong>Gate status</strong><br><code>${htmlEscape(builder.gate.gateStatus)}</code></div>
        <div><strong>Ready</strong><br><code>${builder.gate.readyForTeacherRegistrationExecuteReview ? "true" : "false"}</code></div>
        <div><strong>Prepared only</strong><br><code>${builder.gate.preparedButNotExecuted ? "true" : "false"}</code></div>
        <div><strong>Operational scope</strong><br><code>${htmlEscape(builder.operationalScope?.scopeKind || "unspecified")}</code></div>
        <div><strong>Blockers</strong><br><code>${htmlEscape(builder.gate.blockers.join(", ") || "none")}</code></div>
      </div>
    </section>
    <section class="panel">
      <label>Ready registration execute gate path
        <input id="gatePath" value="${htmlEscape(builder.paths.sourceRegistrationExecuteGate || "<ready-operational-registration-execute-gate.json>")}">
      </label>
      <label>Teacher final registration confirmation
        <input id="teacherConfirmation" value="teacher confirmed approved registration runner">
      </label>
      <label>Retained rollback point
        <input id="rollbackPoint" value="<retained-rollback-point-path-or-label>">
      </label>
      <label>Output directory
        <input id="outputDir" value="${htmlEscape(builder.commandDefaults.outputDir)}">
      </label>
      <div class="controls">
        <button id="generateCommand">Generate registration command</button>
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
        format: "transparent_ai_operational_registration_approved_run_request_v1",
        generatedBy: "operational_registration_approved_command_builder",
        registrationExecuteGatePath: document.getElementById("gatePath").value.trim(),
        teacherConfirmation: document.getElementById("teacherConfirmation").value.trim(),
        rollbackPointCreated: true,
        rollbackPoint: document.getElementById("rollbackPoint").value.trim(),
        outputDir: document.getElementById("outputDir").value.trim(),
        operationalScope: builder.operationalScope,
        executeApprovedRegistration: true,
        allowSystemChange: true,
        locks: builder.locks
      };
      request.command = [
        "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\run-all-software-operational-learning-registration-approved-runner.mjs",
        "--registration-execute-gate", q(request.registrationExecuteGatePath),
        "--execute-approved-registration",
        "--allow-system-change",
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
      a.download = "operational-registration-approved-run-request.json";
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

const goal = argValue("--goal", argValue("--task", "Build a teacher-facing command page for approved operational registration."));
const gateInput = readJsonInput(
  argValue("--registration-execute-gate", argValue("--gate", "")),
  "--registration-execute-gate",
  "transparent_ai_all_software_operational_learning_registration_execute_gate_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "operational-registration-approved-command-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const htmlPath = join(builderDir, "operational-registration-approved-command-builder.html");
const builderPath = join(builderDir, "operational-registration-approved-command-builder.json");
const readmePath = join(builderDir, "OPERATIONAL_REGISTRATION_APPROVED_COMMAND_BUILDER_START_HERE.md");
const gateSummary = summarizeGate(gateInput.value, gateInput.path);
const status = gateInput.value
  ? gateSummary.blockers.length
    ? "operational_registration_command_builder_waiting_for_ready_gate"
    : "operational_registration_command_builder_ready_for_teacher_final_confirmation"
  : "waiting_for_ready_registration_execute_gate_path";

const builder = {
  ok: true,
  format: "transparent_ai_operational_registration_approved_command_builder_v1",
  builderId,
  goal,
  status,
  gate: gateSummary,
  operationalScope: gateSummary.operationalScope,
  paths: {
    sourceRegistrationExecuteGate: gateInput.path,
    builder: builderPath,
    html: htmlPath,
    readme: readmePath
  },
  commandDefaults: {
    outputDir: join(outputRoot, "operational-registration-approved-run")
  },
  commandTemplate: commandLine("run-all-software-operational-learning-registration-approved-runner.mjs", [
    ["--registration-execute-gate", gateInput.path || "<ready-operational-registration-execute-gate.json>"],
    ["--execute-approved-registration", true],
    ["--allow-system-change", true],
    ["--teacher-confirmation", "<teacher-confirmed-approved-registration-runner-text>"],
    ["--rollback-point-created", true],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"],
    ["--output-dir", join(outputRoot, "operational-registration-approved-run")]
  ]),
  forbiddenBuilderActions: [
    "run_registration_approved_runner_from_builder",
    "register_scheduled_task_from_builder",
    "start_scheduled_task_from_builder",
    "execute_target_software_from_builder",
    "capture_screenshot_from_builder",
    "write_memory_from_builder",
    "claim_all_software_unattended_coverage_from_builder"
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
      format: "transparent_ai_operational_registration_approved_command_builder_result_v1",
      status: builder.status,
      builderId,
      gateStatus: gateSummary.gateStatus,
      operationalScope: builder.operationalScope,
      paths: builder.paths,
      commandTemplate: builder.commandTemplate,
      locks: builder.locks
    },
    null,
    2
  )
);
