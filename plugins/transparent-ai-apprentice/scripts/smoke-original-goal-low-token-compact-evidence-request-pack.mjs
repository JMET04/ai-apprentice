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

const root = mkdtempSync(join(tmpdir(), "ta-low-token-compact-evidence-request-pack-"));
const draftPath = join(root, "partial-draft.json");
const receiptPath = join(root, "fallback-route-receipt.json");
const outDir = join(root, "request-pack");

writeJson(draftPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_plan_receipt_draft_v1",
  draftId: "smoke-partial-route-draft",
  status: "partial_draft_ready_for_ready_fallback_routes_remaining_rows_still_blocked",
  counts: {
    planRows: 3,
    sourceValidationReadyRows: 2,
    sourceValidationInvalidRows: 1,
    copiedRouteRows: 2,
    compactEvidenceStillNeeded: 3
  },
  paths: {
    draftReceipt: receiptPath
  },
  locks: {
    draftDoesNotReadLogs: true,
    draftDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
});

writeJson(receiptPath, {
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1",
  teacherDecision: "needs_teacher_review",
  receiptRows: [
    {
      rowId: "row-ready-event",
      ledgerNumber: 1,
      software: "GenericEventApp",
      teacherDecision: "needs_teacher_review",
      logSourceOrFallbackReviewed: true,
      compactWatchEvidenceReviewed: false,
      sourceRouteOrFallbackSummary:
        "Teacher selected fallback route windows_event_metadata (windows_event_log_metadata) after privacy and evidence review.",
      reviewedEvidencePathOrSignal: "route-validation.json#row-ready-event:windows_event_metadata"
    },
    {
      rowId: "row-ready-runtime",
      ledgerNumber: 2,
      software: "RuntimeApp",
      teacherDecision: "needs_teacher_review",
      logSourceOrFallbackReviewed: true,
      compactWatchEvidenceReviewed: false,
      sourceRouteOrFallbackSummary:
        "Teacher selected fallback route runtime_install_metadata (installed_runtime_metadata) after privacy and evidence review.",
      reviewedEvidencePathOrSignal: "route-validation.json#row-ready-runtime:runtime_install_metadata"
    },
    {
      rowId: "row-blocked",
      ledgerNumber: 3,
      software: "BlockedApp",
      teacherDecision: "needs_teacher_review",
      logSourceOrFallbackReviewed: false,
      compactWatchEvidenceReviewed: false,
      sourceRouteOrFallbackSummary: "",
      reviewedEvidencePathOrSignal: ""
    }
  ],
  locks: {
    goalComplete: false
  }
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-compact-evidence-request-pack.mjs",
  "--partial-draft",
  draftPath,
  "--output-dir",
  outDir
]);
const packet = readJson(result.packPath);
const receipt = readJson(result.defaultReceiptPath);

const readyRows = packet.requestRows.filter((row) => row.readyForTeacherConfirmedCompactEvidenceRequest);
const blockedRows = packet.requestRows.filter((row) => !row.readyForTeacherConfirmedCompactEvidenceRequest);
const checks = [
  {
    name: "Creates request pack from partial fallback route receipt",
    pass:
      result.ok === true &&
      packet.format === "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1" &&
      packet.status === "waiting_for_teacher_compact_evidence_request_review" &&
      packet.counts.sourceRows === 3
  },
  {
    name: "Only reviewed fallback route rows become eligible compact evidence requests",
    pass:
      packet.counts.eligibleRows === 2 &&
      packet.counts.blockedRows === 1 &&
      readyRows.length === 2 &&
      blockedRows.length === 1 &&
      blockedRows[0].blockers.includes("fallback_route_not_reviewed")
  },
  {
    name: "Route kinds map to metadata-only collection plans",
    pass:
      packet.counts.windowsEventMetadataRows === 1 &&
      packet.counts.runtimeInstallMetadataRows === 1 &&
      readyRows.some((row) => row.evidenceMode === "windows_event_metadata_only") &&
      readyRows.some((row) => row.evidenceMode === "runtime_install_metadata_only")
  },
  {
    name: "Default receipt and locks fail closed",
    pass:
      receipt.teacherDecision === "needs_teacher_review" &&
      receipt.rollbackRetained === false &&
      receipt.requestRows.every((row) => row.reviewedCompactEvidenceRequest === false) &&
      packet.locks.requestDoesNotReadLogs === true &&
      packet.locks.requestDoesNotRunWatchCycle === true &&
      packet.locks.requestDoesNotExecuteTargetSoftware === true &&
      packet.locks.requestDoesNotWriteMemory === true &&
      packet.goalComplete === false &&
      packet.executeNow === false
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_compact_evidence_request_pack_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        requestPack: result.packPath,
        defaultReceipt: result.defaultReceiptPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
