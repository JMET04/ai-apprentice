#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "spatial-intent-evidence-receipt-builder-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runScript(args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", "create-spatial-intent-evidence-receipt-builder.mjs"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "create-spatial-intent-evidence-receipt-builder failed");
  return JSON.parse(result.stdout);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const requestPath = writeJson(join(smokeRoot, "spatial-intent-evidence-request.json"), {
  format: "transparent_ai_spatial_intent_evidence_request_v1",
  status: "waiting_for_teacher_exported_overlay_packet",
  goal: "Smoke spatial intent evidence receipt builder.",
  software: "ExampleCAD",
  transparentSketchOverlayPath: join(smokeRoot, "transparent-sketch-overlay.html"),
  teacherExportedOverlayPacketPlaceholder: "<teacher-exported-transparent-sketch-packet.json>",
  expectedPacketFormat: "transparent_ai_sketch_overlay_packet_v1",
  spatialTargetConfirmationCommandTemplate:
    'node plugins\\transparent-ai-apprentice\\scripts\\create-spatial-target-confirmation-kit.mjs --overlay-packet "<teacher-exported-transparent-sketch-packet.json>" --goal "Smoke spatial intent evidence receipt builder." --software "ExampleCAD" --output-dir "out" --create-action-kit "true"',
  teacherHandoffSteps: [
    {
      order: 1,
      action: "Open the transparent sketch overlay.",
      evidenceExpected: "Teacher sees target context.",
      stopCondition: "Stop if overlay is not aligned."
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  },
  blockedActions: ["fabricate_spatial_intent_without_teacher_exported_packet"]
});

const result = runScript(["--request", requestPath, "--goal", "Build a spatial intent receipt builder smoke.", "--output-dir", smokeRoot]);
const builder = readJson(result.builderPath);
const receiptTemplate = readJson(result.receiptTemplatePath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const checks = [
  {
    name: "Spatial intent evidence receipt builder writes teacher-facing HTML and receipt template",
    pass:
      result.format === "transparent_ai_spatial_intent_evidence_receipt_builder_result_v1" &&
      builder.format === "transparent_ai_spatial_intent_evidence_receipt_builder_v1" &&
      receiptTemplate.format === "transparent_ai_spatial_intent_evidence_receipt_v1" &&
      existsSync(result.htmlPath) &&
      html.includes("Spatial Intent Evidence Receipt Builder") &&
      html.includes("Teacher-exported overlay packet path") &&
      html.includes("Required spatial evidence") &&
      html.includes("Universal detail logic contract or kit path") &&
      html.includes("Passed detail logic receipt validation path"),
    evidence: result.htmlPath
  },
  {
    name: "Receipt builder preserves placeholder and requires teacher review before validation",
    pass:
      receiptTemplate.teacherDecision === "needs_teacher_review" &&
      receiptTemplate.evidenceReviewed === false &&
      receiptTemplate.teacherExportedOverlayPacketPath === "<teacher-exported-transparent-sketch-packet.json>" &&
      receiptTemplate.detailLogicReviewed === false &&
      receiptTemplate.universalDetailLogicContractPath === "<teacher-reviewed-universal-detail-logic-contract-or-kit.json>" &&
      receiptTemplate.universalDetailLogicReceiptValidationPath === "<passed-parametric-drawing-logic-receipt-validation.json>" &&
      receiptTemplate.requiredSpatialEvidenceDimensions.includes("3d_depth_hint_or_near_far_relation") &&
      receiptTemplate.blockedTeacherDecisions.includes("execute_now") &&
      receiptTemplate.locks.builderDoesNotValidateReceipt === true,
    evidence: result.receiptTemplatePath
  },
  {
    name: "Receipt builder prepares only validation command and keeps execution locks closed",
    pass:
      builder.nextValidationCommand.includes("validate-spatial-intent-evidence-receipt.mjs") &&
      builder.nextValidationCommand.includes("<teacher-filled-spatial-intent-evidence-receipt.json>") &&
      readme.includes("does not run spatial target confirmation") &&
      builder.universalDetailLogicPolicy.allConsequentialDetailsMustBeLogicized === true &&
      builder.universalDetailLogicPolicy.linesAndAnglesAreExamplesOnly === true &&
      builder.universalDetailLogicPolicy.passedReceiptValidationRequired === true &&
      builder.universalDetailLogicPolicy.requiredSpatialEvidenceDimensions.includes("perspective_relationship") &&
      builder.universalDetailLogicPolicy.minimumSpatialEvidenceRule.includes("2D position") &&
      builder.blockedActions.includes("prepare_spatial_confirmation_without_universal_detail_logic_review") &&
      builder.blockedActions.includes("prepare_spatial_confirmation_without_passed_detail_logic_receipt_validation") &&
      builder.locks.builderDoesNotRunSpatialTargetConfirmation === true &&
      builder.locks.builderDoesNotBypassUniversalDetailLogic === true &&
      builder.locks.builderDoesNotAcceptUnvalidatedDetailLogic === true &&
      builder.locks.softwareActionsExecuted === false &&
      builder.locks.screenshotsCaptured === false &&
      builder.locks.memoryWritten === false &&
      builder.locks.goalComplete === false,
    evidence: result.builderPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "passed",
      smoke: "transparent_ai_spatial_intent_evidence_receipt_builder_smoke_v1",
      smokeRoot,
      paths: {
        builder: result.builderPath,
        html: result.htmlPath,
        receiptTemplate: result.receiptTemplatePath,
        readme: result.readmePath
      },
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
