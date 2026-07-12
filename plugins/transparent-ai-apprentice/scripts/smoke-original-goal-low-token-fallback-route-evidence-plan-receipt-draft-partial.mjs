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

const root = mkdtempSync(join(tmpdir(), "ta-partial-fallback-route-plan-draft-"));
const planPath = join(root, "plan.json");
const validationPath = join(root, "partial-route-validation.json");

writeJson(planPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1",
  planId: "smoke-partial-fallback-route-plan",
  status: "blocked_waiting_rows_need_reviewed_low_token_evidence",
  sourceEvidence: {
    cockpit: join(root, "cockpit.json")
  },
  counts: {
    blockedRows: 3,
    rowsNeedingLogSourceRoute: 3,
    rowsNeedingCompactWatchEvidence: 3,
    rowsNeedingTeacherReview: 3
  },
  actionRows: [
    {
      rowId: "row-ready-1",
      ledgerNumber: 1,
      software: "ReadyMetadataA",
      missingEvidenceKinds: [
        "log_source_route_or_reviewed_fallback",
        "compact_watch_or_learning_evidence",
        "teacher_review_receipt"
      ]
    },
    {
      rowId: "row-ready-2",
      ledgerNumber: 2,
      software: "ReadyMetadataB",
      missingEvidenceKinds: [
        "log_source_route_or_reviewed_fallback",
        "compact_watch_or_learning_evidence",
        "teacher_review_receipt"
      ]
    },
    {
      rowId: "row-manual",
      ledgerNumber: 3,
      software: "ManualPrivacyRow",
      missingEvidenceKinds: [
        "log_source_route_or_reviewed_fallback",
        "compact_watch_or_learning_evidence",
        "teacher_review_receipt"
      ]
    }
  ]
});

writeJson(validationPath, {
  ok: false,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_validation_v1",
  validationId: "smoke-partial-route-validation",
  status: "fallback_route_receipt_needs_more_teacher_route_review",
  blockers: [],
  counts: {
    readyRows: 2,
    invalidRows: 1
  },
  validationRows: [
    {
      rowId: "row-ready-1",
      ledgerNumber: 1,
      software: "ReadyMetadataA",
      selectedRouteId: "windows_event_metadata",
      selectedRouteKind: "windows_event_log_metadata",
      status: "selected_route_ready_for_low_token_evidence_follow_up",
      readyForFollowUp: true
    },
    {
      rowId: "row-ready-2",
      ledgerNumber: 2,
      software: "ReadyMetadataB",
      selectedRouteId: "process_window_metadata",
      selectedRouteKind: "process_and_window_state_metadata",
      status: "selected_route_ready_for_low_token_evidence_follow_up",
      readyForFollowUp: true
    },
    {
      rowId: "row-manual",
      ledgerNumber: 3,
      software: "ManualPrivacyRow",
      selectedRouteId: "",
      status: "needs_teacher_review_or_valid_route_selection",
      readyForFollowUp: false
    }
  ],
  locks: {
    routeSelectionIsNotCoverage: true,
    validationDoesNotReadLogs: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotExecuteTargetSoftware: true
  }
});

const strictResult = run(
  [
    "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs",
    "--validation",
    validationPath,
    "--plan",
    planPath,
    "--output-dir",
    join(root, "strict-draft")
  ],
  { expectFailure: true }
);
const partialResult = run([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs",
  "--validation",
  validationPath,
  "--plan",
  planPath,
  "--allow-partial-ready",
  "--output-dir",
  join(root, "partial-draft")
]);
const partialPacket = readJson(partialResult.packetPath);
const partialReceipt = readJson(partialResult.draftReceiptPath);

const copiedRows = partialReceipt.receiptRows.filter((row) => row.logSourceOrFallbackReviewed === true);
const manualRow = partialReceipt.receiptRows.find((row) => row.rowId === "row-manual");

const checks = [
  {
    name: "Default strict mode still rejects partial route validation",
    pass:
      strictResult.ok === false &&
      strictResult.status === "blocked_until_fallback_route_receipt_validation_is_ready" &&
      strictResult.blockers.includes("fallback_route_receipt_validation_not_ok")
  },
  {
    name: "Partial mode copies only ready route rows",
    pass:
      partialResult.ok === true &&
      partialPacket.status === "partial_draft_ready_for_ready_fallback_routes_remaining_rows_still_blocked" &&
      partialPacket.counts.sourceValidationReadyRows === 2 &&
      partialPacket.counts.sourceValidationInvalidRows === 1 &&
      partialPacket.counts.partialReadyAllowed === true &&
      partialPacket.counts.copiedRouteRows === 2 &&
      copiedRows.length === 2 &&
      manualRow?.logSourceOrFallbackReviewed === false
  },
  {
    name: "Partial draft keeps remaining evidence and teacher review unresolved",
    pass:
      partialPacket.warnings.includes("partial_ready_rows_still_need_teacher_review") &&
      partialPacket.counts.compactEvidenceStillNeeded === 3 &&
      partialPacket.counts.rowsStillNeedingTeacherReview === 3 &&
      partialReceipt.rollbackRetained === false &&
      partialReceipt.teacherDecision === "needs_teacher_review"
  },
  {
    name: "Partial draft keeps no-op locks closed",
    pass:
      partialResult.locks.draftDoesNotReadLogs === true &&
      partialResult.locks.draftDoesNotCaptureScreenshots === true &&
      partialResult.locks.draftDoesNotExecuteTargetSoftware === true &&
      partialResult.locks.draftDoesNotWriteMemory === true &&
      partialResult.locks.selectedRouteIsNotCoverage === true &&
      partialResult.goalComplete === false
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_fallback_route_evidence_plan_receipt_draft_partial_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        strictDraft: strictResult.packetPath,
        partialDraft: partialResult.packetPath,
        partialReceipt: partialResult.draftReceiptPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
