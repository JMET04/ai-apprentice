#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCorpusIndex, readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "knowledge-augmented-spatial-execution-bridge", String(Date.now()));
const sourceDir = join(root, "knowledge-source");
const outDir = join(root, "out");
mkdirSync(sourceDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

function runNode(script, args) {
  const result = spawnSync(process.execPath, [join(__dirname, "..", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function fixturePath(name, value) {
  const path = join(outDir, name);
  writeJson(path, value);
  return path;
}

const sourcePath = join(sourceDir, "spatial-cad-control-notes.md");
writeFileSync(
  sourcePath,
  [
    "# Spatial Software Control Notes",
    "",
    "When the teacher draws a depth arrow into a pocket, bind the action to the confirmed numbered pocket before any software route is planned.",
    "",
    "Depth, angle, target position, and relation to an anchor must be backed by reviewed data, formula, constraint, or teacher exception. Visual similarity alone is not enough.",
    "",
    "For export or apply events, use compact log evidence only as a trigger for teacher review. Prefer file import/export and dry-run route previews before supervised UI fallback."
  ].join("\n"),
  "utf8"
);

const { indexPath } = buildCorpusIndex({
  sourcePath: sourceDir,
  outDir,
  sourceIdPrefix: "smoke.spatial_control",
  sourceType: "teacher_note",
  domain: "spatial_execution"
});

const compactPacketPath = fixturePath("compact-learning-events.json", {
  format: "transparent_ai_compact_learning_events_from_universal_observation_v1",
  packetId: "smoke-spatial-control-compact-events",
  software: "Generic CAD-like Engineering App",
  status: "waiting_for_teacher_review",
  compactLearningEvents: [
    {
      id: "delta-1",
      sourceType: "metadata_delta",
      classification: "spatial_apply_requested",
      confidence: "medium",
      compactEvidence: {
        retainedSnippet: "Teacher changed a depth-pocket sketch target and requested apply preview."
      },
      suggestedRuleBoundary:
        "Bind the apply preview to the teacher-confirmed numbered pocket and reviewed depth logic before any execution."
    },
    {
      id: "delta-2",
      sourceType: "log_tail_delta",
      classification: "dry_run_export_ready",
      confidence: "medium",
      compactEvidence: {
        retainedSnippet: "Dry-run export route is available for project geometry."
      },
      suggestedRuleBoundary:
        "Prefer file import/export dry-run evidence before supervised Windows UI automation."
    }
  ],
  reviewLocks: {
    ruleEnabled: false,
    accepted: false,
    packagingGated: true,
    fullContinuousRecording: false
  }
});

const knowledgeRun = runNode("knowledge/augment-low-token-learning-with-retrieval.mjs", [
  "--corpus-index",
  indexPath,
  "--compact-events",
  compactPacketPath,
  "--out-dir",
  join(outDir, "knowledge-bridge"),
  "--top-k",
  "2"
]);

const overlayPacket = {
  format: "transparent_ai_sketch_overlay_packet_v1",
  software: "Generic CAD-like Engineering App",
  goal: "Teacher sketches a 3D depth move into the target pocket.",
  overlayMode: "live_topmost_2d_perspective_3d",
  coordinateSpace: { origin: "top_left", units: "normalized_0_to_1", supports2D: true, supports3DDepthHints: true },
  anchors: [
    { id: "source-part", type: "teacher_marked_region", label: "source part", box: [0.2, 0.58, 0.32, 0.72] },
    { id: "target-pocket", type: "teacher_marked_region", label: "target pocket", box: [0.62, 0.28, 0.8, 0.48] }
  ],
  strokes: [
    {
      id: "depth-move",
      mode: "depth_axis_3d",
      semanticLabel: "move source part into deeper target pocket",
      targetAnchorId: "target-pocket",
      points: [
        { x: 0.26, y: 0.65, zHint: 0.06 },
        { x: 0.71, y: 0.38, zHint: 0.44 }
      ]
    }
  ],
  universalDetailLogicContract: {
    format: "transparent_ai_universal_detail_logic_contract_v1",
    principle: "All consequential sketch details must be logicized before execution.",
    consequentialDetailRows: [
      {
        id: "target-position",
        sourceElementId: "target-pocket",
        detailCategory: "position/alignment/relation",
        classification: "constraint_or_relationship_backed",
        logicSource: "teacher-confirmed target anchor box and selected target number",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      },
      {
        id: "depth-relation",
        sourceElementId: "depth-move",
        detailCategory: "view/depth/perspective",
        classification: "constraint_or_relationship_backed",
        logicSource: "depth stroke zHint increases from source to target pocket",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      },
      {
        id: "angle-direction",
        sourceElementId: "depth-move",
        detailCategory: "angular/curvature",
        classification: "data_or_formula_backed",
        logicSource: "direction vector between first and last teacher stroke points",
        teacherReviewRequired: true,
        blocksExecutionIfMissing: true
      }
    ],
    missingDetailLogicCount: 0,
    missingLogicSourceBehavior: "block_execute_and_route_to_teacher_review",
    blockedActions: [
      "execute_or_generate_output_that_only_looks_similar_without_detail_logic",
      "generate_any_consequential_detail_without_logic_source"
    ]
  }
};

const targetConfirmation = {
  format: "transparent_ai_numbered_target_confirmation_v1",
  goal: overlayPacket.goal,
  software: overlayPacket.software,
  candidates: [
    {
      number: 1,
      id: "source-part",
      label: "source part",
      normalizedTarget: { x: 0.26, y: 0.65, zHint: 0.06, coordinateSource: "transparent_overlay_anchor_center" },
      reason: "Source object, not final target.",
      teacherReviewRequired: true
    },
    {
      number: 2,
      id: "target-pocket",
      label: "target pocket",
      normalizedTarget: { x: 0.71, y: 0.38, zHint: 0.44, coordinateSource: "spatial_intent_suggested_action" },
      reason: "Teacher depth stroke ends in this pocket.",
      teacherReviewRequired: true
    }
  ],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, softwareActionsExecuted: false }
};

const controlChannelProfile = {
  format: "transparent_ai_software_control_channel_profile_v1",
  goal: overlayPacket.goal,
  software: overlayPacket.software,
  principle: "Prefer file import/export dry-run routes before supervised Windows UI fallback.",
  channels: [
    {
      adapterId: "existing-file-import-export",
      label: "geometry import/export dry-run",
      score: 20,
      evidence: ["project geometry can be previewed as a file export"],
      requiredEvidenceBeforeExecute: ["dry-run diff", "schema validation"],
      blockers: []
    },
    {
      adapterId: "existing-windows-ui-automation",
      label: "supervised Windows UI fallback",
      score: 10,
      evidence: ["visible target window can be checked by preflight"],
      requiredEvidenceBeforeExecute: ["target window title", "coordinate preflight"],
      blockers: ["missing_target_window_or_low_token_verifier"]
    }
  ],
  recommendedRoute: {
    primaryAdapterId: "existing-file-import-export",
    recommendedAdapters: ["existing-file-import-export", "existing-windows-ui-automation"],
    dryRunFirst: true,
    teacherConfirmationRequired: true
  },
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, softwareActionsExecuted: false }
};

const overlayPath = fixturePath("overlay-packet.json", overlayPacket);
const targetConfirmationPath = fixturePath("target-confirmation.json", targetConfirmation);
const controlChannelProfilePath = fixturePath("control-channel-profile.json", controlChannelProfile);

const routeRun = runNode("create-spatial-software-execution-route-bridge.mjs", [
  "--goal",
  overlayPacket.goal,
  "--software",
  overlayPacket.software,
  "--overlay-packet",
  overlayPath,
  "--target-confirmation",
  targetConfirmationPath,
  "--selected-number",
  "2",
  "--control-channel-profile",
  controlChannelProfilePath,
  "--output-dir",
  join(outDir, "spatial-route")
]);

const bridgeRun = runNode("create-knowledge-augmented-spatial-execution-bridge.mjs", [
  "--goal",
  "Connect retrieved software knowledge to the selected transparent sketch route.",
  "--software",
  overlayPacket.software,
  "--knowledge-augmented-learning",
  knowledgeRun.packetPath,
  "--spatial-route-bridge",
  routeRun.bridgePath,
  "--output-dir",
  join(outDir, "knowledge-spatial")
]);

const bridge = readJson(bridgeRun.packetPath);
const receipt = readJson(bridgeRun.receiptPath);

const checks = [
  {
    name: "Knowledge-augmented spatial bridge combines retrieval events with confirmed spatial route",
    pass:
      bridge.format === "transparent_ai_knowledge_augmented_spatial_execution_bridge_v1" &&
      bridge.status === "ready_for_teacher_reviewed_dry_run_route" &&
      bridge.counts.knowledgeAugmentedEvents === 2 &&
      bridge.counts.retrievalEvidenceRows === 2 &&
      bridge.counts.routeCandidates >= 2 &&
      bridge.counts.reviewRows === 2 &&
      bridge.sourceEvidence.selectedTarget.selectedNumber === 2,
    evidence: bridgeRun.packetPath
  },
  {
    name: "Bridge preserves strict low-token and execution locks",
    pass:
      bridge.locks.fullLogRead === false &&
      bridge.locks.screenshotsCaptured === false &&
      bridge.locks.softwareActionsExecuted === false &&
      bridge.locks.targetSoftwareCommandsExecuted === false &&
      bridge.locks.nativeUniversalExecution === false &&
      bridge.locks.memoryEnabled === false &&
      bridge.locks.ruleEnabled === false &&
      bridge.locks.packagingGated === true &&
      receipt.locks.softwareActionsExecuted === false,
    evidence: bridgeRun.receiptPath
  },
  {
    name: "Review rows require teacher grounding before dry-run route",
    pass:
      bridge.reviewRows.every((row) => row.nextAllowedAction === "teacher_review_then_dry_run_route_only") &&
      bridge.reviewRows.every((row) => row.blockedUntilTeacherReview.includes("execute_software")) &&
      bridge.blockedActions.includes("execute_without_teacher_reviewed_knowledge_grounding") &&
      bridge.blockedActions.includes("execute_with_missing_detail_logic"),
    evidence: bridgeRun.packetPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(JSON.stringify({
  ok: failed.length === 0,
  smoke: "transparent_ai_knowledge_augmented_spatial_execution_bridge_smoke_v1",
  status: failed.length === 0 ? "passed" : "failed",
  knowledgePacketPath: knowledgeRun.packetPath,
  spatialRouteBridgePath: routeRun.bridgePath,
  bridgePacketPath: bridgeRun.packetPath,
  receiptPath: bridgeRun.receiptPath,
  passed: checks.length - failed.length,
  total: checks.length,
  checks
}, null, 2));
if (failed.length) process.exit(1);
