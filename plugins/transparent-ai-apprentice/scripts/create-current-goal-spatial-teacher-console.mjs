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

function visitFiles(root, fileName) {
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) return [];
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(resolvedRoot);
  return found;
}

function newestFile(root, fileName) {
  return visitFiles(root, fileName).sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestRollbackPoint(root) {
  return newestFile(join(root, ".transparent-apprentice", "rollback-points"), "rollback-point.json");
}

function slugify(value) {
  return (
    String(value || "spatial-teacher-console")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 84) || "spatial-teacher-console"
  );
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
    consoleDoesNotFillReceipts: true,
    consoleDoesNotCreateOverlay: true,
    consoleDoesNotInterpretNewSketch: true,
    consoleDoesNotConfirmTargets: true,
    consoleDoesNotRunExecutionGate: true,
    consoleDoesNotExecuteTargetSoftware: true,
    consoleDoesNotWriteMemory: true,
    consoleDoesNotDeleteRollbackPoint: true,
    overlayCreated: false,
    newSpatialInterpretationRun: false,
    numberedTargetConfirmed: false,
    targetSoftwareCommandsExecuted: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    spatialIntentAccepted: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function laneById(gate, id) {
  return (Array.isArray(gate?.lanes) ? gate.lanes : []).find((lane) => lane?.id === id) || null;
}

function evidenceRows(map) {
  return Object.entries(map)
    .map(
      ([key, value]) =>
        `<tr><td><code>${htmlEscape(key)}</code></td><td><a href="${htmlEscape(fileHref(value))}">${htmlEscape(value || "missing")}</a></td></tr>`
    )
    .join("\n");
}

function writeHtml(path, consoleArtifact) {
  const stepRows = consoleArtifact.teacherActionSequence
    .map(
      (step) => `<tr><td><code>${htmlEscape(step.id)}</code></td><td>${htmlEscape(step.action)}</td><td>${htmlEscape(step.continueCondition)}</td><td>${htmlEscape(step.stopCondition)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spatial Intent Teacher Console</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
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
  <h1>Spatial Intent Teacher Console</h1>
  <section>
    <p>Status: <code>${htmlEscape(consoleArtifact.status)}</code></p>
    <p>Spatial final lane ready: <code>${htmlEscape(consoleArtifact.finalLane.ready)}</code></p>
    <p class="lock">Review-only. This console does not fill receipts, create overlays, interpret new sketches, confirm targets, run execution gates, execute software, write memory, delete rollback points, or claim completion.</p>
  </section>
  <section>
    <h2>Capability State</h2>
    <table><tbody>
      <tr><th>2D/Perspective/3D implementation audit</th><td>${htmlEscape(consoleArtifact.capabilityState.sketchImplementationReady)}</td></tr>
      <tr><th>Overlay packet validation</th><td>${htmlEscape(consoleArtifact.capabilityState.overlayPacketStatus)}</td></tr>
      <tr><th>Depth rehearsal</th><td>${htmlEscape(consoleArtifact.capabilityState.depthRehearsalStatus)}</td></tr>
      <tr><th>Spatial receipt validation</th><td>${htmlEscape(consoleArtifact.capabilityState.spatialReceiptValidationStatus)}</td></tr>
      <tr><th>Spatial convergence</th><td>${htmlEscape(consoleArtifact.capabilityState.spatialConvergenceStatus)}</td></tr>
    </tbody></table>
  </section>
  <section>
    <h2>Teacher Action Sequence</h2>
    <table><thead><tr><th>Step</th><th>Action</th><th>Continue</th><th>Stop</th></tr></thead><tbody>${stepRows}</tbody></table>
  </section>
  <section>
    <h2>Source Evidence</h2>
    <table><thead><tr><th>Source</th><th>Path</th></tr></thead><tbody>${evidenceRows(consoleArtifact.sourceEvidence)}</tbody></table>
  </section>
</main>
</body>
</html>
`,
    "utf8"
  );
}

function writeReadme(path, consoleArtifact) {
  const lines = [
    "# Spatial Intent Teacher Console",
    "",
    `Status: ${consoleArtifact.status}`,
    `Spatial final lane ready: ${consoleArtifact.finalLane.ready}`,
    "",
    "This console ties transparent drawing mask, 2D position, perspective relation, 3D depth rehearsal, detail-logic review, numbered target confirmation, and execution-gate preparation into one review-only teacher entrypoint.",
    "It does not fill receipts, create overlays, interpret new sketches, confirm numbered targets, run execution gates, execute software, write memory, delete rollback points, or claim completion.",
    "",
    "## Teacher Sequence",
    "",
    ...consoleArtifact.teacherActionSequence.map((step, index) => `${index + 1}. ${step.action}`),
    "",
    "## Final Gate Boundary",
    "",
    consoleArtifact.finalLane.blocker || "Spatial final lane is still not complete."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Create spatial intent teacher console for transparent sketch overlay review.");
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
  )
);
const sketchAuditPath = resolve(
  argValue(
    "--sketch-implementation-audit",
    newestFile(join(repoRoot, "artifacts", "sketch-demonstration-implementation-audits"), "sketch-demonstration-implementation-audit.json")
  )
);
const overlayValidationPath = resolve(
  argValue(
    "--overlay-packet-validation",
    newestFile(join(repoRoot, "artifacts", "current-goal-transparent-sketch-overlay-packet-validations"), "transparent-sketch-overlay-packet-validation.json")
  )
);
const depthRehearsalPath = resolve(
  argValue(
    "--depth-rehearsal",
    newestFile(join(repoRoot, "artifacts", "current-goal-transparent-sketch-depth-demonstration-rehearsals"), "transparent-sketch-depth-demonstration-rehearsal.json")
  )
);
const spatialReceiptValidationPath = resolve(
  argValue(
    "--spatial-receipt-validation",
    newestFile(join(repoRoot, "artifacts", "current-goal-spatial-first-blocker-overlay-resolutions"), "spatial-intent-evidence-receipt-validation.json")
  )
);
const spatialFinalReviewPackPath = resolve(
  argValue(
    "--spatial-final-review-pack",
    newestFile(join(repoRoot, "artifacts", "current-goal-spatial-final-review-packs"), "spatial-final-review-pack.json")
  )
);
const spatialConvergenceAuditPath = resolve(
  argValue(
    "--spatial-convergence-audit",
    newestFile(join(repoRoot, "artifacts", "current-goal-spatial-convergence-audits"), "spatial-convergence-audit.json")
  )
);
const spatialDrawingHandoffPath = resolve(
  argValue(
    "--spatial-drawing-handoff",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-spatial-drawing-handoffs"), "current-goal-teacher-spatial-drawing-handoff.json")
  )
);
const rollbackPath = resolve(argValue("--rollback-point", newestRollbackPoint(repoRoot)));
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-spatial-teacher-consoles"))
);
mkdirSync(outputRoot, { recursive: true });

