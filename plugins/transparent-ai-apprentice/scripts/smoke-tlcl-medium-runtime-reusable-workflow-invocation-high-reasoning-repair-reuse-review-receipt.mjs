#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-repair-reuse-review-smoke", String(Date.now()));
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
  providerRoleUsePlanHash: "sha256:repair-reuse-review-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repair-reuse-review-reasoning-budget-governor-smoke",
  recommendedExecutionModel: "medium_runtime_reusable_workflow_executor",
  highReasoningRepairRequiredOnCorrection: true
};

const repairOutcomeValidationPath = writeJson(join(smokeRoot, "repair-outcome-validation.json"), {
  ok: true,
  format:
    "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_validation_v1",
  validationId: "repair-reuse-review-smoke-outcome-validation",
  status: "reusable_workflow_repair_invocation_outcome_matched_contract_waiting_for_reuse_review",
  decision: "executed_route_matched_contract",
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  outcomeMatchedContract: true,
  matchedRepairOutcomeHandoff: {
    kind: "reusable_workflow_repair_fresh_outcome_matched_contract_handoff",
    runtimeTransition: "repaired_reusable_workflow_fresh_outcome_waiting_for_reuse_review",
    sourceRepairRunId: "repair-reuse-review-smoke-run",
    executesNow: false,
    memoryWriteAllowed: false,
    ruleEnablementAllowed: false,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  sourceEvidence: {
    repairRunPath: join(smokeRoot, "repair-approved-gate-runner.json"),
    repairOutcomeReviewReceiptPath: join(smokeRoot, "repair-outcome-review-receipt.json"),
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
  "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-candidate-builder.mjs",
  ["--validation", repairOutcomeValidationPath, "--out-dir", join(smokeRoot, "candidate")]
);
const template = readJson(candidate.receiptTemplatePath);
const approvalReceiptPath = writeJson(join(smokeRoot, "repair-reuse-approval-receipt.json"), {
  ...template,
  teacherDecision: "approve_medium_runtime_reuse",
  candidateReviewed: true,
  contractBoundaryReviewed: true,
  sourceOutcomeEvidenceReviewed: true,
  deterministicValidatorsStillRequiredConfirmed: true,
  approvalGateStillRequiredConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedBoundedReuse: true,
  repairOutcomeValidationReviewed: true,
  repairedWorkflowBoundaryReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  ragEvidenceNonAuthoritativeConfirmed: true,
  blockedActionsConfirmed: true
});
const correctionReceiptPath = writeJson(join(smokeRoot, "repair-reuse-correction-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  repairOutcomeValidationReviewed: true,
  repairedWorkflowBoundaryReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  blockedActionsConfirmed: true,
  teacherCorrection: "The repaired workflow is still too broad for future material variants."
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "repair-reuse-forbidden-receipt.json"), {
  ...template,
  teacherDecision: "write_memory",
  repairOutcomeValidationReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  blockedActionsConfirmed: true
});
const ragAuthorityReceiptPath = writeJson(join(smokeRoot, "repair-reuse-rag-authority-receipt.json"), {
  ...template,
  teacherDecision: "approve_medium_runtime_reuse",
  candidateReviewed: true,
  contractBoundaryReviewed: true,
  sourceOutcomeEvidenceReviewed: true,
  deterministicValidatorsStillRequiredConfirmed: true,
  approvalGateStillRequiredConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedBoundedReuse: true,
  repairOutcomeValidationReviewed: true,
  repairedWorkflowBoundaryReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  blockedActionsConfirmed: true,
  ragEvidenceTreatedAsAuthority: true,
  ragEvidenceNonAuthoritative: true,
  ragEvidenceNonAuthoritativeConfirmed: true
});

const approval = runNode(
  "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
  ["--candidate", candidate.candidatePath, "--receipt", approvalReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const correction = runNode(
  "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
  ["--candidate", candidate.candidatePath, "--receipt", correctionReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const forbidden = runNode(
  "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
  ["--candidate", candidate.candidatePath, "--receipt", forbiddenReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const ragAuthority = runNode(
  "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
  ["--candidate", candidate.candidatePath, "--receipt", ragAuthorityReceiptPath, "--out-dir", join(smokeRoot, "validation")]
);
const approvalPacket = readJson(approval.validationPath);
const correctionPacket = readJson(correction.validationPath);
const candidatePacket = readJson(candidate.candidatePath);
const checks = [
  check(
    "Matched repaired fresh outcome can become a repair reuse review candidate",
    candidate.status === "reusable_workflow_repair_reuse_review_candidate_ready_for_teacher_review" &&
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
    "Repair reuse review candidate preserves provider role-use trace from matched repair outcome",
    candidatePacket.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
      providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      candidatePacket.defaultReceipt.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(candidatePacket.sourceEvidence.providerRoleUsePlanTrace || {})
  ),
  check(
    "Repair reuse review candidate preserves reasoning budget trace from matched repair outcome",
    candidatePacket.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
      reasoningBudgetGovernorReviewTrace.validationHash &&
      candidatePacket.defaultReceipt.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(candidatePacket.sourceEvidence.reasoningBudgetGovernorReviewTrace || {})
  ),
  check(
    "Teacher approval allows repaired reusable workflow only for later invocation planning",
    approval.status === "repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning" &&
      approval.mediumRuntimeWorkflowEnabled === true &&
      approval.ragInformedRepairReuse === true &&
      approval.ragEvidenceTreatedAsAuthority === false &&
      approval.ragEvidenceNonAuthoritative === true &&
      approval.workflowExecuted === false &&
      approval.targetSoftwareCommandsExecuted === false &&
      approval.memoryWritten === false &&
      approval.ruleEnabled === false &&
      approvalPacket.reusableWorkflowCard?.ragEvidenceNonAuthoritative === true &&
      approvalPacket.reusableWorkflowCard?.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      approvalPacket.reusableWorkflowCard?.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      approvalPacket.reusableWorkflowCard?.executionStillRequiresApprovalGate === true,
    approval.validationPath
  ),
  check(
    "Repair reuse review correction returns to high reasoning contract repair",
      correction.status === "repaired_reusable_workflow_reuse_review_to_high_reasoning_contract_repair" &&
      correction.escalateToHighReasoningRepair === true &&
      correction.ragInformedRepairReuse === true &&
      correctionPacket.highReasoningRepairHandoff?.ragEvidenceNonAuthoritative === true &&
      correctionPacket.highReasoningRepairHandoff?.runtimeTransition === "repair_reuse_review_to_high_reasoning_contract_repair",
    correction.validationPath
  ),
  check(
    "Forbidden repair reuse review decisions are fail-closed",
    forbidden.status === "blocked_for_forbidden_repaired_reusable_workflow_reuse_review_decision" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.memoryWritten === false &&
      forbidden.ruleEnabled === false &&
      forbidden.goalComplete === false,
    forbidden.validationPath
  ),
  check(
    "Treating RAG as authority during repair reuse review is fail-closed",
    ragAuthority.status === "repaired_reusable_workflow_reuse_review_needs_teacher_review_or_more_evidence" &&
      ragAuthority.blockers.includes("rag_informed_reuse_review_receipt_treats_rag_as_authority") &&
      ragAuthority.workflowExecuted === false &&
      ragAuthority.memoryWritten === false,
    ragAuthority.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_smoke_v1",
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
