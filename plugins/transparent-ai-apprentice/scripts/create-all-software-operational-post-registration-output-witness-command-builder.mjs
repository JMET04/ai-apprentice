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
    String(value || "operational-post-registration-output-witness-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "operational-post-registration-output-witness-command-builder"
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
    builderDoesNotTriggerRunner: true,
    builderDoesNotInvokeReviewedScheduledRunner: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotStartScheduledTask: true,
    builderDoesNotStopScheduledTask: true,
    builderDoesNotUnregisterTask: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotWriteMemory: true,
    generatedCommandRequiresMatchingRegistrationStatus: true,
    generatedCommandRequiresTeacherOutputWitnessConfirmation: true,
    generatedCommandRequiresRollback: true,
    generatedCommandRequiresTriggerReviewedOutput: true,
    generatedCommandRequiresAllowRunnerTrigger: true,
    scheduledTaskRegisteredByBuilder: false,
    scheduledTaskStartedByBuilder: false,
    runnerLaunchedByBuilder: false,
    commandsExecutedByBuilder: false,
    targetSoftwareCommandsExecutedByBuilder: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareUnattendedCoverageProven: false,
    goalComplete: false
  };
}

function summarizeStatus(status, path) {
  if (!status) {
    return {
      registrationStatusPath: "",
      status: "waiting_for_registered_matching_status_path",
      registeredMatchesExpectedRunner: false,
      taskRegistered: false,
      sourceSchedulePath: "",
      sourceRegistrationRunnerPath: "",
      blockers: ["registered_and_matching_registration_status_required"]
    };
  }
  const summary = {
    registrationStatusPath: path,
    status: status.status || "",
    registeredMatchesExpectedRunner: status.registeredMatchesExpectedRunner === true,
    taskRegistered: status.taskRegistered === true,
    sourceSchedulePath: status.sourceSchedulePath || "",
    sourceRegistrationRunnerPath: status.sourceRegistrationRunnerPath || "",
    blockers: []
  };
  if (status.status !== "registered_and_matches_reviewed_runner") {
    summary.blockers.push("registration_status_not_registered_and_matching_reviewed_runner");
  }
  if (status.registeredMatchesExpectedRunner !== true) {
    summary.blockers.push("registration_status_match_flag_missing");
  }
  if (status.taskRegistered !== true) {
    summary.blockers.push("registration_status_task_not_registered");
  }
  if (status.locks?.statusVerifierDoesNotChangeSystem !== true) {
    summary.blockers.push("registration_status_read_only_lock_missing");
  }
  if (!summary.sourceSchedulePath || !existsSync(summary.sourceSchedulePath)) {
    summary.blockers.push("source_schedule_not_found");
  }
  return summary;
}

function summarizeApprovedRunner(runner, path) {
  if (!runner) {
    return {
      approvedRunnerPath: "",
      status: "optional_not_loaded",
      witnessedMatchingStatus: false,
      operationalScope: null,
      blockers: []
    };
  }
  const blockers = [];
  if (runner.postExecuteRegisteredMatchesExpectedRunner !== true) {
    blockers.push("approved_runner_did_not_witness_matching_status");
  }
  if (runner.locks?.registrationRunnerInvoked !== true) {
    blockers.push("approved_runner_registration_not_invoked");
  }
  if (runner.locks?.scheduledTaskStarted !== false) {
    blockers.push("approved_runner_started_task_unexpectedly");
  }
  return {
    approvedRunnerPath: path,
    status: runner.status || "",
    witnessedMatchingStatus: runner.postExecuteRegisteredMatchesExpectedRunner === true,
    operationalScope: runner.operationalScope || null,
    blockers
  };
}

