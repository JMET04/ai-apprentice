#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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

function slug(value) {
  return (
    String(value || "tlcl-reusable-workflow-activation-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-activation-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["approve_medium_runtime_reuse", "approve_bounded_reuse", "medium_runtime_workflow_allowed"].includes(decision)) {
    return "approve_medium_runtime_reuse";
  }
  if (["workflow_mismatch_blocked", "mismatch_blocked", "blocked"].includes(decision)) return "workflow_mismatch_blocked";
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (["accepted", "enable_rule", "write_memory", "unlock_packaging", "claim_goal_complete", "claim_all_software_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function providerRoleUsePlanTraceFromCandidate(candidate) {
  return (
    candidate?.boundedReuseScope?.providerRoleUsePlanTrace ||
    candidate?.sourceEvidence?.providerRoleUsePlanTrace ||
    {}
  );
}

function locks(workflowEnabled = false) {
  return {
    reviewOnly: true,
    activationValidationOnly: true,
    mediumRuntimeWorkflowEnabled: workflowEnabled,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher approval for bounded TLCL medium-runtime workflow reuse.");
const candidateInput = readJsonInput(
  argValue("--candidate", argValue("--workflow-candidate", "")),
  "--candidate",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_candidate_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-reusable-workflow-activation-validations"))
);
const candidate = candidateInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set(["accepted", "enable_rule", "write_memory", "unlock_packaging", "claim_goal_complete", "claim_all_software_complete"]);
const blockers = [];
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (candidate.status !== "reusable_workflow_candidate_ready_for_teacher_activation_review") {
  blockers.push("candidate_not_ready_for_activation_review");
}
if (candidate.mediumRuntimeReuseCandidate !== true) blockers.push("candidate_reuse_flag_missing");
if (!candidate.workflowFingerprint) blockers.push("workflow_fingerprint_missing");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");
if (decision === "approve_medium_runtime_reuse") {
  if (receipt.candidateReviewed !== true) blockers.push("candidate_not_reviewed");
  if (receipt.contractBoundaryReviewed !== true) blockers.push("contract_boundary_not_reviewed");
  if (receipt.sourceOutcomeEvidenceReviewed !== true) blockers.push("source_outcome_evidence_not_reviewed");
  if (receipt.deterministicValidatorsStillRequiredConfirmed !== true) blockers.push("validator_requirement_not_confirmed");
  if (receipt.approvalGateStillRequiredConfirmed !== true) blockers.push("approval_gate_requirement_not_confirmed");
  if (receipt.rollbackPointStillRetained !== true) blockers.push("rollback_point_not_retained");
  if (receipt.teacherApprovedBoundedReuse !== true) blockers.push("teacher_bounded_reuse_approval_missing");
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt.teacherCorrection || "").trim()) {
  blockers.push("high_reasoning_repair_correction_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const mediumRuntimeWorkflowEnabled = decision === "approve_medium_runtime_reuse" && blockers.length === 0;
const mismatchBlocked = decision === "workflow_mismatch_blocked" && !forbiddenDecisionUsed;
const escalateToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : mediumRuntimeWorkflowEnabled
    ? "medium_runtime_workflow_reuse_allowed_for_bounded_contract"
    : mismatchBlocked || escalateToHighReasoningRepair
      ? "escalate_to_high_reasoning_repair"
      : "needs_teacher_review_or_more_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-medium-runtime-reusable-workflow-activation-validation.json");
const receiptPath = join(validationDir, "tlcl-medium-runtime-reusable-workflow-activation-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_MEDIUM_RUNTIME_REUSABLE_WORKFLOW_ACTIVATION_VALIDATION_START_HERE.md");
const reusableWorkflowCard = mediumRuntimeWorkflowEnabled
  ? {
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_card_v1",
      workflowFingerprint: candidate.workflowFingerprint,
      runtimeTier: "medium_reasoning_runtime",
      providerRoleUsePlanTrace: providerRoleUsePlanTraceFromCandidate(candidate),
      mediumRuntimeWorkflowEnabled: true,
      boundedReuseScope: candidate.boundedReuseScope,
      requiredBeforeEveryRun: candidate.requiredBeforeEveryReuse,
      executionStillRequiresApprovalGate: true,
      rollbackStillRequired: true,
      outcomeReviewStillRequired: true,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      packagingUnlockAllowed: false,
      completionClaimAllowed: false
    }
  : null;
const highReasoningRepairHandoff =
  mismatchBlocked || escalateToHighReasoningRepair
    ? {
        kind: "high_reasoning_repair_handoff",
        runtimeTransition: "reusable_workflow_candidate_to_high_reasoning_contract_repair",
        workflowFingerprint: candidate.workflowFingerprint || "",
        teacherDecision: decision,
        teacherCorrection: receipt.teacherCorrection || "",
        teacherNote: receipt.teacherNote || "",
        evidenceToInspect: [candidateInput.path, candidate.sourceEvidence?.outcomeValidationPath || ""].filter(Boolean),
        repairTasks: [
          "Repair the TLCL contract boundary or route fingerprint before allowing medium-runtime reuse.",
          "Rerun the approved outcome review and reusable workflow candidate builder after repair.",
          "Do not let the medium runtime reuse this candidate until a new teacher activation receipt passes."
        ]
      }
    : null;
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  mediumRuntimeWorkflowEnabled,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  reusableWorkflowCard,
  highReasoningRepairHandoff,
  sourceEvidence: {
    candidatePath: candidateInput.path,
    candidateHash: sha256Object(candidate),
    receiptPath: receiptInput.path,
    receiptHash: sha256Object(receipt),
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromCandidate(candidate)
  },
  blockedTransitions: [
    "run_workflow_from_activation_validation",
    "execute_target_software_from_activation_validation",
    "write_memory_from_activation_validation",
    "enable_rule_from_activation_validation",
    "unlock_packaging_from_activation_validation",
    "claim_goal_complete_from_activation_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceCandidate: candidateInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks(mediumRuntimeWorkflowEnabled)
};
const validationReceipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_validation_receipt_v1",
  validationId,
  status,
  decision,
  mediumRuntimeWorkflowEnabled,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  workflowExecuted: false,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  goalComplete: false,
  locks: locks(mediumRuntimeWorkflowEnabled)
};

writeJson(validationPath, validation);
writeJson(receiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Reusable Workflow Activation Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation may allow bounded medium-runtime workflow reuse, but it does not run the workflow, execute target software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_validation_result_v1",
      validationId,
      status,
      decision,
      mediumRuntimeWorkflowEnabled,
      mismatchBlocked,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath,
      readmePath,
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
