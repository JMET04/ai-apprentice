#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  let parsed = null;
  let sourcePath = "";
  try {
    sourcePath = resolve(text);
    parsed = JSON.parse(readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    try {
      parsed = JSON.parse(text);
      sourcePath = "";
    } catch {
      parsed = null;
    }
  }
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return { value: parsed, path: sourcePath };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["approve_active_promotion_planning", "approve_active_planning", "ready_for_active_promotion_planning"].includes(decision)) {
    return "approve_active_promotion_planning";
  }
  if (["request_high_reasoning_repair", "high_reasoning_repair", "repair", "mismatch"].includes(decision)) {
    return "request_high_reasoning_repair";
  }
  if (["request_more_evidence", "needs_more_evidence", "more_evidence"].includes(decision)) return "request_more_evidence";
  if (decision === "blocked") return "blocked";
  if (
    [
      "accepted",
      "activate_rule",
      "enable_rule",
      "promote_rule",
      "compile_active_package",
      "execute_software",
      "write_memory",
      "fetch_rag",
      "unlock_packaging",
      "claim_complete",
      "package_release"
    ].includes(decision)
  ) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks({ approved = false } = {}) {
  return {
    reviewOnly: true,
    validationOnly: true,
    activePromotionPlanningApproved: approved,
    activePromotionApplied: false,
    activeRulePackageCompiled: false,
    activeCompilationAllowedHere: false,
    ruleEnabled: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    modelInvoked: false,
    ragFetched: false,
    externalFetchPerformed: false,
    packagingUnlocked: false,
    accepted: false,
    goalComplete: false
  };
}

const transitionInput = readJsonInput(
  argValue("--transition-package", argValue("--package", "")),
  "--transition-package",
  "transparent_ai_real_case_review_only_transition_package_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_real_case_active_promotion_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "real-case-active-promotion-review-validations"))
);
const transitionPackage = transitionInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbidden = new Set([
  "accepted",
  "activate_rule",
  "enable_rule",
  "promote_rule",
  "compile_active_package",
  "execute_software",
  "write_memory",
  "fetch_rag",
  "unlock_packaging",
  "claim_complete",
  "package_release"
]);
const blockers = [];
function block(code, message) {
  blockers.push({ code, message });
}

if (receipt.sourceTransitionPackageId !== transitionPackage.transitionId) {
  block("source_transition_package_id_mismatch", "Receipt sourceTransitionPackageId must match transitionPackage.transitionId.");
}
if (receipt.sourceTransitionPackageHash !== hashText(JSON.stringify(transitionPackage))) {
  block("source_transition_package_hash_mismatch", "Receipt sourceTransitionPackageHash must match the transition package.");
}
if (receipt.executeNow !== false) block("receipt_execute_lock_missing", "Receipt must keep executeNow=false.");
if (receipt.reviewOnly !== true) block("receipt_review_only_missing", "Receipt must keep reviewOnly=true.");
if (receipt.blockedActionsConfirmed !== true) block("blocked_actions_not_confirmed", "Teacher must confirm blocked actions.");
if (forbidden.has(decision)) block("forbidden_teacher_decision", `Forbidden teacher decision: ${decision}`);
if (
  transitionPackage.status !== "ready_for_teacher_review_only_transition_package_review" ||
  transitionPackage.ok !== true ||
  transitionPackage.appliedTransitionScope !== "staged_rule_copies_only" ||
  transitionPackage.sourceRuleFilesModified !== false ||
  transitionPackage.reviewOnlyRuleCount < 1 ||
  !transitionPackage.compiledReviewOnlyRulePackagePath ||
  transitionPackage.nextReview?.requiresSeparateActiveGate !== true ||
  transitionPackage.nextReview?.mayPromoteActiveRules !== false ||
  transitionPackage.nextReview?.mayCompileActiveRulePackage !== false ||
  transitionPackage.locks?.reviewOnlyRulePackageCompiled !== true ||
  transitionPackage.locks?.activeRulePackageCompiled !== false ||
  transitionPackage.locks?.ruleEnabled !== false ||
  transitionPackage.locks?.packagingUnlocked !== false
) {
  block("source_transition_package_not_locked", "Transition package must be a locked review_only package awaiting active promotion review.");
}

if (decision === "approve_active_promotion_planning") {
  if (receipt.transitionPackageReviewed !== true) block("transition_package_not_reviewed", "Teacher must review transition package.");
  if (receipt.reviewOnlyRulesReviewed !== true) block("review_only_rules_not_reviewed", "Teacher must review review_only rules.");
  if (receipt.sourceDraftDisabledPreservationReviewed !== true) {
    block("source_draft_disabled_preservation_not_reviewed", "Teacher must review source draft_disabled preservation.");
  }
  if (receipt.activePromotionPlanningOnlyConfirmed !== true) {
    block("active_promotion_planning_only_not_confirmed", "Teacher must confirm this only prepares active promotion planning.");
  }
  if (receipt.activeCompilationStillSeparateConfirmed !== true) {
    block("active_compilation_separate_gate_not_confirmed", "Teacher must confirm active compilation remains a separate gate.");
  }
  if (receipt.separateExecutionGateRequiredConfirmed !== true) {
    block("separate_execution_gate_not_confirmed", "Teacher must confirm execution requires a later separate gate.");
  }
  if (receipt.teacherConfirmedNoExecution !== true) block("no_execution_not_confirmed", "Teacher must confirm no execution now.");
  if (receipt.rollbackRetained !== true) block("rollback_not_retained", "Teacher must confirm retained rollback point.");
}
if ((decision === "request_high_reasoning_repair" || decision === "request_more_evidence") && !String(receipt.teacherNotes || "").trim()) {
  block("teacher_note_required", `${decision} requires teacherNotes.`);
}

