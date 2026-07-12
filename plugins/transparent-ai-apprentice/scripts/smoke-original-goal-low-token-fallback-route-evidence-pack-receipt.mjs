#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

const root = mkdtempSync(join(tmpdir(), "ta-low-token-fallback-route-receipt-"));
const packPath = join(root, "pack.json");
const builderOutDir = join(root, "builder");
const validationOutDir = join(root, "validation");
const forbiddenOutDir = join(root, "forbidden-validation");
const badRouteOutDir = join(root, "bad-route-validation");
const receiptPath = join(root, "teacher-receipt.json");
const forbiddenReceiptPath = join(root, "forbidden-teacher-receipt.json");
const badRouteReceiptPath = join(root, "bad-route-teacher-receipt.json");

writeJson(packPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1",
  packId: "smoke-fallback-route-pack",
  sourceEvidence: {
    blockedWaitingRowEvidencePlan: join(root, "blocked-waiting-row-evidence-plan.json")
  },
  counts: {
    rows: 2,
    candidateRoutes: 4,
    rowsRequiringTeacherRouteSelection: 2
  },
  rows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: 1,
      software: "WeChat",
      category: "chat_app",
      candidateRoutes: [
        { routeId: "privacy_sensitive_chat_state_metadata", routeKind: "teacher_marker", reviewOnly: true },
        { routeId: "process_window_metadata", routeKind: "metadata", reviewOnly: true }
      ]
    },
    {
      rowId: "low-token-waiting-002",
      ledgerNumber: 2,
      software: "Microsoft ASP.NET Core Shared Framework",
      category: "runtime_framework",
      candidateRoutes: [
        { routeId: "runtime_install_metadata", routeKind: "metadata", reviewOnly: true },
        { routeId: "teacher_exclusion_or_manual_marker", routeKind: "teacher_marker", reviewOnly: true }
      ]
    }
  ],
  teacherReviewContract: {
    selectedRouteIsStillNotCoverage: true,
    blockedDecisions: ["execute_now", "claim_goal_complete"]
  },
  locks: {
    reviewOnly: true,
    packDoesNotReadLogs: true,
    packDoesNotCaptureScreenshots: true,
    packDoesNotExecuteTargetSoftware: true,
    packDoesNotClaimAllSoftwareCoverage: true,
    goalComplete: false
  }
});

const builderResult = run([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-fallback-route-evidence-pack-receipt-builder.mjs",
  "--pack",
  packPath,
  "--output-dir",
  builderOutDir
]);
const builder = JSON.parse(readFileSync(builderResult.builderPath, "utf8"));
const template = JSON.parse(readFileSync(builderResult.receiptTemplatePath, "utf8"));
const builderHtml = readFileSync(builderResult.htmlPath, "utf8");

const validReceipt = {
  ...template,
  templateOnly: false,
  teacherDecision: "routes_selected_for_follow_up",
  blockedShortcutsReviewed: true,
  noFullLogReadConfirmed: true,
  noScreenshotConfirmed: true,
  noSoftwareExecutionConfirmed: true,
  noMemoryWriteConfirmed: true,
  receiptRows: template.receiptRows.map((row, index) => ({
    ...row,
    teacherDecision: "select_candidate_route",
    selectedRouteId: index === 0 ? "privacy_sensitive_chat_state_metadata" : "runtime_install_metadata",
    routeEvidenceReviewed: true,
    privacyBoundaryReviewed: true,
    noContentReadConfirmed: true,
    routeSelectionNote: "Teacher reviewed metadata-only route; no content was read.",
    reviewedEvidencePathOrSignal: `teacher-reviewed-signal-${index + 1}`
  }))
};
writeJson(receiptPath, validReceipt);

const validationResult = run([
  "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs",
  "--pack",
  packPath,
  "--receipt",
  receiptPath,
  "--output-dir",
  validationOutDir
]);
const validation = JSON.parse(readFileSync(validationResult.validationPath, "utf8"));

const forbiddenReceipt = {
  ...validReceipt,
  teacherDecision: "execute_now"
};
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenResult = run(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs",
    "--pack",
    packPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    forbiddenOutDir
  ],
  { expectFailure: true }
);

const badRouteReceipt = {
  ...validReceipt,
  receiptRows: validReceipt.receiptRows.map((row, index) => ({
    ...row,
    selectedRouteId: index === 0 ? "missing-route" : row.selectedRouteId
  }))
};
writeJson(badRouteReceiptPath, badRouteReceipt);
const badRouteResult = run(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs",
    "--pack",
    packPath,
    "--receipt",
    badRouteReceiptPath,
    "--output-dir",
    badRouteOutDir
  ],
  { expectFailure: true }
);

const checks = [
  {
    name: "Receipt builder exposes teacher route selection without side effects",
    pass:
      builder.format === "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_builder_v1" &&
      builder.rowCount === 2 &&
      builder.candidateRouteCount === 4 &&
      builder.interactiveWorkbench === true &&
      builder.nextValidationCommand.includes(
        "validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs"
      ) &&
      builder.locks.builderDoesNotReadLogs === true &&
      builder.locks.builderDoesNotExecuteTargetSoftware === true &&
      builder.locks.routeSelectionIsNotCoverage === true
  },
  {
    name: "Interactive receipt workbench generates teacher-fillable JSON",
    pass:
      builderHtml.includes("Fallback Route Receipt Builder") &&
      builderHtml.includes("Generate Receipt JSON") &&
      builderHtml.includes("Mark All Selected Routes Reviewed") &&
      builderHtml.includes("Copy JSON") &&
      builderHtml.includes("navigator.clipboard.writeText") &&
      builderHtml.includes("routeSelectionIsNotCoverage") &&
      builderHtml.includes("builderDoesNotReadLogs") &&
      builderHtml.includes("builderDoesNotExecuteTargetSoftware")
  },
  {
    name: "Receipt template blocks execution and completion claims",
    pass:
      template.format === "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_v1" &&
      template.blockedTeacherDecisions.includes("execute_now") &&
      template.blockedTeacherDecisions.includes("claim_goal_complete") &&
      template.routeSelectionIsNotCoverage === true
  },
  {
    name: "Validator accepts selected fallback routes only as follow-up evidence",
    pass:
      validation.ok === true &&
      validation.status === "fallback_route_receipt_ready_for_low_token_evidence_plan_follow_up" &&
      validation.nextSafeCommand.commandLine.includes(
        "create-original-goal-low-token-fallback-route-evidence-plan-receipt-draft.mjs"
      ) &&
      validation.locks.validationDoesNotReadLogs === true &&
      validation.locks.validationDoesNotExecuteTargetSoftware === true &&
      validation.locks.routeSelectionIsNotCoverage === true &&
      validation.goalComplete === false
  },
  {
    name: "Validator fail-closes forbidden execution decisions",
    pass:
      forbiddenResult.ok === false &&
      forbiddenResult.status === "blocked_for_invalid_or_forbidden_fallback_route_receipt" &&
      forbiddenResult.blockers.includes("forbidden_top_level_decision")
  },
  {
    name: "Validator blocks selected routes that are not in the pack",
    pass:
      badRouteResult.ok === false &&
      badRouteResult.status !== "fallback_route_receipt_ready_for_low_token_evidence_plan_follow_up"
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        builder: builderResult.builderPath,
        receiptTemplate: builderResult.receiptTemplatePath,
        validation: validationResult.validationPath,
        forbiddenValidation: forbiddenResult.validationPath,
        badRouteValidation: badRouteResult.validationPath
      }
    },
    null,
    2
  )
);

if (failed.length) process.exit(1);
