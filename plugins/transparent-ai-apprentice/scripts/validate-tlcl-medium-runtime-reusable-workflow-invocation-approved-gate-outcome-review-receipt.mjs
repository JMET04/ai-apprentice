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
    String(value || "tlcl-reusable-workflow-approved-gate-outcome-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-approved-gate-outcome-review-validation"
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
    reusesExistingTlclOutcomeReviewValidator: true,
    doesNotRunApprovedGate: true,
    doesNotExecuteTargetSoftware: true,
    doesNotCaptureScreenshots: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function providerRoleUsePlanTraceFromRun(run) {
  return run?.sourceEvidence?.providerRoleUsePlanTrace || {};
}

function reasoningBudgetGovernorReviewTraceFromRun(run) {
  return run?.sourceEvidence?.reasoningBudgetGovernorReviewTrace || {};
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

function adaptReusableRun(run) {
  return {
    ...run,
    format: "transparent_ai_tlcl_medium_runtime_approved_gate_runner_v1",
    status:
      run.status === "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review"
        ? "tlcl_approved_gate_controlled_route_completed_waiting_for_teacher_review"
        : run.status,
    sourceReusableWorkflowInvocationRunId: run.runId || "",
    sourceReusableWorkflowInvocationStatus: run.status || ""
  };
}

function adaptReusableReceipt(receipt) {
  return {
    ...receipt,
    format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_v1"
  };
}

const goal = argValue("--goal", "Validate teacher outcome review for one TLCL reusable workflow approved-gate run.");
const runInput = readJsonInput(
  argValue("--run", argValue("--approved-gate-runner", argValue("--reusable-workflow-run", ""))),
  "--run",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-approved-gate-outcome-review-validations")
  )
);
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const adaptedRunPath = join(validationDir, "adapted-tlcl-approved-gate-runner.json");
const adaptedReceiptPath = join(validationDir, "adapted-tlcl-approved-gate-outcome-review-receipt.json");
const run = runInput.value;
const receipt = receiptInput.value;
writeJson(adaptedRunPath, adaptReusableRun(run));
writeJson(adaptedReceiptPath, adaptReusableReceipt(receipt));

const existingValidation = runNode(
  "validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs",
  ["--goal", goal, "--run", adaptedRunPath, "--receipt", adaptedReceiptPath, "--out-dir", join(validationDir, "existing-outcome-review-validation")],
  process.cwd()
);
const existingValidationPacket = readJson(existingValidation.validationPath);
const outcomeMatchedContract = existingValidation.outcomeMatchedContract === true;
const mismatchBlocked = existingValidation.mismatchBlocked === true;
const escalateToHighReasoningRepair = existingValidation.escalateToHighReasoningRepair === true || mismatchBlocked;
const forbiddenDecisionUsed = existingValidation.forbiddenDecisionUsed === true;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_reusable_workflow_outcome_review_decision"
  : outcomeMatchedContract
    ? "reusable_workflow_invocation_outcome_matched_contract_waiting_for_reuse_review"
    : escalateToHighReasoningRepair
      ? "reusable_workflow_invocation_to_high_reasoning_contract_repair"
      : "reusable_workflow_invocation_needs_teacher_review_or_more_evidence";
const highReasoningRepairHandoff = escalateToHighReasoningRepair
  ? {
      kind: "reusable_workflow_invocation_high_reasoning_repair_handoff",
      runtimeTransition: "reusable_workflow_invocation_to_high_reasoning_contract_repair",
      sourceRunId: run.runId || "",
      workflowFingerprint: run.sourceEvidence?.workflowFingerprint || "",
      providerRoleUsePlanTrace: providerRoleUsePlanTraceFromRun(run),
      reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromRun(run),
      teacherDecision: existingValidation.decision,
      teacherCorrection: receipt.teacherCorrection || "",
      observedIssue: receipt.observedIssue || receipt.teacherNote || "",
      affectedLogicFields: Array.isArray(receipt.affectedLogicFields) ? receipt.affectedLogicFields : [],
      evidenceToInspect: [
        runInput.path,
        run.generatedEvidence?.existingRunnerReceiptPath || "",
        run.generatedEvidence?.adapterReceiptPath || "",
        run.generatedEvidence?.outcomeVerificationPath || "",
        run.generatedEvidence?.postActionCheckpointPath || ""
      ].filter(Boolean),
      repairTasks: [
        "Use highest-reasoning compile to repair the reusable workflow contract, fingerprint rules, route binding, or command template.",
        "Do not let the medium runtime reuse this workflow again until the repaired contract passes deterministic validation.",
        "Rebuild the reusable workflow candidate or invocation planner if the workflow fingerprint changed."
      ]
    }
  : null;
const validationPath = join(validationDir, "tlcl-reusable-workflow-approved-gate-outcome-review-validation.json");
const validationReceiptPath = join(validationDir, "tlcl-reusable-workflow-approved-gate-outcome-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_REUSABLE_WORKFLOW_APPROVED_GATE_OUTCOME_REVIEW_VALIDATION_START_HERE.md");
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision: existingValidation.decision,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers: existingValidation.blockers || [],
  highReasoningRepairHandoff,
  existingOutcomeReviewValidatorInvoked: true,
  existingOutcomeReviewValidationStatus: existingValidation.status,
  sourceEvidence: {
    reusableWorkflowRunPath: runInput.path,
    reusableWorkflowRunHash: sha256Object(run),
    reusableWorkflowReceiptPath: receiptInput.path,
    reusableWorkflowReceiptHash: sha256Object(receipt),
    adaptedRunPath,
    adaptedReceiptPath,
    existingValidationPath: existingValidation.validationPath,
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromRun(run),
    reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromRun(run)
  },
  blockedTransitions: [
    "run_reusable_workflow_from_outcome_validation",
    "enable_rule_from_reusable_workflow_outcome_validation",
    "write_memory_from_reusable_workflow_outcome_validation",
    "unlock_packaging_from_reusable_workflow_outcome_validation",
    "claim_goal_complete_from_reusable_workflow_outcome_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: validationReceiptPath,
    readme: readmePath,
    sourceRun: runInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_validation_receipt_v1",
  validationId,
  status,
  decision: existingValidation.decision,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers: existingValidation.blockers || [],
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
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
    "# TLCL Reusable Workflow Approved-Gate Outcome Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${existingValidation.decision}`,
    "",
    "This validation reads one reusable workflow invocation outcome review receipt. It does not run software, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(validation.blockers.length ? validation.blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_validation_result_v1",
      validationId,
      status,
      decision: existingValidation.decision,
      outcomeMatchedContract,
      mismatchBlocked,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers: existingValidation.blockers || [],
      validationPath,
      receiptPath: validationReceiptPath,
      readmePath,
      existingOutcomeReviewValidatorInvoked: true,
      existingOutcomeReviewValidationStatus: existingValidation.status,
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
