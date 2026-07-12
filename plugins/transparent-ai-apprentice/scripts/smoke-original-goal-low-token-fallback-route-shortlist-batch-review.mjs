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

const root = mkdtempSync(join(tmpdir(), "ta-low-token-fallback-route-batch-review-"));
const packPath = join(root, "pack.json");
const shortlistPath = join(root, "shortlist.json");
const outDir = join(root, "batch-review");

writeJson(packPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1",
  packId: "smoke-fallback-route-batch-review-pack",
  status: "waiting_for_teacher_fallback_route_review",
  counts: {
    rows: 5,
    candidateRoutes: 9,
    rowsRequiringTeacherRouteSelection: 5
  },
  rows: [
    {
      rowId: "row-metadata-1",
      software: "GenericA",
      category: "generic_desktop_app",
      candidateRoutes: [{ routeId: "windows_event_metadata" }]
    },
    {
      rowId: "row-metadata-2",
      software: "RuntimeA",
      category: "runtime_framework",
      candidateRoutes: [{ routeId: "runtime_install_metadata" }]
    },
    {
      rowId: "row-manual",
      software: "RemoteA",
      category: "remote_control_app",
      candidateRoutes: [{ routeId: "remote_control_security_boundary" }]
    },
    {
      rowId: "row-privacy",
      software: "ChatA",
      category: "chat_app",
      candidateRoutes: [{ routeId: "privacy_sensitive_chat_state_metadata" }]
    },
    {
      rowId: "row-other",
      software: "OddA",
      category: "generic_desktop_app",
      candidateRoutes: [{ routeId: "teacher_exclusion_or_manual_marker" }]
    }
  ]
});

writeJson(shortlistPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_shortlist_v1",
  shortlistId: "smoke-fallback-route-shortlist",
  status: "waiting_for_teacher_fallback_route_shortlist_review",
  sourceEvidence: {
    packPath,
    packId: "smoke-fallback-route-batch-review-pack",
    sourceCandidateRoutes: 9
  },
  counts: {
    rows: 5,
    sourceCandidateRoutes: 9,
    recommendedRoutes: 5,
    highRiskManualMarkerRows: 1,
    metadataOnlyRows: 2
  },
  recommendations: [
    {
      priority: 1,
      rowId: "row-metadata-1",
      software: "GenericA",
      category: "generic_desktop_app",
      recommendedRouteId: "windows_event_metadata",
      recommendedRouteKind: "windows_event_log_metadata",
      tokenPolicy: "metadata_only",
      evidenceToReview: "provider/count/newest timestamp only",
      riskBoundary: "metadata_only_low_token",
      recommendedRoute: { routeId: "windows_event_metadata" }
    },
    {
      priority: 2,
      rowId: "row-metadata-2",
      software: "RuntimeA",
      category: "runtime_framework",
      recommendedRouteId: "runtime_install_metadata",
      recommendedRouteKind: "installed_runtime_metadata",
      tokenPolicy: "metadata_only",
      evidenceToReview: "version/path hash/timestamp only",
      riskBoundary: "metadata_only_low_token",
      recommendedRoute: { routeId: "runtime_install_metadata" }
    },
    {
      priority: 3,
      rowId: "row-manual",
      software: "RemoteA",
      category: "remote_control_app",
      recommendedRouteId: "remote_control_security_boundary",
      recommendedRouteKind: "security_sensitive_manual_marker",
      tokenPolicy: "zero_token_until_teacher_marker",
      evidenceToReview: "manual teacher marker",
      riskBoundary: "high_risk_manual_marker_only",
      recommendedRoute: { routeId: "remote_control_security_boundary" }
    },
    {
      priority: 4,
      rowId: "row-privacy",
      software: "ChatA",
      category: "chat_app",
      recommendedRouteId: "privacy_sensitive_chat_state_metadata",
      recommendedRouteKind: "privacy_preserving_state_metadata",
      tokenPolicy: "metadata_or_teacher_marker_only",
      evidenceToReview: "app state metadata, no content",
      riskBoundary: "privacy_sensitive_metadata_or_marker_only",
      recommendedRoute: { routeId: "privacy_sensitive_chat_state_metadata" }
    },
    {
      priority: 5,
      rowId: "row-other",
      software: "OddA",
      category: "generic_desktop_app",
      recommendedRouteId: "teacher_exclusion_or_manual_marker",
      recommendedRouteKind: "teacher_policy",
      tokenPolicy: "zero_token_until_teacher_marker",
      evidenceToReview: "teacher policy marker",
      riskBoundary: "teacher_policy_marker_only",
      recommendedRoute: { routeId: "teacher_exclusion_or_manual_marker" }
    }
  ],
  paths: { sourcePack: packPath },
  locks: { goalComplete: false }
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-fallback-route-shortlist-batch-review.mjs",
  "--shortlist",
  shortlistPath,
  "--output-dir",
  outDir
]);
const reviewPack = readJson(result.reviewPackPath);
const defaultReceipt = readJson(result.defaultReceiptPath);
const batchDraft = readJson(result.batchDraftReceiptPath);
const defaultValidation = run(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs",
    "--pack",
    packPath,
    "--receipt",
    result.defaultReceiptPath,
    "--output-dir",
    join(root, "default-validation")
  ],
  { expectFailure: true }
);
const draftValidation = run(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs",
    "--pack",
    packPath,
    "--receipt",
    result.batchDraftReceiptPath,
    "--output-dir",
    join(root, "draft-validation")
  ],
  { expectFailure: true }
);
const defaultValidationFile = readJson(defaultValidation.validationPath);
const draftValidationFile = readJson(draftValidation.validationPath);

