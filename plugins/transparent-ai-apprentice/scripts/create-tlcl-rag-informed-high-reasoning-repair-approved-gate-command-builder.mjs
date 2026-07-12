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
    String(value || "tlcl-rag-informed-repair-approved-gate-command-builder")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-rag-informed-repair-approved-gate-command-builder"
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

function locks(builderReady = false) {
  return {
    reviewOnly: true,
    evidenceOnly: true,
    ragInformedApprovedGateCommandBuilderOnly: true,
    approvalGateRebuilt: builderReady,
    ruleLifecycle: "draft_disabled",
    ragEvidenceNonAuthoritative: true,
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
    doesNotTreatRagAsAuthority: true,
    doesNotClaimCompletion: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    packagingUnlocked: false,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  };
}

const goal = argValue(
  "--goal",
  argValue("--task", "Create a final teacher-facing approved-gate command builder after RAG-informed TLCL repair.")
);
const rebuildInput = readJsonInput(
  argValue("--rebuild-package", argValue("--package", argValue("--approval-gate-rebuild-package", ""))),
  "--rebuild-package",
  "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approval_gate_rebuild_package_v1"
);
if (!rebuildInput.value) throw new Error("--rebuild-package is required");

const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-rag-informed-repair-approved-gate-command-builders"))
);
const builderId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const builderDir = join(outRoot, builderId);
const wrapperPath = join(builderDir, "tlcl-rag-informed-repair-approved-gate-command-builder.json");
const receiptPath = join(builderDir, "tlcl-rag-informed-repair-approved-gate-command-builder-receipt.json");
const readmePath = join(builderDir, "TLCL_RAG_INFORMED_REPAIR_APPROVED_GATE_COMMAND_BUILDER_START_HERE.md");
mkdirSync(builderDir, { recursive: true });

const rebuildPackage = rebuildInput.value;
const prepRunnerPacketPath = rebuildPackage.generatedEvidence?.prepRunnerPacketPath || "";
const approvalGatePath = argValue("--gate", rebuildPackage.generatedEvidence?.approvalGatePath || "");
const blockers = [];
if (rebuildPackage.status !== "rag_informed_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review") {
  blockers.push("rag_informed_repair_approval_gate_rebuild_package_not_ready_for_teacher_execute_review");
}
if (rebuildPackage.approvalGateRebuilt !== true) blockers.push("rag_informed_repair_approval_gate_not_rebuilt");
if (rebuildPackage.readyForTeacherExecuteReview !== true) blockers.push("rag_informed_repair_approval_gate_teacher_execute_review_not_ready");
if (rebuildPackage.approvedGateRunnerInvoked !== false) blockers.push("rag_informed_repair_approved_gate_runner_already_invoked");
if (rebuildPackage.mediumRuntimeRetryAllowed !== false) blockers.push("rag_informed_repair_medium_runtime_retry_already_allowed");
if (rebuildPackage.ragEvidenceTreatedAsAuthority !== false) blockers.push("rag_evidence_authority_lock_missing_from_rebuild_package");
if (rebuildPackage.locks?.ragEvidenceNonAuthoritative !== true) blockers.push("rag_non_authority_lock_missing_from_rebuild_package");
if (rebuildPackage.locks?.doesNotTreatRagAsAuthority !== true) blockers.push("rag_authority_forbidden_lock_missing_from_rebuild_package");
if (rebuildPackage.locks?.doesNotRunApprovedGateRunner !== true) blockers.push("rag_informed_rebuild_runner_lock_missing");
if (rebuildPackage.locks?.doesNotRunMediumRuntimeWorkflow !== true) blockers.push("rag_informed_rebuild_medium_runtime_lock_missing");
if (!prepRunnerPacketPath || !existsSync(prepRunnerPacketPath)) blockers.push("rag_informed_rebuild_prep_runner_packet_missing");

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
    join(builderDir, "reused-rag-informed-reusable-workflow-approved-gate-command-builder")
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
  ? "rag_informed_repair_approved_gate_command_builder_ready_for_teacher_final_confirmation"
  : commandBuilderInvoked
    ? "rag_informed_repair_approved_gate_command_builder_prepared_but_blocked"
    : "blocked_before_rag_informed_repair_approved_gate_command_builder";
