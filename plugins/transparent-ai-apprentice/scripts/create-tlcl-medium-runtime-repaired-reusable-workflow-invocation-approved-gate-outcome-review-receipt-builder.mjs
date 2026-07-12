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
    String(value || "tlcl-repaired-reusable-workflow-outcome-review-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-repaired-reusable-workflow-outcome-review-receipt-builder"
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
    receiptBuilderOnly: true,
    repairedReusableWorkflowInvocation: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    reusesExistingReusableWorkflowOutcomeReviewBuilder: true,
    freshOutcomeReviewRequired: true,
    doesNotValidateReceipt: true,
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

const goal = argValue(
  "--goal",
  "Build a fresh teacher outcome review receipt for one repaired TLCL reusable workflow invocation run."
);
const runInput = readJsonInput(
  argValue("--run", argValue("--repaired-run", argValue("--approved-gate-runner", ""))),
  "--run",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-repaired-reusable-workflow-outcome-review-receipt-builders")
  )
);
const repairedRun = runInput.value;
const ragInformedRepairReuse = repairedRun.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromRepairedRun(repairedRun);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromRepairedRun(repairedRun);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const adaptedRunPath = join(builderDir, "adapted-reusable-workflow-approved-gate-runner.json");
writeJson(adaptedRunPath, adaptRepairedRun(repairedRun));

const adaptedRun = readJson(adaptedRunPath);
const blockers = [];
if (
  repairedRun.status !==
  "repaired_reusable_workflow_invocation_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
) {
  blockers.push("repaired_reusable_workflow_runner_not_waiting_for_fresh_outcome_review");
}
if (repairedRun.runnerInvoked !== true) blockers.push("repaired_reusable_workflow_runner_not_invoked");
if (repairedRun.controlledRouteActionExecuted !== true) blockers.push("repaired_reusable_workflow_controlled_route_not_executed");
if (repairedRun.locks?.freshOutcomeReviewRequired !== true) blockers.push("repaired_reusable_workflow_fresh_outcome_review_lock_missing");
if (repairedRun.locks?.goalComplete !== false) blockers.push("repaired_reusable_workflow_goal_completion_lock_missing");
if (repairedRun.locks?.packagingGated !== true) blockers.push("repaired_reusable_workflow_packaging_gate_lock_missing");
if (ragInformedRepairReuse) {
  if (repairedRun.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_informed_repaired_run_treats_rag_as_authority");
  if (repairedRun.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_repaired_run_non_authority_flag_missing");
  if (repairedRun.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_repaired_run_non_authority_lock_missing");
  if (repairedRun.locks?.doesNotTreatRagAsAuthority !== true) blockers.push("rag_informed_repaired_run_does_not_treat_rag_as_authority_lock_missing");
}

const reusedBuilder =
  blockers.length === 0
    ? runNode(
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs",
        ["--goal", goal, "--run", adaptedRunPath, "--out-dir", join(builderDir, "reused-reusable-workflow-outcome-review-builder")],
        process.cwd()
      )
    : null;
const reusedTemplate = reusedBuilder ? readJson(reusedBuilder.receiptTemplatePath) : null;
const receiptTemplatePath = join(builderDir, "tlcl-repaired-reusable-workflow-outcome-review-receipt-template.json");
const builderPath = join(builderDir, "tlcl-repaired-reusable-workflow-outcome-review-receipt-builder.json");
const readmePath = join(builderDir, "TLCL_REPAIRED_REUSABLE_WORKFLOW_OUTCOME_REVIEW_RECEIPT_BUILDER_START_HERE.md");
const status =
  blockers.length === 0
    ? "repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use"
    : "blocked_before_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder";
const receiptTemplate = reusedTemplate
  ? {
      ...reusedTemplate,
      format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_v1",
      sourceRepairedRunPath: runInput.path,
      sourceRepairedRunId: repairedRun.runId || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragEvidenceNonAuthoritativeReviewed: false,
      repairedRunnerPacketReviewed: false,
      reusedWorkflowRunnerPacketReviewed: false,
      repairedRouteOutcomeReviewed: false,
      repairedWorkflowFingerprintReviewed: false,
      teacherNote:
        "Review this fresh repaired reusable workflow outcome before memory, rule enablement, packaging, or completion."
    }
  : {
      format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_v1",
      builderId,
      sourceRepairedRunPath: runInput.path,
      sourceRepairedRunId: repairedRun.runId || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      ragEvidenceNonAuthoritativeReviewed: false,
      teacherDecision: "needs_teacher_review",
      repairedRunnerPacketReviewed: false,
      reusedWorkflowRunnerPacketReviewed: false,
      repairedRouteOutcomeReviewed: false,
      repairedWorkflowFingerprintReviewed: false,
      blockedActionsConfirmed: true,
      locks: locks()
    };
const builder = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  blockers,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  sourceRepairedRunStatus: repairedRun.status || "",
  reusedOutcomeReviewBuilderInvoked: Boolean(reusedBuilder),
  reusedOutcomeReviewBuilderStatus: reusedBuilder?.status || "",
  repairedOutcomeContext: {
    repairedRunId: repairedRun.runId || "",
    runnerInvoked: repairedRun.runnerInvoked === true,
    controlledRouteActionExecuted: repairedRun.controlledRouteActionExecuted === true,
    targetSoftwareCommandsExecuted: repairedRun.targetSoftwareCommandsExecuted === true,
    workflowFingerprint: adaptedRun.sourceEvidence?.workflowFingerprint || "",
    ragInformedRepairReuse
  },
  defaultReceipt: receiptTemplate,
  sourceEvidence: {
    repairedRunPath: runInput.path,
    repairedRunHash: sha256Object(repairedRun),
    adaptedReusableWorkflowRunPath: adaptedRunPath,
    reusedBuilderPath: reusedBuilder?.builderPath || "",
    reusedReceiptTemplatePath: reusedBuilder?.receiptTemplatePath || "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-medium-runtime-repaired-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs --run "' +
    (runInput.path || "<tlcl-repaired-reusable-workflow-approved-gate-runner.json>") +
    '" --receipt "<teacher-filled-repaired-reusable-workflow-outcome-review-receipt.json>"',
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceRepairedRun: runInput.path,
    adaptedReusableWorkflowRun: adaptedRunPath
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Repaired Reusable Workflow Outcome Review Receipt Builder",
    "",
    `Status: ${status}`,
    `Source repaired run: ${runInput.path || "<inline>"}`,
    "",
    "Use this after one repaired reusable workflow approved-gate runner produced a controlled route outcome.",
    "A matched fresh outcome remains review-only and can only move to a separate reuse review. A mismatch or teacher correction returns to high-reasoning repair.",
    "",
    "This builder does not validate the receipt, rerun the approved gate, execute software, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    `Next validation command: ${builder.nextValidationCommand}`
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format:
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_result_v1",
      builderId,
      status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      adaptedRunPath,
      blockers,
      reusedOutcomeReviewBuilderInvoked: Boolean(reusedBuilder),
      reusedOutcomeReviewBuilderStatus: reusedBuilder?.status || "",
      controlledRouteActionExecuted: builder.repairedOutcomeContext.controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted: builder.repairedOutcomeContext.targetSoftwareCommandsExecuted,
      doesNotRunApprovedGate: true,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
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
