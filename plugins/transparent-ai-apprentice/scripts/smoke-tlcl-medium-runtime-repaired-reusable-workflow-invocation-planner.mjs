#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "smoke", "tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner");
mkdirSync(smokeRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function run(args) {
  const result = spawnSync(
    process.execPath,
    [
      join(
        repoRoot,
        "plugins",
        "transparent-ai-apprentice",
        "scripts",
        "create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs"
      ),
      ...args
    ],
    { cwd: repoRoot, encoding: "utf8", timeout: 300000 }
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "repaired reusable workflow invocation planner failed");
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const providerRoleUsePlanTrace = {
  providerRoleUsePlanHash: "sha256:repaired-invocation-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repaired-invocation-reasoning-budget-governor-smoke",
  highReasoningCompileRequiredForLogicChanges: true,
  mediumReasoningRuntimeAllowedAfterTeacherApproval: true,
  correctionReturnsToHighReasoningRepair: true
};
const repairedCard = {
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_card_v1",
  sourceExistingActivationValidationPath: join(smokeRoot, "reused-activation-validation.json"),
  workflowFingerprint: "sha256:repaired-bounded-workflow",
  mediumRuntimeWorkflowEnabled: true,
  executionStillRequiresApprovalGate: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  memoryWriteAllowed: false,
  ruleEnablementAllowed: false,
  packagingUnlockAllowed: false,
  completionClaimAllowed: false
};
const approvedRepairReuseValidation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_validation_v1",
  validationId: "repaired-reusable-workflow-invocation-smoke-validation",
  status: "repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning",
  decision: "approve_medium_runtime_reuse",
  mediumRuntimeWorkflowEnabled: true,
  reusableWorkflowCard: repairedCard,
  sourceEvidence: {
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  locks: {
    doesNotRunWorkflow: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    goalComplete: false
  },
  paths: {
    validation: join(smokeRoot, "repair-reuse-review-validation.json")
  }
};
const ragInformedRepairedCard = {
  format: "transparent_ai_tlcl_rag_informed_repaired_reusable_workflow_card_v1",
  sourceExistingRepairReuseValidationPath: join(smokeRoot, "rag-informed-reuse-review-validation.json"),
  workflowFingerprint: "sha256:rag-informed-repaired-bounded-workflow",
  mediumRuntimeWorkflowEnabled: true,
  ragEvidenceNonAuthoritative: true,
  ragEvidenceTreatedAsAuthority: false,
  executionStillRequiresApprovalGate: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  memoryWriteAllowed: false,
  ruleEnablementAllowed: false,
  packagingUnlockAllowed: false,
  completionClaimAllowed: false
};
const approvedRagInformedReuseValidation = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_v1",
  validationId: "rag-informed-repaired-reusable-workflow-invocation-smoke-validation",
  status: "rag_informed_repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning",
  decision: "approve_medium_runtime_reuse",
  mediumRuntimeWorkflowEnabled: true,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  reusableWorkflowCard: ragInformedRepairedCard,
  sourceEvidence: {
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  locks: {
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    doesNotRunWorkflow: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    goalComplete: false
  },
  paths: {
    validation: join(smokeRoot, "rag-informed-reuse-review-validation.json")
  }
};
const blockedRepairReuseValidation = {
  ...approvedRepairReuseValidation,
  status: "repaired_reusable_workflow_reuse_review_needs_teacher_review_or_more_evidence",
  mediumRuntimeWorkflowEnabled: false
};
const readyContext = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_context_v1",
  workflowFingerprint: "sha256:repaired-bounded-workflow",
  deterministicValidatorsPassed: true,
  approvalGateStillRequiredConfirmed: true,
  rollbackPointRetained: true,
  teacherReviewedReuseIntent: true,
  freshOutcomeReviewPlanned: true
};
const ragReadyContext = {
  ...readyContext,
  workflowFingerprint: "sha256:rag-informed-repaired-bounded-workflow"
};
const correctionContext = {
  ...readyContext,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherCorrection: "The repaired workflow still misses an angle binding."
};
const forbiddenContext = {
  ...readyContext,
  teacherDecision: "write_memory"
};

const approvedPath = writeJson(join(smokeRoot, "repair-reuse-review-validation.json"), approvedRepairReuseValidation);
const ragApprovedPath = writeJson(join(smokeRoot, "rag-informed-reuse-review-validation.json"), approvedRagInformedReuseValidation);
const blockedPath = writeJson(join(smokeRoot, "blocked-repair-reuse-review-validation.json"), blockedRepairReuseValidation);
const readyContextPath = writeJson(join(smokeRoot, "ready-context.json"), readyContext);
const ragReadyContextPath = writeJson(join(smokeRoot, "rag-ready-context.json"), ragReadyContext);
const correctionContextPath = writeJson(join(smokeRoot, "correction-context.json"), correctionContext);
const forbiddenContextPath = writeJson(join(smokeRoot, "forbidden-context.json"), forbiddenContext);

const ready = run(["--repair-reuse-validation", approvedPath, "--reuse-context", readyContextPath, "--out-dir", join(smokeRoot, "ready")]);
const readyWrapper = readJson(ready.wrapperPath);
const ragReady = run([
  "--repair-reuse-validation",
  ragApprovedPath,
  "--reuse-context",
  ragReadyContextPath,
  "--out-dir",
  join(smokeRoot, "rag-ready")
]);
const ragReadyWrapper = readJson(ragReady.wrapperPath);
const correction = run([
  "--repair-reuse-validation",
  approvedPath,
  "--reuse-context",
  correctionContextPath,
  "--out-dir",
  join(smokeRoot, "correction")
]);
const forbidden = run([
  "--repair-reuse-validation",
  approvedPath,
  "--reuse-context",
  forbiddenContextPath,
  "--out-dir",
  join(smokeRoot, "forbidden")
]);
const blocked = run(["--repair-reuse-validation", blockedPath, "--reuse-context", readyContextPath, "--out-dir", join(smokeRoot, "blocked")]);

const checks = [
  check(
    "Teacher-approved repaired reusable workflow can reuse existing invocation planner",
    ready.format === "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_planner_result_v1" &&
      ready.status === "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning" &&
      ready.invocationReady === true &&
      ready.reusedExistingInvocationPlanner === true &&
      ready.reusedExistingInvocationPlannerStatus === "medium_runtime_reuse_invocation_ready_for_approval_gate_planning" &&
      ready.fingerprintMatched === true &&
      ready.workflowExecuted === false &&
      ready.memoryWritten === false &&
      ready.ruleEnabled === false &&
      readyWrapper.paths.existingInvocationPlan === ready.existingInvocationPlanPath,
    ready.wrapperPath
  ),
  check(
    "Repaired reusable workflow invocation planner preserves provider role-use trace for next approval gate",
    ready.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyWrapper.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyWrapper.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(readyWrapper.sourceEvidence.providerRoleUsePlanTrace)
  ),
  check(
    "Repaired reusable workflow invocation planner preserves reasoning budget trace for next approval gate",
    ready.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyWrapper.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyWrapper.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(readyWrapper.sourceEvidence.reasoningBudgetGovernorReviewTrace)
  ),
  check(
    "RAG-informed approved reuse review can feed the repaired invocation planner without treating RAG as authority",
    ragReady.status === "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning" &&
      ragReady.invocationReady === true &&
      ragReady.reusedExistingInvocationPlanner === true &&
      ragReady.ragInformedRepairReuse === true &&
      ragReady.ragEvidenceTreatedAsAuthority === false &&
      ragReady.ragEvidenceNonAuthoritative === true &&
      ragReady.workflowExecuted === false &&
      ragReady.memoryWritten === false &&
      ragReady.ruleEnabled === false &&
      ragReadyWrapper.sourceEvidence.repairReuseReviewValidationFormat ===
        "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_v1" &&
      ragReadyWrapper.paths.existingInvocationPlan === ragReady.existingInvocationPlanPath,
    ragReady.wrapperPath
  ),
  check(
    "Repaired reusable workflow correction returns to high reasoning repair",
    correction.status === "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair" &&
      correction.escalateToHighReasoningRepair === true &&
      correction.workflowExecuted === false &&
      correction.ruleEnabled === false,
    correction.wrapperPath
  ),
  check(
    "Forbidden repaired reusable workflow invocation decisions are fail-closed",
    forbidden.status === "blocked_for_forbidden_repaired_reusable_workflow_invocation_decision" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.memoryWritten === false &&
      forbidden.ruleEnabled === false &&
      forbidden.goalComplete === false,
    forbidden.wrapperPath
  ),
  check(
    "Unapproved repair reuse review cannot feed the next invocation planner",
    blocked.status === "blocked_before_repaired_reusable_workflow_invocation_planning" &&
      blocked.reusedExistingInvocationPlanner === false &&
      blocked.blockers.includes("repair_reuse_review_not_allowed_for_next_invocation_planning") &&
      blocked.workflowExecuted === false,
    blocked.wrapperPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_planner_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyWrapperPath: ready.wrapperPath,
  ragReadyWrapperPath: ragReady.wrapperPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
