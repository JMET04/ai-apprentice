#!/usr/bin/env node
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

function readOptionalJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
  return readJsonInput(text, label, expectedFormat);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return (
    String(value || "teacher-method-reuse-result-proof-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 84) || "teacher-method-reuse-result-proof-validation"
  );
}

function commandLine(script, args = []) {
  const parts = ["node", `plugins\\transparent-ai-apprentice\\scripts\\${script}`];
  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === "") continue;
    if (value === true) parts.push(flag);
    else parts.push(flag, `"${String(value).replace(/"/g, '\\"')}"`);
  }
  return parts.join(" ");
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_reuse_result_confirmed", "confirmed", "approve_reuse_result"].includes(decision)) {
    return "teacher_reuse_result_confirmed";
  }
  if (["teacher_reuse_result_needs_repair", "repair", "correction"].includes(decision)) {
    return "teacher_reuse_result_needs_repair";
  }
  if (["blocked", "needs_teacher_review"].includes(decision)) return decision;
  if (["accepted", "execute_now", "run_now", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    validationDoesNotRunCommands: true,
    validationDoesNotRegisterTask: true,
    validationDoesNotLaunchRunner: true,
    validationDoesNotExecuteTargetSoftware: true,
    validationDoesNotCaptureScreenshots: true,
    validationDoesNotReadFullLogs: true,
    validationDoesNotWriteMemory: true,
    validationDoesNotEnableRules: true,
    scheduledTaskRegistered: false,
    runnerLaunched: false,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    mediumRuntimeReuseEnabled: false,
    highReasoningRepairTriggered: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function nonPlaceholder(value) {
  const text = String(value || "").trim();
  return text && !text.includes("<") && !text.includes("__");
}

function evidenceExistsOrInline(value) {
  const text = String(value || "").trim();
  if (!nonPlaceholder(text)) return false;
  return existsSync(text) || text.length >= 12;
}

const goal = argValue("--goal", "Validate teacher method reuse result proof receipt.");
const validationInput = readJsonInput(
  argValue("--contract-receipt-validation", argValue("--validation", "")),
  "--contract-receipt-validation",
  "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_teacher_method_reuse_result_proof_receipt_v1"
);
const contractInput = readOptionalJsonInput(
  argValue("--contract", argValue("--teacher-method-contract", "")),
  "--contract",
  "transparent_ai_teacher_method_execution_learning_contract_v1"
);
const outputRoot = resolve(
  argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "teacher-method-reuse-result-proof-validations"))
);
mkdirSync(outputRoot, { recursive: true });

const contractReceiptValidation = validationInput.value;
const receipt = receiptInput.value;
const contract = contractInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set([
  "accepted",
  "execute_now",
  "run_now",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_complete"
]);
const blockers = [];
if (forbiddenDecisions.has(decision)) blockers.push(`forbidden_teacher_decision:${decision}`);
if (contractReceiptValidation.readyForReuseResultProof !== true) {
  blockers.push("contract_receipt_validation_not_ready_for_reuse_result_proof");
}
if (contractReceiptValidation.status !== "teacher_method_contract_confirmed_waiting_for_reuse_result_proof") {
  blockers.push(`unexpected_contract_receipt_validation_status:${contractReceiptValidation.status || "missing"}`);
}
if (contract && contract.format !== "transparent_ai_teacher_method_execution_learning_contract_v1") {
  blockers.push("contract_wrong_format");
}

const confirmedDecision = decision === "teacher_reuse_result_confirmed";
const repairDecision = decision === "teacher_reuse_result_needs_repair";
if (confirmedDecision) {
  if (receipt.teacherReviewedBeforeAfter !== true) blockers.push("teacher_before_after_review_missing");
  if (receipt.teacherObservedImprovement !== true) blockers.push("teacher_observed_improvement_missing");
  if (receipt.ambiguityReducedOrAccuracyImproved !== true) blockers.push("ambiguity_or_accuracy_improvement_missing");
  if (!evidenceExistsOrInline(receipt.previousRunEvidencePath)) blockers.push("previous_run_evidence_missing_or_placeholder");
  if (!evidenceExistsOrInline(receipt.reuseRunEvidencePath)) blockers.push("reuse_run_evidence_missing_or_placeholder");
  if (!nonPlaceholder(receipt.improvementSummary)) blockers.push("improvement_summary_missing");
  if (String(receipt.remainingMismatchOrCorrection || "").trim()) blockers.push("remaining_mismatch_requires_high_reasoning_repair");
  if (receipt.rollbackPointRetained !== true) blockers.push("rollback_point_retained_missing");
  if (receipt.contractStillMatchesTeacherMethod !== true) blockers.push("contract_still_matches_teacher_method_not_confirmed");
  if (receipt.mediumRuntimeReuseScopeReviewed !== true) blockers.push("medium_runtime_reuse_scope_not_reviewed");
  if (receipt.highReasoningRepairRouteForFailures !== true) blockers.push("high_reasoning_repair_route_for_failures_missing");
  if (receipt.ragEvidenceNonAuthoritativeConfirmed !== true) blockers.push("rag_evidence_non_authoritative_not_confirmed");
  if (!nonPlaceholder(receipt.teacherConfirmationText)) blockers.push("teacher_confirmation_text_missing");
}
if (repairDecision && !nonPlaceholder(receipt.remainingMismatchOrCorrection)) {
  blockers.push("repair_decision_requires_teacher_correction_or_mismatch");
}

