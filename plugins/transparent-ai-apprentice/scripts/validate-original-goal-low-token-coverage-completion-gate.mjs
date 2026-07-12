#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "original-goal-low-token-coverage-completion-gate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "original-goal-low-token-coverage-completion-gate"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(text), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    gateDoesNotRunFollowUpPlan: true,
    gateDoesNotRunBatch: true,
    gateDoesNotReadLogs: true,
    gateDoesNotCaptureScreenshots: true,
    gateDoesNotExecuteTargetSoftware: true,
    gateDoesNotRegisterSchedule: true,
    gateDoesNotWriteMemory: true,
    allSoftwareCoverageComplete: false,
    teacherFinalAcceptanceRequired: true,
    fullContinuousRecording: false,
    screenshotsCaptured: false,
    rawFullLogsRetained: false,
    logContentsRead: false,
    fullLogsRead: false,
    fileContentsRead: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    scheduledTaskInstalled: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function writeReadme(path, gate) {
  const lines = [
    "# Original Goal Low-Token Coverage Completion Gate",
    "",
    `Status: ${gate.status}`,
    `Log-source discovery rows: ${gate.counts.logSourceDiscoveryRows}`,
    `Log-source missing rows: ${gate.counts.logSourceDiscoveryMissingRows}`,
    `Log-source discovery ready for coverage: ${gate.logSourceDiscoveryReadyForCoverage}`,
    `Ledger rows: ${gate.counts.ledgerRows}`,
    `Unresolved rows: ${gate.counts.unresolvedCoverageRows}`,
    `Coverage contract incomplete rows: ${gate.counts.coverageContractIncompleteRows}`,
    `Coverage contracts satisfied before teacher receipt: ${gate.counts.coverageContractSatisfiedBeforeTeacherReceipt}`,
    `Teacher-reviewed coverage rows: ${gate.counts.teacherReviewedCoverageRows}`,
    `Coverage evidence ready for final teacher review: ${gate.coverageEvidenceReadyForFinalTeacherReview}`,
    "",
    "This gate prevents the project from claiming all-software low-token coverage until every in-scope ledger row is either teacher-reviewed as covered or teacher-excluded/private.",
    "",
    "Blockers:",
    ...gate.blockers.map((blocker) => `- ${blocker}`),
    "",
    "Safety boundary:",
    "- This gate does not run follow-up plans or batches.",
    "- It does not read logs, capture screenshots, execute target software, register schedules, write memory, accept coverage, unlock packaging, or claim goal completion."
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const dossierInput = readJsonInput(
  argValue("--dossier", argValue("--coverage-dossier", "")),
  "--dossier",
  "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1"
);
if (!dossierInput.value) throw new Error("--dossier is required");
const validationInput = readJsonInput(
  argValue("--dossier-validation", argValue("--validation", "")),
  "--dossier-validation",
  "transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_v1"
);
const logSourceDiscoveryInput = readJsonInput(
  argValue("--log-source-discovery-ledger", argValue("--source-discovery-ledger", "")),
  "--log-source-discovery-ledger",
  "transparent_ai_all_software_log_source_discovery_ledger_v1"
);
const goal = argValue("--goal", "Gate original-goal all-software low-token coverage completion claims.");
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "original-goal-low-token-coverage-completion-gates"))
);
mkdirSync(outputRoot, { recursive: true });
const gateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const gateDir = join(outputRoot, gateId);
mkdirSync(gateDir, { recursive: true });

const dossier = dossierInput.value;
const validation = validationInput.value;
const logSourceDiscoveryLedger = logSourceDiscoveryInput.value;
const dossierCounts = dossier.counts || {};
const logSourceDiscoveryCounts = logSourceDiscoveryLedger?.counts || {};
const validationRows = Array.isArray(validation?.validationRows) ? validation.validationRows : [];
const ledgerRows = Number(dossierCounts.ledgerRows || 0);
const logSourceDiscoveryRows =
  Number(logSourceDiscoveryCounts.ledgerRows || 0) ||
  (Array.isArray(logSourceDiscoveryLedger?.rows) ? logSourceDiscoveryLedger.rows.length : 0);
const logSourceDiscoveryMissingRows = Number(logSourceDiscoveryCounts.needsTeacherLogSourceOrExclusion || 0);
const logSourceDiscoveryNextReviewQueueCount = Array.isArray(logSourceDiscoveryLedger?.nextReviewQueue)
  ? logSourceDiscoveryLedger.nextReviewQueue.length
  : 0;
