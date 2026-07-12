#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-spatial-first-blocker-"));
const refreshPath = join(root, "original-goal-current-status-refresh.json");
const gatePath = join(root, "spatial-to-software-execution-gate-package.json");
const requestHtml = join(root, "spatial-intent-evidence-request.html");
const requestJson = join(root, "spatial-intent-evidence-request.json");
const overlayHtml = join(root, "transparent-sketch-overlay.html");
const builderHtml = join(root, "spatial-intent-evidence-receipt-builder.html");
const receiptTemplate = join(root, "teacher-spatial-intent-evidence-receipt-template.json");
const outputDir = join(root, "handoff");
mkdirSync(outputDir, { recursive: true });
writeFileSync(overlayHtml, "<!doctype html><title>overlay</title>", "utf8");
writeFileSync(requestHtml, "<!doctype html><title>request</title>", "utf8");
writeFileSync(builderHtml, "<!doctype html><title>builder</title>", "utf8");
writeJson(requestJson, { format: "transparent_ai_spatial_intent_evidence_request_v1" });
writeJson(receiptTemplate, { format: "transparent_ai_spatial_intent_evidence_receipt_v1" });

writeJson(refreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Smoke spatial first blocker handoff",
  paths: {
    spatialIntentEvidenceRequest: requestJson,
    spatialIntentEvidenceRequestHtml: requestHtml,
    spatialIntentEvidenceReceiptBuilderHtml: builderHtml,
    spatialIntentEvidenceReceiptTemplate: receiptTemplate,
    spatialIntentEvidenceReceiptValidationCommandTemplate:
      "node plugins\\transparent-ai-apprentice\\scripts\\validate-spatial-intent-evidence-receipt.mjs --request \"request.json\" --receipt \"<teacher-filled-spatial-intent-evidence-receipt.json>\""
  },
  discoveredEvidence: {
    transparentSketchOverlay: overlayHtml
  }
});

writeJson(gatePath, {
  format: "transparent_ai_spatial_to_software_execution_gate_package_v1",
  goal: "Smoke spatial first blocker handoff",
  status: "blocked_before_spatial_software_execution",
  readyForDryRunRouteBridge: false,
  firstBlocker: {
    id: "teacher_exported_overlay_validation",
    status: "blocked",
    blocker: "blocked_placeholder_is_not_teacher_evidence"
  },
  sourceEvidence: { refresh: refreshPath },
  gates: [
    {
      id: "teacher_exported_overlay_validation",
      ready: false,
      status: "blocked",
      evidencePath: join(root, "spatial-validation.json"),
      blocker: "blocked_placeholder_is_not_teacher_evidence"
    }
  ],
  paths: { html: join(root, "spatial-to-software-execution-gate-package.html") },
  locks: { packageDoesNotExecuteSoftware: true, softwareActionsExecuted: false, goalComplete: false }
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-spatial-to-software-first-blocker-handoff.mjs",
  "--gate",
  gatePath,
  "--output-dir",
  outputDir
]);
const handoff = JSON.parse(readFileSync(result.handoffPath, "utf8"));
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");
const checks = [
  {
    name: "First blocker handoff keeps the same spatial execution blocker visible",
    pass:
      handoff.format === "transparent_ai_spatial_to_software_first_blocker_handoff_v1" &&
      handoff.status === "waiting_for_teacher_to_resolve_spatial_execution_first_blocker" &&
      handoff.firstBlocker.id === "teacher_exported_overlay_validation" &&
      handoff.firstTeacherAction.id === "open_transparent_sketch_overlay" &&
      handoff.firstTeacherAction.evidencePath === overlayHtml
  },
  {
    name: "Teacher-exported overlay blocker maps to receipt builder and validation steps",
    pass:
      handoff.teacherSteps.some((step) => step.id === "open_spatial_intent_receipt_builder" && step.evidencePath === builderHtml) &&
      handoff.teacherSteps.some(
        (step) =>
          step.id === "resolve_first_blocker_with_exported_overlay_packet" &&
          step.command.includes("resolve-spatial-first-blocker-overlay-packet.mjs") &&
          step.command.includes("--request") &&
          step.command.includes(requestJson) &&
          step.command.includes("<teacher-exported-transparent-sketch-packet.json>")
      ) &&
      handoff.teacherSteps.some((step) => step.id === "fill_spatial_intent_receipt_template" && step.evidencePath === receiptTemplate) &&
      handoff.teacherSteps.some(
        (step) =>
          step.id === "validate_spatial_intent_receipt" &&
          step.command.includes("validate-spatial-intent-evidence-receipt.mjs") &&
          step.command.includes("<teacher-filled-spatial-intent-evidence-receipt.json>")
      )
  },
  {
    name: "First blocker handoff is review-only and cannot execute software",
    pass:
      handoff.locks.handoffDoesNotRunCommands === true &&
      handoff.locks.handoffDoesNotExecuteSoftware === true &&
      handoff.locks.softwareActionsExecuted === false &&
      handoff.locks.goalComplete === false &&
      handoff.teacherSteps.every((step) => step.allowedInThisHandoff === false)
  },
  {
    name: "First blocker handoff maps spatial blocker back to original-goal completion lane",
    pass:
      handoff.objectiveRequirementId === "transparent_mask_2d_perspective_3d_depth_understanding" &&
      handoff.completionBlockerLane === "transparent_sketch_spatial_intent_teacher_export" &&
      handoff.nextGate === "resolve_spatial_first_blocker_overlay_packet_then_validate_spatial_intent_evidence_receipt" &&
      handoff.nextGateHandoff.format === "transparent_ai_spatial_to_software_first_blocker_next_gate_handoff_v1" &&
      handoff.nextGateHandoff.status === "review_only_next_gate_handoff_ready" &&
      handoff.nextGateHandoff.completionBlockerLane === "transparent_sketch_spatial_intent_teacher_export" &&
      handoff.nextGateHandoff.requiredEvidenceBeforeManualUse.includes(
        "real teacher-exported transparent_ai_sketch_overlay_packet_v1 packet"
      ) &&
      handoff.nextGateHandoff.requiredEvidenceBeforeManualUse.includes("retained rollback point") &&
      handoff.nextGateHandoff.returnToCompletionBlockerMatrixAfterNextGate === true
  },
  {
    name: "Next-gate handoff preserves teacher-confirmation locks",
    pass:
      handoff.nextGateHandoff.blockedActions.includes("choose_numbered_target_without_teacher_confirmation") &&
      handoff.nextGateHandoff.blockedActions.includes("execute_target_software_from_spatial_first_blocker_handoff") &&
      handoff.nextGateHandoff.locks.handoffDoesNotRunCommands === true &&
      handoff.nextGateHandoff.locks.handoffDoesNotExecuteSoftware === true &&
      handoff.nextGateHandoff.locks.handoffDoesNotWriteMemory === true &&
      handoff.nextGateHandoff.locks.goalComplete === false
  },
  {
    name: "First blocker handoff writes a teacher-facing HTML page",
    pass:
      html.includes("Spatial To Software First Blocker Handoff") &&
      html.includes("Teacher action") &&
      html.includes("Completion blocker lane") &&
      html.includes("Required Evidence Before Manual Use") &&
      readme.includes("Next-gate handoff") &&
      readme.includes("transparent_sketch_spatial_intent_teacher_export")
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_spatial_to_software_first_blocker_handoff_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        handoff: result.handoffPath,
        html: result.htmlPath,
        readme: result.readmePath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
