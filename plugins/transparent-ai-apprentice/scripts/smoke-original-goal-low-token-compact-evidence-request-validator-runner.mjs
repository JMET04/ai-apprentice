#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function run(args, { expectFailure = false } = {}) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (!expectFailure && result.status !== 0) {
    throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  if (expectFailure && result.status === 0) {
    throw new Error(`command unexpectedly passed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-compact-evidence-validator-runner-"));
const requestPackPath = join(root, "request-pack.json");
const defaultReceiptPath = join(root, "default-receipt.json");
const confirmedReceiptPath = join(root, "confirmed-receipt.json");
const fixturePath = join(root, "metadata-fixture.json");
const rollbackDir = join(root, "rollback-point");
const invalidRollbackDir = join(root, "invalid-rollback-point");
mkdirSync(rollbackDir, { recursive: true });
mkdirSync(invalidRollbackDir, { recursive: true });
writeJson(join(rollbackDir, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_v1",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

writeJson(requestPackPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1",
  packId: "smoke-compact-evidence-request-pack",
  status: "waiting_for_teacher_compact_evidence_request_review",
  counts: { sourceRows: 3, eligibleRows: 2, blockedRows: 1 },
  requestRows: [
    {
      rowId: "row-event",
      ledgerNumber: 1,
      software: "EventApp",
      routeId: "windows_event_metadata",
      routeKind: "windows_event_log_metadata",
      evidenceMode: "windows_event_metadata_only",
      compactFields: ["provider", "event id histogram"],
      forbiddenFields: ["full event message body"],
      readyForTeacherConfirmedCompactEvidenceRequest: true
    },
    {
      rowId: "row-process",
      ledgerNumber: 2,
      software: "ProcessApp",
      routeId: "process_window_metadata",
      routeKind: "process_and_window_state_metadata",
      evidenceMode: "process_window_metadata_only",
      compactFields: ["process name", "window title"],
      forbiddenFields: ["screen capture"],
      readyForTeacherConfirmedCompactEvidenceRequest: true
    },
    {
      rowId: "row-blocked",
      ledgerNumber: 3,
      software: "BlockedApp",
      routeId: "teacher_marker",
      routeKind: "manual",
      evidenceMode: "manual_teacher_marker_or_generic_metadata",
      compactFields: ["teacher marker"],
      forbiddenFields: ["private content"],
      readyForTeacherConfirmedCompactEvidenceRequest: false
    }
  ],
  locks: { requestDoesNotReadLogs: true, goalComplete: false }
});

writeJson(defaultReceiptPath, {
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_v1",
  sourceRequestPackPath: requestPackPath,
  teacherDecision: "needs_teacher_review",
  rollbackRetained: false,
  noFullLogReadConfirmed: true,
  noScreenshotConfirmed: true,
  noSoftwareExecutionConfirmed: true,
  requestRows: [
    { rowId: "row-event", teacherDecision: "needs_teacher_review", reviewedCompactEvidenceRequest: false, compactEvidenceCollected: false },
    { rowId: "row-process", teacherDecision: "needs_teacher_review", reviewedCompactEvidenceRequest: false, compactEvidenceCollected: false },
    { rowId: "row-blocked", teacherDecision: "needs_teacher_review", reviewedCompactEvidenceRequest: false, compactEvidenceCollected: false }
  ]
});

writeJson(confirmedReceiptPath, {
  format: "transparent_ai_original_goal_low_token_compact_evidence_request_receipt_v1",
  sourceRequestPackPath: requestPackPath,
  teacherDecision: "compact_metadata_request_confirmed",
  rollbackRetained: true,
  noFullLogReadConfirmed: true,
  noScreenshotConfirmed: true,
  noSoftwareExecutionConfirmed: true,
  requestRows: [
    {
      rowId: "row-event",
      software: "EventApp",
      teacherDecision: "compact_metadata_request_confirmed",
      reviewedCompactEvidenceRequest: true,
      compactEvidenceCollected: false,
      teacherNote: "confirmed metadata-only event histogram"
    },
    {
      rowId: "row-process",
      software: "ProcessApp",
      teacherDecision: "compact_metadata_request_confirmed",
      reviewedCompactEvidenceRequest: true,
      compactEvidenceCollected: false,
      teacherNote: "confirmed metadata-only process state"
    },
    {
      rowId: "row-blocked",
      software: "BlockedApp",
      teacherDecision: "teacher_excluded_from_monitoring",
      reviewedCompactEvidenceRequest: true,
      compactEvidenceCollected: false,
      teacherNote: "exclude this row"
    }
  ]
});

writeJson(fixturePath, {
  format: "transparent_ai_compact_metadata_fixture_v1",
  rows: [
    {
      rowId: "row-event",
      compactEvidence: {
        providerCount: 2,
        eventIdHistogram: [{ eventId: 1000, count: 1 }],
        messageBodiesRead: false
      }
    },
    {
      rowId: "row-process",
      compactEvidence: {
        processCount: 1,
        windowTitleHash: "abc123",
        screenshotsCaptured: false
      }
    }
  ]
});

const defaultValidation = run(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-compact-evidence-request-receipt.mjs",
    "--request-pack",
    requestPackPath,
    "--receipt",
    defaultReceiptPath,
    "--output-dir",
    join(root, "default-validation")
  ],
  { expectFailure: true }
);
const defaultValidationFile = readJson(defaultValidation.validationPath);

const confirmedValidation = run([
  "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-compact-evidence-request-receipt.mjs",
  "--request-pack",
  requestPackPath,
  "--receipt",
  confirmedReceiptPath,
  "--output-dir",
  join(root, "confirmed-validation")
]);
const confirmedValidationFile = readJson(confirmedValidation.validationPath);

const blockedRun = run(
  [
    "plugins/transparent-ai-apprentice/scripts/run-original-goal-low-token-compact-evidence-request.mjs",
    "--validation",
    confirmedValidation.validationPath,
    "--output-dir",
    join(root, "blocked-run")
  ],
  { expectFailure: true }
);
const invalidRollbackRun = run(
  [
    "plugins/transparent-ai-apprentice/scripts/run-original-goal-low-token-compact-evidence-request.mjs",
    "--validation",
    confirmedValidation.validationPath,
    "--run-confirmed-metadata-only",
    "--allow-compact-evidence-runner",
    "--teacher-confirmation",
    "teacher confirmed compact metadata request",
    "--rollback-point",
    invalidRollbackDir,
    "--metadata-fixture",
    fixturePath,
    "--output-dir",
    join(root, "invalid-rollback-run")
  ],
  { expectFailure: true }
);
const successRun = run([
  "plugins/transparent-ai-apprentice/scripts/run-original-goal-low-token-compact-evidence-request.mjs",
  "--validation",
  confirmedValidation.validationPath,
  "--run-confirmed-metadata-only",
  "--allow-compact-evidence-runner",
  "--teacher-confirmation",
  "teacher confirmed compact metadata request",
  "--rollback-point",
  rollbackDir,
  "--metadata-fixture",
  fixturePath,
  "--output-dir",
  join(root, "success-run")
]);
const successRunFile = readJson(successRun.runPath);

const checks = [
  {
    name: "Default receipt fails closed",
    pass:
      defaultValidation.ok === false &&
      defaultValidationFile.status === "blocked_for_invalid_or_forbidden_compact_evidence_request_receipt" &&
      defaultValidationFile.blockers.includes("rollback_not_retained")
  },
  {
    name: "Confirmed receipt validates only eligible rows",
    pass:
      confirmedValidation.ok === true &&
      confirmedValidationFile.status === "validated_with_prepared_compact_metadata_collection_command" &&
      confirmedValidationFile.counts.readyRows === 2 &&
      confirmedValidationFile.counts.invalidRows === 0 &&
      confirmedValidationFile.nextPreparedCommand.commandLine.includes("run-original-goal-low-token-compact-evidence-request.mjs")
  },
  {
    name: "Runner blocks without explicit flags",
    pass: blockedRun.ok === false && blockedRun.blockedReason === "runner_requires_explicit_run_flags"
  },
  {
    name: "Runner rejects rollback paths without a retained rollback manifest",
    pass:
      invalidRollbackRun.ok === false &&
      invalidRollbackRun.blockedReason === "runner_requires_retained_rollback_point_manifest"
  },
  {
    name: "Runner collects fixture metadata only and keeps locks closed",
    pass:
      successRun.ok === true &&
      successRunFile.counts.evidenceRows === 2 &&
      successRunFile.counts.fixtureRowsUsed === 2 &&
      successRunFile.rollbackPointManifest.endsWith("rollback-point.json") &&
      successRunFile.rollbackPointContract.format === "transparent_ai_rollback_point_v1" &&
      successRunFile.rollbackPointContract.status === "waiting_for_teacher_confirmation" &&
      successRunFile.rollbackPointContract.deleteOnlyAfterTeacherConfirmation === true &&
      successRunFile.evidenceRows.every((row) => row.contentBoundary.fullLogsRead === false && row.contentBoundary.screenshotsCaptured === false) &&
      successRunFile.locks.logContentsRead === false &&
      successRunFile.locks.targetSoftwareCommandsExecuted === false &&
      successRunFile.goalComplete === false
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_compact_evidence_request_validator_runner_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        defaultValidation: defaultValidation.validationPath,
        confirmedValidation: confirmedValidation.validationPath,
        successRun: successRun.runPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
