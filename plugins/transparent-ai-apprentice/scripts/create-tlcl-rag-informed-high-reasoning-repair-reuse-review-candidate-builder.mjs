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
    String(value || "tlcl-rag-informed-repair-reuse-review-candidate")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-repair-reuse-review-candidate"
  );
}

function locks() {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    candidateBuilderOnly: true,
    reusesExistingHighReasoningRepairReuseReviewCandidateBuilder: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    doesNotEnableWorkflow: true,
    doesNotRunWorkflow: true,
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

function runNode(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function adaptRagOutcomeValidation(validation) {
  return {
    ...validation,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_validation_v1",
    status:
      validation.status === "rag_informed_repair_outcome_matched_contract_waiting_for_reuse_review"
        ? "reusable_workflow_repair_invocation_outcome_matched_contract_waiting_for_reuse_review"
        : validation.status,
    matchedRepairOutcomeHandoff: {
      kind: "reusable_workflow_repair_fresh_outcome_matched_contract_handoff",
      runtimeTransition: "repaired_reusable_workflow_fresh_outcome_waiting_for_reuse_review",
      sourceRepairRunId: validation.matchedRagOutcomeHandoff?.sourceRagInformedRunId || validation.validationId || "",
      executesNow: false,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      nextRequiredReview:
        "Teacher must review whether this RAG-informed repaired reusable workflow may be retained for bounded medium-runtime planning."
    },
    locks: {
      ...(validation.locks || {}),
      doesNotEnableRules: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    }
  };
}

const goal = argValue("--goal", "Build a RAG-informed repair reuse review candidate from one matched fresh outcome.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--rag-outcome-validation", argValue("--outcome-review-validation", ""))),
  "--validation",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_validation_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-repair-reuse-review-candidates"))
);
const validation = validationInput.value;
const candidateId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const candidateDir = join(outRoot, candidateId);
const adaptedValidationPath = join(candidateDir, "adapted-high-reasoning-repair-outcome-review-validation.json");
writeJson(adaptedValidationPath, adaptRagOutcomeValidation(validation));

