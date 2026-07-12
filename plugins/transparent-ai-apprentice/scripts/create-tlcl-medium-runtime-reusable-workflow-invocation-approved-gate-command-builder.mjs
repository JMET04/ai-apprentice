#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function slugify(value) {
  return (
    String(value || "tlcl-reusable-workflow-invocation-approved-gate-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-invocation-approved-gate-command-builder"
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) return { value: null, path: "" };
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

function runExistingBuilder(args, cwd) {
  const result = spawnSync(
    process.execPath,
    [join(__dirname, "create-all-software-execution-approved-gate-command-builder.mjs"), ...args],
    {
      cwd,
      encoding: "utf8",
      timeout: 300000
    }
  );
  if (result.status !== 0) {
    return {
      ok: false,
      error: result.stderr || result.stdout || "create-all-software-execution-approved-gate-command-builder.mjs failed"
    };
  }
  return { ok: true, result: JSON.parse(result.stdout) };
}

function locks() {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    wrapperDoesNotRunApprovedGate: true,
    wrapperDoesNotInvokeRunner: true,
    wrapperDoesNotExecuteTargetSoftware: true,
    wrapperDoesNotSendUiEvents: true,
    wrapperDoesNotCaptureScreenshots: true,
    wrapperDoesNotWriteMemory: true,
    generatedCommandRequiresTeacherConfirmation: true,
    generatedCommandRequiresRollback: true,
    runnerLaunched: false,
    commandsExecutedByWrapper: false,
    softwareActionsExecutedByWrapper: false,
    targetSoftwareCommandsExecutedByWrapper: false,
    uiEventsSentByWrapper: false,
    screenshotsCaptured: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function providerRoleUsePlanTraceFromPrep(prep) {
  return prep?.sourceEvidence?.providerRoleUsePlanTrace || {};
}

function reasoningBudgetGovernorReviewTraceFromPrep(prep) {
  return prep?.sourceEvidence?.reasoningBudgetGovernorReviewTrace || {};
}

const goal = argValue("--goal", argValue("--task", "Build a TLCL reusable workflow teacher-facing approved-gate command page."));
const prepInput = readJsonInput(
  argValue("--prep", argValue("--prep-runner", argValue("--invocation-prep", ""))),
  "--prep",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approval_gate_prep_runner_v1"
);
if (!prepInput.value) throw new Error("--prep is required");

const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-invocation-approved-gate-command-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const builderDir = join(outRoot, builderId);
mkdirSync(builderDir, { recursive: true });

const prep = prepInput.value;
const approvalGatePath = argValue("--gate", prep.generatedEvidence?.approvalGatePath || "");
const blockers = [];
if (prep.status !== "reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review") {
  blockers.push("reusable_workflow_invocation_prep_status_not_ready_for_teacher_execute_review");
}
if (prep.planReady !== true) blockers.push("reusable_workflow_invocation_plan_not_ready");
if (prep.approvalGateInvoked !== true) blockers.push("reusable_workflow_invocation_approval_gate_not_invoked");
if (prep.readyForExecuteRequest !== true) blockers.push("reusable_workflow_invocation_readyForExecuteRequest_not_true");
if (prep.locks?.prepRunnerDoesNotInvokeExecutionRunner !== true) blockers.push("reusable_workflow_invocation_execution_runner_lock_missing");
if (!approvalGatePath || !existsSync(approvalGatePath)) blockers.push("approval_gate_path_missing");

let existingBuilder = null;
let existingBuilderResult = null;
if (blockers.length === 0) {
  const run = runExistingBuilder(
    [
      "--goal",
      goal,
      "--gate",
      approvalGatePath,
      "--output-dir",
      join(builderDir, "existing-approved-gate-command-builder")
    ],
    process.cwd()
  );
  if (!run.ok) {
    blockers.push(`existing_command_builder_failed: ${run.error}`);
  } else {
    existingBuilderResult = run.result;
    existingBuilder = existingBuilderResult.paths?.builder && existsSync(existingBuilderResult.paths.builder)
      ? readJson(existingBuilderResult.paths.builder)
      : null;
    if (existingBuilder?.status !== "approval_gate_command_builder_ready_for_teacher_final_confirmation") {
      blockers.push("existing_command_builder_not_ready_for_teacher_final_confirmation");
    }
  }
}

const status =
  blockers.length === 0
    ? "reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation"
    : "blocked_before_reusable_workflow_invocation_approved_gate_command_builder";
const wrapperPath = join(builderDir, "tlcl-reusable-workflow-invocation-approved-gate-command-builder.json");
const receiptPath = join(builderDir, "tlcl-reusable-workflow-invocation-approved-gate-command-builder-receipt.json");
const readmePath = join(builderDir, "TLCL_REUSABLE_WORKFLOW_INVOCATION_APPROVED_GATE_COMMAND_BUILDER_START_HERE.md");
const wrapper = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourcePrepStatus: prep.status || "",
  sourceEvidence: {
    prepPath: prepInput.path,
    approvalGatePath,
    workflowFingerprint: prep.sourceEvidence?.workflowFingerprint || "",
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromPrep(prep),
    reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromPrep(prep),
    existingCommandBuilderScript: join(__dirname, "create-all-software-execution-approved-gate-command-builder.mjs")
  },
  existingCommandBuilderInvoked: existingBuilderResult !== null,
  existingCommandBuilderStatus: existingBuilder?.status || "",
  generatedEvidence: {
    existingBuilderPath: existingBuilderResult?.paths?.builder || "",
    existingBuilderHtmlPath: existingBuilderResult?.paths?.html || "",
    existingBuilderReadmePath: existingBuilderResult?.paths?.readme || "",
    commandTemplate: existingBuilderResult?.commandTemplate || "",
    existingBuilderResult
  },
  blockers,
  blockedTransitions: [
    "run_approved_gate_runner_from_reusable_workflow_invocation_builder",
    "execute_target_software_from_reusable_workflow_invocation_builder",
    "send_ui_events_from_reusable_workflow_invocation_builder",
    "capture_screenshot_from_reusable_workflow_invocation_builder",
    "write_memory_from_reusable_workflow_invocation_builder",
    "enable_rule_from_reusable_workflow_invocation_builder",
    "unlock_packaging_from_reusable_workflow_invocation_builder",
    "claim_completion_from_reusable_workflow_invocation_builder"
  ],
  nextTeacherActions: blockers.length
    ? [
        "Resolve every blocker before using a final approved-gate command builder.",
        "Return to the reusable workflow invocation approval-gate prep runner if the source gate is missing or not ready."
      ]
    : [
        "Open the generated existing command-builder HTML.",
        "Review the ready approval gate and generated command request for this reusable workflow invocation.",
        "Only after final teacher confirmation and rollback evidence should a separate approved-gate runner command be run."
      ],
  paths: {
    wrapper: wrapperPath,
    receipt: receiptPath,
    readme: readmePath,
    sourcePrep: prepInput.path
  },
  locks: locks()
};
const receipt = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_command_builder_receipt_v1",
  builderId,
  status,
  existingCommandBuilderInvoked: wrapper.existingCommandBuilderInvoked,
  existingCommandBuilderStatus: wrapper.existingCommandBuilderStatus,
  existingBuilderPath: wrapper.generatedEvidence.existingBuilderPath,
  existingBuilderHtmlPath: wrapper.generatedEvidence.existingBuilderHtmlPath,
  commandTemplate: wrapper.generatedEvidence.commandTemplate,
  blockers,
  commandsExecutedByWrapper: false,
  softwareActionsExecutedByWrapper: false,
  targetSoftwareCommandsExecutedByWrapper: false,
  uiEventsSentByWrapper: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  goalComplete: false,
  locks: locks()
};

