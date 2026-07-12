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
    String(value || "transparent-sketch-overlay-packet-validation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "transparent-sketch-overlay-packet-validation"
  );
}

function readJsonInput(input) {
  if (!input) throw new Error("Missing --overlay-packet.");
  const text = String(input).trim();
  if (existsSync(text)) return { packet: JSON.parse(readFileSync(text, "utf8").replace(/^\uFEFF/, "")), source: resolve(text) };
  if (text.startsWith("{")) return { packet: JSON.parse(text), source: "inline_json" };
  throw new Error("--overlay-packet must be a JSON file path or inline JSON object.");
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

function locks() {
  return {
    reviewOnly: true,
    teacherOverlayPacketValidationOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotReadLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotRegisterSchedule: true,
    validationDoesNotWriteMemory: true,
    spatialTargetConfirmationNotRun: true,
    logContentsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function pointZDelta(stroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  if (points.length < 2) return 0;
  return Number(points.at(-1)?.zHint || 0) - Number(points[0]?.zHint || 0);
}

function writeHtml(path, packet) {
  const blockers = packet.blockers.map((item) => `<li><code>${htmlEscape(item)}</code></li>`).join("");
  const rows = packet.detailLogicRows
    .map(
      (row) => `<tr>
        <td><code>${htmlEscape(row.id)}</code></td>
        <td>${htmlEscape(row.detailCategory)}</td>
        <td>${htmlEscape(row.classification)}</td>
        <td>${htmlEscape(row.status || "")}</td>
      </tr>`
    )
    .join("");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transparent Sketch Overlay Packet Validation</title>
  <style>
    :root { font: 14px/1.45 "Segoe UI", Arial, sans-serif; color: #17202a; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: 0; }
    section { background: #fff; border: 1px solid #dbe4ef; border-radius: 8px; padding: 15px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e4edf5; text-align: left; padding: 7px; vertical-align: top; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Transparent Sketch Overlay Packet Validation</h1>
  <section>
    <p><strong>Status:</strong> <code>${htmlEscape(packet.status)}</code></p>
    <p><strong>Overlay packet:</strong> <a href="${htmlEscape(fileHref(packet.sourceEvidence.overlayPacket))}">${htmlEscape(packet.sourceEvidence.overlayPacket)}</a></p>
    <p><strong>2D:</strong> ${packet.spatialEvidence.has2DPositionEvidence} <strong>Perspective:</strong> ${packet.spatialEvidence.hasPerspectiveEvidence} <strong>3D depth:</strong> ${packet.spatialEvidence.has3DDepthEvidence}</p>
    <p>This validation only checks teacher-exported packet structure and logic evidence. It does not run spatial target confirmation, execute software, capture screenshots, register schedules, write memory, enable rules, or claim completion.</p>
  </section>
  <section>
    <h2>Blockers</h2>
    <ul>${blockers || "<li>none</li>"}</ul>
  </section>
  <section>
    <h2>Detail Logic Rows</h2>
    <table><thead><tr><th>ID</th><th>Category</th><th>Classification</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
  </section>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, packet) {
  const lines = [
    "# Transparent Sketch Overlay Packet Validation",
    "",
    `Status: ${packet.status}`,
    `Ready for spatial intent evidence receipt: ${packet.readyForSpatialIntentEvidenceReceipt}`,
    "",
    "Spatial evidence:",
    `- 2D position: ${packet.spatialEvidence.has2DPositionEvidence}`,
    `- perspective: ${packet.spatialEvidence.hasPerspectiveEvidence}`,
    `- 3D depth: ${packet.spatialEvidence.has3DDepthEvidence}`,
    `- detail logic ready: ${packet.detailLogic.ready}`,
    "",
    "Blockers:",
    ...(packet.blockers.length ? packet.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "Locks:",
    ...Object.entries(packet.locks).map(([key, value]) => `- ${key}: ${value}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const overlayInput = argValue("--overlay-packet", "");
const outputRoot = resolve(argValue("--output-dir", join(process.cwd(), "artifacts", "transparent-sketch-overlay-packet-validations")));
const { packet: overlayPacket, source } = readJsonInput(overlayInput);
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(basename(source, ".json"))}`;
const dir = join(outputRoot, validationId);
mkdirSync(dir, { recursive: true });

const strokes = Array.isArray(overlayPacket.strokes) ? overlayPacket.strokes : [];
const anchors = Array.isArray(overlayPacket.anchors) ? overlayPacket.anchors : [];
const relationships = Array.isArray(overlayPacket.spatialIntent?.relationships) ? overlayPacket.spatialIntent.relationships : [];
const perspectiveCues = Array.isArray(overlayPacket.spatialIntent?.perspectiveCues) ? overlayPacket.spatialIntent.perspectiveCues : [];
const detailLogicRows = Array.isArray(overlayPacket.universalDetailLogicContract?.consequentialDetailRows)
  ? overlayPacket.universalDetailLogicContract.consequentialDetailRows
  : [];
const strokeModes = new Set(strokes.map((stroke) => String(stroke.mode || "")));
const relationshipNames = new Set(relationships.map((row) => String(row.relation || "")));
const cueNames = new Set(perspectiveCues.map((row) => String(row.cue || "")));
const has2DPositionEvidence =
  overlayPacket.coordinateSpace?.supports2D === true &&
  (anchors.length > 0 || strokeModes.has("screen_2d") || strokeModes.has("plane_2d"));
const hasPerspectiveEvidence =
  overlayPacket.coordinateSpace?.supportsPerspectiveRelationships === true &&
  (strokeModes.has("perspective_grid") ||
    relationshipNames.has("perspective_to") ||
    [...cueNames].some((cue) => cue.includes("perspective")));
const has3DDepthEvidence =
  overlayPacket.coordinateSpace?.supports3DDepthHints === true &&
  (strokeModes.has("depth_axis_3d") ||
    relationshipNames.has("nearer_than") ||
    relationshipNames.has("farther_than") ||
    [...cueNames].some((cue) => cue.includes("3d") || cue.includes("depth")) ||
    strokes.some((stroke) => Math.abs(pointZDelta(stroke)) > 0.08));
const missingLogicRows = detailLogicRows.filter(
  (row) =>
    row.classification === "missing_evidence_blocks_execution" ||
    row.status === "blocked_missing_logic_source" ||
    row.blocksExecutionIfMissing === true && !row.logicSource
);
const blockers = [
  overlayPacket.format === "transparent_ai_sketch_overlay_packet_v1" ? "" : "wrong_overlay_packet_format",
  has2DPositionEvidence ? "" : "missing_2d_position_evidence",
  hasPerspectiveEvidence ? "" : "missing_perspective_evidence",
  has3DDepthEvidence ? "" : "missing_3d_depth_evidence",
  detailLogicRows.length > 0 ? "" : "missing_universal_detail_logic_rows",
  missingLogicRows.length === 0 ? "" : "detail_logic_rows_block_execution",
  overlayPacket.locks?.accepted === false || overlayPacket.locks?.accepted === undefined ? "" : "overlay_packet_claims_acceptance",
  overlayPacket.locks?.ruleEnabled === false || overlayPacket.locks?.ruleEnabled === undefined ? "" : "overlay_packet_claims_rule_enabled"
].filter(Boolean);
const readyForSpatialIntentEvidenceReceipt = blockers.length === 0;
const lockState = locks();
const validationPath = join(dir, "transparent-sketch-overlay-packet-validation.json");
const htmlPath = join(dir, "transparent-sketch-overlay-packet-validation.html");
const readmePath = join(dir, "TRANSPARENT_SKETCH_OVERLAY_PACKET_VALIDATION_START_HERE.md");
const result = {
  ok: true,
  format: "transparent_ai_transparent_sketch_overlay_packet_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status: readyForSpatialIntentEvidenceReceipt
    ? "overlay_packet_ready_for_spatial_intent_evidence_receipt"
    : "overlay_packet_waiting_for_teacher_correction_or_more_detail_logic",
  readyForSpatialIntentEvidenceReceipt,
  sourceEvidence: {
    overlayPacket: source
  },
  counts: {
    anchors: anchors.length,
    strokes: strokes.length,
    relationships: relationships.length,
    perspectiveCues: perspectiveCues.length,
    detailLogicRows: detailLogicRows.length,
    missingLogicRows: missingLogicRows.length,
    blockers: blockers.length
  },
  spatialEvidence: {
    has2DPositionEvidence,
    hasPerspectiveEvidence,
    has3DDepthEvidence,
    strokeModes: [...strokeModes],
    relationshipNames: [...relationshipNames],
    cueNames: [...cueNames]
  },
  detailLogic: {
    ready: detailLogicRows.length > 0 && missingLogicRows.length === 0,
    missingLogicRowIds: missingLogicRows.map((row) => row.id || row.sourceElementId || "")
  },
  detailLogicRows,
  blockers,
  nextCommandTemplate: readyForSpatialIntentEvidenceReceipt
    ? `node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --request "<spatial-intent-evidence-request.json>" --receipt "<teacher-filled-spatial-intent-evidence-receipt-with-this-overlay-packet.json>" --output-dir "<spatial-intent-evidence-receipt-validation>"`
    : "",
  blockedClaims: [
    "claim_real_teacher_spatial_intent_from_packet_without_receipt",
    "run_spatial_target_confirmation_from_packet_validation",
    "execute_target_software_from_packet_validation",
    "write_memory_from_packet_validation",
    "claim_goal_complete_from_packet_validation"
  ],
  paths: {
    validation: validationPath,
    html: htmlPath,
    readme: readmePath
  },
  locks: lockState,
  goalComplete: false
};

writeFileSync(validationPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
writeHtml(htmlPath, result);
writeReadme(readmePath, result);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_transparent_sketch_overlay_packet_validation_result_v1",
      status: result.status,
      validationPath,
      htmlPath,
      readmePath,
      counts: result.counts,
      readyForSpatialIntentEvidenceReceipt,
      goalComplete: false,
      locks: lockState
    },
    null,
    2
  )
);
