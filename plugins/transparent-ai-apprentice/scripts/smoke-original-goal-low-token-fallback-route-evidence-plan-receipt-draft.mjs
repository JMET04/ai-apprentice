#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "original-goal-low-token-fallback-route-evidence-plan-receipt-draft");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runScript(script, args, { expectFailure = false } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    const parsed = JSON.parse(stdout);
    if (expectFailure) throw new Error(`Expected ${script} to fail`);
    return parsed;
  } catch (error) {
    if (!expectFailure) throw error;
    const stdout = error.stdout ? String(error.stdout) : "";
    return JSON.parse(stdout);
  }
}

function basePlan() {
  return {
    ok: true,
    format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1",
    planId: "smoke-fallback-route-to-plan-receipt",
    status: "blocked_waiting_rows_need_reviewed_low_token_evidence",
    sourceEvidence: {
      cockpit: join(smokeRoot, "waiting-row-cockpit.json")
    },
    counts: {
      blockedRows: 2,
      rowsNeedingLogSourceRoute: 2,
      rowsNeedingCompactWatchEvidence: 1,
      rowsNeedingTeacherReview: 2
    },
    actionRows: [
      {
        rowId: "low-token-waiting-001",
        ledgerNumber: 1,
        software: "ExampleNoLogUtility",
        missingEvidenceKinds: ["log_source_route_or_reviewed_fallback", "teacher_review_receipt"]
      },
      {
        rowId: "low-token-waiting-002",
        ledgerNumber: 2,
        software: "ExampleNeedsCompactWatch",
        missingEvidenceKinds: [
          "log_source_route_or_reviewed_fallback",
          "compact_watch_or_learning_evidence",
          "teacher_review_receipt"
        ]
      }
    ],
    locks: {
      reviewOnly: true,
      planDoesNotReadLogs: true,
      planDoesNotRunMetadataGate: true,
      planDoesNotExecuteTargetSoftware: true,
      goalComplete: false
    }
  };
}

function basePack() {
  return {
    ok: true,
    format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1",
    packId: "smoke-fallback-route-pack",
    sourceEvidence: {
      blockedWaitingRowEvidencePlan: join(smokeRoot, "blocked-waiting-row-evidence-plan.json")
    },
    rows: [
      {
        rowId: "low-token-waiting-001",
        ledgerNumber: 1,
        software: "ExampleNoLogUtility",
        category: "generic_desktop_app",
        candidateRoutes: [{ routeId: "process_window_metadata", routeKind: "metadata" }]
      },
      {
        rowId: "low-token-waiting-002",
        ledgerNumber: 2,
        software: "ExampleNeedsCompactWatch",
        category: "generic_desktop_app",
        candidateRoutes: [{ routeId: "config_state_file_metadata", routeKind: "metadata" }]
      }
    ],
    locks: {
      reviewOnly: true,
      packDoesNotReadLogs: true,
      packDoesNotCaptureScreenshots: true,
      packDoesNotExecuteTargetSoftware: true,
      packDoesNotClaimAllSoftwareCoverage: true,
      goalComplete: false
    }
  };
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });
const planPath = join(smokeRoot, "blocked-waiting-row-evidence-plan.json");
const packPath = join(smokeRoot, "fallback-route-pack.json");
writeJson(planPath, basePlan());
writeJson(packPath, basePack());

const routeBuilder = runScript("create-original-goal-low-token-fallback-route-evidence-pack-receipt-builder.mjs", [
  "--pack",
  packPath,
  "--out-dir",
  join(smokeRoot, "route-builder")
]);
const routeReceipt = readJson(routeBuilder.receiptTemplatePath);
routeReceipt.templateOnly = false;
routeReceipt.teacherDecision = "routes_selected_for_follow_up";
routeReceipt.blockedShortcutsReviewed = true;
routeReceipt.noFullLogReadConfirmed = true;
routeReceipt.noScreenshotConfirmed = true;
routeReceipt.noSoftwareExecutionConfirmed = true;
routeReceipt.noMemoryWriteConfirmed = true;
routeReceipt.receiptRows = routeReceipt.receiptRows.map((row, index) => ({
  ...row,
  teacherDecision: "select_candidate_route",
  selectedRouteId: index === 0 ? "process_window_metadata" : "config_state_file_metadata",
  routeEvidenceReviewed: true,
  privacyBoundaryReviewed: true,
  noContentReadConfirmed: true,
  routeSelectionNote: "Teacher reviewed metadata-only fallback route.",
  reviewedEvidencePathOrSignal: join(smokeRoot, `route-evidence-${index + 1}.json`)
}));
const routeReceiptPath = join(smokeRoot, "teacher-route-receipt.json");
writeJson(routeReceiptPath, routeReceipt);
const routeValidation = runScript("validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs", [
  "--pack",
  packPath,
  "--receipt",
  routeReceiptPath,
  "--out-dir",
  join(smokeRoot, "route-validation")
]);

