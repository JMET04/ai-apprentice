#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");

const forbiddenDecisions = new Set([
  "accepted",
  "enabled_without_tlcl",
  "execute_target_software",
  "write_memory",
  "unlock_packaging",
  "bypass_contract",
  "claim_complete"
]);

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slug(value) {
  return (
    String(value || "tlcl-provider-activation-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-provider-activation-review-validation"
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

function addBlocker(blockers, blocker) {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["approve_provider_for_tlcl_role", "approve_provider_role", "qualified_provider_allowed"].includes(decision)) {
    return "approve_provider_for_tlcl_role";
  }
  if (["provider_mismatch_blocked", "mismatch_blocked", "blocked"].includes(decision)) return "provider_mismatch_blocked";
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_provider_contract"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (forbiddenDecisions.has(decision)) return decision;
  return "needs_teacher_review";
}

function locks(providerEnabledForTlclRole = false) {
  return {
    reviewOnly: true,
    activationValidationOnly: true,
    providerCapabilityCardIssued: providerEnabledForTlclRole,
    providerEnabledForTlclRole,
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

function allowedUseForRole(role) {
  if (role === "senior_reasoning_compile") {
    return [
      "compile disabled Rule Cards and Rule DSL proposals",
      "repair TLCL contracts after teacher corrections or validator unknowns",
      "prepare review-only regression plans before lower-cost retry"
    ];
  }
  if (role === "medium_reasoning_runtime") {
    return [
      "prepare or run only TLCL-gated medium-runtime work after runtime gates",
      "use reusable workflow cards only when fingerprints and validators match",
      "escalate every correction or mismatch back to high reasoning repair"
    ];
  }
  if (role === "low_reasoning_tool") {
    return [
      "perform fixed transforms and metadata work under checked inputs",
      "return unknown_blocked on missing fields or schema mismatch",
      "never infer missing logic without a senior compile repair"
    ];
  }
  return ["unknown role requires another teacher review before use"];
}

const goal = argValue("--goal", "Validate TLCL capability provider activation review receipt");
const candidatePathArg = argValue("--candidate", argValue("--activation-candidate", ""));
const receiptPathArg = argValue("--receipt", argValue("--teacher-receipt", ""));
const outRoot = resolve(
  argValue("--out-dir", join(repoRoot, ".transparent-apprentice", "tlcl-capability-provider-activation-validations"))
);

const blockers = [];
let candidate = null;
let receipt = null;
const candidatePath = candidatePathArg ? resolve(candidatePathArg) : "";
const receiptPath = receiptPathArg ? resolve(receiptPathArg) : "";

if (!candidatePathArg || !existsSync(candidatePath)) {
  addBlocker(blockers, "missing_activation_review_candidate");
} else {
  candidate = readJson(candidatePath);
  if (candidate.format !== "transparent_ai_tlcl_capability_provider_activation_review_candidate_v1") {
    addBlocker(blockers, "invalid_activation_review_candidate_format");
  }
  if (candidate.status !== "tlcl_capability_provider_activation_review_candidate_ready_for_teacher_approval") {
    addBlocker(blockers, "activation_review_candidate_not_ready");
  }
  if (candidate.reviewBoundary?.mayApproveProviderForTlclRoleOnly !== true) {
    addBlocker(blockers, "candidate_role_approval_boundary_missing");
  }
}

if (!receiptPathArg || !existsSync(receiptPath)) {
  addBlocker(blockers, "missing_activation_review_receipt");
} else {
  receipt = readJson(receiptPath);
  if (receipt.format !== "transparent_ai_tlcl_capability_provider_activation_review_receipt_v1") {
    addBlocker(blockers, "invalid_activation_review_receipt_format");
  }
}

if (candidate && receipt) {
  if (receipt.sourceCandidateHash !== candidateReceiptHash(candidate)) addBlocker(blockers, "receipt_source_candidate_hash_mismatch");
  if (receipt.sourceCandidatePath && resolve(receipt.sourceCandidatePath) !== candidatePath) {
    addBlocker(blockers, "receipt_source_candidate_path_mismatch");
  }
  if (receipt.locks?.providerMayExecuteTargetSoftware !== false || receipt.locks?.providerMayWriteMemory !== false) {
    addBlocker(blockers, "receipt_locks_not_preserved");
  }
}

const decision = normalizeDecision(receipt?.teacherDecision);
const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
if (forbiddenDecisionUsed) addBlocker(blockers, "forbidden_teacher_decision");
if (receipt?.blockedActionsConfirmed !== true) addBlocker(blockers, "blocked_actions_not_confirmed_by_teacher");

if (decision === "approve_provider_for_tlcl_role") {
  if (receipt.providerReviewed !== true) addBlocker(blockers, "provider_not_reviewed");
  if (receipt.qualificationEvidenceReviewed !== true) addBlocker(blockers, "qualification_evidence_not_reviewed");
  if (receipt.roleBoundaryReviewed !== true) addBlocker(blockers, "role_boundary_not_reviewed");
  if (receipt.deterministicValidatorsStillRequiredConfirmed !== true) {
    addBlocker(blockers, "deterministic_validator_requirement_not_confirmed");
  }
  if (receipt.runtimeGateStillRequiredConfirmed !== true) addBlocker(blockers, "runtime_gate_requirement_not_confirmed");
  if (receipt.rollbackPointStillRetained !== true) addBlocker(blockers, "rollback_point_not_retained");
  if (receipt.teacherApprovedProviderForTlclRole !== true) addBlocker(blockers, "teacher_provider_role_approval_missing");
}
if (decision === "correction_to_high_reasoning_repair" && !String(receipt?.teacherCorrection || "").trim()) {
  addBlocker(blockers, "high_reasoning_repair_correction_missing");
}

const providerEnabledForTlclRole = decision === "approve_provider_for_tlcl_role" && blockers.length === 0;
const escalateToHighReasoningRepair =
  !forbiddenDecisionUsed && ["provider_mismatch_blocked", "correction_to_high_reasoning_repair"].includes(decision);
const status = providerEnabledForTlclRole
  ? "tlcl_capability_provider_role_approved_waiting_for_gated_use"
  : forbiddenDecisionUsed
    ? "blocked_before_tlcl_capability_provider_activation_review"
    : escalateToHighReasoningRepair
      ? "tlcl_capability_provider_activation_review_escalate_to_high_reasoning_repair"
      : "tlcl_capability_provider_activation_review_needs_teacher_review";

const providerRole = candidate?.providerRole || candidate?.provider?.requestedRole || "unknown_role";
const validationDir = join(outRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`);
const validationPath = join(validationDir, "tlcl-capability-provider-activation-review-validation.json");
const receiptRecordPath = join(validationDir, "tlcl-capability-provider-activation-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_CAPABILITY_PROVIDER_ACTIVATION_REVIEW_VALIDATION_START_HERE.md");

const providerCapabilityCard = providerEnabledForTlclRole
  ? {
      format: "transparent_ai_tlcl_capability_provider_card_v1",
      provider: candidate.provider || {},
      providerRole,
      providerQualifiedForTlclRole: true,
      providerEnabledForTlclRole: true,
      roleScopedAllowedUse: allowedUseForRole(providerRole),
      stillRequires: [
        "TLCL status refresh or current contract evidence",
        "deterministic validators for the specific workflow",
        "runtime gate before medium-runtime work",
        "teacher-reviewed approval gate before target software execution",
        "retained rollback before any system change",
        "fresh outcome review after every run"
      ],
      forbiddenUse: [
        "self approval",
        "contract bypass",
        "ungated target software execution",
        "memory writes without teacher review",
        "packaging unlock",
        "technology acceptance or completion claim"
      ],
      sourceCandidatePath: candidatePath,
      sourceCandidateHash: candidate ? candidateReceiptHash(candidate) : ""
    }
  : null;

const highReasoningRepairHandoff = escalateToHighReasoningRepair
  ? {
      kind: "high_reasoning_provider_repair_handoff",
      transition: "provider_activation_review_to_high_reasoning_repair",
      provider: candidate?.provider || {},
      providerRole,
      teacherDecision: decision,
      teacherCorrection: receipt?.teacherCorrection || "",
      teacherNote: receipt?.teacherNote || "",
      evidenceToInspect: [candidatePath, candidate?.qualificationResultValidationPath || ""].filter(Boolean),
      repairTasks: [
        "Repair the provider role boundary or qualification tests before another activation review.",
        "Rerun result receipt validation after repair evidence is available.",
        "Do not use this provider for TLCL role work until a new activation receipt passes."
      ]
    }
  : null;

const validation = {
  ok: true,
  format: "transparent_ai_tlcl_capability_provider_activation_validation_v1",
  validationId: `tlcl-capability-provider-activation-validation.${new Date().toISOString().replace(/[:.]/g, "-")}`,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  providerRole,
  providerEnabledForTlclRole,
  providerCapabilityCard,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  highReasoningRepairHandoff,
  sourceEvidence: {
    candidatePath,
    candidateHash: candidate ? candidateReceiptHash(candidate) : "",
    receiptPath,
    receiptHash: receipt ? sha256Object(receipt) : ""
  },
  paths: {
    validation: validationPath,
    receipt: receiptRecordPath,
    readme: readmePath,
    sourceCandidate: candidatePath,
    sourceReceipt: receiptPath
  },
  locks: locks(providerEnabledForTlclRole)
};

const validationReceipt = {
  format: "transparent_ai_tlcl_capability_provider_activation_validation_receipt_v1",
  validationId: validation.validationId,
  status,
  decision,
  providerRole,
  providerEnabledForTlclRole,
  providerCapabilityCardIssued: Boolean(providerCapabilityCard),
  targetSoftwareCommandsExecuted: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  packagingUnlocked: false,
  completionClaim: false,
  blockers,
  locks: validation.locks
};

writeJson(validationPath, validation);
writeJson(receiptRecordPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Capability Provider Activation Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    `Provider role: ${providerRole}`,
    "",
    "This validation may issue a role-scoped provider capability card for later TLCL-gated use.",
    "It does not execute target software, write memory, unlock packaging, bypass TLCL, or claim acceptance.",
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
      format: "transparent_ai_tlcl_capability_provider_activation_validation_result_v1",
      status,
      decision,
      providerRole,
      providerEnabledForTlclRole,
      providerCapabilityCardIssued: Boolean(providerCapabilityCard),
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath: receiptRecordPath,
      readmePath,
      targetSoftwareCommandsExecuted: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false,
      completionClaim: false
    },
    null,
    2
  )
);
