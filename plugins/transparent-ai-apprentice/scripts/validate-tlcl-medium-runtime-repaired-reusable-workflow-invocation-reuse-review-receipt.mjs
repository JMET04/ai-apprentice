#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    String(value || "tlcl-repaired-reusable-workflow-invocation-reuse-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-repaired-reusable-workflow-invocation-reuse-review-validation"
  );
}

function locks(workflowEnabled = false) {
  return {
    reviewOnly: true,
    validationOnly: true,
    repairedReusableWorkflowInvocationReuseReview: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    reusesExistingReusableWorkflowActivationValidator: true,
    mediumRuntimeWorkflowEnabled: workflowEnabled,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function runNode(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function providerRoleUsePlanTraceFromCandidate(candidate) {
  return (
    candidate.sourceEvidence?.providerRoleUsePlanTrace ||
    candidate.defaultReceipt?.providerRoleUsePlanTrace ||
    candidate.providerRoleUsePlanTrace ||
    null
  );
}

function reasoningBudgetGovernorReviewTraceFromCandidate(candidate) {
  return (
    candidate.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    candidate.defaultReceipt?.reasoningBudgetGovernorReviewTrace ||
    candidate.reasoningBudgetGovernorReviewTrace ||
    null
  );
}

function adaptRepairedInvocationReuseReceipt(receipt) {
  return {
    ...receipt,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_receipt_v1",
    candidateReviewed: receipt.candidateReviewed === true || receipt.repairedInvocationOutcomeValidationReviewed === true,
    contractBoundaryReviewed: receipt.contractBoundaryReviewed === true || receipt.repairedWorkflowBoundaryReviewed === true,
    sourceOutcomeEvidenceReviewed:
      receipt.sourceOutcomeEvidenceReviewed === true || receipt.repairedInvocationOutcomeValidationReviewed === true,
    deterministicValidatorsStillRequiredConfirmed: receipt.deterministicValidatorsStillRequiredConfirmed === true,
    approvalGateStillRequiredConfirmed: receipt.approvalGateStillRequiredConfirmed === true,
    rollbackPointStillRetained: receipt.rollbackPointStillRetained === true,
    teacherApprovedBoundedReuse: receipt.teacherApprovedBoundedReuse === true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: receipt.ragEvidenceNonAuthoritative === true,
    ragEvidenceNonAuthoritativeConfirmed: receipt.ragEvidenceNonAuthoritativeConfirmed === true
  };
}

const goal = argValue("--goal", "Validate teacher review for retaining a repaired reusable workflow invocation.");
const candidateInput = readJsonInput(
  argValue("--candidate", argValue("--repaired-reuse-candidate", argValue("--workflow-candidate", ""))),
  "--candidate",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_candidate_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-repaired-reusable-workflow-invocation-reuse-review-validations")
  )
);
const candidate = candidateInput.value;
const receipt = receiptInput.value;
const ragInformedRepairReuse = candidate.ragInformedRepairReuse === true || candidate.sourceEvidence?.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromCandidate(candidate);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromCandidate(candidate);
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const adaptedReceiptPath = join(validationDir, "adapted-reusable-workflow-activation-receipt.json");
writeJson(adaptedReceiptPath, adaptRepairedInvocationReuseReceipt(receipt));

const preflightBlockers = [];
if (candidate.status !== "repaired_reusable_workflow_invocation_reuse_review_candidate_ready_for_teacher_review") {
  preflightBlockers.push("repaired_invocation_reuse_review_candidate_not_ready");
}
if (!candidate.sourceEvidence?.reusedCandidatePath || !existsSync(candidate.sourceEvidence.reusedCandidatePath)) {
  preflightBlockers.push("reused_reusable_workflow_candidate_missing");
}
if (receipt.repairedInvocationOutcomeValidationReviewed !== true && receipt.teacherDecision === "approve_medium_runtime_reuse") {
  preflightBlockers.push("repaired_invocation_outcome_validation_not_reviewed");
}
if (receipt.repairedWorkflowBoundaryReviewed !== true && receipt.teacherDecision === "approve_medium_runtime_reuse") {
  preflightBlockers.push("repaired_workflow_boundary_not_reviewed");
}
if (receipt.repairedWorkflowFingerprintReviewed !== true && receipt.teacherDecision === "approve_medium_runtime_reuse") {
  preflightBlockers.push("repaired_workflow_fingerprint_not_reviewed");
}
if (ragInformedRepairReuse) {
  if (candidate.ragEvidenceTreatedAsAuthority !== false) {
    preflightBlockers.push("rag_informed_repaired_invocation_reuse_candidate_treats_rag_as_authority");
  }
  if (candidate.ragEvidenceNonAuthoritative !== true) {
    preflightBlockers.push("rag_informed_repaired_invocation_reuse_candidate_non_authority_flag_missing");
  }
  if (candidate.locks?.ragEvidenceNonAuthoritative !== true) {
    preflightBlockers.push("rag_informed_repaired_invocation_reuse_candidate_non_authority_lock_missing");
  }
  if (candidate.locks?.doesNotTreatRagAsAuthority !== true) {
    preflightBlockers.push("rag_informed_repaired_invocation_reuse_candidate_does_not_treat_rag_as_authority_lock_missing");
  }
  if (receipt.ragEvidenceTreatedAsAuthority !== false) {
    preflightBlockers.push("rag_informed_repaired_invocation_reuse_receipt_treats_rag_as_authority");
  }
  if (receipt.ragEvidenceNonAuthoritative !== true) {
    preflightBlockers.push("rag_informed_repaired_invocation_reuse_receipt_non_authority_flag_missing");
  }
  if (receipt.ragEvidenceNonAuthoritativeConfirmed !== true && receipt.teacherDecision === "approve_medium_runtime_reuse") {
    preflightBlockers.push("rag_informed_repaired_invocation_reuse_non_authority_not_confirmed");
  }
}

const existingValidation =
  preflightBlockers.length === 0
    ? runNode(
        "validate-tlcl-medium-runtime-reusable-workflow-activation-receipt.mjs",
        [
          "--goal",
          goal,
          "--candidate",
          candidate.sourceEvidence.reusedCandidatePath,
          "--receipt",
          adaptedReceiptPath,
          "--out-dir",
          join(validationDir, "reused-reusable-workflow-activation-validation")
        ],
        process.cwd()
      )
    : {
        status: "needs_teacher_review_or_more_evidence",
        decision: receipt.teacherDecision || "needs_teacher_review",
        mediumRuntimeWorkflowEnabled: false,
        mismatchBlocked: false,
        escalateToHighReasoningRepair: false,
        forbiddenDecisionUsed: false,
        blockers: preflightBlockers,
        validationPath: ""
      };

const mediumRuntimeWorkflowEnabled = existingValidation.mediumRuntimeWorkflowEnabled === true && preflightBlockers.length === 0;
const mismatchBlocked = existingValidation.mismatchBlocked === true;
const escalateToHighReasoningRepair = existingValidation.escalateToHighReasoningRepair === true || mismatchBlocked;
const forbiddenDecisionUsed = existingValidation.forbiddenDecisionUsed === true;
const blockers = [...preflightBlockers, ...(existingValidation.blockers || [])].filter((value, index, arr) => arr.indexOf(value) === index);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_repaired_reusable_workflow_invocation_reuse_review_decision"
  : mediumRuntimeWorkflowEnabled
    ? "repaired_reusable_workflow_invocation_reuse_review_allowed_waiting_for_next_invocation_planning"
    : escalateToHighReasoningRepair
      ? "repaired_reusable_workflow_invocation_reuse_review_to_high_reasoning_contract_repair"
      : "repaired_reusable_workflow_invocation_reuse_review_needs_teacher_review_or_more_evidence";
const reusableWorkflowCard = mediumRuntimeWorkflowEnabled
  ? {
      format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_card_v1",
      sourceExistingActivationValidationPath: existingValidation.validationPath || "",
      workflowFingerprint: candidate.workflowFingerprint || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      mediumRuntimeWorkflowEnabled: true,
      executionStillRequiresApprovalGate: true,
      rollbackStillRequired: true,
      outcomeReviewStillRequired: true,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      packagingUnlockAllowed: false,
      completionClaimAllowed: false
    }
  : null;
const highReasoningRepairHandoff = escalateToHighReasoningRepair
  ? {
      kind: "repaired_reusable_workflow_invocation_reuse_review_high_reasoning_repair_handoff",
      runtimeTransition: "repaired_invocation_reuse_review_to_high_reasoning_contract_repair",
      workflowFingerprint: candidate.workflowFingerprint || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      teacherDecision: existingValidation.decision,
      teacherCorrection: receipt.teacherCorrection || "",
      teacherNote: receipt.teacherNote || "",
      evidenceToInspect: [
        candidateInput.path,
        candidate.sourceEvidence?.repairedInvocationOutcomeValidationPath || "",
        candidate.sourceEvidence?.reusedCandidatePath || "",
        existingValidation.validationPath || ""
      ].filter(Boolean),
      repairTasks: [
        "Use highest-reasoning compile to narrow or repair the reusable workflow boundary.",
        "Do not let the medium runtime plan a next invocation from this repaired workflow until a new reuse review passes.",
        "Preserve rollback and fresh outcome review requirements for every future invocation."
      ]
    }
  : null;
const validationPath = join(validationDir, "tlcl-repaired-reusable-workflow-invocation-reuse-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-repaired-reusable-workflow-invocation-reuse-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REPAIRED_REUSABLE_WORKFLOW_INVOCATION_REUSE_REVIEW_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision: existingValidation.decision,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  mediumRuntimeWorkflowEnabled,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  reusableWorkflowCard,
  highReasoningRepairHandoff,
  reusedActivationValidatorInvoked: preflightBlockers.length === 0,
  reusedActivationValidationStatus: existingValidation.status,
  sourceEvidence: {
    repairedInvocationReuseReviewCandidatePath: candidateInput.path,
    repairedInvocationReuseReviewCandidateHash: sha256Object(candidate),
    repairedInvocationReuseReviewReceiptPath: receiptInput.path,
    repairedInvocationReuseReviewReceiptHash: sha256Object(receipt),
    reusedCandidatePath: candidate.sourceEvidence?.reusedCandidatePath || "",
    adaptedReceiptPath,
    reusedActivationValidationPath: existingValidation.validationPath || "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  blockedTransitions: [
    "run_repaired_reusable_workflow_from_invocation_reuse_review_validation",
    "execute_target_software_from_repaired_invocation_reuse_review_validation",
    "write_memory_from_repaired_invocation_reuse_review_validation",
    "enable_rule_from_repaired_invocation_reuse_review_validation",
    "unlock_packaging_from_repaired_invocation_reuse_review_validation",
    "treat_rag_as_authority_from_repaired_invocation_reuse_review",
    "claim_goal_complete_from_repaired_invocation_reuse_review_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceCandidate: candidateInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks(mediumRuntimeWorkflowEnabled)
};
const validationReceipt = {
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_receipt_v1",
  validationId,
  status,
  decision: existingValidation.decision,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  mediumRuntimeWorkflowEnabled,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  workflowExecuted: false,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  goalComplete: false,
  locks: locks(mediumRuntimeWorkflowEnabled)
};

writeJson(validationPath, validation);
writeJson(validationReceiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Repaired Reusable Workflow Invocation Reuse Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${existingValidation.decision}`,
    "",
    "This validation may allow a repaired reusable workflow invocation to be used by a later invocation planner, but it does not run workflow code, execute target software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_result_v1",
      validationId,
      status,
      decision: existingValidation.decision,
      mediumRuntimeWorkflowEnabled,
      mismatchBlocked,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      reusedActivationValidatorInvoked: preflightBlockers.length === 0,
      reusedActivationValidationStatus: existingValidation.status,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      workflowExecuted: false,
      approvedGateRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      goalComplete: false
    },
    null,
    2
  )
);
