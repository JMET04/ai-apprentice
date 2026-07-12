#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-completion-blocker-matrix")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-completion-blocker-matrix"
  );
}

function readJson(path, required = false) {
  if (!path || !existsSync(path)) {
    if (required) throw new Error(`JSON file is required: ${path || "(missing)"}`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileHref(path) {
  return path ? pathToFileURL(path).href : "";
}

function lockedReviewOnly() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    matrixDoesNotValidateReceipts: true,
    matrixDoesNotRegisterTask: true,
    matrixDoesNotLaunchRunner: true,
    matrixDoesNotExecuteTargetSoftware: true,
    matrixDoesNotCaptureScreenshots: true,
    matrixDoesNotReadFullLogs: true,
    matrixDoesNotWriteMemory: true,
    matrixDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function compactEvidence(parts) {
  return parts.filter(Boolean).join("; ") || "no current evidence found in this refresh";
}

function verifier(script, args = []) {
  const command = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    command.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return command.join(" ");
}

function row({
  id,
  lane,
  requirement,
  currentEvidence,
  missingProof,
  nextSafeAction,
  verifierCommand,
  reviewCommandTemplates = [],
  sourcePaths = [],
  blockedClaims = []
}) {
  return {
    id,
    lane,
    status: "blocked_or_waiting_for_teacher_reviewed_evidence",
    requirement,
    currentEvidence,
    missingProof,
    nextSafeAction,
    verifierCommand,
    reviewCommandTemplates: array(reviewCommandTemplates).filter(Boolean),
    sourcePaths: sourcePaths.filter(Boolean),
    blockedClaims,
    locks: lockedReviewOnly()
  };
}

function writeHtml(path, matrix) {
  const rows = matrix.rows
    .map(
      (item) => `<tr>
        <td>${htmlEscape(item.lane)}</td>
        <td>${htmlEscape(item.requirement)}</td>
        <td>${htmlEscape(item.currentEvidence)}</td>
        <td>${htmlEscape(item.missingProof)}</td>
        <td>${htmlEscape(item.nextSafeAction)}</td>
        <td><code>${htmlEscape(item.verifierCommand)}</code></td>
        <td>${array(item.reviewCommandTemplates)
          .map((command) => `<code>${htmlEscape(command)}</code>`)
          .join("<br>")}</td>
      </tr>`
    )
    .join("");
  const sourceLinks = Object.entries(matrix.sourceEvidence)
    .filter(([, value]) => value)
    .map(
      ([key, value]) =>
        `<li>${htmlEscape(key)}: <a href="${htmlEscape(fileHref(value))}">${htmlEscape(basename(value))}</a></li>`
    )
    .join("");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Original Goal Completion Blocker Matrix</title>
  <style>
    :root { color: #17202a; background: #f6f8fb; font: 14px/1.45 "Segoe UI", Arial, sans-serif; }
    body { margin: 0; }
    main { max-width: 1220px; margin: 0 auto; padding: 26px; }
    h1 { margin: 0 0 8px; font-size: 27px; letter-spacing: 0; }
    h2 { margin: 24px 0 12px; font-size: 18px; letter-spacing: 0; }
    .summary, table { background: #fff; border: 1px solid #d9e2ef; border-radius: 8px; }
    .summary { padding: 15px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 9px; text-align: left; vertical-align: top; }
    th { background: #edf3f8; }
    code { background: #eef3f8; border-radius: 5px; padding: 2px 4px; overflow-wrap: anywhere; }
    a { color: #145f8f; }
    .lock { color: #596779; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <h1>Original Goal Completion Blocker Matrix</h1>
  <section class="summary">
    <p><strong>Status:</strong> ${htmlEscape(matrix.status)}</p>
    <p><strong>Completion decision:</strong> ${htmlEscape(matrix.completionDecision)}</p>
    <p><strong>Next safe action:</strong> ${htmlEscape(matrix.nextSafeAction)}</p>
    <p class="lock">This matrix is review-only. It does not register tasks, launch runners, execute target software, capture screenshots, read full logs, write memory, enable rules, unlock packaging, or claim completion.</p>
  </section>
  <h2>Source Evidence</h2>
  <ul>${sourceLinks || "<li>No linked source files were available.</li>"}</ul>
  <h2>Blockers</h2>
  <table>
    <thead><tr><th>Lane</th><th>Requirement</th><th>Current Evidence</th><th>Missing Proof</th><th>Next Safe Action</th><th>Verifier</th><th>Review Commands</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
</body>
</html>
`;
  writeFileSync(path, html, "utf8");
}

function writeReadme(path, matrix) {
  const lines = [
    "# Original Goal Completion Blocker Matrix",
    "",
    `Status: ${matrix.status}`,
    `Completion decision: ${matrix.completionDecision}`,
    "",
    "This packet turns the remaining original-goal boundary into explicit evidence lanes.",
    "",
    "Files:",
    `- Matrix JSON: ${matrix.paths.matrix}`,
    `- Matrix HTML: ${matrix.paths.html}`,
    "",
    "Rows:",
    ...matrix.rows.map((item) => `- ${item.lane}: ${item.missingProof}`),
    "",
    "Locks:",
    ...Object.entries(matrix.locks).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "This matrix is review-only and cannot be used as acceptance, rule enablement, packaging unlock, native execution proof, or goal completion proof."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const statusRefreshInput = argValue("--status-refresh", argValue("--refresh", ""));
if (!statusRefreshInput) {
  throw new Error(
    "Usage: node create-original-goal-completion-blocker-matrix.mjs --status-refresh <original-goal-current-status-refresh.json>"
  );
}

const statusRefreshPath = resolve(statusRefreshInput);
const refresh = readJson(statusRefreshPath, true);
const goal = argValue("--goal", refresh.goal || "Review original-goal completion blockers.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-completion-blocker-matrices"))
);
const matrixId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const matrixDir = join(outputRoot, matrixId);
mkdirSync(matrixDir, { recursive: true });

const paths = refresh.paths || {};
const statusConsole = readJson(paths.operationalStatusConsole);
const gapBoard = readJson(paths.gapActionBoard);
const triage = readJson(paths.nextActionTriage);
const lowTokenBudget = readJson(paths.lowTokenTriggerBudgetPlan);
const lowTokenCoverageEvidenceDossier = readJson(paths.originalGoalLowTokenCoverageEvidenceDossier);
const triggeredVisualBuilder = readJson(paths.triggeredVisualCheckCommandBuilder);
const spatialRehearsal = readJson(paths.transparentSketchDepthDemonstrationRehearsal);
const spatialIntentEvidenceReceiptValidation = readJson(paths.spatialIntentEvidenceReceiptValidation);
const voiceCapability = readJson(paths.nonExpertEngineeringVoiceControlCapability);
const rollbackPoint = readJson(paths.rollbackPointManifest);
const locks = lockedReviewOnly();

const sourceEvidence = {
  statusRefresh: statusRefreshPath,
  operationalStatusConsole: paths.operationalStatusConsole || "",
  gapActionBoard: paths.gapActionBoard || "",
  nextActionTriage: paths.nextActionTriage || "",
  lowTokenTriggerBudgetPlan: paths.lowTokenTriggerBudgetPlan || "",
  originalGoalLowTokenCoverageEvidenceDossier: paths.originalGoalLowTokenCoverageEvidenceDossier || "",
  triggeredVisualCheckCommandBuilder: paths.triggeredVisualCheckCommandBuilder || "",
  transparentSketchDepthDemonstrationRehearsal: paths.transparentSketchDepthDemonstrationRehearsal || "",
  spatialIntentFormalEvidenceEntrypoint: paths.spatialIntentFormalEvidenceEntrypoint || "",
  spatialIntentFormalEvidenceEntrypointCommandTemplate:
    paths.spatialIntentFormalEvidenceEntrypointCommandTemplate || "",
  nonExpertEngineeringVoiceControlCapability: paths.nonExpertEngineeringVoiceControlCapability || "",
  rollbackPointManifest: paths.rollbackPointManifest || "",
  ruleDslDeliveryGateAudit: paths.ruleDslDeliveryGateAudit || "",
  originalGoalFinalCompletionGateCommandTemplate: paths.originalGoalFinalCompletionGateCommandTemplate || ""
};

const refreshed = refresh.refreshedEvidence || {};
const discovered = refresh.discoveredEvidence || {};
function commandTemplate(key) {
  return paths[key] || discovered[key] || refreshed[key] || "";
}
function replaceCommandPlaceholders(command, replacements = {}) {
  let next = String(command || "");
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (!value) continue;
    next = next.split(placeholder).join(String(value).replace(/"/g, '\\"'));
  }
  return next;
}
const lowTokenCoverageKnownPathReplacements = {
  "<original-goal-low-token-coverage-evidence-dossier.json>": paths.originalGoalLowTokenCoverageEvidenceDossier,
  "<original-goal-low-token-coverage-dossier-receipt-builder.json>":
    paths.originalGoalLowTokenCoverageDossierReceiptBuilder,
  "<original-goal-low-token-coverage-dossier-receipt-validation.json>":
    paths.originalGoalLowTokenCoverageDossierReceiptValidation,
  "<original-goal-low-token-coverage-waiting-row-cockpit.json>":
    paths.originalGoalLowTokenCoverageWaitingRowCockpit
};
const lowTokenCoverageDossierReceiptBuilderCommand =
  replaceCommandPlaceholders(
    paths.originalGoalLowTokenCoverageDossierReceiptBuilderCommandTemplate ||
      verifier("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs", [
        ["--goal", goal],
        ["--dossier", paths.originalGoalLowTokenCoverageEvidenceDossier],
        ["--output-dir", join(matrixDir, "low-token-coverage-dossier-receipt-builder")]
      ]),
    lowTokenCoverageKnownPathReplacements
  );
const lowTokenCoverageDossierReceiptValidationCommand =
  replaceCommandPlaceholders(
    paths.originalGoalLowTokenCoverageDossierReceiptValidationCommandTemplate ||
      verifier("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs", [
        ["--builder", "<original-goal-low-token-coverage-dossier-receipt-builder.json>"],
        ["--receipt", "<teacher-filled-low-token-coverage-dossier-receipt.json>"],
        ["--output-dir", join(matrixDir, "low-token-coverage-dossier-receipt-validation")]
      ]),
    lowTokenCoverageKnownPathReplacements
  );
const lowTokenCoverageCompletionGateCommand =
  replaceCommandPlaceholders(
    paths.originalGoalLowTokenCoverageCompletionGateCommandTemplate ||
      verifier("validate-original-goal-low-token-coverage-completion-gate.mjs", [
        ["--dossier", paths.originalGoalLowTokenCoverageEvidenceDossier],
        ["--receipt-validation", "<original-goal-low-token-coverage-dossier-receipt-validation.json>"],
        ["--log-source-discovery-ledger", paths.logSourceDiscoveryLedger],
        ["--output-dir", join(matrixDir, "low-token-coverage-completion-gate")]
      ]),
    lowTokenCoverageKnownPathReplacements
  );
const lowTokenCoverageWaitingRowCockpitValidationCommand =
  replaceCommandPlaceholders(
    paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate ||
      verifier("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
        ["--cockpit", "<original-goal-low-token-coverage-waiting-row-cockpit.json>"],
        ["--receipt", "<teacher-filled-low-token-waiting-row-cockpit-receipt.json>"],
        ["--output-dir", join(matrixDir, "low-token-coverage-waiting-row-cockpit-receipt-validation")]
      ]),
    lowTokenCoverageKnownPathReplacements
  );
const ruleDslDeliveryGateAuditReady =
  refreshed.ruleDslDeliveryGateAuditReady === true && Boolean(paths.ruleDslDeliveryGateAudit);
const ruleDslDeliveryGateAuditReviewCommand = ruleDslDeliveryGateAuditReady
  ? [
      "node",
      "plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-review-receipt-builder.mjs",
      "--audit-trail",
      `"${String(paths.ruleDslDeliveryGateAudit).replace(/"/g, '\\"')}"`,
      "--out-dir",
      `"${join(matrixDir, "rag-delivery-gate-audit-review-receipt-builder").replace(/"/g, '\\"')}"`
    ].join(" ")
  : "";
const spatialIntentEvidenceReceiptValidationReady =
  refreshed.spatialIntentEvidenceReceiptValidationReady === true &&
  Boolean(paths.spatialIntentEvidenceReceiptValidation);
const spatialIntentEvidenceReviewTarget =
  spatialIntentEvidenceReceiptValidationReady
    ? paths.spatialIntentEvidenceReceiptValidation
    : commandTemplate("spatialIntentEvidenceReceiptValidationCommandTemplate") ||
      verifier("validate-spatial-intent-evidence-receipt.mjs", []);
const rows = [
  row({
    id: "all_software_low_token_coverage_evidence",
    lane: "all_software_low_token_coverage_evidence",
    requirement:
      "Prove that all target software has low-token log/state coverage or a documented fallback signal path, with teacher-reviewed evidence.",
    currentEvidence: compactEvidence([
      `statusConsole=${statusConsole?.status || refreshed.statusConsoleStatus || "missing"}`,
      `gapRows=${array(gapBoard?.actionRows || gapBoard?.rows).length}`,
      `triageRows=${array(triage?.rows).length}`,
      `budgetActions=${lowTokenBudget?.selectedActionCount ?? refreshed.lowTokenTriggerBudgetPlanSelectedActionCount ?? 0}`,
      lowTokenCoverageEvidenceDossier?.status
        ? `coverageDossier=${lowTokenCoverageEvidenceDossier.status}`
        : "",
      lowTokenCoverageEvidenceDossier?.counts
        ? `waitingRows=${lowTokenCoverageEvidenceDossier.counts.waitingForLowTokenEvidence || 0}`
        : "",
      paths.logSourceDiscoveryLedger ? "log-source discovery ledger linked" : "",
      refreshed.logSourceDiscoveryLedgerReady
        ? `logSourceDiscoveryMissingRows=${refreshed.logSourceDiscoveryMissingRows ?? "unknown"}`
        : "",
      refreshed.originalGoalLowTokenCoverageWaitingRowCockpitReady
        ? `waitingRowCockpitRows=${refreshed.originalGoalLowTokenCoverageWaitingRowCockpitRows ?? 0}`
        : "",
      refreshed.originalGoalLowTokenCoverageWaitingRowCockpitReadyRows !== undefined
        ? `cockpitReadyRows=${refreshed.originalGoalLowTokenCoverageWaitingRowCockpitReadyRows ?? 0}`
        : "",
      refreshed.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithLogSourceLedgerRoute !== undefined
        ? `cockpitLogSourceRouteRows=${refreshed.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithLogSourceLedgerRoute ?? 0}`
        : "",
      refreshed.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithoutCurrentLogSourceLedgerMatch !== undefined
        ? `cockpitRowsWithoutCurrentLogSourceLedgerMatch=${refreshed.originalGoalLowTokenCoverageWaitingRowCockpitRowsWithoutCurrentLogSourceLedgerMatch ?? 0}`
        : "",
      refreshed.originalGoalLowTokenCoverageWaitingRowCockpitScopeMismatchLikely
        ? "coverageLogSourceScopeMismatchLikely=true"
        : "",
      refreshed.originalGoalLowTokenCoverageWaitingRowCockpitUsesSafeTextRendering
        ? "cockpitSafeTextRendering=true"
        : "",
      paths.realLocalAllSoftwareLowTokenReadinessPackage ? "real-local readiness package linked" : ""
    ]),
    missingProof:
      "Need per-software reviewed coverage evidence proving every in-scope app has a mapped log source, compact log/state learning, or an explicit fallback before claiming all-software coverage.",
    nextSafeAction:
      refreshed.originalGoalLowTokenCoverageWaitingRowCockpitScopeMismatchLikely
        ? "Refresh or realign the coverage enrollment ledger from the current log-source discovery ledger before collecting teacher coverage receipts; then regenerate the waiting-row cockpit and validate the teacher receipt."
        : "Open the log-source discovery ledger and the low-token waiting-row cockpit, have the teacher review each ledger-to-coverage row, validate the waiting-row cockpit receipt, then proceed only through metadata-only follow-up actions.",
    verifierCommand: verifier("create-original-goal-low-token-coverage-evidence-dossier.mjs", [
      ["--status-refresh", statusRefreshPath],
      ["--output-dir", join(matrixDir, "low-token-coverage-evidence-dossier")]
    ]),
    reviewCommandTemplates: [
      lowTokenCoverageDossierReceiptBuilderCommand,
      lowTokenCoverageWaitingRowCockpitValidationCommand,
      lowTokenCoverageDossierReceiptValidationCommand,
      lowTokenCoverageCompletionGateCommand
    ],
    sourcePaths: [
      paths.originalGoalLowTokenCoverageEvidenceDossier,
      paths.originalGoalLowTokenCoverageEvidenceDossierHtml,
      paths.originalGoalLowTokenCoverageWaitingRowCockpit,
      paths.originalGoalLowTokenCoverageWaitingRowCockpitHtml,
      paths.originalGoalLowTokenCoverageWaitingRowCockpitReceiptTemplate,
      lowTokenCoverageWaitingRowCockpitValidationCommand,
      lowTokenCoverageDossierReceiptBuilderCommand,
      lowTokenCoverageDossierReceiptValidationCommand,
      lowTokenCoverageCompletionGateCommand,
      paths.logSourceDiscoveryLedger,
      paths.logSourceDiscoveryLedgerReadme,
      paths.realLocalAllSoftwareLowTokenReadinessPackage,
      paths.coverageEnrollmentLedger,
      paths.coverageEnrollmentFollowUpPlan,
      paths.originalGoalRemainingGatesPacket
    ],
    blockedClaims: ["claim_all_software_low_token_coverage_complete", "claim_original_goal_complete"]
  }),
  row({
    id: "unattended_operational_monitor_evidence",
    lane: "unattended_operational_monitor_evidence",
    requirement:
      "Prove an approved recurring or operational monitor is registered, produces bounded outputs, and has teacher-reviewed post-run evidence.",
    currentEvidence: compactEvidence([
      `operationalStatus=${statusConsole?.status || "missing"}`,
      paths.operationalRegistrationExecuteGate ? "registration execute gate linked" : "",
      paths.operationalPostActivationWitness ? "post-activation witness linked" : "",
      paths.operationalPostActivationWitnessReceiptBuilder ? "witness receipt builder linked" : ""
    ]),
    missingProof:
      "Need teacher-approved registration evidence plus actual post-registration output witness review before claiming unattended all-software operation.",
    nextSafeAction:
      "Use the operational activation, registration execute gate, and post-activation witness receipt flow; keep registration blocked until teacher approval.",
    verifierCommand: verifier("verify-all-software-recurring-monitor-registration-status.mjs", [
      ["--registration-runner", "<teacher-reviewed-recurring-monitor-registration-runner.json>"]
    ]),
    sourcePaths: [
      paths.operationalActivationGate,
      paths.operationalRegistrationExecuteGate,
      paths.operationalPostActivationWitness,
      paths.operationalPostActivationWitnessReceiptBuilder
    ],
    blockedClaims: ["register_monitor_without_teacher_receipt", "claim_unattended_learning_operational"]
  }),
  row({
    id: "universal_native_execution_control_channel",
    lane: "universal_native_execution_control_channel",
    requirement:
      "Prove target software can be controlled through a reviewed native or safe control channel, with outcome verification and no unreviewed UI action.",
    currentEvidence: compactEvidence([
      `nativeUniversalExecution=${Boolean(refresh.locks?.nativeUniversalExecution || locks.nativeUniversalExecution)}`,
      paths.executionFollowUpReceiptBuilder ? "execution follow-up receipt builder linked" : "",
      paths.executionApprovalGatePrepRunnerCommandTemplate ? "approval gate prep command present" : "",
      commandTemplate("executionApprovedGateRunnerCommandTemplate") ? "approved gate runner command present" : ""
    ]),
    missingProof:
      "Need teacher-approved control-channel execution proof and verified outcome for representative real software before claiming universal native execution.",
    nextSafeAction:
      "Advance only one teacher-reviewed execution follow-up item through dry-run receipt, approval gate prep, and approved-gate runner.",
    verifierCommand:
      commandTemplate("executionApprovedGateRunnerCommandTemplate") ||
      verifier("run-all-software-execution-approved-gate-runner.mjs", [["--gate", "<teacher-approved-execution-gate.json>"]]),
    sourcePaths: [
      paths.executionFollowUpReceiptBuilder,
      paths.executionFollowUpHandoffQueueCommandTemplate,
      paths.executionApprovalGatePrepRunnerCommandTemplate,
      commandTemplate("executionApprovedGateRunnerCommandTemplate")
    ],
    blockedClaims: ["execute_target_software_without_teacher_gate", "claim_universal_native_execution"]
  }),
  row({
    id: "teacher_reviewed_triggered_visual_evidence_path",
    lane: "teacher_reviewed_triggered_visual_evidence_path",
    requirement:
      "Use changed log/state evidence to request only bounded teacher-confirmed visual checks, then convert the capture into a reviewed learning handoff.",
    currentEvidence: compactEvidence([
      `builderStatus=${triggeredVisualBuilder?.status || discovered.triggeredVisualCheckCommandBuilderStatus || "missing"}`,
      `requestKind=${triggeredVisualBuilder?.requestKind || discovered.triggeredVisualCheckCommandBuilderRequestKind || "missing"}`,
      `requestCount=${triggeredVisualBuilder?.requestCount ?? discovered.triggeredVisualCheckCommandBuilderRequestCount ?? 0}`,
      `screenshotsCaptured=${Boolean(refresh.locks?.screenshotsCaptured)}`
    ]),
    missingProof:
      "Need a teacher-selected request, a capture receipt, and a reviewed visual learning card before visual evidence can teach a reusable rule.",
    nextSafeAction:
      "Open the triggered visual check command builder, generate one capture command, and run it only after teacher confirmation.",
    verifierCommand: commandTemplate("triggeredVisualCaptureCommandTemplate") || verifier("capture-triggered-visual-check.mjs", []),
    sourcePaths: [
      paths.triggeredVisualCheckCommandBuilder,
      paths.triggeredVisualCheckCommandBuilderHtml,
      commandTemplate("triggeredVisualCaptureCommandTemplate")
    ],
    blockedClaims: ["capture_screenshots_without_teacher_confirmation", "write_visual_learning_memory_without_review"]
  }),
  row({
    id: "transparent_sketch_spatial_intent_teacher_export",
    lane: "transparent_sketch_spatial_intent_teacher_export",
    requirement:
      "Prove transparent sketch, 2D perspective, 3D depth, position, and angle intent through teacher-exported evidence and receipt validation.",
    currentEvidence: compactEvidence([
      `spatialEvidencePresent=${Boolean(refreshed.formalSpatialIntentEvidencePresent)}`,
      `rehearsalStatus=${spatialRehearsal?.status || discovered.transparentSketchDepthDemonstrationRehearsalStatus || "missing"}`,
      `spatialReceiptValidation=${spatialIntentEvidenceReceiptValidation?.status || refreshed.spatialIntentEvidenceReceiptValidationStatus || "missing"}`,
      `has2D=${Boolean(refreshed.spatialIntentEvidenceReceiptValidationHas2D)}`,
      `hasPerspective=${Boolean(refreshed.spatialIntentEvidenceReceiptValidationHasPerspective)}`,
      `has3DDepth=${Boolean(refreshed.spatialIntentEvidenceReceiptValidationHas3DDepth)}`,
      `detailLogicReady=${Boolean(refreshed.spatialIntentEvidenceReceiptValidationDetailLogicReady)}`,
      paths.spatialIntentEvidenceRequest ? "spatial evidence request linked" : "",
      paths.spatialIntentEvidenceReceiptBuilder ? "spatial receipt builder linked" : "",
      paths.spatialIntentFormalEvidenceEntrypoint ? "formal evidence entrypoint linked as demo-only handoff" : "",
      paths.spatialIntentFormalEvidenceEntrypointCommandTemplate ? "formal evidence entrypoint command linked" : "",
      commandTemplate("spatialRoutePilotSelectionReceiptCommandTemplate")
        ? "spatial route pilot-selection receipt command linked"
        : "",
      commandTemplate("spatialRoutePilotSelectionReceiptValidationCommandTemplate")
        ? "spatial route pilot-selection receipt validation command linked"
        : "",
      spatialIntentEvidenceReceiptValidationReady ? "existing spatial receipt validation linked" : ""
    ]),
    missingProof:
      "Need teacher-exported overlay/spatial packet, validated receipt connecting geometry, position, angle, perspective, and depth to data logic, plus a teacher-reviewed spatial route pilot-selection receipt before approval-prep reuse.",
    nextSafeAction:
      spatialIntentEvidenceReceiptValidationReady
        ? "Review the existing spatial intent receipt validation, then create the spatial route pilot-selection receipt before approval-prep handoff reuse or target execution."
        : "Create/open the spatial intent formal evidence entrypoint, use the spatial intent evidence request and receipt builder to validate the teacher-filled receipt, then create a spatial route pilot-selection receipt before any approval-prep handoff.",
    verifierCommand:
      spatialIntentEvidenceReceiptValidationReady
        ? commandTemplate("spatialRoutePilotSelectionReceiptCommandTemplate") || spatialIntentEvidenceReviewTarget
        : spatialIntentEvidenceReviewTarget,
    sourcePaths: [
      paths.spatialIntentEvidenceRequest,
      paths.spatialIntentEvidenceReceiptBuilder,
      paths.spatialIntentFormalEvidenceEntrypoint,
      paths.spatialIntentFormalEvidenceEntrypointHtml,
      paths.spatialIntentFormalEvidenceEntrypointCommandTemplate,
      commandTemplate("spatialRoutePilotSelectionReceiptCommandTemplate"),
      commandTemplate("spatialRoutePilotSelectionReceiptValidationCommandTemplate"),
      paths.spatialIntentEvidenceReceiptValidation,
      paths.transparentSketchDepthDemonstrationRehearsal,
      paths.transparentSketchDepthRehearsalReviewReceiptValidation,
      paths.spatialToSoftwareExecutionGatePackage,
      paths.spatialToSoftwareFirstBlockerHandoff
    ],
    blockedClaims: [
      "claim_spatial_intent_understood_without_teacher_export",
      "generate_detail_logic_as_if_accepted",
      "auto_select_real_local_pilot_without_teacher_receipt",
      "reuse_spatial_route_for_approval_prep_without_pilot_selection_receipt"
    ]
  }),
  row({
    id: "voice_text_numbered_confirmation_supervised_execution_gate",
    lane: "voice_text_numbered_confirmation_supervised_execution_gate",
    requirement:
      "Let non-expert users issue voice/text commands, show numbered candidate targets, require exactly one teacher confirmation, then execute only through a supervised gate.",
    currentEvidence: compactEvidence([
      `voiceCapability=${voiceCapability?.status || "linked"}`,
      `numberedTargetConfirmationReady=${Boolean(refreshed.nonExpertNumberedTargetConfirmationReady)}`,
      `teacherConfirmationRequired=${Boolean(refreshed.nonExpertExecutionStillRequiresTeacherConfirmedNumber)}`
    ]),
    missingProof:
      "Need a teacher-chosen target number, validated command-target receipt, approved execution gate, and verified outcome before claiming voice-controlled execution.",
    nextSafeAction:
      "Open the voice/text workbench, collect exactly one confirmed number, then run the confirmation bridge and approval gate only from validated evidence.",
    verifierCommand: commandTemplate("numberedTargetConfirmCommandTemplate") || verifier("confirm-engineering-command-target.mjs", []),
    sourcePaths: [
      paths.nonExpertEngineeringVoiceControlCapability,
      paths.nonExpertEngineeringVoiceControlWorkbench,
      discovered.lowTokenPreflightTargetConfirmation
    ],
    blockedClaims: ["execute_voice_command_without_numbered_confirmation", "claim_non_expert_control_complete"]
  }),
  row({
    id: "rule_dsl_delivery_gate_audit",
    lane: "rule_dsl_delivery_gate_audit",
    requirement:
      "Prove retrieved RAG evidence reached disabled Rule Card, Rule DSL validation, Validation Report, closed Delivery Gate, and an audit trail before final completion.",
    currentEvidence: compactEvidence([
      paths.ruleDslDeliveryGateAudit ? `audit=${basename(paths.ruleDslDeliveryGateAudit)}` : "",
      refreshed.ruleDslDeliveryGateAuditStatus
        ? `auditStatus=${refreshed.ruleDslDeliveryGateAuditStatus}`
        : "auditStatus=missing_rule_dsl_delivery_gate_audit_trail",
      refreshed.ruleDslDeliveryGateAuditReady === true ? "auditReady=true" : "auditReady=false",
      paths.originalGoalFinalCompletionGateCommandTemplate ? "final completion gate command linked" : ""
    ]),
    missingProof:
      ruleDslDeliveryGateAuditReady
        ? "Need teacher review receipt for the existing transparent_ai_rag_delivery_gate_audit_trail_v1 before it can feed later follow-up or final completion gates."
        : "Need transparent_ai_rag_delivery_gate_audit_trail_v1 showing disabled RAG rules reached Validation Report and a closed Delivery Gate while activation, memory, execution, acceptance, and packaging remain blocked.",
    nextSafeAction:
      ruleDslDeliveryGateAuditReady
        ? "Create the RAG delivery-gate audit review receipt builder for the existing audit trail; do not regenerate the audit unless the teacher rejects it."
        : "Create or review the RAG delivery-gate audit trail only after the closed delivery gate and retained rollback point are teacher-reviewed.",
    verifierCommand:
      ruleDslDeliveryGateAuditReviewCommand ||
      [
        "node",
        "plugins\\transparent-ai-apprentice\\scripts\\knowledge\\create-rag-delivery-gate-audit-trail.mjs",
        "--delivery-gate",
        "\"<rag-validation-report-delivery-gate.json>\"",
        "--rollback-point",
        "\"<retained-rollback-point-dir>\"",
        "--teacher-reviewed",
        "--out-dir",
        `"${join(matrixDir, "rag-delivery-gate-audit-trail").replace(/"/g, '\\"')}"`
      ].join(" "),
    sourcePaths: [
      paths.ruleDslDeliveryGateAudit,
      paths.originalGoalFinalCompletionGateCommandTemplate,
      paths.originalGoalRemainingGatesPacket
    ],
    blockedClaims: [
      "claim_rule_dsl_delivery_gate_audit_ready_without_audit_trail",
      "claim_rag_research_acceptance_from_delivery_allowed",
      "claim_original_goal_complete"
    ]
  }),
  row({
    id: "rollback_evidence_before_system_change",
    lane: "rollback_evidence_before_system_change",
    requirement:
      "Retain a rollback point before any registration, runner launch, software execution, packaging, or irreversible system-changing action.",
    currentEvidence: compactEvidence([
      paths.rollbackPointManifest ? `rollback=${basename(paths.rollbackPointManifest)}` : "",
      rollbackPoint?.status ? `rollbackStatus=${rollbackPoint.status}` : "",
      rollbackPoint?.deleteOnlyAfterTeacherConfirmation === true ? "delete only after teacher confirmation" : ""
    ]),
    missingProof:
      paths.rollbackPointManifest
        ? "Rollback exists and must be retained until the teacher confirms the direction is correct."
        : "Need a retained rollback point before any downstream system-changing action.",
    nextSafeAction:
      "Keep the rollback point; create a new one before the next code or system-changing operation and delete only after teacher confirmation.",
    verifierCommand: verifier("create-rollback-point.mjs", [
      ["--label", "before-next-system-changing-action"],
      ["--path", "package.json"]
    ]),
    sourcePaths: [paths.rollbackPointManifest, paths.rollbackPointDir],
    blockedClaims: ["delete_rollback_without_teacher_confirmation", "perform_system_change_without_rollback"]
  })
];

const matrixPath = join(matrixDir, "original-goal-completion-blocker-matrix.json");
const htmlPath = join(matrixDir, "original-goal-completion-blocker-matrix.html");
const readmePath = join(matrixDir, "ORIGINAL_GOAL_COMPLETION_BLOCKER_MATRIX_START_HERE.md");
const matrix = {
  ok: true,
  format: "transparent_ai_original_goal_completion_blocker_matrix_v1",
  matrixId,
  createdAt: new Date().toISOString(),
  goal,
  status: "waiting_for_teacher_completion_blocker_review",
  purpose:
    "Convert the original-goal not-complete boundary into explicit proof lanes so future work can advance with low-token, review-only evidence.",
  completionDecision:
    refresh.completionDecision ||
    "not_complete_full_objective_because_universal_native_control_and_unattended_all_app_coverage_are_not_proven",
  nextSafeAction:
    "Review these blocker rows before claiming completion; advance only one teacher-confirmed evidence lane at a time.",
  sourceEvidence,
  counts: {
    rows: rows.length,
    blockedOrWaitingRows: rows.length,
    gapRows: array(gapBoard?.actionRows || gapBoard?.rows).length,
    triageRows: array(triage?.rows).length,
    statusLanes: array(refresh.refreshedEvidence?.statusLanes).length,
    visualRequestCount: triggeredVisualBuilder?.requestCount ?? 0
  },
  rows,
  blockedClaims: [
    "claim_original_goal_complete_from_blocker_matrix",
    "accept_technology_from_blocker_matrix",
    "enable_rules_from_blocker_matrix",
    "unlock_packaging_from_blocker_matrix",
    "register_or_launch_runner_from_blocker_matrix",
    "execute_target_software_from_blocker_matrix",
    "capture_screenshots_from_blocker_matrix",
    "write_memory_from_blocker_matrix"
  ],
  paths: {
    matrix: matrixPath,
    html: htmlPath,
    readme: readmePath
  },
  locks
};

writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
writeHtml(htmlPath, matrix);
writeReadme(readmePath, matrix);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_completion_blocker_matrix_result_v1",
      matrixId,
      status: matrix.status,
      matrixPath,
      htmlPath,
      readmePath,
      rowCount: rows.length,
      locks
    },
    null,
    2
  )
);
