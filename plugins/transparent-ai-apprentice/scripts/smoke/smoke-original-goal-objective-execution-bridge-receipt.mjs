#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "objective-execution-bridge-receipt", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], { allowFailure = false } = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0 && !allowFailure) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return {
    status: result.status,
    json: result.stdout ? JSON.parse(result.stdout) : null,
    stderr: result.stderr
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const audit = runNodeScript("create-original-goal-objective-fulfillment-audit.mjs", [
  "--output-dir",
  join(smokeRoot, "audit")
]).json;
const queue = runNodeScript("create-original-goal-objective-fulfillment-next-step-queue.mjs", [
  "--audit",
  audit.auditPath,
  "--output-dir",
  join(smokeRoot, "queue")
]).json;
const bridge = runNodeScript("create-original-goal-objective-execution-bridge.mjs", [
  "--queue",
  queue.queuePath,
  "--output-dir",
  join(smokeRoot, "bridge")
]).json;
const builder = runNodeScript("create-original-goal-objective-execution-bridge-receipt-builder.mjs", [
  "--bridge",
  bridge.bridgePath,
  "--output-dir",
  join(smokeRoot, "builder")
]).json;
const template = readJson(builder.receiptTemplatePath);
const goodReceiptPath = writeJson(join(smokeRoot, "good-receipt.json"), {
  ...template,
  teacherDecision: "teacher_selects_route",
  selectedRouteId: "existing_all_software_execution_approval_gate_prep_runner",
  routeReviewed: true,
  teacherSelectedNumberedTarget: "candidate-1",
  retainedRollbackPoint: "rollback-point-for-smoke",
  adapterEvidencePath: "reviewed-adapter-evidence.json",
  postActionEvidencePlan: "review outcome receipt after separate runner",
  teacherNotes: "Use the all-software prep route after dry-run validation."
});
const good = runNodeScript("validate-original-goal-objective-execution-bridge-receipt.mjs", [
  "--bridge",
  bridge.bridgePath,
  "--receipt",
  goodReceiptPath,
  "--output-dir",
  join(smokeRoot, "good-validation")
]).json;
const goodPacket = readJson(good.validationPath);

const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  ...template,
  teacherDecision: "execute_now",
  selectedRouteId: "existing_real_local_execution_approval_gate",
  routeReviewed: true,
  executeNow: true
});
const forbidden = runNodeScript(
  "validate-original-goal-objective-execution-bridge-receipt.mjs",
  ["--bridge", bridge.bridgePath, "--receipt", forbiddenReceiptPath, "--output-dir", join(smokeRoot, "forbidden-validation")],
  { allowFailure: true }
);

const missingReceiptPath = writeJson(join(smokeRoot, "missing-receipt.json"), {
  ...template,
  teacherDecision: "teacher_selects_route",
  selectedRouteId: "existing_real_local_execution_approval_gate",
  routeReviewed: true,
  teacherSelectedNumberedTarget: "candidate-2",
  retainedRollbackPoint: "",
  adapterEvidencePath: "",
  postActionEvidencePlan: ""
});
const missing = runNodeScript(
  "validate-original-goal-objective-execution-bridge-receipt.mjs",
  ["--bridge", bridge.bridgePath, "--receipt", missingReceiptPath, "--output-dir", join(smokeRoot, "missing-validation")],
  { allowFailure: true }
);

const checks = [
  {
    name: "Execution bridge receipt builder creates teacher route-selection template",
    pass:
      builder.status === "waiting_for_teacher_objective_execution_bridge_receipt" &&
      builder.routeCount === 3 &&
      template.format === "transparent_ai_original_goal_objective_execution_bridge_receipt_v1" &&
      template.executeNow === false,
    evidence: builder.receiptTemplatePath
  },
  {
    name: "Execution bridge receipt validation selects one existing route for later controlled gate",
    pass:
      good.status === "objective_execution_bridge_route_selected_for_later_controlled_gate" &&
      good.routeReadyForLaterGate === true &&
      goodPacket.selectedRouteHandoff?.selectedRouteId === "existing_all_software_execution_approval_gate_prep_runner" &&
      goodPacket.selectedRouteHandoff?.executeNow === false &&
      goodPacket.locks.validationDoesNotExecuteTargetSoftware === true,
    evidence: good.validationPath
  },
  {
    name: "Execution bridge receipt validation blocks forbidden execute-now decisions",
    pass:
      forbidden.status !== 0 &&
      forbidden.json?.status === "blocked_for_forbidden_objective_execution_bridge_decision" &&
      forbidden.json?.blockers.includes("receipt_execute_now_forbidden"),
    evidence: forbidden.json
  },
  {
    name: "Execution bridge receipt validation requires rollback adapter evidence and post-action plan",
    pass:
      missing.status !== 0 &&
      missing.json?.blockers.includes("retained_rollback_point_required") &&
      missing.json?.blockers.includes("adapter_evidence_path_required") &&
      missing.json?.blockers.includes("post_action_evidence_plan_required"),
    evidence: missing.json
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_objective_execution_bridge_receipt_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
