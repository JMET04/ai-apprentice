#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const pluginRoot = join(repoRoot, "plugins", "transparent-ai-apprentice");

function readPlugin(relativePath) {
  return readFileSync(join(pluginRoot, relativePath), "utf8");
}

function readRepo(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

const checks = [];

function check(name, passed, evidence = {}) {
  checks.push({ name, passed: Boolean(passed), evidence });
}

const docs = {
  readme: readPlugin("README.md"),
  package: readRepo("package.json")
};

check(
  "README documents RAG evidence as non-authoritative high-reasoning repair input",
  hasAll(docs.readme, [
    "RAG evidence",
    "ragEvidenceNonAuthoritative=true",
    "ragEvidenceTreatedAsAuthority=false",
    "treating RAG as authority blocks",
    "medium runtime stays blocked",
    "providerRoleUsePlanTrace"
  ]),
  { file: "README.md" }
);

const chainScripts = [
  {
    name: "evidence attachment",
    path: "scripts/create-tlcl-rag-evidence-attachment.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_evidence_attachment_v1",
      "ready_for_review_only_rule_dsl_validation",
      "ragDoesNotAuthorizeExecution",
      "ragDoesNotEnableRules",
      "ragDoesNotWriteMemory",
      "ragDoesNotUnlockPackaging",
      "mediumRuntimeContinuationAllowed: false",
      "approvedDisabledDrafts",
      "planningLogicEvidenceHash",
      "bypass_teacher_review_from_tlcl_rag_attachment"
    ]
  },
  {
    name: "high reasoning repair intake",
    path: "scripts/create-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_intake_v1",
      "highest-reasoning TLCL contract compiler",
      "dimensions, angles, line relationships, tolerances, formulas",
      "mediumRuntimeContinuationBlocked",
      "readyForMediumRuntime: false",
      "requiresDeterministicValidation",
      "requiresFreshMediumRuntimeApprovalGate",
      "treat_rag_as_authority_from_rag_informed_repair_intake"
    ]
  },
  {
    name: "draft disabled repair package",
    path: "scripts/create-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_package_v1",
      "draft_disabled",
      "validateRuleCard",
      "compile-rule-package.mjs",
      "Every repair clause cites at least one reviewed RAG evidence row.",
      "Every uncertain logic item remains a teacher question until reviewed.",
      "reuse_medium_runtime_without_teacher_review",
      "treat_rag_as_authority_from_draft_package"
    ]
  },
  {
    name: "draft review receipt validation",
    path: "scripts/validate-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_validation_v1",
      "approve_rag_informed_repair_for_validation",
      "ragEvidenceNonAuthoritativeConfirmed",
      "treat_rag_as_authority",
      "readyForDeterministicValidation",
      "readyForMediumRuntime: false",
      "forbiddenDecisionUsed"
    ]
  },
  {
    name: "deterministic validation package",
    path: "scripts/create-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_package_v1",
      "rag_informed_deterministic_validation_ready_for_fingerprint_review",
      "lifecycleSkippedRows",
      "ragEvidenceNonAuthoritative",
      "mayTreatRagAsAuthority: false",
      "mediumRuntimeRetryAllowed: false",
      "workflowFingerprintReviewStillRequired"
    ]
  },
  {
    name: "workflow fingerprint review",
    path: "scripts/validate-tlcl-rag-informed-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_workflow_fingerprint_review_validation_v1",
      "rag_informed_fingerprint_review_ready_for_approval_gate_rebuild",
      "ragEvidenceNonAuthoritativeConfirmed",
      "approvalGateRebuildStillRequired",
      "mediumRuntimeRetryStillBlockedConfirmed",
      "treat_rag_as_authority"
    ]
  },
  {
    name: "approval gate rebuild",
    path: "scripts/create-tlcl-rag-informed-high-reasoning-repair-approval-gate-rebuild-package.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approval_gate_rebuild_package_v1",
      "rag_informed_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review",
      "ragEvidenceNonAuthoritative",
      "ragEvidenceTreatedAsAuthority",
      "approvedGateRunnerInvoked: false",
      "doesNotExecuteTargetSoftware"
    ]
  },
  {
    name: "approved gate command builder",
    path: "scripts/create-tlcl-rag-informed-high-reasoning-repair-approved-gate-command-builder.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_v1",
      "rag_informed_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation",
      "ragEvidenceNonAuthoritative",
      "ragEvidenceTreatedAsAuthority",
      "readyForTeacherFinalConfirmation",
      "approvedGateRunnerInvoked: false"
    ]
  },
  {
    name: "approved gate runner",
    path: "scripts/run-tlcl-rag-informed-high-reasoning-repair-approved-gate-runner.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_runner_v1",
      "rag_informed_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review",
      "ragEvidenceNonAuthoritative",
      "ragEvidenceTreatedAsAuthority",
      "freshOutcomeReviewStillRequired",
      "goalComplete: false"
    ]
  },
  {
    name: "fresh outcome review",
    path: "scripts/validate-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_validation_v1",
      "rag_informed_repair_outcome_matched_contract_waiting_for_reuse_review",
      "rag_informed_repair_outcome_to_high_reasoning_contract_repair",
      "ragNonAuthorityConfirmed",
      "ragEvidenceTreatedAsAuthority",
      "providerRoleUsePlanTrace"
    ]
  },
  {
    name: "reuse review",
    path: "scripts/validate-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs",
    tokens: [
      "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_validation_v1",
      "rag_informed_repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning",
      "rag_informed_repaired_reusable_workflow_reuse_review_to_high_reasoning_contract_repair",
      "ragNonAuthorityConfirmed",
      "ragEvidenceTreatedAsAuthority",
      "providerRoleUsePlanTrace"
    ]
  }
];

