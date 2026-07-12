#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slugify(value) {
  return (
    String(value || "current-goal-teacher-spatial-drawing-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "current-goal-teacher-spatial-drawing-handoff"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  }
  return JSON.parse(result.stdout);
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandText(scriptName, args = []) {
  return ["node", join("plugins", "transparent-ai-apprentice", "scripts", scriptName), ...args]
    .filter((part) => part !== "" && part !== undefined && part !== null)
    .map(q)
    .join(" ");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path && existsSync(path) ? pathToFileURL(path).href : "";
}

function newestDirectoryWithFile(root, fileName) {
  if (!existsSync(root)) return "";
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(root, entry.name);
      const file = join(dir, fileName);
      return existsSync(file) ? { file, time: statSync(dir).mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.time - a.time)[0]?.file || "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    teacherExportedOverlayRequiredForRealEvidence: true,
    teacherReviewedDetailLogicRequiredBeforeNumberedConfirmation: true,
    handoffDoesNotCaptureScreenshots: true,
    handoffDoesNotReadFullLogs: true,
    handoffDoesNotExecuteTargetSoftware: true,
    handoffDoesNotRunSpatialTargetConfirmation: true,
    handoffDoesNotWriteMemory: true,
    handoffDoesNotEnableRules: true,
    samplePacketIsImplementationProofOnly: true,
    screenshotsCaptured: false,
    fullLogsRead: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function spatialCapabilitySummary(kit, sampleValidation) {
  return {
    transparentMaskAvailable: true,
    browserOverlayAvailable: Boolean(kit.browserOverlay),
    windowsTopMostOverlayAvailable: Boolean(kit.powershellOverlay),
    outputPacketFormat: "transparent_ai_sketch_overlay_packet_v1",
    coordinateSpace: {
      supports2D: true,
      supportsPerspectiveRelationships: true,
      supports3DDepthHints: true,
      units: "normalized_0_to_1",
      origin: "top_left_screen_or_screenshot"
    },
    teacherCanDraw: [
      "2d_position_or_plane_mark",
      "perspective_grid_or_relation",
      "3d_depth_axis_or_near_far_hint",
      "angle_direction_or_movement_vector",
      "semantic_label_or_target_anchor"
    ],
    sampleValidation: {
      readyForSpatialIntentEvidenceReceipt: sampleValidation.readyForSpatialIntentEvidenceReceipt === true,
      has2DPositionEvidence: sampleValidation.spatialEvidence?.has2DPositionEvidence === true,
      hasPerspectiveEvidence: sampleValidation.spatialEvidence?.hasPerspectiveEvidence === true,
      has3DDepthEvidence: sampleValidation.spatialEvidence?.has3DDepthEvidence === true,
      hasUniversalDetailLogicContract:
        sampleValidation.detailLogic?.ready === true || Array.isArray(sampleValidation.detailLogicRows)
    },
    executionBoundary: {
      requiresTeacherExportedPacket: true,
      requiresTeacherSpatialReceipt: true,
      requiresDepthRehearsalReviewForDepthClaims: true,
      requiresNumberedTargetConfirmation: true,
      executionPreparedHere: false,
      targetSoftwareExecutedHere: false
    }
  };
}

function writeHtml(path, handoff) {
  const link = (label, value) =>
    value && existsSync(value)
      ? `<a href="${htmlEscape(fileHref(value))}">${htmlEscape(label)}</a>`
      : `<span>${htmlEscape(label)}: missing</span>`;
  const commandItems = handoff.nextCommands
    .map((item) => `<li><strong>${htmlEscape(item.id)}</strong><pre>${htmlEscape(item.command)}</pre></li>`)
    .join("");
  const blockerItems = handoff.blockedActions.map((item) => `<li><code>${htmlEscape(item)}</code></li>`).join("");
  const evidenceRows = Object.entries(handoff.paths)
    .map(
      ([key, value]) => `<tr>
        <td><code>${htmlEscape(key)}</code></td>
        <td>${value ? link(value, value) : ""}</td>
      </tr>`
    )
    .join("");
  const capabilityRows = [
    ["Transparent mask", handoff.spatialCapabilitySummary.transparentMaskAvailable],
    ["Browser overlay", handoff.spatialCapabilitySummary.browserOverlayAvailable],
    ["Windows top-most overlay", handoff.spatialCapabilitySummary.windowsTopMostOverlayAvailable],
    ["2D position", handoff.spatialCapabilitySummary.sampleValidation.has2DPositionEvidence],
    ["Perspective relation", handoff.spatialCapabilitySummary.sampleValidation.hasPerspectiveEvidence],
    ["3D depth", handoff.spatialCapabilitySummary.sampleValidation.has3DDepthEvidence],
    ["Universal detail logic contract", handoff.spatialCapabilitySummary.sampleValidation.hasUniversalDetailLogicContract]
  ]
    .map(([label, value]) => `<tr><td>${htmlEscape(label)}</td><td><code>${htmlEscape(value)}</code></td></tr>`)
    .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Teacher Spatial Drawing Handoff</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #17202a; background: #f7f8fa; }
    main { max-width: 1080px; margin: 0 auto; }
    section { background: white; border: 1px solid #d9dee7; border-radius: 8px; padding: 18px; margin: 14px 0; }
    h1, h2 { margin: 0 0 12px; }
    code, pre { background: #f0f3f7; border-radius: 6px; }
    pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; }
    table { border-collapse: collapse; width: 100%; }
    td { border-top: 1px solid #e5e8ef; padding: 8px; vertical-align: top; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #9fb3c8; border-radius: 999px; background: #edf5ff; }
  </style>
</head>
<body>
<main>
  <h1>Teacher Spatial Drawing Handoff</h1>
  <p class="status">${htmlEscape(handoff.status)}</p>
  <section>
    <h2>Start Here</h2>
    <p>Use the overlay to draw 2D position, perspective relations, and 3D depth hints over the target software or a screenshot. Export the packet, validate it, then review the spatial receipt before any numbered target confirmation.</p>
    <p>${link("Browser transparent overlay", handoff.paths.browserOverlay)}</p>
    <p>${link("Windows top-most PowerShell overlay", handoff.paths.powershellOverlay)}</p>
    <p>${link("Teacher readme", handoff.paths.teacherReadme)}</p>
  </section>
  <section>
    <h2>Capability Summary</h2>
    <table>${capabilityRows}</table>
    <p><strong>Teacher can draw:</strong> ${htmlEscape(handoff.spatialCapabilitySummary.teacherCanDraw.join(", "))}</p>
    <p><strong>Execution boundary:</strong> teacher packet, spatial receipt, depth review, and numbered target confirmation are required before any target software execution gate.</p>
  </section>
  <section>
    <h2>Evidence</h2>
    <table>${evidenceRows}</table>
  </section>
  <section>
    <h2>Next Commands</h2>
    <ol>${commandItems}</ol>
  </section>
  <section>
    <h2>Blocked Actions</h2>
    <ul>${blockerItems}</ul>
  </section>
</main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, handoff) {
  writeFileSync(
    path,
    [
      "# Current Goal Teacher Spatial Drawing Handoff",
      "",
      `Status: ${handoff.status}`,
      "",
      "This is the shortest teacher-facing route for the transparent drawing mask requirement:",
      "",
      "1. Open the browser overlay or PowerShell top-most overlay.",
      "2. Draw 2D position, perspective relation, and 3D depth hints.",
      "3. Export `transparent_ai_sketch_overlay_packet_v1`.",
      "4. Validate the packet.",
      "5. Resolve the first spatial blocker into a teacher receipt.",
      "6. Only after teacher review, run a separate numbered target confirmation command.",
      "",
      "Locked defaults: reviewOnly=true, accepted=false, ruleEnabled=false, packagingGated=true, and no target software execution.",
      "",
      "Capability summary:",
      `- Browser transparent overlay: ${handoff.spatialCapabilitySummary.browserOverlayAvailable}`,
      `- Windows top-most overlay: ${handoff.spatialCapabilitySummary.windowsTopMostOverlayAvailable}`,
      `- 2D position evidence: ${handoff.spatialCapabilitySummary.sampleValidation.has2DPositionEvidence}`,
      `- Perspective relation evidence: ${handoff.spatialCapabilitySummary.sampleValidation.hasPerspectiveEvidence}`,
      `- 3D depth evidence: ${handoff.spatialCapabilitySummary.sampleValidation.has3DDepthEvidence}`,
      `- Universal detail logic contract: ${handoff.spatialCapabilitySummary.sampleValidation.hasUniversalDetailLogicContract}`,
      "",
      "HTML entry:",
      handoff.paths.html,
      "",
      "Next commands:",
      ...handoff.nextCommands.map((item) => `- ${item.id}: ${item.command}`)
    ].join("\n"),
    "utf8"
  );
}

const goal = argValue(
  "--goal",
  "Verify and use the transparent drawing mask so a teacher can demonstrate 2D position, perspective, and 3D depth intent before any software execution."
);
const software = argValue("--software", argValue("--app", "all local software / teacher-selected engineering software"));
const overlayPacket = argValue(
  "--overlay-packet",
  argValue("--teacher-exported-overlay-packet", argValue("--transparent-sketch-packet", ""))
);
const refresh =
  argValue("--refresh", argValue("--current-status-refresh", "")) ||
  newestDirectoryWithFile(join(repoRoot, "artifacts", "original-goal-current-status-refreshes"), "original-goal-current-status-refresh.json");
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-teacher-spatial-drawing-handoffs"))
);
mkdirSync(outputRoot, { recursive: true });
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const handoffDir = join(outputRoot, handoffId);
mkdirSync(handoffDir, { recursive: true });

const kit = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--mode",
  "2d_3d",
  "--output-dir",
  join(handoffDir, "overlay-kit")
]);

const sampleValidation = runNodeScript("validate-transparent-sketch-overlay-packet.mjs", [
  "--overlay-packet",
  kit.samplePacket,
  "--output-dir",
  join(handoffDir, "sample-overlay-packet-validation")
]);
const sampleValidationPacket = readJson(sampleValidation.validationPath);

let teacherValidation = null;
let teacherResolution = null;
if (overlayPacket) {
  teacherValidation = runNodeScript("validate-transparent-sketch-overlay-packet.mjs", [
    "--overlay-packet",
    overlayPacket,
    "--output-dir",
    join(handoffDir, "teacher-overlay-packet-validation")
  ]);
  const args = [];
  if (refresh) args.push("--refresh", refresh);
  args.push("--overlay-packet", overlayPacket, "--output-dir", join(handoffDir, "teacher-spatial-first-blocker-resolution"));
  teacherResolution = runNodeScript("resolve-spatial-first-blocker-overlay-packet.mjs", args);
}

const status = overlayPacket
  ? teacherResolution?.readyForNextSpatialConfirmation
    ? "teacher_packet_ready_for_separate_numbered_target_confirmation_review"
    : "teacher_packet_received_but_waiting_for_spatial_receipt_or_detail_logic_review"
  : "waiting_for_teacher_exported_overlay_packet";

const validateTeacherPacketCommand = commandText("validate-transparent-sketch-overlay-packet.mjs", [
  "--overlay-packet",
  "<teacher-exported-transparent-sketch-packet.json>",
  "--output-dir",
  join("artifacts", "current-goal-transparent-sketch-overlay-packet-validations")
]);
const resolveTeacherPacketCommand = commandText("resolve-spatial-first-blocker-overlay-packet.mjs", [
  refresh ? "--refresh" : "",
  refresh,
  "--overlay-packet",
  "<teacher-exported-transparent-sketch-packet.json>",
  "--output-dir",
  join("artifacts", "current-goal-spatial-first-blocker-overlay-resolutions")
]);
const numberedTargetCommand = commandText("create-spatial-target-confirmation-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  "<teacher-reviewed-transparent-sketch-packet.json>",
  "--create-action-kit",
  "--create-execution-adapter",
  "--output-dir",
  join("artifacts", "current-goal-spatial-target-confirmation-kits")
]);
const depthRehearsalCommand = commandText("create-transparent-sketch-depth-demonstration-rehearsal.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  "<teacher-reviewed-transparent-sketch-packet.json>",
  "--output-dir",
  join("artifacts", "current-goal-transparent-sketch-depth-demonstration-rehearsals")
]);
const logicContractRuleDraftCommand = commandText("create-transparent-sketch-logic-contract-rule-draft.mjs", [
  "--rehearsal",
  "<teacher-reviewed-transparent-sketch-depth-demonstration-rehearsal.json>",
  "--rollback-point",
  "<retained-rollback-point>",
  "--teacher-reviewed-spatial-intent",
  "--output-dir",
  join("artifacts", "current-goal-transparent-sketch-logic-contract-rule-drafts")
]);

