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
    String(value || "original-goal-objective-next-lane-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-objective-next-lane-command-builder"
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
    builderDoesNotRunCommands: true,
    builderDoesNotRegisterTask: true,
    builderDoesNotLaunchRunner: true,
    builderDoesNotExecuteTargetSoftware: true,
    builderDoesNotCaptureScreenshots: true,
    builderDoesNotReadLogs: true,
    builderDoesNotWriteMemory: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function sourceRefreshFromValidation(validation) {
  if (validation.sourceAuditPath && existsSync(validation.sourceAuditPath)) {
    const audit = readJson(validation.sourceAuditPath);
    if (audit.sourceRefreshPath && existsSync(audit.sourceRefreshPath)) return readJson(audit.sourceRefreshPath);
  }
  return {};
}

function pathExists(path) {
  return Boolean(path && existsSync(path));
}

function commandForLane(requirementId, refresh) {
  const paths = refresh.paths || {};
  if (requirementId === "all_software_low_token_learning") {
    return {
      routeKind: "low_token_coverage_review",
      title: "Review all-software low-token coverage gaps",
      openPath:
        paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml ||
        paths.originalGoalLowTokenFallbackRouteEvidencePackHtml ||
        paths.originalGoalLowTokenCoverageEvidenceDossierHtml ||
        "",
      receiptTemplate:
        paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate ||
        paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptTemplate ||
        paths.originalGoalLowTokenCoverageDossierReceiptTemplate ||
        "",
      validationCommand:
        paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate ||
        paths.originalGoalLowTokenFallbackRouteEvidencePackReceiptValidationCommandTemplate ||
        paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate ||
        "",
      teacherInstruction:
        "Open the low-token coverage cockpit, review blocked rows, select or correct the log/fallback evidence route, then validate the teacher-filled receipt before any runner or registration."
    };
  }
  if (requirementId === "adapt_any_teacher_learning_method") {
    return {
      routeKind: "teacher_method_review",
      title: "Review teacher method and non-expert control route",
      openPath:
        paths.teacherReviewCockpitHtml ||
        paths.goalCommandCenterHtml ||
        paths.nonExpertEngineeringVoiceControlCapabilityHtml ||
        paths.parametricDrawingLogicLearningKitHtml ||
        "",
      receiptTemplate:
        paths.teacherReviewCockpitReceiptTemplate ||
        paths.teacherActionShortlistRouterReceiptTemplate ||
        paths.parametricDrawingLogicTeacherReceiptTemplate ||
        "",
      validationCommand:
        paths.teacherReviewCockpitReceiptValidationCommandTemplate ||
        paths.teacherActionShortlistRouterReceiptValidationCommandTemplate ||
        paths.parametricDrawingLogicReceiptValidationCommandTemplate ||
        "",
      teacherInstruction:
        "Review the teacher method/profile route, correct any misunderstood teaching preference, then validate the receipt before reusing the route."
    };
  }
  if (requirementId === "transparent_mask_2d_perspective_3d_depth_understanding") {
    return {
      routeKind: "transparent_sketch_depth_review",
      title: "Review transparent 2D perspective 3D depth rehearsal",
      openPath:
        paths.transparentSketchDepthRehearsalReviewReceiptBuilderHtml ||
        paths.transparentSketchDepthDemonstrationRehearsalHtml ||
        paths.sketchDemonstrationImplementationAudit ||
        "",
      receiptTemplate: paths.transparentSketchDepthRehearsalReviewReceiptTemplate || "",
      validationCommand: paths.transparentSketchDepthRehearsalReviewReceiptValidationCommandTemplate || "",
      teacherInstruction:
        "Have the teacher confirm or correct the 2D, perspective, and 3D depth rows, then validate the depth rehearsal receipt before spatial route follow-up."
    };
  }
  if (requirementId === "execute_in_target_software_after_confirmation") {
    return {
      routeKind: "execution_gate_review",
      title: "Prepare one teacher-confirmed execution gate",
      openPath: paths.executionApprovedGateCommandBuilderHtml || paths.executionGapReviewCockpitHtml || "",
      receiptTemplate: paths.executionGapReviewCockpitReceiptTemplate || "",
      validationCommand:
        paths.executionFollowUpHandoffItemReceiptValidationCommandTemplate ||
        paths.executionApprovedGateRunnerCommandTemplate ||
        "",
      teacherInstruction:
        "Do not execute from this page. First confirm one numbered target, retained rollback point, adapter route, and dry-run evidence; only then run the separate approved runner."
    };
  }
  return {
    routeKind: "unknown_objective_lane",
    title: "Unknown objective lane",
    openPath: "",
    receiptTemplate: "",
    validationCommand: "",
    teacherInstruction: "Return to the objective fulfillment receipt and choose a known lane."
  };
}

function buildCommandPacket(validation) {
  const queue = Array.isArray(validation.nextLaneQueue) ? validation.nextLaneQueue : [];
  if (validation.format !== "transparent_ai_original_goal_objective_fulfillment_receipt_validation_v1") {
    throw new Error("--validation must be transparent_ai_original_goal_objective_fulfillment_receipt_validation_v1");
  }
  if (validation.ok !== true) throw new Error("Objective fulfillment receipt validation is not ok.");
  if (queue.length !== 1) throw new Error("Objective fulfillment next-lane command builder requires exactly one selected lane.");
  const refresh = sourceRefreshFromValidation(validation);
  const selected = queue[0];
  const command = commandForLane(selected.requirementId, refresh);
  return {
    selected,
    refresh,
    command: {
      ...command,
      openPathExists: pathExists(command.openPath),
      receiptTemplateExists: pathExists(command.receiptTemplate),
      validationCommandReady: Boolean(command.validationCommand),
      executeNow: false,
      registerNow: false,
      writeMemoryNow: false,
      claimCompleteNow: false,
      blockedActions: [
        "execute_target_software_from_next_lane_builder",
        "register_task_from_next_lane_builder",
        "launch_runner_from_next_lane_builder",
        "capture_screenshot_from_next_lane_builder",
        "write_memory_from_next_lane_builder",
        "claim_goal_complete_from_next_lane_builder"
      ]
    }
  };
}

function writeHtml(path, packet) {
  const command = packet.command;
  const links = [
    ["Open review page", command.openPath],
    ["Receipt template", command.receiptTemplate]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<li>${htmlEscape(label)}: <a href="${htmlEscape(fileHref(value))}">${htmlEscape(basename(value))}</a></li>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Original Goal Objective Next Lane Command Builder</title>
  <style>
    body { margin: 0; font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f8fafc; }
    main { max-width: 980px; margin: 0 auto; padding: 24px; }
    .panel { background: white; border: 1px solid #d8e0ea; border-radius: 8px; padding: 14px; margin: 12px 0; }
    code { display: block; white-space: pre-wrap; background: #eef2f7; padding: 8px; border-radius: 6px; }
    a { color: #174d89; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Objective Next Lane Command Builder</h1>
  <p>Status: <code>${htmlEscape(packet.status)}</code></p>
  <section class="panel">
    <h2>${htmlEscape(command.title)}</h2>
    <p>${htmlEscape(command.teacherInstruction)}</p>
    <ul>${links}</ul>
    <p>Validation command:</p>
    <code>${htmlEscape(command.validationCommand || "(none)")}</code>
  </section>
</main>
</body>
</html>`,
    "utf8"
  );
}

function writeReadme(path, packet) {
  const lines = [
    "# Original Goal Objective Next Lane Command Builder",
    "",
    `Status: ${packet.status}`,
    `Selected requirement: ${packet.selected.requirementId}`,
    "",
    `- Open review page: ${packet.command.openPath}`,
    `- Receipt template: ${packet.command.receiptTemplate}`,
    `- Validation command: ${packet.command.validationCommand}`,
    "",
    "Safety boundary:",
    "- This builder only maps the teacher-selected objective lane to existing review pages and validation commands.",
    "- It does not run commands, register tasks, launch runners, execute target software, capture screenshots, read logs, write memory, enable rules, unlock packaging, or claim completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const validationInput = readJsonInput(
  argValue("--validation", argValue("--objective-validation", "")),
  "--validation",
  "transparent_ai_original_goal_objective_fulfillment_receipt_validation_v1"
);
if (!validationInput.value) throw new Error("--validation is required");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-objective-next-lane-command-builders"))
);
mkdirSync(outputRoot, { recursive: true });
const built = buildCommandPacket(validationInput.value);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(built.selected.requirementId)}`;
const builderDir = join(outputRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const builderPath = join(builderDir, "original-goal-objective-next-lane-command-builder.json");
const htmlPath = join(builderDir, "original-goal-objective-next-lane-command-builder.html");
const readmePath = join(builderDir, "ORIGINAL_GOAL_OBJECTIVE_NEXT_LANE_COMMAND_BUILDER_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_original_goal_objective_next_lane_command_builder_v1",
  builderId,
  status: "objective_next_lane_review_command_ready",
  sourceValidationPath: validationInput.path,
  selected: built.selected,
  command: built.command,
  paths: {
    builder: builderPath,
    html: htmlPath,
    readme: readmePath
  },
  locks: locks()
};
writeFileSync(builderPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
writeHtml(htmlPath, packet);
writeReadme(readmePath, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_objective_next_lane_command_builder_result_v1",
      builderPath,
      htmlPath,
      readmePath,
      status: packet.status,
      selectedRequirementId: built.selected.requirementId
    },
    null,
    2
  )
);