const finalGate = existsSync(finalGatePath) ? readJson(finalGatePath) : null;
const sketchAudit = existsSync(sketchAuditPath) ? readJson(sketchAuditPath) : null;
const overlayValidation = existsSync(overlayValidationPath) ? readJson(overlayValidationPath) : null;
const depthRehearsal = existsSync(depthRehearsalPath) ? readJson(depthRehearsalPath) : null;
const spatialReceiptValidation = existsSync(spatialReceiptValidationPath) ? readJson(spatialReceiptValidationPath) : null;
const spatialFinalReviewPack = existsSync(spatialFinalReviewPackPath) ? readJson(spatialFinalReviewPackPath) : null;
const spatialConvergenceAudit = existsSync(spatialConvergenceAuditPath) ? readJson(spatialConvergenceAuditPath) : null;
const spatialDrawingHandoff = existsSync(spatialDrawingHandoffPath) ? readJson(spatialDrawingHandoffPath) : null;
const rollback = existsSync(rollbackPath) ? readJson(rollbackPath) : null;
const spatialLane = laneById(finalGate, "teacher_validated_spatial_intent_and_detail_logic");
const sketchLane = laneById(finalGate, "transparent_2d_perspective_3d_sketch_implementation");

const blockers = [];
if (!finalGate) blockers.push("final_completion_gate_missing");
if (!spatialLane) blockers.push("spatial_final_lane_missing");
if (!sketchAudit) blockers.push("sketch_implementation_audit_missing");
if (!overlayValidation) blockers.push("overlay_packet_validation_missing");
if (!depthRehearsal) blockers.push("depth_rehearsal_missing");
if (!spatialReceiptValidation) blockers.push("spatial_receipt_validation_missing");
if (!spatialFinalReviewPack) blockers.push("spatial_final_review_pack_missing");
if (!spatialConvergenceAudit) blockers.push("spatial_convergence_audit_missing");
if (!spatialDrawingHandoff) blockers.push("spatial_drawing_handoff_missing");
if (!rollback) blockers.push("rollback_point_missing");

const consoleStatus = blockers.length
  ? "spatial_teacher_console_needs_source_evidence"
  : "spatial_teacher_console_ready_for_teacher_receipts_not_execution";
