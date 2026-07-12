#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-repair-regression-validation-smoke", String(Date.now()));
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
  providerRoleUsePlanHash: "sha256:repair-regression-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repair-regression-reasoning-budget-governor-smoke",
  recommendedExecutionModel: "medium_runtime_reusable_workflow_executor",
  highReasoningRepairRequiredOnCorrection: true
};

const readyIntakePath = writeJson(join(smokeRoot, "ready-intake.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_v1",
  intakeId: "tlcl-reusable-workflow-repair-regression-validation-smoke",
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
  blockedActionsConfirmed: true
});
const reviewResult = runNode("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs", [
  "--draft-package",
  draftResult.draftPackagePath,
  "--receipt",
  approvedReceiptPath,
  "--out-dir",
  join(smokeRoot, "review-validations")
]);
const blockedReviewPath = writeJson(join(smokeRoot, "blocked-review-validation.json"), {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_validation_v1",
  status: "reusable_workflow_repair_draft_return_to_high_reasoning_repair",
  readyForDeterministicRegressionValidation: false,
  blockers: ["needs_more_high_reasoning_repair"],
  locks: {
    mediumRuntimeContinuationBlocked: true,
    doesNotEnableRules: true
  }
});

const ready = runNode(
  "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs",
  ["--review-validation", reviewResult.validationPath, "--out-dir", join(smokeRoot, "regression-validations")]
);
const blocked = runNode(
  "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs",
  ["--review-validation", blockedReviewPath, "--out-dir", join(smokeRoot, "regression-validations")]
);
const readyPackage = readJson(ready.validationPackagePath);
const validationReport = readJson(ready.validationReportPath);
const checks = [
  check(
    "Reusable workflow repair regression validation creates lifecycle-skipped validation report",
    ready.status === "reusable_workflow_repair_regression_validation_ready_for_fingerprint_review" &&
      ready.deterministicValidationRun === true &&
      ready.readyForWorkflowFingerprintReview === true &&
      readyPackage.validationSummary.disabledRuleCount === 1 &&
      readyPackage.validationSummary.ragInformedRepairReuse === true &&
      readyPackage.validationSummary.ragEvidenceTreatedAsAuthority === false &&
      readyPackage.validationSummary.ragEvidenceNonAuthoritative === true &&
      readyPackage.validationSummary.lifecycleSkippedRows === 1 &&
      readyPackage.validationSummary.nonSkippedRuleRows === 0 &&
      validationReport.delivery_allowed === true,
    ready.validationReportPath
  ),
  check(
    "Reusable workflow repair regression validation keeps medium retry and rule activation blocked",
    ready.mediumRuntimeRetryAllowed === false &&
      ready.ruleEnabled === false &&
      ready.accepted === false &&
      readyPackage.mediumRuntimeRetryAllowed === false &&
      readyPackage.ruleActivationAllowed === false &&
      readyPackage.locks.mediumRuntimeContinuationBlocked === true &&
      readyPackage.locks.workflowFingerprintReviewStillRequired === true,
    JSON.stringify(readyPackage.locks)
  ),
  check(
    "Reusable workflow repair regression validation preserves RAG non-authority locks",
    ready.ragInformedRepairReuse === true &&
      ready.ragEvidenceTreatedAsAuthority === false &&
      ready.ragEvidenceNonAuthoritative === true &&
      readyPackage.ragInformedRepairReuse === true &&
      readyPackage.ragEvidenceNonAuthoritative === true &&
      readyPackage.locks.ragEvidenceNonAuthoritative === true &&
      readyPackage.locks.doesNotTreatRagAsAuthority === true &&
      readyPackage.nextReview.forbiddenShortcuts.includes("treat_rag_as_authority_from_regression_validation"),
    JSON.stringify(readyPackage.sourceEvidence)
  ),
  check(
    "Reusable workflow repair regression validation preserves provider role-use trace for fingerprint review",
    readyPackage.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
      providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPackage.validationSummary.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPackage.nextReview.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(readyPackage.sourceEvidence.providerRoleUsePlanTrace || {})
  ),
  check(
    "Reusable workflow repair regression validation preserves reasoning budget trace for fingerprint review",
    readyPackage.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
      reasoningBudgetGovernorReviewTrace.validationHash &&
      readyPackage.validationSummary.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash &&
      readyPackage.nextReview.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(readyPackage.sourceEvidence.reasoningBudgetGovernorReviewTrace || {})
  ),
  check(
    "Reusable workflow repair regression validation blocks unready draft review validation",
    blocked.status === "blocked_before_reusable_workflow_repair_regression_validation" &&
      blocked.deterministicValidationRun === false &&
      blocked.readyForWorkflowFingerprintReview === false &&
      blocked.mediumRuntimeRetryAllowed === false,
    blocked.validationPackagePath
  ),
  check(
    "Reusable workflow repair regression validation keeps execution memory packaging and completion locks",
    ready.approvedGateRunnerInvoked === false &&
      ready.targetSoftwareCommandsExecuted === false &&
      ready.screenshotsCaptured === false &&
      ready.memoryWritten === false &&
      ready.packagingGated === true &&
      ready.goalComplete === false &&
      readyPackage.locks.doesNotExecuteTargetSoftware === true,
    JSON.stringify(readyPackage.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_regression_validation_package_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyValidationPackagePath: ready.validationPackagePath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
