#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-rag-informed-high-reasoning-repair-draft-review-smoke",
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
  ragEvidenceNonAuthoritativeConfirmed: true,
  teacherNote: "Reviewed RAG evidence can move to deterministic validation only."
});
const correctionReceiptPath = writeJson(join(smokeRoot, "correction-review-receipt.json"), {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_receipt_v1",
  teacherDecision: "needs_more_high_reasoning_repair",
  teacherCorrection: "The angle relationship is still ambiguous and must remain a teacher question.",
  blockedActionsConfirmed: true,
  ragEvidenceNonAuthoritativeConfirmed: true
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-review-receipt.json"), {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_receipt_v1",
  teacherDecision: "treat_rag_as_authority",
  blockedActionsConfirmed: true,
  ragEvidenceNonAuthoritativeConfirmed: false
});

const approved = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs", [
  "--draft-package",
  draft.draftPackagePath,
  "--receipt",
  approvedReceiptPath,
  "--out-dir",
  join(smokeRoot, "review-validations")
]);
const correction = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs", [
  "--draft-package",
  draft.draftPackagePath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "review-validations")
]);
const forbidden = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-draft-review-receipt.mjs", [
  "--draft-package",
  draft.draftPackagePath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "review-validations")
]);
const approvedValidation = readJson(approved.validationPath);
const correctionValidation = readJson(correction.validationPath);
const checks = [
  check(
    "RAG-informed repair draft review approves only deterministic validation handoff",
    approved.status === "rag_informed_repair_draft_ready_for_deterministic_validation" &&
      approved.readyForDeterministicValidation === true &&
      approved.readyForMediumRuntime === false &&
      approved.deterministicValidationRun === false &&
      approvedValidation.deterministicValidationHandoff?.requiredBeforeMediumRuntimeRetry === true &&
      approvedValidation.deterministicValidationHandoff?.forbiddenShortcuts.includes(
        "treat_rag_as_authority_from_repair_draft_review"
      ),
    JSON.stringify(approvedValidation.deterministicValidationHandoff)
  ),
  check(
    "RAG-informed repair draft review correction returns to high-reasoning repair",
    correction.status === "rag_informed_repair_draft_return_to_high_reasoning_repair" &&
      correction.returnToHighReasoningRepair === true &&
      correctionValidation.highReasoningRepairHandoff?.kind === "rag_informed_repair_draft_back_to_high_reasoning_handoff" &&
      correctionValidation.highReasoningRepairHandoff?.repairTasks.some((task) => task.includes("teacher questions")),
    JSON.stringify(correctionValidation.highReasoningRepairHandoff)
  ),
  check(
    "RAG-informed repair draft review blocks forbidden RAG authority and rule enablement",
    forbidden.status === "blocked_for_forbidden_rag_informed_repair_draft_review_decision" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.blockers.includes("forbidden_teacher_decision") &&
      forbidden.ruleEnabled === false &&
      forbidden.memoryWritten === false,
    JSON.stringify(forbidden.blockers)
  ),
  check(
    "RAG-informed repair draft review keeps execution memory packaging and completion locks",
    approved.approvedGateRunnerInvoked === false &&
      approved.targetSoftwareCommandsExecuted === false &&
      approved.mediumRuntimeContinued === false &&
      approved.screenshotsCaptured === false &&
      approved.memoryWritten === false &&
      approved.accepted === false &&
      approved.ruleEnabled === false &&
      approved.packagingGated === true &&
      approved.packagingUnlocked === false &&
      approved.goalComplete === false &&
      approvedValidation.locks.mediumRuntimeContinuationBlocked === true &&
      approvedValidation.locks.ragEvidenceNonAuthoritative === true,
    JSON.stringify(approvedValidation.locks)
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_draft_review_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  approvedValidationPath: approved.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
