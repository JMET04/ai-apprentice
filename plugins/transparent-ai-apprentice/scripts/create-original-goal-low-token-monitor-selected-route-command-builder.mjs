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
    String(value || "low-token-monitor-selected-route-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "low-token-monitor-selected-route-command-builder"
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
    builderDoesNotReadLogs: true,
    builderDoesNotReadFullLogs: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotRecordScreen: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    logsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    softwareActionsExecuted: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function classifyRoute(routeId) {
  const routes = {
    existing_low_token_coverage_review: {
      routeKind: "coverage_before_monitor",
      nextGate: "create_original_goal_low_token_coverage_evidence_dossier_receipt_builder",
      completionBlockerLane: "all_software_low_token_coverage_evidence",
      requiredEvidenceBeforeManualUse: [
        "current low-token coverage evidence dossier or waiting-row cockpit evidence",
        "teacher-reviewed software exclusions or coverage notes",
        "metadata-only follow-up plan for unresolved software rows"
      ],
      teacherInstruction:
        "Use when all-software coverage or teacher exclusions still need review before any recurring monitor planning."
    },
    existing_recurring_monitor_teacher_confirmation: {
      routeKind: "teacher_confirmation_before_registration",
      nextGate: "create_all_software_recurring_monitor_teacher_confirmation_package",
      completionBlockerLane: "unattended_operational_monitor_evidence",
      requiredEvidenceBeforeManualUse: [
      "reviewed all-software low-token readiness package",
      "retained rollback point",
      "teacher-reviewed coverage receipt validation or explicit software exclusions",
      "teacher confirmation that recurring monitoring is allowed without continuous recording"
      ],
      teacherInstruction:
        "Use when reviewed coverage evidence is ready and the teacher wants recurring low-token observation without continuous recording."
    },
    existing_recurring_monitor_registration_runner_template: {
      routeKind: "registration_after_validated_teacher_confirmation",
      nextGate: "run_all_software_recurring_monitor_registration_runner",
      completionBlockerLane: "unattended_operational_monitor_evidence",
      requiredEvidenceBeforeManualUse: [
        "validated recurring monitor teacher confirmation receipt",
        "retained rollback point still present",
        "explicit separate teacher approval for dry-run or registration request"
      ],
      teacherInstruction:
        "Use only after teacher-confirmation validation says registration planning is ready and rollback is retained."
    },
    existing_recurring_monitor_status_verifier: {
      routeKind: "read_only_registration_status_check",
      nextGate: "verify_all_software_recurring_monitor_registration_status",
      completionBlockerLane: "unattended_operational_monitor_evidence",
      requiredEvidenceBeforeManualUse: [
        "registration runner result path",
        "expected scheduled task or monitor id",
        "read-only verification scope confirmed"
      ],
      teacherInstruction:
        "Use after a separate registration runner produced a result and the next step is read-only scheduled-task status verification."
    },
    existing_recurring_monitor_run_output_audit: {
      routeKind: "run_output_before_learning_claim",
      nextGate: "audit_all_software_recurring_monitor_run_output",
      completionBlockerLane: "unattended_operational_monitor_evidence",
      requiredEvidenceBeforeManualUse: [
        "registration status verification path",
        "bounded recurring monitor run output path",
        "teacher review plan before any memory write or completion claim"
      ],
      teacherInstruction:
        "Use after a monitor produced bounded run output that must be audited before any automatic learning claim."
    }
  };
  return (
    routes[routeId] || {
      routeKind: "unknown_route",
      nextGate: "blocked_unknown_route",
      completionBlockerLane: "all_software_low_token_coverage_evidence",
      requiredEvidenceBeforeManualUse: ["known teacher-selected low-token monitor route"],
      teacherInstruction: "Return to the low-token monitor bridge receipt and choose a known route."
    }
  );
}

function nextGateHandoff(routeInfo, selected, packetLocks) {
  return {
    format: "transparent_ai_original_goal_low_token_monitor_selected_route_next_gate_handoff_v1",
    status: "review_only_next_gate_handoff_ready",
    objectiveRequirementId: "all_software_low_token_learning",
    completionBlockerLane: routeInfo.completionBlockerLane,
    selectedRouteId: selected.selectedRouteId,
    routeKind: routeInfo.routeKind,
    nextGate: routeInfo.nextGate,
    teacherInstruction: routeInfo.teacherInstruction,
    commandTemplate: selected.commandTemplate,
    retainedRollbackPoint: selected.retainedRollbackPoint || "",
    coverageEvidencePath: selected.coverageEvidencePath || "",
    coverageReviewReceiptValidationPath: selected.coverageReviewReceiptValidationPath || "",
    teacherExclusionsOrCoverageNote: selected.teacherExclusionsOrCoverageNote || "",
    requiredEvidenceBeforeManualUse: routeInfo.requiredEvidenceBeforeManualUse,
    returnToCompletionBlockerMatrixAfterNextGate: true,
    followUpAuditExpectation:
      "After the selected next gate returns evidence, refresh the original-goal current status and completion blocker matrix before any memory write, monitor registration claim, or completion claim.",
    blockedActions: [
      "run_next_gate_from_selected_route_handoff",
      "register_task_from_selected_route_handoff",
      "launch_runner_from_selected_route_handoff",
      "read_logs_from_selected_route_handoff",
      "read_full_logs_from_selected_route_handoff",
      "capture_screenshot_from_selected_route_handoff",
      "record_screen_from_selected_route_handoff",
      "execute_target_software_from_selected_route_handoff",
      "write_memory_from_selected_route_handoff",
      "enable_rule_from_selected_route_handoff",
      "claim_goal_complete_from_selected_route_handoff"
    ],
    locks: packetLocks
  };
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Low-Token Monitor Selected Route Command Builder",
    "",
    `Status: ${packet.status}`,
    `Selected route: ${packet.selectedRouteId}`,
    `Next gate: ${packet.nextGate}`,
    `Coverage review receipt validation: ${packet.coverageReviewReceiptValidationPath || "(none)"}`,
    `Teacher exclusions or coverage note: ${packet.teacherExclusionsOrCoverageNote || "(none)"}`,
    "",
    "This package turns a validated teacher-selected low-token monitor route into a reviewable command handoff.",
    "It does not run the command, register a monitor, read logs, read full logs, write memory, or prove all-software learning.",
    "",
    "Next-gate handoff:",
    `- Objective requirement: ${packet.nextGateHandoff.objectiveRequirementId}`,
    `- Completion blocker lane: ${packet.nextGateHandoff.completionBlockerLane}`,
    `- Follow-up audit: ${packet.nextGateHandoff.followUpAuditExpectation}`,
    "",
    "Command template:",
    packet.commandTemplate,
    "",
    "Preflight checklist:",
    ...packet.preflightChecklist.map((item) => `- ${item}`),
    "",
    "Safety boundary:",
    "- This builder does not run commands, register tasks, launch runners, read logs, read full logs, capture screenshots, record the screen, execute software, write memory, enable rules, unlock packaging, or claim completion."
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
  <title>Low-Token Monitor Selected Route Command Builder</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 1080px; margin: 0 auto; padding: 24px; }
    .panel { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin: 12px 0; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #eef2f7; border-radius: 6px; padding: 10px; }
    a { color: #174d89; }
  </style>
</head>
<body>
<main>
  <h1>Low-Token Monitor Selected Route Command Builder</h1>
  <p>Status: <code>${htmlEscape(packet.status)}</code></p>
  <p>Validation: <a href="${htmlEscape(fileHref(packet.sourceValidationPath))}">${htmlEscape(basename(packet.sourceValidationPath))}</a></p>
  <section class="panel">
    <h2>${htmlEscape(packet.selectedRouteId)}</h2>
    <p>${htmlEscape(packet.teacherInstruction)}</p>
    <p><strong>Next gate:</strong> ${htmlEscape(packet.nextGate)}</p>
    <p><strong>Completion blocker lane:</strong> ${htmlEscape(packet.nextGateHandoff.completionBlockerLane)}</p>
    <p><strong>Coverage review receipt validation:</strong> ${htmlEscape(packet.coverageReviewReceiptValidationPath || "(none)")}</p>
    <p><strong>Teacher exclusions or coverage note:</strong> ${htmlEscape(packet.teacherExclusionsOrCoverageNote || "(none)")}</p>
    <p><strong>Follow-up audit:</strong> ${htmlEscape(packet.nextGateHandoff.followUpAuditExpectation)}</p>
    <pre>${htmlEscape(packet.commandTemplate)}</pre>
  </section>
  <section class="panel">
    <h2>Preflight Checklist</h2>
    <ul>${packet.preflightChecklist.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
  </section>
  <section class="panel">
    <h2>Required Evidence Before Manual Use</h2>
    <ul>${packet.nextGateHandoff.requiredEvidenceBeforeManualUse.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
  </section>
</main>
</body>
</html>`,
    "utf8"
  );
}

const validationInput = readJsonInput(
  argValue("--validation", argValue("--receipt-validation", argValue("--low-token-monitor-bridge-receipt-validation", ""))),
  "--validation",
  "transparent_ai_original_goal_low_token_monitor_bridge_receipt_validation_v1"
);
const validation = validationInput.value;
if (validation.routeReadyForLaterGate !== true || !validation.selectedRouteHandoff) {
  throw new Error("LOW_TOKEN_MONITOR_SELECTED_ROUTE_COMMAND_BUILDER_REQUIRES_READY_ROUTE_VALIDATION");
}
const selected = validation.selectedRouteHandoff;
const routeInfo = classifyRoute(selected.selectedRouteId);
if (routeInfo.routeKind === "unknown_route") {
  throw new Error("LOW_TOKEN_MONITOR_SELECTED_ROUTE_COMMAND_BUILDER_UNKNOWN_ROUTE");
}

const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), "artifacts", "lt-monitor-selected-route-command-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(selected.selectedRouteId)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });
const builderPath = join(builderDir, "original-goal-low-token-monitor-selected-route-command-builder.json");
const htmlPath = join(builderDir, "original-goal-low-token-monitor-selected-route-command-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_LOW_TOKEN_MONITOR_SELECTED_ROUTE_COMMAND_BUILDER_START_HERE.md");
const packetLocks = locks();
const packet = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_monitor_selected_route_command_builder_v1",
  builderId,
  status: "low_token_monitor_selected_route_command_ready_for_teacher_review",
  sourceValidationPath: validationInput.path,
  selectedRouteId: selected.selectedRouteId,
  routeKind: routeInfo.routeKind,
  nextGate: routeInfo.nextGate,
  objectiveRequirementId: "all_software_low_token_learning",
  completionBlockerLane: routeInfo.completionBlockerLane,
  teacherInstruction: routeInfo.teacherInstruction,
  commandTemplate: selected.commandTemplate,
  retainedRollbackPoint: selected.retainedRollbackPoint || "",
  coverageEvidencePath: selected.coverageEvidencePath || "",
  coverageReviewReceiptValidationPath: selected.coverageReviewReceiptValidationPath || "",
  teacherExclusionsOrCoverageNote: selected.teacherExclusionsOrCoverageNote || "",
  readinessPackagePath: selected.readinessPackagePath || "",
  recurringMonitorConfirmationReceiptPath: selected.recurringMonitorConfirmationReceiptPath || "",
  validatedRecurringMonitorConfirmationPath: selected.validatedRecurringMonitorConfirmationPath || "",
  registrationRunnerResultPath: selected.registrationRunnerResultPath || "",
  registrationStatusVerificationPath: selected.registrationStatusVerificationPath || "",
  recurringMonitorRunOutputPath: selected.recurringMonitorRunOutputPath || "",
  preflightChecklist: [
    "Teacher confirms the selected low-token route still matches the current all-software learning objective.",
    "Retained rollback point is still present and must not be deleted until the teacher confirms the direction.",
    "Route-specific evidence paths or teacher exclusions are reviewed before the next gate.",
    "Any downstream runner or scheduled-task registration remains a separate teacher-approved step.",
    "Run-output audit and teacher review must return before any memory write or completion claim."
  ],
  executeNow: false,
  registerNow: false,
  launchRunnerNow: false,
  readLogsNow: false,
  readFullLogsNow: false,
  claimCompleteNow: false,
  blockedActions: [
    "run_monitor_from_low_token_selected_route_command_builder",
    "register_task_from_low_token_selected_route_command_builder",
    "launch_runner_from_low_token_selected_route_command_builder",
    "read_logs_from_low_token_selected_route_command_builder",
    "read_full_logs_from_low_token_selected_route_command_builder",
    "capture_screenshot_from_low_token_selected_route_command_builder",
    "record_screen_from_low_token_selected_route_command_builder",
    "execute_target_software_from_low_token_selected_route_command_builder",
    "write_memory_from_low_token_selected_route_command_builder",
    "enable_rule_from_low_token_selected_route_command_builder",
    "claim_goal_complete_from_low_token_selected_route_command_builder"
  ],
  nextGateHandoff: nextGateHandoff(routeInfo, selected, packetLocks),
  locks: packetLocks,
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
      format: "transparent_ai_original_goal_low_token_monitor_selected_route_command_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      status: packet.status,
      selectedRouteId: packet.selectedRouteId,
      nextGate: packet.nextGate,
      executeNow: packet.executeNow,
      registerNow: packet.registerNow,
      readFullLogsNow: packet.readFullLogsNow
    },
    null,
    2
  )
);