for (const item of chainScripts) {
  const absolutePath = join(pluginRoot, item.path);
  const exists = existsSync(absolutePath);
  const text = exists ? readPlugin(item.path) : "";
  const missingTokens = exists ? item.tokens.filter((token) => !text.includes(token)) : item.tokens;
  check(`RAG-to-repair chain script: ${item.name}`, exists && missingTokens.length === 0, {
    file: item.path,
    missingTokens
  });
}

const smokeScripts = [
  {
    name: "attachment smoke",
    path: "scripts/smoke-tlcl-rag-evidence-attachment.mjs",
    tokens: [
      "Reviewed RAG validation attaches to TLCL packet for high reasoning only",
      "TLCL RAG attachment preserves evidence-only handoff and medium runtime block",
      "Unsafe RAG rule enablement lock is fail-closed"
    ]
  },
  {
    name: "repair intake smoke",
    path: "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-intake.mjs",
    tokens: [
      "RAG evidence attachment becomes high-reasoning repair intake only",
      "RAG-informed repair intake optimizes prompt around explicit logic extraction",
      "RAG-informed repair intake rejects medium-runtime continuation before teacher review"
    ]
  },
  {
    name: "draft package smoke",
    path: "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs",
    tokens: [
      "RAG-informed repair draft package compiles only draft_disabled evidence-bound rules",
      "RAG-informed repair draft package preserves teacher questions and validator expectations",
      "RAG-informed repair draft package keeps RAG evidence non-authoritative"
    ]
  },
  {
    name: "deterministic validation smoke",
    path: "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs",
    tokens: [
      "RAG-informed deterministic validation creates lifecycle-skipped validation report",
      "RAG-informed deterministic validation keeps medium retry and rule activation blocked",
      "RAG-informed deterministic validation keeps RAG evidence non-authoritative"
    ]
  },
  {
    name: "fingerprint review smoke",
    path: "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-workflow-fingerprint-review-receipt.mjs",
    tokens: [
      "RAG-informed fingerprint review prepares only approval gate rebuild handoff",
      "RAG-informed fingerprint review blocks forbidden RAG authority and execution"
    ]
  },
  {
    name: "fresh outcome smoke",
    path: "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs",
    tokens: [
      "Matched RAG-informed fresh outcome stays review-only before reuse review",
      "RAG-informed outcome review fails closed if receipt treats RAG as authority"
    ]
  },
  {
    name: "reuse review smoke",
    path: "scripts/smoke-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs",
    tokens: [
      "Teacher approval allows RAG-informed repaired workflow only for later medium-runtime planning",
      "Treating RAG as authority is fail-closed"
    ]
  }
];

for (const item of smokeScripts) {
  const text = readPlugin(item.path);
  const missingTokens = item.tokens.filter((token) => !text.includes(token));
  check(`targeted smoke keeps RAG non-authority assertion visible: ${item.name}`, missingTokens.length === 0, {
    file: item.path,
    missingTokens
  });
}

check(
  "npm script exposes RAG evidence to high-reasoning repair chain audit",
  hasAll(docs.package, [
    "smoke:plugin-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit",
    "smoke-tlcl-rag-evidence-to-high-reasoning-repair-chain-audit.mjs"
  ]),
  { packagePath: join(repoRoot, "package.json") }
);

const passed = checks.filter((item) => item.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_evidence_to_high_reasoning_repair_chain_audit_smoke_v1",
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(result, null, 2));

if (result.status !== "passed") {
  process.exit(1);
}
