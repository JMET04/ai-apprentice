#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "original-goal-low-token-coverage-completion-gate-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createRefreshFixture(name, rows) {
  const fixtureRoot = join(smokeRoot, name);
  mkdirSync(fixtureRoot, { recursive: true });
  const ledgerPath = join(fixtureRoot, "all-software-coverage-enrollment-ledger.json");
  const refreshPath = join(fixtureRoot, "original-goal-current-status-refresh.json");
  writeJson(ledgerPath, {
    format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
    counts: {
      totalInventoryRows: rows.length,
      ledgerRows: rows.length,
      enrolledWithWatchEvidence: rows.filter((row) => String(row.status).includes("with_watch_evidence")).length,
      enrolledWaitingForWatchEvidence: rows.filter((row) => String(row.status).includes("waiting_for_watch_evidence")).length,
      waitingForQueueEnrollment: rows.filter((row) => row.status === "waiting_for_queue_enrollment").length
    },
    rows,
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareCoverageComplete: false
    }
  });
  writeJson(refreshPath, {
    format: "transparent_ai_original_goal_current_status_refresh_v1",
    goal: `Smoke ${name} low-token coverage completion gate.`,
    paths: {
      coverageEnrollmentLedger: ledgerPath,
      coverageEnrollmentFollowUpPlan: join(fixtureRoot, "follow-up-plan.json"),
      realLocalAllSoftwareLowTokenReadinessPackage: join(fixtureRoot, "readiness.json")
    },
    discoveredEvidence: {},
    refreshedEvidence: {},
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareCoverageComplete: false,
      goalComplete: false
    }
  });
  return { fixtureRoot, ledgerPath, refreshPath };
}

function createLogSourceDiscoveryLedger(fixtureRoot, rows, overrides = {}) {
  mkdirSync(fixtureRoot, { recursive: true });
  const ledgerPath = join(fixtureRoot, "all-software-log-source-discovery-ledger.json");
  const missingRows = rows.filter((row) => row.discoveryStatus === "needs_teacher_log_source_or_exclusion").length;
  const completeRows = rows.filter((row) => row.discoveryStatus !== "needs_teacher_log_source_or_exclusion").length;
  const ledger = {
    format: "transparent_ai_all_software_log_source_discovery_ledger_v1",
    status: missingRows > 0 ? "needs_teacher_log_source_review" : "all_rows_have_source_route_for_coverage_review",
    counts: {
      totalInventoryRows: rows.length,
      ledgerRows: rows.length,
      directLogCandidatesReadyForMetadataGate: rows.filter((row) => row.discoveryStatus === "direct_log_candidates_ready_for_metadata_gate").length,
      nonLogLowTokenFallbackReadyForReview: rows.filter((row) => row.discoveryStatus === "non_log_low_token_fallback_ready_for_review").length,
      windowsEventLogFallbackReadyForReview: rows.filter((row) => row.discoveryStatus === "windows_event_log_fallback_ready_for_review").length,
      candidateRootsNeedBoundedScan: rows.filter((row) => row.discoveryStatus === "candidate_roots_need_bounded_scan").length,
      needsTeacherLogSourceOrExclusion: missingRows,
      rowsWithSourceRoute: completeRows
    },
    rows,
    allRowsHaveSourceRoute: missingRows === 0,
    nextReviewQueue: rows.filter((row) => row.discoveryStatus === "needs_teacher_log_source_or_exclusion"),
    locks: {
      reviewOnly: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      allSoftwareLogSourceDiscoveryComplete: false,
      logContentsRead: false,
      screenshotsCaptured: false,
      softwareActionsExecuted: false,
      nativeUniversalExecution: false
    },
    ...overrides
  };
  writeJson(ledgerPath, ledger);
  return ledgerPath;
}