const selectedRows = batchDraft.receiptRows.filter((row) => row.teacherDecision === "select_candidate_route");
const checks = [
  {
    name: "Batch review separates safe metadata rows from manual and privacy rows",
    pass:
      reviewPack.format === "transparent_ai_original_goal_low_token_fallback_route_shortlist_batch_review_v1" &&
      reviewPack.counts.metadataOnlyBatchRows === 2 &&
      reviewPack.counts.manualReviewRows === 2 &&
      reviewPack.counts.privacySensitiveRows === 1 &&
      reviewPack.counts.rowsStillNeedingOneByOneReview === 3
  },
  {
    name: "Default receipt remains unreviewed and fail-closes in existing validator",
    pass:
      defaultReceipt.teacherDecision === "needs_teacher_review" &&
      defaultReceipt.blockedShortcutsReviewed === false &&
      defaultValidationFile.ok === false &&
      defaultValidationFile.status === "blocked_for_invalid_or_forbidden_fallback_route_receipt" &&
      defaultValidationFile.blockers.includes("blocked_shortcuts_not_reviewed")
  },
  {
    name: "Batch draft only pre-fills metadata-only rows and leaves other rows blocked for teacher review",
    pass:
      batchDraft.draftOnly === true &&
      batchDraft.teacherMustConfirm === true &&
      selectedRows.length === 2 &&
      selectedRows.every((row) => ["row-metadata-1", "row-metadata-2"].includes(row.rowId)) &&
      batchDraft.receiptRows
        .filter((row) => !["row-metadata-1", "row-metadata-2"].includes(row.rowId))
        .every((row) => row.teacherDecision === "needs_teacher_review") &&
      draftValidationFile.ok === false &&
      draftValidationFile.counts.readyRows === 2 &&
      draftValidationFile.counts.invalidRows === 3
  },
  {
    name: "Review pack keeps no-op locks closed",
    pass:
      reviewPack.locks.batchReviewDoesNotReadLogs === true &&
      reviewPack.locks.batchReviewDoesNotCaptureScreenshots === true &&
      reviewPack.locks.batchReviewDoesNotExecuteTargetSoftware === true &&
      reviewPack.locks.batchReviewDoesNotWriteMemory === true &&
      reviewPack.locks.routeSelectionIsNotCoverage === true &&
      reviewPack.locks.goalComplete === false &&
      reviewPack.executeNow === false
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_fallback_route_shortlist_batch_review_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        reviewPack: result.reviewPackPath,
        defaultReceipt: result.defaultReceiptPath,
        batchDraftReceipt: result.batchDraftReceiptPath,
        defaultValidation: defaultValidation.validationPath,
        draftValidation: draftValidation.validationPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
