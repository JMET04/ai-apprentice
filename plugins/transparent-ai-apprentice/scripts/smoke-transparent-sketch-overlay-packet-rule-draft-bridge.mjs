#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function run(args, expectOk = true) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 180000 });
  if (expectOk && result.status !== 0) {
    throw new Error(`command failed\nargs=${args.join(" ")}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`command unexpectedly passed\nargs=${args.join(" ")}\nstdout=${result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-overlay-packet-rule-draft-bridge-"));
const rollbackPoint = join(root, "rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-transparent-overlay-packet-rule-draft-bridge",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const overlayKit = run([
  "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-overlay-kit.mjs",
  "--goal",
  "Bridge a teacher exported transparent overlay packet into disabled logic rules.",
  "--software",
  "ExampleCAD",
  "--mode",
  "screen_2d_perspective_3d",
  "--output-dir",
  join(root, "overlay-kit")
]);

const missingReview = run(
  [
    "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-overlay-packet-rule-draft-bridge.mjs",
    "--overlay-packet",
    overlayKit.samplePacket,
    "--rollback-point",
    rollbackPoint,
    "--output-dir",
    join(root, "missing-review")
  ],
  false
);

const ready = run([
  "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-overlay-packet-rule-draft-bridge.mjs",
  "--overlay-packet",
  overlayKit.samplePacket,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed-overlay-packet",
  "--teacher-reviewed-spatial-intent",
  "--output-dir",
  join(root, "ready")
]);
const bridge = readJson(ready.bridgePath);
const ruleDraft = readJson(bridge.paths.ruleDraftPackage);
const compiled = readJson(bridge.paths.compiledRulePackage);

const blockedPacketPath = join(root, "blocked-overlay-packet.json");
writeJson(blockedPacketPath, {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "ExampleCAD",
  goal: "blocked overlay bridge",
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

const blocked = run(
  [
    "plugins/transparent-ai-apprentice/scripts/create-transparent-sketch-overlay-packet-rule-draft-bridge.mjs",
    "--overlay-packet",
    blockedPacketPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed-overlay-packet",
    "--teacher-reviewed-spatial-intent",
    "--output-dir",
    join(root, "blocked")
  ],
  false
);

const checks = [
  {
    name: "Bridge fails closed without teacher reviewed overlay and spatial intent flags",
    pass:
      missingReview.status === "blocked_before_transparent_sketch_overlay_packet_rule_draft_bridge" &&
      missingReview.blockers.includes("teacher_reviewed_overlay_packet_flag_required") &&
      missingReview.blockers.includes("teacher_reviewed_spatial_intent_flag_required")
  },
  {
    name: "Teacher reviewed overlay packet becomes spatial intent and disabled rule package",
    pass:
      bridge.status === "ready_for_teacher_transparent_sketch_overlay_packet_rule_draft_review" &&
      bridge.paths.overlayValidation &&
      bridge.paths.spatialIntent &&
      bridge.paths.ruleDraftPackage &&
      ruleDraft.disabledRuleCount >= 3 &&
      compiled.rules.every((rule) => rule.lifecycle === "draft_disabled")
  },
  {
    name: "Bridge preserves 2D position angle perspective and 3D depth scopes",
    pass:
      ruleDraft.detailLogicContractSummary.requiredScopes.includes("position_alignment_relation") &&
      ruleDraft.detailLogicContractSummary.requiredScopes.includes("angle_direction_curvature") &&
      ruleDraft.detailLogicContractSummary.requiredScopes.includes("view_depth_perspective")
  },
  {
    name: "Incomplete overlay packet is blocked before rule draft generation",
    pass:
      blocked.status === "blocked_before_transparent_sketch_overlay_packet_rule_draft_bridge" &&
      blocked.blockers.includes("overlay_packet_validation_not_ready_for_spatial_intent_evidence_receipt") &&
      blocked.blockers.some((item) => item.includes("missing_perspective_evidence")) &&
      blocked.blockers.some((item) => item.includes("missing_3d_depth_evidence"))
  },
  {
    name: "Bridge keeps side-effect locks closed",
    pass:
      bridge.locks.softwareActionsExecuted === false &&
      bridge.locks.targetSoftwareCommandsExecuted === false &&
      bridge.locks.memoryWritten === false &&
      bridge.locks.screenshotsCaptured === false &&
      bridge.locks.ruleEnabled === false &&
      bridge.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      smoke: "transparent_ai_transparent_sketch_overlay_packet_rule_draft_bridge_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        overlayKit: overlayKit.kitPath,
        bridge: ready.bridgePath,
        ruleDraft: bridge.paths.ruleDraftPackage,
        compiledRulePackage: bridge.paths.compiledRulePackage
      },
      locks: bridge.locks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