function buildDossierAndValidation(name, rows, decisionForBucket) {
  const fixture = createRefreshFixture(name, rows);
  const logSourceDiscoveryLedgerPath = createLogSourceDiscoveryLedger(
    fixture.fixtureRoot,
    rows.map((row) => ({
      ledgerNumber: row.ledgerNumber,
      software: row.software,
      discoveryStatus: row.status === "enrolled_non_log_fallback_with_watch_evidence"
        ? "non_log_low_token_fallback_ready_for_review"
        : "direct_log_candidates_ready_for_metadata_gate"
    }))
  );
  const dossierResult = runNodeScript("create-original-goal-low-token-coverage-evidence-dossier.mjs", [
    "--status-refresh",
    fixture.refreshPath,
    "--output-dir",
    join(fixture.fixtureRoot, "dossier")
  ]);
  const builderResult = runNodeScript("create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs", [
    "--dossier",
    dossierResult.dossierPath,
    "--output-dir",
    join(fixture.fixtureRoot, "builder")
  ]);
  const template = readJson(builderResult.receiptTemplatePath);
  const receiptPath = join(fixture.fixtureRoot, "teacher-filled-coverage-dossier-receipt.json");
  const receipt = {
    ...template,
    decision: "teacher_reviewed_low_token_coverage_dossier",
    rowDecisions: template.rowDecisions.map((row) => ({
      ...row,
      teacherDecision: decisionForBucket(row.bucket),
      evidenceReviewed: true,
      teacherNote: "reviewed by completion gate smoke"
    }))
  };
  writeJson(receiptPath, receipt);
  const validationResult = runNodeScript("validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs", [
    "--builder",
    builderResult.builderPath,
    "--receipt",
    receiptPath,
    "--output-dir",
    join(fixture.fixtureRoot, "receipt-validation")
  ]);
  return {
    fixture,
    dossierResult,
    builderResult,
    validationResult,
    logSourceDiscoveryLedgerPath,
    dossier: readJson(dossierResult.dossierPath),
    validation: readJson(validationResult.validationPath)
  };
}

function runCompletionGate(name, dossierPath, validationPath = "", logSourceDiscoveryLedgerPath = "") {
  const args = ["--dossier", dossierPath, "--output-dir", join(smokeRoot, name, "completion-gate")];
  if (logSourceDiscoveryLedgerPath) args.push("--log-source-discovery-ledger", logSourceDiscoveryLedgerPath);
  if (validationPath) args.push("--dossier-validation", validationPath);
  const result = runNodeScript("validate-original-goal-low-token-coverage-completion-gate.mjs", args);
  return { result, gate: readJson(result.gatePath) };
}

const blockedFixture = buildDossierAndValidation(
  "blocked-unresolved",
  [
    {
      ledgerNumber: 1,
      software: "ReadyApp",
      processName: "ReadyApp",
      status: "enrolled_log_route_with_watch_evidence",
      readyForTeacherCoverageReview: true,
      queueItemPresent: true,
      coverageAuditStatus: "covered_with_log_route_and_watch_evidence",
      candidateLogFileCount: 1,
      watchEvidenceCount: 1
    },
    {
      ledgerNumber: 2,
      software: "WaitingLogApp",
      processName: "WaitingLogApp",
      status: "enrolled_log_route_waiting_for_watch_evidence",
      readyForTeacherCoverageReview: false,
      queueItemPresent: true,
      coverageAuditStatus: "covered_with_log_route",
      candidateLogFileCount: 1,
      watchEvidenceCount: 0
    },
    {
      ledgerNumber: 3,
      software: "WaitingQueueApp",
      processName: "WaitingQueueApp",
      status: "waiting_for_queue_enrollment",
      readyForTeacherCoverageReview: false,
      queueItemPresent: false,
      coverageAuditStatus: "waiting_for_queue_enrollment",
      candidateLogRootCount: 1,
      watchEvidenceCount: 0
    },
    {
      ledgerNumber: 4,
      software: "NeedsSignalApp",
      processName: "NeedsSignalApp",
      status: "needs_teacher_signal_or_exclusion",
      readyForTeacherCoverageReview: false,
      queueItemPresent: false,
      coverageAuditStatus: "needs_teacher_signal_or_exclusion",
      nonLogFallbackSignalCount: 1,
      watchEvidenceCount: 0
    }
  ],
  (bucket) => {
    if (bucket === "ready_for_teacher_coverage_review") return "teacher_reviewed_ready_coverage_row";
    if (bucket === "waiting_for_queue_enrollment") return "teacher_reviewed_promote_to_observer_queue";
    if (bucket === "needs_teacher_signal_or_exclusion") return "teacher_reviewed_prepare_signal_question";
    return "teacher_reviewed_collect_metadata_follow_up";
  }
);
const blockedGate = runCompletionGate(
  "blocked-unresolved",
  blockedFixture.dossierResult.dossierPath,
  blockedFixture.validationResult.validationPath,
  blockedFixture.logSourceDiscoveryLedgerPath
);

