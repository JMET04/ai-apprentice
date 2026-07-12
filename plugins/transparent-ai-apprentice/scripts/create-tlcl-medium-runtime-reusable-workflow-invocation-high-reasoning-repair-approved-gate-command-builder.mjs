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
    String(value || "tlcl-reusable-workflow-repair-approved-gate-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-approved-gate-command-builder"
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
    return { ok: false, error: result.stderr || result.stdout || "reusable workflow approved-gate command builder failed" };
  }
  return { ok: true, result: JSON.parse(result.stdout) };
}

function locks(builderReady = false, ragInformedRepairReuse = false) {
  return {
    reviewOnly: true,
    repairApprovedGateCommandBuilderOnly: true,
    supportsRagInformedRepairReuseInvocation: true,
    approvalGateRebuilt: builderReady,
    finalTeacherExecuteConfirmationStillRequired: true,
    mediumRuntimeContinuationBlockedUntilTeacherExecuteReview: true,
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
    goalComplete: false,
    ...(ragInformedRepairReuse
      ? {
          ragEvidenceNonAuthoritative: true,
          doesNotTreatRagAsAuthority: true
        }
      : {})
  };
}

function providerRoleUsePlanTraceFromRebuild(rebuildPackage) {
  return (
    rebuildPackage.sourceEvidence?.providerRoleUsePlanTrace ||
    rebuildPackage.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromRebuild(rebuildPackage) {
  return (
    rebuildPackage.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    rebuildPackage.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

const goal = argValue(
  "--goal",
  argValue("--task", "Create a final teacher-facing approved-gate command builder after high-reasoning TLCL repair.")
);
const rebuildInput = readJsonInput(
  argValue("--rebuild-package", argValue("--package", argValue("--approval-gate-rebuild-package", ""))),
  "--rebuild-package",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approval_gate_rebuild_package_v1"
);
if (!rebuildInput.value) throw new Error("--rebuild-package is required");

const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-approved-gate-command-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const wrapperPath = join(builderDir, "tlcl-reusable-workflow-repair-approved-gate-command-builder.json");
const receiptPath = join(builderDir, "tlcl-reusable-workflow-repair-approved-gate-command-builder-receipt.json");
const readmePath = join(builderDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_APPROVED_GATE_COMMAND_BUILDER_START_HERE.md");
mkdirSync(builderDir, { recursive: true });

const rebuildPackage = rebuildInput.value;
const ragInformedRepairReuse = rebuildPackage.ragInformedRepairReuse === true || rebuildPackage.sourceEvidence?.ragInformedRepairReuse === true;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromRebuild(rebuildPackage);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromRebuild(rebuildPackage);
const prepRunnerPacketPath = rebuildPackage.generatedEvidence?.prepRunnerPacketPath || "";
const approvalGatePath = argValue("--gate", rebuildPackage.generatedEvidence?.approvalGatePath || "");
const blockers = [];
if (rebuildPackage.status !== "reusable_workflow_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review") {
  blockers.push("repair_approval_gate_rebuild_package_not_ready_for_teacher_execute_review");
}
if (rebuildPackage.approvalGateRebuilt !== true) blockers.push("repair_approval_gate_not_rebuilt");
if (rebuildPackage.readyForTeacherExecuteReview !== true) blockers.push("repair_approval_gate_teacher_execute_review_not_ready");
if (rebuildPackage.approvedGateRunnerInvoked !== false) blockers.push("repair_approved_gate_runner_already_invoked");
if (rebuildPackage.mediumRuntimeRetryAllowed !== false) blockers.push("repair_medium_runtime_retry_already_allowed");
if (rebuildPackage.locks?.doesNotRunApprovedGateRunner !== true) blockers.push("repair_rebuild_runner_lock_missing");
if (rebuildPackage.locks?.doesNotRunMediumRuntimeWorkflow !== true) blockers.push("repair_rebuild_medium_runtime_lock_missing");
if (ragInformedRepairReuse) {
  if (rebuildPackage.ragEvidenceTreatedAsAuthority === true || rebuildPackage.sourceEvidence?.ragEvidenceTreatedAsAuthority === true) {
    blockers.push("rag_informed_repair_command_builder_treats_rag_as_authority");
  }
  if (rebuildPackage.ragEvidenceNonAuthoritative !== true && rebuildPackage.sourceEvidence?.ragEvidenceNonAuthoritative !== true) {
    blockers.push("rag_informed_repair_command_builder_non_authority_flag_missing");
  }
  if (rebuildPackage.locks?.ragEvidenceNonAuthoritative !== true || rebuildPackage.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_repair_command_builder_non_authority_lock_missing");
  }
}
if (!prepRunnerPacketPath || !existsSync(prepRunnerPacketPath)) blockers.push("repair_rebuild_prep_runner_packet_missing");

let commandBuilderResult = null;
let commandBuilderInvoked = false;
let builderReady = false;
if (blockers.length === 0) {
  const args = [
    "--goal",
    goal,
    "--prep",
    prepRunnerPacketPath,
    "--out-dir",
    join(builderDir, "reused-reusable-workflow-approved-gate-command-builder")
  ];
  if (approvalGatePath) args.push("--gate", approvalGatePath);
  commandBuilderInvoked = true;
  const run = runReusableWorkflowCommandBuilder(args, process.cwd());
  if (!run.ok) {
    blockers.push(`reusable_workflow_command_builder_failed:${run.error}`);
  } else {
    commandBuilderResult = run.result;
    builderReady =
      commandBuilderResult.status === "reusable_workflow_invocation_approved_gate_command_builder_ready_for_teacher_final_confirmation";
    if (!builderReady) {
      for (const blocker of commandBuilderResult.blockers || []) blockers.push(`reusable_workflow_command_builder_blocker:${blocker}`);
    }
  }
}

const status = builderReady
  ? "reusable_workflow_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation"
  : commandBuilderInvoked
    ? "reusable_workflow_repair_approved_gate_command_builder_prepared_but_blocked"
    : "blocked_before_reusable_workflow_repair_approved_gate_command_builder";
const packageLocks = locks(builderReady, ragInformedRepairReuse);
const wrapper = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceRebuildStatus: rebuildPackage.status || "",
  approvalGateRebuilt: builderReady,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  reusableWorkflowCommandBuilderInvoked: commandBuilderInvoked,
  readyForTeacherFinalConfirmation: builderReady,
  approvedGateRunnerInvoked: false,
  sourceEvidence: {
    rebuildPackagePath: rebuildInput.path,
    prepRunnerPacketPath,
    approvalGatePath,
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse,
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
    "run_approved_gate_runner_from_repair_approved_gate_command_builder",
    "run_medium_runtime_workflow_from_repair_approved_gate_command_builder",
    "execute_target_software_from_repair_approved_gate_command_builder",
    "send_ui_events_from_repair_approved_gate_command_builder",
    "capture_screenshot_from_repair_approved_gate_command_builder",
    "write_memory_from_repair_approved_gate_command_builder",
    "enable_rule_from_repair_approved_gate_command_builder",
    "unlock_packaging_from_repair_approved_gate_command_builder",
    ...(ragInformedRepairReuse ? ["treat_rag_as_authority_from_repair_approved_gate_command_builder"] : []),
    "claim_goal_complete_from_repair_approved_gate_command_builder"
  ],
  nextTeacherActions: builderReady
    ? [
        "Open the reused command-builder HTML and inspect the final approved-gate command request.",
        "Confirm the rebuilt repair approval gate matches the intended repaired workflow.",
        "Only after separate final teacher execute confirmation and rollback evidence may a runner command be copied and run.",
        "Create a fresh outcome review after any later approved-gate runner execution."
      ]
    : [
        "Resolve every blocker before exposing a final command request.",
        "Return to the high-reasoning repair rebuild package if the prep runner packet is missing or no longer ready.",
        "Keep rollback points until the teacher confirms the rebuilt gate and final command are correct."
      ],
  paths: {
    wrapper: wrapperPath,
    receipt: receiptPath,
    readme: readmePath,
    rebuildPackage: rebuildInput.path
  },
  locks: packageLocks
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_command_builder_receipt_v1",
  builderId,
  status,
  approvalGateRebuilt: builderReady,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  reusableWorkflowCommandBuilderInvoked: commandBuilderInvoked,
  readyForTeacherFinalConfirmation: builderReady,
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
    "# TLCL Reusable Workflow Repair Approved-Gate Command Builder",
    "",
    `Status: ${status}`,
    `Rebuild package: ${rebuildInput.path || "<inline>"}`,
    `Prep runner packet: ${prepRunnerPacketPath || "<missing>"}`,
    "",
    "This bridge validates a high-reasoning repair approval-gate rebuild package, then reuses the existing reusable workflow approved-gate command builder.",
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
      format:
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approved_gate_command_builder_result_v1",
      builderId,
      status,
      approvalGateRebuilt: builderReady,
      reusableWorkflowCommandBuilderInvoked: commandBuilderInvoked,
      readyForTeacherFinalConfirmation: builderReady,
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
