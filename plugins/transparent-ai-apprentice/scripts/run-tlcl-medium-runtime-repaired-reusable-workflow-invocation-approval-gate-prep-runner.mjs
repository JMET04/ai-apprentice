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

function hasFlag(name) {
  return process.argv.includes(name);
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

function slugify(value) {
  return (
    String(value || "tlcl-repaired-reusable-workflow-invocation-approval-gate-prep-runner")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "tlcl-repaired-reusable-workflow-invocation-approval-gate-prep-runner"
  );
}

function locks(ready = false) {
  return {
    reviewOnly: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    repairedReusableWorkflowInvocation: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    repairedApprovalGatePrepRunnerOnly: true,
    reusesExistingApprovalGatePrepRunner: true,
    repairedApprovalGatePrepared: ready,
    prepRunnerDoesNotInvokeExecutionRunner: true,
    prepRunnerDoesNotExecuteTargetSoftware: true,
    prepRunnerDoesNotSendUiEvents: true,
    prepRunnerDoesNotCaptureScreenshots: true,
    prepRunnerDoesNotWriteMemory: true,
    approvalGateDoesNotRunRunner: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    goalComplete: false
  };
}

function runExistingPrepRunner(args, cwd) {
  const result = spawnSync(
    process.execPath,
    [join(__dirname, "run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs"), ...args],
    {
      cwd,
      encoding: "utf8",
      timeout: 300000
    }
  );
  if (result.status !== 0) {
    return {
      ok: false,
      error: result.stderr || result.stdout || "reusable workflow invocation approval gate prep runner failed"
    };
  }
  return { ok: true, result: JSON.parse(result.stdout) };
}

function pushForwardedArg(args, sourceName, targetName = sourceName) {
  const value = argValue(sourceName, "");
  if (value) args.push(targetName, value);
}

function providerRoleUsePlanTraceFromWrapper(wrapper) {
  return (
    wrapper.sourceEvidence?.providerRoleUsePlanTrace ||
    wrapper.providerRoleUsePlanTrace ||
    null
  );
}

function reasoningBudgetGovernorReviewTraceFromWrapper(wrapper) {
  return (
    wrapper.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    wrapper.reasoningBudgetGovernorReviewTrace ||
    null
  );
}

function writeReadme(path, packet) {
  const lines = [
    "# TLCL Repaired Reusable Workflow Invocation Approval Gate Prep Runner",
    "",
    `Status: ${packet.status}`,
    `Repaired invocation status: ${packet.repairedInvocationStatus}`,
    `Existing approval-gate prep runner reused: ${packet.reusedExistingApprovalGatePrepRunner ? "yes" : "no"}`,
    `Ready for execute request: ${packet.readyForExecuteRequest ? "yes" : "no"}`,
    "",
    "This packet bridges a teacher-approved repaired reusable workflow invocation into the existing reusable-workflow approval-gate prep runner.",
    "",
    "Review order:",
    "1. Confirm the repaired reusable workflow invocation wrapper is ready for approval-gate planning.",
    "2. Confirm its existing invocation plan path still points to the reviewed medium-runtime reusable workflow invocation plan.",
    "3. Confirm selected pilot, adapter route evidence, explicit teacher confirmation, and rollback evidence are current.",
    "4. Review the generated approval gate packet before any separate approved execution runner request.",
    "",
    "Blocking reasons:"
  ];
  for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  if (!packet.blockers.length) lines.push("- none");
  lines.push(
    "",
    "Locked boundary: this repaired reusable workflow prep adapter only prepares an approval gate packet through the existing prep runner. It does not invoke the execution runner, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, or claim completion."
  );
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function writePacket(prepDir, packet) {
  const packetPath = join(
    prepDir,
    "tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner.json"
  );
  const receiptPath = join(
    prepDir,
    "tlcl-medium-runtime-repaired-reusable-workflow-invocation-approval-gate-prep-runner-receipt.json"
  );
  const readmePath = join(
    prepDir,
    "TLCL_REPAIRED_REUSABLE_WORKFLOW_INVOCATION_APPROVAL_GATE_PREP_RUNNER_START_HERE.md"
  );
  packet.paths.packet = packetPath;
  packet.paths.receipt = receiptPath;
  packet.paths.readme = readmePath;
  const receipt = {
    ok: true,
    format:
      "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner_receipt_v1",
    prepId: packet.prepId,
    status: packet.status,
    repairedInvocationStatus: packet.repairedInvocationStatus,
    wrapperReady: packet.wrapperReady,
    ragInformedRepairReuse: packet.ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: packet.ragEvidenceNonAuthoritative,
    providerRoleUsePlanTrace: packet.providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace: packet.reasoningBudgetGovernorReviewTrace,
    reusedExistingApprovalGatePrepRunner: packet.reusedExistingApprovalGatePrepRunner,
    existingApprovalGatePrepRunnerStatus: packet.existingApprovalGatePrepRunnerStatus,
    readyForExecuteRequest: packet.readyForExecuteRequest,
    existingPrepPacketPath: packet.generatedEvidence.existingPrepPacketPath,
    approvalGatePath: packet.generatedEvidence.approvalGatePath,
    approvalGateReceiptPath: packet.generatedEvidence.approvalGateReceiptPath,
    blockers: packet.blockers,
    approvalGateDoesNotRunRunner: true,
    prepRunnerDoesNotInvokeExecutionRunner: true,
    softwareActionsExecuted: false,
    targetSoftwareCommandsExecuted: false,
    uiEventsSent: false,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    goalComplete: false,
    locks: packet.locks
  };
  writeReadme(readmePath, packet);
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return { packetPath, receiptPath, readmePath };
}

const goal = argValue(
  "--goal",
  argValue("--task", "Prepare an approval gate for one repaired TLCL reusable workflow invocation.")
);
const repairedInput = readJsonInput(
  argValue("--repaired-invocation-plan", argValue("--planner", argValue("--plan", ""))),
  "--repaired-invocation-plan",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_plan_v1"
);
if (!repairedInput.value) throw new Error("--repaired-invocation-plan is required");

const wrapper = repairedInput.value;
const ragInformedRepairReuse = wrapper.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromWrapper(wrapper);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromWrapper(wrapper);
const existingInvocationPlanPath = resolve(argValue("--existing-invocation-plan", wrapper.existingInvocationPlanPath || ""));
const outputRoot = resolve(
  argValue(
    "--output-dir",
    join(
      process.cwd(),
      ".transparent-apprentice",
      "tlcl-repaired-reusable-workflow-invocation-approval-gate-prep-runners"
    )
  )
);
const prepId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(goal)}`;
const prepDir = join(outputRoot, prepId);
mkdirSync(prepDir, { recursive: true });

const wrapperReady =
  wrapper.status === "repaired_reusable_workflow_invocation_ready_for_approval_gate_planning" &&
  wrapper.invocationReady === true &&
  wrapper.repairedReusableWorkflowInvocation === true &&
  wrapper.reusedExistingInvocationPlanner === true &&
  wrapper.reusedExistingInvocationPlannerStatus === "medium_runtime_reuse_invocation_ready_for_approval_gate_planning" &&
  wrapper.fingerprintMatched === true &&
  wrapper.mediumRuntimeWorkflowEnabled === true &&
  wrapper.approvalGateStillRequired === true &&
  wrapper.rollbackStillRequired === true &&
  wrapper.outcomeReviewStillRequired === true &&
  wrapper.forbiddenDecisionUsed === false &&
  wrapper.locks?.doesNotRunWorkflow === true &&
  wrapper.locks?.doesNotRunApprovedGate === true &&
  wrapper.locks?.doesNotExecuteTargetSoftware === true;

const blockers = [];
if (!wrapperReady) blockers.push("repaired_reusable_workflow_invocation_plan_not_ready_for_approval_gate_planning");
if (ragInformedRepairReuse) {
  if (wrapper.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_informed_invocation_treats_rag_as_authority");
  if (wrapper.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_invocation_non_authority_lock_missing");
  if (wrapper.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_invocation_lock_non_authority_missing");
  if (wrapper.locks?.doesNotTreatRagAsAuthority !== true) blockers.push("rag_informed_invocation_authority_forbidden_lock_missing");
}
if (!wrapper.existingInvocationPlanPath && !argValue("--existing-invocation-plan", "")) {
  blockers.push("missing_existing_reusable_workflow_invocation_plan_path");
} else if (!existsSync(existingInvocationPlanPath)) {
  blockers.push("existing_reusable_workflow_invocation_plan_path_not_found");
}

let existingPrep = null;
let reusedExistingApprovalGatePrepRunner = false;
let existingApprovalGatePrepRunnerStatus = "";
let readyForExecuteRequest = false;
if (blockers.length === 0) {
  const args = ["--goal", goal, "--plan", existingInvocationPlanPath, "--output-dir", join(prepDir, "existing-prep-runner")];
  pushForwardedArg(args, "--selector");
  pushForwardedArg(args, "--selector-path", "--selector");
  pushForwardedArg(args, "--queue");
  pushForwardedArg(args, "--queue-path", "--queue");
  pushForwardedArg(args, "--selected-pilot-id");
  pushForwardedArg(args, "--pilot-id", "--selected-pilot-id");
  pushForwardedArg(args, "--selected-number");
  pushForwardedArg(args, "--number", "--selected-number");
  pushForwardedArg(args, "--adapter-id");
  pushForwardedArg(args, "--reviewed-command");
  pushForwardedArg(args, "--reviewed-api-request");
  pushForwardedArg(args, "--reviewed-mapping");
  pushForwardedArg(args, "--reviewed-browser-target");
  pushForwardedArg(args, "--target-window-title");
  pushForwardedArg(args, "--teacher-confirmation");
  pushForwardedArg(args, "--confirmation", "--teacher-confirmation");
  if (hasFlag("--rollback-point-created")) args.push("--rollback-point-created");

  reusedExistingApprovalGatePrepRunner = true;
  const run = runExistingPrepRunner(args, process.cwd());
  if (!run.ok) {
    blockers.push(`existing_approval_gate_prep_runner_failed: ${run.error}`);
    existingApprovalGatePrepRunnerStatus = "existing_approval_gate_prep_runner_failed";
  } else {
    existingPrep = run.result;
    existingApprovalGatePrepRunnerStatus = existingPrep.status || "";
    readyForExecuteRequest =
      existingPrep.status === "reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review" &&
      existingPrep.readyForExecuteRequest === true;
    if (!readyForExecuteRequest) {
      for (const blocker of existingPrep.blockers || []) blockers.push(`existing_prep_blocker: ${blocker}`);
    }
  }
}

const status = !reusedExistingApprovalGatePrepRunner
  ? "blocked_before_repaired_reusable_workflow_invocation_approval_gate"
  : readyForExecuteRequest
    ? "repaired_reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review"
    : "blocked_before_repaired_reusable_workflow_invocation_approval_gate";
const packet = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner_v1",
  prepId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  repairedInvocationStatus: wrapper.status || "",
  wrapperReady,
  repairedReusableWorkflowInvocation: true,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  reusedExistingApprovalGatePrepRunner,
  existingApprovalGatePrepRunnerStatus,
  readyForExecuteRequest,
  sourceEvidence: {
    repairedInvocationPlanPath: repairedInput.path,
    existingInvocationPlanPath,
    ragInformedRepairReuse,
    selectorPath: argValue("--selector", argValue("--selector-path", "")),
    executionPilotQueuePath: argValue("--queue", argValue("--queue-path", "")),
    reviewedCommand: argValue("--reviewed-command", ""),
    reviewedApiRequest: argValue("--reviewed-api-request", ""),
    reviewedMapping: argValue("--reviewed-mapping", ""),
    reviewedBrowserTarget: argValue("--reviewed-browser-target", ""),
    targetWindowTitle: argValue("--target-window-title", ""),
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    existingApprovalGatePrepRunnerScript: join(
      __dirname,
      "run-tlcl-medium-runtime-reusable-workflow-invocation-approval-gate-prep-runner.mjs"
    )
  },
  generatedEvidence: {
    existingPrepPacketPath: existingPrep?.packetPath || "",
    existingPrepReceiptPath: existingPrep?.receiptPath || "",
    existingPrepReadmePath: existingPrep?.readmePath || "",
    approvalGatePath: existingPrep?.approvalGatePath || "",
    approvalGateReceiptPath: existingPrep?.approvalGateReceiptPath || "",
    approvalGateReadmePath: existingPrep?.approvalGateReadmePath || "",
    existingPrepResult: existingPrep
  },
  blockers,
  nextTeacherActions: readyForExecuteRequest
    ? [
        "Review the generated real-local execution approval gate packet for this repaired reusable workflow invocation.",
        "Confirm the generated runner request is still the intended single supervised execute attempt.",
        "Only then decide whether to run a separate approved execution runner request."
      ]
    : [
        "Resolve every blocker before creating or using an approval gate.",
        "Return to high-reasoning repair if the repaired reusable workflow wrapper is no longer ready.",
        "Replace placeholders with reviewed selector, queue, route evidence, teacher confirmation, and rollback evidence."
      ],
  blockedTransitions: [
    "invoke_execution_runner_from_repaired_reusable_workflow_invocation_prep_runner",
    "execute_target_software_from_repaired_reusable_workflow_invocation_prep_runner",
    "send_ui_events_from_repaired_reusable_workflow_invocation_prep_runner",
    "capture_screenshot_from_repaired_reusable_workflow_invocation_prep_runner",
    "write_memory_from_repaired_reusable_workflow_invocation_prep_runner",
    "enable_rule_from_repaired_reusable_workflow_invocation_prep_runner",
    "unlock_packaging_from_repaired_reusable_workflow_invocation_prep_runner",
    "claim_completion_from_repaired_reusable_workflow_invocation_prep_runner"
  ],
  completionBoundary: {
    goalComplete: false,
    reason:
      "This TLCL repaired reusable workflow invocation prep adapter only prepares one approval gate packet through the existing reusable workflow prep runner. It does not run target software or complete the apprentice capability."
  },
  paths: {},
  locks: locks(readyForExecuteRequest)
};
const paths = writePacket(prepDir, packet);

console.log(
  JSON.stringify(
    {
      ok: true,
      format:
        "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approval_gate_prep_runner_result_v1",
      prepId,
      status,
      wrapperReady,
      repairedReusableWorkflowInvocation: true,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      reusedExistingApprovalGatePrepRunner,
      existingApprovalGatePrepRunnerStatus,
      readyForExecuteRequest,
      packetPath: paths.packetPath,
      receiptPath: paths.receiptPath,
      readmePath: paths.readmePath,
      existingPrepPacketPath: existingPrep?.packetPath || "",
      existingPrepReceiptPath: existingPrep?.receiptPath || "",
      approvalGatePath: existingPrep?.approvalGatePath || "",
      approvalGateReceiptPath: existingPrep?.approvalGateReceiptPath || "",
      approvalGateReadmePath: existingPrep?.approvalGateReadmePath || "",
      blockers,
      prepRunnerDoesNotInvokeExecutionRunner: true,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      goalComplete: false,
      locks: packet.locks
    },
    null,
    2
  )
);
