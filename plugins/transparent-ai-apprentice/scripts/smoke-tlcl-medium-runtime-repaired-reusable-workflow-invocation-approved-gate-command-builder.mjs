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
  "tlcl-repaired-reusable-workflow-invocation-approved-gate-command-builder-smoke",
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

const prepSmoke = runNode("smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs");
const ready = runNode("create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs", [
  "--prep",
  prepSmoke.readyPacketPath,
  "--out-dir",
  join(smokeRoot, "ready")
]);
const readyWrapper = readJson(ready.wrapperPath);
const readyReceipt = readJson(ready.receiptPath);
const readyPrepPacket = readJson(prepSmoke.readyPacketPath);
const providerRoleUsePlanTrace = readyPrepPacket.providerRoleUsePlanTrace;
const reasoningBudgetGovernorReviewTrace = readyPrepPacket.reasoningBudgetGovernorReviewTrace;

const ragReady = runNode("create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs", [
  "--prep",
  prepSmoke.ragReadyPacketPath,
  "--out-dir",
  join(smokeRoot, "rag-ready")
]);
const ragReadyWrapper = readJson(ragReady.wrapperPath);
const ragReadyReceipt = readJson(ragReady.receiptPath);

const ragAuthorityPrep = {
  ...readJson(prepSmoke.ragReadyPacketPath),
  ragEvidenceTreatedAsAuthority: true
};
const ragAuthorityPrepPath = writeJson(join(smokeRoot, "rag-authority-approval-gate-prep-runner.json"), ragAuthorityPrep);
const ragAuthority = runNode("create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs", [
  "--prep",
  ragAuthorityPrepPath,
  "--out-dir",
  join(smokeRoot, "rag-authority")
]);
const ragAuthorityWrapper = readJson(ragAuthority.wrapperPath);

const blocked = runNode("create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs", [
  "--prep",
  prepSmoke.blockedPacketPath,
  "--out-dir",
  join(smokeRoot, "blocked")
]);
const blockedWrapper = readJson(blocked.wrapperPath);

const checks = [
  {
    name: "Ready repaired reusable workflow invocation approval prep reuses the existing command builder",
    pass:
      ready.status === "repaired_reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation" &&
      ready.readyForTeacherFinalConfirmation === true &&
      ready.reusedExistingReusableWorkflowCommandBuilder === true &&
      ready.reusableWorkflowCommandBuilderStatus ===
        "reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation" &&
      ready.approvedGateRunnerInvoked === false &&
      existsSync(ready.reusedExistingBuilderHtmlPath || "") &&
      ready.commandTemplate.includes("--execute-approved-gate") &&
      readyWrapper.generatedEvidence.reusedCommandBuilderWrapperPath === ready.reusedCommandBuilderWrapperPath,
    evidence: ready.reusedExistingBuilderHtmlPath
  },
  {
    name: "Repaired reusable workflow command builder preserves provider role-use trace from approval prep",
    pass:
      ready.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyWrapper.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyWrapper.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyReceipt.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash,
    evidence: JSON.stringify(readyWrapper.sourceEvidence.providerRoleUsePlanTrace)
  },
  {
    name: "Repaired reusable workflow command builder preserves reasoning budget trace from approval prep",
    pass:
      ready.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyWrapper.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyWrapper.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      readyReceipt.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash,
    evidence: JSON.stringify(readyWrapper.sourceEvidence.reasoningBudgetGovernorReviewTrace)
  },
  {
    name: "RAG-informed repaired reusable workflow command builder preserves non-authority locks",
    pass:
      ragReady.status ===
        "repaired_reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation" &&
      ragReady.readyForTeacherFinalConfirmation === true &&
      ragReady.ragInformedRepairReuse === true &&
      ragReady.ragEvidenceTreatedAsAuthority === false &&
      ragReady.ragEvidenceNonAuthoritative === true &&
      ragReadyWrapper.ragInformedRepairReuse === true &&
      ragReadyWrapper.ragEvidenceTreatedAsAuthority === false &&
      ragReadyWrapper.ragEvidenceNonAuthoritative === true &&
      ragReadyWrapper.locks.ragEvidenceNonAuthoritative === true &&
      ragReadyWrapper.locks.doesNotTreatRagAsAuthority === true &&
      ragReadyReceipt.ragEvidenceTreatedAsAuthority === false &&
      ragReadyReceipt.targetSoftwareCommandsExecuted === false &&
      ragReadyReceipt.memoryWritten === false,
    evidence: ragReady.wrapperPath
  },
  {
    name: "Treating RAG as authority blocks repaired invocation approved-gate command builder",
    pass:
      ragAuthority.status === "blocked_before_repaired_reusable_workflow_invocation_approved_gate_command_builder" &&
      ragAuthority.reusedExistingReusableWorkflowCommandBuilder === false &&
      ragAuthorityWrapper.blockers.includes("rag_informed_prep_treats_rag_as_authority") &&
      ragAuthorityWrapper.approvedGateRunnerInvoked === false &&
      ragAuthorityWrapper.locks.doesNotRunApprovedGateRunner === true,
    evidence: ragAuthorityWrapper.blockers.join(",")
  },
  {
    name: "Non-ready repaired reusable workflow invocation approval prep is blocked before command builder reuse",
    pass:
      blocked.status === "blocked_before_repaired_reusable_workflow_invocation_approved_gate_command_builder" &&
      blocked.reusedExistingReusableWorkflowCommandBuilder === false &&
      blockedWrapper.blockers.includes(
        "repaired_reusable_workflow_invocation_prep_status_not_ready_for_teacher_execute_review"
      ),
    evidence: blockedWrapper.blockers.join(",")
  },
  {
    name: "Repaired reusable workflow command builder keeps runner execution memory rule packaging and completion locks",
    pass:
      readyWrapper.locks.reviewOnly === true &&
      readyWrapper.locks.finalTeacherExecuteConfirmationStillRequired === true &&
      readyWrapper.locks.doesNotRunApprovedGateRunner === true &&
      readyWrapper.locks.doesNotRunMediumRuntimeWorkflow === true &&
      readyWrapper.locks.doesNotExecuteTargetSoftware === true &&
      readyWrapper.locks.doesNotWriteMemory === true &&
      readyWrapper.locks.doesNotEnableRules === true &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.memoryWritten === false &&
      readyReceipt.ruleEnabled === false &&
      readyReceipt.goalComplete === false,
    evidence: JSON.stringify(readyWrapper.locks)
  },
  {
    name: "Repaired reusable workflow command builder output remains review-only and packaging gated",
    pass:
      readyWrapper.format ===
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder_v1" &&
      readyWrapper.locks.accepted === false &&
      readyWrapper.locks.ruleEnabled === false &&
      readyWrapper.locks.packagingGated === true &&
      readyWrapper.locks.nativeUniversalExecution === false &&
      readyWrapper.locks.allSoftwareExecutionComplete === false &&
      readyWrapper.locks.goalComplete === false,
    evidence: ready.wrapperPath
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder_smoke_v1",
  passed,
  total: checks.length,
  readyWrapperPath: ready.wrapperPath,
  readyPackagePath: ready.wrapperPath,
  ragReadyWrapperPath: ragReady.wrapperPath,
  ragAuthorityWrapperPath: ragAuthority.wrapperPath,
  blockedWrapperPath: blocked.wrapperPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
