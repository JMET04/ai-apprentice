#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-repaired-reusable-workflow-invocation-reuse-review-smoke", String(Date.now()));
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
  providerRoleUsePlanHash: "sha256:repaired-invocation-reuse-review-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repaired-invocation-reasoning-budget-governor-smoke",
  highReasoningCompileRequiredForLogicChanges: true,
  mediumReasoningRuntimeAllowedAfterTeacherApproval: true,
  correctionReturnsToHighReasoningRepair: true
};
const repairedOutcomeValidationPath = writeJson(join(smokeRoot, "repaired-invocation-outcome-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
  validationId: "repaired-invocation-reuse-review-smoke-outcome-validation",
  status: "repaired_reusable_workflow_invocation_outcome_matched_contract_waiting_for_reuse_review",
  decision: "executed_route_matched_contract",
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  outcomeMatchedContract: true,
  matchedOutcomeHandoff: {
    kind: "repaired_reusable_workflow_invocation_fresh_outcome_matched_contract_handoff",
    runtimeTransition: "repaired_reusable_workflow_invocation_waiting_for_reuse_review",
    sourceRepairedRunId: "repaired-invocation-reuse-review-smoke-run",
    executesNow: false,
    memoryWriteAllowed: false,
    ruleEnablementAllowed: false,
    ragInformedRepairReuse: true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: true,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  sourceEvidence: {
    ragInformedRepairReuse: true,
    repairedRunPath: join(smokeRoot, "repaired-approved-gate-runner.json"),
    repairedOutcomeReviewReceiptPath: join(smokeRoot, "repaired-outcome-review-receipt.json"),
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  locks: {
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    doesNotEnableRules: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  }
});

const candidate = runNode(
  "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-candidate-builder.mjs",
  ["--validation", repairedOutcomeValidationPath, "--out-dir", join(smokeRoot, "candidate")]
);
const candidatePacket = readJson(candidate.candidatePath);
const template = readJson(candidate.receiptTemplatePath);
const approvalReceiptPath = writeJson(join(smokeRoot, "repaired-invocation-reuse-approval-receipt.json"), {
  ...template,
  teacherDecision: "approve_medium_runtime_reuse",
  candidateReviewed: true,
  contractBoundaryReviewed: true,
  sourceOutcomeEvidenceReviewed: true,
  deterministicValidatorsStillRequiredConfirmed: true,
  approvalGateStillRequiredConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedBoundedReuse: true,
  repairedInvocationOutcomeValidationReviewed: true,
  repairedWorkflowBoundaryReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  ragEvidenceNonAuthoritativeConfirmed: true,
  blockedActionsConfirmed: true
});
const correctionReceiptPath = writeJson(join(smokeRoot, "repaired-invocation-reuse-correction-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  repairedInvocationOutcomeValidationReviewed: true,
  repairedWorkflowBoundaryReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  blockedActionsConfirmed: true,
  teacherCorrection: "The repaired invocation still misses a data dependency for future variants."
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "repaired-invocation-reuse-forbidden-receipt.json"), {
  ...template,
  teacherDecision: "enable_rule",
  repairedInvocationOutcomeValidationReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  blockedActionsConfirmed: true
});
const ragAuthorityReceiptPath = writeJson(join(smokeRoot, "repaired-invocation-reuse-rag-authority-receipt.json"), {
  ...template,
  teacherDecision: "approve_medium_runtime_reuse",
  candidateReviewed: true,
  contractBoundaryReviewed: true,
  sourceOutcomeEvidenceReviewed: true,
  deterministicValidatorsStillRequiredConfirmed: true,
  approvalGateStillRequiredConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedBoundedReuse: true,
  repairedInvocationOutcomeValidationReviewed: true,
  repairedWorkflowBoundaryReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  blockedActionsConfirmed: true,
  ragEvidenceTreatedAsAuthority: true,
  ragEvidenceNonAuthoritative: true,
  ragEvidenceNonAuthoritativeConfirmed: true
});

const approval = runNode(
  "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
  ["--candidate", candidate.candidatePath, "--receipt", approvalReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const correction = runNode(
  "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
  ["--candidate", candidate.candidatePath, "--receipt", correctionReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const forbidden = runNode(
  "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
  ["--candidate", candidate.candidatePath, "--receipt", forbiddenReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const ragAuthority = runNode(
  "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
  ["--candidate", candidate.candidatePath, "--receipt", ragAuthorityReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const approvalPacket = readJson(approval.validationPath);
const correctionPacket = readJson(correction.validationPath);

const planner = runNode("scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs", [
  "--validation",
  approval.validationPath,
  "--reuse-context",
  JSON.stringify({
    teacherDecision: "invoke_medium_runtime_reuse",
    workflowFingerprint: approvalPacket.reusableWorkflowCard.workflowFingerprint,
    deterministicValidatorsPassed: true,
    approvalGateStillRequiredConfirmed: true,
    rollbackPointStillRetained: true,
    teacherReviewedReuseIntent: true,
    freshOutcomeReviewPlanned: true
  }),
  "--out-dir",
  join(smokeRoot, "planner")
]);

const checks = [
  check(
    "Matched repaired invocation outcome can become a reuse review candidate",
    candidate.status === "repaired_reusable_workflow_invocation_reuse_review_candidate_ready_for_teacher_review" &&
      candidate.reusedCandidateBuilderInvoked === true &&
      candidate.ragInformedRepairReuse === true &&
      candidate.ragEvidenceTreatedAsAuthority === false &&
      candidate.ragEvidenceNonAuthoritative === true &&
      candidate.mediumRuntimeReuseCandidate === true &&
      candidate.mediumRuntimeWorkflowEnabled === false &&
      candidate.memoryWritten === false,
    candidate.candidatePath
  ),
  check(
    "Repaired invocation reuse review candidate preserves provider role-use trace",
    candidate.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      candidatePacket.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      candidatePacket.defaultReceipt.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      template.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(candidatePacket.sourceEvidence.providerRoleUsePlanTrace)
  ),
  check(
    "Repaired invocation reuse review candidate preserves reasoning budget trace",
    candidate.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      candidatePacket.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      candidatePacket.defaultReceipt.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      template.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(candidatePacket.sourceEvidence.reasoningBudgetGovernorReviewTrace)
  ),
  check(
    "Teacher approval allows repaired invocation reuse only for later invocation planning",
    approval.status === "repaired_reusable_workflow_invocation_reuse_review_allowed_waiting_for_next_invocation_planning" &&
      approval.mediumRuntimeWorkflowEnabled === true &&
      approval.ragInformedRepairReuse === true &&
      approval.ragEvidenceTreatedAsAuthority === false &&
      approval.ragEvidenceNonAuthoritative === true &&
      approval.workflowExecuted === false &&
      approval.targetSoftwareCommandsExecuted === false &&
      approval.memoryWritten === false &&
      approval.ruleEnabled === false &&
      approvalPacket.reusableWorkflowCard?.ragInformedRepairReuse === true &&
      approvalPacket.reusableWorkflowCard?.ragEvidenceNonAuthoritative === true &&
      approvalPacket.reusableWorkflowCard?.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      approvalPacket.reusableWorkflowCard?.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      approvalPacket.reusableWorkflowCard?.executionStillRequiresApprovalGate === true,
    approval.validationPath
  ),
  check(
    "Approved repaired invocation reuse review can feed the repaired invocation planner",
      planner.status === "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning" &&
      planner.invocationReady === true &&
      planner.ragInformedRepairReuse === true &&
      planner.ragEvidenceTreatedAsAuthority === false &&
      planner.ragEvidenceNonAuthoritative === true &&
      planner.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      planner.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      planner.workflowExecuted === false &&
      planner.targetSoftwareCommandsExecuted === false &&
      planner.memoryWritten === false &&
      planner.ruleEnabled === false,
    planner.wrapperPath
  ),
  check(
    "Repaired invocation reuse review correction returns to high reasoning contract repair",
      correction.status === "repaired_reusable_workflow_invocation_reuse_review_to_high_reasoning_contract_repair" &&
      correction.escalateToHighReasoningRepair === true &&
      correction.ragInformedRepairReuse === true &&
      correctionPacket.highReasoningRepairHandoff?.ragEvidenceNonAuthoritative === true &&
      correctionPacket.highReasoningRepairHandoff?.runtimeTransition ===
        "repaired_invocation_reuse_review_to_high_reasoning_contract_repair",
    correction.validationPath
  ),
  check(
    "Forbidden repaired invocation reuse review decisions are fail-closed",
    forbidden.status === "blocked_for_forbidden_repaired_reusable_workflow_invocation_reuse_review_decision" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.memoryWritten === false &&
      forbidden.ruleEnabled === false &&
      forbidden.goalComplete === false,
    forbidden.validationPath
  ),
  check(
    "Treating RAG as authority during repaired invocation reuse review is fail-closed",
    ragAuthority.status === "repaired_reusable_workflow_invocation_reuse_review_needs_teacher_review_or_more_evidence" &&
      ragAuthority.blockers.includes("rag_informed_repaired_invocation_reuse_receipt_treats_rag_as_authority") &&
      ragAuthority.workflowExecuted === false &&
      ragAuthority.memoryWritten === false,
    ragAuthority.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  candidatePath: candidate.candidatePath,
  approvalValidationPath: approval.validationPath,
  correctionValidationPath: correction.validationPath,
  plannerWrapperPath: planner.wrapperPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
