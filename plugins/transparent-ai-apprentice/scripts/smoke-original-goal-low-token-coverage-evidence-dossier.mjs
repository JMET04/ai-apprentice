#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "original-goal-low-token-coverage-evidence-dossier-smoke", String(Date.now()));
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
  return path;
}

function hasUtf8Bom(path) {
  const bytes = readFileSync(path);
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function powershellDefaultCanParseJson(path) {
  if (process.platform !== "win32") return true;
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "$p=$env:TRANSPARENT_AI_JSON_PATH; try { Get-Content -LiteralPath $p -Raw | ConvertFrom-Json | Out-Null; 'ok' } catch { Write-Error $_.Exception.Message; exit 1 }"
    ],
    { encoding: "utf8", timeout: 30000, env: { ...process.env, TRANSPARENT_AI_JSON_PATH: path } }
  );
  return result.status === 0;
}

const ledgerPath = join(smokeRoot, "all-software-coverage-enrollment-ledger.json");
const queuePath = join(smokeRoot, "software-observer-queue.json");
const planPath = join(smokeRoot, "follow-up-plan.json");
const batchPath = join(smokeRoot, "follow-up-batch.json");
const refreshPath = join(smokeRoot, "original-goal-current-status-refresh.json");

writeJson(ledgerPath, {
  format: "transparent_ai_all_software_coverage_enrollment_ledger_v1",
  counts: {
    totalInventoryRows: 4,
    ledgerRows: 4,
    enrolledWithWatchEvidence: 1,
    enrolledWaitingForWatchEvidence: 3
  },
  rows: [
    {
      ledgerNumber: 1,
      software: "ReadyApp",
      processName: "ReadyApp",
      status: "enrolled_log_route_with_watch_evidence",
      readyForTeacherCoverageReview: true,
      queueItemPresent: true,
      coverageAuditStatus: "covered_with_log_route_and_watch_evidence",
      candidateLogFileCount: 1,
      candidateLogRootCount: 0,
      windowsEventLogCount: 0,
      nonLogFallbackSignalCount: 0,
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
      candidateLogRootCount: 0,
      windowsEventLogCount: 0,
      nonLogFallbackSignalCount: 0,
      watchEvidenceCount: 0
    },
    {
      ledgerNumber: 3,
      software: "FallbackApp",
      processName: "FallbackApp",
      status: "enrolled_non_log_fallback_waiting_for_watch_evidence",
      readyForTeacherCoverageReview: false,
      queueItemPresent: true,
      coverageAuditStatus: "covered_with_non_log_fallback_route",
      candidateLogFileCount: 0,
      candidateLogRootCount: 1,
      windowsEventLogCount: 1,
      nonLogFallbackSignalCount: 2,
      watchEvidenceCount: 0
    },
    {
      ledgerNumber: 4,
      software: "BrowserFallbackApp",
      processName: "",
      status: "enrolled_non_log_fallback_waiting_for_watch_evidence",
      readyForTeacherCoverageReview: false,
      queueItemPresent: true,
      coverageAuditStatus: "covered_with_non_log_fallback_route",
      candidateLogFileCount: 0,
      candidateLogRootCount: 1,
      windowsEventLogCount: 1,
      nonLogFallbackSignalCount: 2,
      watchEvidenceCount: 0
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false
  }
});

writeJson(queuePath, {
  format: "transparent_ai_software_observer_queue_v1",
  queueId: "fixture-queue",
  queue: [
    {
      queueItemId: "waiting-log-app",
      software: "WaitingLogApp",
      processName: "WaitingLogApp",
      sourceReason: "fixture_log_metadata",
      lowTokenSignals: ["log metadata and mtime"],
      recentLogCandidates: [{ path: "D:\\example\\waiting.log", size: 12, mtimeMs: 123 }]
    },
    {
      queueItemId: "fallback-app",
      software: "FallbackApp",
      processName: "FallbackApp",
      sourceReason: "fixture_non_log_fallback",
      lowTokenSignals: ["Windows Event Log recent count and preview", "file modified-time deltas"],
      nonLogFallbackSignals: [{ sourceType: "windows_event_log", sources: ["Application"] }]
    },
    {
      queueItemId: "browser-fallback-app",
      software: "BrowserFallbackApp",
      processName: "",
      sourceReason: "fixture_non_log_fallback",
      lowTokenSignals: ["file modified-time deltas"],
      nonLogFallbackSignals: [{ sourceType: "file_modified_time_deltas", sources: ["D:\\example"] }]
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

writeJson(planPath, {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
  followUpItems: [
    {
      followUpId: "enrollment-follow-up-001",
      ledgerNumber: 2,
      software: "WaitingLogApp",
      processName: "WaitingLogApp",
      route: "collect_watch_or_queue_item_evidence",
      tool: "watch_log_source_metadata_deltas",
      arguments: { queue: queuePath, item: "waiting-log-app" }
    },
    {
      followUpId: "enrollment-follow-up-002",
      ledgerNumber: 3,
      software: "FallbackApp",
      processName: "FallbackApp",
      route: "collect_watch_or_queue_item_evidence",
      tool: "watch_log_source_metadata_deltas",
      arguments: { queue: queuePath, item: "fallback-app" }
    },
    {
      followUpId: "enrollment-follow-up-003",
      ledgerNumber: 4,
      software: "BrowserFallbackApp",
      processName: "",
      route: "collect_watch_or_queue_item_evidence",
      tool: "watch_log_source_metadata_deltas",
      arguments: { queue: queuePath, item: "browser-fallback-app" }
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

writeJson(batchPath, {
  format: "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1",
  teacherReviewed: false,
  selectedItemCount: 3,
  ranToolCount: 0,
  runResults: [
    {
      followUpId: "enrollment-follow-up-001",
      software: "WaitingLogApp",
      status: "dry_run_only",
      reason: "blocked_until_teacher_review",
      ranTool: false
    },
    {
      followUpId: "enrollment-follow-up-002",
      software: "FallbackApp",
      status: "dry_run_only",
      reason: "blocked_until_teacher_review",
      ranTool: false
    },
    {
      followUpId: "enrollment-follow-up-003",
      software: "BrowserFallbackApp",
      status: "dry_run_only",
      reason: "blocked_until_teacher_review",
      ranTool: false
    }
  ],
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});

writeJson(refreshPath, {
  format: "transparent_ai_original_goal_current_status_refresh_v1",
  goal: "Summarize low-token all-software coverage.",
  paths: {
    coverageEnrollmentLedger: ledgerPath,
    coverageEnrollmentFollowUpPlan: planPath,
    coverageEnrollmentFollowUpBatch: batchPath,
    realLocalAllSoftwareLowTokenReadinessPackage: join(smokeRoot, "readiness.json")
  },
  discoveredEvidence: {},
  refreshedEvidence: {},
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    goalComplete: false
  }
});

const result = runNodeScript("create-original-goal-low-token-coverage-evidence-dossier.mjs", [
  "--status-refresh",
  refreshPath,
  "--output-dir",
  join(smokeRoot, "dossier")
]);
const dossier = readJson(result.dossierPath);
const proofSnapshot = readJson(result.proofSnapshotPath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const checks = [
  {
    name: "Dossier summarizes per-software low-token coverage rows",
    pass:
      dossier.format === "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1" &&
      dossier.counts.ledgerRows === 4 &&
      dossier.counts.readyForTeacherCoverageReview === 1 &&
      dossier.counts.waitingForLowTokenEvidence === 3 &&
      dossier.nextReviewRows.some((row) => row.software === "WaitingLogApp") &&
      dossier.nextReviewRows.some((row) => row.software === "BrowserFallbackApp") &&
      dossier.nextReviewRows.some((row) => row.coverageProofGrade === "metadata_gate_ready") &&
      dossier.nextReviewRows.every((row) => row.coverageContract?.status) &&
      dossier.nextReviewRows.every((row) => Array.isArray(row.coverageContract?.missingRequirements)) &&
      dossier.nextReviewRows.every((row) => row.coverageProofQuestion) &&
      dossier.coverageProofGradeCounts.metadata_gate_ready === 3 &&
      dossier.coverageProofGradeCounts.teacher_review_ready === 1 &&
      dossier.coverageContractStatusCounts.coverage_contract_metadata_gate_ready_pending_teacher_review === 3 &&
      dossier.coverageContractStatusCounts.coverage_contract_satisfied_pending_teacher_receipt === 1 &&
      dossier.counts.coverageContractIncompleteRows === 3 &&
      dossier.coverageContracts.length === 4 &&
      dossier.proofSnapshot.format === "transparent_ai_original_goal_low_token_coverage_proof_snapshot_v1" &&
      existsSync(result.proofSnapshotPath),
    evidence: result.dossierPath
  },
  {
    name: "Dossier assigns per-software proof grades and teacher questions",
    pass:
      dossier.nextReviewRows.every((row) => typeof row.coverageProofGrade === "string") &&
      dossier.nextReviewRows.every((row) => row.coverageProofQuestion.includes("?")) &&
      proofSnapshot.proofRows.every((row) => row.coverageProofGrade === "metadata_gate_ready") &&
      proofSnapshot.proofRows.every(
        (row) => row.coverageContract.status === "coverage_contract_metadata_gate_ready_pending_teacher_review"
      ) &&
      proofSnapshot.coverageContractStatusCounts.coverage_contract_metadata_gate_ready_pending_teacher_review === 3 &&
      proofSnapshot.counts.coverageContractsStillIncomplete === 3 &&
      proofSnapshot.proofRows.every((row) => Array.isArray(row.proofLadder) && row.proofLadder.length === 4) &&
      proofSnapshot.proofRows.every((row) =>
        row.proofLadder.some((step) => step.step === "teacher_coverage_receipt" && step.status === "required_before_any_completion_claim")
      ),
    evidence: JSON.stringify(dossier.coverageProofGradeCounts)
  },
  {
    name: "Dossier proof snapshot explains waiting rows without running metadata gates",
    pass:
      proofSnapshot.counts.waitingRows === 3 &&
      proofSnapshot.counts.metadataGateReadyRows === 3 &&
      proofSnapshot.counts.dryRunBlockedRows === 3 &&
      proofSnapshot.counts.reviewedBatchRanRows === 0 &&
      proofSnapshot.proofRows.every((row) => row.metadataGateReady === true) &&
      proofSnapshot.proofRows.every((row) => row.blockers.includes("blocked_until_teacher_review")) &&
      proofSnapshot.locks.proofSnapshotDoesNotRunMetadataGate === true &&
      proofSnapshot.locks.proofSnapshotDoesNotReadLogs === true,
    evidence: result.proofSnapshotPath
  },
  {
    name: "Dossier JSON is UTF-8 BOM safe for default Windows PowerShell parsing",
    pass: hasUtf8Bom(result.dossierPath) && hasUtf8Bom(result.proofSnapshotPath) && powershellDefaultCanParseJson(result.dossierPath),
    evidence: result.dossierPath
  },
  {
    name: "Dossier keeps all-software completion and native execution unclaimed",
    pass:
      dossier.completionBoundary.allSoftwareCoverageComplete === false &&
      dossier.proofSnapshot.completionBoundary.allSoftwareCoverageComplete === false &&
      dossier.locks.accepted === false &&
      dossier.locks.packagingGated === true &&
      dossier.locks.dossierDoesNotRunCoverageTools === true &&
      dossier.locks.nativeUniversalExecution === false &&
      dossier.locks.goalComplete === false,
    evidence: JSON.stringify(dossier.locks)
  },
  {
    name: "Dossier writes teacher-readable HTML and next commands without running them",
    pass:
      existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      html.includes("Original Goal Low-Token Coverage Evidence Dossier") &&
      html.includes("Proof Snapshot") &&
      html.includes("Coverage proof grades") &&
      html.includes("Coverage contracts") &&
      html.includes("Coverage Contract") &&
      html.includes("Missing Contract Requirements") &&
      html.includes("Proof Grade") &&
      html.includes("Teacher Question") &&
      html.includes("WaitingLogApp") &&
      readme.includes("Coverage proof grade counts") &&
      readme.includes("Coverage contract status counts") &&
      readme.includes("Coverage contract incomplete rows") &&
      readme.includes("It does not run coverage tools") &&
      dossier.nextCommands.coverageEnrollmentFollowUpPlanCommand.includes(
        "create-all-software-coverage-enrollment-follow-up-plan.mjs"
      ) &&
      dossier.nextCommands.coverageEnrollmentFollowUpReceiptValidationCommand.includes(
        "validate-all-software-coverage-enrollment-follow-up-receipt.mjs"
      ),
    evidence: result.htmlPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_low_token_coverage_evidence_dossier_smoke_v1",
      smokeRoot,
      result,
      checks
    },
    null,
    2
  )
);

if (failed.length > 0) process.exit(1);
