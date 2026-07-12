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
    String(value || "tlcl-rag-informed-repair-draft-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-repair-draft-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (
    [
      "approve_rag_informed_repair_for_validation",
      "approve_repair_for_validation",
      "approve_deterministic_validation",
      "ready_for_deterministic_validation"
    ].includes(decision)
  ) {
    return "approve_rag_informed_repair_for_validation";
  }
  if (["needs_more_high_reasoning_repair", "teacher_correction", "revise_rag_repair_draft", "repair_contract"].includes(decision)) {
    return "needs_more_high_reasoning_repair";
  }
  if (["blocked", "repair_draft_blocked", "evidence_blocked"].includes(decision)) return "rag_informed_repair_draft_blocked";
  if (
    [
      "accepted",
      "enable_rule",
      "write_memory",
      "unlock_packaging",
      "execute_target_software",
      "run_medium_runtime",
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
    repairDraftReviewValidationOnly: true,
    readyForDeterministicValidationOnly: true,
    ruleLifecycle: "draft_disabled",
    ragEvidenceNonAuthoritative: true,
    mediumRuntimeContinuationBlocked: true,
    doesNotRunDeterministicValidation: true,
    doesNotRunWorkflow: true,
    doesNotRunApprovedGate: true,
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

const goal = argValue("--goal", "Validate teacher review for one RAG-informed TLCL repair draft package.");
const draftInput = readJsonInput(
  argValue("--draft-package", argValue("--draft", argValue("--repair-draft-package", ""))),
  "--draft-package",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-repair-draft-review-validations"))
);
const draft = draftInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set([
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "execute_target_software",
  "run_medium_runtime",
  "claim_goal_complete",
  "claim_all_software_complete",
  "treat_rag_as_authority"
]);
const blockers = [];
if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (draft.status !== "tlcl_rag_informed_high_reasoning_repair_draft_package_ready_for_teacher_review") {
  blockers.push("rag_informed_repair_draft_package_not_ready_for_teacher_review");
}
if (!Array.isArray(draft.draftDisabledRules) || draft.draftDisabledRules.length < 1) {
  blockers.push("draft_disabled_rag_repair_rule_missing");
}
if (!String(draft.compiledRulePackagePath || "").trim()) blockers.push("compiled_disabled_rule_package_missing");
if (!Array.isArray(draft.teacherQuestionHandoff) || draft.teacherQuestionHandoff.length < 1) {
  blockers.push("teacher_question_handoff_missing");
}
if (draft.locks?.ruleLifecycle !== "draft_disabled") blockers.push("draft_lifecycle_lock_missing");
if (draft.locks?.evidenceOnly !== true) blockers.push("evidence_only_lock_missing");
if (draft.locks?.mediumRuntimeContinuationBlocked !== true) blockers.push("medium_runtime_continuation_lock_missing");
if (draft.locks?.doesNotEnableRules !== true) blockers.push("rule_enablement_lock_missing");
if (draft.locks?.doesNotWriteMemory !== true) blockers.push("memory_lock_missing");
if (draft.locks?.doesNotUnlockPackaging !== true) blockers.push("packaging_unlock_lock_missing");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");
if (receipt.ragEvidenceNonAuthoritativeConfirmed !== true) blockers.push("rag_non_authority_not_confirmed");
if (decision === "approve_rag_informed_repair_for_validation") {
  if (receipt.draftPackageReviewed !== true) blockers.push("draft_package_not_reviewed");
  if (receipt.draftDisabledRulesReviewed !== true) blockers.push("draft_disabled_rules_not_reviewed");
  if (receipt.evidenceRowsReviewed !== true) blockers.push("evidence_rows_not_reviewed");
  if (receipt.teacherQuestionsReviewed !== true) blockers.push("teacher_questions_not_reviewed");
  if (receipt.compiledDisabledRulePackageReviewed !== true) blockers.push("compiled_disabled_rule_package_not_reviewed");
  if (receipt.deterministicValidationPlanReviewed !== true) blockers.push("deterministic_validation_plan_not_reviewed");
  if (receipt.deterministicValidationStillRequiredConfirmed !== true) blockers.push("deterministic_validation_requirement_not_confirmed");
  if (receipt.mediumRuntimeRetryStillBlockedConfirmed !== true) blockers.push("medium_runtime_retry_block_not_confirmed");
  if (receipt.rollbackPointStillRetained !== true) blockers.push("rollback_point_not_retained");
  if (receipt.teacherApprovedDeterministicValidation !== true) blockers.push("teacher_deterministic_validation_approval_missing");
}
if (decision === "needs_more_high_reasoning_repair" && !String(receipt.teacherCorrection || receipt.blockerQuestion || "").trim()) {
  blockers.push("high_reasoning_repair_follow_up_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForDeterministicValidation = decision === "approve_rag_informed_repair_for_validation" && blockers.length === 0;
const returnToHighReasoningRepair = decision === "needs_more_high_reasoning_repair" && !forbiddenDecisionUsed;
const repairDraftBlocked = decision === "rag_informed_repair_draft_blocked" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_rag_informed_repair_draft_review_decision"
  : readyForDeterministicValidation
    ? "rag_informed_repair_draft_ready_for_deterministic_validation"
    : returnToHighReasoningRepair
      ? "rag_informed_repair_draft_return_to_high_reasoning_repair"
      : repairDraftBlocked
        ? "rag_informed_repair_draft_blocked_by_teacher_review"
        : "rag_informed_repair_draft_needs_teacher_review_or_more_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-rag-informed-repair-draft-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-informed-repair-draft-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_RAG_INFORMED_REPAIR_DRAFT_REVIEW_VALIDATION_START_HERE.md");
const evidenceToInspect = [
  draftInput.path,
  draft.compiledRulePackagePath || "",
  draft.compileReportPath || "",
  draft.lockPath || "",
  draft.sourceEvidence?.attachmentPath || "",
  receiptInput.path
].filter(Boolean);
const deterministicValidationHandoff = readyForDeterministicValidation
  ? {
      kind: "rag_informed_repair_draft_deterministic_validation_handoff",
      runtimeTransition: "rag_informed_repair_draft_review_to_deterministic_validation",
      draftId: draft.draftId || validationId,
      draftPackagePath: draftInput.path,
      compiledRulePackagePath: draft.compiledRulePackagePath || "",
      attachmentPath: draft.sourceEvidence?.attachmentPath || "",
      validationInputs: draft.deterministicValidationPlan?.validationInputs || [],
      validatorExpectations: draft.deterministicValidationPlan?.validatorExpectations || [],
      requiredBeforeMediumRuntimeRetry: true,
      nextValidationTasks: [
        "Run deterministic Rule DSL and disabled Rule Package checks against the reviewed RAG-informed repair draft.",
        "Verify every proposed repair cites reviewed RAG evidence and keeps unresolved logic as teacher questions.",
        "Compare the relevant TLCL contract fields, validators, and workflow fingerprint before any medium-runtime retry.",
        "Require a fresh approval gate and fresh outcome review after any later medium-runtime run."
      ],
      forbiddenShortcuts: [
        "enable_rule_from_rag_informed_repair_draft_review",
        "write_memory_from_rag_informed_repair_draft_review",
        "execute_target_software_from_rag_informed_repair_draft_review",
        "treat_rag_as_authority_from_repair_draft_review",
        "reuse_medium_runtime_from_rag_informed_repair_draft_review"
      ]
    }
  : null;
const highReasoningRepairHandoff = returnToHighReasoningRepair || repairDraftBlocked
  ? {
      kind: "rag_informed_repair_draft_back_to_high_reasoning_handoff",
      runtimeTransition: "rag_informed_repair_draft_review_to_high_reasoning_repair",
      draftId: draft.draftId || validationId,
      teacherDecision: decision,
      teacherCorrection: receipt.teacherCorrection || "",
      blockerQuestion: receipt.blockerQuestion || "",
      teacherNote: receipt.teacherNote || "",
      evidenceToInspect,
      repairTasks: [
        "Revise the draft_disabled RAG-informed Rule Card or Rule DSL before deterministic validation.",
        "Resolve or preserve teacher questions instead of guessing from RAG evidence.",
        "Keep medium runtime blocked until the repaired draft is reviewed again."
      ]
    }
  : null;
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForDeterministicValidation,
  readyForMediumRuntime: false,
  returnToHighReasoningRepair,
  repairDraftBlocked,
  forbiddenDecisionUsed,
  blockers,
  deterministicValidationHandoff,
  highReasoningRepairHandoff,
  sourceEvidence: {
    draftPackagePath: draftInput.path,
    draftPackageHash: sha256Object(draft),
    receiptPath: receiptInput.path,
    receiptHash: sha256Object(receipt),
    attachmentPath: draft.sourceEvidence?.attachmentPath || "",
    attachmentHash: draft.sourceEvidence?.attachmentHash || ""
  },
  blockedTransitions: [
    "run_deterministic_validation_from_rag_informed_repair_draft_review",
    "run_medium_runtime_from_rag_informed_repair_draft_review",
    "execute_target_software_from_rag_informed_repair_draft_review",
    "enable_rule_from_rag_informed_repair_draft_review",
    "write_memory_from_rag_informed_repair_draft_review",
    "unlock_packaging_from_rag_informed_repair_draft_review",
    "claim_goal_complete_from_rag_informed_repair_draft_review",
    "treat_rag_as_authority_from_repair_draft_review"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceDraftPackage: draftInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForDeterministicValidation,
  readyForMediumRuntime: false,
  returnToHighReasoningRepair,
  repairDraftBlocked,
  forbiddenDecisionUsed,
  blockers,
  deterministicValidationRun: false,
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
    "# TLCL RAG-Informed Repair Draft Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation checks teacher review of a draft_disabled RAG-informed repair package. It may prepare a deterministic validation handoff, but it does not run validation, execute software, continue medium runtime, write memory, enable rules, unlock packaging, treat RAG as authority, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_validation_result_v1",
      validationId,
      status,
      decision,
      readyForDeterministicValidation,
      readyForMediumRuntime: false,
      returnToHighReasoningRepair,
      repairDraftBlocked,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      deterministicValidationRun: false,
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