const readyFixture = buildDossierAndValidation(
  "ready-final-review",
  [
    {
      ledgerNumber: 1,
      software: "ReadyLogApp",
      processName: "ReadyLogApp",
      status: "enrolled_log_route_with_watch_evidence",
      readyForTeacherCoverageReview: true,
      queueItemPresent: true,
      coverageAuditStatus: "covered_with_log_route_and_watch_evidence",
      candidateLogFileCount: 1,
      watchEvidenceCount: 2
    },
    {
      ledgerNumber: 2,
      software: "ReadyFallbackApp",
      processName: "ReadyFallbackApp",
      status: "enrolled_non_log_fallback_with_watch_evidence",
      readyForTeacherCoverageReview: true,
      queueItemPresent: true,
      coverageAuditStatus: "covered_with_non_log_fallback_route_and_watch_evidence",
      nonLogFallbackSignalCount: 1,
      watchEvidenceCount: 1
    }
  ],
  () => "teacher_reviewed_ready_coverage_row"
);
const readyGate = runCompletionGate(
  "ready-final-review",
  readyFixture.dossierResult.dossierPath,
  readyFixture.validationResult.validationPath,
  readyFixture.logSourceDiscoveryLedgerPath
);

const incompleteLogSourceLedgerPath = createLogSourceDiscoveryLedger(
  join(smokeRoot, "incomplete-log-source"),
  [
    {
      ledgerNumber: 1,
      software: "ReadyLogApp",
      discoveryStatus: "direct_log_candidates_ready_for_metadata_gate"
    },
    {
      ledgerNumber: 2,
      software: "MissingSourceApp",
      discoveryStatus: "needs_teacher_log_source_or_exclusion"
    }
  ]
);
const incompleteLogSourceGate = runCompletionGate(
  "incomplete-log-source",
  readyFixture.dossierResult.dossierPath,
  readyFixture.validationResult.validationPath,
  incompleteLogSourceLedgerPath
);
const missingValidationGate = runCompletionGate(
  "missing-validation",
  readyFixture.dossierResult.dossierPath,
  "",
  readyFixture.logSourceDiscoveryLedgerPath
);

