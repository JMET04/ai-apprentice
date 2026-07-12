#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
const root = mkdtempSync(join(tmpdir(), "ta-low-token-coverage-final-review-pack-"));
const completionGatePath = join(root, "original-goal-low-token-coverage-completion-gate.json");
const cockpitPath = join(root, "original-goal-low-token-coverage-waiting-row-cockpit.json");
const cockpitReadmePath = join(root, "ORIGINAL_GOAL_LOW_TOKEN_COVERAGE_WAITING_ROW_COCKPIT_START_HERE.md");
const cockpitHtmlPath = join(root, "original-goal-low-token-coverage-waiting-row-cockpit.html");
const cockpitReceiptPath = join(root, "original-goal-low-token-coverage-waiting-row-cockpit-receipt-template.json");
writeJson(completionGatePath, {
  format: "transparent_ai_original_goal_low_token_coverage_completion_gate_v1",
  status: "blocked_before_all_software_low_token_coverage_completion_claim",
  coverageEvidenceReadyForFinalTeacherReview: false,
  logSourceDiscoveryReadyForCoverage: true,
  allSoftwareCoverageComplete: false,
  canClaimOriginalGoalComplete: false,
  counts: {
    logSourceDiscoveryRows: 32,
    logSourceDiscoveryMissingRows: 0,
    unresolvedCoverageRows: 32,
    teacherReviewedCoverageRows: 0
  },
  blockers: [
    "unresolved_low_token_coverage_rows_remain",
    "not_every_ledger_row_has_teacher_reviewed_coverage_or_exclusion"
  ],
  sourceEvidence: {
    dossierPath: join(root, "dossier.json"),
    dossierValidationPath: join(root, "dossier-validation.json"),
    logSourceDiscoveryLedgerPath: join(root, "log-source-ledger.json")
  },
  locks: {
    reviewOnly: true,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  }
});
writeJson(cockpitPath, {
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  status: "waiting_for_teacher_low_token_waiting_row_review",
  counts: {
    totalRows: 32,
    rowsWithLogSourceLedgerRoute: 32,
    rowsWithMetadataGatePreflight: 32,
    rowsWithCoverageContract: 32,
    readyForTeacherConfirmedMetadataGateRows: 10,
    blockedRows: 22
  },
  scopeDiagnostics: {
    likelyCoverageLedgerScopeMismatch: false
  },
  paths: {
    cockpit: cockpitPath,
    html: cockpitHtmlPath,
    readme: cockpitReadmePath,
    receiptTemplate: cockpitReceiptPath,
    sourceDossier: join(root, "dossier.json"),
    sourceLogSourceDiscoveryLedger: join(root, "log-source-ledger.json")
  },
  locks: {
    reviewOnly: true,
    cockpitDoesNotReadLogs: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    cockpitDoesNotWriteMemory: true,
    allSoftwareCoverageComplete: false,
    goalComplete: false
  }
});
writeFileSync(cockpitReadmePath, "# Waiting Row Cockpit\n", "utf8");
writeFileSync(cockpitHtmlPath, "<!doctype html><title>Cockpit</title>", "utf8");
writeJson(cockpitReceiptPath, { format: "receipt", decision: "needs_teacher_review" });

const result = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-low-token-coverage-final-review-pack.mjs"),
  "--completion-gate",
  completionGatePath,
  "--waiting-row-cockpit",
  cockpitPath,
  "--output-dir",
  join(root, "review-pack")
]);
const pack = readJson(result.packPath);
const receipt = readJson(result.receiptTemplatePath);

assert(pack.format === "transparent_ai_low_token_coverage_final_review_pack_v1", "bad pack format");
assert(pack.status === "waiting_for_teacher_low_token_coverage_final_review_not_completion", "pack should wait for teacher review");
assert(pack.coverageSummary.logSourceDiscoveryReadyForCoverage === true, "log source readiness missing");
assert(pack.coverageSummary.coverageEvidenceReadyForFinalTeacherReview === false, "coverage must not be final-ready in fixture");
assert(pack.cockpitSummary.totalRows === 32, "total rows missing");
assert(pack.cockpitSummary.readyForTeacherConfirmedMetadataGateRows === 10, "ready row count missing");
assert(pack.cockpitSummary.blockedRows === 22, "blocked row count missing");
assert(pack.completionBoundary.allSoftwareLowTokenCoverageComplete === false, "coverage completion must stay false");
assert(pack.completionBoundary.finalGoalCompletionAllowed === false, "final completion must stay false");
assert(pack.locks.packDoesNotReadLogs === true, "read log lock missing");
assert(pack.locks.packDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(pack.locks.packDoesNotWriteMemory === true, "memory lock missing");
assert(pack.locks.goalComplete === false, "goal completion lock missing");
assert(receipt.teacherDecision === "needs_teacher_review", "receipt default must wait");
assert(receipt.forbiddenTeacherDecisions.includes("claim_complete"), "claim complete must be forbidden");
assert(receipt.forbiddenTeacherDecisions.includes("read_logs_now"), "read logs must be forbidden");
assert(receipt.forbiddenTeacherDecisions.includes("execute_target_software"), "execute must be forbidden");

const blockedGatePath = join(root, "blocked-completion-gate.json");
writeJson(blockedGatePath, {
  ...readJson(completionGatePath),
  logSourceDiscoveryReadyForCoverage: false
});
const blockedResult = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-low-token-coverage-final-review-pack.mjs"),
  "--completion-gate",
  blockedGatePath,
  "--waiting-row-cockpit",
  cockpitPath,
  "--output-dir",
  join(root, "blocked-review-pack")
]);
const blockedPack = readJson(blockedResult.packPath);
assert(blockedPack.status === "blocked_waiting_for_valid_low_token_coverage_review_inputs", "blocked inputs should block");
assert(blockedPack.blockers.includes("log_source_discovery_not_ready_for_coverage"), "missing log source blocker");
assert(blockedPack.locks.goalComplete === false, "blocked pack must not complete");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_low_token_coverage_final_review_pack_smoke_v1",
      pack: result.packPath,
      receiptTemplate: result.receiptTemplatePath,
      blockedPack: blockedResult.packPath,
      cockpitSummary: pack.cockpitSummary,
      locks: pack.locks
    },
    null,
    2
  )
);
