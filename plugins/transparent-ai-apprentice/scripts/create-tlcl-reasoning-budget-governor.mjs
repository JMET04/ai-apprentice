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

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, ""));
}

function readOptionalJson(path, label) {
  const text = String(path || "").trim();
  if (!text) return { value: null, path: "" };
  const absolutePath = resolve(text);
  if (!existsSync(absolutePath)) throw new Error(`${label} does not exist: ${absolutePath}`);
  return { value: readJson(absolutePath), path: absolutePath };
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
    String(value || "tlcl-reasoning-budget-governor")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reasoning-budget-governor"
  );
}

function normalizeTier(value) {
  const tier = String(value || "").trim().toLowerCase();
  if (["senior", "highest", "high", "high_reasoning", "senior_reasoning_compile"].includes(tier)) {
    return "senior_reasoning_compile";
  }
  if (["medium", "medium_reasoning", "medium_reasoning_runtime"].includes(tier)) {
    return "medium_reasoning_runtime";
  }
  if (["low", "tool", "fixed", "low_reasoning_tool"].includes(tier)) return "low_reasoning_tool";
  if (["validator", "deterministic_validator"].includes(tier)) return "deterministic_validator";
  return "unknown";
}

function normalizeOperation(value) {
  const operation = String(value || "medium_runtime_reuse").trim().toLowerCase();
  if (["reuse", "medium_runtime_reuse", "invoke_medium_runtime_reuse", "execute_confirmed_workflow"].includes(operation)) {
    return "medium_runtime_reuse";
  }
  if (["compile", "compile_logic_contract", "learn_logic", "create_rule"].includes(operation)) {
    return "compile_logic_contract";
  }
  if (["repair", "repair_logic_contract", "teacher_correction", "fix_contract"].includes(operation)) {
    return "repair_logic_contract";
  }
  if (["fixed_transform", "metadata_transform", "format_convert"].includes(operation)) return "fixed_transform";
  if (["validate", "deterministic_validation", "run_validator"].includes(operation)) return "deterministic_validation";
  if (["execute", "execute_target_software", "run_target_software"].includes(operation)) return "execute_target_software";
  return operation || "medium_runtime_reuse";
}

function validationTriggers(report) {
  const triggers = [];
  if (!report) return triggers;
  if (report.status === "unknown") triggers.push("validator_unknown");
  if (report.status === "error") triggers.push("validator_error");
  if (report.delivery_allowed === false) triggers.push("validation_report_blocks_delivery");
  for (const result of report.results || []) {
    if (result.status === "unknown") triggers.push("validator_unknown");
    if (result.status === "error") triggers.push("validator_error");
    if (result.status === "fail" && result.lifecycle === "active" && result.severity === "blocking") {
      triggers.push("active_blocking_rule_failed");
    }
  }
  return [...new Set(triggers)];
}

function locks() {
  return {
    reviewOnly: true,
    governorOnly: true,
    doesNotInvokeModel: true,
    doesNotExecuteTargetSoftware: true,
    doesNotRunMediumRuntime: true,
    doesNotRunSeniorCompiler: true,
    doesNotRunValidators: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    memoryWritten: false,
    packagingGated: true,
    goalComplete: false
  };
}

