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
    String(value || "tlcl-reusable-workflow-repair-approved-gate-outcome-review-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-approved-gate-outcome-review-receipt-builder"
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
    receiptBuilderOnly: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    reusesExistingReusableWorkflowOutcomeReviewBuilder: true,
    repairFreshOutcomeReviewRequired: true,
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

function runNode(scriptName, args, cwd) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 300000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function reasoningBudgetGovernorReviewTraceFromRepairRun(repairRun) {
  return (
    repairRun.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    repairRun.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

function adaptRepairRun(repairRun) {
  const reused = repairRun.generatedEvidence?.reusableWorkflowRunnerResult || {};
  const ragInformedRepairReuse = repairRun.ragInformedRepairReuse === true || repairRun.sourceEvidence?.ragInformedRepairReuse === true;
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
      reasoningBudgetGovernorReviewTrace
    },
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

const goal = argValue(
  "--goal",
  "Build a fresh teacher outcome review receipt for one high-reasoning repaired TLCL reusable workflow run."
);
const repairRunInput = readJsonInput(
  argValue("--run", argValue("--repair-run", argValue("--approved-gate-runner", ""))),
  "--run",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-approved-gate-outcome-review-receipt-builders")
  )
);
const repairRun = repairRunInput.value;
const ragInformedRepairReuse = repairRun.ragInformedRepairReuse === true || repairRun.sourceEvidence?.ragInformedRepairReuse === true;
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromRepairRun(repairRun);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const adaptedRunPath = join(builderDir, "adapted-reusable-workflow-approved-gate-runner.json");
writeJson(adaptedRunPath, adaptRepairRun(repairRun));

const adaptedRun = readJson(adaptedRunPath);
const blockers = [];
if (repairRun.status !== "reusable_workflow_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review") {
  blockers.push("repair_approved_gate_runner_not_waiting_for_fresh_outcome_review");
}
if (repairRun.runnerInvoked !== true) blockers.push("repair_runner_not_invoked");
if (repairRun.controlledRouteActionExecuted !== true) blockers.push("repair_controlled_route_not_executed");
if (repairRun.locks?.freshOutcomeReviewRequired !== true) blockers.push("repair_runner_fresh_outcome_review_lock_missing");
if (repairRun.locks?.goalComplete !== false) blockers.push("repair_runner_goal_completion_lock_missing");
if (repairRun.locks?.packagingGated !== true) blockers.push("repair_runner_packaging_gate_lock_missing");
if (ragInformedRepairReuse) {
  if (repairRun.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_informed_repair_run_treats_rag_as_authority");
  if (repairRun.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_repair_run_non_authority_flag_missing");
  if (repairRun.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_repair_run_non_authority_lock_missing");
  if (repairRun.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_repair_run_does_not_treat_rag_as_authority_lock_missing");
  }
}

const existingBuilder =
  blockers.length === 0
    ? runNode(
        "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt-builder.mjs",
        ["--goal", goal, "--run", adaptedRunPath, "--out-dir", join(builderDir, "reused-reusable-workflow-outcome-review-builder")],
        process.cwd()
      )
    : null;
const existingTemplate = existingBuilder ? readJson(existingBuilder.receiptTemplatePath) : null;
const receiptTemplatePath = join(builderDir, "tlcl-reusable-workflow-repair-approved-gate-outcome-review-receipt-template.json");
const builderPath = join(builderDir, "tlcl-reusable-workflow-repair-approved-gate-outcome-review-receipt-builder.json");
const readmePath = join(builderDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_APPROVED_GATE_OUTCOME_REVIEW_RECEIPT_BUILDER_START_HERE.md");
const status =
  blockers.length === 0
    ? "reusable_workflow_repair_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use"
    : "blocked_before_reusable_workflow_repair_approved_gate_outcome_review_receipt_builder";
const receiptTemplate = existingTemplate
  ? {
      ...existingTemplate,
      format:
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_v1",
      sourceRepairRunPath: repairRunInput.path,
      sourceRepairRunId: repairRun.runId || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      reasoningBudgetGovernorReviewTrace,
      ragEvidenceNonAuthoritativeReviewed: false,
      repairRunnerPacketReviewed: false,
      reusedWorkflowRunnerPacketReviewed: false,
      repairedRouteOutcomeReviewed: false,
      repairWorkflowFingerprintReviewed: false,
      teacherNote:
        "Review this fresh outcome after high-reasoning repair before any memory, rule enablement, packaging, or completion claim."
    }
  : {
      format:
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_v1",
      builderId,
      sourceRepairRunPath: repairRunInput.path,
      sourceRepairRunId: repairRun.runId || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      reasoningBudgetGovernorReviewTrace,
      ragEvidenceNonAuthoritativeReviewed: false,
      teacherDecision: "needs_teacher_review",
      repairRunnerPacketReviewed: false,
      reusedWorkflowRunnerPacketReviewed: false,
      repairedRouteOutcomeReviewed: false,
      repairWorkflowFingerprintReviewed: false,
      blockedActionsConfirmed: true,
      locks: locks()
    };
const builder = {
  ok: true,
  format:
    "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  blockers,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  sourceRepairRunStatus: repairRun.status || "",
  reusedOutcomeReviewBuilderInvoked: Boolean(existingBuilder),
  reusedOutcomeReviewBuilderStatus: existingBuilder?.status || "",
  repairOutcomeContext: {
    repairRunId: repairRun.runId || "",
    repairedRunnerInvoked: repairRun.runnerInvoked === true,
    controlledRouteActionExecuted: repairRun.controlledRouteActionExecuted === true,
    targetSoftwareCommandsExecuted: repairRun.targetSoftwareCommandsExecuted === true,
    workflowFingerprint: adaptedRun.sourceEvidence?.workflowFingerprint || "",
    ragInformedRepairReuse
  },
  defaultReceipt: receiptTemplate,
  sourceEvidence: {
    repairRunPath: repairRunInput.path,
    repairRunHash: sha256Object(repairRun),
    adaptedReusableWorkflowRunPath: adaptedRunPath,
    reusedBuilderPath: existingBuilder?.builderPath || "",
    reusedReceiptTemplatePath: existingBuilder?.receiptTemplatePath || "",
    reasoningBudgetGovernorReviewTrace
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-medium-runtime-reusable-workflow-invocation-high-reasoning-repair-approved-gate-outcome-review-receipt.mjs --run "' +
    (repairRunInput.path || "<tlcl-reusable-workflow-repair-approved-gate-runner.json>") +
    '" --receipt "<teacher-filled-repair-outcome-review-receipt.json>"',
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    sourceRepairRun: repairRunInput.path,
    adaptedReusableWorkflowRun: adaptedRunPath
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow Repair Approved-Gate Outcome Review Receipt Builder",
    "",
    `Status: ${status}`,
    `Source repair run: ${repairRunInput.path || "<inline>"}`,
    "",
    "Use this after a high-reasoning repaired reusable workflow approved-gate runner produced one controlled route outcome.",
    "A matched fresh outcome remains review-only. A mismatch or teacher correction returns to high-reasoning repair again.",
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
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_outcome_review_receipt_builder_result_v1",
      builderId,
      status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      adaptedRunPath,
      blockers,
      reusedOutcomeReviewBuilderInvoked: Boolean(existingBuilder),
      reusedOutcomeReviewBuilderStatus: existingBuilder?.status || "",
      controlledRouteActionExecuted: builder.repairOutcomeContext.controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted: builder.repairOutcomeContext.targetSoftwareCommandsExecuted,
      doesNotRunApprovedGate: true,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
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
