#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tempRoot = join(process.cwd(), ".transparent-apprentice", "smoke", "tlcl-reasoning-budget-medium-reuse-handoff");
mkdirSync(tempRoot, { recursive: true });

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runScript(script, args, expectFailure = false) {
  const result = spawnSync(process.execPath, [join(process.cwd(), "plugins", "transparent-ai-apprentice", "scripts", script), ...args], {
    encoding: "utf8",
    timeout: 120000
  });
  if (!expectFailure && result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  if (expectFailure && result.status === 0) throw new Error(`${script} unexpectedly passed`);
  return JSON.parse(result.stdout);
}

const providerRoleUsePlanTrace = {
  inheritedFromPrep: true,
  requiredForScopedProvider: true,
  accepted: false,
  providerRole: "medium_reasoning_runtime",
  providerRoleUsePlanPath: join(tempRoot, "tlcl-provider-role-use-plan.json"),
  providerRoleUsePlanHash: "sha256:reasoning-budget-medium-reuse-provider-role-use-plan",
  nextGateSatisfied: true
};
const workflowCard = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_card_v1",
  workflowFingerprint: "sha256:reasoning-budget-bounded-workflow",
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
    "teacher-reviewed reasoning budget governor validation",
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
const confirmedGovernorReviewValidation = {
  ok: true,
  format: "transparent_ai_tlcl_reasoning_budget_governor_review_validation_v1",
  validationId: "reasoning-budget-review-validation-smoke",
  status: "reasoning_budget_governor_confirmed_for_next_gate",
  decision: "confirmed_for_next_gate",
  readyForNextGate: true,
  escalateToHighReasoningRepair: false,
  forbiddenDecisionUsed: false,
  blockers: [],
  nextGate: {
    kind: "medium_reasoning_runtime_next_gate",
    recommendedTool: "create_tlcl_medium_runtime_reusable_workflow_invocation_planner"
  },
  locks: {
    doesNotInvokeModel: true,
    doesNotRunMediumRuntime: true,
    doesNotExecuteTargetSoftware: true,
    noMemoryWrite: true,
    noRuleEnablement: true,
    noPackagingUnlock: true
  }
};
const blockedGovernorReviewValidation = {
  ...confirmedGovernorReviewValidation,
  validationId: "reasoning-budget-review-validation-blocked-smoke",
  status: "reasoning_budget_governor_review_needs_teacher_review_or_more_evidence",
  readyForNextGate: false,
  blockers: ["rollback_point_not_retained"],
  nextGate: null
};

const activationPath = writeJson(join(tempRoot, "activation-validation.json"), activationValidation);
const confirmedValidationPath = writeJson(join(tempRoot, "confirmed-governor-review-validation.json"), confirmedGovernorReviewValidation);
const blockedValidationPath = writeJson(join(tempRoot, "blocked-governor-review-validation.json"), blockedGovernorReviewValidation);

const handoff = runScript("create-tlcl-reasoning-budget-medium-reuse-handoff.mjs", [
  "--governor-review-validation",
  confirmedValidationPath,
  "--workflow-fingerprint",
  workflowCard.workflowFingerprint,
  "--out-dir",
  join(tempRoot, "handoff")
]);
const handoffPacket = JSON.parse(readFileSync(handoff.handoffPath, "utf8"));
const reuseContext = JSON.parse(readFileSync(handoff.reuseContextPath, "utf8"));
const invocationPlan = runScript("create-tlcl-medium-runtime-reusable-workflow-invocation-planner.mjs", [
  "--activation-validation",
  activationPath,
  "--reuse-context",
  handoff.reuseContextPath,
  "--out-dir",
  join(tempRoot, "planner")
]);
const invocationPlanPacket = JSON.parse(readFileSync(invocationPlan.planPath, "utf8"));

const runnerPath = join(tempRoot, "teacher-reviewed-reusable-workflow-target.mjs");
writeFileSync(
  runnerPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'reasoning budget bounded reusable workflow' }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);

