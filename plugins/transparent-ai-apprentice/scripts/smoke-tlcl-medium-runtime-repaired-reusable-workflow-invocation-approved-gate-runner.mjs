#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-repaired-reusable-workflow-invocation-approved-gate-runner-smoke",
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const builderSmoke = runNode("smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs");
const readyBuilderWrapper = readJson(builderSmoke.readyWrapperPath);
const providerRoleUsePlanTrace = readyBuilderWrapper.providerRoleUsePlanTrace;
const reasoningBudgetGovernorReviewTrace = readyBuilderWrapper.reasoningBudgetGovernorReviewTrace;

const noFlag = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs", [
  "--builder",
  builderSmoke.readyWrapperPath,
  "--teacher-confirmation",
  "teacher confirmed tlcl repaired reusable workflow approved gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "no-flag")
]);
const noFlagPacket = readJson(noFlag.packetPath);

const readyRun = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs", [
  "--builder",
  builderSmoke.readyWrapperPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed tlcl repaired reusable workflow approved gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyPacket = readJson(readyRun.packetPath);
const readyReceipt = readJson(readyRun.receiptPath);

const ragReadyRun = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs", [
  "--builder",
  builderSmoke.ragReadyWrapperPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed tlcl repaired reusable workflow approved gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "rag-ready")
]);
const ragReadyPacket = readJson(ragReadyRun.packetPath);
const ragReadyReceipt = readJson(ragReadyRun.receiptPath);

const ragAuthorityBuilder = {
  ...readJson(builderSmoke.ragReadyWrapperPath),
  ragEvidenceTreatedAsAuthority: true
};
const ragAuthorityBuilderPath = writeJson(join(smokeRoot, "rag-authority-approved-gate-command-builder.json"), ragAuthorityBuilder);
const ragAuthority = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs", [
  "--builder",
  ragAuthorityBuilderPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed tlcl repaired reusable workflow approved gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "rag-authority")
]);
const ragAuthorityPacket = readJson(ragAuthority.packetPath);

const blockedBuilder = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs", [
  "--builder",
  builderSmoke.blockedWrapperPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed tlcl repaired reusable workflow approved gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "blocked-builder")
]);
const blockedPacket = readJson(blockedBuilder.packetPath);

const checks = [
  {
    name: "Repaired reusable workflow approved gate runner blocks without final execute flag",
    pass:
      noFlag.status === "blocked_before_repaired_reusable_workflow_invocation_approved_gate_runner" &&
      noFlag.runnerInvoked === false &&
      noFlagPacket.blockers.includes("missing_execute_approved_gate_flag"),
    evidence: noFlagPacket.blockers.join(",")
  },
  {
    name: "Ready repaired reusable workflow approved gate runner invokes the existing reusable workflow runner",
    pass:
      readyRun.status ===
        "repaired_reusable_workflow_invocation_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review" &&
      readyRun.runnerInvoked === true &&
      readyRun.controlledRouteActionExecuted === true &&
      readyRun.targetSoftwareCommandsExecuted === true &&
      existsSync(readyRun.reusableWorkflowRunnerReceiptPath || "") &&
      existsSync(readyRun.existingRunnerReceiptPath || "") &&
      existsSync(readyRun.adapterReceiptPath || "") &&
      existsSync(readyRun.outcomeVerificationPath || "") &&
      existsSync(readyRun.postActionCheckpointPath || "") &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.goalComplete === false,
    evidence: readyRun.reusableWorkflowRunnerReceiptPath
  },
  {
    name: "Repaired reusable workflow approved gate runner preserves provider role-use trace from command builder",
    pass:
      readyRun.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPacket.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPacket.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyReceipt.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash,
    evidence: JSON.stringify(readyPacket.sourceEvidence.providerRoleUsePlanTrace)
  },
  {
    name: "Repaired reusable workflow approved gate runner preserves reasoning budget trace from command builder",
    pass:
      readyRun.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyPacket.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      readyReceipt.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash,
    evidence: JSON.stringify(readyPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace)
  },
  {
    name: "RAG-informed repaired reusable workflow approved gate runner preserves non-authority locks",
    pass:
      ragReadyRun.status ===
        "repaired_reusable_workflow_invocation_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review" &&
      ragReadyRun.runnerInvoked === true &&
      ragReadyRun.controlledRouteActionExecuted === true &&
      ragReadyRun.ragInformedRepairReuse === true &&
      ragReadyRun.ragEvidenceTreatedAsAuthority === false &&
      ragReadyRun.ragEvidenceNonAuthoritative === true &&
      ragReadyPacket.ragInformedRepairReuse === true &&
      ragReadyPacket.ragEvidenceTreatedAsAuthority === false &&
      ragReadyPacket.ragEvidenceNonAuthoritative === true &&
      ragReadyPacket.locks.ragEvidenceNonAuthoritative === true &&
      ragReadyPacket.locks.doesNotTreatRagAsAuthority === true &&
      ragReadyReceipt.ragEvidenceTreatedAsAuthority === false &&
      ragReadyReceipt.memoryWritten === false &&
      ragReadyReceipt.ruleEnabled === false,
    evidence: ragReadyRun.packetPath
  },
  {
    name: "Treating RAG as authority blocks repaired invocation approved gate runner",
    pass:
      ragAuthority.status === "blocked_before_repaired_reusable_workflow_invocation_approved_gate_runner" &&
      ragAuthority.runnerInvoked === false &&
      ragAuthorityPacket.blockers.includes("rag_informed_command_builder_treats_rag_as_authority") &&
      ragAuthorityPacket.targetSoftwareCommandsExecuted !== true &&
      ragAuthorityPacket.memoryWritten !== true,
    evidence: ragAuthorityPacket.blockers.join(",")
  },
  {
    name: "Repaired reusable workflow approved gate runner blocks non-ready repaired command builder",
    pass:
      blockedBuilder.status === "blocked_before_repaired_reusable_workflow_invocation_approved_gate_runner" &&
      blockedBuilder.runnerInvoked === false &&
      blockedPacket.blockers.includes("repaired_reusable_workflow_command_builder_not_ready_for_final_confirmation"),
    evidence: blockedPacket.blockers.join(",")
  },
  {
    name: "Repaired reusable workflow approved gate runner keeps fresh review memory rule packaging and completion locks",
    pass:
      readyPacket.locks.accepted === false &&
      readyPacket.locks.ruleEnabled === false &&
      readyPacket.locks.packagingGated === true &&
      readyPacket.locks.oneApprovedGateOnly === true &&
      readyPacket.locks.freshOutcomeReviewRequired === true &&
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
  smoke: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_smoke_v1",
  passed,
  total: checks.length,
  noFlagPacketPath: noFlag.packetPath,
  readyPacketPath: readyRun.packetPath,
  ragReadyPacketPath: ragReadyRun.packetPath,
  ragAuthorityPacketPath: ragAuthority.packetPath,
  blockedPacketPath: blockedBuilder.packetPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