writeJson(wrapperPath, wrapper);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow Invocation Approved-Gate Command Builder",
    "",
    `Status: ${status}`,
    `Source prep: ${prepInput.path || "<inline>"}`,
    `Approval gate: ${approvalGatePath || "<missing>"}`,
    "",
    "This TLCL wrapper validates that a ready execution approval gate came from the reusable workflow invocation chain, then reuses the existing approved-gate command builder.",
    "",
    "It does not run the approved gate runner, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_command_builder_result_v1",
      builderId,
      status,
      wrapperPath,
      receiptPath,
      readmePath,
      existingBuilderPath: wrapper.generatedEvidence.existingBuilderPath,
      existingBuilderHtmlPath: wrapper.generatedEvidence.existingBuilderHtmlPath,
      commandTemplate: wrapper.generatedEvidence.commandTemplate,
      existingCommandBuilderInvoked: wrapper.existingCommandBuilderInvoked,
      existingCommandBuilderStatus: wrapper.existingCommandBuilderStatus,
      blockers,
      commandsExecutedByWrapper: false,
      softwareActionsExecutedByWrapper: false,
      targetSoftwareCommandsExecutedByWrapper: false,
      uiEventsSentByWrapper: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      goalComplete: false,
      locks: locks()
    },
    null,
    2
  )
);