const forbiddenDecisionUsed = forbidden.has(decision);
const readyForActivePromotionPlanning = decision === "approve_active_promotion_planning" && !forbiddenDecisionUsed && blockers.length === 0;
const routesToHighReasoningRepair = decision === "request_high_reasoning_repair" && !forbiddenDecisionUsed && blockers.length === 0;
const routesToMoreEvidence = decision === "request_more_evidence" && !forbiddenDecisionUsed && blockers.length === 0;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_real_case_active_promotion_review_decision"
  : readyForActivePromotionPlanning
    ? "real_case_active_promotion_review_ready_for_active_package_planning"
    : routesToHighReasoningRepair
      ? "real_case_active_promotion_review_routes_to_high_reasoning_repair"
      : routesToMoreEvidence
        ? "real_case_active_promotion_review_waiting_for_more_evidence"
        : "real_case_active_promotion_review_needs_teacher_review";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${decision}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "real-case-active-promotion-review-validation.json");
const receiptRecordPath = join(validationDir, "real-case-active-promotion-review-receipt.json");
const readmePath = join(validationDir, "REAL_CASE_ACTIVE_PROMOTION_REVIEW_VALIDATION_START_HERE.md");
const validationLocks = locks({ approved: readyForActivePromotionPlanning });

const activePromotionPlanningHandoff = readyForActivePromotionPlanning
  ? {
      format: "transparent_ai_real_case_active_promotion_planning_handoff_v1",
      transitionId: transitionPackage.transitionId,
      reportId: transitionPackage.reportId || "",
      caseType: transitionPackage.caseType || "",
      transitionPackagePath: transitionInput.path,
      compiledReviewOnlyRulePackagePath: transitionPackage.compiledReviewOnlyRulePackagePath,
      stagedRulesDir: transitionPackage.stagedRulesDir,
      reviewOnlyRuleCount: transitionPackage.reviewOnlyRuleCount,
      sourceRuleFilesModified: false,
      activePromotionPlanningApproved: true,
      activePackageCompilationAllowedHere: false,
      requiresSeparateActiveCompilationGate: true,
      requiresSeparateExecutionGate: true,
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const highReasoningRepairHandoff = routesToHighReasoningRepair
  ? {
      format: "transparent_ai_real_case_active_promotion_high_reasoning_repair_handoff_v1",
      transitionId: transitionPackage.transitionId || "",
      teacherNotes: receipt.teacherNotes || "",
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;
const moreEvidenceHandoff = routesToMoreEvidence
  ? {
      format: "transparent_ai_real_case_active_promotion_more_evidence_handoff_v1",
      transitionId: transitionPackage.transitionId || "",
      teacherNotes: receipt.teacherNotes || "",
      requestedEvidenceKinds: ["review_only_rule_row", "validator_expectation", "active_promotion_risk", "rollback_point"],
      executeNow: false,
      copyOnly: true,
      reviewOnly: true
    }
  : null;

const result = {
  ok: !forbiddenDecisionUsed && blockers.length === 0,
  format: "transparent_ai_real_case_active_promotion_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  status,
  decision,
  readyForActivePromotionPlanning,
  routesToHighReasoningRepair,
  routesToMoreEvidence,
  forbiddenDecisionUsed,
  blockers,
  activePromotionPlanningHandoff,
  highReasoningRepairHandoff,
  moreEvidenceHandoff,
  blockedActions: [
    "activate_rule_from_active_promotion_review",
    "compile_active_package_from_active_promotion_review",
    "execute_software_from_active_promotion_review",
    "write_memory_from_active_promotion_review",
    "fetch_rag_from_active_promotion_review",
    "unlock_packaging_from_active_promotion_review",
    "claim_completion_from_active_promotion_review"
  ],
  locks: validationLocks,
  paths: {
    validation: validationPath,
    receiptRecord: receiptRecordPath,
    readme: readmePath,
    sourceTransitionPackage: transitionInput.path,
    sourceReceipt: receiptInput.path
  }
};

writeJson(validationPath, result);
writeJson(receiptRecordPath, receipt);
writeFileSync(
  readmePath,
  [
    "# Real-Case Active Promotion Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation can only prepare active package planning. It does not compile active packages, enable rules, run software, write memory, fetch RAG, unlock packaging, accept technology, or claim completion.",
    "",
    `Validation JSON: ${validationPath}`,
    ""
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: result.ok,
      format: "transparent_ai_real_case_active_promotion_review_validation_result_v1",
      status,
      validationPath,
      receiptRecordPath,
      readmePath,
      readyForActivePromotionPlanning,
      activePromotionPlanningHandoff,
      highReasoningRepairHandoff,
      moreEvidenceHandoff,
      blockers,
      executeNow: false,
      locks: validationLocks
    },
    null,
    2
  )
);