function summarizeOperationalScope(approvedRunner, dryRunRehearsal, registrationExecuteGate) {
  const scope = approvedRunner?.operationalScope || registrationExecuteGate?.operationalScope || dryRunRehearsal?.operationalScope || null;
  const blockers = [];
  if (!scope) blockers.push("operational_scope_missing_from_post_registration_inputs");
  if (scope && scope.teacherReviewedScope !== true) blockers.push("operational_scope_not_teacher_reviewed");
  const compared = [
    ["approved_runner", approvedRunner?.operationalScope],
    ["registration_execute_gate", registrationExecuteGate?.operationalScope],
    ["dry_run_rehearsal", dryRunRehearsal?.operationalScope]
  ].filter(([, value]) => value);
  for (const [label, value] of compared) {
    if (scope?.sourceTrialPath && value.sourceTrialPath && resolve(scope.sourceTrialPath) !== resolve(value.sourceTrialPath)) {
      blockers.push(`operational_scope_trial_mismatch_${label}`);
    }
    if (scope?.sourceSchedulePath && value.sourceSchedulePath && resolve(scope.sourceSchedulePath) !== resolve(value.sourceSchedulePath)) {
      blockers.push(`operational_scope_schedule_mismatch_${label}`);
    }
  }
  return {
    scope,
    sourceCount: compared.length,
    blockers
  };
}