const checks = [
  {
    name: "Coverage completion gate blocks unresolved or follow-up rows",
    pass:
      blockedGate.gate.format === "transparent_ai_original_goal_low_token_coverage_completion_gate_v1" &&
      blockedGate.gate.status === "blocked_before_all_software_low_token_coverage_completion_claim" &&
      blockedGate.gate.logSourceDiscoveryReadyForCoverage === true &&
      blockedGate.gate.coverageEvidenceReadyForFinalTeacherReview === false &&
      blockedGate.gate.allSoftwareCoverageComplete === false &&
      blockedGate.gate.canClaimOriginalGoalComplete === false &&
      blockedGate.gate.blockers.includes("unresolved_low_token_coverage_rows_remain") &&
      blockedGate.gate.blockers.includes("low_token_coverage_contracts_incomplete_for_some_rows") &&
      blockedGate.gate.blockers.includes("reviewed_follow_up_rows_still_need_metadata_or_queue_follow_up") &&
      blockedGate.gate.counts.coverageContractIncompleteRows === 3 &&
      blockedGate.gate.locks.gateDoesNotReadLogs === true &&
      blockedGate.gate.locks.gateDoesNotCaptureScreenshots === true &&
      blockedGate.gate.locks.gateDoesNotExecuteTargetSoftware === true &&
      blockedGate.gate.locks.gateDoesNotWriteMemory === true,
    evidence: blockedGate.result.gatePath
  },
  {
    name: "Coverage completion gate allows only final teacher review when every row is reviewed",
    pass:
      readyFixture.validation.validationDecision === "reviewed_rows_recorded_without_completion_claim" &&
      readyGate.gate.status === "coverage_evidence_ready_for_final_teacher_review_not_completion" &&
      readyGate.gate.logSourceDiscoveryReadyForCoverage === true &&
      readyGate.gate.coverageEvidenceReadyForFinalTeacherReview === true &&
      readyGate.gate.counts.logSourceDiscoveryMissingRows === 0 &&
      readyGate.gate.counts.teacherReviewedCoverageRows === readyGate.gate.counts.ledgerRows &&
      readyGate.gate.counts.coverageContractIncompleteRows === 0 &&
      readyGate.gate.counts.coverageContractSatisfiedBeforeTeacherReceipt === readyGate.gate.counts.ledgerRows &&
      readyGate.gate.blockers.length === 0 &&
      readyGate.gate.allSoftwareCoverageComplete === false &&
      readyGate.gate.canClaimOriginalGoalComplete === false &&
      readyGate.gate.locks.teacherFinalAcceptanceRequired === true &&
      readyGate.gate.locks.goalComplete === false &&
      readyGate.gate.nextAllowedActions.includes("prepare_final_teacher_coverage_acceptance_review"),
    evidence: readyGate.result.gatePath
  },
  {
    name: "Coverage completion gate blocks incomplete log-source discovery ledger",
    pass:
      incompleteLogSourceGate.gate.status === "blocked_before_all_software_low_token_coverage_completion_claim" &&
      incompleteLogSourceGate.gate.logSourceDiscoveryReadyForCoverage === false &&
      incompleteLogSourceGate.gate.coverageEvidenceReadyForFinalTeacherReview === false &&
      incompleteLogSourceGate.gate.blockers.includes("unresolved_log_source_discovery_rows_remain") &&
      incompleteLogSourceGate.gate.blockers.includes("not_every_software_row_has_log_source_or_fallback_route") &&
      incompleteLogSourceGate.gate.counts.logSourceDiscoveryMissingRows === 1 &&
      incompleteLogSourceGate.gate.allSoftwareCoverageComplete === false,
    evidence: incompleteLogSourceGate.result.gatePath
  },
  {
    name: "Coverage completion gate blocks missing teacher validation",
    pass:
      missingValidationGate.gate.status === "blocked_before_all_software_low_token_coverage_completion_claim" &&
      missingValidationGate.gate.blockers.includes("missing_teacher_dossier_receipt_validation") &&
      missingValidationGate.gate.coverageEvidenceReadyForFinalTeacherReview === false &&
      missingValidationGate.gate.allSoftwareCoverageComplete === false &&
      missingValidationGate.gate.canClaimOriginalGoalComplete === false,
    evidence: missingValidationGate.result.gatePath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_low_token_coverage_completion_gate_smoke_v1",
      smokeRoot,
      paths: {
        blockedGate: blockedGate.result.gatePath,
        readyGate: readyGate.result.gatePath,
        incompleteLogSourceGate: incompleteLogSourceGate.result.gatePath,
        missingValidationGate: missingValidationGate.result.gatePath
      },
      checks
    },
    null,
    2
  )
);

if (failed.length > 0) process.exit(1);
