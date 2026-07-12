#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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

function readJsonInput(input, label, expectedFormats = []) {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormats.length && !expectedFormats.includes(parsed.value?.format)) {
    throw new Error(`${label} must be one of: ${expectedFormats.join(", ")}`);
  }
  return parsed;
}

function slug(value) {
  return (
    String(value || "tlcl-reusable-workflow-invocation-planner")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-invocation-planner"
  );
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
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

function providerRoleUsePlanTraceFromWorkflowCard(workflowCard) {
  return (
    workflowCard?.providerRoleUsePlanTrace ||
    workflowCard?.boundedReuseScope?.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromContext(context) {
  return context?.reasoningBudgetGovernorReviewTrace || {};
}

function locks(ready = false) {
  return {
    reviewOnly: true,
    invocationPlannerOnly: true,
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goal = argValue("--goal", argValue("--task", "Plan one bounded TLCL medium-runtime reusable workflow invocation."));
const activationInput = readJsonInput(
  argValue("--activation-validation", argValue("--validation", "")),
  "--activation-validation",
  ["transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_validation_v1"]
);
const cardInput = readJsonInput(
  argValue("--workflow-card", argValue("--card", "")),
  "--workflow-card",
  ["transparent_ai_tlcl_medium_runtime_reusable_workflow_card_v1"]
);
const contextInput = readJsonInput(argValue("--reuse-context", argValue("--context", "")), "--reuse-context", []);
const outputRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-reusable-workflow-invocations"))
);

const activation = activationInput.value;
const workflowCard = cardInput.value || activation?.reusableWorkflowCard || null;
const context = contextInput.value || {};
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromContext(context);
const decision = normalizeDecision(
  argValue("--teacher-decision", context.teacherDecision || context.decision || "invoke_medium_runtime_reuse")
);
const expectedWorkflowFingerprint = workflowCard?.workflowFingerprint || "";
const observedWorkflowFingerprint =
  argValue("--workflow-fingerprint", context.workflowFingerprint || context.observedWorkflowFingerprint || "");
const deterministicValidatorsPassed =
  hasFlag("--deterministic-validators-passed") || context.deterministicValidatorsPassed === true;
const approvalGateStillRequiredConfirmed =
  hasFlag("--approval-gate-still-required") || context.approvalGateStillRequiredConfirmed === true;
const rollbackPointRetained =
  hasFlag("--rollback-point-retained") || context.rollbackPointRetained === true || context.rollbackPointStillRetained === true;
const teacherReviewedReuseIntent =
  hasFlag("--teacher-reviewed-reuse-intent") || context.teacherReviewedReuseIntent === true;
const freshOutcomeReviewPlanned =
  hasFlag("--fresh-outcome-review-planned") || context.freshOutcomeReviewPlanned === true;

const forbiddenDecisions = new Set([
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_goal_complete",
  "claim_all_software_complete"
]);
const blockers = [];
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (!workflowCard) blockers.push("workflow_card_missing");
if (workflowCard && workflowCard.mediumRuntimeWorkflowEnabled !== true) blockers.push("workflow_card_not_enabled");
if (workflowCard && workflowCard.executionStillRequiresApprovalGate !== true) blockers.push("workflow_card_approval_gate_lock_missing");
if (workflowCard && workflowCard.rollbackStillRequired !== true) blockers.push("workflow_card_rollback_lock_missing");
if (workflowCard && workflowCard.outcomeReviewStillRequired !== true) blockers.push("workflow_card_outcome_review_lock_missing");
if (!expectedWorkflowFingerprint) blockers.push("workflow_card_fingerprint_missing");
if (decision === "invoke_medium_runtime_reuse") {
  if (!observedWorkflowFingerprint) blockers.push("reuse_context_workflow_fingerprint_missing");
  if (expectedWorkflowFingerprint && observedWorkflowFingerprint && expectedWorkflowFingerprint !== observedWorkflowFingerprint) {
    blockers.push("workflow_fingerprint_mismatch_requires_high_reasoning_repair");
  }
  if (!deterministicValidatorsPassed) blockers.push("deterministic_validators_not_confirmed");
  if (!approvalGateStillRequiredConfirmed) blockers.push("approval_gate_requirement_not_confirmed");
  if (!rollbackPointRetained) blockers.push("rollback_point_not_retained");
  if (!teacherReviewedReuseIntent) blockers.push("teacher_reuse_intent_not_reviewed");
  if (!freshOutcomeReviewPlanned) blockers.push("fresh_outcome_review_not_planned");
}
if (decision === "correction_to_high_reasoning_repair" && !String(context.teacherCorrection || argValue("--teacher-correction", "")).trim()) {
  blockers.push("high_reasoning_repair_correction_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const fingerprintMatched = Boolean(expectedWorkflowFingerprint && observedWorkflowFingerprint && expectedWorkflowFingerprint === observedWorkflowFingerprint);
const invocationReady = decision === "invoke_medium_runtime_reuse" && blockers.length === 0;
const mismatchBlocked =
  decision === "workflow_mismatch_blocked" ||
  blockers.includes("workflow_fingerprint_mismatch_requires_high_reasoning_repair");
const escalateToHighReasoningRepair =
  decision === "correction_to_high_reasoning_repair" || (mismatchBlocked && !forbiddenDecisionUsed);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : invocationReady
    ? "medium_runtime_reuse_invocation_ready_for_approval_gate_planning"
    : escalateToHighReasoningRepair
      ? "escalate_to_high_reasoning_contract_repair"
      : "blocked_before_medium_runtime_reuse_invocation";
const invocationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const invocationDir = join(outputRoot, invocationId);
const planPath = join(invocationDir, "tlcl-medium-runtime-reusable-workflow-invocation-plan.json");
const receiptPath = join(invocationDir, "tlcl-medium-runtime-reusable-workflow-invocation-plan-receipt.json");
const readmePath = join(invocationDir, "TLCL_MEDIUM_RUNTIME_REUSABLE_WORKFLOW_INVOCATION_START_HERE.md");

const reuseInvocationHandoff = invocationReady
  ? {
      kind: "medium_runtime_reusable_workflow_invocation_handoff",
      runtimeTier: "medium_reasoning_runtime",
      workflowFingerprint: expectedWorkflowFingerprint,
      providerRoleUsePlanTrace: providerRoleUsePlanTraceFromWorkflowCard(workflowCard),
      reasoningBudgetGovernorReviewTrace,
      nextRequiredGate: "teacher_reviewed_execution_approval_gate",
      everyRunStillRequires: workflowCard.requiredBeforeEveryRun || [],
      executesNow: false,
      approvedGateRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      ruleEnabled: false,
      packagingGated: true,
      goalComplete: false
    }
  : null;
const highReasoningRepairHandoff = escalateToHighReasoningRepair
  ? {
      kind: "high_reasoning_repair_handoff",
      runtimeTransition: "reusable_workflow_invocation_to_high_reasoning_contract_repair",
      expectedWorkflowFingerprint,
      observedWorkflowFingerprint,
      providerRoleUsePlanTrace: providerRoleUsePlanTraceFromWorkflowCard(workflowCard),
      reasoningBudgetGovernorReviewTrace,
      fingerprintMatched,
      teacherDecision: decision,
      teacherCorrection: context.teacherCorrection || argValue("--teacher-correction", ""),
      observedIssue: context.observedIssue || argValue("--observed-issue", ""),
      evidenceToInspect: [activationInput.path, cardInput.path, contextInput.path].filter(Boolean),
      repairTasks: [
        "Repair the TLCL contract or route fingerprint before allowing medium-runtime reuse.",
        "Rebuild or reactivate a reusable workflow card after the repair is teacher-reviewed.",
        "Do not let medium runtime invoke this workflow while the fingerprint or teacher correction is unresolved."
      ]
    }
  : null;
const plan = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_plan_v1",
  invocationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  runtimeTier: "medium_reasoning_runtime",
  expectedWorkflowFingerprint,
  observedWorkflowFingerprint,
  fingerprintMatched,
  invocationReady,
  mediumRuntimeWorkflowEnabled: workflowCard?.mediumRuntimeWorkflowEnabled === true,
  approvalGateStillRequired: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  deterministicValidatorsPassed,
  teacherReviewedReuseIntent,
  freshOutcomeReviewPlanned,
  forbiddenDecisionUsed,
  blockers,
  reuseInvocationHandoff,
  highReasoningRepairHandoff,
  sourceEvidence: {
    activationValidationPath: activationInput.path,
    workflowCardPath: cardInput.path,
    reuseContextPath: contextInput.path,
    activationValidationHash: activation ? sha256Object(activation) : "",
    workflowCardHash: workflowCard ? sha256Object(workflowCard) : "",
    reuseContextHash: contextInput.value ? sha256Object(contextInput.value) : "",
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromWorkflowCard(workflowCard),
    reasoningBudgetGovernorReviewTrace
  },
  blockedTransitions: [
    "run_workflow_from_invocation_planner",
    "invoke_approved_gate_runner_from_invocation_planner",
    "execute_target_software_from_invocation_planner",
    "write_memory_from_invocation_planner",
    "enable_rule_from_invocation_planner",
    "unlock_packaging_from_invocation_planner",
    "claim_goal_complete_from_invocation_planner"
  ],
  paths: {
    plan: planPath,
    receipt: receiptPath,
    readme: readmePath
  },
  locks: locks(invocationReady)
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_plan_receipt_v1",
  invocationId,
  status,
  decision,
  invocationReady,
  fingerprintMatched,
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

writeJson(planPath, plan);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Reusable Workflow Invocation Planner",
    "",
    `Status: ${status}`,
    `Fingerprint matched: ${fingerprintMatched ? "yes" : "no"}`,
    "",
    "This planner lets the medium-runtime layer reuse only a previously teacher-activated TLCL workflow card.",
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
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_planner_result_v1",
      invocationId,
      status,
      decision,
      invocationReady,
      fingerprintMatched,
      mediumRuntimeWorkflowEnabled: workflowCard?.mediumRuntimeWorkflowEnabled === true,
      approvalGateStillRequired: true,
      rollbackStillRequired: true,
      outcomeReviewStillRequired: true,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers,
      planPath,
      receiptPath,
      readmePath,
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
