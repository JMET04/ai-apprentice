#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-repaired-reusable-workflow-invocation-approval-gate-prep-runner-smoke",
  String(Date.now())
);
mkdirSync(smokeRoot, { recursive: true });

function runNode(scriptName, args) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const runnerPath = join(smokeRoot, "teacher-reviewed-repaired-reusable-workflow-target.mjs");
writeFileSync(
  runnerPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'tlcl repaired reusable workflow reviewed command' }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);

const reviewedCommandPath = writeJson(join(smokeRoot, "reviewed-command-manifest.json"), {
  format: "transparent_ai_reviewed_cli_command_manifest_v1",
  teacherReviewed: true,
  commandKind: "node-script",
  scriptSourceFile: runnerPath,
  expectedScriptSha256: sha256(runnerPath),
  targetOutputFileName: "tlcl-repaired-reusable-workflow-controlled-output.json"
});

const adapterReceiptPath = join(smokeRoot, "existing-cli-or-script-execution-receipt.json");
const adapterRunnerPath = join(smokeRoot, "run-existing-cli-or-script.mjs");
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

const adapterPackagePath = writeJson(join(smokeRoot, "adapter-package.json"), {
  format: "transparent_ai_execution_adapter_package_v1",
  runnerEntries: [
    {
      adapterId: "existing-cli-or-script",
      runnerPath: adapterRunnerPath,
      receiptPath: adapterReceiptPath
    }
  ]
});
const actionPlanPath = writeJson(join(smokeRoot, "action-plan.json"), {
  format: "transparent_ai_execution_action_plan_v1",
  teacherReviewed: true,
  routeMode: "existing-cli-or-script"
});
const queuePath = writeJson(join(smokeRoot, "execution-pilot-queue.json"), {
  format: "transparent_ai_all_software_execution_pilot_queue_v1",
  pilots: [
    {
      pilotId: "tlcl-repaired-reuse-smoke-cli-pilot-001",
      software: "TLCL repaired reusable workflow smoke reviewed CLI software",
      routeMode: "existing-cli-or-script",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      status: "dry_run_runner_ready_for_teacher_review"
    }
  ]
});
const selectorPath = writeJson(join(smokeRoot, "real-local-execution-pilot-selector.json"), {
  ok: true,
  format: "transparent_ai_real_local_execution_pilot_selector_v1",
  selectorId: "tlcl-repaired-reuse-smoke-selector",
  sourceEvidence: {
    executionPilotQueuePath: queuePath
  },
  numberedCandidates: [
    {
      number: 1,
      pilotId: "tlcl-repaired-reuse-smoke-cli-pilot-001",
      software: "TLCL repaired reusable workflow smoke reviewed CLI software",
      routeMode: "existing-cli-or-script",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      score: 200
    }
  ],
  selectedCandidate: {
    number: 1,
    pilotId: "tlcl-repaired-reuse-smoke-cli-pilot-001",
    software: "TLCL repaired reusable workflow smoke reviewed CLI software",
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

const providerRoleUsePlanTrace = {
  providerRoleUsePlanHash: "sha256:repaired-invocation-approval-prep-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repaired-invocation-reasoning-budget-governor-smoke",
  highReasoningCompileRequiredForLogicChanges: true,
  mediumReasoningRuntimeAllowedAfterTeacherApproval: true,
  correctionReturnsToHighReasoningRepair: true
};
const existingInvocationPlanPath = writeJson(join(smokeRoot, "ready-reusable-workflow-invocation-plan.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_plan_v1",
  invocationId: "ready-reusable-workflow-invocation",
  status: "medium_runtime_reuse_invocation_ready_for_approval_gate_planning",
  decision: "invoke_medium_runtime_reuse",
  runtimeTier: "medium_reasoning_runtime",
  expectedWorkflowFingerprint: "sha256:tlcl-repaired-reuse-smoke",
  observedWorkflowFingerprint: "sha256:tlcl-repaired-reuse-smoke",
  fingerprintMatched: true,
  invocationReady: true,
  mediumRuntimeWorkflowEnabled: true,
  approvalGateStillRequired: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  deterministicValidatorsPassed: true,
  teacherReviewedReuseIntent: true,
  freshOutcomeReviewPlanned: true,
  forbiddenDecisionUsed: false,
  blockers: [],
  reuseInvocationHandoff: {
    kind: "medium_runtime_reusable_workflow_invocation_handoff",
    runtimeTier: "medium_reasoning_runtime",
    workflowFingerprint: "sha256:tlcl-repaired-reuse-smoke",
    nextRequiredGate: "teacher_reviewed_execution_approval_gate",
    executesNow: false,
    approvedGateRunnerInvoked: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  },
  locks: {
    reviewOnly: true,
    doesNotRunWorkflow: true,
    doesNotExecuteTargetSoftware: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const readyWrapperPath = writeJson(join(smokeRoot, "ready-repaired-reusable-workflow-invocation-wrapper.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_plan_v1",
  invocationId: "ready-repaired-reusable-workflow-invocation",
  status: "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning",
  invocationReady: true,
  repairedReusableWorkflowInvocation: true,
  reusedExistingInvocationPlanner: true,
  reusedExistingInvocationPlannerStatus: "medium_runtime_reuse_invocation_ready_for_approval_gate_planning",
  existingInvocationPlanPath,
  fingerprintMatched: true,
  mediumRuntimeWorkflowEnabled: true,
  approvalGateStillRequired: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  forbiddenDecisionUsed: false,
  blockers: [],
  sourceEvidence: {
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  locks: {
    reviewOnly: true,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const ragReadyWrapperPath = writeJson(join(smokeRoot, "rag-ready-repaired-reusable-workflow-invocation-wrapper.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_plan_v1",
  invocationId: "rag-ready-repaired-reusable-workflow-invocation",
  status: "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning",
  invocationReady: true,
  repairedReusableWorkflowInvocation: true,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  reusedExistingInvocationPlanner: true,
  reusedExistingInvocationPlannerStatus: "medium_runtime_reuse_invocation_ready_for_approval_gate_planning",
  existingInvocationPlanPath,
  fingerprintMatched: true,
  mediumRuntimeWorkflowEnabled: true,
  approvalGateStillRequired: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  forbiddenDecisionUsed: false,
  blockers: [],
  sourceEvidence: {
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  locks: {
    reviewOnly: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const ragAuthorityWrapperPath = writeJson(join(smokeRoot, "rag-authority-repaired-reusable-workflow-invocation-wrapper.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_plan_v1",
  invocationId: "rag-authority-repaired-reusable-workflow-invocation",
  status: "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning",
  invocationReady: true,
  repairedReusableWorkflowInvocation: true,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: true,
  ragEvidenceNonAuthoritative: true,
  reusedExistingInvocationPlanner: true,
  reusedExistingInvocationPlannerStatus: "medium_runtime_reuse_invocation_ready_for_approval_gate_planning",
  existingInvocationPlanPath,
  fingerprintMatched: true,
  mediumRuntimeWorkflowEnabled: true,
  approvalGateStillRequired: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  forbiddenDecisionUsed: false,
  blockers: [],
  sourceEvidence: {
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  locks: {
    reviewOnly: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const blockedWrapperPath = writeJson(join(smokeRoot, "blocked-repaired-reusable-workflow-invocation-wrapper.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_plan_v1",
  invocationId: "blocked-repaired-reusable-workflow-invocation",
  status: "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair",
  invocationReady: false,
  repairedReusableWorkflowInvocation: true,
  reusedExistingInvocationPlanner: true,
  reusedExistingInvocationPlannerStatus: "escalate_to_high_reasoning_contract_repair",
  existingInvocationPlanPath,
  fingerprintMatched: false,
  mediumRuntimeWorkflowEnabled: true,
  approvalGateStillRequired: true,
  rollbackStillRequired: true,
  outcomeReviewStillRequired: true,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  forbiddenDecisionUsed: false,
  blockers: ["teacher_correction_requires_high_reasoning_repair"],
  sourceEvidence: {
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  locks: {
    reviewOnly: true,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});

const ready = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs", [
  "--repaired-invocation-plan",
  readyWrapperPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "tlcl-repaired-reuse-smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow invocation approval gate",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "ready")
]);
const readyPacket = readJson(ready.packetPath);
const readyReceipt = readJson(ready.receiptPath);
const readyGatePacket = readJson(ready.approvalGatePath);

const ragReady = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs", [
  "--repaired-invocation-plan",
  ragReadyWrapperPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "tlcl-repaired-reuse-smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow invocation approval gate",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "rag-ready")
]);
const ragReadyPacket = readJson(ragReady.packetPath);
const ragReadyReceipt = readJson(ragReady.receiptPath);

const ragAuthority = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs", [
  "--repaired-invocation-plan",
  ragAuthorityWrapperPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "tlcl-repaired-reuse-smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow invocation approval gate",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "rag-authority")
]);
const ragAuthorityPacket = readJson(ragAuthority.packetPath);

const blocked = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs", [
  "--repaired-invocation-plan",
  blockedWrapperPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "tlcl-repaired-reuse-smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--reviewed-command",
  reviewedCommandPath,
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow invocation approval gate",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "blocked")
]);
const blockedPacket = readJson(blocked.packetPath);

const missingRoute = runNode("run-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.mjs", [
  "--repaired-invocation-plan",
  readyWrapperPath,
  "--selector",
  selectorPath,
  "--queue",
  queuePath,
  "--selected-pilot-id",
  "tlcl-repaired-reuse-smoke-cli-pilot-001",
  "--adapter-id",
  "existing-cli-or-script",
  "--teacher-confirmation",
  "teacher confirmed tlcl reusable workflow invocation approval gate",
  "--rollback-point-created",
  "--output-dir",
  join(smokeRoot, "missing-route")
]);
const missingRoutePacket = readJson(missingRoute.packetPath);

const checks = [
  {
    name: "Ready repaired reusable workflow invocation prepares an approval gate without executing the runner",
    pass:
      ready.format ===
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner_result_v1" &&
      ready.status ===
        "repaired_reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review" &&
      ready.reusedExistingApprovalGatePrepRunner === true &&
      ready.readyForExecuteRequest === true &&
      existsSync(ready.approvalGatePath) &&
      readyGatePacket.generatedRunnerRequest?.args?.includes("--execute") &&
      readyReceipt.prepRunnerDoesNotInvokeExecutionRunner === true &&
      readyReceipt.targetSoftwareCommandsExecuted === false &&
      readyReceipt.uiEventsSent === false,
    evidence: ready.approvalGatePath
  },
  {
    name: "Repaired reusable workflow approval gate prep preserves provider role-use trace",
    pass:
      ready.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPacket.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPacket.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyReceipt.providerRoleUsePlanTrace?.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash,
    evidence: JSON.stringify(readyPacket.sourceEvidence.providerRoleUsePlanTrace)
  },
  {
    name: "Repaired reusable workflow approval gate prep preserves reasoning budget trace",
    pass:
      ready.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyPacket.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash &&
      readyReceipt.reasoningBudgetGovernorReviewTrace?.validationHash === reasoningBudgetGovernorReviewTrace.validationHash,
    evidence: JSON.stringify(readyPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace)
  },
  {
    name: "RAG-informed repaired reusable workflow invocation preserves non-authority locks during approval prep",
    pass:
      ragReady.status ===
        "repaired_reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review" &&
      ragReady.readyForExecuteRequest === true &&
      ragReady.ragInformedRepairReuse === true &&
      ragReady.ragEvidenceTreatedAsAuthority === false &&
      ragReady.ragEvidenceNonAuthoritative === true &&
      ragReadyPacket.ragInformedRepairReuse === true &&
      ragReadyPacket.locks.ragEvidenceNonAuthoritative === true &&
      ragReadyPacket.locks.doesNotTreatRagAsAuthority === true &&
      ragReadyReceipt.ragEvidenceTreatedAsAuthority === false &&
      ragReadyReceipt.targetSoftwareCommandsExecuted === false,
    evidence: ragReady.packetPath
  },
  {
    name: "Treating RAG as authority blocks repaired invocation approval gate prep",
    pass:
      ragAuthority.status === "blocked_before_repaired_reusable_workflow_invocation_approval_gate" &&
      ragAuthority.reusedExistingApprovalGatePrepRunner === false &&
      ragAuthorityPacket.blockers.includes("rag_informed_invocation_treats_rag_as_authority") &&
      ragAuthorityPacket.targetSoftwareCommandsExecuted !== true &&
      ragAuthorityPacket.memoryWritten !== true,
    evidence: ragAuthorityPacket.blockers.join(",")
  },
  {
    name: "Non-ready repaired reusable workflow invocation is blocked before approval gate",
    pass:
      blocked.status === "blocked_before_repaired_reusable_workflow_invocation_approval_gate" &&
      blocked.reusedExistingApprovalGatePrepRunner === false &&
      blockedPacket.blockers.includes(
        "repaired_reusable_workflow_invocation_plan_not_ready_for_approval_gate_planning"
      ),
    evidence: blockedPacket.blockers.join(",")
  },
  {
    name: "Missing repaired reusable workflow route evidence is blocked before approval gate",
    pass:
      missingRoute.status === "blocked_before_repaired_reusable_workflow_invocation_approval_gate" &&
      missingRoute.reusedExistingApprovalGatePrepRunner === true &&
      missingRoutePacket.blockers.includes("existing_prep_blocker: missing_reviewed_command_manifest"),
    evidence: missingRoutePacket.blockers.join(",")
  },
  {
    name: "Repaired reusable workflow approval gate prep keeps execution memory rule packaging and completion locks",
    pass:
      readyPacket.locks.reviewOnly === true &&
      readyPacket.locks.accepted === false &&
      readyPacket.locks.ruleEnabled === false &&
      readyPacket.locks.packagingGated === true &&
      readyPacket.locks.prepRunnerDoesNotInvokeExecutionRunner === true &&
      readyPacket.locks.prepRunnerDoesNotExecuteTargetSoftware === true &&
      readyPacket.locks.screenshotsCaptured === false &&
      readyPacket.locks.memoryWritten === false &&
      readyPacket.locks.nativeUniversalExecution === false &&
      readyPacket.locks.goalComplete === false,
    evidence: JSON.stringify(readyPacket.locks)
  }
];

const passed = checks.filter((check) => check.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke:
    "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner_smoke_v1",
  passed,
  total: checks.length,
  readyPacketPath: ready.packetPath,
  readyApprovalGatePath: ready.approvalGatePath,
  ragReadyPacketPath: ragReady.packetPath,
  ragReadyReceiptPath: ragReady.receiptPath,
  ragReadyApprovalGatePath: ragReady.approvalGatePath,
  ragAuthorityPacketPath: ragAuthority.packetPath,
  blockedPacketPath: blocked.packetPath,
  missingRoutePacketPath: missingRoute.packetPath,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
