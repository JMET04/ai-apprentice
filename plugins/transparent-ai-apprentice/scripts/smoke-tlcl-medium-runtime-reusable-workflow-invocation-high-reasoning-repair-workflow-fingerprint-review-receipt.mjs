#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-repair-fingerprint-review-smoke", String(Date.now()));
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const providerRoleUsePlanTrace = {
  providerRoleUsePlanHash: "sha256:repair-fingerprint-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repair-fingerprint-reasoning-budget-governor-smoke",
  recommendedExecutionModel: "medium_runtime_reusable_workflow_executor",
  highReasoningRepairRequiredOnCorrection: true
};

const readyIntakePath = writeJson(join(smokeRoot, "ready-intake.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_v1",
  intakeId: "tlcl-reusable-workflow-repair-fingerprint-review-smoke",
  status: "reusable_workflow_high_reasoning_repair_intake_ready",
  readyForHighReasoningCompile: true,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  sourceEvidence: {
    workflowFingerprint: "sha256:old-workflow-fingerprint",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse: true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: true
  },
  repairContext: {
    runtimeTransition: "reusable_workflow_invocation_to_high_reasoning_contract_repair",
    teacherDecision: "correction_to_high_reasoning_repair",
    ragInformedRepairReuse: true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: true,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    teacherCorrection: "Reusable workflow used stale angle and dimension binding.",
    observedIssue: "The repaired logic must bind dimension and angle before retry.",
    affectedLogicFields: ["workflow.fingerprint", "rule.dimensionBinding", "rule.angleBinding"],
    evidenceToInspect: [join(smokeRoot, "run.json"), join(smokeRoot, "adapter-receipt.json")],
    repairTasks: ["Repair Rule DSL and validator expectations."]
  },
  locks: {
    mediumRuntimeContinuationBlocked: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const draftResult = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs", [
  "--intake",
  readyIntakePath,
  "--out-dir",
  join(smokeRoot, "draft-packages")
]);
const approvedDraftReviewReceiptPath = writeJson(join(smokeRoot, "approved-draft-review-receipt.json"), {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_receipt_v1",
  teacherDecision: "approve_repair_for_regression_validation",
  draftPackageReviewed: true,
  draftDisabledRulesReviewed: true,
  compiledDisabledRulePackageReviewed: true,
  teacherCorrectionPreserved: true,
  affectedLogicFieldsReviewed: true,
  regressionValidationPlanReviewed: true,
  deterministicValidationStillRequiredConfirmed: true,
  mediumRuntimeRetryStillBlockedConfirmed: true,
  rollbackPointStillRetained: true,
  ragEvidenceNonAuthoritativeConfirmed: true,
  teacherApprovedRegressionValidation: true,
  blockedActionsConfirmed: true
});
const draftReviewResult = runNode(
  "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs",
  ["--draft-package", draftResult.draftPackagePath, "--receipt", approvedDraftReviewReceiptPath, "--out-dir", join(smokeRoot, "draft-review")]
);
const regressionResult = runNode(
  "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs",
  ["--review-validation", draftReviewResult.validationPath, "--out-dir", join(smokeRoot, "regression-validation")]
);
const approvedFingerprintReceiptPath = writeJson(join(smokeRoot, "approved-fingerprint-review-receipt.json"), {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_receipt_v1",
  teacherDecision: "approve_fingerprint_for_approval_gate_rebuild",
  regressionValidationReviewed: true,
  validationReportReviewed: true,
  draftDisabledLifecycleReviewed: true,
  workflowFingerprintReviewed: true,
  workflowFingerprintBefore: "sha256:old-workflow-fingerprint",
  workflowFingerprintAfter: "sha256:repaired-workflow-fingerprint",
  fingerprintChanged: true,
  proposedRepairTargetsReviewed: true,
  proposedRepairTargets: ["workflow.fingerprint", "rule.dimensionBinding", "rule.angleBinding"],
  routeSemanticsReviewed: true,
  routeSemanticsDecision: "teacher_reviewed_repaired_route_semantics",
  approvalGateRebuildStillRequiredConfirmed: true,
  freshOutcomeReviewStillRequiredConfirmed: true,
  mediumRuntimeRetryStillBlockedConfirmed: true,
  rollbackPointStillRetained: true,
  ragEvidenceNonAuthoritativeConfirmed: true,
  teacherApprovedFingerprintReview: true,
  blockedActionsConfirmed: true
});
const forbiddenFingerprintReceiptPath = writeJson(join(smokeRoot, "forbidden-fingerprint-review-receipt.json"), {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_receipt_v1",
  teacherDecision: "run_medium_runtime",
  blockedActionsConfirmed: true
});

const ready = runNode(
  "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
  [
    "--regression-validation-package",
    regressionResult.validationPackagePath,
    "--receipt",
    approvedFingerprintReceiptPath,
    "--out-dir",
    join(smokeRoot, "fingerprint-review")
  ]
);
const forbidden = runNode(
  "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
  [
    "--regression-validation-package",
    regressionResult.validationPackagePath,
    "--receipt",
    forbiddenFingerprintReceiptPath,
    "--out-dir",
    join(smokeRoot, "fingerprint-review")
  ]
);
const readyValidation = readJson(ready.validationPath);
const checks = [
  check(
    "Reusable workflow repair fingerprint review prepares only approval gate rebuild handoff",
      ready.status === "reusable_workflow_repair_fingerprint_review_ready_for_approval_gate_rebuild" &&
      ready.readyForApprovalGateRebuild === true &&
      ready.ragInformedRepairReuse === true &&
      ready.ragEvidenceTreatedAsAuthority === false &&
      ready.ragEvidenceNonAuthoritative === true &&
      readyValidation.approvalGateRebuildHandoff?.runtimeTransition === "repair_fingerprint_review_to_approval_gate_rebuild" &&
      readyValidation.approvalGateRebuildHandoff?.ragEvidenceNonAuthoritative === true &&
      readyValidation.approvalGateRebuildHandoff?.fingerprintChanged === true,
    JSON.stringify(readyValidation.approvalGateRebuildHandoff)
  ),
  check(
    "Reusable workflow repair fingerprint review preserves RAG non-authority locks",
    readyValidation.ragInformedRepairReuse === true &&
      readyValidation.ragEvidenceTreatedAsAuthority === false &&
      readyValidation.ragEvidenceNonAuthoritative === true &&
      readyValidation.locks.ragEvidenceNonAuthoritative === true &&
      readyValidation.locks.doesNotTreatRagAsAuthority === true &&
      readyValidation.blockedTransitions.includes("treat_rag_as_authority_from_fingerprint_review"),
    JSON.stringify(readyValidation.sourceEvidence)
  ),
  check(
    "Reusable workflow repair fingerprint review preserves provider role-use trace for approval gate rebuild",
    readyValidation.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
      providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyValidation.approvalGateRebuildHandoff?.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(readyValidation.approvalGateRebuildHandoff?.providerRoleUsePlanTrace || {})
  ),
  check(
    "Reusable workflow repair fingerprint review preserves reasoning budget trace for approval gate rebuild",
    readyValidation.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
      reasoningBudgetGovernorReviewTrace.validationHash &&
      readyValidation.approvalGateRebuildHandoff?.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(readyValidation.approvalGateRebuildHandoff?.reasoningBudgetGovernorReviewTrace || {})
  ),
  check(
    "Reusable workflow repair fingerprint review keeps medium runtime and approval gate blocked",
    ready.mediumRuntimeRetryAllowed === false &&
      ready.approvedGateRunnerInvoked === false &&
      readyValidation.locks.doesNotRunMediumRuntime === true &&
      readyValidation.locks.doesNotRebuildApprovalGate === true &&
      readyValidation.locks.approvalGateRebuildStillRequired === true,
    JSON.stringify(readyValidation.locks)
  ),
  check(
    "Reusable workflow repair fingerprint review blocks forbidden execution and rule enablement",
    forbidden.status === "blocked_for_forbidden_repair_fingerprint_review_decision" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.mediumRuntimeRetryAllowed === false &&
      forbidden.ruleEnabled === false,
    JSON.stringify(forbidden.blockers)
  ),
  check(
    "Reusable workflow repair fingerprint review keeps memory packaging and completion locks",
    ready.targetSoftwareCommandsExecuted === false &&
      ready.screenshotsCaptured === false &&
      ready.memoryWritten === false &&
      ready.accepted === false &&
      ready.ruleEnabled === false &&
      ready.packagingGated === true &&
      ready.goalComplete === false,
    JSON.stringify(readyValidation.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyValidationPath: ready.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
