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
    String(value || "tlcl-reusable-workflow-candidate")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-candidate"
  );
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function providerRoleUsePlanTraceFromValidation(validation) {
  return (
    validation?.matchedContractHandoff?.providerRoleUsePlanTrace ||
    validation?.sourceEvidence?.providerRoleUsePlanTrace ||
    {}
  );
}

function locks() {
  return {
    reviewOnly: true,
    candidateBuilderOnly: true,
    doesNotEnableWorkflow: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    workflowEnabled: false,
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

const goal = argValue("--goal", "Build a bounded medium-runtime reusable workflow candidate from one matched TLCL outcome.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--outcome-validation", "")),
  "--validation",
  "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_validation_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-reusable-workflow-candidates"))
);
const validation = validationInput.value;
const blockers = [];
if (validation.status !== "execution_outcome_matched_contract_waiting_for_rule_activation_review") {
  blockers.push("outcome_validation_not_matched_contract");
}
if (validation.outcomeMatchedContract !== true) blockers.push("outcome_match_confirmation_missing");
if (validation.locks?.goalComplete !== false) blockers.push("outcome_validation_completion_lock_missing");
if (validation.locks?.doesNotEnableRules !== true) blockers.push("outcome_validation_rule_lock_missing");
if (!validation.matchedContractHandoff) blockers.push("matched_contract_handoff_missing");

const candidateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const candidateDir = join(outRoot, candidateId);
const candidatePath = join(candidateDir, "tlcl-medium-runtime-reusable-workflow-candidate.json");
const receiptTemplatePath = join(candidateDir, "tlcl-medium-runtime-reusable-workflow-activation-receipt-template.json");
const readmePath = join(candidateDir, "TLCL_MEDIUM_RUNTIME_REUSABLE_WORKFLOW_CANDIDATE_START_HERE.md");
const workflowFingerprint = sha256Object({
  sourceRunId: validation.matchedContractHandoff?.sourceRunId || "",
  sourceEvidence: validation.sourceEvidence || {},
  matchedContractHandoff: validation.matchedContractHandoff || null
});
const status = blockers.length ? "blocked_before_reusable_workflow_candidate" : "reusable_workflow_candidate_ready_for_teacher_activation_review";
const receiptTemplate = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_activation_receipt_v1",
  candidateId,
  sourceCandidatePath: candidatePath,
  teacherDecision: "needs_teacher_review",
  candidateReviewed: false,
  contractBoundaryReviewed: false,
  sourceOutcomeEvidenceReviewed: false,
  deterministicValidatorsStillRequiredConfirmed: false,
  approvalGateStillRequiredConfirmed: false,
  rollbackPointStillRetained: false,
  teacherApprovedBoundedReuse: false,
  teacherCorrection: "",
  teacherNote: "",
  blockedActionsConfirmed: true,
  locks: locks()
};
const candidate = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_candidate_v1",
  candidateId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  workflowFingerprint,
  runtimeTier: "medium_reasoning_runtime",
  mediumRuntimeReuseCandidate: blockers.length === 0,
  mediumRuntimeWorkflowEnabled: false,
  boundedReuseScope: {
    sourceOutcomeValidationPath: validationInput.path,
    sourceRunId: validation.matchedContractHandoff?.sourceRunId || "",
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromValidation(validation),
    allowedOnlyWhenWorkflowFingerprintMatches: true,
    everyFutureRunRequiresApprovalGate: true,
    everyFutureRunRequiresRollback: true,
    everyFutureRunRequiresOutcomeReview: true
  },
  requiredBeforeEveryReuse: [
    "same TLCL contract and route fingerprint",
    "deterministic validators still pass",
    "teacher-reviewed approval gate is ready",
    "rollback point is retained",
    "post-run outcome review is created again"
  ],
  blockedTransitions: [
    "run_workflow_from_candidate_builder",
    "execute_target_software_from_candidate_builder",
    "write_memory_from_candidate_builder",
    "enable_rule_from_candidate_builder",
    "unlock_packaging_from_candidate_builder",
    "claim_goal_complete_from_candidate_builder"
  ],
  blockers,
  defaultReceipt: receiptTemplate,
  sourceEvidence: {
    outcomeValidationPath: validationInput.path,
    outcomeValidationHash: sha256Object(validation),
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromValidation(validation)
  },
  paths: {
    candidate: candidatePath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceValidation: validationInput.path
  },
  locks: locks()
};

writeJson(candidatePath, candidate);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Reusable Workflow Candidate",
    "",
    `Status: ${status}`,
    `Workflow fingerprint: ${workflowFingerprint}`,
    "",
    "This builder creates a bounded reuse candidate from one teacher-matched TLCL approved-gate outcome.",
    "It does not enable the workflow, run software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_candidate_builder_result_v1",
      candidateId,
      status,
      workflowFingerprint,
      candidatePath,
      receiptTemplatePath,
      readmePath,
      mediumRuntimeReuseCandidate: candidate.mediumRuntimeReuseCandidate,
      mediumRuntimeWorkflowEnabled: false,
      blockers,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      workflowEnabled: false,
      packagingGated: true,
      goalComplete: false
    },
    null,
    2
  )
);
