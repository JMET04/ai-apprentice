#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "objective-fulfillment-next-step-queue", String(Date.now()));
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
const queue = readJson(queueResult.queuePath);

const requiredRoutes = new Map([
  ["all_software_low_token_learning", "low_token_coverage_review"],
  ["adapt_any_teacher_learning_method", "teacher_method_review"],
  ["transparent_mask_2d_perspective_3d_depth_understanding", "transparent_sketch_depth_review"],
  ["execute_in_target_software_after_confirmation", "execution_gate_review"]
]);

const checks = [
  {
    name: "Objective fulfillment next-step queue is generated from audit rows",
    pass:
      queue.format === "transparent_ai_original_goal_objective_fulfillment_next_step_queue_v1" &&
      queue.status === "objective_follow_up_queue_ready" &&
      queue.queueItems.length === 4 &&
      [...requiredRoutes.entries()].every(([id, routeKind]) =>
        queue.queueItems.some((item) => item.requirementId === id && item.routeKind === routeKind)
      ),
    evidence: queue.queueItems.map((item) => ({ requirementId: item.requirementId, routeKind: item.routeKind }))
  },
  {
    name: "Objective fulfillment queue preserves teacher selection and no-op locks",
    pass:
      queue.completionAllowed === false &&
      queue.locks.queueDoesNotRunCommands === true &&
      queue.locks.queueDoesNotRegisterTask === true &&
      queue.locks.queueDoesNotExecuteTargetSoftware === true &&
      queue.locks.queueDoesNotCaptureScreenshots === true &&
      queue.locks.queueDoesNotWriteMemory === true &&
      queue.locks.goalComplete === false &&
      queue.queueItems.every((item) => item.teacherSelectionReceiptPatch?.teacherDecision === "teacher_selects_next_lane") &&
      queue.queueItems.every((item) => item.validationCommandTemplate.includes("<teacher-filled-objective-fulfillment-receipt.json>")),
    evidence: queue.locks
  },
  {
    name: "Objective fulfillment queue orders next actions by broad goal priority",
    pass:
      queue.queueItems[0]?.requirementId === "all_software_low_token_learning" &&
      queue.queueItems.at(-1)?.requirementId === "execute_in_target_software_after_confirmation",
    evidence: queue.queueItems.map((item) => item.requirementId)
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_objective_fulfillment_next_step_queue_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
