#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-repair-draft-package-smoke", String(Date.now()));
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
  providerRoleUsePlanHash: "sha256:repair-validation-provider-role-use-plan-smoke",
  acceptedProviderRole: "medium_runtime_reusable_workflow_executor",
  highReasoningCompilerRequiredForRepair: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationHash: "sha256:repair-validation-reasoning-budget-governor-smoke",
  recommendedExecutionModel: "medium_runtime_reusable_workflow_executor",
  highReasoningRepairRequiredOnCorrection: true
};

const readyIntakePath = writeJson(join(smokeRoot, "ready-intake.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_v1",
  intakeId: "tlcl-reusable-workflow-repair-intake-smoke",
  status: "reusable_workflow_high_reasoning_repair_intake_ready",
  readyForHighReasoningCompile: true,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  sourceEvidence: {
    workflowFingerprint: "sha256:old-workflow-fingerprint",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse: true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: true
  },
  repairContext: {
    runtimeTransition: "reusable_workflow_invocation_to_high_reasoning_contract_repair",
    teacherDecision: "correction_to_high_reasoning_repair",
    ragInformedRepairReuse: true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: true,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    teacherCorrection: "Reusable workflow reused the wrong parameter binding for the new target edge.",
    observedIssue: "Reusable workflow parameter binding mismatch.",
    affectedLogicFields: ["workflow.fingerprint", "route.commandTemplate", "rule.parameterBinding"],
    evidenceToInspect: [join(smokeRoot, "run.json"), join(smokeRoot, "adapter-receipt.json")],
    repairTasks: ["Repair the Rule DSL and validator expectations."]
  },
  locks: {
    mediumRuntimeContinuationBlocked: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const blockedIntakePath = writeJson(join(smokeRoot, "blocked-intake.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_v1",
  intakeId: "tlcl-reusable-workflow-repair-intake-blocked-smoke",
  status: "blocked_before_reusable_workflow_high_reasoning_repair_intake",
  readyForHighReasoningCompile: false,
  repairContext: {},
  locks: {
    mediumRuntimeContinuationBlocked: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});

const ready = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs", [
  "--intake",
  readyIntakePath,
  "--out-dir",
  join(smokeRoot, "draft-packages")
]);
const blocked = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-draft-package.mjs", [
  "--intake",
  blockedIntakePath,
  "--out-dir",
  join(smokeRoot, "draft-packages")
]);
const readyPackage = readJson(ready.draftPackagePath);
const compiledPackage = readJson(ready.compiledRulePackagePath);
const checks = [
  check(
    "Reusable workflow repair draft package compiles only draft_disabled repair rules",
    ready.status === "reusable_workflow_high_reasoning_repair_draft_package_ready_for_teacher_review" &&
      ready.draftDisabledRuleCount === 1 &&
      compiledPackage.rules.length === 1 &&
      compiledPackage.rules.every((rule) => rule.lifecycle === "draft_disabled") &&
      readyPackage.draftDisabledRules[0].lifecycle === "draft_disabled",
    ready.compiledRulePackagePath
  ),
  check(
    "Reusable workflow repair draft package blocks unready repair intake",
    blocked.status === "blocked_before_reusable_workflow_repair_draft_package" &&
      blocked.draftDisabledRuleCount === 0 &&
      blocked.targetSoftwareCommandsExecuted === false,
    blocked.draftPackagePath
  ),
  check(
    "Reusable workflow repair draft package carries regression validation plan before medium retry",
    readyPackage.regressionValidationPlan.requiredBeforeMediumRuntimeRetry === true &&
      readyPackage.workflowRepairProposal.mediumRuntimeRetryBlocked === true &&
      readyPackage.regressionValidationPlan.forbiddenShortcuts.includes("reuse_medium_runtime_without_revalidation"),
    JSON.stringify(readyPackage.regressionValidationPlan)
  ),
  check(
    "Reusable workflow repair draft package preserves RAG non-authority locks",
    ready.ragInformedRepairReuse === true &&
      ready.ragEvidenceTreatedAsAuthority === false &&
      ready.ragEvidenceNonAuthoritative === true &&
      readyPackage.ragInformedRepairReuse === true &&
      readyPackage.ragEvidenceNonAuthoritative === true &&
      readyPackage.locks.ragEvidenceNonAuthoritative === true &&
      readyPackage.locks.doesNotTreatRagAsAuthority === true &&
      readyPackage.regressionValidationPlan.forbiddenShortcuts.includes("treat_rag_as_authority_from_draft_package"),
    JSON.stringify(readyPackage.sourceEvidence)
  ),
  check(
    "Reusable workflow repair draft package preserves provider role-use trace from repair intake",
    readyPackage.sourceEvidence.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
      providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPackage.workflowRepairProposal.providerRoleUsePlanTrace?.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash,
    JSON.stringify(readyPackage.sourceEvidence.providerRoleUsePlanTrace || {})
  ),
  check(
    "Reusable workflow repair draft package preserves reasoning budget trace from repair intake",
    readyPackage.sourceEvidence.reasoningBudgetGovernorReviewTrace?.validationHash ===
      reasoningBudgetGovernorReviewTrace.validationHash &&
      readyPackage.workflowRepairProposal.reasoningBudgetGovernorReviewTrace?.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash,
    JSON.stringify(readyPackage.sourceEvidence.reasoningBudgetGovernorReviewTrace || {})
  ),
  check(
    "Reusable workflow repair draft package keeps execution memory packaging and completion locks",
    ready.activeRulePackageCompiled === false &&
      ready.approvedGateRunnerInvoked === false &&
      ready.targetSoftwareCommandsExecuted === false &&
      ready.memoryWritten === false &&
      ready.ruleEnabled === false &&
      ready.packagingGated === true &&
      ready.goalComplete === false &&
      readyPackage.locks.mediumRuntimeContinuationBlocked === true,
    JSON.stringify(readyPackage.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_draft_package_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyDraftPackagePath: ready.draftPackagePath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
