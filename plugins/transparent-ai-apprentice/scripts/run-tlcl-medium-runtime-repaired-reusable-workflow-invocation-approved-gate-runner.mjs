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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slug(value) {
  return (
    String(value || "tlcl-repaired-reusable-workflow-invocation-approved-gate-runner")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-repaired-reusable-workflow-invocation-approved-gate-runner"
  );
}

function explicitFinalConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed tlcl repaired reusable workflow approved gate runner",
    "teacher confirmed repaired reusable workflow approved gate runner",
    "teacher confirmed tlcl repaired reusable workflow invocation approved gate runner",
    "teacher confirmed repaired reusable workflow invocation approved gate runner",
    "teacher confirmed tlcl reusable workflow approved gate runner after repair",
    "approve repaired reusable workflow approved execution gate runner",
    "i confirm repaired reusable workflow approved execution gate runner"
  ].some((marker) => text.includes(marker));
}

function runReusableWorkflowRunner(args, cwd) {
  const result = spawnSync(
    process.execPath,
    [join(__dirname, "run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs"), ...args],
    {
      cwd,
      encoding: "utf8",
      timeout: 300000
    }
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout || "reusable workflow approved-gate runner failed" };
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
    repairedReusableWorkflowInvocation: true,
    supportsRagInformedRepairReuseInvocation: true,
    ragEvidenceNonAuthoritative: true,
    doesNotTreatRagAsAuthority: true,
    reusesExistingReusableWorkflowApprovedGateRunner: true,
    finalTeacherConfirmationRequired: true,
    rollbackPointRequired: true,
    oneApprovedGateOnly: true,
    freshOutcomeReviewRequired: true,
    doesNotWriteMemory: true,
    doesNotEnableRules: true,
    doesNotUnlockPackaging: true,
    doesNotClaimCompletion: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

function providerRoleUsePlanTraceFromBuilder(builder) {
  return (
    builder.sourceEvidence?.providerRoleUsePlanTrace ||
    builder.providerRoleUsePlanTrace ||
    null
  );
}

function reasoningBudgetGovernorReviewTraceFromBuilder(builder) {
  return (
    builder.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    builder.reasoningBudgetGovernorReviewTrace ||
    null
  );
}

const goal = argValue(
  "--goal",
  argValue("--task", "Run one teacher-approved repaired TLCL reusable workflow invocation.")
);
const builderInput = readJsonInput(
  argValue("--builder", argValue("--command-builder", argValue("--repaired-command-builder", ""))),
  "--builder",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_command_builder_v1"
);
if (!builderInput.value) throw new Error("--builder is required");

const outputRoot = resolve(
  argValue(
    "--out-dir",
    argValue(
      "--output-dir",
      join(process.cwd(), ".transparent-apprentice", "tlcl-repaired-reusable-workflow-invocation-approved-gate-runs")
    )
  )
);
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const builder = builderInput.value;
const reusedCommandBuilderWrapperPath = builder.generatedEvidence?.reusedCommandBuilderWrapperPath || "";
const approvalGatePath = argValue("--gate", builder.sourceEvidence?.approvalGatePath || "");
const ragInformedRepairReuse = builder.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromBuilder(builder);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromBuilder(builder);
const executeApprovedGate = hasFlag("--execute-approved-gate");
const teacherConfirmationText = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const finalConfirmation = explicitFinalConfirmation(teacherConfirmationText);
const rollbackPointCreated = hasFlag("--rollback-point-created");
const blockers = [];

if (builder.status !== "repaired_reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation") {
  blockers.push("repaired_reusable_workflow_command_builder_not_ready_for_final_confirmation");
}
if (builder.readyForTeacherFinalConfirmation !== true) blockers.push("repaired_reusable_workflow_command_builder_ready_flag_missing");
if (builder.reusedExistingReusableWorkflowCommandBuilder !== true) {
  blockers.push("existing_reusable_workflow_command_builder_not_reused");
}
if (builder.approvedGateRunnerInvoked !== false) blockers.push("repaired_reusable_workflow_approved_gate_runner_already_invoked");
if (builder.locks?.doesNotRunApprovedGateRunner !== true) {
  blockers.push("repaired_reusable_workflow_command_builder_runner_lock_missing");
}
if (builder.locks?.doesNotRunMediumRuntimeWorkflow !== true) {
  blockers.push("repaired_reusable_workflow_command_builder_medium_runtime_lock_missing");
}
if (builder.locks?.doesNotExecuteTargetSoftware !== true) {
  blockers.push("repaired_reusable_workflow_command_builder_target_software_lock_missing");
}
if (ragInformedRepairReuse) {
  if (builder.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_informed_command_builder_treats_rag_as_authority");
  if (builder.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_command_builder_non_authority_flag_missing");
  if (builder.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_informed_command_builder_non_authority_lock_missing");
  if (builder.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_command_builder_does_not_treat_rag_as_authority_lock_missing");
  }
}
if (!reusedCommandBuilderWrapperPath || !existsSync(reusedCommandBuilderWrapperPath)) {
  blockers.push("reused_reusable_workflow_command_builder_wrapper_missing");
}
if (!approvalGatePath || !existsSync(approvalGatePath)) blockers.push("approval_gate_path_missing");
if (!executeApprovedGate) blockers.push("missing_execute_approved_gate_flag");
if (!finalConfirmation) blockers.push("missing_final_teacher_repaired_reusable_workflow_approved_gate_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_repaired_reusable_workflow_approved_gate_run");

let runnerInvoked = false;
let runnerResult = null;
if (blockers.length === 0) {
  runnerInvoked = true;
  const run = runReusableWorkflowRunner(
    [
      "--goal",
      goal,
      "--builder",
      reusedCommandBuilderWrapperPath,
      "--gate",
      approvalGatePath,
      "--execute-approved-gate",
      "--teacher-confirmation",
      "teacher confirmed tlcl reusable workflow approved gate runner",
      "--rollback-point-created",
      "--output-dir",
      join(runDir, "reused-reusable-workflow-invocation-approved-gate-runner")
    ],
    process.cwd()
  );
  if (!run.ok) {
    blockers.push(`reusable_workflow_approved_gate_runner_failed:${run.error}`);
  } else {
    runnerResult = run.result;
    if (
      runnerResult.status !== "reusable_workflow_approved_gate_controlled_route_completed_waiting_for_teacher_review" ||
      runnerResult.runnerInvoked !== true ||
      runnerResult.controlledRouteActionExecuted !== true
    ) {
      const runnerBlockers = runnerResult.blockers?.length
        ? runnerResult.blockers
        : ["reusable_workflow_approved_gate_runner_did_not_complete_controlled_route"];
      for (const blocker of runnerBlockers) blockers.push(`reusable_workflow_runner_blocker:${blocker}`);
    }
  }
}

const controlledRouteActionExecuted = runnerResult?.controlledRouteActionExecuted === true;
const status =
  blockers.length > 0 && !runnerInvoked
    ? "blocked_before_repaired_reusable_workflow_invocation_approved_gate_runner"
    : controlledRouteActionExecuted
      ? "repaired_reusable_workflow_invocation_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
      : runnerInvoked
        ? "repaired_reusable_workflow_invocation_approved_gate_runner_invoked_but_blocked"
        : "blocked";

const packetPath = join(runDir, "tlcl-repaired-reusable-workflow-invocation-approved-gate-runner.json");
const receiptPath = join(runDir, "tlcl-repaired-reusable-workflow-invocation-approved-gate-runner-receipt.json");
const readmePath = join(runDir, "TLCL_REPAIRED_REUSABLE_WORKFLOW_INVOCATION_APPROVED_GATE_RUNNER_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceEvidence: {
    repairedCommandBuilderPath: builderInput.path,
    reusedReusableWorkflowCommandBuilderPath: reusedCommandBuilderWrapperPath,
    approvalGatePath,
    repairedPrepPath: builder.sourceEvidence?.repairedPrepPath || "",
    ragInformedRepairReuse,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    reusableWorkflowRunnerScript: join(__dirname, "run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs")
  },
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  executeApprovedGate,
  finalConfirmationMatched: finalConfirmation,
  rollbackPointCreated,
  runnerInvoked,
  controlledRouteActionExecuted,
  targetSoftwareCommandsExecuted: runnerResult?.targetSoftwareCommandsExecuted === true,
  uiEventsSent: runnerResult?.uiEventsSent === true,
  generatedEvidence: {
    reusableWorkflowRunnerResult: runnerResult,
    reusableWorkflowRunnerPacketPath: runnerResult?.packetPath || "",
    reusableWorkflowRunnerReceiptPath: runnerResult?.receiptPath || "",
    existingRunnerPacketPath: runnerResult?.existingRunnerPacketPath || "",
    existingRunnerReceiptPath: runnerResult?.existingRunnerReceiptPath || "",
    adapterReceiptPath: runnerResult?.adapterReceiptPath || "",
    outcomeVerificationPath: runnerResult?.outcomeVerificationPath || "",
    postActionCheckpointPath: runnerResult?.postActionCheckpointPath || ""
  },
  blockers,
  nextTeacherActions: controlledRouteActionExecuted
    ? [
        "Review the repaired reusable workflow runner packet, reused workflow runner packet, existing runner receipt, adapter receipt, outcome verification, and post-action checkpoint.",
        "Create a fresh outcome review against the repaired TLCL contract before enabling rules, writing memory, packaging, or claiming completion.",
        "If the route mismatched the repaired contract, send the correction back to high-reasoning repair and regenerate the contract."
      ]
    : [
        "Resolve every blocker before invoking the repaired reusable workflow approved-gate runner.",
        "Use only a ready repaired command builder with final teacher confirmation and retained rollback evidence."
      ],
  completionBoundary: {
    goalComplete: false,
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason:
      "This wrapper can run only one teacher-approved repaired reusable workflow route. A fresh outcome review is still required before any reusable rule or memory activation."
  },
  paths: {
    packet: packetPath,
    receipt: receiptPath,
    readme: readmePath
  },
  locks: locks()
};
const receipt = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_receipt_v1",
  runId,
  status,
  runnerInvoked,
  controlledRouteActionExecuted,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  providerRoleUsePlanTrace,
  reasoningBudgetGovernorReviewTrace,
  targetSoftwareCommandsExecuted: packet.targetSoftwareCommandsExecuted,
  uiEventsSent: packet.uiEventsSent,
  reusableWorkflowRunnerReceiptPath: packet.generatedEvidence.reusableWorkflowRunnerReceiptPath,
  existingRunnerReceiptPath: packet.generatedEvidence.existingRunnerReceiptPath,
  adapterReceiptPath: packet.generatedEvidence.adapterReceiptPath,
  outcomeVerificationPath: packet.generatedEvidence.outcomeVerificationPath,
  postActionCheckpointPath: packet.generatedEvidence.postActionCheckpointPath,
  blockers,
  screenshotsCaptured: false,
  fullContinuousRecording: false,
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

writeJson(packetPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Repaired Reusable Workflow Invocation Approved Gate Runner",
    "",
    `Status: ${status}`,
    `Runner invoked: ${runnerInvoked ? "yes" : "no"}`,
    `Controlled route action executed: ${controlledRouteActionExecuted ? "yes" : "no"}`,
    "",
    "This wrapper validates a repaired reusable workflow command builder and then reuses the existing reusable workflow approved-gate runner.",
    "It requires a separate explicit teacher execute confirmation plus retained rollback evidence.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "Boundary: it does not write memory, enable rules, unlock packaging, claim universal execution, or complete the apprentice. A fresh outcome review is still required."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format: "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_runner_result_v1",
      runId,
      status,
      packetPath,
      receiptPath,
      readmePath,
      runnerInvoked,
      controlledRouteActionExecuted,
      targetSoftwareCommandsExecuted: packet.targetSoftwareCommandsExecuted,
      uiEventsSent: packet.uiEventsSent,
      reusableWorkflowRunnerPacketPath: packet.generatedEvidence.reusableWorkflowRunnerPacketPath,
      reusableWorkflowRunnerReceiptPath: packet.generatedEvidence.reusableWorkflowRunnerReceiptPath,
      existingRunnerPacketPath: packet.generatedEvidence.existingRunnerPacketPath,
      existingRunnerReceiptPath: packet.generatedEvidence.existingRunnerReceiptPath,
      adapterReceiptPath: packet.generatedEvidence.adapterReceiptPath,
      outcomeVerificationPath: packet.generatedEvidence.outcomeVerificationPath,
      postActionCheckpointPath: packet.generatedEvidence.postActionCheckpointPath,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      providerRoleUsePlanTrace,
      reasoningBudgetGovernorReviewTrace,
      blockers,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks: locks()
    },
    null,
    2
  )
);
