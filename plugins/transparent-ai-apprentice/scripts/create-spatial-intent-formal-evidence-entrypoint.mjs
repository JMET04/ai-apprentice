#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "spatial-intent-formal-evidence-entrypoint")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 84) || "spatial-intent-formal-evidence-entrypoint"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function latestRefreshPath(root) {
  const refreshRoot = resolve(root || join(process.cwd(), ".transparent-apprentice", "original-goal-current-status-refreshes"));
  if (!existsSync(refreshRoot)) return "";
  const latest = readdirSync(refreshRoot)
    .map((name) => join(refreshRoot, name))
    .filter((path) => {
      try {
        return statSync(path).isDirectory() && existsSync(join(path, "original-goal-current-status-refresh.json"));
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  return latest ? join(latest, "original-goal-current-status-refresh.json") : "";
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

function closedLocks() {
  return {
    reviewOnly: true,
    entrypointOnly: true,
    demoPacketIsNotTeacherEvidence: true,
    teacherMustExportOrConfirmRealOverlayPacket: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    entrypointDoesNotValidateReceipt: true,
    entrypointDoesNotRunSpatialTargetConfirmation: true,
    entrypointDoesNotExecuteSoftware: true,
    entrypointDoesNotCaptureScreenshots: true,
    entrypointDoesNotWriteMemory: true,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function sampleOverlayPacket(goal, sourceRehearsalPath) {
  return {
    format: "transparent_ai_sketch_overlay_packet_v1",
    packetId: `${new Date().toISOString().replace(/[:.]/g, "-")}-formal-spatial-demo-packet`,
    createdAt: new Date().toISOString(),
    evidenceClass: "demo_structure_not_teacher_evidence",
    goal,
    sourceRehearsal: sourceRehearsalPath,
    coordinateSpace: {
      frame: "transparent_overlay_screen_space_with_depth_hints",
      units: "normalized_screen_coordinate",
      supports2D: true,
      supportsPerspectiveRelationships: true,
      supports3DDepthHints: true
    },
    anchors: [
      { id: "target_surface", label: "teacher-marked target surface", box: [0.18, 0.22, 0.64, 0.58] },
      { id: "far_reference", label: "teacher-marked far reference", box: [0.62, 0.1, 0.82, 0.3] }
    ],
    strokes: [
      {
        id: "stroke_2d_anchor",
        mode: "2d_position_anchor",
        targetAnchor: "target_surface",
        points: [
          { x: 0.22, y: 0.32, zHint: 0 },
          { x: 0.46, y: 0.32, zHint: 0 },
          { x: 0.46, y: 0.5, zHint: 0 }
        ],
        teacherIntentSlot: "position_or_outline"
      },
      {
        id: "stroke_angle_direction",
        mode: "angle_direction_vector",
        points: [
          { x: 0.28, y: 0.48, zHint: 0 },
          { x: 0.54, y: 0.28, zHint: 0 }
        ],
        teacherIntentSlot: "angle_or_direction"
      },
      {
        id: "stroke_perspective_depth",
        mode: "perspective_3d_depth_hint",
        depthHint: "near_to_far",
        points: [
          { x: 0.36, y: 0.54, zHint: 0.1 },
          { x: 0.54, y: 0.42, zHint: 0.45 },
          { x: 0.72, y: 0.25, zHint: 0.78 }
        ],
        teacherIntentSlot: "perspective_or_depth"
      }
    ],
    spatialIntent: {
      supports2DPosition: true,
      supportsPerspectiveRelationships: true,
      supports3DDepthHints: true,
      relationships: [
        {
          from: "stroke_perspective_depth",
          to: "far_reference",
          relation: "perspective_converges_toward"
        },
        {
          from: "stroke_perspective_depth.points[0]",
          to: "stroke_perspective_depth.points[2]",
          relation: "nearer_than"
        }
      ],
      perspectiveCues: [
        { cue: "perspective_vanish_direction", from: "target_surface", to: "far_reference" },
        { cue: "3d_depth_near_far_gradient", from: "stroke_perspective_depth.points[0]", to: "stroke_perspective_depth.points[2]" }
      ]
    },
    teacherConfirmationRequired:
      "A teacher must export or confirm a real overlay packet before this structure can be used for spatial target confirmation."
  };
}

function pointHasDepth(point) {
  return point && point.zHint !== undefined && point.zHint !== null && Number(point.zHint) !== 0;
}

function dimensionCheck(packet) {
  const strokes = Array.isArray(packet?.strokes) ? packet.strokes : [];
  const anchors = Array.isArray(packet?.anchors) ? packet.anchors : [];
  const relationships = Array.isArray(packet?.spatialIntent?.relationships) ? packet.spatialIntent.relationships : [];
  const perspectiveCues = Array.isArray(packet?.spatialIntent?.perspectiveCues) ? packet.spatialIntent.perspectiveCues : [];
  const allPoints = strokes.flatMap((stroke) => (Array.isArray(stroke.points) ? stroke.points : []));
  const has2DPositionEvidence =
    packet?.coordinateSpace?.supports2D === true ||
    packet?.spatialIntent?.supports2DPosition === true ||
    anchors.some((anchor) => Array.isArray(anchor.box) && anchor.box.length >= 4) ||
    allPoints.some((point) => point.x !== undefined && point.y !== undefined);
  const hasAngleOrDirectionEvidence = strokes.some((stroke) => {
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    if (String(stroke.mode || "").includes("angle") || String(stroke.mode || "").includes("direction")) return true;
    if (points.length < 2) return false;
    const first = points[0];
    const last = points[points.length - 1];
    return first?.x !== last?.x || first?.y !== last?.y;
  });
  const hasPerspectiveEvidence =
    packet?.coordinateSpace?.supportsPerspectiveRelationships === true ||
    packet?.spatialIntent?.supportsPerspectiveRelationships === true ||
    strokes.some((stroke) => String(stroke.mode || "").includes("perspective")) ||
    relationships.some((row) => String(row.relation || "").includes("perspective")) ||
    perspectiveCues.some((row) => String(row.cue || "").includes("perspective"));
  const has3DDepthEvidence =
    packet?.coordinateSpace?.supports3DDepthHints === true ||
    packet?.spatialIntent?.supports3DDepthHints === true ||
    strokes.some((stroke) => String(stroke.mode || "").includes("3d") || String(stroke.depthHint || "").includes("near") || String(stroke.depthHint || "").includes("far")) ||
    relationships.some((row) => ["nearer_than", "farther_than"].includes(String(row.relation || ""))) ||
    perspectiveCues.some((row) => String(row.cue || "").includes("3d")) ||
    allPoints.some(pointHasDepth);
  const checks = {
    has2DPositionEvidence,
    hasAngleOrDirectionEvidence,
    hasPerspectiveEvidence,
    has3DDepthEvidence
  };
  return {
    ...checks,
    ready: Object.values(checks).every(Boolean),
    missingDimensions: Object.entries(checks)
      .filter(([, value]) => value !== true)
      .map(([key]) => key),
    strokeCount: strokes.length,
    anchorCount: anchors.length,
    relationshipCount: relationships.length,
    perspectiveCueCount: perspectiveCues.length
  };
}

function writeReadme(path, entrypoint) {
  const lines = [
    "# Spatial Intent Formal Evidence Entrypoint",
    "",
    `Status: ${entrypoint.status}`,
    `Dimension-ready demo packet: ${entrypoint.dimensionCheck.ready}`,
    "",
    "This entrypoint proves that the transparent overlay packet can represent 2D position, angle or direction, perspective relation, and 3D depth hints in a machine-checkable shape.",
    "It is not teacher evidence. A teacher must export or confirm a real overlay packet and fill the teacher receipt before spatial target confirmation or software execution can proceed.",
    "",
    "Open in order:",
    `1. Entrypoint JSON: ${entrypoint.paths.entrypoint}`,
    `2. Demo overlay packet: ${entrypoint.paths.demoOverlayPacket}`,
    `3. Teacher receipt template: ${entrypoint.paths.teacherReceiptTemplate}`,
    `4. HTML: ${entrypoint.paths.html}`,
    "",
    "Next command after real teacher export:",
    entrypoint.nextValidationCommand,
    "",
    "Locks:",
    ...Object.entries(entrypoint.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, entrypoint) {
  const checks = Object.entries(entrypoint.dimensionCheck)
    .filter(([, value]) => typeof value === "boolean")
    .map(([key, value]) => `<li><code>${htmlEscape(key)}</code>: ${htmlEscape(value)}</li>`)
    .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spatial Intent Formal Evidence Entrypoint</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f6f8fb; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 15px; margin: 14px 0; }
    code { background: #edf3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Spatial Intent Formal Evidence Entrypoint</h1>
  <section class="panel">
    <p><strong>Status:</strong> <code>${htmlEscape(entrypoint.status)}</code></p>
    <p><strong>Teacher evidence status:</strong> <code>${htmlEscape(entrypoint.teacherEvidenceStatus)}</code></p>
    <p><strong>Demo overlay packet:</strong> <a href="${htmlEscape(fileHref(entrypoint.paths.demoOverlayPacket))}">${htmlEscape(entrypoint.paths.demoOverlayPacket)}</a></p>
    <p>This entrypoint is review-only. It does not validate a receipt, run target confirmation, capture screenshots, execute software, write memory, enable rules, unlock packaging, or claim completion.</p>
  </section>
  <section class="panel">
    <h2>Dimension Check</h2>
    <ul>${checks}</ul>
  </section>
  <section class="panel">
    <h2>Next Teacher Step</h2>
    <p>${htmlEscape(entrypoint.nextTeacherAction)}</p>
    <p><code>${htmlEscape(entrypoint.nextValidationCommand)}</code></p>
  </section>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

const refreshPath = resolve(argValue("--refresh", latestRefreshPath(argValue("--refresh-root", ""))));
if (!refreshPath || !existsSync(refreshPath)) {
  throw new Error("Usage: node create-spatial-intent-formal-evidence-entrypoint.mjs --refresh <original-goal-current-status-refresh.json>");
}
const refresh = readJson(refreshPath);
const requestPath = resolve(argValue("--request", refresh.paths?.spatialIntentEvidenceRequest || ""));
const receiptBuilderPath = resolve(argValue("--receipt-builder", refresh.paths?.spatialIntentEvidenceReceiptBuilder || ""));
const rehearsalPath = resolve(argValue("--rehearsal", refresh.paths?.transparentSketchDepthDemonstrationRehearsal || ""));
if (!existsSync(requestPath)) throw new Error("--request path does not exist");
if (!existsSync(receiptBuilderPath)) throw new Error("--receipt-builder path does not exist");
if (!existsSync(rehearsalPath)) throw new Error("--rehearsal path does not exist");

const request = readJson(requestPath);
const receiptBuilder = readJson(receiptBuilderPath);
const rehearsal = readJson(rehearsalPath);
if (request.format !== "transparent_ai_spatial_intent_evidence_request_v1") {
  throw new Error("--request must be transparent_ai_spatial_intent_evidence_request_v1");
}
if (receiptBuilder.format !== "transparent_ai_spatial_intent_evidence_receipt_builder_v1") {
  throw new Error("--receipt-builder must be transparent_ai_spatial_intent_evidence_receipt_builder_v1");
}
if (rehearsal.format !== "transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1") {
  throw new Error("--rehearsal must be transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1");
}

const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "spatial-intent-formal-evidence-entrypoints")));
const goal = refresh.goal || rehearsal.goal || request.goal || "transparent sketch spatial intent evidence";
const entrypointId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const dir = join(outputRoot, entrypointId);
mkdirSync(dir, { recursive: true });

const entrypointPath = join(dir, "spatial-intent-formal-evidence-entrypoint.json");
const demoOverlayPacketPath = join(dir, "demo-transparent-sketch-overlay-packet.json");
const teacherReceiptTemplatePath = join(dir, "teacher-spatial-intent-evidence-receipt-template.json");
const readmePath = join(dir, "SPATIAL_INTENT_FORMAL_EVIDENCE_START_HERE.md");
const htmlPath = join(dir, "spatial-intent-formal-evidence-entrypoint.html");
const demoPacket = sampleOverlayPacket(goal, rehearsalPath);
const check = dimensionCheck(demoPacket);
const locks = closedLocks();
const nextValidationCommand =
  `node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --request "${requestPath}" --receipt "<teacher-filled-spatial-intent-evidence-receipt.json>" --output-dir "${join(dir, "teacher-receipt-validation")}"`;
const teacherReceiptTemplate = {
  format: "transparent_ai_spatial_intent_evidence_receipt_v1",
  entrypointId,
  sourceEntrypoint: entrypointPath,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "teacher_reviewed_prepare_spatial_confirmation",
    "blocked_needs_more_evidence"
  ],
  blockedTeacherDecisions: ["accepted", "execute_now", "enable_memory", "claim_complete", "unlock_packaging", "native_universal_execution"],
  evidenceReviewed: false,
  teacherExportedOverlayPacketPath: "<teacher-exported-transparent-sketch-packet.json>",
  demoOverlayPacketPath,
  demoPacketIsNotTeacherEvidence: true,
  detailLogicReviewed: false,
  universalDetailLogicContractPath: "<teacher-reviewed-universal-detail-logic-contract-or-kit.json>",
  universalDetailLogicReceiptValidationPath: "<passed-parametric-drawing-logic-receipt-validation.json>",
  requiredSpatialEvidenceDimensions: [
    "2d_position_or_anchor",
    "angle_or_direction_vector",
    "perspective_relationship",
    "3d_depth_hint_or_near_far_relation"
  ],
  teacherNote: "",
  locks
};
const entrypoint = {
  ok: true,
  format: "transparent_ai_spatial_intent_formal_evidence_entrypoint_v1",
  entrypointId,
  createdAt: new Date().toISOString(),
  status: check.ready ? "ready_for_teacher_exported_overlay_packet" : "blocked_demo_packet_dimension_gap",
  teacherEvidenceStatus: "missing_teacher_exported_overlay_packet",
  goal,
  sourceEvidence: {
    refresh: refreshPath,
    spatialIntentEvidenceRequest: requestPath,
    spatialIntentEvidenceReceiptBuilder: receiptBuilderPath,
    transparentSketchDepthDemonstrationRehearsal: rehearsalPath
  },
  implementationEvidence: {
    transparentSketchOverlayRequestExists: existsSync(requestPath),
    spatialReceiptBuilderExists: existsSync(receiptBuilderPath),
    depthRehearsalExists: existsSync(rehearsalPath),
    requestStatus: request.status || "",
    receiptBuilderStatus: receiptBuilder.status || "",
    rehearsalStatus: rehearsal.status || ""
  },
  dimensionCheck: check,
  paths: {
    entrypoint: entrypointPath,
    demoOverlayPacket: demoOverlayPacketPath,
    teacherReceiptTemplate: teacherReceiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  nextTeacherAction:
    "Use the transparent overlay UI to export a real teacher sketch packet, then fill teacher-spatial-intent-evidence-receipt-template.json and run the validation command.",
  nextValidationCommand,
  completionBoundary:
    "This entrypoint proves the overlay packet schema and dimension checks. It is not teacher evidence, not spatial target confirmation, not software execution, not memory, and not goal completion.",
  locks
};

writeFileSync(demoOverlayPacketPath, `${JSON.stringify(demoPacket, null, 2)}\n`, "utf8");
writeFileSync(teacherReceiptTemplatePath, `${JSON.stringify(teacherReceiptTemplate, null, 2)}\n`, "utf8");
writeFileSync(entrypointPath, `${JSON.stringify(entrypoint, null, 2)}\n`, "utf8");
writeReadme(readmePath, entrypoint);
writeHtml(htmlPath, entrypoint);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_intent_formal_evidence_entrypoint_result_v1",
      entrypointId,
      status: entrypoint.status,
      entrypointPath,
      demoOverlayPacketPath,
      teacherReceiptTemplatePath,
      readmePath,
      htmlPath,
      dimensionCheck: check,
      locks
    },
    null,
    2
  )
);
