#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const root = process.cwd();
const smokeRoot = join(root, ".transparent-apprentice", "smoke", "original-goal-next-confirmation-pack", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

const statusDir = join(smokeRoot, "status");
mkdirSync(statusDir, { recursive: true });
const compactDir = join(smokeRoot, "compact");
mkdirSync(compactDir, { recursive: true });
const manualDir = join(smokeRoot, "manual");
mkdirSync(manualDir, { recursive: true });
const actionDir = join(smokeRoot, "action");
mkdirSync(actionDir, { recursive: true });

const compactHtml = join(compactDir, "original-goal-low-token-compact-evidence-request-pack.html");
const compactPack = join(compactDir, "original-goal-low-token-compact-evidence-request-pack.json");
const compactReceipt = join(compactDir, "teacher-low-token-compact-evidence-request-receipt-template.json");
const compactValidate = join(compactDir, "validate-low-token-compact-evidence-request-receipt.command.txt");
const compactRun = join(compactDir, "run-confirmed-low-token-compact-evidence-collection.command.txt");
writeFileSync(compactHtml, "<html>compact</html>", "utf8");
writeFileSync(compactPack, JSON.stringify({ format: "transparent_ai_original_goal_low_token_compact_evidence_request_pack_v1", status: "waiting_for_teacher_compact_evidence_request_review", counts: { eligibleRows: 10, blockedRows: 3 }, locks: { reviewOnly: true } }, null, 2), "utf8");
writeFileSync(compactReceipt, JSON.stringify({ format: "receipt" }, null, 2), "utf8");
writeFileSync(compactValidate, "node validate-compact --receipt <teacher-filled-receipt.json>", "utf8");
writeFileSync(compactRun, "node run-compact --confirmed true", "utf8");

const manualHtml = join(manualDir, "low-token-fallback-route-manual-review-pack.html");
const manualPack = join(manualDir, "low-token-fallback-route-manual-review-pack.json");
const manualTemplate = join(manualDir, "teacher-manual-route-review-patch-template.json");
writeFileSync(manualHtml, "<html>manual</html>", "utf8");
writeFileSync(manualPack, JSON.stringify({ rows: [{ rowId: "low-token-waiting-011", software: "WeChat", recommendedRoute: "privacy_sensitive_chat_state_metadata" }] }, null, 2), "utf8");
writeFileSync(manualTemplate, JSON.stringify({ format: "transparent_ai_low_token_fallback_route_manual_review_patch_v1" }, null, 2), "utf8");

const actionPackage = join(actionDir, "all-software-action-logic-source-contract-package.json");
const actionHtml = join(actionDir, "all-software-action-logic-source-contract-package.html");
const actionReceipt = join(actionDir, "teacher-action-logic-source-contract-receipt-template.json");
writeFileSync(actionHtml, "<html>action</html>", "utf8");
writeFileSync(actionReceipt, JSON.stringify({ format: "action-receipt" }, null, 2), "utf8");
writeFileSync(actionPackage, JSON.stringify({ status: "waiting_for_teacher_action_logic_source_review", counts: { totalRows: 4, rowsNeedingTeacherLogic: 4 }, nextValidationCommand: "node validate-action --receipt <teacher-filled-receipt.json>" }, null, 2), "utf8");

const teacherActionShortlist = join(statusDir, "original-goal-teacher-action-shortlist.json");
const teacherActionReceipt = join(statusDir, "original-goal-teacher-action-shortlist-router-receipt-template.json");
writeFileSync(teacherActionShortlist, JSON.stringify({ actions: [{ id: "status_lane_operational_learning", title: "registered recurring monitor evidence is missing" }] }, null, 2), "utf8");
writeFileSync(teacherActionReceipt, JSON.stringify({ format: "router-receipt" }, null, 2), "utf8");

const statusRefresh = join(statusDir, "original-goal-current-status-refresh.json");
writeFileSync(
  statusRefresh,
  JSON.stringify(
    {
      format: "transparent_ai_original_goal_current_status_refresh_v1",
      goal: "Make all software learn with low-token evidence and transparent sketch confirmation.",
      refreshedEvidence: {
        originalGoalLowTokenCoverageLedgerRows: 211,
        originalGoalLowTokenCoverageWaitingRows: 13,
        originalGoalLowTokenFallbackRouteShortlistBatchReviewMetadataOnlyRows: 10,
        originalGoalLowTokenFallbackRouteShortlistBatchReviewRowsStillNeedingOneByOneReview: 3,
        originalGoalLowTokenCompactEvidenceRequestPackEligibleRows: 10,
        originalGoalLowTokenCompactEvidenceRequestPackBlockedRows: 3,
        originalGoalLowTokenCompactEvidenceRequestPackStatus: "waiting_for_teacher_compact_evidence_request_review",
        originalGoalLowTokenCompactEvidenceRunReady: false,
        originalGoalLowTokenCompactEvidenceLearningHandoffReady: false,
        transparentSketchDepthDemonstrationRehearsalReady: true,
        transparentSketch2DPerspective3DImplemented: true,
        formalSpatialIntentEvidencePresent: true,
        spatialIntentEvidenceReceiptValidationStatus: "blocked"
      },
      paths: {
        currentStatusDashboardHtml: join(statusDir, "dashboard.html"),
        originalGoalLowTokenCompactEvidenceRequestPackHtml: compactHtml,
        originalGoalLowTokenFallbackRouteManualReviewPackHtml: manualHtml,
        spatialIntentEvidenceRequestHtml: join(statusDir, "spatial-intent-evidence-request.html"),
        spatialIntentEvidenceReceiptTemplate: join(statusDir, "spatial-intent-evidence-receipt-template.json"),
        spatialIntentEvidenceReceiptValidationCommandTemplate: "node validate-spatial --receipt <teacher-filled-receipt.json>",
        actionLogicSourceContractPackage: actionPackage,
        actionLogicSourceContractPackageHtml: actionHtml,
        actionLogicSourceContractReceiptTemplate: actionReceipt,
        teacherActionShortlist,
        teacherActionShortlistRouterReceiptTemplate: teacherActionReceipt,
        teacherActionShortlistRouterReceiptValidationCommandTemplate: "node validate-router --receipt <teacher-filled-receipt.json>"
      }
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(join(statusDir, "dashboard.html"), "<html>dashboard</html>", "utf8");
writeFileSync(join(statusDir, "spatial-intent-evidence-request.html"), "<html>spatial</html>", "utf8");
writeFileSync(join(statusDir, "spatial-intent-evidence-receipt-template.json"), JSON.stringify({ format: "spatial-receipt" }, null, 2), "utf8");

const result = spawnSync(
  process.execPath,
  [
    "plugins/transparent-ai-apprentice/scripts/create-original-goal-next-confirmation-pack.mjs",
    "--status-refresh",
    statusRefresh,
    "--output-dir",
    join(smokeRoot, "out")
  ],
  { cwd: root, encoding: "utf8" }
);
if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(result.status || 1);
}

const pack = JSON.parse(result.stdout);
assert(pack.format === "transparent_ai_original_goal_next_confirmation_pack_v1", "pack format mismatch");
assert(pack.status === "waiting_for_teacher_next_confirmation_review", "pack must wait for teacher review");
assert(pack.confirmationItems.length === 5, "expected five confirmation items");
assert(pack.counts.compactMetadataRows === 10, "compact metadata row count missing");
assert(pack.counts.sensitiveManualRows === 3, "manual sensitive row count missing");
assert(pack.statusSnapshot.transparentSketch2DPerspective3DImplemented === true, "transparent sketch implementation evidence missing");
assert(pack.statusSnapshot.compactEvidenceRunReady === false, "compact evidence run must remain unready");
assert(pack.locks.confirmationPackDoesNotReadFullLogs === true, "full log read lock missing");
assert(pack.locks.confirmationPackDoesNotCaptureScreenshots === true, "screenshot lock missing");
assert(pack.locks.confirmationPackDoesNotExecuteTargetSoftware === true, "target execution lock missing");
assert(pack.locks.confirmationPackDoesNotRegisterSchedule === true, "schedule registration lock missing");
assert(pack.locks.confirmationPackDoesNotWriteMemory === true, "memory lock missing");
assert(pack.locks.goalComplete === false, "goal must not be complete");
assert(existsSync(pack.paths.html), "html path missing");
assert(existsSync(pack.paths.receiptTemplate), "receipt template path missing");
const receipt = readJson(pack.paths.receiptTemplate);
assert(receipt.decision === "needs_teacher_review", "default receipt decision must need teacher review");
assert(receipt.itemDecisions.every((item) => item.teacherDecision === "needs_teacher_review"), "item defaults must need teacher review");

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_original_goal_next_confirmation_pack_smoke_v1",
      pack: pack.paths.pack,
      html: pack.paths.html,
      confirmationItems: pack.confirmationItems.length,
      locks: pack.locks
    },
    null,
    2
  )
);
