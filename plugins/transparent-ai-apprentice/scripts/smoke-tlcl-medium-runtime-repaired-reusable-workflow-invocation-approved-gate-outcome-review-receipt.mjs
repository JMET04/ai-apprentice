#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-repaired-reusable-workflow-outcome-review-smoke",
  String(Date.now())
);
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const existingRunnerPacketPath = writeJson(join(smokeRoot, "existing-runner-packet.json"), {
  format: "transparent_ai_all_software_execution_approved_gate_runner_v1",
  status: "approved_gate_controlled_route_completed_waiting_for_teacher_review"
});
const existingRunnerReceiptPath = writeJson(join(smokeRoot, "existing-runner-receipt.json"), {
  format: "transparent_ai_all_software_execution_approved_gate_runner_receipt_v1",
  status: "approved_gate_controlled_route_completed_waiting_for_teacher_review"
});
const adapterReceiptPath = writeJson(join(smokeRoot, "adapter-receipt.json"), {
  format: "transparent_ai_existing_software_execution_receipt_v1",
  status: "teacher_confirmed_cli_script_executed",
  commandExecuted: true
});
const outcomeVerificationPath = writeJson(join(smokeRoot, "outcome-verification.json"), {
  format: "transparent_ai_supervised_action_outcome_verification_v1",
  status: "waiting_for_supervised_outcome_review"
});
const checkpointPath = writeJson(join(smokeRoot, "post-action-checkpoint.json"), {
  format: "transparent_ai_post_action_evidence_checkpoint_v1",
  status: "checkpoint_waiting_for_teacher_review"
});
const providerRoleUsePlanTrace = {
  providerRoleUsePlanHash: "sha256:repaired-invocation-outcome-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repaired-invocation-reasoning-budget-governor-smoke",
  highReasoningCompileRequiredForLogicChanges: true,
  mediumReasoningRuntimeAllowedAfterTeacherApproval: true,
  correctionReturnsToHighReasoningRepair: true
};
const reusedRunnerResult = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_result_v1",
  runId: "reused-runner-after-repaired-invocation-smoke",
  status: "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review",
  runnerInvoked: true,
  controlledRouteActionExecuted: true,
  targetSoftwareCommandsExecuted: true,
  uiEventsSent: false,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  sourceEvidence: {
    workflowFingerprint: "sha256:repaired-reuse-outcome-review-smoke",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  generatedEvidence: {
    existingRunnerPacketPath,
    existingRunnerReceiptPath,
    adapterReceiptPath,
    outcomeVerificationPath,
    postActionCheckpointPath: checkpointPath
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  }
};
const repairedRunPath = writeJson(join(smokeRoot, "tlcl-repaired-reusable-workflow-approved-gate-runner.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_v1",
  runId: "repaired-reusable-workflow-approved-gate-runner-smoke",
  status: "repaired_reusable_workflow_invocation_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review",
  runnerInvoked: true,
  controlledRouteActionExecuted: true,
  targetSoftwareCommandsExecuted: true,
  uiEventsSent: false,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  sourceEvidence: {
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  generatedEvidence: {
    reusableWorkflowRunnerResult: reusedRunnerResult,
    reusableWorkflowRunnerPacketPath: join(smokeRoot, "reused-runner-packet.json"),
    reusableWorkflowRunnerReceiptPath: join(smokeRoot, "reused-runner-receipt.json"),
    existingRunnerPacketPath,
    existingRunnerReceiptPath,
    adapterReceiptPath,
    outcomeVerificationPath,
    postActionCheckpointPath: checkpointPath
  },
  locks: {
    freshOutcomeReviewRequired: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  }
});

const builder = runNode(
  "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs",
  ["--run", repairedRunPath, "--out-dir", join(smokeRoot, "builder")]
);
const template = readJson(builder.receiptTemplatePath);
const matchedReceiptPath = writeJson(join(smokeRoot, "matched-repaired-outcome-receipt.json"), {
  ...template,
  teacherDecision: "executed_route_matched_contract",
  runnerPacketReviewed: true,
  existingRunnerReceiptReviewed: true,
  adapterReceiptReviewed: true,
  outcomeVerificationReviewed: true,
  postActionCheckpointReviewed: true,
  rollbackPointStillRetained: true,
  teacherMatchedContract: true,
  repairedRunnerPacketReviewed: true,
  reusedWorkflowRunnerPacketReviewed: true,
  repairedRouteOutcomeReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  ragEvidenceNonAuthoritativeReviewed: true,
  reusableWorkflowInvocationReviewed: true,
  reusableWorkflowFingerprintReviewed: true,
  blockedActionsConfirmed: true
});
const correctionReceiptPath = writeJson(join(smokeRoot, "correction-repaired-outcome-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  repairedRunnerPacketReviewed: true,
  reusedWorkflowRunnerPacketReviewed: true,
  repairedRouteOutcomeReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  ragEvidenceNonAuthoritativeReviewed: true,
  blockedActionsConfirmed: true,
  teacherCorrection: "The repaired reusable workflow still binds angle to the old field.",
  observedIssue: "Fresh repaired outcome has an angle mismatch.",
  affectedLogicFields: ["rule.angleConstraint", "workflow.parameterBinding", "validator.routeGeometry"]
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-repaired-outcome-receipt.json"), {
  ...template,
  teacherDecision: "enable_rule",
  repairedRunnerPacketReviewed: true,
  blockedActionsConfirmed: true
});

const matchedValidation = runNode(
  "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
  ["--run", repairedRunPath, "--receipt", matchedReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const matchedPacket = readJson(matchedValidation.validationPath);
const correctionValidation = runNode(
  "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
  ["--run", repairedRunPath, "--receipt", correctionReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const forbiddenValidation = runNode(
  "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
  ["--run", repairedRunPath, "--receipt", forbiddenReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const correctionPacket = readJson(correctionValidation.validationPath);
const checks = [
  check(
    "Repaired reusable workflow outcome review builder reuses existing reusable workflow outcome review builder without execution",
    builder.format ===
      "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_result_v1" &&
    builder.status === "repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use" &&
      builder.reusedOutcomeReviewBuilderInvoked === true &&
      builder.ragInformedRepairReuse === true &&
      builder.ragEvidenceTreatedAsAuthority === false &&
      builder.ragEvidenceNonAuthoritative === true &&
      builder.doesNotRunApprovedGate === true &&
      builder.memoryWritten === false &&
      builder.goalComplete === false,
    builder.builderPath
  ),
  check(
    "Matched repaired reusable workflow fresh outcome stays review-only before reuse review",
    matchedValidation.status === "repaired_reusable_workflow_invocation_outcome_matched_contract_waiting_for_reuse_review" &&
      matchedValidation.outcomeMatchedContract === true &&
      matchedValidation.ragInformedRepairReuse === true &&
      matchedValidation.ragEvidenceTreatedAsAuthority === false &&
      matchedValidation.ragEvidenceNonAuthoritative === true &&
      matchedValidation.memoryWritten === false &&
      matchedValidation.ruleEnabled === false &&
      matchedValidation.goalComplete === false,
    matchedValidation.validationPath
  ),
  check(
    "Repaired reusable workflow fresh outcome preserves provider role-use trace for reuse review and repair",
    builder.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      template.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      matchedPacket.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      matchedPacket.matchedOutcomeHandoff?.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      correctionPacket.highReasoningRepairHandoff?.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(matchedPacket.sourceEvidence.providerRoleUsePlanTrace)
  ),
  check(
    "Repaired invocation fresh outcome preserves reasoning budget trace for reuse review and repair",
    builder.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      template.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      matchedPacket.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      matchedPacket.matchedOutcomeHandoff?.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      correctionPacket.highReasoningRepairHandoff?.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(matchedPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace)
  ),
  check(
    "RAG-informed repaired reusable workflow fresh outcome preserves non-authority locks",
    builder.ragInformedRepairReuse === true &&
      builder.ragEvidenceTreatedAsAuthority === false &&
      builder.ragEvidenceNonAuthoritative === true &&
      matchedValidation.ragInformedRepairReuse === true &&
      matchedValidation.ragEvidenceTreatedAsAuthority === false &&
      matchedValidation.ragEvidenceNonAuthoritative === true &&
      correctionPacket.highReasoningRepairHandoff?.ragEvidenceTreatedAsAuthority === false &&
      correctionPacket.highReasoningRepairHandoff?.ragEvidenceNonAuthoritative === true,
    matchedValidation.validationPath
  ),
  check(
    "Fresh repaired reusable workflow correction returns to high reasoning repair",
    correctionValidation.status === "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair" &&
      correctionValidation.escalateToHighReasoningRepair === true &&
      correctionPacket.highReasoningRepairHandoff?.runtimeTransition ===
        "repaired_reusable_workflow_fresh_outcome_to_high_reasoning_contract_repair" &&
      correctionPacket.highReasoningRepairHandoff?.ragInformedRepairReuse === true &&
      correctionPacket.highReasoningRepairHandoff?.ragEvidenceTreatedAsAuthority === false &&
      correctionPacket.highReasoningRepairHandoff?.ragEvidenceNonAuthoritative === true &&
      correctionValidation.memoryWritten === false,
    correctionValidation.validationPath
  ),
  check(
    "Forbidden repaired reusable workflow outcome review decisions are fail-closed",
    forbiddenValidation.status === "blocked_for_forbidden_repaired_reusable_workflow_outcome_review_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.targetSoftwareCommandsExecuted === false &&
      forbiddenValidation.memoryWritten === false,
    forbiddenValidation.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  builderPath: builder.builderPath,
  matchedValidationPath: matchedValidation.validationPath,
  correctionValidationPath: correctionValidation.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
