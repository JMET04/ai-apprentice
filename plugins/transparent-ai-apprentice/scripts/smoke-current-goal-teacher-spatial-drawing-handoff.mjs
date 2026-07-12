#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-teacher-spatial-drawing-handoff", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const waiting = runNodeScript("create-current-goal-teacher-spatial-drawing-handoff.mjs", [
  "--goal",
  "Smoke teacher spatial drawing handoff waiting path.",
  "--software",
  "all local software",
  "--output-dir",
  join(smokeRoot, "waiting")
]);
const waitingPacket = readJson(waiting.handoffPath);

const withPacket = runNodeScript("create-current-goal-teacher-spatial-drawing-handoff.mjs", [
  "--goal",
  "Smoke teacher spatial drawing handoff supplied packet path.",
  "--software",
  "all local software",
  "--overlay-packet",
  waiting.samplePacket,
  "--output-dir",
  join(smokeRoot, "with-packet")
]);
const suppliedPacket = readJson(withPacket.handoffPath);

const checks = [
  {
    name: "Handoff creates browser and PowerShell transparent overlays before teacher packet exists",
    pass:
      waitingPacket.format === "transparent_ai_current_goal_teacher_spatial_drawing_handoff_v1" &&
      waitingPacket.status === "waiting_for_teacher_exported_overlay_packet" &&
      existsSync(waitingPacket.paths.browserOverlay) &&
      existsSync(waitingPacket.paths.powershellOverlay) &&
      waitingPacket.paths.overlayHtml === waitingPacket.paths.browserOverlay &&
      waitingPacket.paths.overlayPowershell === waitingPacket.paths.powershellOverlay &&
      waitingPacket.paths.sampleOverlayPacket === waitingPacket.paths.samplePacket &&
      waitingPacket.implementedNow.browserTransparentOverlay === true &&
      waitingPacket.implementedNow.windowsTopMostOverlay === true,
    evidence: waiting.handoffPath
  },
  {
    name: "Spatial handoff exposes an explicit 2D perspective 3D capability summary",
    pass:
      waitingPacket.spatialCapabilitySummary?.transparentMaskAvailable === true &&
      waitingPacket.spatialCapabilitySummary?.browserOverlayAvailable === true &&
      waitingPacket.spatialCapabilitySummary?.windowsTopMostOverlayAvailable === true &&
      waitingPacket.spatialCapabilitySummary?.coordinateSpace?.supports2D === true &&
      waitingPacket.spatialCapabilitySummary?.coordinateSpace?.supportsPerspectiveRelationships === true &&
      waitingPacket.spatialCapabilitySummary?.coordinateSpace?.supports3DDepthHints === true &&
      waitingPacket.spatialCapabilitySummary?.sampleValidation?.has2DPositionEvidence === true &&
      waitingPacket.spatialCapabilitySummary?.sampleValidation?.hasPerspectiveEvidence === true &&
      waitingPacket.spatialCapabilitySummary?.sampleValidation?.has3DDepthEvidence === true &&
      waitingPacket.spatialCapabilitySummary?.executionBoundary?.requiresNumberedTargetConfirmation === true &&
      waitingPacket.spatialCapabilitySummary?.executionBoundary?.targetSoftwareExecutedHere === false,
    evidence: waitingPacket.spatialCapabilitySummary
  },
  {
    name: "Sample packet proves 2D perspective 3D depth shape but is not accepted as teacher evidence",
    pass:
      waitingPacket.proofOnlySample.notTeacherEvidence === true &&
      waitingPacket.implementedNow.validates2DPositionPerspective3DDepth === true &&
      waitingPacket.blockedActions.includes("treat_sample_packet_as_teacher_evidence"),
    evidence: waitingPacket.paths.sampleValidation
  },
  {
    name: "Supplied overlay packet is validated and routed only to review-only spatial receipt resolution",
    pass:
      suppliedPacket.realTeacherOverlayPacketProvided === true &&
      suppliedPacket.teacherPacketReview.readyForSpatialIntentEvidenceReceipt === true &&
      Boolean(suppliedPacket.teacherPacketReview.resolutionPath) &&
      suppliedPacket.locks.handoffDoesNotExecuteTargetSoftware === true &&
      suppliedPacket.locks.handoffDoesNotRunSpatialTargetConfirmation === true,
    evidence: withPacket.handoffPath
  },
  {
    name: "Next commands preserve numbered confirmation and execution as separate teacher-gated steps",
    pass:
      suppliedPacket.nextCommands.some((item) => item.id === "after_teacher_review_create_numbered_targets") &&
      suppliedPacket.nextCommands.some((item) => item.id === "optional_depth_demonstration_rehearsal") &&
      suppliedPacket.goalComplete === false &&
      suppliedPacket.locks.goalComplete === false,
    evidence: withPacket.handoffPath
  },
  {
    name: "Spatial handoff exposes transparent sketch logic contract rule draft without enabling rules",
    pass:
      suppliedPacket.implementedNow.logicContractRuleDraftCommandPreparedButNotRun === true &&
      suppliedPacket.nextCommands.some(
        (item) =>
          item.id === "after_teacher_review_create_logic_contract_rule_draft" &&
          item.command.includes("create-transparent-sketch-logic-contract-rule-draft.mjs") &&
          item.command.includes("--teacher-reviewed-spatial-intent")
      ) &&
      suppliedPacket.logicContractRuleDraftActionPack.status ===
        "waiting_for_teacher_reviewed_spatial_intent_and_retained_rollback" &&
      suppliedPacket.logicContractRuleDraftActionPack.outputsOnlyDraftDisabledRules === true &&
      suppliedPacket.logicContractRuleDraftActionPack.enableRulesNow === false &&
      suppliedPacket.logicContractRuleDraftActionPack.writeMemoryNow === false &&
      suppliedPacket.logicContractRuleDraftActionPack.goalCompleteNow === false &&
      suppliedPacket.blockedActions.includes("enable_logic_contract_rules_inside_this_handoff"),
    evidence: suppliedPacket.logicContractRuleDraftActionPack
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_teacher_spatial_drawing_handoff_smoke_v1",
      smokeRoot,
      checks,
      artifacts: {
        waiting: waiting.handoffPath,
        withPacket: withPacket.handoffPath
      }
    },
    null,
    2
  )
);
