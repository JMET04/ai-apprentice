#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-real-local-trial-package", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const result = runNodeScript("create-current-goal-real-local-trial-package.mjs", ["--output-dir", smokeRoot]);
const packet = readJson(result.packagePath);
const html = readFileSync(result.htmlPath, "utf8");
const readme = readFileSync(result.readmePath, "utf8");

const checks = [
  {
    name: "Package writes formal JSON HTML README and smoke summary",
    pass:
      packet.format === "transparent_ai_current_goal_real_local_trial_package_v1" &&
      existsSync(result.packagePath) &&
      existsSync(result.htmlPath) &&
      existsSync(result.readmePath) &&
      existsSync(result.smokeSummaryPath),
    evidence: result
  },
  {
    name: "Package proves the integrated real-local sampled path",
    pass:
      packet.status === "real_local_trial_evidence_ready_review_only_goal_not_complete" &&
      packet.checkSummary.total >= 10 &&
      packet.checkSummary.failed === 0 &&
      packet.checks.some((check) => check.name.includes("Real local all-software inventory")) &&
      packet.checks.some((check) => check.name.includes("Transparent mask preserves 2D")) &&
      packet.checks.some((check) => check.name.includes("Supervised execution gate")),
    evidence: packet.checkSummary
  },
  {
    name: "Package links real local software context",
    pass:
      Boolean(packet.realLocalSoftware.software) &&
      Number(packet.realLocalSoftware.discoveredCandidateCount || 0) > 0 &&
      Boolean(packet.paths.inventory) &&
      Boolean(packet.paths.overlayPacket) &&
      Boolean(packet.paths.supervisedExecutionDryRun),
    evidence: packet.realLocalSoftware
  },
  {
    name: "Package keeps goal completion and side effects locked",
    pass:
      packet.goalComplete === false &&
      packet.locks.realLocalTrialDoesNotCaptureScreenshots === true &&
      packet.locks.realLocalTrialDoesNotRecordScreen === true &&
      packet.locks.realLocalTrialDoesNotExecuteTargetSoftware === true &&
      packet.locks.realLocalTrialDoesNotWriteMemory === true &&
      packet.locks.realLocalTrialDoesNotEnableRules === true &&
      packet.locks.realLocalTrialDoesNotDeleteRollbackPoints === true &&
      packet.locks.goalComplete === false,
    evidence: packet.locks
  },
  {
    name: "Teacher-facing HTML and README explain the boundary",
    pass:
      html.includes("Current Goal Real Local Trial Package") &&
      html.includes("does not register monitors") &&
      readme.includes("Goal complete: false") &&
      readme.includes("No target software execution"),
    evidence: { htmlPath: result.htmlPath, readmePath: result.readmePath }
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

rmSync(smokeRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_real_local_trial_package_smoke_v1",
      checks,
      tempCleaned: true
    },
    null,
    2
  )
);