const goal = argValue("--goal", "Govern TLCL reasoning tier and cost before runtime reuse.");
const requestedOperation = normalizeOperation(argValue("--operation", argValue("--requested-operation", "medium_runtime_reuse")));
const requestedTier = normalizeTier(argValue("--tier", argValue("--requested-tier", "medium_reasoning_runtime")));
const validationInput = readOptionalJson(argValue("--validation-report", ""), "--validation-report");
const workflowInput = readOptionalJson(argValue("--workflow-card", ""), "--workflow-card");
const providerRoleUsePlanInput = readOptionalJson(argValue("--provider-role-use-plan", ""), "--provider-role-use-plan");
const ragEvidenceInput = readOptionalJson(argValue("--rag-evidence", ""), "--rag-evidence");
const outRoot = resolve(argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-reasoning-budget-governor")));

const teacherCorrection = argValue("--teacher-correction", "");
const observedIssue = argValue("--observed-issue", "");
const deterministicValidatorsPassed = hasFlag("--deterministic-validators-passed");
const teacherReviewed = hasFlag("--teacher-reviewed");
const workflowConfirmed = hasFlag("--workflow-confirmed");
const rollbackPointRetained = hasFlag("--rollback-point-retained");
const freshOutcomeReviewPlanned = hasFlag("--fresh-outcome-review-planned");
const ragEvidenceAuthoritative = hasFlag("--rag-evidence-authoritative");
const validationRepairTriggers = validationTriggers(validationInput.value);

const blockers = [];
const repairTriggers = [...validationRepairTriggers];
if (teacherCorrection.trim()) repairTriggers.push("teacher_correction");
if (observedIssue.trim()) repairTriggers.push("observed_issue");
if (ragEvidenceAuthoritative) blockers.push("rag_evidence_claimed_as_authority");
if (ragEvidenceInput.value && requestedOperation === "medium_runtime_reuse" && !repairTriggers.length) {
  blockers.push("rag_evidence_must_enter_high_reasoning_repair_before_medium_reuse");
}

const mediumReusePreconditions = {
  workflowConfirmed,
  deterministicValidatorsPassed,
  teacherReviewed,
  rollbackPointRetained,
  freshOutcomeReviewPlanned
};
if (requestedOperation === "medium_runtime_reuse") {
  for (const [key, value] of Object.entries(mediumReusePreconditions)) {
    if (!value) blockers.push(`medium_reuse_precondition_missing:${key}`);
  }
}

const wrongTierUse =
  (requestedOperation === "medium_runtime_reuse" && requestedTier !== "medium_reasoning_runtime") ||
  (["compile_logic_contract", "repair_logic_contract"].includes(requestedOperation) &&
    requestedTier !== "senior_reasoning_compile") ||
  (requestedOperation === "fixed_transform" && requestedTier !== "low_reasoning_tool") ||
  (requestedOperation === "deterministic_validation" && requestedTier !== "deterministic_validator");
if (wrongTierUse) blockers.push("requested_reasoning_tier_does_not_match_operation");
if (requestedOperation === "execute_target_software") blockers.push("execution_requires_separate_teacher_approval_gate");

const mustEscalateToSenior =
  ["compile_logic_contract", "repair_logic_contract"].includes(requestedOperation) ||
  repairTriggers.length > 0 ||
  blockers.includes("rag_evidence_claimed_as_authority") ||
  blockers.includes("rag_evidence_must_enter_high_reasoning_repair_before_medium_reuse");
const mediumReuseAllowed =
  requestedOperation === "medium_runtime_reuse" &&
  requestedTier === "medium_reasoning_runtime" &&
  blockers.length === 0 &&
  repairTriggers.length === 0;
const fixedTransformAllowed =
  requestedOperation === "fixed_transform" &&
  requestedTier === "low_reasoning_tool" &&
  blockers.length === 0 &&
  repairTriggers.length === 0;
const deterministicValidationAllowed =
  requestedOperation === "deterministic_validation" &&
  requestedTier === "deterministic_validator" &&
  blockers.length === 0;

const decision = mediumReuseAllowed
  ? "allow_medium_reasoning_runtime_reuse"
  : fixedTransformAllowed
    ? "allow_low_reasoning_fixed_transform"
    : deterministicValidationAllowed
      ? "allow_deterministic_validation"
      : mustEscalateToSenior
        ? "route_to_highest_reasoning_contract_compile_or_repair"
        : "blocked_before_reasoning_tier_use";
const recommendedTier =
  decision === "allow_medium_reasoning_runtime_reuse"
    ? "medium_reasoning_runtime"
    : decision === "allow_low_reasoning_fixed_transform"
      ? "low_reasoning_tool"
      : decision === "allow_deterministic_validation"
        ? "deterministic_validator"
        : "senior_reasoning_compile";
const costPolicy = {
  highReasoningUse: recommendedTier === "senior_reasoning_compile" ? "allowed_for_compile_or_repair_only" : "not_allowed_for_this_step",
  mediumReasoningUse:
    recommendedTier === "medium_reasoning_runtime" ? "allowed_for_confirmed_workflow_reuse_only" : "blocked_until_contract_ready",
  lowReasoningUse: recommendedTier === "low_reasoning_tool" ? "allowed_for_fixed_transform_only" : "not_primary_for_this_step",
  estimatedCostClass:
    recommendedTier === "senior_reasoning_compile"
      ? "highest_cost_only_when_learning_or_repairing"
      : recommendedTier === "medium_reasoning_runtime"
        ? "medium_cost_for_reusable_execution_planning"
        : "low_cost_for_deterministic_or_fixed_work",
  escalationBackToHighReasoningWhen: [
    "teacher_correction",
    "validator_unknown",
    "validator_error",
    "active_blocking_rule_failed",
    "workflow_fingerprint_mismatch",
    "rag_evidence_needs_logic_extraction",
    "missing_teacher_review_or_rollback"
  ]
};

const governorId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const governorDir = join(outRoot, governorId);
const governorPath = join(governorDir, "tlcl-reasoning-budget-governor.json");
const receiptPath = join(governorDir, "tlcl-reasoning-budget-governor-review-receipt.json");

const evidence = {
  validationReportPath: validationInput.path,
  workflowCardPath: workflowInput.path,
  providerRoleUsePlanPath: providerRoleUsePlanInput.path,
  ragEvidencePath: ragEvidenceInput.path,
  hashes: {
    validationReportHash: validationInput.value ? sha256Object(validationInput.value) : "",
    workflowCardHash: workflowInput.value ? sha256Object(workflowInput.value) : "",
    providerRoleUsePlanHash: providerRoleUsePlanInput.value ? sha256Object(providerRoleUsePlanInput.value) : "",
    ragEvidenceHash: ragEvidenceInput.value ? sha256Object(ragEvidenceInput.value) : ""
  }
};
const governor = {
  ok: true,
  format: "transparent_ai_tlcl_reasoning_budget_governor_v1",
  governorId,
  createdAt: new Date().toISOString(),
  goal,
  requestedOperation,
  requestedTier,
  decision,
  recommendedTier,
  mediumReuseAllowed,
  mustEscalateToSenior,
  repairTriggers: [...new Set(repairTriggers)],
  blockers: [...new Set(blockers)],
  mediumReusePreconditions,
  costPolicy,
  evidence,
  nextActions:
    decision === "allow_medium_reasoning_runtime_reuse"
      ? [
          "Continue with the medium-runtime reusable workflow invocation planner.",
          "Keep the separate teacher execution approval gate and fresh outcome review.",
          "If the teacher corrects the result, rerun this governor with the correction to route back to senior compile."
        ]
      : decision === "route_to_highest_reasoning_contract_compile_or_repair"
        ? [
            "Use the highest-reasoning TLCL compiler to draft or repair the logic contract.",
            "Keep RAG evidence non-authoritative and cite it only as evidence.",
            "Rerun deterministic validation and teacher review before medium runtime reuse."
          ]
        : [
            "Do not use the requested reasoning tier for this operation.",
            "Collect missing teacher review, validation, workflow, or rollback evidence before retrying."
          ],
  blockedTransitions: [
    "high_reasoning_direct_target_execution",
    "medium_reasoning_rule_compilation",
    "medium_reasoning_contract_repair_without_escalation",
    "rag_authority_to_runtime",
    "runtime_without_teacher_review",
    "runtime_without_rollback",
    "write_memory_from_governor",
    "enable_rule_from_governor",
    "unlock_packaging_from_governor",
    "claim_completion_from_governor"
  ],
  locks: locks(),
  paths: {
    governor: governorPath,
    receipt: receiptPath
  }
};
const receipt = {
  format: "transparent_ai_tlcl_reasoning_budget_governor_review_receipt_v1",
  governorId,
  sourceGovernorPath: governorPath,
  sourceGovernorHash: sha256Object(governor),
  decision,
  recommendedTier,
  teacherReviewDecision: "needs_teacher_review",
  allowedTeacherReviewDecisions: ["needs_teacher_review", "confirmed_for_next_gate", "correction_to_high_reasoning_repair", "blocked"],
  forbiddenTeacherReviewDecisions: ["execute_now", "accepted", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"],
  governorDecisionReviewed: false,
  recommendedTierReviewed: false,
  costPolicyReviewed: false,
  mediumReusePreconditionsReviewed: false,
  nextGateReviewed: false,
  blockedTransitionsConfirmed: false,
  rollbackPointStillRetained: false,
  ragEvidenceNonAuthorityConfirmed: false,
  observedIssue: "",
  teacherCorrection: "",
  locks: locks()
};

writeJson(governorPath, governor);
writeJson(receiptPath, receipt);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_reasoning_budget_governor_result_v1",
      governorId,
      decision,
      requestedOperation,
      requestedTier,
      recommendedTier,
      mediumReuseAllowed,
      mustEscalateToSenior,
      repairTriggers: governor.repairTriggers,
      blockers: governor.blockers,
      governorPath,
      receiptPath,
      locks: locks()
    },
    null,
    2
  )
);