const logSourceDiscoveryReadyForCoverage =
  Boolean(logSourceDiscoveryLedger) &&
  logSourceDiscoveryRows > 0 &&
  logSourceDiscoveryMissingRows === 0 &&
  logSourceDiscoveryLedger?.allRowsHaveSourceRoute === true &&
  logSourceDiscoveryLedger?.locks?.reviewOnly === true &&
  logSourceDiscoveryLedger?.locks?.logContentsRead === false &&
  logSourceDiscoveryLedger?.locks?.screenshotsCaptured === false &&
  logSourceDiscoveryLedger?.locks?.softwareActionsExecuted === false;
const unresolvedCoverageRows =
  Number(dossierCounts.waitingForLowTokenEvidence || 0) +
  Number(dossierCounts.waitingForQueueEnrollment || 0) +
  Number(dossierCounts.needsTeacherSignalOrExclusion || 0);
const coverageContractIncompleteRows = Number(dossierCounts.coverageContractIncompleteRows || 0);
const coverageContractSatisfiedBeforeTeacherReceipt = Number(
  dossierCounts.coverageContractSatisfiedBeforeTeacherReceipt || 0
);
const readyReviewRows = Number(dossierCounts.readyForTeacherCoverageReview || 0);
const teacherExcludedOrPrivate = Number(dossierCounts.teacherExcludedOrPrivate || 0);
const readyFollowUpRowCount = Number(validation?.readyFollowUpRowCount || 0);
const reviewedReadyRowCount = Number(validation?.reviewedReadyRowCount || 0);
const excludedRowCount = Number(validation?.excludedRowCount || 0);
const waitingValidationRowCount = Number(validation?.waitingRowCount || 0);
const teacherReviewedCoverageRows = reviewedReadyRowCount + excludedRowCount;

const blockers = [];
if (!logSourceDiscoveryLedger) blockers.push("missing_log_source_discovery_ledger");
if (logSourceDiscoveryLedger && logSourceDiscoveryRows <= 0) blockers.push("missing_log_source_discovery_rows");
if (logSourceDiscoveryLedger && logSourceDiscoveryMissingRows > 0) blockers.push("unresolved_log_source_discovery_rows_remain");
if (logSourceDiscoveryLedger && logSourceDiscoveryLedger.allRowsHaveSourceRoute !== true) {
  blockers.push("not_every_software_row_has_log_source_or_fallback_route");
}
if (logSourceDiscoveryLedger && logSourceDiscoveryLedger.locks?.logContentsRead !== false) {
  blockers.push("source_log_discovery_ledger_does_not_preserve_log_read_lock");
}
if (logSourceDiscoveryLedger && logSourceDiscoveryLedger.locks?.screenshotsCaptured !== false) {
  blockers.push("source_log_discovery_ledger_does_not_preserve_screenshot_lock");
}
if (logSourceDiscoveryLedger && logSourceDiscoveryLedger.locks?.softwareActionsExecuted !== false) {
  blockers.push("source_log_discovery_ledger_does_not_preserve_execution_lock");
}
if (!validation) blockers.push("missing_teacher_dossier_receipt_validation");
if (ledgerRows <= 0) blockers.push("missing_coverage_ledger_rows");
if (unresolvedCoverageRows > 0) blockers.push("unresolved_low_token_coverage_rows_remain");
if (coverageContractIncompleteRows > 0) blockers.push("low_token_coverage_contracts_incomplete_for_some_rows");
if (readyFollowUpRowCount > 0) blockers.push("reviewed_follow_up_rows_still_need_metadata_or_queue_follow_up");
if (waitingValidationRowCount > 0) blockers.push("teacher_dossier_validation_has_waiting_rows");
if (validation?.forbiddenDecisionUsed === true) blockers.push("teacher_dossier_validation_used_forbidden_decision");
if (validation && teacherReviewedCoverageRows < ledgerRows) blockers.push("not_every_ledger_row_has_teacher_reviewed_coverage_or_exclusion");
if (validation && validation.locks?.allSoftwareCoverageComplete !== false) blockers.push("source_validation_does_not_preserve_coverage_completion_lock");
if (dossier.locks?.allSoftwareCoverageComplete !== false) blockers.push("source_dossier_does_not_preserve_coverage_completion_lock");