const blockers = [];
if (validation.status !== "rag_informed_repair_outcome_matched_contract_waiting_for_reuse_review") {
  blockers.push("rag_informed_outcome_validation_not_matched_for_reuse_review");
}
if (validation.outcomeMatchedContract !== true) blockers.push("rag_informed_outcome_match_confirmation_missing");
if (!validation.matchedRagOutcomeHandoff) blockers.push("matched_rag_outcome_handoff_missing");
if (validation.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_evidence_treated_as_authority_in_outcome_validation");
if (validation.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_non_authority_lock_missing");
if (validation.locks?.doesNotTreatRagAsAuthority !== true) blockers.push("rag_authority_forbidden_lock_missing");
if (validation.locks?.goalComplete !== false) blockers.push("rag_outcome_completion_lock_missing");
if (validation.locks?.doesNotEnableRules !== true) blockers.push("rag_outcome_rule_lock_missing");

const reusedCandidate =
  blockers.length === 0
    ? runNode(
        "create-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-reuse-review-candidate-builder.mjs",
        ["--goal", goal, "--validation", adaptedValidationPath, "--out-dir", join(candidateDir, "reused-high-reasoning-repair-reuse-review-candidate")],
        process.cwd()
      )
    : null;
const reusedTemplate = reusedCandidate ? readJson(reusedCandidate.receiptTemplatePath) : null;
const providerRoleUsePlanTrace =
  validation.providerRoleUsePlanTrace || validation.matchedRagOutcomeHandoff?.providerRoleUsePlanTrace || reusedCandidate?.providerRoleUsePlanTrace || null;
const candidatePath = join(candidateDir, "tlcl-rag-informed-repair-reuse-review-candidate.json");
const receiptTemplatePath = join(candidateDir, "tlcl-rag-informed-repair-reuse-review-receipt-template.json");
const readmePath = join(candidateDir, "TLCL_RAG_INFORMED_REPAIR_REUSE_REVIEW_CANDIDATE_START_HERE.md");
const status =
  blockers.length === 0
    ? "rag_informed_repair_reuse_review_candidate_ready_for_teacher_review"
    : "blocked_before_rag_informed_repair_reuse_review_candidate";
const receiptTemplate = reusedTemplate
  ? {
      ...reusedTemplate,
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_receipt_v1",
      sourceRagInformedRepairReuseReviewCandidatePath: candidatePath,
      ragOutcomeValidationReviewed: false,
      ragEvidenceReviewed: false,
      ragEvidenceTreatedAsAuthority: false,
      ragNonAuthorityConfirmed: false,
      ragReuseBoundaryReviewed: false,
      teacherNote:
        "Review whether this RAG-informed repaired reusable workflow may be retained for later bounded medium-runtime invocation planning."
    }
  : {
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_receipt_v1",
      candidateId,
      sourceRagInformedRepairReuseReviewCandidatePath: candidatePath,
      teacherDecision: "needs_teacher_review",
      ragOutcomeValidationReviewed: false,
      ragEvidenceReviewed: false,
      ragEvidenceTreatedAsAuthority: false,
      ragNonAuthorityConfirmed: false,
      ragReuseBoundaryReviewed: false,
      blockedActionsConfirmed: true,
      locks: locks()
    };
const candidate = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_candidate_v1",
  candidateId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  workflowFingerprint: reusedCandidate?.workflowFingerprint || "",
  mediumRuntimeReuseCandidate: Boolean(reusedCandidate?.mediumRuntimeReuseCandidate),
  mediumRuntimeWorkflowEnabled: false,
  ragEvidenceTreatedAsAuthority: false,
  providerRoleUsePlanTrace,
  blockers,
  reusedHighReasoningRepairReuseReviewCandidateBuilderInvoked: Boolean(reusedCandidate),
  reusedHighReasoningRepairReuseReviewCandidateStatus: reusedCandidate?.status || "",
  sourceEvidence: {
    ragOutcomeReviewValidationPath: validationInput.path,
    ragOutcomeReviewValidationHash: sha256Object(validation),
    adaptedOutcomeValidationPath: adaptedValidationPath,
    reusedRepairReuseCandidatePath: reusedCandidate?.candidatePath || "",
    reusedRepairReuseReceiptTemplatePath: reusedCandidate?.receiptTemplatePath || "",
    providerRoleUsePlanTrace
  },
  defaultReceipt: receiptTemplate,
  blockedTransitions: [
    "run_rag_informed_repaired_workflow_from_reuse_review_candidate",
    "treat_rag_as_authority_from_reuse_review_candidate",
    "write_memory_from_rag_informed_reuse_review_candidate",
    "enable_rule_from_rag_informed_reuse_review_candidate",
    "unlock_packaging_from_rag_informed_reuse_review_candidate",
    "claim_goal_complete_from_rag_informed_reuse_review_candidate"
  ],
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
    "# TLCL RAG-Informed Repair Reuse Review Candidate",
    "",
    `Status: ${status}`,
    `Workflow fingerprint: ${candidate.workflowFingerprint || "<blocked>"}`,
    "",
    "This wrapper reuses the existing high-reasoning repair reuse-review candidate builder after a RAG-informed fresh outcome matched the contract.",
    "RAG evidence remains non-authoritative evidence only. This artifact does not enable the workflow, run software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_candidate_builder_result_v1",
      candidateId,
      status,
      workflowFingerprint: candidate.workflowFingerprint,
      candidatePath,
      receiptTemplatePath,
      readmePath,
      blockers,
      reusedHighReasoningRepairReuseReviewCandidateBuilderInvoked: Boolean(reusedCandidate),
      reusedHighReasoningRepairReuseReviewCandidateStatus: reusedCandidate?.status || "",
      mediumRuntimeReuseCandidate: candidate.mediumRuntimeReuseCandidate,
      mediumRuntimeWorkflowEnabled: false,
      ragEvidenceTreatedAsAuthority: false,
      workflowExecuted: false,
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
