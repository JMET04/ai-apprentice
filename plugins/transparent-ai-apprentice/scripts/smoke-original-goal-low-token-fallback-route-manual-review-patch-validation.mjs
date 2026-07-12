#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`command failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-low-token-manual-patch-validation-"));
const packPath = join(root, "manual-review-pack.json");
const defaultPatchPath = join(root, "default-patch.json");
const readyPatchPath = join(root, "ready-patch.json");
const outDir = join(root, "out");

const pack = {
  format: "transparent_ai_low_token_fallback_route_manual_review_pack_v1",
  manualRows: [
    {
      rowId: "low-token-waiting-001",
      software: "RemoteTool",
      category: "remote_control_app",
      candidateRoutes: [
        { routeId: "remote_control_security_boundary", evidenceToReview: "manual marker only" },
        { routeId: "teacher_exclusion_or_manual_marker", evidenceToReview: "teacher marker" }
      ],
      recommendation: {
        recommendedDecision: "mark_out_of_scope_or_select_manual_marker",
        safestRouteId: "remote_control_security_boundary"
      }
    },
    {
      rowId: "low-token-waiting-002",
      software: "ChatApp",
      category: "chat_app",
      candidateRoutes: [{ routeId: "privacy_sensitive_chat_state_metadata", evidenceToReview: "state timestamp only" }],
      recommendation: {
        recommendedDecision: "select_privacy_preserving_state_metadata_or_manual_marker",
        safestRouteId: "privacy_sensitive_chat_state_metadata"
      }
    }
  ],
  sourceEvidence: { validation: join(root, "source-validation.json") }
};

const defaultPatch = {
  format: "transparent_ai_low_token_fallback_route_manual_review_patch_v1",
  rows: pack.manualRows.map((row) => ({
    rowId: row.rowId,
    software: row.software,
    category: row.category,
    recommendedRouteId: row.recommendation.safestRouteId,
    teacherDecision: "needs_teacher_review",
    selectedRouteId: "",
    routeEvidenceReviewed: false,
    privacyBoundaryReviewed: false,
    noContentReadConfirmed: false,
    routeSelectionNote: "",
    reviewedEvidencePathOrSignal: ""
  }))
};

const readyPatch = {
  ...defaultPatch,
  rows: defaultPatch.rows.map((row) => ({
    ...row,
    teacherDecision: "select_recommended_route_after_review",
    selectedRouteId: row.recommendedRouteId,
    routeEvidenceReviewed: true,
    privacyBoundaryReviewed: true,
    noContentReadConfirmed: true,
    routeSelectionNote: "Teacher reviewed the route and confirmed no content read."
  }))
};

writeJson(packPath, pack);
writeJson(defaultPatchPath, defaultPatch);
writeJson(readyPatchPath, readyPatch);

const defaultResult = run([
  "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-fallback-route-manual-review-patch.mjs",
  "--pack",
  packPath,
  "--patch",
  defaultPatchPath,
  "--output-dir",
  join(outDir, "default")
]);
const readyResult = run([
  "plugins/transparent-ai-apprentice/scripts/validate-original-goal-low-token-fallback-route-manual-review-patch.mjs",
  "--pack",
  packPath,
  "--patch",
  readyPatchPath,
  "--output-dir",
  join(outDir, "ready")
]);

const defaultPacket = JSON.parse(readFileSync(defaultResult.validationPath, "utf8"));
const readyPacket = JSON.parse(readFileSync(readyResult.validationPath, "utf8"));
const checks = [
  {
    name: "Default template remains blocked until teacher review",
    pass:
      defaultPacket.status === "manual_route_patch_waiting_for_teacher_review_or_corrections" &&
      defaultPacket.counts.readyRows === 0 &&
      defaultPacket.validationRows.every((row) => row.blockers.includes("teacher_decision_still_needs_review"))
  },
  {
    name: "Teacher-reviewed recommended routes validate for locked follow-up",
    pass:
      readyPacket.status === "manual_route_patch_ready_for_locked_follow_up" &&
      readyPacket.counts.readyRows === 2 &&
      readyPacket.validationRows.every((row) => row.readyForFollowUp === true)
  },
  {
    name: "Manual patch validation keeps all side-effect locks closed",
    pass:
      readyPacket.locks.validationDoesNotReadLogs === true &&
      readyPacket.locks.validationDoesNotExecuteTargetSoftware === true &&
      readyPacket.locks.validationDoesNotWriteMemory === true &&
      readyPacket.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_low_token_fallback_route_manual_review_patch_validation_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        defaultValidation: defaultResult.validationPath,
        readyValidation: readyResult.validationPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
