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

function slug(value) {
  return (
    String(value || "tlcl-provider-activation-review")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-provider-activation-review"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function candidateReceiptHash(candidate) {
  return sha256Object({ ...candidate, defaultReceipt: null });
}

function locks() {
  return {
    reviewOnly: true,
    activationCandidateOnly: true,
    providerCapabilityCardIssued: false,
    providerEnabledForTlclRole: false,
    providerMayBypassTlcl: false,
    providerMayExecuteTargetSoftware: false,
    providerMayWriteMemory: false,
    providerMayUnlockPackaging: false,
    providerMayClaimAcceptance: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    packagingUnlocked: false,
    completionClaim: false
  };
}

function addBlocker(blockers, blocker) {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

const goal = argValue("--goal", "Build a TLCL capability provider activation review candidate.");
const validationPathArg = argValue("--validation", argValue("--qualification-result-validation", ""));
const outRoot = resolve(
  argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-capability-provider-activation-reviews"))
);

const blockers = [];
let validation = null;
const validationPath = validationPathArg ? resolve(validationPathArg) : "";

if (!validationPathArg || !existsSync(validationPath)) {
  addBlocker(blockers, "missing_qualification_result_validation");
} else {
  validation = readJson(validationPath);
  if (validation.format !== "transparent_ai_tlcl_capability_provider_qualification_result_validation_v1") {
    addBlocker(blockers, "invalid_qualification_result_validation_format");
  }
  if (validation.status !== "tlcl_capability_provider_qualification_results_ready_for_validator_review") {
    addBlocker(blockers, "qualification_result_validation_not_ready_for_activation_review");
  }
  if (Array.isArray(validation.blockers) && validation.blockers.length > 0) {
    addBlocker(blockers, "qualification_result_validation_has_blockers");
  }
  if (
    validation.counts?.totalRows <= 0 ||
    validation.counts?.matchedExpected !== validation.counts?.totalRows ||
    validation.counts?.mismatchBlocked !== 0 ||
    validation.counts?.unknownBlocked !== 0 ||
    validation.counts?.notRunYet !== 0
  ) {
    addBlocker(blockers, "qualification_result_rows_not_all_matched");
  }
  if (
    validation.locks?.providerEnabled !== false ||
    validation.locks?.targetSoftwareCommandsExecuted !== false ||
    validation.locks?.memoryWritten !== false ||
    validation.locks?.packagingGated !== true
  ) {
    addBlocker(blockers, "qualification_result_validation_locks_not_preserved");
  }
}

const provider = validation?.provider || {};
const providerRole = provider.requestedRole || "unknown_role";
const candidateId = `tlcl-capability-provider-activation-review.${new Date().toISOString().replace(/[:.]/g, "-")}`;
const candidateDir = join(outRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(provider.name || goal)}`);
const candidatePath = join(candidateDir, "tlcl-capability-provider-activation-review-candidate.json");
const receiptTemplatePath = join(candidateDir, "tlcl-capability-provider-activation-review-receipt-template.json");
const readmePath = join(candidateDir, "TLCL_CAPABILITY_PROVIDER_ACTIVATION_REVIEW_START_HERE.md");
const validationHash = validation ? sha256Object(validation) : "";
const status = blockers.length
  ? "blocked_before_tlcl_capability_provider_activation_review_candidate"
  : "tlcl_capability_provider_activation_review_candidate_ready_for_teacher_approval";

const receiptTemplate = {
  format: "transparent_ai_tlcl_capability_provider_activation_review_receipt_v1",
  sourceCandidatePath: candidatePath,
  sourceCandidateHash: "",
  teacherDecision: "needs_teacher_review",
  providerReviewed: false,
  qualificationEvidenceReviewed: false,
  roleBoundaryReviewed: false,
  deterministicValidatorsStillRequiredConfirmed: false,
  runtimeGateStillRequiredConfirmed: false,
  rollbackPointStillRetained: false,
  teacherApprovedProviderForTlclRole: false,
  teacherCorrection: "",
  teacherNote: "",
  blockedActionsConfirmed: true,
  locks: locks()
};

const candidate = {
  ok: true,
  format: "transparent_ai_tlcl_capability_provider_activation_review_candidate_v1",
  candidateId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  provider,
  providerRole,
  qualificationResultValidationPath: validationPath,
  qualificationResultValidationHash: validationHash,
  qualificationSummary: {
    totalRows: validation?.counts?.totalRows || 0,
    matchedExpected: validation?.counts?.matchedExpected || 0,
    mismatchBlocked: validation?.counts?.mismatchBlocked || 0,
    unknownBlocked: validation?.counts?.unknownBlocked || 0,
    notRunYet: validation?.counts?.notRunYet || 0
  },
  reviewBoundary: {
    mayApproveProviderForTlclRoleOnly: blockers.length === 0,
    stillRequiresRuntimeGate: true,
    stillRequiresDeterministicValidators: true,
    stillRequiresTeacherApprovalBeforeTargetExecution: true,
    stillRequiresRollbackBeforeSystemChange: true,
    stillRequiresOutcomeReviewAfterEveryRun: true,
    cannotBypassTlcl: true,
    cannotExecuteTargetSoftware: true,
    cannotWriteMemory: true,
    cannotUnlockPackaging: true,
    cannotClaimAcceptance: true
  },
  allowedTeacherDecisions: [
    "needs_teacher_review",
    "approve_provider_for_tlcl_role",
    "provider_mismatch_blocked",
    "correction_to_high_reasoning_repair"
  ],
  forbiddenTeacherDecisions: [
    "accepted",
    "enabled_without_tlcl",
    "execute_target_software",
    "write_memory",
    "unlock_packaging",
    "bypass_contract",
    "claim_complete"
  ],
  blockers,
  defaultReceipt: null,
  paths: {
    candidate: candidatePath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    qualificationResultValidation: validationPath
  },
  locks: locks()
};

receiptTemplate.sourceCandidateHash = candidateReceiptHash(candidate);
candidate.defaultReceipt = receiptTemplate;

writeJson(candidatePath, candidate);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Capability Provider Activation Review",
    "",
    `Status: ${status}`,
    `Provider role: ${providerRole}`,
    "",
    "This package lets a teacher approve a qualified provider only for a bounded TLCL role.",
    "Approval does not execute target software, write memory, unlock packaging, bypass TLCL, or claim acceptance.",
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
      format: "transparent_ai_tlcl_capability_provider_activation_review_candidate_builder_result_v1",
      candidateId,
      status,
      providerRole,
      candidatePath,
      receiptTemplatePath,
      readmePath,
      blockers,
      providerCapabilityCardIssued: false,
      providerEnabledForTlclRole: false,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      packagingGated: true
    },
    null,
    2
  )
);
