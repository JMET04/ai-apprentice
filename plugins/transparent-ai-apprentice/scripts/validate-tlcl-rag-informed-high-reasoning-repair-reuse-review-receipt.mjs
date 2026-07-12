#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    String(value || "tlcl-rag-informed-repair-reuse-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-repair-reuse-review-validation"
  );
}

function locks(workflowEnabled = false) {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    validationOnly: true,
    reusesExistingHighReasoningRepairReuseReviewValidator: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
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

function runNode(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function adaptRagReuseReceipt(receipt) {
  return {
    ...receipt,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_reuse_review_receipt_v1",
    repairOutcomeValidationReviewed: receipt.repairOutcomeValidationReviewed === true || receipt.ragOutcomeValidationReviewed === true,
    repairedWorkflowBoundaryReviewed:
      receipt.repairedWorkflowBoundaryReviewed === true || receipt.ragReuseBoundaryReviewed === true || receipt.contractBoundaryReviewed === true,
    repairedWorkflowFingerprintReviewed: receipt.repairedWorkflowFingerprintReviewed === true || receipt.reusableWorkflowFingerprintReviewed === true,
    deterministicValidatorsStillRequiredConfirmed: receipt.deterministicValidatorsStillRequiredConfirmed === true,
    approvalGateStillRequiredConfirmed: receipt.approvalGateStillRequiredConfirmed === true,
    rollbackPointStillRetained: receipt.rollbackPointStillRetained === true,
    teacherApprovedBoundedReuse: receipt.teacherApprovedBoundedReuse === true
  };
}

const goal = argValue("--goal", "Validate teacher review for retaining a RAG-informed repaired reusable workflow.");
const candidateInput = readJsonInput(
  argValue("--candidate", argValue("--rag-reuse-candidate", argValue("--workflow-candidate", ""))),
  "--candidate",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_candidate_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-repair-reuse-review-validations"))
);
const candidate = candidateInput.value;
const receipt = receiptInput.value;
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const adaptedReceiptPath = join(validationDir, "adapted-high-reasoning-repair-reuse-review-receipt.json");
writeJson(adaptedReceiptPath, adaptRagReuseReceipt(receipt));

const preflightBlockers = [];
if (candidate.status !== "rag_informed_repair_reuse_review_candidate_ready_for_teacher_review") {
  preflightBlockers.push("rag_informed_reuse_review_candidate_not_ready");
}
if (!candidate.sourceEvidence?.reusedRepairReuseCandidatePath || !existsSync(candidate.sourceEvidence.reusedRepairReuseCandidatePath)) {
  preflightBlockers.push("reused_high_reasoning_repair_reuse_review_candidate_missing");
}
if (candidate.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("rag_evidence_treated_as_authority_in_candidate");
if (candidate.locks?.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("candidate_rag_non_authority_lock_missing");
if (candidate.locks?.doesNotTreatRagAsAuthority !== true) preflightBlockers.push("candidate_rag_authority_forbidden_lock_missing");
if (receipt.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("receipt_treats_rag_as_authority");
if (receipt.teacherDecision === "approve_medium_runtime_reuse") {
  if (receipt.ragOutcomeValidationReviewed !== true) preflightBlockers.push("rag_outcome_validation_not_reviewed");
  if (receipt.ragEvidenceReviewed !== true) preflightBlockers.push("rag_evidence_not_reviewed_for_reuse");
  if (receipt.ragNonAuthorityConfirmed !== true) preflightBlockers.push("rag_non_authority_not_confirmed_for_reuse");
  if (receipt.ragReuseBoundaryReviewed !== true) preflightBlockers.push("rag_reuse_boundary_not_reviewed");
}

const reusedValidation =
  preflightBlockers.length === 0
    ? runNode(
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-receipt.mjs",
        [
          "--goal",
          goal,
          "--candidate",
          candidate.sourceEvidence.reusedRepairReuseCandidatePath,
          "--receipt",
          adaptedReceiptPath,
          "--out-dir",
          join(validationDir, "reused-high-reasoning-repair-reuse-review-validation")
        ],
        process.cwd()
      )
    : {
        status: "repaired_reusable_workflow_reuse_review_needs_teacher_review_or_more_evidence",
        decision: receipt.teacherDecision || "needs_teacher_review",
        mediumRuntimeWorkflowEnabled: false,
        mismatchBlocked: false,
        escalateToHighReasoningRepair: false,
        forbiddenDecisionUsed: false,
        blockers: preflightBlockers,
        validationPath: ""
      };

const mediumRuntimeWorkflowEnabled = reusedValidation.mediumRuntimeWorkflowEnabled === true && preflightBlockers.length === 0;
const mismatchBlocked = reusedValidation.mismatchBlocked === true;
const escalateToHighReasoningRepair = reusedValidation.escalateToHighReasoningRepair === true || mismatchBlocked;
const forbiddenDecisionUsed =
  reusedValidation.forbiddenDecisionUsed === true || receipt.teacherDecision === "write_memory" || receipt.teacherDecision === "enable_rule";
const blockers = [...preflightBlockers, ...(reusedValidation.blockers || [])].filter((value, index, arr) => arr.indexOf(value) === index);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_rag_informed_reuse_review_decision"
  : mediumRuntimeWorkflowEnabled
    ? "rag_informed_repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning"
    : escalateToHighReasoningRepair
      ? "rag_informed_repaired_reusable_workflow_reuse_review_to_high_reasoning_contract_repair"
      : "rag_informed_repaired_reusable_workflow_reuse_review_needs_teacher_review_or_more_evidence";
const providerRoleUsePlanTrace = candidate.providerRoleUsePlanTrace || reusedValidation.providerRoleUsePlanTrace || null;
const reusableWorkflowCard = mediumRuntimeWorkflowEnabled
  ? {
      format: "transparent_ai_tlcl_rag_informed_repaired_reusable_workflow_card_v1",
      sourceExistingRepairReuseValidationPath: reusedValidation.validationPath || "",
      workflowFingerprint: candidate.workflowFingerprint || "",
      providerRoleUsePlanTrace,
      mediumRuntimeWorkflowEnabled: true,
      ragEvidenceNonAuthoritative: true,
      ragEvidenceTreatedAsAuthority: false,
      executionStillRequiresApprovalGate: true,
      rollbackStillRequired: true,
      outcomeReviewStillRequired: true,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      packagingUnlockAllowed: false,
      completionClaimAllowed: false
    }
  : null;
const highReasoningRepairHandoff = escalateToHighReasoningRepair
  ? {
      kind: "rag_informed_reusable_workflow_reuse_review_high_reasoning_repair_handoff",
      runtimeTransition: "rag_informed_reuse_review_to_high_reasoning_contract_repair",
      workflowFingerprint: candidate.workflowFingerprint || "",
      providerRoleUsePlanTrace,
      teacherDecision: reusedValidation.decision,
      teacherCorrection: receipt.teacherCorrection || "",
      teacherNote: receipt.teacherNote || "",
      ragEvidenceTreatedAsAuthority: false,
      evidenceToInspect: [
        candidateInput.path,
        candidate.sourceEvidence?.ragOutcomeReviewValidationPath || "",
        candidate.sourceEvidence?.reusedRepairReuseCandidatePath || "",
        reusedValidation.validationPath || ""
      ].filter(Boolean),
      repairTasks: [
        "Use highest-reasoning compile to narrow or repair the reusable workflow boundary, Rule DSL, validator fit, or RAG evidence interpretation.",
        "Keep RAG evidence non-authoritative and require teacher confirmation before the medium runtime can plan another invocation.",
        "Preserve rollback, deterministic validators, approval gate, and fresh outcome review requirements."
      ]
    }
  : null;
const validationPath = join(validationDir, "tlcl-rag-informed-repair-reuse-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-informed-repair-reuse-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_RAG_INFORMED_REPAIR_REUSE_REVIEW_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision: reusedValidation.decision,
  mediumRuntimeWorkflowEnabled,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  providerRoleUsePlanTrace,
  blockers,
  reusableWorkflowCard,
  highReasoningRepairHandoff,
  reusedHighReasoningRepairReuseReviewValidatorInvoked: preflightBlockers.length === 0,
  reusedHighReasoningRepairReuseReviewValidationStatus: reusedValidation.status,
  sourceEvidence: {
    ragReuseReviewCandidatePath: candidateInput.path,
    ragReuseReviewCandidateHash: sha256Object(candidate),
    ragReuseReviewReceiptPath: receiptInput.path,
    ragReuseReviewReceiptHash: sha256Object(receipt),
    reusedRepairReuseCandidatePath: candidate.sourceEvidence?.reusedRepairReuseCandidatePath || "",
    adaptedReceiptPath,
    reusedRepairReuseValidationPath: reusedValidation.validationPath || "",
    providerRoleUsePlanTrace
  },
  blockedTransitions: [
    "run_rag_informed_repaired_workflow_from_reuse_review_validation",
    "treat_rag_as_authority_from_reuse_review_validation",
    "execute_target_software_from_rag_informed_reuse_review_validation",
    "write_memory_from_rag_informed_reuse_review_validation",
    "enable_rule_from_rag_informed_reuse_review_validation",
    "unlock_packaging_from_rag_informed_reuse_review_validation",
    "claim_goal_complete_from_rag_informed_reuse_review_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceCandidate: candidateInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks(mediumRuntimeWorkflowEnabled)
};
const validationReceipt = {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_receipt_v1",
  validationId,
  status,
  decision: reusedValidation.decision,
  mediumRuntimeWorkflowEnabled,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  ragInformedRepairReuse: true,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: true,
  providerRoleUsePlanTrace,
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
writeJson(validationReceiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL RAG-Informed Repair Reuse Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${reusedValidation.decision}`,
    "",
    "This validation may allow a RAG-informed repaired reusable workflow to be used by a later invocation planner, but it does not run workflow code, treat RAG as authority, execute target software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_result_v1",
      validationId,
      status,
      decision: reusedValidation.decision,
      mediumRuntimeWorkflowEnabled,
      mismatchBlocked,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      ragInformedRepairReuse: true,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: true,
      blockers,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      reusedHighReasoningRepairReuseReviewValidatorInvoked: preflightBlockers.length === 0,
      reusedHighReasoningRepairReuseReviewValidationStatus: reusedValidation.status,
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