const consoleId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const consoleDir = join(outputRoot, consoleId);
mkdirSync(consoleDir, { recursive: true });
const consolePath = join(consoleDir, "current-goal-spatial-teacher-console.json");
const htmlPath = join(consoleDir, "current-goal-spatial-teacher-console.html");
const readmePath = join(consoleDir, "CURRENT_GOAL_SPATIAL_TEACHER_CONSOLE.md");

const consoleArtifact = {
  ok: blockers.length === 0,
  format: "transparent_ai_current_goal_spatial_teacher_console_v1",
  consoleId,
  createdAt: new Date().toISOString(),
  goal,
  status: consoleStatus,
  blockers,
  finalLane: {
    id: spatialLane?.id || "teacher_validated_spatial_intent_and_detail_logic",
    ready: spatialLane?.ready === true,
    blocker: spatialLane?.blocker || "",
    sourcePath: spatialLane?.sourcePath || ""
  },
  sketchImplementationLane: {
    id: sketchLane?.id || "transparent_2d_perspective_3d_sketch_implementation",
    ready: sketchLane?.ready === true,
    sourcePath: sketchLane?.sourcePath || ""
  },
  capabilityState: {
    sketchImplementationReady: sketchLane?.ready === true,
    overlayPacketStatus: overlayValidation?.status || "",
    depthRehearsalStatus: depthRehearsal?.status || "",
    spatialReceiptValidationStatus: spatialReceiptValidation?.status || "",
    spatialFinalReviewPackStatus: spatialFinalReviewPack?.status || "",
    spatialConvergenceStatus: spatialConvergenceAudit?.status || "",
    spatialDrawingHandoffStatus: spatialDrawingHandoff?.status || "",
    completionClaimAllowed: false
  },
  teacherActionSequence: [
    {
      id: "export_teacher_overlay_packet",
      action: "Teacher exports or confirms the transparent sketch overlay packet that carries the intended 2D position, perspective relation, and 3D depth cues.",
      continueCondition: "Overlay packet validation is ready and the teacher evidence references the actual exported overlay.",
      stopCondition: "Overlay is missing, generated without teacher drawing, or not tied to a source screenshot/canvas."
    },
    {
      id: "validate_spatial_intent_receipt",
      action: "Teacher fills the spatial intent evidence receipt for reviewed 2D position, perspective relation, 3D depth, and detail-logic contract.",
      continueCondition: "Receipt validation passes and does not accept execution or completion.",
      stopCondition: "Any detail logic is placeholder-only or any receipt decision tries to execute software."
    },
    {
      id: "confirm_numbered_spatial_target",
      action: "Use the numbered target confirmation route only after the teacher selects one spatial target.",
      continueCondition: "Exactly one target is teacher-confirmed and routed to dry-run-first execution gate preparation.",
      stopCondition: "Multiple targets, ambiguous target, or no teacher-selected number."
    },
    {
      id: "prepare_execution_gate_without_running",
      action: "Prepare the existing spatial-to-software execution gate package, still blocked before target software execution.",
      continueCondition: "Execution gate remains review-only with rollback and teacher approval requirements.",
      stopCondition: "Any command would run target software or write memory before the separate execution approval gate."
    }
  ],
  sourceEvidence: {
    finalCompletionGate: existsSync(finalGatePath) ? finalGatePath : "",
    sketchImplementationAudit: existsSync(sketchAuditPath) ? sketchAuditPath : "",
    overlayPacketValidation: existsSync(overlayValidationPath) ? overlayValidationPath : "",
    depthDemonstrationRehearsal: existsSync(depthRehearsalPath) ? depthRehearsalPath : "",
    spatialIntentReceiptValidation: existsSync(spatialReceiptValidationPath) ? spatialReceiptValidationPath : "",
    spatialFinalReviewPack: existsSync(spatialFinalReviewPackPath) ? spatialFinalReviewPackPath : "",
    spatialConvergenceAudit: existsSync(spatialConvergenceAuditPath) ? spatialConvergenceAuditPath : "",
    teacherSpatialDrawingHandoff: existsSync(spatialDrawingHandoffPath) ? spatialDrawingHandoffPath : "",
    rollbackPoint: existsSync(rollbackPath) ? rollbackPath : ""
  },
  paths: {
    console: consolePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: locks()
};

writeJson(consolePath, consoleArtifact);
writeHtml(htmlPath, consoleArtifact);
writeReadme(readmePath, consoleArtifact);

console.log(
  JSON.stringify(
    {
      ok: true,
      consolePath,
      htmlPath,
      readmePath,
      status: consoleArtifact.status,
      blockers: consoleArtifact.blockers,
      capabilityState: consoleArtifact.capabilityState
    },
    null,
    2
  )
);
