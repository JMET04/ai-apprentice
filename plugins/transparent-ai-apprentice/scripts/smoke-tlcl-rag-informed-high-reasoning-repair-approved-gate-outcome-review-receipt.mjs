#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-rag-informed-repair-approved-gate-outcome-review-smoke", String(Date.now()));
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

const existingRunnerPacketPath = writeJson(join(smokeRoot, "existing-runner-packet.json"), {
  format: "transparent_ai_all_software_execution_approved_gate_runner_v1",
  status: "approved_gate_controlled_route_completed_waiting_for_teacher_review"
});
const existingRunnerReceiptPath = writeJson(join(smokeRoot, "existing-runner-receipt.json"), {
  format: "transparent_ai_all_software_execution_approved_gate_runner_receipt_v1",
  status: "approved_gate_controlled_route_completed_waiting_for_teacher_review"
});
const adapterReceiptPath = writeJson(join(smokeRoot, "adapter-receipt.json"), {
  format: "transparent_ai_existing_software_execution_receipt_v1",
  status: "teacher_confirmed_cli_script_executed",
  commandExecuted: true
});
const outcomeVerificationPath = writeJson(join(smokeRoot, "outcome-verification.json"), {
  format: "transparent_ai_supervised_action_outcome_verification_v1",
  status: "waiting_for_supervised_outcome_review"
});
const checkpointPath = writeJson(join(smokeRoot, "post-action-checkpoint.json"), {
  format: "transparent_ai_post_action_evidence_checkpoint_v1",
  status: "checkpoint_waiting_for_teacher_review"
});
const reusedRunnerResult = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_result_v1",
  runId: "reused-runner-after-rag-informed-repair-smoke",
  status: "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review",
  runnerInvoked: true,
  controlledRouteActionExecuted: true,
  targetSoftwareCommandsExecuted: true,
  uiEventsSent: false,
  sourceEvidence: {
    workflowFingerprint: "sha256:rag-informed-repair-outcome-review-smoke"
  },
  generatedEvidence: {
    existingRunnerPacketPath,
    existingRunnerReceiptPath,
    adapterReceiptPath,
    outcomeVerificationPath,
    postActionCheckpointPath: checkpointPath
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  }
};
const ragRunPath = writeJson(join(smokeRoot, "tlcl-rag-informed-repair-approved-gate-runner.json"), {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_runner_v1",
  runId: "rag-informed-repair-approved-gate-runner-smoke",
  status: "rag_informed_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review",
  runnerInvoked: true,
  controlledRouteActionExecuted: true,
  targetSoftwareCommandsExecuted: true,
  uiEventsSent: false,
  ragEvidenceTreatedAsAuthority: false,
  sourceEvidence: {
    workflowFingerprint: "sha256:rag-informed-repair-outcome-review-smoke",
    ragEvidenceNonAuthoritative: true
  },
  generatedEvidence: {
    reusableWorkflowRunnerResult: reusedRunnerResult,
    reusableWorkflowRunnerPacketPath: join(smokeRoot, "reused-runner-packet.json"),
    reusableWorkflowRunnerReceiptPath: join(smokeRoot, "reused-runner-receipt.json"),
    existingRunnerPacketPath,
    existingRunnerReceiptPath,
    adapterReceiptPath,
    outcomeVerificationPath,
    postActionCheckpointPath: checkpointPath
  },
  locks: {
    reviewOnly: true,
    evidenceOnly: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    freshOutcomeReviewStillRequired: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  }
});

