#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-rag-informed-deterministic-validation-smoke",
  String(Date.now())
);
mkdirSync(smokeRoot, { recursive: true });

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const tlclPacketPath = writeJson(join(smokeRoot, "tlcl-repair-packet.json"), {
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_reuse_review_validation_v1",
  status: "repaired_reusable_workflow_invocation_reuse_review_to_high_reasoning_contract_repair",
  decision: "correction_to_high_reasoning_repair",
  mediumRuntimeWorkflowEnabled: false,
  locks: {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    goalComplete: false
  }
});
const planningLogicEvidence = {
  query: "packaging dieline fold allowance rule",
  logicExtractionHint: "fold allowance depends on material thickness, print-side orientation, and scored fold angle"
};
const readyRagValidationPath = writeJson(join(smokeRoot, "ready-rag-validation.json"), {
  format: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
  status: "ready_for_review_only_rule_dsl_validation",
  planningLogicEvidence,
  planningLogicEvidenceHash: sha256Object(planningLogicEvidence),
  approvedDisabledDrafts: [
    {
      sourceId: "manual.packaging.001",
      retrievalPath: join(smokeRoot, "retrieval-evidence-packet.json"),
      rulePath: join(smokeRoot, "draft-disabled-rule-card.json"),
      ruleLifecycle: "draft_disabled",
      logicExtractionHint: planningLogicEvidence.logicExtractionHint,
      logicFitDecision: "matches_intended_logic",
      evidenceRefs: ["retrieval://manual.packaging.001/chunk.001"],
      reviewerNote: "Use as evidence for high-reasoning contract repair only."
    }
  ],
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    accepted: false,
    ruleEnabled: false,
    memoryEnabled: false,
    softwareActionsExecuted: false,
    externalFetchPerformed: false,
    packagingGated: true,
    packagingUnlocked: false
  }
});

const attachment = runNode("scripts/create-tlcl-rag-evidence-attachment.mjs", [
  "--tlcl-packet",
  tlclPacketPath,
  "--rag-validation",
  readyRagValidationPath,
  "--out-dir",
  join(smokeRoot, "attachment")
]);
const intake = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-intake.mjs", [
  "--attachment",
  attachment.attachmentPath,
  "--out-dir",
  join(smokeRoot, "intakes")
]);
const draft = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-draft-package.mjs", [
  "--intake",
  intake.intakePath,
  "--out-dir",
  join(smokeRoot, "draft-packages")
]);
const approvedReceiptPath = writeJson(join(smokeRoot, "approved-review-receipt.json"), {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_receipt_v1",
  teacherDecision: "approve_rag_informed_repair_for_validation",
  draftPackageReviewed: true,
  draftDisabledRulesReviewed: true,
  evidenceRowsReviewed: true,
  teacherQuestionsReviewed: true,
  compiledDisabledRulePackageReviewed: true,
  deterministicValidationPlanReviewed: true,
  deterministicValidationStillRequiredConfirmed: true,
  mediumRuntimeRetryStillBlockedConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedDeterministicValidation: true,
  blockedActionsConfirmed: true,
  ragEvidenceNonAuthoritativeConfirmed: true
});
const review = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs", [
  "--draft-package",
  draft.draftPackagePath,
  "--receipt",
  approvedReceiptPath,
  "--out-dir",
  join(smokeRoot, "review-validations")
]);
const blockedReviewPath = writeJson(join(smokeRoot, "blocked-review-validation.json"), {
  ...readJson(review.validationPath),
  status: "rag_informed_repair_draft_return_to_high_reasoning_repair",
  readyForDeterministicValidation: false
});
const unsafeReviewPath = writeJson(join(smokeRoot, "unsafe-review-validation.json"), {
  ...readJson(review.validationPath),
  readyForMediumRuntime: true,
  locks: {
    ...readJson(review.validationPath).locks,
    ragEvidenceNonAuthoritative: false
  }
});

const ready = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs", [
  "--review-validation",
  review.validationPath,
  "--out-dir",
  join(smokeRoot, "deterministic-validations")
]);
const blocked = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs", [
  "--review-validation",
  blockedReviewPath,
  "--out-dir",
  join(smokeRoot, "deterministic-validations")
]);
const unsafe = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-deterministic-validation-package.mjs", [
  "--review-validation",
  unsafeReviewPath,
  "--out-dir",
  join(smokeRoot, "deterministic-validations")
]);
const readyPackage = readJson(ready.validationPackagePath);
const validationReport = readJson(ready.validationReportPath);

const checks = [
  check(
    "RAG-informed deterministic validation creates lifecycle-skipped validation report",
    ready.status === "rag_informed_deterministic_validation_ready_for_fingerprint_review" &&
      ready.deterministicValidationRun === true &&
      ready.readyForWorkflowFingerprintReview === true &&
      ready.readyForMediumRuntime === false &&
      readyPackage.validationSummary.disabledRuleCount === 1 &&
      readyPackage.validationSummary.lifecycleSkippedRows === 1 &&
      readyPackage.validationSummary.nonSkippedRuleRows === 0 &&
      readyPackage.validationSummary.teacherQuestionCount >= 3 &&
      validationReport.delivery_allowed === true,
    ready.validationReportPath
  ),
  check(
    "RAG-informed deterministic validation keeps medium retry and rule activation blocked",
    ready.mediumRuntimeRetryAllowed === false &&
      ready.ruleEnabled === false &&
      ready.accepted === false &&
      readyPackage.mediumRuntimeRetryAllowed === false &&
      readyPackage.ruleActivationAllowed === false &&
      readyPackage.locks.mediumRuntimeContinuationBlocked === true &&
      readyPackage.locks.workflowFingerprintReviewStillRequired === true,
    JSON.stringify(readyPackage.locks)
  ),
  check(
    "RAG-informed deterministic validation blocks unready or unsafe review validation",
    blocked.status === "blocked_before_rag_informed_deterministic_validation" &&
      blocked.deterministicValidationRun === false &&
      blocked.readyForWorkflowFingerprintReview === false &&
      unsafe.status === "blocked_before_rag_informed_deterministic_validation" &&
      unsafe.deterministicValidationRun === false &&
      unsafe.readyForMediumRuntime === false,
    `${blocked.validationPackagePath};${unsafe.validationPackagePath}`
  ),
  check(
    "RAG-informed deterministic validation keeps RAG evidence non-authoritative",
    ready.approvedGateRunnerInvoked === false &&
      ready.targetSoftwareCommandsExecuted === false &&
      ready.mediumRuntimeContinued === false &&
      ready.screenshotsCaptured === false &&
      ready.memoryWritten === false &&
      ready.packagingGated === true &&
      ready.goalComplete === false &&
      readyPackage.nextReview.mayTreatRagAsAuthority === false &&
      readyPackage.locks.ragEvidenceNonAuthoritative === true,
    JSON.stringify(readyPackage.nextReview)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_deterministic_validation_package_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  readyValidationPackagePath: ready.validationPackagePath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
