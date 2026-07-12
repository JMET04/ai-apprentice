#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const smokeRoot = mkdtempSync(join(tmpdir(), "ta-overlay-packet-validation-"));
const overlayKit = runNodeScript("create-transparent-sketch-overlay-kit.mjs", [
  "--goal",
  "Validate a teacher exported 2D perspective 3D transparent sketch packet.",
  "--software",
  "ExampleCAD",
  "--output-dir",
  join(smokeRoot, "overlay-kit")
]);
const readyResult = runNodeScript("validate-transparent-sketch-overlay-packet.mjs", [
  "--overlay-packet",
  overlayKit.samplePacket,
  "--output-dir",
  join(smokeRoot, "ready-validation")
]);
const readyPacket = readJson(readyResult.validationPath);

const blockedPacketPath = join(smokeRoot, "blocked-overlay-packet.json");
writeJson(blockedPacketPath, {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "ExampleCAD",
  goal: "blocked overlay",
  coordinateSpace: {
    supports2D: true,
    supports3DDepthHints: false,
    supportsPerspectiveRelationships: false
  },
  anchors: [],
  strokes: [
    {
      id: "stroke-1",
      mode: "screen_2d",
      semanticLabel: "point here",
      points: [
        { x: 0.1, y: 0.1, zHint: 0 },
        { x: 0.2, y: 0.2, zHint: 0 }
      ]
    }
  ],
  spatialIntent: { relationships: [], perspectiveCues: [] },
  universalDetailLogicContract: {
    format: "transparent_ai_universal_detail_logic_contract_v1",
    consequentialDetailRows: [
      {
        id: "missing-logic",
        sourceElementId: "stroke-1",
        detailCategory: "position/alignment/relation",
        classification: "missing_evidence_blocks_execution",
        logicSource: "",
        blocksExecutionIfMissing: true
      }
    ]
  },
  locks: { accepted: false, ruleEnabled: false }
});
const blockedResult = runNodeScript("validate-transparent-sketch-overlay-packet.mjs", [
  "--overlay-packet",
  blockedPacketPath,
  "--output-dir",
  join(smokeRoot, "blocked-validation")
]);
const blockedValidation = readJson(blockedResult.validationPath);

const checks = [
  {
    name: "Sample overlay packet validates 2D perspective 3D and detail logic",
    pass:
      readyPacket.status === "overlay_packet_ready_for_spatial_intent_evidence_receipt" &&
      readyPacket.readyForSpatialIntentEvidenceReceipt === true &&
      readyPacket.spatialEvidence.has2DPositionEvidence === true &&
      readyPacket.spatialEvidence.hasPerspectiveEvidence === true &&
      readyPacket.spatialEvidence.has3DDepthEvidence === true &&
      readyPacket.detailLogic.ready === true
  },
  {
    name: "Incomplete overlay packet remains blocked",
    pass:
      blockedValidation.status === "overlay_packet_waiting_for_teacher_correction_or_more_detail_logic" &&
      blockedValidation.readyForSpatialIntentEvidenceReceipt === false &&
      blockedValidation.blockers.includes("missing_perspective_evidence") &&
      blockedValidation.blockers.includes("missing_3d_depth_evidence") &&
      blockedValidation.blockers.includes("detail_logic_rows_block_execution")
  },
  {
    name: "Overlay packet validation keeps side-effect locks closed",
    pass:
      readyPacket.locks.validationDoesNotExecuteTargetSoftware === true &&
      readyPacket.locks.validationDoesNotCaptureScreenshots === true &&
      readyPacket.locks.validationDoesNotWriteMemory === true &&
      readyPacket.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_transparent_sketch_overlay_packet_validation_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        overlayKit: overlayKit.kitPath,
        readyValidation: readyResult.validationPath,
        blockedValidation: blockedResult.validationPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