const coverageEvidenceReadyForFinalTeacherReview =
  blockers.length === 0 &&
  logSourceDiscoveryReadyForCoverage &&
  ledgerRows > 0 &&
  unresolvedCoverageRows === 0 &&
  teacherReviewedCoverageRows >= ledgerRows;

const status = coverageEvidenceReadyForFinalTeacherReview
  ? "coverage_evidence_ready_for_final_teacher_review_not_completion"
  : "blocked_before_all_software_low_token_coverage_completion_claim";
const lockState = locks();
const gatePath = join(gateDir, "original-goal-low-token-coverage-completion-gate.json");
const receiptPath = join(gateDir, "original-goal-low-token-coverage-completion-gate-receipt.json");
const readmePath = join(gateDir, "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_COMPLETION_GATE_START_HERE.md");
const gate = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_completion_gate_v1",
  gateId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  coverageEvidenceReadyForFinalTeacherReview,
  logSourceDiscoveryReadyForCoverage,
  allSoftwareCoverageComplete: false,
  canClaimOriginalGoalComplete: false,
  counts: {
    logSourceDiscoveryRows,
    logSourceDiscoveryMissingRows,
    logSourceDiscoveryNextReviewQueueCount,
    ledgerRows,
    unresolvedCoverageRows,
    coverageContractIncompleteRows,
    coverageContractSatisfiedBeforeTeacherReceipt,
    readyReviewRows,
    teacherExcludedOrPrivate,
    teacherReviewedCoverageRows,
    readyFollowUpRowCount,
    waitingValidationRowCount,
    validationRows: validationRows.length
  },
  blockers,
  sourceEvidence: {
    logSourceDiscoveryLedgerPath: logSourceDiscoveryInput.path,
    logSourceDiscoveryStatus: logSourceDiscoveryLedger?.status || "",
    logSourceDiscoveryAllRowsHaveSourceRoute: logSourceDiscoveryLedger?.allRowsHaveSourceRoute === true,
    dossierPath: dossierInput.path,
    dossierStatus: dossier.status || "",
    dossierValidationPath: validationInput.path,
    dossierValidationStatus: validation?.status || "",
    sourceLedger: dossier.sourceEvidence?.coverageEnrollmentLedger || validation?.paths?.sourceLedger || ""
  },
  nextAllowedActions: coverageEvidenceReadyForFinalTeacherReview
    ? [
        "prepare_final_teacher_coverage_acceptance_review",
        "keep_original_goal_completion_blocked_until_operational_and_native_execution_evidence_are_proven"
      ]
    : [
        "resolve_unreviewed_or_waiting_coverage_rows",
        "rerun_dossier_receipt_validation_after_teacher_review",
        "rerun_this_completion_gate"
      ],
  blockedActions: [
    "claim_all_software_low_token_coverage_complete_from_partial_rows",
    "claim_original_goal_complete_from_coverage_gate",
    "run_follow_up_plan_from_completion_gate",
    "read_logs_from_completion_gate",
    "capture_screenshot_from_completion_gate",
    "execute_target_software_from_completion_gate",
    "write_memory_from_completion_gate",
    "unlock_packaging_from_completion_gate"
  ],
  locks: lockState
};
const receipt = {
  format: "transparent_ai_original_goal_low_token_coverage_completion_gate_receipt_v1",
  gateId,
  status,
  coverageEvidenceReadyForFinalTeacherReview,
  logSourceDiscoveryReadyForCoverage,
  allSoftwareCoverageComplete: false,
  canClaimOriginalGoalComplete: false,
  blockers,
  screenshotsCaptured: false,
  targetSoftwareCommandsExecuted: false,
  scheduledTaskInstalled: false,
  memoryWritten: false,
  nativeUniversalExecution: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: lockState
};

writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
writeReadme(readmePath, gate);

console.log(JSON.stringify({
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_completion_gate_result_v1",
  gateId,
  gatePath,
  receiptPath,
  readmePath,
  status,
  coverageEvidenceReadyForFinalTeacherReview,
  allSoftwareCoverageComplete: false,
  canClaimOriginalGoalComplete: false,
  blockers,
  logSourceDiscoveryRows,
  logSourceDiscoveryMissingRows,
  locks: lockState
}, null, 2));
