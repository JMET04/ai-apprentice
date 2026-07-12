#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { evaluateRulePackage } from "./rules/evaluate-rule-package.mjs";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slug(value) {
  return (
    String(value || "tlcl-reusable-workflow-repair-regression-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-regression-validation"
  );
}

function locks(ragInformedRepairReuse = false) {
  return {
    reviewOnly: true,
    deterministicRegressionValidationOnly: true,
    ruleLifecycle: "draft_disabled",
    supportsRagInformedRepairReuseInvocation: true,
    mediumRuntimeContinuationBlocked: true,
    workflowFingerprintReviewStillRequired: true,
    approvalGateRebuildStillRequired: true,
    freshOutcomeReviewStillRequired: true,
    doesNotRunMediumRuntime: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    ...(ragInformedRepairReuse
      ? {
          ragEvidenceNonAuthoritative: true,
          doesNotTreatRagAsAuthority: true
        }
      : {})
  };
}

function providerRoleUsePlanTraceFromReview(review, handoff, draftPackage = null) {
  return (
    handoff.providerRoleUsePlanTrace ||
    review.sourceEvidence?.providerRoleUsePlanTrace ||
    review.providerRoleUsePlanTrace ||
    draftPackage?.sourceEvidence?.providerRoleUsePlanTrace ||
    draftPackage?.workflowRepairProposal?.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromReview(review, handoff, draftPackage = null) {
  return (
    handoff.reasoningBudgetGovernorReviewTrace ||
    review.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    review.reasoningBudgetGovernorReviewTrace ||
    draftPackage?.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    draftPackage?.workflowRepairProposal?.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

const goal = argValue("--goal", "Create deterministic regression validation for one reviewed TLCL reusable workflow repair draft.");
const reviewInput = readJsonInput(
  argValue("--review-validation", argValue("--validation", argValue("--draft-review-validation", ""))),
  "--review-validation",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_validation_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-regression-validations")
  )
);
const review = reviewInput.value;
const blockers = [];
const handoff = review.regressionValidationHandoff || {};
let ragInformedRepairReuse = review.ragInformedRepairReuse === true || handoff.ragInformedRepairReuse === true;
if (review.status !== "reusable_workflow_repair_draft_ready_for_deterministic_regression_validation") {
  blockers.push("repair_draft_review_not_ready_for_regression_validation");
}
if (review.readyForDeterministicRegressionValidation !== true) {
  blockers.push("regression_validation_ready_flag_missing");
}
if (review.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("medium_runtime_continuation_lock_missing");
if (review.locks?.doesNotEnableRules !== true) blockers.push("rule_enablement_lock_missing");
if (ragInformedRepairReuse) {
  if (review.ragEvidenceTreatedAsAuthority === true || handoff.ragEvidenceTreatedAsAuthority === true) {
    blockers.push("rag_informed_regression_validation_treats_rag_as_authority");
  }
  if (review.ragEvidenceNonAuthoritative !== true && handoff.ragEvidenceNonAuthoritative !== true) {
    blockers.push("rag_informed_regression_validation_non_authority_flag_missing");
  }
  if (review.locks?.ragEvidenceNonAuthoritative !== true || review.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_regression_validation_non_authority_lock_missing");
  }
}
const draftPackagePathRaw = String(handoff.draftPackagePath || review.sourceEvidence?.draftPackagePath || "").trim();
const draftPackagePath = draftPackagePathRaw ? resolve(draftPackagePathRaw) : "";
if (!handoff || handoff.kind !== "reusable_workflow_repair_draft_regression_validation_handoff") {
  blockers.push("regression_validation_handoff_missing");
}
if (!draftPackagePath || !existsSync(draftPackagePath)) blockers.push("draft_package_path_missing_or_not_found");

let draftPackage = null;
let compiledRulePackage = null;
let compiledRulePackagePath = "";
let providerRoleUsePlanTrace = providerRoleUsePlanTraceFromReview(review, handoff);
let reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromReview(review, handoff);
if (!blockers.includes("draft_package_path_missing_or_not_found")) {
  draftPackage = readJson(draftPackagePath);
  providerRoleUsePlanTrace = providerRoleUsePlanTraceFromReview(review, handoff, draftPackage);
  reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromReview(review, handoff, draftPackage);
  ragInformedRepairReuse =
    ragInformedRepairReuse || draftPackage.ragInformedRepairReuse === true || draftPackage.sourceEvidence?.ragInformedRepairReuse === true;
  if (draftPackage.format !== "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package_v1") {
    blockers.push("draft_package_format_mismatch");
  }
  if (draftPackage.status !== "reusable_workflow_high_reasoning_repair_draft_package_ready_for_teacher_review") {
    blockers.push("draft_package_not_ready_for_review");
  }
  if (draftPackage.locks?.ruleLifecycle !== "draft_disabled") blockers.push("draft_package_lifecycle_lock_missing");
  if (draftPackage.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("draft_package_medium_runtime_lock_missing");
  if (ragInformedRepairReuse) {
    if (review.ragEvidenceNonAuthoritative !== true && handoff.ragEvidenceNonAuthoritative !== true) {
      blockers.push("rag_informed_regression_review_non_authority_flag_missing");
    }
    if (review.locks?.ragEvidenceNonAuthoritative !== true || review.locks?.doesNotTreatRagAsAuthority !== true) {
      blockers.push("rag_informed_regression_review_non_authority_lock_missing");
    }
    if (draftPackage.ragEvidenceTreatedAsAuthority === true || draftPackage.sourceEvidence?.ragEvidenceTreatedAsAuthority === true) {
      blockers.push("rag_informed_draft_package_treats_rag_as_authority");
    }
    if (draftPackage.ragEvidenceNonAuthoritative !== true && draftPackage.sourceEvidence?.ragEvidenceNonAuthoritative !== true) {
      blockers.push("rag_informed_draft_package_non_authority_flag_missing");
    }
    if (draftPackage.locks?.ragEvidenceNonAuthoritative !== true || draftPackage.locks?.doesNotTreatRagAsAuthority !== true) {
      blockers.push("rag_informed_draft_package_non_authority_lock_missing");
    }
  }
  const compiledRulePackagePathRaw = String(handoff.compiledRulePackagePath || draftPackage.compiledRulePackagePath || "").trim();
  compiledRulePackagePath = compiledRulePackagePathRaw ? resolve(compiledRulePackagePathRaw) : "";
  if (!compiledRulePackagePath || !existsSync(compiledRulePackagePath)) blockers.push("compiled_disabled_rule_package_missing_or_not_found");
}
if (compiledRulePackagePath && existsSync(compiledRulePackagePath)) {
  compiledRulePackage = readJson(compiledRulePackagePath);
  const rules = Array.isArray(compiledRulePackage.rules) ? compiledRulePackage.rules : [];
  if (!rules.length) blockers.push("compiled_rule_package_has_no_rules");
  if (rules.some((rule) => rule.lifecycle === "active")) blockers.push("compiled_rule_package_contains_active_rule");
  if (rules.some((rule) => rule.lifecycle !== "draft_disabled")) blockers.push("compiled_rule_package_contains_non_draft_disabled_rule");
}

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const artifactPath = join(validationDir, "tlcl-reusable-workflow-repair-regression-artifact.json");
const validationReportPath = join(validationDir, "tlcl-reusable-workflow-repair-regression-validation-report.json");
const packetPath = join(validationDir, "tlcl-reusable-workflow-repair-regression-validation-package.json");
const receiptPath = join(validationDir, "tlcl-reusable-workflow-repair-regression-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_REGRESSION_VALIDATION_START_HERE.md");
const artifact = {
  artifact_id: `${validationId}.artifact`,
  artifact_type: "tlcl_reusable_workflow_invocation",
  schema_version: "0.1",
  units: "review_only_regression_validation",
  created_at: new Date().toISOString(),
  source_refs: [reviewInput.path, draftPackagePath].filter(Boolean),
  context: {
    risk_level: "high",
    review_only: true,
    teacher_review_validation_path: reviewInput.path,
    workflow_fingerprint: handoff.workflowFingerprint || draftPackage?.workflowRepairProposal?.workflowFingerprint || "",
    proposed_repair_targets: handoff.proposedRepairTargets || draftPackage?.workflowRepairProposal?.proposedRepairTargets || [],
    provider_role_use_plan_trace: providerRoleUsePlanTrace,
    reasoning_budget_governor_review_trace: reasoningBudgetGovernorReviewTrace,
    rag_informed_repair_reuse: ragInformedRepairReuse,
    rag_evidence_treated_as_authority: false,
    rag_evidence_non_authoritative: ragInformedRepairReuse,
    medium_runtime_retry_blocked: true,
    approval: { teacher_confirmed: false }
  },
  objects: []
};
writeJson(artifactPath, artifact);

let validationReport = null;
if (!blockers.length) {
  validationReport = await evaluateRulePackage({
    rulesPath: compiledRulePackagePath,
    artifactPath,
    outPath: validationReportPath
  });
  const rules = compiledRulePackage.rules || [];
  const skippedRows = (validationReport.results || []).filter((row) => row.status === "skipped" && row.validator === "lifecycle-gate");
  const nonSkippedRuleRows = (validationReport.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped");
  if (skippedRows.length !== rules.length) blockers.push("draft_disabled_rules_must_appear_as_lifecycle_skipped_rows");
  if (nonSkippedRuleRows.length) blockers.push("draft_disabled_rules_must_not_evaluate_active_validators");
  if (validationReport.delivery_allowed !== true) blockers.push("disabled_rule_regression_report_must_not_block_delivery");
}

const finalStatus = blockers.length
  ? "blocked_before_reusable_workflow_repair_regression_validation"
  : "reusable_workflow_repair_regression_validation_ready_for_fingerprint_review";
const validationPackage = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_regression_validation_package_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status: finalStatus,
  deterministicValidationRun: blockers.length === 0,
  readyForWorkflowFingerprintReview: blockers.length === 0,
  mediumRuntimeRetryAllowed: false,
  ruleActivationAllowed: false,
  sourceEvidence: {
    repairDraftReviewValidationPath: reviewInput.path,
    repairDraftReviewValidationHash: sha256Object(review),
    draftPackagePath,
    draftPackageHash: draftPackage ? sha256Object(draftPackage) : "",
    compiledRulePackagePath,
    compiledRulePackageHash: compiledRulePackage ? sha256Object(compiledRulePackage) : "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse
  },
  validationSummary: validationReport
    ? {
        validationReportStatus: validationReport.status,
        deliveryAllowed: validationReport.delivery_allowed,
        disabledRuleCount: (compiledRulePackage.rules || []).length,
        workflowFingerprint: handoff.workflowFingerprint || draftPackage?.workflowRepairProposal?.workflowFingerprint || "",
        proposedRepairTargets: handoff.proposedRepairTargets || draftPackage?.workflowRepairProposal?.proposedRepairTargets || [],
        providerRoleUsePlanTrace,
        reasoningBudgetGovernorReviewTrace,
        ragInformedRepairReuse,
        ragEvidenceTreatedAsAuthority: false,
        ragEvidenceNonAuthoritative: ragInformedRepairReuse,
        lifecycleSkippedRows: (validationReport.results || []).filter((row) => row.status === "skipped" && row.validator === "lifecycle-gate").length,
        activeRuleRowsEvaluated: (validationReport.results || []).filter((row) => row.lifecycle === "active").length,
        nonSkippedRuleRows: (validationReport.results || []).filter((row) => row.rule_id !== "artifact-envelope" && row.status !== "skipped").length
      }
    : null,
  nextReview: {
    instruction: "Review this deterministic regression validation package before rebuilding workflow fingerprint, approval gate, or medium-runtime retry.",
    mayRunMediumRuntime: false,
    mayEnableRules: false,
    mayWriteMemory: false,
    mayExecuteTargetSoftware: false,
    mayUnlockPackaging: false,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    nextAllowedReview: "workflow_fingerprint_review",
    requiredBeforeMediumRuntimeRetry: [
      "teacher reviews deterministic regression validation report",
      "workflow fingerprint review confirms repaired route semantics",
      "approval gate is rebuilt from reviewed repaired workflow evidence",
      "fresh outcome review is required after any later run"
    ],
    forbiddenShortcuts: [
      "run_medium_runtime_from_regression_validation",
      "enable_rule_from_regression_validation",
      "write_memory_from_regression_validation",
      "unlock_packaging_from_regression_validation",
      ...(ragInformedRepairReuse ? ["treat_rag_as_authority_from_regression_validation"] : [])
    ]
  },
  blockers,
  paths: {
    package: packetPath,
    receipt: receiptPath,
    readme: readmePath,
    artifact: artifactPath,
    validationReport: validationReport ? validationReportPath : "",
    sourceReviewValidation: reviewInput.path,
    sourceDraftPackage: draftPackagePath,
    compiledRulePackage: compiledRulePackagePath
  },
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  locks: locks(ragInformedRepairReuse)
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_regression_validation_receipt_v1",
  validationId,
  status: finalStatus,
  deterministicValidationRun: blockers.length === 0,
  readyForWorkflowFingerprintReview: blockers.length === 0,
  mediumRuntimeRetryAllowed: false,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  locks: locks(ragInformedRepairReuse)
};

writeJson(packetPath, validationPackage);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow Repair Regression Validation",
    "",
    `Status: ${finalStatus}`,
    "",
    "This package runs deterministic Rule DSL validation for a teacher-reviewed draft_disabled repair package.",
    "It does not enable rules, run medium runtime, execute target software, write memory, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format:
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_regression_validation_package_result_v1",
      validationId,
      status: finalStatus,
      deterministicValidationRun: blockers.length === 0,
      readyForWorkflowFingerprintReview: blockers.length === 0,
      validationPackagePath: packetPath,
      receiptPath,
      readmePath,
      validationReportPath: validationReport ? validationReportPath : "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      blockerCount: blockers.length,
      mediumRuntimeRetryAllowed: false,
      approvedGateRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