function writeReadme(path, builder) {
  const lines = [
    "# Operational Post-Registration Output Witness Command Builder",
    "",
    `Status: ${builder.status}`,
    `Registration status: ${builder.paths.sourceRegistrationStatus || "<registered matching status path not loaded yet>"}`,
    `Operational scope: ${builder.operationalScope?.scopeKind || "unspecified"}`,
    "",
    "Use the HTML page to review the registered-and-matching Scheduled Task status, enter the teacher's final output-witness confirmation and retained rollback point, then copy the generated post-registration output witness command.",
    "",
    `- Builder HTML: ${builder.paths.html}`,
    `- Builder JSON: ${builder.paths.builder}`,
    "",
    "Safety boundary:",
    "- This builder only creates command text and a run-request JSON in the browser.",
    "- It does not invoke the output witness runner, invoke the reviewed scheduled runner, register/start/stop/unregister Scheduled Tasks, execute target software, capture screenshots, read full logs, write memory, accept rules, unlock packaging, or claim all-software unattended coverage.",
    "- The generated command remains a separate teacher-approved runner trigger and must only be used after reviewing matching registration status, confirmation text, and rollback point."
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
  <title>Operational Post-Registration Output Witness Command Builder</title>
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
    <h1>Operational Post-Registration Output Witness Command Builder</h1>
    <p><strong>Status:</strong> ${htmlEscape(builder.status)}</p>
    <p><strong>Registration status:</strong> ${builder.paths.sourceRegistrationStatus ? `<a href="${htmlEscape(fileHref(builder.paths.sourceRegistrationStatus))}">${htmlEscape(builder.paths.sourceRegistrationStatus)}</a>` : "<code>choose a registered-and-matching status when generating this builder</code>"}</p>
    <p class="lock">This page only generates command text. It does not invoke runners, touch Scheduled Tasks, execute target software, capture screenshots, read full logs, write memory, unlock packaging, or claim completion.</p>
    <section class="panel">
      <div class="grid">
        <div><strong>Status evidence</strong><br><code>${htmlEscape(builder.registrationStatus.status)}</code></div>
        <div><strong>Matches runner</strong><br><code>${builder.registrationStatus.registeredMatchesExpectedRunner ? "true" : "false"}</code></div>
        <div><strong>Task registered</strong><br><code>${builder.registrationStatus.taskRegistered ? "true" : "false"}</code></div>
        <div><strong>Operational scope</strong><br><code>${htmlEscape(builder.operationalScope?.scopeKind || "unspecified")}</code></div>
        <div><strong>Blockers</strong><br><code>${htmlEscape([...builder.registrationStatus.blockers, ...builder.approvedRunner.blockers, ...builder.operationalScopeSummary.blockers].join(", ") || "none")}</code></div>
      </div>
    </section>
    <section class="panel">
      <label>Registered-and-matching registration status path
        <input id="registrationStatus" value="${htmlEscape(builder.paths.sourceRegistrationStatus || "<registered-and-matching-recurring-monitor-status.json>")}">
      </label>
      <label>Registration approved runner path
        <input id="approvedRunner" value="${htmlEscape(builder.paths.sourceRegistrationApprovedRunner || "<registration-approved-runner.json>")}">
      </label>
      <label>Passed activation dry-run rehearsal path
        <input id="dryRunRehearsal" value="${htmlEscape(builder.paths.sourceDryRunRehearsal || "<passed-operational-activation-dry-run-rehearsal.json>")}">
      </label>
      <label>Ready registration execute gate path
        <input id="registrationExecuteGate" value="${htmlEscape(builder.paths.sourceRegistrationExecuteGate || "<ready-operational-registration-execute-gate.json>")}">
      </label>
      <label>Teacher final output witness confirmation
        <input id="teacherConfirmation" value="teacher confirmed post-registration output witness">
      </label>
      <label>Retained rollback point
        <input id="rollbackPoint" value="<retained-rollback-point-path-or-label>">
      </label>
      <label>Output directory
        <input id="outputDir" value="${htmlEscape(builder.commandDefaults.outputDir)}">
      </label>
      <div class="controls">
        <button id="generateCommand">Generate output witness command</button>
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
        format: "transparent_ai_operational_post_registration_output_witness_run_request_v1",
        generatedBy: "operational_post_registration_output_witness_command_builder",
        registrationStatusPath: document.getElementById("registrationStatus").value.trim(),
        registrationApprovedRunnerPath: document.getElementById("approvedRunner").value.trim(),
        dryRunRehearsalPath: document.getElementById("dryRunRehearsal").value.trim(),
        registrationExecuteGatePath: document.getElementById("registrationExecuteGate").value.trim(),
        teacherConfirmation: document.getElementById("teacherConfirmation").value.trim(),
        rollbackPointCreated: true,
        rollbackPoint: document.getElementById("rollbackPoint").value.trim(),
        outputDir: document.getElementById("outputDir").value.trim(),
        operationalScope: builder.operationalScope,
        triggerReviewedOutput: true,
        allowRunnerTrigger: true,
        locks: builder.locks
      };
      request.command = [
        "node plugins\\\\transparent-ai-apprentice\\\\scripts\\\\run-all-software-operational-learning-post-registration-output-witness-runner.mjs",
        "--registration-status", q(request.registrationStatusPath),
        "--registration-approved-runner", q(request.registrationApprovedRunnerPath),
        "--dry-run-rehearsal", q(request.dryRunRehearsalPath),
        "--registration-execute-gate", q(request.registrationExecuteGatePath),
        "--trigger-reviewed-output",
        "--allow-runner-trigger",
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
      a.download = "operational-post-registration-output-witness-run-request.json";
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

const goal = argValue("--goal", argValue("--task", "Build a teacher-facing command page for post-registration output witness."));
const registrationStatusInput = readJsonInput(
  argValue("--registration-status", argValue("--status", "")),
  "--registration-status",
  "transparent_ai_all_software_recurring_monitor_registration_status_v1"
);
const approvedRunnerInput = readJsonInput(
  argValue("--registration-approved-runner", argValue("--approved-runner", "")),
  "--registration-approved-runner",
  "transparent_ai_all_software_operational_learning_registration_approved_runner_v1"
);
const dryRunRehearsalInput = readJsonInput(
  argValue("--dry-run-rehearsal", argValue("--rehearsal", "")),
  "--dry-run-rehearsal",
  "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1"
);
const registrationExecuteGateInput = readJsonInput(
  argValue("--registration-execute-gate", argValue("--execute-gate", argValue("--gate", ""))),
  "--registration-execute-gate",
  "transparent_ai_all_software_operational_learning_registration_execute_gate_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "operational-post-registration-output-witness-command-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const htmlPath = join(builderDir, "operational-post-registration-output-witness-command-builder.html");
const builderPath = join(builderDir, "operational-post-registration-output-witness-command-builder.json");
const readmePath = join(builderDir, "OPERATIONAL_POST_REGISTRATION_OUTPUT_WITNESS_COMMAND_BUILDER_START_HERE.md");
const registrationStatusSummary = summarizeStatus(registrationStatusInput.value, registrationStatusInput.path);
const approvedRunnerSummary = summarizeApprovedRunner(approvedRunnerInput.value, approvedRunnerInput.path);
const operationalScopeSummary = summarizeOperationalScope(
  approvedRunnerInput.value,
  dryRunRehearsalInput.value,
  registrationExecuteGateInput.value
);
const blockers = [...registrationStatusSummary.blockers, ...approvedRunnerSummary.blockers, ...operationalScopeSummary.blockers];
const status = registrationStatusInput.value
  ? blockers.length
    ? "operational_post_registration_output_witness_command_builder_waiting_for_matching_status"
    : "operational_post_registration_output_witness_command_builder_ready_for_teacher_final_confirmation"
  : "waiting_for_registered_matching_status_path";

const builder = {
  ok: true,
  format: "transparent_ai_operational_post_registration_output_witness_command_builder_v1",
  builderId,
  goal,
  status,
  registrationStatus: registrationStatusSummary,
  approvedRunner: approvedRunnerSummary,
  operationalScope: operationalScopeSummary.scope,
  operationalScopeSummary,
  paths: {
    sourceRegistrationStatus: registrationStatusInput.path,
    sourceRegistrationApprovedRunner: approvedRunnerInput.path,
    sourceDryRunRehearsal: dryRunRehearsalInput.path,
    sourceRegistrationExecuteGate: registrationExecuteGateInput.path,
    builder: builderPath,
    html: htmlPath,
    readme: readmePath
  },
  commandDefaults: {
    outputDir: join(outputRoot, "operational-post-registration-output-witness-run")
  },
  commandTemplate: commandLine("run-all-software-operational-learning-post-registration-output-witness-runner.mjs", [
    ["--registration-status", registrationStatusInput.path || "<registered-and-matching-recurring-monitor-status.json>"],
    ["--registration-approved-runner", approvedRunnerInput.path || "<registration-approved-runner.json>"],
    ["--dry-run-rehearsal", dryRunRehearsalInput.path || "<passed-operational-activation-dry-run-rehearsal.json>"],
    ["--registration-execute-gate", registrationExecuteGateInput.path || "<ready-operational-registration-execute-gate.json>"],
    ["--trigger-reviewed-output", true],
    ["--allow-runner-trigger", true],
    ["--teacher-confirmation", "<teacher-confirmed-post-registration-output-witness-text>"],
    ["--rollback-point-created", true],
    ["--rollback-point", "<retained-rollback-point-path-or-label>"],
    ["--output-dir", join(outputRoot, "operational-post-registration-output-witness-run")]
  ]),
  forbiddenBuilderActions: [
    "run_post_registration_output_witness_runner_from_builder",
    "invoke_reviewed_scheduled_runner_from_builder",
    "register_scheduled_task_from_builder",
    "start_scheduled_task_from_builder",
    "stop_scheduled_task_from_builder",
    "unregister_scheduled_task_from_builder",
    "execute_target_software_from_builder",
    "capture_screenshot_from_builder",
    "read_full_logs_from_builder",
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
      format: "transparent_ai_operational_post_registration_output_witness_command_builder_result_v1",
      status: builder.status,
      builderId,
      registrationStatus: registrationStatusSummary.status,
      operationalScope: builder.operationalScope,
      paths: builder.paths,
      commandTemplate: builder.commandTemplate,
      locks: builder.locks
    },
    null,
    2
  )
);
