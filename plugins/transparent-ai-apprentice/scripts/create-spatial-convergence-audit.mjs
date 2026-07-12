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
  const slug =
    String(value || "spatial-convergence-audit")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84)
      .replace(/[.\s-]+$/g, "") || "spatial-convergence-audit";
  return slug.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, `${slug}-audit`);
}

function exists(path) {
  return Boolean(path && existsSync(path) && statSync(path).isFile());
}

function statusRow(id, label, passed, evidence = "", blocker = "") {
  return { id, label, passed: Boolean(passed), evidence, blocker: passed ? "" : blocker };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return exists(path) ? pathToFileURL(path).href : "";
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    auditDoesNotRunCommands: true,
    auditDoesNotRunSpatialTargetConfirmation: true,
    auditDoesNotExecuteTargetSoftware: true,
    auditDoesNotCaptureScreenshots: true,
    auditDoesNotReadLogs: true,
    auditDoesNotWriteMemory: true,
    auditDoesNotEnableRules: true,
    auditDoesNotDeleteRollbackPoints: true,
    teacherExportedOverlayRequiredForRealEvidence: true,
    teacherReviewedDetailLogicRequiredBeforeExecution: true,
    spatialTargetConfirmationInvoked: false,
    screenshotsCaptured: false,
    logContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function sourceSummary(path, packet) {
  return {
    path: path || "",
    exists: Boolean(packet),
    format: packet?.format || "",
    status: packet?.status || "",
    goalComplete: packet?.locks?.goalComplete === true || packet?.goalComplete === true,
    screenshotsCaptured: packet?.locks?.screenshotsCaptured === true,
    executesTargetSoftware: packet?.locks?.softwareActionsExecuted === true || packet?.locks?.targetSoftwareCommandsExecuted === true,
    writesMemory: packet?.locks?.memoryWritten === true,
    enablesRules: packet?.locks?.ruleEnabled === true || packet?.locks?.rulesEnabled === true
  };
}

function writeReadme(path, audit) {
  const lines = [
    "# Spatial / Transparent Sketch Convergence Audit",
    "",
    `Status: ${audit.status}`,
    `Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}`,
    `Implemented checks passed: ${audit.summary.implementedChecksPassed}/${audit.summary.implementedChecks}`,
    `Teacher validation complete: ${audit.summary.teacherValidated}`,
    "",
    "This audit answers whether the transparent drawing mask, 2D/perspective/3D depth sketch understanding, numbered confirmation, and software execution bridge are implemented. It does not treat sample evidence as teacher evidence, run target confirmation, execute software, write memory, enable rules, or claim completion.",
    "",
    "Spatial capability summary:",
    `- transparent drawing mask: ${audit.capabilities.transparentDrawingMaskImplemented}`,
    `- 2D position evidence: ${audit.capabilities.has2DPositionEvidence}`,
    `- angle/direction evidence: ${audit.capabilities.hasAngleOrDirectionEvidence}`,
    `- perspective evidence: ${audit.capabilities.hasPerspectiveEvidence}`,
    `- 3D depth evidence: ${audit.capabilities.has3DDepthEvidence}`,
    `- numbered target confirmation: ${audit.capabilities.numberedTargetConfirmationImplemented}`,
    `- software execution bridge prepared: ${audit.capabilities.softwareExecutionBridgeImplemented}`,
    "",
    "Checks:",
    ...audit.checks.map((row) => `- ${row.passed ? "PASS" : "BLOCKED"} ${row.id}: ${row.label}${row.blocker ? ` (${row.blocker})` : ""}`),
    "",
    "Next teacher action:",
    audit.nextTeacherAction,
    "",
    "Blocked actions:",
    ...audit.blockedActions.map((item) => `- ${item}`)
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, audit) {
  const rows = audit.checks
    .map(
      (row) =>
        `<tr><td>${htmlEscape(row.id)}</td><td>${row.passed ? "PASS" : "BLOCKED"}</td><td>${htmlEscape(row.label)}</td><td>${htmlEscape(row.blocker)}</td></tr>`
    )
    .join("\n");
  const links = audit.primaryOpenOrder
    .map((item) => {
      const href = fileHref(item.path);
      return `<li>${htmlEscape(item.label)}: ${href ? `<a href="${href}">${htmlEscape(item.path)}</a>` : htmlEscape(item.path || "missing")}</li>`;
    })
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html><html><head><meta charset="utf-8"><title>Spatial Convergence Audit</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:1120px;margin:32px auto;padding:0 20px;line-height:1.45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}code{background:#f3f3f3;padding:2px 4px}</style></head><body><h1>Spatial / Transparent Sketch Convergence Audit</h1><p>Status: <code>${htmlEscape(audit.status)}</code></p><p>Passed checks: ${audit.summary.passedChecks}/${audit.summary.totalChecks}. Teacher validation complete: ${audit.summary.teacherValidated}</p><h2>Open Evidence</h2><ol>${links}</ol><h2>Capabilities</h2><pre>${htmlEscape(JSON.stringify(audit.capabilities, null, 2))}</pre><h2>Checks</h2><table><thead><tr><th>Id</th><th>Status</th><th>Check</th><th>Blocker</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`,
    "utf8"
  );
}

const repoRoot = resolve(argValue("--repo-root", process.cwd()));
const goal = argValue("--goal", "Audit transparent sketch spatial and depth convergence before teacher-confirmed target software execution.");
const finalReviewPackPath = resolve(
  argValue(
    "--spatial-final-review-pack",
    newestFile(join(repoRoot, "artifacts", "current-goal-spatial-final-review-packs"), "spatial-final-review-pack.json")
  )
);
const handoffPath = resolve(
  argValue(
    "--teacher-spatial-handoff",
    newestFile(join(repoRoot, "artifacts", "current-goal-teacher-spatial-drawing-handoffs"), "current-goal-teacher-spatial-drawing-handoff.json")
  )
);
const depthRehearsalPath = resolve(
  argValue(
    "--depth-rehearsal",
    newestFile(join(repoRoot, "artifacts", "current-goal-transparent-sketch-depth-demonstration-rehearsals"), "transparent-sketch-depth-demonstration-rehearsal.json")
  )
);
const overlayValidationPath = resolve(
  argValue(
    "--overlay-validation",
    newestFile(join(repoRoot, "artifacts", "current-goal-transparent-sketch-overlay-packet-validations"), "transparent-sketch-overlay-packet-validation.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-spatial-convergence-audits")));

const finalReviewPack = exists(finalReviewPackPath) ? readJson(finalReviewPackPath) : null;
const handoff = exists(handoffPath) ? readJson(handoffPath) : null;
const depthRehearsal = exists(depthRehearsalPath) ? readJson(depthRehearsalPath) : null;
const overlayValidation = exists(overlayValidationPath) ? readJson(overlayValidationPath) : null;
const implementation = finalReviewPack?.implementationSummary || {};
const spatial = finalReviewPack?.spatialEvidenceSummary || {};
const detailLogic = finalReviewPack?.detailLogicSummary || {};
const handoffImpl = handoff?.implementedNow || {};
const sample = handoff?.proofOnlySample || {};
const depthCapabilities = depthRehearsal?.capabilitiesRehearsed || {};

const sources = {
  finalReviewPack: sourceSummary(finalReviewPackPath, finalReviewPack),
  teacherSpatialHandoff: sourceSummary(handoffPath, handoff),
  depthRehearsal: sourceSummary(depthRehearsalPath, depthRehearsal),
  overlayValidation: sourceSummary(overlayValidationPath, overlayValidation)
};
const unsafeSource = Object.values(sources).some(
  (source) => source.goalComplete || source.screenshotsCaptured || source.executesTargetSoftware || source.writesMemory || source.enablesRules
);

const capabilities = {
  transparentDrawingMaskImplemented: Boolean(implementation.transparentDrawingMaskImplemented || handoffImpl.transparentDrawingMaskKitCreated),
  browserTransparentOverlay: Boolean(handoffImpl.browserTransparentOverlay),
  windowsTopMostOverlay: Boolean(handoffImpl.windowsTopMostOverlay),
  exportsLowTokenOverlayPacket: Boolean(handoffImpl.exportsLowTokenOverlayPacket),
  has2DPositionEvidence: Boolean(spatial.has2DPositionEvidence || overlayValidation?.spatialEvidence?.has2DPositionEvidence),
  hasAngleOrDirectionEvidence: Boolean(spatial.hasAngleOrDirectionEvidence || overlayValidation?.spatialEvidence?.hasAngleOrDirectionEvidence),
  hasPerspectiveEvidence: Boolean(spatial.hasPerspectiveEvidence || overlayValidation?.spatialEvidence?.hasPerspectiveEvidence),
  has3DDepthEvidence: Boolean(spatial.has3DDepthEvidence || overlayValidation?.spatialEvidence?.has3DDepthEvidence),
  sketchDemonstrationImplemented: Boolean(implementation.sketchDemonstrationImplemented || depthCapabilities.depthDemonstration || depthCapabilities.twoDPosition),
  numberedTargetConfirmationImplemented: Boolean(implementation.numberedTargetConfirmationImplemented || handoffImpl.numberedTargetConfirmationCommandPreparedButNotRun),
  softwareExecutionBridgeImplemented: Boolean(implementation.softwareExecutionBridgeImplemented || handoffImpl.targetSoftwareExecutionPreparedButNotRun),
  realTeacherOverlayPacketProvided: handoff?.realTeacherOverlayPacketProvided === true,
  samplePacketIsImplementationProofOnly: handoff?.locks?.samplePacketIsImplementationProofOnly === true || sample.notTeacherEvidence === true
};

const checks = [
  statusRow("spatial_final_review_pack_present", "Spatial final review pack is present.", Boolean(finalReviewPack), finalReviewPackPath, "missing_spatial_final_review_pack"),
  statusRow("transparent_overlay_implemented", "Transparent drawing mask exists with browser and top-most overlay routes.", capabilities.transparentDrawingMaskImplemented && capabilities.browserTransparentOverlay && capabilities.windowsTopMostOverlay, "overlay kit", "transparent_overlay_not_implemented"),
  statusRow("overlay_packet_low_token_export", "Overlay can export a low-token vector/metadata packet.", capabilities.exportsLowTokenOverlayPacket, "overlay packet export", "overlay_packet_export_missing"),
  statusRow("two_d_position_understood", "2D position evidence is represented in validation.", capabilities.has2DPositionEvidence, "2D evidence", "two_d_position_evidence_missing"),
  statusRow("angle_direction_understood", "Angle or direction evidence is represented in validation.", capabilities.hasAngleOrDirectionEvidence, "angle/direction evidence", "angle_direction_evidence_missing"),
  statusRow("perspective_understood", "Perspective relation evidence is represented in validation.", capabilities.hasPerspectiveEvidence, "perspective evidence", "perspective_evidence_missing"),
  statusRow("three_d_depth_understood", "3D depth sketch evidence is represented in validation.", capabilities.has3DDepthEvidence, "3D depth evidence", "three_d_depth_evidence_missing"),
  statusRow("depth_rehearsal_present", "2D/3D depth demonstration rehearsal exists and does not execute software.", Boolean(depthRehearsal) && depthRehearsal?.locks?.softwareActionsExecuted === false, depthRehearsalPath, "depth_rehearsal_missing"),
  statusRow("numbered_confirmation_prepared_not_run", "Numbered target confirmation is prepared but not invoked.", capabilities.numberedTargetConfirmationImplemented && finalReviewPack?.locks?.spatialTargetConfirmationInvoked === false, "numbered target confirmation", "numbered_confirmation_missing_or_invoked"),
  statusRow("execution_bridge_prepared_not_run", "Software execution bridge is prepared but target software is not executed.", capabilities.softwareExecutionBridgeImplemented && finalReviewPack?.locks?.softwareActionsExecuted === false, "execution bridge", "execution_bridge_missing_or_executed"),
  statusRow("sample_not_teacher_evidence", "Sample overlay evidence is explicitly marked as implementation proof only.", capabilities.samplePacketIsImplementationProofOnly, sample.validationPath || "", "sample_evidence_boundary_missing"),
  statusRow("detail_logic_review_boundary_present", "Universal detail logic review blockers are explicit before execution.", detailLogic.blockedRows > 0 && detailLogic.fullDetailCoverageReviewed === false, String(detailLogic.blockedRows || 0), "detail_logic_review_boundary_missing"),
  statusRow("review_only_locks_closed", "Sources do not capture screenshots, execute target software, write memory, enable rules, or claim completion.", !unsafeSource, "locks", "unsafe_source_lock_detected")
];

const failed = checks.filter((row) => !row.passed);
const implementedChecks = checks.filter((row) => !["detail_logic_review_boundary_present", "sample_not_teacher_evidence"].includes(row.id));
const teacherValidated = capabilities.realTeacherOverlayPacketProvided === true && detailLogic.fullDetailCoverageReviewed === true;
const auditId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const auditDir = join(outputRoot, auditId);
mkdirSync(auditDir, { recursive: true });
const auditPath = join(auditDir, "spatial-convergence-audit.json");
const receiptTemplatePath = join(auditDir, "spatial-convergence-audit-receipt-template.json");
const readmePath = join(auditDir, "SPATIAL_CONVERGENCE_AUDIT_START_HERE.md");
const htmlPath = join(auditDir, "spatial-convergence-audit.html");
const lockState = locks();

const audit = {
  ok: failed.length === 0,
  format: "transparent_ai_spatial_convergence_audit_v1",
  auditId,
  createdAt: new Date().toISOString(),
  goal,
  status: failed.length
    ? "blocked_waiting_for_spatial_convergence_evidence"
    : "spatial_convergence_ready_for_teacher_review_not_execution",
  summary: {
    totalChecks: checks.length,
    passedChecks: checks.length - failed.length,
    blockedChecks: failed.length,
    implementedChecks: implementedChecks.length,
    implementedChecksPassed: implementedChecks.filter((row) => row.passed).length,
    teacherValidated,
    detailLogicBlockedRows: Number(detailLogic.blockedRows || 0),
    finalGoalCompletionAllowed: false
  },
  capabilities,
  sourceEvidence: sources,
  checks,
  blockers: failed.map((row) => `${row.id}:${row.blocker}`),
  nextTeacherAction:
    "Export and review a real teacher transparent sketch packet, review the 13 consequential detail-logic rows, then confirm numbered target selection before any target software execution gate.",
  primaryOpenOrder: [
    { label: "Spatial Final Review Pack", path: finalReviewPackPath },
    { label: "Teacher Spatial Drawing Handoff", path: handoffPath },
    { label: "Depth Demonstration Rehearsal", path: depthRehearsalPath },
    { label: "Overlay Packet Validation", path: overlayValidationPath }
  ],
  blockedActions: [
    "claim_spatial_goal_complete_from_audit",
    "treat_sample_overlay_as_teacher_evidence",
    "run_spatial_target_confirmation_from_audit",
    "execute_target_software_from_audit",
    "capture_screenshot_from_audit",
    "read_logs_from_audit",
    "write_memory_from_audit",
    "enable_rule_from_audit",
    "delete_rollback_points_from_audit",
    "unlock_packaging_from_audit"
  ],
  completionBoundary: {
    goalComplete: false,
    finalGoalCompletionAllowed: false,
    reason:
      "This audit proves implementation convergence for transparent sketch, 2D/perspective/3D depth, numbered target confirmation, and execution bridge. Completion still requires a real teacher-exported overlay packet, detail-logic review, target confirmation, dry-run approval, and final teacher acceptance."
  },
  paths: {
    audit: auditPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    html: htmlPath
  },
  locks: lockState
};

const receiptTemplate = {
  format: "transparent_ai_spatial_convergence_audit_receipt_template_v1",
  auditId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_real_overlay_packet_review", "blocked_needs_spatial_correction"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "run_spatial_target_confirmation",
    "execute_target_software",
    "capture_screenshot_now",
    "read_logs_now",
    "write_memory",
    "enable_rule",
    "delete_rollback_points",
    "unlock_packaging"
  ],
  reviewRows: checks.map((row) => ({
    checkId: row.id,
    passed: row.passed,
    teacherReviewed: false,
    teacherNote: ""
  })),
  locks: lockState
};

writeJson(auditPath, audit);
writeJson(receiptTemplatePath, receiptTemplate);
writeReadme(readmePath, audit);
writeHtml(htmlPath, audit);

console.log(
  JSON.stringify(
    {
      ok: audit.ok,
      format: "transparent_ai_spatial_convergence_audit_result_v1",
      status: audit.status,
      auditPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      summary: audit.summary,
      blockers: audit.blockers,
      locks: audit.locks
    },
    null,
    2
  )
);
