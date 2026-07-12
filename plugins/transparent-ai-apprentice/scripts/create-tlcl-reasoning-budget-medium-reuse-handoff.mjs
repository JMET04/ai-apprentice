#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: readJson(resolve(text)), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slug(value) {
  return (
    String(value || "tlcl-reasoning-budget-medium-reuse-handoff")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reasoning-budget-medium-reuse-handoff"
  );
}

function locks(ready = false) {
  return {
    reviewOnly: true,
    handoffOnly: true,
    readyForMediumReusePlanner: ready,
    doesNotInvokeModel: true,
    doesNotRunMediumRuntime: true,
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
    goalComplete: false
  };
}

const goal = argValue("--goal", "Prepare a TLCL medium-runtime reusable workflow context after reasoning budget review.");
const validationInput = readJsonInput(
  argValue("--governor-review-validation", argValue("--validation", "")),
  "--governor-review-validation",
  "transparent_ai_tlcl_reasoning_budget_governor_review_validation_v1"
);
const workflowFingerprint = argValue("--workflow-fingerprint", argValue("--fingerprint", ""));
const teacherReviewedReuseIntent = argValue("--teacher-reviewed-reuse-intent", "true") !== "false";
const deterministicValidatorsPassed = argValue("--deterministic-validators-passed", "true") !== "false";
const approvalGateStillRequiredConfirmed = argValue("--approval-gate-still-required", "true") !== "false";
const rollbackPointRetained = argValue("--rollback-point-retained", "true") !== "false";
const freshOutcomeReviewPlanned = argValue("--fresh-outcome-review-planned", "true") !== "false";
const outputRoot = resolve(
  argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-reasoning-budget-medium-reuse-handoffs"))
);

const validation = validationInput.value;
const blockers = [];
if (validation.status !== "reasoning_budget_governor_confirmed_for_next_gate") {
  blockers.push("governor_review_validation_not_confirmed_for_next_gate");
}
if (validation.readyForNextGate !== true) blockers.push("governor_review_validation_not_ready_for_next_gate");
if (validation.nextGate?.kind !== "medium_reasoning_runtime_next_gate") {
  blockers.push("governor_review_validation_next_gate_not_medium_runtime");
}
if (validation.locks?.doesNotInvokeModel !== true || validation.locks?.doesNotRunMediumRuntime !== true) {
  blockers.push("governor_review_validation_locks_not_preserved");
}
if (!workflowFingerprint) blockers.push("workflow_fingerprint_missing");
if (!teacherReviewedReuseIntent) blockers.push("teacher_reuse_intent_not_reviewed");
if (!deterministicValidatorsPassed) blockers.push("deterministic_validators_not_confirmed");
if (!approvalGateStillRequiredConfirmed) blockers.push("approval_gate_requirement_not_confirmed");
if (!rollbackPointRetained) blockers.push("rollback_point_not_retained");
if (!freshOutcomeReviewPlanned) blockers.push("fresh_outcome_review_not_planned");

