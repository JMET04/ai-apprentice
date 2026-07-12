#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "objective-selected-route-command-builder", String(Date.now()));
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

function makeValidation(routeId) {
  const audit = runNodeScript("create-original-goal-objective-fulfillment-audit.mjs", [
    "--output-dir",
    join(smokeRoot, `audit-${routeId}`)
  ]).json;
  const queue = runNodeScript("create-original-goal-objective-fulfillment-next-step-queue.mjs", [
    "--audit",
    audit.auditPath,
    "--output-dir",
    join(smokeRoot, `queue-${routeId}`)
  ]).json;
  const bridge = runNodeScript("create-original-goal-objective-execution-bridge.mjs", [
    "--queue",
    queue.queuePath,
    "--output-dir",
    join(smokeRoot, `bridge-${routeId}`)
  ]).json;
  const builder = runNodeScript("create-original-goal-objective-execution-bridge-receipt-builder.mjs", [
    "--bridge",
    bridge.bridgePath,
    "--output-dir",
    join(smokeRoot, `receipt-builder-${routeId}`)
  ]).json;
  const template = readJson(builder.receiptTemplatePath);
  const receiptPath = writeJson(join(smokeRoot, `receipt-${routeId}.json`), {
    ...template,
    teacherDecision: "teacher_selects_route",
    selectedRouteId: routeId,
    routeReviewed: true,
    teacherSelectedNumberedTarget: "candidate-1",
    retainedRollbackPoint: "rollback-point-for-command-builder-smoke",
    adapterEvidencePath: "reviewed-adapter-evidence.json",
    postActionEvidencePlan: "review separate-runner outcome receipt",
    teacherNotes: `Select ${routeId}.`
  });
  return runNodeScript("validate-original-goal-objective-execution-bridge-receipt.mjs", [
    "--bridge",
    bridge.bridgePath,
    "--receipt",
    receiptPath,
    "--output-dir",
    join(smokeRoot, `validation-${routeId}`)
  ]).json;
}

const allSoftwareValidation = makeValidation("existing_all_software_execution_approval_gate_prep_runner");
const realLocalValidation = makeValidation("existing_real_local_execution_approval_gate");
const allSoftwareBuilder = runNodeScript("create-original-goal-objective-execution-selected-route-command-builder.mjs", [
  "--validation",
  allSoftwareValidation.validationPath,
  "--output-dir",
  join(smokeRoot, "all-software-builder")
]).json;
const realLocalBuilder = runNodeScript("create-original-goal-objective-execution-selected-route-command-builder.mjs", [
  "--validation",
  realLocalValidation.validationPath,
  "--output-dir",
  join(smokeRoot, "real-local-builder")
]).json;
const allSoftwarePacket = readJson(allSoftwareBuilder.builderPath);
const realLocalPacket = readJson(realLocalBuilder.builderPath);

const blockedValidationPath = writeJson(join(smokeRoot, "blocked-validation.json"), {
  format: "transparent_ai_original_goal_objective_execution_bridge_receipt_validation_v1",
  status: "objective_execution_bridge_needs_teacher_review",
  routeReadyForLaterGate: false,
  selectedRouteHandoff: null,
  locks: { validationDoesNotExecuteTargetSoftware: true, goalComplete: false }
});
const blocked = runNodeScript(
  "create-original-goal-objective-execution-selected-route-command-builder.mjs",
  ["--validation", blockedValidationPath, "--output-dir", join(smokeRoot, "blocked-builder")],
  { allowFailure: true }
);

const checks = [
  {
    name: "Selected route command builder creates all-software prep command package",
    pass:
      allSoftwareBuilder.status === "selected_route_command_ready_for_teacher_review" &&
      allSoftwareBuilder.nextGate === "run_all_software_execution_approval_gate_prep_runner" &&
      allSoftwareBuilder.executeNow === false &&
      allSoftwarePacket.locks.builderDoesNotExecuteTargetSoftware === true,
    evidence: allSoftwareBuilder.builderPath
  },
  {
    name: "Selected route command builder creates real-local approval command package",
    pass:
      realLocalBuilder.status === "selected_route_command_ready_for_teacher_review" &&
      realLocalPacket.selectedRouteId === "existing_real_local_execution_approval_gate" &&
      realLocalBuilder.nextGate === "create_real_local_execution_approval_gate" &&
      realLocalPacket.commandTemplate.includes("create-real-local-execution-approval-gate.mjs") &&
      realLocalPacket.locks.builderDoesNotRunCommands === true,
    evidence: realLocalBuilder.builderPath
  },
  {
    name: "Selected route command builder rejects non-ready route validations",
    pass:
      blocked.status !== 0 &&
      String(blocked.stderr || "").includes("OBJECTIVE_EXECUTION_SELECTED_ROUTE_COMMAND_BUILDER_REQUIRES_READY_ROUTE_VALIDATION"),
    evidence: blocked.stderr
  },
  {
    name: "Selected route command builder preserves rollback adapter and post-action preflight",
    pass:
      allSoftwarePacket.preflightChecklist.some((item) => item.includes("Rollback point")) &&
      allSoftwarePacket.preflightChecklist.some((item) => item.includes("Adapter/control-channel")) &&
      allSoftwarePacket.preflightChecklist.some((item) => item.includes("Post-action evidence")) &&
      allSoftwarePacket.claimCompleteNow === false,
    evidence: allSoftwarePacket.preflightChecklist
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_objective_execution_selected_route_command_builder_smoke_v1",
      smokeRoot,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
