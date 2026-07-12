#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
    String(value || "transparent-sketch-depth-demonstration-rehearsal")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "transparent-sketch-depth-demonstration-rehearsal"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileHref(path) {
  return `file:///${String(path).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
}

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function jsonInputToPath(input, outPath, label) {
  const text = String(input || "").trim();
  if (!text) return "";
  if (existsSync(text)) return resolve(text);
  if (text.startsWith("{")) {
    writeFileSync(outPath, `${JSON.stringify(JSON.parse(text), null, 2)}\n`, "utf8");
    return outPath;
  }
  throw new Error(`${label} must be a JSON path or inline JSON object.`);
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    teacherReviewRequired: true,
    selectedNumberRequiredBeforeRoute: true,
    rehearsalDoesNotCaptureScreenshots: true,
    rehearsalDoesNotExecuteSoftware: true,
    rehearsalDoesNotSendUiEvents: true,
    rehearsalDoesNotWriteMemory: true,
    rehearsalDoesNotEnableRules: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    rawFullLogsRetained: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function evidenceChecks({ overlayPacket, spatialIntent, targetConfirmation, routeBridge, routeReceipt, confirmationReceipt }) {
  const detailRows = spatialIntent.detailLogicContract?.consequentialDetailRows || [];
  const routeReady = routeBridge.status === "spatial_target_bound_to_execution_routes_waiting_for_dry_run_review";
  return [
    {
      name: "Transparent mask exports 2D perspective and 3D depth sketch evidence",
      pass:
        overlayPacket.format === "transparent_ai_sketch_overlay_packet_v1" &&
        overlayPacket.coordinateSpace?.supports2D === true &&
        overlayPacket.coordinateSpace?.supportsPerspectiveRelationships === true &&
        overlayPacket.coordinateSpace?.supports3DDepthHints === true &&
        overlayPacket.strokes?.some((stroke) => stroke.mode === "screen_2d") &&
        overlayPacket.strokes?.some((stroke) => stroke.mode === "perspective_grid") &&
        overlayPacket.strokes?.some((stroke) => stroke.mode === "depth_axis_3d"),
      evidence: "screen_2d + perspective_grid + depth_axis_3d"
    },
    {
      name: "Spatial interpreter derives position perspective and depth relationships",
      pass:
        spatialIntent.format === "transparent_ai_spatial_intent_interpretation_v1" &&
        spatialIntent.summary?.supports2D === true &&
        spatialIntent.summary?.supports3DDepthHints === true &&
        spatialIntent.inferredRelationships?.some((row) => row.relation === "perspective_to") &&
        spatialIntent.inferredRelationships?.some((row) => row.relation === "nearer_than"),
      evidence: "transparent_ai_spatial_intent_interpretation_v1"
    },
    {
      name: "Every consequential sketch detail is logicized before route planning",
      pass:
        spatialIntent.detailLogicContract?.format === "transparent_ai_universal_detail_logic_contract_v1" &&
        spatialIntent.detailLogicContract?.missingLogicSourceBehavior === "block_execute_and_route_to_teacher_review" &&
        detailRows.some((row) => row.detailCategory === "position/alignment/relation") &&
        detailRows.some((row) => row.detailCategory === "angular/curvature") &&
        detailRows.some((row) => row.detailCategory === "view/depth/perspective") &&
        Number(spatialIntent.detailLogicContract?.missingDetailLogicCount || 0) === 0,
      evidence: `${detailRows.length} detail logic rows`
    },
    {
      name: "Sketch intent becomes numbered targets before any software action",
      pass:
        targetConfirmation.format === "transparent_ai_numbered_target_confirmation_v1" &&
        targetConfirmation.candidates?.length >= 2 &&
        targetConfirmation.spatialEvidenceSummary?.supports2D === true &&
        targetConfirmation.spatialEvidenceSummary?.supportsPerspectiveRelationships === true &&
        targetConfirmation.spatialEvidenceSummary?.supports3DDepthHints === true,
      evidence: `${targetConfirmation.candidates?.length || 0} numbered candidates`
    },
    {
      name: "Confirmed number narrows the route to one selected target when provided",
      pass:
        routeReady ||
        (routeBridge.status === "waiting_for_numbered_spatial_target_confirmation" &&
          routeReceipt.nextRequiredGate === "teacher_numbered_target_confirmation") ||
        (confirmationReceipt?.evidence?.selectedTargetOnly === true && routeReceipt.selectedTargetOnly === true),
      evidence: routeBridge.status
    },
    {
      name: "Rehearsal never captures screenshots executes software writes memory or unlocks packaging",
      pass:
        routeReceipt.softwareActionsExecuted === false &&
        routeReceipt.targetSoftwareCommandsExecuted === false &&
        routeReceipt.screenshotsCaptured === false &&
        routeReceipt.memoryWritten === false &&
        routeReceipt.accepted === false &&
        routeReceipt.ruleEnabled === false &&
        routeReceipt.packagingGated === true,
      evidence: "all execution and learning locks remain closed"
    }
  ];
}

function writeHtml(path, packet) {
  const rows = packet.checks
    .map(
      (check) =>
        `<tr><td>${htmlEscape(check.pass ? "pass" : "fail")}</td><td>${htmlEscape(check.name)}</td><td>${htmlEscape(check.evidence)}</td></tr>`
    )
    .join("\n");
  const links = Object.entries(packet.paths)
    .filter(([, value]) => value)
    .map(([key, value]) => `<li><a href="${htmlEscape(fileHref(value))}">${htmlEscape(key)}</a></li>`)
    .join("\n");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Transparent Sketch Depth Demonstration Rehearsal</title>
  <style>
    body { margin: 0; font: 14px/1.45 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 17px; margin-top: 24px; }
    .status { display: inline-block; padding: 4px 8px; border: 1px solid #7c8a99; border-radius: 6px; background: white; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #d6dde5; }
    th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid #e3e8ef; }
    code { background: #edf1f5; padding: 1px 4px; border-radius: 4px; }
    a { color: #0b5cad; }
  </style>
</head>
<body>
  <main>
    <h1>Transparent Sketch Depth Demonstration Rehearsal</h1>
    <p class="status">${htmlEscape(packet.status)}</p>
    <p>Goal: ${htmlEscape(packet.goal)}</p>
    <p>Software: ${htmlEscape(packet.software)}</p>
    <h2>Evidence</h2>
    <ul>${links}</ul>
    <h2>Checks</h2>
    <table>
      <thead><tr><th>Result</th><th>Check</th><th>Evidence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Next Gate</h2>
    <p>${htmlEscape(packet.nextRequiredGate)}</p>
  </main>
</body>
</html>`;
  writeFileSync(path, html, "utf8");
}

