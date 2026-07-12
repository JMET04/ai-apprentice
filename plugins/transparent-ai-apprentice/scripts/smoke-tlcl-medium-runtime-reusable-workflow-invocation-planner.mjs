#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tempRoot = join(process.cwd(), ".transparent-apprentice", "smoke", "tlcl-medium-runtime-reusable-workflow-invocation-planner");
mkdirSync(tempRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function run(args) {
  const result = spawnSync(
    process.execPath,
    [join(process.cwd(), "plugins", "transparent-ai-apprentice", "scripts", "create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs"), ...args],
    { encoding: "utf8", timeout: 120000 }
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "invocation planner failed");
  return JSON.parse(result.stdout);
}

const providerRoleUsePlanTrace = {
  inheritedFromPrep: true,
  requiredForScopedProvider: true,
  accepted: false,
  providerRole: "medium_reasoning_runtime",
  providerRoleUsePlanPath: join(tempRoot, "tlcl-provider-role-use-plan.json"),
  providerRoleUsePlanHash: "sha256:reusable-invocation-provider-role-use-plan-smoke",
  nextGateSatisfied: true
};

const workflowCard = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_card_v1",
  workflowFingerprint: "sha256:bounded-workflow",
  runtimeTier: "medium_reasoning_runtime",
  providerRoleUsePlanTrace,
  mediumRuntimeWorkflowEnabled: true,
  boundedReuseScope: {
    sourceRunId: "run-1",
    providerRoleUsePlanTrace,
    allowedOnlyWhenWorkflowFingerprintMatches: true
  },
  requiredBeforeEveryRun: [
    "same TLCL contract and route fingerprint",
    "deterministic validators still pass",
    "teacher-reviewed approval gate is ready",
    "rollback point is retained",
    "post-run outcome review is created again"
  ],
  executionStillRequiresApprovalGate: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  memoryWriteAllowed: false,
  ruleEnablementAllowed: false,
  packagingUnlockAllowed: false,
  completionClaimAllowed: false
};
const activationValidation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_validation_v1",
  status: "medium_runtime_workflow_reuse_allowed_for_bounded_contract",
  mediumRuntimeWorkflowEnabled: true,
  reusableWorkflowCard: workflowCard,
  locks: {
    doesNotRunWorkflow: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    goalComplete: false
  }
};
const readyContext = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_context_v1",
  workflowFingerprint: "sha256:bounded-workflow",
  deterministicValidatorsPassed: true,
  approvalGateStillRequiredConfirmed: true,
  rollbackPointRetained: true,
  teacherReviewedReuseIntent: true,
  freshOutcomeReviewPlanned: true
};
const mismatchContext = {
  ...readyContext,
  workflowFingerprint: "sha256:different-workflow",
  observedIssue: "New request does not match the activated route fingerprint."
};
const correctionContext = {
  ...readyContext,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherCorrection: "The reusable workflow missed a dimension rule."
};
const forbiddenContext = {
  ...readyContext,
  teacherDecision: "enable_rule"
};

const activationPath = writeJson(join(tempRoot, "activation-validation.json"), activationValidation);
const readyContextPath = writeJson(join(tempRoot, "ready-context.json"), readyContext);
const mismatchContextPath = writeJson(join(tempRoot, "mismatch-context.json"), mismatchContext);
const correctionContextPath = writeJson(join(tempRoot, "correction-context.json"), correctionContext);
const forbiddenContextPath = writeJson(join(tempRoot, "forbidden-context.json"), forbiddenContext);

const ready = run(["--activation-validation", activationPath, "--reuse-context", readyContextPath, "--out-dir", join(tempRoot, "ready")]);
const readyPlan = JSON.parse(readFileSync(ready.planPath, "utf8"));
const mismatch = run(["--activation-validation", activationPath, "--reuse-context", mismatchContextPath, "--out-dir", join(tempRoot, "mismatch")]);
const correction = run(["--activation-validation", activationPath, "--reuse-context", correctionContextPath, "--out-dir", join(tempRoot, "correction")]);
const forbidden = run(["--activation-validation", activationPath, "--reuse-context", forbiddenContextPath, "--out-dir", join(tempRoot, "forbidden")]);

const checks = [
  {
    name: "Activated TLCL reusable workflow can plan one bounded medium-runtime invocation",
    pass:
      ready.format === "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_planner_result_v1" &&
      ready.status === "medium_runtime_reuse_invocation_ready_for_approval_gate_planning" &&
      ready.invocationReady === true &&
      ready.fingerprintMatched === true &&
      ready.workflowExecuted === false &&
      ready.approvedGateRunnerInvoked === false &&
      ready.targetSoftwareCommandsExecuted === false &&
      ready.memoryWritten === false &&
      ready.ruleEnabled === false &&
      ready.goalComplete === false &&
      readyPlan.reuseInvocationHandoff?.kind === "medium_runtime_reusable_workflow_invocation_handoff"
  },
  {
    name: "Reusable workflow invocation planner preserves provider role-use trace from workflow card",
    pass:
      readyPlan.reuseInvocationHandoff.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPlan.sourceEvidence.providerRoleUsePlanTrace.providerRole === "medium_reasoning_runtime" &&
      readyPlan.highReasoningRepairHandoff === null,
    evidence: ready.planPath
  },
  {
    name: "Reusable workflow fingerprint mismatch escalates to high reasoning repair",
    pass:
      mismatch.status === "escalate_to_high_reasoning_contract_repair" &&
      mismatch.escalateToHighReasoningRepair === true &&
      mismatch.fingerprintMatched === false &&
      mismatch.blockers.includes("workflow_fingerprint_mismatch_requires_high_reasoning_repair") &&
      mismatch.workflowExecuted === false
  },
  {
    name: "Reusable workflow teacher correction escalates to high reasoning repair",
    pass:
      correction.status === "escalate_to_high_reasoning_contract_repair" &&
      correction.escalateToHighReasoningRepair === true &&
      correction.workflowExecuted === false &&
      correction.ruleEnabled === false
  },
  {
    name: "Forbidden reusable workflow invocation decisions are fail-closed",
    pass:
      forbidden.status === "blocked_for_forbidden_decision" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.blockers.includes("forbidden_teacher_decision") &&
      forbidden.memoryWritten === false &&
      forbidden.ruleEnabled === false &&
      forbidden.goalComplete === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_planner_smoke_v1",
      status: failed.length === 0 ? "passed" : "failed",
      passed: checks.length - failed.length,
      total: checks.length,
      checks
    },
    null,
    2
  )
);
if (failed.length) process.exit(1);
