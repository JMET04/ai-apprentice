#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
    String(value || "tlcl-reusable-workflow-repair-fingerprint-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-fingerprint-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (
    [
      "approve_fingerprint_for_approval_gate_rebuild",
      "approve_workflow_fingerprint",
      "ready_for_approval_gate_rebuild"
    ].includes(decision)
  ) {
    return "approve_fingerprint_for_approval_gate_rebuild";
  }
  if (["needs_more_high_reasoning_repair", "teacher_correction", "revise_repair_draft"].includes(decision)) {
    return "needs_more_high_reasoning_repair";
  }
  if (["blocked", "fingerprint_review_blocked", "mismatch_blocked"].includes(decision)) return "fingerprint_review_blocked";
  if (
    [
      "accepted",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "execute_target_software",
      "run_medium_runtime",
      "rebuild_approval_gate",
      "claim_goal_complete",
      "claim_all_software_complete"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks(ragInformedRepairReuse = false) {
  return {
    reviewOnly: true,
    workflowFingerprintReviewValidationOnly: true,
    ruleLifecycle: "draft_disabled",
    supportsRagInformedRepairReuseInvocation: true,
    mediumRuntimeContinuationBlocked: true,
    approvalGateRebuildStillRequired: true,
    freshOutcomeReviewStillRequired: true,
    doesNotRunMediumRuntime: true,
    doesNotRunApprovedGate: true,
    doesNotRebuildApprovalGate: true,
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

function providerRoleUsePlanTraceFromValidationPackage(validationPackage) {
  return (
    validationPackage.sourceEvidence?.providerRoleUsePlanTrace ||
    validationPackage.validationSummary?.providerRoleUsePlanTrace ||
    validationPackage.nextReview?.providerRoleUsePlanTrace ||
    validationPackage.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromValidationPackage(validationPackage) {
  return (
    validationPackage.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    validationPackage.validationSummary?.reasoningBudgetGovernorReviewTrace ||
    validationPackage.nextReview?.reasoningBudgetGovernorReviewTrace ||
    validationPackage.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

const goal = argValue("--goal", "Validate teacher review for one repaired TLCL reusable workflow fingerprint.");
const packageInput = readJsonInput(
  argValue("--regression-validation-package", argValue("--package", argValue("--validation-package", ""))),
  "--regression-validation-package",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_regression_validation_package_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-fingerprint-review-validations")
  )
);
const validationPackage = packageInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const ragInformedRepairReuse =
  validationPackage.ragInformedRepairReuse === true ||
  validationPackage.sourceEvidence?.ragInformedRepairReuse === true ||
    validationPackage.validationSummary?.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromValidationPackage(validationPackage);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromValidationPackage(validationPackage);
const forbiddenDecisions = new Set([
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "execute_target_software",
  "run_medium_runtime",
  "rebuild_approval_gate",
  "claim_goal_complete",
  "claim_all_software_complete"
]);
const blockers = [];
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (validationPackage.status !== "reusable_workflow_repair_regression_validation_ready_for_fingerprint_review") {
  blockers.push("repair_regression_validation_not_ready_for_fingerprint_review");
}
if (validationPackage.readyForWorkflowFingerprintReview !== true) blockers.push("fingerprint_review_ready_flag_missing");
if (validationPackage.deterministicValidationRun !== true) blockers.push("deterministic_regression_validation_not_run");
if (validationPackage.locks?.workflowFingerprintReviewStillRequired !== true) blockers.push("fingerprint_review_lock_missing");
if (validationPackage.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("medium_runtime_continuation_lock_missing");
if (validationPackage.locks?.doesNotEnableRules !== true) blockers.push("rule_enablement_lock_missing");
if ((validationPackage.validationSummary?.nonSkippedRuleRows ?? 1) !== 0) blockers.push("draft_disabled_regression_validation_must_not_run_active_rules");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");
if (ragInformedRepairReuse) {
  if (
    validationPackage.ragEvidenceTreatedAsAuthority === true ||
    validationPackage.sourceEvidence?.ragEvidenceTreatedAsAuthority === true ||
    validationPackage.validationSummary?.ragEvidenceTreatedAsAuthority === true
  ) {
    blockers.push("rag_informed_fingerprint_review_treats_rag_as_authority");
  }
  if (
    validationPackage.ragEvidenceNonAuthoritative !== true &&
    validationPackage.sourceEvidence?.ragEvidenceNonAuthoritative !== true &&
    validationPackage.validationSummary?.ragEvidenceNonAuthoritative !== true
  ) {
    blockers.push("rag_informed_fingerprint_review_non_authority_flag_missing");
  }
  if (validationPackage.locks?.ragEvidenceNonAuthoritative !== true || validationPackage.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_fingerprint_review_non_authority_lock_missing");
  }
  if (receipt.ragEvidenceTreatedAsAuthorityConfirmed === true) {
    blockers.push("rag_informed_fingerprint_review_receipt_treats_rag_as_authority");
  }
}

const sourceFingerprint =
  String(receipt.workflowFingerprintBefore || receipt.workflowFingerprint || validationPackage.sourceEvidence?.workflowFingerprint || "").trim() ||
  String(validationPackage.validationSummary?.workflowFingerprint || "").trim();
const repairedFingerprint = String(receipt.workflowFingerprintAfter || receipt.repairedWorkflowFingerprint || sourceFingerprint).trim();
if (decision === "approve_fingerprint_for_approval_gate_rebuild") {
  if (receipt.regressionValidationReviewed !== true) blockers.push("regression_validation_package_not_reviewed");
  if (receipt.validationReportReviewed !== true) blockers.push("validation_report_not_reviewed");
  if (receipt.draftDisabledLifecycleReviewed !== true) blockers.push("draft_disabled_lifecycle_not_reviewed");
  if (receipt.workflowFingerprintReviewed !== true) blockers.push("workflow_fingerprint_not_reviewed");
  if (receipt.proposedRepairTargetsReviewed !== true) blockers.push("proposed_repair_targets_not_reviewed");
  if (receipt.routeSemanticsReviewed !== true) blockers.push("route_semantics_not_reviewed");
  if (receipt.approvalGateRebuildStillRequiredConfirmed !== true) blockers.push("approval_gate_rebuild_requirement_not_confirmed");
  if (receipt.freshOutcomeReviewStillRequiredConfirmed !== true) blockers.push("fresh_outcome_review_requirement_not_confirmed");
  if (receipt.mediumRuntimeRetryStillBlockedConfirmed !== true) blockers.push("medium_runtime_retry_block_not_confirmed");
  if (receipt.rollbackPointStillRetained !== true) blockers.push("rollback_point_not_retained");
  if (receipt.teacherApprovedFingerprintReview !== true) blockers.push("teacher_fingerprint_review_approval_missing");
  if (ragInformedRepairReuse && receipt.ragEvidenceNonAuthoritativeConfirmed !== true) {
    blockers.push("rag_informed_fingerprint_review_non_authority_not_confirmed");
  }
}
if (decision === "needs_more_high_reasoning_repair" && !String(receipt.teacherCorrection || receipt.blockerQuestion || "").trim()) {
  blockers.push("high_reasoning_repair_follow_up_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForApprovalGateRebuild = decision === "approve_fingerprint_for_approval_gate_rebuild" && blockers.length === 0;
const returnToHighReasoningRepair = decision === "needs_more_high_reasoning_repair" && !forbiddenDecisionUsed;
const fingerprintReviewBlocked = decision === "fingerprint_review_blocked" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_repair_fingerprint_review_decision"
  : readyForApprovalGateRebuild
    ? "reusable_workflow_repair_fingerprint_review_ready_for_approval_gate_rebuild"
    : returnToHighReasoningRepair
      ? "reusable_workflow_repair_fingerprint_review_return_to_high_reasoning_repair"
      : fingerprintReviewBlocked
        ? "reusable_workflow_repair_fingerprint_review_blocked_by_teacher_review"
        : "reusable_workflow_repair_fingerprint_review_needs_teacher_review_or_more_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-reusable-workflow-repair-fingerprint-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-reusable-workflow-repair-fingerprint-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_FINGERPRINT_REVIEW_VALIDATION_START_HERE.md");
const evidenceToInspect = [
  packageInput.path,
  validationPackage.paths?.validationReport || "",
  validationPackage.paths?.artifact || "",
  validationPackage.paths?.sourceDraftPackage || "",
  receiptInput.path
].filter(Boolean);
const approvalGateRebuildHandoff = readyForApprovalGateRebuild
  ? {
      kind: "reusable_workflow_repair_fingerprint_review_approval_gate_rebuild_handoff",
      runtimeTransition: "repair_fingerprint_review_to_approval_gate_rebuild",
      validationId,
      regressionValidationPackagePath: packageInput.path,
      validationReportPath: validationPackage.paths?.validationReport || "",
      workflowFingerprintBefore: sourceFingerprint,
      workflowFingerprintAfter: repairedFingerprint,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      fingerprintChanged: receipt.fingerprintChanged === true || (sourceFingerprint && repairedFingerprint && sourceFingerprint !== repairedFingerprint),
      routeSemanticsDecision: receipt.routeSemanticsDecision || "teacher_reviewed_repaired_route_semantics",
      proposedRepairTargets: receipt.proposedRepairTargets || validationPackage.validationSummary?.proposedRepairTargets || [],
      requiredBeforeMediumRuntimeRetry: [
        "rebuild reusable workflow invocation approval gate from reviewed repaired workflow evidence",
        "run only the approval-gated medium-runtime path after the rebuilt gate exists",
        "create a fresh approved-gate outcome review after the later medium-runtime run",
        "keep rollback point retained until teacher confirms the rebuilt route is correct"
      ],
      forbiddenShortcuts: [
        "run_medium_runtime_from_fingerprint_review",
        "rebuild_approval_gate_inside_fingerprint_review",
        "enable_rule_from_fingerprint_review",
        "write_memory_from_fingerprint_review",
        "unlock_packaging_from_fingerprint_review",
        ...(ragInformedRepairReuse ? ["treat_rag_as_authority_from_fingerprint_review"] : []),
        "claim_completion_from_fingerprint_review"
      ]
    }
  : null;
const highReasoningRepairHandoff = returnToHighReasoningRepair || fingerprintReviewBlocked
  ? {
      kind: "reusable_workflow_repair_fingerprint_back_to_high_reasoning_handoff",
      runtimeTransition: "repair_fingerprint_review_to_high_reasoning_repair",
      teacherDecision: decision,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      teacherCorrection: receipt.teacherCorrection || "",
      blockerQuestion: receipt.blockerQuestion || "",
      teacherNote: receipt.teacherNote || "",
      evidenceToInspect,
      repairTasks: [
        "Revise the repaired workflow fingerprint, route semantics, or Rule DSL bindings.",
        "Keep medium-runtime retry blocked while the high-reasoning repair is revised.",
        "Re-run deterministic regression validation before another fingerprint review."
      ]
    }
  : null;
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  readyForApprovalGateRebuild,
  returnToHighReasoningRepair,
  fingerprintReviewBlocked,
  forbiddenDecisionUsed,
  mediumRuntimeRetryAllowed: false,
  ruleActivationAllowed: false,
  blockers,
  approvalGateRebuildHandoff,
  highReasoningRepairHandoff,
  sourceEvidence: {
    regressionValidationPackagePath: packageInput.path,
    regressionValidationPackageHash: sha256Object(validationPackage),
    receiptPath: receiptInput.path,
    receiptHash: sha256Object(receipt),
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse
  },
  blockedTransitions: [
    "run_medium_runtime_from_fingerprint_review",
    "run_approved_gate_from_fingerprint_review",
    "rebuild_approval_gate_from_fingerprint_review",
    "execute_target_software_from_fingerprint_review",
    "enable_rule_from_fingerprint_review",
    "write_memory_from_fingerprint_review",
    "unlock_packaging_from_fingerprint_review",
    ...(ragInformedRepairReuse ? ["treat_rag_as_authority_from_fingerprint_review"] : []),
    "claim_goal_complete_from_fingerprint_review"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceRegressionValidationPackage: packageInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks(ragInformedRepairReuse)
};
const validationReceipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForApprovalGateRebuild,
  returnToHighReasoningRepair,
  fingerprintReviewBlocked,
  forbiddenDecisionUsed,
  blockers,
  approvalGateRebuilt: false,
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

writeJson(validationPath, validation);
writeJson(validationReceiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow Repair Fingerprint Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation checks teacher review of the repaired workflow fingerprint and route semantics.",
    "It may prepare an approval-gate rebuild handoff, but it does not rebuild the gate, run medium runtime, execute software, write memory, enable rules, unlock packaging, or claim completion.",
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
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_validation_result_v1",
      validationId,
      status,
      decision,
      readyForApprovalGateRebuild,
      returnToHighReasoningRepair,
      fingerprintReviewBlocked,
      forbiddenDecisionUsed,
      blockers,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      approvalGateRebuilt: false,
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
