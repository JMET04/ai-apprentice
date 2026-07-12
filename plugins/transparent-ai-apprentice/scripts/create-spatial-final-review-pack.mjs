#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function newestFile(root, fileName) {
  if (!existsSync(root)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(root);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function slugify(value) {
  return (
    String(value || "spatial-final-review-pack")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "spatial-final-review-pack"
  );
}

function q(value) {
  const text = String(value ?? "");
  return /\s|["<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function commandLine(scriptName, args = []) {
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

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    packDoesNotRunSpatialTargetConfirmation: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotReadLogs: true,
    packDoesNotWriteMemory: true,
    packDoesNotEnableRules: true,
    spatialTargetConfirmationInvoked: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    screenshotsCaptured: false,
    logContentsRead: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function finalLane(gate, id) {
  return (Array.isArray(gate?.lanes) ? gate.lanes : []).find((lane) => lane.id === id) || null;
}

function writeReadme(path, pack) {
  const lines = [
    "# Spatial Final Review Pack",
    "",
    `Status: ${pack.status}`,
    `Sketch demo implemented: ${pack.implementationSummary.sketchDemonstrationImplemented}`,
    `Has 2D evidence: ${pack.spatialEvidenceSummary.has2DPositionEvidence}`,
    `Has perspective evidence: ${pack.spatialEvidenceSummary.hasPerspectiveEvidence}`,
    `Has 3D depth evidence: ${pack.spatialEvidenceSummary.has3DDepthEvidence}`,
    `Detail-logic blocked rows: ${pack.detailLogicSummary.blockedRows}`,
    "",
    "This pack separates implemented demonstration capability from teacher-validated operational readiness.",
    "It does not run spatial target confirmation, execute target software, capture screenshots, read logs, write memory, enable rules, or claim completion.",
    "",
    "Start here:",
    "",
    `1. Review the spatial blocker resolution: ${pack.sourceEvidence.spatialResolutionReadme || pack.sourceEvidence.spatialResolution}`,
    `2. Review the detail-logic validation rows: ${pack.sourceEvidence.detailLogicValidationReadme || pack.sourceEvidence.detailLogicValidation}`,
    "3. Teacher reviews/corrects every consequential detail logic row, including position, angle/direction, perspective, 3D depth, hidden constraints, state, and transfer validation.",
    "4. Re-run spatial intent receipt validation only after teacher review.",
    "",
    "Next commands:",
    ""
  ];
  for (const command of pack.nextReviewCommands) {
    lines.push(`## ${command.id}`, "", command.purpose, "", "```powershell", command.command, "```", "");
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, pack, receiptTemplate) {
  const gapRows = pack.detailLogicSummary.blockedRowsPreview
    .map((row) => `<tr><td><code>${htmlEscape(row.id)}</code></td><td>${htmlEscape(row.status)}</td><td>${htmlEscape(row.blocker)}</td></tr>`)
    .join("\n");
  const commandRows = pack.nextReviewCommands
    .map((command) => `<section><h2>${htmlEscape(command.id)}</h2><p>${htmlEscape(command.purpose)}</p><pre>${htmlEscape(command.command)}</pre></section>`)
    .join("\n");
  const receiptRows = receiptTemplate.reviewRows
    .map((row) => `<tr><td><code>${htmlEscape(row.id)}</code></td><td>${htmlEscape(row.question)}</td><td>${htmlEscape(row.defaultAnswer)}</td></tr>`)
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spatial Final Review Pack</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; padding: 16px; margin: 12px 0; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border-top: 1px solid #e5ebf2; padding: 8px; text-align: left; vertical-align: top; }
    pre, code { background: #edf3f8; border-radius: 5px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; }
    .lock { color: #8a3b00; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>Spatial Final Review Pack</h1>
  <section>
    <p>Status: <code>${htmlEscape(pack.status)}</code></p>
    <p class="lock">Review-only. No spatial confirmation, software execution, screenshot capture, memory write, rule enablement, or completion claim.</p>
    <p>Spatial receipt validation: <a href="${htmlEscape(fileHref(pack.sourceEvidence.spatialReceiptValidation))}">${htmlEscape(pack.sourceEvidence.spatialReceiptValidation)}</a></p>
    <p>Detail logic validation: <a href="${htmlEscape(fileHref(pack.sourceEvidence.detailLogicValidation))}">${htmlEscape(pack.sourceEvidence.detailLogicValidation)}</a></p>
  </section>
  <section>
    <h2>Evidence Summary</h2>
    <table><tbody>
      <tr><th>2D position</th><td>${htmlEscape(pack.spatialEvidenceSummary.has2DPositionEvidence)}</td></tr>
      <tr><th>Perspective</th><td>${htmlEscape(pack.spatialEvidenceSummary.hasPerspectiveEvidence)}</td></tr>
      <tr><th>3D depth</th><td>${htmlEscape(pack.spatialEvidenceSummary.has3DDepthEvidence)}</td></tr>
      <tr><th>Blocked detail rows</th><td>${htmlEscape(pack.detailLogicSummary.blockedRows)}</td></tr>
    </tbody></table>
  </section>
  <section><h2>Blocked Detail Rows</h2><table><thead><tr><th>Row</th><th>Status</th><th>Blocker</th></tr></thead><tbody>${gapRows}</tbody></table></section>
  <section><h2>Teacher Receipt Rows</h2><table><thead><tr><th>Row</th><th>Question</th><th>Default</th></tr></thead><tbody>${receiptRows}</tbody></table></section>
  ${commandRows}
</main>
</body>
</html>
`,
    "utf8"
  );
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Prepare transparent sketch spatial intent and detail logic for final teacher review without claiming execution readiness.");
const sketchAuditPath = resolve(
  argValue(
    "--sketch-audit",
    newestFile(join(repoRoot, "artifacts", "sketch-demonstration-implementation-audits"), "sketch-demonstration-implementation-audit.json")
  )
);
const spatialResolutionPath = resolve(
  argValue(
    "--spatial-resolution",
    newestFile(join(repoRoot, "artifacts", "current-goal-spatial-first-blocker-overlay-resolutions"), "spatial-first-blocker-overlay-resolution.json")
  )
);
const spatialReceiptValidationPath = resolve(
  argValue(
    "--spatial-receipt-validation",
    newestFile(join(repoRoot, "artifacts", "current-goal-spatial-first-blocker-overlay-resolutions"), "spatial-intent-evidence-receipt-validation.json")
  )
);
const detailLogicValidationPath = resolve(
  argValue(
    "--detail-logic-validation",
    newestFile(join(repoRoot, "artifacts", "current-goal-spatial-detail-logic-receipt-validations"), "parametric-drawing-logic-receipt-validation.json")
  )
);
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-spatial-final-review-packs")));
if (!existsSync(spatialResolutionPath)) throw new Error(`Missing spatial resolution: ${spatialResolutionPath}`);
if (!existsSync(spatialReceiptValidationPath)) throw new Error(`Missing spatial receipt validation: ${spatialReceiptValidationPath}`);
if (!existsSync(detailLogicValidationPath)) throw new Error(`Missing detail logic validation: ${detailLogicValidationPath}`);

const sketchAudit = existsSync(sketchAuditPath) ? readJson(sketchAuditPath) : null;
const spatialResolution = readJson(spatialResolutionPath);
const spatialValidation = readJson(spatialReceiptValidationPath);
const detailValidation = readJson(detailLogicValidationPath);
const finalGate = existsSync(finalGatePath) ? readJson(finalGatePath) : null;
const spatialLane = finalLane(finalGate, "teacher_validated_spatial_intent_and_detail_logic");
const demoLane = finalLane(finalGate, "transparent_2d_perspective_3d_sketch_implementation");
const validationRow = spatialValidation.validationRow || {};
const spatialEvidence = validationRow.spatialEvidence || {};
const detailCounts = detailValidation.counts || {};
const blockedRows = Array.isArray(detailValidation.blockedRows) ? detailValidation.blockedRows : [];
const lockState = locks();
const blockers = [];
if (demoLane && demoLane.ready !== true) blockers.push("transparent_sketch_demo_not_ready");
if (spatialResolution.overlayReadyForReceipt !== true) blockers.push("overlay_packet_not_ready_for_receipt");
if (validationRow.hasSpatialEvidence !== true) blockers.push("spatial_receipt_lacks_spatial_evidence");
if (spatialEvidence.has2DPositionEvidence !== true) blockers.push("missing_2d_position_evidence");
if (spatialEvidence.hasPerspectiveEvidence !== true) blockers.push("missing_perspective_evidence");
if (spatialEvidence.has3DDepthEvidence !== true) blockers.push("missing_3d_depth_evidence");
if (detailValidation.status !== "blocked_until_teacher_reviews_every_consequential_detail_logic_row") {
  blockers.push("detail_logic_validation_not_waiting_for_teacher_review");
}
if (Number(detailCounts.blockedRows || 0) < 1) blockers.push("detail_logic_validation_has_no_blocked_rows_to_review");
if (spatialValidation.status !== "blocked") blockers.push("spatial_receipt_validation_not_blocked_for_review");
if (spatialLane && spatialLane.ready !== false) blockers.push("final_spatial_lane_not_blocked");
if (spatialValidation.locks?.spatialTargetConfirmationInvoked !== false) blockers.push("spatial_validation_confirmation_lock_missing");
if (detailValidation.locks?.validationDoesNotExecuteSoftware !== true) blockers.push("detail_logic_execution_lock_missing");

const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packDir = join(outputRoot, packId);
mkdirSync(packDir, { recursive: true });
const packPath = join(packDir, "spatial-final-review-pack.json");
const receiptTemplatePath = join(packDir, "spatial-final-review-receipt-template.json");
const readmePath = join(packDir, "SPATIAL_FINAL_REVIEW_START_HERE.md");
const htmlPath = join(packDir, "spatial-final-review-pack.html");

const receiptTemplate = {
  format: "transparent_ai_spatial_final_review_receipt_template_v1",
  packId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_detail_logic_row_review", "ready_for_spatial_receipt_review", "blocked"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "execute_now",
    "run_spatial_confirmation_now",
    "capture_screenshot_now",
    "write_memory",
    "enable_rule",
    "unlock_packaging"
  ],
  reviewRows: [
    {
      id: "overlay_packet_review",
      question: "Does the teacher-exported overlay packet represent the teacher's intended 2D, perspective, and 3D depth sketch?",
      defaultAnswer: "not_reviewed_yet"
    },
    {
      id: "universal_detail_logic_review",
      question: "Has every consequential visible, hidden, derived, state, and transfer detail been reviewed as data, formula, constraint, exception, or decorative/non-parametric?",
      defaultAnswer: "needs_teacher_review"
    },
    {
      id: "spatial_receipt_validation_review",
      question: "After detail logic review, did spatial receipt validation become ready for reviewed spatial target confirmation?",
      defaultAnswer: "blocked_missing_universal_detail_logic_review"
    },
    {
      id: "execution_boundary_review",
      question: "Confirm that this pack itself is not permission to run target software.",
      defaultAnswer: "execution_still_blocked"
    }
  ],
  locks: lockState
};

const pack = {
  ok: blockers.length === 0,
  format: "transparent_ai_spatial_final_review_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  goal,
  status: blockers.length
    ? "blocked_waiting_for_valid_spatial_review_inputs"
    : "waiting_for_teacher_spatial_detail_logic_review_before_execution",
  blockers,
  implementationSummary: {
    sketchDemonstrationImplemented: sketchAudit?.status === "sketch_demonstration_implemented_waiting_for_teacher_real_overlay_review",
    transparentDrawingMaskImplemented: sketchAudit?.requirementSummary?.transparentDrawingMaskImplemented === true,
    teacher2DSketchUnderstood: sketchAudit?.requirementSummary?.teacher2DSketchUnderstood === true,
    teacherPerspectiveSketchUnderstood: sketchAudit?.requirementSummary?.teacherPerspectiveSketchUnderstood === true,
    teacher3DDepthSketchUnderstood: sketchAudit?.requirementSummary?.teacher3DDepthSketchUnderstood === true,
    numberedTargetConfirmationImplemented: sketchAudit?.requirementSummary?.numberedTargetConfirmationImplemented === true,
    softwareExecutionBridgeImplemented: sketchAudit?.requirementSummary?.softwareExecutionBridgeImplemented === true
  },
  spatialEvidenceSummary: {
    receiptValidationStatus: spatialValidation.status,
    validationDecision: spatialValidation.validationDecision || "",
    overlayPacketExists: validationRow.overlayPacketExists === true,
    overlayPacketFormatOk: validationRow.overlayPacketFormatOk === true,
    has2DPositionEvidence: spatialEvidence.has2DPositionEvidence === true,
    hasAngleOrDirectionEvidence: spatialEvidence.hasAngleOrDirectionEvidence === true,
    hasPerspectiveEvidence: spatialEvidence.hasPerspectiveEvidence === true,
    has3DDepthEvidence: spatialEvidence.has3DDepthEvidence === true,
    canPrepareSpatialConfirmation: validationRow.canPrepareSpatialConfirmation === true
  },
  detailLogicSummary: {
    status: detailValidation.status,
    decision: detailValidation.decision,
    blockedRows: Number(detailCounts.blockedRows || blockedRows.length || 0),
    relationshipRows: Number(detailCounts.relationshipRows || 0),
    universalDetailLogicRows: Number(detailCounts.universalDetailLogicRows || 0),
    transferValidationRows: Number(detailCounts.transferValidationRows || 0),
    fullDetailCoverageReviewed: detailValidation.requirementGates?.fullDetailCoverageReviewed === true,
    implicitHiddenDerivedDetailCoverageReviewed:
      detailValidation.requirementGates?.implicitHiddenDerivedDetailCoverageReviewed === true,
    blockedRowsPreview: blockedRows.slice(0, 10).map((row, index) => ({
      id: row.relationshipId || row.validationId || row.featureId || `row-${index + 1}`,
      status: row.status || "blocked",
      blocker: row.blocker || ""
    }))
  },
  sourceEvidence: {
    sketchAudit: existsSync(sketchAuditPath) ? sketchAuditPath : "",
    spatialResolution: spatialResolutionPath,
    spatialResolutionReadme: spatialResolution.paths?.readme || "",
    overlayPacket: spatialResolution.paths?.overlayPacket || spatialValidation.paths?.teacherExportedOverlayPacket || "",
    overlayValidation: spatialResolution.paths?.overlayValidation || "",
    spatialReceiptValidation: spatialReceiptValidationPath,
    spatialReceiptValidationReadme: spatialValidation.paths?.readme || "",
    detailLogicValidation: detailLogicValidationPath,
    detailLogicValidationReadme: detailValidation.paths?.readme || "",
    detailLogicSourceKit: detailValidation.paths?.sourceKit || detailValidation.sourceKit || "",
    detailLogicSourceReceipt: detailValidation.paths?.sourceReceipt || detailValidation.sourceReceipt || "",
    finalCompletionGate: existsSync(finalGatePath) ? finalGatePath : "",
    finalSpatialLaneStatus: spatialLane?.status || "missing",
    finalSpatialLaneEvidence: spatialLane?.evidence || "",
    finalDemoLaneStatus: demoLane?.status || "missing"
  },
  nextReviewCommands: [
    {
      id: "open_spatial_blocker_resolution",
      purpose: "Review the current overlay packet, prefilled receipt, and blocked transitions.",
      command: spatialResolution.paths?.readme || spatialResolutionPath
    },
    {
      id: "open_detail_logic_validation",
      purpose: "Teacher reviews/corrects each blocked detail logic row before any spatial execution preparation.",
      command: detailValidation.paths?.readme || detailLogicValidationPath
    },
    {
      id: "validate_teacher_filled_spatial_receipt_after_detail_logic_review",
      purpose: "After teacher detail-logic review, validate the teacher-filled spatial intent evidence receipt.",
      command: commandLine("validate-spatial-intent-evidence-receipt.mjs", [
        "--request",
        spatialValidation.paths?.sourceRequest || "<spatial-intent-evidence-request.json>",
        "--receipt",
        "<teacher-filled-spatial-intent-evidence-receipt.json>",
        "--output-dir",
        "artifacts\\current-goal-spatial-intent-evidence-receipt-validations"
      ])
    },
    {
      id: "prepare_spatial_confirmation_only_after_validation_ready",
      purpose: "Prepare numbered spatial target confirmation only after receipt validation reports ready_for_reviewed_spatial_target_confirmation.",
      command: commandLine("create-spatial-target-confirmation-kit.mjs", [
        "--spatial-intent-validation",
        "<ready-spatial-intent-evidence-receipt-validation.json>",
        "--output-dir",
        "artifacts\\current-goal-spatial-target-confirmation-kits"
      ])
    }
  ],
  completionBoundary: {
    spatialExecutionReady: false,
    finalGoalCompletionAllowed: false,
    reason:
      "This pack proves the implementation path and organizes teacher review, but execution remains blocked until universal detail logic and spatial receipt validation pass."
  },
  paths: {
    pack: packPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

writeJson(packPath, pack);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, pack);
writeHtml(htmlPath, pack, receiptTemplate);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_spatial_final_review_pack_result_v1",
      status: pack.status,
      packPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      blockers,
      spatialEvidenceSummary: pack.spatialEvidenceSummary,
      detailLogicSummary: pack.detailLogicSummary,
      locks: lockState
    },
    null,
    2
  )
);
