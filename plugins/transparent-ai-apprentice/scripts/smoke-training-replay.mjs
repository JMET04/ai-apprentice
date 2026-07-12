#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");

function run(script, args) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${script} failed`);
  }
  return JSON.parse(result.stdout);
}

const sessionResult = run("create-teaching-session.mjs", [
  "--name",
  "training replay smoke",
  "--task",
  "verify demonstration correction and replay loop"
]);

const importResult = run("import-demonstration-artifact.mjs", [
  "--session",
  sessionResult.sessionPath,
  "--artifact",
  "plugins/transparent-ai-apprentice/assets/examples/drawio-demo.drawio",
  "--tool",
  "draw.io",
  "--teacher-action",
  "Teacher connected rough intent to disabled rule draft",
  "--taught-behavior",
  "Preserve smooth curve connector intent"
]);

const correctionResult = run("apply-teacher-correction.mjs", [
  "--session",
  sessionResult.sessionPath,
  "--rule-id",
  importResult.ruleDraftId,
  "--type",
  "too_broad",
  "--correction",
  "Only use this smooth curve connector idea when I confirm the connector is intentional, not decorative.",
  "--decision",
  "needs_teacher_review"
]);

const replayResult = run("replay-teaching-session.mjs", [
  "--session",
  sessionResult.sessionPath,
  "--rule-id",
  importResult.ruleDraftId,
  "--input",
  "Future task: teacher draws rough intent with a smooth curve connector into a disabled draft box."
]);

const session = JSON.parse(readFileSync(sessionResult.sessionPath, "utf8"));
const replay = session.replays.find((item) => item.id === replayResult.replayId);
const replayTrace = session.publicTraces.find((trace) => trace.sourceReplayId === replayResult.replayId);

const checks = [
  {
    name: "Replay created after correction",
    pass: Boolean(replay) && replay.selectedRuleDraftId === importResult.ruleDraftId,
    evidence: replay ? replay.selectedRuleDraftId : "missing"
  },
  {
    name: "Replay detects matching cues",
    pass: replayResult.matchedCueCount > 0 && replay?.matchedCues?.length === replayResult.matchedCueCount,
    evidence: `matchedCueCount=${replayResult.matchedCueCount}`
  },
  {
    name: "Replay remains review-only",
    pass:
      replayResult.ruleEnabled === false &&
      replayResult.requiresTeacherConfirmation === true &&
      replayResult.outcome === "needs_teacher_review",
    evidence: `outcome=${replayResult.outcome}; ruleEnabled=${replayResult.ruleEnabled}`
  },
  {
    name: "Replay public trace created",
    pass: Boolean(replayTrace) && replayTrace.steps.length >= 2,
    evidence: `traceSteps=${replayTrace?.steps.length ?? 0}`
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  sessionPath: sessionResult.sessionPath,
  importResult,
  correctionResult,
  replayResult,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") {
  process.exit(1);
}

