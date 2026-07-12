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
    lane: "medium_runtime_dry_run_chain",
    files: [
      {
        path: "scripts/create-tlcl-medium-runtime-dry-run-prep.mjs",
        tokens: ["providerRoleUsePlanAccepted", "providerRoleUsePlanHash", "provider_role_use_plan_not_accepted_by_runtime_gate"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-dry-run-route-review-handoff.mjs",
        tokens: ["providerRoleUsePlanTrace", "providerRoleUsePlanHash", "executesNow: false"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-dry-run-route-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "providerRoleUsePlanHash", "run_dry_run_only_runner_from_validation"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-dry-run-only-runner.mjs",
        tokens: ["providerRoleUsePlanTrace", "providerRoleUsePlanHash", "doesNotInvokeAdapter: true"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-dry-run-only-post-run-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "executionApprovalGateCreated: false", "ready_for_execution_approval_gate_planning"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-execution-approval-gate-prep-runner.mjs",
        tokens: ["providerRoleUsePlanTrace", "prepRunnerDoesNotInvokeExecutionRunner: true", "create-real-local-execution-approval-gate.mjs"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-approved-gate-command-builder.mjs",
        tokens: ["providerRoleUsePlanTrace", "wrapperDoesNotRunApprovedGate: true", "create-all-software-execution-approved-gate-command-builder.mjs"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-approved-gate-runner.mjs",
        tokens: ["providerRoleUsePlanTrace", "oneApprovedGateOnly: true", "run-all-software-execution-approved-gate-runner.mjs"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "highReasoningRepairHandoff", "correction_to_high_reasoning_repair"]
      }
    ]
  },
  {
    lane: "reusable_workflow_chain",
    files: [
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-candidate-builder.mjs",
        tokens: ["providerRoleUsePlanTrace", "doesNotEnableWorkflow: true", "transparent_ai_tlcl_medium_runtime_reusable_workflow_candidate_v1"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-activation-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "mediumRuntimeWorkflowEnabled: true", "highReasoningRepairHandoff"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs",
        tokens: ["providerRoleUsePlanTrace", "doesNotRunWorkflow: true", "reusable_workflow_invocation_to_high_reasoning_contract_repair"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        tokens: ["providerRoleUsePlanTrace", "prepRunnerDoesNotInvokeExecutionRunner: true", "create-real-local-execution-approval-gate.mjs"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs",
        tokens: ["providerRoleUsePlanTrace", "wrapperDoesNotRunApprovedGate: true", "create-all-software-execution-approved-gate-command-builder.mjs"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs",
        tokens: ["providerRoleUsePlanTrace", "oneApprovedGateOnly: true", "run-all-software-execution-approved-gate-runner.mjs"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "highReasoningRepairHandoff", "reusable_workflow_invocation_to_high_reasoning_contract_repair"]
      }
    ]
  },
  {
    lane: "high_reasoning_repair_reuse_chain",
    files: [
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs",
        tokens: ["providerRoleUsePlanTrace", "highest-reasoning TLCL compiler", "mediumRuntimeContinuationBlocked: true"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs",
        tokens: ["providerRoleUsePlanTrace", "draft_disabled", "compile-rule-package.mjs"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "highReasoningRepairHandoff", "approve_repair_for_regression_validation"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-regression-validation-package.mjs",
        tokens: ["providerRoleUsePlanTrace", "mediumRuntimeRetryAllowed: false", "draft_disabled"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "highReasoningRepairHandoff", "approval_gate_rebuild"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs",
        tokens: ["providerRoleUsePlanTrace", "reusable_workflow_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review", "run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-command-builder.mjs",
        tokens: ["providerRoleUsePlanTrace", "reusable_workflow_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation", "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-runner.mjs",
        tokens: ["providerRoleUsePlanTrace", "reusable_workflow_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review", "run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "highReasoningRepairHandoff", "reusable_workflow_repair_invocation_to_high_reasoning_contract_repair"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-candidate-builder.mjs",
        tokens: ["providerRoleUsePlanTrace", "reusable_workflow_repair_reuse_review_candidate_ready_for_teacher_review", "create-tlcl-medium-runtime-reusable-workflow-candidate-builder.mjs"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "highReasoningRepairHandoff", "repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning"]
      }
    ]
  },
  {
    lane: "repaired_reusable_invocation_chain",
    files: [
      {
        path: "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs",
        tokens: ["providerRoleUsePlanTrace", "isRagInformedRepairReuse", "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
        tokens: ["providerRoleUsePlanTrace", "supportsRagInformedRepairReuseInvocation", "run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs",
        tokens: ["providerRoleUsePlanTrace", "supportsRagInformedRepairReuseInvocation", "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs"]
      },
      {
        path: "scripts/run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs",
        tokens: ["providerRoleUsePlanTrace", "supportsRagInformedRepairReuseInvocation", "run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs",
        tokens: ["providerRoleUsePlanTrace", "supportsRagInformedRepairReuseInvocation", "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_v1"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "highReasoningRepairHandoff", "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair"]
      },
      {
        path: "scripts/create-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-candidate-builder.mjs",
        tokens: ["providerRoleUsePlanTrace", "repaired_reusable_workflow_invocation_reuse_review_candidate_ready_for_teacher_review", "ragEvidenceNonAuthoritativeConfirmed"]
      },
      {
        path: "scripts/validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
        tokens: ["providerRoleUsePlanTrace", "highReasoningRepairHandoff", "repaired_reusable_workflow_invocation_reuse_review_allowed_waiting_for_next_invocation_planning"]
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
  check(`${lane.lane} preserves provider role-use trace`, missing.length === 0 && tokenFailures.length === 0, {
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
    path: "scripts/smoke-tlcl-medium-runtime-dry-run-only-runner.mjs",
    phrase: "TLCL dry-run-only runner preserves provider role-use trace from prep through route review"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-execution-approval-gate-prep-runner.mjs",
    phrase: "TLCL approval gate prep preserves provider role-use trace from post-run validation"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs",
    phrase: "Approved outcome review preserves provider role-use trace for reuse or high-reasoning repair"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-activation.mjs",
    phrase: "Reusable workflow card preserves provider role-use trace from approved medium-runtime outcome"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs",
    phrase: "Reusable workflow invocation planner preserves provider role-use trace from workflow card"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
    phrase: "Reusable workflow approval gate prep preserves provider role-use trace from invocation plan"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs",
    phrase: "Reusable workflow command builder preserves provider role-use trace from approval prep"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs",
    phrase: "Reusable workflow approved gate runner preserves provider role-use trace from command builder"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
    phrase: "Reusable workflow outcome review preserves provider role-use trace for matched or repair paths"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs",
    phrase: "Reusable workflow repair approval gate rebuild preserves provider role-use trace for repaired command builder"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
    phrase: "Repair reuse review candidate preserves provider role-use trace from matched repair outcome"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-planner.mjs",
    phrase: "Repaired reusable workflow invocation planner preserves provider role-use trace for next approval gate"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs",
    phrase: "Repaired reusable workflow approval gate prep preserves provider role-use trace"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-command-builder.mjs",
    phrase: "Repaired reusable workflow command builder preserves provider role-use trace from approval prep"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-runner.mjs",
    phrase: "Repaired reusable workflow approved gate runner preserves provider role-use trace from command builder"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
    phrase: "Repaired reusable workflow fresh outcome preserves provider role-use trace for reuse review and repair"
  },
  {
    path: "scripts/smoke-tlcl-medium-runtime-repaired-reusable-workflow-invocation-reuse-review-receipt.mjs",
    phrase: "Repaired invocation reuse review candidate preserves provider role-use trace"
  }
];

const missingSmokePhrases = smokePhraseFiles
  .filter((item) => {
    const absolutePath = join(pluginRoot, item.path);
    return !existsSync(absolutePath) || !read(item.path).includes(item.phrase);
  })
  .map((item) => item.phrase);

check("targeted smokes keep provider trace assertions visible", missingSmokePhrases.length === 0, {
  phrasesChecked: smokePhraseFiles.length,
  missingSmokePhrases
});

const packageText = readRepoFile("package.json");
check(
  "npm script exposes provider trace continuity audit",
  existsSync(repoPackagePath) &&
    packageText.includes("smoke:plugin-tlcl-provider-role-use-trace-continuity-audit") &&
    packageText.includes("smoke-tlcl-provider-role-use-trace-continuity-audit.mjs"),
  { packagePath: repoPackagePath }
);

const readmeText = read("README.md");
check(
  "README documents provider trace continuity audit",
  hasAll(readmeText, [
    "smoke:plugin-tlcl-provider-role-use-trace-continuity-audit",
    "providerRoleUsePlanTrace",
    "high-reasoning-to-medium-runtime role split"
  ]),
  { readmePath: join(pluginRoot, "README.md") }
);

const passed = checks.filter((item) => item.passed).length;
const total = checks.length;
const result = {
  status: passed === total ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_provider_role_use_trace_continuity_audit_smoke_v1",
  passed,
  total,
  lanes: laneResults,
  checks
};

console.log(JSON.stringify(result, null, 2));

if (result.status !== "passed") {
  process.exit(1);
}
