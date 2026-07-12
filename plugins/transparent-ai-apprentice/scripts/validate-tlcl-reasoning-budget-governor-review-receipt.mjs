#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

const forbiddenDecisions = new Set(["execute_now", "accepted", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"]);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: JSON.parse(readFileSync(resolve(text), "utf8").replace(/^\uFEFF/, "")), path: resolve(text) }
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
    String(value || "tlcl-reasoning-budget-governor-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reasoning-budget-governor-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["confirmed_for_next_gate", "confirm_next_gate", "approved_for_next_gate"].includes(decision)) return "confirmed_for_next_gate";
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (["blocked", "needs_more_evidence", "needs_teacher_review"].includes(decision)) return decision;
  if (forbiddenDecisions.has(decision)) return decision;
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    doesNotInvokeModel: true,
    doesNotRunMediumRuntime: true,
    doesNotRunSeniorCompiler: true,
    doesNotRunValidators: true,
    doesNotExecuteTargetSoftware: true,
    noUiEvents: true,
    noScreenshots: true,
    noMemoryWrite: true,
    noRuleEnablement: true,
    noPackagingUnlock: true,
    noCompletionClaim: true,
    accepted: false,
    ruleEnabled: false,
    memoryWritten: false,
    packagingGated: true,
    goalComplete: false
  };
}

function nextGateFor(governor) {
  if (governor.decision === "allow_medium_reasoning_runtime_reuse") {
    return {
      kind: "medium_reasoning_runtime_next_gate",
      recommendedTool: "create_tlcl_medium_runtime_reusable_workflow_invocation_planner",
      fallbackTool: "create_tlcl_medium_runtime_dry_run_prep",
      allowedOnlyAfter: [
        "teacher-reviewed governor receipt validation",
        "retained rollback point",
        "separate execution approval gate before target software"
      ]
    };
  }
  if (governor.decision === "allow_low_reasoning_fixed_transform") {
    return {
      kind: "low_reasoning_fixed_transform_next_gate",
      recommendedTool: "fixed_transform_input_schema_gate",
      allowedOnlyAfter: ["schema-confirmed input", "missing fields fail as unknown"]
    };
  }
  if (governor.decision === "allow_deterministic_validation") {
    return {
      kind: "deterministic_validation_next_gate",
      recommendedTool: "evaluate_rule_package",
      allowedOnlyAfter: ["artifact envelope and rule package are present"]
    };
  }
  return {
    kind: "high_reasoning_contract_compile_or_repair_next_gate",
    recommendedTool: "create_tlcl_rag_informed_high_reasoning_repair_intake",
    allowedOnlyAfter: ["teacher correction or repair need is reviewed", "RAG evidence remains non-authoritative"]
  };
}

const goal = argValue("--goal", "Validate a TLCL reasoning budget governor teacher receipt.");
const governorInput = readJsonInput(
  argValue("--governor", argValue("--reasoning-budget-governor", "")),
  "--governor",
  "transparent_ai_tlcl_reasoning_budget_governor_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_reasoning_budget_governor_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-reasoning-budget-governor-review-validations"))
);

const governor = governorInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherReviewDecision);
const blockers = [];
const sourceHash = sha256Object(governor);

if (receipt.governorId !== governor.governorId) blockers.push("receipt_governor_id_mismatch");
if (receipt.sourceGovernorHash && receipt.sourceGovernorHash !== sourceHash) blockers.push("receipt_source_governor_hash_mismatch");
if (receipt.sourceGovernorPath && governorInput.path && resolve(receipt.sourceGovernorPath) !== governorInput.path) {
  blockers.push("receipt_source_governor_path_mismatch");
}
if (receipt.decision !== governor.decision) blockers.push("receipt_governor_decision_mismatch");
if (receipt.recommendedTier !== governor.recommendedTier) blockers.push("receipt_recommended_tier_mismatch");
if (receipt.locks?.doesNotExecuteTargetSoftware !== true || receipt.locks?.doesNotInvokeModel !== true) {
  blockers.push("receipt_locks_not_preserved");
}
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_review_decision");

