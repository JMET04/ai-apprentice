#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(repoRoot, args) {
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "command failed");
  return JSON.parse(result.stdout);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const root = mkdtempSync(join(tmpdir(), "ta-low-token-coverage-convergence-"));
const ledgerPath = join(root, "all-software-log-source-discovery-ledger.json");
const finalReviewPackPath = join(root, "low-token-coverage-final-review-pack.json");
const cockpitPath = join(root, "original-goal-low-token-coverage-waiting-row-cockpit.json");
const dossierPath = join(root, "original-goal-low-token-coverage-evidence-dossier.json");
const completionGatePath = join(root, "original-goal-low-token-coverage-completion-gate.json");
const locks = {
  reviewOnly: true,
  accepted: false,
  ruleEnabled: false,
  logContentsRead: false,
  fullLogsRead: false,
  screenshotsCaptured: false,
  scheduledTaskInstalled: false,
  softwareActionsExecuted: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  goalComplete: false
};

writeJson(ledgerPath, { format: "transparent_ai_all_software_log_source_discovery_ledger_v1", rows: Array.from({ length: 32 }, (_, i) => ({ id: i + 1 })) });
writeJson(finalReviewPackPath, {
  format: "transparent_ai_low_token_coverage_final_review_pack_v1",
  status: "waiting_for_teacher_low_token_coverage_final_review_not_completion",
  coverageSummary: {
    completionGateStatus: "blocked_before_all_software_low_token_coverage_completion_claim",
    logSourceDiscoveryReadyForCoverage: true,
    allSoftwareCoverageComplete: false,
    logSourceDiscoveryRows: 32,
    logSourceDiscoveryMissingRows: 0,
    teacherReviewedCoverageRows: 0
  },
  sourceEvidence: {
    completionGate: completionGatePath,
    dossier: dossierPath,
    logSourceLedger: ledgerPath,
    waitingRowCockpit: cockpitPath
  },
  locks
});
writeJson(cockpitPath, {
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  status: "waiting_for_teacher_low_token_waiting_row_review",
  counts: {
    totalRows: 32,
    rowsWithLogSourceLedgerRoute: 32,
    rowsWithoutCurrentLogSourceLedgerMatch: 0,
    rowsWithMetadataGatePreflight: 32,
    rowsWithCoverageContract: 32,
    readyForTeacherConfirmedMetadataGateRows: 10,
    blockedRows: 22
  },
  reviewRows: Array.from({ length: 32 }, (_, i) => ({ rowId: `row-${i + 1}` })),
  locks
});
writeJson(dossierPath, {
  format: "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1",
  status: "waiting_for_low_token_coverage_evidence",
  counts: {
    ledgerRows: 32,
    totalInventoryRows: 32,
    readyForTeacherCoverageReview: 0,
    waitingForLowTokenEvidence: 32
  },
  locks
});
writeJson(completionGatePath, {
  format: "transparent_ai_original_goal_low_token_coverage_completion_gate_v1",
  status: "blocked_before_all_software_low_token_coverage_completion_claim",
  locks
});

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-low-token-coverage-convergence-audit.mjs"),
  "--final-review-pack",
  finalReviewPackPath,
  "--waiting-row-cockpit",
  cockpitPath,
  "--coverage-dossier",
  dossierPath,
  "--completion-gate",
  completionGatePath,
  "--output-dir",
  join(root, "audit")
]);
const audit = readJson(result.auditPath);
const receipt = readJson(result.receiptTemplatePath);
const auditDirName = basename(dirname(result.auditPath));

assert(audit.format === "transparent_ai_low_token_coverage_convergence_audit_v1", "bad audit format");
assert(!/[.\s]$/.test(auditDirName), "audit directory must not end with a Windows-hostile dot or space");
assert(audit.status === "low_token_coverage_convergence_ready_for_teacher_review_not_completion", "audit should be review-ready");
assert(audit.summary.totalChecks === 9, "check count changed unexpectedly");
assert(audit.summary.passedChecks === 9, "all checks should pass");
assert(audit.summary.finalGoalCompletionAllowed === false, "completion must remain false");
assert(audit.coverage.totalRows === 32, "total rows missing");
assert(audit.coverage.rowsWithLogSourceLedgerRoute === 32, "ledger route coverage missing");
assert(audit.coverage.rowsWithMetadataGatePreflight === 32, "metadata gate coverage missing");
assert(audit.coverage.rowsWithCoverageContract === 32, "coverage contract coverage missing");
assert(audit.coverage.readyForTeacherConfirmedMetadataGateRows === 10, "ready row split missing");
assert(audit.coverage.blockedRows === 22, "blocked row split missing");
assert(audit.locks.auditDoesNotReadLogs === true, "read log lock missing");
assert(audit.locks.auditDoesNotRegisterMonitor === true, "monitor registration lock missing");
assert(audit.locks.goalComplete === false, "goal completion lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("read_logs_now"), "read logs forbidden missing");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete forbidden missing");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_low_token_coverage_convergence_audit_smoke_v1",
      audit: result.auditPath,
      receiptTemplate: result.receiptTemplatePath,
      summary: audit.summary,
      coverage: audit.coverage,
      locks: audit.locks
    },
    null,
    2
  )
);
