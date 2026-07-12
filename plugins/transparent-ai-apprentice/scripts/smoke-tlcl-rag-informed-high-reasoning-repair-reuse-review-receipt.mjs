#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-rag-informed-repair-reuse-review-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const ragOutcomeValidationPath = writeJson(join(smokeRoot, "rag-outcome-validation.json"), {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_validation_v1",
  validationId: "rag-informed-reuse-review-smoke-outcome-validation",
  status: "rag_informed_repair_outcome_matched_contract_waiting_for_reuse_review",
  decision: "executed_route_matched_contract",
  outcomeMatchedContract: true,
  ragEvidenceTreatedAsAuthority: false,
  matchedRagOutcomeHandoff: {
    kind: "rag_informed_repair_fresh_outcome_matched_contract_handoff",
    runtimeTransition: "rag_informed_fresh_outcome_waiting_for_reuse_review",
    sourceRagInformedRunId: "rag-informed-reuse-review-smoke-run",
    executesNow: false,
    memoryWriteAllowed: false,
    ruleEnablementAllowed: false
  },
  sourceEvidence: {
    ragInformedRunPath: join(smokeRoot, "rag-informed-runner.json"),
    ragOutcomeReviewReceiptPath: join(smokeRoot, "rag-outcome-review-receipt.json")
  },
  locks: {
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    doesNotEnableRules: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  }
});

const candidate = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-reuse-review-candidate-builder.mjs", [
  "--validation",
  ragOutcomeValidationPath,
  "--out-dir",
  join(smokeRoot, "candidate")
]);
const template = readJson(candidate.receiptTemplatePath);
const approvalReceiptPath = writeJson(join(smokeRoot, "rag-reuse-approval-receipt.json"), {
  ...template,
  teacherDecision: "approve_medium_runtime_reuse",
  candidateReviewed: true,
  contractBoundaryReviewed: true,
  sourceOutcomeEvidenceReviewed: true,
  deterministicValidatorsStillRequiredConfirmed: true,
  approvalGateStillRequiredConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedBoundedReuse: true,
  repairOutcomeValidationReviewed: true,
  repairedWorkflowBoundaryReviewed: true,
  repairedWorkflowFingerprintReviewed: true,
  ragOutcomeValidationReviewed: true,
  ragEvidenceReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragNonAuthorityConfirmed: true,
  ragReuseBoundaryReviewed: true,
  blockedActionsConfirmed: true
});
const correctionReceiptPath = writeJson(join(smokeRoot, "rag-reuse-correction-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  ragOutcomeValidationReviewed: true,
  ragEvidenceReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragNonAuthorityConfirmed: true,
  ragReuseBoundaryReviewed: true,
  blockedActionsConfirmed: true,
  teacherCorrection: "The RAG-informed reusable workflow still keeps an obsolete angle constraint."
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "rag-reuse-forbidden-receipt.json"), {
  ...template,
  teacherDecision: "approve_medium_runtime_reuse",
  ragOutcomeValidationReviewed: true,
  ragEvidenceReviewed: true,
  ragEvidenceTreatedAsAuthority: true,
  ragNonAuthorityConfirmed: true,
  ragReuseBoundaryReviewed: true,
  blockedActionsConfirmed: true
});

const approval = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  approvalReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const correction = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const forbidden = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-reuse-review-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const approvalPacket = readJson(approval.validationPath);
const correctionPacket = readJson(correction.validationPath);
const checks = [
  check(
    "Matched RAG-informed fresh outcome can become a reuse review candidate",
    candidate.status === "rag_informed_repair_reuse_review_candidate_ready_for_teacher_review" &&
      candidate.reusedHighReasoningRepairReuseReviewCandidateBuilderInvoked === true &&
      candidate.mediumRuntimeReuseCandidate === true &&
      candidate.mediumRuntimeWorkflowEnabled === false &&
      candidate.ragEvidenceTreatedAsAuthority === false,
    candidate.candidatePath
  ),
  check(
    "Teacher approval allows RAG-informed repaired workflow only for later medium-runtime planning",
    approval.status === "rag_informed_repaired_reusable_workflow_reuse_review_allowed_waiting_for_next_invocation_planning" &&
      approval.mediumRuntimeWorkflowEnabled === true &&
      approval.workflowExecuted === false &&
      approval.targetSoftwareCommandsExecuted === false &&
      approval.memoryWritten === false &&
      approval.ruleEnabled === false &&
      approvalPacket.reusableWorkflowCard?.ragEvidenceTreatedAsAuthority === false &&
      approvalPacket.reusableWorkflowCard?.executionStillRequiresApprovalGate === true,
    approval.validationPath
  ),
  check(
    "RAG-informed reuse review correction returns to high reasoning repair",
    correction.status === "rag_informed_repaired_reusable_workflow_reuse_review_to_high_reasoning_contract_repair" &&
      correction.escalateToHighReasoningRepair === true &&
      correctionPacket.highReasoningRepairHandoff?.runtimeTransition === "rag_informed_reuse_review_to_high_reasoning_contract_repair",
    correction.validationPath
  ),
  check(
    "Treating RAG as authority is fail-closed",
    forbidden.status === "rag_informed_repaired_reusable_workflow_reuse_review_needs_teacher_review_or_more_evidence" &&
      forbidden.blockers.includes("receipt_treats_rag_as_authority") &&
      forbidden.ragEvidenceTreatedAsAuthority === false &&
      forbidden.memoryWritten === false &&
      forbidden.ruleEnabled === false &&
      forbidden.goalComplete === false,
    forbidden.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_reuse_review_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  candidatePath: candidate.candidatePath,
  approvalValidationPath: approval.validationPath,
  correctionValidationPath: correction.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
