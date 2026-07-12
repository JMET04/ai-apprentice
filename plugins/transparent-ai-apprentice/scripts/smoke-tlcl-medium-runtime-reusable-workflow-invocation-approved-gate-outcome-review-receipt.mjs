#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-approved-gate-outcome-review-smoke", String(Date.now()));
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

const providerRoleUsePlanTrace = {
  inheritedFromPrep: true,
  requiredForScopedProvider: true,
  accepted: false,
  providerRole: "medium_reasoning_runtime",
  providerRoleUsePlanPath: join(smokeRoot, "tlcl-provider-role-use-plan.json"),
  providerRoleUsePlanHash: "sha256:reusable-outcome-provider-role-use-plan-smoke",
  nextGateSatisfied: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationId: "reasoning-budget-outcome-review-smoke-validation",
  validationHash: "sha256:reasoning-budget-outcome-review-smoke-validation",
  nextGateKind: "medium_reasoning_runtime_next_gate",
  recommendedTool: "create_tlcl_medium_runtime_reusable_workflow_invocation_planner",
  locks: {
    doesNotInvokeModel: true,
    doesNotRunMediumRuntime: true,
    doesNotExecuteTargetSoftware: true
  }
};

const existingReceiptPath = writeJson(join(smokeRoot, "existing-runner-receipt.json"), {
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
const runPath = writeJson(join(smokeRoot, "tlcl-reusable-workflow-approved-gate-runner.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_v1",
  runId: "tlcl-reusable-workflow-outcome-review-smoke-run",
  status: "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review",
  runnerInvoked: true,
  controlledRouteActionExecuted: true,
  targetSoftwareCommandsExecuted: true,
  uiEventsSent: false,
  sourceEvidence: {
    workflowFingerprint: "sha256:reusable-workflow-smoke",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  generatedEvidence: {
    existingRunnerReceiptPath: existingReceiptPath,
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
});

const builder = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs", [
  "--run",
  runPath,
  "--out-dir",
  join(smokeRoot, "builder")
]);
const template = readJson(builder.receiptTemplatePath);
const matchedReceiptPath = writeJson(join(smokeRoot, "matched-receipt.json"), {
  ...template,
  teacherDecision: "executed_route_matched_contract",
  runnerPacketReviewed: true,
  existingRunnerReceiptReviewed: true,
  adapterReceiptReviewed: true,
  outcomeVerificationReviewed: true,
  postActionCheckpointReviewed: true,
  rollbackPointStillRetained: true,
  teacherMatchedContract: true,
  reusableWorkflowInvocationReviewed: true,
  reusableWorkflowFingerprintReviewed: true,
  blockedActionsConfirmed: true
});
const correctionReceiptPath = writeJson(join(smokeRoot, "correction-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  blockedActionsConfirmed: true,
  teacherCorrection: "Reusable workflow reused the wrong parameter binding for the new target edge.",
  observedIssue: "Reusable workflow parameter binding mismatch.",
  affectedLogicFields: ["workflow.fingerprint", "route.commandTemplate", "rule.parameterBinding"]
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  ...template,
  teacherDecision: "enable_rule",
  blockedActionsConfirmed: true
});

const matchedValidation = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  runPath,
  "--receipt",
  matchedReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const correctionValidation = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  runPath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const forbiddenValidation = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  runPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const correctionPacket = readJson(correctionValidation.validationPath);
const matchedPacket = readJson(matchedValidation.validationPath);
const checks = [
  check(
    "Reusable workflow outcome review builder reuses existing TLCL outcome review builder without execution",
    builder.format ===
      "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_result_v1" &&
      builder.existingOutcomeReviewBuilderInvoked === true &&
      builder.doesNotRunApprovedGate === true &&
      builder.memoryWritten === false &&
      builder.goalComplete === false,
    builder.builderPath
  ),
  check(
    "Matched reusable workflow outcome stays review-only before reuse evidence promotion",
    matchedValidation.status === "reusable_workflow_invocation_outcome_matched_contract_waiting_for_reuse_review" &&
      matchedValidation.outcomeMatchedContract === true &&
      matchedValidation.memoryWritten === false &&
      matchedValidation.ruleEnabled === false &&
      matchedValidation.goalComplete === false,
    matchedValidation.validationPath
  ),
  check(
    "Reusable workflow correction escalates back to high reasoning contract repair",
    correctionValidation.status === "reusable_workflow_invocation_to_high_reasoning_contract_repair" &&
      correctionValidation.escalateToHighReasoningRepair === true &&
      correctionPacket.highReasoningRepairHandoff?.runtimeTransition ===
        "reusable_workflow_invocation_to_high_reasoning_contract_repair" &&
      correctionValidation.memoryWritten === false,
    correctionValidation.validationPath
  ),
  check(
    "Forbidden reusable workflow outcome review decisions are fail-closed",
    forbiddenValidation.status === "blocked_for_forbidden_reusable_workflow_outcome_review_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.targetSoftwareCommandsExecuted === false &&
      forbiddenValidation.memoryWritten === false,
    forbiddenValidation.validationPath
  ),
  check(
    "Reusable workflow outcome review preserves provider role-use trace for matched or repair paths",
    matchedPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
      providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      correctionPacket.highReasoningRepairHandoff.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash,
    matchedValidation.validationPath
  ),
  check(
    "Reusable workflow outcome review preserves reasoning budget trace for matched and high-reasoning repair paths",
    builder.controlledRouteActionExecuted === true &&
      matchedPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      correctionPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      correctionPacket.highReasoningRepairHandoff.reasoningBudgetGovernorReviewTrace.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash,
    correctionValidation.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_smoke_v1",
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
