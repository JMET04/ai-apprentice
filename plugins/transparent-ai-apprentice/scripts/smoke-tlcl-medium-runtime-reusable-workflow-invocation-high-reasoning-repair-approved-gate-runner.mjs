#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-reusable-workflow-repair-approved-gate-runner-smoke",
  String(Date.now())
);

function runNode(scriptName, args = []) {
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

const builderSmoke = runNode(
  "smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder.mjs"
);

const noFlag = runNode("run-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs", [
  "--builder",
  builderSmoke.readyWrapperPath,
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow repair approved gate runner",
  "--rollback-point-created",
  "--out-dir",
  join(smokeRoot, "no-flag")
]);
const noFlagPacket = readJson(noFlag.packetPath);

const readyRun = runNode("run-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs", [
  "--builder",
  builderSmoke.readyWrapperPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow repair approved gate runner",
  "--rollback-point-created",
  "--out-dir",
  join(smokeRoot, "ready")
]);
const readyPacket = readJson(readyRun.packetPath);
const readyReceipt = readJson(readyRun.receiptPath);

const blockedBuilder = runNode("run-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs", [
  "--builder",
  builderSmoke.blockedWrapperPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow repair approved gate runner",
  "--rollback-point-created",
  "--out-dir",
  join(smokeRoot, "blocked-builder")
]);
const blockedPacket = readJson(blockedBuilder.packetPath);

const checks = [
  {
    name: "Reusable workflow repair approved gate runner blocks without final execute flag",
    pass:
      noFlag.status === "blocked_before_reusable_workflow_repair_approved_gate_runner" &&
      noFlag.runnerInvoked === false &&
      noFlagPacket.blockers.includes("missing_execute_approved_gate_flag"),
    evidence: noFlagPacket.blockers.join(",")
  },
  {
    name: "Ready reusable workflow repair approved gate runner invokes the existing reusable workflow runner and preserves evidence",
    pass:
      readyRun.status === "reusable_workflow_repair_approved_gate_runner_invoked_but_blocked" &&
      readyRun.runnerInvoked === true &&
      readyRun.controlledRouteActionExecuted === false &&
      readyRun.targetSoftwareCommandsExecuted === false &&
      existsSync(readyRun.reusableWorkflowRunnerReceiptPath || "") &&
      existsSync(readyRun.existingRunnerReceiptPath || "") &&
      existsSync(readyRun.adapterReceiptPath || "") &&
      existsSync(readyRun.outcomeVerificationPath || "") &&
      existsSync(readyRun.postActionCheckpointPath || "") &&
      readyRun.blockers.includes("reusable_workflow_runner_blocker:reusable_workflow_approved_gate_runner_did_not_complete_controlled_route") &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.goalComplete === false,
    evidence: readyRun.reusableWorkflowRunnerReceiptPath
  },
  {
    name: "Reusable workflow repair approved gate runner blocks non-ready repair command builder",
    pass:
      blockedBuilder.status === "blocked_before_reusable_workflow_repair_approved_gate_runner" &&
      blockedBuilder.runnerInvoked === false &&
      blockedPacket.blockers.includes("repair_command_builder_not_ready_for_final_confirmation"),
    evidence: blockedPacket.blockers.join(",")
  },
  {
    name: "Reusable workflow repair approved gate runner preserves RAG non-authority locks",
    pass:
      readyRun.ragInformedRepairReuse === true &&
      readyRun.ragEvidenceTreatedAsAuthority === false &&
      readyRun.ragEvidenceNonAuthoritative === true &&
      readyPacket.ragInformedRepairReuse === true &&
      readyPacket.ragEvidenceNonAuthoritative === true &&
      readyPacket.locks.ragEvidenceNonAuthoritative === true &&
      readyPacket.locks.doesNotTreatRagAsAuthority === true &&
      readyReceipt.ragEvidenceNonAuthoritative === true,
    evidence: JSON.stringify(readyPacket.sourceEvidence)
  },
  {
    name: "Reusable workflow repair approved gate runner preserves provider role-use trace from command builder",
    pass:
      readyPacket.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
      "sha256:repair-reuse-provider-role-use-plan-smoke",
    evidence: JSON.stringify(readyPacket.sourceEvidence.providerRoleUsePlanTrace || {})
  },
  {
    name: "Reusable workflow repair approved gate runner preserves reasoning budget trace from command builder",
    pass:
      readyPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
      "sha256:repair-rebuild-reasoning-budget-governor-smoke",
    evidence: JSON.stringify(readyPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace || {})
  },
  {
    name: "Reusable workflow repair approved gate runner keeps fresh review memory rule packaging and completion locks",
    pass:
      readyPacket.locks.accepted === false &&
      readyPacket.locks.ruleEnabled === false &&
      readyPacket.locks.packagingGated === true &&
      readyPacket.locks.oneApprovedGateOnly === true &&
      readyPacket.locks.freshOutcomeReviewRequired === true &&
      readyPacket.locks.screenshotsCaptured === false &&
      readyPacket.locks.memoryWritten === false &&
      readyPacket.locks.nativeUniversalExecution === false &&
      readyPacket.locks.allSoftwareExecutionComplete === false &&
      readyPacket.locks.goalComplete === false,
    evidence: JSON.stringify(readyPacket.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke:
    "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_smoke_v1",
  passed,
  total: checks.length,
  noFlagPacketPath: noFlag.packetPath,
  readyPacketPath: readyRun.packetPath,
  blockedPacketPath: blockedBuilder.packetPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
