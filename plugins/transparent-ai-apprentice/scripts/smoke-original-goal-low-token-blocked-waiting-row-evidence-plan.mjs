#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(tmpdir(), `transparent-ai-blocked-waiting-row-plan-${Date.now()}`);
mkdirSync(smokeRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runPlan(cockpitPath, label) {
  const outputDir = join(smokeRoot, label);
  const stdout = execFileSync(
    "node",
    [
      join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-original-goal-low-token-blocked-waiting-row-evidence-plan.mjs"),
      "--cockpit",
      cockpitPath,
      "--output-dir",
      outputDir
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );
  const result = JSON.parse(stdout);
  return readJson(result.planPath);
}

const cockpit = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  cockpitId: "blocked-waiting-row-smoke",
  status: "waiting_for_teacher_low_token_waiting_row_review",
  reviewRows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: 1,
      software: "ReadyApp",
      reviewStatus: "ready_for_teacher_confirmed_metadata_gate_receipt",
      blockers: [],
      proofSnapshotReview: { blockers: [] },
      logSourceLedgerReview: { present: true },
      coverageContractReview: {
        present: true,
        status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
        missingRequirements: [],
        allowsMetadataGateReview: true
      }
    },
    {
      rowId: "low-token-waiting-002",
      ledgerNumber: 2,
      software: "MissingLogRouteApp",
      reviewStatus: "blocked_needs_more_low_token_evidence",
      blockers: ["log_source_route_not_found_in_ledger"],
      proofSnapshotReview: {
        blockers: ["missing_watch_or_compact_learning_evidence", "blocked_until_teacher_review"]
      },
      logSourceLedgerReview: { present: false },
      coverageContractReview: {
        present: true,
        status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
        missingRequirements: [],
        allowsMetadataGateReview: true
      }
    },
    {
      rowId: "low-token-waiting-003",
      ledgerNumber: 3,
      software: "InheritedFallbackApp",
      reviewStatus: "blocked_needs_more_low_token_evidence",
      blockers: ["metadata_gate_preflight_not_ready"],
      proofSnapshotReview: {
        blockers: ["missing_watch_or_compact_learning_evidence", "blocked_until_teacher_review"]
      },
      logSourceLedgerReview: {
        present: false,
        inheritedFromCoverageProofSnapshot: true,
        inheritedFallbackEvidenceKinds: ["non_log_fallback_signal_metadata"]
      },
      coverageContractReview: {
        present: true,
        status: "coverage_contract_metadata_gate_ready_pending_teacher_review",
        missingRequirements: [],
        allowsMetadataGateReview: true
      }
    }
  ],
  paths: {
    cockpit: join(smokeRoot, "cockpit.json"),
    sourceDossier: join(smokeRoot, "dossier.json"),
    sourceMetadataGatePreflight: join(smokeRoot, "preflight.json"),
    sourceLogSourceDiscoveryLedger: join(smokeRoot, "ledger.json")
  }
};

const noBlockedCockpit = {
  ...cockpit,
  cockpitId: "no-blocked-waiting-row-smoke",
  reviewRows: [cockpit.reviewRows[0]],
  paths: { ...cockpit.paths, cockpit: join(smokeRoot, "no-blocked-cockpit.json") }
};

const cockpitPath = join(smokeRoot, "cockpit.json");
const noBlockedCockpitPath = join(smokeRoot, "no-blocked-cockpit.json");
writeJson(cockpitPath, cockpit);
writeJson(noBlockedCockpitPath, noBlockedCockpit);

const blockedPlan = runPlan(cockpitPath, "blocked");
const noBlockedPlan = runPlan(noBlockedCockpitPath, "no-blocked");
const missingLogSourceRow = blockedPlan.actionRows.find((row) => row.software === "MissingLogRouteApp");
const inheritedFallbackRow = blockedPlan.actionRows.find((row) => row.software === "InheritedFallbackApp");

const assertions = [
  {
    name: "Blocked waiting rows become reviewed low-token evidence acquisition actions",
    pass:
      blockedPlan.format === "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1" &&
      blockedPlan.status === "blocked_waiting_rows_need_reviewed_low_token_evidence" &&
      blockedPlan.counts.blockedRows === 2 &&
      blockedPlan.counts.rowsWithCoverageContractReadyForMetadataGate === 2 &&
      blockedPlan.counts.rowsNeedingLogSourceRoute === 1 &&
      blockedPlan.counts.rowsNeedingCompactWatchEvidence === 2 &&
      missingLogSourceRow?.coverageContractReview.status ===
        "coverage_contract_metadata_gate_ready_pending_teacher_review" &&
      missingLogSourceRow?.lowTokenRouteGap.missingLedgerRouteBlocksReturn === true &&
      missingLogSourceRow?.existingToolsToReuse.includes("create-all-software-log-source-discovery-ledger.mjs") &&
      missingLogSourceRow?.existingToolsToReuse.includes("run-all-software-low-token-learning-cycle.mjs") &&
      blockedPlan.nextReviewHandoff.returnCommandTemplate.includes(
        "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
      )
  },
  {
    name: "Inherited low-token fallback does not reopen a log-source route gap",
    pass:
      inheritedFallbackRow?.lowTokenRouteGap.inheritedFallbackFromCoverageProofSnapshot === true &&
      inheritedFallbackRow?.lowTokenRouteGap.missingLedgerRouteBlocksReturn === false &&
      !inheritedFallbackRow?.missingEvidenceKinds.includes("log_source_route_or_reviewed_fallback") &&
      !inheritedFallbackRow?.existingToolsToReuse.includes("create-all-software-log-source-discovery-ledger.mjs") &&
      inheritedFallbackRow?.existingToolsToReuse.includes("run-all-software-low-token-learning-cycle.mjs")
  },
  {
    name: "Blocked waiting-row evidence plan keeps all no-op locks closed",
    pass:
      blockedPlan.locks.reviewOnly === true &&
      blockedPlan.locks.planDoesNotRunMetadataGate === true &&
      blockedPlan.locks.planDoesNotReadLogs === true &&
      blockedPlan.locks.planDoesNotCaptureScreenshots === true &&
      blockedPlan.locks.planDoesNotExecuteTargetSoftware === true &&
      blockedPlan.locks.planDoesNotWriteMemory === true &&
      blockedPlan.locks.goalComplete === false &&
      blockedPlan.commandTemplates.every((command) => command.includes("<") || command.includes("create-") || command.includes("run-"))
  },
  {
    name: "No-blocked waiting-row cockpit produces an empty review-only plan",
    pass:
      noBlockedPlan.status === "no_blocked_waiting_rows_waiting_for_cockpit_receipt_review" &&
      noBlockedPlan.counts.blockedRows === 0 &&
      noBlockedPlan.actionRows.length === 0 &&
      noBlockedPlan.locks.goalComplete === false
  }
];

if (process.env.TRANSPARENT_AI_KEEP_SMOKE_TMP !== "1") {
  rmSync(smokeRoot, { recursive: true, force: true });
}

const failed = assertions.filter((assertion) => !assertion.pass);
console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_smoke_v1",
      assertions,
      locks: {
        smokeDoesNotRunMetadataGate: true,
        smokeDoesNotReadLogs: true,
        smokeDoesNotCaptureScreenshots: true,
        smokeDoesNotExecuteTargetSoftware: true,
        smokeDoesNotWriteMemory: true,
        goalComplete: false
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
