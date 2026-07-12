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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slug(value) {
  return (
    String(value || "tlcl-rag-informed-fingerprint-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-fingerprint-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (
    [
      "approve_fingerprint_for_approval_gate_rebuild",
      "approve_rag_informed_fingerprint_for_approval_gate_rebuild",
      "approve_workflow_fingerprint",
      "ready_for_approval_gate_rebuild"
    ].includes(decision)
  ) {
    return "approve_fingerprint_for_approval_gate_rebuild";
  }
  if (["needs_more_high_reasoning_repair", "teacher_correction", "revise_rag_repair_draft"].includes(decision)) {
    return "needs_more_high_reasoning_repair";
  }
  if (["blocked", "fingerprint_review_blocked", "mismatch_blocked"].includes(decision)) return "fingerprint_review_blocked";
  if (
    [
      "accepted",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "execute_target_software",
      "run_medium_runtime",
      "rebuild_approval_gate",
      "claim_goal_complete",
      "claim_all_software_complete",
      "treat_rag_as_authority"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    workflowFingerprintReviewValidationOnly: true,
    ruleLifecycle: "draft_disabled",
    ragEvidenceNonAuthoritative: true,
    mediumRuntimeContinuationBlocked: true,
    approvalGateRebuildStillRequired: true,
    freshOutcomeReviewStillRequired: true,
    doesNotRunMediumRuntime: true,
    doesNotRunApprovedGate: true,
    doesNotRebuildApprovalGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

const goal = argValue("--goal", "Validate teacher review for one RAG-informed repaired TLCL workflow fingerprint.");
const packageInput = readJsonInput(
  argValue("--deterministic-validation-package", argValue("--package", argValue("--validation-package", ""))),
  "--deterministic-validation-package",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_package_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_workflow_fingerprint_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-fingerprint-review-validations"))
);
const validationPackage = packageInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set([
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "execute_target_software",
  "run_medium_runtime",
  "rebuild_approval_gate",
  "claim_goal_complete",
  "claim_all_software_complete",
  "treat_rag_as_authority"
]);
const blockers = [];
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (validationPackage.status !== "rag_informed_deterministic_validation_ready_for_fingerprint_review") {
  blockers.push("rag_informed_deterministic_validation_not_ready_for_fingerprint_review");
}
if (validationPackage.readyForWorkflowFingerprintReview !== true) blockers.push("fingerprint_review_ready_flag_missing");
if (validationPackage.deterministicValidationRun !== true) blockers.push("deterministic_validation_not_run");
if (validationPackage.readyForMediumRuntime !== false) blockers.push("medium_runtime_ready_flag_must_be_false");
if (validationPackage.locks?.workflowFingerprintReviewStillRequired !== true) blockers.push("fingerprint_review_lock_missing");
if (validationPackage.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("medium_runtime_continuation_lock_missing");
if (validationPackage.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_non_authority_lock_missing");
if (validationPackage.locks?.doesNotEnableRules !== true) blockers.push("rule_enablement_lock_missing");
if ((validationPackage.validationSummary?.nonSkippedRuleRows ?? 1) !== 0) blockers.push("draft_disabled_validation_must_not_run_active_rules");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");
if (receipt.ragEvidenceNonAuthoritativeConfirmed !== true) blockers.push("rag_non_authority_not_confirmed");

const sourceFingerprint =
  String(receipt.workflowFingerprintBefore || receipt.workflowFingerprint || validationPackage.sourceEvidence?.draftPackageHash || "").trim() ||
  String(validationPackage.sourceEvidence?.attachmentHash || "").trim();
const repairedFingerprint = String(receipt.workflowFingerprintAfter || receipt.repairedWorkflowFingerprint || sourceFingerprint).trim();
if (decision === "approve_fingerprint_for_approval_gate_rebuild") {
  if (receipt.deterministicValidationReviewed !== true) blockers.push("deterministic_validation_package_not_reviewed");
  if (receipt.validationReportReviewed !== true) blockers.push("validation_report_not_reviewed");
  if (receipt.draftDisabledLifecycleReviewed !== true) blockers.push("draft_disabled_lifecycle_not_reviewed");
  if (receipt.evidenceBoundRulesReviewed !== true) blockers.push("evidence_bound_rules_not_reviewed");
  if (receipt.teacherQuestionsReviewed !== true) blockers.push("teacher_questions_not_reviewed");
  if (receipt.workflowFingerprintReviewed !== true) blockers.push("workflow_fingerprint_not_reviewed");
  if (receipt.routeSemanticsReviewed !== true) blockers.push("route_semantics_not_reviewed");
  if (receipt.approvalGateRebuildStillRequiredConfirmed !== true) blockers.push("approval_gate_rebuild_requirement_not_confirmed");
  if (receipt.freshOutcomeReviewStillRequiredConfirmed !== true) blockers.push("fresh_outcome_review_requirement_not_confirmed");
  if (receipt.mediumRuntimeRetryStillBlockedConfirmed !== true) blockers.push("medium_runtime_retry_block_not_confirmed");
  if (receipt.rollbackPointStillRetained !== true) blockers.push("rollback_point_not_retained");
  if (receipt.teacherApprovedFingerprintReview !== true) blockers.push("teacher_fingerprint_review_approval_missing");
}
if (decision === "needs_more_high_reasoning_repair" && !String(receipt.teacherCorrection || receipt.blockerQuestion || "").trim()) {
  blockers.push("high_reasoning_repair_follow_up_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForApprovalGateRebuild = decision === "approve_fingerprint_for_approval_gate_rebuild" && blockers.length === 0;
const returnToHighReasoningRepair = decision === "needs_more_high_reasoning_repair" && !forbiddenDecisionUsed;
const fingerprintReviewBlocked = decision === "fingerprint_review_blocked" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_rag_informed_fingerprint_review_decision"
  : readyForApprovalGateRebuild
    ? "rag_informed_fingerprint_review_ready_for_approval_gate_rebuild"
    : returnToHighReasoningRepair
      ? "rag_informed_fingerprint_review_return_to_high_reasoning_repair"
      : fingerprintReviewBlocked
        ? "rag_informed_fingerprint_review_blocked_by_teacher_review"
        : "rag_informed_fingerprint_review_needs_teacher_review_or_more_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-rag-informed-fingerprint-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-informed-fingerprint-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_RAG_INFORMED_FINGERPRINT_REVIEW_VALIDATION_START_HERE.md");
const evidenceToInspect = [
  packageInput.path,
  validationPackage.paths?.validationReport || "",
  validationPackage.paths?.sourceDraftPackage || "",
  validationPackage.paths?.sourceAttachment || "",
  receiptInput.path
].filter(Boolean);
const approvalGateRebuildHandoff = readyForApprovalGateRebuild
  ? {
      kind: "rag_informed_fingerprint_review_approval_gate_rebuild_handoff",
      runtimeTransition: "rag_informed_fingerprint_review_to_approval_gate_rebuild",
      validationId,
      deterministicValidationPackagePath: packageInput.path,
      validationReportPath: validationPackage.paths?.validationReport || "",
      attachmentPath: validationPackage.paths?.sourceAttachment || "",
      workflowFingerprintBefore: sourceFingerprint,
      workflowFingerprintAfter: repairedFingerprint,
      fingerprintChanged: receipt.fingerprintChanged === true || (sourceFingerprint && repairedFingerprint && sourceFingerprint !== repairedFingerprint),
      routeSemanticsDecision: receipt.routeSemanticsDecision || "teacher_reviewed_rag_informed_route_semantics",
      proposedRepairTargets: receipt.proposedRepairTargets || [],
      requiredBeforeMediumRuntimeRetry: [
        "rebuild approval gate from reviewed RAG-informed deterministic validation evidence",
        "run only the rebuilt approval-gated medium-runtime path after the gate exists",
        "create a fresh approved-gate outcome review after the later medium-runtime run",
        "keep rollback point retained until teacher confirms the rebuilt route is correct"
      ],
      forbiddenShortcuts: [
        "run_medium_runtime_from_rag_informed_fingerprint_review",
        "rebuild_approval_gate_inside_rag_informed_fingerprint_review",
        "enable_rule_from_rag_informed_fingerprint_review",
        "write_memory_from_rag_informed_fingerprint_review",
        "unlock_packaging_from_rag_informed_fingerprint_review",
        "treat_rag_as_authority_from_fingerprint_review",
        "claim_completion_from_rag_informed_fingerprint_review"
      ]
    }
  : null;
const highReasoningRepairHandoff = returnToHighReasoningRepair || fingerprintReviewBlocked
  ? {
      kind: "rag_informed_fingerprint_back_to_high_reasoning_handoff",
      runtimeTransition: "rag_informed_fingerprint_review_to_high_reasoning_repair",
      teacherDecision: decision,
      teacherCorrection: receipt.teacherCorrection || "",
      blockerQuestion: receipt.blockerQuestion || "",
      teacherNote: receipt.teacherNote || "",
      evidenceToInspect,
      repairTasks: [
        "Revise the RAG-informed workflow fingerprint, route semantics, or Rule DSL bindings.",
        "Keep RAG evidence non-authoritative while the high-reasoning repair is revised.",
        "Re-run deterministic validation before another fingerprint review."
      ]
    }
  : null;
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_workflow_fingerprint_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForApprovalGateRebuild,
  returnToHighReasoningRepair,
  fingerprintReviewBlocked,
  forbiddenDecisionUsed,
  mediumRuntimeRetryAllowed: false,
  ruleActivationAllowed: false,
  blockers,
  approvalGateRebuildHandoff,
  highReasoningRepairHandoff,
  sourceEvidence: {
    deterministicValidationPackagePath: packageInput.path,
    deterministicValidationPackageHash: sha256Object(validationPackage),
    receiptPath: receiptInput.path,
    receiptHash: sha256Object(receipt)
  },
  blockedTransitions: [
    "run_medium_runtime_from_rag_informed_fingerprint_review",
    "run_approved_gate_from_rag_informed_fingerprint_review",
    "rebuild_approval_gate_from_rag_informed_fingerprint_review",
    "execute_target_software_from_rag_informed_fingerprint_review",
    "enable_rule_from_rag_informed_fingerprint_review",
    "write_memory_from_rag_informed_fingerprint_review",
    "unlock_packaging_from_rag_informed_fingerprint_review",
    "treat_rag_as_authority_from_fingerprint_review",
    "claim_goal_complete_from_rag_informed_fingerprint_review"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceDeterministicValidationPackage: packageInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_workflow_fingerprint_review_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForApprovalGateRebuild,
  returnToHighReasoningRepair,
  fingerprintReviewBlocked,
  forbiddenDecisionUsed,
  blockers,
  approvalGateRebuilt: false,
  mediumRuntimeRetryAllowed: false,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  mediumRuntimeContinued: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  packagingUnlocked: false,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  locks: locks()
};

writeJson(validationPath, validation);
writeJson(validationReceiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL RAG-Informed Fingerprint Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation checks teacher review of the RAG-informed workflow fingerprint and route semantics.",
    "It may prepare an approval-gate rebuild handoff, but it does not rebuild the gate, run medium runtime, execute software, write memory, enable rules, unlock packaging, treat RAG as authority, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_workflow_fingerprint_review_validation_result_v1",
      validationId,
      status,
      decision,
      readyForApprovalGateRebuild,
      returnToHighReasoningRepair,
      fingerprintReviewBlocked,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      approvalGateRebuilt: false,
      mediumRuntimeRetryAllowed: false,
      approvedGateRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
      mediumRuntimeContinued: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
