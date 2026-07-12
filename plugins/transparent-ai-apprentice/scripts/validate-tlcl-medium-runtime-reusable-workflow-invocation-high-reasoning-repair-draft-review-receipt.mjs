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
    String(value || "tlcl-reusable-workflow-repair-draft-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-draft-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (
    [
      "approve_repair_for_regression_validation",
      "approve_deterministic_regression_validation",
      "ready_for_regression_validation"
    ].includes(decision)
  ) {
    return "approve_repair_for_regression_validation";
  }
  if (["needs_more_high_reasoning_repair", "teacher_correction", "repair_contract", "revise_repair_draft"].includes(decision)) {
    return "needs_more_high_reasoning_repair";
  }
  if (["blocked", "repair_draft_blocked", "mismatch_blocked"].includes(decision)) return "repair_draft_blocked";
  if (
    [
      "accepted",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "execute_target_software",
      "run_medium_runtime",
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
    repairDraftReviewValidationOnly: true,
    readyForDeterministicRegressionValidationOnly: true,
    ruleLifecycle: "draft_disabled",
    supportsRagInformedRepairReuseInvocation: true,
    mediumRuntimeContinuationBlocked: true,
    doesNotRunRegressionValidation: true,
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

function providerRoleUsePlanTraceFromDraft(draft) {
  return (
    draft.sourceEvidence?.providerRoleUsePlanTrace ||
    draft.workflowRepairProposal?.providerRoleUsePlanTrace ||
    draft.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromDraft(draft) {
  return (
    draft.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    draft.workflowRepairProposal?.reasoningBudgetGovernorReviewTrace ||
    draft.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

const goal = argValue("--goal", "Validate teacher review for one TLCL reusable workflow repair draft package.");
const draftInput = readJsonInput(
  argValue("--draft-package", argValue("--draft", argValue("--repair-draft-package", ""))),
  "--draft-package",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-draft-review-validations")
  )
);
const draft = draftInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const ragInformedRepairReuse = draft.ragInformedRepairReuse === true || draft.sourceEvidence?.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromDraft(draft);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromDraft(draft);
const forbiddenDecisions = new Set([
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "execute_target_software",
  "run_medium_runtime",
  "claim_goal_complete",
  "claim_all_software_complete"
]);
const blockers = [];
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (draft.status !== "reusable_workflow_high_reasoning_repair_draft_package_ready_for_teacher_review") {
  blockers.push("repair_draft_package_not_ready_for_teacher_review");
}
if (!Array.isArray(draft.draftDisabledRules) || draft.draftDisabledRules.length < 1) {
  blockers.push("draft_disabled_repair_rule_missing");
}
if (!String(draft.compiledRulePackagePath || "").trim()) blockers.push("compiled_disabled_rule_package_missing");
if (draft.locks?.ruleLifecycle !== "draft_disabled") blockers.push("draft_lifecycle_lock_missing");
if (draft.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("medium_runtime_continuation_lock_missing");
if (draft.locks?.doesNotEnableRules !== true) blockers.push("rule_enablement_lock_missing");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");
if (ragInformedRepairReuse) {
  if (draft.ragEvidenceTreatedAsAuthority === true || draft.sourceEvidence?.ragEvidenceTreatedAsAuthority === true) {
    blockers.push("rag_informed_repair_draft_review_treats_rag_as_authority");
  }
  if (draft.ragEvidenceNonAuthoritative !== true && draft.sourceEvidence?.ragEvidenceNonAuthoritative !== true) {
    blockers.push("rag_informed_repair_draft_review_non_authority_flag_missing");
  }
  if (draft.locks?.ragEvidenceNonAuthoritative !== true || draft.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_repair_draft_review_non_authority_lock_missing");
  }
  if (receipt.ragEvidenceTreatedAsAuthorityConfirmed === true) {
    blockers.push("rag_informed_repair_draft_review_receipt_treats_rag_as_authority");
  }
}
if (decision === "approve_repair_for_regression_validation") {
  if (receipt.draftPackageReviewed !== true) blockers.push("draft_package_not_reviewed");
  if (receipt.draftDisabledRulesReviewed !== true) blockers.push("draft_disabled_rules_not_reviewed");
  if (receipt.compiledDisabledRulePackageReviewed !== true) blockers.push("compiled_disabled_rule_package_not_reviewed");
  if (receipt.teacherCorrectionPreserved !== true) blockers.push("teacher_correction_not_confirmed_preserved");
  if (receipt.affectedLogicFieldsReviewed !== true) blockers.push("affected_logic_fields_not_reviewed");
  if (receipt.regressionValidationPlanReviewed !== true) blockers.push("regression_validation_plan_not_reviewed");
  if (receipt.deterministicValidationStillRequiredConfirmed !== true) blockers.push("deterministic_validation_requirement_not_confirmed");
  if (receipt.mediumRuntimeRetryStillBlockedConfirmed !== true) blockers.push("medium_runtime_retry_block_not_confirmed");
  if (receipt.rollbackPointStillRetained !== true) blockers.push("rollback_point_not_retained");
  if (receipt.teacherApprovedRegressionValidation !== true) blockers.push("teacher_regression_validation_approval_missing");
  if (ragInformedRepairReuse && receipt.ragEvidenceNonAuthoritativeConfirmed !== true) {
    blockers.push("rag_informed_repair_draft_review_non_authority_not_confirmed");
  }
}
if (decision === "needs_more_high_reasoning_repair" && !String(receipt.teacherCorrection || receipt.blockerQuestion || "").trim()) {
  blockers.push("high_reasoning_repair_follow_up_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForDeterministicRegressionValidation =
  decision === "approve_repair_for_regression_validation" && blockers.length === 0;
const returnToHighReasoningRepair = decision === "needs_more_high_reasoning_repair" && !forbiddenDecisionUsed;
const repairDraftBlocked = decision === "repair_draft_blocked" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_repair_draft_review_decision"
  : readyForDeterministicRegressionValidation
    ? "reusable_workflow_repair_draft_ready_for_deterministic_regression_validation"
    : returnToHighReasoningRepair
      ? "reusable_workflow_repair_draft_return_to_high_reasoning_repair"
      : repairDraftBlocked
        ? "reusable_workflow_repair_draft_blocked_by_teacher_review"
        : "reusable_workflow_repair_draft_needs_teacher_review_or_more_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-reusable-workflow-repair-draft-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-reusable-workflow-repair-draft-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_DRAFT_REVIEW_VALIDATION_START_HERE.md");
const evidenceToInspect = [
  draftInput.path,
  draft.compiledRulePackagePath || "",
  draft.compileReportPath || "",
  draft.lockPath || "",
  receiptInput.path
].filter(Boolean);
const regressionValidationHandoff = readyForDeterministicRegressionValidation
  ? {
      kind: "reusable_workflow_repair_draft_regression_validation_handoff",
      runtimeTransition: "high_reasoning_repair_draft_to_deterministic_regression_validation",
      draftId: draft.draftId || validationId,
      draftPackagePath: draftInput.path,
      compiledRulePackagePath: draft.compiledRulePackagePath || "",
      workflowFingerprint: draft.workflowRepairProposal?.workflowFingerprint || "",
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      proposedRepairTargets: draft.workflowRepairProposal?.proposedRepairTargets || [],
      requiredBeforeMediumRuntimeRetry: true,
      nextValidationTasks: [
        "Run deterministic Rule DSL and disabled Rule Package checks against the reviewed repair draft.",
        "Compare repaired workflow fingerprint expectations before any reusable workflow retry.",
        "Rebuild the reusable workflow invocation approval gate after validation, not from this review directly.",
        "Require a fresh approved-gate outcome review after any later medium-runtime run."
      ],
      forbiddenShortcuts: [
        "enable_rule_from_repair_draft_review",
        "write_memory_from_repair_draft_review",
        "execute_target_software_from_repair_draft_review",
        "reuse_medium_runtime_from_repair_draft_review"
      ]
    }
  : null;
const highReasoningRepairHandoff = returnToHighReasoningRepair || repairDraftBlocked
  ? {
      kind: "reusable_workflow_repair_draft_back_to_high_reasoning_handoff",
      runtimeTransition: "repair_draft_review_to_high_reasoning_repair",
      draftId: draft.draftId || validationId,
      teacherDecision: decision,
      teacherCorrection: receipt.teacherCorrection || "",
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      blockerQuestion: receipt.blockerQuestion || "",
      teacherNote: receipt.teacherNote || "",
      evidenceToInspect,
      repairTasks: [
        "Revise the draft_disabled Rule Card or Rule DSL before regression validation.",
        "Preserve the medium runtime continuation block while the repair draft is revised.",
        "Re-run repair draft package review after the high-reasoning repair update."
      ]
    }
  : null;
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  readyForDeterministicRegressionValidation,
  returnToHighReasoningRepair,
  repairDraftBlocked,
  forbiddenDecisionUsed,
  blockers,
  regressionValidationHandoff,
  highReasoningRepairHandoff,
  sourceEvidence: {
    draftPackagePath: draftInput.path,
    draftPackageHash: sha256Object(draft),
    receiptPath: receiptInput.path,
    receiptHash: sha256Object(receipt),
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  blockedTransitions: [
    "run_regression_validation_from_repair_draft_review",
    "run_medium_runtime_from_repair_draft_review",
    "execute_target_software_from_repair_draft_review",
    "enable_rule_from_repair_draft_review",
    "write_memory_from_repair_draft_review",
    "unlock_packaging_from_repair_draft_review",
    "claim_goal_complete_from_repair_draft_review"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceDraftPackage: draftInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks(ragInformedRepairReuse)
};
const validationReceipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForDeterministicRegressionValidation,
  returnToHighReasoningRepair,
  repairDraftBlocked,
  forbiddenDecisionUsed,
  blockers,
  regressionValidationRun: false,
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
    "# TLCL Reusable Workflow Repair Draft Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation checks teacher review of a draft_disabled repair package. It may prepare a deterministic regression-validation handoff, but it does not run validation, execute software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_review_validation_result_v1",
      validationId,
      status,
      decision,
      readyForDeterministicRegressionValidation,
      returnToHighReasoningRepair,
      repairDraftBlocked,
      forbiddenDecisionUsed,
      blockers,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      regressionValidationRun: false,
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
