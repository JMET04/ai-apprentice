#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(
  tmpdir(),
  "transparent-ai-apprentice-smoke",
  "low-token-monitor-selected-route-command-builder",
  String(Date.now())
);
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = [], { expectFailure = false } = {}) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (expectFailure) return result;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
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
const bridgeResult = runNodeScript("create-original-goal-low-token-monitor-command-bridge.mjs", [
  "--queue",
  queueResult.queuePath,
  "--output-dir",
  join(smokeRoot, "bridge")
]);
const receiptBuilder = runNodeScript("create-original-goal-low-token-monitor-bridge-receipt-builder.mjs", [
  "--bridge",
  bridgeResult.bridgePath,
  "--output-dir",
  join(smokeRoot, "receipt-builder")
]);
const template = readJson(receiptBuilder.receiptTemplatePath);
const receiptPath = writeJson(join(smokeRoot, "teacher-selected-low-token-route.json"), {
  ...template,
  teacherDecision: "teacher_selects_route",
  selectedRouteId: "existing_recurring_monitor_teacher_confirmation",
  routeReviewed: true,
  retainedRollbackPoint: "rollback-point-for-low-token-selected-route-smoke",
  readinessPackagePath: "real-local-all-software-low-token-readiness-package.json",
  coverageReviewReceiptValidationPath: "teacher-reviewed-low-token-coverage-dossier-receipt-validation.json",
  teacherNotes: "Smoke selects teacher confirmation package route."
});
const validationResult = runNodeScript("validate-original-goal-low-token-monitor-bridge-receipt.mjs", [
  "--bridge",
  bridgeResult.bridgePath,
  "--receipt",
  receiptPath,
  "--output-dir",
  join(smokeRoot, "receipt-validation")
]);
const commandBuilderResult = runNodeScript("create-original-goal-low-token-monitor-selected-route-command-builder.mjs", [
  "--validation",
  validationResult.validationPath,
  "--output-dir",
  join(smokeRoot, "command-builder")
]);
const commandBuilder = readJson(commandBuilderResult.builderPath);

const notReadyValidationPath = writeJson(join(smokeRoot, "not-ready-validation.json"), {
  format: "transparent_ai_original_goal_low_token_monitor_bridge_receipt_validation_v1",
  routeReadyForLaterGate: false,
  selectedRouteHandoff: null
});
const notReadyFailure = runNodeScript(
  "create-original-goal-low-token-monitor-selected-route-command-builder.mjs",
  ["--validation", notReadyValidationPath, "--output-dir", join(smokeRoot, "not-ready-command-builder")],
  { expectFailure: true }
);

const checks = [
  {
    name: "Low-token monitor selected-route command builder creates reviewable next gate package",
    pass:
      commandBuilderResult.format ===
        "transparent_ai_original_goal_low_token_monitor_selected_route_command_builder_result_v1" &&
      existsSync(commandBuilderResult.builderPath) &&
      existsSync(commandBuilderResult.htmlPath) &&
      commandBuilder.format === "transparent_ai_original_goal_low_token_monitor_selected_route_command_builder_v1" &&
      commandBuilder.selectedRouteId === "existing_recurring_monitor_teacher_confirmation" &&
      commandBuilder.nextGate === "create_all_software_recurring_monitor_teacher_confirmation_package" &&
      commandBuilder.objectiveRequirementId === "all_software_low_token_learning" &&
      commandBuilder.completionBlockerLane === "unattended_operational_monitor_evidence" &&
      commandBuilder.nextGateHandoff.format ===
        "transparent_ai_original_goal_low_token_monitor_selected_route_next_gate_handoff_v1" &&
      commandBuilder.nextGateHandoff.status === "review_only_next_gate_handoff_ready" &&
      commandBuilder.nextGateHandoff.completionBlockerLane === "unattended_operational_monitor_evidence" &&
      commandBuilder.nextGateHandoff.requiredEvidenceBeforeManualUse.includes("retained rollback point") &&
      commandBuilder.nextGateHandoff.requiredEvidenceBeforeManualUse.includes(
        "teacher-reviewed coverage receipt validation or explicit software exclusions"
      ) &&
      commandBuilder.coverageReviewReceiptValidationPath ===
        "teacher-reviewed-low-token-coverage-dossier-receipt-validation.json" &&
      commandBuilder.nextGateHandoff.coverageReviewReceiptValidationPath ===
        "teacher-reviewed-low-token-coverage-dossier-receipt-validation.json" &&
      commandBuilder.nextGateHandoff.returnToCompletionBlockerMatrixAfterNextGate === true &&
      commandBuilder.executeNow === false &&
      commandBuilder.registerNow === false &&
      commandBuilder.readFullLogsNow === false,
    evidence: commandBuilderResult
  },
  {
    name: "Low-token monitor selected-route command builder keeps all side-effect locks closed",
    pass:
      commandBuilder.locks.builderDoesNotRunCommands === true &&
      commandBuilder.locks.builderDoesNotRegisterTask === true &&
      commandBuilder.locks.builderDoesNotLaunchRunner === true &&
      commandBuilder.locks.builderDoesNotReadLogs === true &&
      commandBuilder.locks.builderDoesNotReadFullLogs === true &&
      commandBuilder.locks.builderDoesNotWriteMemory === true &&
      commandBuilder.nextGateHandoff.locks.builderDoesNotRunCommands === true &&
      commandBuilder.nextGateHandoff.locks.builderDoesNotRegisterTask === true &&
      commandBuilder.nextGateHandoff.locks.builderDoesNotReadFullLogs === true &&
      commandBuilder.nextGateHandoff.locks.builderDoesNotWriteMemory === true &&
      commandBuilder.locks.goalComplete === false,
    evidence: commandBuilder.locks
  },
  {
    name: "Low-token monitor selected-route command builder refuses not-ready validation",
    pass:
      notReadyFailure.status !== 0 &&
      String(notReadyFailure.stderr || notReadyFailure.stdout).includes(
        "LOW_TOKEN_MONITOR_SELECTED_ROUTE_COMMAND_BUILDER_REQUIRES_READY_ROUTE_VALIDATION"
      ),
    evidence: { status: notReadyFailure.status, stderr: notReadyFailure.stderr, stdout: notReadyFailure.stdout }
  }
];

const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      status: failed.length === 0 ? "passed" : "failed",
      smoke: "transparent_ai_original_goal_low_token_monitor_selected_route_command_builder_smoke_v1",
      smokeRoot,
      commandBuilderPath: commandBuilderResult.builderPath,
      checks
    },
    null,
    2
  )
);
if (failed.length > 0) process.exit(1);