const readyForMediumRuntimeReuseGate = confirmedDecision && blockers.length === 0;
const repairRequired = repairDecision || blockers.includes("remaining_mismatch_requires_high_reasoning_repair");
const status = forbiddenDecisions.has(decision)
  ? "blocked_for_forbidden_teacher_method_reuse_result_decision"
  : readyForMediumRuntimeReuseGate
    ? "teacher_method_reuse_result_confirmed_ready_for_medium_runtime_reuse_gate"
    : repairRequired
      ? "teacher_method_reuse_result_routes_to_high_reasoning_repair"
      : "teacher_method_reuse_result_needs_teacher_review_or_more_evidence";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const validationDir = join(outputRoot, validationId);
mkdirSync(validationDir, { recursive: true });
const validationPath = join(validationDir, "teacher-method-reuse-result-proof-validation.json");
const readmePath = join(validationDir, "TEACHER_METHOD_REUSE_RESULT_PROOF_VALIDATION_START_HERE.md");
const lockState = locks();
const validation = {
  ok: !forbiddenDecisions.has(decision),
  format: "transparent_ai_teacher_method_reuse_result_proof_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForMediumRuntimeReuseGate,
  repairRequired,
  blockers,
  sourceEvidence: {
    contractReceiptValidation: validationInput.path,
    contract: contractInput.path || contractReceiptValidation.sourceEvidence?.contract || "",
    receipt: receiptInput.path,
    previousRunEvidencePath: receipt.previousRunEvidencePath || "",
    reuseRunEvidencePath: receipt.reuseRunEvidencePath || "",
    rollbackPoint: receipt.rollbackPoint || contractReceiptValidation.sourceEvidence?.rollbackPoint || ""
  },
  proofSummary: {
    teacherReviewedBeforeAfter: receipt.teacherReviewedBeforeAfter === true,
    teacherObservedImprovement: receipt.teacherObservedImprovement === true,
    ambiguityReducedOrAccuracyImproved: receipt.ambiguityReducedOrAccuracyImproved === true,
    improvementSummary: receipt.improvementSummary || "",
    remainingMismatchOrCorrection: receipt.remainingMismatchOrCorrection || ""
  },
  nextMediumRuntimeReuseGate: readyForMediumRuntimeReuseGate
    ? {
        status: "ready_for_separate_medium_runtime_reuse_gate_preparation",
        allowedOnlyAfter: [
          "teacher confirmed before/after improvement",
          "rollback point retained",
          "RAG remains evidence only",
          "failure route returns to high reasoning repair"
        ],
        commandTemplate: commandLine("create-teacher-method-low-token-workflow-gate-package.mjs", [
          ["--refresh", "<original-goal-current-status-refresh.json>"],
          ["--contract", contractInput.path || contractReceiptValidation.sourceEvidence?.contract || "<teacher-method-contract.json>"],
          ["--output-dir", join(validationDir, "teacher-method-low-token-workflow-gate-package")]
        ])
      }
    : null,
  highReasoningRepairHandoff: repairRequired
    ? {
        status: "route_teacher_method_back_to_high_reasoning_repair",
        teacherCorrection: receipt.remainingMismatchOrCorrection || "",
        reason: "The teacher method reuse result is not proven clean enough for medium-runtime reuse."
      }
    : null,
  completionBoundary: {
    adaptAnyTeacherMethodProofCandidate: readyForMediumRuntimeReuseGate,
    completionAllowed: false,
    reason:
      "A confirmed reuse result can prove the teacher-method lane, but the full original goal still requires all-software unattended evidence, spatial/depth evidence, and teacher-confirmed execution evidence."
  },
  blockedTransitions: [
    "execute_software_from_teacher_method_reuse_result_validation",
    "write_memory_from_teacher_method_reuse_result_validation",
    "enable_rule_from_teacher_method_reuse_result_validation",
    "enable_medium_runtime_reuse_without_separate_gate",
    "claim_goal_complete_from_teacher_method_reuse_result_validation"
  ],
  locks: lockState,
  paths: {
    validation: validationPath,
    readme: readmePath
  }
};

writeJson(validationPath, validation);
writeFileSync(
  readmePath,
  [
    "# Teacher Method Reuse Result Proof Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Ready for medium-runtime reuse gate: ${readyForMediumRuntimeReuseGate}`,
    "",
    "This validator only checks teacher-reviewed reuse-result proof. It does not execute software, read logs, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n") + "\n",
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: !forbiddenDecisions.has(decision),
      format: "transparent_ai_teacher_method_reuse_result_proof_validation_result_v1",
      validationPath,
      readmePath,
      status,
      decision,
      readyForMediumRuntimeReuseGate,
      repairRequired,
      blockers,
      locks: lockState
    },
    null,
    2
  )
);

if (forbiddenDecisions.has(decision)) process.exit(1);
