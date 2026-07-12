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

function slug(value) {
  return (
    String(value || "tlcl-repaired-reusable-workflow-outcome-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-repaired-reusable-workflow-outcome-review-validation"
  );
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

function runNode(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    repairedReusableWorkflowInvocation: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    reusesExistingReusableWorkflowOutcomeReviewValidator: true,
    freshOutcomeReviewValidated: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function providerRoleUsePlanTraceFromRepairedRun(repairedRun) {
  return (
    repairedRun.sourceEvidence?.providerRoleUsePlanTrace ||
    repairedRun.providerRoleUsePlanTrace ||
    repairedRun.generatedEvidence?.reusableWorkflowRunnerResult?.sourceEvidence?.providerRoleUsePlanTrace ||
    repairedRun.generatedEvidence?.reusableWorkflowRunnerResult?.providerRoleUsePlanTrace ||
    null
  );
}

function reasoningBudgetGovernorReviewTraceFromRepairedRun(repairedRun) {
  return (
    repairedRun.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    repairedRun.reasoningBudgetGovernorReviewTrace ||
    repairedRun.generatedEvidence?.reusableWorkflowRunnerResult?.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    repairedRun.generatedEvidence?.reusableWorkflowRunnerResult?.reasoningBudgetGovernorReviewTrace ||
    null
  );
}

function adaptRepairedRun(repairedRun) {
  const reused = repairedRun.generatedEvidence?.reusableWorkflowRunnerResult || {};
  const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromRepairedRun(repairedRun);
  const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromRepairedRun(repairedRun);
  return {
    ...reused,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_v1",
    status:
      repairedRun.status ===
      "repaired_reusable_workflow_invocation_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
        ? "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review"
        : reused.status || repairedRun.status,
    sourceRepairedReusableWorkflowRunId: repairedRun.runId || "",
    sourceRepairedReusableWorkflowRunStatus: repairedRun.status || "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    sourceEvidence: {
      ...(reused.sourceEvidence || {}),
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace
    },
    generatedEvidence: {
      ...(reused.generatedEvidence || {}),
      existingRunnerPacketPath: reused.existingRunnerPacketPath || repairedRun.generatedEvidence?.existingRunnerPacketPath || "",
      existingRunnerReceiptPath: reused.existingRunnerReceiptPath || repairedRun.generatedEvidence?.existingRunnerReceiptPath || "",
      adapterReceiptPath: reused.adapterReceiptPath || repairedRun.generatedEvidence?.adapterReceiptPath || "",
      outcomeVerificationPath: reused.outcomeVerificationPath || repairedRun.generatedEvidence?.outcomeVerificationPath || "",
      postActionCheckpointPath: reused.postActionCheckpointPath || repairedRun.generatedEvidence?.postActionCheckpointPath || ""
    },
    runnerInvoked: reused.runnerInvoked === true || repairedRun.runnerInvoked === true,
    controlledRouteActionExecuted: reused.controlledRouteActionExecuted === true || repairedRun.controlledRouteActionExecuted === true,
    targetSoftwareCommandsExecuted: reused.targetSoftwareCommandsExecuted === true || repairedRun.targetSoftwareCommandsExecuted === true,
    uiEventsSent: reused.uiEventsSent === true || repairedRun.uiEventsSent === true,
    ragInformedRepairReuse: repairedRun.ragInformedRepairReuse === true,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: repairedRun.ragInformedRepairReuse === true,
    locks: {
      ...(reused.locks || {}),
      ragEvidenceNonAuthoritative: repairedRun.ragInformedRepairReuse === true || reused.locks?.ragEvidenceNonAuthoritative === true,
      doesNotTreatRagAsAuthority: repairedRun.ragInformedRepairReuse === true || reused.locks?.doesNotTreatRagAsAuthority === true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    }
  };
}

function adaptRepairedReceipt(receipt) {
  return {
    ...receipt,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_v1",
    reusableWorkflowInvocationReviewed:
      receipt.reusableWorkflowInvocationReviewed === true ||
      receipt.repairedRouteOutcomeReviewed === true ||
      receipt.reusedWorkflowRunnerPacketReviewed === true,
    reusableWorkflowFingerprintReviewed:
      receipt.reusableWorkflowFingerprintReviewed === true || receipt.repairedWorkflowFingerprintReviewed === true
  };
}

const goal = argValue("--goal", "Validate a fresh repaired TLCL reusable workflow invocation outcome review.");
const runInput = readJsonInput(
  argValue("--run", argValue("--repaired-run", argValue("--approved-gate-runner", ""))),
  "--run",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-repaired-reusable-workflow-outcome-review-validations")
  )
);
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const adaptedRunPath = join(validationDir, "adapted-reusable-workflow-approved-gate-runner.json");
const adaptedReceiptPath = join(validationDir, "adapted-reusable-workflow-outcome-review-receipt.json");
const repairedRun = runInput.value;
const receipt = receiptInput.value;
const ragInformedRepairReuse = repairedRun.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromRepairedRun(repairedRun);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromRepairedRun(repairedRun);
writeJson(adaptedRunPath, adaptRepairedRun(repairedRun));
writeJson(adaptedReceiptPath, adaptRepairedReceipt(receipt));

const preflightBlockers = [];
if (
  repairedRun.status !==
  "repaired_reusable_workflow_invocation_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
) {
  preflightBlockers.push("repaired_reusable_workflow_runner_not_waiting_for_fresh_outcome_review");
}
if (repairedRun.locks?.freshOutcomeReviewRequired !== true) {
  preflightBlockers.push("repaired_reusable_workflow_fresh_outcome_review_lock_missing");
}
if (repairedRun.locks?.goalComplete !== false) preflightBlockers.push("repaired_reusable_workflow_goal_completion_lock_missing");
if (repairedRun.locks?.packagingGated !== true) preflightBlockers.push("repaired_reusable_workflow_packaging_gate_lock_missing");
if (ragInformedRepairReuse) {
  if (repairedRun.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("rag_informed_repaired_run_treats_rag_as_authority");
  if (repairedRun.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_repaired_run_non_authority_flag_missing");
  if (repairedRun.locks?.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_repaired_run_non_authority_lock_missing");
  if (repairedRun.locks?.doesNotTreatRagAsAuthority !== true) {
    preflightBlockers.push("rag_informed_repaired_run_does_not_treat_rag_as_authority_lock_missing");
  }
  if (receipt.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("rag_informed_receipt_treats_rag_as_authority");
  if (receipt.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_receipt_non_authority_flag_missing");
  if (receipt.ragEvidenceNonAuthoritativeReviewed !== true && receipt.teacherDecision === "executed_route_matched_contract") {
    preflightBlockers.push("rag_informed_non_authority_not_reviewed");
  }
}
if (receipt.repairedRunnerPacketReviewed !== true && receipt.teacherDecision === "executed_route_matched_contract") {
  preflightBlockers.push("repaired_runner_packet_not_reviewed");
}

const reusedValidation =
  preflightBlockers.length === 0
    ? runNode(
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs",
        [
          "--goal",
          goal,
          "--run",
          adaptedRunPath,
          "--receipt",
          adaptedReceiptPath,
          "--out-dir",
          join(validationDir, "reused-reusable-workflow-outcome-review-validation")
        ],
        process.cwd()
      )
    : {
        status: "repaired_reusable_workflow_invocation_needs_teacher_review_or_more_evidence",
        decision: receipt.teacherDecision || "needs_teacher_review",
        outcomeMatchedContract: false,
        mismatchBlocked: false,
        escalateToHighReasoningRepair: false,
        forbiddenDecisionUsed: false,
        blockers: preflightBlockers,
        validationPath: ""
      };

const outcomeMatchedContract = reusedValidation.outcomeMatchedContract === true && preflightBlockers.length === 0;
const mismatchBlocked = reusedValidation.mismatchBlocked === true;
const escalateToHighReasoningRepair = reusedValidation.escalateToHighReasoningRepair === true || mismatchBlocked;
const forbiddenDecisionUsed = reusedValidation.forbiddenDecisionUsed === true;
const blockers = [...preflightBlockers, ...(reusedValidation.blockers || [])].filter(
  (value, index, list) => list.indexOf(value) === index
);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_repaired_reusable_workflow_outcome_review_decision"
  : outcomeMatchedContract
    ? "repaired_reusable_workflow_invocation_outcome_matched_contract_waiting_for_reuse_review"
    : escalateToHighReasoningRepair
      ? "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair"
      : "repaired_reusable_workflow_invocation_needs_teacher_review_or_more_evidence";
const highReasoningRepairHandoff = escalateToHighReasoningRepair
  ? {
      kind: "repaired_reusable_workflow_invocation_high_reasoning_repair_handoff",
      runtimeTransition: "repaired_reusable_workflow_fresh_outcome_to_high_reasoning_contract_repair",
      sourceRepairedRunId: repairedRun.runId || "",
      sourceRepairedRunStatus: repairedRun.status || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      teacherDecision: reusedValidation.decision,
      teacherCorrection: receipt.teacherCorrection || "",
      observedIssue: receipt.observedIssue || receipt.teacherNote || "",
      affectedLogicFields: Array.isArray(receipt.affectedLogicFields) ? receipt.affectedLogicFields : [],
      evidenceToInspect: [
        runInput.path,
        repairedRun.generatedEvidence?.reusableWorkflowRunnerPacketPath || "",
        repairedRun.generatedEvidence?.reusableWorkflowRunnerReceiptPath || "",
        repairedRun.generatedEvidence?.existingRunnerReceiptPath || "",
        repairedRun.generatedEvidence?.adapterReceiptPath || "",
        repairedRun.generatedEvidence?.outcomeVerificationPath || "",
        repairedRun.generatedEvidence?.postActionCheckpointPath || "",
        reusedValidation.validationPath || ""
      ].filter(Boolean),
      repairTasks: [
        "Use highest-reasoning compile to repair the TLCL contract, Rule DSL, validators, route binding, workflow fingerprint, or command template.",
        "Keep medium runtime blocked until the repaired contract passes deterministic validation and a new workflow fingerprint review.",
        "Rebuild the approval gate and require another fresh outcome review before reuse, memory, packaging, or completion claims."
      ],
      mediumRuntimeContinuationBlocked: true
    }
  : null;
const matchedOutcomeHandoff = outcomeMatchedContract
  ? {
      kind: "repaired_reusable_workflow_fresh_outcome_matched_contract_handoff",
      runtimeTransition: "repaired_reusable_workflow_fresh_outcome_waiting_for_reuse_review",
      sourceRepairedRunId: repairedRun.runId || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      executesNow: false,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      nextRequiredReview: "Teacher must separately decide whether this repaired reusable workflow evidence can remain reusable."
    }
  : null;
const validationPath = join(validationDir, "tlcl-repaired-reusable-workflow-outcome-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-repaired-reusable-workflow-outcome-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REPAIRED_REUSABLE_WORKFLOW_OUTCOME_REVIEW_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision: reusedValidation.decision,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  matchedOutcomeHandoff,
  highReasoningRepairHandoff,
  reusedOutcomeReviewValidatorInvoked: preflightBlockers.length === 0,
  reusedOutcomeReviewValidationStatus: reusedValidation.status,
  sourceEvidence: {
    repairedRunPath: runInput.path,
    repairedRunHash: sha256Object(repairedRun),
    repairedOutcomeReviewReceiptPath: receiptInput.path,
    repairedOutcomeReviewReceiptHash: sha256Object(receipt),
    adaptedReusableWorkflowRunPath: adaptedRunPath,
    adaptedReusableWorkflowReceiptPath: adaptedReceiptPath,
    reusedValidationPath: reusedValidation.validationPath || "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  blockedTransitions: [
    "run_repaired_reusable_workflow_from_outcome_validation",
    "enable_rule_from_repaired_outcome_validation",
    "write_memory_from_repaired_outcome_validation",
    "unlock_packaging_from_repaired_outcome_validation",
    "claim_goal_complete_from_repaired_outcome_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceRepairedRun: runInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format:
    "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_validation_receipt_v1",
  validationId,
  status,
  decision: reusedValidation.decision,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  locks: locks()
};

writeJson(validationPath, validation);
writeJson(validationReceiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Repaired Reusable Workflow Outcome Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${reusedValidation.decision}`,
    "",
    "This validation reads one fresh repaired reusable workflow outcome review. It does not run software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format:
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_validation_result_v1",
      validationId,
      status,
      decision: reusedValidation.decision,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      outcomeMatchedContract,
      mismatchBlocked,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      reusedOutcomeReviewValidatorInvoked: preflightBlockers.length === 0,
      reusedOutcomeReviewValidationStatus: reusedValidation.status,
      approvedGateRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
