#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(pluginRoot, relativePath), "utf8");
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function readPackageJsonText() {
  const repoPackagePath = resolve(pluginRoot, "..", "..", "package.json");
  const bundledPackagePath = join(pluginRoot, "package.json");
  return readFileSync(existsSync(repoPackagePath) ? repoPackagePath : bundledPackagePath, "utf8");
}

const files = {
  package: readPackageJsonText(),
  readme: read("README.md"),
  mcpServer: read("scripts/mcp-server.mjs"),
  tlclOverallDirection: read("TLCL_OVERALL_DIRECTION.md"),
  fullTargetDirectionTaskList: read("FULL_TARGET_DIRECTION_AND_TASK_LIST.md"),
  reasoningTierContractSchema: read("schemas/reasoning-tier-contract.schema.json"),
  tlclRuntimeGateSchema: read("schemas/tlcl-runtime-gate.schema.json"),
  tlclMediumRuntimeDryRunPrepSchema: read("schemas/tlcl-medium-runtime-dry-run-prep.schema.json"),
  tlclStatusRefresh: read("scripts/create-tlcl-status-refresh.mjs"),
  tlclStatusRefreshSmoke: read("scripts/smoke-tlcl-status-refresh.mjs"),
  tlclDirectionOperationalConsole: read("scripts/create-tlcl-direction-operational-console.mjs"),
  tlclDirectionOperationalConsoleSmoke: read("scripts/smoke-tlcl-direction-operational-console.mjs"),
  tlclNextRouteInputContract: read("scripts/create-tlcl-next-route-input-contract.mjs"),
  tlclNextRouteInputContractSmoke: read("scripts/smoke-tlcl-next-route-input-contract.mjs"),
  tlclNextRouteInputContractReceiptBuilder: read("scripts/create-tlcl-next-route-input-contract-receipt-builder.mjs"),
  tlclNextRouteInputContractReceiptValidation: read("scripts/validate-tlcl-next-route-input-contract-receipt.mjs"),
  tlclNextRouteInputContractReceiptSmoke: read("scripts/smoke-tlcl-next-route-input-contract-receipt.mjs"),
  tlclNextRouteEvidenceAcquisitionPlan: read("scripts/create-tlcl-next-route-evidence-acquisition-plan.mjs"),
  tlclNextRouteEvidenceAcquisitionPlanSmoke: read("scripts/smoke-tlcl-next-route-evidence-acquisition-plan.mjs"),
  tlclNextRouteEvidenceAcquisitionPlanReceiptBuilder: read(
    "scripts/create-tlcl-next-route-evidence-acquisition-plan-receipt-builder.mjs"
  ),
  tlclNextRouteEvidenceAcquisitionPlanReceiptValidation: read(
    "scripts/validate-tlcl-next-route-evidence-acquisition-plan-receipt.mjs"
  ),
  tlclNextRouteEvidenceAcquisitionPlanReceiptSmoke: read(
    "scripts/smoke-tlcl-next-route-evidence-acquisition-plan-receipt.mjs"
  ),
  tlclNextRouteEvidencePlanRegenerationCommandBuilder: read(
    "scripts/create-tlcl-next-route-evidence-plan-regeneration-command-builder.mjs"
  ),
  tlclNextRouteEvidencePlanRegenerationCommandBuilderSmoke: read(
    "scripts/smoke-tlcl-next-route-evidence-plan-regeneration-command-builder.mjs"
  ),
  tlclNextRouteEvidencePlanRegenerationRequestReceiptBuilder: read(
    "scripts/create-tlcl-next-route-evidence-plan-regeneration-request-receipt-builder.mjs"
  ),
  tlclNextRouteEvidencePlanRegenerationRequestReceiptValidation: read(
    "scripts/validate-tlcl-next-route-evidence-plan-regeneration-request-receipt.mjs"
  ),
  tlclNextRouteEvidencePlanRegenerationRequestReceiptSmoke: read(
    "scripts/smoke-tlcl-next-route-evidence-plan-regeneration-request-receipt.mjs"
  ),
  tlclNextRouteEvidencePlanRegenerationManualResultReceiptBuilder: read(
    "scripts/create-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builder.mjs"
  ),
  tlclNextRouteEvidencePlanRegenerationManualResultReceiptValidation: read(
    "scripts/validate-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs"
  ),
  tlclNextRouteEvidencePlanRegenerationManualResultReceiptSmoke: read(
    "scripts/smoke-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs"
  ),
  tlclNextRouteRegeneratedInputContractReviewRouter: read(
    "scripts/create-tlcl-next-route-regenerated-input-contract-review-router.mjs"
  ),
  tlclNextRouteRegeneratedInputContractReviewSelectionValidation: read(
    "scripts/validate-tlcl-next-route-regenerated-input-contract-review-selection.mjs"
  ),
  tlclNextRouteRegeneratedInputContractReviewRouterSmoke: read(
    "scripts/smoke-tlcl-next-route-regenerated-input-contract-review-router.mjs"
  ),
  realCasePilotIntake: read("scripts/create-real-case-pilot-intake.mjs"),
  realCasePilotIntakeReceiptValidation: read("scripts/validate-real-case-pilot-intake-receipt.mjs"),
  realCasePilotIntakeSmoke: read("scripts/smoke-real-case-pilot-intake.mjs"),
  realCaseRuleDslPreparationPackage: read("scripts/create-real-case-rule-dsl-preparation-package.mjs"),
  realCaseRuleDslPreparationPackageSmoke: read("scripts/smoke-real-case-rule-dsl-preparation-package.mjs"),
  realCaseRuleDslReviewReceiptBuilder: read("scripts/create-real-case-rule-dsl-review-receipt-builder.mjs"),
  realCaseRuleDslReviewReceiptValidation: read("scripts/validate-real-case-rule-dsl-review-receipt.mjs"),
  realCaseRuleDslReviewGateSmoke: read("scripts/smoke-real-case-rule-dsl-review-gate.mjs"),
  realCaseDisabledPackageValidationReport: read("scripts/create-real-case-disabled-package-validation-report.mjs"),
  realCaseDisabledPackageValidationReportSmoke: read("scripts/smoke-real-case-disabled-package-validation-report.mjs"),
  realCaseValidationReportReviewReceiptBuilder: read("scripts/create-real-case-validation-report-review-receipt-builder.mjs"),
  realCaseValidationReportReviewReceiptValidation: read("scripts/validate-real-case-validation-report-review-receipt.mjs"),
  realCaseValidationReportReviewGateSmoke: read("scripts/smoke-real-case-validation-report-review-gate.mjs"),
  realCaseLifecycleCandidateReviewReceiptBuilder: read("scripts/create-real-case-lifecycle-candidate-review-receipt-builder.mjs"),
  realCaseLifecycleCandidateReviewReceiptValidation: read("scripts/validate-real-case-lifecycle-candidate-review-receipt.mjs"),
  realCaseLifecycleCandidateReviewGateSmoke: read("scripts/smoke-real-case-lifecycle-candidate-review-gate.mjs"),
  realCaseReviewOnlyPackagePlanning: read("scripts/create-real-case-review-only-package-planning-packet.mjs"),
  realCaseReviewOnlyPackagePlanningSmoke: read("scripts/smoke-real-case-review-only-package-planning.mjs"),
  realCaseReviewOnlyTransitionPackage: read("scripts/create-real-case-review-only-transition-package.mjs"),
  realCaseReviewOnlyTransitionPackageSmoke: read("scripts/smoke-real-case-review-only-transition-package.mjs"),
  realCaseActivePromotionReviewReceiptBuilder: read(
    "scripts/create-real-case-active-promotion-review-receipt-builder.mjs"
  ),
  realCaseActivePromotionReviewReceiptValidation: read(
    "scripts/validate-real-case-active-promotion-review-receipt.mjs"
  ),
  realCaseActivePromotionReviewGateSmoke: read("scripts/smoke-real-case-active-promotion-review-gate.mjs"),
  realCaseActiveRulePackageCompilationGate: read("scripts/create-real-case-active-rule-package-compilation-gate.mjs"),
  realCaseActiveRulePackageCompilationGateSmoke: read("scripts/smoke-real-case-active-rule-package-compilation-gate.mjs"),
  realCaseActivePackageValidationReport: read("scripts/create-real-case-active-package-validation-report.mjs"),
  realCaseActivePackageValidationReportSmoke: read("scripts/smoke-real-case-active-package-validation-report.mjs"),
  realCaseActiveValidationReportDeliveryGate: read("scripts/create-real-case-active-validation-report-delivery-gate.mjs"),
  realCaseActiveValidationReportDeliveryGateSmoke: read("scripts/smoke-real-case-active-validation-report-delivery-gate.mjs"),
  realCaseActiveExecutionGateReceiptBuilder: read("scripts/create-real-case-active-execution-gate-receipt-builder.mjs"),
  realCaseActiveExecutionGateReceiptValidation: read("scripts/validate-real-case-active-execution-gate-receipt.mjs"),
  realCaseActiveExecutionGateSmoke: read("scripts/smoke-real-case-active-execution-gate.mjs"),
  realCaseControlledExecutionRequestDryRun: read("scripts/run-real-case-controlled-execution-request-dry-run.mjs"),
  realCaseControlledExecutionRequestDryRunSmoke: read("scripts/smoke-real-case-controlled-execution-request-dry-run.mjs"),
  realCaseControlledExecutionDryRunReceiptValidation: read(
    "scripts/validate-real-case-controlled-execution-dry-run-receipt.mjs"
  ),
  realCaseAdapterSpecificRunnerApprovalGateSmoke: read("scripts/smoke-real-case-adapter-specific-runner-approval-gate.mjs"),
  realCaseSeparateRealRunner: read("scripts/run-real-case-separate-real-runner.mjs"),
  realCaseSeparateRealRunnerSmoke: read("scripts/smoke-real-case-separate-real-runner.mjs"),
  realCaseSeparateRealRunnerOutcomeReview: read("scripts/validate-real-case-separate-real-runner-outcome-review-receipt.mjs"),
  realCaseSeparateRealRunnerOutcomeReviewSmoke: read("scripts/smoke-real-case-separate-real-runner-outcome-review.mjs"),
  realCaseConfirmedOutcomeDurableActivation: read("scripts/validate-real-case-confirmed-outcome-durable-activation-receipt.mjs"),
  realCaseConfirmedOutcomeDurableActivationSmoke: read("scripts/smoke-real-case-confirmed-outcome-durable-activation-gate.mjs"),
  realCaseConfirmedOutcomeSeparateDurableActivationRunner: read(
    "scripts/run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs"
  ),
  realCaseConfirmedOutcomeSeparateDurableActivationRunnerSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-separate-durable-activation-runner.mjs"
  ),
  realCaseConfirmedOutcomeCandidateLedgerReview: read(
    "scripts/validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs"
  ),
  realCaseConfirmedOutcomeCandidateLedgerReviewSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-candidate-ledger-review-gate.mjs"
  ),
  realCaseConfirmedOutcomeRuleDslLifecycle: read(
    "scripts/validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs"
  ),
  realCaseConfirmedOutcomeRuleDslLifecycleSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-rule-dsl-lifecycle-gate.mjs"
  ),
  realCaseConfirmedOutcomeRuleDslDraftPreparationPackage: read(
    "scripts/create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs"
  ),
  realCaseConfirmedOutcomeRuleDslDraftPreparationPackageSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs"
  ),
  realCaseConfirmedOutcomeRuleDslReviewReceiptBuilder: read(
    "scripts/create-real-case-confirmed-outcome-rule-dsl-review-receipt-builder.mjs"
  ),
  realCaseConfirmedOutcomeRuleDslReviewReceiptValidation: read(
    "scripts/validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs"
  ),
  realCaseConfirmedOutcomeRuleDslReviewGateSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-rule-dsl-review-gate.mjs"
  ),
  realCaseConfirmedOutcomeDisabledPackageValidationReport: read(
    "scripts/create-real-case-confirmed-outcome-disabled-package-validation-report.mjs"
  ),
  realCaseConfirmedOutcomeDisabledPackageValidationReportSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-disabled-package-validation-report.mjs"
  ),
  realCaseConfirmedOutcomeValidationReportReviewReceiptBuilder: read(
    "scripts/create-real-case-confirmed-outcome-validation-report-review-receipt-builder.mjs"
  ),
  realCaseConfirmedOutcomeValidationReportReviewReceiptValidation: read(
    "scripts/validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs"
  ),
  realCaseConfirmedOutcomeValidationReportReviewGateSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-validation-report-review-gate.mjs"
  ),
  realCaseConfirmedOutcomeLifecycleCandidateReviewReceiptBuilder: read(
    "scripts/create-real-case-confirmed-outcome-lifecycle-candidate-review-receipt-builder.mjs"
  ),
  realCaseConfirmedOutcomeLifecycleCandidateReviewReceiptValidation: read(
    "scripts/validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs"
  ),
  realCaseConfirmedOutcomeLifecycleCandidateReviewGateSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-lifecycle-candidate-review-gate.mjs"
  ),
  realCaseConfirmedOutcomeReviewOnlyPackagePlanning: read(
    "scripts/create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs"
  ),
  realCaseConfirmedOutcomeReviewOnlyPackagePlanningSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-review-only-package-planning.mjs"
  ),
  realCaseConfirmedOutcomeReviewOnlyTransitionPackage: read(
    "scripts/create-real-case-confirmed-outcome-review-only-transition-package.mjs"
  ),
  realCaseConfirmedOutcomeReviewOnlyTransitionPackageSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-review-only-transition-package.mjs"
  ),
  realCaseConfirmedOutcomeActivePromotionReviewReceiptBuilder: read(
    "scripts/create-real-case-confirmed-outcome-active-promotion-review-receipt-builder.mjs"
  ),
  realCaseConfirmedOutcomeActivePromotionReviewReceiptValidation: read(
    "scripts/validate-real-case-confirmed-outcome-active-promotion-review-receipt.mjs"
  ),
  realCaseConfirmedOutcomeActivePromotionReviewGateSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-active-promotion-review-gate.mjs"
  ),
  realCaseConfirmedOutcomeActiveRulePackageCompilationGate: read(
    "scripts/create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs"
  ),
  realCaseConfirmedOutcomeActiveRulePackageCompilationGateSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs"
  ),
  realCaseConfirmedOutcomeActivePackageValidationReport: read(
    "scripts/create-real-case-confirmed-outcome-active-package-validation-report.mjs"
  ),
  realCaseConfirmedOutcomeActivePackageValidationReportSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-active-package-validation-report.mjs"
  ),
  realCaseConfirmedOutcomeActiveValidationReportDeliveryGate: read(
    "scripts/create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs"
  ),
  realCaseConfirmedOutcomeActiveValidationReportDeliveryGateSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs"
  ),
  realCaseConfirmedOutcomeActiveExecutionGateReceiptBuilder: read(
    "scripts/create-real-case-confirmed-outcome-active-execution-gate-receipt-builder.mjs"
  ),
  realCaseConfirmedOutcomeActiveExecutionGateReceiptValidation: read(
    "scripts/validate-real-case-confirmed-outcome-active-execution-gate-receipt.mjs"
  ),
  realCaseConfirmedOutcomeActiveExecutionGateSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-active-execution-gate.mjs"
  ),
  realCaseConfirmedOutcomeControlledExecutionRequestDryRun: read(
    "scripts/run-real-case-confirmed-outcome-controlled-execution-request-dry-run.mjs"
  ),
  realCaseConfirmedOutcomeControlledExecutionRequestDryRunSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-controlled-execution-request-dry-run.mjs"
  ),
  realCaseConfirmedOutcomeAdapterSpecificRunnerApprovalGate: read(
    "scripts/validate-real-case-confirmed-outcome-controlled-execution-dry-run-receipt.mjs"
  ),
  realCaseConfirmedOutcomeAdapterSpecificRunnerApprovalGateSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-adapter-specific-runner-approval-gate.mjs"
  ),
  realCaseConfirmedOutcomeSeparateRealRunner: read(
    "scripts/run-real-case-confirmed-outcome-separate-real-runner.mjs"
  ),
  realCaseConfirmedOutcomeSeparateRealRunnerSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-separate-real-runner.mjs"
  ),
  realCaseConfirmedOutcomeSeparateRealRunnerOutcomeReview: read(
    "scripts/validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs"
  ),
  realCaseConfirmedOutcomeSeparateRealRunnerOutcomeReviewSmoke: read(
    "scripts/smoke-real-case-confirmed-outcome-separate-real-runner-outcome-review.mjs"
  ),
  tlclReasoningBudgetGovernor: read("scripts/create-tlcl-reasoning-budget-governor.mjs"),
  tlclReasoningBudgetGovernorSmoke: read("scripts/smoke-tlcl-reasoning-budget-governor.mjs"),
  tlclReasoningBudgetGovernorReviewReceiptValidation: read("scripts/validate-tlcl-reasoning-budget-governor-review-receipt.mjs"),
  tlclReasoningBudgetGovernorReviewReceiptSmoke: read("scripts/smoke-tlcl-reasoning-budget-governor-review-receipt.mjs"),
  tlclReasoningBudgetMediumReuseHandoff: read("scripts/create-tlcl-reasoning-budget-medium-reuse-handoff.mjs"),
  tlclReasoningBudgetMediumReuseHandoffSmoke: read("scripts/smoke-tlcl-reasoning-budget-medium-reuse-handoff.mjs"),
  tlclCapabilityProviderIntake: read("scripts/create-tlcl-capability-provider-intake.mjs"),
  tlclCapabilityProviderIntakeSmoke: read("scripts/smoke-tlcl-capability-provider-intake.mjs"),
  tlclCapabilityProviderQualificationPlan: read("scripts/create-tlcl-capability-provider-qualification-plan.mjs"),
  tlclCapabilityProviderQualificationPlanSmoke: read("scripts/smoke-tlcl-capability-provider-qualification-plan.mjs"),
  tlclCapabilityProviderQualificationNoActionRunner: read("scripts/run-tlcl-capability-provider-qualification-no-action-runner.mjs"),
  tlclCapabilityProviderQualificationNoActionRunnerSmoke: read(
    "scripts/smoke-tlcl-capability-provider-qualification-no-action-runner.mjs"
  ),
  tlclCapabilityProviderQualificationResultReceipt: read(
    "scripts/validate-tlcl-capability-provider-qualification-result-receipt.mjs"
  ),
  tlclCapabilityProviderQualificationResultReceiptSmoke: read(
    "scripts/smoke-tlcl-capability-provider-qualification-result-receipt.mjs"
  ),
  tlclCapabilityProviderActivationReviewCandidateBuilder: read(
    "scripts/create-tlcl-capability-provider-activation-review-candidate-builder.mjs"
  ),
  tlclCapabilityProviderActivationReviewReceiptValidation: read(
    "scripts/validate-tlcl-capability-provider-activation-review-receipt.mjs"
  ),
  tlclCapabilityProviderActivationReviewSmoke: read("scripts/smoke-tlcl-capability-provider-activation-review.mjs"),
  tlclCapabilityProviderRoleUsePlanner: read("scripts/create-tlcl-capability-provider-role-use-planner.mjs"),
  tlclCapabilityProviderRoleUsePlannerSmoke: read("scripts/smoke-tlcl-capability-provider-role-use-planner.mjs"),
  tlclRuntimeGate: read("scripts/create-tlcl-runtime-gate.mjs"),
  tlclRuntimeGateSmoke: read("scripts/smoke-tlcl-runtime-gate.mjs"),
  tlclRuntimeGateProviderRolePlanSmoke: read("scripts/smoke-tlcl-runtime-gate-provider-role-plan.mjs"),
  tlclMediumRuntimeDryRunPrep: read("scripts/create-tlcl-medium-runtime-dry-run-prep.mjs"),
  tlclMediumRuntimeDryRunPrepSmoke: read("scripts/smoke-tlcl-medium-runtime-dry-run-prep.mjs"),
  tlclMediumRuntimeDryRunPrepReviewReceiptBuilder: read("scripts/create-tlcl-medium-runtime-dry-run-prep-review-receipt-builder.mjs"),
  tlclMediumRuntimeDryRunPrepReviewReceiptValidation: read("scripts/validate-tlcl-medium-runtime-dry-run-prep-review-receipt.mjs"),
  tlclMediumRuntimeDryRunPrepReviewReceiptSmoke: read("scripts/smoke-tlcl-medium-runtime-dry-run-prep-review-receipt.mjs"),
  tlclMediumRuntimeDryRunRouteReviewHandoff: read("scripts/create-tlcl-medium-runtime-dry-run-route-review-handoff.mjs"),
  tlclMediumRuntimeDryRunRouteReviewHandoffSmoke: read("scripts/smoke-tlcl-medium-runtime-dry-run-route-review-handoff.mjs"),
  tlclMediumRuntimeDryRunRouteReviewReceiptBuilder: read("scripts/create-tlcl-medium-runtime-dry-run-route-review-receipt-builder.mjs"),
  tlclMediumRuntimeDryRunRouteReviewReceiptValidation: read("scripts/validate-tlcl-medium-runtime-dry-run-route-review-receipt.mjs"),
  tlclMediumRuntimeDryRunRouteReviewReceiptSmoke: read("scripts/smoke-tlcl-medium-runtime-dry-run-route-review-receipt.mjs"),
  tlclMediumRuntimeDryRunOnlyRunner: read("scripts/run-tlcl-medium-runtime-dry-run-only-runner.mjs"),
  tlclMediumRuntimeDryRunOnlyRunnerSmoke: read("scripts/smoke-tlcl-medium-runtime-dry-run-only-runner.mjs"),
  tlclMediumRuntimeDryRunOnlyPostRunReceiptBuilder: read("scripts/create-tlcl-medium-runtime-dry-run-only-post-run-receipt-builder.mjs"),
  tlclMediumRuntimeDryRunOnlyPostRunReceiptValidation: read("scripts/validate-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs"),
  tlclMediumRuntimeDryRunOnlyPostRunReceiptSmoke: read("scripts/smoke-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs"),
  tlclMediumRuntimeExecutionApprovalGatePrepRunner: read("scripts/run-tlcl-medium-runtime-execution-approval-gate-prep-runner.mjs"),
  tlclMediumRuntimeExecutionApprovalGatePrepRunnerSmoke: read("scripts/smoke-tlcl-medium-runtime-execution-approval-gate-prep-runner.mjs"),
  tlclMediumRuntimeApprovedGateCommandBuilder: read("scripts/create-tlcl-medium-runtime-approved-gate-command-builder.mjs"),
  tlclMediumRuntimeApprovedGateCommandBuilderSmoke: read("scripts/smoke-tlcl-medium-runtime-approved-gate-command-builder.mjs"),
  tlclMediumRuntimeApprovedGateRunner: read("scripts/run-tlcl-medium-runtime-approved-gate-runner.mjs"),
  tlclMediumRuntimeApprovedGateRunnerSmoke: read("scripts/smoke-tlcl-medium-runtime-approved-gate-runner.mjs"),
  tlclMediumRuntimeApprovedGateOutcomeReviewReceiptBuilder: read("scripts/create-tlcl-medium-runtime-approved-gate-outcome-review-receipt-builder.mjs"),
  tlclMediumRuntimeApprovedGateOutcomeReviewReceiptValidation: read("scripts/validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs"),
  tlclMediumRuntimeApprovedGateOutcomeReviewReceiptSmoke: read("scripts/smoke-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs"),
  tlclRagEvidenceAttachment: read("scripts/create-tlcl-rag-evidence-attachment.mjs"),
  tlclRagEvidenceAttachmentSmoke: read("scripts/smoke-tlcl-rag-evidence-attachment.mjs"),
  tlclRagInformedHighReasoningRepairIntake: read("scripts/create-tlcl-rag-informed-high-reasoning-repair-intake.mjs"),
  tlclRagInformedHighReasoningRepairIntakeSmoke: read("scripts/smoke-tlcl-rag-informed-high-reasoning-repair-intake.mjs"),
  tlclRagInformedHighReasoningRepairDraftPackage: read(
    "scripts/create-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs"
  ),
  tlclRagInformedHighReasoningRepairDraftPackageSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs"
  ),
  tlclRagInformedHighReasoningRepairDraftReviewValidation: read(
    "scripts/validate-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs"
  ),
  tlclRagInformedHighReasoningRepairDraftReviewSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs"
  ),
  tlclRagInformedHighReasoningRepairDeterministicValidation: read(
    "scripts/create-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs"
  ),
  tlclRagInformedHighReasoningRepairDeterministicValidationSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs"
  ),
  tlclRagInformedHighReasoningRepairWorkflowFingerprintReviewValidation: read(
    "scripts/validate-tlcl-rag-informed-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs"
  ),
  tlclRagInformedHighReasoningRepairWorkflowFingerprintReviewSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovalGateRebuild: read(
    "scripts/create-tlcl-rag-informed-high-reasoning-repair-approval-gate-rebuild-package.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovalGateRebuildSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approval-gate-rebuild-package.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovedGateCommandBuilder: read(
    "scripts/create-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovedGateCommandBuilderSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovedGateRunner: read(
    "scripts/run-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovedGateRunnerSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovedGateOutcomeReviewBuilder: read(
    "scripts/create-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt-builder.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovedGateOutcomeReviewValidation: read(
    "scripts/validate-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs"
  ),
  tlclRagInformedHighReasoningRepairApprovedGateOutcomeReviewSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs"
  ),
  tlclRagInformedHighReasoningRepairReuseReviewCandidateBuilder: read(
    "scripts/create-tlcl-rag-informed-high-reasoning-repair-reuse-review-candidate-builder.mjs"
  ),
  tlclRagInformedHighReasoningRepairReuseReviewValidation: read(
    "scripts/validate-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs"
  ),
  tlclRagInformedHighReasoningRepairReuseReviewSmoke: read(
    "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs"
  ),
  tlclMediumRuntimeReusableWorkflowCandidateBuilder: read("scripts/create-tlcl-medium-runtime-reusable-workflow-candidate-builder.mjs"),
  tlclMediumRuntimeReusableWorkflowActivationValidation: read("scripts/validate-tlcl-medium-runtime-reusable-workflow-activation-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowActivationSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-activation.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationPlanner: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationPlannerSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovalGatePrepRunner: read("scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovalGatePrepRunnerSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovedGateCommandBuilder: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovedGateCommandBuilderSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovedGateRunner: read("scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovedGateRunnerSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptBuilder: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptValidation: read("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairIntake: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairIntakeSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftPackage: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftPackageSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftReviewValidation: read("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftReviewSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairRegressionValidationPackage: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairRegressionValidationPackageSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairWorkflowFingerprintReviewValidation: read("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairWorkflowFingerprintReviewSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovalGateRebuildPackage: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovalGateRebuildPackageSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateCommandBuilder: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateCommandBuilderSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateRunner: read("scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateRunnerSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateOutcomeReviewReceiptBuilder: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt-builder.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateOutcomeReviewReceiptValidation: read("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateOutcomeReviewReceiptSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairReuseReviewCandidateBuilder: read("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-candidate-builder.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairReuseReviewReceiptValidation: read("scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs"),
  tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairReuseReviewReceiptSmoke: read("scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs"),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationPlanner: read("scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs"),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationPlannerSmoke: read("scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs"),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovalGatePrepRunner: read(
    "scripts/run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovalGatePrepRunnerSmoke: read(
    "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateCommandBuilder: read(
    "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateCommandBuilderSmoke: read(
    "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateRunner: read(
    "scripts/run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateRunnerSmoke: read(
    "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptBuilder: read(
    "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptValidation: read(
    "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptSmoke: read(
    "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationReuseReviewCandidateBuilder: read(
    "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-candidate-builder.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationReuseReviewReceiptValidation: read(
    "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs"
  ),
  tlclMediumRuntimeRepairedReusableWorkflowInvocationReuseReviewReceiptSmoke: read(
    "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs"
  ),
  tlclProviderRoleUseTraceContinuityAuditSmoke: read("scripts/smoke-tlcl-provider-role-use-trace-continuity-audit.mjs"),
  tlclReasoningBudgetTraceContinuityAuditSmoke: read("scripts/smoke-tlcl-reasoning-budget-trace-continuity-audit.mjs"),
  tlclApprenticeSessionLauncher: read("scripts/create-tlcl-apprentice-session-launcher.mjs"),
  tlclApprenticeSessionLauncherSmoke: read("scripts/smoke-tlcl-apprentice-session-launcher.mjs"),
  tlclApprenticeSessionLauncherReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-launcher-receipt.mjs"
  ),
  tlclApprenticeSessionLauncherReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-launcher-receipt.mjs"
  ),
  tlclApprenticeSessionHandoffItemCommandBuilder: read(
    "scripts/create-tlcl-apprentice-session-handoff-item-command-builder.mjs"
  ),
  tlclApprenticeSessionHandoffItemCommandBuilderSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-handoff-item-command-builder.mjs"
  ),
  tlclApprenticeSessionHandoffItemContinuationValidation: read(
    "scripts/validate-tlcl-apprentice-session-handoff-item-continuation-request.mjs"
  ),
  tlclApprenticeSessionHandoffItemContinuationSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-handoff-item-continuation-request.mjs"
  ),
  tlclApprenticeSessionValidatedContinuationRouter: read(
    "scripts/create-tlcl-apprentice-session-validated-continuation-router.mjs"
  ),
  tlclApprenticeSessionValidatedContinuationRouterSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-validated-continuation-router.mjs"
  ),
  tlclApprenticeSessionValidatedRouteCommandBuilder: read(
    "scripts/create-tlcl-apprentice-session-validated-route-command-builder.mjs"
  ),
  tlclApprenticeSessionValidatedRouteCommandBuilderSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-validated-route-command-builder.mjs"
  ),
  tlclApprenticeSessionValidatedRouteRequestReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-validated-route-request-receipt-builder.mjs"
  ),
  tlclApprenticeSessionValidatedRouteRequestReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-validated-route-request-receipt.mjs"
  ),
  tlclApprenticeSessionValidatedRouteRequestReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-validated-route-request-receipt.mjs"
  ),
  tlclApprenticeSessionManualDownstreamUseResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-manual-downstream-use-result-receipt-builder.mjs"
  ),
  tlclApprenticeSessionManualDownstreamUseResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs"
  ),
  tlclApprenticeSessionManualDownstreamUseResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs"
  ),
  tlclApprenticeSessionReviewedManualDownstreamResultNextGateSelector: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selector.mjs"
  ),
  tlclApprenticeSessionReviewedManualDownstreamResultNextGateValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs"
  ),
  tlclApprenticeSessionReviewedManualDownstreamResultNextGateSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs"
  ),
  tlclApprenticeSessionManualNextGatePreparationBuilder: read(
    "scripts/create-tlcl-apprentice-session-manual-next-gate-preparation-builder.mjs"
  ),
  tlclApprenticeSessionManualNextGatePreparationValidation: read(
    "scripts/validate-tlcl-apprentice-session-manual-next-gate-preparation-receipt.mjs"
  ),
  tlclApprenticeSessionManualNextGatePreparationSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-manual-next-gate-preparation.mjs"
  ),
  tlclRagEvidenceToHighReasoningRepairChainAuditSmoke: read(
    "scripts/smoke-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit.mjs"
  ),
  tlclMarketResponseProviderBoundaryAuditSmoke: read("scripts/smoke-tlcl-market-response-provider-boundary-audit.mjs"),
  skill: read("skills/teachable-apprentice/SKILL.md"),
  mcp: read("scripts/mcp-server.mjs"),
  allSoftwareBootstrap: read("scripts/create-all-software-observer-bootstrap.mjs"),
  allSoftwareSupervisor: read("scripts/run-all-software-observer-supervisor.mjs"),
  allSoftwareLearningCycle: read("scripts/run-all-software-low-token-learning-cycle.mjs"),
  ragResearchIntakeQueue: read("scripts/knowledge/create-rag-research-intake-queue.mjs"),
  ragResearchIntakeQueueSmoke: read("scripts/smoke/smoke-rag-research-intake-queue.mjs"),
  ragResearchIntakeReceiptBuilder: read("scripts/knowledge/create-rag-research-intake-receipt-builder.mjs"),
  ragResearchIntakeReceiptValidation: read("scripts/knowledge/validate-rag-research-intake-receipt.mjs"),
  ragResearchIntakeReceiptSmoke: read("scripts/smoke/smoke-rag-research-intake-receipt.mjs"),
  ragConfirmedSourceRegistryPackage: read("scripts/knowledge/create-rag-confirmed-source-registry-package.mjs"),
  ragConfirmedSourceRegistryPackageSmoke: read("scripts/smoke/smoke-rag-confirmed-source-registry-package.mjs"),
  ragConfirmedLocalIngestRunner: read("scripts/knowledge/run-rag-confirmed-local-ingest.mjs"),
  ragConfirmedLocalIngestRunnerSmoke: read("scripts/smoke/smoke-rag-confirmed-local-ingest-runner.mjs"),
  ragConfirmedRetrievalDraftRunner: read("scripts/knowledge/run-rag-confirmed-retrieval-draft.mjs"),
  ragConfirmedRetrievalDraftRunnerSmoke: read("scripts/smoke/smoke-rag-confirmed-retrieval-draft-runner.mjs"),
  ragConfirmedRetrievalDraftReviewReceiptBuilder: read("scripts/knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs"),
  ragConfirmedRetrievalDraftReviewReceiptValidation: read("scripts/knowledge/validate-rag-confirmed-retrieval-draft-review-receipt.mjs"),
  ragConfirmedRetrievalDraftReviewReceiptSmoke: read("scripts/smoke/smoke-rag-confirmed-retrieval-draft-review-receipt.mjs"),
  ragReviewedRuleDslValidationPackage: read("scripts/knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs"),
  ragReviewedRuleDslValidationPackageSmoke: read("scripts/smoke/smoke-rag-reviewed-rule-dsl-validation-package.mjs"),
  ragReviewedRuleDslReviewReceiptBuilder: read("scripts/knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs"),
  ragReviewedRuleDslReviewReceiptValidation: read("scripts/knowledge/validate-rag-reviewed-rule-dsl-review-receipt.mjs"),
  ragReviewedRuleDslReviewReceiptSmoke: read("scripts/smoke/smoke-rag-reviewed-rule-dsl-review-receipt.mjs"),
  ragReviewedDisabledRulePackage: read("scripts/knowledge/create-rag-reviewed-disabled-rule-package.mjs"),
  ragReviewedDisabledRulePackageSmoke: read("scripts/smoke/smoke-rag-reviewed-disabled-rule-package.mjs"),
  ragDisabledPackageValidationReport: read("scripts/knowledge/create-rag-disabled-package-validation-report.mjs"),
  ragDisabledPackageValidationReportSmoke: read("scripts/smoke/smoke-rag-disabled-package-validation-report.mjs"),
  ragValidationReportDeliveryGate: read("scripts/knowledge/create-rag-validation-report-delivery-gate.mjs"),
  ragValidationReportDeliveryGateSmoke: read("scripts/smoke/smoke-rag-validation-report-delivery-gate.mjs"),
  ragDeliveryGateAuditTrail: read("scripts/knowledge/create-rag-delivery-gate-audit-trail.mjs"),
  ragDeliveryGateAuditTrailSmoke: read("scripts/smoke/smoke-rag-delivery-gate-audit-trail.mjs"),
  ragDeliveryGateAuditReviewReceiptBuilder: read("scripts/knowledge/create-rag-delivery-gate-audit-review-receipt-builder.mjs"),
  ragDeliveryGateAuditReviewReceiptValidation: read("scripts/knowledge/validate-rag-delivery-gate-audit-review-receipt.mjs"),
  ragDeliveryGateAuditReviewReceiptSmoke: read("scripts/smoke/smoke-rag-delivery-gate-audit-review-receipt.mjs"),
  ragAuditReviewFollowUpQueue: read("scripts/knowledge/create-rag-audit-review-follow-up-queue.mjs"),
  ragAuditReviewFollowUpQueueSmoke: read("scripts/smoke/smoke-rag-audit-review-follow-up-queue.mjs"),
  ragFollowUpQueueSelectionReceiptBuilder: read("scripts/knowledge/create-rag-follow-up-queue-selection-receipt-builder.mjs"),
  ragFollowUpQueueSelectionReceiptValidation: read("scripts/knowledge/validate-rag-follow-up-queue-selection-receipt.mjs"),
  ragFollowUpQueueSelectionReceiptSmoke: read("scripts/smoke/smoke-rag-follow-up-queue-selection-receipt.mjs"),
  tlclRagSelectionReceiptBuilderResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt-builder.mjs"
  ),
  tlclRagSelectionReceiptBuilderResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt.mjs"
  ),
  tlclRagSelectionReceiptBuilderResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt.mjs"
  ),
  tlclRagSelectionReceiptValidationResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt-builder.mjs"
  ),
  tlclRagSelectionReceiptValidationResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs"
  ),
  tlclRagSelectionReceiptValidationResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs"
  ),
  tlclRagSelectedFollowUpPlanningResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt-builder.mjs"
  ),
  tlclRagSelectedFollowUpPlanningResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs"
  ),
  tlclRagSelectedFollowUpPlanningResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs"
  ),
  tlclRagPrimarySourceEvidenceRequestResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt-builder.mjs"
  ),
  tlclRagPrimarySourceEvidenceRequestResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs"
  ),
  tlclRagPrimarySourceEvidenceRequestResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs"
  ),
  tlclRagConfirmedSourceRegistryResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt-builder.mjs"
  ),
  tlclRagConfirmedSourceRegistryResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs"
  ),
  tlclRagConfirmedSourceRegistryResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs"
  ),
  tlclRagConfirmedLocalIngestResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt-builder.mjs"
  ),
  tlclRagConfirmedLocalIngestResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs"
  ),
  tlclRagConfirmedLocalIngestResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs"
  ),
  tlclRagConfirmedRetrievalDraftResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt-builder.mjs"
  ),
  tlclRagConfirmedRetrievalDraftResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs"
  ),
  tlclRagConfirmedRetrievalDraftResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs"
  ),
  tlclRagRetrievalDraftReviewValidationResultReceiptBuilder: read(
    "scripts/create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt-builder.mjs"
  ),
  tlclRagRetrievalDraftReviewValidationResultReceiptValidation: read(
    "scripts/validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs"
  ),
  tlclRagRetrievalDraftReviewValidationResultReceiptSmoke: read(
    "scripts/smoke-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs"
  ),
  ragPrimarySourceFollowUpQueueSelectionReceiptSmoke: read("scripts/smoke/smoke-rag-primary-source-follow-up-queue-selection-receipt.mjs"),
  ragPrimarySourceFollowUpQueueSelectionReceiptPlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-follow-up-queue-selection-receipt-planning-logic-context.mjs"
  ),
  ragSelectedFollowUpPlanningPacket: read("scripts/knowledge/create-rag-selected-follow-up-planning-packet.mjs"),
  ragSelectedFollowUpPlanningPacketSmoke: read("scripts/smoke/smoke-rag-selected-follow-up-planning-packet.mjs"),
  ragPrimarySourceSelectedFollowUpPlanningPacketSmoke: read("scripts/smoke/smoke-rag-primary-source-selected-follow-up-planning-packet.mjs"),
  ragPrimarySourceSelectedFollowUpPlanningPacketPlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-selected-follow-up-planning-packet-planning-logic-context.mjs"
  ),
  ragPrimarySourceEvidenceRequestReceiptBuilder: read("scripts/knowledge/create-rag-primary-source-evidence-request-receipt-builder.mjs"),
  ragPrimarySourceEvidenceRequestReceiptValidation: read("scripts/knowledge/validate-rag-primary-source-evidence-request-receipt.mjs"),
  ragPrimarySourceEvidenceRequestReceiptSmoke: read("scripts/smoke/smoke-rag-primary-source-evidence-request-receipt.mjs"),
  ragPrimarySourceEvidenceRequestLogicContextSmoke: read("scripts/smoke/smoke-rag-primary-source-evidence-request-logic-context.mjs"),
  ragPrimarySourceRegistryFollowUpSmoke: read("scripts/smoke/smoke-rag-primary-source-registry-follow-up.mjs"),
  ragPrimarySourceRegistryLogicContextSmoke: read("scripts/smoke/smoke-rag-primary-source-registry-logic-context.mjs"),
  ragPrimarySourceLocalIngestFollowUpSmoke: read("scripts/smoke/smoke-rag-primary-source-local-ingest-follow-up.mjs"),
  ragPrimarySourceLocalIngestLogicContextSmoke: read("scripts/smoke/smoke-rag-primary-source-local-ingest-logic-context.mjs"),
  ragPrimarySourceRetrievalDraftFollowUpSmoke: read("scripts/smoke/smoke-rag-primary-source-retrieval-draft-follow-up.mjs"),
  ragPrimarySourceRetrievalDraftLogicContextSmoke: read("scripts/smoke/smoke-rag-primary-source-retrieval-draft-logic-context.mjs"),
  ragPrimarySourceRetrievalDraftReviewReceiptSmoke: read("scripts/smoke/smoke-rag-primary-source-retrieval-draft-review-receipt.mjs"),
  ragPrimarySourceRetrievalDraftReviewLogicContextSmoke: read("scripts/smoke/smoke-rag-primary-source-retrieval-draft-review-logic-context.mjs"),
  ragPrimarySourceRuleDslValidationPackageSmoke: read("scripts/smoke/smoke-rag-primary-source-rule-dsl-validation-package.mjs"),
  ragPrimarySourceRuleDslValidationPlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-rule-dsl-validation-planning-logic-context.mjs"
  ),
  ragPrimarySourceRuleDslReviewReceiptSmoke: read("scripts/smoke/smoke-rag-primary-source-rule-dsl-review-receipt.mjs"),
  ragPrimarySourceRuleDslReviewPlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-rule-dsl-review-planning-logic-context.mjs"
  ),
  ragPrimarySourceDisabledRulePackageSmoke: read("scripts/smoke/smoke-rag-primary-source-disabled-rule-package.mjs"),
  ragPrimarySourceDisabledRulePackagePlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-disabled-rule-package-planning-logic-context.mjs"
  ),
  ragPrimarySourceDisabledPackageValidationReportSmoke: read("scripts/smoke/smoke-rag-primary-source-disabled-package-validation-report.mjs"),
  ragPrimarySourceDisabledPackageValidationReportPlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-disabled-package-validation-report-planning-logic-context.mjs"
  ),
  ragPrimarySourceValidationReportDeliveryGateSmoke: read("scripts/smoke/smoke-rag-primary-source-validation-report-delivery-gate.mjs"),
  ragPrimarySourceValidationReportDeliveryGatePlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-validation-report-delivery-gate-planning-logic-context.mjs"
  ),
  ragPrimarySourceDeliveryGateAuditTrailSmoke: read("scripts/smoke/smoke-rag-primary-source-delivery-gate-audit-trail.mjs"),
  ragPrimarySourceDeliveryGateAuditTrailPlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-delivery-gate-audit-trail-planning-logic-context.mjs"
  ),
  ragPrimarySourceDeliveryGateAuditReviewReceiptSmoke: read("scripts/smoke/smoke-rag-primary-source-delivery-gate-audit-review-receipt.mjs"),
  ragPrimarySourceDeliveryGateAuditReviewReceiptPlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-delivery-gate-audit-review-receipt-planning-logic-context.mjs"
  ),
  ragPrimarySourceAuditReviewFollowUpQueueSmoke: read("scripts/smoke/smoke-rag-primary-source-audit-review-follow-up-queue.mjs"),
  ragPrimarySourceAuditReviewFollowUpQueuePlanningLogicContextSmoke: read(
    "scripts/smoke/smoke-rag-primary-source-audit-review-follow-up-queue-planning-logic-context.mjs"
  ),
  ragNextReviewHashCoverageAuditSmoke: read("scripts/smoke/smoke-rag-next-review-hash-coverage-audit.mjs"),
  tlclRagReturnChainCoverageAuditSmoke: read("scripts/smoke/smoke-tlcl-rag-return-chain-coverage-audit.mjs"),
  originalGoalCapabilityMatrixCoverageAuditSmoke: read("scripts/smoke/smoke-original-goal-capability-matrix-coverage-audit.mjs"),
  knowledgeAugmentedLowTokenLearningBridge: read("scripts/knowledge/augment-low-token-learning-with-retrieval.mjs"),
  knowledgeAugmentedLowTokenLearningSmoke: read("scripts/smoke/smoke-knowledge-augmented-low-token-learning.mjs"),
  knowledgeAugmentedSpatialExecutionBridge: read("scripts/create-knowledge-augmented-spatial-execution-bridge.mjs"),
  knowledgeAugmentedSpatialExecutionBridgeSmoke: read("scripts/smoke/smoke-knowledge-augmented-spatial-execution-bridge.mjs"),
  automaticLowTokenLearningRunner: read("scripts/run-automatic-low-token-learning-runner.mjs"),
  automaticLowTokenLearningSchedule: read("scripts/create-automatic-low-token-learning-schedule.mjs"),
  allSoftwareRecurringMonitorApprovalGate: read("scripts/create-all-software-recurring-monitor-approval-gate.mjs"),
  allSoftwareRecurringMonitorRegistrationRunner: read("scripts/run-all-software-recurring-monitor-registration-runner.mjs"),
  allSoftwareRecurringMonitorRegistrationStatus: read("scripts/verify-all-software-recurring-monitor-registration-status.mjs"),
  allSoftwareRecurringMonitorRunOutputAudit: read("scripts/audit-all-software-recurring-monitor-run-output.mjs"),
  allSoftwareRecurringMonitorTeacherReviewPacket: read("scripts/create-all-software-recurring-monitor-teacher-review-packet.mjs"),
  allSoftwareRecurringMonitorReviewDecisionReplayQueue: read("scripts/create-all-software-recurring-monitor-review-decision-replay-queue.mjs"),
  allSoftwareUnattendedLearningAudit: read("scripts/create-all-software-unattended-learning-audit.mjs"),
  allSoftwareOperationalLearningWorkbench: read("scripts/create-all-software-operational-learning-workbench.mjs"),
  allSoftwareOperationalLearningTrial: read("scripts/run-all-software-operational-learning-trial.mjs"),
  allSoftwareOperationalLearningActivationGate: read("scripts/create-all-software-operational-learning-activation-gate.mjs"),
  allSoftwareOperationalLearningActivationDryRunRehearsal: read(
    "scripts/run-all-software-operational-learning-activation-dry-run-rehearsal.mjs"
  ),
  allSoftwareOperationalLearningRegistrationExecuteGate: read(
    "scripts/create-all-software-operational-learning-registration-execute-gate.mjs"
  ),
  allSoftwareOperationalLearningRegistrationApprovedCommandBuilder: read(
    "scripts/create-all-software-operational-registration-approved-command-builder.mjs"
  ),
  allSoftwareOperationalLearningPostRegistrationOutputWitnessCommandBuilder: read(
    "scripts/create-all-software-operational-post-registration-output-witness-command-builder.mjs"
  ),
  allSoftwareOperationalLearningPostRegistrationOutputWitnessCommandBuilderSmoke: read(
    "scripts/smoke-operational-post-registration-output-witness-command-builder.mjs"
  ),
  allSoftwareOperationalLearningPostRegistrationOutputWitnessReceiptBuilder: read(
    "scripts/create-all-software-operational-post-registration-output-witness-receipt-builder.mjs"
  ),
  allSoftwareOperationalLearningPostRegistrationOutputWitnessReceiptValidation: read(
    "scripts/validate-all-software-operational-post-registration-output-witness-receipt.mjs"
  ),
  allSoftwareOperationalLearningPostRegistrationOutputWitnessReceiptReviewSmoke: read(
    "scripts/smoke-operational-post-registration-output-witness-receipt-review.mjs"
  ),
  allSoftwareOperationalLearningRegistrationApprovedRunner: read(
    "scripts/run-all-software-operational-learning-registration-approved-runner.mjs"
  ),
  allSoftwareOperationalLearningRegistrationApprovedRunnerSmoke: read(
    "scripts/smoke-all-software-operational-learning-registration-approved-runner.mjs"
  ),
  allSoftwareOperationalLearningPostRegistrationOutputWitnessRunner: read(
    "scripts/run-all-software-operational-learning-post-registration-output-witness-runner.mjs"
  ),
  allSoftwareOperationalLearningPostRegistrationOutputWitnessRunnerSmoke: read(
    "scripts/smoke-all-software-operational-learning-post-registration-output-witness-runner.mjs"
  ),
  allSoftwareOperationalLearningPostActivationWitness: read(
    "scripts/create-all-software-operational-learning-post-activation-witness.mjs"
  ),
  allSoftwareOperationalPostActivationWitnessReceiptBuilder: read(
    "scripts/create-all-software-operational-post-activation-witness-receipt-builder.mjs"
  ),
  allSoftwareOperationalPostActivationWitnessReceiptBuilderSmoke: read(
    "scripts/smoke-all-software-operational-post-activation-witness-receipt-builder.mjs"
  ),
  allSoftwareOperationalPostActivationWitnessReceiptValidation: read(
    "scripts/validate-all-software-operational-post-activation-witness-receipt.mjs"
  ),
  allSoftwareOperationalPostActivationWitnessReceiptValidationSmoke: read(
    "scripts/smoke-all-software-operational-post-activation-witness-receipt-validation.mjs"
  ),
  allSoftwareOperationalStatusConsole: read("scripts/create-all-software-operational-status-console.mjs"),
  automaticTriggeredVisualCheckQueue: read("scripts/create-automatic-triggered-visual-check-queue.mjs"),
  lowTokenTriggerBudgetPlan: read("scripts/create-low-token-trigger-budget-plan.mjs"),
  eventTriggeredLowTokenObservationPolicy: read("scripts/create-event-triggered-low-token-observation-policy.mjs"),
  eventTriggeredLowTokenObservationPolicyReceiptBuilder: read(
    "scripts/create-event-triggered-low-token-observation-policy-receipt-builder.mjs"
  ),
  eventTriggeredLowTokenObservationPolicyReceiptValidation: read(
    "scripts/validate-event-triggered-low-token-observation-policy-receipt.mjs"
  ),
  realLocalAllSoftwareLowTokenReadinessPackage: read("scripts/create-real-local-all-software-low-token-readiness-package.mjs"),
  allSoftwareCoverageAudit: read("scripts/create-all-software-observer-coverage-audit.mjs"),
  allSoftwareCoverageEnrollmentLedger: read("scripts/create-all-software-coverage-enrollment-ledger.mjs"),
  allSoftwareCoverageEnrollmentFollowUpPlan: read("scripts/create-all-software-coverage-enrollment-follow-up-plan.mjs"),
  allSoftwareCoverageEnrollmentFollowUpReceiptBuilder: read("scripts/create-all-software-coverage-enrollment-follow-up-receipt-builder.mjs"),
  allSoftwareCoverageEnrollmentFollowUpReceiptValidation: read("scripts/validate-all-software-coverage-enrollment-follow-up-receipt.mjs"),
  allSoftwareCoverageEnrollmentFollowUpHandoffQueue: read("scripts/create-all-software-coverage-enrollment-follow-up-handoff-queue.mjs"),
  allSoftwareCoverageEnrollmentFollowUpHandoffItemCommandBuilder: read(
    "scripts/create-all-software-coverage-enrollment-follow-up-handoff-item-command-builder.mjs"
  ),
  allSoftwareCoverageEnrollmentFollowUpHandoffQueueItemRunner: read(
    "scripts/run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs"
  ),
  allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilder: read(
    "scripts/create-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder.mjs"
  ),
  allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidation: read(
    "scripts/validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs"
  ),
  allSoftwareCoverageEnrollmentFollowUpBatch: read("scripts/run-all-software-coverage-enrollment-follow-up-batch.mjs"),
  allSoftwareCoverageEnrollmentFollowUpReconciliation: read("scripts/reconcile-all-software-coverage-enrollment-follow-up-batch.mjs"),
  allSoftwareCoverageRepairQueue: read("scripts/create-all-software-coverage-repair-queue.mjs"),
  allSoftwareCoverageExpansionPlan: read("scripts/create-all-software-coverage-expansion-plan.mjs"),
  allSoftwareCoverageRolloutBatch: read("scripts/run-all-software-coverage-rollout-batch.mjs"),
  allSoftwareCoverageRolloutSupervisor: read("scripts/run-all-software-coverage-rollout-supervisor.mjs"),
  allSoftwareCoverageRolloutReceiptBuilder: read("scripts/create-all-software-coverage-rollout-receipt-builder.mjs"),
  allSoftwareCoverageRolloutReceiptValidation: read("scripts/validate-all-software-coverage-rollout-receipt.mjs"),
  allSoftwareCoverageRolloutHandoffQueue: read("scripts/create-all-software-coverage-rollout-handoff-queue.mjs"),
  allSoftwareCoverageRolloutHandoffQueueItemRunner: read("scripts/run-all-software-coverage-rollout-handoff-queue-item.mjs"),
  allSoftwareCoverageRolloutHandoffItemRunReviewReceiptBuilder: read(
    "scripts/create-all-software-coverage-rollout-handoff-item-run-review-receipt-builder.mjs"
  ),
  allSoftwareCoverageRolloutHandoffItemRunReviewReceiptValidation: read(
    "scripts/validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs"
  ),
  originalGoalReviewHandoffQueueItemRunner: read("scripts/run-original-goal-review-handoff-queue-item.mjs"),
  allSoftwareCoverageConvergenceAudit: read("scripts/create-all-software-coverage-convergence-audit.mjs"),
  convergenceAutomaticLearningPackage: read("scripts/create-convergence-automatic-learning-package.mjs"),
  allSoftwareControlChannelCoverageAudit: read("scripts/create-all-software-control-channel-coverage-audit.mjs"),
  allSoftwareExecutionPilotQueue: read("scripts/create-all-software-execution-pilot-queue.mjs"),
  allSoftwareExecutionCapabilityMatrix: read("scripts/create-all-software-execution-capability-matrix.mjs"),
  allSoftwareExecutionCapabilityMatrixFollowUpBatch: read("scripts/run-all-software-execution-capability-matrix-follow-up-batch.mjs"),
  allSoftwareExecutionCapabilityMatrixFollowUpReconciliation: read("scripts/reconcile-all-software-execution-capability-matrix-follow-up-batch.mjs"),
  allSoftwareExecutionFollowUpHandoffQueue: read("scripts/create-all-software-execution-follow-up-handoff-queue.mjs"),
  allSoftwareExecutionFollowUpHandoffItemCommandBuilder: read(
    "scripts/create-all-software-execution-follow-up-handoff-item-command-builder.mjs"
  ),
  allSoftwareExecutionFollowUpHandoffQueueItemRunner: read("scripts/run-all-software-execution-follow-up-handoff-queue-item.mjs"),
  allSoftwareExecutionFollowUpHandoffItemReceiptBuilder: read("scripts/create-all-software-execution-follow-up-handoff-item-receipt-builder.mjs"),
  allSoftwareExecutionFollowUpHandoffItemReceiptValidation: read("scripts/validate-all-software-execution-follow-up-handoff-item-receipt.mjs"),
  allSoftwareExecutionApprovalGatePrepRunner: read("scripts/run-all-software-execution-approval-gate-prep-runner.mjs"),
  allSoftwareExecutionApprovedGateCommandBuilder: read("scripts/create-all-software-execution-approved-gate-command-builder.mjs"),
  allSoftwareExecutionApprovedGateRunner: read("scripts/run-all-software-execution-approved-gate-runner.mjs"),
  allSoftwareExecutionCapabilitySupervisor: read("scripts/run-all-software-execution-capability-supervisor.mjs"),
  allSoftwareExecutionCapabilityConvergenceAudit: read("scripts/create-all-software-execution-capability-convergence-audit.mjs"),
  allSoftwareExecutionPilotRunner: read("scripts/run-all-software-execution-pilot-runner.mjs"),
  allSoftwareExecutionPilotBatch: read("scripts/run-all-software-execution-pilot-batch.mjs"),
  realLocalAllSoftwareExecutionReadinessBatch: read("scripts/run-real-local-all-software-execution-readiness-batch.mjs"),
  realLocalExecutionPilotSelector: read("scripts/create-real-local-execution-pilot-selector.mjs"),
  automaticObserverSchedule: read("scripts/create-automatic-observer-schedule.mjs"),
  softwareInventory: read("scripts/create-software-observer-inventory.mjs"),
  softwareObserverQueue: read("scripts/create-software-observer-queue.mjs"),
  allSoftwareLogSourceDiscoveryLedger: read("scripts/create-all-software-log-source-discovery-ledger.mjs"),
  logSourceMetadataDeltas: read("scripts/watch-log-source-metadata-deltas.mjs"),
  softwareObserverQueueRunner: read("scripts/run-software-observer-queue-item.mjs"),
  softwareObservationDeltaMonitor: read("scripts/monitor-software-observation-deltas.mjs"),
  triggeredVisualCheck: read("scripts/create-triggered-visual-check-request.mjs"),
  triggeredVisualCapture: read("scripts/capture-triggered-visual-check.mjs"),
  triggeredVisualLearningHandoff: read("scripts/create-triggered-visual-evidence-learning-handoff.mjs"),
  triggeredVisualLearningHandoffReview: read("scripts/run-triggered-visual-evidence-learning-handoff-review.mjs"),
  triggeredVisualLearningHandoffReviewReceiptValidation: read(
    "scripts/validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs"
  ),
  triggeredVisualVoiceControlWorkbench: read("scripts/create-triggered-visual-evidence-voice-control-workbench.mjs"),
  softwareObserverWatchCycle: read("scripts/run-software-observer-watch-cycle.mjs"),
  universalObserver: read("scripts/create-universal-software-observer-kit.mjs"),
  teacherMethodProfile: read("scripts/create-teacher-learning-method-profile.mjs"),
  engineeringCommand: read("scripts/create-engineering-command-confirmation-kit.mjs"),
  visualEngineeringTargetConfirmation: read("scripts/create-visual-engineering-target-confirmation-kit.mjs"),
  engineeringVoiceControlSession: read("scripts/create-engineering-voice-control-session.mjs"),
  engineeringVoiceControlWorkbench: read("scripts/create-engineering-voice-control-workbench.mjs"),
  engineeringVoiceCommandControlLoop: read("scripts/run-engineering-voice-command-control-loop.mjs"),
  engineeringVoiceExecutionApprovalGate: read("scripts/create-engineering-voice-execution-approval-gate.mjs"),
  goalCommandCenter: read("scripts/create-goal-command-center.mjs"),
  goalCommandCenterTrial: read("scripts/run-goal-command-center-trial.mjs"),
  engineeringCommandTarget: read("scripts/confirm-engineering-command-target.mjs"),
  engineeringCommandTargetReceiptValidation: read("scripts/validate-engineering-command-target-confirmation-receipt.mjs"),
  spatialTargetConfirmation: read("scripts/create-spatial-target-confirmation-kit.mjs"),
  transparentSketchDepthDemonstrationRehearsal: read("scripts/create-transparent-sketch-depth-demonstration-rehearsal.mjs"),
  transparentSketchDepthRehearsalReviewReceiptBuilder: read(
    "scripts/create-transparent-sketch-depth-rehearsal-review-receipt-builder.mjs"
  ),
  transparentSketchDepthRehearsalReviewReceiptValidation: read(
    "scripts/validate-transparent-sketch-depth-rehearsal-review-receipt.mjs"
  ),
  compactLearningEvents: read("scripts/compact-universal-observation-learning-events.mjs"),
  softwareProfile: read("scripts/create-software-capability-profile.mjs"),
  softwareControlChannelProbe: read("scripts/create-software-control-channel-probe.mjs"),
  softwareControlChannel: read("scripts/create-software-control-channel-profile.mjs"),
  adaptiveObserver: read("scripts/create-adaptive-software-observer-from-profile.mjs"),
  overlay: read("scripts/create-transparent-sketch-overlay-kit.mjs"),
  spatialIntent: read("scripts/interpret-transparent-sketch-spatial-intent.mjs"),
  spatialExecutionRouteBridge: read("scripts/create-spatial-software-execution-route-bridge.mjs"),
  parametricDrawingLogic: read("scripts/create-parametric-drawing-logic-learning-kit.mjs"),
  parametricDrawingLogicReceiptValidation: read("scripts/validate-parametric-drawing-logic-receipt.mjs"),
  parametricDrawingLogicRulePackage: read("scripts/compile-parametric-drawing-logic-rule-package.mjs"),
  universalDetailLogicApplicationDryRun: read("scripts/apply-universal-detail-logic-rule-package-dry-run.mjs"),
  universalDetailLogicExistingToolPreview: read("scripts/create-universal-detail-logic-existing-tool-preview-package.mjs"),
  supervisedAction: read("scripts/create-supervised-software-action-kit.mjs"),
  executionAdapter: read("scripts/create-existing-software-execution-adapter.mjs"),
  supervisedOutcome: read("scripts/verify-supervised-action-outcome.mjs"),
  postActionCheckpoint: read("scripts/create-post-action-evidence-checkpoint.mjs"),
  learningWorkflow: read("scripts/create-learning-workflow.mjs"),
  teachExecuteLoop: read("scripts/create-teach-execute-learning-loop.mjs"),
  teachExecuteSafeStart: read("scripts/start-teach-execute-safe-run.mjs"),
  teachExecuteReviewedObservation: read("scripts/start-teach-execute-reviewed-observation.mjs"),
  teachExecuteActionRehearsal: read("scripts/start-teach-execute-action-rehearsal.mjs"),
  teachExecuteSupervisedExecution: read("scripts/start-teach-execute-supervised-execution.mjs"),
  toolSurfaceSmoke: read("scripts/smoke-mcp-tool-surface.mjs"),
  teacherMethodProfileSmoke: read("scripts/smoke-teacher-learning-method-profile.mjs"),
  existingDrawingSpatialControlledExecutionSmoke: read("scripts/smoke-existing-drawing-spatial-controlled-execution.mjs"),
  sketchDemonstrationImplementationAuditSmoke: read("scripts/smoke-sketch-demonstration-implementation-audit.mjs"),
  transparentOverlayBrowserSpatialFlowSmoke: read("scripts/smoke-transparent-overlay-browser-packet-spatial-flow.mjs"),
  engineeringCommandSmoke: read("scripts/smoke-engineering-command-confirmation.mjs"),
  visualEngineeringTargetConfirmationSmoke: read("scripts/smoke-visual-engineering-target-confirmation.mjs"),
  engineeringVoiceControlSessionSmoke: read("scripts/smoke-engineering-voice-control-session.mjs"),
  engineeringVoiceControlWorkbenchSmoke: read("scripts/smoke-engineering-voice-control-workbench.mjs"),
  engineeringVoiceCommandControlLoopSmoke: read("scripts/smoke-engineering-voice-command-control-loop.mjs"),
  engineeringVoiceExecutionApprovalGateSmoke: read("scripts/smoke-engineering-voice-execution-approval-gate.mjs"),
  goalCommandCenterSmoke: read("scripts/smoke-goal-command-center.mjs"),
  goalCommandCenterTrialSmoke: read("scripts/smoke-goal-command-center-trial.mjs"),
  engineeringCommandTargetSmoke: read("scripts/smoke-engineering-command-target-confirmation.mjs"),
  spatialTargetConfirmationSmoke: read("scripts/smoke-spatial-target-confirmation.mjs"),
  transparentSketchDepthDemonstrationRehearsalSmoke: read("scripts/smoke-transparent-sketch-depth-demonstration-rehearsal.mjs"),
  transparentSketchDepthRehearsalReviewReceiptSmoke: read(
    "scripts/smoke-transparent-sketch-depth-rehearsal-review-receipt.mjs"
  ),
  universalOverlaySmoke: read("scripts/smoke-universal-observer-and-overlay.mjs"),
  spatialIntentSmoke: read("scripts/smoke-spatial-intent-interpreter.mjs"),
  spatialExecutionRouteBridgeSmoke: read("scripts/smoke-spatial-software-execution-route-bridge.mjs"),
  parametricDrawingLogicSmoke: read("scripts/smoke-parametric-drawing-logic-learning-kit.mjs"),
  parametricDrawingLogicReceiptValidationSmoke: read("scripts/smoke-parametric-drawing-logic-receipt-validation.mjs"),
  parametricDrawingLogicRulePackageSmoke: read("scripts/smoke-parametric-drawing-logic-rule-package.mjs"),
  universalDetailLogicApplicationDryRunSmoke: read("scripts/smoke-universal-detail-logic-application-dry-run.mjs"),
  universalDetailLogicExistingToolPreviewSmoke: read("scripts/smoke-universal-detail-logic-existing-tool-preview-package.mjs"),
  realLocalSpatialExecutionRouteSmoke: read("scripts/smoke-real-local-spatial-execution-route.mjs"),
  realLocalEngineeringVoiceControlClosedLoopSmoke: read("scripts/smoke-real-local-engineering-voice-control-closed-loop.mjs"),
  realLocalEngineeringVoiceControlledExecutionSmoke: read("scripts/smoke-real-local-engineering-voice-controlled-execution.mjs"),
  realLocalEngineeringVoiceCommandControlLoopSmoke: read("scripts/smoke-real-local-engineering-voice-command-control-loop.mjs"),
  realLocalFullGoalIntegratedCycleSmoke: read("scripts/smoke-real-local-full-goal-integrated-cycle.mjs"),
  supervisedActionSmoke: read("scripts/smoke-supervised-action-bridge.mjs"),
  executionAdapterSmoke: read("scripts/smoke-existing-software-execution-adapter.mjs"),
  softwareControlChannelProbeSmoke: read("scripts/smoke-software-control-channel-probe.mjs"),
  softwareControlChannelSmoke: read("scripts/smoke-software-control-channel-profile.mjs"),
  supervisedOutcomeSmoke: read("scripts/smoke-supervised-action-outcome-verifier.mjs"),
  postActionCheckpointSmoke: read("scripts/smoke-post-action-evidence-checkpoint.mjs"),
  compactLearningEventsSmoke: read("scripts/smoke-compact-universal-learning-events.mjs"),
  softwareInventorySmoke: read("scripts/smoke-software-observer-inventory.mjs"),
  softwareObserverQueueSmoke: read("scripts/smoke-software-observer-queue.mjs"),
  allSoftwareLogSourceDiscoveryLedgerSmoke: read("scripts/smoke-all-software-log-source-discovery-ledger.mjs"),
  logSourceMetadataDeltasSmoke: read("scripts/smoke-log-source-metadata-deltas.mjs"),
  softwareObserverQueueRunnerSmoke: read("scripts/smoke-software-observer-queue-runner.mjs"),
  softwareObservationDeltaMonitorSmoke: read("scripts/smoke-software-observation-delta-monitor.mjs"),
  triggeredVisualCheckSmoke: read("scripts/smoke-triggered-visual-check-request.mjs"),
  triggeredVisualCaptureSmoke: read("scripts/smoke-triggered-visual-capture.mjs"),
  triggeredVisualLearningHandoffSmoke: read("scripts/smoke-triggered-visual-evidence-learning-handoff.mjs"),
  triggeredVisualLearningHandoffReviewSmoke: read("scripts/smoke-triggered-visual-evidence-learning-handoff-review.mjs"),
  triggeredVisualVoiceControlWorkbenchSmoke: read("scripts/smoke-triggered-visual-evidence-voice-control-workbench.mjs"),
  realLocalTriggeredVisualCheckSmoke: read("scripts/smoke-real-local-triggered-visual-check.mjs"),
  softwareObserverWatchCycleSmoke: read("scripts/smoke-software-observer-watch-cycle.mjs"),
  realLocalAllSoftwareObserverSmoke: read("scripts/smoke-real-local-all-software-observer.mjs"),
  realLocalAllSoftwareLowTokenReadinessPackageSmoke: read("scripts/smoke-real-local-all-software-low-token-readiness-package.mjs"),
  realLocalAllSoftwareCoverageAuditSmoke: read("scripts/smoke-real-local-all-software-coverage-audit.mjs"),
  allSoftwareCoverageEnrollmentLedgerSmoke: read("scripts/smoke-all-software-coverage-enrollment-ledger.mjs"),
  allSoftwareCoverageEnrollmentFollowUpPlanSmoke: read("scripts/smoke-all-software-coverage-enrollment-follow-up-plan.mjs"),
  allSoftwareCoverageEnrollmentFollowUpReceiptBuilderSmoke: read("scripts/smoke-all-software-coverage-enrollment-follow-up-receipt-builder.mjs"),
  allSoftwareCoverageEnrollmentFollowUpReceiptValidationSmoke: read("scripts/smoke-all-software-coverage-enrollment-follow-up-receipt-validation.mjs"),
  allSoftwareCoverageEnrollmentFollowUpHandoffQueueSmoke: read("scripts/smoke-all-software-coverage-enrollment-follow-up-handoff-queue.mjs"),
  allSoftwareCoverageEnrollmentFollowUpHandoffQueueItemRunnerSmoke: read(
    "scripts/smoke-all-software-coverage-enrollment-follow-up-handoff-queue-item-runner.mjs"
  ),
  allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptSmoke: read(
    "scripts/smoke-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs"
  ),
  allSoftwareCoverageEnrollmentFollowUpBatchSmoke: read("scripts/smoke-all-software-coverage-enrollment-follow-up-batch.mjs"),
  allSoftwareCoverageEnrollmentFollowUpReconciliationSmoke: read("scripts/smoke-all-software-coverage-enrollment-follow-up-reconciliation.mjs"),
  allSoftwareBootstrapSmoke: read("scripts/smoke-all-software-observer-bootstrap.mjs"),
  allSoftwareSupervisorSmoke: read("scripts/smoke-all-software-observer-supervisor.mjs"),
  allSoftwareLearningCycleSmoke: read("scripts/smoke-all-software-low-token-learning-cycle.mjs"),
  automaticLowTokenLearningRunnerSmoke: read("scripts/smoke-automatic-low-token-learning-runner.mjs"),
  automaticLowTokenLearningScheduleSmoke: read("scripts/smoke-automatic-low-token-learning-schedule.mjs"),
  allSoftwareRecurringMonitorApprovalGateSmoke: read("scripts/smoke-all-software-recurring-monitor-approval-gate.mjs"),
  realLocalAllSoftwareRecurringMonitorApprovalGateSmoke: read("scripts/smoke-real-local-all-software-recurring-monitor-approval-gate.mjs"),
  realLocalAllSoftwareRecurringMonitorRegistrationRunnerSmoke: read("scripts/smoke-real-local-all-software-recurring-monitor-registration-runner.mjs"),
  realLocalAllSoftwareRecurringMonitorRegistrationStatusSmoke: read("scripts/smoke-real-local-all-software-recurring-monitor-registration-status.mjs"),
  realLocalAllSoftwareRecurringMonitorRunOutputAuditSmoke: read("scripts/smoke-real-local-all-software-recurring-monitor-run-output-audit.mjs"),
  realLocalAllSoftwareRecurringMonitorTeacherReviewPacketSmoke: read("scripts/smoke-real-local-all-software-recurring-monitor-teacher-review-packet.mjs"),
  allSoftwareRecurringMonitorReviewDecisionReplayQueueSmoke: read("scripts/smoke-all-software-recurring-monitor-review-decision-replay-queue.mjs"),
  realLocalAllSoftwareUnattendedLearningAuditSmoke: read("scripts/smoke-real-local-all-software-unattended-learning-audit.mjs"),
  allSoftwareOperationalLearningWorkbenchSmoke: read("scripts/smoke-all-software-operational-learning-workbench.mjs"),
  realLocalAllSoftwareOperationalLearningTrialSmoke: read("scripts/smoke-real-local-all-software-operational-learning-trial.mjs"),
  allSoftwareOperationalLearningActivationGateSmoke: read("scripts/smoke-all-software-operational-learning-activation-gate.mjs"),
  automaticTriggeredVisualCheckQueueSmoke: read("scripts/smoke-automatic-triggered-visual-check-queue.mjs"),
  lowTokenTriggerBudgetPlanSmoke: read("scripts/smoke-low-token-trigger-budget-plan.mjs"),
  eventTriggeredLowTokenObservationPolicySmoke: read("scripts/smoke-event-triggered-low-token-observation-policy.mjs"),
  eventTriggeredLowTokenObservationPolicyReceiptBuilderSmoke: read(
    "scripts/smoke-event-triggered-low-token-observation-policy-receipt-builder.mjs"
  ),
  eventTriggeredLowTokenObservationPolicyReceiptSmoke: read("scripts/smoke-event-triggered-low-token-observation-policy-receipt.mjs"),
  realLocalAutomaticLowTokenLearningScheduleSmoke: read("scripts/smoke-real-local-automatic-low-token-learning-schedule.mjs"),
  realLocalAllSoftwareLearningCycleSmoke: read("scripts/smoke-real-local-all-software-low-token-learning-cycle.mjs"),
  allSoftwareCoverageAuditSmoke: read("scripts/smoke-all-software-observer-coverage-audit.mjs"),
  allSoftwareCoverageRepairQueueSmoke: read("scripts/smoke-all-software-coverage-repair-queue.mjs"),
  realLocalAllSoftwareCoverageRepairQueueSmoke: read("scripts/smoke-real-local-all-software-coverage-repair-queue.mjs"),
  realLocalAllSoftwareCoverageExpansionPlanSmoke: read("scripts/smoke-real-local-all-software-coverage-expansion-plan.mjs"),
  realLocalAllSoftwareCoverageRolloutBatchSmoke: read("scripts/smoke-real-local-all-software-coverage-rollout-batch.mjs"),
  realLocalAllSoftwareCoverageRolloutSupervisorSmoke: read("scripts/smoke-real-local-all-software-coverage-rollout-supervisor.mjs"),
  allSoftwareCoverageRolloutReceiptBuilderSmoke: read("scripts/smoke-all-software-coverage-rollout-receipt-builder.mjs"),
  allSoftwareCoverageRolloutHandoffQueueSmoke: read("scripts/smoke-all-software-coverage-rollout-handoff-queue.mjs"),
  allSoftwareCoverageRolloutHandoffQueueItemRunnerSmoke: read("scripts/smoke-all-software-coverage-rollout-handoff-queue-item-runner.mjs"),
  allSoftwareCoverageRolloutHandoffItemRunReviewReceiptSmoke: read(
    "scripts/smoke-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs"
  ),
  originalGoalReviewHandoffQueueItemRunnerSmoke: read("scripts/smoke-original-goal-review-handoff-queue-item-runner.mjs"),
  realLocalAllSoftwareCoverageConvergenceAuditSmoke: read("scripts/smoke-real-local-all-software-coverage-convergence-audit.mjs"),
  realLocalConvergenceAutomaticLearningPackageSmoke: read("scripts/smoke-real-local-convergence-automatic-learning-package.mjs"),
  realLocalAllSoftwareControlChannelCoverageAuditSmoke: read("scripts/smoke-real-local-all-software-control-channel-coverage-audit.mjs"),
  realLocalAllSoftwareExecutionPilotQueueSmoke: read("scripts/smoke-real-local-all-software-execution-pilot-queue.mjs"),
  realLocalAllSoftwareExecutionCapabilityMatrixSmoke: read("scripts/smoke-real-local-all-software-execution-capability-matrix.mjs"),
  realLocalAllSoftwareExecutionCapabilityMatrixFollowUpBatchSmoke: read(
    "scripts/smoke-real-local-all-software-execution-capability-matrix-follow-up-batch.mjs"
  ),
  realLocalAllSoftwareExecutionCapabilityFollowUpReconciliationSmoke: read(
    "scripts/smoke-real-local-all-software-execution-capability-follow-up-reconciliation.mjs"
  ),
  allSoftwareExecutionFollowUpHandoffQueueSmoke: read("scripts/smoke-all-software-execution-follow-up-handoff-queue.mjs"),
  allSoftwareExecutionFollowUpHandoffQueueItemRunnerSmoke: read(
    "scripts/smoke-all-software-execution-follow-up-handoff-queue-item-runner.mjs"
  ),
  allSoftwareExecutionFollowUpHandoffItemReceiptReviewSmoke: read(
    "scripts/smoke-all-software-execution-follow-up-handoff-item-receipt-review.mjs"
  ),
  allSoftwareExecutionApprovalGatePrepRunnerSmoke: read(
    "scripts/smoke-all-software-execution-approval-gate-prep-runner.mjs"
  ),
  allSoftwareExecutionApprovedGateRunnerSmoke: read(
    "scripts/smoke-all-software-execution-approved-gate-runner.mjs"
  ),
  realLocalAllSoftwareExecutionCapabilitySupervisorSmoke: read(
    "scripts/smoke-real-local-all-software-execution-capability-supervisor.mjs"
  ),
  realLocalAllSoftwareExecutionCapabilityConvergenceAuditSmoke: read(
    "scripts/smoke-real-local-all-software-execution-capability-convergence-audit.mjs"
  ),
  realLocalAllSoftwareExecutionPilotRunnerSmoke: read("scripts/smoke-real-local-all-software-execution-pilot-runner.mjs"),
  realLocalAllSoftwareExecutionPilotBatchSmoke: read("scripts/smoke-real-local-all-software-execution-pilot-batch.mjs"),
  realLocalAllSoftwareExecutionReadinessBatchSmoke: read("scripts/smoke-real-local-all-software-execution-readiness-batch.mjs"),
  realLocalExecutionPilotSelectorSmoke: read("scripts/smoke-real-local-execution-pilot-selector.mjs"),
  automaticObserverScheduleSmoke: read("scripts/smoke-automatic-observer-schedule.mjs"),
  adaptiveObserverSmoke: read("scripts/smoke-adaptive-software-observer-from-profile.mjs"),
  learningWorkflowSmoke: read("scripts/smoke-learning-workflow.mjs"),
  teachExecuteLoopSmoke: read("scripts/smoke-teach-execute-learning-loop.mjs"),
  teachExecuteSafeStartSmoke: read("scripts/smoke-teach-execute-safe-start.mjs"),
  teachExecuteReviewedObservationSmoke: read("scripts/smoke-teach-execute-reviewed-observation.mjs"),
  teachExecuteActionRehearsalSmoke: read("scripts/smoke-teach-execute-action-rehearsal.mjs"),
  teachExecuteSupervisedExecutionSmoke: read("scripts/smoke-teach-execute-supervised-execution.mjs"),
  originalGoalReadinessAudit: read("scripts/create-original-goal-readiness-audit.mjs"),
  originalGoalReadinessAuditSmoke: read("scripts/smoke-original-goal-readiness-audit.mjs"),
  originalGoalCurrentStatusRefresh: read("scripts/create-original-goal-current-status-refresh.mjs"),
  originalGoalCurrentStatusRefreshSmoke: read("scripts/smoke-original-goal-current-status-refresh.mjs"),
  originalGoalIntegratedControlFlow: read("scripts/create-original-goal-integrated-control-flow.mjs"),
  originalGoalIntegratedControlFlowSmoke: read("scripts/smoke-original-goal-integrated-control-flow.mjs"),
  originalGoalLowTokenCoverageEvidenceDossier: read("scripts/create-original-goal-low-token-coverage-evidence-dossier.mjs"),
  originalGoalLowTokenCoverageEvidenceDossierSmoke: read("scripts/smoke-original-goal-low-token-coverage-evidence-dossier.mjs"),
  originalGoalLowTokenMetadataGatePreflight: read("scripts/create-original-goal-low-token-metadata-gate-preflight.mjs"),
  originalGoalLowTokenMetadataGatePreflightSmoke: read("scripts/smoke-original-goal-low-token-metadata-gate-preflight.mjs"),
  originalGoalLowTokenMetadataGatePreflightReceiptBuilder: read(
    "scripts/create-original-goal-low-token-metadata-gate-preflight-receipt-builder.mjs"
  ),
  originalGoalLowTokenMetadataGatePreflightReceiptValidation: read(
    "scripts/validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs"
  ),
  originalGoalLowTokenMetadataGatePreflightReceiptSmoke: read(
    "scripts/smoke-original-goal-low-token-metadata-gate-preflight-receipt.mjs"
  ),
  originalGoalLowTokenMetadataGateValidationCommandRunner: read(
    "scripts/run-original-goal-low-token-metadata-gate-validation-command.mjs"
  ),
  originalGoalLowTokenMetadataGateValidationCommandRunnerSmoke: read(
    "scripts/smoke-original-goal-low-token-metadata-gate-validation-command-runner.mjs"
  ),
  originalGoalLowTokenCoverageEvidenceDossierReceiptBuilder: read(
    "scripts/create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs"
  ),
  originalGoalLowTokenCoverageEvidenceDossierReceiptValidation: read(
    "scripts/validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs"
  ),
  originalGoalLowTokenCoverageEvidenceDossierReceiptSmoke: read(
    "scripts/smoke-original-goal-low-token-coverage-evidence-dossier-receipt.mjs"
  ),
  originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidation: read(
    "scripts/validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
  ),
  originalGoalLowTokenCoverageWaitingRowCockpitReceiptSmoke: read(
    "scripts/smoke-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs"
  ),
  originalGoalLowTokenBlockedWaitingRowEvidencePlan: read(
    "scripts/create-original-goal-low-token-blocked-waiting-row-evidence-plan.mjs"
  ),
  originalGoalLowTokenBlockedWaitingRowEvidencePlanSmoke: read(
    "scripts/smoke-original-goal-low-token-blocked-waiting-row-evidence-plan.mjs"
  ),
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder: read(
    "scripts/create-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-builder.mjs"
  ),
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidation: read(
    "scripts/validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs"
  ),
  originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptSmoke: read(
    "scripts/smoke-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs"
  ),
  originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilder: read(
    "scripts/create-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs"
  ),
  originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderSmoke: read(
    "scripts/smoke-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs"
  ),
  originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunner: read(
    "scripts/run-original-goal-low-token-evidence-return-cockpit-receipt-validation.mjs"
  ),
  originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerSmoke: read(
    "scripts/smoke-original-goal-low-token-evidence-return-cockpit-receipt-validation-runner.mjs"
  ),
  originalGoalLowTokenCoverageCompletionGate: read("scripts/validate-original-goal-low-token-coverage-completion-gate.mjs"),
  originalGoalLowTokenCoverageCompletionGateSmoke: read(
    "scripts/smoke-original-goal-low-token-coverage-completion-gate.mjs"
  ),
  originalGoalFinalCompletionGate: read("scripts/validate-original-goal-final-completion-gate.mjs"),
  originalGoalFinalCompletionGateSmoke: read("scripts/smoke-original-goal-final-completion-gate.mjs"),
  originalGoalFinalTeacherAcceptanceReceiptBuilder: read(
    "scripts/create-original-goal-final-teacher-acceptance-receipt-builder.mjs"
  ),
  originalGoalFinalTeacherAcceptanceReceiptValidation: read(
    "scripts/validate-original-goal-final-teacher-acceptance-receipt.mjs"
  ),
  originalGoalFinalTeacherAcceptanceReceiptSmoke: read(
    "scripts/smoke-original-goal-final-teacher-acceptance-receipt.mjs"
  ),
  originalGoalTeacherActionRouter: read("scripts/create-original-goal-teacher-action-router.mjs"),
  originalGoalTeacherActionRouterSmoke: read("scripts/smoke-original-goal-teacher-action-router.mjs"),
  originalGoalTeacherActionRouterReceiptBuilder: read("scripts/create-original-goal-teacher-action-router-receipt-builder.mjs"),
  originalGoalTeacherActionRouterReceiptValidation: read("scripts/validate-original-goal-teacher-action-router-receipt.mjs"),
  originalGoalTeacherActionRouterReceiptSmoke: read("scripts/smoke-original-goal-teacher-action-router-receipt.mjs"),
  originalGoalTeacherActionRouterHandoffQueue: read("scripts/create-original-goal-teacher-action-router-handoff-queue.mjs"),
  originalGoalTeacherActionRouterHandoffQueueSmoke: read("scripts/smoke-original-goal-teacher-action-router-handoff-queue.mjs"),
  goalTeacherReviewCockpitHandoffQueue: read("scripts/create-goal-teacher-review-cockpit-handoff-queue.mjs"),
  goalTeacherReviewCockpitHandoffQueueSmoke: read("scripts/smoke-goal-teacher-review-cockpit-handoff-queue.mjs"),
  originalGoalReviewEntrypointHealthAudit: read("scripts/audit-original-goal-review-entrypoint-health.mjs"),
  originalGoalReviewEntrypointHealthAuditSmoke: read("scripts/smoke-original-goal-review-entrypoint-health.mjs"),
  originalGoalCompletionBlockerMatrix: read("scripts/create-original-goal-completion-blocker-matrix.mjs"),
  originalGoalCompletionBlockerNextStepQueue: read("scripts/create-original-goal-completion-blocker-next-step-queue.mjs"),
  originalGoalCompletionBlockerLaneRunReviewReceiptBuilder: read(
    "scripts/create-original-goal-completion-blocker-lane-run-review-receipt-builder.mjs"
  ),
  originalGoalCompletionBlockerLaneRunReviewReceiptValidation: read(
    "scripts/validate-original-goal-completion-blocker-lane-run-review-receipt.mjs"
  ),
  originalGoalCompletionBlockerLaneRunReviewReceiptSmoke: read(
    "scripts/smoke-original-goal-completion-blocker-lane-run-review-receipt.mjs"
  )
};

const repoPackagePath = resolve(pluginRoot, "..", "..", "package.json");
const repoPackageJson = existsSync(repoPackagePath)
  ? JSON.parse(readFileSync(repoPackagePath, "utf8"))
  : null;
const adapterCatalog = JSON.parse(read("assets/templates/tool-adapters.json"));

const checks = [
  {
    requirement: "Can discover low-token evidence for arbitrary software, not only CAD or SolidWorks",
    pass:
      hasAll(files.universalObserver, [
        "notHardcodedToSoftware: true",
        "explicitLogPaths",
        "explicitLogRoots",
        "Get-WinEvent",
        "file modified-time deltas",
        "triggered screenshot only after meaningful state change",
        "fullContinuousRecording: false"
      ]) &&
      hasAll(files.compactLearningEvents, [
        "transparent_ai_compact_learning_events_from_universal_observation_v1",
        "log_tail_delta",
        "windows_event_log",
        "non_log_low_token_fallback",
        "manual_teacher_marker",
        "rawFullLogsRetained: false",
        "screenshotRequiredByDefault: false"
      ]) &&
      hasAll(files.softwareInventory, [
        "transparent_ai_software_observer_inventory_v1",
        "transparent_ai_software_observer_batch_plan_v1",
        "Get-Process",
        "CurrentVersion\\Uninstall",
        "transparent_ai_all_software_log_source_index_v1",
        "Get-CandidateLogFiles",
        "metadata_first_then_tail_on_trigger",
        "create_universal_software_observer_kit",
        "fullContinuousRecording: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.allSoftwareLogSourceDiscoveryLedger, [
        "transparent_ai_all_software_log_source_discovery_ledger_v1",
        "direct_log_candidates_ready_for_metadata_gate",
        "non_log_low_token_fallback_ready_for_review",
        "windows_event_log_fallback_ready_for_review",
        "needs_teacher_log_source_or_exclusion",
        "allSoftwareLogSourceDiscoveryComplete: false",
        "logContentsRead: false",
        "screenshotsCaptured: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.allSoftwareBootstrap, [
        "transparent_ai_all_software_observer_bootstrap_v1",
        "transparent_ai_all_software_teacher_review_template_v1",
        "create-software-observer-inventory.mjs",
        "create-software-observer-queue.mjs",
        "run-software-observer-watch-cycle.mjs",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.allSoftwareSupervisor, [
        "transparent_ai_all_software_observer_supervisor_v1",
        "run-software-observer-watch-cycle.mjs",
        "boundedPeriodicRun: true",
        "backgroundTaskInstalled: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.allSoftwareLearningCycle, [
        "transparent_ai_all_software_low_token_learning_cycle_v1",
        "watch-log-source-metadata-deltas.mjs",
        "metadataDeltaGateEnabled",
        "tailReadSkippedByMetadataGate",
        "nonLogFallbackQueuePath",
        "nonLogFallbackItems",
        "run-software-observer-watch-cycle.mjs",
        "run-software-observer-queue-item.mjs",
        "learning_events_waiting_for_teacher_review",
        "longTermMemoryWritten: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.automaticLowTokenLearningRunner, [
        "transparent_ai_automatic_low_token_learning_runner_v1",
        "run-all-software-low-token-learning-cycle.mjs",
        "skipTailWhenMetadataUnchanged",
        "compactChangedItemsOnly",
        "longTermMemoryWritten: false",
        "screenshotsCaptured: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.automaticLowTokenLearningSchedule, [
        "transparent_ai_automatic_low_token_learning_schedule_v1",
        "run-automatic-low-token-learning-runner.mjs",
        "Register-ScheduledTask",
        "TeacherConfirmed is required",
        "scheduledTaskInstalled: false",
        "longTermMemoryWritten: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.allSoftwareRecurringMonitorApprovalGate, [
        "transparent_ai_all_software_recurring_monitor_approval_gate_v1",
        "missing_explicit_teacher_recurring_monitor_confirmation",
        "missing_reviewed_monitor_scope_confirmation",
        "rollback_point_not_confirmed_for_recurring_monitor",
        "approvalGateDoesNotRegisterTask: true",
        "scheduledTaskInstalled: false",
        "longTermMemoryWritten: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.allSoftwareRecurringMonitorRegistrationRunner, [
        "transparent_ai_all_software_recurring_monitor_registration_runner_v1",
        "missing_explicit_teacher_registration_confirmation",
        "execute_requested_without_allow_system_change",
        "dry_run_ready_for_teacher_review",
        "unregisterCommand"
      ]) &&
      hasAll(files.allSoftwareRecurringMonitorRegistrationStatus, [
        "transparent_ai_all_software_recurring_monitor_registration_status_v1",
        "verified_not_registered_yet",
        "registered_and_matches_reviewed_runner",
        "registered_but_mismatch_blocked",
        "statusVerifierDoesNotChangeSystem: true",
        "registerTaskCalled: false",
        "unregisterTaskCalled: false",
        "startTaskCalled: false"
      ]) &&
      hasAll(files.allSoftwareRecurringMonitorRunOutputAudit, [
        "transparent_ai_all_software_recurring_monitor_run_output_audit_v1",
        "waiting_for_first_scheduled_run_output",
        "learning_events_waiting_for_teacher_review",
        "blocked_recurring_monitor_run_output_lock_mismatch",
        "runOutputAuditDoesNotChangeSystem: true",
        "runnerLaunched: false",
        "scheduledTaskRegistered: false",
        "longTermMemoryWritten: false"
      ]) &&
      hasAll(files.allSoftwareRecurringMonitorTeacherReviewPacket, [
        "transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1",
        "ready_for_teacher_teach_apprentice_review",
        "needs_triggered_visual_check_review",
        "blocked_until_lock_or_parse_issue_reviewed",
        "create_automatic_triggered_visual_check_queue",
        "longTermMemoryWritten: false",
        "screenshotsCaptured: false",
        "softwareActionsExecuted: false"
      ]) &&
      hasAll(files.allSoftwareRecurringMonitorReviewDecisionReplayQueue, [
        "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1",
        "blocked_invalid_acceptance_decision",
        "compact_teaching_follow_up_ready",
        "visual_follow_up_ready",
        "longTermMemoryWritten: false",
        "softwareActionsExecuted: false"
      ]) &&
      hasAll(files.allSoftwareUnattendedLearningAudit, [
        "transparent_ai_all_software_unattended_learning_audit_v1",
        "transparent_ai_all_software_unattended_learning_audit_receipt_v1",
        "unattended_learning_not_ready_remaining_gaps",
        "unattended_learning_ready_for_teacher_operational_review",
        "scheduled_task_not_registered_or_not_matching",
        "unattendedAllAppMonitoringComplete: false",
        "longTermMemoryWritten: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.realLocalAllSoftwareUnattendedLearningAuditSmoke, [
        "transparent_ai_real_local_all_software_unattended_learning_audit_smoke_v1",
        "Unattended learning audit detects missing chain evidence before completion",
        "Unattended learning audit aggregates schedule approval runner status output review and replay evidence",
        "Unattended learning audit preserves schedule runner screenshots memory execution and packaging locks"
      ]) &&
      hasAll(files.allSoftwareOperationalLearningWorkbench, [
        "transparent_ai_all_software_operational_learning_workbench_v1",
        "transparent_ai_all_software_operational_learning_workbench_receipt_v1",
        "ALL_SOFTWARE_OPERATIONAL_LEARNING_WORKBENCH_START_HERE.md",
        "scheduled_task_not_registered_or_not_matching",
        "operationalWorkbenchDoesNotRegisterTask: true",
        "operationalWorkbenchDoesNotLaunchRunner: true",
        "softwareActionsExecuted: false"
      ]) &&
      hasAll(files.allSoftwareOperationalLearningWorkbenchSmoke, [
        "transparent_ai_all_software_operational_learning_workbench_smoke_v1",
        "Operational workbench reports missing evidence instead of claiming automatic learning",
        "Operational workbench keeps unregistered scheduled task as the next real blocker",
        "Operational workbench can reach teacher operational review only from ready audit evidence"
      ]) &&
      hasAll(files.allSoftwareRecurringMonitorReviewDecisionReplayQueueSmoke, [
        "transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_smoke_v1",
        "Mixed decisions replay queues follow-up while preserving blockers",
        "Accepted decisions are explicitly blocked and do not enable memory or rules"
      ]) &&
      hasAll(files.automaticTriggeredVisualCheckQueue, [
        "transparent_ai_automatic_triggered_visual_check_queue_v1",
        "automatic_low_token_learning_runner",
        "captureOnlyAfterReview: true",
        "maxScreenshots: 1",
        "screenshotsCaptured: false",
        "longTermMemoryWritten: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.allSoftwareCoverageAudit, [
        "transparent_ai_all_software_observer_coverage_audit_v1",
        "transparent_ai_all_software_observer_coverage_repair_plan_v1",
        "covered_with_log_metadata_route",
        "covered_with_non_log_fallback_route",
        "needs_teacher_review_or_manual_signal",
        "logContentsRead: false",
        "screenshotsCaptured: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.allSoftwareCoverageRepairQueue, [
        "transparent_ai_all_software_coverage_repair_queue_v1",
        "transparent_ai_all_software_coverage_repair_queue_receipt_template_v1",
        "create_software_capability_profile",
        "create_software_control_channel_probe",
        "create_universal_software_observer_kit",
        "create_triggered_visual_check_request",
        "visualCheckOnlyAfterMeaningfulSignal: true",
        "memoryWritten: false"
      ]) &&
      hasAll(files.allSoftwareCoverageExpansionPlan, [
        "transparent_ai_all_software_coverage_expansion_plan_v1",
        "boundedBatchSize",
        "teacherExclusionReviewBeforeObservation",
        "noUniversalNativeExecutionClaim",
        "allSoftwareCoverageComplete: false",
        "run_automatic_low_token_learning_runner"
      ]) &&
      hasAll(files.allSoftwareCoverageRolloutBatch, [
        "transparent_ai_all_software_coverage_rollout_batch_run_v1",
        "transparent_ai_all_software_coverage_rollout_batch_receipt_v1",
        "run-automatic-low-token-learning-runner.mjs",
        "create-software-observer-queue.mjs",
        "allSoftwareCoverageComplete: false",
        "scheduledTaskInstalled: false"
      ]) &&
      hasAll(files.allSoftwareCoverageRolloutSupervisor, [
        "transparent_ai_all_software_coverage_rollout_supervisor_v1",
        "transparent_ai_all_software_coverage_rollout_supervisor_receipt_v1",
        "run-all-software-coverage-rollout-batch.mjs",
        "create-all-software-observer-coverage-audit.mjs",
        "allSoftwareCoverageComplete: false",
        "scheduledTaskInstalled: false"
      ]) &&
      hasAll(files.allSoftwareCoverageConvergenceAudit, [
        "transparent_ai_all_software_coverage_convergence_audit_v1",
        "transparent_ai_all_software_coverage_convergence_audit_receipt_v1",
        "coverageConvergedForTeacherReview",
        "allSoftwareCoverageComplete: false",
        "scheduledTaskInstalled: false"
      ]) &&
      hasAll(files.automaticObserverSchedule, [
        "transparent_ai_automatic_observer_schedule_v1",
        "Register-ScheduledTask",
        "TeacherConfirmed is required",
        "scheduledTaskInstalled: false",
        "fullContinuousRecording: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.softwareControlChannelProbe, [
        "transparent_ai_software_control_channel_probe_result_v1",
        "transparent_ai_software_control_channel_probe_to_profile_request_v1",
        "targetSoftwareCommandsExecuted: false",
        "fileContentsRead = $false",
        "Get-Process",
        "Get-NetTCPConnection",
        "create_software_control_channel_profile",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.mcp.includes("create_all_software_observer_bootstrap") &&
      files.mcp.includes("run_all_software_observer_supervisor") &&
      files.mcp.includes("run_all_software_low_token_learning_cycle") &&
      files.mcp.includes("run_automatic_low_token_learning_runner") &&
      files.mcp.includes("create_automatic_low_token_learning_schedule") &&
      files.mcp.includes("create_all_software_recurring_monitor_approval_gate") &&
      files.mcp.includes("run_all_software_recurring_monitor_registration_runner") &&
      files.mcp.includes("verify_all_software_recurring_monitor_registration_status") &&
      files.mcp.includes("audit_all_software_recurring_monitor_run_output") &&
      files.mcp.includes("create_all_software_recurring_monitor_teacher_review_packet") &&
      files.mcp.includes("create_all_software_recurring_monitor_review_decision_replay_queue") &&
      files.mcp.includes("create_all_software_unattended_learning_audit") &&
      files.mcp.includes("create_automatic_triggered_visual_check_queue") &&
      files.mcp.includes("allSoftwareLearningCycle") &&
      files.mcp.includes("create_all_software_observer_coverage_audit") &&
      files.mcp.includes("allSoftwareObserverCoverageAudit") &&
      files.mcp.includes("create_all_software_coverage_repair_queue") &&
      files.mcp.includes("allSoftwareCoverageRepairQueue") &&
      files.realLocalAllSoftwareCoverageRepairQueueSmoke.includes("transparent_ai_real_local_all_software_coverage_repair_queue_smoke_v1") &&
      files.mcp.includes("create_all_software_coverage_expansion_plan") &&
      files.mcp.includes("allSoftwareCoverageExpansionPlan") &&
      files.realLocalAllSoftwareCoverageExpansionPlanSmoke.includes("transparent_ai_real_local_all_software_coverage_expansion_plan_smoke_v1") &&
      files.mcp.includes("run_all_software_coverage_rollout_batch") &&
      files.mcp.includes("allSoftwareCoverageRolloutBatch") &&
      files.realLocalAllSoftwareCoverageRolloutBatchSmoke.includes("transparent_ai_real_local_all_software_coverage_rollout_batch_smoke_v1") &&
      files.mcp.includes("run_all_software_coverage_rollout_supervisor") &&
      files.mcp.includes("allSoftwareCoverageRolloutSupervisor") &&
      files.realLocalAllSoftwareCoverageRolloutSupervisorSmoke.includes("transparent_ai_real_local_all_software_coverage_rollout_supervisor_smoke_v1") &&
      files.mcp.includes("create_all_software_coverage_convergence_audit") &&
      files.mcp.includes("allSoftwareCoverageConvergenceAudit") &&
      files.realLocalAllSoftwareCoverageConvergenceAuditSmoke.includes("transparent_ai_real_local_all_software_coverage_convergence_audit_smoke_v1") &&
      files.mcp.includes("create_automatic_observer_schedule") &&
      files.mcp.includes("create_software_observer_inventory") &&
      files.mcp.includes("create_software_observer_queue") &&
      files.mcp.includes("watch_log_source_metadata_deltas") &&
      files.mcp.includes("run_software_observer_queue_item") &&
      files.mcp.includes("monitor_software_observation_deltas") &&
      files.mcp.includes("create_triggered_visual_check_request") &&
      files.mcp.includes("run_software_observer_watch_cycle") &&
      files.mcp.includes("create_software_control_channel_probe") &&
      hasAll(files.softwareObserverQueue, [
        "transparent_ai_software_observer_queue_v1",
        "candidateLogFiles",
        "no_candidate_logs_found",
        "nonLogFallbackSignals",
        "non-log fallback",
        "inventory_log_source_index",
        "watch_log_source_metadata_deltas",
        "boundedScan",
        "create_universal_software_observer_kit",
        "compact_universal_observation_learning_events",
        "fullLogsRead: false"
      ]) &&
      hasAll(files.logSourceMetadataDeltas, [
        "transparent_ai_log_source_metadata_delta_watch_v1",
        "metadata_only_change_gate_before_tail_or_screenshot",
        "transparent_ai_non_log_low_token_fallback_v1",
        "nonLogFallbackQueuePath",
        "logContentsRead: false",
        "fullLogsRead: false",
        "screenshotsCaptured: false",
        "run_software_observer_watch_cycle"
      ]) &&
      hasAll(files.softwareObserverQueueRunner, [
        "transparent_ai_software_observer_queue_item_run_result_v1",
        "transparent_ai_software_observer_queue_item_run_receipt_v1",
        "bounded_tail_only_for_selected_candidate_logs",
        "none_no_candidate_logs",
        "nonLogFallbackSummaries",
        "nonLogFallbackUsed",
        "maxTailBytes",
        "fullContinuousRecording: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.softwareObservationDeltaMonitor, [
        "transparent_ai_software_observation_delta_monitor_v1",
        "baseline_vs_current_low_token_delta_monitor",
        "screenshotRequiredByDefault: false",
        "screenshotsCaptured: false",
        "rawFullLogsRetained: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.triggeredVisualCheck, [
        "transparent_ai_triggered_visual_check_request_v1",
        "transparent_ai_triggered_visual_check_receipt_template_v1",
        "maxScreenshots: 1",
        "screenshotsCaptured: false",
        "fullContinuousRecording: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.softwareObserverWatchCycle, [
        "transparent_ai_software_observer_watch_cycle_v1",
        "transparent_ai_software_observer_watch_state_v1",
        "baseline_initialized_waiting_for_next_cycle",
        "screenshotsCaptured: false",
        "rawFullLogsRetained: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.softwareProfile, [
        "transparent_ai_software_capability_profile_v1",
        "transparent_ai_software_capability_probe_result_v1",
        "Get-Process",
        "Get-WinEvent",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.adaptiveObserver, [
        "transparent_ai_adaptive_software_observer_setup_v1",
        "create-universal-software-observer-kit.mjs",
        "fullContinuousRecording: false"
      ]) &&
      hasAll(files.teachExecuteLoop, [
        "all_software_observer_bootstrap",
        "all_software_observer_supervisor",
        "all_software_low_token_learning_cycle",
        "all_software_observer_coverage_audit",
        "all_software_inventory",
        "software_observer_queue",
        "log_source_metadata_delta_gate",
        "software_observer_queue_item_run",
        "software_observation_delta_monitor",
        "software_observer_watch_cycle",
        "software_profile",
        "adaptive_observer",
        "universal_observation"
      ]) &&
      hasAll(files.teachExecuteReviewedObservation, [
        "transparent_ai_teach_execute_reviewed_observation_v1",
        "blocked_waiting_for_teacher_confirmation",
        "create-software-observer-inventory.mjs",
        "create-software-observer-queue.mjs",
        "run-software-observer-watch-cycle.mjs",
        "logContentsReadByInventory: false",
        "softwareActionsExecuted: false",
        "screenshotsCaptured: false",
        "fullContinuousRecording: false"
      ]) &&
      files.softwareObserverQueueSmoke.includes("Queue supports non-CAD apps and keeps native execution locked") &&
      files.softwareObserverQueueSmoke.includes("Queue creates non-log fallback route when no candidate logs are found") &&
      files.logSourceMetadataDeltasSmoke.includes("Metadata gate detects changed log before tail reads or screenshots") &&
      files.softwareInventorySmoke.includes("Generated probe runs with small limits and writes bounded log-source index metadata") &&
      files.allSoftwareLogSourceDiscoveryLedgerSmoke.includes("Direct log candidates route to metadata gate before tail read") &&
      files.allSoftwareLogSourceDiscoveryLedgerSmoke.includes("No-log apps route to low-token fallback before screenshots") &&
      files.softwareObserverQueueRunnerSmoke.includes("Queue runner consumes one reviewed non-CAD software item") &&
      files.softwareObserverQueueRunnerSmoke.includes("Queue runner creates non-log fallback compact events when no logs exist") &&
      files.softwareObservationDeltaMonitorSmoke.includes("Delta monitor requests screenshot only after meaningful trigger") &&
      files.triggeredVisualCheckSmoke.includes("Metadata-only gate does not jump straight to screenshots by default") &&
      hasAll(files.triggeredVisualCapture, [
        "transparent_ai_triggered_visual_check_capture_receipt_v1",
        "transparent_ai_automatic_triggered_visual_check_queue_v1",
        "selectedRequestId",
        "dry_run_no_screenshot_captured",
        "captured_one_bounded_visual_evidence",
        "nextLearningHandoffCommand",
        "create-triggered-visual-evidence-learning-handoff.mjs",
        "maxScreenshots: 1",
        "fullContinuousRecording: false",
        "softwareActionsExecuted: false"
      ]) &&
      hasAll(files.triggeredVisualLearningHandoff, [
        "transparent_ai_triggered_visual_evidence_learning_handoff_v1",
        "learn_from_visual_evidence_without_trigger_receipt",
        "handoffDoesNotCaptureScreenshots: true",
        "handoffDoesNotExecuteSoftware: true",
        "handoffDoesNotWriteMemory: true",
        "teacherReviewRequiredBeforeMemory: true",
        "nextLearningCardReviewCommand",
        "run-triggered-visual-evidence-learning-handoff-review.mjs"
      ]) &&
      hasAll(files.triggeredVisualLearningHandoffReview, [
        "transparent_ai_triggered_visual_evidence_learning_handoff_review_result_v1",
        "transparent_ai_triggered_visual_evidence_learning_handoff_review_receipt_v1",
        "validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs",
        "usedExistingTeachingEngine",
        "continue-teaching.mjs",
        "show-teaching-card.mjs",
        "handoffReviewDoesNotCaptureScreenshots: true",
        "handoffReviewDoesNotExecuteSoftware: true",
        "handoffReviewDoesNotWriteMemory: true",
        "handoffReviewDoesNotEnableRules: true"
      ]) &&
      hasAll(files.triggeredVisualLearningHandoffReviewReceiptValidation, [
        "transparent_ai_triggered_visual_evidence_learning_handoff_review_receipt_validation_v1",
        "ready_for_review_only_follow_up_not_memory",
        "blocked_forbidden_teacher_decision",
        "validationDoesNotCaptureScreenshots: true",
        "validationDoesNotExecuteSoftware: true",
        "validationDoesNotWriteMemory: true",
        "validationDoesNotEnableRules: true",
        "canWriteMemory: false",
        "canEnableRules: false",
        "canExecuteSoftware: false"
      ]) &&
      hasAll(files.triggeredVisualVoiceControlWorkbench, [
        "transparent_ai_triggered_visual_evidence_voice_control_workbench_v1",
        "create-engineering-voice-control-workbench.mjs",
        "create-visual-engineering-target-confirmation-kit.mjs",
        "bridgeDoesNotCaptureScreenshots: true",
        "bridgeDoesNotExecuteSoftware: true",
        "bridgeDoesNotReadFullLogs: true",
        "bridgeDoesNotWriteMemory: true",
        "bridgeDoesNotEnableRules: true"
      ]) &&
      files.triggeredVisualCaptureSmoke.includes("Capture runner dry-runs without teacher confirmation") &&
      files.triggeredVisualCaptureSmoke.includes("Teacher-confirmed capture stores exactly one bounded visual evidence file") &&
      files.triggeredVisualCaptureSmoke.includes("Automatic low-token visual-check queue can be captured by selected request id") &&
      files.triggeredVisualLearningHandoffSmoke.includes("transparent_ai_triggered_visual_evidence_learning_handoff_smoke_v1") &&
      files.triggeredVisualLearningHandoffSmoke.includes("Captured visual evidence becomes a complete learning handoff packet") &&
      files.triggeredVisualLearningHandoffSmoke.includes("nextLearningCardReviewCommand") &&
      files.triggeredVisualLearningHandoffSmoke.includes("Default teach_apprentice accepts request receipt and image as one review-only learning handoff") &&
      files.triggeredVisualLearningHandoffSmoke.includes("Learning handoff keeps memory approval and packaging locked") &&
      files.triggeredVisualLearningHandoffReviewSmoke.includes("transparent_ai_triggered_visual_evidence_learning_handoff_review_smoke_v1") &&
      files.triggeredVisualLearningHandoffReviewSmoke.includes("Review runner automatically reuses the existing teaching engine") &&
      files.triggeredVisualLearningHandoffReviewSmoke.includes("Handoff review creates a teacher-facing learning card") &&
      files.triggeredVisualLearningHandoffReviewSmoke.includes("Review runner keeps screenshots execution memory rules and packaging locked") &&
      files.triggeredVisualVoiceControlWorkbenchSmoke.includes("transparent_ai_triggered_visual_evidence_voice_control_workbench_smoke_v1") &&
      files.triggeredVisualVoiceControlWorkbenchSmoke.includes("Triggered visual evidence creates a voice/text numbered-target workbench") &&
      files.triggeredVisualVoiceControlWorkbenchSmoke.includes("Workbench reuses the confirmed visual evidence as the numbered-target backdrop") &&
      files.triggeredVisualVoiceControlWorkbenchSmoke.includes("Bridge does not capture screenshots execute software read full logs write memory or unlock packaging") &&
      files.realLocalTriggeredVisualCheckSmoke.includes("transparent_ai_real_local_triggered_visual_check_smoke_v1") &&
      files.realLocalTriggeredVisualCheckSmoke.includes("Metadata baseline and unchanged pass skip tail reads and screenshots") &&
      files.realLocalTriggeredVisualCheckSmoke.includes("Changed metadata narrows the real local queue before any screenshot") &&
      files.softwareObserverWatchCycleSmoke.includes("Watch cycle scans multiple non-CAD software queue items with bounded tails") &&
      files.realLocalAllSoftwareObserverSmoke.includes("transparent_ai_real_local_all_software_observer_smoke_v1") &&
      files.realLocalAllSoftwareObserverSmoke.includes("Real local inventory probe runs with small limits") &&
      files.realLocalAllSoftwareObserverSmoke.includes("Real local inventory turns into a reviewed observer queue") &&
      files.realLocalAllSoftwareObserverSmoke.includes("Real local queue can initialize a low-token watch baseline") &&
      hasAll(files.realLocalAllSoftwareLowTokenReadinessPackage, [
        "transparent_ai_real_local_all_software_low_token_readiness_package_v1",
        "create_software_observer_inventory",
        "create_software_observer_queue",
        "create_all_software_log_source_discovery_ledger",
        "logSourceDiscoveryLedger",
        "directLogCandidatesReadyForMetadataGate",
        "lowTokenFallbackRoutesReadyForReview",
        "run_automatic_low_token_learning_runner",
        "create_all_software_observer_coverage_audit",
        "create_all_software_coverage_repair_queue",
        "create_automatic_low_token_learning_schedule",
        "create_automatic_triggered_visual_check_queue"
      ]) &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("transparent_ai_real_local_all_software_low_token_readiness_package_smoke_v1") &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("Readiness package runs real local inventory and observer queue with bounded limits") &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("Readiness package maps real local software rows to log sources or low-token fallbacks") &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("Readiness package creates coverage audit and repair queue for widening all-software learning") &&
      files.allSoftwareBootstrapSmoke.includes("Bootstrap turns reviewed non-CAD inventory into queue and watch baseline") &&
      files.allSoftwareSupervisorSmoke.includes("Supervisor detects meaningful later log delta and stops for teacher review") &&
      files.allSoftwareLearningCycleSmoke.includes("Learning cycle initializes metadata baseline without tail reads or learning events") &&
      files.allSoftwareLearningCycleSmoke.includes("Learning cycle uses metadata gate to narrow changed logs before bounded tail reads") &&
      files.allSoftwareLearningCycleSmoke.includes("Learning cycle routes no-log software into non-log fallback instead of stalling") &&
      files.allSoftwareLearningCycleSmoke.includes("Learning cycle converts only changed reviewed software into compact learning events") &&
      files.allSoftwareLearningCycleSmoke.includes("Default teach_apprentice routes explicit all-software learning-cycle intent to new cycle") &&
      hasAll(files.eventTriggeredLowTokenObservationPolicy, [
        "transparent_ai_event_triggered_low_token_observation_policy_v1",
        "metadata_only_watch",
        "bounded_tail_or_compact_event",
        "teacher_review_before_visual",
        "one_bounded_screenshot",
        "nextReceiptBuilderCommand",
        "create-event-triggered-low-token-observation-policy-receipt-builder.mjs",
        "nextReceiptValidationCommand",
        "validate-event-triggered-low-token-observation-policy-receipt.mjs",
        "maxScreenshotsPerTrigger: 1",
        "softwareActionsExecuted: false"
      ]) &&
      hasAll(files.eventTriggeredLowTokenObservationPolicyReceiptBuilder, [
        "transparent_ai_event_triggered_low_token_observation_policy_receipt_builder_v1",
        "browserReceiptBuilder: true",
        "Download Receipt JSON",
        "builderDoesNotWriteTeacherFilledReceipt: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotExecuteSoftware: true"
      ]) &&
      hasAll(files.eventTriggeredLowTokenObservationPolicyReceiptValidation, [
        "transparent_ai_event_triggered_low_token_observation_policy_receipt_validation_v1",
        "transparent_ai_event_triggered_low_token_observation_policy_follow_up_queue_v1",
        "teacher_confirmed_event_trigger_policy_review_only",
        "validationDoesNotCaptureScreenshots: true",
        "validationDoesNotExecuteSoftware: true",
        "blocked_forbidden_teacher_decision"
      ]) &&
      files.mcp.includes("create_event_triggered_low_token_observation_policy") &&
      files.mcp.includes("create-event-triggered-low-token-observation-policy.mjs") &&
      files.eventTriggeredLowTokenObservationPolicySmoke.includes("transparent_ai_event_triggered_low_token_observation_policy_smoke_v1") &&
      files.eventTriggeredLowTokenObservationPolicySmoke.includes("Event-triggered policy keeps compact evidence before screenshots") &&
      files.eventTriggeredLowTokenObservationPolicySmoke.includes("Event-triggered policy allows only teacher-confirmed single visual checks") &&
      files.eventTriggeredLowTokenObservationPolicyReceiptBuilderSmoke.includes(
        "transparent_ai_event_triggered_low_token_observation_policy_receipt_builder_smoke_v1"
      ) &&
      files.eventTriggeredLowTokenObservationPolicyReceiptBuilderSmoke.includes(
        "Receipt builder writes browser page packet and default template"
      ) &&
      files.eventTriggeredLowTokenObservationPolicyReceiptSmoke.includes(
        "transparent_ai_event_triggered_low_token_observation_policy_receipt_smoke_v1"
      ) &&
      files.eventTriggeredLowTokenObservationPolicyReceiptSmoke.includes(
        "Policy receipt validation converts teacher-confirmed rows into review-only follow-up queue"
      ) &&
      files.automaticLowTokenLearningRunnerSmoke.includes("Automatic runner initializes persistent baseline without learning from unchanged startup state") &&
      files.automaticLowTokenLearningRunnerSmoke.includes("Automatic runner detects changed log metadata and creates compact learning events") &&
      files.automaticLowTokenLearningRunnerSmoke.includes("Automatic runner preserves low-token and review-only locks across runs") &&
      files.automaticLowTokenLearningScheduleSmoke.includes("Generated scheduled runner initializes baseline then learns only after changed metadata") &&
      files.automaticLowTokenLearningScheduleSmoke.includes("Schedule registration remains teacher-confirmed and locks screenshots, memory, execution, and native universal claims") &&
      files.allSoftwareRecurringMonitorApprovalGateSmoke.includes("transparent_ai_all_software_recurring_monitor_approval_gate_smoke_v1") &&
      files.allSoftwareRecurringMonitorApprovalGateSmoke.includes("Recurring monitor approval gate blocks registration without scope, teacher confirmation, and rollback") &&
      files.allSoftwareRecurringMonitorApprovalGateSmoke.includes("Approval gate produces registration request but does not install a scheduled task") &&
      files.realLocalAllSoftwareRecurringMonitorApprovalGateSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_approval_gate_smoke_v1") &&
      files.realLocalAllSoftwareRecurringMonitorApprovalGateSmoke.includes("Real local inventory and queue create reviewed scope for recurring monitor approval") &&
      files.realLocalAllSoftwareRecurringMonitorApprovalGateSmoke.includes("Real local reviewed queue creates an automatic low-token schedule package without registering a task") &&
      files.realLocalAllSoftwareRecurringMonitorApprovalGateSmoke.includes("Real local recurring monitor approval gate produces a registration request after scope, teacher confirmation, and rollback") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationRunnerSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_registration_runner_smoke_v1") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationRunnerSmoke.includes("Real local schedule and approval gate provide a reviewed registration request") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationRunnerSmoke.includes("Registration runner dry-run creates register and unregister commands without installing a task") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationRunnerSmoke.includes("Execute mode remains blocked unless the system-change allow flag is explicit") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationStatusSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_registration_status_smoke_v1") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationStatusSmoke.includes("Status verifier detects the unique smoke task is not registered without changing the system") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationStatusSmoke.includes("MCP advanced tool exposes the read-only registration status verifier") &&
      files.realLocalAllSoftwareRecurringMonitorRunOutputAuditSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_run_output_audit_smoke_v1") &&
      files.realLocalAllSoftwareRecurringMonitorRunOutputAuditSmoke.includes("Run-output audit reports no scheduled output before any runner launch") &&
      files.realLocalAllSoftwareRecurringMonitorRunOutputAuditSmoke.includes("Manual scheduled runner output becomes teacher-review recurring monitor learning events") &&
      files.allSoftwareRecurringMonitorTeacherReviewPacket.includes("transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1") &&
      files.allSoftwareRecurringMonitorTeacherReviewPacket.includes("ready_for_teacher_teach_apprentice_review") &&
      files.allSoftwareRecurringMonitorTeacherReviewPacket.includes("needs_triggered_visual_check_review") &&
      files.allSoftwareRecurringMonitorTeacherReviewPacket.includes("blocked_until_lock_or_parse_issue_reviewed") &&
      files.realLocalAllSoftwareRecurringMonitorTeacherReviewPacketSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_teacher_review_packet_smoke_v1") &&
      files.realLocalAllSoftwareRecurringMonitorTeacherReviewPacketSmoke.includes("Direct teacher-review packet routes compact evidence to teach_apprentice") &&
      files.realLocalAllSoftwareRecurringMonitorTeacherReviewPacketSmoke.includes("Visual teacher-method packet routes changed evidence to triggered visual-check request only") &&
      files.realLocalAutomaticLowTokenLearningScheduleSmoke.includes("Real local inventory and queue feed an automatic low-token learning schedule") &&
      files.realLocalAutomaticLowTokenLearningScheduleSmoke.includes("Generated real local scheduled runner performs a bounded low-token pass without registering the task") &&
      files.realLocalAllSoftwareLearningCycleSmoke.includes("transparent_ai_real_local_all_software_low_token_learning_cycle_smoke_v1") &&
      files.realLocalAllSoftwareLearningCycleSmoke.includes("Real local inventory probe discovers bounded all-software candidates without reading log contents") &&
      files.realLocalAllSoftwareLearningCycleSmoke.includes("Real local inventory becomes an all-software observer queue with log and non-log routes") &&
      files.realLocalAllSoftwareLearningCycleSmoke.includes("Learning cycle can generate a low-token queue directly from real local inventory") &&
      files.realLocalAllSoftwareLearningCycleSmoke.includes("Changed metadata narrows the real local software candidate before bounded compact learning") &&
      files.realLocalAllSoftwareLearningCycleSmoke.includes("No-log real local candidate routes to non-log low-token learning instead of continuous recording") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Real local all-software inventory and queue are created without log contents or screenshots") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Low-token learning uses metadata baseline then compact changed signal") &&
      files.allSoftwareCoverageAuditSmoke.includes("Coverage audit distinguishes log routes, non-log fallbacks, and gaps") &&
      files.allSoftwareCoverageAuditSmoke.includes("Default teach_apprentice routes explicit coverage-audit requests to the audit card") &&
      files.realLocalAllSoftwareCoverageAuditSmoke.includes("transparent_ai_real_local_all_software_coverage_audit_smoke_v1") &&
      files.realLocalAllSoftwareCoverageAuditSmoke.includes("Coverage audit consumes real local inventory and queue evidence") &&
      files.realLocalAllSoftwareCoverageAuditSmoke.includes("Bounded real local inventory, queue, and coverage audit complete without log/file contents, screenshots, execution, or memory") &&
      files.realLocalAllSoftwareCoverageRolloutSupervisorSmoke.includes("transparent_ai_real_local_all_software_coverage_rollout_supervisor_smoke_v1") &&
      files.realLocalAllSoftwareCoverageRolloutSupervisorSmoke.includes("Supervisor reruns coverage audit after each selected batch before widening") &&
      files.allSoftwareCoverageRolloutReceiptBuilder.includes("transparent_ai_all_software_coverage_rollout_receipt_builder_v1") &&
      files.allSoftwareCoverageRolloutReceiptValidation.includes("transparent_ai_all_software_coverage_rollout_receipt_validation_v1") &&
      files.allSoftwareCoverageRolloutHandoffQueue.includes("transparent_ai_all_software_coverage_rollout_handoff_queue_v1") &&
      files.allSoftwareCoverageRolloutHandoffQueue.includes("manual_coverage_rollout_handoffs_ready") &&
      files.allSoftwareCoverageRolloutHandoffQueue.includes("queueDoesNotRunRolloutSupervisor: true") &&
      files.allSoftwareCoverageRolloutHandoffQueueItemRunner.includes(
        "transparent_ai_all_software_coverage_rollout_handoff_queue_item_run_v1"
      ) &&
      files.allSoftwareCoverageRolloutHandoffQueueItemRunner.includes("run-all-software-coverage-rollout-supervisor.mjs") &&
      files.allSoftwareCoverageRolloutHandoffQueueItemRunner.includes("queueItemRunnerDoesNotRunArbitraryCommandString: true") &&
      files.allSoftwareCoverageRolloutHandoffQueueItemRunner.includes("queueItemRunnerUsesStructuredArgumentsOnly: true") &&
      files.allSoftwareCoverageRolloutHandoffQueueItemRunner.includes("queueItemRunnerConsumesOneHandoffItem: true") &&
      files.allSoftwareCoverageRolloutReceiptBuilderSmoke.includes("transparent_ai_all_software_coverage_rollout_receipt_builder_smoke_v1") &&
      files.allSoftwareCoverageRolloutReceiptBuilderSmoke.includes("Reviewed batch becomes review-only rollout supervisor command without running it") &&
      files.allSoftwareCoverageRolloutHandoffQueueSmoke.includes("transparent_ai_all_software_coverage_rollout_handoff_queue_smoke_v1") &&
      files.allSoftwareCoverageRolloutHandoffQueueSmoke.includes("Coverage rollout handoff queue blocks unsafe commands") &&
      files.allSoftwareCoverageRolloutHandoffQueueItemRunnerSmoke.includes(
        "transparent_ai_all_software_coverage_rollout_handoff_queue_item_runner_smoke_v1"
      ) &&
      files.allSoftwareCoverageRolloutHandoffQueueItemRunnerSmoke.includes(
        "Coverage rollout handoff item runner advances exactly one reviewed item"
      ) &&
      files.allSoftwareCoverageRolloutHandoffQueueItemRunnerSmoke.includes(
        "Coverage rollout handoff item runner uses structured arguments, not the display command string"
      ) &&
      files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptBuilder.includes(
        "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_builder_v1"
      ) &&
      files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptValidation.includes(
        "coverage_rollout_handoff_item_run_reviewed_for_convergence_audit"
      ) &&
      files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptSmoke.includes(
        "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_smoke_v1"
      ) &&
      files.realLocalAllSoftwareCoverageConvergenceAuditSmoke.includes("transparent_ai_real_local_all_software_coverage_convergence_audit_smoke_v1") &&
      files.realLocalAllSoftwareCoverageConvergenceAuditSmoke.includes("Convergence audit proves all sampled planned batches have post-batch audit packets") &&
      files.convergenceAutomaticLearningPackage.includes("transparent_ai_convergence_automatic_learning_package_v1") &&
      files.convergenceAutomaticLearningPackage.includes("transparent_ai_convergence_automatic_learning_package_receipt_v1") &&
      files.convergenceAutomaticLearningPackage.includes("run-automatic-low-token-learning-runner.mjs") &&
      files.convergenceAutomaticLearningPackage.includes("scheduledTaskInstalled: false") &&
      files.realLocalConvergenceAutomaticLearningPackageSmoke.includes("transparent_ai_real_local_convergence_automatic_learning_package_smoke_v1") &&
      files.realLocalConvergenceAutomaticLearningPackageSmoke.includes("Package reuses existing automatic low-token learning runner for every reviewed queue") &&
      files.allSoftwareControlChannelCoverageAudit.includes("transparent_ai_all_software_control_channel_coverage_audit_v1") &&
      files.allSoftwareControlChannelCoverageAudit.includes("structured_control_route_reviewable") &&
      files.allSoftwareControlChannelCoverageAudit.includes("supervised_ui_fallback_reviewable") &&
      files.allSoftwareControlChannelCoverageAudit.includes("observation_only_needs_control_evidence") &&
      files.allSoftwareControlChannelCoverageAudit.includes("needs_teacher_control_evidence") &&
      files.realLocalAllSoftwareControlChannelCoverageAuditSmoke.includes("transparent_ai_real_local_all_software_control_channel_coverage_audit_smoke_v1") &&
      files.realLocalAllSoftwareControlChannelCoverageAuditSmoke.includes("Real local inventory feeds all-software control-channel coverage audit") &&
      files.realLocalAllSoftwareControlChannelCoverageAuditSmoke.includes("Audit reuses existing control-channel profile creator for reviewed rows") &&
      files.allSoftwareExecutionPilotQueue.includes("transparent_ai_all_software_execution_pilot_queue_v1") &&
      files.realLocalAllSoftwareExecutionPilotQueueSmoke.includes("transparent_ai_real_local_all_software_execution_pilot_queue_smoke_v1") &&
      files.realLocalAllSoftwareExecutionPilotQueueSmoke.includes("Real local control-channel coverage feeds execution pilot queue") &&
      hasAll(files.goalCommandCenter, [
        "transparent_ai_goal_command_center_v1",
        "create-all-software-observer-bootstrap.mjs",
        "create-transparent-sketch-overlay-kit.mjs",
        "create-engineering-voice-control-workbench.mjs",
        "create-all-software-coverage-rollout-receipt-builder.mjs",
        "create-teach-execute-learning-loop.mjs",
        "commandCenterDoesNotExecuteSoftware"
      ]) &&
      files.goalCommandCenterSmoke.includes("transparent_ai_goal_command_center_smoke_v1") &&
      files.goalCommandCenterSmoke.includes("Command center reuses existing low-token observation, overlay, voice workbench, voice approval gate, and teach-execute tools") &&
      hasAll(files.goalCommandCenterTrial, [
        "transparent_ai_goal_command_center_trial_v1",
        "blocked_waiting_for_teacher_review",
        "create-software-observer-inventory.mjs",
        "run-all-software-low-token-learning-cycle.mjs",
        "screenshotsCaptured: false",
        "softwareActionsExecuted: false",
        "memoryWritten: false"
      ]) &&
      files.goalCommandCenterTrialSmoke.includes("transparent_ai_goal_command_center_trial_smoke_v1") &&
      files.goalCommandCenterTrialSmoke.includes("Trial blocks before teacher review and does not run inventory or learning") &&
      files.goalCommandCenterTrialSmoke.includes("Teacher-reviewed trial runs bounded read-only inventory and metadata-first low-token cycle") &&
      files.teachExecuteReviewedObservationSmoke.includes("Teacher-confirmed reviewed observation runs read-only inventory and creates queue") &&
      files.teachExecuteReviewedObservationSmoke.includes("Reviewed observation initializes bounded watch baseline without screenshots or execution") &&
      files.automaticObserverScheduleSmoke.includes("Registration script requires explicit teacher confirmation") &&
      files.universalOverlaySmoke.includes("Universal observer is not hardcoded to CAD or SolidWorks"),
    evidence: "real local bounded probe + all-software bootstrap + teacher-confirmed reviewed observation + bounded supervisor + all-software learning cycle + real-local readiness package + command-center trial runner + automatic low-token learning runner + automatic low-token learning schedule + recurring monitor run-output audit + recurring monitor teacher review packet + recurring monitor replay queue + unattended learning completion audit + operational learning workbench + convergence automatic learning package + all-software control-channel coverage audit + all-software execution pilot queue + goal command center + automatic triggered visual-check queue + real-local automatic learning schedule + real-local learning cycle + observer coverage audit + coverage repair queue + real-local coverage repair queue + real-local coverage expansion plan + real-local coverage rollout batch runner + real-local coverage rollout supervisor + real-local coverage convergence audit + automatic observer schedule + bounded log-source index + log-source discovery ledger + metadata delta gate + software inventory + observer queue + queue item runner + delta monitor + watch cycle + universal observer + profile probe + adaptive bridge + unified loop"
  },
  {
    requirement: "Maps every bounded software row to a direct log source or reviewed low-token fallback before claiming all-software learning",
    pass:
      files.mcp.includes("create_all_software_log_source_discovery_ledger") &&
      files.mcp.includes("create-all-software-log-source-discovery-ledger.mjs") &&
      hasAll(files.allSoftwareLogSourceDiscoveryLedger, [
        "transparent_ai_all_software_log_source_discovery_ledger_v1",
        "direct_log_candidates_ready_for_metadata_gate",
        "non_log_low_token_fallback_ready_for_review",
        "windows_event_log_fallback_ready_for_review",
        "candidate_roots_need_bounded_scan",
        "needs_teacher_log_source_or_exclusion",
        "teacher_excluded_or_private",
        "metadata gates run before any bounded tail read",
        "teacher reviews no-log fallback routes before screenshots",
        "allSoftwareLogSourceDiscoveryComplete: false",
        "logContentsRead: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.allSoftwareLogSourceDiscoveryLedgerSmoke.includes("transparent_ai_all_software_log_source_discovery_ledger_smoke_v1") &&
      files.allSoftwareLogSourceDiscoveryLedgerSmoke.includes("Direct log candidates route to metadata gate before tail read") &&
      files.allSoftwareLogSourceDiscoveryLedgerSmoke.includes("No-log apps route to low-token fallback before screenshots") &&
      files.allSoftwareLogSourceDiscoveryLedgerSmoke.includes("Rows with no source ask teacher for source or exclusion") &&
      files.originalGoalCompletionBlockerMatrix.includes("logSourceDiscoveryLedger") &&
      files.originalGoalCompletionBlockerMatrix.includes("logSourceDiscoveryLedgerReadme") &&
      files.originalGoalCompletionBlockerMatrix.includes("log-source discovery ledger linked") &&
      files.originalGoalCompletionBlockerMatrix.includes("mapped log source") &&
      files.originalGoalCompletionBlockerMatrix.includes("Open the log-source discovery ledger") &&
      files.toolSurfaceSmoke.includes("create_all_software_log_source_discovery_ledger") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode exposes and runs all-software log source discovery ledger") &&
      files.package.includes("smoke:plugin-all-software-log-source-discovery-ledger"),
    evidence:
      "bounded inventory rows now get an explicit MCP-accessible log-source discovery state: direct log metadata gate, non-log fallback, Windows Event fallback, bounded root scan, teacher source request, or teacher exclusion"
  },
  {
    requirement: "Tracks every bounded software row through low-token enrollment before claiming all-software coverage",
    pass:
      files.mcp.includes("create_all_software_coverage_enrollment_ledger") &&
      hasAll(files.allSoftwareCoverageEnrollmentLedger, [
        "transparent_ai_all_software_coverage_enrollment_ledger_v1",
        "transparent_ai_all_software_coverage_enrollment_ledger_receipt_v1",
        "enrolled_log_route_with_watch_evidence",
        "enrolled_non_log_fallback_with_watch_evidence",
        "inventory_signal_waiting_for_queue_enrollment",
        "needs_teacher_signal_or_exclusion",
        "allSoftwareCoverageComplete: false",
        "screenshotsCapturedByThisTool: false",
        "logContentsRead: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.allSoftwareCoverageEnrollmentLedgerSmoke.includes("transparent_ai_all_software_coverage_enrollment_ledger_smoke_v1") &&
      files.allSoftwareCoverageEnrollmentLedgerSmoke.includes("Enrollment ledger accounts for bounded real-local inventory rows") &&
      files.allSoftwareCoverageEnrollmentLedgerSmoke.includes("Enrollment ledger separates enrolled waiting rows from teacher signal or exclusion gaps") &&
      files.allSoftwareCoverageEnrollmentLedgerSmoke.includes("Enrollment ledger refuses to claim all-software completion from a bounded sample"),
    evidence:
      "bounded inventory rows now become an auditable enrollment ledger: each software row is enrolled with evidence, waiting for watch evidence, waiting for queue enrollment, or needs teacher signal/exclusion"
  },
  {
    requirement: "Turns all-software enrollment gaps into next low-token follow-up actions",
    pass:
      files.mcp.includes("create_all_software_coverage_enrollment_follow_up_plan") &&
      hasAll(files.allSoftwareCoverageEnrollmentFollowUpPlan, [
        "transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1",
        "transparent_ai_all_software_coverage_enrollment_follow_up_plan_receipt_v1",
        "collect_watch_or_queue_item_evidence",
        "promote_inventory_row_to_observer_queue",
        "ask_teacher_for_signal_or_exclusion",
        "watch_log_source_metadata_deltas",
        "run_software_observer_queue_item",
        "create_software_observer_queue",
        "allSoftwareCoverageComplete: false",
        "screenshotsCapturedByThisTool: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.allSoftwareCoverageEnrollmentFollowUpPlanSmoke.includes("transparent_ai_all_software_coverage_enrollment_follow_up_plan_smoke_v1") &&
      files.allSoftwareCoverageEnrollmentFollowUpPlanSmoke.includes("Follow-up plan consumes an enrollment ledger and creates per-row next actions") &&
      files.allSoftwareCoverageEnrollmentFollowUpPlanSmoke.includes("Follow-up plan prioritizes existing low-token tools instead of new automation") &&
      files.allSoftwareCoverageEnrollmentFollowUpPlanSmoke.includes("Follow-up plan keeps all-software completion unclaimed"),
    evidence:
      "ledger rows waiting for watch evidence, queue enrollment, or teacher signal can now become prioritized next actions using existing low-token tools"
  },
  {
    requirement: "Requires teacher review of low-token coverage dossier rows before follow-up plans",
    pass:
      hasAll(files.originalGoalLowTokenCoverageEvidenceDossierReceiptBuilder, [
        "transparent_ai_original_goal_low_token_coverage_dossier_receipt_builder_v1",
        "transparent_ai_original_goal_low_token_coverage_dossier_review_receipt_v1",
        "teacher_reviewed_collect_metadata_follow_up",
        "teacher_reviewed_promote_to_observer_queue",
        "teacher_reviewed_prepare_signal_question",
        "builderDoesNotRunFollowUpPlan: true",
        "builderDoesNotReadLogs: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotWriteMemory: true",
        "claim_all_software_coverage_complete_from_dossier_receipt_builder"
      ]) &&
      hasAll(files.originalGoalLowTokenCoverageEvidenceDossierReceiptValidation, [
        "transparent_ai_original_goal_low_token_coverage_dossier_receipt_validation_v1",
        "ready_for_review_only_low_token_follow_up_plan",
        "create-all-software-coverage-enrollment-follow-up-plan.mjs",
        "validationDoesNotRunFollowUpPlan: true",
        "validationDoesNotRunBatch: true",
        "validationDoesNotReadLogs: true",
        "validationDoesNotCaptureScreenshots: true",
        "validationDoesNotExecuteTargetSoftware: true",
        "validationDoesNotWriteMemory: true",
        "claim_all_software_coverage_complete_from_validation"
      ]) &&
      files.originalGoalLowTokenCoverageEvidenceDossierReceiptSmoke.includes(
        "transparent_ai_original_goal_low_token_coverage_dossier_receipt_smoke_v1"
      ) &&
      files.originalGoalLowTokenCoverageEvidenceDossierReceiptSmoke.includes(
        "Matched dossier receipt prepares only review-only follow-up commands"
      ) &&
      files.originalGoalLowTokenCoverageEvidenceDossierReceiptSmoke.includes(
        "Forbidden dossier receipt decisions fail closed before follow-up commands"
      ) &&
      files.originalGoalLowTokenCoverageEvidenceDossierReceiptSmoke.includes(
        "expectFailure: true"
      ) &&
      hasAll(files.originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidation, [
        "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_validation_v1",
        "teacher_ready_for_metadata_gate_receipt",
        "ready_from_validated_blocked_waiting_row_evidence_plan_receipt",
        "sourceReadyFromEvidencePlanReturn",
        "blocked_for_forbidden_or_unready_decision",
        "validationDoesNotRunMetadataGate: true",
        "validationDoesNotReadLogs: true",
        "validationDoesNotCaptureScreenshots: true",
        "validationDoesNotExecuteTargetSoftware: true",
        "validationDoesNotWriteMemory: true",
        "goalComplete: false",
        "validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs"
      ]) &&
      files.originalGoalLowTokenCoverageWaitingRowCockpitReceiptSmoke.includes(
        "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_smoke_v1"
      ) &&
      files.originalGoalLowTokenCoverageWaitingRowCockpitReceiptSmoke.includes(
        "Matched waiting-row cockpit receipt prepares only the next metadata preflight receipt validation command"
      ) &&
      hasAll(files.originalGoalLowTokenBlockedWaitingRowEvidencePlan, [
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_v1",
        "log_source_route_or_reviewed_fallback",
        "compact_watch_or_learning_evidence",
        "create-all-software-log-source-discovery-ledger.mjs",
        "run-all-software-low-token-learning-cycle.mjs",
        "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs",
        "planDoesNotReadLogs: true",
        "planDoesNotRunMetadataGate: true",
        "planDoesNotCaptureScreenshots: true",
        "planDoesNotExecuteTargetSoftware: true",
        "planDoesNotWriteMemory: true",
        "goalComplete: false"
      ]) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidencePlanSmoke.includes(
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_smoke_v1"
      ) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidencePlanSmoke.includes(
        "Blocked waiting rows become reviewed low-token evidence acquisition actions"
      ) &&
      hasAll(files.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder, [
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_builder_v1",
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_v1",
        "teacher-low-token-blocked-waiting-row-evidence-plan-receipt-template.json",
        "validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs",
        "builderDoesNotReadLogs: true",
        "builderDoesNotRunMetadataGate: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "goalComplete: false"
      ]) &&
      hasAll(files.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptValidation, [
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_v1",
        "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs",
        "validationDoesNotReadLogs: true",
        "validationDoesNotRunMetadataGate: true",
        "validationDoesNotExecuteTargetSoftware: true",
        "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit",
        "goalComplete: false"
      ]) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptSmoke.includes(
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_smoke_v1"
      ) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptSmoke.includes(
        "Reviewed evidence receipt returns only to waiting-row cockpit validation"
      ) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptSmoke.includes(
        "Evidence receipt validation fails closed on forbidden execute decisions"
      ) &&
      hasAll(files.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilder, [
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_return_cockpit_receipt_builder_v1",
        "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_receipt_v1",
        "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs",
        "builderDoesNotValidateCockpitReceipt: true",
        "builderDoesNotRunMetadataGate: true",
        "builderDoesNotReadLogs: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotWriteMemory: true",
        "goalComplete: false"
      ]) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderSmoke.includes(
        "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_return_cockpit_receipt_builder_smoke_v1"
      ) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderSmoke.includes(
        "Validated evidence-plan receipt builds a teacher-review cockpit receipt draft"
      ) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderSmoke.includes(
        "Cockpit receipt validator accepts blocked rows only through the validated evidence return bridge"
      ) &&
      files.originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderSmoke.includes(
        "Blocked evidence-plan validation cannot create a cockpit receipt validation command"
      ) &&
      hasAll(files.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunner, [
        "transparent_ai_original_goal_low_token_evidence_return_cockpit_receipt_validation_run_v1",
        "teacher_reviewed_draft_confirmation_missing",
        "rollback_not_retained",
        "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs",
        "runnerDoesNotRunMetadataGate: true",
        "runnerDoesNotReadLogs: true",
        "runnerDoesNotReadFullLogs: true",
        "runnerDoesNotCaptureScreenshots: true",
        "runnerDoesNotExecuteTargetSoftware: true",
        "runnerDoesNotWriteMemory: true",
        "goalComplete: false"
      ]) &&
      files.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerSmoke.includes(
        "transparent_ai_original_goal_low_token_evidence_return_cockpit_receipt_validation_runner_smoke_v1"
      ) &&
      files.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerSmoke.includes(
        "Teacher-reviewed return cockpit receipt draft validates through the existing cockpit receipt gate"
      ) &&
      files.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerSmoke.includes(
        "Missing retained rollback blocks before invoking cockpit receipt validation"
      ) &&
      files.originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerSmoke.includes(
        "Forbidden receipt decisions fail closed through the cockpit receipt validator"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalLowTokenCoverageDossierReceiptBuilder") &&
      files.originalGoalCurrentStatusRefresh.includes(
        "originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandTemplate"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalLowTokenBlockedWaitingRowEvidencePlan") &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilder") &&
      files.originalGoalCurrentStatusRefresh.includes(
        "originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandTemplate"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes(
        "originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandTemplate"
      ) &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("originalGoalLowTokenCoverageDossierReceiptBuilderReady") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "originalGoalLowTokenCoverageWaitingRowCockpitReceiptValidationCommandReady"
      ) &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "originalGoalLowTokenBlockedWaitingRowEvidencePlanReady"
      ) &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "originalGoalLowTokenBlockedWaitingRowEvidencePlanReceiptBuilderReady"
      ) &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "originalGoalLowTokenBlockedWaitingRowEvidenceReturnCockpitReceiptBuilderCommandReady"
      ) &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "originalGoalLowTokenEvidenceReturnCockpitReceiptValidationRunnerCommandReady"
      ) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-coverage-evidence-dossier-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-coverage-evidence-dossier-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-coverage-waiting-row-cockpit-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-blocked-waiting-row-evidence-plan"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-blocked-waiting-row-evidence-plan.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-evidence-return-cockpit-receipt-validation-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-evidence-return-cockpit-receipt-validation-runner.mjs"),
    evidence:
      "waiting low-token coverage dossier rows now require a teacher receipt before review-only follow-up plan commands are prepared"
  },
  {
    requirement: "Prepares teacher-confirmed low-token metadata gate preflight before running waiting coverage rows",
    pass:
      hasAll(files.originalGoalLowTokenMetadataGatePreflight, [
        "transparent_ai_original_goal_low_token_metadata_gate_preflight_v1",
        "preflightDoesNotRunMetadataGate: true",
        "preflightDoesNotReadLogs: true",
        "preflightDoesNotCaptureScreenshots: true",
        "preflightDoesNotExecuteTargetSoftware: true",
        "preflightDoesNotWriteMemory: true",
        "rollbackPointRequiredBeforeRun: true",
        "run-all-software-coverage-enrollment-follow-up-batch.mjs",
        "--teacher-reviewed",
        "--max-logs-per-item 1",
        "claim_original_goal_complete_from_preflight"
      ]) &&
      files.originalGoalLowTokenMetadataGatePreflightSmoke.includes(
        "transparent_ai_original_goal_low_token_metadata_gate_preflight_smoke_v1"
      ) &&
      files.originalGoalLowTokenMetadataGatePreflightSmoke.includes(
        "Preflight converts proof snapshot rows into teacher-confirmed metadata gate candidates"
      ) &&
      files.originalGoalLowTokenMetadataGatePreflightSmoke.includes(
        "Preflight keeps blocked rows blocked before metadata gate commands"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalLowTokenMetadataGatePreflight") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("originalGoalLowTokenMetadataGatePreflightReadyRows") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-metadata-gate-preflight"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-metadata-gate-preflight.mjs"),
    evidence:
      "waiting low-token coverage rows now get an exact preflight command bundle before teacher-confirmed metadata gates can be run"
  },
  {
    requirement: "Requires teacher receipt and retained rollback before preparing low-token metadata gate commands",
    pass:
      hasAll(files.originalGoalLowTokenMetadataGatePreflightReceiptBuilder, [
        "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_builder_v1",
        "transparent_ai_original_goal_low_token_metadata_gate_preflight_review_receipt_v1",
        "builderDoesNotRunMetadataGate: true",
        "builderDoesNotReadLogs: true",
        "rollbackPointRequiredBeforeRun: true",
        "validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs",
        "allowCommandGeneration: false",
        "Generate Receipt JSON",
        "Mark Ready Rows Confirmed",
        "navigator.clipboard.writeText"
      ]) &&
      hasAll(files.originalGoalLowTokenMetadataGatePreflightReceiptValidation, [
        "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_validation_v1",
        "blocked_missing_teacher_confirmation_or_retained_rollback_point",
        "validationDoesNotRunMetadataGate: true",
        "validationDoesNotReadLogs: true",
        "validationDoesNotExecuteTargetSoftware: true",
        "validRollbackPoint",
        "nextPreparedCommands",
        "executesNow: false"
      ]) &&
      files.originalGoalLowTokenMetadataGatePreflightReceiptSmoke.includes(
        "transparent_ai_original_goal_low_token_metadata_gate_preflight_receipt_smoke_v1"
      ) &&
      files.originalGoalLowTokenMetadataGatePreflightReceiptSmoke.includes(
        "Receipt validator prepares command only after teacher confirmation and retained rollback point"
      ) &&
      files.originalGoalLowTokenMetadataGatePreflightReceiptSmoke.includes(
        "Missing rollback point and forbidden accepted decision fail closed"
      ) &&
      files.originalGoalLowTokenMetadataGatePreflightReceiptSmoke.includes(
        "Receipt builder HTML generates teacher receipt JSON without running commands"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalLowTokenMetadataGatePreflightReceiptBuilder") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "originalGoalLowTokenMetadataGatePreflightReceiptValidationCommandReady"
      ) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-metadata-gate-preflight-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-metadata-gate-preflight-receipt.mjs"),
    evidence:
      "low-token metadata gate preflight now produces a teacher receipt builder and fail-closed validator before any prepared batch command"
  },
  {
    requirement: "Runs validated low-token metadata gate commands only through a no-shell allowlisted runner",
    pass:
      hasAll(files.originalGoalLowTokenMetadataGateValidationCommandRunner, [
        "transparent_ai_original_goal_low_token_metadata_gate_validation_command_run_v1",
        "EXPECTED_SCRIPT = \"run-all-software-coverage-enrollment-follow-up-batch.mjs\"",
        "runsOnlyPreparedValidationCommand: true",
        "shellCommandExecution: false",
        "runner_requires_explicit_run_flags",
        "runner_requires_teacher_confirmation_text",
        "runner_requires_existing_retained_rollback_point",
        "prepared_command_must_not_enable_bounded_tail_from_validation_runner",
        "spawnSync(process.execPath, [scriptPath, ...args]",
        "executedViaShell: false",
        "nextPreparedCommands",
        "reconcile_all_software_coverage_enrollment_follow_up_batch",
        "nextReconciliationExecutesNow: false",
        "requiresTeacherReviewOfBatchReceipt: true"
      ]) &&
      hasAll(files.originalGoalLowTokenMetadataGateValidationCommandRunnerSmoke, [
        "transparent_ai_original_goal_low_token_metadata_gate_validation_command_runner_smoke_v1",
        "Runner executes only allowlisted validation command without shell",
        "Runner prepares review-only reconciliation handoff after batch",
        "ready_for_next_coverage_audit_and_enrollment_ledger",
        "Missing run flags fail closed",
        "Bounded tail command is rejected",
        "Wrong prepared command tool is rejected",
        "Missing validation JSON fails closed"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-metadata-gate-validation-command-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-metadata-gate-validation-command-runner.mjs"),
    evidence:
      "validated metadata-gate receipts can now invoke one prepared low-token batch only through a no-shell allowlisted runner, then prepare a review-only reconciliation handoff back into the next coverage audit and enrollment ledger while bounded tails, screenshots, target execution, memory, packaging, and completion stay locked"
  },
  {
    requirement: "Blocks all-software low-token coverage completion claims until every ledger row is teacher reviewed",
    pass:
      hasAll(files.originalGoalLowTokenCoverageCompletionGate, [
        "transparent_ai_original_goal_low_token_coverage_completion_gate_v1",
        "coverage_evidence_ready_for_final_teacher_review_not_completion",
        "blocked_before_all_software_low_token_coverage_completion_claim",
        "transparent_ai_all_software_log_source_discovery_ledger_v1",
        "logSourceDiscoveryReadyForCoverage",
        "missing_log_source_discovery_ledger",
        "unresolved_log_source_discovery_rows_remain",
        "not_every_software_row_has_log_source_or_fallback_route",
        "missing_teacher_dossier_receipt_validation",
        "unresolved_low_token_coverage_rows_remain",
        "reviewed_follow_up_rows_still_need_metadata_or_queue_follow_up",
        "not_every_ledger_row_has_teacher_reviewed_coverage_or_exclusion",
        "allSoftwareCoverageComplete: false",
        "canClaimOriginalGoalComplete: false",
        "gateDoesNotReadLogs: true",
        "gateDoesNotCaptureScreenshots: true",
        "gateDoesNotExecuteTargetSoftware: true",
        "gateDoesNotWriteMemory: true"
      ]) &&
      files.originalGoalLowTokenCoverageCompletionGateSmoke.includes(
        "transparent_ai_original_goal_low_token_coverage_completion_gate_smoke_v1"
      ) &&
      files.originalGoalLowTokenCoverageCompletionGateSmoke.includes(
        "Coverage completion gate blocks unresolved or follow-up rows"
      ) &&
      files.originalGoalLowTokenCoverageCompletionGateSmoke.includes(
        "Coverage completion gate allows only final teacher review when every row is reviewed"
      ) &&
      files.originalGoalLowTokenCoverageCompletionGateSmoke.includes(
        "Coverage completion gate blocks incomplete log-source discovery ledger"
      ) &&
      files.originalGoalLowTokenCoverageCompletionGateSmoke.includes(
        "Coverage completion gate blocks missing teacher validation"
      ) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-coverage-completion-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-coverage-completion-gate.mjs"),
    evidence:
      "a separate coverage completion gate now permits only final teacher review and keeps all-software coverage and original-goal completion claims locked"
  },
  {
    requirement: "Blocks full original-goal completion claims until every objective evidence chain and validated final teacher acceptance are present",
    pass:
      hasAll(files.originalGoalFinalCompletionGate, [
        "transparent_ai_original_goal_final_completion_gate_v1",
        "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_v1",
        "--final-teacher-receipt-validation",
        "--rule-dsl-delivery-gate-audit",
        "completion_blocker_matrix_present",
        "all_software_low_token_coverage_final_review",
        "unattended_all_software_operational_evidence",
        "transparent_2d_perspective_3d_sketch_implementation",
        "teacher_validated_spatial_intent_and_detail_logic",
        "voice_text_numbered_execution_capability_convergence",
        "rule_dsl_validation_report_delivery_gate_audit",
        "transparent_ai_rag_delivery_gate_audit_trail_v1",
        "claim_reusable_learning_without_rule_dsl_validation_report_delivery_gate_audit",
        "explicit_final_teacher_acceptance",
        "blocked_before_original_goal_completion_claim",
        "ready_for_goal_completion_claim_after_teacher_acceptance",
        "gateDoesNotRunCommands: true",
        "gateDoesNotCaptureScreenshots: true",
        "gateDoesNotExecuteTargetSoftware: true",
        "gateDoesNotWriteMemory: true"
      ]) &&
      files.originalGoalFinalCompletionGateSmoke.includes(
        "transparent_ai_original_goal_final_completion_gate_smoke_v1"
      ) &&
      files.originalGoalFinalCompletionGateSmoke.includes(
        "Final completion gate blocks when final teacher acceptance validation is missing"
      ) &&
      files.originalGoalFinalCompletionGateSmoke.includes(
        "Final completion gate blocks when Rule DSL delivery-gate audit trail is missing"
      ) &&
      files.originalGoalFinalCompletionGateSmoke.includes(
        "Final completion gate only becomes ready when every objective lane and teacher receipt validation are ready"
      ) &&
      files.originalGoalFinalCompletionGateSmoke.includes(
        "Default teach_apprentice routes final completion gate without claiming completion"
      ) &&
      hasAll(files.mcp, [
        "originalGoalFinalCompletionGateRequested",
        "validateOriginalGoalFinalCompletionGate",
        "goalCompleteClaimedByThisTool",
        "waiting_for_final_completion_gate_review"
      ]) &&
      hasAll(files.originalGoalFinalTeacherAcceptanceReceiptBuilder, [
        "transparent_ai_original_goal_final_teacher_acceptance_receipt_builder_v1",
        "Download Receipt JSON",
        "builderDoesNotRunFinalGate: true",
        "builderDoesNotExecuteTargetSoftware: true"
      ]) &&
      hasAll(files.originalGoalFinalTeacherAcceptanceReceiptValidation, [
        "transparent_ai_original_goal_final_teacher_acceptance_receipt_validation_v1",
        "validated_ready_for_final_completion_gate",
        "teacher_acceptance_ready_for_final_completion_gate",
        "blocked_for_forbidden_final_teacher_decision",
        "validationDoesNotRunFinalGate: true",
        "validationDoesNotExecuteTargetSoftware: true"
      ]) &&
      files.originalGoalFinalTeacherAcceptanceReceiptSmoke.includes(
        "transparent_ai_original_goal_final_teacher_acceptance_receipt_smoke_v1"
      ) &&
      files.originalGoalFinalTeacherAcceptanceReceiptSmoke.includes(
        "Final teacher acceptance receipt validation fails closed on forbidden decisions"
      ) &&
      files.originalGoalFinalTeacherAcceptanceReceiptSmoke.includes(
        "Default teach_apprentice routes final teacher acceptance receipt builder without claiming completion"
      ) &&
      files.originalGoalFinalTeacherAcceptanceReceiptSmoke.includes(
        "Default teach_apprentice routes final teacher acceptance receipt validation without running final gate"
      ) &&
      hasAll(files.mcp, [
        "originalGoalFinalTeacherAcceptanceReceiptBuilderRequested",
        "originalGoalFinalTeacherAcceptanceReceiptValidationRequested",
        "originalGoalFinalTeacherAcceptanceReceiptBuilder",
        "originalGoalFinalTeacherAcceptanceReceiptValidation"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-final-completion-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-final-completion-gate.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-final-teacher-acceptance-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-final-teacher-acceptance-receipt.mjs"),
    evidence:
      "the full objective now has one final anti-false-completion gate spanning coverage, unattended operation, sketch/spatial logic, voice/text execution convergence, Rule DSL delivery-gate audit evidence, and validated final teacher acceptance"
  },
  {
    requirement: "Advances reviewed enrollment follow-up rows through low-token batch actions",
    pass:
      files.mcp.includes("create_all_software_coverage_enrollment_follow_up_handoff_queue") &&
      hasAll(files.allSoftwareCoverageEnrollmentFollowUpHandoffQueue, [
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_v1",
        "reviewed_low_token_batch_command",
        "queueDoesNotRunBatch: true",
        "queueDoesNotReadLogs: true",
        "queueDoesNotCaptureScreenshots: true",
        "queueDoesNotExecuteTargetSoftware: true",
        "queueDoesNotRegisterSchedule: true",
        "queueDoesNotWriteMemory: true",
        "claim_all_software_coverage_complete_from_queue"
      ]) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueSmoke.includes(
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_smoke_v1"
      ) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueSmoke.includes("classifies safe reviewed batch commands") &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueSmoke.includes("blocks unsafe commands") &&
      hasAll(files.allSoftwareCoverageEnrollmentFollowUpHandoffItemCommandBuilder, [
        "transparent_ai_coverage_enrollment_follow_up_handoff_item_command_builder_v1",
        "run-all-software-coverage-enrollment-follow-up-handoff-queue-item.mjs",
        "teacher confirmed coverage enrollment follow-up item",
        "builderDoesNotRunHandoffItem: true",
        "builderDoesNotInvokeRunner: true",
        "builderDoesNotReadLogs: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotWriteMemory: true"
      ]) &&
      files.mcp.includes("run_all_software_coverage_enrollment_follow_up_handoff_queue_item") &&
      hasAll(files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueItemRunner, [
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_run_v1",
        "queueItemRunnerDoesNotRunArbitraryCommandString",
        "queueItemRunnerConsumesOneHandoffItem",
        "--follow-up-id",
        "--max-items",
        "missing_teacher_coverage_enrollment_follow_up_confirmation",
        "claim_all_software_coverage_complete_from_item_runner"
      ]) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueItemRunnerSmoke.includes(
        "Coverage enrollment follow-up handoff item runner advances exactly one reviewed item"
      ) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueItemRunnerSmoke.includes(
        "uses structured arguments, not the display command string"
      ) &&
      files.mcp.includes("create_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_builder") &&
      files.mcp.includes("validate_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt") &&
      hasAll(files.allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptBuilder, [
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_builder_v1",
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_v1",
        "builderDoesNotRerunItem: true",
        "builderDoesNotReadLogs: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotWriteMemory: true"
      ]) &&
      hasAll(files.allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptValidation, [
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_validation_v1",
        "coverage_enrollment_handoff_item_run_reviewed_for_reconciliation",
        "reconcile-all-software-coverage-enrollment-follow-up-batch.mjs",
        "validationDoesNotRerunItem: true",
        "validationDoesNotReadLogs: true",
        "validationDoesNotCaptureScreenshots: true",
        "validationDoesNotExecuteTargetSoftware: true",
        "validationDoesNotWriteMemory: true",
        "claim_all_software_coverage_complete_from_validation"
      ]) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptSmoke.includes(
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_item_run_review_receipt_smoke_v1"
      ) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptSmoke.includes(
        "Matched teacher review prepares reconciliation command template only"
      ) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptSmoke.includes(
        "Forbidden memory or completion decision fails closed"
      ) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffItemRunReviewReceiptSmoke.includes(
        "expectFailure: true"
      ) &&
      files.mcp.includes("run_all_software_coverage_enrollment_follow_up_batch") &&
      hasAll(files.allSoftwareCoverageEnrollmentFollowUpBatch, [
        "transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1",
        "transparent_ai_all_software_coverage_enrollment_follow_up_batch_receipt_v1",
        "blocked_until_teacher_review",
        "metadata_gate_ran",
        "coverage_enrollment_follow_up_item",
        "narrowedQueuePath",
        "narrowedQueueMatchedCount",
        "observer_queue_created",
        "teacher_signal_question_prepared",
        "allowBoundedTail",
        "allSoftwareCoverageComplete: false",
        "screenshotsCapturedByThisTool: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.allSoftwareCoverageEnrollmentFollowUpBatchSmoke.includes("transparent_ai_all_software_coverage_enrollment_follow_up_batch_smoke_v1") &&
      files.allSoftwareCoverageEnrollmentFollowUpBatchSmoke.includes("Follow-up batch blocks actual low-token runs until teacher review") &&
      files.allSoftwareCoverageEnrollmentFollowUpBatchSmoke.includes("Teacher-reviewed batch runs only low-token read-only follow-up tools") &&
      files.allSoftwareCoverageEnrollmentFollowUpBatchSmoke.includes("Teacher-reviewed metadata gates use narrowed per-follow-up queues") &&
      files.allSoftwareCoverageEnrollmentFollowUpBatchSmoke.includes("Follow-up batch keeps screenshots execution schedules memory native control and completion locked"),
    evidence:
      "validated enrollment receipts now become manual low-token handoff queues before one reviewed row or a small reviewed batch runs per-row narrowed metadata-only gates, observer queue creation, or teacher signal handoffs"
  },
  {
    requirement: "Reconciles reviewed follow-up batch evidence back into coverage audit and enrollment ledger",
    pass:
      files.mcp.includes("reconcile_all_software_coverage_enrollment_follow_up_batch") &&
      hasAll(files.allSoftwareCoverageEnrollmentFollowUpReconciliation, [
        "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_v1",
        "transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_receipt_v1",
        "ready_for_next_coverage_audit_and_enrollment_ledger",
        "reconciled_next_ledger_ready_for_review",
        "allSoftwareCoverageComplete: false",
        "screenshotsCapturedByThisTool: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.allSoftwareCoverageEnrollmentFollowUpReconciliationSmoke.includes("transparent_ai_all_software_coverage_enrollment_follow_up_reconciliation_smoke_v1") &&
      files.allSoftwareCoverageEnrollmentFollowUpReconciliationSmoke.includes("Reconciliation blocks unreviewed follow-up batch evidence") &&
      files.allSoftwareCoverageEnrollmentFollowUpReconciliationSmoke.includes("Reviewed batch reconciliation prepares next audit and ledger commands without rerun by default") &&
      files.allSoftwareCoverageEnrollmentFollowUpReconciliationSmoke.includes("Teacher-reviewed rerun regenerates coverage audit and enrollment ledger from batch evidence"),
    evidence:
      "reviewed follow-up batch evidence now flows back into the next coverage audit and enrollment ledger instead of relying on manual evidence stitching"
  },
  {
    requirement: "Requires teacher review of one coverage rollout handoff item run before convergence audit",
    pass:
      files.mcp.includes("create_all_software_coverage_rollout_handoff_item_run_review_receipt_builder") &&
      files.mcp.includes("validate_all_software_coverage_rollout_handoff_item_run_review_receipt") &&
      hasAll(files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptBuilder, [
        "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_builder_v1",
        "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_v1",
        "builderDoesNotRerunItem: true",
        "builderDoesNotReadLogs: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotWriteMemory: true"
      ]) &&
      hasAll(files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptValidation, [
        "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_validation_v1",
        "coverage_rollout_handoff_item_run_reviewed_for_convergence_audit",
        "create-all-software-coverage-convergence-audit.mjs",
        "validationDoesNotRerunItem: true",
        "validationDoesNotReadLogs: true",
        "validationDoesNotWriteMemory: true"
      ]) &&
      files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptSmoke.includes(
        "transparent_ai_all_software_coverage_rollout_handoff_item_run_review_receipt_smoke_v1"
      ) &&
      files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptSmoke.includes(
        "Matched teacher review prepares convergence audit command template only"
      ) &&
      files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptSmoke.includes(
        "Forbidden coverage completion decision fails closed"
      ) &&
      files.allSoftwareCoverageRolloutHandoffItemRunReviewReceiptSmoke.includes(
        "expectFailure: true"
      ),
    evidence:
      "reviewed rollout handoff item evidence now requires teacher confirmation of supervisor output, post-batch audit, low-token outcome, and rollback before convergence-audit commands are prepared"
  },
  {
    requirement: "Uses low-token learning instead of continuous recording",
    pass:
      hasAll(files.learningWorkflow, [
        "event_driven_low_token_observation",
        "observeCheapSignalsFirst",
        "escalateToScreenshotOnlyWhen",
        "askTeacherOnlyWhen",
        "fullContinuousRecording: false"
      ]) &&
      hasAll(files.universalObserver, [
        "Summarize changed file paths",
        "Store only compact tail snippets",
        "Ask the teacher only when evidence is ambiguous"
      ]) &&
      hasAll(files.teachExecuteLoop, [
        "execution receipt",
        "supervised action outcome verification",
        "compact learning event packet",
        "teacher-confirmed automatic observer schedule package",
        "bounded all-software observer supervisor",
        "metadata-only log source delta gate",
        "software observation delta monitor",
        "multi-software watch cycle",
        "create_all_software_observer_bootstrap",
        "run_all_software_observer_supervisor",
        "create_all_software_observer_coverage_audit",
        "create_automatic_observer_schedule",
        "watch_log_source_metadata_deltas",
        "run_software_observer_queue_item",
        "monitor_software_observation_deltas",
        "run_software_observer_watch_cycle",
        "triggered screenshot only if cheap signals are ambiguous",
        "fullContinuousRecording: false"
      ]) &&
      hasAll(files.supervisedOutcome, [
        "transparent_ai_supervised_action_outcome_verification_v1",
        "watch-log-source-metadata-deltas.mjs",
        "logContentsRead: false",
        "screenshotsCaptured: false",
        "fullContinuousRecording: false",
        "outcomeAccepted: false"
      ]) &&
      hasAll(files.postActionCheckpoint, [
        "transparent_ai_post_action_low_token_evidence_checkpoint_v1",
        "transparent_ai_post_action_low_token_state_snapshot_v1",
        "fileContentsRead: false",
        "logContentsRead: false",
        "screenshotsCaptured: false",
        "fullContinuousRecording: false",
        "softwareActionsExecuted: false",
        "create_triggered_visual_check_request"
      ]) &&
      hasAll(files.automaticTriggeredVisualCheckQueue, [
        "transparent_ai_automatic_triggered_visual_check_queue_v1",
        "captureOnlyAfterReview: true",
        "maxScreenshots: 1",
        "screenshotsCaptured: false",
        "fullContinuousRecording: false",
        "softwareActionsExecuted: false",
        "longTermMemoryWritten: false"
      ]) &&
      hasAll(files.lowTokenTriggerBudgetPlan, [
        "transparent_ai_low_token_trigger_budget_plan_v1",
        "bounded_tail_review_before_visual_check",
        "compact_learning_review_only",
        "one_screenshot_after_teacher_confirmation",
        "teacherConfirmationRequiredBeforeCapture: true",
        "softwareActionsExecuted: false"
      ]) &&
      hasAll(files.allSoftwareCoverageAudit, [
        "transparent_ai_all_software_observer_coverage_audit_v1",
        "coverage-repair-plan.json",
        "logContentsRead: false",
        "fileContentsRead: false",
        "screenshotsCaptured: false",
        "fullContinuousRecording: false",
        "softwareActionsExecuted: false",
        "memoryWritten: false"
      ]) &&
      files.softwareObserverQueueRunnerSmoke.includes("Queue runner reads only bounded selected log tails") &&
      files.supervisedOutcomeSmoke.includes("Outcome verifier uses metadata-only gate after simulated execution") &&
      files.postActionCheckpointSmoke.includes("Checkpoint captures before state without reading file contents") &&
      files.lowTokenTriggerBudgetPlanSmoke.includes("Low-token trigger budget plan selects compact evidence before screenshots") &&
      files.lowTokenTriggerBudgetPlanSmoke.includes("Low-token trigger budget plan keeps visual checks teacher-confirmed and bounded") &&
      files.postActionCheckpointSmoke.includes("No cheap post-action change recommends only one reviewed visual check") &&
      files.softwareObservationDeltaMonitorSmoke.includes("Delta monitor keeps low-token locks closed") &&
      files.realLocalTriggeredVisualCheckSmoke.includes("Changed metadata still prefers bounded-tail review before screenshots by default") &&
      files.realLocalTriggeredVisualCheckSmoke.includes("Teacher marker can request exactly one bounded visual check after metadata change") &&
      files.softwareObserverWatchCycleSmoke.includes("Watch cycle keeps execution, recording, and memory gates locked") &&
      files.automaticLowTokenLearningRunnerSmoke.includes("Automatic runner preserves low-token and review-only locks across runs") &&
      files.automaticLowTokenLearningScheduleSmoke.includes("Schedule registration remains teacher-confirmed and locks screenshots, memory, execution, and native universal claims") &&
      files.allSoftwareRecurringMonitorApprovalGateSmoke.includes("Recurring monitor approval gate validates schedule, reviewed scope, teacher confirmation, and rollback") &&
      files.allSoftwareRecurringMonitorApprovalGateSmoke.includes("Approval gate produces registration request but does not install a scheduled task") &&
      files.realLocalAllSoftwareRecurringMonitorApprovalGateSmoke.includes("Real local recurring monitor approval gate still does not install task, screenshot, memory, execution, or native control") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationRunnerSmoke.includes("Registration runner keeps screenshots memory software execution and native control locked in dry-run") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationStatusSmoke.includes("Status verifier preserves unregister handoff and all safety locks") &&
      files.realLocalAllSoftwareRecurringMonitorRunOutputAuditSmoke.includes("Run-output audit remains read-only and preserves all safety locks") &&
      files.realLocalAllSoftwareUnattendedLearningAuditSmoke.includes("Unattended learning audit preserves schedule runner screenshots memory execution and packaging locks") &&
      files.realLocalAutomaticLowTokenLearningScheduleSmoke.includes("Real local automatic learning schedule keeps review, registration, memory, screenshot, execution, and native-control gates closed") &&
      files.realLocalAllSoftwareObserverSmoke.includes("Controlled real-candidate delta proves screenshot is trigger-only after a changed signal") &&
      files.allSoftwareBootstrapSmoke.includes("Bootstrap keeps privacy, recording, memory, and native-execution gates locked") &&
      files.allSoftwareSupervisorSmoke.includes("Supervisor keeps periodic observation bounded and low-token") &&
      files.allSoftwareLearningCycleSmoke.includes("Learning cycle initializes metadata baseline without tail reads or learning events") &&
      files.allSoftwareLearningCycleSmoke.includes("Learning cycle uses metadata gate to narrow changed logs before bounded tail reads") &&
      files.realLocalAllSoftwareLearningCycleSmoke.includes("Metadata gate initializes baseline and skips tail reads before any learning event") &&
      files.realLocalAllSoftwareLearningCycleSmoke.includes("Real local all-software learning stays review-only, low-token, and gated") &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("Readiness package maps real local software rows to log sources or low-token fallbacks") &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("Readiness package runs automatic low-token runner metadata-first without memory or screenshots") &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("Readiness package creates a teacher-confirmed schedule package but does not register it") &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("Readiness package creates triggered visual-check queue only as review-gated follow-up") &&
      files.realLocalAllSoftwareLowTokenReadinessPackageSmoke.includes("Readiness package keeps broad completion, native execution, schedules, screenshots, memory, and packaging locked") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Integrated full-goal smoke keeps execution, screenshots, memory, acceptance, packaging, and native universal execution locked") &&
      files.allSoftwareCoverageAuditSmoke.includes("Coverage audit reads no log or file contents and keeps screenshots/execution/memory locked") &&
      files.allSoftwareCoverageEnrollmentLedgerSmoke.includes("Enrollment ledger keeps screenshots logs execution schedules memory native control and packaging locked") &&
      files.allSoftwareCoverageEnrollmentFollowUpPlanSmoke.includes("Follow-up plan preserves low-token and safety locks") &&
      files.allSoftwareCoverageEnrollmentFollowUpBatchSmoke.includes("Follow-up batch keeps screenshots execution schedules memory native control and completion locked") &&
      files.realLocalAllSoftwareCoverageAuditSmoke.includes("Coverage audit reads no log or file contents and keeps screenshots/execution/memory locked") &&
      files.realLocalAllSoftwareCoverageAuditSmoke.includes("Coverage repair plan preserves broad-coverage blockers instead of overclaiming") &&
      files.realLocalAllSoftwareCoverageRolloutSupervisorSmoke.includes("Supervisor keeps screenshots memory schedules execution native control and packaging locked") &&
      files.realLocalAllSoftwareCoverageConvergenceAuditSmoke.includes("Convergence audit keeps screenshots memory schedules execution native control and packaging locked") &&
      files.realLocalConvergenceAutomaticLearningPackageSmoke.includes("Package keeps screenshots memory schedules execution and packaging locked") &&
      files.realLocalAllSoftwareControlChannelCoverageAuditSmoke.includes("Coverage audit keeps screenshots memory software execution native control and packaging locked") &&
      files.realLocalAllSoftwareExecutionPilotQueueSmoke.includes("Pilot queue keeps screenshots memory UI events target commands and packaging locked") &&
      files.automaticObserverScheduleSmoke.includes("Schedule uses bounded supervisor runs instead of continuous recording") &&
      files.compactLearningEventsSmoke.includes("Compressor keeps low-token limits and avoids continuous screenshots"),
    evidence: "real local bounded probe + all-software bootstrap + bounded supervisor + automatic low-token learning runner + automatic low-token learning schedule + low-token trigger budget planner + real-local readiness package + recurring monitor output/review/replay + unattended learning audit + convergence automatic learning package + all-software control-channel coverage audit + all-software execution pilot queue + automatic triggered visual-check queue + real-local automatic learning schedule + coverage audit + coverage repair queue + real-local coverage repair queue + real-local coverage expansion plan + real-local coverage rollout batch runner + real-local coverage rollout supervisor + real-local coverage convergence audit + teacher-confirmed automatic schedule + event-driven observation policy + bounded queue item tail reads + baseline/current delta monitor + multi-software watch cycle + compact learning event compression + receipt/checkpoint-first verification"
  },
  {
    requirement: "Turns adviser RAG research suggestions into review-only source candidates before citation",
    pass:
      hasAll(files.ragResearchIntakeQueue, [
        "transparent_ai_rag_research_intake_queue_v1",
        "adviser_wechat_rag_direction_note",
        "zhejiang_university_research_lead",
        "trustLevel: \"unverified\"",
        "treat_unverified_leads_as_citations",
        "buildCorpusIndex",
        "softwareActionsExecuted: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.ragResearchIntakeQueueSmoke, [
        "transparent_ai_rag_research_intake_queue_smoke_v1",
        "Research intake queue must not accept source candidates",
        "Zhejiang University lead must stay unverified",
        "The adviser note corpus should be locally retrievable"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-rag-research-intake-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-rag-research-intake-queue.mjs"),
    evidence:
      "adviser screenshots and unverified external leads now become a review-only RAG research intake queue before citation, rule enablement, memory, execution, or packaging"
  },
  {
    requirement: "Gates RAG research source confirmations through fail-closed receipts",
    pass:
      hasAll(files.ragResearchIntakeReceiptBuilder, [
        "transparent_ai_rag_research_intake_receipt_builder_v1",
        "transparent_ai_rag_research_intake_receipt_v1",
        "cite_unverified_lead",
        "verified_public_reference",
        "builderDoesNot"
      ]) &&
      hasAll(files.ragResearchIntakeReceiptValidation, [
        "transparent_ai_rag_research_intake_receipt_validation_v1",
        "VERIFIED_REFERENCE_REQUIRES_PRIMARY_SOURCE_URI",
        "FORBIDDEN_TOP_LEVEL_DECISION",
        "mayEnableRules: false",
        "mayExecuteSoftware: false",
        "process.exit(1)"
      ]) &&
      hasAll(files.ragResearchIntakeReceiptSmoke, [
        "transparent_ai_rag_research_intake_receipt_smoke_v1",
        "Only the teacher-supplied adviser note should be confirmed",
        "Unverified Zhejiang lead should fail without a primary source URI",
        "Forbidden top-level decision should fail closed"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-rag-research-intake-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-rag-research-intake-receipt.mjs"),
    evidence:
      "RAG research source candidates now require teacher/researcher receipts and primary-source fields before any review-only source card confirmation"
  },
  {
    requirement: "Packages confirmed RAG sources for review-only local corpus ingest",
    pass:
      hasAll(files.ragConfirmedSourceRegistryPackage, [
        "transparent_ai_rag_confirmed_source_registry_package_v1",
        "ready_for_review_only_local_corpus_ingest",
        "external_reference_registered_no_fetch",
        "ingest-local-corpus.mjs",
        "externalFetchPerformed: false",
        "mayEnableRules: false",
        "mayExecuteSoftware: false"
      ]) &&
      hasAll(files.ragConfirmedSourceRegistryPackageSmoke, [
        "transparent_ai_rag_confirmed_source_registry_package_smoke_v1",
        "Confirmed local adviser note should be ready for local corpus ingest",
        "Registry package should prepare the existing local corpus ingest command",
        "Registry package must reject validation that is not ready"
      ]) &&
      hasAll(files.mcpServer, [
        "ragConfirmedSourceRegistryPackageRequested",
        "create_rag_confirmed_source_registry_package",
        "knowledge/create-rag-confirmed-source-registry-package.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG confirmed source registry package",
        "Default teach_apprentice creates RAG primary-source confirmed source registry package"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-rag-confirmed-source-registry-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-rag-confirmed-source-registry-package.mjs"),
    evidence:
      "validated RAG source cards now become a review-only source registry with prepared local ingest commands and no external fetch, rule enablement, memory, execution, or packaging unlock"
  },
  {
    requirement: "Runs teacher-reviewed confirmed local RAG source ingest through a no-shell allowlisted runner",
    pass:
      hasAll(files.ragConfirmedLocalIngestRunner, [
        "transparent_ai_rag_confirmed_local_ingest_run_v1",
        "RAG_CONFIRMED_LOCAL_INGEST_REQUIRES_TEACHER_REVIEWED_FLAG",
        "ROLLBACK_POINT_NOT_FOUND",
        "spawnSync(process.execPath",
        "ingest-local-corpus.mjs",
        "externalFetchPerformed: false",
        "shellCommandExecuted: false",
        "mayEnableRules: false",
        "mayExecuteSoftware: false"
      ]) &&
      hasAll(files.ragConfirmedLocalIngestRunnerSmoke, [
        "transparent_ai_rag_confirmed_local_ingest_runner_smoke_v1",
        "Confirmed local ingest runner must reject missing teacher-reviewed flag",
        "Confirmed local ingest runner must use no-shell structured spawn",
        "external_reference_registered_no_fetch"
      ]) &&
      hasAll(files.mcpServer, [
        "ragConfirmedLocalIngestRequested",
        "run_rag_confirmed_local_ingest",
        "knowledge/run-rag-confirmed-local-ingest.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice runs RAG confirmed local ingest"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-rag-confirmed-local-ingest-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-rag-confirmed-local-ingest-runner.mjs"),
    evidence:
      "confirmed local RAG source cards now advance into a local corpus only after teacher review and retained rollback, using no-shell structured spawn while external fetch, rules, memory, execution, and packaging remain locked"
  },
  {
    requirement: "Turns teacher-reviewed confirmed local RAG corpora into retrieval evidence and disabled rule drafts",
    pass:
      hasAll(files.ragConfirmedRetrievalDraftRunner, [
        "transparent_ai_rag_confirmed_retrieval_draft_run_v1",
        "RAG_CONFIRMED_RETRIEVAL_DRAFT_REQUIRES_TEACHER_REVIEWED_FLAG",
        "retrieve-local-knowledge.mjs",
        "draft-rule-card-from-retrieval.mjs",
        "draft_disabled",
        "externalFetchPerformed: false",
        "shellCommandExecuted: false",
        "mayEnableRules: false",
        "mayExecuteSoftware: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragConfirmedRetrievalDraftRequested",
        "run_rag_confirmed_retrieval_draft",
        "knowledge/run-rag-confirmed-retrieval-draft.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice runs RAG confirmed retrieval draft"
      ]) &&
      hasAll(files.ragConfirmedRetrievalDraftRunnerSmoke, [
        "transparent_ai_rag_confirmed_retrieval_draft_runner_smoke_v1",
        "Confirmed retrieval draft runner must reject missing teacher-reviewed flag",
        "Confirmed retrieval draft runner must use no-shell retrieval spawn",
        "Confirmed retrieval draft runner must keep Rule Cards draft_disabled"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-rag-confirmed-retrieval-draft-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-rag-confirmed-retrieval-draft-runner.mjs"),
    evidence:
      "confirmed local RAG corpora now produce retrieval packets and disabled rule drafts through existing no-shell RAG tools while external fetch, rule enablement, memory, execution, and packaging remain locked"
  },
  {
    requirement: "Requires teacher review receipt before confirmed RAG disabled drafts can move to further rule validation",
    pass:
      hasAll(files.ragConfirmedRetrievalDraftReviewReceiptBuilder, [
        "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_builder_v1",
        "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_v1",
        "forbiddenDecisions",
        "approve_disabled_draft_for_rule_dsl_validation"
      ]) &&
      hasAll(files.mcpServer, [
        "ragConfirmedRetrievalDraftReviewReceiptBuilderRequested",
        "ragConfirmedRetrievalDraftReviewReceiptValidationRequested",
        "create_rag_confirmed_retrieval_draft_review_receipt_builder",
        "validate_rag_confirmed_retrieval_draft_review_receipt",
        "knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs",
        "knowledge/validate-rag-confirmed-retrieval-draft-review-receipt.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG retrieval draft review receipt builder",
        "Default teach_apprentice validates RAG retrieval draft review receipt"
      ]) &&
      hasAll(files.ragConfirmedRetrievalDraftReviewReceiptValidation, [
        "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
        "RUN_HASH_MISMATCH",
        "APPROVED_ROW_REQUIRES_DRAFT_DISABLED",
        "ready_for_review_only_rule_dsl_validation",
        "mayEnableRules: false",
        "memoryEnabled: false"
      ]) &&
      hasAll(files.ragConfirmedRetrievalDraftReviewReceiptSmoke, [
        "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_smoke_v1",
        "Review receipt validation should prepare review-only Rule DSL validation",
        "Review receipt validation must fail closed on forbidden rule enablement"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-rag-confirmed-retrieval-draft-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-rag-confirmed-retrieval-draft-review-receipt.mjs"),
    evidence:
      "retrieved confirmed RAG evidence and disabled rule drafts now require a teacher receipt before further rule validation, while enablement, memory, execution, external fetch, and packaging remain blocked"
  },
  {
    requirement: "Validates teacher-reviewed RAG disabled drafts through Rule DSL without enabling rules",
    pass:
      hasAll(files.ragReviewedRuleDslValidationPackage, [
        "transparent_ai_rag_reviewed_rule_dsl_validation_package_v1",
        "ready_for_review_only_rule_dsl_validation",
        "RAG_REVIEWED_RULE_DSL_VALIDATION_REQUIRES_TEACHER_REVIEWED_FLAG",
        "ROLLBACK_POINT_NOT_FOUND",
        "validateRuleCard",
        "RULE_DRAFT_MUST_REMAIN_DRAFT_DISABLED",
        "ruleEnabled: false",
        "memoryEnabled: false",
        "softwareActionsExecuted: false",
        "externalFetchPerformed: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragReviewedRuleDslValidationPackageRequested",
        "create_rag_reviewed_rule_dsl_validation_package",
        "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG reviewed Rule DSL validation package"
      ]) &&
      hasAll(files.ragReviewedRuleDslValidationPackageSmoke, [
        "transparent_ai_rag_reviewed_rule_dsl_validation_package_smoke_v1",
        "Reviewed Rule DSL validation package must reject validation packets that are not ready",
        "Reviewed Rule DSL validation package must reject active Rule Cards"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-reviewed-rule-dsl-validation-package",
        "smoke-rag-reviewed-rule-dsl-validation-package.mjs"
      ]),
    evidence:
      "teacher-reviewed RAG disabled drafts can now be checked by the existing Rule DSL core while activation, memory, execution, external fetch, and packaging stay locked"
  },
  {
    requirement: "Requires teacher review after RAG Rule DSL validation before disabled package planning",
    pass:
      hasAll(files.ragReviewedRuleDslReviewReceiptBuilder, [
        "transparent_ai_rag_reviewed_rule_dsl_review_receipt_builder_v1",
        "transparent_ai_rag_reviewed_rule_dsl_review_receipt_v1",
        "approve_disabled_rule_for_package_planning",
        "compile_active_rule_package"
      ]) &&
      hasAll(files.mcpServer, [
        "ragReviewedRuleDslReviewReceiptBuilderRequested",
        "ragReviewedRuleDslReviewReceiptValidationRequested",
        "create_rag_reviewed_rule_dsl_review_receipt_builder",
        "validate_rag_reviewed_rule_dsl_review_receipt",
        "knowledge/create-rag-reviewed-rule-dsl-review-receipt-builder.mjs",
        "knowledge/validate-rag-reviewed-rule-dsl-review-receipt.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG Rule DSL review receipt builder",
        "Default teach_apprentice validates RAG Rule DSL review receipt"
      ]) &&
      hasAll(files.ragReviewedRuleDslReviewReceiptValidation, [
        "transparent_ai_rag_reviewed_rule_dsl_review_receipt_validation_v1",
        "PACKAGE_HASH_MISMATCH",
        "APPROVED_ROW_REQUIRES_DSL_VALIDATION_REVIEW",
        "ready_for_review_only_disabled_rule_package_planning",
        "mayCompileActiveRulePackage: false",
        "ruleEnabled: false",
        "rulePackageCompiled: false",
        "memoryEnabled: false"
      ]) &&
      hasAll(files.ragReviewedRuleDslReviewReceiptSmoke, [
        "transparent_ai_rag_reviewed_rule_dsl_review_receipt_smoke_v1",
        "Rule DSL review receipt validation should prepare only disabled rule package planning",
        "Rule DSL review receipt validation must fail closed on forbidden enablement"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-reviewed-rule-dsl-review-receipt",
        "smoke-rag-reviewed-rule-dsl-review-receipt.mjs"
      ]),
    evidence:
      "machine-valid RAG Rule DSL drafts now require a teacher receipt before disabled package planning while active compilation, rule enablement, memory, execution, external fetch, and packaging stay locked"
  },
  {
    requirement: "Compiles teacher-reviewed RAG disabled rules into disabled Rule Package without active promotion",
    pass:
      hasAll(files.ragReviewedDisabledRulePackage, [
        "transparent_ai_rag_reviewed_disabled_rule_package_v1",
        "ready_for_review_only_disabled_rule_package_planning",
        "RAG_REVIEWED_DISABLED_RULE_PACKAGE_REQUIRES_TEACHER_REVIEWED_FLAG",
        "ROLLBACK_POINT_NOT_FOUND",
        "compile-rule-package.mjs",
        "spawnSync(process.execPath",
        "REVIEWED_RULE_MUST_REMAIN_DRAFT_DISABLED",
        "DISABLED_RULE_PACKAGE_CONTAINS_ACTIVE_RULES",
        "disabledRulePackageCompiled: true",
        "activeRulePackageCompiled: false",
        "ruleEnabled: false",
        "memoryEnabled: false",
        "softwareActionsExecuted: false",
        "externalFetchPerformed: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragReviewedDisabledRulePackageRequested",
        "create_rag_reviewed_disabled_rule_package",
        "knowledge/create-rag-reviewed-disabled-rule-package.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG reviewed disabled Rule Package"
      ]) &&
      hasAll(files.ragReviewedDisabledRulePackageSmoke, [
        "transparent_ai_rag_reviewed_disabled_rule_package_smoke_v1",
        "Reviewed disabled rule package must contain only draft_disabled rules",
        "Reviewed disabled rule package must reject active rules"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-reviewed-disabled-rule-package",
        "smoke-rag-reviewed-disabled-rule-package.mjs"
      ]),
    evidence:
      "teacher-reviewed RAG draft_disabled rules can now be compiled into a disabled Rule Package through the existing compiler while active promotion, rule enablement, memory, execution, external fetch, and packaging stay locked"
  },
  {
    requirement: "Carries primary-source logic fit into disabled Rule Package staging",
    pass:
      hasAll(files.ragReviewedDisabledRulePackage, [
        "logicExtractionHint",
        "logicFitDecision",
        "REVIEWED_RULE_LOGIC_EXTRACTION_HINT_MISMATCH",
        "REVIEWED_RULE_LOGIC_FIT_DECISION_MISMATCH",
        "REVIEWED_RULE_REQUIRES_MATCHING_LOGIC_FIT",
        "logicExtractionHints",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.ragPrimarySourceDisabledRulePackageSmoke, [
        "transparent_ai_rag_primary_source_disabled_rule_package_smoke_v1",
        "Primary-source disabled rule package should preserve the logic extraction hint on staged rules",
        "Primary-source disabled rule package must reject tampered missing logic hints",
        "Primary-source disabled rule package must keep activation, memory, software, external fetch, and packaging locks"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source reviewed disabled Rule Package"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-disabled-rule-package",
        "smoke-rag-primary-source-disabled-rule-package.mjs"
      ]),
    evidence:
      "primary-source logic hints now survive disabled Rule Package staging and tampered logic evidence is rejected before package review"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source disabled Rule Package staging",
    pass:
      hasAll(files.ragReviewedDisabledRulePackage, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "DISABLED_RULE_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "DISABLED_RULE_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "DISABLED_RULE_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "nextReview"
      ]) &&
      hasAll(files.ragPrimarySourceDisabledRulePackagePlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_disabled_rule_package_planning_logic_context_smoke_v1",
        "Primary-source disabled rule package should preserve upstream planning logic hints",
        "Primary-source disabled rule package should expose the planning logic evidence hash for package review",
        "Primary-source disabled rule package must reject tampered planning logic evidence",
        "Primary-source disabled rule package must reject tampered next-review planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source disabled Rule Package planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-disabled-rule-package-planning-logic-context",
        "smoke-rag-primary-source-disabled-rule-package-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source disabled Rule Package staging now retains and hash-checks upstream confirmed planning logic evidence"
  },
  {
    requirement: "Reports RAG disabled Rule Package validation without blocking delivery",
    pass:
      hasAll(files.ragDisabledPackageValidationReport, [
        "transparent_ai_rag_disabled_package_validation_report_v1",
        "evaluateRulePackage",
        "VALIDATION_REPORT_REHEARSAL_REJECTS_ACTIVE_RULES",
        "DISABLED_RULES_MUST_APPEAR_AS_LIFECYCLE_SKIPPED_ROWS",
        "DISABLED_RULE_PACKAGE_MUST_NOT_EVALUATE_RULE_VALIDATORS",
        "DISABLED_RULE_PACKAGE_REPORT_MUST_NOT_BLOCK_DELIVERY",
        "RAG_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG",
        "ruleEnabled: false",
        "activeRulePackageCompiled: false",
        "softwareActionsExecuted: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragDisabledPackageValidationReportRequested",
        "create_rag_disabled_package_validation_report",
        "knowledge/create-rag-disabled-package-validation-report.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG disabled package Validation Report"
      ]) &&
      hasAll(files.ragDisabledPackageValidationReportSmoke, [
        "transparent_ai_rag_disabled_package_validation_report_smoke_v1",
        "RAG disabled package validation report should include one lifecycle-skipped disabled rule",
        "RAG disabled package validation report must reject active rules"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-disabled-package-validation-report",
        "smoke-rag-disabled-package-validation-report.mjs"
      ]),
    evidence:
      "disabled RAG Rule Packages can now enter Validation Reports as lifecycle-gated skipped rows while delivery stays allowed and rule activation, execution, memory, external fetch, and packaging remain locked"
  },
  {
    requirement: "Carries primary-source logic fit into disabled package Validation Report",
    pass:
      hasAll(files.ragDisabledPackageValidationReport, [
        "disabledRuleLogicRows",
        "primarySourceLogicHintCount",
        "VALIDATION_REPORT_LOGIC_EXTRACTION_HINT_MISMATCH",
        "VALIDATION_REPORT_LOGIC_FIT_DECISION_MISMATCH",
        "VALIDATION_REPORT_REQUIRES_MATCHING_LOGIC_FIT",
        "logicExtractionHints",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.ragPrimarySourceDisabledPackageValidationReportSmoke, [
        "transparent_ai_rag_primary_source_disabled_package_validation_report_smoke_v1",
        "Primary-source disabled package validation report should preserve the logic extraction hint",
        "Primary-source disabled package validation report must reject tampered logic hints",
        "Primary-source disabled package validation report must not evaluate disabled rules as active validators"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source disabled package Validation Report"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-disabled-package-validation-report",
        "smoke-rag-primary-source-disabled-package-validation-report.mjs"
      ]),
    evidence:
      "primary-source logic hints now survive disabled package Validation Reports and tampered package logic evidence is rejected"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source disabled package Validation Report",
    pass:
      hasAll(files.ragDisabledPackageValidationReport, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "VALIDATION_REPORT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "VALIDATION_REPORT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "VALIDATION_REPORT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "nextReview"
      ]) &&
      hasAll(files.ragPrimarySourceDisabledPackageValidationReportPlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_disabled_package_validation_report_planning_logic_context_smoke_v1",
        "Primary-source disabled package validation report should preserve upstream planning logic hints",
        "Primary-source disabled package validation report should expose the planning logic evidence hash for report review",
        "Primary-source disabled package validation report must reject tampered planning logic evidence",
        "Primary-source disabled package validation report must reject tampered next-review planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source Validation Report planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-disabled-package-validation-report-planning-logic-context",
        "smoke-rag-primary-source-disabled-package-validation-report-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source disabled package Validation Reports now retain and hash-check upstream confirmed planning logic evidence"
  },
  {
    requirement: "Gates RAG Validation Report delivery without unlocking packaging or execution",
    pass:
      hasAll(files.ragValidationReportDeliveryGate, [
        "transparent_ai_rag_validation_report_delivery_gate_v1",
        "review_only_delivery_gate_closed",
        "deliveryAllowedOnlyMeansDisabledRulesDidNotBlock",
        "RAG_DELIVERY_GATE_REQUIRES_TEACHER_REVIEWED_FLAG",
        "RAG_DELIVERY_GATE_REQUIRES_LOCKED_VALIDATION_PACKET",
        "RAG_DELIVERY_GATE_REJECTS_NON_ALLOWED_OR_NON_SKIPPED_REPORT",
        "RAG_DELIVERY_GATE_REJECTS_ACTIVE_VALIDATOR_ROWS",
        "validation_report_delivery_allowed_to_packaging_unlock",
        "gateAllowsPackaging: false",
        "gateAllowsExecution: false",
        "deliveryGateOpen: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragValidationReportDeliveryGateRequested",
        "create_rag_validation_report_delivery_gate",
        "knowledge/create-rag-validation-report-delivery-gate.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG closed delivery gate"
      ]) &&
      hasAll(files.ragValidationReportDeliveryGateSmoke, [
        "transparent_ai_rag_validation_report_delivery_gate_smoke_v1",
        "RAG validation report delivery gate must not turn delivery_allowed into packaging or execution permission",
        "RAG validation report delivery gate must reject an unlocked validation packet",
        "RAG validation report delivery gate must reject non-allowed reports"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-validation-report-delivery-gate",
        "smoke-rag-validation-report-delivery-gate.mjs"
      ]),
    evidence:
      "RAG Validation Reports now feed a closed Delivery Gate where delivery_allowed stays review-only visibility evidence and cannot unlock rules, memory, execution, external fetch, acceptance, or packaging"
  },
  {
    requirement: "Carries primary-source logic fit into closed Delivery Gate",
    pass:
      hasAll(files.ragValidationReportDeliveryGate, [
        "disabledRuleLogicRows",
        "primarySourceLogicHintCount",
        "RAG_DELIVERY_GATE_LOGIC_EXTRACTION_HINT_MISMATCH",
        "RAG_DELIVERY_GATE_LOGIC_FIT_DECISION_MISMATCH",
        "RAG_DELIVERY_GATE_REQUIRES_MATCHING_LOGIC_FIT",
        "logicExtractionHints",
        "deliveryGateOpen: false"
      ]) &&
      hasAll(files.ragPrimarySourceValidationReportDeliveryGateSmoke, [
        "transparent_ai_rag_primary_source_validation_report_delivery_gate_smoke_v1",
        "Primary-source delivery gate should preserve the logic extraction hint",
        "Primary-source delivery gate must reject tampered logic hints",
        "Primary-source delivery gate must not turn delivery_allowed into packaging or execution permission"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source closed delivery gate"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-validation-report-delivery-gate",
        "smoke-rag-primary-source-validation-report-delivery-gate.mjs"
      ]),
    evidence:
      "primary-source logic hints now survive the closed Delivery Gate while delivery_allowed remains review-only evidence"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source closed Delivery Gate",
    pass:
      hasAll(files.ragValidationReportDeliveryGate, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "RAG_DELIVERY_GATE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_DELIVERY_GATE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_DELIVERY_GATE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "deliveryGateOpen: false"
      ]) &&
      hasAll(files.ragPrimarySourceValidationReportDeliveryGatePlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_validation_report_delivery_gate_planning_logic_context_smoke_v1",
        "Primary-source delivery gate should preserve upstream planning logic hints",
        "Primary-source delivery gate should expose the planning logic evidence hash for next review",
        "Primary-source delivery gate must reject tampered planning logic evidence",
        "Primary-source delivery gate must reject tampered next-review planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source closed delivery gate",
        "Default teach_apprentice preserves RAG primary-source Delivery Gate planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-validation-report-delivery-gate-planning-logic-context",
        "smoke-rag-primary-source-validation-report-delivery-gate-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source closed Delivery Gates now retain and hash-check upstream confirmed planning logic evidence"
  },
  {
    requirement: "Records RAG Delivery Gate audit trail with evidence chain and forbidden interpretations",
    pass:
      hasAll(files.ragDeliveryGateAuditTrail, [
        "transparent_ai_rag_delivery_gate_audit_trail_v1",
        "audit_trail_ready_for_teacher_review",
        "evidenceChain",
        "rag_disabled_validation_report_packet",
        "closed_delivery_gate",
        "RAG_DELIVERY_GATE_AUDIT_REQUIRES_TEACHER_REVIEWED_FLAG",
        "RAG_DELIVERY_GATE_AUDIT_REQUIRES_CLOSED_LOCKED_GATE",
        "RAG_DELIVERY_GATE_AUDIT_REQUIRES_BLOCKED_TRANSITIONS",
        "forbiddenInterpretations",
        "packaging_unlock",
        "software_execution",
        "privateChainOfThoughtStored: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragDeliveryGateAuditTrailRequested",
        "create_rag_delivery_gate_audit_trail",
        "knowledge/create-rag-delivery-gate-audit-trail.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG delivery gate audit trail"
      ]) &&
      hasAll(files.ragDeliveryGateAuditTrailSmoke, [
        "transparent_ai_rag_delivery_gate_audit_trail_smoke_v1",
        "RAG delivery gate audit trail must cite validation packet and closed gate evidence",
        "RAG delivery gate audit trail must reject an opened delivery gate",
        "RAG delivery gate audit trail must reject a packaging-unlocked gate"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-delivery-gate-audit-trail",
        "smoke-rag-delivery-gate-audit-trail.mjs"
      ]),
    evidence:
      "closed RAG Delivery Gates now produce a review-only audit trail with hashed evidence chain, retained rollback, blocked-transition replay, and no-action locks"
  },
  {
    requirement: "Carries primary-source logic fit into Delivery Gate audit trail",
    pass:
      hasAll(files.ragDeliveryGateAuditTrail, [
        "disabledRuleLogicRows",
        "primary_source_logic_evidence",
        "RAG_DELIVERY_GATE_AUDIT_LOGIC_EXTRACTION_HINT_MISMATCH",
        "RAG_DELIVERY_GATE_AUDIT_LOGIC_FIT_DECISION_MISMATCH",
        "RAG_DELIVERY_GATE_AUDIT_REQUIRES_MATCHING_LOGIC_FIT",
        "logicExtractionHints",
        "privateChainOfThoughtStored: false"
      ]) &&
      hasAll(files.ragPrimarySourceDeliveryGateAuditTrailSmoke, [
        "transparent_ai_rag_primary_source_delivery_gate_audit_trail_smoke_v1",
        "Primary-source audit trail should preserve the logic extraction hint",
        "Primary-source audit trail should add logic evidence to the evidence chain",
        "Primary-source audit trail must reject tampered logic hints"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source delivery gate audit trail"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-delivery-gate-audit-trail",
        "smoke-rag-primary-source-delivery-gate-audit-trail.mjs"
      ]),
    evidence:
      "primary-source logic hints now survive into the final audit trail with an explicit logic evidence chain step"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source Delivery Gate audit trail",
    pass:
      hasAll(files.ragDeliveryGateAuditTrail, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "primary_source_planning_logic_evidence",
        "RAG_DELIVERY_GATE_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_DELIVERY_GATE_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_DELIVERY_GATE_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "privateChainOfThoughtStored: false"
      ]) &&
      hasAll(files.ragPrimarySourceDeliveryGateAuditTrailPlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_delivery_gate_audit_trail_planning_logic_context_smoke_v1",
        "Primary-source audit trail should preserve upstream planning logic hints",
        "Primary-source audit trail should add planning logic evidence to the evidence chain",
        "Primary-source audit trail must reject tampered planning logic evidence",
        "Primary-source audit trail must reject tampered next-review planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source delivery gate audit trail",
        "Default teach_apprentice preserves RAG primary-source Audit Trail planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-delivery-gate-audit-trail-planning-logic-context",
        "smoke-rag-primary-source-delivery-gate-audit-trail-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source Delivery Gate audit trails now retain and hash-check upstream confirmed planning logic evidence"
  },
  {
    requirement: "Requires teacher review receipt before RAG audit trail can prepare follow-up queue",
    pass:
      hasAll(files.ragDeliveryGateAuditReviewReceiptBuilder, [
        "transparent_ai_rag_delivery_gate_audit_review_receipt_builder_v1",
        "transparent_ai_rag_delivery_gate_audit_review_receipt_v1",
        "evidenceChainReviews",
        "rag-delivery-gate-audit-review-workbench.html",
        "reviewWorkbenchHtmlPath",
        "forbiddenInterpretationsReviewed",
        "rollbackPointRetained"
      ]) &&
      hasAll(files.mcpServer, [
        "ragDeliveryGateAuditReviewReceiptBuilderRequested",
        "create_rag_delivery_gate_audit_review_receipt_builder",
        "knowledge/create-rag-delivery-gate-audit-review-receipt-builder.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG audit review receipt builder"
      ]) &&
      hasAll(files.ragDeliveryGateAuditReviewReceiptValidation, [
        "transparent_ai_rag_delivery_gate_audit_review_receipt_validation_v1",
        "ready_for_review_only_follow_up_queue",
        "FOLLOW_UP_DECISION_REQUIRES_ALL_EVIDENCE_ROWS_REVIEWED",
        "FOLLOW_UP_DECISION_REQUIRES_FORBIDDEN_INTERPRETATIONS_REVIEW",
        "FOLLOW_UP_DECISION_REQUIRES_RETAINED_ROLLBACK_POINT",
        "mayPrepareReviewOnlyFollowUpQueue",
        "mayUnlockPackaging: false",
        "mayExecuteSoftware: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragDeliveryGateAuditReviewReceiptValidationRequested",
        "validate_rag_delivery_gate_audit_review_receipt",
        "knowledge/validate-rag-delivery-gate-audit-review-receipt.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice validates RAG audit review receipt"
      ]) &&
      hasAll(files.ragDeliveryGateAuditReviewReceiptSmoke, [
        "transparent_ai_rag_delivery_gate_audit_review_receipt_smoke_v1",
        "Audit review receipt validation should prepare only a review-only follow-up queue",
        "Audit review receipt validation must fail closed on acceptance",
        "Audit review receipt validation must require retained rollback review"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-delivery-gate-audit-review-receipt",
        "smoke-rag-delivery-gate-audit-review-receipt.mjs"
      ]),
    evidence:
      "RAG audit trails now require teacher receipt validation before any review-only follow-up queue while acceptance, execution, memory, delivery opening, and packaging remain blocked"
  },
  {
    requirement: "Requires explicit teacher review of primary-source audit logic evidence",
    pass:
      hasAll(files.ragDeliveryGateAuditReviewReceiptBuilder, [
        "logicEvidenceReviews",
        "reviewed_logic_evidence",
        "request_logic_recheck"
      ]) &&
      hasAll(files.ragDeliveryGateAuditReviewReceiptValidation, [
        "AUDIT_LOGIC_EVIDENCE_ROW_COUNT_MISMATCH",
        "AUDIT_LOGIC_EXTRACTION_HINT_MISMATCH",
        "FOLLOW_UP_DECISION_REQUIRES_ALL_LOGIC_EVIDENCE_ROWS_REVIEWED",
        "REVIEWED_LOGIC_ROW_REQUIRES_LOGIC_EVIDENCE_REVIEW",
        "REVIEWED_LOGIC_ROW_REQUIRES_LOGIC_FIT_REVIEW",
        "reviewedLogicEvidenceRows"
      ]) &&
      hasAll(files.ragPrimarySourceDeliveryGateAuditReviewReceiptSmoke, [
        "transparent_ai_rag_primary_source_delivery_gate_audit_review_receipt_smoke_v1",
        "Primary-source audit review receipt should expose the logic extraction hint",
        "Primary-source audit review validation must require logic evidence review",
        "Primary-source audit review validation must reject tampered logic hints"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source audit review receipt builder",
        "Default teach_apprentice validates RAG primary-source audit review receipt"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-delivery-gate-audit-review-receipt",
        "smoke-rag-primary-source-delivery-gate-audit-review-receipt.mjs"
      ]),
    evidence:
      "primary-source audit logic evidence now requires explicit teacher review before a review-only follow-up queue can be prepared"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source audit review receipt",
    pass:
      hasAll(files.ragDeliveryGateAuditReviewReceiptBuilder, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "RAG_AUDIT_REVIEW_BUILDER_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_AUDIT_REVIEW_BUILDER_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_AUDIT_REVIEW_BUILDER_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "transparent_ai_rag_delivery_gate_audit_review_receipt_v1"
      ]) &&
      hasAll(files.ragDeliveryGateAuditReviewReceiptValidation, [
        "AUDIT_REVIEW_AUDIT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "AUDIT_REVIEW_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "AUDIT_REVIEW_AUDIT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "AUDIT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "AUDIT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "nextReview"
      ]) &&
      hasAll(files.ragPrimarySourceDeliveryGateAuditReviewReceiptPlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_delivery_gate_audit_review_receipt_planning_logic_context_smoke_v1",
        "Primary-source audit review receipt should preserve upstream planning logic hints",
        "Primary-source audit review validation should preserve planning logic evidence hints",
        "Primary-source audit review receipt builder must reject tampered audit planning logic evidence",
        "Primary-source audit review validation must reject tampered next-review audit planning logic evidence",
        "Primary-source audit review validation must reject tampered planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source audit review receipt builder",
        "Default teach_apprentice validates RAG primary-source audit review receipt",
        "Default teach_apprentice preserves RAG primary-source audit review receipt planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-delivery-gate-audit-review-receipt-planning-logic-context",
        "smoke-rag-primary-source-delivery-gate-audit-review-receipt-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source audit review receipts now retain and hash-check upstream confirmed planning logic evidence"
  },
  {
    requirement: "Creates manual RAG audit-review follow-up queue without actions or completion claims",
    pass:
      hasAll(files.ragAuditReviewFollowUpQueue, [
        "transparent_ai_rag_audit_review_follow_up_queue_v1",
        "manual_review_only_follow_up_queue_ready",
        "RAG_FOLLOW_UP_QUEUE_REQUIRES_READY_AUDIT_REVIEW_VALIDATION",
        "RAG_FOLLOW_UP_QUEUE_REQUIRES_LOCKED_AUDIT_REVIEW_VALIDATION",
        "review_forbidden_interpretations",
        "confirm_rollback_retained",
        "choose_next_review_only_rag_step",
        "queueDoesNotRunCommands: true",
        "queueDoesNotOpenFiles: true",
        "queueDoesNotFetchSources: true",
        "queueDoesNotClaimCompletion: true"
      ]) &&
      hasAll(files.mcpServer, [
        "ragAuditReviewFollowUpQueueRequested",
        "create_rag_audit_review_follow_up_queue",
        "knowledge/create-rag-audit-review-follow-up-queue.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG audit review follow-up queue"
      ]) &&
      hasAll(files.ragAuditReviewFollowUpQueueSmoke, [
        "transparent_ai_rag_audit_review_follow_up_queue_smoke_v1",
        "RAG audit review follow-up queue should prepare four manual review items",
        "RAG audit review follow-up queue must reject non-ready validation",
        "RAG audit review follow-up queue must require a retained rollback point"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-audit-review-follow-up-queue",
        "smoke-rag-audit-review-follow-up-queue.mjs"
      ]),
    evidence:
      "validated RAG audit reviews now produce a manual follow-up queue for evidence, forbidden-interpretation, rollback, and next-lane review without commands, file opens, fetch, memory, execution, delivery opening, packaging, or completion claims"
  },
  {
    requirement: "Carries primary-source logic evidence into audit-review follow-up queue",
    pass:
      hasAll(files.ragAuditReviewFollowUpQueue, [
        "review_primary_source_logic_evidence",
        "logicExtractionHints",
        "primarySourceLogicHintItems",
        "logic_evidence_review",
        "logic_evidence_confirmed",
        "request_logic_recheck",
        "queueDoesNotRunCommands: true"
      ]) &&
      hasAll(files.ragPrimarySourceAuditReviewFollowUpQueueSmoke, [
        "transparent_ai_rag_primary_source_audit_review_follow_up_queue_smoke_v1",
        "Primary-source audit follow-up queue should include a logic evidence review item",
        "Primary-source audit follow-up queue should preserve logic extraction hints",
        "Audit follow-up queue should not invent logic evidence items"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source audit review follow-up queue"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-audit-review-follow-up-queue",
        "smoke-rag-primary-source-audit-review-follow-up-queue.mjs"
      ]),
    evidence:
      "primary-source audit follow-up queues now include a manual logic evidence item before next-lane selection"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source audit-review follow-up queue",
    pass:
      hasAll(files.ragAuditReviewFollowUpQueue, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "RAG_FOLLOW_UP_QUEUE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_FOLLOW_UP_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_FOLLOW_UP_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "planningLogicEvidencePresent",
        "mayClaimGoalComplete: false"
      ]) &&
      hasAll(files.ragPrimarySourceAuditReviewFollowUpQueuePlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_audit_review_follow_up_queue_planning_logic_context_smoke_v1",
        "Primary-source audit follow-up queue should preserve upstream planning logic hints",
        "Primary-source audit follow-up queue should expose the planning logic evidence hash for next review",
        "Primary-source audit follow-up queue must reject tampered planning logic evidence",
        "Primary-source audit follow-up queue must reject tampered next-review planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source audit review follow-up queue",
        "Default teach_apprentice preserves RAG primary-source audit follow-up queue planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-audit-review-follow-up-queue-planning-logic-context",
        "smoke-rag-primary-source-audit-review-follow-up-queue-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source audit follow-up queues now retain and hash-check upstream confirmed planning logic evidence"
  },
  {
    requirement: "Audits all RAG next-review hash mismatch codes against documentation and delivery gates",
    pass:
      hasAll(files.ragNextReviewHashCoverageAuditSmoke, [
        "transparent_ai_rag_next_review_hash_coverage_audit_smoke_v1",
        "NEXT_REVIEW",
        "HASH_MISMATCH",
        "README.md",
        "KNOWLEDGE_AUGMENTED_RAG_RESEARCH_DIRECTION.md",
        "scripts/verify-plugin.mjs",
        "scripts/smoke-goal-coverage.mjs",
        "RAG_NEXT_REVIEW_HASH_COVERAGE_AUDIT_MISSING_TARGETS",
        "externalFetchPerformed: false",
        "softwareActionsExecuted: false",
        "memoryWritten: false"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-next-review-hash-coverage-audit",
        "smoke-rag-next-review-hash-coverage-audit.mjs"
      ]),
    evidence:
      "RAG next-review hash mismatch codes now have a reusable audit that prevents docs, verify-plugin, and goal coverage from drifting behind knowledge scripts"
  },
  {
    requirement: "Audits the TLCL RAG result-return chain across scripts, MCP, docs, verifier, and goal coverage",
    pass:
      hasAll(files.tlclRagReturnChainCoverageAuditSmoke, [
        "transparent_ai_tlcl_rag_return_chain_coverage_audit_smoke_v1",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-",
        "mcp-server.mjs",
        "smoke-mcp-tool-surface.mjs",
        "verify-plugin.mjs",
        "smoke-goal-coverage.mjs",
        "goalComplete: false",
        "ruleEnabled: false",
        "high_reasoning_logic_contract_repair"
      ]) &&
      hasAll(files.readme, [
        "TLCL RAG Return-Chain Coverage Audit",
        "smoke-tlcl-rag-return-chain-coverage-audit.mjs"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-tlcl-rag-return-chain-coverage-audit",
        "smoke-tlcl-rag-return-chain-coverage-audit.mjs"
      ]),
    evidence:
      "every current TLCL RAG result-return gate now has a static drift audit across scripts, MCP, docs, package scripts, verify-plugin, goal coverage, high-reasoning repair routes, and no-op locks"
  },
  {
    requirement: "Audits the original goal capability matrix across documentation, MCP surface, scripts, and safety locks",
    pass:
      hasAll(files.originalGoalCapabilityMatrixCoverageAuditSmoke, [
        "transparent_ai_original_goal_capability_matrix_coverage_audit_smoke_v1",
        "knowledge_augmented_rag",
        "low_token_visual_escalation",
        "voice_text_numbered_engineering_control",
        "spatial_numbered_target_confirmation",
        "universal_detail_logic",
        "existing_tool_first_feasibility",
        "rollback_and_approval_safety",
        "README.md",
        "TRANSPARENT_AI_APPRENTICE_FRAMEWORK_AND_LOGIC.md",
        "scripts/mcp-server.mjs",
        "softwareActionsExecuted: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-original-goal-capability-matrix-coverage-audit",
        "smoke-original-goal-capability-matrix-coverage-audit.mjs"
      ]),
    evidence:
      "the user's RAG, low-token, voice, spatial confirmation, strict detail logic, existing-tool-first, rollback, and approval-gate directions now have one reusable capability-matrix coverage audit"
  },
  {
    requirement: "Requires teacher selection receipt for exactly one review-only RAG follow-up lane",
    pass:
      hasAll(files.ragFollowUpQueueSelectionReceiptBuilder, [
        "transparent_ai_rag_follow_up_queue_selection_receipt_builder_v1",
        "transparent_ai_rag_follow_up_queue_selection_receipt_v1",
        "selectedFollowUpDecision",
        "noActionBoundaryReviewed"
      ]) &&
      hasAll(files.ragFollowUpQueueSelectionReceiptValidation, [
        "transparent_ai_rag_follow_up_queue_selection_receipt_validation_v1",
        "ready_for_selected_review_only_rag_follow_up",
        "TOP_LEVEL_SELECTION_REQUIRES_EXACTLY_ONE_SELECTED_ROW",
        "SELECTED_ROW_REQUIRES_NO_ACTION_BOUNDARY_REVIEW",
        "mayPrepareSelectedReviewOnlyFollowUp",
        "mayFetchExternalSources: false",
        "mayClaimGoalComplete: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragFollowUpQueueSelectionReceiptBuilderRequested",
        "create_rag_follow_up_queue_selection_receipt_builder",
        "knowledge/create-rag-follow-up-queue-selection-receipt-builder.mjs",
        "ragFollowUpQueueSelectionReceiptValidationRequested",
        "validate_rag_follow_up_queue_selection_receipt",
        "knowledge/validate-rag-follow-up-queue-selection-receipt.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG follow-up queue selection receipt builder",
        "Default teach_apprentice validates RAG follow-up queue selection receipt"
      ]) &&
      hasAll(files.ragFollowUpQueueSelectionReceiptSmoke, [
        "transparent_ai_rag_follow_up_queue_selection_receipt_smoke_v1",
        "Follow-up queue selection receipt should prepare only the selected review-only RAG follow-up",
        "Follow-up queue selection receipt must reject multiple selected rows",
        "Follow-up queue selection receipt must require no-action boundary review"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-follow-up-queue-selection-receipt",
        "smoke-rag-follow-up-queue-selection-receipt.mjs"
      ]),
    evidence:
      "RAG follow-up queues now require a teacher selection receipt that selects exactly one review-only lane while blocking acceptance, fetch, execution, memory, delivery opening, packaging, and completion"
  },
  {
    requirement: "Requires confirmed primary-source logic evidence before RAG follow-up lane selection",
    pass:
      hasAll(files.ragFollowUpQueueSelectionReceiptBuilder, [
        "allowedLogicEvidenceDecisions",
        "logicEvidenceDecision",
        "logicFitDecisionConfirmed",
        "logicExtractionHints"
      ]) &&
      hasAll(files.ragFollowUpQueueSelectionReceiptValidation, [
        "SELECTION_REQUIRES_CONFIRMED_PRIMARY_SOURCE_LOGIC_EVIDENCE",
        "SELECTION_REQUIRES_CONFIRMED_PRIMARY_SOURCE_LOGIC_FIT",
        "LOGIC_EVIDENCE_HINTS_MISMATCH",
        "logicEvidenceReviews"
      ]) &&
      hasAll(files.ragPrimarySourceFollowUpQueueSelectionReceiptSmoke, [
        "transparent_ai_rag_primary_source_follow_up_queue_selection_receipt_smoke_v1",
        "Primary-source selection receipt should preserve logic extraction hints",
        "Primary-source selection receipt must fail closed until logic evidence is confirmed",
        "Primary-source selection receipt must reject mismatched logic evidence hints"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source follow-up queue selection receipt builder",
        "Default teach_apprentice validates RAG primary-source follow-up queue selection receipt"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-follow-up-queue-selection-receipt",
        "smoke-rag-primary-source-follow-up-queue-selection-receipt.mjs"
      ]),
    evidence:
      "primary-source RAG follow-up selection now requires confirmed strict data-to-output logic evidence before downstream review-only planning"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source follow-up lane selection",
    pass:
      hasAll(files.ragFollowUpQueueSelectionReceiptBuilder, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "FOLLOW_UP_SELECTION_BUILDER_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "FOLLOW_UP_SELECTION_BUILDER_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "FOLLOW_UP_SELECTION_BUILDER_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
      ]) &&
      hasAll(files.ragFollowUpQueueSelectionReceiptValidation, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "FOLLOW_UP_SELECTION_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "FOLLOW_UP_SELECTION_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "FOLLOW_UP_SELECTION_QUEUE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "mayClaimGoalComplete: false"
      ]) &&
      hasAll(files.ragPrimarySourceFollowUpQueueSelectionReceiptPlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_follow_up_queue_selection_receipt_planning_logic_context_smoke_v1",
        "Primary-source selection receipt should preserve upstream planning logic hints",
        "Primary-source selection validation should expose the planning logic evidence hash for next review",
        "Primary-source selection receipt must reject tampered planning logic evidence",
        "Primary-source selection receipt builder must reject tampered next-review planning logic evidence",
        "Primary-source selection receipt builder must reject tampered next-review planning logic evidence hash",
        "Primary-source selection validation must reject tampered queue next-review planning logic evidence",
        "Primary-source selection validation must reject tampered queue next-review planning logic evidence hash"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source follow-up queue selection receipt builder",
        "Default teach_apprentice validates RAG primary-source follow-up queue selection receipt",
        "Default teach_apprentice preserves RAG primary-source selection receipt planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-follow-up-queue-selection-receipt-planning-logic-context",
        "smoke-rag-primary-source-follow-up-queue-selection-receipt-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source follow-up lane selection now retains and hash-checks upstream confirmed planning logic evidence"
  },
  {
    requirement: "Turns selected RAG follow-up lane into review-only planning packet",
    pass:
      hasAll(files.ragSelectedFollowUpPlanningPacket, [
        "transparent_ai_rag_selected_follow_up_planning_packet_v1",
        "selected_follow_up_planning_ready_for_teacher_review",
        "RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_READY_SELECTION_VALIDATION",
        "RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_LOCKED_SELECTION_VALIDATION",
        "RAG_SELECTED_FOLLOW_UP_PLANNING_REJECTS_FORBIDDEN_DECISION",
        "request_more_primary_sources",
        "plannedItems",
        "externalFetchPerformed: false",
        "softwareActionsExecuted: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragSelectedFollowUpPlanningPacketRequested",
        "create_rag_selected_follow_up_planning_packet",
        "knowledge/create-rag-selected-follow-up-planning-packet.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG selected follow-up planning packet"
      ]) &&
      hasAll(files.ragSelectedFollowUpPlanningPacketSmoke, [
        "transparent_ai_rag_selected_follow_up_planning_packet_smoke_v1",
        "Selected follow-up planning should prepare primary-source evidence review",
        "Selected follow-up planning must reject non-ready selection validation",
        "Selected follow-up planning must require retained rollback"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-selected-follow-up-planning-packet",
        "smoke-rag-selected-follow-up-planning-packet.mjs"
      ]),
    evidence:
      "selected RAG follow-up lanes now become locked review-only planning packets that require a retained rollback point while blocking fetch, execution, rule enablement, memory, packaging, acceptance, and completion"
  },
  {
    requirement: "Carries confirmed primary-source logic evidence into selected RAG follow-up planning",
    pass:
      hasAll(files.ragSelectedFollowUpPlanningPacket, [
        "logicExtractionHints",
        "logicEvidenceReviews",
        "RAG_SELECTED_FOLLOW_UP_PLANNING_REQUIRES_CONFIRMED_LOGIC_EVIDENCE",
        "logic_evidence_confirmed"
      ]) &&
      hasAll(files.ragPrimarySourceSelectedFollowUpPlanningPacketSmoke, [
        "transparent_ai_rag_primary_source_selected_follow_up_planning_packet_smoke_v1",
        "Primary-source selected follow-up planning should preserve logic extraction hints",
        "Primary-source selected follow-up planning should preserve confirmed logic evidence review",
        "Primary-source selected follow-up planning must reject unconfirmed logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source selected follow-up planning packet"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-selected-follow-up-planning-packet",
        "smoke-rag-primary-source-selected-follow-up-planning-packet.mjs"
      ]),
    evidence:
      "confirmed primary-source data-to-output logic evidence now survives into selected review-only planning packets"
  },
  {
    requirement: "Preserves planning logic evidence through selected primary-source follow-up planning",
    pass:
      hasAll(files.ragSelectedFollowUpPlanningPacket, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "RAG_SELECTED_FOLLOW_UP_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_SELECTED_FOLLOW_UP_PLANNING_SELECTED_LOGIC_EVIDENCE_MISMATCH",
        "RAG_SELECTED_FOLLOW_UP_PLANNING_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_SELECTED_FOLLOW_UP_PLANNING_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH"
      ]) &&
      hasAll(files.ragPrimarySourceSelectedFollowUpPlanningPacketPlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_selected_follow_up_planning_packet_planning_logic_context_smoke_v1",
        "Primary-source selected follow-up planning should preserve upstream planning logic hints",
        "Primary-source selected follow-up planning should expose the planning logic hash for next review",
        "Primary-source selected follow-up planning must reject tampered planning logic evidence",
        "Primary-source selected follow-up planning must reject tampered selected-follow-up planning logic evidence",
        "Primary-source selected follow-up planning must reject tampered next-review planning logic evidence",
        "Primary-source selected follow-up planning must reject tampered next-review planning logic evidence hash"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source selected follow-up planning packet",
        "Default teach_apprentice preserves RAG primary-source selected follow-up planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-selected-follow-up-planning-packet-planning-logic-context",
        "smoke-rag-primary-source-selected-follow-up-planning-packet-planning-logic-context.mjs"
      ]),
    evidence:
      "upstream confirmed planning logic evidence now survives into selected primary-source follow-up planning packets"
  },
  {
    requirement: "Captures teacher-provided primary sources with logic extraction hints for RAG follow-up",
    pass:
      hasAll(files.ragPrimarySourceEvidenceRequestReceiptBuilder, [
        "transparent_ai_rag_primary_source_evidence_request_receipt_builder_v1",
        "transparent_ai_rag_primary_source_evidence_request_receipt_v1",
        "logicExtractionHint",
        "RAG_PRIMARY_SOURCE_EVIDENCE_RECEIPT_REQUIRES_LOCKED_PRIMARY_SOURCE_PLANNING_PACKET"
      ]) &&
      hasAll(files.ragPrimarySourceEvidenceRequestReceiptValidation, [
        "transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1",
        "ready_for_review_only_primary_source_registry_follow_up",
        "PRIMARY_SOURCE_ROW_REQUIRES_LOGIC_EXTRACTION_HINT",
        "confirmedSources",
        "mayFetchExternalSources: false",
        "mayClaimGoalComplete: false"
      ]) &&
      hasAll(files.mcpServer, [
        "ragPrimarySourceEvidenceRequestReceiptBuilderRequested",
        "create_rag_primary_source_evidence_request_receipt_builder",
        "knowledge/create-rag-primary-source-evidence-request-receipt-builder.mjs",
        "ragPrimarySourceEvidenceRequestReceiptValidationRequested",
        "validate_rag_primary_source_evidence_request_receipt",
        "knowledge/validate-rag-primary-source-evidence-request-receipt.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source evidence request receipt builder",
        "Default teach_apprentice validates RAG primary-source evidence request receipt"
      ]) &&
      hasAll(files.ragPrimarySourceEvidenceRequestReceiptSmoke, [
        "transparent_ai_rag_primary_source_evidence_request_receipt_smoke_v1",
        "Primary-source evidence receipt should preserve the logic extraction hint",
        "Primary-source evidence receipt must reject acceptance",
        "Primary-source evidence receipt builder must require locked planning packet"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-evidence-request-receipt",
        "smoke-rag-primary-source-evidence-request-receipt.mjs"
      ]),
    evidence:
      "teacher-provided primary-source RAG follow-ups now require reviewed source evidence and logic extraction hints while emitting locked confirmedSources for later registry work"
  },
  {
    requirement: "Preserves confirmed planning logic evidence through primary-source evidence request receipts",
    pass:
      hasAll(files.ragPrimarySourceEvidenceRequestReceiptBuilder, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "logicEvidenceReviews",
        "RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_PRIMARY_SOURCE_EVIDENCE_REQUEST_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH"
      ]) &&
      hasAll(files.ragPrimarySourceEvidenceRequestReceiptValidation, [
        "PRIMARY_SOURCE_PLANNING_PACKET_LOGIC_EVIDENCE_HASH_MISMATCH",
        "PRIMARY_SOURCE_PLANNING_PACKET_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH",
        "PRIMARY_SOURCE_PLANNING_PACKET_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH",
        "PRIMARY_SOURCE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "PRIMARY_SOURCE_REQUEST_CONTEXT_LOGIC_EVIDENCE_MISMATCH",
        "planningLogicEvidence",
        "planningLogicEvidenceHash"
      ]) &&
      hasAll(files.ragPrimarySourceEvidenceRequestLogicContextSmoke, [
        "transparent_ai_rag_primary_source_evidence_request_logic_context_smoke_v1",
        "Primary-source evidence request should expose upstream planning logic hints",
        "Primary-source evidence request should preserve the upstream planning packet logic hash",
        "Primary-source evidence validation should preserve planning logic evidence hints",
        "Primary-source evidence validation must reject tampered planning logic evidence context",
        "Primary-source evidence request builder must reject tampered planning packet next-review logic evidence",
        "Primary-source evidence request builder must reject tampered planning packet next-review logic evidence hash",
        "Primary-source evidence validation must reject tampered planning packet next-review logic evidence",
        "Primary-source evidence validation must reject tampered planning packet next-review logic evidence hash"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source evidence request planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-evidence-request-logic-context",
        "smoke-rag-primary-source-evidence-request-logic-context.mjs"
      ]),
    evidence:
      "primary-source evidence request receipts now retain a hash-checked upstream planning logic context"
  },
  {
    requirement: "Feeds primary-source validation into confirmed source registry follow-up",
    pass:
      hasAll(files.ragConfirmedSourceRegistryPackage, [
        "transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1",
        "primary_source_evidence_follow_up",
        "sourceRegistryFollowUpKind",
        "logicExtractionHint",
        "Confirmed source registry package requires locked review-only validation"
      ]) &&
      hasAll(files.ragPrimarySourceRegistryFollowUpSmoke, [
        "transparent_ai_rag_primary_source_registry_follow_up_smoke_v1",
        "Primary-source registry follow-up should preserve the logic extraction hint on source rows",
        "Primary-source registry follow-up should prepare the existing local corpus ingest command",
        "Primary-source registry follow-up must reject unlocked validation"
      ]) &&
      hasAll(files.mcpServer, [
        "ragConfirmedSourceRegistryPackageRequested",
        "create_rag_confirmed_source_registry_package",
        "knowledge/create-rag-confirmed-source-registry-package.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG confirmed source registry package"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-registry-follow-up",
        "smoke-rag-primary-source-registry-follow-up.mjs"
      ]),
    evidence:
      "primary-source receipt validations now feed the existing confirmed source registry package while preserving logic hints and local-ingest-only locks"
  },
  {
    requirement: "Returns primary-source validation through TLCL before confirmed source registry follow-up",
    pass:
      hasAll(files.readme, [
        "Current TLCL RAG primary-source evidence-request result return update",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt-builder.mjs",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt.mjs"
      ]) &&
      hasAll(files.tlclRagPrimarySourceEvidenceRequestResultReceiptBuilder, [
        "transparent_ai_rag_primary_source_evidence_request_receipt_validation_v1",
        "builderDoesNotRunConfirmedSourceRegistryPackage",
        "confirmedSources",
        "logic_extraction_hint"
      ]) &&
      hasAll(files.tlclRagPrimarySourceEvidenceRequestResultReceiptValidation, [
        "tlcl_rag_primary_source_evidence_request_ready_for_confirmed_source_registry_follow_up",
        "knowledge/create-rag-confirmed-source-registry-package.mjs",
        "validatorDoesNotRunConfirmedSourceRegistryPackage",
        "high_reasoning_logic_contract_repair_after_tlcl_rag_primary_source_evidence_request_result"
      ]) &&
      hasAll(files.tlclRagPrimarySourceEvidenceRequestResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_smoke_v1",
        "TLCL RAG primary-source evidence request result validation prepares source registry handoff",
        "TLCL RAG primary-source evidence request result validation blocks forbidden registry package runs",
        "TLCL RAG primary-source evidence request result validation can route correction back to high reasoning repair"
      ]) &&
      hasAll(files.mcpServer, [
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt_builder",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_primary_source_evidence_request_result_receipt"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "MCP advanced mode builds TLCL RAG primary-source evidence request result receipt",
        "MCP advanced mode validates TLCL RAG primary-source evidence request result receipt",
        "Default teach_apprentice builds TLCL RAG primary-source evidence request result receipt",
        "Default teach_apprentice validates TLCL RAG primary-source evidence request result receipt",
        "advancedNames.length === 363"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-primary-source-evidence-request-result-receipt"
      ]),
    evidence:
      "primary-source evidence request validations now return through TLCL before any confirmed source registry package handoff"
  },
  {
    requirement: "Returns confirmed source registry package through TLCL before local ingest follow-up",
    pass:
      hasAll(files.readme, [
        "Current TLCL RAG confirmed source-registry result return update",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt-builder.mjs",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt.mjs"
      ]) &&
      hasAll(files.tlclRagConfirmedSourceRegistryResultReceiptBuilder, [
        "transparent_ai_rag_confirmed_source_registry_package_v1",
        "builderDoesNotRunLocalIngest",
        "readyLocalSourceIds",
        "logicExtractionHint"
      ]) &&
      hasAll(files.tlclRagConfirmedSourceRegistryResultReceiptValidation, [
        "tlcl_rag_confirmed_source_registry_ready_for_local_ingest_follow_up",
        "knowledge/run-rag-confirmed-local-ingest.mjs",
        "validatorDoesNotRunLocalIngest",
        "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_source_registry_result"
      ]) &&
      hasAll(files.tlclRagConfirmedSourceRegistryResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_smoke_v1",
        "TLCL RAG confirmed source registry result validation prepares local ingest handoff",
        "TLCL RAG confirmed source registry result validation blocks forbidden local ingest runs",
        "TLCL RAG confirmed source registry result validation can route correction back to high reasoning repair"
      ]) &&
      hasAll(files.mcpServer, [
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt_builder",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_source_registry_result_receipt"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "MCP advanced mode builds TLCL RAG confirmed source registry result receipt",
        "MCP advanced mode validates TLCL RAG confirmed source registry result receipt",
        "Default teach_apprentice builds TLCL RAG confirmed source registry result receipt",
        "Default teach_apprentice validates TLCL RAG confirmed source registry result receipt",
        "advancedNames.length === 363"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-source-registry-result-receipt"
      ]),
    evidence:
      "confirmed source registry packages now return through TLCL before any local ingest handoff"
  },
  {
    requirement: "Returns confirmed local ingest run through TLCL before retrieval draft follow-up",
    pass:
      hasAll(files.readme, [
        "Current TLCL RAG confirmed local-ingest result return update",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt-builder.mjs",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt.mjs"
      ]) &&
      hasAll(files.tlclRagConfirmedLocalIngestResultReceiptBuilder, [
        "transparent_ai_rag_confirmed_local_ingest_run_v1",
        "builderDoesNotRunRetrievalDraft",
        "localCorpusIndexes",
        "retrievalQuery"
      ]) &&
      hasAll(files.tlclRagConfirmedLocalIngestResultReceiptValidation, [
        "tlcl_rag_confirmed_local_ingest_ready_for_retrieval_draft_follow_up",
        "knowledge/run-rag-confirmed-retrieval-draft.mjs",
        "validatorDoesNotRunRetrievalDraft",
        "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_local_ingest_result"
      ]) &&
      hasAll(files.tlclRagConfirmedLocalIngestResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_smoke_v1",
        "TLCL RAG confirmed local ingest result validation prepares retrieval draft handoff",
        "TLCL RAG confirmed local ingest result validation blocks forbidden retrieval draft runs",
        "TLCL RAG confirmed local ingest result validation can route correction back to high reasoning repair"
      ]) &&
      hasAll(files.mcpServer, [
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt_builder",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_local_ingest_result_receipt"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "MCP advanced mode builds TLCL RAG confirmed local ingest result receipt",
        "MCP advanced mode validates TLCL RAG confirmed local ingest result receipt",
        "Default teach_apprentice builds TLCL RAG confirmed local ingest result receipt",
        "Default teach_apprentice validates TLCL RAG confirmed local ingest result receipt",
        "advancedNames.length === 363"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-local-ingest-result-receipt"
      ]),
    evidence:
      "confirmed local ingest runs now return through TLCL before any retrieval draft handoff"
  },
  {
    requirement: "Returns confirmed retrieval draft run through TLCL before detailed review receipt follow-up",
    pass:
      hasAll(files.readme, [
        "Current TLCL RAG confirmed retrieval-draft result return update",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt-builder.mjs",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt.mjs"
      ]) &&
      hasAll(files.tlclRagConfirmedRetrievalDraftResultReceiptBuilder, [
        "transparent_ai_rag_confirmed_retrieval_draft_run_v1",
        "builderDoesNotRunRetrievalDraftReviewReceiptBuilder",
        "retrievalRows",
        "draft_disabled"
      ]) &&
      hasAll(files.tlclRagConfirmedRetrievalDraftResultReceiptValidation, [
        "tlcl_rag_confirmed_retrieval_draft_ready_for_review_receipt_follow_up",
        "knowledge/create-rag-confirmed-retrieval-draft-review-receipt-builder.mjs",
        "validatorDoesNotRunRetrievalDraftReviewReceiptBuilder",
        "validatorDoesNotRunRuleDslValidation",
        "high_reasoning_logic_contract_repair_after_tlcl_rag_confirmed_retrieval_draft_result"
      ]) &&
      hasAll(files.tlclRagConfirmedRetrievalDraftResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_smoke_v1",
        "TLCL RAG confirmed retrieval draft result validation prepares review receipt handoff",
        "TLCL RAG confirmed retrieval draft result validation blocks forbidden review receipt builder runs",
        "TLCL RAG confirmed retrieval draft result validation can route correction back to high reasoning repair"
      ]) &&
      hasAll(files.mcpServer, [
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt_builder",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_confirmed_retrieval_draft_result_receipt"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "MCP advanced mode builds TLCL RAG confirmed retrieval draft result receipt",
        "MCP advanced mode validates TLCL RAG confirmed retrieval draft result receipt",
        "Default teach_apprentice builds TLCL RAG confirmed retrieval draft result receipt",
        "Default teach_apprentice validates TLCL RAG confirmed retrieval draft result receipt",
        "advancedNames.length === 363"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-confirmed-retrieval-draft-result-receipt"
      ]),
    evidence:
      "confirmed retrieval draft runs now return through TLCL before any detailed retrieval-draft review receipt builder or Rule DSL validation handoff"
  },
  {
    requirement: "Returns retrieval draft review validation through TLCL before Rule DSL validation package follow-up",
    pass:
      hasAll(files.readme, [
        "Current TLCL RAG retrieval-draft review-validation result return update",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt-builder.mjs",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt.mjs"
      ]) &&
      hasAll(files.tlclRagRetrievalDraftReviewValidationResultReceiptBuilder, [
        "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
        "builderDoesNotRunRuleDslValidationPackage",
        "approvedDraftRows",
        "draft_disabled"
      ]) &&
      hasAll(files.tlclRagRetrievalDraftReviewValidationResultReceiptValidation, [
        "tlcl_rag_retrieval_draft_review_validation_ready_for_rule_dsl_validation_package",
        "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
        "validatorDoesNotRunRuleDslValidationPackage",
        "teacherConfirmedNoRuleEnablement",
        "high_reasoning_logic_contract_repair_after_tlcl_rag_retrieval_draft_review_validation_result"
      ]) &&
      hasAll(files.tlclRagRetrievalDraftReviewValidationResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_smoke_v1",
        "TLCL RAG retrieval draft review validation result prepares Rule DSL validation package handoff",
        "TLCL RAG retrieval draft review validation result blocks forbidden Rule DSL package runs",
        "TLCL RAG retrieval draft review validation result can route correction back to high reasoning repair"
      ]) &&
      hasAll(files.mcpServer, [
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt_builder",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_retrieval_draft_review_validation_result_receipt"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "MCP advanced mode builds TLCL RAG retrieval draft review validation result receipt",
        "MCP advanced mode validates TLCL RAG retrieval draft review validation result receipt",
        "Default teach_apprentice builds TLCL RAG retrieval draft review validation result receipt",
        "Default teach_apprentice validates TLCL RAG retrieval draft review validation result receipt",
        "advancedNames.length === 363"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-retrieval-draft-review-validation-result-receipt"
      ]),
    evidence:
      "retrieval draft review validations now return through TLCL before any Rule DSL validation package handoff"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source registry follow-up",
    pass:
      hasAll(files.ragConfirmedSourceRegistryPackage, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "nextReview",
        "RAG_CONFIRMED_SOURCE_REGISTRY_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_CONFIRMED_SOURCE_REGISTRY_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_CONFIRMED_SOURCE_REGISTRY_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH"
      ]) &&
      hasAll(files.ragPrimarySourceRegistryLogicContextSmoke, [
        "transparent_ai_rag_primary_source_registry_logic_context_smoke_v1",
        "Primary-source registry should preserve upstream planning logic hints",
        "Primary-source registry should preserve confirmed upstream logic evidence reviews",
        "Primary-source registry should expose the planning logic evidence hash for next review",
        "Primary-source registry must reject tampered validation planning logic evidence",
        "Primary-source registry must reject tampered validation next-review planning logic evidence",
        "Primary-source registry must reject tampered validation next-review planning logic evidence hash"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source registry planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-registry-logic-context",
        "smoke-rag-primary-source-registry-logic-context.mjs"
      ]),
    evidence:
      "confirmed primary-source registry packages now retain upstream planning logic evidence for later local ingest review"
  },
  {
    requirement: "Preserves primary-source logic extraction hints through local ingest",
    pass:
      hasAll(files.ragConfirmedLocalIngestRunner, [
        "logicExtractionHint: row.logicExtractionHint",
        "logicExtractionHints",
        "externalFetchPerformed: false",
        "shellCommandExecuted: false"
      ]) &&
      hasAll(files.ragPrimarySourceLocalIngestFollowUpSmoke, [
        "transparent_ai_rag_primary_source_local_ingest_follow_up_smoke_v1",
        "Primary-source local ingest should preserve the source logic extraction hint",
        "Primary-source local ingest should expose logic extraction hints for next review",
        "Primary-source local ingest must reject missing teacher-reviewed flag"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice runs RAG primary-source confirmed local ingest"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-local-ingest-follow-up",
        "smoke-rag-primary-source-local-ingest-follow-up.mjs"
      ]),
    evidence:
      "primary-source registry rows now enter local ingest with teacher logic hints preserved for retrieval and disabled Rule Card drafting review"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source local ingest",
    pass:
      hasAll(files.ragConfirmedLocalIngestRunner, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "nextReview",
        "RAG_CONFIRMED_LOCAL_INGEST_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_CONFIRMED_LOCAL_INGEST_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_CONFIRMED_LOCAL_INGEST_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH"
      ]) &&
      hasAll(files.ragPrimarySourceLocalIngestLogicContextSmoke, [
        "transparent_ai_rag_primary_source_local_ingest_logic_context_smoke_v1",
        "Primary-source local ingest should preserve upstream planning logic hints",
        "Primary-source local ingest should preserve confirmed upstream logic evidence reviews",
        "Primary-source local ingest should expose the planning logic evidence hash for retrieval review",
        "Primary-source local ingest must reject tampered registry planning logic evidence",
        "Primary-source local ingest must reject tampered registry next-review planning logic evidence",
        "Primary-source local ingest must reject tampered registry next-review planning logic evidence hash"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source local ingest planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-local-ingest-logic-context",
        "smoke-rag-primary-source-local-ingest-logic-context.mjs"
      ]),
    evidence:
      "primary-source local ingest run packets now retain upstream confirmed planning logic evidence"
  },
  {
    requirement: "Preserves primary-source logic extraction hints through retrieval draft",
    pass:
      hasAll(files.ragConfirmedRetrievalDraftRunner, [
        "logicExtractionHint: row.logicExtractionHint",
        "logicExtractionHints",
        "draft_disabled",
        "externalFetchPerformed: false",
        "shellCommandExecuted: false"
      ]) &&
      hasAll(files.ragPrimarySourceRetrievalDraftFollowUpSmoke, [
        "transparent_ai_rag_primary_source_retrieval_draft_follow_up_smoke_v1",
        "Primary-source retrieval draft should preserve the source logic extraction hint",
        "Primary-source retrieval draft should expose logic extraction hints for next review",
        "Primary-source retrieval draft must keep Rule Cards draft_disabled"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice runs RAG primary-source confirmed retrieval draft"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-retrieval-draft-follow-up",
        "smoke-rag-primary-source-retrieval-draft-follow-up.mjs"
      ]),
    evidence:
      "primary-source local corpora now retain teacher logic hints through retrieval evidence and draft_disabled Rule Card generation review"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source retrieval draft",
    pass:
      hasAll(files.ragConfirmedRetrievalDraftRunner, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "RAG_CONFIRMED_RETRIEVAL_DRAFT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_CONFIRMED_RETRIEVAL_DRAFT_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_CONFIRMED_RETRIEVAL_DRAFT_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH",
        "nextReview"
      ]) &&
      hasAll(files.ragPrimarySourceRetrievalDraftLogicContextSmoke, [
        "transparent_ai_rag_primary_source_retrieval_draft_logic_context_smoke_v1",
        "Primary-source retrieval draft should preserve upstream planning logic hints",
        "Primary-source retrieval draft should preserve confirmed upstream logic evidence reviews",
        "Primary-source retrieval draft should expose the planning logic evidence hash for review",
        "Primary-source retrieval draft must reject tampered ingest planning logic evidence",
        "Primary-source retrieval draft must reject tampered ingest next-review planning logic evidence",
        "Primary-source retrieval draft must reject tampered ingest next-review planning logic evidence hash"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source retrieval draft planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-retrieval-draft-logic-context",
        "smoke-rag-primary-source-retrieval-draft-logic-context.mjs"
      ]),
    evidence:
      "primary-source retrieval draft run packets now retain upstream confirmed planning logic evidence"
  },
  {
    requirement: "Requires teacher logic-fit review before primary-source Rule DSL validation",
    pass:
      hasAll(files.ragConfirmedRetrievalDraftReviewReceiptBuilder, [
        "logicExtractionHintReviewed",
        "logicFitDecision",
        "allowedLogicFitDecisions"
      ]) &&
      hasAll(files.ragConfirmedRetrievalDraftReviewReceiptValidation, [
        "LOGIC_EXTRACTION_HINT_MISMATCH",
        "APPROVED_ROW_REQUIRES_LOGIC_EXTRACTION_HINT_REVIEW",
        "APPROVED_ROW_REQUIRES_MATCHING_LOGIC_FIT",
        "logicFitDecision",
        "mayEnableRules: false"
      ]) &&
      hasAll(files.ragPrimarySourceRetrievalDraftReviewReceiptSmoke, [
        "transparent_ai_rag_primary_source_retrieval_draft_review_receipt_smoke_v1",
        "Primary-source review receipt should expose the logic extraction hint",
        "Primary-source review validation must require logic hint review",
        "Primary-source review validation must require matching logic fit"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source retrieval draft review receipt builder",
        "Default teach_apprentice validates RAG primary-source retrieval draft review receipt"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-retrieval-draft-review-receipt",
        "smoke-rag-primary-source-retrieval-draft-review-receipt.mjs"
      ]),
    evidence:
      "primary-source retrieval draft reviews now require teacher confirmation that the disabled draft matches the intended data-to-output logic before Rule DSL validation"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source retrieval draft review receipt",
    pass:
      hasAll(files.ragConfirmedRetrievalDraftReviewReceiptBuilder, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_RETRIEVAL_DRAFT_REVIEW_BUILDER_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH",
        "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_v1"
      ]) &&
      hasAll(files.ragConfirmedRetrievalDraftReviewReceiptValidation, [
        "RETRIEVAL_REVIEW_RUN_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RETRIEVAL_REVIEW_RUN_NEXT_REVIEW_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RETRIEVAL_REVIEW_RUN_NEXT_REVIEW_LOGIC_EVIDENCE_MISMATCH",
        "RETRIEVAL_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "nextReview"
      ]) &&
      hasAll(files.ragPrimarySourceRetrievalDraftReviewLogicContextSmoke, [
        "transparent_ai_rag_primary_source_retrieval_draft_review_logic_context_smoke_v1",
        "Primary-source retrieval review receipt should expose upstream planning logic hints",
        "Primary-source retrieval review validation should preserve planning logic evidence hints",
        "Primary-source retrieval review receipt builder must reject tampered run planning logic evidence",
        "Primary-source retrieval review receipt builder must reject tampered run next-review planning logic evidence",
        "Primary-source retrieval review receipt builder must reject tampered run next-review planning logic evidence hash",
        "Primary-source retrieval review validation must reject tampered run planning logic evidence",
        "Primary-source retrieval review validation must reject tampered run next-review planning logic evidence",
        "Primary-source retrieval review validation must reject tampered run next-review planning logic evidence hash",
        "Primary-source retrieval review validation must reject tampered planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source retrieval draft review planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-retrieval-draft-review-logic-context",
        "smoke-rag-primary-source-retrieval-draft-review-logic-context.mjs"
      ]),
    evidence:
      "primary-source retrieval draft review receipts now retain and hash-check upstream confirmed planning logic evidence"
  },
  {
    requirement: "Carries primary-source logic fit into Rule DSL validation package",
    pass:
      hasAll(files.ragReviewedRuleDslValidationPackage, [
        "RULE_DSL_VALIDATION_REQUIRES_MATCHING_LOGIC_FIT",
        "logicExtractionHint",
        "logicFitDecision",
        "logicExtractionHints",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.ragPrimarySourceRuleDslValidationPackageSmoke, [
        "transparent_ai_rag_primary_source_rule_dsl_validation_package_smoke_v1",
        "Primary-source Rule DSL validation package should preserve the logic extraction hint",
        "Primary-source Rule DSL validation package should preserve the teacher logic-fit decision",
        "Primary-source Rule DSL validation package must reject non-matching logic fit"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source reviewed Rule DSL validation package"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-rule-dsl-validation-package",
        "smoke-rag-primary-source-rule-dsl-validation-package.mjs"
      ]),
    evidence:
      "primary-source disabled drafts now carry teacher-confirmed logic hints into Rule DSL validation and reject tampered non-matching logic fit"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source Rule DSL validation package",
    pass:
      hasAll(files.ragReviewedRuleDslValidationPackage, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "RULE_DSL_VALIDATION_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RULE_DSL_VALIDATION_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RULE_DSL_VALIDATION_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "nextReview"
      ]) &&
      hasAll(files.ragPrimarySourceRuleDslValidationPlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_rule_dsl_validation_planning_logic_context_smoke_v1",
        "Primary-source Rule DSL validation package should preserve upstream planning logic hints",
        "Primary-source Rule DSL validation package should expose the planning logic evidence hash for next review",
        "Primary-source Rule DSL validation package must reject tampered planning logic evidence",
        "Primary-source Rule DSL validation package must reject tampered next-review planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source Rule DSL validation planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-rule-dsl-validation-planning-logic-context",
        "smoke-rag-primary-source-rule-dsl-validation-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source Rule DSL validation packages now retain and hash-check upstream confirmed planning logic evidence"
  },
  {
    requirement: "Carries primary-source logic fit through Rule DSL review receipt",
    pass:
      hasAll(files.ragReviewedRuleDslReviewReceiptBuilder, [
        "logicExtractionHint",
        "logicFitDecision",
        "logicExtractionHintReviewed",
        "logicFitDecisionReviewed"
      ]) &&
      hasAll(files.ragReviewedRuleDslReviewReceiptValidation, [
        "LOGIC_EXTRACTION_HINT_MISMATCH",
        "LOGIC_FIT_DECISION_MISMATCH",
        "APPROVED_ROW_REQUIRES_LOGIC_EXTRACTION_HINT_REVIEW",
        "APPROVED_ROW_REQUIRES_LOGIC_FIT_DECISION_REVIEW",
        "APPROVED_ROW_REQUIRES_MATCHING_LOGIC_FIT",
        "logicExtractionHints",
        "mayEnableRules: false"
      ]) &&
      hasAll(files.ragPrimarySourceRuleDslReviewReceiptSmoke, [
        "transparent_ai_rag_primary_source_rule_dsl_review_receipt_smoke_v1",
        "Primary-source Rule DSL review receipt template should preserve the logic extraction hint",
        "Primary-source Rule DSL review receipt validation must require teacher review of the logic extraction hint",
        "Primary-source Rule DSL review receipt validation must reject tampered logic-fit decisions"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice creates RAG primary-source Rule DSL review receipt builder",
        "Default teach_apprentice validates RAG primary-source Rule DSL review receipt"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-rule-dsl-review-receipt",
        "smoke-rag-primary-source-rule-dsl-review-receipt.mjs"
      ]),
    evidence:
      "primary-source logic hints now survive the human Rule DSL review receipt and require teacher-confirmed logic review before disabled package planning"
  },
  {
    requirement: "Preserves planning logic evidence through primary-source Rule DSL review receipt",
    pass:
      hasAll(files.ragReviewedRuleDslReviewReceiptBuilder, [
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RAG_RULE_DSL_REVIEW_BUILDER_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "transparent_ai_rag_reviewed_rule_dsl_review_receipt_v1"
      ]) &&
      hasAll(files.ragReviewedRuleDslReviewReceiptValidation, [
        "RULE_DSL_REVIEW_PACKAGE_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RULE_DSL_REVIEW_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RULE_DSL_REVIEW_PACKAGE_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "RULE_DSL_REVIEW_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH",
        "RULE_DSL_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH",
        "planningLogicEvidence",
        "planningLogicEvidenceHash",
        "nextReview"
      ]) &&
      hasAll(files.ragPrimarySourceRuleDslReviewPlanningLogicContextSmoke, [
        "transparent_ai_rag_primary_source_rule_dsl_review_planning_logic_context_smoke_v1",
        "Primary-source Rule DSL review receipt should preserve upstream planning logic hints",
        "Primary-source Rule DSL review validation should preserve planning logic evidence hints",
        "Primary-source Rule DSL review receipt builder must reject tampered package planning logic evidence",
        "Primary-source Rule DSL review validation must reject tampered next-review package planning logic evidence",
        "Primary-source Rule DSL review validation must reject tampered planning logic evidence"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice preserves RAG primary-source Rule DSL review receipt planning context"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-rag-primary-source-rule-dsl-review-planning-logic-context",
        "smoke-rag-primary-source-rule-dsl-review-planning-logic-context.mjs"
      ]),
    evidence:
      "primary-source Rule DSL review receipts now retain and hash-check upstream confirmed planning logic evidence"
  },
  {
    requirement: "Grounds compact low-token learning events with knowledge-augmented RAG evidence",
    pass:
      hasAll(files.knowledgeAugmentedLowTokenLearningBridge, [
        "transparent_ai_knowledge_augmented_low_token_learning_v1",
        "collectCompactEvents",
        "retrieveFromCorpus",
        "draftRuleCardFromRetrieval",
        "fullLogRead: false",
        "screenshotsCaptured: false",
        "softwareActionsExecuted: false",
        "ruleEnabled: false",
        "accepted: false",
        "packagingGated: true",
        "forbiddenDecisions"
      ]) &&
      hasAll(files.knowledgeAugmentedLowTokenLearningSmoke, [
        "transparent_ai_knowledge_augmented_low_token_learning_smoke_v1",
        "augment-low-token-learning-with-retrieval.mjs",
        "RAG must not enable rules",
        "Bridge must not read full logs",
        "Bridge must not execute software",
        "draft_disabled"
      ]) &&
      hasAll(files.mcp, [
        "augment_low_token_learning_with_retrieval",
        "knowledgeAugmentedLowTokenLearningRequested",
        "knowledgeAugmentedLowTokenLearning",
        "knowledge/augment-low-token-learning-with-retrieval.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice routes knowledge-augmented low-token learning retrieval bridge",
        "MCP advanced mode exposes and runs knowledge-augmented low-token learning retrieval bridge",
        "advancedNames.length === 363"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-knowledge-augmented-low-token-learning"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-knowledge-augmented-low-token-learning.mjs"),
    evidence:
      "compact learning events can now be enriched by retrieved source chunks and disabled rule drafts through CLI smoke and advanced MCP while full logs, continuous recording, screenshots, software execution, memory, rule enablement, and packaging remain locked"
  },
  {
    requirement: "Combines knowledge-augmented low-token evidence with transparent sketch spatial execution routes before dry-run",
    pass:
      hasAll(files.knowledgeAugmentedSpatialExecutionBridge, [
        "transparent_ai_knowledge_augmented_spatial_execution_bridge_v1",
        "knowledgeAugmentedLearningPath",
        "spatialRouteBridgePath",
        "selectedTarget",
        "reviewRows",
        "execute_without_teacher_reviewed_knowledge_grounding",
        "execute_with_missing_detail_logic",
        "fullLogRead: false",
        "screenshotsCaptured: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false",
        "packagingGated: true"
      ]) &&
      hasAll(files.knowledgeAugmentedSpatialExecutionBridgeSmoke, [
        "transparent_ai_knowledge_augmented_spatial_execution_bridge_smoke_v1",
        "Knowledge-augmented spatial bridge combines retrieval events with confirmed spatial route",
        "Bridge preserves strict low-token and execution locks",
        "Review rows require teacher grounding before dry-run route"
      ]) &&
      hasAll(files.mcp, [
        "create_knowledge_augmented_spatial_execution_bridge",
        "knowledgeAugmentedSpatialExecutionBridgeRequested",
        "knowledgeAugmentedSpatialExecutionBridge",
        "create-knowledge-augmented-spatial-execution-bridge.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "Default teach_apprentice routes knowledge-augmented spatial execution bridge",
        "MCP advanced mode exposes and runs knowledge-augmented spatial execution bridge",
        "advancedNames.length === 363"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-knowledge-augmented-spatial-execution-bridge"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-knowledge-augmented-spatial-execution-bridge.mjs"),
    evidence:
      "retrieved low-token evidence, selected numbered transparent sketch target, spatial detail logic, route candidates, and teacher review rows now meet in one pre-dry-run bridge while full logs, screenshots, execution, memory, rules, and packaging remain locked"
  },
  {
    requirement: "Uses high reasoning for contract compilation, medium reasoning for reviewed runtime, and senior escalation after correction",
    pass:
      hasAll(files.readme, [
        "create-tlcl-status-refresh",
        "create-tlcl-reasoning-budget-governor",
        "validate-tlcl-reasoning-budget-governor-review-receipt",
        "create-tlcl-reasoning-budget-medium-reuse-handoff",
        "create-tlcl-runtime-gate",
        "create-tlcl-medium-runtime-dry-run-prep",
        "create-tlcl-medium-runtime-dry-run-prep-review-receipt-builder",
        "validate-tlcl-medium-runtime-dry-run-prep-review-receipt",
        "create-tlcl-medium-runtime-dry-run-route-review-handoff",
        "create-tlcl-medium-runtime-dry-run-route-review-receipt-builder",
        "validate-tlcl-medium-runtime-dry-run-route-review-receipt",
        "run-tlcl-medium-runtime-dry-run-only-runner",
        "create-tlcl-medium-runtime-dry-run-only-post-run-receipt-builder",
        "validate-tlcl-medium-runtime-dry-run-only-post-run-receipt",
        "run-tlcl-medium-runtime-execution-approval-gate-prep-runner",
        "create-tlcl-medium-runtime-approved-gate-command-builder",
        "run-tlcl-medium-runtime-approved-gate-runner",
        "create_tlcl_status_refresh",
        "create_tlcl_reasoning_budget_governor",
        "validate_tlcl_reasoning_budget_governor_review_receipt",
        "create_tlcl_reasoning_budget_medium_reuse_handoff",
        "create_tlcl_runtime_gate",
        "create_tlcl_medium_runtime_dry_run_prep",
        "create_tlcl_medium_runtime_dry_run_prep_review_receipt_builder",
        "validate_tlcl_medium_runtime_dry_run_prep_review_receipt",
        "create_tlcl_medium_runtime_dry_run_route_review_handoff",
        "create_tlcl_medium_runtime_dry_run_route_review_receipt_builder",
        "validate_tlcl_medium_runtime_dry_run_route_review_receipt",
        "run_tlcl_medium_runtime_dry_run_only_runner",
        "create_tlcl_medium_runtime_dry_run_only_post_run_receipt_builder",
        "validate_tlcl_medium_runtime_dry_run_only_post_run_receipt",
        "run_tlcl_medium_runtime_execution_approval_gate_prep_runner",
        "create_tlcl_medium_runtime_approved_gate_command_builder",
        "run_tlcl_medium_runtime_approved_gate_runner",
        "create_tlcl_capability_provider_intake",
        "create_tlcl_capability_provider_qualification_plan",
        "run_tlcl_capability_provider_qualification_no_action_runner",
        "validate_tlcl_capability_provider_qualification_result_receipt",
        "create_tlcl_capability_provider_activation_review_candidate_builder",
        "validate_tlcl_capability_provider_activation_review_receipt",
        "medium_runtime_allowed",
        "escalate_to_senior_compile",
        "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1",
        "transparent_ai_tlcl_medium_runtime_dry_run_route_review_handoff_v1",
        "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_validation_v1",
        "transparent_ai_tlcl_medium_runtime_dry_run_only_run_v1",
        "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_validation_v1",
        "teacher_reviewed_route_ready_for_dry_run",
        "route_reviewed_ready_for_dry_run_only_runner",
        "dry_run_matched_expected",
        "executionApprovalGateCreated=false",
        "prepRunnerDoesNotInvokeExecutionRunner=true",
        "wrapperDoesNotRunApprovedGate=true",
        "adapterInvoked=false",
        "executesNow=false",
        "mismatches or unknowns block provider enablement",
        "transparent_ai_tlcl_capability_provider_card_v1",
        "highest-reasoning models learn, repair, and compile",
        "medium-reasoning runtimes execute already-confirmed workflows"
      ]) &&
      hasAll(files.fullTargetDirectionTaskList, [
        "Senior Model Compiler / Medium Runtime",
        "Medium Reasoning Runtime",
        "Low Reasoning Tool Layer",
        "TLCL Runtime Gate",
        "Senior Model Rule Compiler",
        "Claude/GPT/Gemini",
        "TLCL pipeline"
      ]) &&
      hasAll(files.tlclOverallDirection, [
        "Senior Model Rule Compiler",
        "Medium Reasoning Runtime",
        "Low Reasoning Tool Layer",
        "TLCL Runtime Gate",
        "Claude, GPT, Gemini",
        "Distilled skills and stronger model releases are handled as replaceable capability providers",
        "cannot bypass the contract lifecycle"
      ]) &&
      hasAll(files.reasoningTierContractSchema, [
        "transparent_ai_reasoning_tier_contract_v1",
        "senior_reasoning_compile",
        "medium_reasoning_runtime",
        "low_reasoning_tool",
        "teacher_correction",
        "deterministic_validator"
      ]) &&
      hasAll(files.tlclRuntimeGateSchema, [
        "transparent_ai_tlcl_runtime_gate_v1",
        "medium_runtime_allowed",
        "escalate_to_senior_compile",
        "canExecuteTargetSoftware",
        "teacher_correction"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunPrepSchema, [
        "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1",
        "medium_runtime_dry_run_prep_ready_for_teacher_review",
        "blocked_escalate_to_senior_compile",
        "providerRoleUsePlanHash",
        "canExecuteTargetSoftware"
      ]) &&
      hasAll(files.tlclStatusRefresh, [
        "transparent_ai_tlcl_status_refresh_v1",
        "highest_reasoning_compile_medium_runtime",
        "correction_returns_to_senior",
        "rag_external_knowledge_retriever",
        "foundation_model_response",
        "skill_distillation_response",
        "transparent_ai_tlcl_market_response_policy_v1",
        "distilled_skill_or_low_cost_model_direct",
        "distilledSkillMayBypassContractLifecycle",
        "providerMayExecuteTargetSoftwareWithoutGate",
        "providerMayUnlockPackaging",
        "noCompletionClaim"
      ]) &&
      hasAll(files.tlclReasoningBudgetGovernor, [
        "transparent_ai_tlcl_reasoning_budget_governor_v1",
        "allow_medium_reasoning_runtime_reuse",
        "route_to_highest_reasoning_contract_compile_or_repair",
        "highest_cost_only_when_learning_or_repairing",
        "allowed_for_confirmed_workflow_reuse_only",
        "rag_authority_to_runtime",
        "medium_reasoning_rule_compilation",
        "doesNotInvokeModel: true",
        "doesNotExecuteTargetSoftware: true"
      ]) &&
      hasAll(files.tlclReasoningBudgetGovernorSmoke, [
        "transparent_ai_tlcl_reasoning_budget_governor_smoke_v1",
        "Confirmed workflow can use medium reasoning runtime",
        "Teacher correction and validator unknown escalate back to high reasoning",
        "High reasoning cannot be used as a direct runtime shortcut",
        "Medium reasoning cannot compile or repair the normative contract",
        "RAG evidence cannot authorize medium runtime"
      ]) &&
      hasAll(files.tlclReasoningBudgetGovernorReviewReceiptValidation, [
        "transparent_ai_tlcl_reasoning_budget_governor_review_validation_v1",
        "reasoning_budget_governor_confirmed_for_next_gate",
        "reasoning_budget_governor_review_escalate_to_high_reasoning_repair",
        "forbidden_teacher_review_decision",
        "doesNotInvokeModel: true",
        "doesNotRunMediumRuntime: true"
      ]) &&
      hasAll(files.tlclReasoningBudgetGovernorReviewReceiptSmoke, [
        "transparent_ai_tlcl_reasoning_budget_governor_review_receipt_smoke_v1",
        "Confirmed governor receipt prepares only the next reviewed gate",
        "Teacher correction routes back to high-reasoning repair",
        "Forbidden receipt decision fails closed"
      ]) &&
      hasAll(files.tlclReasoningBudgetMediumReuseHandoff, [
        "transparent_ai_tlcl_reasoning_budget_medium_reuse_handoff_v1",
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_context_v1",
        "reasoningBudgetGovernorReviewTrace",
        "doesNotRunMediumRuntime: true",
        "doesNotExecuteTargetSoftware: true"
      ]) &&
      hasAll(files.tlclReasoningBudgetMediumReuseHandoffSmoke, [
        "transparent_ai_tlcl_reasoning_budget_medium_reuse_handoff_smoke_v1",
        "Confirmed reasoning budget review becomes a medium reuse context",
        "Planner carries reasoning budget trace into the bounded invocation plan",
        "Reasoning budget trace survives reusable workflow approval prep command builder and approved runner",
        "Unconfirmed governor review validation blocks before medium reuse context"
      ]) &&
      hasAll(files.tlclCapabilityProviderIntake, [
        "transparent_ai_tlcl_capability_provider_intake_v1",
        "tlcl_capability_provider_candidate_waiting_for_teacher_review",
        "blocked_before_tlcl_capability_provider_teacher_review",
        "provider_claims_contract_bypass",
        "provider_claims_target_execution_without_gate",
        "provider_claims_packaging_unlock",
        "mayBeUsedAsSeniorCompiler: false"
      ]) &&
      hasAll(files.tlclCapabilityProviderIntakeSmoke, [
        "transparent_ai_tlcl_capability_provider_intake_smoke_v1",
        "Distilled skill enters only teacher-review provider intake",
        "Strong model enters only senior-compiler candidate review",
        "Provider bypass claims block intake before teacher review"
      ]) &&
      hasAll(files.tlclCapabilityProviderQualificationPlan, [
        "transparent_ai_tlcl_capability_provider_qualification_plan_v1",
        "tlcl_capability_provider_qualification_plan_waiting_for_test_review",
        "blocked_before_tlcl_capability_provider_qualification_plan",
        "missing_teacher_reviewed_candidate_flag",
        "senior_compile.teacher_correction_to_disabled_rule_card",
        "low_tool.missing_field_to_unknown",
        "providerEnabled: false"
      ]) &&
      hasAll(files.tlclCapabilityProviderQualificationPlanSmoke, [
        "transparent_ai_tlcl_capability_provider_qualification_plan_smoke_v1",
        "Senior provider qualification plan creates review-only compiler tests",
        "Qualification plan requires teacher-reviewed candidate evidence",
        "Blocked provider intake cannot create qualification tests"
      ]) &&
      hasAll(files.tlclCapabilityProviderQualificationNoActionRunner, [
        "transparent_ai_tlcl_capability_provider_qualification_no_action_run_v1",
        "tlcl_capability_provider_qualification_no_action_run_waiting_for_result_receipts",
        "blocked_before_tlcl_capability_provider_qualification_no_action_run",
        "missing_teacher_reviewed_test_plan_flag",
        "providerInvocationStatus: \"not_invoked\"",
        "transparent_ai_tlcl_capability_provider_qualification_result_template_v1",
        "providerInvoked: false"
      ]) &&
      hasAll(files.tlclCapabilityProviderQualificationNoActionRunnerSmoke, [
        "transparent_ai_tlcl_capability_provider_qualification_no_action_runner_smoke_v1",
        "Qualification no-action runner creates result template without invoking provider",
        "Qualification result template defaults to not-run review states",
        "Blocked qualification plan cannot be converted into run rows"
      ]) &&
      hasAll(files.tlclCapabilityProviderQualificationResultReceipt, [
        "transparent_ai_tlcl_capability_provider_qualification_result_validation_v1",
        "tlcl_capability_provider_qualification_results_ready_for_validator_review",
        "tlcl_capability_provider_qualification_results_blocked_before_provider_enablement",
        "tlcl_capability_provider_qualification_results_waiting_for_more_evidence",
        "blocked_before_tlcl_capability_provider_qualification_result_validation",
        "receipt_source_run_hash_mismatch",
        "forbidden_overall_decision",
        "mayEnableProvider: false"
      ]) &&
      hasAll(files.tlclCapabilityProviderQualificationResultReceiptSmoke, [
        "transparent_ai_tlcl_capability_provider_qualification_result_receipt_smoke_v1",
        "Matched receipt becomes ready for later validator review but keeps provider disabled",
        "Mismatch and unknown receipt blocks provider enablement before reuse",
        "Tampered source hash or row identity fails closed"
      ]) &&
      hasAll(files.tlclCapabilityProviderActivationReviewCandidateBuilder, [
        "transparent_ai_tlcl_capability_provider_activation_review_candidate_v1",
        "tlcl_capability_provider_activation_review_candidate_ready_for_teacher_approval",
        "transparent_ai_tlcl_capability_provider_activation_review_receipt_v1",
        "providerCapabilityCardIssued: false"
      ]) &&
      hasAll(files.tlclCapabilityProviderActivationReviewReceiptValidation, [
        "transparent_ai_tlcl_capability_provider_activation_validation_v1",
        "tlcl_capability_provider_role_approved_waiting_for_gated_use",
        "transparent_ai_tlcl_capability_provider_card_v1",
        "provider_activation_review_to_high_reasoning_repair",
        "providerMayExecuteTargetSoftware: false",
        "bypass_contract"
      ]) &&
      hasAll(files.tlclCapabilityProviderActivationReviewSmoke, [
        "transparent_ai_tlcl_capability_provider_activation_review_smoke_v1",
        "Teacher activation approval issues only a TLCL role-scoped provider card",
        "Teacher correction routes provider activation back to high reasoning repair",
        "Forbidden provider activation decision fails closed"
      ]) &&
      hasAll(files.tlclCapabilityProviderRoleUsePlanner, [
        "transparent_ai_tlcl_capability_provider_role_use_plan_v1",
        "tlcl_capability_provider_role_use_ready_for_runtime_gate",
        "tlcl_capability_provider_role_use_blocked_role_mismatch",
        "blocked_before_tlcl_capability_provider_role_use_plan",
        "provider_role_use_mismatch_to_high_reasoning_repair",
        "providerMayExecuteTargetSoftware: false"
      ]) &&
      hasAll(files.tlclCapabilityProviderRoleUsePlannerSmoke, [
        "transparent_ai_tlcl_capability_provider_role_use_planner_smoke_v1",
        "Approved provider card becomes only a role-use plan for the next TLCL runtime gate",
        "Requested role mismatch is blocked and routed to high reasoning repair",
        "Missing TLCL status refresh blocks role-use planning"
      ]) &&
      hasAll(files.tlclRuntimeGate, [
        "transparent_ai_tlcl_runtime_gate_v1",
        "medium_runtime_allowed",
        "escalate_to_senior_compile",
        "validator_unknown",
        "teacher_correction",
        "provider_role_use_plan_not_medium_runtime",
        "providerRoleUsePlanAccepted",
        "canExecuteTargetSoftware: false"
      ]) &&
      hasAll(files.tlclRuntimeGateProviderRolePlanSmoke, [
        "transparent_ai_tlcl_runtime_gate_provider_role_plan_smoke_v1",
        "Medium provider role-use plan is accepted by runtime gate",
        "Low-reasoning tool role-use plan cannot enter medium runtime gate",
        "Invalid provider role-use source fails closed before runtime"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunPrep, [
        "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1",
        "medium_runtime_dry_run_prep_ready_for_teacher_review",
        "waiting_for_teacher_confirmed_route_evidence",
        "teacher_correction_requires_senior_compile",
        "provider_role_use_plan_not_accepted_by_runtime_gate",
        "providerRoleUsePlanAccepted",
        "providerRoleUsePlanHash",
        "canExecuteTargetSoftware: false"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunPrepReviewReceiptBuilder, [
        "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_receipt_builder_v1",
        "teacher_reviewed_route_ready_for_dry_run",
        "correction_to_senior_compile",
        "execute_target_software_from_receipt_builder"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunPrepReviewReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_validation_v1",
        "ready_for_separate_dry_run_route_review",
        "blocked_for_forbidden_decision",
        "senior_reasoning_compile",
        "if (forbiddenDecisionUsed) process.exit(1)"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunRouteReviewHandoff, [
        "transparent_ai_tlcl_medium_runtime_dry_run_route_review_handoff_v1",
        "dry_run_route_review_handoff_ready",
        "senior_compile_repair_handoff_ready",
        "blocked_for_forbidden_decision",
        "providerRoleUsePlanTrace",
        "providerRoleUsePlanHash",
        "executesNow: false"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunRouteReviewReceiptBuilder, [
        "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_builder_v1",
        "route_reviewed_ready_for_dry_run_only_runner",
        "run_dry_run_only_runner_from_route_review_builder"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunRouteReviewReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_validation_v1",
        "ready_for_separate_dry_run_only_runner",
        "blocked_for_forbidden_decision",
        "run_dry_run_only_runner_from_validation",
        "providerRoleUsePlanTrace",
        "providerRoleUsePlanHash",
        "if (forbiddenDecisionUsed) process.exit(1)"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunOnlyRunner, [
        "transparent_ai_tlcl_medium_runtime_dry_run_only_run_v1",
        "transparent_ai_tlcl_medium_runtime_dry_run_only_runner_result_v1",
        "dry_run_only_runner_completed_waiting_for_teacher_review",
        "blocked_before_dry_run_only_runner",
        "adapterInvoked: false",
        "providerRoleUsePlanTrace",
        "providerRoleUsePlanHash",
        "doesNotInvokeAdapter: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunOnlyPostRunReceiptBuilder, [
        "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_builder_v1",
        "dry_run_matched_expected",
        "create_execution_approval_gate_from_builder"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunOnlyPostRunReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_validation_v1",
        "ready_for_execution_approval_gate_planning",
        "blocked_for_forbidden_decision",
        "executionApprovalGateCreated: false",
        "if (forbiddenDecisionUsed) process.exit(1)"
      ]) &&
      hasAll(files.tlclMediumRuntimeExecutionApprovalGatePrepRunner, [
        "transparent_ai_tlcl_medium_runtime_execution_approval_gate_prep_runner_v1",
        "ready_for_execution_approval_gate_planning",
        "create-real-local-execution-approval-gate.mjs",
        "blocked_before_execution_approval_gate",
        "prepRunnerDoesNotInvokeExecutionRunner: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeApprovedGateCommandBuilder, [
        "transparent_ai_tlcl_medium_runtime_approved_gate_command_builder_v1",
        "create-all-software-execution-approved-gate-command-builder.mjs",
        "tlcl_approved_gate_command_builder_ready_for_teacher_final_confirmation",
        "blocked_before_tlcl_approved_gate_command_builder",
        "wrapperDoesNotRunApprovedGate: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeApprovedGateRunner, [
        "transparent_ai_tlcl_medium_runtime_approved_gate_runner_v1",
        "run-all-software-execution-approved-gate-runner.mjs",
        "blocked_before_tlcl_approved_gate_runner",
        "tlcl_approved_gate_controlled_route_completed_waiting_for_teacher_review",
        "allSoftwareExecutionComplete: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.tlclMediumRuntimeApprovedGateOutcomeReviewReceiptBuilder, [
        "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_builder_v1",
        "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_v1",
        "doesNotRunApprovedGate: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeApprovedGateOutcomeReviewReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_validation_v1",
        "high_reasoning_repair_handoff",
        "medium_runtime_execution_result_to_high_reasoning_contract_repair",
        "execution_outcome_matched_contract_waiting_for_rule_activation_review"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowCandidateBuilder, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_candidate_v1",
        "reusable_workflow_candidate_ready_for_teacher_activation_review",
        "doesNotEnableWorkflow: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowActivationValidation, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_validation_v1",
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_card_v1",
        "medium_runtime_workflow_reuse_allowed_for_bounded_contract",
        "reusable_workflow_candidate_to_high_reasoning_contract_repair"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationPlanner, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_plan_v1",
        "medium_runtime_reuse_invocation_ready_for_approval_gate_planning",
        "workflow_fingerprint_mismatch_requires_high_reasoning_repair",
        "reusable_workflow_invocation_to_high_reasoning_contract_repair",
        "doesNotRunWorkflow: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovalGatePrepRunner, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approval_gate_prep_runner_v1",
        "create-real-local-execution-approval-gate.mjs",
        "reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review",
        "blocked_before_reusable_workflow_invocation_approval_gate",
        "prepRunnerDoesNotInvokeExecutionRunner: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateCommandBuilder, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_command_builder_v1",
        "create-all-software-execution-approved-gate-command-builder.mjs",
        "reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation",
        "blocked_before_reusable_workflow_invocation_approved_gate_command_builder",
        "wrapperDoesNotRunApprovedGate: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateRunner, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_v1",
        "run-all-software-execution-approved-gate-runner.mjs",
        "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review",
        "blocked_before_reusable_workflow_approved_gate_runner",
        "oneApprovedGateOnly: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptBuilder, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_v1",
        "create-tlcl-medium-runtime-approved-gate-outcome-review-receipt-builder.mjs",
        "reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
        "validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs",
        "reusable_workflow_invocation_to_high_reasoning_contract_repair",
        "blocked_for_forbidden_reusable_workflow_outcome_review_decision"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairIntake, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_v1",
        "reusable_workflow_high_reasoning_repair_intake_ready",
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
        "rag_informed_repair_intake_treats_rag_as_authority",
        "mediumRuntimeContinuationBlocked: true",
        "highest-reasoning TLCL compiler"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftPackage, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package_v1",
        "reusable_workflow_high_reasoning_repair_draft_package_ready_for_teacher_review",
        "rag_informed_repair_draft_treats_rag_as_authority",
        "treat_rag_as_authority_from_draft_package",
        "draft_disabled",
        "compile-rule-package.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftReviewValidation, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_validation_v1",
        "reusable_workflow_repair_draft_ready_for_deterministic_regression_validation",
        "blocked_for_forbidden_repair_draft_review_decision",
        "rag_informed_repair_draft_review_non_authority_not_confirmed",
        "mediumRuntimeContinuationBlocked: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairRegressionValidationPackage, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_regression_validation_package_v1",
        "reusable_workflow_repair_regression_validation_ready_for_fingerprint_review",
        "rag_informed_regression_validation_treats_rag_as_authority",
        "treat_rag_as_authority_from_regression_validation",
        "evaluateRulePackage",
        "draft_disabled_rules_must_appear_as_lifecycle_skipped_rows"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairWorkflowFingerprintReviewValidation, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_validation_v1",
        "reusable_workflow_repair_fingerprint_review_ready_for_approval_gate_rebuild",
        "blocked_for_forbidden_repair_fingerprint_review_decision",
        "rag_informed_fingerprint_review_non_authority_not_confirmed",
        "treat_rag_as_authority_from_fingerprint_review",
        "approvalGateRebuildStillRequired: true",
        "doesNotRebuildApprovalGate: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovalGateRebuildPackage, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approval_gate_rebuild_package_v1",
        "reusable_workflow_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review",
        "blocked_before_reusable_workflow_repair_approval_gate_rebuild",
        "reasoningBudgetGovernorReviewTraceFromInputs",
        "reasoningBudgetGovernorReviewTrace",
        "rag_informed_approval_gate_rebuild_treats_rag_as_authority",
        "treat_rag_as_authority_from_repair_approval_gate_rebuild",
        "run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        "doesNotRunApprovedGateRunner: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateCommandBuilder, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_command_builder_v1",
        "reusable_workflow_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation",
        "blocked_before_reusable_workflow_repair_approved_gate_command_builder",
        "reasoningBudgetGovernorReviewTraceFromRebuild",
        "reasoningBudgetGovernorReviewTrace",
        "rag_informed_repair_command_builder_treats_rag_as_authority",
        "treat_rag_as_authority_from_repair_approved_gate_command_builder",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs",
        "doesNotRunApprovedGateRunner: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateRunner, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_v1",
        "reusable_workflow_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review",
        "blocked_before_reusable_workflow_repair_approved_gate_runner",
        "reasoningBudgetGovernorReviewTraceFromBuilder",
        "reasoningBudgetGovernorReviewTrace",
        "rag_informed_repair_runner_treats_rag_as_authority",
        "supportsRagInformedRepairReuseInvocation",
        "run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs",
        "freshOutcomeReviewRequired: true"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateOutcomeReviewReceiptBuilder, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_builder_v1",
        "reusable_workflow_repair_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use",
        "reasoningBudgetGovernorReviewTraceFromRepairRun",
        "reasoningBudgetGovernorReviewTrace",
        "ragEvidenceNonAuthoritativeReviewed",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateOutcomeReviewReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_validation_v1",
        "reusable_workflow_repair_invocation_outcome_matched_contract_waiting_for_reuse_review",
        "reusable_workflow_repair_invocation_to_high_reasoning_contract_repair",
        "reasoningBudgetGovernorReviewTraceFromRepairRun",
        "reasoningBudgetGovernorReviewTrace",
        "treat_rag_as_authority_from_repair_approved_gate_outcome_review",
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairReuseReviewCandidateBuilder, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_candidate_v1",
        "reusable_workflow_repair_reuse_review_candidate_ready_for_teacher_review",
        "reasoningBudgetGovernorReviewTraceFromValidation",
        "reasoningBudgetGovernorReviewTrace",
        "ragEvidenceNonAuthoritativeConfirmed",
        "create-tlcl-medium-runtime-reusable-workflow-candidate-builder.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairReuseReviewReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_validation_v1",
        "repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning",
        "repaired_reusable_workflow_reuse_review_to_high_reasoning_contract_repair",
        "reasoningBudgetGovernorReviewTraceFromCandidate",
        "reasoningBudgetGovernorReviewTrace",
        "treat_rag_as_authority_from_repair_reuse_review",
        "validate-tlcl-medium-runtime-reusable-workflow-activation-receipt.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationPlanner, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_plan_v1",
        "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning",
        "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs",
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_v1",
        "rag_informed_repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning",
        "reasoningBudgetGovernorReviewTraceFromValidation",
        "reasoningBudgetGovernorReviewTrace",
        "rag_informed_validation_treats_rag_as_authority",
        "repair_reuse_review_not_allowed_for_next_invocation_planning"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovalGatePrepRunner, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner_v1",
        "repaired_reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review",
        "blocked_before_repaired_reusable_workflow_invocation_approval_gate",
        "run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        "reasoningBudgetGovernorReviewTraceFromWrapper",
        "reasoningBudgetGovernorReviewTrace",
        "rag_informed_invocation_treats_rag_as_authority",
        "supportsRagInformedRepairReuseInvocation"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovalGatePrepRunnerSmoke, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner_smoke_v1",
        "Ready repaired reusable workflow invocation prepares an approval gate without executing the runner",
        "Repaired reusable workflow approval gate prep preserves provider role-use trace",
        "Repaired reusable workflow approval gate prep preserves reasoning budget trace",
        "RAG-informed repaired reusable workflow invocation preserves non-authority locks during approval prep",
        "Treating RAG as authority blocks repaired invocation approval gate prep",
        "Non-ready repaired reusable workflow invocation is blocked before approval gate"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateCommandBuilder, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder_v1",
        "repaired_reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation",
        "blocked_before_repaired_reusable_workflow_invocation_approved_gate_command_builder",
        "rag_informed_prep_treats_rag_as_authority",
        "reasoningBudgetGovernorReviewTraceFromPrep",
        "reasoningBudgetGovernorReviewTrace",
        "supportsRagInformedRepairReuseInvocation",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateCommandBuilderSmoke, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder_smoke_v1",
        "Ready repaired reusable workflow invocation approval prep reuses the existing command builder",
        "Repaired reusable workflow command builder preserves provider role-use trace from approval prep",
        "Repaired reusable workflow command builder preserves reasoning budget trace from approval prep",
        "RAG-informed repaired reusable workflow command builder preserves non-authority locks",
        "Treating RAG as authority blocks repaired invocation approved-gate command builder",
        "Non-ready repaired reusable workflow invocation approval prep is blocked before command builder reuse"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateRunner, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_v1",
        "repaired_reusable_workflow_invocation_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review",
        "blocked_before_repaired_reusable_workflow_invocation_approved_gate_runner",
        "rag_informed_command_builder_treats_rag_as_authority",
        "reasoningBudgetGovernorReviewTraceFromBuilder",
        "reasoningBudgetGovernorReviewTrace",
        "supportsRagInformedRepairReuseInvocation",
        "run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateRunnerSmoke, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_smoke_v1",
        "Ready repaired reusable workflow approved gate runner invokes the existing reusable workflow runner",
        "Repaired reusable workflow approved gate runner preserves provider role-use trace from command builder",
        "Repaired reusable workflow approved gate runner preserves reasoning budget trace from command builder",
        "RAG-informed repaired reusable workflow approved gate runner preserves non-authority locks",
        "Treating RAG as authority blocks repaired invocation approved gate runner",
        "Repaired reusable workflow approved gate runner blocks non-ready repaired command builder"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptBuilder, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_v1",
        "repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use",
        "rag_informed_repaired_run_treats_rag_as_authority",
        "reasoningBudgetGovernorReviewTraceFromRepairedRun",
        "reasoningBudgetGovernorReviewTrace",
        "supportsRagInformedRepairReuseInvocation",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
        "repaired_reusable_workflow_invocation_outcome_matched_contract_waiting_for_reuse_review",
        "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair",
        "blocked_for_forbidden_repaired_reusable_workflow_outcome_review_decision",
        "rag_informed_non_authority_not_reviewed",
        "reasoningBudgetGovernorReviewTraceFromRepairedRun",
        "reasoningBudgetGovernorReviewTrace",
        "ragEvidenceNonAuthoritative"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_smoke_v1",
        "Matched repaired reusable workflow fresh outcome stays review-only before reuse review",
        "Repaired reusable workflow fresh outcome preserves provider role-use trace for reuse review and repair",
        "Repaired invocation fresh outcome preserves reasoning budget trace for reuse review and repair",
        "RAG-informed repaired reusable workflow fresh outcome preserves non-authority locks",
        "Fresh repaired reusable workflow correction returns to high reasoning repair"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationReuseReviewCandidateBuilder, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_candidate_v1",
        "repaired_reusable_workflow_invocation_reuse_review_candidate_ready_for_teacher_review",
        "reasoningBudgetGovernorReviewTraceFromValidation",
        "reasoningBudgetGovernorReviewTrace",
        "ragEvidenceNonAuthoritativeConfirmed",
        "create-tlcl-medium-runtime-reusable-workflow-candidate-builder.mjs"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationReuseReviewReceiptValidation, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_v1",
        "repaired_reusable_workflow_invocation_reuse_review_allowed_waiting_for_next_invocation_planning",
        "repaired_reusable_workflow_invocation_reuse_review_to_high_reasoning_contract_repair",
        "blocked_for_forbidden_repaired_reusable_workflow_invocation_reuse_review_decision",
        "reasoningBudgetGovernorReviewTraceFromCandidate",
        "reasoningBudgetGovernorReviewTrace",
        "treat_rag_as_authority_from_repaired_invocation_reuse_review"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationReuseReviewReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_smoke_v1",
        "Repaired invocation reuse review candidate preserves provider role-use trace",
        "Repaired invocation reuse review candidate preserves reasoning budget trace",
        "Approved repaired invocation reuse review can feed the repaired invocation planner",
        "Repaired invocation reuse review correction returns to high reasoning contract repair",
        "Treating RAG as authority during repaired invocation reuse review is fail-closed"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationPlanner, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_v1",
        "acceptedPlanningStatuses",
        "isRagInformedRepairReuse",
        "reasoningBudgetGovernorReviewTraceFromValidation",
        "treat_rag_as_authority_from_repaired_invocation_planner",
        "repair_reuse_review_validation_format_not_supported"
      ]) &&
      hasAll(files.tlclProviderRoleUseTraceContinuityAuditSmoke, [
        "transparent_ai_tlcl_provider_role_use_trace_continuity_audit_smoke_v1",
        "medium_runtime_dry_run_chain",
        "reusable_workflow_chain",
        "high_reasoning_repair_reuse_chain",
        "repaired_reusable_invocation_chain",
        "targeted smokes keep provider trace assertions visible",
        "README documents provider trace continuity audit"
      ]) &&
      hasAll(files.tlclReasoningBudgetTraceContinuityAuditSmoke, [
        "transparent_ai_tlcl_reasoning_budget_trace_continuity_audit_smoke_v1",
        "reusable_workflow_invocation_cost_control_chain",
        "high_reasoning_repair_cost_control_chain",
        "repaired_reusable_invocation_cost_control_chain",
        "targeted smokes keep reasoning budget trace assertions visible",
        "README documents reasoning budget trace continuity audit"
      ]) &&
      hasAll(files.tlclApprenticeSessionLauncher, [
        "transparent_ai_tlcl_apprentice_session_launcher_v1",
        "execute_confirmed_reusable_workflow_only",
        "externalKnowledgeBaseRetriever",
        "rag_rule_dsl_review",
        "continue_with_rag_rule_dsl_review",
        "create-rag-reviewed-rule-dsl-validation-package.mjs",
        "handoffInputs",
        "retrievalDraftReviewValidation",
        "create_engineering_voice_control_session",
        "tlcl-apprentice-session-route-receipt-builder.html",
        "Open route receipt builder",
        "Manual validation command template",
        "Copy validation command",
        "rollbackRequiredBeforeExecution",
        "teacher_correction_to_high_reasoning_repair",
        "strongerModelsAndDistilledSkillsAreProviders"
      ]) &&
      hasAll(files.tlclApprenticeSessionLauncherSmoke, [
        "transparent_ai_tlcl_apprentice_session_launcher_smoke_v1",
        "Launcher creates a teacher route receipt builder page",
        "Route receipt builder collects concrete handoff inputs",
        "Route receipt builder gives a manual validator command template",
        "Launcher exposes reviewed RAG Rule DSL validation as a locked route",
        "RAG stays evidence-only and non-authoritative",
        "Voice and numbered confirmation are visible before execution",
        "Teacher correction returns to high-reasoning repair"
      ]) &&
      hasAll(files.tlclApprenticeSessionLauncherReceiptValidation, [
        "transparent_ai_tlcl_apprentice_session_launcher_receipt_validation_v1",
        "start_with_existing_tool_demo",
        "start_with_rag_sources",
        "continue_with_rag_rule_dsl_review",
        "create-rag-reviewed-rule-dsl-validation-package.mjs",
        "RAG_RULE_DSL_REVIEW_VALIDATION_INPUT_MISSING_USING_PLACEHOLDER",
        "handoffInputs",
        "tlcl-apprentice-session-launcher-manual-handoff.md",
        "tlcl-apprentice-session-launcher-manual-handoff.html",
        "transparent_ai_tlcl_apprentice_session_launcher_handoff_queue_v1",
        "tlcl-apprentice-session-launcher-handoff-queue.json",
        "tlcl-apprentice-session-launcher-handoff-queue.html",
        "TLCL_APPRENTICE_SESSION_HANDOFF_QUEUE_START_HERE.md",
        "Manual Handoff Command Template",
        "Copy command template",
        "Copy next call",
        "start_with_voice_numbered_confirmation",
        "start_with_low_token_observation",
        "blocked_for_forbidden_decision",
        "create_all_software_observer_bootstrap",
        "doesNotExecuteTargetSoftware"
      ]) &&
      hasAll(files.tlclApprenticeSessionLauncherReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_launcher_receipt_smoke_v1",
        "Existing-tool route becomes a manual continue_teaching handoff",
        "RAG route stays evidence-only without fetch",
        "Reviewed RAG Rule DSL route becomes a manual disabled-rule validation handoff",
        "Receipt validation writes a readable manual handoff markdown",
        "Receipt validation writes a copyable manual handoff HTML page",
        "Receipt validation writes a single-item manual handoff queue",
        "fixture-retrieval-draft-review-validation.json",
        "Voice route requires numbered target confirmation",
        "Low-token route is synthesized without screenshots",
        "Forbidden execute decision is blocked"
      ]) &&
      hasAll(files.tlclApprenticeSessionHandoffItemCommandBuilder, [
        "transparent_ai_tlcl_apprentice_session_handoff_item_command_builder_v1",
        "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1",
        "TLCL_APPRENTICE_SESSION_HANDOFF_ITEM_COMMAND_BUILDER_START_HERE.md",
        "builderDoesNotAutoRunNextCall",
        "Copy selected nextCall"
      ]) &&
      hasAll(files.tlclApprenticeSessionHandoffItemCommandBuilderSmoke, [
        "transparent_ai_tlcl_apprentice_session_handoff_item_command_builder_smoke_v1",
        "TLCL handoff item command builder consumes launcher handoff queue",
        "TLCL handoff item command builder writes a copyable browser page",
        "TLCL handoff item command builder keeps continuation review-only",
        "TLCL handoff item command builder can render before queue exists"
      ]) &&
      hasAll(files.tlclApprenticeSessionHandoffItemContinuationValidation, [
        "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_validation_v1",
        "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1",
        "validatorDoesNotExecuteNextCall",
        "execute_now_forbidden",
        "queue_item_not_found",
        "tlcl-apprentice-session-handoff-item-continuation-next-step.md"
      ]) &&
      hasAll(files.tlclApprenticeSessionHandoffItemContinuationSmoke, [
        "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_smoke_v1",
        "TLCL handoff item continuation request validates one reviewed queue item",
        "TLCL handoff item continuation validation keeps nextCall manual and locked",
        "TLCL handoff item continuation validation blocks executeNow",
        "TLCL handoff item continuation validation blocks unreviewed item mismatch"
      ]) &&
      hasAll(files.tlclApprenticeSessionValidatedContinuationRouter, [
        "transparent_ai_tlcl_apprentice_session_validated_continuation_router_v1",
        "tlcl_validated_continuation_route_prepared_waiting_for_manual_downstream_review",
        "routerDoesNotInvokeDownstreamTool",
        "next_tool_not_allowlisted",
        "TLCL_VALIDATED_CONTINUATION_ROUTER_START_HERE.md"
      ]) &&
      hasAll(files.tlclApprenticeSessionValidatedContinuationRouterSmoke, [
        "transparent_ai_tlcl_apprentice_session_validated_continuation_router_smoke_v1",
        "TLCL validated continuation router prepares reviewed RAG Rule DSL route",
        "TLCL validated continuation router keeps downstream tool manual and locked",
        "TLCL validated continuation router blocks failed continuation validation",
        "TLCL validated continuation router blocks non-allowlisted next tool"
      ]) &&
      hasAll(files.tlclApprenticeSessionValidatedRouteCommandBuilder, [
        "transparent_ai_tlcl_apprentice_session_validated_route_command_builder_v1",
        "transparent_ai_tlcl_apprentice_session_validated_route_downstream_request_v1",
        "TLCL_VALIDATED_ROUTE_COMMAND_BUILDER_START_HERE.md",
        "builderDoesNotExecuteDownstreamTool",
        "Copy downstream request JSON"
      ]) &&
      hasAll(files.tlclApprenticeSessionValidatedRouteCommandBuilderSmoke, [
        "transparent_ai_tlcl_apprentice_session_validated_route_command_builder_smoke_v1",
        "TLCL validated route command builder creates copyable downstream request",
        "TLCL validated route command builder stays copy-only and no-op",
        "TLCL validated route command builder blocks failed router packets"
      ]) &&
      hasAll(files.tlclApprenticeSessionValidatedRouteRequestReceiptBuilder, [
        "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_builder_v1",
        "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_v1",
        "TLCL_VALIDATED_ROUTE_REQUEST_RECEIPT_BUILDER_START_HERE.md",
        "builderDoesNotExecuteDownstreamTool",
        "teacher_reviewed_downstream_request_ready_for_manual_use"
      ]) &&
      hasAll(files.tlclApprenticeSessionValidatedRouteRequestReceiptValidation, [
        "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_v1",
        "transparent_ai_tlcl_apprentice_session_validated_route_manual_downstream_use_v1",
        "tlcl_validated_route_request_reviewed_waiting_for_separate_manual_downstream_use",
        "validatorDoesNotExecuteDownstreamTool",
        "confirmed_rollback_point_missing",
        "forbidden_teacher_decision"
      ]) &&
      hasAll(files.tlclApprenticeSessionValidatedRouteRequestReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_smoke_v1",
        "TLCL validated route request receipt builder creates teacher receipt template",
        "TLCL validated route request receipt validation prepares separate manual downstream use",
        "TLCL validated route request receipt blocks forbidden execute decisions",
        "TLCL validated route request receipt detects reviewed args mismatch",
        "TLCL validated route request receipt requires retained rollback point"
      ]) &&
      hasAll(files.tlclApprenticeSessionManualDownstreamUseResultReceiptBuilder, [
        "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_builder_v1",
        "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_v1",
        "TLCL_MANUAL_DOWNSTREAM_USE_RESULT_RECEIPT_BUILDER_START_HERE.md",
        "builderDoesNotExecuteDownstreamTool",
        "manual_downstream_result_reviewed_ready_for_next_gate"
      ]) &&
      hasAll(files.tlclApprenticeSessionManualDownstreamUseResultReceiptValidation, [
        "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_validation_v1",
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_v1",
        "manual_downstream_result_reviewed_waiting_for_next_tlcl_gate_selection",
        "validatorDoesNotExecuteDownstreamTool",
        "result_evidence_missing",
        "rollback_point_mismatch",
        "forbidden_teacher_decision"
      ]) &&
      hasAll(files.tlclApprenticeSessionManualDownstreamUseResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_smoke_v1",
        "TLCL manual downstream result receipt builder creates teacher result evidence template",
        "TLCL manual downstream result receipt validation prepares reviewed result for next gate",
        "TLCL manual downstream result receipt blocks forbidden execute decisions",
        "TLCL manual downstream result receipt requires result evidence",
        "TLCL manual downstream result receipt rejects rollback mismatch"
      ]) &&
      hasAll(files.tlclApprenticeSessionReviewedManualDownstreamResultNextGateSelector, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selector_v1",
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_receipt_v1",
        "TLCL_REVIEWED_MANUAL_DOWNSTREAM_RESULT_NEXT_GATE_SELECTOR_START_HERE.md",
        "prepare_rag_rule_dsl_review_follow_up",
        "prepare_medium_runtime_dry_run_prep",
        "selectorDoesNotExecuteNextGateTool"
      ]) &&
      hasAll(files.tlclApprenticeSessionReviewedManualDownstreamResultNextGateValidation, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_validation_v1",
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_manual_next_gate_handoff_v1",
        "reviewed_manual_downstream_result_next_gate_selected_waiting_for_manual_preparation",
        "validatorDoesNotExecuteNextGateTool",
        "selected_next_gate_not_candidate",
        "result_evidence_paths_mismatch",
        "forbidden_teacher_decision"
      ]) &&
      hasAll(files.tlclApprenticeSessionReviewedManualDownstreamResultNextGateSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection_smoke_v1",
        "TLCL reviewed manual downstream result next-gate selector creates teacher choice receipt",
        "TLCL reviewed manual downstream result next-gate validation prepares manual handoff",
        "TLCL reviewed manual downstream result next-gate validation blocks forbidden execute decisions",
        "TLCL reviewed manual downstream result next-gate validation rejects non-candidate gate",
        "TLCL reviewed manual downstream result next-gate validation rejects evidence mismatch",
        "TLCL reviewed manual downstream result next-gate validation can route correction back to high reasoning repair"
      ]) &&
      hasAll(files.tlclApprenticeSessionManualNextGatePreparationBuilder, [
        "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_builder_v1",
        "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_receipt_v1",
        "TLCL_MANUAL_NEXT_GATE_PREPARATION_BUILDER_START_HERE.md",
        "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
        "create-tlcl-medium-runtime-dry-run-prep.mjs",
        "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
        "builderDoesNotExecuteNextGateTool"
      ]) &&
      hasAll(files.tlclApprenticeSessionManualNextGatePreparationValidation, [
        "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_validation_v1",
        "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_v1",
        "manual_next_gate_prepared_waiting_for_separate_manual_use",
        "validatorDoesNotExecuteNextGateTool",
        "reviewed_command_template_mismatch",
        "selected_gate_not_reviewed",
        "forbidden_teacher_decision"
      ]) &&
      hasAll(files.tlclApprenticeSessionManualNextGatePreparationSmoke, [
        "transparent_ai_tlcl_apprentice_session_manual_next_gate_preparation_smoke_v1",
        "TLCL manual next-gate preparation builder creates reviewed RAG follow-up receipt",
        "TLCL manual next-gate preparation validation prepares separate manual use",
        "TLCL manual next-gate preparation blocks forbidden run decisions",
        "TLCL manual next-gate preparation rejects command template mismatch",
        "TLCL manual next-gate preparation requires selected gate review",
        "TLCL manual next-gate preparation can prepare high-reasoning repair as separate manual use"
      ]) &&
      hasAll(files.mcp, [
        "validate_tlcl_apprentice_session_launcher_receipt",
        "validate-tlcl-apprentice-session-launcher-receipt.mjs",
        "create_tlcl_apprentice_session_handoff_item_command_builder",
        "create-tlcl-apprentice-session-handoff-item-command-builder.mjs",
        "validate_tlcl_apprentice_session_handoff_item_continuation_request",
        "validate-tlcl-apprentice-session-handoff-item-continuation-request.mjs",
        "create_tlcl_apprentice_session_validated_continuation_router",
        "create-tlcl-apprentice-session-validated-continuation-router.mjs",
        "create_tlcl_apprentice_session_validated_route_command_builder",
        "create-tlcl-apprentice-session-validated-route-command-builder.mjs",
        "create_tlcl_apprentice_session_validated_route_request_receipt_builder",
        "create-tlcl-apprentice-session-validated-route-request-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_validated_route_request_receipt",
        "validate-tlcl-apprentice-session-validated-route-request-receipt.mjs",
        "create_tlcl_apprentice_session_manual_downstream_use_result_receipt_builder",
        "create-tlcl-apprentice-session-manual-downstream-use-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_manual_downstream_use_result_receipt",
        "validate-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selector",
        "create-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selector.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection",
        "validate-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection.mjs",
        "create_tlcl_apprentice_session_manual_next_gate_preparation_builder",
        "create-tlcl-apprentice-session-manual-next-gate-preparation-builder.mjs",
        "validate_tlcl_apprentice_session_manual_next_gate_preparation_receipt",
        "validate-tlcl-apprentice-session-manual-next-gate-preparation-receipt.mjs",
        "create_tlcl_apprentice_session_manual_next_gate_result_receipt_builder",
        "create-tlcl-apprentice-session-manual-next-gate-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_manual_next_gate_result_receipt",
        "validate-tlcl-apprentice-session-manual-next-gate-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selector",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selector.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selection",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt.mjs",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_builder",
        "create-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt-builder.mjs",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt",
        "validate-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt.mjs"
      ]) &&
      hasAll(files.tlclRagSelectionReceiptBuilderResultReceiptBuilder, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_builder_v1",
        "transparent_ai_rag_follow_up_queue_selection_receipt_builder_v1",
        "builderDoesNotRunSelectionReceiptValidation",
        "builderDoesNotSelectFollowUpLane"
      ]) &&
      hasAll(files.tlclRagSelectionReceiptBuilderResultReceiptValidation, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_validation_result_v1",
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_follow_up_selection_receipt_validation_handoff_v1",
        "tlcl_rag_selection_receipt_builder_ready_for_selection_receipt_validation",
        "validatorDoesNotRunSelectionReceiptValidation",
        "validatorDoesNotSelectFollowUpLane",
        "high_reasoning_logic_contract_repair_after_tlcl_rag_selection_receipt_builder_result"
      ]) &&
      hasAll(files.tlclRagSelectionReceiptBuilderResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_smoke_v1",
        "TLCL RAG selection receipt builder result receipt builder consumes existing builder result",
        "TLCL RAG selection receipt builder result validation prepares selection receipt validation handoff",
        "TLCL RAG selection receipt builder result validation blocks forbidden validator runs"
      ]) &&
      hasAll(files.tlclRagSelectionReceiptValidationResultReceiptBuilder, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_builder_v1",
        "transparent_ai_rag_follow_up_queue_selection_receipt_validation_v1",
        "builderDoesNotRunSelectedFollowUpPlanningPacket",
        "builderDoesNotSelectFollowUpLane"
      ]) &&
      hasAll(files.tlclRagSelectionReceiptValidationResultReceiptValidation, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_validation_result_v1",
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_selected_follow_up_planning_handoff_v1",
        "tlcl_rag_selection_receipt_validation_ready_for_selected_follow_up_planning",
        "validatorDoesNotRunSelectedFollowUpPlanningPacket",
        "validatorDoesNotSelectFollowUpLane",
        "high_reasoning_logic_contract_repair_after_tlcl_rag_selection_receipt_validation_result"
      ]) &&
      hasAll(files.tlclRagSelectionReceiptValidationResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_smoke_v1",
        "TLCL RAG selection receipt validation result receipt builder consumes existing selection validation",
        "TLCL RAG selection receipt validation result validation prepares selected follow-up planning handoff",
        "TLCL RAG selection receipt validation result validation blocks forbidden planner runs"
      ]) &&
      hasAll(files.tlclRagSelectedFollowUpPlanningResultReceiptBuilder, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_builder_v1",
        "transparent_ai_rag_selected_follow_up_planning_packet_v1",
        "builderDoesNotRunPrimarySourceEvidenceRequestReceiptBuilder",
        "builderDoesNotChangeSelectedFollowUpLane"
      ]) &&
      hasAll(files.tlclRagSelectedFollowUpPlanningResultReceiptValidation, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_validation_result_v1",
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_manual_rag_primary_source_evidence_request_receipt_builder_handoff_v1",
        "tlcl_rag_selected_follow_up_planning_ready_for_primary_source_evidence_request_receipt_builder",
        "validatorDoesNotRunPrimarySourceEvidenceRequestReceiptBuilder",
        "validatorDoesNotChangeSelectedFollowUpLane",
        "high_reasoning_logic_contract_repair_after_tlcl_rag_selected_follow_up_planning_result"
      ]) &&
      hasAll(files.tlclRagSelectedFollowUpPlanningResultReceiptSmoke, [
        "transparent_ai_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_smoke_v1",
        "TLCL RAG selected follow-up planning result receipt builder consumes existing planning packet",
        "TLCL RAG selected follow-up planning result validation prepares primary-source evidence request handoff",
        "TLCL RAG selected follow-up planning result validation blocks forbidden primary-source builder runs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "MCP advanced mode validates TLCL apprentice session launcher receipt into manual handoff",
        "validate_tlcl_apprentice_session_launcher_receipt",
        "MCP advanced mode builds TLCL apprentice session handoff item continuation request page",
        "create_tlcl_apprentice_session_handoff_item_command_builder",
        "MCP advanced mode validates TLCL apprentice session handoff item continuation request",
        "validate_tlcl_apprentice_session_handoff_item_continuation_request",
        "MCP advanced mode routes validated TLCL continuation into manual downstream lane",
        "create_tlcl_apprentice_session_validated_continuation_router",
        "MCP advanced mode builds TLCL validated route downstream command request",
        "create_tlcl_apprentice_session_validated_route_command_builder",
        "MCP advanced mode builds TLCL validated route request teacher receipt",
        "create_tlcl_apprentice_session_validated_route_request_receipt_builder",
        "MCP advanced mode validates TLCL route request receipt before manual downstream use",
        "validate_tlcl_apprentice_session_validated_route_request_receipt",
        "MCP advanced mode builds TLCL manual downstream result receipt",
        "create_tlcl_apprentice_session_manual_downstream_use_result_receipt_builder",
        "MCP advanced mode validates TLCL manual downstream result before next gate",
        "validate_tlcl_apprentice_session_manual_downstream_use_result_receipt",
        "MCP advanced mode builds TLCL reviewed manual downstream result next-gate selector",
        "create_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selector",
        "MCP advanced mode validates TLCL reviewed manual downstream result next-gate selection",
        "validate_tlcl_apprentice_session_reviewed_manual_downstream_result_next_gate_selection",
        "MCP advanced mode builds TLCL manual next-gate preparation",
        "create_tlcl_apprentice_session_manual_next_gate_preparation_builder",
        "MCP advanced mode validates TLCL manual next-gate preparation",
        "validate_tlcl_apprentice_session_manual_next_gate_preparation_receipt",
        "MCP advanced mode builds TLCL manual next-gate result receipt",
        "create_tlcl_apprentice_session_manual_next_gate_result_receipt_builder",
        "MCP advanced mode validates TLCL manual next-gate result receipt",
        "validate_tlcl_apprentice_session_manual_next_gate_result_receipt",
        "MCP advanced mode builds TLCL reviewed manual next-gate result follow-up selector",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selector",
        "MCP advanced mode validates TLCL reviewed manual next-gate result follow-up selection",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_follow_up_selection",
        "MCP advanced mode builds TLCL RAG review receipt adapter",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter_builder",
        "MCP advanced mode validates TLCL RAG review receipt adapter",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_adapter",
        "Default teach_apprentice builds TLCL RAG review receipt adapter",
        "Default teach_apprentice validates TLCL RAG review receipt adapter",
        "MCP advanced mode builds TLCL RAG review receipt builder result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG review receipt builder result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_builder_result_receipt",
        "Default teach_apprentice builds TLCL RAG review receipt builder result receipt",
        "Default teach_apprentice validates TLCL RAG review receipt builder result receipt",
        "MCP advanced mode builds TLCL RAG review receipt validation result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG review receipt validation result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_review_receipt_validation_result_receipt",
        "Default teach_apprentice builds TLCL RAG review receipt validation result receipt",
        "Default teach_apprentice validates TLCL RAG review receipt validation result receipt",
        "MCP advanced mode builds TLCL RAG disabled package result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG disabled package result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_disabled_package_result_receipt",
        "Default teach_apprentice builds TLCL RAG disabled package result receipt",
        "Default teach_apprentice validates TLCL RAG disabled package result receipt",
        "MCP advanced mode builds TLCL RAG validation report result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG validation report result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_validation_report_result_receipt",
        "Default teach_apprentice builds TLCL RAG validation report result receipt",
        "Default teach_apprentice validates TLCL RAG validation report result receipt",
        "MCP advanced mode builds TLCL RAG delivery gate result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG delivery gate result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_delivery_gate_result_receipt",
        "Default teach_apprentice builds TLCL RAG delivery gate result receipt",
        "Default teach_apprentice validates TLCL RAG delivery gate result receipt",
        "MCP advanced mode builds TLCL RAG audit trail result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG audit trail result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_trail_result_receipt",
        "Default teach_apprentice builds TLCL RAG audit trail result receipt",
        "Default teach_apprentice validates TLCL RAG audit trail result receipt",
        "MCP advanced mode builds TLCL RAG audit review receipt builder result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG audit review receipt builder result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_receipt_builder_result_receipt",
        "Default teach_apprentice builds TLCL RAG audit review receipt builder result receipt",
        "Default teach_apprentice validates TLCL RAG audit review receipt builder result receipt",
        "MCP advanced mode builds TLCL RAG audit review validation result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG audit review validation result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_audit_review_validation_result_receipt",
        "Default teach_apprentice builds TLCL RAG audit review validation result receipt",
        "Default teach_apprentice validates TLCL RAG audit review validation result receipt",
        "MCP advanced mode builds TLCL RAG follow-up queue result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG follow-up queue result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_follow_up_queue_result_receipt",
        "Default teach_apprentice builds TLCL RAG follow-up queue result receipt",
        "Default teach_apprentice validates TLCL RAG follow-up queue result receipt",
        "MCP advanced mode builds TLCL RAG selection receipt builder result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG selection receipt builder result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_builder_result_receipt",
        "Default teach_apprentice builds TLCL RAG selection receipt builder result receipt",
        "Default teach_apprentice validates TLCL RAG selection receipt builder result receipt",
        "MCP advanced mode builds TLCL RAG selection receipt validation result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG selection receipt validation result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selection_receipt_validation_result_receipt",
        "Default teach_apprentice builds TLCL RAG selection receipt validation result receipt",
        "Default teach_apprentice validates TLCL RAG selection receipt validation result receipt",
        "MCP advanced mode builds TLCL RAG selected follow-up planning result receipt",
        "create_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt_builder",
        "MCP advanced mode validates TLCL RAG selected follow-up planning result receipt",
        "validate_tlcl_apprentice_session_reviewed_manual_next_gate_result_rag_selected_follow_up_planning_result_receipt",
        "Default teach_apprentice builds TLCL RAG selected follow-up planning result receipt",
        "Default teach_apprentice validates TLCL RAG selected follow-up planning result receipt"
      ]) &&
      hasAll(files.package, [
        "smoke:plugin-tlcl-apprentice-session-launcher-receipt",
        "smoke:plugin-tlcl-apprentice-session-handoff-item-command-builder",
        "smoke:plugin-tlcl-apprentice-session-handoff-item-continuation-request",
        "smoke:plugin-tlcl-apprentice-session-validated-continuation-router",
        "smoke:plugin-tlcl-apprentice-session-validated-route-command-builder",
        "smoke:plugin-tlcl-apprentice-session-validated-route-request-receipt",
        "smoke:plugin-tlcl-apprentice-session-manual-downstream-use-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-downstream-result-next-gate-selection",
        "smoke:plugin-tlcl-apprentice-session-manual-next-gate-preparation",
        "smoke:plugin-tlcl-apprentice-session-manual-next-gate-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-follow-up-selection",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-adapter",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-builder-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-review-receipt-validation-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-disabled-package-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-validation-report-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-delivery-gate-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-trail-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-receipt-builder-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-audit-review-validation-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-follow-up-queue-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-builder-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selection-receipt-validation-result-receipt",
        "smoke:plugin-tlcl-apprentice-session-reviewed-manual-next-gate-result-rag-selected-follow-up-planning-result-receipt"
      ]) &&
      hasAll(files.tlclRagEvidenceToHighReasoningRepairChainAuditSmoke, [
        "transparent_ai_tlcl_rag_evidence_to_high_reasoning_repair_chain_audit_smoke_v1",
        "RAG-to-repair chain script:",
        "evidence attachment",
        "highest-reasoning TLCL contract compiler",
        "draft_disabled",
        "ragEvidenceNonAuthoritative",
        "ragEvidenceTreatedAsAuthority",
        "providerRoleUsePlanTrace",
        "RAG-informed deterministic validation keeps medium retry and rule activation blocked",
        "npm script exposes RAG evidence to high-reasoning repair chain audit"
      ]) &&
      hasAll(files.tlclMarketResponseProviderBoundaryAuditSmoke, [
        "transparent_ai_tlcl_market_response_provider_boundary_audit_smoke_v1",
        "strong_foundation_model",
        "distilled_skill",
        "provider_claims_contract_bypass",
        "provider_role_use_mismatch_to_high_reasoning_repair",
        "provider_role_use_plan_not_medium_runtime",
        "Low-reasoning tool role-use plan cannot enter medium runtime gate"
      ]) &&
      hasAll(files.tlclStatusRefreshSmoke, [
        "transparent_ai_tlcl_status_refresh_smoke_v1",
        "default_runtime_tier === \"medium_reasoning_runtime\"",
        "teacher_correction"
      ]) &&
      hasAll(files.tlclRuntimeGateSmoke, [
        "transparent_ai_tlcl_runtime_gate_smoke_v1",
        "Passing validation allows only medium reviewed dry-run",
        "Teacher correction escalates back to senior compile"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunPrepSmoke, [
        "transparent_ai_tlcl_medium_runtime_dry_run_prep_smoke_v1",
        "TLCL medium runtime dry-run prep accepts only allowed runtime gate plus route evidence",
        "Medium runtime dry-run prep inherits accepted provider role-use plan hash from runtime gate",
        "Teacher correction or blocked TLCL gate returns dry-run prep to senior compile"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunPrepReviewReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_receipt_smoke_v1",
        "Teacher-approved prep review validates only a separate dry-run route review handoff",
        "Forbidden execute decisions are blocked by TLCL prep review validation"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunRouteReviewHandoffSmoke, [
        "transparent_ai_tlcl_medium_runtime_dry_run_route_review_handoff_smoke_v1",
        "TLCL dry-run route review handoff creates one non-executing handoff item",
        "TLCL dry-run route review handoff can carry senior compile repairs"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunRouteReviewReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_smoke_v1",
        "Teacher-approved route review validates only a separate dry-run-only runner template",
        "Forbidden execute decisions are blocked by TLCL route review validation"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunOnlyRunnerSmoke, [
        "transparent_ai_tlcl_medium_runtime_dry_run_only_runner_smoke_v1",
        "TLCL dry-run-only runner records evidence from a ready route review validation",
        "TLCL dry-run-only runner preserves provider role-use trace from prep through route review",
        "TLCL dry-run-only runner blocks unready route review validation"
      ]) &&
      hasAll(files.tlclMediumRuntimeDryRunOnlyPostRunReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_smoke_v1",
        "Matched TLCL post-run receipt validates only execution approval gate planning",
        "Forbidden TLCL post-run receipt decisions are fail-closed"
      ]) &&
      hasAll(files.tlclMediumRuntimeExecutionApprovalGatePrepRunnerSmoke, [
        "transparent_ai_tlcl_medium_runtime_execution_approval_gate_prep_runner_smoke_v1",
        "Ready TLCL post-run validation prepares an approval gate without executing the runner",
        "Non-ready TLCL post-run validation is blocked before approval gate",
        "TLCL approval gate prep preserves provider role-use trace from post-run validation"
      ]) &&
      hasAll(files.tlclMediumRuntimeApprovedGateCommandBuilderSmoke, [
        "transparent_ai_tlcl_medium_runtime_approved_gate_command_builder_smoke_v1",
        "Ready TLCL approval prep reuses the existing approved-gate command builder",
        "Non-ready TLCL approval prep is blocked before command-builder reuse"
      ]) &&
      hasAll(files.tlclMediumRuntimeApprovedGateRunnerSmoke, [
        "transparent_ai_tlcl_medium_runtime_approved_gate_runner_smoke_v1",
        "TLCL approved gate runner blocks without final execute flag",
        "Ready TLCL approved gate runner invokes exactly one existing approved-gate runner"
      ]) &&
      hasAll(files.tlclMediumRuntimeApprovedGateOutcomeReviewReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_smoke_v1",
        "Teacher correction from approved outcome escalates back to high reasoning repair",
        "Matched approved outcome stays review-only before rule activation",
        "Approved outcome review preserves provider role-use trace for reuse or high-reasoning repair"
      ]) &&
      hasAll(files.tlclRagEvidenceAttachment, [
        "transparent_ai_tlcl_rag_evidence_attachment_v1",
        "tlcl_rag_evidence_attached_waiting_for_high_reasoning_review",
        "rag_validation_not_ready_for_review_only_rule_dsl_validation",
        "ragDoesNotAuthorizeExecution: true"
      ]) &&
      hasAll(files.tlclRagEvidenceAttachmentSmoke, [
        "transparent_ai_tlcl_rag_evidence_attachment_smoke_v1",
        "Reviewed RAG validation attaches to TLCL packet for high reasoning only",
        "Unsafe RAG rule enablement lock is fail-closed"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairIntake, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_v1",
        "tlcl_rag_informed_high_reasoning_repair_intake_waiting_for_teacher_review",
        "mediumRuntimeContinuationAllowed: false",
        "ragDoesNotAuthorizeExecution: true"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairIntakeSmoke, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_smoke_v1",
        "RAG-informed repair intake rejects medium-runtime continuation before teacher review",
        "RAG-informed repair intake optimizes prompt around explicit logic extraction"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairDraftPackage, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_v1",
        "tlcl_rag_informed_high_reasoning_repair_draft_package_ready_for_teacher_review",
        "draft_disabled",
        "treat_rag_as_authority_from_draft_package"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairDraftPackageSmoke, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_smoke_v1",
        "RAG-informed repair draft package compiles only draft_disabled evidence-bound rules",
        "RAG-informed repair draft package keeps RAG evidence non-authoritative"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairDraftReviewValidation, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_validation_v1",
        "rag_informed_repair_draft_ready_for_deterministic_validation",
        "treat_rag_as_authority",
        "doesNotRunDeterministicValidation: true"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairDraftReviewSmoke, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_smoke_v1",
        "RAG-informed repair draft review approves only deterministic validation handoff",
        "RAG-informed repair draft review blocks forbidden RAG authority and rule enablement"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairDeterministicValidation, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_package_v1",
        "rag_informed_deterministic_validation_ready_for_fingerprint_review",
        "evaluateRulePackage",
        "ragEvidenceNonAuthoritative: true"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairDeterministicValidationSmoke, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_package_smoke_v1",
        "RAG-informed deterministic validation creates lifecycle-skipped validation report",
        "RAG-informed deterministic validation keeps RAG evidence non-authoritative"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairWorkflowFingerprintReviewValidation, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_workflow_fingerprint_review_validation_v1",
        "rag_informed_fingerprint_review_ready_for_approval_gate_rebuild",
        "doesNotRebuildApprovalGate: true",
        "treat_rag_as_authority_from_fingerprint_review"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairWorkflowFingerprintReviewSmoke, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_workflow_fingerprint_review_smoke_v1",
        "RAG-informed fingerprint review prepares only approval gate rebuild handoff",
        "RAG-informed fingerprint review blocks forbidden RAG authority and execution"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairApprovalGateRebuild, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approval_gate_rebuild_package_v1",
        "rag_informed_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review",
        "run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        "doesNotTreatRagAsAuthority: true"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairApprovalGateRebuildSmoke, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approval_gate_rebuild_package_smoke_v1",
        "RAG-informed repair approval gate rebuild invokes only the existing prep runner",
        "RAG-informed repair approval gate rebuild keeps RAG evidence non-authoritative"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairApprovedGateCommandBuilder, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_v1",
        "rag_informed_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs",
        "doesNotTreatRagAsAuthority: true"
      ]) &&
      hasAll(files.tlclRagInformedHighReasoningRepairApprovedGateCommandBuilderSmoke, [
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_smoke_v1",
        "RAG-informed repair approved-gate command builder reuses only the existing command builder",
        "RAG-informed repair approved-gate command builder keeps RAG evidence non-authoritative"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowActivationSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_smoke_v1",
        "Teacher approval enables only bounded medium-runtime workflow reuse",
        "Reusable workflow correction escalates back to high reasoning repair",
        "Reusable workflow card preserves provider role-use trace from approved medium-runtime outcome"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationPlannerSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_planner_smoke_v1",
        "Activated TLCL reusable workflow can plan one bounded medium-runtime invocation",
        "Reusable workflow fingerprint mismatch escalates to high reasoning repair",
        "Reusable workflow invocation planner preserves provider role-use trace from workflow card"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovalGatePrepRunnerSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approval_gate_prep_runner_smoke_v1",
        "Ready TLCL reusable workflow invocation prepares an approval gate without executing the runner",
        "Mismatch TLCL reusable workflow invocation is blocked before approval gate",
        "Reusable workflow approval gate prep preserves provider role-use trace from invocation plan"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovalGatePrepRunner, [
        "reasoningBudgetGovernorReviewTraceFromPlan",
        "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromPlan(plan)"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateCommandBuilderSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_command_builder_smoke_v1",
        "Ready reusable workflow invocation approval prep reuses the existing approved-gate command builder",
        "Non-ready reusable workflow invocation approval prep is blocked before command-builder reuse",
        "Reusable workflow command builder preserves provider role-use trace from approval prep"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateCommandBuilder, [
        "reasoningBudgetGovernorReviewTraceFromPrep",
        "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromPrep(prep)"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateRunnerSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_smoke_v1",
        "Ready reusable workflow approved gate runner invokes exactly one existing approved-gate runner",
        "Reusable workflow approved gate runner blocks without final execute flag",
        "Reusable workflow approved gate runner preserves provider role-use trace from command builder"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateRunner, [
        "reasoningBudgetGovernorReviewTraceFromBuilder",
        "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromBuilder(builder)"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_smoke_v1",
        "Reusable workflow correction escalates back to high reasoning contract repair",
        "Forbidden reusable workflow outcome review decisions are fail-closed",
        "Reusable workflow outcome review preserves provider role-use trace for matched or repair paths",
        "Reusable workflow outcome review preserves reasoning budget trace for matched and high-reasoning repair paths"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptBuilder, [
        "reasoningBudgetGovernorReviewTraceFromRun",
        "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromRun(run)"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationApprovedGateOutcomeReviewReceiptValidation, [
        "reasoningBudgetGovernorReviewTraceFromRun",
        "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromRun(run)"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairIntakeSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_smoke_v1",
        "Reusable workflow repair intake turns teacher correction into high-reasoning compile work",
        "Reusable workflow repair intake accepts repaired RAG-informed corrections with non-authority locks",
        "Reusable workflow repair intake blocks matched outcomes before repair intake",
        "Reusable workflow repair intake preserves provider role-use trace for high-reasoning repair",
        "Reusable workflow repair intake preserves reasoning budget trace for high-reasoning repair"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairIntake, [
        "reasoningBudgetGovernorReviewTraceFromValidation",
        "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromValidation(validation, handoff)"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftPackageSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package_smoke_v1",
        "Reusable workflow repair draft package compiles only draft_disabled repair rules",
        "Reusable workflow repair draft package preserves RAG non-authority locks",
        "Reusable workflow repair draft package carries regression validation plan before medium retry",
        "Reusable workflow repair draft package preserves provider role-use trace from repair intake",
        "Reusable workflow repair draft package preserves reasoning budget trace from repair intake"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftPackage, [
        "reasoningBudgetGovernorReviewTraceFromIntake",
        "workflowRepairProposal",
        "reasoningBudgetGovernorReviewTrace,"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftReviewSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_smoke_v1",
        "Reusable workflow repair draft review approves only deterministic regression validation handoff",
        "Reusable workflow repair draft package preserves RAG non-authority through draft_disabled rules",
        "Reusable workflow repair draft review blocks forbidden acceptance and rule enablement",
        "Reusable workflow repair draft review preserves provider role-use trace for regression validation handoff",
        "Reusable workflow repair draft review preserves reasoning budget trace for regression validation handoff"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairDraftReviewValidation, [
        "reasoningBudgetGovernorReviewTraceFromDraft",
        "regressionValidationHandoff",
        "reasoningBudgetGovernorReviewTrace,"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairRegressionValidationPackageSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_regression_validation_package_smoke_v1",
        "Reusable workflow repair regression validation creates lifecycle-skipped validation report",
        "Reusable workflow repair regression validation preserves RAG non-authority locks",
        "Reusable workflow repair regression validation keeps medium retry and rule activation blocked",
        "Reusable workflow repair regression validation preserves provider role-use trace for fingerprint review",
        "Reusable workflow repair regression validation preserves reasoning budget trace for fingerprint review"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairRegressionValidationPackage, [
        "reasoningBudgetGovernorReviewTraceFromReview",
        "reasoning_budget_governor_review_trace"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairWorkflowFingerprintReviewSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_smoke_v1",
        "Reusable workflow repair fingerprint review prepares only approval gate rebuild handoff",
        "Reusable workflow repair fingerprint review preserves RAG non-authority locks",
        "Reusable workflow repair fingerprint review blocks forbidden execution and rule enablement",
        "Reusable workflow repair fingerprint review preserves provider role-use trace for approval gate rebuild",
        "Reusable workflow repair fingerprint review preserves reasoning budget trace for approval gate rebuild"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairWorkflowFingerprintReviewValidation, [
        "reasoningBudgetGovernorReviewTraceFromValidationPackage",
        "approvalGateRebuildHandoff",
        "reasoningBudgetGovernorReviewTrace,"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovalGateRebuildPackageSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approval_gate_rebuild_package_smoke_v1",
        "Reusable workflow repair approval gate rebuild invokes only the existing prep runner",
        "Reusable workflow repair approval gate rebuild preserves RAG non-authority locks",
        "Reusable workflow repair approval gate rebuild blocks unready fingerprint review",
        "Reusable workflow repair approval gate rebuild preserves provider role-use trace for repaired command builder",
        "Reusable workflow repair approval gate rebuild preserves reasoning budget trace for repaired command builder"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateCommandBuilderSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_command_builder_smoke_v1",
        "Reusable workflow repair approved-gate command builder reuses only the existing command builder",
        "Reusable workflow repair approved-gate command builder preserves RAG non-authority locks",
        "Reusable workflow repair approved-gate command builder blocks unready rebuild packages",
        "Reusable workflow repair approved-gate command builder preserves provider role-use trace from rebuild package",
        "Reusable workflow repair approved-gate command builder preserves reasoning budget trace from rebuild package"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateRunnerSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_smoke_v1",
        "Ready reusable workflow repair approved gate runner invokes the existing reusable workflow runner and preserves evidence",
        "Reusable workflow repair approved gate runner preserves RAG non-authority locks",
        "Reusable workflow repair approved gate runner blocks non-ready repair command builder",
        "Reusable workflow repair approved gate runner preserves provider role-use trace from command builder",
        "Reusable workflow repair approved gate runner preserves reasoning budget trace from command builder"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairApprovedGateOutcomeReviewReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_smoke_v1",
        "Matched repaired reusable workflow fresh outcome stays review-only before reuse review",
        "Repaired reusable workflow fresh outcome preserves provider role-use trace for reuse review",
        "Repaired reusable workflow fresh outcome preserves reasoning budget trace for reuse review",
        "Fresh repaired reusable workflow correction returns to high reasoning repair",
        "Treating RAG as authority during repair outcome review is fail-closed"
      ]) &&
      hasAll(files.tlclMediumRuntimeReusableWorkflowInvocationHighReasoningRepairReuseReviewReceiptSmoke, [
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_smoke_v1",
        "Teacher approval allows repaired reusable workflow only for later invocation planning",
        "Repair reuse review candidate preserves provider role-use trace from matched repair outcome",
        "Repair reuse review candidate preserves reasoning budget trace from matched repair outcome",
        "Repair reuse review correction returns to high reasoning contract repair",
        "Treating RAG as authority during repair reuse review is fail-closed"
      ]) &&
      hasAll(files.tlclMediumRuntimeRepairedReusableWorkflowInvocationPlannerSmoke, [
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_planner_smoke_v1",
        "Teacher-approved repaired reusable workflow can reuse existing invocation planner",
        "Repaired reusable workflow invocation planner preserves provider role-use trace for next approval gate",
        "Repaired reusable workflow invocation planner preserves reasoning budget trace for next approval gate",
        "RAG-informed approved reuse review can feed the repaired invocation planner without treating RAG as authority",
        "Unapproved repair reuse review cannot feed the next invocation planner"
      ]) &&
      hasAll(files.mcp, [
        "create_tlcl_status_refresh",
        "create-tlcl-status-refresh.mjs",
        "create_tlcl_runtime_gate",
        "create-tlcl-runtime-gate.mjs",
        "create_tlcl_medium_runtime_dry_run_prep",
        "create-tlcl-medium-runtime-dry-run-prep.mjs",
        "create_tlcl_medium_runtime_dry_run_prep_review_receipt_builder",
        "create-tlcl-medium-runtime-dry-run-prep-review-receipt-builder.mjs",
        "validate_tlcl_medium_runtime_dry_run_prep_review_receipt",
        "validate-tlcl-medium-runtime-dry-run-prep-review-receipt.mjs",
        "create_tlcl_medium_runtime_dry_run_route_review_handoff",
        "create-tlcl-medium-runtime-dry-run-route-review-handoff.mjs",
        "create_tlcl_medium_runtime_dry_run_route_review_receipt_builder",
        "create-tlcl-medium-runtime-dry-run-route-review-receipt-builder.mjs",
        "validate_tlcl_medium_runtime_dry_run_route_review_receipt",
        "validate-tlcl-medium-runtime-dry-run-route-review-receipt.mjs",
        "run_tlcl_medium_runtime_dry_run_only_runner",
        "run-tlcl-medium-runtime-dry-run-only-runner.mjs",
        "create_tlcl_medium_runtime_dry_run_only_post_run_receipt_builder",
        "create-tlcl-medium-runtime-dry-run-only-post-run-receipt-builder.mjs",
        "validate_tlcl_medium_runtime_dry_run_only_post_run_receipt",
        "validate-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs",
        "run_tlcl_medium_runtime_execution_approval_gate_prep_runner",
        "run-tlcl-medium-runtime-execution-approval-gate-prep-runner.mjs",
        "create_tlcl_medium_runtime_approved_gate_command_builder",
        "create-tlcl-medium-runtime-approved-gate-command-builder.mjs",
        "run_tlcl_medium_runtime_approved_gate_runner",
        "run-tlcl-medium-runtime-approved-gate-runner.mjs",
        "create_tlcl_medium_runtime_approved_gate_outcome_review_receipt_builder",
        "create-tlcl-medium-runtime-approved-gate-outcome-review-receipt-builder.mjs",
        "validate_tlcl_medium_runtime_approved_gate_outcome_review_receipt",
        "validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_candidate_builder",
        "create-tlcl-medium-runtime-reusable-workflow-candidate-builder.mjs",
        "validate_tlcl_medium_runtime_reusable_workflow_activation_receipt",
        "validate-tlcl-medium-runtime-reusable-workflow-activation-receipt.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_planner",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs",
        "run_tlcl_medium_runtime_reusable_workflow_invocation_approval_gate_prep_runner",
        "run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_command_builder",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs",
        "run_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner",
        "run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs",
        "validate_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt",
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs",
        "validate_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_receipt",
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_regression_validation_package",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs",
        "validate_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_receipt",
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approval_gate_rebuild_package",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_command_builder",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder.mjs",
        "run_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner",
        "run-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_builder",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt-builder.mjs",
        "validate_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt",
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs",
        "create_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_candidate_builder",
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-candidate-builder.mjs",
        "validate_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_receipt",
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
        "create_tlcl_medium_runtime_repaired_reusable_workflow_invocation_planner",
        "create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs",
        "run_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner",
        "run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        "create_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder",
        "create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs",
        "run_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner",
        "run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs",
        "create_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder",
        "create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs",
        "validate_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt",
        "validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
        "create_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_candidate_builder",
        "create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-candidate-builder.mjs",
        "validate_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_receipt",
        "validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
        "create_tlcl_rag_evidence_attachment",
        "create-tlcl-rag-evidence-attachment.mjs",
        "create_tlcl_rag_informed_high_reasoning_repair_intake",
        "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
        "create_tlcl_rag_informed_high_reasoning_repair_draft_package",
        "create-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs",
        "validate_tlcl_rag_informed_high_reasoning_repair_draft_review_receipt",
        "validate-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs",
        "create_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_package",
        "create-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs",
        "validate_tlcl_rag_informed_high_reasoning_repair_workflow_fingerprint_review_receipt",
        "validate-tlcl-rag-informed-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
        "create_tlcl_rag_informed_high_reasoning_repair_approval_gate_rebuild_package",
        "create-tlcl-rag-informed-high-reasoning-repair-approval-gate-rebuild-package.mjs",
        "create_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder",
        "create-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder.mjs",
        "run_tlcl_rag_informed_high_reasoning_repair_approved_gate_runner",
        "run-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner.mjs",
        "create_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt_builder",
        "create-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt-builder.mjs",
        "validate_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt",
        "validate-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs",
        "create_tlcl_rag_informed_high_reasoning_repair_reuse_review_candidate_builder",
        "create-tlcl-rag-informed-high-reasoning-repair-reuse-review-candidate-builder.mjs",
        "validate_tlcl_rag_informed_high_reasoning_repair_reuse_review_receipt",
        "validate-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs",
        "validate_tlcl_reasoning_budget_governor_review_receipt",
        "validate-tlcl-reasoning-budget-governor-review-receipt.mjs",
        "create_tlcl_reasoning_budget_medium_reuse_handoff",
        "create-tlcl-reasoning-budget-medium-reuse-handoff.mjs"
      ]) &&
      hasAll(files.toolSurfaceSmoke, [
        "MCP advanced mode exposes and runs TLCL status refresh",
        "MCP advanced mode exposes and creates TLCL capability provider intake",
        "MCP advanced mode exposes and creates TLCL capability provider qualification plan",
        "MCP advanced mode exposes and runs TLCL capability provider qualification no-action runner",
        "MCP advanced mode exposes and runs TLCL runtime gate",
        "MCP advanced mode exposes and runs TLCL reasoning budget governor",
        "MCP advanced mode exposes and validates TLCL reasoning budget governor review receipt",
        "MCP advanced mode carries TLCL reasoning budget review into medium reuse handoff",
        "MCP advanced mode exposes and runs TLCL medium runtime dry-run prep",
        "MCP advanced mode exposes and validates TLCL medium dry-run prep review receipt",
        "MCP advanced mode exposes and runs TLCL medium dry-run route review handoff",
        "MCP advanced mode exposes and validates TLCL medium dry-run route review receipt",
        "MCP advanced mode exposes and runs TLCL medium dry-run-only runner",
        "MCP advanced mode exposes and validates TLCL medium dry-run-only post-run receipt",
        "MCP advanced mode exposes and runs TLCL medium execution approval gate prep runner",
        "MCP advanced mode exposes and creates TLCL medium approved-gate command builder",
        "MCP advanced mode exposes and blocks TLCL medium approved-gate runner without execute flag",
        "MCP advanced mode exposes and validates TLCL medium approved outcome review correction",
        "MCP advanced mode exposes and validates TLCL bounded medium workflow reuse",
        "MCP advanced mode exposes and plans TLCL bounded medium workflow invocation",
        "MCP advanced mode exposes and prepares TLCL reusable workflow invocation approval gate",
        "MCP advanced mode exposes and creates TLCL reusable workflow invocation approved-gate command builder",
        "MCP advanced mode exposes and runs TLCL reusable workflow invocation approved-gate runner",
        "MCP advanced mode exposes and validates TLCL reusable workflow invocation approved outcome review correction",
        "MCP advanced mode exposes and creates TLCL reusable workflow high-reasoning repair intake",
        "MCP advanced mode exposes and creates TLCL reusable workflow high-reasoning repair draft package",
        "MCP advanced mode exposes and validates TLCL reusable workflow high-reasoning repair draft review",
        "MCP advanced mode exposes and creates TLCL reusable workflow high-reasoning repair regression validation package",
        "MCP advanced mode exposes and validates TLCL reusable workflow high-reasoning repair fingerprint review",
        "MCP advanced mode exposes and rebuilds TLCL reusable workflow high-reasoning repair approval gate",
        "MCP advanced mode exposes and creates TLCL reusable workflow high-reasoning repair approved-gate command builder",
        "MCP advanced mode exposes and runs TLCL reusable workflow high-reasoning repair approved-gate runner",
        "MCP advanced mode exposes and validates TLCL reusable workflow high-reasoning repair fresh outcome review",
        "MCP advanced mode exposes and validates TLCL reusable workflow high-reasoning repair reuse review",
        "MCP advanced mode exposes and plans TLCL repaired reusable workflow invocation",
        "MCP advanced mode exposes and prepares TLCL repaired reusable workflow invocation approval gate",
        "MCP advanced mode exposes and creates TLCL repaired reusable workflow invocation approved-gate command builder",
        "MCP advanced mode exposes and runs TLCL repaired reusable workflow invocation approved-gate runner",
        "MCP advanced mode exposes and validates TLCL repaired reusable workflow invocation fresh outcome review",
        "MCP advanced mode exposes TLCL repaired reusable workflow invocation reuse review and replans safely",
        "MCP advanced mode attaches reviewed RAG evidence to TLCL without authorization",
        "MCP advanced mode creates RAG-informed high-reasoning repair intake without medium runtime",
        "Default teach_apprentice creates RAG-informed high-reasoning repair intake without medium runtime",
        "MCP advanced mode compiles RAG-informed repair draft package as disabled rules",
        "Default teach_apprentice compiles RAG-informed repair draft package as disabled rules",
        "MCP advanced mode validates RAG-informed repair draft review without execution",
        "Default teach_apprentice validates RAG-informed repair draft review receipt without execution",
        "MCP advanced mode creates RAG-informed deterministic validation package",
        "Default teach_apprentice creates RAG-informed deterministic validation package",
        "MCP advanced mode validates RAG-informed workflow fingerprint review without rebuilding gate",
        "Default teach_apprentice validates RAG-informed workflow fingerprint review without rebuilding gate",
        "MCP advanced mode rebuilds RAG-informed repair approval gate without execution",
        "Default teach_apprentice rebuilds RAG-informed repair approval gate without execution",
        "MCP advanced mode creates RAG-informed repair approved-gate command builder without execution",
        "Default teach_apprentice creates RAG-informed repair approved-gate command builder without execution",
        "MCP advanced mode invokes RAG-informed repair approved-gate runner without overclaiming completion",
        "Default teach_apprentice runs RAG-informed repair approved-gate runner with final confirmation locks",
        "MCP advanced mode validates RAG-informed fresh outcome review before reuse or repair",
        "Default teach_apprentice validates RAG-informed fresh outcome review before reuse or repair",
        "MCP advanced mode validates RAG-informed repair reuse before medium-runtime replanning",
        "Default teach_apprentice validates RAG-informed repair reuse before medium-runtime replanning",
        "MCP advanced mode feeds RAG-informed repair reuse into repaired invocation planner",
        "Default teach_apprentice feeds RAG-informed repair reuse into repaired invocation planner",
        "MCP advanced mode prepares RAG-informed repaired invocation approval gate with non-authority locks",
        "Default teach_apprentice prepares RAG-informed repaired invocation approval gate with non-authority locks",
        "MCP advanced mode builds RAG-informed repaired invocation approved-gate command with non-authority locks",
        "Default teach_apprentice builds RAG-informed repaired invocation approved-gate command with non-authority locks",
        "MCP advanced mode runs RAG-informed repaired invocation approved gate with non-authority locks",
        "Default teach_apprentice runs RAG-informed repaired invocation approved gate with non-authority locks",
        "MCP advanced mode validates RAG-informed repaired invocation fresh outcome with non-authority locks",
        "Default teach_apprentice validates RAG-informed repaired invocation fresh outcome with non-authority locks",
        "Default teach_apprentice validates RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice replans from RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice advances second-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates second-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice replans from second-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice advances third-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates third-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice replans from third-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice advances fourth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fourth-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice replans from fourth-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice advances fifth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fifth-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice replans from fifth-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice advances sixth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates sixth-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice replans from sixth-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice advances seventh-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates seventh-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice replans from seventh-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice advances eighth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates eighth-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice replans from eighth-cycle RAG-informed repaired invocation reuse review with non-authority locks",
        "Default teach_apprentice advances ninth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates ninth-cycle RAG-informed repaired invocation reuse review and tenth planner with non-authority locks",
        "Default teach_apprentice advances tenth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates tenth-cycle RAG-informed repaired invocation reuse review and eleventh planner with non-authority locks",
        "Default teach_apprentice advances eleventh-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates eleventh-cycle RAG-informed repaired invocation reuse review and twelfth planner with non-authority locks",
        "Default teach_apprentice advances twelfth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twelfth-cycle RAG-informed repaired invocation reuse review and thirteenth planner with non-authority locks",
        "Default teach_apprentice advances thirteenth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirteenth-cycle RAG-informed repaired invocation reuse review and fourteenth planner with non-authority locks",
        "Default teach_apprentice advances fourteenth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fourteenth-cycle RAG-informed repaired invocation reuse review and fifteenth planner with non-authority locks",
        "Default teach_apprentice advances fifteenth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fifteenth-cycle RAG-informed repaired invocation reuse review and sixteenth planner with non-authority locks",
        "Default teach_apprentice advances sixteenth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates sixteenth-cycle RAG-informed repaired invocation reuse review and seventeenth planner with non-authority locks",
        "Default teach_apprentice advances seventeenth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates seventeenth-cycle RAG-informed repaired invocation reuse review and eighteenth planner with non-authority locks",
        "Default teach_apprentice advances eighteenth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates eighteenth-cycle RAG-informed repaired invocation reuse review and nineteenth planner with non-authority locks",
        "Default teach_apprentice advances nineteenth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates nineteenth-cycle RAG-informed repaired invocation reuse review and twentieth planner with non-authority locks",
        "Default teach_apprentice advances twentieth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twentieth-cycle RAG-informed repaired invocation reuse review and twenty-first planner with non-authority locks",
        "Default teach_apprentice advances twenty-first-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-first-cycle RAG-informed repaired invocation reuse review and twenty-second planner with non-authority locks",
        "Default teach_apprentice advances twenty-second-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-second-cycle RAG-informed repaired invocation reuse review and twenty-third planner with non-authority locks",
        "Default teach_apprentice advances twenty-third-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-third-cycle RAG-informed repaired invocation reuse review and twenty-fourth planner with non-authority locks",
        "Default teach_apprentice advances twenty-fourth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-fourth-cycle RAG-informed repaired invocation reuse review and twenty-fifth planner with non-authority locks",
        "Default teach_apprentice advances twenty-fifth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-fifth-cycle RAG-informed repaired invocation reuse review and twenty-sixth planner with non-authority locks",
        "Default teach_apprentice advances twenty-sixth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-sixth-cycle RAG-informed repaired invocation reuse review and twenty-seventh planner with non-authority locks",
        "Default teach_apprentice advances twenty-seventh-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-seventh-cycle RAG-informed repaired invocation reuse review and twenty-eighth planner with non-authority locks",
        "Default teach_apprentice advances twenty-eighth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-eighth-cycle RAG-informed repaired invocation reuse review and twenty-ninth planner with non-authority locks",
        "Default teach_apprentice advances twenty-ninth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates twenty-ninth-cycle RAG-informed repaired invocation reuse review and thirtieth planner with non-authority locks",
        "Default teach_apprentice advances thirtieth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirtieth-cycle RAG-informed repaired invocation reuse review and thirty-first planner with non-authority locks",
        "Default teach_apprentice advances thirty-first-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-first-cycle RAG-informed repaired invocation reuse review and thirty-second planner with non-authority locks",
        "Default teach_apprentice advances thirty-second-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-second-cycle RAG-informed repaired invocation reuse review and thirty-third planner with non-authority locks",
        "Default teach_apprentice advances thirty-third-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-third-cycle RAG-informed repaired invocation reuse review and thirty-fourth planner with non-authority locks",
        "Default teach_apprentice advances thirty-fourth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-fourth-cycle RAG-informed repaired invocation reuse review and thirty-fifth planner with non-authority locks",
        "Default teach_apprentice advances thirty-fifth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-fifth-cycle RAG-informed repaired invocation reuse review and thirty-sixth planner with non-authority locks",
        "Default teach_apprentice advances thirty-sixth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-sixth-cycle RAG-informed repaired invocation reuse review and thirty-seventh planner with non-authority locks",
        "Default teach_apprentice advances thirty-seventh-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-seventh-cycle RAG-informed repaired invocation reuse review and thirty-eighth planner with non-authority locks",
        "Default teach_apprentice advances thirty-eighth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-eighth-cycle RAG-informed repaired invocation reuse review and thirty-ninth planner with non-authority locks",
        "Default teach_apprentice advances thirty-ninth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates thirty-ninth-cycle RAG-informed repaired invocation reuse review and fortieth planner with non-authority locks",
        "Default teach_apprentice advances fortieth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fortieth-cycle RAG-informed repaired invocation reuse review and forty-first planner with non-authority locks",
        "Default teach_apprentice advances forty-first-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-first-cycle RAG-informed repaired invocation reuse review and forty-second planner with non-authority locks",
        "Default teach_apprentice advances forty-second-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-second-cycle RAG-informed repaired invocation reuse review and forty-third planner with non-authority locks",
        "Default teach_apprentice advances forty-third-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-third-cycle RAG-informed repaired invocation reuse review and forty-fourth planner with non-authority locks",
        "Default teach_apprentice advances forty-fourth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-fourth-cycle RAG-informed repaired invocation reuse review and forty-fifth planner with non-authority locks",
        "Default teach_apprentice advances forty-fifth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-fifth-cycle RAG-informed repaired invocation reuse review and forty-sixth planner with non-authority locks",
        "Default teach_apprentice advances forty-sixth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-sixth-cycle RAG-informed repaired invocation reuse review and forty-seventh planner with non-authority locks",
        "Default teach_apprentice advances forty-seventh-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-seventh-cycle RAG-informed repaired invocation reuse review and forty-eighth planner with non-authority locks",
        "Default teach_apprentice advances forty-eighth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-eighth-cycle RAG-informed repaired invocation reuse review and forty-ninth planner with non-authority locks",
        "Default teach_apprentice advances forty-ninth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates forty-ninth-cycle RAG-informed repaired invocation reuse review and fiftieth planner with non-authority locks",
        "Default teach_apprentice advances fiftieth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fiftieth-cycle RAG-informed repaired invocation reuse review and fifty-first planner with non-authority locks",
        "Default teach_apprentice advances fifty-first-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fifty-first-cycle RAG-informed repaired invocation reuse review and fifty-second planner with non-authority locks",
        "Default teach_apprentice advances fifty-second-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fifty-second-cycle RAG-informed repaired invocation reuse review and fifty-third planner with non-authority locks",
        "Default teach_apprentice advances fifty-third-cycle RAG-informed repaired invocation gates with non-authority locks",
        "Default teach_apprentice validates fifty-third-cycle RAG-informed repaired invocation reuse review and fifty-fourth planner with non-authority locks",
        "Default teach_apprentice advances fifty-fourth-cycle RAG-informed repaired invocation gates with non-authority locks",
        "validate_tlcl_capability_provider_qualification_result_receipt",
        "MCP advanced mode exposes and validates TLCL capability provider qualification result receipt",
        "create_tlcl_capability_provider_activation_review_candidate_builder",
        "validate_tlcl_capability_provider_activation_review_receipt",
        "create_tlcl_capability_provider_role_use_planner",
        "MCP advanced mode creates and validates TLCL capability provider activation review",
        "MCP advanced mode creates TLCL provider role-use plan before the next role gate",
        "providerRoleUsePlanAccepted",
        "advancedNames.length === 363"
      ]) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-status-refresh"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-status-refresh.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-capability-provider-intake"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-capability-provider-intake.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-capability-provider-qualification-plan"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-capability-provider-qualification-plan.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-capability-provider-qualification-no-action-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-capability-provider-qualification-no-action-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-capability-provider-qualification-result-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-capability-provider-qualification-result-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-capability-provider-activation-review"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-capability-provider-activation-review.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-capability-provider-role-use-planner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-capability-provider-role-use-planner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-runtime-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-runtime-gate.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-runtime-gate-provider-role-plan"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-runtime-gate-provider-role-plan.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-reasoning-budget-governor-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-reasoning-budget-governor-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-reasoning-budget-medium-reuse-handoff"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-reasoning-budget-medium-reuse-handoff.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-dry-run-prep"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-dry-run-prep.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-dry-run-prep-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-dry-run-prep-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-dry-run-route-review-handoff"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-dry-run-route-review-handoff.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-dry-run-route-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-dry-run-route-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-dry-run-only-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-dry-run-only-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-dry-run-only-post-run-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-execution-approval-gate-prep-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-execution-approval-gate-prep-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-approved-gate-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-approved-gate-command-builder.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-approved-gate-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-approved-gate-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-approved-gate-outcome-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-evidence-attachment"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-evidence-attachment.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-intake"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-intake.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-draft-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-workflow-fingerprint-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-approval-gate-rebuild-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approval-gate-rebuild-package.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-activation"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-activation.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-planner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.[
          "smoke:plugin-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner"
        ] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.[
          "smoke:plugin-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder"
        ] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.[
          "smoke:plugin-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner"
        ] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.[
          "smoke:plugin-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt"
        ] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.[
          "smoke:plugin-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt"
        ] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs"),
    evidence:
      "the model-cost strategy is now represented as a TLCL status refresh, runtime gate, reasoning-tier schema, docs, and smoke gates: high reasoning compiles and repairs contracts, medium reasoning executes reviewed workflows, low reasoning handles fixed transforms, validators judge, and corrections escalate back to senior compile"
  },
  {
    requirement: "Provides one low-token TLCL direction console for next safe route selection",
    pass:
      hasAll(files.tlclDirectionOperationalConsole, [
        "transparent_ai_tlcl_direction_operational_console_v1",
        "route_to_tlcl_apprentice_session_launcher",
        "route_to_rag_evidence_then_contract_compile",
        "route_to_highest_reasoning_contract_repair",
        "route_to_reasoning_budget_governor_before_medium_runtime",
        "smoke:plugin-tlcl-rag-return-chain-coverage-audit",
        "create-tlcl-reasoning-budget-governor.mjs",
        "create-tlcl-rag-evidence-attachment.mjs",
        "create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
        "modelInvoked: false",
        "ragFetched: false",
        "targetSoftwareCommandsExecuted: false",
        "memoryWritten: false",
        "ruleEnabled: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.tlclDirectionOperationalConsoleSmoke, [
        "transparent_ai_tlcl_direction_operational_console_smoke_v1",
        "RAG route keeps knowledge evidence non-authoritative",
        "Teacher correction routes back to high reasoning repair",
        "Runtime intent routes through reasoning budget before medium reuse"
      ]) &&
      files.mcp.includes("create_tlcl_direction_operational_console") &&
      files.readme.includes("create-tlcl-direction-operational-console") &&
      files.readme.includes("create_tlcl_direction_operational_console") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-direction-operational-console"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-direction-operational-console.mjs"),
    evidence:
      "the current TLCL direction now has one review-only console that routes to launcher, RAG evidence, high-reasoning repair, or reasoning-budget review without model, RAG fetch, software execution, memory, rule enablement, packaging, or completion claims"
  },
  {
    requirement: "Gates the selected TLCL next route with explicit input contracts before manual use",
    pass:
      hasAll(files.tlclNextRouteInputContract, [
        "transparent_ai_tlcl_next_route_input_contract_v1",
        "route_to_tlcl_apprentice_session_launcher",
        "route_to_rag_evidence_then_contract_compile",
        "route_to_highest_reasoning_contract_repair",
        "route_to_reasoning_budget_governor_before_medium_runtime",
        "reviewed_tlcl_rag_evidence_attachment",
        "rollback_point_retained",
        "reviewed_rag_validation_path",
        "reasoning_budget_review",
        "nextToolExecuted: false",
        "modelInvoked: false",
        "ragFetched: false",
        "targetSoftwareCommandsExecuted: false",
        "memoryWritten: false",
        "ruleEnabled: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.tlclNextRouteInputContractSmoke, [
        "transparent_ai_tlcl_next_route_input_contract_smoke_v1",
        "Default launcher route requires teacher route choice before downstream use",
        "RAG evidence route requires TLCL packet, reviewed RAG validation, and teacher confirmation",
        "Correction route becomes ready only with reviewed RAG attachment and retained rollback",
        "Medium runtime route requires budget review, activation validation, and rollback"
      ]) &&
      files.mcp.includes("create_tlcl_next_route_input_contract") &&
      files.readme.includes("create-tlcl-next-route-input-contract") &&
      files.readme.includes("create_tlcl_next_route_input_contract") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-next-route-input-contract"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-next-route-input-contract.mjs"),
    evidence:
      "selected TLCL routes now have a review-only input contract that requires evidence, teacher confirmation, and rollback before any next-route tool can be prepared"
  },
  {
    requirement: "Validates teacher receipts for selected TLCL next-route input contracts before handoff",
    pass:
      hasAll(files.tlclNextRouteInputContractReceiptBuilder, [
        "transparent_ai_tlcl_next_route_input_contract_receipt_builder_v1",
        "transparent_ai_tlcl_next_route_input_contract_receipt_v1",
        "provide_missing_inputs_for_regeneration",
        "approve_manual_next_route_use",
        "doesNotRunNextTool: true",
        "doesNotRegenerateInputContract: true"
      ]) &&
      hasAll(files.tlclNextRouteInputContractReceiptValidation, [
        "transparent_ai_tlcl_next_route_input_contract_receipt_validation_v1",
        "input_contract_receipt_ready_for_input_contract_regeneration",
        "input_contract_receipt_ready_for_manual_next_route_use",
        "blocked_for_forbidden_decision",
        "suggestedRegenerationCommand",
        "suggestedNextCommand",
        "executeNow: false",
        "doesNotRunNextTool: true",
        "doesNotRegenerateInputContract: true"
      ]) &&
      hasAll(files.tlclNextRouteInputContractReceiptSmoke, [
        "transparent_ai_tlcl_next_route_input_contract_receipt_smoke_v1",
        "Validator blocks manual next-route approval while input contract is still missing evidence",
        "Validator can prepare input-contract regeneration handoff from supplied missing inputs",
        "Validator approves ready input contract only as manual next-route handoff",
        "Validator fails closed on forbidden execute decisions"
      ]) &&
      files.mcp.includes("create_tlcl_next_route_input_contract_receipt_builder") &&
      files.mcp.includes("validate_tlcl_next_route_input_contract_receipt") &&
      files.readme.includes("create-tlcl-next-route-input-contract-receipt-builder") &&
      files.readme.includes("validate-tlcl-next-route-input-contract-receipt") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-next-route-input-contract-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-next-route-input-contract-receipt.mjs"),
    evidence:
      "teacher receipts now validate selected-route evidence and can only prepare input-contract regeneration or manual next-route handoff with execution locked"
  },
  {
    requirement: "Plans missing TLCL next-route evidence acquisition through existing tools before regeneration",
    pass:
      hasAll(files.tlclNextRouteEvidenceAcquisitionPlan, [
        "transparent_ai_tlcl_next_route_evidence_acquisition_plan_v1",
        "reviewed_tlcl_rag_evidence_attachment",
        "rollback_point_retained",
        "tlcl_packet_path",
        "reviewed_rag_validation_path",
        "teacher_confirmation",
        "create-tlcl-rag-evidence-attachment.mjs",
        "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
        "create-tlcl-next-route-input-contract.mjs",
        "evidenceAcquisitionPlanOnly: true",
        "modelInvoked: false",
        "ragFetched: false",
        "nextToolExecuted: false",
        "targetSoftwareCommandsExecuted: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.tlclNextRouteEvidenceAcquisitionPlanSmoke, [
        "Repair route creates evidence acquisition plan for RAG attachment and rollback",
        "RAG route reuses reviewed RAG lane without external fetch or authority shortcut",
        "Ready contract produces no acquisition actions and still refuses execution"
      ]) &&
      files.mcp.includes("create_tlcl_next_route_evidence_acquisition_plan") &&
      files.mcp.includes("create-tlcl-next-route-evidence-acquisition-plan.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates TLCL next-route evidence acquisition plan") &&
      files.readme.includes("create-tlcl-next-route-evidence-acquisition-plan") &&
      files.readme.includes("create_tlcl_next_route_evidence_acquisition_plan") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-next-route-evidence-acquisition-plan"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-next-route-evidence-acquisition-plan.mjs"),
    evidence:
      "missing next-route evidence now becomes a review-only runbook that reuses RAG, rollback, receipt, reasoning-budget, and reusable-workflow tools before any regeneration or next-route handoff"
  },
  {
    requirement: "Gates TLCL next-route evidence acquisition plans with teacher receipts before input-contract regeneration",
    pass:
      hasAll(files.tlclNextRouteEvidenceAcquisitionPlanReceiptBuilder, [
        "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_builder_v1",
        "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_v1",
        "provide_evidence_for_input_contract_regeneration",
        "correction_to_high_reasoning_repair",
        "doesNotRegenerateInputContract: true",
        "doesNotRunNextTool: true",
        "modelInvoked: false",
        "ragFetched: false"
      ]) &&
      hasAll(files.tlclNextRouteEvidenceAcquisitionPlanReceiptValidation, [
        "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_validation_v1",
        "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_validation_result_v1",
        "evidence_plan_receipt_ready_for_input_contract_regeneration",
        "blocked_for_forbidden_decision",
        "ragEvidenceOnlyConfirmed",
        "rollbackRetained",
        "transparent_ai_tlcl_next_route_evidence_plan_input_contract_regeneration_handoff_v1",
        "doesNotRegenerateInputContract: true",
        "doesNotRunNextTool: true"
      ]) &&
      hasAll(files.tlclNextRouteEvidenceAcquisitionPlanReceiptSmoke, [
        "transparent_ai_tlcl_next_route_evidence_acquisition_plan_receipt_smoke_v1",
        "Receipt builder creates teacher-fillable evidence plan receipt",
        "Validator prepares input-contract regeneration handoff from reviewed evidence",
        "Validator fails closed on forbidden execute decisions",
        "Validator acknowledges no missing inputs without executing next tool"
      ]) &&
      files.mcp.includes("create_tlcl_next_route_evidence_acquisition_plan_receipt_builder") &&
      files.mcp.includes("validate_tlcl_next_route_evidence_acquisition_plan_receipt") &&
      files.mcp.includes("create-tlcl-next-route-evidence-acquisition-plan-receipt-builder.mjs") &&
      files.mcp.includes("validate-tlcl-next-route-evidence-acquisition-plan-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode builds TLCL next-route evidence acquisition plan receipt") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates TLCL next-route evidence acquisition plan receipt") &&
      files.readme.includes("create-tlcl-next-route-evidence-acquisition-plan-receipt-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-next-route-evidence-acquisition-plan-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-next-route-evidence-acquisition-plan-receipt.mjs"),
    evidence:
      "teacher-reviewed evidence receipts now prepare only manual input-contract regeneration handoffs while blocking execution shortcuts and preserving RAG evidence-only boundaries"
  },
  {
    requirement: "Turns validated TLCL evidence-plan receipts into copy-only regeneration command pages",
    pass:
      hasAll(files.tlclNextRouteEvidencePlanRegenerationCommandBuilder, [
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_v1",
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_v1",
        "evidence_plan_regeneration_command_builder_waiting_for_teacher_copy",
        "blocked_before_evidence_plan_regeneration_command_builder",
        "builderDoesNotRegenerateInputContract: true",
        "builderDoesNotRunCommand: true",
        "inputContractRegenerated: false",
        "commandExecuted: false",
        "modelInvoked: false",
        "ragFetched: false"
      ]) &&
      hasAll(files.tlclNextRouteEvidencePlanRegenerationCommandBuilderSmoke, [
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_command_builder_smoke_v1",
        "Command builder creates copy-only regeneration request from ready evidence receipt validation",
        "Command builder blocks forbidden evidence receipt validation before command copy",
        "Command builder blocks no-missing-input acknowledgement from regeneration command copy"
      ]) &&
      files.mcp.includes("create_tlcl_next_route_evidence_plan_regeneration_command_builder") &&
      files.mcp.includes("create-tlcl-next-route-evidence-plan-regeneration-command-builder.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode builds TLCL evidence plan regeneration command page") &&
      files.readme.includes("create-tlcl-next-route-evidence-plan-regeneration-command-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-next-route-evidence-plan-regeneration-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-next-route-evidence-plan-regeneration-command-builder.mjs"),
    evidence:
      "ready evidence-plan receipt validations can now produce a teacher copy page, while blocked and no-missing routes cannot regenerate input contracts or run commands"
  },
  {
    requirement: "Requires teacher receipt before validated TLCL evidence-plan regeneration requests can be used manually",
    pass:
      hasAll(files.tlclNextRouteEvidencePlanRegenerationRequestReceiptBuilder, [
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_builder_v1",
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_v1",
        "evidence_plan_regeneration_request_receipt_builder_waiting_for_teacher_review",
        "builderDoesNotRunCommand: true",
        "builderDoesNotRegenerateInputContract: true"
      ]) &&
      hasAll(files.tlclNextRouteEvidencePlanRegenerationRequestReceiptValidation, [
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_validation_v1",
        "evidence_plan_regeneration_request_reviewed_waiting_for_separate_manual_use",
        "blocked_for_forbidden_regeneration_request_receipt_decision",
        "transparent_ai_tlcl_next_route_evidence_plan_manual_input_contract_regeneration_use_v1",
        "validatorDoesNotRunCommand: true",
        "validatorDoesNotRegenerateInputContract: true",
        "confirmedRetainedRollbackPoint"
      ]) &&
      hasAll(files.tlclNextRouteEvidencePlanRegenerationRequestReceiptSmoke, [
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_request_receipt_smoke_v1",
        "Request receipt validation allows only reviewed separate manual regeneration use",
        "Request receipt validation blocks execute-now decisions",
        "Request receipt validation blocks reviewed command mismatches"
      ]) &&
      files.mcp.includes("create_tlcl_next_route_evidence_plan_regeneration_request_receipt_builder") &&
      files.mcp.includes("validate_tlcl_next_route_evidence_plan_regeneration_request_receipt") &&
      files.mcp.includes("create-tlcl-next-route-evidence-plan-regeneration-request-receipt-builder.mjs") &&
      files.mcp.includes("validate-tlcl-next-route-evidence-plan-regeneration-request-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode builds TLCL evidence plan regeneration request receipt") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates TLCL evidence plan regeneration request receipt") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-tlcl-next-route-evidence-plan-regeneration-request-receipt-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-next-route-evidence-plan-regeneration-request-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-next-route-evidence-plan-regeneration-request-receipt.mjs"),
    evidence:
      "copy-only regeneration requests now require teacher-reviewed route, command, evidence rows, locks, and rollback confirmation before any separate manual use"
  },
  {
    requirement: "Returns manual TLCL evidence-plan regeneration results through a reviewed input-contract receipt",
    pass:
      hasAll(files.tlclNextRouteEvidencePlanRegenerationManualResultReceiptBuilder, [
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_builder_v1",
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_v1",
        "evidence_plan_regeneration_manual_result_receipt_builder_waiting_for_teacher_result_evidence",
        "builderDoesNotRunCommand: true",
        "builderDoesNotRegenerateInputContract: true"
      ]) &&
      hasAll(files.tlclNextRouteEvidencePlanRegenerationManualResultReceiptValidation, [
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_validation_v1",
        "transparent_ai_tlcl_next_route_reviewed_regenerated_input_contract_v1",
        "regeneration_manual_result_reviewed_waiting_for_next_route_contract_review",
        "blocked_for_forbidden_regeneration_manual_result_decision",
        "regenerated_input_contract_not_ready_for_next_tool",
        "validatorDoesNotRegenerateInputContract: true",
        "validatorDoesNotRunCommand: true"
      ]) &&
      hasAll(files.tlclNextRouteEvidencePlanRegenerationManualResultReceiptSmoke, [
        "transparent_ai_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_smoke_v1",
        "Manual regeneration result receipt validates reviewed ready input contract",
        "Manual regeneration result receipt blocks execute-now decisions",
        "Manual regeneration result receipt blocks not-ready regenerated contracts"
      ]) &&
      files.mcp.includes("create_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt_builder") &&
      files.mcp.includes("validate_tlcl_next_route_evidence_plan_regeneration_manual_result_receipt") &&
      files.mcp.includes("create-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builder.mjs") &&
      files.mcp.includes("validate-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode builds TLCL evidence plan regeneration manual result receipt") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates TLCL evidence plan regeneration manual result receipt") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-next-route-evidence-plan-regeneration-manual-result-receipt.mjs"),
    evidence:
      "manual regeneration results now require a reviewed regenerated input contract, readyForNextTool=true, retained rollback, and locked no-action validation before next-route review"
  },
  {
    requirement: "Routes reviewed regenerated TLCL input contracts back through the next teacher gate before use",
    pass:
      hasAll(files.tlclNextRouteRegeneratedInputContractReviewRouter, [
        "transparent_ai_tlcl_next_route_regenerated_input_contract_review_router_v1",
        "build_input_contract_receipt_for_regenerated_contract",
        "send_regeneration_result_to_high_reasoning_contract_repair",
        "routerDoesNotRunNextTool: true",
        "inputContractReceiptBuilt: false"
      ]) &&
      hasAll(files.tlclNextRouteRegeneratedInputContractReviewSelectionValidation, [
        "transparent_ai_tlcl_next_route_regenerated_input_contract_review_selection_validation_v1",
        "regenerated_input_contract_review_selection_ready_for_manual_preparation",
        "blocked_for_forbidden_regenerated_contract_review_selection",
        "validatorDoesNotBuildInputContractReceipt: true",
        "nextToolExecuted: false"
      ]) &&
      hasAll(files.tlclNextRouteRegeneratedInputContractReviewRouterSmoke, [
        "transparent_ai_tlcl_next_route_regenerated_input_contract_review_router_smoke_v1",
        "Reviewed regenerated input contract routes to normal input-contract receipt gate",
        "Regenerated input contract review selection blocks execute-now decisions",
        "Regenerated input contract review can route correction back to high reasoning"
      ]) &&
      files.mcp.includes("create_tlcl_next_route_regenerated_input_contract_review_router") &&
      files.mcp.includes("validate_tlcl_next_route_regenerated_input_contract_review_selection") &&
      files.mcp.includes("create-tlcl-next-route-regenerated-input-contract-review-router.mjs") &&
      files.mcp.includes("validate-tlcl-next-route-regenerated-input-contract-review-selection.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode routes reviewed regenerated TLCL input contract to next teacher gate") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates regenerated TLCL input contract review selection") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-tlcl-next-route-regenerated-input-contract-review-router") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-tlcl-next-route-regenerated-input-contract-review-router"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-tlcl-next-route-regenerated-input-contract-review-router.mjs"),
    evidence:
      "reviewed regenerated input contracts now return to the normal teacher receipt gate or to high-reasoning repair instead of becoming executable shortcuts"
  },
  {
    requirement: "Starts packaging CAD and engineering software verification through a real-case pilot intake",
    pass:
      hasAll(files.realCasePilotIntake, [
        "transparent_ai_real_case_pilot_intake_v1",
        "packaging_box",
        "cad_drawing",
        "prepare_universal_detail_logic",
        "prepare_voice_numbered_confirmation",
        "intakeDoesNotRunNextTool: true",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      hasAll(files.realCasePilotIntakeReceiptValidation, [
        "transparent_ai_real_case_pilot_intake_receipt_validation_v1",
        "real_case_pilot_intake_ready_for_manual_route_preparation",
        "real_case_pilot_intake_waiting_for_missing_evidence_collection",
        "blocked_for_forbidden_real_case_pilot_intake_decision",
        "validatorDoesNotRunNextTool: true",
        "validatorDoesNotExecuteSoftware: true"
      ]) &&
      hasAll(files.realCasePilotIntakeSmoke, [
        "transparent_ai_real_case_pilot_intake_smoke_v1",
        "Packaging real-case pilot intake prepares universal detail logic route",
        "Real-case pilot intake blocks route preparation when required evidence is missing",
        "Real-case pilot intake receipt blocks execute-now decisions"
      ]) &&
      files.mcp.includes("create_real_case_pilot_intake") &&
      files.mcp.includes("validate_real_case_pilot_intake_receipt") &&
      files.mcp.includes("create-real-case-pilot-intake.mjs") &&
      files.mcp.includes("validate-real-case-pilot-intake-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case pilot intake for packaging/CAD validation") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates real-case pilot intake receipt into manual detail-logic handoff") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-pilot-intake") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-pilot-intake"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-pilot-intake.mjs"),
    evidence:
      "real packaging/CAD/engineering cases can now become review-only pilot packages before RAG, universal detail logic, voice confirmation, or high-reasoning repair"
  },
  {
    requirement: "Turns reviewed real-case pilots into draft-disabled Rule DSL candidates before active execution",
    pass:
      hasAll(files.realCaseRuleDslPreparationPackage, [
        "transparent_ai_real_case_rule_dsl_preparation_package_v1",
        "draft_disabled",
        "activeRulePackageCompiled: false",
        "ruleEnabled: false",
        "targetSoftwareCommandsExecuted: false",
        "packagingUnlocked: false",
        "REAL_CASE_RULE_DSL_PREPARATION_REQUIRES_TEACHER_REVIEWED_FLAG"
      ]) &&
      hasAll(files.realCaseRuleDslPreparationPackageSmoke, [
        "transparent_ai_real_case_rule_dsl_preparation_package_smoke_v1",
        "Real-case Rule DSL prep creates draft_disabled candidate rules from packaging constraints",
        "Real-case Rule DSL prep keeps active compilation execution and packaging locked",
        "Real-case Rule DSL prep requires explicit teacher-reviewed flag"
      ]) &&
      files.mcp.includes("create_real_case_rule_dsl_preparation_package") &&
      files.mcp.includes("create-real-case-rule-dsl-preparation-package.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates draft-disabled Rule DSL prep from real-case pilot validation") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-rule-dsl-preparation-package") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-rule-dsl-preparation-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-rule-dsl-preparation-package.mjs"),
    evidence:
      "teacher-reviewed real cases now become draft_disabled Rule Cards with evidence refs while active compilation, execution, memory, and packaging stay locked"
  },
  {
    requirement: "Requires teacher review before real-case draft rules can move toward disabled package planning",
    pass:
      hasAll(files.realCaseRuleDslReviewReceiptBuilder, [
        "transparent_ai_real_case_rule_dsl_review_receipt_builder_v1",
        "transparent_ai_real_case_rule_dsl_review_receipt_v1",
        "logic_matches",
        "logic_mismatch_repair",
        "request_more_evidence",
        "compile_active_package",
        "activeRulePackageCompiled: false"
      ]) &&
      hasAll(files.realCaseRuleDslReviewReceiptValidation, [
        "transparent_ai_real_case_rule_dsl_review_validation_v1",
        "real_case_rule_dsl_review_ready_for_disabled_package_planning",
        "real_case_rule_dsl_review_routes_to_high_reasoning_repair",
        "real_case_rule_dsl_review_waiting_for_more_evidence",
        "blocked_for_forbidden_real_case_rule_dsl_review_decision",
        "validatorDoesNotCompileActivePackage: true",
        "disabledRulePackageCompiled: false",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.realCaseRuleDslReviewGateSmoke, [
        "transparent_ai_real_case_rule_dsl_review_gate_smoke_v1",
        "Real-case Rule DSL review builder creates teacher receipt template",
        "Real-case Rule DSL review validation prepares disabled package planning only after logic match",
        "Real-case Rule DSL review validation routes mismatches to high reasoning repair",
        "Real-case Rule DSL review validation blocks forbidden active compilation decisions"
      ]) &&
      files.mcp.includes("create_real_case_rule_dsl_review_receipt_builder") &&
      files.mcp.includes("validate_real_case_rule_dsl_review_receipt") &&
      files.mcp.includes("create-real-case-rule-dsl-review-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-rule-dsl-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case Rule DSL review receipt builder") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates real-case Rule DSL review receipt to disabled package planning") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-rule-dsl-review-receipt-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-rule-dsl-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-rule-dsl-review-gate.mjs"),
    evidence:
      "real-case candidate rules now require teacher logic-fit review before disabled package planning while mismatch and missing-evidence routes stay locked"
  },
  {
    requirement: "Produces real-case disabled Rule Package Validation Reports as evidence only",
    pass:
      hasAll(files.realCaseDisabledPackageValidationReport, [
        "transparent_ai_real_case_disabled_package_validation_report_v1",
        "REAL_CASE_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG",
        "REAL_CASE_DISABLED_RULES_MUST_APPEAR_AS_LIFECYCLE_SKIPPED_ROWS",
        "REAL_CASE_DISABLED_PACKAGE_MUST_NOT_EVALUATE_RULE_VALIDATORS",
        "deliveryAllowedIsEvidenceOnly: true",
        "disabledRulePackageCompiled: true",
        "activeRulePackageCompiled: false",
        "ruleEnabled: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.realCaseDisabledPackageValidationReportSmoke, [
        "transparent_ai_real_case_disabled_package_validation_report_smoke_v1",
        "Real-case disabled package validation report compiles only draft_disabled rules",
        "Real-case disabled validation report keeps delivery allowed evidence-only without packaging unlock",
        "Real-case disabled validation report requires explicit teacher-reviewed flag"
      ]) &&
      files.mcp.includes("create_real_case_disabled_package_validation_report") &&
      files.mcp.includes("create-real-case-disabled-package-validation-report.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case disabled package Validation Report evidence") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-disabled-package-validation-report") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-disabled-package-validation-report"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-disabled-package-validation-report.mjs"),
    evidence:
      "real-case logic-match rules now compile into disabled packages and lifecycle-skipped Validation Reports without active rule promotion or packaging unlock"
  },
  {
    requirement: "Reviews real-case Validation Reports before lifecycle candidate planning",
    pass:
      hasAll(files.realCaseValidationReportReviewReceiptBuilder, [
        "transparent_ai_real_case_validation_report_review_receipt_builder_v1",
        "transparent_ai_real_case_validation_report_review_receipt_v1",
        "deliveryAllowedEvidenceOnlyConfirmed",
        "ruleEnabled: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.realCaseValidationReportReviewReceiptValidation, [
        "transparent_ai_real_case_validation_report_review_validation_v1",
        "real_case_validation_report_review_ready_for_lifecycle_candidate_planning",
        "blocked_for_forbidden_real_case_validation_report_review_decision",
        "validatorDoesNotPromoteRule: true",
        "nextStepRequiresSeparateTeacherLifecycleGate: true"
      ]) &&
      hasAll(files.realCaseValidationReportReviewGateSmoke, [
        "transparent_ai_real_case_validation_report_review_gate_smoke_v1",
        "Real-case Validation Report review builder creates evidence-only receipt template",
        "Real-case Validation Report review prepares lifecycle candidate handoff without promotion",
        "Real-case Validation Report review routes mismatches to high reasoning repair",
        "Real-case Validation Report review blocks forbidden rule promotion decisions"
      ]) &&
      files.mcp.includes("create_real_case_validation_report_review_receipt_builder") &&
      files.mcp.includes("validate_real_case_validation_report_review_receipt") &&
      files.mcp.includes("create-real-case-validation-report-review-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-validation-report-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case Validation Report review receipt builder") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates real-case Validation Report review to lifecycle candidate handoff") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-validation-report-review-receipt-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-validation-report-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-validation-report-review-gate.mjs"),
    evidence:
      "real-case Validation Reports now require a teacher review receipt before any separate lifecycle candidate planning gate"
  },
  {
    requirement: "Gates real-case lifecycle candidates before review-only planning",
    pass:
      hasAll(files.realCaseLifecycleCandidateReviewReceiptBuilder, [
        "transparent_ai_real_case_lifecycle_candidate_review_receipt_builder_v1",
        "transparent_ai_real_case_lifecycle_candidate_review_receipt_v1",
        "draft_disabled_to_review_only_candidate",
        "activePromotionAllowed: false",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.realCaseLifecycleCandidateReviewReceiptValidation, [
        "transparent_ai_real_case_lifecycle_candidate_review_validation_v1",
        "real_case_lifecycle_candidate_review_ready_for_review_only_package_planning",
        "blocked_for_forbidden_real_case_lifecycle_candidate_review_decision",
        "transparent_ai_real_case_review_only_lifecycle_candidate_handoff_v1",
        "separateActiveGateRequired: true"
      ]) &&
      hasAll(files.realCaseLifecycleCandidateReviewGateSmoke, [
        "transparent_ai_real_case_lifecycle_candidate_review_gate_smoke_v1",
        "Real-case lifecycle candidate review builder creates review-only receipt template",
        "Real-case lifecycle candidate review prepares review-only package planning without active promotion",
        "Real-case lifecycle candidate review routes corrections to high reasoning repair",
        "Real-case lifecycle candidate review blocks active rule activation decisions"
      ]) &&
      files.mcp.includes("create_real_case_lifecycle_candidate_review_receipt_builder") &&
      files.mcp.includes("validate_real_case_lifecycle_candidate_review_receipt") &&
      files.mcp.includes("create-real-case-lifecycle-candidate-review-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-lifecycle-candidate-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case lifecycle candidate review receipt builder") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates real-case lifecycle candidate review to review-only planning") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-lifecycle-candidate-review-receipt-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-lifecycle-candidate-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-lifecycle-candidate-review-gate.mjs"),
    evidence:
      "real-case lifecycle candidates now require teacher review before review_only planning and still block active promotion, execution, memory, RAG fetch, packaging, and completion"
  },
  {
    requirement: "Plans real-case review-only package candidates without applying lifecycle transition",
    pass:
      hasAll(files.realCaseReviewOnlyPackagePlanning, [
        "transparent_ai_real_case_review_only_package_planning_packet_v1",
        "transparent_ai_real_case_review_only_package_planning_packet_result_v1",
        "ready_for_teacher_review_only_package_plan_review",
        "transitionApplied: false",
        "ruleFilesModified: false",
        "reviewOnlyRulePackageCompiled: false",
        "activeRulePackageCompiled: false",
        "requiresSeparateReviewOnlyTransitionGate: true",
        "requiresSeparateActiveGate: true"
      ]) &&
      hasAll(files.realCaseReviewOnlyPackagePlanningSmoke, [
        "transparent_ai_real_case_review_only_package_planning_smoke_v1",
        "Real-case review-only package planning packet stages lifecycle candidates without applying transition",
        "Real-case review-only package planning preserves draft-disabled source rules",
        "Real-case review-only package planning requires teacher-reviewed flag",
        "Real-case review-only package planning rejects non-approved lifecycle validation"
      ]) &&
      files.mcp.includes("create_real_case_review_only_package_planning_packet") &&
      files.mcp.includes("create-real-case-review-only-package-planning-packet.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case review-only package planning packet") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-review-only-package-planning-packet") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-review-only-package-planning"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-review-only-package-planning.mjs"),
    evidence:
      "real-case review_only package planning now stages lifecycle candidates while leaving rule files, package compilation, execution, memory, RAG, packaging, and completion locked"
  },
  {
    requirement: "Compiles real-case review-only transition packages from staged copies without active promotion",
    pass:
      hasAll(files.realCaseReviewOnlyTransitionPackage, [
        "transparent_ai_real_case_review_only_transition_package_v1",
        "transparent_ai_real_case_review_only_transition_package_result_v1",
        "ready_for_teacher_review_only_transition_package_review",
        "staged-review-only-rule-cards",
        "sourceRuleFilesModified: false",
        "reviewOnlyRulePackageCompiled: compiled",
        "activeRulePackageCompiled: false",
        "REAL_CASE_REVIEW_ONLY_PACKAGE_CONTAINS_ACTIVE_RULES"
      ]) &&
      hasAll(files.realCaseReviewOnlyTransitionPackageSmoke, [
        "transparent_ai_real_case_review_only_transition_package_smoke_v1",
        "Real-case review-only transition package compiles review-only copies only",
        "Real-case review-only transition package leaves source draft-disabled rules unchanged",
        "Real-case review-only transition package requires teacher-reviewed flag",
        "Real-case review-only transition package rejects unlocked planning packet"
      ]) &&
      files.mcp.includes("create_real_case_review_only_transition_package") &&
      files.mcp.includes("create-real-case-review-only-transition-package.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case review-only transition package") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-review-only-transition-package") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-review-only-transition-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-review-only-transition-package.mjs"),
    evidence:
      "real-case review_only transition now compiles staged review_only rule copies while keeping draft_disabled sources, active promotion, execution, memory, RAG, packaging, and completion locked"
  },
  {
    requirement: "Gates real-case active promotion planning before active package compilation",
    pass:
      hasAll(files.realCaseActivePromotionReviewReceiptBuilder, [
        "transparent_ai_real_case_active_promotion_review_receipt_builder_v1",
        "transparent_ai_real_case_active_promotion_review_receipt_v1",
        "compile_active_package"
      ]) &&
      hasAll(files.realCaseActivePromotionReviewReceiptValidation, [
        "transparent_ai_real_case_active_promotion_review_validation_v1",
        "real_case_active_promotion_review_ready_for_active_package_planning",
        "blocked_for_forbidden_real_case_active_promotion_review_decision",
        "transparent_ai_real_case_active_promotion_planning_handoff_v1",
        "activePackageCompilationAllowedHere: false",
        "requiresSeparateActiveCompilationGate: true"
      ]) &&
      hasAll(files.realCaseActivePromotionReviewGateSmoke, [
        "transparent_ai_real_case_active_promotion_review_gate_smoke_v1",
        "Real-case active promotion review builder creates planning-only receipt template",
        "Real-case active promotion review prepares active package planning without active compilation",
        "Real-case active promotion review routes corrections to high reasoning repair",
        "Real-case active promotion review blocks forbidden active compilation decisions"
      ]) &&
      files.mcp.includes("create_real_case_active_promotion_review_receipt_builder") &&
      files.mcp.includes("validate_real_case_active_promotion_review_receipt") &&
      files.mcp.includes("create-real-case-active-promotion-review-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-active-promotion-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode creates real-case active promotion review receipt builder"
      ) &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode validates real-case active promotion review to planning handoff"
      ) &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-active-promotion-review-receipt-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-active-promotion-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-active-promotion-review-gate.mjs"),
    evidence:
      "real-case active promotion review now produces only an active package planning handoff while active compilation, rule enablement, execution, memory, RAG, packaging, acceptance, and completion remain locked"
  },
  {
    requirement: "Compiles real-case active rule packages only through a separate teacher-reviewed gate",
    pass:
      hasAll(files.realCaseActiveRulePackageCompilationGate, [
        "transparent_ai_real_case_active_rule_package_compilation_v1",
        "transparent_ai_real_case_active_rule_package_compilation_result_v1",
        "ready_for_teacher_active_rule_package_validation_report_review",
        "compile-rule-package.mjs",
        "activeRulePackageCompiled: compiled",
        "ruleEnabled: false",
        "targetSoftwareCommandsExecuted: false",
        "requiresSeparateValidationReportGate: true"
      ]) &&
      hasAll(files.realCaseActiveRulePackageCompilationGateSmoke, [
        "transparent_ai_real_case_active_rule_package_compilation_gate_smoke_v1",
        "Real-case active rule package compilation gate compiles active copies only",
        "Real-case active rule package contains only active rules and preserves review-only sources",
        "Real-case active rule package compilation requires teacher-reviewed flag",
        "Real-case active rule package compilation rejects non-approved active promotion validation"
      ]) &&
      files.mcp.includes("create_real_case_active_rule_package_compilation_gate") &&
      files.mcp.includes("create-real-case-active-rule-package-compilation-gate.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode compiles real-case active rule package through separate gate"
      ) &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-active-rule-package-compilation-gate") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-active-rule-package-compilation-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-active-rule-package-compilation-gate.mjs"),
    evidence:
      "real-case active package compilation now uses existing deterministic Rule Package compiler on active staged copies while rule enablement, execution, memory, RAG, packaging, acceptance, and completion remain locked"
  },
  {
    requirement: "Evaluates real-case active rule packages through Validation Reports before delivery gates",
    pass:
      hasAll(files.realCaseActivePackageValidationReport, [
        "transparent_ai_real_case_active_package_validation_report_v1",
        "transparent_ai_real_case_active_package_validation_report_result_v1",
        "ready_for_teacher_active_validation_report_delivery_gate_review",
        "active_validation_report_blocks_delivery_pending_teacher_repair_review",
        "evaluateRulePackage",
        "deliveryGateOpened: false",
        "ruleEnabled: false",
        "requiresSeparateDeliveryGate: true"
      ]) &&
      hasAll(files.realCaseActivePackageValidationReportSmoke, [
        "transparent_ai_real_case_active_package_validation_report_smoke_v1",
        "Real-case active package Validation Report allows valid artifact only as evidence",
        "Real-case active package Validation Report records invalid warning without opening delivery gate",
        "Real-case active package Validation Report blocks active blocking failures",
        "Real-case active package Validation Report requires teacher-reviewed flag",
        "Real-case active package Validation Report rejects non-ready active compilation packet"
      ]) &&
      files.mcp.includes("create_real_case_active_package_validation_report") &&
      files.mcp.includes("create-real-case-active-package-validation-report.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case active package Validation Report") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-active-package-validation-report") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-active-package-validation-report"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-active-package-validation-report.mjs"),
    evidence:
      "real-case active Rule Packages now produce deterministic Validation Reports before delivery gates, including active blocking failure coverage while delivery, execution, memory, RAG, packaging, acceptance, and completion stay locked"
  },
  {
    requirement: "Closes real-case active Validation Report delivery gates before execution review",
    pass:
      hasAll(files.realCaseActiveValidationReportDeliveryGate, [
        "transparent_ai_real_case_active_validation_report_delivery_gate_v1",
        "transparent_ai_real_case_active_validation_report_delivery_gate_result_v1",
        "active_delivery_gate_closed_ready_for_teacher_execution_gate_review",
        "REAL_CASE_ACTIVE_DELIVERY_GATE_REQUIRES_ALLOWED_LOCKED_VALIDATION_REPORT_PACKET",
        "deliveryAllowedOnlyMeansActiveBlockingRulesDidNotBlock",
        "mayOpenExecutionGateHere: false",
        "targetSoftwareCommandsExecuted: false",
        "requiresSeparateExecutionGate: true"
      ]) &&
      hasAll(files.realCaseActiveValidationReportDeliveryGateSmoke, [
        "transparent_ai_real_case_active_validation_report_delivery_gate_smoke_v1",
        "Real-case active delivery gate closes valid active Validation Report without execution",
        "Real-case active delivery gate records warning failures as evidence only",
        "Real-case active delivery gate rejects blocking active Validation Reports",
        "Real-case active delivery gate requires teacher-reviewed flag",
        "Real-case active delivery gate rejects packets with opened delivery locks"
      ]) &&
      files.mcp.includes("create_real_case_active_validation_report_delivery_gate") &&
      files.mcp.includes("create-real-case-active-validation-report-delivery-gate.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates closed real-case active delivery gate") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-active-validation-report-delivery-gate") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-active-validation-report-delivery-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-active-validation-report-delivery-gate.mjs"),
    evidence:
      "real-case active Validation Reports now produce closed delivery gates that keep delivery_allowed evidence-only and require a separate teacher execution gate before any software action"
  },
  {
    requirement: "Validates real-case active execution gate receipts into controlled requests without running software",
    pass:
      hasAll(files.realCaseActiveExecutionGateReceiptBuilder, [
        "transparent_ai_real_case_active_execution_gate_receipt_builder_v1",
        "transparent_ai_real_case_active_execution_gate_receipt_v1",
        "ready_for_teacher_real_case_active_execution_gate_review",
        "controlledExecutionRequestCreated: false",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      hasAll(files.realCaseActiveExecutionGateReceiptValidation, [
        "transparent_ai_real_case_active_execution_gate_validation_v1",
        "transparent_ai_real_case_controlled_execution_request_v1",
        "real_case_active_execution_gate_ready_for_controlled_execution_request",
        "requiresSeparateControlledRunner: true",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      hasAll(files.realCaseActiveExecutionGateSmoke, [
        "transparent_ai_real_case_active_execution_gate_smoke_v1",
        "Real-case active execution gate receipt builder prepares no-execution teacher review",
        "Real-case active execution gate validates controlled execution request without running",
        "Real-case active execution gate blocks execute-now decisions",
        "Real-case active execution gate requires explicit execution scope",
        "Real-case active execution gate routes teacher corrections to high-reasoning repair",
        "Real-case active execution gate rejects tampered delivery gate hash"
      ]) &&
      files.mcp.includes("create_real_case_active_execution_gate_receipt_builder") &&
      files.mcp.includes("validate_real_case_active_execution_gate_receipt") &&
      files.mcp.includes("create-real-case-active-execution-gate-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-active-execution-gate-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates real-case active execution gate receipt builder") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates real-case active execution gate receipt") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-active-execution-gate-receipt-builder") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-active-execution-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-active-execution-gate.mjs"),
    evidence:
      "real-case active delivery gates now require a teacher execution gate receipt that can approve only a controlled request for a later separate runner while keeping execution, rules, memory, RAG, packaging, acceptance, and completion locked"
  },
  {
    requirement: "Dry-runs real-case controlled execution requests through a no-op runner gate before any adapter invocation",
    pass:
      hasAll(files.realCaseControlledExecutionRequestDryRun, [
        "transparent_ai_real_case_controlled_execution_dry_run_v1",
        "transparent_ai_real_case_controlled_execution_dry_run_result_v1",
        "real_case_controlled_execution_dry_run_ready_for_teacher_runner_review",
        "adapterInvoked: false",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false",
        "requiresAdapterSpecificGate: true"
      ]) &&
      hasAll(files.realCaseControlledExecutionRequestDryRunSmoke, [
        "transparent_ai_real_case_controlled_execution_dry_run_smoke_v1",
        "Real-case controlled execution dry-run accepts approved request without invoking adapter",
        "Real-case controlled execution dry-run rejects non-ready execution gate validation",
        "Real-case controlled execution dry-run rejects executeNow tampering",
        "Real-case controlled execution dry-run requires retained rollback point",
        "Real-case controlled execution dry-run preserves execution scope and no-op locks"
      ]) &&
      files.mcp.includes("run_real_case_controlled_execution_request_dry_run") &&
      files.mcp.includes("run-real-case-controlled-execution-request-dry-run.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode dry-runs real-case controlled execution request without invoking adapter"
      ) &&
      files.readme.includes("run-real-case-controlled-execution-request-dry-run") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-controlled-execution-request-dry-run"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-controlled-execution-request-dry-run.mjs"),
    evidence:
      "approved real-case controlled execution requests now enter a separate dry-run runner gate that simulates adapter selection while preserving no-op locks until a later teacher-reviewed real runner"
  },
  {
    requirement: "Creates adapter-specific real-runner approval gates from reviewed dry-run receipts without executing software",
    pass:
      hasAll(files.realCaseControlledExecutionDryRunReceiptValidation, [
        "transparent_ai_real_case_adapter_specific_runner_approval_gate_v1",
        "transparent_ai_real_case_adapter_specific_runner_approval_gate_result_v1",
        "transparent_ai_real_case_separate_real_runner_request_v1",
        "real_case_adapter_specific_runner_approval_gate_ready_for_separate_real_runner",
        "requiresFinalTeacherExecuteConfirmation: true",
        "adapterInvoked: false",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      hasAll(files.realCaseAdapterSpecificRunnerApprovalGateSmoke, [
        "transparent_ai_real_case_adapter_specific_runner_approval_gate_smoke_v1",
        "Real-case adapter-specific runner approval gate creates separate real-runner request without execution",
        "Real-case adapter-specific runner approval gate blocks execute-now decisions",
        "Real-case adapter-specific runner approval gate requires adapter id and control channel",
        "Real-case adapter-specific runner approval gate rejects tampered dry-run hash",
        "Real-case adapter-specific runner approval gate routes corrections to high-reasoning repair"
      ]) &&
      files.mcp.includes("validate_real_case_controlled_execution_dry_run_receipt") &&
      files.mcp.includes("validate-real-case-controlled-execution-dry-run-receipt.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode creates real-case adapter-specific runner approval gate without execution"
      ) &&
      files.readme.includes("validate-real-case-controlled-execution-dry-run-receipt") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-adapter-specific-runner-approval-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-adapter-specific-runner-approval-gate.mjs"),
    evidence:
      "reviewed real-case dry-run receipts now create adapter-specific approval gates and separate real-runner requests while still blocking adapter invocation, software commands, UI events, memory, RAG, packaging, acceptance, and completion"
  },
  {
    requirement: "Runs one final teacher-confirmed real-case separate runner from an adapter-specific gate with rollback and controlled output",
    pass:
      hasAll(files.realCaseSeparateRealRunner, [
        "transparent_ai_real_case_separate_real_runner_v1",
        "transparent_ai_real_case_separate_real_runner_result_v1",
        "transparent_ai_real_case_reviewed_node_runner_manifest_v1",
        "real_case_separate_real_runner_completed_waiting_for_teacher_outcome_review",
        "missing_final_teacher_confirmation",
        "fresh_rollback_point_not_found",
        "filesWrittenOutsideRunDir: false",
        "uiEventsSent: false",
        "memoryWritten: false"
      ]) &&
      hasAll(files.realCaseSeparateRealRunnerSmoke, [
        "transparent_ai_real_case_separate_real_runner_smoke_v1",
        "Real-case separate real runner blocks without final execute confirmation",
        "Real-case separate real runner executes one reviewed local manifest into controlled output",
        "Real-case separate real runner requires fresh rollback point",
        "Real-case separate real runner rejects tampered reviewed runner manifest hash"
      ]) &&
      files.mcp.includes("run_real_case_separate_real_runner") &&
      files.mcp.includes("run-real-case-separate-real-runner.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode runs one real-case separate real runner with final confirmation") &&
      files.readme.includes("run-real-case-separate-real-runner") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-separate-real-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-separate-real-runner.mjs"),
    evidence:
      "adapter-specific real-case gates now have a final teacher-confirmed runner path with fresh rollback, reviewed manifest hash checks, controlled output, and closed memory/RAG/packaging/acceptance locks"
  },
  {
    requirement: "Reviews real-case separate runner outcome before memory, rule activation, repair, or completion",
    pass:
      hasAll(files.realCaseSeparateRealRunnerOutcomeReview, [
        "transparent_ai_real_case_separate_real_runner_outcome_review_v1",
        "transparent_ai_real_case_separate_real_runner_confirmed_outcome_handoff_v1",
        "transparent_ai_real_case_separate_real_runner_high_reasoning_repair_handoff_v1",
        "real_case_separate_real_runner_outcome_confirmed_waiting_for_memory_or_rule_gate",
        "real_case_separate_real_runner_outcome_routes_to_high_reasoning_repair",
        "forbidden_teacher_decision",
        "controlled_output_hash_mismatch",
        "targetSoftwareCommandsExecutedAgain: false",
        "requiresSeparateMemoryOrRuleActivationGate: true"
      ]) &&
      hasAll(files.realCaseSeparateRealRunnerOutcomeReviewSmoke, [
        "transparent_ai_real_case_separate_real_runner_outcome_review_smoke_v1",
        "Separate real runner outcome review confirms controlled output without unlocking memory or packaging",
        "Separate real runner outcome review routes teacher correction to high-reasoning repair without execution",
        "Separate real runner outcome review blocks forbidden memory or acceptance decisions",
        "Separate real runner outcome review blocks controlled output hash mismatch",
        "Separate real runner outcome review blocks incomplete teacher review confirmations"
      ]) &&
      files.mcp.includes("validate_real_case_separate_real_runner_outcome_review_receipt") &&
      files.mcp.includes("validate-real-case-separate-real-runner-outcome-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates separate real runner outcome review") &&
      files.readme.includes("validate-real-case-separate-real-runner-outcome-review-receipt") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-separate-real-runner-outcome-review"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-separate-real-runner-outcome-review.mjs"),
    evidence:
      "real-case final runner output now has a teacher outcome review gate that either confirms a controlled output into later durable gates or routes corrections back to high-reasoning repair without executing again"
  },
  {
    requirement: "Prepares durable activation only after confirmed real-case outcome and separate teacher receipt",
    pass:
      hasAll(files.realCaseConfirmedOutcomeDurableActivation, [
        "transparent_ai_real_case_confirmed_outcome_durable_activation_gate_v1",
        "transparent_ai_real_case_confirmed_outcome_durable_activation_request_v1",
        "transparent_ai_real_case_confirmed_outcome_activation_high_reasoning_repair_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1",
        "EXPECTED_CONFIRMED_OUTCOME_REVIEW_FORMAT",
        "confirmed_outcome_source_review_format_mismatch",
        "confirmed_outcome_handoff_source_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceConfirmedOutcomeSourceRunId",
        "confirmed_outcome_branch_missing",
        "real_case_confirmed_outcome_durable_activation_gate_ready_for_separate_activation_runner",
        "real_case_confirmed_outcome_durable_activation_routes_to_high_reasoning_repair",
        "forbidden_teacher_decision",
        "controlled_output_hash_mismatch",
        "requiresSeparateDurableActivationRunner: true",
        "memoryWritten: false",
        "ruleEnabled: false",
        "ragEvidenceTreatedAsAuthority: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeDurableActivationSmoke, [
        "transparent_ai_real_case_confirmed_outcome_durable_activation_gate_smoke_v1",
        "fixture_confirmed_review_packet",
        "source-review-fixture",
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1",
        "Confirmed outcome durable activation gate prepares request without writing memory or enabling rules",
        "Confirmed outcome durable activation gate routes activation-scope correction to high-reasoning repair",
        "Confirmed outcome durable activation gate blocks lost confirmed-outcome source continuity",
        "Confirmed outcome durable activation gate blocks direct memory or rule activation decisions",
        "Confirmed outcome durable activation gate blocks controlled output hash mismatch",
        "Confirmed outcome durable activation gate blocks incomplete activation confirmations"
      ]) &&
      files.mcp.includes("validate_real_case_confirmed_outcome_durable_activation_receipt") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-durable-activation-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates confirmed outcome durable activation gate") &&
      files.toolSurfaceSmoke.includes("sourceConfirmedOutcomeReviewId") &&
      files.toolSurfaceSmoke.includes("sourceConfirmedOutcomeSourceRunId") &&
      files.readme.includes("validate-real-case-confirmed-outcome-durable-activation-receipt") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-durable-activation-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-durable-activation-gate.mjs"),
    evidence:
      "confirmed real-case outcomes now require a separate teacher durable-activation receipt before any memory/rule activation request can be prepared, and the request still cannot execute or mutate durable state"
  },
  {
    requirement: "Runs confirmed outcome durable activation only as a separate candidate-ledger runner",
    pass:
      hasAll(files.realCaseConfirmedOutcomeSeparateDurableActivationRunner, [
        "transparent_ai_real_case_confirmed_outcome_separate_durable_activation_runner_v1",
        "transparent_ai_real_case_confirmed_outcome_durable_activation_ledger_v1",
        "transparent_ai_real_case_confirmed_outcome_memory_candidate_v1",
        "transparent_ai_real_case_confirmed_outcome_rule_activation_candidate_v1",
        "candidate_ledger_only",
        "confirmed_outcome_branch_missing",
        "source_review_format_not_confirmed_outcome",
        "confirmed_outcome_source_ids_missing",
        "source_gate_confirmed_outcome_ids_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceConfirmedOutcomeSourceRunId",
        "missing_final_teacher_activation_confirmation",
        "source_gate_hash_mismatch",
        "forbidden_activation_operation",
        "productionMemoryWritten: false",
        "productionRuleRegistryMutated: false",
        "memoryWritten: false",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeSeparateDurableActivationRunnerSmoke, [
        "transparent_ai_real_case_confirmed_outcome_separate_durable_activation_runner_smoke_v1",
        "Separate durable activation runner writes only candidate ledger files after final teacher confirmation",
        "Separate durable activation runner blocks lost confirmed-outcome source continuity",
        "approvedLedger.confirmedOutcomeBranch",
        "approvedMemoryCandidate.sourceReviewFormat",
        "approvedRuleActivationCandidate.sourceConfirmedOutcomeSourceRunId",
        "Separate durable activation runner blocks missing final teacher confirmation",
        "Separate durable activation runner blocks source gate hash mismatch",
        "Separate durable activation runner blocks direct production memory write or rule enablement",
        "Separate durable activation runner blocks missing fresh rollback point"
      ]) &&
      files.mcp.includes("run_real_case_confirmed_outcome_separate_durable_activation_runner") &&
      files.mcp.includes("run-real-case-confirmed-outcome-separate-durable-activation-runner.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode runs confirmed outcome separate durable activation runner") &&
      files.toolSurfaceSmoke.includes("sourceConfirmedOutcomeReviewId") &&
      files.toolSurfaceSmoke.includes("sourceConfirmedOutcomeSourceRunId") &&
      files.readme.includes("run-real-case-confirmed-outcome-separate-durable-activation-runner") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-separate-durable-activation-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-separate-durable-activation-runner.mjs"),
    evidence:
      "confirmed real-case outcomes can now enter a final teacher-confirmed separate runner that writes only durable candidate ledger files while production memory, rule enablement, RAG authority, packaging, acceptance, and completion stay locked"
  },
  {
    requirement: "Reviews durable candidate ledger files before routing to memory or Rule DSL lifecycle gates",
    pass:
      hasAll(files.realCaseConfirmedOutcomeCandidateLedgerReview, [
        "transparent_ai_real_case_confirmed_outcome_candidate_ledger_review_v1",
        "transparent_ai_real_case_confirmed_outcome_memory_lifecycle_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_candidate_ledger_high_reasoning_repair_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1",
        "confirmed_outcome_branch_missing",
        "source_review_format_not_confirmed_outcome",
        "source_confirmed_outcome_ids_missing",
        "candidate_ledger_source_ids_mismatch",
        "candidate_ledger_confirmed_outcome_branch_missing",
        "memory_candidate_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceConfirmedOutcomeSourceRunId",
        "real_case_confirmed_outcome_candidate_ledger_routes_to_memory_lifecycle_gate",
        "real_case_confirmed_outcome_candidate_ledger_routes_to_rule_dsl_lifecycle_gate",
        "candidate_ledger_hash_mismatch",
        "forbidden_teacher_decision",
        "productionMemoryWritten: false",
        "productionRuleRegistryMutated: false",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeCandidateLedgerReviewSmoke, [
        "transparent_ai_real_case_confirmed_outcome_candidate_ledger_review_gate_smoke_v1",
        "Candidate ledger review routes reviewed memory candidate to memory lifecycle handoff only",
        "Candidate ledger review routes reviewed rule candidate to Rule DSL lifecycle handoff only",
        "Candidate ledger review routes teacher correction to high-reasoning repair",
        "expectedSourceReviewFormat",
        "Candidate ledger review blocks lost confirmed-outcome source continuity",
        "Candidate ledger review blocks missing confirmed-outcome source ids",
        "Candidate ledger review blocks forbidden production memory write or rule enablement decisions",
        "Candidate ledger review blocks candidate ledger hash mismatch",
        "Candidate ledger review blocks incomplete lifecycle confirmations"
      ]) &&
      files.mcp.includes("validate_real_case_confirmed_outcome_candidate_ledger_review_receipt") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-candidate-ledger-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates confirmed outcome candidate ledger review gate") &&
      files.toolSurfaceSmoke.includes("sourceConfirmedOutcomeReviewId") &&
      files.toolSurfaceSmoke.includes("sourceConfirmedOutcomeSourceRunId") &&
      files.readme.includes("validate-real-case-confirmed-outcome-candidate-ledger-review-receipt") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-candidate-ledger-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-candidate-ledger-review-gate.mjs"),
    evidence:
      "durable candidate ledger files now require a teacher review gate before memory lifecycle, Rule DSL lifecycle, or high-reasoning repair routing, while direct production mutation remains locked"
  },
  {
    requirement: "Routes reviewed rule candidates into draft-disabled Rule DSL lifecycle planning only",
    pass:
      hasAll(files.realCaseConfirmedOutcomeRuleDslLifecycle, [
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_gate_v1",
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_planning_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_high_reasoning_repair_handoff_v1",
        "real_case_confirmed_outcome_rule_dsl_lifecycle_ready_for_draft_disabled_planning",
        "rule_activation_candidate_hash_mismatch",
        "forbidden_teacher_decision",
        "proposedLifecycle: \"draft_disabled\"",
        "ruleFilesModified: false",
        "rulePackageCompiled: false",
        "productionRuleRegistryMutated: false",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeRuleDslLifecycle, [
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "source_handoff_source_review_format_mismatch",
        "rule_activation_candidate_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeRuleDslLifecycleSmoke, [
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_lifecycle_gate_smoke_v1",
        "Rule DSL lifecycle gate prepares draft-disabled planning handoff without enabling rules",
        "Rule DSL lifecycle gate routes teacher correction to high-reasoning repair",
        "Rule DSL lifecycle gate blocks active enablement or registry mutation decisions",
        "Rule DSL lifecycle gate blocks rule activation candidate hash mismatch",
        "Rule DSL lifecycle gate blocks incomplete draft-disabled lifecycle confirmations",
        "Rule DSL lifecycle gate blocks lost confirmed-outcome source continuity",
        "Rule DSL lifecycle gate blocks missing retained rollback point"
      ]) &&
      files.mcp.includes("validate_real_case_confirmed_outcome_rule_dsl_lifecycle_receipt") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates confirmed outcome Rule DSL lifecycle gate") &&
      files.readme.includes("validate-real-case-confirmed-outcome-rule-dsl-lifecycle-receipt") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-rule-dsl-lifecycle-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-rule-dsl-lifecycle-gate.mjs"),
    evidence:
      "reviewed rule candidates now require a teacher-filled Rule DSL lifecycle receipt before any draft-disabled planning handoff, while active rule enablement, registry mutation, RAG authority, execution, packaging, acceptance, and completion remain locked"
  },
  {
    requirement: "Writes only draft-disabled Rule Card candidates from confirmed outcome lifecycle planning",
    pass:
      hasAll(files.realCaseConfirmedOutcomeRuleDslDraftPreparationPackage, [
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_v1",
        "confirmed_outcome_rule_dsl_draft_preparation_waiting_for_teacher_rule_review",
        "draft-disabled-rule-cards",
        "lifecycle: \"draft_disabled\"",
        "CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_RULE_ACTIVATION_CANDIDATE_HASH_MISMATCH",
        "CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_REQUIRES_READY_LIFECYCLE_GATE",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "CONFIRMED_OUTCOME_RULE_DSL_DRAFT_PREP_HANDOFF_SOURCE_REVIEW_FORMAT_MISMATCH",
        "sourceConfirmedOutcomeReviewId",
        "confirmed_outcome_review://",
        "sourceRuleFilesModified: false",
        "rulePackageCompiled: false",
        "productionRuleRegistryMutated: false",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeRuleDslDraftPreparationPackageSmoke, [
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_draft_preparation_package_smoke_v1",
        "Confirmed outcome Rule DSL draft prep creates draft_disabled Rule Card from lifecycle planning",
        "Confirmed outcome Rule DSL draft prep keeps registry package execution RAG and packaging locked",
        "Confirmed outcome Rule DSL draft prep requires explicit teacher-reviewed flag",
        "Confirmed outcome Rule DSL draft prep rejects non-ready lifecycle gates",
        "Confirmed outcome Rule DSL draft prep blocks rule activation candidate hash mismatch",
        "Confirmed outcome Rule DSL draft prep blocks lost confirmed-outcome source continuity"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_rule_dsl_draft_preparation_package") &&
      files.mcp.includes("create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates confirmed outcome Rule DSL draft preparation package") &&
      files.readme.includes("create-real-case-confirmed-outcome-rule-dsl-draft-preparation-package") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-rule-dsl-draft-preparation-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-rule-dsl-draft-preparation-package.mjs"),
    evidence:
      "confirmed outcome lifecycle planning now becomes hash-checked draft_disabled Rule Card candidates only, while active package compilation, rule enablement, registry mutation, RAG authority, execution, packaging, acceptance, and completion remain locked"
  },
  {
    requirement: "Reviews confirmed outcome draft Rule Cards before disabled package planning",
    pass:
      hasAll(files.realCaseConfirmedOutcomeRuleDslReviewReceiptBuilder, [
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_receipt_builder_v1",
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_receipt_v1",
        "sourceConfirmedOutcomeReviewId",
        "sourceReviewFormat",
        "compile_active_package",
        "ruleEnabled: false",
        "productionRuleRegistryMutated: false",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeRuleDslReviewReceiptValidation, [
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_validation_v1",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "source_package_review_format_mismatch",
        "receipt_source_review_format_mismatch",
        "candidate_receipt_source_review_format_mismatch",
        "confirmed_outcome_rule_dsl_review_ready_for_disabled_package_planning",
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_disabled_package_planning_handoff_v1",
        "confirmed_outcome_rule_dsl_review_routes_to_high_reasoning_repair",
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_high_reasoning_repair_handoff_v1",
        "blocked_for_forbidden_confirmed_outcome_rule_dsl_review_decision",
        "candidate_hash_mismatch",
        "controlled_output_hash_not_reviewed",
        "activeRulePackageCompiled: false",
        "productionRuleRegistryMutated: false",
        "ruleEnabled: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeRuleDslReviewGateSmoke, [
        "transparent_ai_real_case_confirmed_outcome_rule_dsl_review_gate_smoke_v1",
        "Confirmed outcome Rule DSL review builder creates teacher receipt template",
        "Confirmed outcome Rule DSL review validation prepares disabled package planning only after logic match",
        "Confirmed outcome Rule DSL review validation routes mismatches to high reasoning repair",
        "Confirmed outcome Rule DSL review validation blocks forbidden active compilation decisions",
        "Confirmed outcome Rule DSL review validation blocks candidate hash mismatch",
        "Confirmed outcome Rule DSL review validation blocks lost confirmed-outcome source continuity",
        "Confirmed outcome Rule DSL review validation blocks incomplete teacher confirmations"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_rule_dsl_review_receipt_builder") &&
      files.mcp.includes("validate_real_case_confirmed_outcome_rule_dsl_review_receipt") &&
      files.mcp.includes("create-real-case-confirmed-outcome-rule-dsl-review-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode builds confirmed outcome Rule DSL review receipt template") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode validates confirmed outcome Rule DSL review receipt into disabled package planning only"
      ) &&
      files.readme.includes("create-real-case-confirmed-outcome-rule-dsl-review-receipt-builder.mjs") &&
      files.readme.includes("validate-real-case-confirmed-outcome-rule-dsl-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-rule-dsl-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-rule-dsl-review-gate.mjs"),
    evidence:
      "teacher-reviewed draft Rule Cards now need a review receipt before disabled package planning; matches stay disabled, mismatches route to high-reasoning repair, and active compilation, rule enablement, registry mutation, RAG, execution, packaging, acceptance, and completion remain locked"
  },
  {
    requirement: "Compiles confirmed outcome draft rules into disabled Validation Reports as evidence only",
    pass:
      hasAll(files.realCaseConfirmedOutcomeDisabledPackageValidationReport, [
        "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_v1",
        "CONFIRMED_OUTCOME_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG",
        "CONFIRMED_OUTCOME_DISABLED_RULES_MUST_APPEAR_AS_LIFECYCLE_SKIPPED_ROWS",
        "CONFIRMED_OUTCOME_DISABLED_PACKAGE_MUST_NOT_EVALUATE_RULE_VALIDATORS",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "CONFIRMED_OUTCOME_DISABLED_REPORT_REVIEW_VALIDATION_SOURCE_FORMAT_MISMATCH",
        "sourceConfirmedOutcomeReviewId",
        "confirmed_outcome_review://",
        "deliveryAllowedIsEvidenceOnly: true",
        "activeRulePackageCompiled: false",
        "productionRuleRegistryMutated: false",
        "targetSoftwareCommandsExecuted: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeDisabledPackageValidationReportSmoke, [
        "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_smoke_v1",
        "Confirmed outcome disabled package validation report compiles only draft_disabled rules",
        "Confirmed outcome disabled validation report keeps delivery allowed evidence-only without packaging unlock",
        "Confirmed outcome disabled validation report requires explicit teacher-reviewed flag",
        "Confirmed outcome disabled validation report rejects non-ready review validations",
        "Confirmed outcome disabled validation report blocks lost confirmed-outcome source continuity"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_disabled_package_validation_report") &&
      files.mcp.includes("create-real-case-confirmed-outcome-disabled-package-validation-report.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode creates confirmed outcome disabled package Validation Report evidence"
      ) &&
      files.readme.includes("create-real-case-confirmed-outcome-disabled-package-validation-report.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-disabled-package-validation-report"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-disabled-package-validation-report.mjs"),
    evidence:
      "confirmed outcome draft rules now compile only into disabled Rule Packages and lifecycle-skipped Validation Reports, preserving delivery_allowed as evidence-only while active packages, rules, registry mutation, RAG, execution, packaging, acceptance, and completion remain locked"
  },
  {
    requirement: "Reviews confirmed outcome disabled Validation Reports before lifecycle candidate planning",
    pass:
      hasAll(files.realCaseConfirmedOutcomeValidationReportReviewReceiptBuilder, [
        "transparent_ai_real_case_confirmed_outcome_validation_report_review_receipt_builder_v1",
        "transparent_ai_real_case_confirmed_outcome_validation_report_review_receipt_v1",
        "transparent_ai_real_case_confirmed_outcome_disabled_package_validation_report_v1",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "deliveryAllowedEvidenceOnlyConfirmed",
        "promote_rule",
        "compile_active_package"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeValidationReportReviewReceiptValidation, [
        "transparent_ai_real_case_confirmed_outcome_validation_report_review_validation_v1",
        "confirmed_outcome_validation_report_review_ready_for_lifecycle_candidate_planning",
        "confirmed_outcome_validation_report_review_routes_to_high_reasoning_repair",
        "blocked_for_forbidden_confirmed_outcome_validation_report_review_decision",
        "receipt_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_validation_report_high_reasoning_repair_handoff_v1",
        "activePromotionAllowedHere: false",
        "lifecyclePromotionExecuted: false",
        "ruleEnabled: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeValidationReportReviewGateSmoke, [
        "transparent_ai_real_case_confirmed_outcome_validation_report_review_gate_smoke_v1",
        "Real-case confirmed outcome Validation Report review builder creates evidence-only receipt template",
        "Real-case confirmed outcome Validation Report review prepares lifecycle candidate handoff without promotion",
        "Real-case confirmed outcome Validation Report review routes mismatches to high reasoning repair",
        "Real-case confirmed outcome Validation Report review blocks forbidden rule promotion decisions",
        "Real-case confirmed outcome Validation Report review blocks lost confirmed-outcome source continuity"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_validation_report_review_receipt_builder") &&
      files.mcp.includes("validate_real_case_confirmed_outcome_validation_report_review_receipt") &&
      files.mcp.includes("create-real-case-confirmed-outcome-validation-report-review-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode creates confirmed outcome Validation Report review receipt builder"
      ) &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode validates confirmed outcome Validation Report review to lifecycle candidate handoff"
      ) &&
      files.readme.includes("create-real-case-confirmed-outcome-validation-report-review-receipt-builder.mjs") &&
      files.readme.includes("validate-real-case-confirmed-outcome-validation-report-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-validation-report-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-validation-report-review-gate.mjs"),
    evidence:
      "confirmed outcome Validation Reports now require a teacher receipt before lifecycle-candidate planning; confirmation stays evidence-only, mismatches route to high-reasoning repair, and promotion/execution/packaging remain locked"
  },
  {
    requirement: "Reviews confirmed outcome lifecycle candidates before review-only package planning",
    pass:
      hasAll(files.realCaseConfirmedOutcomeLifecycleCandidateReviewReceiptBuilder, [
        "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_builder_v1",
        "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_v1",
        "ready_for_teacher_confirmed_outcome_lifecycle_candidate_review",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "draft_disabled_to_review_only_candidate",
        "activate_rule",
        "compile_active_package"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeLifecycleCandidateReviewReceiptValidation, [
        "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_validation_v1",
        "receipt_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "confirmed_outcome_lifecycle_candidate_review_ready_for_review_only_package_planning",
        "confirmed_outcome_lifecycle_candidate_review_routes_to_high_reasoning_repair",
        "blocked_for_forbidden_confirmed_outcome_lifecycle_candidate_review_decision",
        "transparent_ai_real_case_confirmed_outcome_review_only_lifecycle_candidate_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_high_reasoning_repair_handoff_v1",
        "reviewOnlyLifecycleCandidateApproved",
        "lifecycleTransitionExecuted: false",
        "activeRulePackageCompiled: false",
        "ruleEnabled: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeLifecycleCandidateReviewGateSmoke, [
        "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_gate_smoke_v1",
        "Real-case confirmed outcome lifecycle candidate review builder creates review-only receipt template",
        "Real-case confirmed outcome lifecycle candidate review prepares review-only package planning without active promotion",
        "Real-case confirmed outcome lifecycle candidate review routes corrections to high reasoning repair",
        "Real-case confirmed outcome lifecycle candidate review blocks active rule activation decisions",
        "Real-case confirmed outcome lifecycle candidate review blocks lost confirmed-outcome source continuity"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_lifecycle_candidate_review_receipt_builder") &&
      files.mcp.includes("validate_real_case_confirmed_outcome_lifecycle_candidate_review_receipt") &&
      files.mcp.includes("create-real-case-confirmed-outcome-lifecycle-candidate-review-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode creates confirmed outcome lifecycle candidate review receipt builder"
      ) &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode validates confirmed outcome lifecycle candidate review to review-only planning"
      ) &&
      files.readme.includes("create-real-case-confirmed-outcome-lifecycle-candidate-review-receipt-builder.mjs") &&
      files.readme.includes("validate-real-case-confirmed-outcome-lifecycle-candidate-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-lifecycle-candidate-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-lifecycle-candidate-review-gate.mjs"),
    evidence:
      "confirmed outcome lifecycle candidates now require teacher approval before review-only planning; active activation, execution, packaging, acceptance, and completion remain locked"
  },
  {
    requirement: "Stages confirmed outcome review-only package planning without applying lifecycle transition",
    pass:
      hasAll(files.realCaseConfirmedOutcomeReviewOnlyPackagePlanning, [
        "transparent_ai_real_case_confirmed_outcome_review_only_package_planning_packet_v1",
        "transparent_ai_real_case_confirmed_outcome_review_only_package_planning_packet_result_v1",
        "transparent_ai_real_case_confirmed_outcome_lifecycle_candidate_review_validation_v1",
        "transparent_ai_real_case_confirmed_outcome_review_only_lifecycle_candidate_handoff_v1",
        "ready_for_teacher_review_only_package_plan_review",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "REAL_CASE_CONFIRMED_OUTCOME_REVIEW_ONLY_PLANNING_SOURCE_FORMAT_MISMATCH",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "transitionApplied: false",
        "ruleFilesModified: false",
        "reviewOnlyRulePackageCompiled: false",
        "activeRulePackageCompiled: false",
        "ruleEnabled: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeReviewOnlyPackagePlanningSmoke, [
        "transparent_ai_real_case_confirmed_outcome_review_only_package_planning_smoke_v1",
        "Real-case confirmed outcome review-only package planning packet stages lifecycle candidates without applying transition",
        "Real-case confirmed outcome review-only package planning preserves draft-disabled source rules",
        "Real-case confirmed outcome review-only package planning blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome review-only package planning requires teacher-reviewed flag",
        "Real-case confirmed outcome review-only package planning rejects non-approved lifecycle validation"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_review_only_package_planning_packet") &&
      files.mcp.includes("create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates confirmed outcome review-only package planning packet") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-confirmed-outcome-review-only-package-planning-packet.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-review-only-package-planning"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-review-only-package-planning.mjs"),
    evidence:
      "confirmed outcome review_only package planning stages draft_disabled-to-review_only candidates while blocking source mutation, package compilation, execution, memory, RAG, packaging, and completion"
  },
  {
    requirement: "Compiles confirmed outcome review-only transition copies without mutating source rules",
    pass:
      hasAll(files.realCaseConfirmedOutcomeReviewOnlyTransitionPackage, [
        "transparent_ai_real_case_confirmed_outcome_review_only_transition_package_v1",
        "transparent_ai_real_case_confirmed_outcome_review_only_transition_package_result_v1",
        "transparent_ai_real_case_confirmed_outcome_review_only_package_planning_packet_v1",
        "ready_for_teacher_review_only_transition_package_review",
        "staged-review-only-rule-cards",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "REAL_CASE_CONFIRMED_OUTCOME_REVIEW_ONLY_TRANSITION_SOURCE_FORMAT_MISMATCH",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "sourceRuleFilesModified: false",
        "reviewOnlyRulePackageCompiled: compiled",
        "activeRulePackageCompiled: false",
        "ruleEnabled: false",
        "packagingUnlocked: false",
        "REAL_CASE_CONFIRMED_OUTCOME_REVIEW_ONLY_PACKAGE_CONTAINS_ACTIVE_RULES"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeReviewOnlyTransitionPackageSmoke, [
        "transparent_ai_real_case_confirmed_outcome_review_only_transition_package_smoke_v1",
        "Real-case confirmed outcome review-only transition package compiles review-only copies only",
        "Real-case confirmed outcome review-only transition package leaves source draft-disabled rules unchanged",
        "Real-case confirmed outcome review-only transition package blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome review-only transition package requires teacher-reviewed flag",
        "Real-case confirmed outcome review-only transition package rejects unlocked planning packet"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_review_only_transition_package") &&
      files.mcp.includes("create-real-case-confirmed-outcome-review-only-transition-package.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates confirmed outcome review-only transition package") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-confirmed-outcome-review-only-transition-package.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-review-only-transition-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-review-only-transition-package.mjs"),
    evidence:
      "confirmed outcome review_only transition compiles staged review_only copies only, preserving draft_disabled sources and keeping active promotion, execution, memory, RAG, packaging, and completion locked"
  },
  {
    requirement: "Reviews confirmed outcome active promotion before active package planning",
    pass:
      hasAll(files.realCaseConfirmedOutcomeActivePromotionReviewReceiptBuilder, [
        "transparent_ai_real_case_confirmed_outcome_active_promotion_review_receipt_builder_v1",
        "transparent_ai_real_case_confirmed_outcome_active_promotion_review_receipt_v1",
        "transparent_ai_real_case_confirmed_outcome_review_only_transition_package_v1",
        "ready_for_teacher_real_case_confirmed_outcome_active_promotion_review",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "compile_active_package",
        "activeRulePackageCompiled: false",
        "ruleEnabled: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeActivePromotionReviewReceiptValidation, [
        "transparent_ai_real_case_confirmed_outcome_active_promotion_review_validation_v1",
        "receipt_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "real_case_confirmed_outcome_active_promotion_review_ready_for_active_package_planning",
        "real_case_confirmed_outcome_active_promotion_review_routes_to_high_reasoning_repair",
        "blocked_for_forbidden_real_case_confirmed_outcome_active_promotion_review_decision",
        "transparent_ai_real_case_confirmed_outcome_active_promotion_planning_handoff_v1",
        "activePackageCompilationAllowedHere: false",
        "requiresSeparateActiveCompilationGate: true",
        "activeRulePackageCompiled: false",
        "ruleEnabled: false",
        "targetSoftwareCommandsExecuted: false",
        "packagingUnlocked: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeActivePromotionReviewGateSmoke, [
        "transparent_ai_real_case_confirmed_outcome_active_promotion_review_gate_smoke_v1",
        "Real-case confirmed outcome active promotion review builder creates planning-only receipt template",
        "Real-case confirmed outcome active promotion review prepares active package planning without active compilation",
        "Real-case confirmed outcome active promotion review routes corrections to high reasoning repair",
        "Real-case confirmed outcome active promotion review blocks forbidden active compilation decisions",
        "Real-case confirmed outcome active promotion review blocks lost confirmed-outcome source continuity"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_active_promotion_review_receipt_builder") &&
      files.mcp.includes("validate_real_case_confirmed_outcome_active_promotion_review_receipt") &&
      files.mcp.includes("create-real-case-confirmed-outcome-active-promotion-review-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-active-promotion-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode creates confirmed outcome active promotion review receipt builder"
      ) &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode validates confirmed outcome active promotion review to planning handoff"
      ) &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-confirmed-outcome-active-promotion-review-receipt-builder.mjs") &&
      files.readme.includes("validate-real-case-confirmed-outcome-active-promotion-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-active-promotion-review-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-promotion-review-gate.mjs"),
    evidence:
      "confirmed outcome active promotion now requires teacher review before active package planning, while active compilation, rule enablement, execution, memory, RAG, packaging, and completion stay locked"
  },
  {
    requirement: "Compiles confirmed outcome active rule package copies without enabling execution",
    pass:
      hasAll(files.realCaseConfirmedOutcomeActiveRulePackageCompilationGate, [
        "transparent_ai_real_case_confirmed_outcome_active_rule_package_compilation_v1",
        "transparent_ai_real_case_confirmed_outcome_active_rule_package_compilation_result_v1",
        "transparent_ai_real_case_confirmed_outcome_active_promotion_review_validation_v1",
        "transparent_ai_real_case_confirmed_outcome_active_promotion_planning_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_review_only_transition_package_v1",
        "ready_for_teacher_active_rule_package_validation_report_review",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_RULE_PACKAGE_SOURCE_FORMAT_MISMATCH",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "staged-active-rule-cards",
        "activeRulePackageCompiled: compiled",
        "ruleEnabled: false",
        "targetSoftwareCommandsExecuted: false",
        "requiresSeparateValidationReportGate: true",
        "requiresSeparateExecutionGate: true",
        "REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_RULE_PACKAGE_CONTAINS_NON_ACTIVE_RULES"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeActiveRulePackageCompilationGateSmoke, [
        "transparent_ai_real_case_confirmed_outcome_active_rule_package_compilation_gate_smoke_v1",
        "Real-case confirmed outcome active rule package compilation gate compiles active copies only",
        "Real-case confirmed outcome active rule package contains only active rules and preserves review-only sources",
        "Real-case confirmed outcome active rule package compilation blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome active rule package compilation requires teacher-reviewed flag",
        "Real-case confirmed outcome active rule package compilation rejects non-approved active promotion validation"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_active_rule_package_compilation_gate") &&
      files.mcp.includes("create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates confirmed outcome active rule package compilation gate") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-active-rule-package-compilation-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-rule-package-compilation-gate.mjs"),
    evidence:
      "confirmed outcome active rule package compilation compiles active copies only while rule enablement, execution, memory, RAG, packaging, and completion stay locked"
  },
  {
    requirement: "Evaluates confirmed outcome active Rule Packages into deterministic Validation Reports before delivery",
    pass:
      hasAll(files.realCaseConfirmedOutcomeActivePackageValidationReport, [
        "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_v1",
        "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_result_v1",
        "transparent_ai_real_case_confirmed_outcome_active_rule_package_compilation_v1",
        "ready_for_teacher_confirmed_outcome_active_validation_report_delivery_gate_review",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_SOURCE_FORMAT_MISMATCH",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "confirmed_outcome_active_validation_report_blocks_delivery_pending_teacher_repair_review",
        "evaluateRulePackage",
        "deliveryGateOpened: false",
        "ruleEnabled: false",
        "targetSoftwareCommandsExecuted: false",
        "requiresSeparateDeliveryGate: true",
        "requiresSeparateExecutionGate: true",
        "CONFIRMED_OUTCOME_ACTIVE_VALIDATION_REPORT_REJECTS_NON_ACTIVE_RULES"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeActivePackageValidationReportSmoke, [
        "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_smoke_v1",
        "Real-case confirmed outcome active package Validation Report allows valid artifact only as evidence",
        "Real-case confirmed outcome active package Validation Report records warning unknown without opening delivery gate",
        "Real-case confirmed outcome active package Validation Report blocks active blocking unknown rows",
        "Real-case confirmed outcome active package Validation Report blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome active package Validation Report requires teacher-reviewed flag",
        "Real-case confirmed outcome active package Validation Report rejects non-ready active compilation packet"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_active_package_validation_report") &&
      files.mcp.includes("create-real-case-confirmed-outcome-active-package-validation-report.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates confirmed outcome active package Validation Report") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-confirmed-outcome-active-package-validation-report.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-active-package-validation-report"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-package-validation-report.mjs"),
    evidence:
      "confirmed outcome active Rule Packages now produce deterministic Validation Reports where active blocking fail unknown error rows block delivery evidence while execution and durable side effects stay locked"
  },
  {
    requirement: "Closes confirmed outcome active Validation Reports into delivery evidence before execution review",
    pass:
      hasAll(files.realCaseConfirmedOutcomeActiveValidationReportDeliveryGate, [
        "transparent_ai_real_case_confirmed_outcome_active_validation_report_delivery_gate_v1",
        "transparent_ai_real_case_confirmed_outcome_active_validation_report_delivery_gate_result_v1",
        "transparent_ai_real_case_confirmed_outcome_active_package_validation_report_v1",
        "confirmed_outcome_active_delivery_gate_closed_ready_for_teacher_execution_gate_review",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_SOURCE_FORMAT_MISMATCH",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "REAL_CASE_CONFIRMED_OUTCOME_ACTIVE_DELIVERY_GATE_REJECTS_BLOCKING_VALIDATION_ROWS",
        "warningUnknownRows",
        "deliveryGateOpen: false",
        "ruleEnabled: false",
        "targetSoftwareCommandsExecuted: false",
        "requiresSeparateExecutionGate: true"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeActiveValidationReportDeliveryGateSmoke, [
        "transparent_ai_real_case_confirmed_outcome_active_validation_report_delivery_gate_smoke_v1",
        "Real-case confirmed outcome active delivery gate closes valid active Validation Report without execution",
        "Real-case confirmed outcome active delivery gate records warning unknown rows as evidence only",
        "Real-case confirmed outcome active delivery gate blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome active delivery gate rejects blocking active Validation Reports",
        "Real-case confirmed outcome active delivery gate requires teacher-reviewed flag",
        "Real-case confirmed outcome active delivery gate rejects packets with opened delivery locks"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_active_validation_report_delivery_gate") &&
      files.mcp.includes("create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates closed confirmed outcome active delivery gate") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-active-validation-report-delivery-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-validation-report-delivery-gate.mjs"),
    evidence:
      "confirmed outcome active Validation Reports can now become closed delivery evidence while execution, rule enablement, memory, RAG, packaging, acceptance, and completion stay locked"
  },
  {
    requirement: "Routes confirmed outcome active delivery gates through teacher execution review before controlled requests",
    pass:
      hasAll(files.realCaseConfirmedOutcomeActiveExecutionGateReceiptBuilder, [
        "transparent_ai_real_case_confirmed_outcome_active_execution_gate_receipt_builder_v1",
        "transparent_ai_real_case_confirmed_outcome_active_execution_gate_receipt_v1",
        "ready_for_teacher_real_case_confirmed_outcome_active_execution_gate_review",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "controlledExecutionRequestCreated: false",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeActiveExecutionGateReceiptValidation, [
        "transparent_ai_real_case_confirmed_outcome_active_execution_gate_validation_v1",
        "transparent_ai_real_case_controlled_execution_request_v1",
        "receipt_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "real_case_confirmed_outcome_active_execution_gate_ready_for_controlled_execution_request",
        "requiresSeparateControlledRunner: true",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeActiveExecutionGateSmoke, [
        "transparent_ai_real_case_confirmed_outcome_active_execution_gate_smoke_v1",
        "Real-case confirmed outcome active execution gate receipt builder prepares no-execution teacher review",
        "Real-case confirmed outcome active execution gate validates controlled execution request without running",
        "Real-case confirmed outcome active execution gate blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome active execution gate blocks execute-now decisions",
        "Real-case confirmed outcome active execution gate requires explicit execution scope",
        "Real-case confirmed outcome active execution gate routes teacher corrections to high-reasoning repair",
        "Real-case confirmed outcome active execution gate rejects tampered delivery gate hash"
      ]) &&
      files.mcp.includes("create_real_case_confirmed_outcome_active_execution_gate_receipt_builder") &&
      files.mcp.includes("validate_real_case_confirmed_outcome_active_execution_gate_receipt") &&
      files.mcp.includes("create-real-case-confirmed-outcome-active-execution-gate-receipt-builder.mjs") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-active-execution-gate-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode creates confirmed outcome active execution gate receipt builder") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates confirmed outcome active execution gate receipt") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("create-real-case-confirmed-outcome-active-execution-gate-receipt-builder.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-active-execution-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-active-execution-gate.mjs"),
    evidence:
      "confirmed outcome active closed delivery gates now require a teacher execution receipt before creating only a controlled request for a later runner"
  },
  {
    requirement: "Runs confirmed outcome controlled execution requests only through a no-op dry-run runner before real runner review",
    pass:
      hasAll(files.realCaseConfirmedOutcomeControlledExecutionRequestDryRun, [
        "transparent_ai_real_case_confirmed_outcome_controlled_execution_dry_run_v1",
        "transparent_ai_real_case_confirmed_outcome_controlled_execution_dry_run_result_v1",
        "real_case_confirmed_outcome_controlled_execution_dry_run_ready_for_teacher_runner_review",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "confirmed_outcome_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "adapterInvoked: false",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false",
        "requiresAdapterSpecificGate: true"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeControlledExecutionRequestDryRunSmoke, [
        "transparent_ai_real_case_confirmed_outcome_controlled_execution_dry_run_smoke_v1",
        "Real-case confirmed outcome controlled execution dry-run accepts approved request without invoking adapter",
        "Real-case confirmed outcome controlled execution dry-run blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome controlled execution dry-run rejects non-ready execution gate validation",
        "Real-case confirmed outcome controlled execution dry-run rejects executeNow tampering",
        "Real-case confirmed outcome controlled execution dry-run requires retained rollback point",
        "Real-case confirmed outcome controlled execution dry-run preserves execution scope and no-op locks"
      ]) &&
      files.mcp.includes("run_real_case_confirmed_outcome_controlled_execution_request_dry_run") &&
      files.mcp.includes("run-real-case-confirmed-outcome-controlled-execution-request-dry-run.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode runs confirmed outcome controlled execution request dry-run") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("run-real-case-confirmed-outcome-controlled-execution-request-dry-run.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-controlled-execution-request-dry-run"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-controlled-execution-request-dry-run.mjs"),
    evidence:
      "confirmed outcome controlled execution requests now become no-op dry-run evidence before adapter-specific or real runner review"
  },
  {
    requirement: "Creates confirmed outcome adapter-specific real-runner approval gates from reviewed dry-run receipts without executing software",
    pass:
      hasAll(files.realCaseConfirmedOutcomeAdapterSpecificRunnerApprovalGate, [
        "transparent_ai_real_case_confirmed_outcome_adapter_specific_runner_approval_gate_v1",
        "transparent_ai_real_case_confirmed_outcome_adapter_specific_runner_approval_gate_result_v1",
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_request_v1",
        "real_case_confirmed_outcome_adapter_specific_runner_approval_gate_ready_for_separate_real_runner",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "receipt_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "confirmedOutcomeBranch: true",
        "adapterInvoked: false",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeAdapterSpecificRunnerApprovalGateSmoke, [
        "transparent_ai_real_case_confirmed_outcome_adapter_specific_runner_approval_gate_smoke_v1",
        "Real-case confirmed outcome adapter-specific runner approval gate creates separate real-runner request without execution",
        "Real-case confirmed outcome adapter-specific runner approval gate blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome adapter-specific runner approval gate blocks execute-now decisions",
        "Real-case confirmed outcome adapter-specific runner approval gate requires adapter id and control channel",
        "Real-case confirmed outcome adapter-specific runner approval gate rejects tampered dry-run hash",
        "Real-case confirmed outcome adapter-specific runner approval gate routes corrections to high-reasoning repair"
      ]) &&
      files.mcp.includes("validate_real_case_confirmed_outcome_controlled_execution_dry_run_receipt") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-controlled-execution-dry-run-receipt.mjs") &&
      files.toolSurfaceSmoke.includes(
        "MCP advanced mode creates confirmed outcome adapter-specific runner approval gate without execution"
      ) &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("validate-real-case-confirmed-outcome-controlled-execution-dry-run-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-adapter-specific-runner-approval-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-adapter-specific-runner-approval-gate.mjs"),
    evidence:
      "reviewed confirmed outcome dry-run receipts now create confirmed-outcome adapter-specific approval gates and separate real-runner requests while still blocking adapter invocation, software commands, UI events, memory, RAG, packaging, acceptance, and completion"
  },
  {
    requirement: "Runs one final teacher-confirmed confirmed outcome separate real runner with rollback and controlled output",
    pass:
      hasAll(files.realCaseConfirmedOutcomeSeparateRealRunner, [
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_v1",
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_result_v1",
        "real_case_confirmed_outcome_separate_real_runner_completed_waiting_for_teacher_outcome_review",
        "transparent_ai_real_case_confirmed_outcome_adapter_specific_runner_approval_gate_v1",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "approval_gate_source_review_format_mismatch",
        "request_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceRunId",
        "teacher confirmed confirmed-outcome separate real runner",
        "expectedScriptSha256 mismatch",
        "filesWrittenOutsideRunDir: false",
        "memoryWritten: false",
        "ragFetched: false",
        "packagingUnlocked: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeSeparateRealRunnerSmoke, [
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_smoke_v1",
        "Real-case confirmed outcome separate real runner blocks without final execute confirmation",
        "Real-case confirmed outcome separate real runner executes one reviewed local manifest into controlled output",
        "Real-case confirmed outcome separate real runner blocks lost confirmed-outcome source continuity",
        "Real-case confirmed outcome separate real runner requires fresh rollback point",
        "Real-case confirmed outcome separate real runner rejects tampered reviewed runner manifest hash"
      ]) &&
      files.mcp.includes("run_real_case_confirmed_outcome_separate_real_runner") &&
      files.mcp.includes("run-real-case-confirmed-outcome-separate-real-runner.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode runs one confirmed outcome separate real runner with final confirmation") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("run-real-case-confirmed-outcome-separate-real-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-separate-real-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-separate-real-runner.mjs"),
    evidence:
      "confirmed outcome adapter-specific gates now have a final teacher-confirmed runner path with fresh rollback, reviewed manifest hash checks, controlled output, and closed memory/RAG/packaging/acceptance locks"
  },
  {
    requirement: "Reviews confirmed outcome separate real runner outputs before durable memory or rule gates",
    pass:
      hasAll(files.realCaseConfirmedOutcomeSeparateRealRunnerOutcomeReview, [
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_v1",
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_result_v1",
        "real_case_confirmed_outcome_separate_real_runner_outcome_confirmed_waiting_for_memory_or_rule_gate",
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_confirmed_outcome_handoff_v1",
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_high_reasoning_repair_handoff_v1",
        "confirmedOutcomeBranch: true",
        "EXPECTED_SOURCE_REVIEW_FORMAT",
        "runner_source_review_format_mismatch",
        "receipt_source_review_format_mismatch",
        "sourceConfirmedOutcomeReviewId",
        "sourceConfirmedOutcomeSourceRunId",
        "confirmedOutcomeBranchReviewed",
        "forbidden_teacher_decision",
        "controlled_output_hash_mismatch",
        "targetSoftwareCommandsExecutedAgain: false",
        "memoryWritten: false",
        "ragFetched: false",
        "productionRuleRegistryMutated: false",
        "durableActivationWritten: false",
        "packagingUnlocked: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.realCaseConfirmedOutcomeSeparateRealRunnerOutcomeReviewSmoke, [
        "transparent_ai_real_case_confirmed_outcome_separate_real_runner_outcome_review_smoke_v1",
        "Confirmed outcome separate real runner outcome review confirms controlled output without durable side effects",
        "Confirmed outcome separate real runner outcome review routes teacher correction to high-reasoning repair",
        "Confirmed outcome separate real runner outcome review blocks lost confirmed-outcome source continuity",
        "Confirmed outcome separate real runner outcome review blocks forbidden durable or acceptance decisions",
        "Confirmed outcome separate real runner outcome review blocks controlled output hash mismatch",
        "Confirmed outcome separate real runner outcome review blocks incomplete teacher review confirmations"
      ]) &&
      files.mcp.includes("validate_real_case_confirmed_outcome_separate_real_runner_outcome_review_receipt") &&
      files.mcp.includes("validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs") &&
      files.toolSurfaceSmoke.includes("MCP advanced mode validates confirmed outcome separate real runner outcome review") &&
      files.toolSurfaceSmoke.includes("sourceConfirmedOutcomeReviewId") &&
      files.toolSurfaceSmoke.includes("sourceConfirmedOutcomeSourceRunId") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363") &&
      files.readme.includes("validate-real-case-confirmed-outcome-separate-real-runner-outcome-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-case-confirmed-outcome-separate-real-runner-outcome-review"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-case-confirmed-outcome-separate-real-runner-outcome-review.mjs"),
    evidence:
      "confirmed outcome separate runner outputs now require teacher outcome review before any durable memory/rule path; corrections route to high reasoning and durable side effects stay locked"
  },
  {
    requirement: "Audits unattended all-software low-token learning chain before completion claims",
    pass:
      files.mcp.includes("create_all_software_unattended_learning_audit") &&
      files.mcp.includes("create-all-software-unattended-learning-audit.mjs") &&
      files.mcp.includes("waiting_for_all_software_unattended_learning_audit_review") &&
      files.mcp.includes("allSoftwareUnattendedLearningAudit") &&
      hasAll(files.allSoftwareUnattendedLearningAudit, [
        "transparent_ai_all_software_unattended_learning_audit_v1",
        "transparent_ai_all_software_unattended_learning_audit_receipt_v1",
        "unattended_learning_not_ready_remaining_gaps",
        "unattended_learning_ready_for_teacher_operational_review",
        "missing_recurring_monitor_approval_gate",
        "scheduled_task_not_registered_or_not_matching",
        "missing_run_output_audit",
        "missing_teacher_review_packet",
        "review_replay_waiting_for_teacher",
        "unattendedAllAppMonitoringComplete: false",
        "runnerLaunched: false",
        "scheduledTaskRegistered: false",
        "screenshotsCaptured: false",
        "logContentsRead: false",
        "longTermMemoryWritten: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.realLocalAllSoftwareUnattendedLearningAuditSmoke.includes("transparent_ai_real_local_all_software_unattended_learning_audit_smoke_v1") &&
      files.realLocalAllSoftwareUnattendedLearningAuditSmoke.includes("Unattended learning audit detects missing chain evidence before completion") &&
      files.realLocalAllSoftwareUnattendedLearningAuditSmoke.includes("Unattended learning audit aggregates schedule approval runner status output review and replay evidence") &&
      files.realLocalAllSoftwareUnattendedLearningAuditSmoke.includes("Unattended learning audit preserves schedule runner screenshots memory execution and packaging locks") &&
      files.toolSurfaceSmoke.includes("create_all_software_unattended_learning_audit") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "unattended all-software learning now has a completion-boundary audit over schedule, approval, registration status, recurring run output, teacher review, and replay evidence before operational claims"
  },
  {
    requirement: "Provides one operational workbench for all-software low-token learning activation and verification",
    pass:
      files.mcp.includes("create_all_software_operational_learning_workbench") &&
      files.mcp.includes("create-all-software-operational-learning-workbench.mjs") &&
      files.mcp.includes("waiting_for_all_software_operational_learning_workbench_review") &&
      files.mcp.includes("allSoftwareOperationalLearningWorkbench") &&
      hasAll(files.allSoftwareOperationalLearningWorkbench, [
        "transparent_ai_all_software_operational_learning_workbench_v1",
        "transparent_ai_all_software_operational_learning_workbench_receipt_v1",
        "ALL_SOFTWARE_OPERATIONAL_LEARNING_WORKBENCH_START_HERE.md",
        "create_real_local_all_software_low_token_readiness_package",
        "verify_all_software_recurring_monitor_registration_status",
        "create_all_software_unattended_learning_audit",
        "scheduled_task_not_registered_or_not_matching",
        "operationalWorkbenchDoesNotRegisterTask: true",
        "operationalWorkbenchDoesNotLaunchRunner: true",
        "softwareActionsExecuted: false",
        "longTermMemoryWritten: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.allSoftwareOperationalLearningWorkbenchSmoke.includes("transparent_ai_all_software_operational_learning_workbench_smoke_v1") &&
      files.allSoftwareOperationalLearningWorkbenchSmoke.includes("Operational workbench reports missing evidence instead of claiming automatic learning") &&
      files.allSoftwareOperationalLearningWorkbenchSmoke.includes("Operational workbench keeps unregistered scheduled task as the next real blocker") &&
      files.allSoftwareOperationalLearningWorkbenchSmoke.includes("Operational workbench can reach teacher operational review only from ready audit evidence") &&
      files.toolSurfaceSmoke.includes("create_all_software_operational_learning_workbench") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "readiness, schedule, registration, status, output audit, teacher review, replay, and unattended audit evidence now have one teacher-facing operational workbench before any real all-software learning claim"
  },
  {
    requirement: "Runs a bounded real-local operational trial of the all-software low-token learning chain",
    pass:
      files.mcp.includes("run_all_software_operational_learning_trial") &&
      files.mcp.includes("run-all-software-operational-learning-trial.mjs") &&
      files.mcp.includes("waiting_for_all_software_operational_learning_trial_review") &&
      files.mcp.includes("allSoftwareOperationalLearningTrial") &&
      hasAll(files.allSoftwareOperationalLearningTrial, [
        "transparent_ai_all_software_operational_learning_trial_v1",
        "transparent_ai_all_software_operational_learning_trial_receipt_v1",
        "create_all_software_log_source_discovery_ledger",
        "logSourceDiscoveryLedgerReady",
        "lowTokenSourceRouteEvidence",
        "run_automatic_low_token_learning_runner",
        "audit_all_software_recurring_monitor_run_output",
        "create_all_software_unattended_learning_audit",
        "create_all_software_operational_learning_workbench",
        "manualLowTokenRunnerLaunched: true",
        "scheduledTaskRegistered: false",
        "targetSoftwareCommandsExecuted: false",
        "screenshotsCaptured: false",
        "longTermMemoryWritten: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.realLocalAllSoftwareOperationalLearningTrialSmoke.includes("transparent_ai_real_local_all_software_operational_learning_trial_smoke_v1") &&
      files.realLocalAllSoftwareOperationalLearningTrialSmoke.includes("Trial actually launches the existing low-token runner manually") &&
      files.realLocalAllSoftwareOperationalLearningTrialSmoke.includes("Run-output audit and operational workbench consume the manual runner output") &&
      files.realLocalAllSoftwareOperationalLearningTrialSmoke.includes("Trial carries readiness log-source discovery ledger into operational evidence") &&
      files.realLocalAllSoftwareOperationalLearningTrialSmoke.includes("Safety locks stay closed during real-local operational trial") &&
      files.toolSurfaceSmoke.includes("run_all_software_operational_learning_trial") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "bounded real-local trial now runs readiness -> manual low-token runner -> run-output audit -> unattended audit -> operational workbench, proving the chain without system changes"
  },
  {
    requirement: "Bridges operational trial evidence into an automatic learning activation review gate",
    pass:
      files.mcp.includes("create_all_software_operational_learning_activation_gate") &&
      files.mcp.includes("create-all-software-operational-learning-activation-gate.mjs") &&
      files.mcp.includes("waiting_for_all_software_operational_learning_activation_gate_review") &&
      files.mcp.includes("allSoftwareOperationalLearningActivationGate") &&
      hasAll(files.allSoftwareOperationalLearningActivationGate, [
        "transparent_ai_all_software_operational_learning_activation_gate_v1",
        "lowTokenSourceRouteEvidence",
        "sourceLogSourceDiscoveryLedger",
        "source_trial_log_source_discovery_ledger_missing_or_unreviewed",
        "create_all_software_log_source_discovery_ledger",
        "create_all_software_recurring_monitor_approval_gate",
        "run_all_software_recurring_monitor_registration_runner",
        "verify_all_software_recurring_monitor_registration_status",
        "create_all_software_operational_learning_workbench",
        "activationGateDoesNotRegisterTask: true",
        "registrationRunnerDryRunOnly: true",
        "scheduledTaskRegistered: false",
        "targetSoftwareCommandsExecuted: false",
        "screenshotsCaptured: false",
        "longTermMemoryWritten: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.allSoftwareOperationalLearningActivationGateSmoke.includes(
        "transparent_ai_all_software_operational_learning_activation_gate_smoke_v1"
      ) &&
      files.allSoftwareOperationalLearningActivationGateSmoke.includes(
        "Activation gate carries low-token source-route evidence from the operational trial"
      ) &&
      files.allSoftwareOperationalLearningActivationGateSmoke.includes(
        "Activation gate prepares dry-run registration runner without executing registration"
      ) &&
      files.allSoftwareOperationalLearningActivationGateSmoke.includes(
        "Activation gate verifies scheduled-task status through read-only query only"
      ) &&
      files.allSoftwareOperationalLearningActivationGateSmoke.includes("Activation gate keeps safety locks closed") &&
      files.toolSurfaceSmoke.includes("create_all_software_operational_learning_activation_gate") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "operational trial evidence can now become an activation review gate with approval, dry-run registration, read-only status verification, and updated workbench evidence while system changes remain blocked"
  },
  {
    requirement: "Rehearses the activation registration wrapper in dry-run mode before any system change",
    pass:
      files.mcp.includes("run_all_software_operational_learning_activation_dry_run_rehearsal") &&
      files.mcp.includes("run-all-software-operational-learning-activation-dry-run-rehearsal.mjs") &&
      files.mcp.includes("waiting_for_all_software_operational_learning_activation_dry_run_rehearsal_review") &&
      files.mcp.includes("allSoftwareOperationalLearningActivationDryRunRehearsal") &&
      hasAll(files.allSoftwareOperationalLearningActivationDryRunRehearsal, [
        "transparent_ai_all_software_operational_learning_activation_dry_run_rehearsal_v1",
        "activationDryRunWrapperExecuted: true",
        "wrapperExecuteFlagPassed: false",
        "scheduledTaskRegistered: false",
        "scheduledTaskStarted: false",
        "targetSoftwareCommandsExecuted: false",
        "longTermMemoryWritten: false",
        "nativeUniversalExecution: false",
        "verify-all-software-recurring-monitor-registration-status.mjs"
      ]) &&
      files.toolSurfaceSmoke.includes("run_all_software_operational_learning_activation_dry_run_rehearsal") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "activation registration wrapper can now be truly invoked in dry-run mode and followed by read-only scheduled-task status verification before any system change"
  },
  {
    requirement: "Prepares a teacher-reviewed registration execute gate after activation dry-run rehearsal",
    pass:
      files.mcp.includes("create_all_software_operational_learning_registration_execute_gate") &&
      files.mcp.includes("create-all-software-operational-learning-registration-execute-gate.mjs") &&
      files.mcp.includes("waiting_for_all_software_operational_learning_registration_execute_gate_review") &&
      files.mcp.includes("allSoftwareOperationalLearningRegistrationExecuteGate") &&
      hasAll(files.allSoftwareOperationalLearningRegistrationExecuteGate, [
        "transparent_ai_all_software_operational_learning_registration_execute_gate_v1",
        "ready_for_teacher_registration_execute_review",
        "missing_explicit_teacher_registration_confirmation",
        "rollback_point_not_confirmed_for_registration_execute_gate",
        "executeRequestPrepared: true",
        "executeRequestExecuted: false",
        "scheduledTaskRegistered: false",
        "targetSoftwareCommandsExecuted: false",
        "longTermMemoryWritten: false",
        "unattendedAllAppMonitoringComplete: false"
      ]) &&
      files.toolSurfaceSmoke.includes("create_all_software_operational_learning_registration_execute_gate") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "a passed activation dry-run rehearsal can now become a final teacher-reviewed execute gate that prepares real registration and rollback commands without changing scheduled tasks"
  },
  {
    requirement: "Executes one teacher-approved registration gate and witnesses scheduled-task status before operational claims",
    pass:
      files.skill.includes("run_all_software_operational_learning_registration_approved_runner") &&
      files.skill.includes("status verifier is the authoritative proof") &&
      files.mcp.includes("run_all_software_operational_learning_registration_approved_runner") &&
      files.mcp.includes("run-all-software-operational-learning-registration-approved-runner.mjs") &&
      hasAll(files.allSoftwareOperationalLearningRegistrationApprovedCommandBuilder, [
        "transparent_ai_operational_registration_approved_command_builder_v1",
        "run-all-software-operational-learning-registration-approved-runner.mjs",
        "teacher confirmed approved registration runner",
        "builderDoesNotRunRegistration: true",
        "builderDoesNotInvokeRunner: true",
        "builderDoesNotRegisterTask: true",
        "builderDoesNotStartScheduledTask: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotWriteMemory: true",
        "generatedCommandRequiresTeacherRegistrationConfirmation: true",
        "generatedCommandRequiresRollback: true",
        "generatedCommandRequiresAllowSystemChange: true",
        "generatedCommandRequiresExecuteApprovedRegistration: true"
      ]) &&
      repoPackageJson.scripts?.["smoke:plugin-operational-registration-approved-command-builder"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-operational-registration-approved-command-builder.mjs" &&
      hasAll(files.allSoftwareOperationalLearningRegistrationApprovedRunner, [
        "transparent_ai_all_software_operational_learning_registration_approved_runner_v1",
        "missing_execute_approved_registration_flag",
        "missing_allow_system_change_for_registration",
        "verify-all-software-recurring-monitor-registration-status.mjs",
        "registration_execute_completed_but_status_not_registered_or_mismatch",
        "unattendedAllAppMonitoringComplete: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.allSoftwareOperationalLearningRegistrationApprovedRunnerSmoke, [
        "transparent_ai_all_software_operational_learning_registration_approved_runner_smoke_v1",
        "blocks without final execute-approved-registration flag",
        "read-only scheduled-task status as authoritative"
      ]) &&
      files.toolSurfaceSmoke.includes("run_all_software_operational_learning_registration_approved_runner") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "a ready registration execute gate can now invoke the existing registration runner under final teacher approval and immediately verify scheduled-task status read-only before any operational learning claim"
  },
  {
    requirement: "Triggers one post-registration reviewed runner output and chains audit, teacher review, replay, and unattended gates",
    pass:
      files.skill.includes("run_all_software_operational_learning_post_registration_output_witness_runner") &&
      files.mcp.includes("run_all_software_operational_learning_post_registration_output_witness_runner") &&
      files.mcp.includes("run-all-software-operational-learning-post-registration-output-witness-runner.mjs") &&
      hasAll(files.allSoftwareOperationalLearningPostRegistrationOutputWitnessCommandBuilder, [
        "transparent_ai_operational_post_registration_output_witness_command_builder_v1",
        "run-all-software-operational-learning-post-registration-output-witness-runner.mjs",
        "teacher confirmed post-registration output witness",
        "builderDoesNotTriggerRunner: true",
        "builderDoesNotInvokeReviewedScheduledRunner: true",
        "builderDoesNotRegisterTask: true",
        "builderDoesNotStartScheduledTask: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotReadFullLogs: true",
        "builderDoesNotWriteMemory: true",
        "generatedCommandRequiresMatchingRegistrationStatus: true",
        "generatedCommandRequiresTeacherOutputWitnessConfirmation: true",
        "generatedCommandRequiresRollback: true",
        "generatedCommandRequiresTriggerReviewedOutput: true",
        "generatedCommandRequiresAllowRunnerTrigger: true"
      ]) &&
      hasAll(files.allSoftwareOperationalLearningPostRegistrationOutputWitnessCommandBuilderSmoke, [
        "transparent_ai_operational_post_registration_output_witness_command_builder_smoke_v1",
        "loads matching status evidence",
        "generates final witness command",
        "keeps runner and system-change locks closed"
      ]) &&
      repoPackageJson.scripts?.["smoke:plugin-operational-post-registration-output-witness-command-builder"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-operational-post-registration-output-witness-command-builder.mjs" &&
      hasAll(files.allSoftwareOperationalLearningPostRegistrationOutputWitnessReceiptBuilder, [
        "transparent_ai_all_software_operational_post_registration_output_witness_receipt_builder_v1",
        "transparent_ai_all_software_operational_post_registration_output_witness_review_receipt_v1",
        "validate-all-software-operational-post-registration-output-witness-receipt.mjs",
        "builderDoesNotRerunOutputWitness: true",
        "builderDoesNotInvokeReviewedScheduledRunner: true",
        "builderDoesNotRegisterTask: true",
        "builderDoesNotReadFullLogs: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotWriteMemory: true"
      ]) &&
      hasAll(files.allSoftwareOperationalLearningPostRegistrationOutputWitnessReceiptValidation, [
        "transparent_ai_all_software_operational_post_registration_output_witness_receipt_validation_v1",
        "post_registration_output_witness_reviewed_waiting_for_optional_post_activation_evidence",
        "ready_for_review_only_post_activation_witness_command",
        "validationDoesNotRerunOutputWitness: true",
        "validationDoesNotInvokeReviewedScheduledRunner: true",
        "validationDoesNotRegisterTask: true",
        "validationDoesNotReadFullLogs: true",
        "validationDoesNotCaptureScreenshots: true",
        "validationDoesNotWriteMemory: true"
      ]) &&
      hasAll(files.allSoftwareOperationalLearningPostRegistrationOutputWitnessReceiptReviewSmoke, [
        "transparent_ai_operational_post_registration_output_witness_receipt_review_smoke_v1",
        "blocks default unreviewed receipt",
        "accepts reviewed output witness without system changes",
        "prepares only review-only post-activation witness command"
      ]) &&
      repoPackageJson.scripts?.["smoke:plugin-operational-post-registration-output-witness-receipt-review"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-operational-post-registration-output-witness-receipt-review.mjs" &&
      hasAll(files.allSoftwareOperationalLearningPostRegistrationOutputWitnessRunner, [
        "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_v1",
        "reviewed_scheduled_runner_direct_invocation",
        "audit-all-software-recurring-monitor-run-output.mjs",
        "create-all-software-recurring-monitor-teacher-review-packet.mjs",
        "create-all-software-recurring-monitor-review-decision-replay-queue.mjs",
        "create-all-software-unattended-learning-audit.mjs",
        "scheduledTaskStarted: false",
        "memoryWritten: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.allSoftwareOperationalLearningPostRegistrationOutputWitnessRunnerSmoke, [
        "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_smoke_v1",
        "blocks without explicit trigger flag",
        "directly invokes the reviewed scheduled runner once after matching registration evidence",
        "Triggered output is immediately audited into compact teacher-review learning events"
      ]) &&
      files.toolSurfaceSmoke.includes("run_all_software_operational_learning_post_registration_output_witness_runner") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "a matching post-registration status can now trigger one bounded reviewed low-token output run and immediately hand it to audit, teacher review, replay, and unattended gates without screenshots, memory, packaging, or completion claims"
  },
  {
    requirement: "Witnesses post-activation registration, output, and review evidence before operational claims",
    pass:
      files.mcp.includes("create_all_software_operational_learning_post_activation_witness") &&
      files.mcp.includes("create-all-software-operational-learning-post-activation-witness.mjs") &&
      files.mcp.includes("waiting_for_all_software_operational_learning_post_activation_witness_review") &&
      files.mcp.includes("allSoftwareOperationalLearningPostActivationWitness") &&
      hasAll(files.allSoftwareOperationalLearningPostActivationWitness, [
        "transparent_ai_all_software_operational_learning_post_activation_witness_v1",
        "missing_post_activation_registration_status",
        "scheduled_task_not_registered_or_not_matching_after_execute_gate",
        "missing_post_activation_reviewed_run_output",
        "post_activation_witness_ready_for_teacher_operational_review",
        "postActivationWitnessDoesNotChangeSystem: true",
        "registerTaskCalled: false",
        "runnerLaunched: false",
        "goalComplete: false"
      ]) &&
      hasAll(files.allSoftwareOperationalPostActivationWitnessReceiptBuilder, [
        "transparent_ai_all_software_operational_post_activation_witness_receipt_builder_v1",
        "transparent_ai_all_software_operational_post_activation_witness_evidence_receipt_v1",
        "builderDoesNotRerunWitness",
        "builderDoesNotRegisterTask",
        "<post-activation-run-output-audit.json>",
        "create-all-software-operational-learning-post-activation-witness.mjs"
      ]) &&
      files.allSoftwareOperationalPostActivationWitnessReceiptBuilderSmoke.includes(
        "Post-activation receipt builder prepares only witness rerun command and keeps system locks closed"
      ) &&
      hasAll(files.allSoftwareOperationalPostActivationWitnessReceiptValidation, [
        "transparent_ai_all_software_operational_post_activation_witness_receipt_validation_v1",
        "ready_for_review_only_post_activation_witness_rerun",
        "blocked_until_teacher_reviews_post_activation_evidence_paths",
        "validationDoesNotRerunWitness: true",
        "validationDoesNotRegisterTask: true",
        "allRequiredEvidencePathsPresentAndFormatMatched"
      ]) &&
      files.allSoftwareOperationalPostActivationWitnessReceiptValidationSmoke.includes(
        "Post-activation witness receipt validation prepares only a review-only witness rerun command after every evidence path matches"
      ) &&
      files.toolSurfaceSmoke.includes("create_all_software_operational_learning_post_activation_witness") &&
      files.toolSurfaceSmoke.includes("create_all_software_operational_post_activation_witness_receipt_builder") &&
      files.toolSurfaceSmoke.includes("validate_all_software_operational_post_activation_witness_receipt") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "after the teacher-reviewed registration execute gate, registration status, recurring output, teacher review, replay, and unattended audit evidence can now be witnessed without system changes before any operational completion claim"
  },
  {
    requirement: "Summarizes current all-software operational evidence and next safe action with low token overhead",
    pass:
      files.mcp.includes("create_all_software_operational_status_console") &&
      files.mcp.includes("create-all-software-operational-status-console.mjs") &&
      files.mcp.includes("waiting_for_all_software_operational_status_console_review") &&
      files.mcp.includes("allSoftwareOperationalStatusConsole") &&
      files.mcp.includes("logSourceDiscoveryLedger") &&
      hasAll(files.allSoftwareOperationalStatusConsole, [
        "transparent_ai_all_software_operational_status_console_v1",
        "all_software_status_waiting_for_registration_or_manual_runner_evidence",
        "all_software_status_ready_for_teacher_operational_review",
        "log_source_discovery",
        "logSourceDiscoveryLedgerReady",
        "allSoftwareLogSourceDiscoveryComplete: false",
        "claim_all_software_log_source_discovery_complete",
        "read_logs_before_log_source_metadata_gate",
        "widen_coverage_without_log_source_discovery_ledger",
        "create-all-software-log-source-discovery-ledger.mjs",
        "scanReadsEvidenceMetadataOnly: true",
        "statusConsoleReadOnly: true",
        "registerTaskCalled: false",
        "runnerLaunched: false",
        "targetSoftwareCommandsExecuted: false",
        "goalComplete: false",
        "claim_universal_native_execution"
      ]) &&
      files.originalGoalCurrentStatusRefresh.includes("transparent_ai_original_goal_current_status_refresh_v1") &&
      files.originalGoalCurrentStatusRefresh.includes("create-all-software-operational-status-console.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("sourceLogSourceDiscoveryLedger") &&
      files.originalGoalCurrentStatusRefresh.includes("--log-source-discovery-ledger") &&
      files.originalGoalCurrentStatusRefresh.includes("all-software-log-source-discovery-ledger.json") &&
      files.originalGoalCurrentStatusRefresh.includes("sourceRealLocalReadinessPackagePacket?.paths?.logSourceDiscoveryLedger") &&
      files.originalGoalCurrentStatusRefresh.includes("readinessLedger") &&
      files.originalGoalCurrentStatusRefresh.includes("logSourceDiscoveryLedgerReady") &&
      files.originalGoalCurrentStatusRefresh.includes("allSoftwareLogSourceDiscoveryComplete: false") &&
      files.originalGoalCurrentStatusRefresh.includes("all_software_log_source_discovery_ledger") &&
      files.originalGoalCurrentStatusRefresh.includes("Open all-software log source discovery ledger before broad coverage claims") &&
      files.originalGoalCurrentStatusRefresh.includes("create-all-software-log-source-discovery-ledger.mjs") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("Current status refresh inherits log-source discovery ledger from real-local readiness package") &&
      files.originalGoalCurrentStatusRefresh.includes("transparent_ai_knowledge_augmented_spatial_execution_bridge_command_review_v1") &&
      files.originalGoalCurrentStatusRefresh.includes("teacher_shared_wechat_screenshots_2026_06_12") &&
      files.originalGoalCurrentStatusRefresh.includes("use RAG as an external knowledge-base retriever for the large model") &&
      files.originalGoalCurrentStatusRefresh.includes("knowledgeAugmentedSpatialExecutionBridgeCommandReview") &&
      files.originalGoalCurrentStatusRefresh.includes("knowledgeAugmentedSpatialExecutionBridgeCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("knowledge_augmented_spatial_execution_bridge_command") &&
      files.originalGoalCurrentStatusRefresh.includes("knowledgeAugmentedSpatialExecutionBridgeExecutesSoftware: false") &&
      files.mcp.includes("create_original_goal_current_status_refresh") &&
      files.mcp.includes("create-original-goal-current-status-refresh.mjs") &&
      files.mcp.includes("waiting_for_original_goal_current_status_refresh_review") &&
      files.mcp.includes("originalGoalCurrentStatusRefreshRequested") &&
      files.mcp.includes("create_original_goal_teacher_action_router") &&
      files.mcp.includes("create-original-goal-teacher-action-router.mjs") &&
      files.mcp.includes("create_original_goal_teacher_action_router_receipt_builder") &&
      files.mcp.includes("validate_original_goal_teacher_action_router_receipt") &&
      files.mcp.includes("create_original_goal_teacher_action_router_handoff_queue") &&
      files.mcp.includes("run_original_goal_review_handoff_queue_item") &&
      files.mcp.includes("create-original-goal-teacher-action-router-receipt-builder.mjs") &&
      files.mcp.includes("validate-original-goal-teacher-action-router-receipt.mjs") &&
      files.mcp.includes("create-original-goal-teacher-action-router-handoff-queue.mjs") &&
      files.mcp.includes("run-original-goal-review-handoff-queue-item.mjs") &&
      files.mcp.includes("create_goal_teacher_review_cockpit") &&
      files.mcp.includes("create-goal-teacher-review-cockpit.mjs") &&
      files.mcp.includes("validate_goal_teacher_review_cockpit_receipt") &&
      files.mcp.includes("validate-goal-teacher-review-cockpit-receipt.mjs") &&
      files.mcp.includes("create_goal_teacher_review_cockpit_handoff_queue") &&
      files.mcp.includes("create-goal-teacher-review-cockpit-handoff-queue.mjs") &&
      files.mcp.includes("waiting_for_original_goal_teacher_action_route_review") &&
      files.mcp.includes("originalGoalTeacherActionRouterRequested") &&
      files.mcp.includes("audit_original_goal_review_entrypoint_health") &&
      files.mcp.includes("audit-original-goal-review-entrypoint-health.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("teacherActionRouterHtml") &&
      files.originalGoalCurrentStatusRefresh.includes("create-original-goal-teacher-action-router.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("teacherActionRouterReceiptBuilderHtml") &&
      files.originalGoalCurrentStatusRefresh.includes("teacherActionRouterReceiptValidationCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("teacherActionRouterHandoffQueueCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("teacherReviewCockpitHandoffQueueCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalReviewHandoffQueueItemRunnerCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualCaptureCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("capture-triggered-visual-check.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("--selected-request-id") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualCaptureCommandReady") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualLearningHandoffCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualLearningHandoffCommandReady") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualLearningHandoffReviewCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("run-triggered-visual-evidence-learning-handoff-review.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualLearningHandoffReviewCommandReady") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualLearningHandoffReviewReceiptValidationCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualLearningHandoffReviewReceiptValidationCommandReady") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualVoiceControlWorkbenchCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("create-triggered-visual-evidence-voice-control-workbench.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("triggeredVisualVoiceControlWorkbenchCommandReady") &&
      files.originalGoalCurrentStatusRefresh.includes("create-original-goal-teacher-action-router-receipt-builder.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("create-original-goal-teacher-action-router-handoff-queue.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("create-goal-teacher-review-cockpit-handoff-queue.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("run-original-goal-review-handoff-queue-item.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("create-original-goal-completion-blocker-lane-run-review-receipt-builder.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("validate-original-goal-completion-blocker-lane-run-review-receipt.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalCompletionBlockerLaneRunReviewReceiptGateReady") &&
      hasAll(files.originalGoalCompletionBlockerLaneRunReviewReceiptBuilder, [
        "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_builder_v1",
        "transparent_ai_original_goal_completion_blocker_lane_request_run_v1",
        "builderDoesNotRerunLane: true",
        "builderDoesNotWriteMemory: true",
        "goalComplete: false"
      ]) &&
      hasAll(files.originalGoalCompletionBlockerLaneRunReviewReceiptValidation, [
        "transparent_ai_original_goal_completion_blocker_lane_run_review_receipt_validation_v1",
        "completion_blocker_lane_run_reviewed_for_next_status_refresh",
        "validationDoesNotRerunLane: true",
        "validationDoesNotExecuteTargetSoftware: true",
        "goalComplete: false"
      ]) &&
      files.originalGoalCompletionBlockerLaneRunReviewReceiptSmoke.includes(
        "Completion blocker lane run review validation prepares only review-only status refresh after teacher review"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes("reviewEntrypointHealthAuditHtml") &&
      files.originalGoalCurrentStatusRefresh.includes("audit-original-goal-review-entrypoint-health.mjs") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("Current status refresh regenerates readiness status board and command center") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "Current status refresh adds adviser RAG research direction to the knowledge-augmented spatial bridge"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalCapabilityMatrixCoverageAudit") &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalCapabilityMatrixCoverageAuditHtml") &&
      files.originalGoalCurrentStatusRefresh.includes("covered_review_only_capability_matrix") &&
      files.originalGoalCurrentStatusRefresh.includes("status_lane_original_goal_capability_matrix_coverage") &&
      files.originalGoalCurrentStatusRefresh.includes("original_goal_capability_matrix_coverage_audit") &&
      files.originalGoalCurrentStatusRefresh.includes("smoke:plugin-original-goal-capability-matrix-coverage-audit") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "Current status refresh surfaces original-goal capability matrix coverage audit"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalFinalCompletionGateCommandTemplate") &&
      files.originalGoalCurrentStatusRefresh.includes("ruleDslDeliveryGateAudit") &&
      files.originalGoalCurrentStatusRefresh.includes("ruleDslDeliveryGateAuditReady") &&
      files.originalGoalCurrentStatusRefresh.includes("missing_rule_dsl_delivery_gate_audit_trail") &&
      files.originalGoalCurrentStatusRefresh.includes("validate-original-goal-final-completion-gate.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("--rule-dsl-delivery-gate-audit") &&
      files.originalGoalCurrentStatusRefresh.includes(
        "Run final completion gate only after all evidence chains, including Rule DSL delivery-gate audit, are ready"
      ) &&
      files.originalGoalCurrentStatusRefresh.includes("Final completion Rule DSL delivery-gate audit evidence") &&
      files.originalGoalCurrentStatusRefresh.includes("rule_dsl_delivery_gate_audit_trail") &&
      files.originalGoalCompletionBlockerMatrix.includes("rule_dsl_delivery_gate_audit") &&
      files.originalGoalCompletionBlockerMatrix.includes("knowledge\\\\create-rag-delivery-gate-audit-trail.mjs") &&
      files.originalGoalCompletionBlockerMatrix.includes("claim_rule_dsl_delivery_gate_audit_ready_without_audit_trail") &&
      files.originalGoalCompletionBlockerNextStepQueue.includes("rule_dsl_delivery_gate_audit") &&
      files.originalGoalCompletionBlockerNextStepQueue.includes("[\"rule_dsl_delivery_gate_audit\", 8]") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("rule_dsl_delivery_gate_audit") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "Current status refresh wires final completion gate to Rule DSL delivery-gate audit evidence"
      ) &&
      files.originalGoalCurrentStatusRefreshSmoke.includes(
        "transparent_ai_original_goal_capability_matrix_coverage_audit_smoke_v1"
      ) &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("Original Goal Capability Matrix Coverage Audit") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("original_goal_capability_matrix_coverage_audit") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("Current status refresh surfaces all-software log source discovery ledger") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("Current status refresh preserves no system change and no execution locks") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("Current status refresh routes remaining teacher confirmations through a shortest review-only action router") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("originalGoalReviewHandoffQueueItemRunnerCommandReady") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("triggeredVisualCaptureCommandReady") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("triggeredVisualLearningHandoffCommandReady") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("triggeredVisualLearningHandoffReviewCommandReady") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("triggeredVisualLearningHandoffReviewReceiptValidationCommandReady") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("triggeredVisualVoiceControlWorkbenchCommandReady") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("MCP advanced mode exposes and runs current status refresh") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("Default teach_apprentice routes original-goal current-status refresh to review card") &&
      files.originalGoalTeacherActionRouter.includes("transparent_ai_original_goal_teacher_action_router_v1") &&
      files.originalGoalTeacherActionRouter.includes("routerDoesNotValidateReceipts: true") &&
      files.originalGoalTeacherActionRouter.includes("routerDoesNotRegisterTask: true") &&
      files.originalGoalTeacherActionRouter.includes("routerDoesNotExecuteTargetSoftware: true") &&
      files.originalGoalTeacherActionRouterSmoke.includes("transparent_ai_original_goal_teacher_action_router_smoke_v1") &&
      files.originalGoalTeacherActionRouterSmoke.includes("Teacher action router merges repeated receipt rows into one teacher step") &&
      files.originalGoalTeacherActionRouterReceiptBuilder.includes("transparent_ai_original_goal_teacher_action_router_receipt_builder_v1") &&
      files.originalGoalTeacherActionRouterReceiptBuilder.includes("builderDoesNotRunCommands: true") &&
      files.originalGoalTeacherActionRouterReceiptValidation.includes("transparent_ai_original_goal_teacher_action_router_receipt_validation_v1") &&
      files.originalGoalTeacherActionRouterReceiptValidation.includes("validationDoesNotExecuteCommands: true") &&
      files.originalGoalTeacherActionRouterReceiptValidation.includes("blocked_for_unsafe_downstream_command") &&
      files.originalGoalTeacherActionRouterReceiptSmoke.includes("transparent_ai_original_goal_teacher_action_router_receipt_smoke_v1") &&
      files.originalGoalTeacherActionRouterHandoffQueue.includes("transparent_ai_original_goal_teacher_action_router_handoff_queue_v1") &&
      files.originalGoalTeacherActionRouterHandoffQueue.includes("queueDoesNotExecuteCommands: true") &&
      files.originalGoalTeacherActionRouterHandoffQueueSmoke.includes("transparent_ai_original_goal_teacher_action_router_handoff_queue_smoke_v1") &&
      files.goalTeacherReviewCockpitHandoffQueue.includes("transparent_ai_goal_teacher_review_cockpit_handoff_queue_v1") &&
      files.goalTeacherReviewCockpitHandoffQueue.includes("queueDoesNotExecuteCommands: true") &&
      files.goalTeacherReviewCockpitHandoffQueueSmoke.includes("transparent_ai_goal_teacher_review_cockpit_handoff_queue_smoke_v1") &&
      files.originalGoalReviewHandoffQueueItemRunner.includes("transparent_ai_original_goal_review_handoff_queue_item_run_v1") &&
      files.originalGoalReviewHandoffQueueItemRunner.includes("reviewHandoffItemRunnerDoesNotRunArbitraryCommandString: true") &&
      files.originalGoalReviewHandoffQueueItemRunner.includes("reviewHandoffItemRunnerUsesStructuredArgumentsOnly: true") &&
      files.originalGoalReviewHandoffQueueItemRunner.includes("reviewHandoffItemRunnerConsumesOneHandoffItem: true") &&
      files.originalGoalReviewHandoffQueueItemRunnerSmoke.includes("transparent_ai_original_goal_review_handoff_queue_item_runner_smoke_v1") &&
      files.originalGoalReviewHandoffQueueItemRunnerSmoke.includes("supports teacher action router handoff queues") &&
      files.originalGoalReviewEntrypointHealthAudit.includes("transparent_ai_original_goal_review_entrypoint_health_audit_v1") &&
      files.originalGoalReviewEntrypointHealthAudit.includes("auditDoesNotRunCommands: true") &&
      files.originalGoalReviewEntrypointHealthAudit.includes("auditDoesNotExecuteTargetSoftware: true") &&
      files.originalGoalReviewEntrypointHealthAuditSmoke.includes("transparent_ai_original_goal_review_entrypoint_health_smoke_v1") &&
      files.toolSurfaceSmoke.includes("create_all_software_operational_status_console") &&
      files.toolSurfaceSmoke.includes("create_original_goal_current_status_refresh") &&
      files.toolSurfaceSmoke.includes("create_original_goal_integrated_control_flow") &&
      files.toolSurfaceSmoke.includes("create_original_goal_teacher_action_router") &&
      files.toolSurfaceSmoke.includes("create_original_goal_teacher_action_router_receipt_builder") &&
      files.toolSurfaceSmoke.includes("validate_original_goal_teacher_action_router_receipt") &&
      files.toolSurfaceSmoke.includes("create_original_goal_teacher_action_router_handoff_queue") &&
      files.toolSurfaceSmoke.includes("run_original_goal_review_handoff_queue_item") &&
      files.toolSurfaceSmoke.includes("create_goal_teacher_review_cockpit") &&
      files.toolSurfaceSmoke.includes("validate_goal_teacher_review_cockpit_receipt") &&
      files.toolSurfaceSmoke.includes("create_goal_teacher_review_cockpit_handoff_queue") &&
      files.toolSurfaceSmoke.includes("audit_original_goal_review_entrypoint_health") &&
      files.toolSurfaceSmoke.includes("advancedNames.length === 363"),
    evidence:
      "a read-only status console plus MCP/teach_apprentice current-status refresh now scans current all-software operational learning and execution evidence, reports missing lanes, routes repeated teacher confirmations through the shortest review-only action router, audits local review entrypoints for openability, and keeps completion and system-change claims locked"
  },
  {
    requirement: "Provides one integrated teacher-facing flow for low-token observation, visual evidence, voice/text, transparent sketch, gates, and rollback",
    pass:
      files.originalGoalIntegratedControlFlow.includes("transparent_ai_original_goal_integrated_control_flow_v1") &&
      files.originalGoalIntegratedControlFlow.includes("all_software_metadata_baseline") &&
      files.originalGoalIntegratedControlFlow.includes("event_triggered_low_token_policy") &&
      files.originalGoalIntegratedControlFlow.includes("one_bounded_visual_evidence") &&
      files.originalGoalIntegratedControlFlow.includes("learning_handoff") &&
      files.originalGoalIntegratedControlFlow.includes("tlcl_rag_contract_repair_loop") &&
      files.originalGoalIntegratedControlFlow.includes("voice_text_numbered_target") &&
      files.originalGoalIntegratedControlFlow.includes("transparent_sketch_depth_demo") &&
      files.originalGoalIntegratedControlFlow.includes("execution_approval_gate") &&
      files.originalGoalIntegratedControlFlow.includes("post_action_evidence") &&
      files.originalGoalIntegratedControlFlow.includes("watch-log-source-metadata-deltas.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("create-event-triggered-low-token-observation-policy.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("capture-triggered-visual-check.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("create-triggered-visual-evidence-learning-handoff.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("create-tlcl-rag-informed-high-reasoning-repair-intake.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("smoke-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("create-triggered-visual-evidence-voice-control-workbench.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("create-transparent-sketch-depth-demonstration-rehearsal.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("create-engineering-voice-execution-approval-gate.mjs") &&
      files.originalGoalIntegratedControlFlow.includes("integratedFlowDoesNotExecuteSoftware: true") &&
      files.originalGoalIntegratedControlFlow.includes("integratedFlowDoesNotCaptureScreenshots: true") &&
      files.originalGoalIntegratedControlFlow.includes("integratedFlowDoesNotReadFullLogs: true") &&
      files.originalGoalIntegratedControlFlow.includes("integratedFlowDoesNotWriteMemory: true") &&
      files.originalGoalIntegratedControlFlow.includes("rollbackPointRequiredBeforeExecution: true") &&
      files.originalGoalIntegratedControlFlow.includes("goalComplete: false") &&
      files.mcp.includes("create_original_goal_integrated_control_flow") &&
      files.mcp.includes("originalGoalIntegratedControlFlowRequested") &&
      files.mcp.includes("waiting_for_original_goal_integrated_control_flow_review") &&
      files.toolSurfaceSmoke.includes("create_original_goal_integrated_control_flow") &&
      files.originalGoalCurrentStatusRefresh.includes("create-original-goal-integrated-control-flow.mjs") &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalIntegratedControlFlowHtml") &&
      files.originalGoalCurrentStatusRefresh.includes("originalGoalIntegratedControlFlowReviewOnly") &&
      files.originalGoalCurrentStatusRefreshSmoke.includes("Current status refresh generates an integrated control flow entrypoint") &&
      files.originalGoalIntegratedControlFlowSmoke.includes("transparent_ai_original_goal_integrated_control_flow_smoke_v1") &&
      files.originalGoalIntegratedControlFlowSmoke.includes("Flow orders low-token metadata, event trigger, bounded visual evidence, learning, TLCL/RAG repair, voice, sketch, execution, and post-action stages") &&
      files.originalGoalIntegratedControlFlowSmoke.includes("Flow maps every original-goal requirement to coverage and remaining proof") &&
      files.originalGoalIntegratedControlFlowSmoke.includes("Integrated flow keeps RAG non-authoritative and medium runtime blocked until high-reasoning repair review") &&
      files.originalGoalIntegratedControlFlowSmoke.includes("MCP advanced mode exposes and runs integrated control flow") &&
      files.originalGoalIntegratedControlFlowSmoke.includes("Default teach_apprentice routes overall framework request to integrated control flow card"),
    evidence:
      "a single review-only flow now connects the existing low-token watcher, one-shot visual evidence, learning card, TLCL/RAG high-reasoning contract repair, voice/text numbered target, transparent sketch depth rehearsal, execution approval gate, post-action evidence, and rollback requirement"
  },
  {
    requirement: "Adapts to different teacher methods",
    pass:
      hasAll(files.teacherMethodProfile, [
        "transparent_ai_teacher_learning_method_profile_v1",
        "preferredTeachingModes",
        "evidencePreferenceOrder",
        "questionPolicy",
        "correctionPolicy",
        "teacher_method_first_then_cheapest_evidence",
        "fullContinuousRecording: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.mcp.includes("create_teacher_learning_method_profile") &&
      files.mcp.includes("teacherMethodProfile") &&
      hasAll(files.universalObserver, [
        "step narration",
        "before/after examples",
        "drawn overlay annotations",
        "voice explanation",
        "screen event exports",
        "logs and event deltas",
        "manual markers"
      ]) &&
      adapterCatalog.adapters.some((adapter) => adapter.id === "existing-drawing-software") &&
      adapterCatalog.adapters.some((adapter) => adapter.id === "existing-screen-recording-event-log") &&
      adapterCatalog.adapters.some((adapter) => adapter.id === "existing-browser-automation") &&
      adapterCatalog.adapters.some((adapter) => adapter.id === "existing-cli-or-script") &&
      adapterCatalog.adapters.every((adapter) => adapter.nativeIntegrationRequired === false) &&
      files.compactLearningEvents.includes("supportsTeachingMethods") &&
      hasAll(files.teachExecuteLoop, [
        "teacher_method_profile",
        "teacher learning method profile",
        "ordered steps",
        "before/after examples",
        "voice explanation",
        "transparent overlay sketch",
        "3D depth sketch",
        "plain correction after a failed attempt"
      ]) &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Teacher method profile adapts to overlay-first low-token teaching style") &&
      files.learningWorkflow.includes("create_teacher_learning_method_profile") &&
      files.teacherMethodProfileSmoke.includes("ordinary teach_apprentice routes teacher-method intent to a teacher-facing card") &&
      files.toolSurfaceSmoke.includes("Default teach_apprentice accepts Markdown table examples pasted into a normal message") &&
      files.existingDrawingSpatialControlledExecutionSmoke.includes("Existing drawing templates and transparent overlay kit are reused before execution"),
    evidence: "teacher method profile plus multiple teaching styles route through existing tool adapters and the unified loop"
  },
  {
    requirement: "Lets non-experts control engineering software by voice or text through numbered target confirmation",
    pass:
      hasAll(files.engineeringCommand, [
        "transparent_ai_engineering_voice_text_command_intent_v1",
        "transparent_ai_engineering_voice_or_text_control_workflow_v1",
        "transparent_ai_numbered_target_confirmation_v1",
        "SpeechRecognition",
        "webkitSpeechRecognition",
        "manualTextFallback",
        "restatesUnderstoodOperationBeforeExecution",
        "confirm_engineering_command_target",
        "teacherMustConfirmExactlyOneNumber",
        "needs_numbered_candidate_confirmation",
        "create_supervised_software_action_kit",
        "none_until_teacher_confirms_number",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.mcp.includes("create_engineering_command_confirmation_kit") &&
      files.mcp.includes("create_visual_engineering_target_confirmation_kit") &&
      files.mcp.includes("create_engineering_voice_control_session") &&
      files.mcp.includes("create_engineering_voice_control_workbench") &&
      files.mcp.includes("create-engineering-command-confirmation-kit.mjs") &&
      files.mcp.includes("create-visual-engineering-target-confirmation-kit.mjs") &&
      files.mcp.includes("create-engineering-voice-control-session.mjs") &&
      files.mcp.includes("create-engineering-voice-control-workbench.mjs") &&
      files.mcp.includes("engineeringVoiceControlSession") &&
      files.mcp.includes("engineeringVoiceControlWorkbench") &&
      files.mcp.includes("confirm_engineering_command_target") &&
      files.mcp.includes("confirm-engineering-command-target.mjs") &&
      hasAll(files.visualEngineeringTargetConfirmation, [
        "transparent_ai_visual_engineering_target_confirmation_v1",
        "transparent_ai_visual_engineering_command_intent_v1",
        "transparent_ai_numbered_target_confirmation_v1",
        "reviewed_visual_evidence_numbered_target_confirmation",
        "visualEvidencePath",
        "backdrop",
        "confirm_engineering_command_target",
        "screenshotsCapturedByThisTool: false",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.visualEngineeringTargetConfirmationSmoke.includes("transparent_ai_visual_engineering_target_confirmation_smoke_v1") &&
      files.visualEngineeringTargetConfirmationSmoke.includes("Visual evidence becomes a numbered engineering target confirmation packet") &&
      files.visualEngineeringTargetConfirmationSmoke.includes("Confirmed visual number reuses the existing single-target dry-run bridge") &&
      files.visualEngineeringTargetConfirmationSmoke.includes("MCP advanced tool exposes visual engineering target confirmation") &&
      hasAll(files.engineeringVoiceControlSession, [
        "transparent_ai_engineering_voice_control_session_v1",
        "create-voice-teaching-kit.mjs",
        "create-engineering-command-confirmation-kit.mjs",
        "create-software-control-channel-probe.mjs",
        "create-software-control-channel-profile.mjs",
        "confirm_engineering_command_target",
        "start_teach_execute_supervised_execution",
        "targetSoftwareCommandsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.engineeringVoiceControlSessionSmoke.includes("Voice control session chains voice kit, numbered targets, read-only probe, and profile") &&
      files.engineeringVoiceControlSessionSmoke.includes("Default teach_apprentice routes non-expert voice-control request to the workbench first screen") &&
      hasAll(files.engineeringVoiceControlWorkbench, [
        "transparent_ai_engineering_voice_control_workbench_v1",
        "transparent_ai_engineering_voice_control_workbench_receipt_template_v1",
        "SpeechRecognition",
        "selectedCandidateNumber",
        "confirm_engineering_command_target",
        "workbenchDoesNotExecuteSoftware",
        "softwareActionsExecuted: false",
        "uiEventsSent: false"
      ]) &&
      files.engineeringVoiceControlWorkbenchSmoke.includes("transparent_ai_engineering_voice_control_workbench_smoke_v1") &&
      files.engineeringVoiceControlWorkbenchSmoke.includes("Workbench script writes user-facing HTML plus machine-readable state") &&
      files.engineeringVoiceControlWorkbenchSmoke.includes("HTML supports voice/text, numbered selection, and confirm packet generation without software execution") &&
      files.engineeringVoiceControlWorkbenchSmoke.includes("MCP advanced tool exposes the workbench") &&
      hasAll(files.engineeringVoiceCommandControlLoop, [
        "transparent_ai_engineering_voice_command_control_loop_v1",
        "waiting_for_numbered_target_confirmation",
        "blocked_selected_number_without_teacher_confirmation",
        "--teacher-confirmed-number",
        "create-engineering-voice-control-workbench.mjs",
        "confirm-engineering-command-target.mjs",
        "create_engineering_voice_execution_approval_gate",
        "execute_without_engineering_voice_execution_approval_gate",
        "softwareActionsExecuted: false",
        "targetSoftwareCommandsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.engineeringVoiceCommandControlLoopSmoke.includes("transparent_ai_engineering_voice_command_control_loop_smoke_v1") &&
      files.engineeringVoiceCommandControlLoopSmoke.includes("Control loop waits with numbered candidates before teacher confirmation") &&
      files.engineeringVoiceCommandControlLoopSmoke.includes("Teacher-confirmed number creates single-target dry-run execution package only") &&
      hasAll(files.engineeringCommandTarget, [
        "transparent_ai_engineering_command_target_confirmation_receipt_v1",
        "voice_text_confirmed_single_target",
        "sourceVoiceOrTextControlWorkflow",
        "voiceOrTextControlWorkflowLoaded",
        "selectedTargetOnly: true",
        "create-supervised-software-action-kit.mjs",
        "transparent_ai_confirmed_engineering_target_existing_execution_adapter_request_v1",
        "create-existing-software-execution-adapter.mjs",
        "validate-engineering-command-target-confirmation-receipt.mjs",
        "targetConfirmationReceiptValidationRequired",
        "--create-execution-adapter",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.engineeringCommandTargetReceiptValidation, [
        "transparent_ai_engineering_command_target_confirmation_receipt_validation_v1",
        "ready_for_execution_approval_gate_not_execution",
        "blocked_invalid_command_target_confirmation_receipt",
        "validationDoesNotExecuteTargetSoftware: true",
        "validationDoesNotSendUiEvents: true",
        "validationDoesNotCaptureScreenshots: true",
        "validationDoesNotWriteMemory: true",
        "execute_voice_command_from_unvalidated_target_receipt"
      ]) &&
      files.engineeringCommandSmoke.includes("Engineering command kit marks possible positions with teacher-confirmed numbers") &&
      files.engineeringCommandSmoke.includes("Numbered candidates compile into a transparent overlay packet for the supervised action bridge") &&
      files.engineeringCommandSmoke.includes("MCP advanced mode exposes and runs engineering command confirmation kit") &&
      files.engineeringCommandSmoke.includes("Default teach_apprentice routes natural engineering voice/text control request to confirmation card") &&
      files.engineeringCommandTargetSmoke.includes("Confirmed engineering command target narrows numbered candidates to one selected overlay") &&
      files.engineeringCommandTargetSmoke.includes("Confirmed single target compiles into one supervised action instead of all candidates") &&
      files.engineeringCommandTargetSmoke.includes("Confirmed single target selects an existing execution adapter before any real software execution") &&
      files.engineeringCommandTargetSmoke.includes("Default teach_apprentice routes confirmed number review to selected-target action bridge card") &&
      files.realLocalEngineeringVoiceControlClosedLoopSmoke.includes("transparent_ai_real_local_engineering_voice_control_closed_loop_smoke_v1") &&
      files.realLocalEngineeringVoiceControlClosedLoopSmoke.includes("Real local software candidate feeds the voice/text control session") &&
      files.realLocalEngineeringVoiceControlClosedLoopSmoke.includes("Voice or typed instruction produces numbered target candidates before execution") &&
      files.realLocalEngineeringVoiceControlClosedLoopSmoke.includes("Teacher-confirmed number narrows voice command to one selected target") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("transparent_ai_real_local_engineering_voice_controlled_execution_smoke_v1") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Real local software candidate is selected before voice controlled execution") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Voice or typed engineering command marks numbered possible positions for teacher confirmation") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Teacher-confirmed controlled CLI route writes only inside the execution package") &&
      files.realLocalEngineeringVoiceCommandControlLoopSmoke.includes("transparent_ai_real_local_engineering_voice_command_control_loop_smoke_v1") &&
      files.realLocalEngineeringVoiceCommandControlLoopSmoke.includes("Real local software candidate feeds the one-command voice control loop") &&
      files.realLocalEngineeringVoiceCommandControlLoopSmoke.includes("Teacher-confirmed real local number creates one selected dry-run package") &&
      files.realLocalEngineeringVoiceCommandControlLoopSmoke.includes("Real local one-command loop keeps broad completion honest") &&
      hasAll(files.engineeringVoiceExecutionApprovalGate, [
        "transparent_ai_engineering_voice_execution_approval_gate_v1",
        "missing_explicit_teacher_voice_execute_confirmation",
        "missing_target_confirmation_receipt_validation",
        "targetConfirmationValidation",
        "rollback_point_not_confirmed_for_voice_execute_attempt",
        "approvalGateDoesNotRunRunner: true",
        "targetSoftwareCommandsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.engineeringVoiceExecutionApprovalGateSmoke.includes("transparent_ai_engineering_voice_execution_approval_gate_smoke_v1") &&
      files.engineeringVoiceExecutionApprovalGateSmoke.includes("Approval gate blocks voice execute request without target validation route evidence and rollback point") &&
      files.engineeringVoiceExecutionApprovalGateSmoke.includes("Approval gate produces a runner request but does not execute voice command") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Voice or typed command creates numbered target candidates for real local software") &&
      hasAll(files.goalCommandCenter, [
        "transparent_ai_goal_command_center_v1",
        "create-engineering-voice-control-workbench.mjs",
        "confirmNumberedTarget",
        "confirm_engineering_command_target",
        "voiceExecutionApprovalGate",
        "create_engineering_voice_execution_approval_gate",
        "engineeringVoiceExecutionApprovalGateRequired: true",
        "execute_without_engineering_voice_execution_approval_gate",
        "numberedTargetConfirmationRequired: true",
        "dryRunFirst: true"
      ]) &&
      files.goalCommandCenterSmoke.includes("Command center exposes next calls for teacher method, read-only observation, numbered confirmation, voice approval gate, rehearsal, and supervised gate") &&
      hasAll(files.spatialTargetConfirmation, [
        "transparent_ai_spatial_target_confirmation_kit_v1",
        "transparent_ai_spatial_numbered_target_confirmation_workflow_v1",
        "transparent_ai_numbered_target_confirmation_v1",
        "confirm_engineering_command_target"
      ]) &&
      files.spatialTargetConfirmationSmoke.includes("Spatial target bridge derives numbered candidates from transparent overlay and spatial intent"),
    evidence:
      "voice/text commands become numbered target packets, the confirmed number narrows to one selected overlay, a receipt validator proves the single-target evidence before execution approval, and the voice execution approval gate blocks runner requests until validated target evidence, reviewed route evidence, teacher confirmation, and rollback are present"
  },
  {
    requirement: "Provides transparent drawing mask / overlay for teacher sketches",
    pass:
      hasAll(files.overlay, [
        "transparent_ai_sketch_overlay_packet_v1",
        "transparentDrawingMask: true",
        "browserOverlay: true",
        "windowsTopMostOverlayScript: true",
        "supports2DPlaneSketch: true",
        "supports3DDepthHints: true",
        "supportsPerspectiveRelationships: true",
        "CurrentDepth",
        "perspective_grid",
        "depth_axis_3d",
        "zHint = $_.zHint",
        "perspectiveCues=$PerspectiveCues"
      ]) &&
      files.mcp.includes("create_transparent_sketch_overlay_kit") &&
      files.mcp.includes("create_spatial_target_confirmation_kit") &&
      files.mcp.includes("hasTransparentOverlaySetupIntent") &&
      files.toolSurfaceSmoke.includes("Default teach_apprentice creates transparent overlay kit from natural 2D/3D sketch request") &&
      files.existingDrawingSpatialControlledExecutionSmoke.includes("Teacher drawing packet preserves 2D position, perspective, and 3D depth evidence") &&
      files.transparentOverlayBrowserSpatialFlowSmoke.includes("transparent_ai_transparent_overlay_browser_packet_spatial_flow_smoke_v1") &&
      files.transparentOverlayBrowserSpatialFlowSmoke.includes("Browser overlay JS generates 2D perspective and 3D depth packet") &&
      files.transparentOverlayBrowserSpatialFlowSmoke.includes("Browser overlay spatial flow keeps execution memory and native claims locked") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Transparent mask preserves 2D position, perspective, and 3D depth sketch evidence"),
    evidence: "default teach_apprentice natural-language route + browser overlay actual packet export + Windows top-most overlay script + structured packet schema"
  },
  {
    requirement: "Audits that 2D perspective 3D sketch demonstration is implemented end to end",
    pass:
      files.sketchDemonstrationImplementationAuditSmoke.includes("transparent_ai_sketch_demonstration_implementation_audit_smoke_v1") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("Existing drawing software is reused before transparent mask execution planning") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("Teacher sketch packet carries 2D position perspective and 3D depth strokes") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("Spatial interpreter derives position perspective and depth relationships from the sketch") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("Sketch targets are converted into numbered teacher confirmation candidates") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("Confirmed sketch intent bridges to dry-run-first software execution routes") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("Controlled proof executes only a reviewed package-local route and then verifies low-token outcome") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("Real local proof remains review-only without screenshot memory or native universal execution") &&
      files.transparentOverlayBrowserSpatialFlowSmoke.includes("Browser-generated spatial intent becomes numbered target confirmation") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("transparentDrawingMaskImplemented: true") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("teacher3DDepthSketchUnderstood: true") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("unattendedNativeUniversalExecutionProven: false") &&
      files.transparentSketchDepthDemonstrationRehearsal.includes("transparent_ai_transparent_sketch_depth_demonstration_rehearsal_v1") &&
      files.transparentSketchDepthDemonstrationRehearsal.includes("teacher2DSketchUnderstood: true") &&
      files.transparentSketchDepthDemonstrationRehearsal.includes("teacherPerspectiveSketchUnderstood: true") &&
      files.transparentSketchDepthDemonstrationRehearsal.includes("teacher3DDepthSketchUnderstood: true") &&
      files.transparentSketchDepthDemonstrationRehearsal.includes("rehearsalDoesNotExecuteSoftware: true") &&
      files.transparentSketchDepthDemonstrationRehearsalSmoke.includes("transparent_ai_transparent_sketch_depth_demonstration_rehearsal_smoke_v1") &&
      files.transparentSketchDepthDemonstrationRehearsalSmoke.includes("Default rehearsal waits for exactly one teacher-confirmed number") &&
      files.transparentSketchDepthDemonstrationRehearsalSmoke.includes("Numbered target confirmation and selected target route remain dry-run-first") &&
      files.transparentSketchDepthRehearsalReviewReceiptBuilder.includes(
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_builder_v1"
      ) &&
      files.transparentSketchDepthRehearsalReviewReceiptBuilder.includes("teacher_confirms_understanding") &&
      files.transparentSketchDepthRehearsalReviewReceiptBuilder.includes("teacher_requests_correction") &&
      files.transparentSketchDepthRehearsalReviewReceiptValidation.includes(
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_validation_v1"
      ) &&
      files.transparentSketchDepthRehearsalReviewReceiptValidation.includes("teacher_confirmed_depth_rehearsal_review_only") &&
      files.transparentSketchDepthRehearsalReviewReceiptValidation.includes(
        "teacher_correction_required_before_route_review"
      ) &&
      files.transparentSketchDepthRehearsalReviewReceiptValidation.includes("readyForExecution: false") &&
      files.transparentSketchDepthRehearsalReviewReceiptSmoke.includes(
        "transparent_ai_transparent_sketch_depth_rehearsal_review_receipt_smoke_v1"
      ) &&
      files.transparentSketchDepthRehearsalReviewReceiptSmoke.includes("Forbidden execute-now receipt is rejected") &&
      repoPackageJson.scripts?.["smoke:plugin-transparent-sketch-depth-rehearsal-review-receipt"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-transparent-sketch-depth-rehearsal-review-receipt.mjs",
    evidence: "dedicated implementation audit plus reusable rehearsal ties existing drawing tools, transparent mask, 2D/perspective/3D interpretation, numbered confirmation, dry-run route bridge, teacher review receipt, and real-local context into one proof"
  },
  {
    requirement: "Understands position, perspective, and 2D/3D depth demonstration before execution",
    pass:
      hasAll(files.spatialIntent, [
        "transparent_ai_spatial_intent_interpretation_v1",
        "moves_toward",
        "points_at",
        "perspective_to",
        "nearer_than",
        "farther_than",
        "supports2D",
        "supports3DDepthHints"
      ]) &&
      hasAll(files.spatialTargetConfirmation, [
        "perspective_to",
        "nearer_than",
        "farther_than",
        "spatial_intent_numbered_target_confirmation",
        "preserves2DPositionPerspectiveAndDepthEvidence"
      ]) &&
      hasAll(files.spatialExecutionRouteBridge, [
        "transparent_ai_spatial_software_execution_route_bridge_v1",
        "transparent_ai_selected_spatial_execution_target_v1",
        "waiting_for_numbered_spatial_target_confirmation",
        "selectedTargetOnly: true"
      ]) &&
      files.spatialIntentSmoke.includes("Spatial interpreter infers relative position, perspective, and depth relationships") &&
      hasAll(files.spatialIntentSmoke, ["moves_toward", "nearer_than", "perspective_to"]) &&
      files.transparentOverlayBrowserSpatialFlowSmoke.includes("Browser-generated packet flows into spatial interpretation") &&
      files.transparentOverlayBrowserSpatialFlowSmoke.includes("Browser-generated spatial intent becomes numbered target confirmation") &&
      files.spatialTargetConfirmationSmoke.includes("Spatial target bridge writes a numbered overlay compatible with the existing confirmation bridge") &&
      files.spatialExecutionRouteBridgeSmoke.includes("Confirmed spatial target binds exactly one 2D/3D sketch target to execution route candidates") &&
      files.realLocalSpatialExecutionRouteSmoke.includes("transparent_ai_real_local_spatial_execution_route_smoke_v1") &&
      files.realLocalSpatialExecutionRouteSmoke.includes("Spatial interpreter preserves 2D, perspective, and 3D depth relations for real local software") &&
      files.existingDrawingSpatialControlledExecutionSmoke.includes("Spatial interpreter reads drawing-derived 2D perspective and depth intent before execution") &&
      files.existingDrawingSpatialControlledExecutionSmoke.includes("Drawing-derived spatial target is numbered and teacher-confirmed before route selection") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Spatial target confirmation narrows teacher sketch intent to one confirmed number"),
    evidence: "spatial interpreter covers 2D, perspective, relative anchors, depth hints, numbered confirmation, selected-target route binding, existing drawing software context, and a bounded real-local software context"
  },
  {
    requirement: "Logicizes every consequential detail before similar output or software action",
    pass:
      hasAll(files.parametricDrawingLogic, [
        "transparent_ai_parametric_drawing_logic_learning_kit_v1",
        "transparent_ai_universal_detail_logic_contract_v1",
        "All consequential output details must be logicized before generation; visual similarity is never enough by itself.",
        "featureId|featureType|dataFieldOrVariable|formulaOrConstraint",
        "generate_any_consequential_detail_without_logic_source",
        "override_missing_logic_with_visual_similarity",
        "treat_line_or_angle_examples_as_the_complete_logic_scope",
        "surfaceSimilarityOnlyAccepted: false",
        "nextReceiptValidationCommand",
        "validate-parametric-drawing-logic-receipt.mjs"
      ]) &&
      hasAll(files.parametricDrawingLogicReceiptValidation, [
        "transparent_ai_parametric_drawing_logic_receipt_validation_v1",
        "relationshipRows",
        "universalDetailLogicRows",
        "transferValidationRows",
        "blocked_until_teacher_reviews_every_consequential_detail_logic_row",
        "ready_for_review_only_dry_run_generation_plan",
        "surfaceSimilarityOnlyAccepted: false",
        "targetOutputGenerated: false",
        "softwareActionsExecuted: false",
        "memoryWritten: false"
      ]) &&
      hasAll(files.parametricDrawingLogicRulePackage, [
        "transparent_ai_universal_detail_logic_rule_package_v1",
        "disabled_rule_candidate_ready_for_review_only_dry_run",
        "review_only_logic_rule_package_ready_for_dry_run_application",
        "preGenerationValidationMatrix",
        "compilerDoesNotGenerateOutput: true",
        "compilerDoesNotExecuteSoftware: true",
        "compilerDoesNotWriteMemory: true",
        "compilerDoesNotEnableRules: true",
        "judge_by_visual_similarity_before_logic_validation"
      ]) &&
      hasAll(files.universalDetailLogicApplicationDryRun, [
        "transparent_ai_universal_detail_logic_application_dry_run_v1",
        "logic_applied_to_new_data_in_dry_run",
        "needs_teacher_formula_normalization",
        "review_only_logic_application_dry_run_ready_for_teacher_review",
        "dryRunDoesNotGenerateOutput: true",
        "dryRunDoesNotExecuteSoftware: true",
        "dryRunDoesNotWriteMemory: true"
      ]) &&
      hasAll(files.universalDetailLogicExistingToolPreview, [
        "transparent_ai_universal_detail_logic_existing_tool_preview_package_v1",
        "transparent_ai_universal_detail_logic_existing_tool_preview_recipe_v1",
        "review_only_existing_tool_preview_ready_for_teacher_review",
        "previewDoesNotExecuteSoftware: true",
        "previewDoesNotGenerateNativeCad: true",
        "open_svg_preview_in_browser_or_vector_editor",
        "import_svg_preview_into_draw_io_or_other_drawing_tool"
      ]) &&
      hasAll(files.overlay, [
        "transparent_ai_universal_detail_logic_contract_v1",
        "execute_or_generate_output_that_only_looks_similar_without_detail_logic",
        "generate_any_consequential_detail_without_logic_source"
      ]) &&
      hasAll(files.spatialExecutionRouteBridge, [
        "blocked_missing_detail_logic_before_execution_route",
        "teacher_detail_logic_review",
        "execute_or_generate_output_that_only_looks_similar_without_detail_logic"
      ]) &&
      files.mcp.includes("create_parametric_drawing_logic_learning_kit") &&
      files.mcp.includes("validate_parametric_drawing_logic_receipt") &&
      files.mcp.includes("compile_parametric_drawing_logic_rule_package") &&
      files.mcp.includes("apply_universal_detail_logic_rule_package_dry_run") &&
      files.mcp.includes("create_universal_detail_logic_existing_tool_preview_package") &&
      files.toolSurfaceSmoke.includes("validate_parametric_drawing_logic_receipt") &&
      files.toolSurfaceSmoke.includes("compile_parametric_drawing_logic_rule_package") &&
      files.toolSurfaceSmoke.includes("apply_universal_detail_logic_rule_package_dry_run") &&
      files.toolSurfaceSmoke.includes("create_universal_detail_logic_existing_tool_preview_package") &&
      files.parametricDrawingLogicSmoke.includes("Universal detail logic kit captures teacher feature-data formulas before transfer") &&
      files.parametricDrawingLogicSmoke.includes("Universal detail logic kit blocks surface copying until teacher maps feature-data logic") &&
      files.parametricDrawingLogicReceiptValidationSmoke.includes("Parametric logic receipt validation blocks default unreviewed receipt") &&
      files.parametricDrawingLogicReceiptValidationSmoke.includes("Parametric logic receipt validation allows only review-only dry-run planning after every detail is logic-reviewed") &&
      files.parametricDrawingLogicReceiptValidationSmoke.includes("Parametric logic receipt validation keeps line angle and depth details under one all-detail logic gate") &&
      files.parametricDrawingLogicReceiptValidationSmoke.includes("Parametric logic receipt validation fails closed on forbidden generation or execution decisions") &&
      files.parametricDrawingLogicReceiptValidationSmoke.includes("expectFailure: true") &&
      files.parametricDrawingLogicRulePackageSmoke.includes("Universal detail logic rule package compiler blocks unreviewed receipt validation") &&
      files.parametricDrawingLogicRulePackageSmoke.includes("Universal detail logic rule package compiler emits only disabled rule candidates after all detail logic is reviewed") &&
      files.parametricDrawingLogicRulePackageSmoke.includes("Universal detail logic rule package keeps line angle and depth under reusable logic validation") &&
      files.universalDetailLogicApplicationDryRunSmoke.includes("Universal detail logic application dry-run computes reviewed formulas from new data") &&
      files.universalDetailLogicApplicationDryRunSmoke.includes("Universal detail logic application dry-run keeps output generation and software execution locked") &&
      files.universalDetailLogicApplicationDryRunSmoke.includes("Universal detail logic application dry-run blocks when rule package is not ready") &&
      files.universalDetailLogicExistingToolPreviewSmoke.includes("Universal detail logic existing-tool preview package creates SVG and JSON recipe from computed dry-run values") &&
      files.universalDetailLogicExistingToolPreviewSmoke.includes("Universal detail logic existing-tool preview package keeps native generation and software execution locked") &&
      files.universalDetailLogicExistingToolPreviewSmoke.includes("Universal detail logic existing-tool preview package blocks when application dry-run is not ready"),
    evidence:
      "parametric drawing logic kit, receipt validation, disabled rule package compiler, new-data application dry-run, and existing-tool preview package now require reviewed logic and computable transfer evidence before similar output or software action"
  },
  {
    requirement: "Compiles interpreted teacher intent into supervised software actions",
    pass:
      hasAll(files.supervisedAction, [
        "transparent_ai_supervised_software_action_plan_v1",
        "transparent_ai_supervised_software_action_preflight_v1",
        "spatial-execution-readiness.json",
        "spatialExecutionReadinessPath",
        "supervised-action-outcome-verification-template.json",
        "spatialIntentInterpretation",
        "TeacherConfirmed",
        "Execute",
        "blocked_by_preflight",
        "SetCursorPos",
        "SendKeys",
        "requiresActiveTargetWindow: true",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.executionAdapter, [
        "transparent_ai_existing_software_execution_adapter_selection_v1",
        "transparent_ai_existing_software_execution_package_v1",
        "transparent_ai_existing_software_execution_receipt_v1",
        "existing-browser-automation",
        "existing-cli-or-script",
        "existing-application-api",
        "existing-file-import-export",
        "existing-windows-ui-automation",
        "run-existing-browser-automation.mjs",
        "run-existing-cli-or-script.ps1",
        "run-existing-application-api-request.mjs",
        "prepare-existing-file-import-export.mjs",
        "run-existing-windows-ui-automation.ps1",
        "dryRunDefault: true",
        "noAutonomousExecution: true",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.engineeringVoiceExecutionApprovalGate, [
        "transparent_ai_engineering_voice_execution_approval_gate_v1",
        "generatedRunnerRequest",
        "ready_for_teacher_confirmed_voice_execute_runner_request",
        "approvalGateDoesNotRunRunner: true"
      ]) &&
      files.engineeringVoiceExecutionApprovalGateSmoke.includes("Approval gate validates reviewed command evidence, teacher confirmation, and rollback marker") &&
      hasAll(files.softwareControlChannelProbe, [
        "transparent_ai_software_control_channel_probe_plan_v1",
        "transparent_ai_software_control_channel_probe_result_v1",
        "apiRoutes",
        "macroRoutes",
        "cliRoutes",
        "fileImportExportRoutes",
        "browserOrLocalServiceRoutes",
        "windowsUiFallbackRoutes",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      hasAll(files.softwareControlChannel, [
        "transparent_ai_software_control_channel_profile_v1",
        "transparent_ai_software_control_channel_existing_adapter_request_v1",
        "--probe-result",
        "sourceProbeResult",
        "read_only_probe_found_api_sdk_or_com_route",
        "existing-browser-automation",
        "existing-cli-or-script",
        "existing-application-api",
        "existing-file-import-export",
        "existing-windows-ui-automation",
        "Prefer reviewed existing control channels before supervised UI automation",
        "create-existing-software-execution-adapter.mjs",
        "softwareActionsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.spatialExecutionRouteBridge, [
        "transparent_ai_spatial_software_execution_route_bridge_v1",
        "transparent_ai_spatial_software_execution_route_receipt_v1",
        "create_existing_software_execution_adapter",
        "create_post_action_evidence_checkpoint",
        "targetSoftwareCommandsExecuted: false",
        "nativeUniversalExecution: false"
      ]) &&
      hasAll(files.supervisedOutcome, [
        "transparent_ai_supervised_action_outcome_verification_v1",
        "transparent_ai_existing_software_execution_receipt_v1",
        "existing_software_execution",
        "existing_execution_dry_run_verified_no_events",
        "blocked_before_existing_execution",
        "blocked_before_ui_events",
        "dry_run_verified_no_ui_events",
        "post_action_metadata_changed_waiting_for_teacher_review",
        "watch-log-source-metadata-deltas.mjs"
      ]) &&
      hasAll(files.postActionCheckpoint, [
        "transparent_ai_post_action_low_token_evidence_checkpoint_v1",
        "transparent_ai_post_action_low_token_evidence_checkpoint_receipt_v1",
        "transparent_ai_post_action_low_token_state_snapshot_v1",
        "post_action_changed_waiting_for_teacher_review",
        "post_action_no_cheap_change_waiting_for_teacher_or_visual_check",
        "maxScreenshots: screenshotRecommended ? 1 : 0",
        "outcomeAccepted: false",
        "ruleEnabled: false",
        "packagingGated: true"
      ]) &&
      files.mcp.includes("verify_supervised_action_outcome") &&
      files.mcp.includes("create_post_action_evidence_checkpoint") &&
      files.mcp.includes("create_spatial_software_execution_route_bridge") &&
      files.mcp.includes("spatialSoftwareExecutionRouteBridge") &&
      files.mcp.includes("postActionEvidenceCheckpoint") &&
      files.mcp.includes("create_existing_software_execution_adapter") &&
      files.executionAdapterSmoke.includes("Adapter selection prefers browser automation") &&
      files.executionAdapterSmoke.includes("Selection package keeps execution and acceptance gates closed") &&
      files.executionAdapterSmoke.includes("Selection package generates dry-run-first existing execution runners") &&
      files.executionAdapterSmoke.includes("Generated browser automation runner writes a dry-run receipt without browser events") &&
      files.softwareControlChannelProbeSmoke.includes("Read-only probe discovers reusable route clues from bounded metadata") &&
      files.softwareControlChannelProbeSmoke.includes("Probe result feeds the software control-channel profile before adapter selection") &&
      files.softwareControlChannelSmoke.includes("Control channel profile ranks structured routes before Windows UI fallback") &&
      files.softwareControlChannelSmoke.includes("Control profile can create an existing adapter package without executing software") &&
      files.softwareControlChannelSmoke.includes("Default teach_apprentice routes control-channel intent to the profile bridge") &&
      files.allSoftwareControlChannelCoverageAudit.includes("transparent_ai_all_software_control_channel_coverage_audit_v1") &&
      files.allSoftwareControlChannelCoverageAudit.includes("create-software-control-channel-profile.mjs") &&
      files.allSoftwareControlChannelCoverageAudit.includes("nativeUniversalExecution: false") &&
      files.realLocalAllSoftwareControlChannelCoverageAuditSmoke.includes("Audit classifies every row into structured route, UI fallback, observation-only, or missing teacher evidence") &&
      files.realLocalAllSoftwareControlChannelCoverageAuditSmoke.includes("Repair queue preserves control gaps instead of claiming universal native execution") &&
      files.allSoftwareExecutionPilotQueue.includes("transparent_ai_all_software_execution_pilot_queue_v1") &&
      files.allSoftwareExecutionPilotQueue.includes("create-existing-software-execution-adapter.mjs") &&
      files.allSoftwareExecutionPilotQueue.includes("teacherConfirmationRequired: true") &&
      files.realLocalAllSoftwareExecutionPilotQueueSmoke.includes("Pilot queue converts eligible rows into teacher-confirmed dry-run-first pilots") &&
      files.realLocalAllSoftwareExecutionPilotQueueSmoke.includes("Pilot queue reuses existing execution adapter package generator") &&
      files.allSoftwareExecutionCapabilityMatrix.includes("transparent_ai_all_software_execution_capability_matrix_v1") &&
      files.allSoftwareExecutionCapabilityMatrix.includes("dry_run_pilot_package_ready") &&
      files.allSoftwareExecutionCapabilityMatrix.includes("review_and_run_one_dry_run_pilot") &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes("Matrix maps software rows into execution capability stages and next review lanes") &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes("Matrix links dry-run pilot-ready rows to existing pilot runner instead of claiming native control") &&
      files.allSoftwareExecutionPilotRunner.includes("transparent_ai_all_software_execution_pilot_runner_v1") &&
      files.allSoftwareExecutionPilotRunner.includes("runAdapterRunner") &&
      files.allSoftwareExecutionPilotRunner.includes("verify-supervised-action-outcome.mjs") &&
      files.allSoftwareExecutionPilotRunner.includes("create-post-action-evidence-checkpoint.mjs") &&
      files.realLocalAllSoftwareExecutionPilotRunnerSmoke.includes("Pilot runner consumes an all-software execution pilot queue and selects one adapter runner") &&
      files.realLocalAllSoftwareExecutionPilotRunnerSmoke.includes("Pilot runner can execute a teacher-reviewed existing CLI route inside the execution package") &&
      files.realLocalAllSoftwareExecutionPilotRunnerSmoke.includes("Pilot runner verifies outcome and creates a post-action checkpoint before screenshots or learning") &&
      files.allSoftwareExecutionPilotBatch.includes("transparent_ai_all_software_execution_pilot_batch_v1") &&
      files.allSoftwareExecutionPilotBatch.includes("run-all-software-execution-pilot-runner.mjs") &&
      files.allSoftwareExecutionPilotBatch.includes("completedControlledRoutes") &&
      files.realLocalAllSoftwareExecutionPilotBatchSmoke.includes("Batch runner consumes one execution pilot queue and invokes multiple pilot runners") &&
      files.realLocalAllSoftwareExecutionPilotBatchSmoke.includes("Batch runner can complete two teacher-reviewed CLI pilot routes inside their execution packages") &&
      files.realLocalAllSoftwareExecutionPilotBatchSmoke.includes("Batch runner creates outcome verification and post-action checkpoint for every selected pilot") &&
      files.realLocalAllSoftwareExecutionReadinessBatch.includes("transparent_ai_real_local_all_software_execution_readiness_batch_v1") &&
      files.realLocalAllSoftwareExecutionReadinessBatch.includes("create-software-observer-inventory.mjs") &&
      files.realLocalAllSoftwareExecutionReadinessBatch.includes("run-all-software-execution-pilot-batch.mjs") &&
      files.realLocalAllSoftwareExecutionReadinessBatchSmoke.includes("Readiness batch creates control-channel coverage and execution pilot queue from real local rows") &&
      files.realLocalAllSoftwareExecutionReadinessBatchSmoke.includes("Readiness batch produces outcome verification and post-action checkpoints for dry-run pilots") &&
      files.realLocalExecutionPilotSelector.includes("transparent_ai_real_local_execution_pilot_selector_v1") &&
      files.realLocalExecutionPilotSelector.includes("numberedCandidates") &&
      files.realLocalExecutionPilotSelector.includes("run-all-software-execution-pilot-runner.mjs") &&
      files.realLocalExecutionPilotSelectorSmoke.includes("Selector can advance one teacher-numbered candidate into dry-run runner evidence") &&
      files.supervisedActionSmoke.includes("Action plan includes click, drag, type, and hotkey candidates") &&
      files.supervisedActionSmoke.includes("Action kit writes standalone spatial execution readiness for 2D perspective and depth review") &&
      files.supervisedActionSmoke.includes("Action kit writes outcome verification template for post-action low-token review") &&
      files.supervisedOutcomeSmoke.includes("Outcome verifier accepts existing execution package dry-run receipts") &&
      files.supervisedOutcomeSmoke.includes("MCP advanced mode exposes and runs verify_supervised_action_outcome") &&
      files.postActionCheckpointSmoke.includes("Executed receipt plus changed metadata waits for teacher review") &&
      files.postActionCheckpointSmoke.includes("Default teach_apprentice routes explicit post-action evidence requests to checkpoint card") &&
      files.supervisedActionSmoke.includes("Preflight packet checks active window, coordinate bounds, and action risk before execution") &&
      files.supervisedActionSmoke.includes("Generated runner writes dry-run preflight and receipt without sending UI events") &&
      hasAll(files.teachExecuteActionRehearsal, [
        "transparent_ai_teach_execute_action_rehearsal_v1",
        "create-supervised-software-action-kit.mjs",
        "create-software-control-channel-profile.mjs",
        "create-existing-software-execution-adapter.mjs",
        "verify-supervised-action-outcome.mjs",
        "spatialExecutionReadiness",
        "softwareActionsExecuted: false",
        "explicitExecuteStillBlocked: true"
      ]) &&
      files.teachExecuteActionRehearsalSmoke.includes("Teacher-confirmed action rehearsal links observation and overlay into action evidence") &&
      files.teachExecuteActionRehearsalSmoke.includes("Action rehearsal preserves dry-run boundary and sends no UI events") &&
      files.teachExecuteActionRehearsalSmoke.includes("Action rehearsal includes spatial depth intent, control-channel profile, and existing execution adapter") &&
      files.teachExecuteActionRehearsalSmoke.includes("directRehearsal.generatedEvidence.spatialExecutionReadiness") &&
      files.spatialIntentSmoke.includes("Supervised action bridge embeds spatial intent interpretation before dry-run execution") &&
      files.spatialTargetConfirmationSmoke.includes("Confirmed spatial target reuses the single-target action and existing-adapter path") &&
      files.spatialTargetConfirmationSmoke.includes("Default teach_apprentice routes transparent sketch numbered-target requests to the spatial confirmation bridge") &&
      files.spatialExecutionRouteBridgeSmoke.includes("Route candidates hand off to existing dry-run adapter and post-action evidence checkpoint") &&
      files.spatialExecutionRouteBridgeSmoke.includes("Default teach_apprentice routes explicit spatial execution route requests to the bridge card") &&
      files.realLocalSpatialExecutionRouteSmoke.includes("Real local software candidate is discovered before transparent sketch routing") &&
      files.realLocalSpatialExecutionRouteSmoke.includes("Control-channel profile ranks existing routes before any real local software execution") &&
      files.realLocalSpatialExecutionRouteSmoke.includes("Real local confirmed spatial target binds to dry-run route candidates only") &&
      files.realLocalSpatialExecutionRouteSmoke.includes("Real local spatial route keeps screenshots, execution, memory, acceptance, and native universal execution locked") &&
      files.realLocalEngineeringVoiceControlClosedLoopSmoke.includes("Confirmed target creates an existing execution package with dry-run runner") &&
      files.realLocalEngineeringVoiceControlClosedLoopSmoke.includes("Dry-run runner writes a no-event receipt before any engineering software action") &&
      files.realLocalEngineeringVoiceControlClosedLoopSmoke.includes("Dry-run receipt flows into outcome verification and post-action checkpoint") &&
      files.realLocalEngineeringVoiceControlClosedLoopSmoke.includes("Voice-control closed loop keeps recording, screenshots, memory, acceptance, packaging, and native execution locked") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Dry-run controlled execution route writes no output and executes no command") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Teacher-confirmed controlled CLI route writes only inside the execution package") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Controlled execution receipt flows into outcome verification and post-action checkpoint") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Voice controlled execution keeps autonomous native control, screenshots, memory, acceptance, and packaging locked") &&
      files.engineeringVoiceControlWorkbenchSmoke.includes("Workbench keeps the full-goal boundary honest") &&
      files.engineeringVoiceControlWorkbench.includes("targetSoftwareCommandsExecuted: false") &&
      files.engineeringVoiceControlWorkbench.includes("claim_universal_native_execution_or_all_software_completion") &&
      files.existingDrawingSpatialControlledExecutionSmoke.includes("Confirmed drawing target creates action readiness and dry-run-first execution routes") &&
      files.existingDrawingSpatialControlledExecutionSmoke.includes("Dry-run drawing-controlled execution writes no output and executes no command") &&
      files.existingDrawingSpatialControlledExecutionSmoke.includes("Teacher-confirmed drawing-controlled CLI route writes only inside the execution package") &&
      files.existingDrawingSpatialControlledExecutionSmoke.includes("Drawing-controlled execution receipt flows into outcome verification and post-action checkpoint") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Action rehearsal links observation and 2D/perspective/3D overlay into dry-run execution evidence") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Teacher-confirmed controlled CLI route writes only inside the execution package") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Controlled execution receipt flows into outcome verification and post-action checkpoint") &&
      hasAll(files.teachExecuteLoop, [
        "supervised_action_plan",
        "action_rehearsal",
        "supervised_execution_gate",
        "start_teach_execute_action_rehearsal",
        "start_teach_execute_supervised_execution",
        "supervised_action_outcome_verification",
        "teach_and_replay"
      ]),
    evidence: "reviewed observation plus overlay can become spatial intent, dry-run-first action plan, all-software control-channel coverage audit, all-software execution pilot queue, pilot runner, pilot batch runner, real-local readiness dry-run batch, numbered real-local pilot selector, software control-channel profile, existing execution adapter, receipt, post-action checkpoint, and low-token outcome verification; real-local smokes prove readiness on actual inventory and teacher-numbered candidates can advance to dry-run runner evidence before any execute request"
  },
  {
    requirement: "Maps all-software execution capability into next reviewed pilot lanes",
    pass:
      hasAll(files.allSoftwareExecutionCapabilityMatrix, [
        "transparent_ai_all_software_execution_capability_matrix_v1",
        "transparent_ai_all_software_execution_capability_matrix_receipt_v1",
        "transparent_ai_all_software_execution_evidence_chain_ledger_v1",
        "transparent_ai_all_software_execution_evidence_chain_ledger_summary_v1",
        "dry_run_pilot_package_ready",
        "control_route_reviewable_before_pilot",
        "observation_ready_control_evidence_missing",
        "needs_teacher_signal_or_control_evidence",
        "review_and_run_one_dry_run_pilot",
        "collect_control_channel_evidence",
        "low_token_observation",
        "control_channel",
        "teacher_intent_binding",
        "action_logic_source",
        "dry_run_execution_package",
        "rollback_and_post_action_checkpoint",
        "execute_request_blocked_until_all_evidence_chain_gaps_are_teacher_reviewed",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false",
        "logContentsRead: false",
        "allSoftwareExecutionComplete: false"
      ]) &&
      files.skill.includes("All Software Execution Capability Matrix") &&
      files.mcp.includes("create_all_software_execution_capability_matrix") &&
      files.mcp.includes("waiting_for_all_software_execution_capability_matrix_review") &&
      files.mcp.includes("allSoftwareExecutionCapabilityMatrix") &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes("transparent_ai_real_local_all_software_execution_capability_matrix_smoke_v1") &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes("Real local inventory coverage and pilot evidence feed execution capability matrix") &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes("Matrix maps software rows into execution capability stages and next review lanes") &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes("Matrix writes a per-software execution evidence-chain ledger") &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes(
        "Evidence-chain ledger blocks execute requests until observation control target logic dry-run and rollback evidence are reviewed"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes("Matrix links dry-run pilot-ready rows to existing pilot runner instead of claiming native control") &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixSmoke.includes("Matrix keeps screenshots logs memory UI events target commands and packaging locked"),
    evidence:
      "all-software execution capability matrix now includes a per-software evidence-chain ledger connecting real local observation, control coverage, target/route binding, action logic, dry-run packages, rollback evidence, and next review lanes without claiming universal native control"
  },
  {
    requirement: "Advances execution capability matrix lanes through bounded follow-up batches",
    pass:
      hasAll(files.allSoftwareExecutionCapabilityMatrixFollowUpBatch, [
        "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_v1",
        "transparent_ai_all_software_execution_capability_matrix_follow_up_batch_receipt_v1",
        "review_and_run_one_dry_run_pilot",
        "dry_run_runner_call_prepared_waiting_for_teacher_review",
        "control_channel_probe_package_created_waiting_for_teacher_review",
        "waiting_for_numbered_target_or_exact_route_confirmation",
        "waiting_for_visible_window_and_numbered_target_confirmation",
        "waiting_for_teacher_signal_or_exclusion",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false",
        "screenshotsCaptured: false",
        "logContentsRead: false",
        "fileContentsRead: false",
        "memoryWritten: false",
        "allSoftwareExecutionComplete: false"
      ]) &&
      files.skill.includes("run_all_software_execution_capability_matrix_follow_up_batch") &&
      files.skill.includes("create_all_software_execution_follow_up_handoff_queue") &&
      files.skill.includes("run_all_software_execution_follow_up_handoff_queue_item") &&
      files.skill.includes("create_all_software_execution_follow_up_handoff_item_receipt_builder") &&
      files.skill.includes("validate_all_software_execution_follow_up_handoff_item_receipt") &&
      files.skill.includes("run_all_software_execution_approval_gate_prep_runner") &&
      files.skill.includes("run_all_software_execution_approved_gate_runner") &&
      files.mcp.includes("run_all_software_execution_capability_matrix_follow_up_batch") &&
      files.mcp.includes("create_all_software_execution_follow_up_handoff_queue") &&
      files.mcp.includes("run_all_software_execution_follow_up_handoff_queue_item") &&
      files.mcp.includes("create_all_software_execution_follow_up_handoff_item_receipt_builder") &&
      files.mcp.includes("validate_all_software_execution_follow_up_handoff_item_receipt") &&
      files.mcp.includes("run_all_software_execution_approval_gate_prep_runner") &&
      files.mcp.includes("run_all_software_execution_approved_gate_runner") &&
      files.mcp.includes("run-all-software-execution-follow-up-handoff-queue-item.mjs") &&
      files.mcp.includes("validate-all-software-execution-follow-up-handoff-item-receipt.mjs") &&
      files.mcp.includes("run-all-software-execution-approval-gate-prep-runner.mjs") &&
      files.mcp.includes("run-all-software-execution-approved-gate-runner.mjs") &&
      files.mcp.includes("waiting_for_all_software_execution_capability_matrix_follow_up_review") &&
      files.mcp.includes("allSoftwareExecutionCapabilityMatrixFollowUpBatch") &&
      hasAll(files.allSoftwareExecutionFollowUpHandoffQueue, [
        "transparent_ai_all_software_execution_follow_up_handoff_queue_v1",
        "reviewed_dry_run_runner_command",
        "manual_dry_run_runner_handoffs_ready",
        "queueDoesNotInvokeRunner: true",
        "queueDoesNotExecuteTargetSoftware: true",
        "queueDoesNotSendUiEvents: true",
        "queueDoesNotReadLogs: true",
        "queueDoesNotCaptureScreenshots: true",
        "queueDoesNotRegisterSchedule: true",
        "queueDoesNotWriteMemory: true",
        "claim_all_software_execution_complete_from_queue"
      ]) &&
      files.allSoftwareExecutionFollowUpHandoffQueueSmoke.includes(
        "transparent_ai_all_software_execution_follow_up_handoff_queue_smoke_v1"
      ) &&
      files.allSoftwareExecutionFollowUpHandoffQueueSmoke.includes("classifies safe dry-run runner commands") &&
      files.allSoftwareExecutionFollowUpHandoffQueueSmoke.includes("blocks unsafe execute commands") &&
      hasAll(files.allSoftwareExecutionFollowUpHandoffItemCommandBuilder, [
        "transparent_ai_execution_follow_up_handoff_item_command_builder_v1",
        "run-all-software-execution-follow-up-handoff-queue-item.mjs",
        "teacher confirmed execution follow-up dry-run item",
        "builderDoesNotRunHandoffItem: true",
        "builderDoesNotInvokeRunner: true",
        "builderDoesNotReadLogs: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotSendUiEvents: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotWriteMemory: true"
      ]) &&
      hasAll(files.allSoftwareExecutionFollowUpHandoffQueueItemRunner, [
        "transparent_ai_all_software_execution_follow_up_handoff_queue_item_run_v1",
        "run-all-software-execution-pilot-runner.mjs",
        "dry_run_pilot_runner_completed_waiting_for_teacher_review",
        "queueItemRunnerDoesNotPassExecuteFlag: true",
        "queueItemRunnerDoesNotExecuteTargetSoftware: true",
        "queueItemRunnerDoesNotCaptureScreenshots: true",
        "queueItemRunnerDoesNotWriteMemory: true",
        "blocked_before_pilot_runner",
        "state/state-dir log inputs require"
      ]) &&
      files.allSoftwareExecutionFollowUpHandoffQueueItemRunnerSmoke.includes(
        "transparent_ai_all_software_execution_follow_up_handoff_queue_item_runner_smoke_v1"
      ) &&
      files.allSoftwareExecutionFollowUpHandoffQueueItemRunnerSmoke.includes(
        "consumes one ready dry-run runner item and invokes the existing pilot runner"
      ) &&
      files.allSoftwareExecutionFollowUpHandoffQueueItemRunnerSmoke.includes("blocks unsafe execute handoffs") &&
      repoPackageJson.scripts?.["smoke:plugin-all-software-execution-follow-up-handoff-queue-item-runner"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-follow-up-handoff-queue-item-runner.mjs" &&
      hasAll(files.allSoftwareExecutionFollowUpHandoffItemReceiptBuilder, [
        "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_builder_v1",
        "transparent_ai_all_software_execution_follow_up_handoff_item_review_receipt_v1",
        "builderDoesNotCreateApprovalGate: true",
        "builderDoesNotExecuteTargetSoftware: true"
      ]) &&
      hasAll(files.allSoftwareExecutionFollowUpHandoffItemReceiptValidation, [
        "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_validation_v1",
        "ready_for_execution_approval_gate_planning",
        "create-real-local-execution-approval-gate.mjs",
        "validationDoesNotCreateApprovalGate: true",
        "validationDoesNotExecuteTargetSoftware: true",
        "blocked_for_forbidden_decision"
      ]) &&
      files.allSoftwareExecutionFollowUpHandoffItemReceiptReviewSmoke.includes(
        "transparent_ai_all_software_execution_follow_up_handoff_item_receipt_review_smoke_v1"
      ) &&
      files.allSoftwareExecutionFollowUpHandoffItemReceiptReviewSmoke.includes(
        "Matched teacher receipt becomes approval-gate planning only, not execution"
      ) &&
      files.allSoftwareExecutionFollowUpHandoffItemReceiptReviewSmoke.includes("Forbidden execute-now decision fails closed before approval gate planning") &&
      files.allSoftwareExecutionFollowUpHandoffItemReceiptReviewSmoke.includes("expectFailure: true") &&
      repoPackageJson.scripts?.["smoke:plugin-all-software-execution-follow-up-handoff-item-receipt-review"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-follow-up-handoff-item-receipt-review.mjs" &&
      hasAll(files.allSoftwareExecutionApprovalGatePrepRunner, [
        "transparent_ai_all_software_execution_approval_gate_prep_runner_v1",
        "create-real-local-execution-approval-gate.mjs",
        "blocked_before_approval_gate",
        "prepRunnerDoesNotInvokeExecutionRunner: true",
        "prepRunnerDoesNotExecuteTargetSoftware: true",
        "approvalGateDoesNotRunRunner: true"
      ]) &&
      files.allSoftwareExecutionApprovalGatePrepRunnerSmoke.includes(
        "transparent_ai_all_software_execution_approval_gate_prep_runner_smoke_v1"
      ) &&
      files.allSoftwareExecutionApprovalGatePrepRunnerSmoke.includes(
        "Ready dry-run validation prepares an approval gate without executing the runner"
      ) &&
      files.allSoftwareExecutionApprovalGatePrepRunnerSmoke.includes("Non-ready validation is blocked before approval gate") &&
      repoPackageJson.scripts?.["smoke:plugin-all-software-execution-approval-gate-prep-runner"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-approval-gate-prep-runner.mjs" &&
      hasAll(files.allSoftwareExecutionApprovedGateCommandBuilder, [
        "transparent_ai_execution_approved_gate_command_builder_v1",
        "run-all-software-execution-approved-gate-runner.mjs",
        "teacher confirmed approved execution gate runner",
        "builderDoesNotRunApprovedGate: true",
        "builderDoesNotInvokeRunner: true",
        "builderDoesNotExecuteTargetSoftware: true",
        "builderDoesNotSendUiEvents: true",
        "builderDoesNotCaptureScreenshots: true",
        "builderDoesNotWriteMemory: true",
        "generatedCommandRequiresTeacherConfirmation: true",
        "generatedCommandRequiresRollback: true"
      ]) &&
      repoPackageJson.scripts?.["smoke:plugin-execution-approved-gate-command-builder"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-execution-approved-gate-command-builder.mjs" &&
      hasAll(files.allSoftwareExecutionApprovedGateRunner, [
        "transparent_ai_all_software_execution_approved_gate_runner_v1",
        "run-all-software-execution-pilot-runner.mjs",
        "missing_execute_approved_gate_flag",
        "approval_gate_not_ready_for_execute_runner_request",
        "approved_gate_controlled_route_completed_waiting_for_teacher_review",
        "memoryWritten: false",
        "nativeUniversalExecution: false"
      ]) &&
      files.allSoftwareExecutionApprovedGateRunnerSmoke.includes(
        "transparent_ai_all_software_execution_approved_gate_runner_smoke_v1"
      ) &&
      files.allSoftwareExecutionApprovedGateRunnerSmoke.includes(
        "Ready approval gate invokes exactly one existing pilot runner execute request"
      ) &&
      files.allSoftwareExecutionApprovedGateRunnerSmoke.includes(
        "Approved gate runner produces adapter receipt, outcome verification, and post-action checkpoint"
      ) &&
      repoPackageJson.scripts?.["smoke:plugin-all-software-execution-approved-gate-runner"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-approved-gate-runner.mjs" &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixFollowUpBatchSmoke.includes(
        "transparent_ai_real_local_all_software_execution_capability_matrix_follow_up_batch_smoke_v1"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixFollowUpBatchSmoke.includes(
        "Follow-up batch consumes a real-local execution capability matrix"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixFollowUpBatchSmoke.includes(
        "Unreviewed follow-up prepares calls but does not invoke dry-run pilot runners"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixFollowUpBatchSmoke.includes(
        "Teacher-reviewed follow-up advances pilot-ready rows only through dry-run runner or review-only lanes"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityMatrixFollowUpBatchSmoke.includes(
        "Follow-up keeps screenshots full logs memory target commands UI events native execution and completion locked"
      ),
    evidence:
      "execution capability matrix rows can now advance through reviewed receipt validation and a manual dry-run handoff queue before any runner evidence, while route/probe/question lanes remain review-only"
  },
  {
    requirement: "Reconciles execution capability follow-up evidence into the next reviewed matrix pass",
    pass:
      hasAll(files.allSoftwareExecutionCapabilityMatrixFollowUpReconciliation, [
        "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_v1",
        "transparent_ai_all_software_execution_capability_matrix_follow_up_reconciliation_receipt_v1",
        "review_dry_run_receipt_then_decide_execute_gate_or_more_evidence",
        "review_probe_result_then_rerun_control_channel_profile",
        "reconciled_next_execution_matrix_ready_for_review",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false",
        "softwareActionsExecuted: false",
        "screenshotsCaptured: false",
        "logContentsRead: false",
        "fileContentsRead: false",
        "memoryWritten: false",
        "allSoftwareExecutionComplete: false"
      ]) &&
      files.skill.includes("reconcile_all_software_execution_capability_matrix_follow_up_batch") &&
      files.mcp.includes("reconcile_all_software_execution_capability_matrix_follow_up_batch") &&
      files.mcp.includes("waiting_for_all_software_execution_capability_matrix_follow_up_reconciliation_review") &&
      files.mcp.includes("allSoftwareExecutionCapabilityMatrixFollowUpReconciliation") &&
      files.realLocalAllSoftwareExecutionCapabilityFollowUpReconciliationSmoke.includes(
        "transparent_ai_real_local_all_software_execution_capability_follow_up_reconciliation_smoke_v1"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityFollowUpReconciliationSmoke.includes(
        "Reconciliation consumes a follow-up batch and keeps unreviewed rerun disabled by default"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityFollowUpReconciliationSmoke.includes(
        "Teacher-reviewed reconciliation can regenerate safe next coverage pilot queue and matrix packages"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityFollowUpReconciliationSmoke.includes(
        "Reconciliation keeps screenshots logs memory target commands UI events native execution and completion locked"
      ),
    evidence:
      "execution capability follow-up results can now be reconciled into explicit next lanes and safe next coverage, pilot queue, and matrix packages after teacher review"
  },
  {
    requirement: "Supervises repeated execution capability matrix passes without broad native-control claims",
    pass:
      hasAll(files.allSoftwareExecutionCapabilitySupervisor, [
        "transparent_ai_all_software_execution_capability_supervisor_v1",
        "transparent_ai_all_software_execution_capability_supervisor_receipt_v1",
        "prepared_follow_up_waiting_for_teacher_review",
        "reviewed_rounds_completed_waiting_for_teacher_matrix_review",
        "run-all-software-execution-capability-matrix-follow-up-batch.mjs",
        "reconcile-all-software-execution-capability-matrix-follow-up-batch.mjs",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false",
        "softwareActionsExecuted: false",
        "screenshotsCaptured: false",
        "logContentsRead: false",
        "fileContentsRead: false",
        "memoryWritten: false",
        "allSoftwareExecutionComplete: false"
      ]) &&
      files.skill.includes("run_all_software_execution_capability_supervisor") &&
      files.mcp.includes("run_all_software_execution_capability_supervisor") &&
      files.mcp.includes("waiting_for_all_software_execution_capability_supervisor_review") &&
      files.realLocalAllSoftwareExecutionCapabilitySupervisorSmoke.includes(
        "transparent_ai_real_local_all_software_execution_capability_supervisor_smoke_v1"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilitySupervisorSmoke.includes(
        "Execution capability supervisor reuses matrix follow-up and stops before reconciliation without teacher review"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilitySupervisorSmoke.includes(
        "Teacher-reviewed execution capability supervisor advances multiple safe matrix rounds"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilitySupervisorSmoke.includes(
        "Supervisor preserves screenshots logs memory target commands UI events and packaging locks"
      ),
    evidence:
      "execution capability matrix follow-up and reconciliation can now be run through bounded supervised repeated rounds while completion and native universal execution remain unclaimed"
  },
  {
    requirement: "Audits execution capability convergence before completion claims",
    pass:
      hasAll(files.allSoftwareExecutionCapabilityConvergenceAudit, [
        "transparent_ai_all_software_execution_capability_convergence_audit_v1",
        "transparent_ai_all_software_execution_capability_convergence_audit_receipt_v1",
        "execution_capability_still_has_remaining_lanes_or_review_gaps",
        "bounded_execution_capability_ready_for_teacher_completion_review",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false",
        "softwareActionsExecuted: false",
        "screenshotsCaptured: false",
        "logContentsRead: false",
        "fileContentsRead: false",
        "memoryWritten: false",
        "nativeUniversalExecution: false",
        "allSoftwareExecutionComplete: false"
      ]) &&
      files.skill.includes("create_all_software_execution_capability_convergence_audit") &&
      files.mcp.includes("create_all_software_execution_capability_convergence_audit") &&
      files.mcp.includes("waiting_for_all_software_execution_capability_convergence_review") &&
      files.realLocalAllSoftwareExecutionCapabilityConvergenceAuditSmoke.includes(
        "transparent_ai_real_local_all_software_execution_capability_convergence_audit_smoke_v1"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityConvergenceAuditSmoke.includes(
        "Execution convergence audit detects missing supervisor before completion review"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityConvergenceAuditSmoke.includes(
        "Execution convergence audit aggregates real-local supervisor rounds and latest matrix"
      ) &&
      files.realLocalAllSoftwareExecutionCapabilityConvergenceAuditSmoke.includes(
        "Execution convergence audit preserves completion and native-control locks"
      ),
    evidence:
      "execution capability supervisor packets can now be aggregated into a convergence audit that identifies remaining route, target-confirmation, dry-run, or teacher-evidence gaps without claiming completion"
  },
  {
    requirement: "Provides a teacher-confirmed supervised execution gate after action rehearsal",
    pass:
      hasAll(files.teachExecuteSupervisedExecution, [
        "transparent_ai_teach_execute_supervised_execution_v1",
        "blocked_waiting_for_teacher_supervised_execution_confirmation",
        "blocked_missing_target_window_title",
        "blocked_target_window_title_not_baked_into_plan",
        "blocked_spatial_execution_readiness_not_confirmed",
        "spatialReadinessConfirmationRequiredForExecute",
        "spatialExecutionReadinessReview",
        "dry_run_verified_no_ui_events",
        "executed_under_teacher_supervision_waiting_for_outcome_review",
        "verify-supervised-action-outcome.mjs",
        "runnerReceiptBeforeScreenshots: true",
        "metadataDeltaBeforeScreenshots: true",
        "softwareActionsExecuted: executed",
        "nativeUniversalExecution: false",
        "packagingGated: true"
      ]) &&
      files.mcp.includes("start_teach_execute_supervised_execution") &&
      files.mcp.includes("teachExecuteSupervisedExecution") &&
      files.mcp.includes("hasExplicitSupervisedExecutionConfirmation") &&
      files.teachExecuteSupervisedExecutionSmoke.includes("Supervised execution gate blocks without explicit teacher confirmation") &&
      files.teachExecuteSupervisedExecutionSmoke.includes("Teacher-confirmed supervised execution gate defaults to dry-run") &&
      files.teachExecuteSupervisedExecutionSmoke.includes("Execute request blocks before runner when target window title is missing") &&
      files.teachExecuteSupervisedExecutionSmoke.includes("Execute request blocks before runner when spatial readiness is not teacher-confirmed") &&
      files.teachExecuteSupervisedExecutionSmoke.includes("Default teach_apprentice routes action rehearsal to supervised execution gate card") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Supervised execution gate defaults to dry-run and blocks execute without target-window evidence") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Dry-run controlled execution route writes no output and executes no command") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Teacher-confirmed controlled CLI route writes only inside the execution package") &&
      files.realLocalAllSoftwareExecutionPilotRunnerSmoke.includes("Pilot runner can execute a teacher-reviewed existing CLI route inside the execution package") &&
      files.realLocalAllSoftwareExecutionPilotBatchSmoke.includes("Batch runner can complete two teacher-reviewed CLI pilot routes inside their execution packages") &&
      files.realLocalAllSoftwareExecutionReadinessBatchSmoke.includes("Readiness batch runs selected real local pilots in dry-run mode only") &&
      files.realLocalExecutionPilotSelectorSmoke.includes("Selector keeps real execution, screenshots, memory, and universal completion locked") &&
      files.engineeringVoiceExecutionApprovalGateSmoke.includes(
        "Approval gate blocks voice execute request without target validation route evidence and rollback point"
      ) &&
      files.engineeringVoiceExecutionApprovalGateSmoke.includes("Approval gate validates reviewed command evidence, teacher confirmation, and rollback marker") &&
      files.engineeringVoiceExecutionApprovalGateSmoke.includes("Approval gate produces a runner request but does not execute voice command"),
    evidence: "action rehearsal, voice/text confirmed targets, target-confirmation validation, and all-software pilot queues can enter teacher-confirmed runner gates that reuse generated runners; the real-local selector and voice approval gate add numbered teacher choice, validated target evidence, route evidence, rollback, and explicit teacher confirmation before any execute request"
  },
  {
    requirement: "Provides one ordered observe -> intent -> execute -> receipt -> learn runbook",
    pass:
      hasAll(files.teachExecuteLoop, [
        "transparent_ai_teach_execute_learning_loop_v1",
        "create_teacher_learning_method_profile",
        "create_all_software_observer_bootstrap",
        "run_all_software_observer_supervisor",
        "create_all_software_observer_coverage_audit",
        "create_automatic_observer_schedule",
        "create_software_observer_inventory",
        "run_software_observer_queue_item",
        "monitor_software_observation_deltas",
        "run_software_observer_watch_cycle",
        "compact_universal_observation_learning_events",
        "create_transparent_sketch_overlay_kit",
        "interpret_transparent_sketch_spatial_intent",
        "create_software_control_channel_probe",
        "create_software_control_channel_profile",
        "create_spatial_software_execution_route_bridge",
        "create_existing_software_execution_adapter",
        "create_supervised_software_action_kit",
        "start_teach_execute_action_rehearsal",
        "start_teach_execute_supervised_execution",
        "verify_supervised_action_outcome",
        "create_post_action_evidence_checkpoint",
        "post_action_evidence_checkpoint",
        "transparent_ai_supervised_software_action_preflight_v1",
        "transparent_ai_supervised_software_action_execution_receipt_v1",
        "transparent_ai_supervised_action_outcome_verification_v1",
        "transparent_ai_post_action_low_token_evidence_checkpoint_v1",
        "teach_apprentice",
        "correct_last_result",
        "teacherConfirmationRequired: true"
      ]) &&
      files.teachExecuteLoopSmoke.includes("Loop reuses existing tools instead of inventing a separate automation stack") &&
      files.toolSurfaceSmoke.includes("Default teach_apprentice routes the full user goal to teach-execute loop runbook") &&
      files.toolSurfaceSmoke.includes("Default teach_apprentice routes a runbook path to safe start materials") &&
      hasAll(files.teachExecuteSafeStart, [
        "transparent_ai_teach_execute_safe_start_v1",
        "create-teacher-learning-method-profile.mjs",
        "create-all-software-observer-bootstrap.mjs",
        "create-transparent-sketch-overlay-kit.mjs",
        "create-software-control-channel-profile.mjs",
        "create-existing-software-execution-adapter.mjs",
        "softwareActionsExecuted: false",
        "screenshotsCaptured: false",
        "scheduledTaskRegistered: false",
        "memoryEnabled: false"
      ]) &&
      files.teachExecuteSafeStartSmoke.includes("Safe start reuses existing tools instead of building a separate automation stack") &&
      files.teachExecuteSafeStartSmoke.includes("Default teach_apprentice routes a runbook path to safe start card") &&
      hasAll(files.teachExecuteReviewedObservation, [
        "transparent_ai_teach_execute_reviewed_observation_v1",
        "blocked_waiting_for_teacher_confirmation",
        "create-software-observer-inventory.mjs",
        "create-software-observer-queue.mjs",
        "run-software-observer-watch-cycle.mjs",
        "softwareActionsExecuted: false"
      ]) &&
      files.teachExecuteReviewedObservationSmoke.includes("Default teach_apprentice routes safe-start path to reviewed observation card") &&
      hasAll(files.teachExecuteActionRehearsal, [
        "transparent_ai_teach_execute_action_rehearsal_v1",
        "transparent_ai_teach_execute_reviewed_observation_v1",
        "transparent_ai_sketch_overlay_packet_v1",
        "spatialExecutionReadiness",
        "didRunDryRunReceipt: true",
        "didVerifyDryRunOutcome: true",
        "softwareActionsExecuted: false"
      ]) &&
      files.teachExecuteActionRehearsalSmoke.includes("Default teach_apprentice routes reviewed observation plus overlay to action rehearsal card") &&
      hasAll(files.teachExecuteSupervisedExecution, [
        "transparent_ai_teach_execute_supervised_execution_v1",
        "didRunRunner: true",
        "didVerifyOutcome: true",
        "softwareActionsExecuted: executed"
      ]) &&
      files.teachExecuteSupervisedExecutionSmoke.includes("Default teach_apprentice routes action rehearsal to supervised execution gate card") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Safe start and reviewed observation use real local read-only evidence before action rehearsal") &&
      files.realLocalFullGoalIntegratedCycleSmoke.includes("Action rehearsal links observation and 2D/perspective/3D overlay into dry-run execution evidence") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Teacher-confirmed number narrows to one target before any controlled execution") &&
      files.realLocalEngineeringVoiceControlledExecutionSmoke.includes("Controlled execution receipt flows into outcome verification and post-action checkpoint") &&
      hasAll(files.goalCommandCenter, [
        "transparent_ai_goal_command_center_v1",
        "goal-command-center.html",
        "readOnlyObservation",
        "voiceExecutionApprovalGate",
        "actionRehearsal",
        "supervisedExecutionGate",
        "create_engineering_voice_execution_approval_gate",
        "create-teach-execute-learning-loop.mjs",
        "create_post_action_evidence_checkpoint"
      ]) &&
      files.goalCommandCenterSmoke.includes("Command center writes a unified machine-readable state and local HTML first screen") &&
      files.goalCommandCenterSmoke.includes("Command center exposes next calls for teacher method, read-only observation, numbered confirmation, voice approval gate, rehearsal, and supervised gate") &&
      files.learningWorkflow.includes("create_teach_execute_learning_loop"),
    evidence: "default teach_apprentice can route the full goal to runbook, and the goal command center now gives a local HTML start point linking safe start, reviewed observation, control-channel profiling, action rehearsal, supervised execution gate, and a teacher-confirmed controlled execution receipt path"
  },
  {
    requirement: "Keeps the honest boundary that universal native execution is not yet proven",
    pass:
      hasAll(files.skill, [
        "nativeUniversalExecution=false",
        "packagingGated=true",
        "review-only"
      ]) &&
      hasAll(files.universalObserver, ["nativeControlImplemented: false", "teacherConfirmationRequired: true"]) &&
      hasAll(files.overlay, ["nativeExecutionImplemented: false", "teacher_review_only"]) &&
      hasAll(files.supervisedAction, ["nativeUniversalExecution: false", "requiresActiveTargetWindow: true"]) &&
      hasAll(files.supervisedOutcome, ["nativeUniversalExecution: false", "technologyAccepted: false", "packagingGated: true"]) &&
      hasAll(files.teachExecuteSupervisedExecution, ["nativeUniversalExecution: false", "accepted: false", "packagingGated: true"]) &&
      hasAll(files.teachExecuteLoop, [
        "nativeUniversalExecution: false",
        "spatial intent can execute without teacher review"
      ]) &&
      hasAll(files.allSoftwareControlChannelCoverageAudit, [
        "nativeUniversalExecution: false",
        "allSoftwareControlComplete: false",
        "targetSoftwareCommandsExecuted: false"
      ]) &&
      files.realLocalAllSoftwareControlChannelCoverageAuditSmoke.includes("Repair queue preserves control gaps instead of claiming universal native execution") &&
      hasAll(files.allSoftwareExecutionPilotQueue, [
        "nativeUniversalExecution: false",
        "allSoftwareExecutionComplete: false",
        "targetSoftwareCommandsExecuted: false",
        "uiEventsSent: false"
      ]) &&
      files.realLocalAllSoftwareExecutionPilotQueueSmoke.includes("Pilot queue preserves blocked rows instead of claiming all-software execution") &&
      hasAll(files.allSoftwareExecutionPilotRunner, [
        "nativeUniversalExecution: false",
        "allSoftwareExecutionComplete: false",
        "teacherConfirmationRequired: true"
      ]) &&
      files.realLocalAllSoftwareExecutionPilotRunnerSmoke.includes("Pilot runner keeps universal execution, screenshots, memory, acceptance, rules, and packaging locked") &&
      hasAll(files.allSoftwareExecutionPilotBatch, [
        "nativeUniversalExecution: false",
        "allSoftwareExecutionComplete: false",
        "teacherConfirmationRequired: true"
      ]) &&
      files.realLocalAllSoftwareExecutionPilotBatchSmoke.includes("Batch runner keeps all-software completion and native execution claims locked") &&
      hasAll(files.realLocalAllSoftwareExecutionReadinessBatch, [
        "targetSoftwareCommandsExecuted: false",
        "nativeUniversalExecution: false",
        "allSoftwareExecutionComplete: false",
        "dryRunOnly: true"
      ]) &&
      files.realLocalAllSoftwareExecutionReadinessBatchSmoke.includes("Readiness batch keeps real execution native control screenshots memory rules and packaging locked"),
    evidence: "goal is partially implemented and gated; no false universal native-control claim"
  },
  {
    requirement: "Goal coverage smoke is packaged and runnable",
    pass:
      existsSync(join(pluginRoot, "scripts", "smoke-goal-coverage.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-goal-coverage"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-goal-coverage.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-readiness-audit.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-readiness-audit"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-readiness-audit.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-sketch-demonstration-implementation-audit.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-sketch-demonstration-implementation-audit"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-sketch-demonstration-implementation-audit.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-transparent-sketch-depth-demonstration-rehearsal.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-transparent-sketch-depth-demonstration-rehearsal"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-transparent-sketch-depth-demonstration-rehearsal.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-automatic-low-token-learning-runner.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-automatic-low-token-learning-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-automatic-low-token-learning-runner.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-automatic-low-token-learning-schedule.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-automatic-low-token-learning-schedule"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-automatic-low-token-learning-schedule.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke", "smoke-knowledge-augmented-low-token-learning.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-knowledge-augmented-low-token-learning"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke/smoke-knowledge-augmented-low-token-learning.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-recurring-monitor-approval-gate.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-recurring-monitor-approval-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-recurring-monitor-approval-gate.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-recurring-monitor-approval-gate.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-recurring-monitor-approval-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-recurring-monitor-approval-gate.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-recurring-monitor-registration-runner.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-recurring-monitor-registration-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-recurring-monitor-registration-runner.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-recurring-monitor-registration-status.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-recurring-monitor-registration-status"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-recurring-monitor-registration-status.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-recurring-monitor-run-output-audit.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-recurring-monitor-run-output-audit"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-recurring-monitor-run-output-audit.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-recurring-monitor-teacher-review-packet.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-recurring-monitor-teacher-review-packet"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-recurring-monitor-teacher-review-packet.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-automatic-triggered-visual-check-queue.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-automatic-triggered-visual-check-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-automatic-triggered-visual-check-queue.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-low-token-trigger-budget-plan.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-low-token-trigger-budget-plan"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-low-token-trigger-budget-plan.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-teacher-action-router.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-teacher-action-router"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-teacher-action-router.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-teacher-action-router-receipt.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-teacher-action-router-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-teacher-action-router-receipt.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-teacher-action-router-handoff-queue.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-teacher-action-router-handoff-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-teacher-action-router-handoff-queue.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-review-handoff-queue-item-runner.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-review-handoff-queue-item-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-review-handoff-queue-item-runner.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-goal-teacher-review-cockpit-handoff-queue.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-goal-teacher-review-cockpit-handoff-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-goal-teacher-review-cockpit-handoff-queue.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-review-entrypoint-health.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-review-entrypoint-health"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-review-entrypoint-health.mjs") &&
      existsSync(join(pluginRoot, "scripts", "validate-original-goal-low-token-coverage-completion-gate.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-low-token-coverage-completion-gate.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-coverage-completion-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-coverage-completion-gate.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-automatic-low-token-learning-schedule.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-automatic-low-token-learning-schedule"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-automatic-low-token-learning-schedule.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-full-goal-integrated-cycle.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-full-goal-integrated-cycle"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-full-goal-integrated-cycle.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-triggered-visual-capture.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-triggered-visual-capture"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-triggered-visual-capture.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-triggered-visual-evidence-learning-handoff-review.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-triggered-visual-learning-handoff-review"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-triggered-visual-evidence-learning-handoff-review.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-coverage-repair-queue.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-repair-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-repair-queue.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-coverage-enrollment-ledger.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-coverage-enrollment-ledger.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-enrollment-ledger"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-enrollment-ledger.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-coverage-enrollment-follow-up-plan.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-coverage-enrollment-follow-up-plan.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-enrollment-follow-up-plan"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-enrollment-follow-up-plan.mjs") &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-coverage-enrollment-follow-up-batch.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-coverage-enrollment-follow-up-batch.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-enrollment-follow-up-batch"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-enrollment-follow-up-batch.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-coverage-repair-queue.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-coverage-repair-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-coverage-repair-queue.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-coverage-expansion-plan.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-coverage-expansion-plan"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-coverage-expansion-plan.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-coverage-rollout-batch.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-coverage-rollout-batch"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-coverage-rollout-batch.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-coverage-rollout-supervisor"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-coverage-rollout-supervisor.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-coverage-convergence-audit"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-coverage-convergence-audit.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-convergence-automatic-learning-package.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-convergence-automatic-learning-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-convergence-automatic-learning-package.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-control-channel-coverage-audit.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-control-channel-coverage-audit"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-control-channel-coverage-audit.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-execution-pilot-queue.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-execution-pilot-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-execution-pilot-queue.mjs") &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-execution-pilot-runner.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-execution-pilot-runner.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-execution-follow-up-handoff-queue.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-execution-follow-up-handoff-queue.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-execution-follow-up-handoff-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-follow-up-handoff-queue.mjs") &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-execution-follow-up-handoff-queue-item.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-execution-follow-up-handoff-queue-item-runner.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-execution-follow-up-handoff-queue-item-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-follow-up-handoff-queue-item-runner.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-execution-follow-up-handoff-item-command-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-execution-follow-up-handoff-item-command-builder.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-execution-follow-up-handoff-item-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-execution-follow-up-handoff-item-command-builder.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-execution-follow-up-handoff-item-receipt-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-all-software-execution-follow-up-handoff-item-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-execution-follow-up-handoff-item-receipt-review.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-execution-follow-up-handoff-item-receipt-review"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-follow-up-handoff-item-receipt-review.mjs") &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-execution-approval-gate-prep-runner.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-execution-approval-gate-prep-runner.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-execution-approval-gate-prep-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-approval-gate-prep-runner.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-execution-approved-gate-command-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-execution-approved-gate-command-builder.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-execution-approved-gate-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-execution-approved-gate-command-builder.mjs") &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-execution-approved-gate-runner.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-execution-approved-gate-runner.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-execution-approved-gate-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-execution-approved-gate-runner.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-execution-pilot-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-execution-pilot-runner.mjs") &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-execution-pilot-batch.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-execution-pilot-batch.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-execution-pilot-batch"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-execution-pilot-batch.mjs") &&
      existsSync(join(pluginRoot, "scripts", "run-real-local-all-software-execution-readiness-batch.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-execution-readiness-batch.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-execution-readiness-batch"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-execution-readiness-batch.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-real-local-execution-pilot-selector.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-execution-pilot-selector.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-execution-pilot-selector"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-execution-pilot-selector.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-goal-command-center.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-goal-command-center"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-goal-command-center.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-goal-command-center-trial.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-goal-command-center-trial"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-goal-command-center-trial.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-engineering-voice-command-control-loop.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-engineering-voice-command-control-loop"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-engineering-voice-command-control-loop.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-visual-engineering-target-confirmation-kit.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-visual-engineering-target-confirmation.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-visual-engineering-target-confirmation"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-visual-engineering-target-confirmation.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-engineering-voice-execution-approval-gate.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-engineering-voice-execution-approval-gate.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-engineering-voice-execution-approval-gate"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-engineering-voice-execution-approval-gate.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-engineering-voice-command-control-loop.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-engineering-voice-command-control-loop"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-engineering-voice-command-control-loop.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-real-local-all-software-low-token-readiness-package.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-low-token-readiness-package.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-low-token-readiness-package"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-low-token-readiness-package.mjs") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-engineering-voice-controlled-execution.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-engineering-voice-controlled-execution"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-engineering-voice-controlled-execution.mjs") &&
      files.originalGoalReadinessAudit.includes("transparent_ai_original_goal_readiness_audit_v1") &&
      files.originalGoalReadinessAuditSmoke.includes("transparent_ai_original_goal_readiness_audit_smoke_v1") &&
      files.sketchDemonstrationImplementationAuditSmoke.includes("transparent_ai_sketch_demonstration_implementation_audit_smoke_v1") &&
      files.automaticLowTokenLearningRunner.includes("transparent_ai_automatic_low_token_learning_runner_v1") &&
      files.automaticLowTokenLearningRunnerSmoke.includes("transparent_ai_automatic_low_token_learning_runner_smoke_v1") &&
      files.automaticLowTokenLearningSchedule.includes("transparent_ai_automatic_low_token_learning_schedule_v1") &&
      files.automaticLowTokenLearningScheduleSmoke.includes("transparent_ai_automatic_low_token_learning_schedule_smoke_v1") &&
      files.automaticTriggeredVisualCheckQueue.includes("transparent_ai_automatic_triggered_visual_check_queue_v1") &&
      files.automaticTriggeredVisualCheckQueueSmoke.includes("transparent_ai_automatic_triggered_visual_check_queue_smoke_v1") &&
      files.triggeredVisualLearningHandoff.includes("transparent_ai_triggered_visual_evidence_learning_handoff_v1") &&
      existsSync(join(pluginRoot, "scripts", "create-triggered-visual-evidence-learning-handoff.mjs")) &&
      files.triggeredVisualLearningHandoffReview.includes("transparent_ai_triggered_visual_evidence_learning_handoff_review_result_v1") &&
      existsSync(join(pluginRoot, "scripts", "run-triggered-visual-evidence-learning-handoff-review.mjs")) &&
      files.triggeredVisualLearningHandoffReviewReceiptValidation.includes(
        "transparent_ai_triggered_visual_evidence_learning_handoff_review_receipt_validation_v1"
      ) &&
      existsSync(join(pluginRoot, "scripts", "validate-triggered-visual-evidence-learning-handoff-review-receipt.mjs")) &&
      repoPackageJson.scripts?.["smoke:plugin-triggered-visual-learning-handoff-review"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-triggered-visual-evidence-learning-handoff-review.mjs" &&
      files.triggeredVisualVoiceControlWorkbench.includes("transparent_ai_triggered_visual_evidence_voice_control_workbench_v1") &&
      existsSync(join(pluginRoot, "scripts", "create-triggered-visual-evidence-voice-control-workbench.mjs")) &&
      repoPackageJson.scripts?.["smoke:plugin-triggered-visual-voice-control-workbench"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-triggered-visual-evidence-voice-control-workbench.mjs" &&
      files.allSoftwareCoverageRepairQueue.includes("transparent_ai_all_software_coverage_repair_queue_v1") &&
      files.allSoftwareCoverageEnrollmentFollowUpPlan.includes("transparent_ai_all_software_coverage_enrollment_follow_up_plan_v1") &&
      files.allSoftwareCoverageEnrollmentFollowUpPlanSmoke.includes("transparent_ai_all_software_coverage_enrollment_follow_up_plan_smoke_v1") &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueue.includes("transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_v1") &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueSmoke.includes("transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_smoke_v1") &&
      repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-enrollment-follow-up-handoff-queue"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-enrollment-follow-up-handoff-queue.mjs" &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueItemRunner.includes(
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_run_v1"
      ) &&
      files.allSoftwareCoverageEnrollmentFollowUpHandoffQueueItemRunnerSmoke.includes(
        "transparent_ai_all_software_coverage_enrollment_follow_up_handoff_queue_item_runner_smoke_v1"
      ) &&
      repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-enrollment-follow-up-handoff-queue-item-runner"] ===
        "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-enrollment-follow-up-handoff-queue-item-runner.mjs" &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-coverage-enrollment-follow-up-handoff-item-command-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-coverage-enrollment-follow-up-handoff-item-command-builder.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-coverage-enrollment-follow-up-handoff-item-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-coverage-enrollment-follow-up-handoff-item-command-builder.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-enrollment-follow-up-handoff-item-run-review-receipt.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-coverage-rollout-handoff-item-run-review-receipt-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-rollout-handoff-item-run-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-rollout-handoff-item-run-review-receipt.mjs") &&
      files.allSoftwareCoverageEnrollmentFollowUpBatch.includes("transparent_ai_all_software_coverage_enrollment_follow_up_batch_run_v1") &&
      files.allSoftwareCoverageEnrollmentFollowUpBatchSmoke.includes("transparent_ai_all_software_coverage_enrollment_follow_up_batch_smoke_v1") &&
      files.allSoftwareCoverageRepairQueueSmoke.includes("transparent_ai_all_software_coverage_repair_queue_smoke_v1") &&
      files.realLocalAllSoftwareCoverageRepairQueueSmoke.includes("transparent_ai_real_local_all_software_coverage_repair_queue_smoke_v1") &&
      files.realLocalAllSoftwareCoverageExpansionPlanSmoke.includes("transparent_ai_real_local_all_software_coverage_expansion_plan_smoke_v1") &&
      files.realLocalAllSoftwareCoverageRolloutBatchSmoke.includes("transparent_ai_real_local_all_software_coverage_rollout_batch_smoke_v1") &&
      files.realLocalAllSoftwareCoverageRolloutSupervisorSmoke.includes("transparent_ai_real_local_all_software_coverage_rollout_supervisor_smoke_v1") &&
      files.realLocalAllSoftwareCoverageConvergenceAuditSmoke.includes("transparent_ai_real_local_all_software_coverage_convergence_audit_smoke_v1") &&
      files.realLocalConvergenceAutomaticLearningPackageSmoke.includes("transparent_ai_real_local_convergence_automatic_learning_package_smoke_v1") &&
      files.realLocalAllSoftwareControlChannelCoverageAuditSmoke.includes("transparent_ai_real_local_all_software_control_channel_coverage_audit_smoke_v1") &&
      files.realLocalAllSoftwareExecutionPilotQueueSmoke.includes("transparent_ai_real_local_all_software_execution_pilot_queue_smoke_v1") &&
      files.allSoftwareRecurringMonitorRegistrationRunner.includes("transparent_ai_all_software_recurring_monitor_registration_runner_v1") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationRunnerSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_registration_runner_smoke_v1") &&
      files.allSoftwareOperationalLearningRegistrationApprovedRunner.includes(
        "transparent_ai_all_software_operational_learning_registration_approved_runner_v1"
      ) &&
      files.allSoftwareOperationalLearningRegistrationApprovedRunnerSmoke.includes(
        "transparent_ai_all_software_operational_learning_registration_approved_runner_smoke_v1"
      ) &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-operational-learning-registration-approved-runner.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-operational-learning-registration-approved-runner.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-operational-registration-approved-command-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-operational-registration-approved-command-builder.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-operational-registration-approved-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-operational-registration-approved-command-builder.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-operational-learning-registration-approved-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-operational-learning-registration-approved-runner.mjs") &&
      files.allSoftwareOperationalLearningPostRegistrationOutputWitnessRunner.includes(
        "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_v1"
      ) &&
      files.allSoftwareOperationalLearningPostRegistrationOutputWitnessRunnerSmoke.includes(
        "transparent_ai_all_software_operational_learning_post_registration_output_witness_runner_smoke_v1"
      ) &&
      files.allSoftwareOperationalLearningPostRegistrationOutputWitnessCommandBuilder.includes(
        "transparent_ai_operational_post_registration_output_witness_command_builder_v1"
      ) &&
      files.allSoftwareOperationalLearningPostRegistrationOutputWitnessCommandBuilderSmoke.includes(
        "transparent_ai_operational_post_registration_output_witness_command_builder_smoke_v1"
      ) &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-operational-post-registration-output-witness-command-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-operational-post-registration-output-witness-command-builder.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-operational-post-registration-output-witness-command-builder"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-operational-post-registration-output-witness-command-builder.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-operational-post-registration-output-witness-receipt-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-all-software-operational-post-registration-output-witness-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-operational-post-registration-output-witness-receipt-review.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-operational-post-registration-output-witness-receipt-review"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-operational-post-registration-output-witness-receipt-review.mjs") &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-operational-learning-post-registration-output-witness-runner.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-operational-learning-post-registration-output-witness-runner.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-operational-learning-post-registration-output-witness-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-operational-learning-post-registration-output-witness-runner.mjs") &&
      existsSync(join(pluginRoot, "scripts", "create-all-software-coverage-rollout-handoff-queue.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-coverage-rollout-handoff-queue.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "run-all-software-coverage-rollout-handoff-queue-item.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-coverage-rollout-handoff-queue-item-runner.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-rollout-handoff-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-rollout-handoff-queue.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-coverage-rollout-handoff-queue-item-runner"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-coverage-rollout-handoff-queue-item-runner.mjs") &&
      files.allSoftwareRecurringMonitorRegistrationStatus.includes("transparent_ai_all_software_recurring_monitor_registration_status_v1") &&
      files.realLocalAllSoftwareRecurringMonitorRegistrationStatusSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_registration_status_smoke_v1") &&
      files.allSoftwareRecurringMonitorRunOutputAudit.includes("transparent_ai_all_software_recurring_monitor_run_output_audit_v1") &&
      files.realLocalAllSoftwareRecurringMonitorRunOutputAuditSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_run_output_audit_smoke_v1") &&
      files.allSoftwareRecurringMonitorTeacherReviewPacket.includes("transparent_ai_all_software_recurring_monitor_teacher_review_packet_v1") &&
      files.realLocalAllSoftwareRecurringMonitorTeacherReviewPacketSmoke.includes("transparent_ai_real_local_all_software_recurring_monitor_teacher_review_packet_smoke_v1") &&
      files.allSoftwareRecurringMonitorReviewDecisionReplayQueue.includes("transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_v1") &&
      files.allSoftwareRecurringMonitorReviewDecisionReplayQueueSmoke.includes("transparent_ai_all_software_recurring_monitor_review_decision_replay_queue_smoke_v1") &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-recurring-monitor-review-decision-replay-queue.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-transparent-overlay-browser-packet-spatial-flow.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "create-original-goal-current-status-refresh.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-current-status-refresh.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "create-original-goal-completion-blocker-lane-run-review-receipt-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-original-goal-completion-blocker-lane-run-review-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-completion-blocker-lane-run-review-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "create-original-goal-low-token-coverage-evidence-dossier.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-low-token-coverage-evidence-dossier.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "create-original-goal-low-token-coverage-evidence-dossier-receipt-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-original-goal-low-token-coverage-evidence-dossier-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-low-token-coverage-evidence-dossier-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "create-original-goal-low-token-blocked-waiting-row-evidence-plan.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-low-token-blocked-waiting-row-evidence-plan.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "create-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt-builder.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-low-token-blocked-waiting-row-evidence-plan-receipt.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "validate-original-goal-low-token-coverage-completion-gate.mjs")) &&
      existsSync(join(pluginRoot, "scripts", "smoke-original-goal-low-token-coverage-completion-gate.mjs")) &&
      files.originalGoalLowTokenCoverageEvidenceDossier.includes(
        "transparent_ai_original_goal_low_token_coverage_evidence_dossier_v1"
      ) &&
      files.originalGoalLowTokenCoverageEvidenceDossier.includes(
        "transparent_ai_original_goal_low_token_coverage_proof_snapshot_v1"
      ) &&
      files.originalGoalLowTokenCoverageEvidenceDossier.includes("proofSnapshotDoesNotRunMetadataGate: true") &&
      files.originalGoalLowTokenCoverageEvidenceDossier.includes("proofSnapshotDoesNotReadLogs: true") &&
      files.originalGoalLowTokenCoverageEvidenceDossier.includes("dossierDoesNotRunCoverageTools: true") &&
      files.originalGoalLowTokenCoverageEvidenceDossier.includes("allSoftwareCoverageComplete: false") &&
      files.originalGoalLowTokenCoverageEvidenceDossierSmoke.includes(
        "transparent_ai_original_goal_low_token_coverage_evidence_dossier_smoke_v1"
      ) &&
      files.originalGoalLowTokenCoverageEvidenceDossierSmoke.includes(
        "Dossier proof snapshot explains waiting rows without running metadata gates"
      ) &&
      files.allSoftwareUnattendedLearningAudit.includes("transparent_ai_all_software_unattended_learning_audit_v1") &&
      files.realLocalAllSoftwareUnattendedLearningAuditSmoke.includes("transparent_ai_real_local_all_software_unattended_learning_audit_smoke_v1") &&
      existsSync(join(pluginRoot, "scripts", "smoke-real-local-all-software-unattended-learning-audit.mjs")) &&
      files.allSoftwareOperationalLearningWorkbench.includes("transparent_ai_all_software_operational_learning_workbench_v1") &&
      files.allSoftwareOperationalLearningWorkbenchSmoke.includes("transparent_ai_all_software_operational_learning_workbench_smoke_v1") &&
      existsSync(join(pluginRoot, "scripts", "smoke-all-software-operational-learning-workbench.mjs")) &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-recurring-monitor-review-decision-replay-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-recurring-monitor-review-decision-replay-queue.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-real-local-all-software-unattended-learning-audit"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-real-local-all-software-unattended-learning-audit.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-all-software-operational-learning-workbench"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-all-software-operational-learning-workbench.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-transparent-overlay-browser-spatial-flow"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-transparent-overlay-browser-packet-spatial-flow.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-current-status-refresh"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-current-status-refresh.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-completion-blocker-lane-run-review-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-completion-blocker-lane-run-review-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-coverage-evidence-dossier"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-coverage-evidence-dossier.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-coverage-evidence-dossier-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-coverage-evidence-dossier-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-low-token-coverage-waiting-row-cockpit-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-low-token-coverage-waiting-row-cockpit-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-teacher-action-router"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-teacher-action-router.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-teacher-action-router-receipt"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-teacher-action-router-receipt.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-teacher-action-router-handoff-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-teacher-action-router-handoff-queue.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-goal-teacher-review-cockpit-handoff-queue"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-goal-teacher-review-cockpit-handoff-queue.mjs") &&
      (!repoPackageJson ||
        repoPackageJson.scripts?.["smoke:plugin-original-goal-review-entrypoint-health"] ===
          "node plugins/transparent-ai-apprentice/scripts/smoke-original-goal-review-entrypoint-health.mjs") &&
      files.realLocalAutomaticLowTokenLearningScheduleSmoke.includes("transparent_ai_real_local_automatic_low_token_learning_schedule_smoke_v1"),
    evidence: repoPackageJson
      ? "npm run smoke:plugin-goal-coverage; npm run smoke:plugin-goal-command-center; npm run smoke:plugin-goal-command-center-trial; npm run smoke:plugin-original-goal-readiness-audit; npm run smoke:plugin-original-goal-current-status-refresh; npm run smoke:plugin-original-goal-low-token-coverage-evidence-dossier-receipt; npm run smoke:plugin-original-goal-teacher-action-router; npm run smoke:plugin-original-goal-teacher-action-router-receipt; npm run smoke:plugin-original-goal-teacher-action-router-handoff-queue; npm run smoke:plugin-original-goal-review-handoff-queue-item-runner; npm run smoke:plugin-original-goal-review-entrypoint-health; npm run smoke:plugin-sketch-demonstration-implementation-audit; npm run smoke:plugin-transparent-sketch-depth-demonstration-rehearsal; npm run smoke:plugin-transparent-sketch-depth-rehearsal-review-receipt; npm run smoke:plugin-transparent-overlay-browser-spatial-flow; npm run smoke:plugin-automatic-low-token-learning-runner; npm run smoke:plugin-automatic-low-token-learning-schedule; npm run smoke:plugin-low-token-trigger-budget-plan; npm run smoke:plugin-all-software-recurring-monitor-approval-gate; npm run smoke:plugin-real-local-all-software-recurring-monitor-approval-gate; npm run smoke:plugin-real-local-all-software-recurring-monitor-registration-runner; npm run smoke:plugin-all-software-operational-learning-registration-approved-runner; npm run smoke:plugin-all-software-operational-learning-post-registration-output-witness-runner; npm run smoke:plugin-real-local-all-software-recurring-monitor-registration-status; npm run smoke:plugin-real-local-all-software-recurring-monitor-run-output-audit; npm run smoke:plugin-real-local-all-software-recurring-monitor-teacher-review-packet; npm run smoke:plugin-all-software-recurring-monitor-review-decision-replay-queue; npm run smoke:plugin-real-local-all-software-unattended-learning-audit; npm run smoke:plugin-all-software-operational-learning-workbench; npm run smoke:plugin-automatic-triggered-visual-check-queue; npm run smoke:plugin-visual-engineering-target-confirmation; npm run smoke:plugin-all-software-coverage-enrollment-ledger; npm run smoke:plugin-all-software-coverage-enrollment-follow-up-plan; npm run smoke:plugin-all-software-coverage-enrollment-follow-up-batch; npm run smoke:plugin-all-software-coverage-repair-queue; npm run smoke:plugin-real-local-all-software-low-token-readiness-package; npm run smoke:plugin-real-local-all-software-coverage-repair-queue; npm run smoke:plugin-real-local-all-software-coverage-expansion-plan; npm run smoke:plugin-real-local-all-software-coverage-rollout-batch; npm run smoke:plugin-real-local-all-software-coverage-rollout-supervisor; npm run smoke:plugin-all-software-coverage-rollout-receipt-builder; npm run smoke:plugin-all-software-coverage-rollout-handoff-queue; npm run smoke:plugin-all-software-coverage-rollout-handoff-queue-item-runner; npm run smoke:plugin-real-local-all-software-coverage-convergence-audit; npm run smoke:plugin-real-local-convergence-automatic-learning-package; npm run smoke:plugin-real-local-automatic-low-token-learning-schedule; npm run smoke:plugin-real-local-full-goal-integrated-cycle; npm run smoke:plugin-real-local-execution-pilot-selector; npm run smoke:plugin-engineering-voice-execution-approval-gate; npm run smoke:plugin-real-local-engineering-voice-controlled-execution; npm run smoke:plugin-triggered-visual-capture; npm run smoke:plugin-triggered-visual-learning-handoff-review; npm run smoke:plugin-triggered-visual-voice-control-workbench"
      : "packaged plugin scripts exist"
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_original_goal_coverage_smoke_v1",
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
































