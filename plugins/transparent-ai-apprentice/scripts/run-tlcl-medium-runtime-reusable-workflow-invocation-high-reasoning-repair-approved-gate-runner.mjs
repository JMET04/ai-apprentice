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
    String(value || "tlcl-reusable-workflow-repair-approved-gate-runner")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-approved-gate-runner"
  );
}

function explicitFinalConfirmation(value) {
  const text = String(value || "").toLowerCase();
  return [
    "teacher confirmed tlcl reusable workflow repair approved gate runner",
    "teacher confirmed reusable workflow repair approved gate runner",
    "teacher confirmed tlcl reusable workflow approved gate runner after repair",
    "teacher confirmed repaired approved gate runner",
    "approve repaired approved execution gate runner",
    "i confirm repaired approved execution gate runner"
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

function locks(ragInformedRepairReuse = false) {
  return {
    supportsRagInformedRepairReuseInvocation: true,
    accepted: false,
    ruleEnabled: false,
    technologyAccepted: false,
    packagingGated: true,
    repairRunnerRequiresReadyCommandBuilder: true,
    finalTeacherConfirmationRequired: true,
    rollbackPointRequired: true,
    oneApprovedGateOnly: true,
    freshOutcomeReviewRequired: true,
    screenshotsCaptured: false,
    fullContinuousRecording: false,
    memoryWritten: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false,
    ...(ragInformedRepairReuse
      ? {
          ragEvidenceNonAuthoritative: true,
          doesNotTreatRagAsAuthority: true
        }
      : {})
  };
}

function providerRoleUsePlanTraceFromBuilder(builder) {
  return (
    builder.sourceEvidence?.providerRoleUsePlanTrace ||
    builder.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromBuilder(builder) {
  return (
    builder.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    builder.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

const goal = argValue(
  "--goal",
  argValue("--task", "Run one teacher-approved TLCL reusable workflow after high-reasoning repair.")
);
const builderInput = readJsonInput(
  argValue("--builder", argValue("--command-builder", argValue("--repair-command-builder", ""))),
  "--builder",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_command_builder_v1"
);
if (!builderInput.value) throw new Error("--builder is required");

const outputRoot = resolve(
  argValue(
    "--out-dir",
    argValue("--output-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-approved-gate-runs"))
  )
);
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const runDir = join(outputRoot, runId);
mkdirSync(runDir, { recursive: true });

const builder = builderInput.value;
const ragInformedRepairReuse = builder.ragInformedRepairReuse === true || builder.sourceEvidence?.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromBuilder(builder);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromBuilder(builder);
const reusedCommandBuilderPath = builder.generatedEvidence?.reusedCommandBuilderWrapperPath || "";
const executeApprovedGate = hasFlag("--execute-approved-gate");
const teacherConfirmationText = argValue("--teacher-confirmation", argValue("--confirmation", ""));
const finalConfirmation = explicitFinalConfirmation(teacherConfirmationText);
const rollbackPointCreated = hasFlag("--rollback-point-created");
const blockers = [];
if (builder.status !== "reusable_workflow_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation") {
  blockers.push("repair_command_builder_not_ready_for_final_confirmation");
}
if (builder.readyForTeacherFinalConfirmation !== true) blockers.push("repair_command_builder_ready_flag_missing");
if (builder.reusableWorkflowCommandBuilderInvoked !== true) blockers.push("reusable_workflow_command_builder_not_invoked_from_repair_builder");
if (builder.approvedGateRunnerInvoked !== false) blockers.push("repair_approved_gate_runner_already_invoked");
if (builder.locks?.doesNotRunApprovedGateRunner !== true) blockers.push("repair_command_builder_runner_lock_missing");
if (builder.locks?.freshOutcomeReviewStillRequired !== true) blockers.push("repair_command_builder_fresh_outcome_review_lock_missing");
if (ragInformedRepairReuse) {
  if (builder.ragEvidenceTreatedAsAuthority === true || builder.sourceEvidence?.ragEvidenceTreatedAsAuthority === true) {
    blockers.push("rag_informed_repair_runner_treats_rag_as_authority");
  }
  if (builder.ragEvidenceNonAuthoritative !== true && builder.sourceEvidence?.ragEvidenceNonAuthoritative !== true) {
    blockers.push("rag_informed_repair_runner_non_authority_flag_missing");
  }
  if (builder.locks?.ragEvidenceNonAuthoritative !== true || builder.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_repair_runner_non_authority_lock_missing");
  }
}
if (!reusedCommandBuilderPath || !existsSync(reusedCommandBuilderPath)) blockers.push("reused_reusable_workflow_command_builder_missing");
if (!executeApprovedGate) blockers.push("missing_execute_approved_gate_flag");
if (!finalConfirmation) blockers.push("missing_final_teacher_repair_approved_gate_confirmation");
if (!rollbackPointCreated) blockers.push("rollback_point_not_confirmed_for_repair_approved_gate_run");

let runnerInvoked = false;
let runnerResult = null;
if (blockers.length === 0) {
  runnerInvoked = true;
  const run = runReusableWorkflowRunner(
    [
      "--goal",
      goal,
      "--builder",
      reusedCommandBuilderPath,
      "--execute-approved-gate",
      "--teacher-confirmation",
      "teacher confirmed tlcl reusable workflow approved gate runner",
      "--rollback-point-created",
      "--output-dir",
      join(runDir, "reused-reusable-workflow-approved-gate-runner")
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
      for (const blocker of runnerBlockers) {
        blockers.push(`reusable_workflow_runner_blocker:${blocker}`);
      }
    }
  }
}

const controlledRouteActionExecuted = runnerResult?.controlledRouteActionExecuted === true;
const status =
  blockers.length > 0 && !runnerInvoked
    ? "blocked_before_reusable_workflow_repair_approved_gate_runner"
    : controlledRouteActionExecuted
      ? "reusable_workflow_repair_approved_gate_controlled_route_completed_waiting_for_fresh_outcome_review"
      : runnerInvoked
        ? "reusable_workflow_repair_approved_gate_runner_invoked_but_blocked"
        : "blocked";
const packetPath = join(runDir, "tlcl-reusable-workflow-repair-approved-gate-runner.json");
const receiptPath = join(runDir, "tlcl-reusable-workflow-repair-approved-gate-runner-receipt.json");
const readmePath = join(runDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_APPROVED_GATE_RUNNER_START_HERE.md");
const packet = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_v1",
  runId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  sourceEvidence: {
    repairCommandBuilderPath: builderInput.path,
    reusedReusableWorkflowCommandBuilderPath: reusedCommandBuilderPath,
    repairApprovalGatePath: builder.sourceEvidence?.approvalGatePath || "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse,
    reusableWorkflowRunnerScript: join(__dirname, "run-tlcl-medium-runtime-reusable-workflow-invocation-approved-gate-runner.mjs")
  },
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
        "Review the repair runner packet, reused workflow runner packet, existing runner receipt, adapter receipt, outcome verification, and post-action checkpoint.",
    "Create a fresh outcome review for this repaired reusable workflow invocation.",
        ...(ragInformedRepairReuse ? ["Review that RAG evidence remained non-authoritative during the controlled route."] : []),
        "If the route mismatched the repaired contract, send the correction back to high-reasoning repair before any memory, rule enablement, packaging, or completion claim."
      ]
    : [
        "Resolve every blocker before invoking the repaired reusable workflow approved gate runner.",
        "Use only a ready repair command builder with final teacher confirmation and retained rollback evidence."
      ],
  completionBoundary: {
    goalComplete: false,
    allSoftwareExecutionComplete: false,
    nativeUniversalExecution: false,
    reason: "This wrapper can execute only one teacher-approved repaired reusable workflow route and still requires fresh outcome review."
  },
  paths: {
    packet: packetPath,
    receipt: receiptPath,
    readme: readmePath
  },
  locks: locks(ragInformedRepairReuse)
};
const receipt = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_receipt_v1",
  runId,
  status,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  runnerInvoked,
  controlledRouteActionExecuted,
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
  locks: locks(ragInformedRepairReuse)
};

writeJson(packetPath, packet);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow Repair Approved Gate Runner",
    "",
    `Status: ${status}`,
    `Runner invoked: ${runnerInvoked ? "yes" : "no"}`,
    `Controlled route action executed: ${controlledRouteActionExecuted ? "yes" : "no"}`,
    "",
    "This wrapper invokes the existing reusable workflow approved-gate runner only after a high-reasoning repair command builder is ready, the teacher explicitly confirms execution, and rollback evidence is retained.",
    "",
    "Blockers:",
    ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "Boundary: it can execute one controlled repaired route, but it does not write memory, enable rules, unlock packaging, claim universal execution, or complete the apprentice. A fresh outcome review is still required."
  ].join("\n"),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      format:
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_runner_result_v1",
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
      blockers,
      screenshotsCaptured: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks: locks(ragInformedRepairReuse)
    },
    null,
    2
  )
);
