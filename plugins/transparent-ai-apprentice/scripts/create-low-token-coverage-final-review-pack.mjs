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
    String(value || "low-token-coverage-final-review-pack")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "low-token-coverage-final-review-pack"
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
    packDoesNotRunCommands: true,
    packDoesNotValidateTeacherReceipt: true,
    packDoesNotReadLogs: true,
    packDoesNotReadFullLogs: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotRegisterSchedule: true,
    packDoesNotWriteMemory: true,
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

function writeReadme(path, pack) {
  const lines = [
    "# Low-Token Coverage Final Review Pack",
    "",
    `Status: ${pack.status}`,
    `Log-source discovery ready: ${pack.coverageSummary.logSourceDiscoveryReadyForCoverage}`,
    `Coverage evidence ready for final teacher review: ${pack.coverageSummary.coverageEvidenceReadyForFinalTeacherReview}`,
    `Total waiting rows: ${pack.cockpitSummary.totalRows}`,
    `Rows ready for teacher-confirmed metadata gate: ${pack.cockpitSummary.readyForTeacherConfirmedMetadataGateRows}`,
    `Blocked rows: ${pack.cockpitSummary.blockedRows}`,
    "",
    "This pack is a review surface only. It does not read logs, capture screenshots, execute target software, register schedules, write memory, enable rules, or claim all-software coverage complete.",
    "",
    "Start here:",
    "",
    `1. Open the waiting-row cockpit: ${pack.sourceEvidence.waitingRowCockpitReadme || pack.sourceEvidence.waitingRowCockpitHtml}`,
    "2. Review the rows that are ready for teacher-confirmed metadata gate.",
    "3. Resolve or exclude the blocked rows with teacher evidence.",
    "4. Re-run the coverage dossier receipt validation and completion gate after real teacher review.",
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
  const commandRows = pack.nextReviewCommands
    .map(
      (command) => `<section>
        <h2>${htmlEscape(command.id)}</h2>
        <p>${htmlEscape(command.purpose)}</p>
        <pre>${htmlEscape(command.command)}</pre>
      </section>`
    )
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
  <title>Low-Token Coverage Final Review Pack</title>
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
  <h1>Low-Token Coverage Final Review Pack</h1>
  <section>
    <p>Status: <code>${htmlEscape(pack.status)}</code></p>
    <p class="lock">Review-only. No log reads, screenshots, software execution, schedule registration, memory write, packaging unlock, or completion claim.</p>
    <p>Completion gate: <a href="${htmlEscape(fileHref(pack.sourceEvidence.completionGate))}">${htmlEscape(pack.sourceEvidence.completionGate)}</a></p>
    <p>Waiting-row cockpit: <a href="${htmlEscape(fileHref(pack.sourceEvidence.waitingRowCockpitHtml))}">${htmlEscape(pack.sourceEvidence.waitingRowCockpitHtml)}</a></p>
  </section>
  <section>
    <h2>Coverage Summary</h2>
    <table>
      <tbody>
        <tr><th>Log-source rows</th><td>${htmlEscape(pack.coverageSummary.logSourceDiscoveryRows)}</td></tr>
        <tr><th>Log-source missing rows</th><td>${htmlEscape(pack.coverageSummary.logSourceDiscoveryMissingRows)}</td></tr>
        <tr><th>Total cockpit rows</th><td>${htmlEscape(pack.cockpitSummary.totalRows)}</td></tr>
        <tr><th>Ready metadata-gate rows</th><td>${htmlEscape(pack.cockpitSummary.readyForTeacherConfirmedMetadataGateRows)}</td></tr>
        <tr><th>Blocked rows</th><td>${htmlEscape(pack.cockpitSummary.blockedRows)}</td></tr>
      </tbody>
    </table>
  </section>
  <section>
    <h2>Teacher Receipt Rows</h2>
    <table><thead><tr><th>Row</th><th>Question</th><th>Default</th></tr></thead><tbody>${receiptRows}</tbody></table>
  </section>
  ${commandRows}
</main>
</body>
</html>
`,
    "utf8"
  );
}

const repoRoot = process.cwd();
const goal = argValue("--goal", "Prepare all-software low-token coverage for final teacher review without claiming completion.");
const completionGatePath = resolve(
  argValue(
    "--completion-gate",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-completion-gates"), "original-goal-low-token-coverage-completion-gate.json")
  )
);
const cockpitPath = resolve(
  argValue(
    "--waiting-row-cockpit",
    newestFile(join(repoRoot, "artifacts", "current-goal-low-token-coverage-waiting-row-cockpits"), "original-goal-low-token-coverage-waiting-row-cockpit.json")
  )
);
const outputRoot = resolve(argValue("--output-dir", join(repoRoot, "artifacts", "current-goal-low-token-coverage-final-review-packs")));
if (!existsSync(completionGatePath)) throw new Error(`Missing completion gate: ${completionGatePath}`);
if (!existsSync(cockpitPath)) throw new Error(`Missing waiting-row cockpit: ${cockpitPath}`);

const gate = readJson(completionGatePath);
const cockpit = readJson(cockpitPath);
const lockState = locks();
const blockers = [];
if (gate.logSourceDiscoveryReadyForCoverage !== true) blockers.push("log_source_discovery_not_ready_for_coverage");
if (gate.allSoftwareCoverageComplete !== false) blockers.push("coverage_gate_does_not_preserve_incomplete_lock");
if (gate.canClaimOriginalGoalComplete !== false) blockers.push("coverage_gate_allows_original_goal_completion");
if (!Array.isArray(gate.blockers) || !gate.blockers.includes("not_every_ledger_row_has_teacher_reviewed_coverage_or_exclusion")) {
  blockers.push("completion_gate_missing_teacher_review_blocker");
}
if (cockpit.status !== "waiting_for_teacher_low_token_waiting_row_review") blockers.push("waiting_row_cockpit_not_waiting_for_review");
if (Number(cockpit.counts?.totalRows || 0) <= 0) blockers.push("waiting_row_cockpit_has_no_rows");
if (cockpit.locks?.cockpitDoesNotReadLogs !== true) blockers.push("waiting_row_cockpit_log_read_lock_missing");
if (cockpit.locks?.cockpitDoesNotExecuteTargetSoftware !== true) blockers.push("waiting_row_cockpit_execution_lock_missing");
if (cockpit.locks?.goalComplete !== false) blockers.push("waiting_row_cockpit_goal_completion_lock_missing");

const packId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const packDir = join(outputRoot, packId);
mkdirSync(packDir, { recursive: true });
const packPath = join(packDir, "low-token-coverage-final-review-pack.json");
const receiptTemplatePath = join(packDir, "low-token-coverage-final-review-receipt-template.json");
const readmePath = join(packDir, "LOW_TOKEN_COVERAGE_FINAL_REVIEW_START_HERE.md");
const htmlPath = join(packDir, "low-token-coverage-final-review-pack.html");

const receiptTemplate = {
  format: "transparent_ai_low_token_coverage_final_review_receipt_template_v1",
  packId,
  teacherDecision: "needs_teacher_review",
  allowedTeacherDecisions: ["needs_teacher_review", "ready_for_row_level_review", "blocked"],
  forbiddenTeacherDecisions: [
    "accepted",
    "claim_complete",
    "run_now",
    "read_logs_now",
    "capture_screenshot_now",
    "execute_target_software",
    "write_memory",
    "register_schedule",
    "unlock_packaging"
  ],
  reviewRows: [
    {
      id: "log_source_discovery_review",
      question: "Are all in-scope software rows linked to a low-token log/event/metadata/fallback route?",
      defaultAnswer: "not_reviewed_yet"
    },
    {
      id: "ready_metadata_gate_rows_review",
      question: "Which ready rows may proceed to teacher-confirmed metadata gate review?",
      defaultAnswer: "not_reviewed_yet"
    },
    {
      id: "blocked_rows_review",
      question: "Which blocked rows need more evidence, exclusion, or a different low-token route?",
      defaultAnswer: "not_reviewed_yet"
    },
    {
      id: "completion_claim_review",
      question: "Confirm that this pack is not a completion claim and coverage remains incomplete until all rows are reviewed.",
      defaultAnswer: "coverage_not_complete"
    }
  ],
  locks: lockState
};

const pack = {
  ok: blockers.length === 0,
  format: "transparent_ai_low_token_coverage_final_review_pack_v1",
  packId,
  createdAt: new Date().toISOString(),
  goal,
  status: blockers.length
    ? "blocked_waiting_for_valid_low_token_coverage_review_inputs"
    : "waiting_for_teacher_low_token_coverage_final_review_not_completion",
  blockers,
  coverageSummary: {
    completionGateStatus: gate.status,
    coverageEvidenceReadyForFinalTeacherReview: gate.coverageEvidenceReadyForFinalTeacherReview === true,
    logSourceDiscoveryReadyForCoverage: gate.logSourceDiscoveryReadyForCoverage === true,
    allSoftwareCoverageComplete: gate.allSoftwareCoverageComplete === true,
    canClaimOriginalGoalComplete: gate.canClaimOriginalGoalComplete === true,
    logSourceDiscoveryRows: Number(gate.counts?.logSourceDiscoveryRows || 0),
    logSourceDiscoveryMissingRows: Number(gate.counts?.logSourceDiscoveryMissingRows || 0),
    unresolvedCoverageRows: Number(gate.counts?.unresolvedCoverageRows || 0),
    teacherReviewedCoverageRows: Number(gate.counts?.teacherReviewedCoverageRows || 0),
    blockerCount: Array.isArray(gate.blockers) ? gate.blockers.length : 0
  },
  cockpitSummary: {
    status: cockpit.status,
    totalRows: Number(cockpit.counts?.totalRows || 0),
    rowsWithLogSourceLedgerRoute: Number(cockpit.counts?.rowsWithLogSourceLedgerRoute || 0),
    rowsWithMetadataGatePreflight: Number(cockpit.counts?.rowsWithMetadataGatePreflight || 0),
    rowsWithCoverageContract: Number(cockpit.counts?.rowsWithCoverageContract || 0),
    readyForTeacherConfirmedMetadataGateRows: Number(cockpit.counts?.readyForTeacherConfirmedMetadataGateRows || 0),
    blockedRows: Number(cockpit.counts?.blockedRows || 0),
    likelyCoverageLedgerScopeMismatch: cockpit.scopeDiagnostics?.likelyCoverageLedgerScopeMismatch === true
  },
  sourceEvidence: {
    completionGate: completionGatePath,
    dossier: gate.sourceEvidence?.dossierPath || cockpit.paths?.sourceDossier || "",
    dossierValidation: gate.sourceEvidence?.dossierValidationPath || "",
    logSourceLedger: gate.sourceEvidence?.logSourceDiscoveryLedgerPath || cockpit.paths?.sourceLogSourceDiscoveryLedger || "",
    waitingRowCockpit: cockpitPath,
    waitingRowCockpitHtml: cockpit.paths?.html || "",
    waitingRowCockpitReadme: cockpit.paths?.readme || "",
    waitingRowCockpitReceiptTemplate: cockpit.paths?.receiptTemplate || ""
  },
  nextReviewCommands: [
    {
      id: "open_waiting_row_cockpit",
      purpose: "Review the 32 low-token coverage waiting rows, including the 10 rows ready for teacher-confirmed metadata gate and the 22 blocked rows.",
      command: cockpit.paths?.readme || cockpit.paths?.html || cockpitPath
    },
    {
      id: "validate_teacher_filled_waiting_row_cockpit_receipt",
      purpose: "After the teacher fills the cockpit receipt, validate row decisions without reading logs or executing software.",
      command: commandLine("validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs", [
        "--cockpit",
        cockpitPath,
        "--receipt",
        "<teacher-filled-low-token-coverage-waiting-row-cockpit-receipt.json>",
        "--output-dir",
        "artifacts\\current-goal-low-token-coverage-waiting-row-cockpit-receipt-validations"
      ])
    },
    {
      id: "rerun_low_token_coverage_completion_gate_after_teacher_review",
      purpose: "After real teacher review updates coverage evidence, re-run the completion gate to see whether coverage evidence is ready for final teacher acceptance.",
      command: commandLine("validate-original-goal-low-token-coverage-completion-gate.mjs", [
        "--dossier",
        gate.sourceEvidence?.dossierPath || cockpit.paths?.sourceDossier || "<coverage-dossier.json>",
        "--dossier-validation",
        gate.sourceEvidence?.dossierValidationPath || "<coverage-dossier-receipt-validation.json>",
        "--log-source-discovery-ledger",
        gate.sourceEvidence?.logSourceDiscoveryLedgerPath || cockpit.paths?.sourceLogSourceDiscoveryLedger || "<log-source-discovery-ledger.json>",
        "--output-dir",
        "artifacts\\current-goal-low-token-coverage-completion-gates"
      ])
    }
  ],
  completionBoundary: {
    allSoftwareLowTokenCoverageComplete: false,
    finalGoalCompletionAllowed: false,
    reason: "This pack organizes low-token coverage review. It does not replace teacher-reviewed row receipts or unattended operational evidence."
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
      format: "transparent_ai_low_token_coverage_final_review_pack_result_v1",
      status: pack.status,
      packPath,
      receiptTemplatePath,
      readmePath,
      htmlPath,
      blockers,
      cockpitSummary: pack.cockpitSummary,
      locks: lockState
    },
    null,
    2
  )
);
