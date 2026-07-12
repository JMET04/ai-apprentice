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
    String(value || "objective-execution-selected-route-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "objective-execution-selected-route-command-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    commandBuilderOnly: true,
    builderDoesNotRunCommands: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotSendUiEvents: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadLogs: true,
    builderDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function classifyRoute(routeId) {
  if (routeId === "existing_real_case_controlled_execution_chain") {
    return {
      routeKind: "real_case_controlled_execution_chain",
      nextGate: "create_real_case_pilot_intake_or_real_case_execution_gate_chain",
      teacherInstruction:
        "Use when the selected task must pass real-case intake, rule/validation/delivery gates, controlled dry-run, adapter approval, separate runner, and outcome review."
    };
  }
  if (routeId === "existing_all_software_execution_approval_gate_prep_runner") {
    return {
      routeKind: "all_software_execution_approval_gate_prep_runner",
      nextGate: "run_all_software_execution_approval_gate_prep_runner",
      teacherInstruction:
        "Use when a validated dry-run handoff item is ready for execution approval gate planning, and the teacher has supplied selector, queue, adapter evidence, rollback, and target selection."
    };
  }
  if (routeId === "existing_real_local_execution_approval_gate") {
    return {
      routeKind: "real_local_execution_approval_gate",
      nextGate: "create_real_local_execution_approval_gate",
      teacherInstruction:
        "Use when the teacher already has a selected real-local candidate plus reviewed command/API/file/browser adapter evidence."
    };
  }
  return {
    routeKind: "unknown_route",
    nextGate: "blocked_unknown_route",
    teacherInstruction: "Return to the execution bridge route-selection receipt and choose a known route."
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Objective Execution Selected Route Command Builder",
    "",
    `Status: ${packet.status}`,
    `Selected route: ${packet.selectedRouteId}`,
    `Next gate: ${packet.nextGate}`,
    "",
    "This package turns a validated teacher route selection into a reviewable command handoff.",
    "It does not run the command and does not prove software execution.",
    "",
    "Command template:",
    packet.commandTemplate,
    "",
    "Preflight checklist:",
    ...packet.preflightChecklist.map((item) => `- ${item}`),
    "",
    "Safety boundary:",
    "- This builder does not run commands, register tasks, launch runners, execute target software, send UI events, capture screenshots, read logs, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, packet) {
  writeFileSync(
    path,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Objective Execution Selected Route Command Builder</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1080px; margin: 0 auto; padding: 24px; }
    .panel { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin: 12px 0; }
    pre { white-space: pre-wrap; background: #eef2f7; border-radius: 6px; padding: 10px; }
    a { color: #174d89; }
  </style>
</head>
<body>
<main>
  <h1>Objective Execution Selected Route Command Builder</h1>
  <p>Status: <code>${htmlEscape(packet.status)}</code></p>
  <p>Validation: <a href="${htmlEscape(fileHref(packet.sourceValidationPath))}">${htmlEscape(basename(packet.sourceValidationPath))}</a></p>
  <section class="panel">
    <h2>${htmlEscape(packet.selectedRouteId)}</h2>
    <p>${htmlEscape(packet.teacherInstruction)}</p>
    <p><strong>Next gate:</strong> ${htmlEscape(packet.nextGate)}</p>
    <pre>${htmlEscape(packet.commandTemplate)}</pre>
  </section>
  <section class="panel">
    <h2>Preflight Checklist</h2>
    <ul>${packet.preflightChecklist.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
  </section>
</main>
</body>
</html>`,
    "utf8"
  );
}

const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", "")),
  "--validation",
  "transparent_ai_original_goal_objective_execution_bridge_receipt_validation_v1"
);
const validation = validationInput.value;
if (validation.routeReadyForLaterGate !== true || !validation.selectedRouteHandoff) {
  throw new Error("OBJECTIVE_EXECUTION_SELECTED_ROUTE_COMMAND_BUILDER_REQUIRES_READY_ROUTE_VALIDATION");
}
const selected = validation.selectedRouteHandoff;
const routeInfo = classifyRoute(selected.selectedRouteId);
if (routeInfo.routeKind === "unknown_route") throw new Error("OBJECTIVE_EXECUTION_SELECTED_ROUTE_COMMAND_BUILDER_UNKNOWN_ROUTE");

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-objective-execution-selected-route-command-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(selected.selectedRouteId)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });
const builderPath = join(builderDir, "original-goal-objective-execution-selected-route-command-builder.json");
const htmlPath = join(builderDir, "original-goal-objective-execution-selected-route-command-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_OBJECTIVE_EXECUTION_SELECTED_ROUTE_COMMAND_BUILDER_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_original_goal_objective_execution_selected_route_command_builder_v1",
  builderId,
  status: "selected_route_command_ready_for_teacher_review",
  sourceValidationPath: validationInput.path,
  selectedRouteId: selected.selectedRouteId,
  routeKind: routeInfo.routeKind,
  nextGate: routeInfo.nextGate,
  teacherInstruction: routeInfo.teacherInstruction,
  commandTemplate: selected.commandTemplate,
  teacherSelectedNumberedTarget: selected.teacherSelectedNumberedTarget,
  retainedRollbackPoint: selected.retainedRollbackPoint,
  adapterEvidencePath: selected.adapterEvidencePath,
  postActionEvidencePlan: selected.postActionEvidencePlan,
  preflightChecklist: [
    "Teacher confirms the selected route still matches the target software and numbered target.",
    "Rollback point is retained and belongs to this exact run.",
    "Adapter/control-channel evidence is reviewed and still current.",
    "Post-action evidence plan is ready before any runner is launched.",
    "Run the selected existing gate only as a separate teacher-approved step."
  ],
  executeNow: false,
  registerNow: false,
  launchRunnerNow: false,
  claimCompleteNow: false,
  blockedActions: [
    "execute_target_software_from_selected_route_command_builder",
    "register_task_from_selected_route_command_builder",
    "launch_runner_from_selected_route_command_builder",
    "send_ui_events_from_selected_route_command_builder",
    "capture_screenshot_from_selected_route_command_builder",
    "read_logs_from_selected_route_command_builder",
    "write_memory_from_selected_route_command_builder",
    "enable_rule_from_selected_route_command_builder",
    "claim_goal_complete_from_selected_route_command_builder"
  ],
  locks: locks(),
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath
  }
};
writeFileSync(builderPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeReadme(readmePath, packet);
writeHtml(htmlPath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_objective_execution_selected_route_command_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      status: packet.status,
      selectedRouteId: packet.selectedRouteId,
      nextGate: packet.nextGate,
      executeNow: packet.executeNow
    },
    null,
    2
  )
);
