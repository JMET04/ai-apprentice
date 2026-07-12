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

function slug(value) {
  return (
    String(value || "tlcl-repaired-reusable-workflow-invocation-approved-gate-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-repaired-reusable-workflow-invocation-approved-gate-command-builder"
  );
}

function runReusableWorkflowCommandBuilder(args, cwd) {
  const result = spawnSync(
    process.execPath,
    [join(__dirname, "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs"), ...args],
    {
      cwd,
      encoding: "utf8",
      timeout: 300000
    }
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout || "reusable workflow invocation approved-gate command builder failed" };
  }
  return { ok: true, result: JSON.parse(result.stdout) };
}

function locks(builderReady = false) {
  return {
    reviewOnly: true,
    repairedReusableWorkflowInvocation: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    repairedApprovedGateCommandBuilderOnly: true,
    reusesExistingReusableWorkflowCommandBuilder: true,
    repairedApprovedGateCommandReady: builderReady,
    finalTeacherExecuteConfirmationStillRequired: true,
    rollbackStillRequired: true,
    freshOutcomeReviewStillRequired: true,
    doesNotRunApprovedGateRunner: true,
    doesNotRunMediumRuntimeWorkflow: true,
    doesNotExecuteTargetSoftware: true,
    doesNotSendUiEvents: true,
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

function providerRoleUsePlanTraceFromPrep(prep) {
  return (
    prep.sourceEvidence?.providerRoleUsePlanTrace ||
    prep.providerRoleUsePlanTrace ||
    null
  );
}

function reasoningBudgetGovernorReviewTraceFromPrep(prep) {
  return (
    prep.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    prep.reasoningBudgetGovernorReviewTrace ||
    null
  );
}

const goal = argValue(
  "--goal",
  argValue("--task", "Create a final teacher-facing approved-gate command builder for one repaired reusable workflow invocation.")
);
const prepInput = readJsonInput(
  argValue("--prep", argValue("--prep-runner", argValue("--repaired-invocation-prep", ""))),
  "--prep",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner_v1"
);
if (!prepInput.value) throw new Error("--prep is required");

const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-repaired-reusable-workflow-invocation-approved-gate-command-builders")
  )
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const wrapperPath = join(builderDir, "tlcl-repaired-reusable-workflow-invocation-approved-gate-command-builder.json");
const receiptPath = join(builderDir, "tlcl-repaired-reusable-workflow-invocation-approved-gate-command-builder-receipt.json");
const readmePath = join(builderDir, "TLCL_REPAIRED_REUSABLE_WORKFLOW_INVOCATION_APPROVED_GATE_COMMAND_BUILDER_START_HERE.md");
mkdirSync(builderDir, { recursive: true });

const prep = prepInput.value;
const existingPrepPacketPath = prep.generatedEvidence?.existingPrepPacketPath || "";
const approvalGatePath = argValue("--gate", prep.generatedEvidence?.approvalGatePath || "");
const ragInformedRepairReuse = prep.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromPrep(prep);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromPrep(prep);
const blockers = [];
if (prep.status !== "repaired_reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review") {
  blockers.push("repaired_reusable_workflow_invocation_prep_status_not_ready_for_teacher_execute_review");
}
if (prep.wrapperReady !== true) blockers.push("repaired_reusable_workflow_invocation_wrapper_not_ready");
if (prep.repairedReusableWorkflowInvocation !== true) blockers.push("repaired_reusable_workflow_invocation_flag_missing");
if (prep.reusedExistingApprovalGatePrepRunner !== true) blockers.push("existing_approval_gate_prep_runner_not_reused");
if (prep.readyForExecuteRequest !== true) blockers.push("repaired_reusable_workflow_invocation_readyForExecuteRequest_not_true");
if (prep.locks?.prepRunnerDoesNotInvokeExecutionRunner !== true) blockers.push("repaired_invocation_execution_runner_lock_missing");
if (prep.locks?.prepRunnerDoesNotExecuteTargetSoftware !== true) blockers.push("repaired_invocation_target_software_lock_missing");
if (ragInformedRepairReuse) {
  if (prep.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_informed_prep_treats_rag_as_authority");
  if (prep.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_prep_non_authority_flag_missing");
  if (prep.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_prep_non_authority_lock_missing");
  if (prep.locks?.doesNotTreatRagAsAuthority !== true) blockers.push("rag_informed_prep_does_not_treat_rag_as_authority_lock_missing");
}
if (!existingPrepPacketPath || !existsSync(existingPrepPacketPath)) blockers.push("existing_reusable_workflow_invocation_prep_packet_missing");
if (!approvalGatePath || !existsSync(approvalGatePath)) blockers.push("approval_gate_path_missing");

let commandBuilderResult = null;
let commandBuilderInvoked = false;
let builderReady = false;
if (blockers.length === 0) {
  const args = [
    "--goal",
    goal,
    "--prep",
    existingPrepPacketPath,
    "--gate",
    approvalGatePath,
    "--out-dir",
    join(builderDir, "reused-reusable-workflow-invocation-approved-gate-command-builder")
  ];
  commandBuilderInvoked = true;
  const run = runReusableWorkflowCommandBuilder(args, process.cwd());
  if (!run.ok) {
    blockers.push(`reusable_workflow_invocation_command_builder_failed:${run.error}`);
  } else {
    commandBuilderResult = run.result;
    builderReady =
      commandBuilderResult.status === "reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation";
    if (!builderReady) {
      for (const blocker of commandBuilderResult.blockers || []) blockers.push(`reusable_workflow_invocation_command_builder_blocker:${blocker}`);
    }
  }
}

const status = builderReady
  ? "repaired_reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation"
  : commandBuilderInvoked
    ? "repaired_reusable_workflow_invocation_approved_gate_command_builder_prepared_but_blocked"
    : "blocked_before_repaired_reusable_workflow_invocation_approved_gate_command_builder";
const packageLocks = locks(builderReady);
const wrapper = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourcePrepStatus: prep.status || "",
  repairedReusableWorkflowInvocation: true,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  readyForTeacherFinalConfirmation: builderReady,
  reusedExistingReusableWorkflowCommandBuilder: commandBuilderInvoked,
  reusableWorkflowCommandBuilderStatus: commandBuilderResult?.status || "",
  approvedGateRunnerInvoked: false,
  sourceEvidence: {
    repairedPrepPath: prepInput.path,
    existingReusableWorkflowPrepPacketPath: existingPrepPacketPath,
    approvalGatePath,
    repairedInvocationPlanPath: prep.sourceEvidence?.repairedInvocationPlanPath || "",
    ragInformedRepairReuse,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    reusableWorkflowCommandBuilderScript: join(
      __dirname,
      "create-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-command-builder.mjs"
    )
  },
  generatedEvidence: {
    reusedCommandBuilderWrapperPath: commandBuilderResult?.wrapperPath || "",
    reusedCommandBuilderReceiptPath: commandBuilderResult?.receiptPath || "",
    reusedCommandBuilderReadmePath: commandBuilderResult?.readmePath || "",
    reusedExistingBuilderPath: commandBuilderResult?.existingBuilderPath || "",
    reusedExistingBuilderHtmlPath: commandBuilderResult?.existingBuilderHtmlPath || "",
    commandTemplate: commandBuilderResult?.commandTemplate || "",
    reusableWorkflowCommandBuilderResult: commandBuilderResult
  },
  blockers,
  blockedTransitions: [
    "run_approved_gate_runner_from_repaired_reusable_workflow_invocation_command_builder",
    "run_medium_runtime_workflow_from_repaired_reusable_workflow_invocation_command_builder",
    "execute_target_software_from_repaired_reusable_workflow_invocation_command_builder",
    "send_ui_events_from_repaired_reusable_workflow_invocation_command_builder",
    "capture_screenshot_from_repaired_reusable_workflow_invocation_command_builder",
    "write_memory_from_repaired_reusable_workflow_invocation_command_builder",
    "enable_rule_from_repaired_reusable_workflow_invocation_command_builder",
    "unlock_packaging_from_repaired_reusable_workflow_invocation_command_builder",
    "claim_goal_complete_from_repaired_reusable_workflow_invocation_command_builder"
  ],
  nextTeacherActions: builderReady
    ? [
        "Open the reused command-builder HTML and inspect the final approved-gate command request.",
        "Confirm the repaired reusable workflow invocation still matches the intended workflow and route evidence.",
        "Only after separate final teacher execute confirmation and rollback evidence may a runner command be copied and run.",
        "Create a fresh outcome review after any later approved-gate runner execution."
      ]
    : [
        "Resolve every blocker before exposing a final command request.",
        "Return to the repaired reusable workflow approval-gate prep runner if the existing prep packet or approval gate is missing.",
        "Return to high-reasoning repair if the repaired invocation wrapper is no longer ready."
      ],
  paths: {
    wrapper: wrapperPath,
    receipt: receiptPath,
    readme: readmePath,
    repairedPrep: prepInput.path
  },
  locks: packageLocks
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder_receipt_v1",
  builderId,
  status,
  readyForTeacherFinalConfirmation: builderReady,
  reusedExistingReusableWorkflowCommandBuilder: commandBuilderInvoked,
  reusableWorkflowCommandBuilderStatus: commandBuilderResult?.status || "",
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  blockers,
  locks: packageLocks
};

writeJson(wrapperPath, wrapper);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Repaired Reusable Workflow Invocation Approved-Gate Command Builder",
    "",
    `Status: ${status}`,
    `Repaired prep packet: ${prepInput.path || "<inline>"}`,
    `Existing reusable workflow prep packet: ${existingPrepPacketPath || "<missing>"}`,
    `Approval gate: ${approvalGatePath || "<missing>"}`,
    "",
    "This bridge validates a repaired reusable workflow invocation approval-gate prep packet, then reuses the existing reusable workflow invocation approved-gate command builder.",
    "It does not run the approved-gate runner, run medium runtime, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder_result_v1",
      builderId,
      status,
      readyForTeacherFinalConfirmation: builderReady,
      reusedExistingReusableWorkflowCommandBuilder: commandBuilderInvoked,
      reusableWorkflowCommandBuilderStatus: commandBuilderResult?.status || "",
      approvedGateRunnerInvoked: false,
      wrapperPath,
      receiptPath,
      readmePath,
      reusedCommandBuilderWrapperPath: commandBuilderResult?.wrapperPath || "",
      reusedExistingBuilderPath: commandBuilderResult?.existingBuilderPath || "",
      reusedExistingBuilderHtmlPath: commandBuilderResult?.existingBuilderHtmlPath || "",
      commandTemplate: commandBuilderResult?.commandTemplate || "",
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      blockers,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks: packageLocks
    },
    null,
    2
  )
);