if (decision === "confirmed_for_next_gate") {
  if (receipt.governorDecisionReviewed !== true) blockers.push("governor_decision_not_reviewed");
  if (receipt.recommendedTierReviewed !== true) blockers.push("recommended_tier_not_reviewed");
  if (receipt.costPolicyReviewed !== true) blockers.push("cost_policy_not_reviewed");
  if (receipt.nextGateReviewed !== true) blockers.push("next_gate_not_reviewed");
  if (receipt.blockedTransitionsConfirmed !== true) blockers.push("blocked_transitions_not_confirmed");
  if (receipt.rollbackPointStillRetained !== true) blockers.push("rollback_point_not_retained");
  if (governor.decision === "allow_medium_reasoning_runtime_reuse" && receipt.mediumReusePreconditionsReviewed !== true) {
    blockers.push("medium_reuse_preconditions_not_reviewed");
  }
  if ((governor.evidence?.ragEvidencePath || governor.blockers?.some((item) => String(item).includes("rag"))) && receipt.ragEvidenceNonAuthorityConfirmed !== true) {
    blockers.push("rag_non_authority_not_confirmed");
  }
}

if (decision === "correction_to_high_reasoning_repair" && !String(receipt.teacherCorrection || "").trim()) {
  blockers.push("high_reasoning_repair_correction_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForNextGate = decision === "confirmed_for_next_gate" && blockers.length === 0;
const escalateToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_teacher_review_decision"
  : readyForNextGate
    ? "reasoning_budget_governor_confirmed_for_next_gate"
    : escalateToHighReasoningRepair
      ? "reasoning_budget_governor_review_escalate_to_high_reasoning_repair"
      : "reasoning_budget_governor_review_needs_teacher_review_or_more_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-reasoning-budget-governor-review-validation.json");
const receiptPath = join(validationDir, "tlcl-reasoning-budget-governor-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REASONING_BUDGET_GOVERNOR_REVIEW_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_reasoning_budget_governor_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForNextGate,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  sourceEvidence: {
    governorPath: governorInput.path,
    receiptPath: receiptInput.path,
    governorHash: sourceHash,
    receiptHash: sha256Object(receipt)
  },
  nextGate: readyForNextGate ? nextGateFor(governor) : null,
  highReasoningRepairHandoff: escalateToHighReasoningRepair
    ? {
        kind: "reasoning_budget_governor_review_to_high_reasoning_repair",
        teacherCorrection: receipt.teacherCorrection || "",
        observedIssue: receipt.observedIssue || "",
        governorDecision: governor.decision,
        recommendedTier: governor.recommendedTier,
        repairTasks: [
          "Repair the TLCL cost, tier, or evidence boundary before reusing a lower-cost runtime.",
          "Rerun the reasoning budget governor after the corrected contract evidence is available.",
          "Keep RAG evidence non-authoritative and keep medium runtime blocked until validation passes."
        ]
      }
    : null,
  blockedTransitions: [
    "invoke_model_from_governor_review_validation",
    "run_medium_runtime_from_governor_review_validation",
    "run_high_reasoning_repair_from_governor_review_validation",
    "run_validator_from_governor_review_validation",
    "execute_target_software_from_governor_review_validation",
    "write_memory_from_governor_review_validation",
    "enable_rule_from_governor_review_validation",
    "unlock_packaging_from_governor_review_validation",
    "claim_completion_from_governor_review_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath
  },
  locks: locks()
};
const validationReceipt = {
  format: "transparent_ai_tlcl_reasoning_budget_governor_review_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForNextGate,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  modelInvoked: false,
  mediumRuntimeInvoked: false,
  highReasoningRepairInvoked: false,
  validatorsRun: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  goalComplete: false,
  locks: locks()
};

writeJson(validationPath, validation);
writeJson(receiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reasoning Budget Governor Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation only checks the teacher receipt. It does not invoke models, run runtimes, run validators, execute target software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_reasoning_budget_governor_review_validation_result_v1",
      validationId,
      status,
      decision,
      readyForNextGate,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath,
      readmePath,
      modelInvoked: false,
      mediumRuntimeInvoked: false,
      highReasoningRepairInvoked: false,
      validatorsRun: false,
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

if (forbiddenDecisionUsed) process.exit(1);
