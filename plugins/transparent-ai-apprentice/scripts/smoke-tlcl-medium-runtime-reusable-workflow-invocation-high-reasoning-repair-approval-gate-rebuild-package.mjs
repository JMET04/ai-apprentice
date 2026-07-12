#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-repair-approval-gate-rebuild-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const providerRoleUsePlanTrace = {
  providerRoleUsePlanHash: "sha256:repair-reuse-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repair-rebuild-reasoning-budget-governor-smoke",
  recommendedExecutionModel: "medium_runtime_reusable_workflow_executor",
  highReasoningRepairRequiredOnCorrection: true
};

const reviewedRunnerPath = join(smokeRoot, "teacher-reviewed-repair-target.mjs");
writeFileSync(
  reviewedRunnerPath,
  [
    "import { writeFileSync } from 'node:fs';",
    "const outputPath = process.argv[2];",
    "writeFileSync(outputPath, JSON.stringify({ ok: true, proof: 'repair approval gate rebuild reviewed command' }, null, 2) + '\\n', 'utf8');"
  ].join("\n"),
  "utf8"
);
const reviewedCommandPath = writeJson(join(smokeRoot, "reviewed-command-manifest.json"), {
  format: "transparent_ai_reviewed_cli_command_manifest_v1",
  teacherReviewed: true,
  commandKind: "node-script",
  scriptSourceFile: reviewedRunnerPath,
  expectedScriptSha256: sha256(reviewedRunnerPath),
  targetOutputFileName: "repair-approval-gate-rebuild-output.json"
});
const adapterReceiptPath = join(smokeRoot, "existing-cli-or-script-execution-receipt.json");
const adapterRunnerPath = join(smokeRoot, "run-existing-cli-or-script.mjs");
writeFileSync(
  adapterRunnerPath,
  [
    "import { writeFileSync } from 'node:fs';",
    `const receiptPath = ${JSON.stringify(adapterReceiptPath)};`,
    "const receipt = { format: 'transparent_ai_existing_software_execution_receipt_v1', adapterId: 'existing-cli-or-script', mode: 'dry_run', commandExecuted: false, status: 'dry_run_no_command_executed', locks: { accepted: false, ruleEnabled: false, packagingGated: true, nativeUniversalExecution: false } };",
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
      pilotId: "repair-rebuild-cli-pilot-001",
      software: "TLCL repair rebuild smoke CLI",
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
  selectorId: "repair-rebuild-smoke-selector",
  sourceEvidence: {
    executionPilotQueuePath: queuePath
  },
  numberedCandidates: [
    {
      number: 1,
      pilotId: "repair-rebuild-cli-pilot-001",
      software: "TLCL repair rebuild smoke CLI",
      routeMode: "existing-cli-or-script",
      primaryAdapterId: "existing-cli-or-script",
      adapterPackagePath,
      actionPlanPath,
      score: 200
    }
  ],
  selectedCandidate: {
    number: 1,
    pilotId: "repair-rebuild-cli-pilot-001",
    software: "TLCL repair rebuild smoke CLI",
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
const planPath = writeJson(join(smokeRoot, "ready-reusable-workflow-invocation-plan.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_plan_v1",
  invocationId: "repair-rebuild-ready-plan",
  status: "medium_runtime_reuse_invocation_ready_for_approval_gate_planning",
  invocationReady: true,
  expectedWorkflowFingerprint: "sha256:repaired-workflow-fingerprint",
  observedWorkflowFingerprint: "sha256:repaired-workflow-fingerprint",
  fingerprintMatched: true,
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
    workflowFingerprint: "sha256:repaired-workflow-fingerprint",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    nextRequiredGate: "teacher_reviewed_execution_approval_gate",
    executesNow: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const readyFingerprintReviewPath = writeJson(join(smokeRoot, "ready-fingerprint-review-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_validation_v1",
  validationId: "repair-rebuild-fingerprint-review",
  status: "reusable_workflow_repair_fingerprint_review_ready_for_approval_gate_rebuild",
  readyForApprovalGateRebuild: true,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  approvalGateRebuildHandoff: {
    kind: "reusable_workflow_repair_fingerprint_review_approval_gate_rebuild_handoff",
    runtimeTransition: "repair_fingerprint_review_to_approval_gate_rebuild",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse: true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: true,
    workflowFingerprintBefore: "sha256:old-workflow-fingerprint",
    workflowFingerprintAfter: "sha256:repaired-workflow-fingerprint",
    fingerprintChanged: true
  },
  locks: {
    approvalGateRebuildStillRequired: true,
    doesNotRebuildApprovalGate: true,
    doesNotRunMediumRuntime: true,
    doesNotEnableRules: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const blockedFingerprintReviewPath = writeJson(join(smokeRoot, "blocked-fingerprint-review-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_validation_v1",
  validationId: "repair-rebuild-blocked-fingerprint-review",
  status: "reusable_workflow_repair_fingerprint_review_return_to_high_reasoning_repair",
  readyForApprovalGateRebuild: false,
  locks: {
    approvalGateRebuildStillRequired: true,
    doesNotRebuildApprovalGate: true,
    doesNotRunMediumRuntime: true
  }
});

const ready = runNode(
  "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs",
  [
    "--fingerprint-review-validation",
    readyFingerprintReviewPath,
    "--plan",
    planPath,
    "--selector",
    selectorPath,
    "--queue",
    queuePath,
    "--selected-pilot-id",
    "repair-rebuild-cli-pilot-001",
    "--adapter-id",
    "existing-cli-or-script",
    "--reviewed-command",
    reviewedCommandPath,
    "--teacher-confirmation",
    "teacher confirmed tlcl reusable workflow invocation approval gate",
    "--rollback-point-created",
    "--out-dir",
    join(smokeRoot, "ready")
  ]
);
const blocked = runNode(
  "scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approval-gate-rebuild-package.mjs",
  [
    "--fingerprint-review-validation",
    blockedFingerprintReviewPath,
    "--plan",
    planPath,
    "--selector",
    selectorPath,
    "--queue",
    queuePath,
    "--selected-pilot-id",
    "repair-rebuild-cli-pilot-001",
    "--adapter-id",
    "existing-cli-or-script",
    "--reviewed-command",
    reviewedCommandPath,
    "--teacher-confirmation",
    "teacher confirmed tlcl reusable workflow invocation approval gate",
    "--rollback-point-created",
    "--out-dir",
    join(smokeRoot, "blocked")
  ]
);
const readyPackage = readJson(ready.packagePath);
const checks = [
  check(
    "Reusable workflow repair approval gate rebuild invokes only the existing prep runner",
    ready.status === "reusable_workflow_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review" &&
      ready.approvalGateRebuilt === true &&
      ready.approvalGatePrepRunnerInvoked === true &&
      existsSync(ready.prepRunnerPacketPath) &&
      existsSync(ready.approvalGatePath),
    ready.approvalGatePath
  ),
  check(
    "Reusable workflow repair approval gate rebuild does not run medium runtime or target software",
    ready.mediumRuntimeRetryAllowed === false &&
      ready.approvedGateRunnerInvoked === false &&
      ready.targetSoftwareCommandsExecuted === false &&
      ready.uiEventsSent === false &&
      ready.screenshotsCaptured === false &&
      ready.memoryWritten === false &&
      readyPackage.locks.doesNotRunApprovedGateRunner === true &&
      readyPackage.locks.doesNotExecuteTargetSoftware === true,
    JSON.stringify(readyPackage.locks)
  ),
  check(
    "Reusable workflow repair approval gate rebuild preserves RAG non-authority locks",
    ready.ragInformedRepairReuse === true &&
      ready.ragEvidenceTreatedAsAuthority === false &&
      ready.ragEvidenceNonAuthoritative === true &&
      readyPackage.ragInformedRepairReuse === true &&
      readyPackage.ragEvidenceNonAuthoritative === true &&
      readyPackage.locks.ragEvidenceNonAuthoritative === true &&
      readyPackage.locks.doesNotTreatRagAsAuthority === true &&
      readyPackage.blockedTransitions.includes("treat_rag_as_authority_from_repair_approval_gate_rebuild"),
    JSON.stringify(readyPackage.sourceEvidence)
  ),
  check(
    "Reusable workflow repair approval gate rebuild preserves provider role-use trace for repaired command builder",
    readyPackage.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
      providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(readyPackage.sourceEvidence.providerRoleUsePlanTrace || {})
  ),
  check(
    "Reusable workflow repair approval gate rebuild preserves reasoning budget trace for repaired command builder",
    readyPackage.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
      reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(readyPackage.sourceEvidence.reasoningBudgetGovernorReviewTrace || {})
  ),
  check(
    "Reusable workflow repair approval gate rebuild blocks unready fingerprint review",
    blocked.status === "blocked_before_reusable_workflow_repair_approval_gate_rebuild" &&
      blocked.approvalGateRebuilt === false &&
      blocked.approvalGatePrepRunnerInvoked === false &&
      blocked.blockers.includes("fingerprint_review_not_ready_for_approval_gate_rebuild"),
    blocked.blockers.join(",")
  ),
  check(
    "Reusable workflow repair approval gate rebuild preserves packaging rule and completion locks",
    ready.accepted === false &&
      ready.ruleEnabled === false &&
      ready.packagingGated === true &&
      ready.nativeUniversalExecution === false &&
      ready.allSoftwareExecutionComplete === false &&
      ready.goalComplete === false &&
      readyPackage.locks.mediumRuntimeContinuationBlockedUntilTeacherExecuteReview === true,
    JSON.stringify(readyPackage.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approval_gate_rebuild_package_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyPackagePath: ready.packagePath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
