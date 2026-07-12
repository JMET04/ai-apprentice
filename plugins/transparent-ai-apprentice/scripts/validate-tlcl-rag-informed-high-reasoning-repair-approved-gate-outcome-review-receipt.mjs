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
    String(value || "tlcl-rag-informed-repair-approved-gate-outcome-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-repair-approved-gate-outcome-review-validation"
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
    evidenceOnly: true,
    validationOnly: true,
    reusesExistingRepairOutcomeReviewValidator: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    ragFreshOutcomeReviewValidated: true,
    doesNotRunApprovedGate: true,
    doesNotRunMediumRuntimeWorkflow: true,
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
    packagingUnlocked: false,
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

function adaptRagRun(ragRun) {
  const reused = ragRun.generatedEvidence?.reusableWorkflowRunnerResult || {};
  return {
    ...ragRun,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_v1",
    status:
      ragRun.status === "rag_informed_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
        ? "reusable_workflow_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
        : ragRun.status,
    sourceRagInformedRepairRunId: ragRun.runId || "",
    sourceRagInformedRepairRunStatus: ragRun.status || "",
    generatedEvidence: {
      ...(ragRun.generatedEvidence || {}),
      reusableWorkflowRunnerResult: reused,
      existingRunnerPacketPath: ragRun.generatedEvidence?.existingRunnerPacketPath || reused.existingRunnerPacketPath || "",
      existingRunnerReceiptPath: ragRun.generatedEvidence?.existingRunnerReceiptPath || reused.existingRunnerReceiptPath || "",
      adapterReceiptPath: ragRun.generatedEvidence?.adapterReceiptPath || reused.adapterReceiptPath || "",
      outcomeVerificationPath: ragRun.generatedEvidence?.outcomeVerificationPath || reused.outcomeVerificationPath || "",
      postActionCheckpointPath: ragRun.generatedEvidence?.postActionCheckpointPath || reused.postActionCheckpointPath || ""
    },
    locks: {
      ...(ragRun.locks || {}),
      freshOutcomeReviewRequired: true,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    }
  };
}

function adaptRagReceipt(receipt) {
  return {
    ...receipt,
    format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_v1",
    repairRunnerPacketReviewed: receipt.repairRunnerPacketReviewed === true,
    reusedWorkflowRunnerPacketReviewed: receipt.reusedWorkflowRunnerPacketReviewed === true,
    repairedRouteOutcomeReviewed: receipt.repairedRouteOutcomeReviewed === true,
    repairWorkflowFingerprintReviewed: receipt.repairWorkflowFingerprintReviewed === true,
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
  "Validate a fresh teacher outcome review for one RAG-informed high-reasoning repaired TLCL run."
);
const ragRunInput = readJsonInput(
  argValue("--run", argValue("--rag-run", argValue("--approved-gate-runner", ""))),
  "--run",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_runner_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-repair-approved-gate-outcome-review-validations")
  )
);
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const adaptedRunPath = join(validationDir, "adapted-high-reasoning-repair-approved-gate-runner.json");
const adaptedReceiptPath = join(validationDir, "adapted-high-reasoning-repair-outcome-review-receipt.json");
const ragRun = ragRunInput.value;
const receipt = receiptInput.value;
writeJson(adaptedRunPath, adaptRagRun(ragRun));
writeJson(adaptedReceiptPath, adaptRagReceipt(receipt));

const preflightBlockers = [];
if (ragRun.status !== "rag_informed_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review") {
  preflightBlockers.push("rag_informed_repair_approved_gate_runner_not_waiting_for_fresh_outcome_review");
}
if (ragRun.locks?.ragEvidenceNonAuthoritative !== true) preflightBlockers.push("rag_non_authority_lock_missing_from_runner");
if (ragRun.locks?.doesNotTreatRagAsAuthority !== true) preflightBlockers.push("rag_authority_forbidden_lock_missing_from_runner");
if (ragRun.locks?.freshOutcomeReviewStillRequired !== true) preflightBlockers.push("rag_fresh_outcome_review_lock_missing_from_runner");
if (ragRun.locks?.goalComplete !== false) preflightBlockers.push("rag_runner_goal_completion_lock_missing");
if (ragRun.locks?.packagingGated !== true) preflightBlockers.push("rag_runner_packaging_gate_lock_missing");
if (receipt.ragEvidenceTreatedAsAuthority !== false) preflightBlockers.push("receipt_treats_rag_as_authority");
if (receipt.teacherDecision === "executed_route_matched_contract") {
  if (receipt.ragEvidenceReviewed !== true) preflightBlockers.push("rag_evidence_not_reviewed_for_matched_outcome");
  if (receipt.ragNonAuthorityConfirmed !== true) preflightBlockers.push("rag_non_authority_not_confirmed_for_matched_outcome");
  if (receipt.ragLogicSupportReviewed !== true) preflightBlockers.push("rag_logic_support_not_reviewed_for_matched_outcome");
}

const reusedValidation =
  preflightBlockers.length === 0
    ? runNode(
        "validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs",
        [
          "--goal",
          goal,
          "--run",
          adaptedRunPath,
          "--receipt",
          adaptedReceiptPath,
          "--out-dir",
          join(validationDir, "reused-repair-outcome-review-validation")
        ],
        process.cwd()
      )
    : {
        status: "reusable_workflow_repair_invocation_needs_teacher_review_or_more_evidence",
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
const forbiddenDecisionUsed =
  reusedValidation.forbiddenDecisionUsed === true || receipt.teacherDecision === "enable_rule" || receipt.teacherDecision === "write_memory";
const blockers = [...preflightBlockers, ...(reusedValidation.blockers || [])].filter((value, index, arr) => arr.indexOf(value) === index);
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_rag_informed_repair_outcome_review_decision"
  : outcomeMatchedContract
    ? "rag_informed_repair_outcome_matched_contract_waiting_for_reuse_review"
    : escalateToHighReasoningRepair
      ? "rag_informed_repair_outcome_to_high_reasoning_contract_repair"
      : "rag_informed_repair_outcome_needs_teacher_review_or_more_evidence";
const providerRoleUsePlanTrace = reusedValidation.providerRoleUsePlanTrace || ragRun.providerRoleUsePlanTrace || null;
const highReasoningRepairHandoff = escalateToHighReasoningRepair
  ? {
      kind: "rag_informed_repair_outcome_high_reasoning_repair_handoff",
      runtimeTransition: "rag_informed_fresh_outcome_to_high_reasoning_contract_repair",
      sourceRagInformedRunId: ragRun.runId || "",
      sourceRagInformedRunStatus: ragRun.status || "",
      providerRoleUsePlanTrace,
      teacherDecision: reusedValidation.decision,
      teacherCorrection: receipt.teacherCorrection || "",
      observedIssue: receipt.observedIssue || receipt.teacherNote || "",
      affectedLogicFields: Array.isArray(receipt.affectedLogicFields) ? receipt.affectedLogicFields : [],
      ragEvidenceReviewed: receipt.ragEvidenceReviewed === true,
      ragEvidenceTreatedAsAuthority: false,
      evidenceToInspect: [
        ragRunInput.path,
        ragRun.generatedEvidence?.reusableWorkflowRunnerPacketPath || "",
        ragRun.generatedEvidence?.reusableWorkflowRunnerReceiptPath || "",
        ragRun.generatedEvidence?.existingRunnerReceiptPath || "",
        ragRun.generatedEvidence?.adapterReceiptPath || "",
        ragRun.generatedEvidence?.outcomeVerificationPath || "",
        ragRun.generatedEvidence?.postActionCheckpointPath || "",
        reusedValidation.validationPath || ""
      ].filter(Boolean),
      repairTasks: [
        "Use highest-reasoning compile again to repair the TLCL contract, Rule DSL, validators, route binding, workflow fingerprint, RAG evidence interpretation, or command template.",
        "Keep RAG evidence non-authoritative; it can explain the repair but cannot authorize runtime or memory.",
        "Keep medium runtime blocked until deterministic validation, workflow fingerprint review, approval-gate rebuild, and a new fresh outcome review pass again."
      ],
      mediumRuntimeContinuationBlocked: true
    }
  : null;
const matchedRagOutcomeHandoff = outcomeMatchedContract
  ? {
      kind: "rag_informed_repair_fresh_outcome_matched_contract_handoff",
      runtimeTransition: "rag_informed_fresh_outcome_waiting_for_reuse_review",
      sourceRagInformedRunId: ragRun.runId || "",
      providerRoleUsePlanTrace,
      ragEvidenceTreatedAsAuthority: false,
      executesNow: false,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      nextRequiredReview:
        "Teacher must separately decide whether this RAG-informed repaired reusable workflow evidence can update or preserve the reusable workflow card."
    }
  : null;
const validationPath = join(validationDir, "tlcl-rag-informed-repair-approved-gate-outcome-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-rag-informed-repair-approved-gate-outcome-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_RAG_INFORMED_REPAIR_APPROVED_GATE_OUTCOME_REVIEW_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision: reusedValidation.decision,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  ragEvidenceTreatedAsAuthority: false,
  providerRoleUsePlanTrace,
  blockers,
  matchedRagOutcomeHandoff,
  highReasoningRepairHandoff,
  reusedRepairOutcomeReviewValidatorInvoked: preflightBlockers.length === 0,
  reusedRepairOutcomeReviewValidationStatus: reusedValidation.status,
  sourceEvidence: {
    ragInformedRunPath: ragRunInput.path,
    ragInformedRunHash: sha256Object(ragRun),
    ragOutcomeReviewReceiptPath: receiptInput.path,
    ragOutcomeReviewReceiptHash: sha256Object(receipt),
    adaptedRepairRunPath: adaptedRunPath,
    adaptedRepairReceiptPath: adaptedReceiptPath,
    reusedValidationPath: reusedValidation.validationPath || "",
    providerRoleUsePlanTrace
  },
  blockedTransitions: [
    "run_rag_informed_repaired_workflow_from_outcome_validation",
    "treat_rag_as_authority_from_outcome_validation",
    "enable_rule_from_rag_outcome_validation",
    "write_memory_from_rag_outcome_validation",
    "unlock_packaging_from_rag_outcome_validation",
    "claim_goal_complete_from_rag_outcome_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceRagInformedRun: ragRunInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_validation_receipt_v1",
  validationId,
  status,
  decision: reusedValidation.decision,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  ragEvidenceTreatedAsAuthority: false,
  providerRoleUsePlanTrace,
  blockers,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  technologyAccepted: false,
  packagingGated: true,
  packagingUnlocked: false,
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
    "# TLCL RAG-Informed Repair Approved-Gate Outcome Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${reusedValidation.decision}`,
    "",
    "This validation reads one fresh RAG-informed outcome review after high-reasoning repair. It does not run software, treat RAG as authority, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_outcome_review_validation_result_v1",
      validationId,
      status,
      decision: reusedValidation.decision,
      outcomeMatchedContract,
      mismatchBlocked,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      ragEvidenceTreatedAsAuthority: false,
      blockers,
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      reusedRepairOutcomeReviewValidatorInvoked: preflightBlockers.length === 0,
      reusedRepairOutcomeReviewValidationStatus: reusedValidation.status,
      approvedGateRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false
    },
    null,
    2
  )
);
