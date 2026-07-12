#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-teacher-trial-intake-router", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const missingResult = runNodeScript("create-current-goal-teacher-trial-intake-router.mjs", [
  "--output-dir",
  join(smokeRoot, "missing")
]);
const missingRouter = readJson(missingResult.routerPath);

const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeJson(forbiddenReceiptPath, {
  format: "transparent_ai_current_goal_teacher_trial_workbench_receipt_v1",
  teacherDecision: "accepted",
  locks: {
    accepted: false,
    ruleEnabled: false,
    softwareActionsExecuted: true,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    goalComplete: true
  }
});
const forbiddenResult = runNodeScript("create-current-goal-teacher-trial-intake-router.mjs", [
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "forbidden")
]);
const forbiddenRouter = readJson(forbiddenResult.routerPath);

const routeReceiptPath = join(smokeRoot, "route-receipt.json");
writeJson(routeReceiptPath, {
  format: "transparent_ai_current_goal_teacher_trial_workbench_receipt_v1",
  teacherDecision: "ready_for_low_token_route_selection",
  selectedSoftware: "Smoke software",
  selectedLowTokenRouteId: "existing_low_token_coverage_review",
  locks: {
    accepted: false,
    ruleEnabled: false,
    softwareActionsExecuted: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    goalComplete: false
  }
});
const routeResult = runNodeScript("create-current-goal-teacher-trial-intake-router.mjs", [
  "--receipt",
  routeReceiptPath,
  "--output-dir",
  join(smokeRoot, "route")
]);
const routeRouter = readJson(routeResult.routerPath);
const routeHtml = readFileSync(routeResult.htmlPath, "utf8");

const checks = [
  {
    name: "Missing receipt blocks without running anything",
    pass:
      missingRouter.status === "blocked_waiting_for_teacher_trial_receipt" &&
      missingRouter.readyForNextManualCommand === false &&
      missingRouter.blockers.includes("teacher_trial_receipt_missing") &&
      missingRouter.locks.routerDoesNotExecuteTargetSoftware === true,
    evidence: missingRouter
  },
  {
    name: "Forbidden receipt claims stay blocked",
    pass:
      forbiddenRouter.status === "blocked_waiting_for_teacher_evidence_or_valid_receipt" &&
      forbiddenRouter.readyForNextManualCommand === false &&
      forbiddenRouter.blockers.includes("unsupported_teacher_decision:accepted") &&
      forbiddenRouter.blockers.includes("receipt_claims_software_execution") &&
      forbiddenRouter.blockers.includes("receipt_claims_goal_complete"),
    evidence: forbiddenRouter
  },
  {
    name: "Valid low-token route receipt returns one next manual command",
    pass:
      routeRouter.status === "ready_for_next_manual_command_review_only" &&
      routeRouter.readyForNextManualCommand === true &&
      routeRouter.nextManualCommand.includes("validate-original-goal-low-token-monitor-bridge-receipt.mjs") &&
      routeRouter.validationStatus === "ready_for_low_token_route_receipt_validation_manual_command" &&
      routeRouter.preflightStatus === "ready_for_next_manual_gate_review_only",
    evidence: routeRouter
  },
  {
    name: "Router HTML and artifacts are written",
    pass:
      existsSync(routeResult.routerPath) &&
      existsSync(routeResult.htmlPath) &&
      existsSync(routeResult.readmePath) &&
      routeHtml.includes("Current Goal Teacher Trial Intake Router") &&
      routeHtml.includes("does not run that command"),
    evidence: routeResult
  },
  {
    name: "Router keeps all side-effect locks closed",
    pass:
      routeRouter.locks.routerDoesNotRunNextManualCommand === true &&
      routeRouter.locks.routerDoesNotReadLogs === true &&
      routeRouter.locks.routerDoesNotCaptureScreenshots === true &&
      routeRouter.locks.routerDoesNotExecuteTargetSoftware === true &&
      routeRouter.locks.routerDoesNotWriteMemory === true &&
      routeRouter.locks.routerDoesNotEnableRules === true &&
      routeRouter.locks.routerDoesNotDeleteRollbackPoints === true &&
      routeRouter.locks.goalComplete === false,
    evidence: routeRouter.locks
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
      smoke: "transparent_ai_current_goal_teacher_trial_intake_router_smoke_v1",
      checks,
      tempCleaned: true
    },
    null,
    2
  )
);