const handoffPath = join(handoffDir, "current-goal-teacher-spatial-drawing-handoff.json");
const htmlPath = join(handoffDir, "current-goal-teacher-spatial-drawing-handoff.html");
const readmePath = join(handoffDir, "CURRENT_GOAL_TEACHER_SPATIAL_DRAWING_START_HERE.md");
const lockState = locks();
const capabilitySummary = spatialCapabilitySummary(kit, sampleValidationPacket);
const handoff = {
  ok: true,
  format: "transparent_ai_current_goal_teacher_spatial_drawing_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  goal,
  software,
  status,
  realTeacherOverlayPacketProvided: Boolean(overlayPacket),
  implementedNow: {
    transparentDrawingMaskKitCreated: true,
    browserTransparentOverlay: true,
    windowsTopMostOverlay: true,
    exportsLowTokenOverlayPacket: true,
    validates2DPositionPerspective3DDepth: sampleValidation.readyForSpatialIntentEvidenceReceipt === true,
    teacherExportedPacketValidated: Boolean(teacherValidation?.readyForSpatialIntentEvidenceReceipt),
    spatialFirstBlockerResolverAvailable: true,
    numberedTargetConfirmationCommandPreparedButNotRun: true,
    logicContractRuleDraftCommandPreparedButNotRun: true,
    targetSoftwareExecutionPreparedButNotRun: true
  },
  spatialCapabilitySummary: capabilitySummary,
  proofOnlySample: {
    samplePacket: kit.samplePacket,
    validationPath: sampleValidation.validationPath,
    validationStatus: sampleValidation.status,
    notTeacherEvidence: true
  },
  teacherPacketReview: teacherValidation
    ? {
        validationPath: teacherValidation.validationPath,
        validationStatus: teacherValidation.status,
        readyForSpatialIntentEvidenceReceipt: teacherValidation.readyForSpatialIntentEvidenceReceipt,
        resolutionPath: teacherResolution?.resolutionPath || "",
        resolutionStatus: teacherResolution?.status || "",
        readyForNextSpatialConfirmation: teacherResolution?.readyForNextSpatialConfirmation === true
      }
    : null,
  nextCommands: [
    {
      id: "validate_teacher_exported_overlay_packet",
      purpose: "Prove the real teacher packet contains 2D, perspective, 3D depth, and universal detail logic evidence.",
      command: validateTeacherPacketCommand
    },
    {
      id: "prefill_and_validate_spatial_receipt",
      purpose: "Convert the valid overlay packet into a review-only spatial intent receipt and keep execution locked.",
      command: resolveTeacherPacketCommand
    },
    {
      id: "after_teacher_review_create_numbered_targets",
      purpose: "Only after teacher detail-logic review, create numbered possible target locations for confirmation.",
      command: numberedTargetCommand
    },
    {
      id: "optional_depth_demonstration_rehearsal",
      purpose: "Rehearse the 2D/perspective/3D depth chain as a dry-run package without executing target software.",
      command: depthRehearsalCommand
    },
    {
      id: "after_teacher_review_create_logic_contract_rule_draft",
      purpose:
        "Convert teacher-reviewed 2D position, angle/direction, perspective, 3D depth, and universal detail logic into draft_disabled Rule DSL cards before any execution.",
      command: logicContractRuleDraftCommand
    }
  ],
  logicContractRuleDraftActionPack: {
    status: "waiting_for_teacher_reviewed_spatial_intent_and_retained_rollback",
    sourceRequirement: "teacher-reviewed transparent sketch spatial intent or depth rehearsal",
    requiredOrder: [
      "teacher exports and reviews a real transparent sketch packet",
      "packet validation proves 2D position, perspective, 3D depth, and universal detail logic contract evidence",
      "spatial receipt or depth rehearsal is reviewed by teacher",
      "retained rollback point is confirmed present",
      "draft_disabled Rule DSL package is compiled",
      "validation report and delivery gate remain separate teacher-reviewed steps before any execution"
    ],
    commandTemplate: logicContractRuleDraftCommand,
    outputsOnlyDraftDisabledRules: true,
    executeNow: false,
    enableRulesNow: false,
    writeMemoryNow: false,
    packagingUnlockedNow: false,
    goalCompleteNow: false
  },
  blockedActions: [
    "treat_sample_packet_as_teacher_evidence",
    "infer_teacher_approval_from_valid_packet",
    "run_numbered_target_confirmation_inside_this_handoff",
    "compile_active_spatial_rules_inside_this_handoff",
    "enable_logic_contract_rules_inside_this_handoff",
    "execute_target_software_inside_this_handoff",
    "capture_screenshots_inside_this_handoff",
    "read_full_logs_inside_this_handoff",
    "write_memory_inside_this_handoff",
    "enable_rule_inside_this_handoff",
    "claim_original_goal_complete_inside_this_handoff"
  ],
  paths: {
    handoff: handoffPath,
    html: htmlPath,
    readme: readmePath,
    overlayKit: kit.kitPath,
    teacherReadme: kit.teacherReadme,
    overlayHtml: kit.browserOverlay,
    overlayPowershell: kit.powershellOverlay,
    sampleOverlayPacket: kit.samplePacket,
    browserOverlay: kit.browserOverlay,
    powershellOverlay: kit.powershellOverlay,
    samplePacket: kit.samplePacket,
    sampleValidation: sampleValidation.validationPath,
    teacherOverlayPacket: overlayPacket && existsSync(overlayPacket) ? resolve(overlayPacket) : overlayPacket,
    teacherValidation: teacherValidation?.validationPath || "",
    teacherResolution: teacherResolution?.resolutionPath || "",
    currentStatusRefresh: refresh
  },
  locks: lockState,
  goalComplete: false
};

writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
writeHtml(htmlPath, handoff);
writeReadme(readmePath, handoff);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_current_goal_teacher_spatial_drawing_handoff_result_v1",
      status,
      handoffPath,
      htmlPath,
      readmePath,
      browserOverlay: kit.browserOverlay,
      powershellOverlay: kit.powershellOverlay,
      samplePacket: kit.samplePacket,
      sampleValidation: sampleValidation.validationPath,
      teacherValidation: teacherValidation?.validationPath || "",
      teacherResolution: teacherResolution?.resolutionPath || "",
      locks: lockState
    },
    null,
    2
  )
);