const reviewedCommandPath = writeJson(join(tempRoot, "reviewed-command-manifest.json"), {
  format: "transparent_ai_reviewed_cli_command_manifest_v1",
  teacherReviewed: true,
  commandKind: "node-script",
  scriptSourceFile: runnerPath,
  expectedScriptSha256: sha256(runnerPath),
  targetOutputFileName: "reasoning-budget-reusable-workflow-controlled-output.json"
});
const adapterReceiptPath = join(tempRoot, "existing-cli-or-script-execution-receipt.json");
const adapterRunnerPath = join(tempRoot, "run-existing-cli-or-script.mjs");
writeFileSync(
  adapterRunnerPath,
  [
    "import { createHash } from 'node:crypto';",
    "import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';",
    "import { dirname, join } from 'node:path';",
    "import { spawnSync } from 'node:child_process';",
    `const receiptPath = ${JSON.stringify(adapterReceiptPath)};`,
    "function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] || '' : ''; }",
    "function hasFlag(name) { return process.argv.includes(name); }",
    "function sha256(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }",
    "const reviewedCommand = argValue('--reviewed-command');",
    "const execute = hasFlag('--execute');",
    "const teacherConfirmed = hasFlag('--teacher-confirmed');",
    "const receipt = { format: 'transparent_ai_existing_software_execution_receipt_v1', adapterId: 'existing-cli-or-script', mode: 'dry_run', teacherConfirmed, execute, commandExecuted: false, reviewedCommandPath: reviewedCommand, cliOutputPath: '', status: 'dry_run_no_command_executed', locks: { accepted: false, ruleEnabled: false, packagingGated: true, nativeUniversalExecution: false } };",
    "if (teacherConfirmed && execute) {",
    "  try {",
    "    const command = JSON.parse(readFileSync(reviewedCommand, 'utf8').replace(/^\\uFEFF/, ''));",
    "    if (command.teacherReviewed !== true) throw new Error('command_teacherReviewed_must_be_true');",
    "    if (command.commandKind !== 'node-script') throw new Error('only_node_script_commandKind_supported');",
    "    if (!command.scriptSourceFile || !existsSync(command.scriptSourceFile)) throw new Error('script_source_missing');",
    "    const scriptHash = sha256(command.scriptSourceFile);",
    "    if (scriptHash !== String(command.expectedScriptSha256).toLowerCase()) throw new Error('expected_script_sha256_mismatch');",
    "    const outputDir = join(dirname(receiptPath), 'cli-output');",
    "    mkdirSync(outputDir, { recursive: true });",
    "    const outputPath = join(outputDir, command.targetOutputFileName);",
    "    const run = spawnSync(process.execPath, [command.scriptSourceFile, outputPath], { encoding: 'utf8', timeout: 60000 });",
    "    if (run.status !== 0) throw new Error(`reviewed_node_script_failed_exit_${run.status}`);",
    "    receipt.commandExecuted = true;",
    "    receipt.cliOutputPath = outputPath;",
    "    receipt.status = 'teacher_confirmed_cli_script_executed';",
    "    receipt.mode = 'teacher_confirmed_execute';",
    "    receipt.outputSha256 = sha256(outputPath);",
    "  } catch (error) {",
    "    receipt.status = `blocked_reviewed_command_invalid:${error.message}`;",
    "  }",
    "}",
    "writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\\n', 'utf8');",
    "console.log(JSON.stringify(receipt, null, 2));"
  ].join("\n"),
  "utf8"
);
const adapterPackagePath = writeJson(join(tempRoot, "adapter-package.json"), {
  format: "transparent_ai_execution_adapter_package_v1",
  runnerEntries: [
    {
      adapterId: "existing-cli-or-script",
      runnerPath: adapterRunnerPath,
      receiptPath: adapterReceiptPath
    }
  ]
});
const actionPlanPath = writeJson(join(tempRoot, "action-plan.json"), {
  format: "transparent_ai_execution_action_plan_v1",
  teacherReviewed: true,
  routeMode: "existing-cli-or-script"
});
const queuePath = writeJson(join(tempRoot, "execution-pilot-queue.json"), {
  format: "transparent_ai_all_software_execution_pilot_queue_v1",
  pilots: [
    {
      pilotId: "reasoning-budget-medium-reuse-cli-pilot-001",
      software: "Reasoning budget medium reuse smoke reviewed CLI software",
      routeMode: "existing-cli-or-script",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      status: "dry_run_runner_ready_for_teacher_review"
    }
  ]
});
const selectorPath = writeJson(join(tempRoot, "real-local-execution-pilot-selector.json"), {
  ok: true,
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  selectorId: "reasoning-budget-medium-reuse-selector",
  sourceEvidence: {
    executionPilotQueuePath: queuePath
  },
  numberedCandidates: [
    {
      number: 1,
      pilotId: "reasoning-budget-medium-reuse-cli-pilot-001",
      software: "Reasoning budget medium reuse smoke reviewed CLI software",
      routeMode: "existing-cli-or-script",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      score: 200
    }
  ],
  selectedCandidate: {
    number: 1,
    pilotId: "reasoning-budget-medium-reuse-cli-pilot-001",
    software: "Reasoning budget medium reuse smoke reviewed CLI software",
    routeMode: "existing-cli-or-script",
    primaryAdapterId: "existing-cli-or-script",
    adapterPackagePath,
    actionPlanPath,
    score: 200
  },
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  }
});
const approvalPrep = runScript("run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs", [
  "--plan",
  invocationPlan.planPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "reasoning-budget-medium-reuse-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow invocation approval gate",
  "--rollback-point-created",
  "--output-dir",
  join(tempRoot, "approval-prep")
]);
const approvalPrepPacket = JSON.parse(readFileSync(approvalPrep.packetPath, "utf8"));
const commandBuilder = runScript("create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs", [
  "--prep",
  approvalPrep.packetPath,
  "--out-dir",
  join(tempRoot, "command-builder")
]);
const commandBuilderPacket = JSON.parse(readFileSync(commandBuilder.wrapperPath, "utf8"));
const approvedRunner = runScript("run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs", [
  "--builder",
  commandBuilder.wrapperPath,
  "--execute-approved-gate",
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow approved gate runner",
  "--rollback-point-created",
  "--output-dir",
  join(tempRoot, "approved-runner")
]);
const approvedRunnerPacket = JSON.parse(readFileSync(approvedRunner.packetPath, "utf8"));
const blockedHandoff = runScript("create-tlcl-reasoning-budget-medium-reuse-handoff.mjs", [
  "--governor-review-validation",
  blockedValidationPath,
  "--workflow-fingerprint",
  workflowCard.workflowFingerprint,
  "--out-dir",
  join(tempRoot, "blocked-handoff")
]);

