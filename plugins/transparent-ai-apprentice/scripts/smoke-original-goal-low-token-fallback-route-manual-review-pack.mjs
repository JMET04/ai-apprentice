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

const root = mkdtempSync(join(tmpdir(), "ta-low-token-manual-review-"));
const packPath = join(root, "pack.json");
const validationPath = join(root, "validation.json");
const outDir = join(root, "out");

writeJson(packPath, {
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_v1",
  rows: [
    {
      rowId: "low-token-waiting-001",
      software: "RemoteTool",
      category: "remote_control_app",
      candidateRoutes: [
        { routeId: "remote_control_security_boundary", evidenceToReview: "manual marker only" },
        { routeId: "teacher_exclusion_or_manual_marker", evidenceToReview: "teacher marker" }
      ]
    },
    {
      rowId: "low-token-waiting-002",
      software: "ChatApp",
      category: "chat_app",
      candidateRoutes: [
        { routeId: "privacy_sensitive_chat_state_metadata", evidenceToReview: "state timestamp only" }
      ]
    }
  ]
});

writeJson(validationPath, {
  format: "transparent_ai_original_goal_low_token_fallback_route_evidence_pack_receipt_validation_v1",
  validationId: "smoke-manual-review",
  status: "fallback_route_receipt_needs_more_teacher_route_review",
  sourceEvidence: { pack: packPath },
  counts: { readyRows: 10 },
  validationRows: [
    {
      rowId: "low-token-waiting-001",
      software: "RemoteTool",
      category: "remote_control_app",
      status: "needs_teacher_review_or_valid_route_selection",
      readyForFollowUp: false
    },
    {
      rowId: "low-token-waiting-002",
      software: "ChatApp",
      category: "chat_app",
      status: "needs_teacher_review_or_valid_route_selection",
      readyForFollowUp: false
    },
    {
      rowId: "low-token-waiting-003",
      software: "ReadyApp",
      category: "generic_desktop_app",
      status: "selected_route_ready_for_low_token_evidence_follow_up",
      readyForFollowUp: true
    }
  ]
});

const result = run([
  "plugins/transparent-ai-apprentice/scripts/create-original-goal-low-token-fallback-route-manual-review-pack.mjs",
  "--validation",
  validationPath,
  "--output-dir",
  outDir
]);
const packet = JSON.parse(readFileSync(result.packetPath, "utf8"));
const patchTemplate = JSON.parse(readFileSync(result.patchPath, "utf8"));
const html = readFileSync(result.htmlPath, "utf8");
const checks = [
  {
    name: "Manual review pack extracts only non-ready rows",
    pass:
      packet.format === "transparent_ai_low_token_fallback_route_manual_review_pack_v1" &&
      packet.counts.validationRows === 3 &&
      packet.counts.readyRows === 10 &&
      packet.counts.manualRows === 2
  },
  {
    name: "Remote-control and chat rows get conservative manual recommendations",
    pass:
      packet.manualRows.find((row) => row.category === "remote_control_app")?.recommendation.safestRouteId ===
        "remote_control_security_boundary" &&
      packet.manualRows.find((row) => row.category === "chat_app")?.recommendation.safestRouteId ===
        "privacy_sensitive_chat_state_metadata"
  },
  {
    name: "Patch template exposes recommendations without choosing for the teacher",
    pass:
      patchTemplate.rows.every((row) => row.teacherDecision === "needs_teacher_review") &&
      patchTemplate.rows.every((row) => row.selectedRouteId === "") &&
      patchTemplate.rows.find((row) => row.category === "remote_control_app")?.recommendedRouteId ===
        "remote_control_security_boundary" &&
      patchTemplate.rows.find((row) => row.category === "chat_app")?.recommendedRouteId ===
        "privacy_sensitive_chat_state_metadata"
  },
  {
    name: "HTML review page can generate teacher patch JSON without direct execution",
    pass:
      html.includes("Build patch JSON") &&
      html.includes("teacher-row") &&
      html.includes("privacy boundary reviewed") &&
      html.includes("no content read confirmed") &&
      html.includes("patchTemplate") &&
      html.includes("does not validate receipts, run metadata probes, read logs, capture screenshots, execute software")
  },
  {
    name: "Manual review pack keeps all side-effect locks closed",
    pass:
      packet.locks.packDoesNotReadLogs === true &&
      packet.locks.packDoesNotExecuteTargetSoftware === true &&
      packet.locks.packDoesNotWriteMemory === true &&
      packet.locks.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      smoke: "transparent_ai_low_token_fallback_route_manual_review_pack_smoke_v1",
      status: failed.length ? "failed" : "passed",
      checks,
      artifacts: {
        packet: result.packetPath,
        html: result.htmlPath,
        readme: result.readmePath,
        patchTemplate: result.patchPath
      }
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