const readyForMediumReusePlanner = blockers.length === 0;
const handoffId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const handoffDir = join(outputRoot, handoffId);
const handoffPath = join(handoffDir, "tlcl-reasoning-budget-medium-reuse-handoff.json");
const reuseContextPath = join(handoffDir, "tlcl-medium-runtime-reusable-workflow-invocation-context.json");
const receiptPath = join(handoffDir, "tlcl-reasoning-budget-medium-reuse-handoff-receipt.json");
const readmePath = join(handoffDir, "TLCL_REASONING_BUDGET_MEDIUM_REUSE_HANDOFF_START_HERE.md");
const governorReviewTrace = {
  source: "tlcl_reasoning_budget_governor_review_validation",
  validationId: validation.validationId,
  validationStatus: validation.status,
  validationPath: validationInput.path,
  validationHash: sha256Object(validation),
  nextGateKind: validation.nextGate?.kind || "",
  recommendedTool: validation.nextGate?.recommendedTool || "",
  readyForNextGate: validation.readyForNextGate === true,
  locks: {
    doesNotInvokeModel: validation.locks?.doesNotInvokeModel === true,
    doesNotRunMediumRuntime: validation.locks?.doesNotRunMediumRuntime === true,
    doesNotExecuteTargetSoftware: validation.locks?.doesNotExecuteTargetSoftware === true,
    noMemoryWrite: validation.locks?.noMemoryWrite === true,
    noRuleEnablement: validation.locks?.noRuleEnablement === true,
    noPackagingUnlock: validation.locks?.noPackagingUnlock === true
  }
};
const reuseContext = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_context_v1",
  workflowFingerprint,
  teacherDecision: readyForMediumReusePlanner ? "invoke_medium_runtime_reuse" : "needs_teacher_review",
  deterministicValidatorsPassed,
  approvalGateStillRequiredConfirmed,
  rollbackPointRetained,
  teacherReviewedReuseIntent,
  freshOutcomeReviewPlanned,
  reasoningBudgetGovernorReviewTrace: governorReviewTrace,
  sourceEvidence: {
    governorReviewValidationPath: validationInput.path,
    governorReviewValidationHash: governorReviewTrace.validationHash
  },
  locks: locks(readyForMediumReusePlanner)
};
const handoff = {
  ok: true,
  format: "transparent_ai_tlcl_reasoning_budget_medium_reuse_handoff_v1",
  handoffId,
  createdAt: new Date().toISOString(),
  goal,
  status: readyForMediumReusePlanner
    ? "reasoning_budget_medium_reuse_context_ready_for_invocation_planner"
    : "blocked_before_reasoning_budget_medium_reuse_context",
  readyForMediumReusePlanner,
  blockers,
  workflowFingerprint,
  governorReviewTrace,
  nextTool: readyForMediumReusePlanner ? "create_tlcl_medium_runtime_reusable_workflow_invocation_planner" : "",
  nextToolArguments: readyForMediumReusePlanner
    ? {
        reuseContext: reuseContextPath,
        workflowFingerprint
      }
    : null,
  blockedTransitions: [
    "invoke_model_from_reasoning_budget_medium_reuse_handoff",
    "run_medium_runtime_from_reasoning_budget_medium_reuse_handoff",
    "run_workflow_from_reasoning_budget_medium_reuse_handoff",
    "run_approved_gate_from_reasoning_budget_medium_reuse_handoff",
    "execute_target_software_from_reasoning_budget_medium_reuse_handoff",
    "write_memory_from_reasoning_budget_medium_reuse_handoff",
    "enable_rule_from_reasoning_budget_medium_reuse_handoff",
    "unlock_packaging_from_reasoning_budget_medium_reuse_handoff",
    "claim_completion_from_reasoning_budget_medium_reuse_handoff"
  ],
  paths: {
    handoff: handoffPath,
    reuseContext: reuseContextPath,
    receipt: receiptPath,
    readme: readmePath
  },
  locks: locks(readyForMediumReusePlanner)
};
const receipt = {
  format: "transparent_ai_tlcl_reasoning_budget_medium_reuse_handoff_receipt_v1",
  handoffId,
  status: handoff.status,
  readyForMediumReusePlanner,
  blockers,
  modelInvoked: false,
  mediumRuntimeInvoked: false,
  workflowExecuted: false,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  goalComplete: false,
  locks: locks(readyForMediumReusePlanner)
};

writeJson(handoffPath, handoff);
writeJson(reuseContextPath, reuseContext);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reasoning Budget Medium Reuse Handoff",
    "",
    `Status: ${handoff.status}`,
    "",
    "This handoff only converts a confirmed reasoning-budget review validation into a reusable workflow invocation context. It does not invoke models, run medium runtime, execute target software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_reasoning_budget_medium_reuse_handoff_result_v1",
      handoffId,
      status: handoff.status,
      readyForMediumReusePlanner,
      blockers,
      handoffPath,
      reuseContextPath,
      receiptPath,
      readmePath,
      nextTool: handoff.nextTool,
      modelInvoked: false,
      mediumRuntimeInvoked: false,
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
