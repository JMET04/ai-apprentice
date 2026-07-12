#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reusable-workflow-high-reasoning-repair-intake-smoke", String(Date.now()));
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
  inheritedFromPrep: true,
  requiredForScopedProvider: true,
  accepted: false,
  providerRole: "medium_reasoning_runtime",
  providerRoleUsePlanPath: join(smokeRoot, "tlcl-provider-role-use-plan.json"),
  providerRoleUsePlanHash: "sha256:reusable-repair-provider-role-use-plan-smoke",
  nextGateSatisfied: true
};
const reasoningBudgetGovernorReviewTrace = {
  validationId: "reasoning-budget-repair-intake-smoke-validation",
  validationHash: "sha256:reasoning-budget-repair-intake-smoke-validation",
  nextGateKind: "medium_reasoning_runtime_next_gate",
  recommendedTool: "create_tlcl_medium_runtime_reusable_workflow_invocation_planner",
  locks: {
    doesNotInvokeModel: true,
    doesNotRunMediumRuntime: true,
    doesNotExecuteTargetSoftware: true
  }
};

const correctionValidationPath = writeJson(join(smokeRoot, "correction-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
  status: "reusable_workflow_invocation_to_high_reasoning_contract_repair",
  decision: "correction_to_high_reasoning_repair",
  outcomeMatchedContract: false,
  mismatchBlocked: false,
  escalateToHighReasoningRepair: true,
  forbiddenDecisionUsed: false,
  blockers: [],
  highReasoningRepairHandoff: {
    kind: "reusable_workflow_invocation_high_reasoning_repair_handoff",
    runtimeTransition: "reusable_workflow_invocation_to_high_reasoning_contract_repair",
    sourceRunId: "tlcl-reusable-workflow-outcome-review-smoke-run",
    workflowFingerprint: "sha256:reusable-workflow-smoke",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    teacherDecision: "correction_to_high_reasoning_repair",
    teacherCorrection: "Reusable workflow reused the wrong parameter binding for the new target edge.",
    observedIssue: "Reusable workflow parameter binding mismatch.",
    affectedLogicFields: ["workflow.fingerprint", "route.commandTemplate", "rule.parameterBinding"],
    evidenceToInspect: [
      join(smokeRoot, "run.json"),
      join(smokeRoot, "adapter-receipt.json"),
      join(smokeRoot, "outcome-verification.json")
    ]
  },
  sourceEvidence: {
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, goalComplete: false }
});
const repairedRagCorrectionValidationPath = writeJson(join(smokeRoot, "repaired-rag-correction-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
  status: "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair",
  decision: "correction_to_high_reasoning_repair",
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  outcomeMatchedContract: false,
  mismatchBlocked: false,
  escalateToHighReasoningRepair: true,
  forbiddenDecisionUsed: false,
  blockers: [],
  highReasoningRepairHandoff: {
    kind: "repaired_reusable_workflow_invocation_high_reasoning_repair_handoff",
    runtimeTransition: "repaired_reusable_workflow_fresh_outcome_to_high_reasoning_contract_repair",
    sourceRepairedRunId: "tlcl-repaired-rag-reusable-workflow-outcome-review-smoke-run",
    ragInformedRepairReuse: true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: true,
    teacherDecision: "correction_to_high_reasoning_repair",
    teacherCorrection: "RAG evidence helped identify the newer offset table, but the corrected dimension rule must come from teacher-reviewed logic.",
    observedIssue: "Repaired reusable workflow still treated retrieved evidence like an enabled rule.",
    affectedLogicFields: ["workflow.fingerprint", "rule.parameterBinding", "rag.evidenceBoundary"],
    evidenceToInspect: [
      join(smokeRoot, "repaired-run.json"),
      join(smokeRoot, "rag-evidence-packet.json"),
      join(smokeRoot, "outcome-verification.json")
    ]
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true
  }
});
const matchedValidationPath = writeJson(join(smokeRoot, "matched-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
  status: "reusable_workflow_invocation_outcome_matched_contract_waiting_for_reuse_review",
  decision: "executed_route_matched_contract",
  outcomeMatchedContract: true,
  mismatchBlocked: false,
  escalateToHighReasoningRepair: false,
  forbiddenDecisionUsed: false,
  blockers: [],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, goalComplete: false }
});
const forbiddenValidationPath = writeJson(join(smokeRoot, "forbidden-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
  status: "blocked_for_forbidden_reusable_workflow_outcome_review_decision",
  decision: "enable_rule",
  outcomeMatchedContract: false,
  mismatchBlocked: false,
  escalateToHighReasoningRepair: false,
  forbiddenDecisionUsed: true,
  blockers: ["forbidden_teacher_decision"],
  locks: { accepted: false, ruleEnabled: false, packagingGated: true, goalComplete: false }
});

