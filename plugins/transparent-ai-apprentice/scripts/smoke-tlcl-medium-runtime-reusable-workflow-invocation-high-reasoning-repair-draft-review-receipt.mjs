#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-repair-draft-review-smoke", String(Date.now()));
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
  providerRoleUsePlanHash: "sha256:repair-draft-review-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repair-draft-review-reasoning-budget-governor-smoke",
  recommendedExecutionModel: "medium_runtime_reusable_workflow_executor",
  highReasoningRepairRequiredOnCorrection: true
};

const readyIntakePath = writeJson(join(smokeRoot, "ready-intake.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_v1",
  intakeId: "tlcl-reusable-workflow-repair-draft-review-smoke",
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
    teacherCorrection: "Reusable workflow used the old dieline offset after the carton size changed.",
    observedIssue: "Old offset logic was reused for a changed parameter.",
    affectedLogicFields: ["workflow.fingerprint", "rule.dimensionBinding", "route.commandTemplate"],
    evidenceToInspect: [join(smokeRoot, "run.json"), join(smokeRoot, "adapter-receipt.json")],
    repairTasks: ["Repair the Rule DSL and validator expectations."]
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
const approvedReceiptPath = writeJson(join(smokeRoot, "approved-review-receipt.json"), {
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
  blockedActionsConfirmed: true,
  teacherNote: "Repair draft can move to deterministic regression validation only."
});
const correctionReceiptPath = writeJson(join(smokeRoot, "correction-review-receipt.json"), {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_receipt_v1",
  teacherDecision: "needs_more_high_reasoning_repair",
  teacherCorrection: "The angle relationship is still missing from the repaired logic.",
  blockedActionsConfirmed: true
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-review-receipt.json"), {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_receipt_v1",
  teacherDecision: "enable_rule",
  blockedActionsConfirmed: true
});

const approved = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs", [
  "--draft-package",
  draftResult.draftPackagePath,
  "--receipt",
  approvedReceiptPath,
  "--out-dir",
  join(smokeRoot, "review-validations")
]);
const correction = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs", [
  "--draft-package",
  draftResult.draftPackagePath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "review-validations")
]);
const forbidden = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs", [
  "--draft-package",
  draftResult.draftPackagePath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "review-validations")
]);
const approvedValidation = readJson(approved.validationPath);
const correctionValidation = readJson(correction.validationPath);
const draftPackage = readJson(draftResult.draftPackagePath);
const checks = [
  check(
    "Reusable workflow repair draft review approves only deterministic regression validation handoff",
      approved.status === "reusable_workflow_repair_draft_ready_for_deterministic_regression_validation" &&
      approved.readyForDeterministicRegressionValidation === true &&
      approved.ragInformedRepairReuse === true &&
      approved.ragEvidenceTreatedAsAuthority === false &&
      approved.ragEvidenceNonAuthoritative === true &&
      approved.regressionValidationRun === false &&
      approvedValidation.regressionValidationHandoff?.requiredBeforeMediumRuntimeRetry === true &&
      approvedValidation.regressionValidationHandoff?.ragEvidenceNonAuthoritative === true &&
      approvedValidation.regressionValidationHandoff?.forbiddenShortcuts.includes("reuse_medium_runtime_from_repair_draft_review"),
    JSON.stringify(approvedValidation.regressionValidationHandoff)
  ),
  check(
    "Reusable workflow repair draft package preserves RAG non-authority through draft_disabled rules",
    draftResult.ragInformedRepairReuse === true &&
      draftResult.ragEvidenceTreatedAsAuthority === false &&
      draftResult.ragEvidenceNonAuthoritative === true &&
      draftPackage.ragInformedRepairReuse === true &&
      draftPackage.ragEvidenceNonAuthoritative === true &&
      draftPackage.locks.ragEvidenceNonAuthoritative === true &&
      draftPackage.regressionValidationPlan.forbiddenShortcuts.includes("treat_rag_as_authority_from_draft_package") &&
      draftPackage.draftDisabledRules.length === 1,
    JSON.stringify(draftPackage.sourceEvidence)
  ),
  check(
    "Reusable workflow repair draft review preserves provider role-use trace for regression validation handoff",
    approvedValidation.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
      providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      approvedValidation.regressionValidationHandoff?.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(approvedValidation.regressionValidationHandoff?.providerRoleUsePlanTrace || {})
  ),
  check(
    "Reusable workflow repair draft review preserves reasoning budget trace for regression validation handoff",
    approvedValidation.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
      reasoningBudgetGovernorReviewTrace.validationHash &&
      approvedValidation.regressionValidationHandoff?.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(approvedValidation.regressionValidationHandoff?.reasoningBudgetGovernorReviewTrace || {})
  ),
  check(
    "Reusable workflow repair draft review correction returns to high-reasoning repair",
    correction.status === "reusable_workflow_repair_draft_return_to_high_reasoning_repair" &&
      correction.returnToHighReasoningRepair === true &&
      correctionValidation.highReasoningRepairHandoff?.kind === "reusable_workflow_repair_draft_back_to_high_reasoning_handoff",
    JSON.stringify(correctionValidation.highReasoningRepairHandoff)
  ),
  check(
    "Reusable workflow repair draft review blocks forbidden acceptance and rule enablement",
    forbidden.status === "blocked_for_forbidden_repair_draft_review_decision" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.blockers.includes("forbidden_teacher_decision") &&
      forbidden.ruleEnabled === false,
    JSON.stringify(forbidden.blockers)
  ),
  check(
    "Reusable workflow repair draft review keeps execution memory packaging and completion locks",
    approved.approvedGateRunnerInvoked === false &&
      approved.targetSoftwareCommandsExecuted === false &&
      approved.screenshotsCaptured === false &&
      approved.memoryWritten === false &&
      approved.accepted === false &&
      approved.ruleEnabled === false &&
      approved.packagingGated === true &&
      approved.goalComplete === false &&
      approvedValidation.locks.mediumRuntimeContinuationBlocked === true,
    JSON.stringify(approvedValidation.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  approvedValidationPath: approved.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
