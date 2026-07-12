#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const pluginRoot = resolve(process.cwd(), "plugins", "transparent-ai-apprentice");
const repoPackagePath = resolve(process.cwd(), "package.json");

function read(relativePath) {
  return readFileSync(join(pluginRoot, relativePath), "utf8");
}

function readRepoFile(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

const checks = [];

function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

const laneDefinitions = [
  {
    lane: "reusable_workflow_invocation_cost_control_chain",
    files: [
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromContext", "reasoningBudgetGovernorReviewTrace", "reusable_workflow_invocation_to_high_reasoning_contract_repair"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromPlan", "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromPlan(plan)", "prepRunnerDoesNotInvokeExecutionRunner: true"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromPrep", "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromPrep(prep)", "wrapperDoesNotRunApprovedGate: true"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromBuilder", "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromBuilder(builder)", "oneApprovedGateOnly: true"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromRun", "reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromRun(run)", "receiptBuilderOnly: true"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromRun", "highReasoningRepairHandoff", "reusable_workflow_invocation_to_high_reasoning_contract_repair"]
      }
    ]
  },
  {
    lane: "high_reasoning_repair_cost_control_chain",
    files: [
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromValidation", "mediumRuntimeContinuationBlocked: true", "highest-reasoning TLCL compiler"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromIntake", "reasoningBudgetGovernorReviewTrace.validationHash", "draft_disabled"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromDraft", "regressionValidationHandoff", "approve_repair_for_regression_validation"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromReview", "reasoning_budget_governor_review_trace", "mediumRuntimeRetryAllowed: false"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromValidationPackage", "approvalGateRebuildHandoff", "mediumRuntimeRetryAllowed: false"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromInputs", "reasoningBudgetGovernorReviewTrace", "reusable_workflow_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromRebuild", "reasoningBudgetGovernorReviewTrace", "reusable_workflow_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromBuilder", "reasoningBudgetGovernorReviewTrace", "freshOutcomeReviewRequired: true"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt-builder.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromRepairRun", "reasoningBudgetGovernorReviewTrace", "A matched fresh outcome remains review-only"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromRepairRun", "highReasoningRepairHandoff", "reusable_workflow_repair_invocation_to_high_reasoning_contract_repair"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-candidate-builder.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromValidation", "reusable_workflow_repair_reuse_review_candidate_ready_for_teacher_review", "reasoningBudgetGovernorReviewTrace"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromCandidate", "repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning", "highReasoningRepairHandoff"]
      }
    ]
  },
  {
    lane: "repaired_reusable_invocation_cost_control_chain",
    files: [
      {
        path: "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromValidation", "reasoningBudgetGovernorReviewTrace", "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromWrapper", "reasoningBudgetGovernorReviewTrace", "prepRunnerDoesNotInvokeExecutionRunner: true"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromPrep", "reasoningBudgetGovernorReviewTrace", "repaired_reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromBuilder", "reasoningBudgetGovernorReviewTrace", "freshOutcomeReviewRequired: true"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromRepairedRun", "reasoningBudgetGovernorReviewTrace", "repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromRepairedRun", "highReasoningRepairHandoff", "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-candidate-builder.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromValidation", "repaired_reusable_workflow_invocation_reuse_review_candidate_ready_for_teacher_review", "reasoningBudgetGovernorReviewTrace"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
        tokens: ["reasoningBudgetGovernorReviewTraceFromCandidate", "repaired_reusable_workflow_invocation_reuse_review_allowed_waiting_for_next_invocation_planning", "highReasoningRepairHandoff"]
      }
    ]
  }
];

const laneResults = laneDefinitions.map((lane) => {
  const missing = [];
  const tokenFailures = [];
  for (const file of lane.files) {
    const absolutePath = join(pluginRoot, file.path);
    if (!existsSync(absolutePath)) {
      missing.push(file.path);
      continue;
    }
    const text = read(file.path);
    const missingTokens = file.tokens.filter((token) => !text.includes(token));
    if (missingTokens.length > 0) {
      tokenFailures.push({ file: file.path, missingTokens });
    }
  }
  check(`${lane.lane} preserves reasoning budget trace`, missing.length === 0 && tokenFailures.length === 0, {
    filesChecked: lane.files.length,
    missing,
    tokenFailures
  });
  return {
    lane: lane.lane,
    filesChecked: lane.files.length,
    missing,
    tokenFailures
  };
});

