#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-reusable-workflow-activation-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
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
  providerRoleUsePlanHash: "sha256:reusable-workflow-provider-role-use-plan-smoke",
  nextGateSatisfied: true
};

const matchedOutcomeValidationPath = writeJson(join(smokeRoot, "matched-outcome-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_validation_v1",
  validationId: "tlcl-reusable-workflow-smoke-outcome-validation",
  status: "execution_outcome_matched_contract_waiting_for_rule_activation_review",
  decision: "executed_route_matched_contract",
  outcomeMatchedContract: true,
  matchedContractHandoff: {
    kind: "matched_contract_review_handoff",
    runtimeTransition: "one_medium_runtime_execution_result_waiting_for_teacher_rule_activation_review",
    sourceRunId: "tlcl-reusable-workflow-smoke-run",
    providerRoleUsePlanTrace,
    executesNow: false,
    memoryWriteAllowed: false,
    ruleEnablementAllowed: false
  },
  sourceEvidence: {
    runPath: join(smokeRoot, "tlcl-approved-gate-runner.json"),
    receiptPath: join(smokeRoot, "teacher-outcome-review-receipt.json"),
    providerRoleUsePlanTrace
  },
  locks: {
    doesNotEnableRules: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  }
});

const candidate = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-candidate-builder.mjs", [
  "--validation",
  matchedOutcomeValidationPath,
  "--out-dir",
  join(smokeRoot, "candidate")
]);
const template = readJson(candidate.receiptTemplatePath);
const approvalReceiptPath = writeJson(join(smokeRoot, "activation-approval-receipt.json"), {
  ...template,
  teacherDecision: "approve_medium_runtime_reuse",
  candidateReviewed: true,
  contractBoundaryReviewed: true,
  sourceOutcomeEvidenceReviewed: true,
  deterministicValidatorsStillRequiredConfirmed: true,
  approvalGateStillRequiredConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedBoundedReuse: true,
  blockedActionsConfirmed: true
});
const correctionReceiptPath = writeJson(join(smokeRoot, "activation-correction-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  blockedActionsConfirmed: true,
  teacherCorrection: "The reusable scope is too broad for future medium-runtime calls."
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "activation-forbidden-receipt.json"), {
  ...template,
  teacherDecision: "write_memory",
  blockedActionsConfirmed: true
});

const approval = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-activation-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  approvalReceiptPath,
  "--out-dir",
  join(smokeRoot, "activation")
]);
const correction = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-activation-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "activation")
]);
const forbidden = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-activation-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "activation")
]);
const approvalPacket = readJson(approval.validationPath);
const correctionPacket = readJson(correction.validationPath);
const candidatePacket = readJson(candidate.candidatePath);
const checks = [
  check(
    "Matched TLCL outcome can become a bounded medium-runtime workflow candidate",
    candidate.status === "reusable_workflow_candidate_ready_for_teacher_activation_review" &&
      candidate.mediumRuntimeReuseCandidate === true &&
      candidate.mediumRuntimeWorkflowEnabled === false &&
      candidate.ruleEnabled === false,
    candidate.candidatePath
  ),
  check(
    "Teacher approval enables only bounded medium-runtime workflow reuse",
    approval.status === "medium_runtime_workflow_reuse_allowed_for_bounded_contract" &&
      approval.mediumRuntimeWorkflowEnabled === true &&
      approval.workflowExecuted === false &&
      approval.targetSoftwareCommandsExecuted === false &&
      approval.memoryWritten === false &&
      approval.ruleEnabled === false &&
      approvalPacket.reusableWorkflowCard?.executionStillRequiresApprovalGate === true,
    approval.validationPath
  ),
  check(
    "Reusable workflow correction escalates back to high reasoning repair",
    correction.status === "escalate_to_high_reasoning_repair" &&
      correction.escalateToHighReasoningRepair === true &&
      correctionPacket.highReasoningRepairHandoff?.runtimeTransition ===
        "reusable_workflow_candidate_to_high_reasoning_contract_repair",
    correction.validationPath
  ),
  check(
    "Forbidden reusable workflow activation decisions are fail-closed",
    forbidden.status === "blocked_for_forbidden_decision" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.memoryWritten === false &&
      forbidden.ruleEnabled === false &&
      forbidden.goalComplete === false,
    forbidden.validationPath
  ),
  check(
    "Reusable workflow card preserves provider role-use trace from approved medium-runtime outcome",
    candidatePacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      candidatePacket.boundedReuseScope.providerRoleUsePlanTrace.providerRole === "medium_reasoning_runtime" &&
      approvalPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      approvalPacket.reusableWorkflowCard.providerRoleUsePlanTrace.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash,
    approval.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  candidatePath: candidate.candidatePath,
  approvalValidationPath: approval.validationPath,
  correctionValidationPath: correction.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