const draftResult = runScript("create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs", [
  "--validation",
  routeValidation.validationPath,
  "--plan",
  planPath,
  "--out-dir",
  join(smokeRoot, "draft")
]);
const draftPacket = readJson(draftResult.packetPath);
const draftReceipt = readJson(draftResult.draftReceiptPath);

const draftValidation = runScript(
  "validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs",
  ["--plan", planPath, "--receipt", draftResult.draftReceiptPath, "--out-dir", join(smokeRoot, "draft-validation")],
  { expectFailure: true }
);

const completedReceipt = {
  ...draftReceipt,
  draftOnly: false,
  teacherDecision: "evidence_collected_return_to_cockpit_review",
  rollbackRetained: true,
  receiptRows: draftReceipt.receiptRows.map((row) => ({
    ...row,
    teacherDecision: "evidence_collected_return_to_cockpit_review",
    compactWatchEvidenceReviewed: true,
    teacherReviewCompleted: true,
    compactEvidenceSummary: row.compactEvidenceSummary || "Teacher reviewed compact low-token watch evidence after route selection.",
    reviewedEvidencePathOrSignal: row.reviewedEvidencePathOrSignal || join(smokeRoot, `${row.rowId}-reviewed.json`)
  }))
};
const completedReceiptPath = join(smokeRoot, "completed-evidence-plan-receipt.json");
writeJson(completedReceiptPath, completedReceipt);
const completedValidation = runScript("validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs", [
  "--plan",
  planPath,
  "--receipt",
  completedReceiptPath,
  "--out-dir",
  join(smokeRoot, "completed-validation")
]);

const checks = [
  {
    name: "Draft copies teacher-selected fallback routes into evidence-plan receipt shape",
    pass:
      draftResult.format ===
        "transparent_ai_original_goal_low_token_fallback_route_evidence_plan_receipt_draft_result_v1" &&
      draftPacket.format === "transparent_ai_original_goal_low_token_fallback_route_evidence_plan_receipt_draft_v1" &&
      draftReceipt.format === "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1" &&
      draftPacket.counts.copiedRouteRows === 2 &&
      draftReceipt.receiptRows[0].logSourceOrFallbackReviewed === true &&
      draftReceipt.receiptRows[0].teacherDecision === "evidence_collected_return_to_cockpit_review" &&
      existsSync(draftResult.htmlPath)
  },
  {
    name: "Draft does not fabricate compact watch evidence or rollback",
    pass:
      draftPacket.status === "draft_ready_needs_compact_evidence_and_teacher_review" &&
      draftPacket.counts.compactEvidenceStillNeeded === 1 &&
      draftReceipt.rollbackRetained === false &&
      draftReceipt.receiptRows[1].compactWatchEvidenceReviewed === false &&
      draftValidation.ok === false &&
      draftValidation.status !== "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit"
  },
  {
    name: "Completed teacher-reviewed draft can pass downstream evidence-plan validation",
    pass:
      completedValidation.ok === true &&
      completedValidation.status === "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit" &&
      completedValidation.counts.readyRows === 2 &&
      completedValidation.nextSafeCommand.executeNow === false &&
      completedValidation.locks.validationDoesNotReadLogs === true &&
      completedValidation.locks.validationDoesNotExecuteTargetSoftware === true
  },
  {
    name: "Draft generator keeps side effects and completion locked",
    pass:
      draftResult.locks.draftDoesNotReadLogs === true &&
      draftResult.locks.draftDoesNotCaptureScreenshots === true &&
      draftResult.locks.draftDoesNotExecuteTargetSoftware === true &&
      draftResult.locks.selectedRouteIsNotCoverage === true &&
      draftResult.goalComplete === false
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_plan_receipt_draft_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot,
  checks,
  artifacts: {
    routeValidation: routeValidation.validationPath,
    draft: draftResult.packetPath,
    draftReceipt: draftResult.draftReceiptPath,
    completedValidation: completedValidation.validationPath
  }
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