const goal = argValue(
  "--goal",
  argValue(
    "--task",
    "Rehearse transparent 2D perspective 3D sketch understanding before dry-run software execution planning."
  )
);
const software = argValue("--software", argValue("--app", "target engineering software"));
const command = argValue(
  "--command",
  "Apply the teacher sketch intent while preserving 2D position, perspective relation, and 3D depth."
);
const preferredAdapter = argValue("--preferred-adapter", "existing-windows-ui-automation");
const maxCandidates = argValue("--max-candidates", "6");
const selectedNumber = Number(argValue("--selected-number", argValue("--number", "")));
const teacherConfirmedNumber =
  hasFlag("--teacher-confirmed-number") ||
  ["true", "1", "yes"].includes(String(argValue("--teacher-confirmed", "")).toLowerCase());
const selectedNumberReady = Number.isInteger(selectedNumber) && selectedNumber > 0 && teacherConfirmedNumber;
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, ".transparent-apprentice", "transparent-sketch-depth-demonstration-rehearsals"))
);

mkdirSync(outputRoot, { recursive: true });
const rehearsalId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(`${software}-${goal}`)}`;
const rehearsalDir = join(outputRoot, rehearsalId);
mkdirSync(rehearsalDir, { recursive: true });

const overlayInput = argValue("--overlay-packet", argValue("--transparent-sketch-packet", ""));
let overlayKit = null;
let overlayPacketPath = "";
if (overlayInput) {
  overlayPacketPath = jsonInputToPath(overlayInput, join(rehearsalDir, "provided-transparent-sketch-packet.json"), "--overlay-packet");
} else {
  overlayKit = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
    "--goal",
    goal,
    "--software",
    software,
    "--mode",
    "screen_2d_perspective_3d",
    "--output-dir",
    join(rehearsalDir, "transparent-overlay-kit")
  ]);
  overlayPacketPath = overlayKit.samplePacket;
}

const spatialIntent = runNodeScript("interpret-transparent-sketch-spatial-intent.mjs", [
  "--overlay-packet",
  overlayPacketPath,
  "--output-dir",
  join(rehearsalDir, "spatial-intent")
]);

const targetConfirmation = runNodeScript("create-spatial-target-confirmation-kit.mjs", [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  overlayPacketPath,
  "--spatial-intent",
  spatialIntent.interpretationPath,
  "--command",
  command,
  "--max-candidates",
  String(maxCandidates),
  "--output-dir",
  join(rehearsalDir, "spatial-target-confirmation")
]);

let confirmedTarget = null;
if (selectedNumberReady) {
  confirmedTarget = runNodeScript("confirm-engineering-command-target.mjs", [
    "--confirmation",
    targetConfirmation.targetConfirmation,
    "--selected-number",
    String(selectedNumber),
    "--goal",
    goal,
    "--software",
    software,
    "--create-action-kit",
    "--create-execution-adapter",
    "--preferred-adapter",
    preferredAdapter,
    "--output-dir",
    join(rehearsalDir, "confirmed-spatial-target"),
    "--action-output-dir",
    join(rehearsalDir, "confirmed-spatial-target", "supervised-action-kits"),
    "--execution-adapter-output-dir",
    join(rehearsalDir, "confirmed-spatial-target", "execution-adapter-selection")
  ]);
}

const routeBridgeArgs = [
  "--goal",
  goal,
  "--software",
  software,
  "--overlay-packet",
  overlayPacketPath,
  "--spatial-intent",
  spatialIntent.interpretationPath,
  "--target-confirmation",
  targetConfirmation.targetConfirmation,
  "--preferred-adapter",
  preferredAdapter,
  "--output-dir",
  join(rehearsalDir, "spatial-software-execution-route")
];
if (selectedNumberReady) {
  routeBridgeArgs.push("--selected-number", String(selectedNumber));
  if (confirmedTarget?.receipt) routeBridgeArgs.push("--confirmation-receipt", confirmedTarget.receipt);
}
const routeBridge = runNodeScript("create-spatial-software-execution-route-bridge.mjs", routeBridgeArgs);

const overlayPacket = readJson(overlayPacketPath);
const spatialIntentJson = readJson(spatialIntent.interpretationPath);
const targetConfirmationJson = readJson(targetConfirmation.targetConfirmation);
const routeBridgeJson = readJson(routeBridge.bridgePath);
const routeReceipt = readJson(routeBridge.receiptPath);
const confirmationReceipt = confirmedTarget?.receipt ? readJson(confirmedTarget.receipt) : null;
const checks = evidenceChecks({
  overlayPacket,
  spatialIntent: spatialIntentJson,
  targetConfirmation: targetConfirmationJson,
  routeBridge: routeBridgeJson,
  routeReceipt,
  confirmationReceipt
});
const failed = checks.filter((check) => !check.pass);

const rehearsalPath = join(rehearsalDir, "transparent-sketch-depth-demonstration-rehearsal.json");
const readmePath = join(rehearsalDir, "TRANSPARENT_SKETCH_DEPTH_REHEARSAL_START_HERE.md");
const htmlPath = join(rehearsalDir, "transparent-sketch-depth-demonstration-rehearsal.html");
const packet = {
  format: "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1",
  rehearsalId,
  createdAt: new Date().toISOString(),
  status:
    failed.length > 0
      ? "failed_rehearsal_checks"
      : selectedNumberReady
        ? "depth_demonstration_rehearsed_waiting_for_dry_run_route_review"
        : "waiting_for_teacher_numbered_spatial_target_confirmation",
  goal,
  software,
  command,
  selectedNumber: selectedNumberReady ? selectedNumber : 0,
  teacherConfirmedNumber: selectedNumberReady,
  reusedTools: [
    "create-transparent-sketch-overlay-kit.mjs",
    "interpret-transparent-sketch-spatial-intent.mjs",
    "create-spatial-target-confirmation-kit.mjs",
    "confirm-engineering-command-target.mjs",
    "create-spatial-software-execution-route-bridge.mjs",
    "create-supervised-software-action-kit.mjs",
    "create-existing-software-execution-adapter.mjs"
  ],
  capabilitiesRehearsed: {
    transparentDrawingMask: true,
    teacher2DSketchUnderstood: true,
    teacherPerspectiveSketchUnderstood: true,
    teacher3DDepthSketchUnderstood: true,
    universalDetailLogicContractPreserved: true,
    visualSimilarityRejectedWithoutLogic: true,
    numberedTargetConfirmationRequired: true,
    dryRunSoftwareRoutePreparedOnlyAfterConfirmedNumber: selectedNumberReady,
    targetSoftwareExecuted: false
  },
  paths: {
    rehearsal: rehearsalPath,
    readme: readmePath,
    html: htmlPath,
    overlayKit: overlayKit?.kitPath || "",
    overlayPacket: overlayPacketPath,
    spatialIntent: spatialIntent.interpretationPath,
    targetConfirmationKit: targetConfirmation.kitPath || "",
    targetConfirmation: targetConfirmation.targetConfirmation,
    confirmationReceipt: confirmedTarget?.receipt || "",
    narrowedOverlayPacket: confirmedTarget?.narrowedOverlayPacket || "",
    supervisedActionKit: confirmedTarget?.supervisedActionKit || "",
    existingExecutionPackage: confirmedTarget?.existingExecutionPackage || "",
    routeBridge: routeBridge.bridgePath,
    routeReceipt: routeBridge.receiptPath
  },
  nextRequiredGate: selectedNumberReady
    ? "teacher_reviewed_dry_run_route_before_any_execute_request"
    : "teacher_must_confirm_exactly_one_number_or_correct_candidates",
  checks,
  locks: locks()
};
writeJson(rehearsalPath, packet);
writeHtml(htmlPath, packet);
writeFileSync(
  readmePath,
  [
    "# Transparent Sketch Depth Demonstration Rehearsal",
    "",
    `Status: ${packet.status}`,
    `Goal: ${goal}`,
    `Software: ${software}`,
    "",
    "This package reuses the existing transparent overlay, spatial interpreter, numbered target confirmation, and dry-run route bridge. It is meant to prove that 2D position, perspective, and 3D depth demonstrations are wired together before any real software action.",
    "",
    `Open the HTML summary: ${htmlPath}`,
    "",
    "Important evidence:",
    `- Overlay packet: ${overlayPacketPath}`,
    `- Spatial intent: ${spatialIntent.interpretationPath}`,
    `- Numbered target confirmation: ${targetConfirmation.targetConfirmation}`,
    `- Route bridge: ${routeBridge.bridgePath}`,
    "",
    selectedNumberReady
      ? "A teacher-confirmed number was supplied for rehearsal, so the selected target has been narrowed and dry-run route review material was prepared. No target software was executed."
      : "No teacher-confirmed number was supplied, so the package stops at numbered spatial target confirmation. Confirm exactly one number before route planning.",
    "",
    "Locked defaults: screenshotsCaptured=false, softwareActionsExecuted=false, targetSoftwareCommandsExecuted=false, uiEventsSent=false, memoryWritten=false, accepted=false, ruleEnabled=false, packagingGated=true, nativeUniversalExecution=false."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      format: "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_result_v1",
      rehearsalId,
      status: packet.status,
      rehearsalPath,
      readmePath,
      htmlPath,
      overlayPacket: overlayPacketPath,
      spatialIntent: spatialIntent.interpretationPath,
      targetConfirmation: targetConfirmation.targetConfirmation,
      routeBridge: routeBridge.bridgePath,
      routeReceipt: routeBridge.receiptPath,
      selectedNumber: packet.selectedNumber,
      checksPassed: checks.length - failed.length,
      checksTotal: checks.length,
      reviewLocks: locks()
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