const builder = runNode("scripts/create-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt-builder.mjs", [
  "--run",
  ragRunPath,
  "--out-dir",
  join(smokeRoot, "builder")
]);
const template = readJson(builder.receiptTemplatePath);
const matchedReceiptPath = writeJson(join(smokeRoot, "matched-rag-outcome-receipt.json"), {
  ...template,
  teacherDecision: "executed_route_matched_contract",
  runnerPacketReviewed: true,
  existingRunnerReceiptReviewed: true,
  adapterReceiptReviewed: true,
  outcomeVerificationReviewed: true,
  postActionCheckpointReviewed: true,
  rollbackPointStillRetained: true,
  teacherMatchedContract: true,
  repairRunnerPacketReviewed: true,
  reusedWorkflowRunnerPacketReviewed: true,
  repairedRouteOutcomeReviewed: true,
  repairWorkflowFingerprintReviewed: true,
  reusableWorkflowInvocationReviewed: true,
  reusableWorkflowFingerprintReviewed: true,
  ragEvidenceReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragNonAuthorityConfirmed: true,
  ragLogicSupportReviewed: true,
  blockedActionsConfirmed: true
});
const correctionReceiptPath = writeJson(join(smokeRoot, "correction-rag-outcome-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  repairRunnerPacketReviewed: true,
  reusedWorkflowRunnerPacketReviewed: true,
  repairedRouteOutcomeReviewed: true,
  repairWorkflowFingerprintReviewed: true,
  ragEvidenceReviewed: true,
  ragEvidenceTreatedAsAuthority: false,
  ragNonAuthorityConfirmed: true,
  ragLogicSupportReviewed: true,
  blockedActionsConfirmed: true,
  teacherCorrection: "RAG evidence supports the new target edge, but the generated angle still follows the old constraint.",
  observedIssue: "Fresh RAG-informed repair outcome still has angle mismatch.",
  affectedLogicFields: ["rag.logicExtractionHint", "rule.angleConstraint", "workflow.parameterBinding"]
});
const authorityReceiptPath = writeJson(join(smokeRoot, "authority-rag-outcome-receipt.json"), {
  ...template,
  teacherDecision: "executed_route_matched_contract",
  repairRunnerPacketReviewed: true,
  reusedWorkflowRunnerPacketReviewed: true,
  repairedRouteOutcomeReviewed: true,
  repairWorkflowFingerprintReviewed: true,
  ragEvidenceReviewed: true,
  ragEvidenceTreatedAsAuthority: true,
  ragNonAuthorityConfirmed: false,
  ragLogicSupportReviewed: true,
  blockedActionsConfirmed: true
});

const matchedValidation = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  ragRunPath,
  "--receipt",
  matchedReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const correctionValidation = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  ragRunPath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const authorityValidation = runNode("scripts/validate-tlcl-rag-informed-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  ragRunPath,
  "--receipt",
  authorityReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const correctionPacket = readJson(correctionValidation.validationPath);

const checks = [
  check(
    "RAG-informed outcome review builder reuses existing repair outcome review builder without execution",
    builder.format === "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt_builder_result_v1" &&
      builder.status === "rag_informed_repair_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use" &&
      builder.reusedRepairOutcomeReviewBuilderInvoked === true &&
      builder.ragEvidenceTreatedAsAuthority === false &&
      builder.doesNotRunApprovedGate === true &&
      builder.memoryWritten === false &&
      builder.goalComplete === false,
    builder.builderPath
  ),
  check(
    "Matched RAG-informed fresh outcome stays review-only before reuse review",
    matchedValidation.status === "rag_informed_repair_outcome_matched_contract_waiting_for_reuse_review" &&
      matchedValidation.outcomeMatchedContract === true &&
      matchedValidation.ragEvidenceTreatedAsAuthority === false &&
      matchedValidation.memoryWritten === false &&
      matchedValidation.ruleEnabled === false &&
      matchedValidation.goalComplete === false,
    matchedValidation.validationPath
  ),
  check(
    "RAG-informed fresh outcome correction returns to high reasoning repair",
    correctionValidation.status === "rag_informed_repair_outcome_to_high_reasoning_contract_repair" &&
      correctionValidation.escalateToHighReasoningRepair === true &&
      correctionPacket.highReasoningRepairHandoff?.runtimeTransition === "rag_informed_fresh_outcome_to_high_reasoning_contract_repair" &&
      correctionPacket.highReasoningRepairHandoff?.ragEvidenceTreatedAsAuthority === false &&
      correctionValidation.memoryWritten === false,
    correctionValidation.validationPath
  ),
  check(
    "RAG-informed outcome review fails closed if receipt treats RAG as authority",
    authorityValidation.status === "rag_informed_repair_outcome_needs_teacher_review_or_more_evidence" &&
      authorityValidation.blockers.includes("receipt_treats_rag_as_authority") &&
      authorityValidation.ragEvidenceTreatedAsAuthority === false &&
      authorityValidation.targetSoftwareCommandsExecuted === false &&
      authorityValidation.memoryWritten === false,
    authorityValidation.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  builderPath: builder.builderPath,
  matchedValidationPath: matchedValidation.validationPath,
  correctionValidationPath: correctionValidation.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
