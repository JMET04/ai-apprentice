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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const root = mkdtempSync(join(tmpdir(), "ta-low-token-fallback-route-shortlist-"));
const packPath = join(root, "pack.json");
const outDir = join(root, "shortlist");
const validationOutDir = join(root, "validation");

writeJson(packPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1",
  packId: "smoke-fallback-route-shortlist-pack",
  status: "waiting_for_teacher_fallback_route_review",
  counts: {
    rows: 4,
    candidateRoutes: 18,
    rowsRequiringTeacherRouteSelection: 4
  },
  rows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: 1,
      software: "WeChat",
      category: "chat_app",
      candidateRoutes: [
        { routeId: "privacy_sensitive_chat_state_metadata", routeKind: "privacy_preserving_state_metadata", tokenPolicy: "metadata_or_teacher_marker_only" },
        { routeId: "process_window_metadata", routeKind: "process_and_window_state_metadata", tokenPolicy: "metadata_only" }
      ]
    },
    {
      rowId: "low-token-waiting-002",
      ledgerNumber: 2,
      software: "Microsoft ASP.NET Core Shared Framework",
      category: "runtime_framework",
      candidateRoutes: [
        { routeId: "runtime_install_metadata", routeKind: "installed_runtime_metadata", tokenPolicy: "metadata_only" },
        { routeId: "teacher_exclusion_or_manual_marker", routeKind: "teacher_policy", tokenPolicy: "zero_token_until_teacher_marker" }
      ]
    },
    {
      rowId: "low-token-waiting-003",
      ledgerNumber: 3,
      software: "RemoteTool",
      category: "remote_control_app",
      candidateRoutes: [
        { routeId: "remote_control_security_boundary", routeKind: "security_sensitive_manual_marker", tokenPolicy: "zero_token_until_teacher_marker" },
        { routeId: "windows_event_metadata", routeKind: "windows_event_log_metadata", tokenPolicy: "metadata_only" }
      ]
    },
    {
      rowId: "low-token-waiting-004",
      ledgerNumber: 4,
      software: "GenericTool",
      category: "generic_desktop_app",
      candidateRoutes: [
        { routeId: "windows_event_metadata", routeKind: "windows_event_log_metadata", tokenPolicy: "metadata_only" },
        { routeId: "process_window_metadata", routeKind: "process_and_window_state_metadata", tokenPolicy: "metadata_only" }
      ]
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
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-fallback-route-shortlist.mjs",
  "--pack",
  packPath,
  "--output-dir",
  outDir
]);
const shortlist = readJson(result.shortlistPath);
const receipt = readJson(result.receiptTemplatePath);
const validation = run(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-fallback-route-evidence-pack-receipt.mjs",
    "--pack",
    packPath,
    "--receipt",
    result.receiptTemplatePath,
    "--output-dir",
    validationOutDir
  ],
  { expectFailure: true }
);
const validationFile = readJson(validation.validationPath);

const byRow = new Map(shortlist.recommendations.map((row) => [row.rowId, row.recommendedRouteId]));
const checks = [
  {
    name: "Shortlist recommends one route per waiting row",
    pass:
      shortlist.format === "transparent_ai_original_goal_low_token_fallback_route_shortlist_v1" &&
      shortlist.counts.rows === 4 &&
      shortlist.counts.recommendedRoutes === 4
  },
  {
    name: "Route recommendations follow conservative category priorities",
    pass:
      byRow.get("low-token-waiting-001") === "privacy_sensitive_chat_state_metadata" &&
      byRow.get("low-token-waiting-002") === "runtime_install_metadata" &&
      byRow.get("low-token-waiting-003") === "remote_control_security_boundary" &&
      byRow.get("low-token-waiting-004") === "windows_event_metadata"
  },
  {
    name: "Receipt template remains unselected and validator keeps it in teacher-review state",
    pass:
      receipt.teacherDecision === "needs_teacher_review" &&
      receipt.receiptRows.every((row) => row.teacherDecision === "needs_teacher_review" && row.selectedRouteId === "") &&
      validationFile.ok === false &&
      validationFile.status === "blocked_for_invalid_or_forbidden_fallback_route_receipt" &&
      validationFile.blockers.includes("blocked_shortcuts_not_reviewed")
  },
  {
    name: "Shortlist keeps all no-op locks closed",
    pass:
      shortlist.locks.shortlistDoesNotReadLogs === true &&
      shortlist.locks.shortlistDoesNotCaptureScreenshots === true &&
      shortlist.locks.shortlistDoesNotExecuteTargetSoftware === true &&
      shortlist.locks.shortlistDoesNotWriteMemory === true &&
      shortlist.locks.routeRecommendationIsNotCoverage === true &&
      shortlist.locks.goalComplete === false
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_original_goal_low_token_fallback_route_shortlist_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        shortlist: result.shortlistPath,
        receiptTemplate: result.receiptTemplatePath,
        validation: validation.validationPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
