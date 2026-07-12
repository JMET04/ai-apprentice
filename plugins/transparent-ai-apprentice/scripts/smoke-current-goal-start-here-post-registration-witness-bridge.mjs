#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = process.cwd();
const root = mkdtempSync(join(tmpdir(), "ta-start-here-witness-bridge-"));

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNodeScript(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
}

const startHereHtml = writeJson(join(root, "start-here-html-placeholder.json"), { placeholder: true });
const witnessHtml = writeJson(join(root, "witness-html-placeholder.json"), { placeholder: true });
const sourceBuilderHtml = writeJson(join(root, "source-builder-html-placeholder.json"), { placeholder: true });
const startHerePath = writeJson(join(root, "current-goal-start-here.json"), {
  format: "transparent_ai_current_goal_start_here_launchpad_v1",
  statusSummary: {
    goalComplete: false,
    finalReviewIndexReadyLanes: 4,
    finalReviewIndexBlockedLanes: 6,
    nextProofGapRouteId: "post_registration_output_witness_route",
    nextProofGapQuestion: "Does the bounded runner/output witness prove the monitor ran without reading full logs?"
  },
  paths: { html: startHereHtml }
});
const witnessPath = writeJson(join(root, "witness-entry.json"), {
  format: "transparent_ai_current_goal_post_registration_witness_teacher_confirmation_entry_v1",
  status: "waiting_for_teacher_confirmation_before_post_registration_output_witness",
  sourceRegistrationStatus: "verified_not_registered_yet",
  sourceWitnessBuilderStatus: "operational_post_registration_output_witness_command_builder_waiting_for_matching_status",
  blockers: ["registration_status_not_registered_and_matching_reviewed_runner"],
  locks: {
    goalComplete: false,
    runnerLaunched: false,
    scheduledTaskRegistered: false
  },
  paths: {
    html: witnessHtml,
    sourceWitnessCommandBuilder: join(root, "source-builder.json"),
    sourceWitnessCommandBuilderHtml: sourceBuilderHtml
  }
});

const result = runNodeScript("create-current-goal-start-here-post-registration-witness-bridge.mjs", [
  "--start-here",
  startHerePath,
  "--witness-entry",
  witnessPath,
  "--output-dir",
  join(root, "bridge")
]);
const bridge = readJson(result.bridgePath);
const html = readFileSync(result.htmlPath, "utf8");

const checks = [
  {
    name: "Start Here witness bridge links stable Start Here to the supplied witness teacher entry",
    pass:
      bridge.paths.startHere === startHerePath &&
      bridge.paths.witnessEntry === witnessPath &&
      bridge.paths.witnessEntryHtml === witnessHtml,
    evidence: bridge.paths
  },
  {
    name: "Start Here witness bridge preserves incompletion and current next proof gap",
    pass:
      bridge.summary.goalComplete === false &&
      bridge.summary.finalReviewIndexReadyLanes === 4 &&
      bridge.summary.finalReviewIndexBlockedLanes === 6 &&
      bridge.summary.nextProofGapRouteId === "post_registration_output_witness_route",
    evidence: bridge.summary
  },
  {
    name: "Start Here witness bridge keeps all side-effect locks closed",
    pass:
      bridge.locks.bridgeDoesNotModifyStartHere === true &&
      bridge.locks.bridgeDoesNotRunCommands === true &&
      bridge.locks.bridgeDoesNotRegisterTask === true &&
      bridge.locks.bridgeDoesNotLaunchRunner === true &&
      bridge.locks.bridgeDoesNotReadFullLogs === true &&
      bridge.locks.goalComplete === false,
    evidence: bridge.locks
  },
  {
    name: "Start Here witness bridge writes a teacher-readable HTML handoff",
    pass: existsSync(result.htmlPath) && html.includes("Start Here Post-Registration Witness Bridge"),
    evidence: result.htmlPath
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(JSON.stringify({ status: "failed", checks }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      smoke: "transparent_ai_current_goal_start_here_post_registration_witness_bridge_smoke_v1",
      bridgePath: result.bridgePath,
      checks
    },
    null,
    2
  )
);
