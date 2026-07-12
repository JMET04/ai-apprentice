#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-compact-evidence-learning-handoff-"));
const runPath = join(root, "compact-evidence-run.json");

writeJson(runPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_run_v1",
  runId: "smoke-compact-evidence-run",
  status: "metadata_only_evidence_collected_waiting_for_teacher_review",
  sourceValidationPath: join(root, "validation.json"),
  counts: {
    readyRows: 2,
    evidenceRows: 2,
    fixtureRowsUsed: 2
  },
  evidenceRows: [
    {
      rowId: "row-event",
      ledgerNumber: 1,
      software: "EventApp",
      routeId: "windows_event_metadata",
      evidenceMode: "windows_event_metadata_only",
      status: "metadata_only_evidence_collected_waiting_for_teacher_review",
      collected: {
        source: "metadata_fixture",
        fixtureUsed: true,
        compactEvidence: {
          providerCount: 2,
          eventIdHistogram: [{ eventId: 1000, count: 1 }],
          messageBodiesRead: false
        }
      },
      compactEvidenceHash: "eventhash",
      contentBoundary: {
        logContentsRead: false,
        fullLogsRead: false,
        screenshotsCaptured: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false
      }
    },
    {
      rowId: "row-process",
      ledgerNumber: 2,
      software: "ProcessApp",
      routeId: "process_window_metadata",
      evidenceMode: "process_window_metadata_only",
      status: "metadata_only_evidence_collected_waiting_for_teacher_review",
      collected: {
        source: "metadata_fixture",
        fixtureUsed: true,
        compactEvidence: {
          processCount: 1,
          windowTitleHash: "abc123",
          screenshotsCaptured: false
        }
      },
      compactEvidenceHash: "processhash",
      contentBoundary: {
        logContentsRead: false,
        fullLogsRead: false,
        screenshotsCaptured: false,
        targetSoftwareCommandsExecuted: false,
        memoryWritten: false
      }
    }
  ],
  locks: {
    logContentsRead: false,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    goalComplete: false
  },
  goalComplete: false
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-compact-evidence-learning-handoff.mjs",
  "--run",
  runPath,
  "--output-dir",
  join(root, "handoff")
]);
const handoff = readJson(result.handoffPath);
const observation = readJson(result.observationPath);
const compactPacket = readJson(result.compactLearningEventsPath);
const receipt = readJson(result.reviewReceiptTemplatePath);

const checks = [
  {
    name: "Creates learning handoff from compact evidence run",
    pass:
      result.ok === true &&
      handoff.format === "transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_v1" &&
      handoff.status === "waiting_for_teacher_learning_event_review" &&
      handoff.counts.evidenceRows === 2
  },
  {
    name: "Reuses compact learning event packet format",
    pass:
      compactPacket.format === "transparent_ai_compact_learning_events_from_universal_observation_v1" &&
      compactPacket.status === "waiting_for_teacher_review" &&
      compactPacket.compactLearningEvents.length >= 2
  },
  {
    name: "Observation preserves metadata-only boundaries",
    pass:
      observation.nonLogFallbackSummaries.length === 2 &&
      observation.nonLogFallbackSummaries.every((row) => row.contentBoundary.fullLogsRead === false && row.contentBoundary.screenshotsCaptured === false)
  },
  {
    name: "Review receipt defaults to teacher review and keeps locks closed",
    pass:
      receipt.teacherDecision === "needs_teacher_review" &&
      receipt.rollbackRetained === false &&
      receipt.reviewRows.every((row) => row.reviewedLearningEvent === false) &&
      handoff.locks.handoffDoesNotReadLogs === true &&
      handoff.locks.handoffDoesNotExecuteTargetSoftware === true &&
      handoff.goalComplete === false
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        handoff: result.handoffPath,
        compactLearningEvents: result.compactLearningEventsPath,
        reviewReceipt: result.reviewReceiptTemplatePath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