const checks = [
  {
    name: "Confirmed reasoning budget review becomes a medium reuse context",
    pass:
      handoff.format === "transparent_ai_tlcl_reasoning_budget_medium_reuse_handoff_result_v1" &&
      handoff.status === "reasoning_budget_medium_reuse_context_ready_for_invocation_planner" &&
      handoff.readyForMediumReusePlanner === true &&
      reuseContext.format === "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_context_v1" &&
      reuseContext.teacherDecision === "invoke_medium_runtime_reuse"
  },
  {
    name: "Medium reuse handoff preserves governor validation hash and no-op locks",
    pass:
      handoffPacket.governorReviewTrace.validationId === confirmedGovernorReviewValidation.validationId &&
      reuseContext.reasoningBudgetGovernorReviewTrace.validationHash === handoffPacket.governorReviewTrace.validationHash &&
      handoff.modelInvoked === false &&
      handoff.mediumRuntimeInvoked === false &&
      handoff.workflowExecuted === false &&
      handoff.targetSoftwareCommandsExecuted === false &&
      handoff.memoryWritten === false &&
      handoff.ruleEnabled === false &&
      handoff.goalComplete === false,
    evidence: handoff.handoffPath
  },
  {
    name: "Planner carries reasoning budget trace into the bounded invocation plan",
    pass:
      invocationPlan.status === "medium_runtime_reuse_invocation_ready_for_approval_gate_planning" &&
      invocationPlan.invocationReady === true &&
      invocationPlanPacket.reuseInvocationHandoff.reasoningBudgetGovernorReviewTrace.validationHash ===
        reuseContext.reasoningBudgetGovernorReviewTrace.validationHash &&
      invocationPlanPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace.validationId ===
        confirmedGovernorReviewValidation.validationId &&
      invocationPlan.workflowExecuted === false &&
      invocationPlan.targetSoftwareCommandsExecuted === false
  },
  {
    name: "Reasoning budget trace survives reusable workflow approval prep command builder and approved runner",
    pass:
      approvalPrep.status === "reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review" &&
      commandBuilder.status ===
        "reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation" &&
      approvedRunner.status === "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review" &&
      approvalPrepPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace.validationHash ===
        reuseContext.reasoningBudgetGovernorReviewTrace.validationHash &&
      commandBuilderPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace.validationHash ===
        reuseContext.reasoningBudgetGovernorReviewTrace.validationHash &&
      approvedRunnerPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace.validationHash ===
        reuseContext.reasoningBudgetGovernorReviewTrace.validationHash &&
      approvedRunner.runnerInvoked === true &&
      approvedRunner.controlledRouteActionExecuted === true &&
      existsSync(approvedRunner.adapterReceiptPath || "") &&
      approvedRunnerPacket.locks.memoryWritten === false &&
      approvedRunnerPacket.locks.ruleEnabled === false &&
      approvedRunnerPacket.locks.packagingGated === true &&
      approvedRunnerPacket.locks.goalComplete === false,
    evidence: approvedRunner.packetPath
  },
  {
    name: "Unconfirmed governor review validation blocks before medium reuse context",
    pass:
      blockedHandoff.status === "blocked_before_reasoning_budget_medium_reuse_context" &&
      blockedHandoff.readyForMediumReusePlanner === false &&
      blockedHandoff.blockers.includes("governor_review_validation_not_confirmed_for_next_gate") &&
      blockedHandoff.mediumRuntimeInvoked === false &&
      blockedHandoff.workflowExecuted === false
  }
];
const failed = checks.filter((check) => !check.pass);
console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      smoke: "transparent_ai_tlcl_reasoning_budget_medium_reuse_handoff_smoke_v1",
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
