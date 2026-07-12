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

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
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
    String(value || "tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner"
  );
}

function locks(ready = false) {
  return {
    reviewOnly: true,
    repairedReuseInvocationPlannerOnly: true,
    reusesExistingReusableWorkflowInvocationPlanner: true,
    supportsRagInformedRepairReuseValidation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    mediumRuntimeReuseInvocationReady: ready,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    approvalGateStillRequired: true,
    rollbackStillRequired: true,
    outcomeReviewStillRequired: true,
    accepted: false,
    ruleEnabled: false,
    memoryWritten: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function runNode(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function normalizeDecision(value) {
  const decision = String(value || "invoke_medium_runtime_reuse").trim().toLowerCase();
  if (["invoke_medium_runtime_reuse", "prepare_bounded_reuse", "prepare_medium_runtime_reuse"].includes(decision)) {
    return "invoke_medium_runtime_reuse";
  }
  if (["workflow_mismatch_blocked", "mismatch_blocked", "blocked"].includes(decision)) return "workflow_mismatch_blocked";
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (["accepted", "enable_rule", "write_memory", "unlock_packaging", "claim_goal_complete", "claim_all_software_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function isRagInformedRepairReuse(sourceValidation, card) {
  return (
    sourceValidation?.ragInformedRepairReuse === true ||
    sourceValidation?.sourceEvidence?.ragInformedRepairReuse === true ||
    card?.ragInformedRepairReuse === true ||
    sourceValidation?.format === "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_v1"
  );
}

function providerRoleUsePlanTraceFromValidation(sourceValidation, card) {
  return (
    sourceValidation?.reusableWorkflowCard?.providerRoleUsePlanTrace ||
    sourceValidation?.highReasoningRepairHandoff?.providerRoleUsePlanTrace ||
    sourceValidation?.sourceEvidence?.providerRoleUsePlanTrace ||
    sourceValidation?.providerRoleUsePlanTrace ||
    card?.providerRoleUsePlanTrace ||
    card?.sourceEvidence?.providerRoleUsePlanTrace ||
    null
  );
}

function reasoningBudgetGovernorReviewTraceFromValidation(sourceValidation, card) {
  return (
    sourceValidation?.reusableWorkflowCard?.reasoningBudgetGovernorReviewTrace ||
    sourceValidation?.highReasoningRepairHandoff?.reasoningBudgetGovernorReviewTrace ||
    sourceValidation?.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    sourceValidation?.reasoningBudgetGovernorReviewTrace ||
    card?.reasoningBudgetGovernorReviewTrace ||
    card?.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    null
  );
}

function adaptRepairedWorkflowCard(card, sourceValidation) {
  const ragInformedRepairReuse = isRagInformedRepairReuse(sourceValidation, card);
  const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromValidation(sourceValidation, card);
  const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromValidation(sourceValidation, card);
  return {
    ...card,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_card_v1",
    runtimeTier: "medium_reasoning_runtime",
    mediumRuntimeWorkflowEnabled: true,
    boundedReuseScope: {
      ...(card.boundedReuseScope || {}),
      repairedWorkflowReuse: true,
      ragInformedRepairReuse,
      sourceRepairReuseReviewValidationPath: sourceValidation.paths?.validation || "",
      sourceExistingActivationValidationPath: card.sourceExistingActivationValidationPath || "",
      sourceExistingRepairReuseValidationPath: card.sourceExistingRepairReuseValidationPath || "",
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      allowedOnlyWhenWorkflowFingerprintMatches: true
    },
    requiredBeforeEveryRun: [
      "same repaired TLCL contract and route fingerprint",
      "deterministic validators still pass",
      "teacher-reviewed approval gate is ready",
      "rollback point is retained",
      "post-run outcome review is created again",
      "any mismatch returns to highest-reasoning contract repair"
    ],
    executionStillRequiresApprovalGate: true,
    rollbackStillRequired: true,
    outcomeReviewStillRequired: true,
    ragInformedRepairReuse,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    memoryWriteAllowed: false,
    ruleEnablementAllowed: false,
    packagingUnlockAllowed: false,
    completionClaimAllowed: false
  };
}

const goal = argValue("--goal", argValue("--task", "Plan one bounded invocation from a repaired reusable workflow."));
const validationInput = readJsonInput(
  argValue("--repair-reuse-validation", argValue("--validation", "")),
  "--repair-reuse-validation"
);
const contextInput = readJsonInput(argValue("--reuse-context", argValue("--context", "")), "--reuse-context", "");
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-repaired-reusable-workflow-invocations")
  )
);
const validation = validationInput.value;
const context = contextInput.value || {};
const card = validation?.reusableWorkflowCard || null;
const ragInformedRepairReuse = isRagInformedRepairReuse(validation, card);
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromValidation(validation, card);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromValidation(validation, card);
const decision = normalizeDecision(
  argValue("--teacher-decision", context.teacherDecision || context.decision || "invoke_medium_runtime_reuse")
);

const invocationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const invocationDir = join(outRoot, invocationId);
const adaptedCardPath = join(invocationDir, "adapted-repaired-reusable-workflow-card.json");
const wrapperPath = join(invocationDir, "tlcl-medium-runtime-repaired-reusable-workflow-invocation-wrapper.json");
const receiptPath = join(invocationDir, "tlcl-medium-runtime-repaired-reusable-workflow-invocation-receipt.json");
const readmePath = join(invocationDir, "TLCL_MEDIUM_RUNTIME_REPAIRED_REUSABLE_WORKFLOW_INVOCATION_START_HERE.md");

const forbiddenDecisions = new Set([
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_goal_complete",
  "claim_all_software_complete"
]);
const preflightBlockers = [];
if (forbiddenDecisions.has(decision)) preflightBlockers.push("forbidden_teacher_decision");
const acceptedValidationFormats = new Set([
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_validation_v1",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_v1",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_v1"
]);
const acceptedPlanningStatuses = new Set([
  "repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning",
  "repaired_reusable_workflow_invocation_reuse_review_allowed_waiting_for_next_invocation_planning",
  "rag_informed_repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning"
]);
if (!acceptedValidationFormats.has(validation?.format)) {
  preflightBlockers.push("repair_reuse_review_validation_format_not_supported");
}
if (!acceptedPlanningStatuses.has(validation?.status)) {
  preflightBlockers.push("repair_reuse_review_not_allowed_for_next_invocation_planning");
}
if (validation.mediumRuntimeWorkflowEnabled !== true) preflightBlockers.push("repaired_workflow_not_enabled_for_medium_runtime");
if (!card) preflightBlockers.push("repaired_reusable_workflow_card_missing");
if (card && card.mediumRuntimeWorkflowEnabled !== true) preflightBlockers.push("repaired_workflow_card_not_enabled");
if (card && card.executionStillRequiresApprovalGate !== true) preflightBlockers.push("repaired_workflow_approval_gate_lock_missing");
if (card && card.rollbackStillRequired !== true) preflightBlockers.push("repaired_workflow_rollback_lock_missing");
if (card && card.outcomeReviewStillRequired !== true) preflightBlockers.push("repaired_workflow_outcome_review_lock_missing");
if (card && !card.workflowFingerprint) preflightBlockers.push("repaired_workflow_fingerprint_missing");
if (ragInformedRepairReuse) {
  if (validation.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("rag_informed_validation_treats_rag_as_authority");
  if (validation.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_validation_non_authority_flag_missing");
  if (validation.locks?.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_validation_non_authority_lock_missing");
  if (validation.locks?.doesNotTreatRagAsAuthority !== true) preflightBlockers.push("rag_informed_validation_authority_forbidden_lock_missing");
  if (card && card.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("rag_informed_card_treats_rag_as_authority");
  if (card && card.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_card_non_authority_lock_missing");
}

let adaptedCard = null;
let existingPlanner = null;
if (preflightBlockers.length === 0) {
  adaptedCard = adaptRepairedWorkflowCard(card, validation);
  writeJson(adaptedCardPath, adaptedCard);
  const args = [
    "--goal",
    goal,
    "--workflow-card",
    adaptedCardPath,
    "--out-dir",
    join(invocationDir, "existing-reusable-workflow-invocation-planner")
  ];
  if (contextInput.path || contextInput.value) args.push("--reuse-context", contextInput.path || JSON.stringify(contextInput.value));
  const workflowFingerprint = argValue("--workflow-fingerprint", context.workflowFingerprint || context.observedWorkflowFingerprint || "");
  if (workflowFingerprint) args.push("--workflow-fingerprint", workflowFingerprint);
  if (decision) args.push("--teacher-decision", decision);
  const teacherCorrection = argValue("--teacher-correction", context.teacherCorrection || "");
  if (teacherCorrection) args.push("--teacher-correction", teacherCorrection);
  const observedIssue = argValue("--observed-issue", context.observedIssue || "");
  if (observedIssue) args.push("--observed-issue", observedIssue);
  if (hasFlag("--deterministic-validators-passed") || context.deterministicValidatorsPassed === true) {
    args.push("--deterministic-validators-passed");
  }
  if (hasFlag("--approval-gate-still-required") || context.approvalGateStillRequiredConfirmed === true) {
    args.push("--approval-gate-still-required");
  }
  if (hasFlag("--rollback-point-retained") || context.rollbackPointRetained === true || context.rollbackPointStillRetained === true) {
    args.push("--rollback-point-retained");
  }
  if (hasFlag("--teacher-reviewed-reuse-intent") || context.teacherReviewedReuseIntent === true) {
    args.push("--teacher-reviewed-reuse-intent");
  }
  if (hasFlag("--fresh-outcome-review-planned") || context.freshOutcomeReviewPlanned === true) {
    args.push("--fresh-outcome-review-planned");
  }
  existingPlanner = runNode("create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs", args);
}

const existingStatus = existingPlanner?.status || "";
const existingReady = existingStatus === "medium_runtime_reuse_invocation_ready_for_approval_gate_planning";
const existingHighRepair = existingPlanner?.escalateToHighReasoningRepair === true;
const forbiddenDecisionUsed = forbiddenDecisions.has(decision) || existingPlanner?.forbiddenDecisionUsed === true;
const blockers = [...preflightBlockers, ...(existingPlanner?.blockers || [])].filter((value, index, arr) => arr.indexOf(value) === index);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_repaired_reusable_workflow_invocation_decision"
  : existingReady
    ? "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning"
    : existingHighRepair
      ? "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair"
      : "blocked_before_repaired_reusable_workflow_invocation_planning";
const invocationReady = status === "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning";
const wrapper = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_plan_v1",
  invocationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  invocationReady,
  repairedReusableWorkflowInvocation: true,
  reusedExistingInvocationPlanner: existingPlanner !== null,
  reusedExistingInvocationPlannerStatus: existingStatus,
  existingInvocationPlanPath: existingPlanner?.planPath || "",
  adaptedWorkflowCardPath: adaptedCard ? adaptedCardPath : "",
  workflowFingerprint: card?.workflowFingerprint || "",
  fingerprintMatched: existingPlanner?.fingerprintMatched === true,
  mediumRuntimeWorkflowEnabled: card?.mediumRuntimeWorkflowEnabled === true,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  approvalGateStillRequired: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  forbiddenDecisionUsed,
  escalateToHighReasoningRepair: existingHighRepair,
  blockers,
  sourceEvidence: {
    repairReuseReviewValidationPath: validationInput.path,
    repairReuseReviewValidationHash: sha256Object(validation),
    repairReuseReviewValidationFormat: validation?.format || "",
    repairReuseReviewValidationStatus: validation?.status || "",
    reuseContextPath: contextInput.path,
    reuseContextHash: contextInput.value ? sha256Object(contextInput.value) : "",
    repairedWorkflowCardHash: card ? sha256Object(card) : "",
    adaptedWorkflowCardHash: adaptedCard ? sha256Object(adaptedCard) : "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  blockedTransitions: [
    "run_repaired_reusable_workflow_from_planner_adapter",
    "invoke_approved_gate_runner_from_planner_adapter",
    "execute_target_software_from_planner_adapter",
    "write_memory_from_planner_adapter",
    "enable_rule_from_planner_adapter",
    "unlock_packaging_from_planner_adapter",
    "treat_rag_as_authority_from_repaired_invocation_planner",
    "claim_goal_complete_from_planner_adapter"
  ],
  paths: {
    wrapper: wrapperPath,
    receipt: receiptPath,
    readme: readmePath,
    adaptedWorkflowCard: adaptedCard ? adaptedCardPath : "",
    existingInvocationPlan: existingPlanner?.planPath || ""
  },
  locks: locks(invocationReady)
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_plan_receipt_v1",
  invocationId,
  status,
  decision,
  invocationReady,
  repairedReusableWorkflowInvocation: true,
  reusedExistingInvocationPlanner: existingPlanner !== null,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  blockers,
  workflowExecuted: false,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  goalComplete: false,
  locks: locks(invocationReady)
};

writeJson(wrapperPath, wrapper);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Repaired Reusable Workflow Invocation Planner",
    "",
    `Status: ${status}`,
    `Existing planner reused: ${existingPlanner ? "yes" : "no"}`,
    "",
    "This adapter lets a teacher-approved repaired reusable workflow feed the existing medium-runtime invocation planner.",
    "It does not run the workflow, invoke an approved gate runner, execute target software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_planner_result_v1",
      invocationId,
      status,
      decision,
      invocationReady,
      repairedReusableWorkflowInvocation: true,
      reusedExistingInvocationPlanner: existingPlanner !== null,
      reusedExistingInvocationPlannerStatus: existingStatus,
      existingInvocationPlanPath: existingPlanner?.planPath || "",
      wrapperPath,
      receiptPath,
      readmePath,
      adaptedWorkflowCardPath: adaptedCard ? adaptedCardPath : "",
      workflowFingerprint: card?.workflowFingerprint || "",
      fingerprintMatched: existingPlanner?.fingerprintMatched === true,
      mediumRuntimeWorkflowEnabled: card?.mediumRuntimeWorkflowEnabled === true,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      approvalGateStillRequired: true,
      rollbackStillRequired: true,
      outcomeReviewStillRequired: true,
      escalateToHighReasoningRepair: existingHighRepair,
      forbiddenDecisionUsed,
      blockers,
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
