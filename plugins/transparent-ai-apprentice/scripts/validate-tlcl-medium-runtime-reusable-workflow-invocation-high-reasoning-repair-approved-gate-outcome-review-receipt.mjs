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
    String(value || "tlcl-reusable-workflow-repair-approved-gate-outcome-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-approved-gate-outcome-review-validation"
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

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    reusesExistingReusableWorkflowOutcomeReviewValidator: true,
    repairFreshOutcomeReviewValidated: true,
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

function providerRoleUsePlanTraceFromRepairRun(repairRun) {
  return (
    repairRun.sourceEvidence?.providerRoleUsePlanTrace ||
    repairRun.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromRepairRun(repairRun) {
  return (
    repairRun.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    repairRun.reasoningBudgetGovernorReviewTrace ||
    {}
  );
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

function adaptRepairRun(repairRun) {
  const reused = repairRun.generatedEvidence?.reusableWorkflowRunnerResult || {};
  const ragInformedRepairReuse = repairRun.ragInformedRepairReuse === true || repairRun.sourceEvidence?.ragInformedRepairReuse === true;
  const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromRepairRun(repairRun);
  const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromRepairRun(repairRun);
  return {
    ...reused,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_v1",
    status:
      repairRun.status === "reusable_workflow_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
        ? "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review"
        : reused.status || repairRun.status,
    sourceHighReasoningRepairRunId: repairRun.runId || "",
    sourceHighReasoningRepairRunStatus: repairRun.status || "",
    generatedEvidence: {
      ...(reused.generatedEvidence || {}),
      existingRunnerPacketPath: reused.existingRunnerPacketPath || repairRun.generatedEvidence?.existingRunnerPacketPath || "",
      existingRunnerReceiptPath: reused.existingRunnerReceiptPath || repairRun.generatedEvidence?.existingRunnerReceiptPath || "",
      adapterReceiptPath: reused.adapterReceiptPath || repairRun.generatedEvidence?.adapterReceiptPath || "",
      outcomeVerificationPath: reused.outcomeVerificationPath || repairRun.generatedEvidence?.outcomeVerificationPath || "",
      postActionCheckpointPath: reused.postActionCheckpointPath || repairRun.generatedEvidence?.postActionCheckpointPath || ""
    },
    runnerInvoked: reused.runnerInvoked === true || repairRun.runnerInvoked === true,
    controlledRouteActionExecuted: reused.controlledRouteActionExecuted === true || repairRun.controlledRouteActionExecuted === true,
    targetSoftwareCommandsExecuted: reused.targetSoftwareCommandsExecuted === true || repairRun.targetSoftwareCommandsExecuted === true,
    uiEventsSent: reused.uiEventsSent === true || repairRun.uiEventsSent === true,
    sourceEvidence: {
      ...(reused.sourceEvidence || {}),
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace
    },
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse,
    locks: {
      ...(reused.locks || {}),
      ragEvidenceNonAuthoritative: ragInformedRepairReuse || reused.locks?.ragEvidenceNonAuthoritative === true,
      doesNotTreatRagAsAuthority: ragInformedRepairReuse || reused.locks?.doesNotTreatRagAsAuthority === true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    }
  };
}

function adaptRepairReceipt(receipt) {
  return {
    ...receipt,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_v1",
    reusableWorkflowInvocationReviewed:
      receipt.reusableWorkflowInvocationReviewed === true ||
      receipt.repairedRouteOutcomeReviewed === true ||
      receipt.reusedWorkflowRunnerPacketReviewed === true,
    reusableWorkflowFingerprintReviewed:
      receipt.reusableWorkflowFingerprintReviewed === true || receipt.repairWorkflowFingerprintReviewed === true
  };
}

const goal = argValue(
  "--goal",
  "Validate a fresh teacher outcome review for one high-reasoning repaired TLCL reusable workflow run."
);
const repairRunInput = readJsonInput(
  argValue("--run", argValue("--repair-run", argValue("--approved-gate-runner", ""))),
  "--run",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-approved-gate-outcome-review-validations")
  )
);
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const adaptedRunPath = join(validationDir, "adapted-reusable-workflow-approved-gate-runner.json");
const adaptedReceiptPath = join(validationDir, "adapted-reusable-workflow-outcome-review-receipt.json");
const repairRun = repairRunInput.value;
const receipt = receiptInput.value;
const ragInformedRepairReuse = repairRun.ragInformedRepairReuse === true || repairRun.sourceEvidence?.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromRepairRun(repairRun);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromRepairRun(repairRun);
writeJson(adaptedRunPath, adaptRepairRun(repairRun));
writeJson(adaptedReceiptPath, adaptRepairReceipt(receipt));

const preflightBlockers = [];
if (repairRun.status !== "reusable_workflow_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review") {
  preflightBlockers.push("repair_approved_gate_runner_not_waiting_for_fresh_outcome_review");
}
if (repairRun.locks?.freshOutcomeReviewRequired !== true) preflightBlockers.push("repair_runner_fresh_outcome_review_lock_missing");
if (repairRun.locks?.goalComplete !== false) preflightBlockers.push("repair_runner_goal_completion_lock_missing");
if (repairRun.locks?.packagingGated !== true) preflightBlockers.push("repair_runner_packaging_gate_lock_missing");
if (ragInformedRepairReuse) {
  if (repairRun.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("rag_informed_repair_run_treats_rag_as_authority");
  if (repairRun.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_repair_run_non_authority_flag_missing");
  if (repairRun.locks?.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_repair_run_non_authority_lock_missing");
  if (repairRun.locks?.doesNotTreatRagAsAuthority !== true) {
    preflightBlockers.push("rag_informed_repair_run_does_not_treat_rag_as_authority_lock_missing");
  }
  if (receipt.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("rag_informed_receipt_treats_rag_as_authority");
  if (receipt.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_informed_receipt_non_authority_flag_missing");
  if (receipt.ragEvidenceNonAuthoritativeReviewed !== true && receipt.teacherDecision === "executed_route_matched_contract") {
    preflightBlockers.push("rag_informed_non_authority_not_reviewed");
  }
}
if (receipt.repairRunnerPacketReviewed !== true && receipt.teacherDecision === "executed_route_matched_contract") {
  preflightBlockers.push("repair_runner_packet_not_reviewed");
}

const existingValidation =
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
        status: "needs_teacher_review_or_more_evidence",
        decision: receipt.teacherDecision || "needs_teacher_review",
        outcomeMatchedContract: false,
        mismatchBlocked: false,
        escalateToHighReasoningRepair: false,
        forbiddenDecisionUsed: false,
        blockers: preflightBlockers,
        validationPath: ""
      };

const outcomeMatchedContract = existingValidation.outcomeMatchedContract === true && preflightBlockers.length === 0;
const mismatchBlocked = existingValidation.mismatchBlocked === true;
const escalateToHighReasoningRepair = existingValidation.escalateToHighReasoningRepair === true || mismatchBlocked;
const forbiddenDecisionUsed = existingValidation.forbiddenDecisionUsed === true;
const blockers = [...preflightBlockers, ...(existingValidation.blockers || [])].filter((value, index, arr) => arr.indexOf(value) === index);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_reusable_workflow_repair_outcome_review_decision"
  : outcomeMatchedContract
    ? "reusable_workflow_repair_invocation_outcome_matched_contract_waiting_for_reuse_review"
    : escalateToHighReasoningRepair
      ? "reusable_workflow_repair_invocation_to_high_reasoning_contract_repair"
      : "reusable_workflow_repair_invocation_needs_teacher_review_or_more_evidence";
const highReasoningRepairHandoff = escalateToHighReasoningRepair
  ? {
      kind: "reusable_workflow_repair_invocation_high_reasoning_repair_handoff",
      runtimeTransition: "repaired_reusable_workflow_fresh_outcome_to_high_reasoning_contract_repair",
      sourceRepairRunId: repairRun.runId || "",
      sourceRepairRunStatus: repairRun.status || "",
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      teacherDecision: existingValidation.decision,
      teacherCorrection: receipt.teacherCorrection || "",
      observedIssue: receipt.observedIssue || receipt.teacherNote || "",
      affectedLogicFields: Array.isArray(receipt.affectedLogicFields) ? receipt.affectedLogicFields : [],
      evidenceToInspect: [
        repairRunInput.path,
        repairRun.generatedEvidence?.reusableWorkflowRunnerPacketPath || "",
        repairRun.generatedEvidence?.reusableWorkflowRunnerReceiptPath || "",
        repairRun.generatedEvidence?.existingRunnerReceiptPath || "",
        repairRun.generatedEvidence?.adapterReceiptPath || "",
        repairRun.generatedEvidence?.outcomeVerificationPath || "",
        repairRun.generatedEvidence?.postActionCheckpointPath || "",
        existingValidation.validationPath || ""
      ].filter(Boolean),
      repairTasks: [
        "Use highest-reasoning compile again to repair the TLCL contract, Rule DSL, validators, route binding, workflow fingerprint, or command template.",
        "Keep medium runtime blocked until the repaired contract passes deterministic validation and a new workflow fingerprint review.",
        "Rebuild the approval gate and require another fresh outcome review before any reuse, memory, packaging, or completion claim."
      ],
      mediumRuntimeContinuationBlocked: true
    }
  : null;
const matchedRepairOutcomeHandoff = outcomeMatchedContract
  ? {
      kind: "reusable_workflow_repair_fresh_outcome_matched_contract_handoff",
      runtimeTransition: "repaired_reusable_workflow_fresh_outcome_waiting_for_reuse_review",
      sourceRepairRunId: repairRun.runId || "",
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      executesNow: false,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      nextRequiredReview:
        "Teacher must separately decide whether this repaired reusable workflow evidence can update or preserve the reusable workflow card."
    }
  : null;
const validationPath = join(validationDir, "tlcl-reusable-workflow-repair-approved-gate-outcome-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-reusable-workflow-repair-approved-gate-outcome-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_APPROVED_GATE_OUTCOME_REVIEW_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format:
    "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision: existingValidation.decision,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  matchedRepairOutcomeHandoff,
  highReasoningRepairHandoff,
  reusedOutcomeReviewValidatorInvoked: preflightBlockers.length === 0,
  reusedOutcomeReviewValidationStatus: existingValidation.status,
  sourceEvidence: {
    repairRunPath: repairRunInput.path,
    repairRunHash: sha256Object(repairRun),
    repairOutcomeReviewReceiptPath: receiptInput.path,
    repairOutcomeReviewReceiptHash: sha256Object(receipt),
    adaptedReusableWorkflowRunPath: adaptedRunPath,
    adaptedReusableWorkflowReceiptPath: adaptedReceiptPath,
    reusedValidationPath: existingValidation.validationPath || "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  blockedTransitions: [
    "run_repaired_reusable_workflow_from_outcome_validation",
    "enable_rule_from_repair_outcome_validation",
    "write_memory_from_repair_outcome_validation",
    "unlock_packaging_from_repair_outcome_validation",
    "treat_rag_as_authority_from_repair_approved_gate_outcome_review",
    "claim_goal_complete_from_repair_outcome_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceRepairRun: repairRunInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format:
    "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_validation_receipt_v1",
  validationId,
  status,
  decision: existingValidation.decision,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
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
    "# TLCL Reusable Workflow Repair Approved-Gate Outcome Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${existingValidation.decision}`,
    "",
    "This validation reads one fresh outcome review after high-reasoning repair. It does not run software, write memory, enable rules, unlock packaging, or claim completion.",
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
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_validation_result_v1",
      validationId,
      status,
      decision: existingValidation.decision,
      outcomeMatchedContract,
      mismatchBlocked,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      reusedOutcomeReviewValidatorInvoked: preflightBlockers.length === 0,
      reusedOutcomeReviewValidationStatus: existingValidation.status,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
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
