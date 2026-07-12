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
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) return "";
  const found = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === fileName) found.push({ path, time: statSync(path).mtimeMs });
    }
  };
  visit(resolvedRoot);
  return found.sort((a, b) => b.time - a.time)[0]?.path || "";
}

function newestRollbackPoint(root) {
  return newestFile(join(root, ".transparent-apprentice", "rollback-points"), "rollback-point.json");
}

function slugify(value) {
  return (
    String(value || "low-token-coverage-final-review-bridge")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 84) || "low-token-coverage-final-review-bridge"
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
    bridgeDoesNotRunCommands: true,
    bridgeDoesNotValidateTeacherReceipt: true,
    bridgeDoesNotReadLogs: true,
    bridgeDoesNotReadFullLogs: true,
    bridgeDoesNotCaptureScreenshots: true,
    bridgeDoesNotExecuteTargetSoftware: true,
    bridgeDoesNotRegisterSchedule: true,
    bridgeDoesNotWriteMemory: true,
    bridgeDoesNotDeleteRollbackPoint: true,
    fullContinuousRecording: false,
    logContentsRead: false,
    screenshotsCaptured: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    allSoftwareCoverageComplete: false,
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

function writeReadme(path, bridge) {
  const lines = [
    "# Current Goal Low-Token Coverage Final Review Bridge",
    "",
    `Status: ${bridge.status}`,
    `Ledger rows: ${bridge.coverageCounts.ledgerRows}`,
    `Log-source rows: ${bridge.coverageCounts.logSourceDiscoveryRows}`,
    `Ready metadata-gate rows: ${bridge.cockpitSummary.readyForTeacherConfirmedMetadataGateRows}`,
    `Blocked rows: ${bridge.cockpitSummary.blockedRows}`,
    "",
    "This bridge is review-only. It does not read logs, capture screenshots, execute target software, register schedules, write memory, enable rules, delete rollback points, or claim all-software coverage complete.",
    "",
    "## Teacher Path",
    "",
    "1. Open the waiting-row cockpit and review the ready rows first.",
    "2. For each row, either confirm the metadata-gate route, exclude/private it with a teacher reason, or keep it blocked with a concrete missing-evidence note.",
    "3. Re-run the dossier receipt validation and coverage completion gate only after the teacher receipt is filled.",
    "4. Keep rollback points until the teacher confirms this review direction.",
    "",
    "## Next Commands",
    "",
    "```powershell",
    bridge.nextCommands.validateWaitingRowReceipt,
    "```",
    "",
    "```powershell",
    bridge.nextCommands.validateCompletionGateAfterReceipt,
    "```"
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writeHtml(path, bridge) {
  const actionRows = bridge.teacherReviewSteps
    .map(
      (step) =>
        `<tr><td><code>${htmlEscape(step.id)}</code></td><td>${htmlEscape(step.teacherAction)}</td><td>${htmlEscape(step.continueCondition)}</td><td>${htmlEscape(step.stopCondition)}</td></tr>`
    )
    .join("\n");
  writeFileSync(
    path,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Low-Token Coverage Final Review Bridge</title>
  <style>
    body { margin: 0; font: 14px/1.45 Segoe UI, Arial, sans-serif; color: #182433; background: #f6f8fb; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
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
  <h1>Low-Token Coverage Final Review Bridge</h1>
  <section>
    <p>Status: <code>${htmlEscape(bridge.status)}</code></p>
    <p>Final lane ready: <code>${htmlEscape(bridge.finalLane.ready)}</code></p>
    <p class="lock">Review-only. No log reads, screenshots, target software execution, schedule registration, memory write, rule enablement, rollback deletion, or completion claim.</p>
  </section>
  <section>
    <h2>Coverage Counts</h2>
    <table><tbody>
      <tr><th>Ledger rows</th><td>${htmlEscape(bridge.coverageCounts.ledgerRows)}</td></tr>
      <tr><th>Log-source rows</th><td>${htmlEscape(bridge.coverageCounts.logSourceDiscoveryRows)}</td></tr>
      <tr><th>Unresolved coverage rows</th><td>${htmlEscape(bridge.coverageCounts.unresolvedCoverageRows)}</td></tr>
      <tr><th>Teacher-reviewed coverage rows</th><td>${htmlEscape(bridge.coverageCounts.teacherReviewedCoverageRows)}</td></tr>
      <tr><th>Ready metadata-gate rows</th><td>${htmlEscape(bridge.cockpitSummary.readyForTeacherConfirmedMetadataGateRows)}</td></tr>
      <tr><th>Blocked rows</th><td>${htmlEscape(bridge.cockpitSummary.blockedRows)}</td></tr>
    </tbody></table>
  </section>
  <section>
    <h2>Source Evidence</h2>
    <table><thead><tr><th>Source</th><th>Path</th></tr></thead><tbody>${evidenceRows(bridge.sourceEvidence)}</tbody></table>
  </section>
  <section>
    <h2>Teacher Review Steps</h2>
    <table><thead><tr><th>Step</th><th>Teacher Action</th><th>Continue</th><th>Stop</th></tr></thead><tbody>${actionRows}</tbody></table>
  </section>
  <section>
    <h2>Next Commands</h2>
    <pre>${htmlEscape(bridge.nextCommands.validateWaitingRowReceipt)}</pre>
    <pre>${htmlEscape(bridge.nextCommands.validateCompletionGateAfterReceipt)}</pre>
  </section>
</main>
</body>
</html>
`,
    "utf8"
  );
}

const repoRoot = process.cwd();
const goal = argValue(
  "--goal",
  "Bridge all-software low-token coverage final review rows to teacher-confirmed receipt work."
);
const finalGatePath = resolve(
  argValue(
    "--final-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-final-completion-gates"), "original-goal-final-completion-gate.json")
  )
);
const completionGatePath = resolve(
  argValue(
    "--coverage-completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-completion-gates"), "original-goal-low-token-coverage-completion-gate.json")
  )
);
const finalReviewPackPath = resolve(
  argValue(
    "--coverage-final-review-pack",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-final-review-packs"), "low-token-coverage-final-review-pack.json")
  )
);
const convergenceAuditPath = resolve(
  argValue(
    "--coverage-convergence-audit",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-convergence-audits"), "low-token-coverage-convergence-audit.json")
  )
);
const waitingRowCockpitPath = resolve(
  argValue(
    "--waiting-row-cockpit",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-waiting-row-cockpits"), "original-goal-low-token-coverage-waiting-row-cockpit.json")
  )
);
const rollbackPath = resolve(argValue("--rollback-point", newestRollbackPoint(repoRoot)));
const outputRoot = resolve(
  argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-low-token-coverage-final-review-bridges"))
);
mkdirSync(outputRoot, { recursive: true });

const finalGate = existsSync(finalGatePath) ? readJson(finalGatePath) : null;
const completionGate = existsSync(completionGatePath) ? readJson(completionGatePath) : null;
const finalReviewPack = existsSync(finalReviewPackPath) ? readJson(finalReviewPackPath) : null;
const convergenceAudit = existsSync(convergenceAuditPath) ? readJson(convergenceAuditPath) : null;
const waitingRowCockpit = existsSync(waitingRowCockpitPath) ? readJson(waitingRowCockpitPath) : null;
const rollback = existsSync(rollbackPath) ? readJson(rollbackPath) : null;
const lowTokenLane = laneById(finalGate, "all_software_low_token_coverage_final_review");

const blockers = [];
if (!finalGate) blockers.push("final_completion_gate_missing");
if (!lowTokenLane) blockers.push("all_software_low_token_final_lane_missing");
if (lowTokenLane?.ready !== false) blockers.push("all_software_low_token_lane_not_current_blocker");
if (!completionGate) blockers.push("coverage_completion_gate_missing");
if (!finalReviewPack) blockers.push("coverage_final_review_pack_missing");
if (!convergenceAudit) blockers.push("coverage_convergence_audit_missing");
if (!waitingRowCockpit) blockers.push("waiting_row_cockpit_missing");
if (!rollback) blockers.push("rollback_point_missing");

const sourceEvidence = {
  finalCompletionGate: existsSync(finalGatePath) ? finalGatePath : "",
  finalLaneSource: lowTokenLane?.sourcePath || "",
  coverageCompletionGate: existsSync(completionGatePath) ? completionGatePath : "",
  coverageFinalReviewPack: existsSync(finalReviewPackPath) ? finalReviewPackPath : "",
  convergenceAudit: existsSync(convergenceAuditPath) ? convergenceAuditPath : "",
  waitingRowCockpit: existsSync(waitingRowCockpitPath) ? waitingRowCockpitPath : "",
  waitingRowCockpitHtml: finalReviewPack?.sourceEvidence?.waitingRowCockpitHtml || "",
  waitingRowCockpitReceiptTemplate: finalReviewPack?.sourceEvidence?.waitingRowCockpitReceiptTemplate || "",
  dossier: completionGate?.sourceEvidence?.dossierPath || finalReviewPack?.sourceEvidence?.dossier || "",
  dossierValidation: completionGate?.sourceEvidence?.dossierValidationPath || finalReviewPack?.sourceEvidence?.dossierValidation || "",
  logSourceLedger: completionGate?.sourceEvidence?.logSourceDiscoveryLedgerPath || finalReviewPack?.sourceEvidence?.logSourceLedger || "",
  rollbackPoint: existsSync(rollbackPath) ? rollbackPath : ""
};

const coverageCounts = {
  logSourceDiscoveryRows: Number(completionGate?.counts?.logSourceDiscoveryRows || finalReviewPack?.coverageSummary?.logSourceDiscoveryRows || 0),
  logSourceDiscoveryMissingRows: Number(completionGate?.counts?.logSourceDiscoveryMissingRows || finalReviewPack?.coverageSummary?.logSourceDiscoveryMissingRows || 0),
  ledgerRows: Number(completionGate?.counts?.ledgerRows || finalReviewPack?.coverageSummary?.ledgerRows || waitingRowCockpit?.totalRows || 0),
  unresolvedCoverageRows: Number(completionGate?.counts?.unresolvedCoverageRows || 0),
  coverageContractIncompleteRows: Number(completionGate?.counts?.coverageContractIncompleteRows || 0),
  teacherReviewedCoverageRows: Number(completionGate?.counts?.teacherReviewedCoverageRows || 0),
  coverageEvidenceReadyForFinalTeacherReview: completionGate?.coverageEvidenceReadyForFinalTeacherReview === true,
  logSourceDiscoveryReadyForCoverage: completionGate?.logSourceDiscoveryReadyForCoverage === true
};

const cockpitSummary = {
  status: waitingRowCockpit?.status || finalReviewPack?.cockpitSummary?.status || "",
  totalRows: Number(waitingRowCockpit?.totalRows || finalReviewPack?.cockpitSummary?.totalRows || 0),
  rowsWithLogSourceLedgerRoute: Number(waitingRowCockpit?.rowsWithLogSourceLedgerRoute || finalReviewPack?.cockpitSummary?.rowsWithLogSourceLedgerRoute || 0),
  rowsWithMetadataGatePreflight: Number(waitingRowCockpit?.rowsWithMetadataGatePreflight || finalReviewPack?.cockpitSummary?.rowsWithMetadataGatePreflight || 0),
  rowsWithCoverageContract: Number(waitingRowCockpit?.rowsWithCoverageContract || finalReviewPack?.cockpitSummary?.rowsWithCoverageContract || 0),
  readyForTeacherConfirmedMetadataGateRows: Number(
    waitingRowCockpit?.readyForTeacherConfirmedMetadataGateRows ||
      finalReviewPack?.cockpitSummary?.readyForTeacherConfirmedMetadataGateRows ||
      0
  ),
  blockedRows: Number(waitingRowCockpit?.blockedRows || finalReviewPack?.cockpitSummary?.blockedRows || 0)
};

const bridgeStatus = blockers.length
  ? "low_token_coverage_final_review_bridge_needs_missing_source_evidence"
  : coverageCounts.coverageEvidenceReadyForFinalTeacherReview
    ? "low_token_coverage_final_review_bridge_ready_for_final_teacher_review_not_completion"
    : "low_token_coverage_final_review_bridge_waiting_for_teacher_row_review";

const validateWaitingRowReceipt = sourceEvidence.waitingRowCockpitReceiptTemplate
  ? commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
      "--cockpit",
      sourceEvidence.waitingRowCockpit,
      "--receipt",
      sourceEvidence.waitingRowCockpitReceiptTemplate,
      "--output-dir",
      join("artifacts", "current-goal-low-token-coverage-waiting-row-cockpit-receipt-validations"),
      "--goal",
      "Validate teacher-filled low-token waiting-row cockpit receipt."
    ])
  : "";

const validateCompletionGateAfterReceipt =
  sourceEvidence.dossier && sourceEvidence.dossierValidation && sourceEvidence.logSourceLedger
    ? commandLine("validate-original-goal-low-token-coverage-completion-gate.mjs", [
        "--dossier",
        sourceEvidence.dossier,
        "--dossier-validation",
        sourceEvidence.dossierValidation,
        "--log-source-discovery-ledger",
        sourceEvidence.logSourceLedger,
        "--output-dir",
        join("artifacts", "current-goal-low-token-coverage-completion-gates"),
        "--goal",
        "Revalidate all-software low-token coverage completion gate after teacher row review."
      ])
    : "";

const bridgeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const bridgeDir = join(outputRoot, bridgeId);
mkdirSync(bridgeDir, { recursive: true });
const bridgePath = join(bridgeDir, "current-goal-low-token-coverage-final-review-bridge.json");
const htmlPath = join(bridgeDir, "current-goal-low-token-coverage-final-review-bridge.html");
const readmePath = join(bridgeDir, "CURRENT_GOAL_LOW_TOKEN_COVERAGE_FINAL_REVIEW_BRIDGE.md");

const bridge = {
  ok: blockers.length === 0,
  format: "transparent_ai_current_goal_low_token_coverage_final_review_bridge_v1",
  bridgeId,
  createdAt: new Date().toISOString(),
  goal,
  status: bridgeStatus,
  blockers,
  finalLane: {
    id: lowTokenLane?.id || "all_software_low_token_coverage_final_review",
    ready: lowTokenLane?.ready === true,
    blocker: lowTokenLane?.blocker || "",
    sourcePath: lowTokenLane?.sourcePath || ""
  },
  coverageCounts,
  cockpitSummary,
  latestEvidenceStatus: {
    completionGateStatus: completionGate?.status || "",
    finalReviewPackStatus: finalReviewPack?.status || "",
    convergenceAuditStatus: convergenceAudit?.status || "",
    rollbackStatus: rollback?.status || "",
    rollbackDeleteOnlyAfterTeacherConfirmation: rollback?.deleteOnlyAfterTeacherConfirmation === true
  },
  sourceEvidence,
  teacherReviewSteps: [
    {
      id: "confirm_ready_metadata_rows",
      teacherAction: "Review the rows marked ready for teacher-confirmed metadata gate and confirm or reject each route.",
      continueCondition: "Every ready row has a teacher decision and a short evidence note.",
      stopCondition: "Any row is accepted without teacher evidence or tries to read full logs/screenshots by default."
    },
    {
      id: "resolve_or_exclude_blocked_rows",
      teacherAction: "For blocked rows, add the missing source evidence, mark private/excluded with a reason, or keep blocked with a concrete next evidence request.",
      continueCondition: "No row remains ambiguous; each row has coverage, exclusion, or a blocker reason.",
      stopCondition: "A row is silently dropped from the all-software ledger."
    },
    {
      id: "rerun_completion_gate",
      teacherAction: "After the teacher-filled receipt validates, rerun the coverage completion gate with the same log-source ledger.",
      continueCondition: "The gate reports coverage_evidence_ready_for_final_teacher_review_not_completion.",
      stopCondition: "The gate claims goal completion, enables rules, writes memory, executes software, or deletes rollback points."
    }
  ],
  nextTeacherQuestion:
    "Can every in-scope software row be teacher-confirmed as covered by a low-token source route, or explicitly excluded/private, without reading full logs or taking screenshots by default?",
  nextCommands: {
    validateWaitingRowReceipt,
    validateCompletionGateAfterReceipt
  },
  paths: {
    bridge: bridgePath,
    html: htmlPath,
    readme: readmePath
  },
  locks: locks()
};

writeJson(bridgePath, bridge);
writeHtml(htmlPath, bridge);
writeReadme(readmePath, bridge);

console.log(
  JSON.stringify(
    {
      ok: true,
      bridgePath,
      htmlPath,
      readmePath,
      status: bridge.status,
      blockers: bridge.blockers,
      coverageCounts: bridge.coverageCounts,
      cockpitSummary: bridge.cockpitSummary
    },
    null,
    2
  )
);
