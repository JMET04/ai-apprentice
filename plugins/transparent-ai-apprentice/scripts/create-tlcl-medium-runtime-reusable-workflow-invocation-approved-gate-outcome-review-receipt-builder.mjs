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
    String(value || "tlcl-reusable-workflow-approved-gate-outcome-review-receipt-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-approved-gate-outcome-review-receipt-builder"
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
    reusesExistingTlclOutcomeReviewBuilder: true,
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

function reasoningBudgetGovernorReviewTraceFromRun(run) {
  return run?.sourceEvidence?.reasoningBudgetGovernorReviewTrace || {};
}

const goal = argValue("--goal", "Build a teacher outcome review receipt for one TLCL reusable workflow approved-gate run.");
const runInput = readJsonInput(
  argValue("--run", argValue("--approved-gate-runner", argValue("--reusable-workflow-run", ""))),
  "--run",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_runner_v1"
);
const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-approved-gate-outcome-review-receipt-builders")
  )
);
const run = runInput.value;
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const adaptedRunPath = join(builderDir, "adapted-tlcl-approved-gate-runner.json");
writeJson(adaptedRunPath, adaptReusableRun(run));

const existingBuilder = runNode(
  "create-tlcl-medium-runtime-approved-gate-outcome-review-receipt-builder.mjs",
  ["--goal", goal, "--run", adaptedRunPath, "--out-dir", join(builderDir, "existing-outcome-review-builder")],
  process.cwd()
);
const existingTemplate = readJson(existingBuilder.receiptTemplatePath);
const receiptTemplatePath = join(builderDir, "tlcl-reusable-workflow-approved-gate-outcome-review-receipt-template.json");
const builderPath = join(builderDir, "tlcl-reusable-workflow-approved-gate-outcome-review-receipt-builder.json");
const readmePath = join(builderDir, "TLCL_REUSABLE_WORKFLOW_APPROVED_GATE_OUTCOME_REVIEW_RECEIPT_BUILDER_START_HERE.md");
const receiptTemplate = {
  ...existingTemplate,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_v1",
  sourceRunPath: runInput.path,
  sourceRunId: run.runId || "",
  reusableWorkflowInvocationReviewed: false,
  reusableWorkflowFingerprintReviewed: false,
  teacherNote: "Review this reusable workflow invocation outcome before any memory, rule, packaging, or completion claim."
};
const builder = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status: "reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_ready_for_teacher_use",
  sourceRunStatus: run.status || "",
  existingOutcomeReviewBuilderInvoked: true,
  existingOutcomeReviewBuilderStatus: existingBuilder.status,
  reusableWorkflowContext: {
    workflowFingerprint: run.sourceEvidence?.workflowFingerprint || "",
    reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromRun(run),
    runnerInvoked: run.runnerInvoked === true,
    controlledRouteActionExecuted: run.controlledRouteActionExecuted === true,
    targetSoftwareCommandsExecuted: run.targetSoftwareCommandsExecuted === true
  },
  defaultReceipt: receiptTemplate,
  sourceEvidence: {
    reusableWorkflowRunPath: runInput.path,
    reusableWorkflowRunHash: sha256Object(run),
    reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromRun(run),
    adaptedRunPath,
    existingBuilderPath: existingBuilder.builderPath,
    existingReceiptTemplatePath: existingBuilder.receiptTemplatePath
  },
  nextValidationCommand:
    'node plugins\\transparent-ai-apprentice\\scripts\\validate-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-outcome-review-receipt.mjs --run "' +
    (runInput.path || "<tlcl-reusable-workflow-approved-gate-runner.json>") +
    '" --receipt "<teacher-filled-reusable-workflow-outcome-review-receipt.json>"',
  paths: {
    builder: builderPath,
    receiptTemplate: receiptTemplatePath,
    readme: readmePath,
    adaptedRun: adaptedRunPath,
    sourceRun: runInput.path
  },
  locks: locks()
};

writeJson(builderPath, builder);
writeJson(receiptTemplatePath, receiptTemplate);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow Approved-Gate Outcome Review Receipt Builder",
    "",
    `Status: ${builder.status}`,
    `Source reusable workflow run: ${runInput.path || "<inline>"}`,
    "",
    "Use this after one teacher-approved reusable workflow invocation has produced a controlled route outcome.",
    "A matched outcome remains review-only. A mismatch or teacher correction returns to high-reasoning contract repair.",
    "",
    "This builder does not validate the receipt, execute software, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
    "",
    `Next validation command: ${builder.nextValidationCommand}`
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_receipt_builder_result_v1",
      builderId,
      status: builder.status,
      builderPath,
      receiptTemplatePath,
      readmePath,
      adaptedRunPath,
      existingOutcomeReviewBuilderInvoked: true,
      existingOutcomeReviewBuilderStatus: existingBuilder.status,
      controlledRouteActionExecuted: builder.reusableWorkflowContext.controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted: builder.reusableWorkflowContext.targetSoftwareCommandsExecuted,
      doesNotRunApprovedGate: true,
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
