#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-invocation-approved-gate-command-builder-smoke", String(Date.now()));

function runNode(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
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

const prepSmoke = runNode("smoke-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs", []);

const ready = runNode("create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs", [
  "--prep",
  prepSmoke.readyPacketPath,
  "--out-dir",
  join(smokeRoot, "ready")
]);
const readyWrapper = readJson(ready.wrapperPath);
const readyReceipt = readJson(ready.receiptPath);

const blocked = runNode("create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs", [
  "--prep",
  prepSmoke.mismatchPacketPath,
  "--out-dir",
  join(smokeRoot, "blocked")
]);
const blockedWrapper = readJson(blocked.wrapperPath);

const checks = [
  {
    name: "Ready reusable workflow invocation approval prep reuses the existing approved-gate command builder",
    pass:
      ready.status === "reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation" &&
      ready.existingCommandBuilderInvoked === true &&
      ready.existingCommandBuilderStatus === "approval_gate_command_builder_ready_for_teacher_final_confirmation" &&
      existsSync(ready.existingBuilderHtmlPath || "") &&
      ready.commandTemplate.includes("--execute-approved-gate") &&
      readyWrapper.locks.wrapperDoesNotRunApprovedGate === true &&
      readyReceipt.targetSoftwareCommandsExecutedByWrapper === false &&
      readyReceipt.uiEventsSentByWrapper === false,
    evidence: ready.existingBuilderHtmlPath
  },
  {
    name: "Non-ready reusable workflow invocation approval prep is blocked before command-builder reuse",
    pass:
      blocked.status === "blocked_before_reusable_workflow_invocation_approved_gate_command_builder" &&
      blocked.existingCommandBuilderInvoked === false &&
      blockedWrapper.blockers.includes("reusable_workflow_invocation_prep_status_not_ready_for_teacher_execute_review"),
    evidence: blockedWrapper.blockers.join(",")
  },
  {
    name: "Reusable workflow command builder keeps execution memory rule packaging and completion locks",
    pass:
      readyWrapper.locks.reviewOnly === true &&
      readyWrapper.locks.accepted === false &&
      readyWrapper.locks.ruleEnabled === false &&
      readyWrapper.locks.packagingGated === true &&
      readyWrapper.locks.wrapperDoesNotInvokeRunner === true &&
      readyWrapper.locks.wrapperDoesNotExecuteTargetSoftware === true &&
      readyWrapper.locks.screenshotsCaptured === false &&
      readyWrapper.locks.memoryWritten === false &&
      readyWrapper.locks.nativeUniversalExecution === false &&
      readyWrapper.locks.goalComplete === false,
    evidence: JSON.stringify(readyWrapper.locks)
  },
  {
    name: "Reusable workflow command builder preserves provider role-use trace from approval prep",
    pass:
      readyWrapper.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
        "sha256:reusable-invocation-provider-role-use-plan-smoke" &&
      readyWrapper.sourceEvidence.providerRoleUsePlanTrace.providerRole === "medium_reasoning_runtime",
    evidence: ready.wrapperPath
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_command_builder_smoke_v1",
  passed,
  total: checks.length,
  readyWrapperPath: ready.wrapperPath,
  blockedWrapperPath: blocked.wrapperPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
