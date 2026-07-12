#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "objective-execution-bridge", String(Date.now()));
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

const auditResult = runNodeScript("create-original-goal-objective-fulfillment-audit.mjs", [
  "--output-dir",
  join(smokeRoot, "audit")
]);
const queueResult = runNodeScript("create-original-goal-objective-fulfillment-next-step-queue.mjs", [
  "--audit",
  auditResult.auditPath,
  "--output-dir",
  join(smokeRoot, "queue")
]);
const bridgeResult = runNodeScript("create-original-goal-objective-execution-bridge.mjs", [
  "--queue",
  queueResult.queuePath,
  "--output-dir",
  join(smokeRoot, "bridge")
]);
const bridge = readJson(bridgeResult.bridgePath);

const routeIds = bridge.recommendedRouteOrder.map((route) => route.routeId);
const checks = [
  {
    name: "Objective execution bridge maps the original execution lane to existing execution gates",
    pass:
      bridge.format === "transparent_ai_original_goal_objective_execution_bridge_v1" &&
      bridge.executionObjective.requirementId === "execute_in_target_software_after_confirmation" &&
      routeIds.includes("existing_real_case_controlled_execution_chain") &&
      routeIds.includes("existing_all_software_execution_approval_gate_prep_runner") &&
      routeIds.includes("existing_real_local_execution_approval_gate"),
    evidence: routeIds
  },
  {
    name: "Objective execution bridge preserves rollback teacher confirmation and post-action evidence requirements",
    pass:
      bridge.missingBeforeCompletion.includes("teacher selected exactly one numbered target") &&
      bridge.missingBeforeCompletion.includes("retained rollback point exists for this exact run") &&
      bridge.missingBeforeCompletion.includes("post-action evidence review receipt is planned"),
    evidence: bridge.missingBeforeCompletion
  },
  {
    name: "Objective execution bridge is no-op and cannot execute target software",
    pass:
      bridge.completionAllowed === false &&
      bridge.locks.bridgeDoesNotRunCommands === true &&
      bridge.locks.bridgeDoesNotExecuteTargetSoftware === true &&
      bridge.locks.bridgeDoesNotSendUiEvents === true &&
      bridge.locks.bridgeDoesNotCaptureScreenshots === true &&
      bridge.locks.bridgeDoesNotWriteMemory === true &&
      bridge.locks.goalComplete === false &&
      bridge.blockedActions.includes("execute_target_software_from_objective_bridge"),
    evidence: bridge.locks
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_objective_execution_bridge_smoke_v1",
      smokeRoot,
      bridgePath: bridgeResult.bridgePath,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