const ready = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs", [
  "--validation",
  correctionValidationPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const repairedRagReady = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs", [
  "--validation",
  repairedRagCorrectionValidationPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const matched = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs", [
  "--validation",
  matchedValidationPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const forbidden = runNode("scripts/create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-intake.mjs", [
  "--validation",
  forbiddenValidationPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const readyPacket = readJson(ready.intakePath);
const repairedRagReadyPacket = readJson(repairedRagReady.intakePath);
const readyPrompt = readFileSync(ready.promptPath, "utf8");
const repairedRagReadyPrompt = readFileSync(repairedRagReady.promptPath, "utf8");
const checks = [
  check(
    "Reusable workflow repair intake turns teacher correction into high-reasoning compile work",
    ready.status === "reusable_workflow_high_reasoning_repair_intake_ready" &&
      ready.readyForHighReasoningCompile === true &&
      ready.repairTaskCount >= 4 &&
      readyPacket.repairContext.runtimeTransition === "reusable_workflow_invocation_to_high_reasoning_contract_repair" &&
      readyPrompt.includes("highest-reasoning TLCL compiler"),
    ready.intakePath
  ),
  check(
    "Reusable workflow repair intake accepts repaired RAG-informed corrections with non-authority locks",
    repairedRagReady.status === "reusable_workflow_high_reasoning_repair_intake_ready" &&
      repairedRagReady.readyForHighReasoningCompile === true &&
      repairedRagReady.ragInformedRepairReuse === true &&
      repairedRagReady.ragEvidenceTreatedAsAuthority === false &&
      repairedRagReady.ragEvidenceNonAuthoritative === true &&
      repairedRagReadyPacket.repairContext.ragInformedRepairReuse === true &&
      repairedRagReadyPacket.repairContext.ragEvidenceNonAuthoritative === true &&
      repairedRagReadyPacket.locks.ragEvidenceNonAuthoritative === true &&
      repairedRagReadyPacket.locks.doesNotTreatRagAsAuthority === true &&
      repairedRagReadyPrompt.includes("RAG-informed repair reuse: yes"),
    JSON.stringify(repairedRagReadyPacket.repairContext)
  ),
  check(
    "Reusable workflow repair intake blocks matched outcomes before repair intake",
    matched.status === "blocked_before_reusable_workflow_high_reasoning_repair_intake" &&
      matched.readyForHighReasoningCompile === false &&
      matched.targetSoftwareCommandsExecuted === false,
    matched.intakePath
  ),
  check(
    "Reusable workflow repair intake preserves forbidden-decision blocking",
    forbidden.status === "blocked_before_reusable_workflow_high_reasoning_repair_intake" &&
      forbidden.readyForHighReasoningCompile === false &&
      forbidden.ruleEnabled === false &&
      forbidden.memoryWritten === false,
    forbidden.intakePath
  ),
  check(
    "Reusable workflow repair intake keeps execution memory packaging and completion locks",
    ready.approvedGateRunnerInvoked === false &&
      ready.targetSoftwareCommandsExecuted === false &&
      ready.memoryWritten === false &&
      ready.ruleEnabled === false &&
      ready.packagingGated === true &&
      ready.goalComplete === false &&
      readyPacket.locks.mediumRuntimeContinuationBlocked === true,
    JSON.stringify(readyPacket.locks)
  ),
  check(
    "Reusable workflow repair intake preserves provider role-use trace for high-reasoning repair",
    readyPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
      providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      readyPacket.repairContext.providerRoleUsePlanTrace.providerRole === "medium_reasoning_runtime",
    ready.intakePath
  ),
  check(
    "Reusable workflow repair intake preserves reasoning budget trace for high-reasoning repair",
    readyPacket.sourceEvidence.reasoningBudgetGovernorReviewTrace.validationHash ===
      reasoningBudgetGovernorReviewTrace.validationHash &&
      readyPacket.repairContext.reasoningBudgetGovernorReviewTrace.validationHash ===
        reasoningBudgetGovernorReviewTrace.validationHash,
    ready.intakePath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyIntakePath: ready.intakePath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