const smokePhraseFiles = [
  {
    path: "scripts/smoke-tlcl-reasoning-budget-medium-reuse-handoff.mjs",
    phrase: "Reasoning budget trace survives reusable workflow approval prep command builder and approved runner"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
    phrase: "Reusable workflow outcome review preserves reasoning budget trace for matched and high-reasoning repair paths"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs",
    phrase: "Reusable workflow repair intake preserves reasoning budget trace for high-reasoning repair"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs",
    phrase: "Reusable workflow repair draft package preserves reasoning budget trace from repair intake"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs",
    phrase: "Reusable workflow repair draft review preserves reasoning budget trace for regression validation handoff"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs",
    phrase: "Reusable workflow repair regression validation preserves reasoning budget trace for fingerprint review"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
    phrase: "Reusable workflow repair fingerprint review preserves reasoning budget trace for approval gate rebuild"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs",
    phrase: "Reusable workflow repair approval gate rebuild preserves reasoning budget trace for repaired command builder"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder.mjs",
    phrase: "Reusable workflow repair approved-gate command builder preserves reasoning budget trace from rebuild package"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs",
    phrase: "Reusable workflow repair approved gate runner preserves reasoning budget trace from command builder"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs",
    phrase: "Repaired reusable workflow fresh outcome preserves reasoning budget trace for reuse review"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
    phrase: "Repair reuse review candidate preserves reasoning budget trace from matched repair outcome"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs",
    phrase: "Repaired reusable workflow invocation planner preserves reasoning budget trace for next approval gate"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
    phrase: "Repaired reusable workflow approval gate prep preserves reasoning budget trace"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs",
    phrase: "Repaired reusable workflow command builder preserves reasoning budget trace from approval prep"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs",
    phrase: "Repaired reusable workflow approved gate runner preserves reasoning budget trace from command builder"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
    phrase: "Repaired invocation fresh outcome preserves reasoning budget trace for reuse review and repair"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
    phrase: "Repaired invocation reuse review candidate preserves reasoning budget trace"
  }
];

const missingSmokePhrases = smokePhraseFiles
  .filter((item) => {
    const absolutePath = join(pluginRoot, item.path);
    return !existsSync(absolutePath) || !read(item.path).includes(item.phrase);
  })
  .map((item) => item.phrase);

check("targeted smokes keep reasoning budget trace assertions visible", missingSmokePhrases.length === 0, {
  phrasesChecked: smokePhraseFiles.length,
  missingSmokePhrases
});

const packageText = readRepoFile("package.json");
check(
  "npm script exposes reasoning budget trace continuity audit",
  existsSync(repoPackagePath) &&
    packageText.includes("smoke:plugin-tlcl-reasoning-budget-trace-continuity-audit") &&
    packageText.includes("smoke-tlcl-reasoning-budget-trace-continuity-audit.mjs"),
  { packagePath: repoPackagePath }
);

const readmeText = read("README.md");
check(
  "README documents reasoning budget trace continuity audit",
  hasAll(readmeText, [
    "smoke:plugin-tlcl-reasoning-budget-trace-continuity-audit",
    "reasoningBudgetGovernorReviewTrace",
    "highest-reasoning compile and medium-runtime reuse split"
  ]),
  { readmePath: join(pluginRoot, "README.md") }
);

const passed = checks.filter((item) => item.passed).length;
const total = checks.length;
const result = {
  status: passed === total ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_reasoning_budget_trace_continuity_audit_smoke_v1",
  passed,
  total,
  lanes: laneResults,
  checks
};

console.log(JSON.stringify(result, null, 2));

if (result.status !== "passed") {
  process.exit(1);
}
