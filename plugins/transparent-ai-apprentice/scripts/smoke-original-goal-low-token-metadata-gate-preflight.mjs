#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "original-goal-low-token-metadata-gate-preflight-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], timeout = 120000) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const planPath = join(smokeRoot, "coverage-enrollment-follow-up-plan.json");
const proofPath = join(smokeRoot, "original-goal-low-token-coverage-proof-snapshot.json");
const dossierPath = join(smokeRoot, "original-goal-low-token-coverage-evidence-dossier.json");
writeFileSync(
  planPath,
  `${JSON.stringify(
    {
      format: "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
      planId: "fixture-plan",
      followUpItems: []
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  proofPath,
  `\uFEFF${JSON.stringify(
    {
      format: "transparent_ai_original_goal_low_token_coverage_proof_snapshot_v1",
      dossierId: "fixture-dossier",
      status: "proof_snapshot_ready_for_teacher_review",
      sourceEvidence: {
        coverageEnrollmentFollowUpPlan: planPath,
        coverageEnrollmentFollowUpBatch: join(smokeRoot, "dry-run-batch.json")
      },
      counts: {
        waitingRows: 3,
        proofRows: 3,
        metadataGateReadyRows: 2,
        reviewedBatchRanRows: 0,
        dryRunBlockedRows: 2,
        rowsWithQueueMatch: 2,
        rowsWithAnyLowTokenSignalMetadata: 2
      },
      proofRows: [
        {
          ledgerNumber: 1,
          software: "alpha-app",
          processName: "alpha",
          bucket: "waiting_for_low_token_watch_evidence",
          followUpId: "enrollment-follow-up-001",
          route: "collect_watch_or_queue_item_evidence",
          tool: "watch_log_source_metadata_deltas",
          metadataGateReady: true,
          reviewedBatchRan: false,
          batchStatus: "dry_run_only",
          queuePath: join(smokeRoot, "software-observer-queue.json"),
          queueItemId: "alpha-alpha",
          queueItemMatched: true,
          lowTokenEvidenceKinds: ["log_file_metadata", "process_window_metadata"],
          candidateCounts: { candidateLogFileCount: 1 },
          blockers: ["blocked_until_teacher_review"]
        },
        {
          ledgerNumber: 2,
          software: "beta-app",
          processName: "beta",
          bucket: "waiting_for_low_token_watch_evidence",
          followUpId: "enrollment-follow-up-002",
          route: "collect_watch_or_queue_item_evidence",
          tool: "watch_log_source_metadata_deltas",
          metadataGateReady: true,
          reviewedBatchRan: false,
          batchStatus: "dry_run_only",
          queuePath: join(smokeRoot, "software-observer-queue.json"),
          queueItemId: "beta-beta",
          queueItemMatched: true,
          lowTokenEvidenceKinds: ["windows_event_count_preview"],
          candidateCounts: { windowsEventLogCount: 1 },
          blockers: ["blocked_until_teacher_review"]
        },
        {
          ledgerNumber: 3,
          software: "blocked-app",
          processName: "blocked",
          bucket: "waiting_for_low_token_watch_evidence",
          followUpId: "enrollment-follow-up-003",
          route: "collect_watch_or_queue_item_evidence",
          tool: "watch_log_source_metadata_deltas",
          metadataGateReady: false,
          reviewedBatchRan: false,
          batchStatus: "dry_run_only",
          queuePath: "",
          queueItemId: "",
          queueItemMatched: false,
          lowTokenEvidenceKinds: [],
          candidateCounts: {},
          blockers: ["missing_reviewed_queue_path_for_metadata_gate"]
        }
      ],
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        proofSnapshotDoesNotRunMetadataGate: true,
        proofSnapshotDoesNotReadLogs: true,
        proofSnapshotDoesNotExecuteTargetSoftware: true,
        proofSnapshotDoesNotWriteMemory: true,
        nativeUniversalExecution: false,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeFileSync(
  dossierPath,
  `\uFEFF${JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1",
      dossierId: "fixture-dossier",
      status: "waiting_for_low_token_coverage_evidence",
      sourceEvidence: {
        coverageEnrollmentFollowUpPlan: planPath
      },
      counts: {
        ledgerRows: 4,
        waitingForLowTokenEvidence: 3,
        nextReviewRows: 3
      },
      paths: {
        dossier: dossierPath,
        proofSnapshot: proofPath
      },
      locks: {
        reviewOnly: true,
        accepted: false,
        ruleEnabled: false,
        packagingGated: true,
        dossierDoesNotRunCoverageTools: true,
        dossierDoesNotReadFullLogs: true,
        dossierDoesNotExecuteTargetSoftware: true,
        dossierDoesNotCaptureScreenshots: true,
        dossierDoesNotWriteMemory: true,
        goalComplete: false
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

const result = runNodeScript("create-original-goal-low-token-metadata-gate-preflight.mjs", [
  "--dossier",
  dossierPath,
  "--output-dir",
  join(smokeRoot, "preflight")
]);
const preflight = readJson(result.preflightPath);
const html = readFileSync(result.htmlPath, "utf8");

const checks = [
  {
    name: "Preflight converts proof snapshot rows into teacher-confirmed metadata gate candidates",
    pass:
      preflight.format === "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1" &&
      preflight.counts.proofRows === 3 &&
      preflight.counts.readyMetadataGateRows === 2 &&
      preflight.counts.blockedRows === 1 &&
      preflight.commands.length === 1 &&
      preflight.commands[0].commandLine.includes("run-all-software-coverage-enrollment-follow-up-batch.mjs") &&
      preflight.commands[0].commandLine.includes("--teacher-reviewed") &&
      preflight.commands[0].commandLine.includes("--max-logs-per-item 1"),
    evidence: result.preflightPath
  },
  {
    name: "Preflight does not run metadata gates or read logs",
    pass:
      preflight.locks.preflightDoesNotRunMetadataGate === true &&
      preflight.locks.preflightDoesNotReadLogs === true &&
      preflight.locks.metadataGateRunnerInvoked === false &&
      preflight.locks.screenshotsCaptured === false &&
      preflight.locks.targetSoftwareCommandsExecuted === false &&
      preflight.locks.memoryWritten === false &&
      preflight.locks.goalComplete === false,
    evidence: JSON.stringify(preflight.locks)
  },
  {
    name: "Preflight keeps blocked rows blocked before metadata gate commands",
    pass:
      preflight.rows.some((row) => row.software === "blocked-app" && row.status === "blocked_before_metadata_gate") &&
      preflight.rows
        .filter((row) => row.status === "ready_for_teacher_confirmed_metadata_gate")
        .every((row) => row.nextSafeAction.includes("rollback point")),
    evidence: JSON.stringify(preflight.rows.map((row) => ({ software: row.software, status: row.status })))
  },
  {
    name: "Preflight HTML and README expose review-only teacher route",
    pass:
      html.includes("Original Goal Low-Token Metadata Gate Preflight") &&
      html.includes("review only") &&
      readFileSync(result.readmePath, "utf8").includes("does not run metadata gates"),
    evidence: result.htmlPath
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_low_token_metadata_gate_preflight_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