const packageLocks = locks(builderReady);
const wrapper = {
  ok: true,
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_v1",
  builderId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  sourceRebuildStatus: rebuildPackage.status || "",
  approvalGateRebuilt: builderReady,
  reusableWorkflowCommandBuilderInvoked: commandBuilderInvoked,
  readyForTeacherFinalConfirmation: builderReady,
  approvedGateRunnerInvoked: false,
  ragEvidenceTreatedAsAuthority: false,
  sourceEvidence: {
    rebuildPackagePath: rebuildInput.path,
    prepRunnerPacketPath,
    approvalGatePath,
    deterministicValidationPackagePath: rebuildPackage.sourceEvidence?.deterministicValidationPackagePath || "",
    validationReportPath: rebuildPackage.sourceEvidence?.validationReportPath || "",
    attachmentPath: rebuildPackage.sourceEvidence?.attachmentPath || "",
    workflowFingerprintBefore: rebuildPackage.sourceEvidence?.workflowFingerprintBefore || "",
    workflowFingerprintAfter: rebuildPackage.sourceEvidence?.workflowFingerprintAfter || "",
    ragEvidenceNonAuthoritative: true,
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
    "run_approved_gate_runner_from_rag_informed_repair_approved_gate_command_builder",
    "run_medium_runtime_workflow_from_rag_informed_repair_approved_gate_command_builder",
    "execute_target_software_from_rag_informed_repair_approved_gate_command_builder",
    "send_ui_events_from_rag_informed_repair_approved_gate_command_builder",
    "capture_screenshot_from_rag_informed_repair_approved_gate_command_builder",
    "write_memory_from_rag_informed_repair_approved_gate_command_builder",
    "enable_rule_from_rag_informed_repair_approved_gate_command_builder",
    "unlock_packaging_from_rag_informed_repair_approved_gate_command_builder",
    "treat_rag_as_authority_from_rag_informed_repair_approved_gate_command_builder",
    "claim_goal_complete_from_rag_informed_repair_approved_gate_command_builder"
  ],
  nextTeacherActions: builderReady
    ? [
        "Open the reused command-builder HTML and inspect the final approved-gate command request.",
        "Confirm the RAG evidence remains non-authoritative and only supports the repaired logic.",
        "Confirm the rebuilt RAG-informed approval gate matches the intended repaired workflow.",
        "Only after separate final teacher execute confirmation and rollback evidence may a runner command be copied and run.",
        "Create a fresh outcome review after any later approved-gate runner execution."
      ]
    : [
        "Resolve every blocker before exposing a final command request.",
        "Return to the RAG-informed approval-gate rebuild package if the prep runner packet is missing or no longer ready.",
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
  format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_receipt_v1",
  builderId,
  status,
  approvalGateRebuilt: builderReady,
  reusableWorkflowCommandBuilderInvoked: commandBuilderInvoked,
  readyForTeacherFinalConfirmation: builderReady,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  ragEvidenceTreatedAsAuthority: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  packagingUnlocked: false,
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
    "# TLCL RAG-Informed Repair Approved-Gate Command Builder",
    "",
    `Status: ${status}`,
    `Rebuild package: ${rebuildInput.path || "<inline>"}`,
    `Prep runner packet: ${prepRunnerPacketPath || "<missing>"}`,
    "",
    "This bridge validates a RAG-informed high-reasoning repair approval-gate rebuild package, then reuses the existing reusable workflow approved-gate command builder.",
    "RAG evidence remains non-authoritative: it can support evidence-bound logic, but it cannot enable rules, execute software, write memory, unlock packaging, or claim completion.",
    "It does not run the approved-gate runner, run medium runtime, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, treat RAG as authority, or claim completion.",
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
      format: "transparent_ai_tlcl_rag_informed_high_reasoning_repair_approved_gate_command_builder_result_v1",
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
      blockers,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      screenshotsCaptured: false,
      memoryWritten: false,
      ragEvidenceTreatedAsAuthority: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true,
      packagingUnlocked: false,
      nativeUniversalExecution: false,
      allSoftwareExecutionComplete: false,
      goalComplete: false,
      locks: packageLocks
    },
    null,
    2
  )
);
