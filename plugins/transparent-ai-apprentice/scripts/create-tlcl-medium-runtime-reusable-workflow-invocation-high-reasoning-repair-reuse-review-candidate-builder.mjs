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
    String(value || "tlcl-reusable-workflow-repair-reuse-review-candidate")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-reuse-review-candidate"
  );
}

function locks() {
  return {
    reviewOnly: true,
    candidateBuilderOnly: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    reusesExistingReusableWorkflowCandidateBuilder: true,
    doesNotEnableWorkflow: true,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    workflowEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function providerRoleUsePlanTraceFromValidation(validation) {
  return (
    validation.matchedRepairOutcomeHandoff?.providerRoleUsePlanTrace ||
    validation.highReasoningRepairHandoff?.providerRoleUsePlanTrace ||
    validation.sourceEvidence?.providerRoleUsePlanTrace ||
    validation.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromValidation(validation) {
  return (
    validation.matchedRepairOutcomeHandoff?.reasoningBudgetGovernorReviewTrace ||
    validation.highReasoningRepairHandoff?.reasoningBudgetGovernorReviewTrace ||
    validation.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    validation.reasoningBudgetGovernorReviewTrace ||
    {}
  );
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

function adaptRepairOutcomeValidation(validation) {
  const ragInformedRepairReuse = validation.ragInformedRepairReuse === true || validation.sourceEvidence?.ragInformedRepairReuse === true;
  const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromValidation(validation);
  const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromValidation(validation);
  return {
    ...validation,
    format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_validation_v1",
    status:
      validation.status === "reusable_workflow_repair_invocation_outcome_matched_contract_waiting_for_reuse_review"
        ? "execution_outcome_matched_contract_waiting_for_rule_activation_review"
        : validation.status,
    outcomeMatchedContract: validation.outcomeMatchedContract === true,
    matchedContractHandoff: {
      kind: "matched_contract_review_handoff",
      runtimeTransition: "repaired_reusable_workflow_fresh_outcome_waiting_for_reuse_review",
      sourceRunId: validation.matchedRepairOutcomeHandoff?.sourceRepairRunId || validation.validationId || "",
      executesNow: false,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      nextRequiredReview: "Teacher must review whether the repaired reusable workflow card can be retained or updated."
    },
    sourceEvidence: {
      ...(validation.sourceEvidence || {}),
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace
    },
    locks: {
      ...(validation.locks || {}),
      ragEvidenceNonAuthoritative: ragInformedRepairReuse || validation.locks?.ragEvidenceNonAuthoritative === true,
      doesNotTreatRagAsAuthority: ragInformedRepairReuse || validation.locks?.doesNotTreatRagAsAuthority === true,
      doesNotEnableRules: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    }
  };
}

const goal = argValue("--goal", "Build a repair-specific reuse review candidate from one matched repaired TLCL outcome.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--repair-outcome-validation", argValue("--outcome-review-validation", ""))),
  "--validation",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_validation_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-reuse-review-candidates")
  )
);
const validation = validationInput.value;
const ragInformedRepairReuse = validation.ragInformedRepairReuse === true || validation.sourceEvidence?.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromValidation(validation);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromValidation(validation);
const candidateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const candidateDir = join(outRoot, candidateId);
const adaptedValidationPath = join(candidateDir, "adapted-tlcl-approved-gate-outcome-review-validation.json");
writeJson(adaptedValidationPath, adaptRepairOutcomeValidation(validation));

const blockers = [];
if (validation.status !== "reusable_workflow_repair_invocation_outcome_matched_contract_waiting_for_reuse_review") {
  blockers.push("repair_outcome_validation_not_matched_for_reuse_review");
}
if (validation.outcomeMatchedContract !== true) blockers.push("repair_outcome_match_confirmation_missing");
if (!validation.matchedRepairOutcomeHandoff) blockers.push("matched_repair_outcome_handoff_missing");
if (validation.locks?.goalComplete !== false) blockers.push("repair_outcome_completion_lock_missing");
if (validation.locks?.doesNotEnableRules !== true) blockers.push("repair_outcome_rule_lock_missing");
if (ragInformedRepairReuse) {
  if (validation.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_informed_repair_outcome_treats_rag_as_authority");
  if (validation.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_repair_outcome_non_authority_flag_missing");
  if (validation.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_repair_outcome_non_authority_lock_missing");
  if (validation.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_repair_outcome_does_not_treat_rag_as_authority_lock_missing");
  }
}

const existingCandidate =
  blockers.length === 0
    ? runNode(
        "create-tlcl-medium-runtime-reusable-workflow-candidate-builder.mjs",
        ["--goal", goal, "--validation", adaptedValidationPath, "--out-dir", join(candidateDir, "reused-reusable-workflow-candidate")],
        process.cwd()
      )
    : null;
const existingTemplate = existingCandidate ? readJson(existingCandidate.receiptTemplatePath) : null;
const candidatePath = join(candidateDir, "tlcl-reusable-workflow-repair-reuse-review-candidate.json");
const receiptTemplatePath = join(candidateDir, "tlcl-reusable-workflow-repair-reuse-review-receipt-template.json");
const readmePath = join(candidateDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_REUSE_REVIEW_CANDIDATE_START_HERE.md");
const status =
  blockers.length === 0
    ? "reusable_workflow_repair_reuse_review_candidate_ready_for_teacher_review"
    : "blocked_before_reusable_workflow_repair_reuse_review_candidate";
const receiptTemplate = existingTemplate
  ? {
      ...existingTemplate,
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_receipt_v1",
      sourceRepairReuseReviewCandidatePath: candidatePath,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragEvidenceNonAuthoritativeConfirmed: false,
      repairOutcomeValidationReviewed: false,
      repairedWorkflowBoundaryReviewed: false,
      repairedWorkflowFingerprintReviewed: false,
      teacherNote: "Review whether this repaired reusable workflow may be retained for later bounded medium-runtime invocation planning."
    }
  : {
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_receipt_v1",
      candidateId,
      sourceRepairReuseReviewCandidatePath: candidatePath,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragEvidenceNonAuthoritativeConfirmed: false,
      teacherDecision: "needs_teacher_review",
      repairOutcomeValidationReviewed: false,
      repairedWorkflowBoundaryReviewed: false,
      repairedWorkflowFingerprintReviewed: false,
      blockedActionsConfirmed: true,
      locks: locks()
    };
const candidate = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_candidate_v1",
  candidateId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  workflowFingerprint: existingCandidate?.workflowFingerprint || "",
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  mediumRuntimeReuseCandidate: Boolean(existingCandidate?.mediumRuntimeReuseCandidate),
  mediumRuntimeWorkflowEnabled: false,
  blockers,
  reusedCandidateBuilderInvoked: Boolean(existingCandidate),
  reusedCandidateBuilderStatus: existingCandidate?.status || "",
  sourceEvidence: {
    repairOutcomeValidationPath: validationInput.path,
    repairOutcomeValidationHash: sha256Object(validation),
    adaptedOutcomeValidationPath: adaptedValidationPath,
    reusedCandidatePath: existingCandidate?.candidatePath || "",
    reusedReceiptTemplatePath: existingCandidate?.receiptTemplatePath || "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  defaultReceipt: receiptTemplate,
  blockedTransitions: [
    "run_repaired_reusable_workflow_from_reuse_review_candidate",
    "write_memory_from_repair_reuse_review_candidate",
    "enable_rule_from_repair_reuse_review_candidate",
    "unlock_packaging_from_repair_reuse_review_candidate",
    "treat_rag_as_authority_from_repair_reuse_review_candidate",
    "claim_goal_complete_from_repair_reuse_review_candidate"
  ],
  paths: {
    candidate: candidatePath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceValidation: validationInput.path
  },
  locks: locks()
};

writeJson(candidatePath, candidate);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow Repair Reuse Review Candidate",
    "",
    `Status: ${status}`,
    `Workflow fingerprint: ${candidate.workflowFingerprint || "<blocked>"}`,
    "",
    "This wrapper reuses the existing bounded reusable workflow candidate builder after a repaired fresh outcome matched the contract.",
    "It does not enable the workflow, run software, write memory, enable rules, unlock packaging, or claim completion.",
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
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_candidate_builder_result_v1",
      candidateId,
      status,
      workflowFingerprint: candidate.workflowFingerprint,
      candidatePath,
      receiptTemplatePath,
      readmePath,
      blockers,
      reusedCandidateBuilderInvoked: Boolean(existingCandidate),
      reusedCandidateBuilderStatus: existingCandidate?.status || "",
      mediumRuntimeReuseCandidate: candidate.mediumRuntimeReuseCandidate,
      mediumRuntimeWorkflowEnabled: false,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      workflowExecuted: false,
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
