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

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slug(value) {
  return (
    String(value || "tlcl-reusable-workflow-repair-approval-gate-rebuild")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-repair-approval-gate-rebuild"
  );
}

function runPrepRunner(args, cwd) {
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
    return { ok: false, error: result.stderr || result.stdout || "approval gate prep runner failed" };
  }
  return { ok: true, result: JSON.parse(result.stdout) };
}

function locks(approvalGateRebuilt = false, ragInformedRepairReuse = false) {
  return {
    reviewOnly: true,
    approvalGateRebuildPackageOnly: true,
    supportsRagInformedRepairReuseInvocation: true,
    approvalGateRebuilt,
    ruleLifecycle: "draft_disabled",
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

function providerRoleUsePlanTraceFromInputs(fingerprintReview, handoff, plan) {
  return (
    handoff.providerRoleUsePlanTrace ||
    fingerprintReview.sourceEvidence?.providerRoleUsePlanTrace ||
    fingerprintReview.providerRoleUsePlanTrace ||
    plan.reuseInvocationHandoff?.providerRoleUsePlanTrace ||
    plan.sourceEvidence?.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromInputs(fingerprintReview, handoff, plan) {
  return (
    handoff.reasoningBudgetGovernorReviewTrace ||
    fingerprintReview.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    fingerprintReview.reasoningBudgetGovernorReviewTrace ||
    plan.reuseInvocationHandoff?.reasoningBudgetGovernorReviewTrace ||
    plan.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

const goal = argValue("--goal", "Rebuild one approval gate after TLCL reusable workflow high-reasoning repair fingerprint review.");
const fingerprintReviewInput = readJsonInput(
  argValue("--fingerprint-review-validation", argValue("--validation", argValue("--review-validation", ""))),
  "--fingerprint-review-validation",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_workflow_fingerprint_review_validation_v1"
);
const planInput = readJsonInput(
  argValue("--plan", argValue("--invocation-plan", "")),
  "--plan",
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_plan_v1"
);
if (!fingerprintReviewInput.value) throw new Error("--fingerprint-review-validation is required");
if (!planInput.value) throw new Error("--plan is required");

const outRoot = resolve(
  argValue(
    "--out-dir",
    join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-repair-approval-gate-rebuilds")
  )
);
const fingerprintReview = fingerprintReviewInput.value;
const plan = planInput.value;
const ragInformedRepairReuse =
  fingerprintReview.ragInformedRepairReuse === true ||
  fingerprintReview.sourceEvidence?.ragInformedRepairReuse === true ||
  fingerprintReview.approvalGateRebuildHandoff?.ragInformedRepairReuse === true;
const rebuildId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const rebuildDir = join(outRoot, rebuildId);
const packagePath = join(rebuildDir, "tlcl-reusable-workflow-repair-approval-gate-rebuild-package.json");
const receiptPath = join(rebuildDir, "tlcl-reusable-workflow-repair-approval-gate-rebuild-receipt.json");
const readmePath = join(rebuildDir, "TLCL_REUSABLE_WORKFLOW_REPAIR_APPROVAL_GATE_REBUILD_START_HERE.md");

const handoff = fingerprintReview.approvalGateRebuildHandoff || {};
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromInputs(fingerprintReview, handoff, plan);
const reasoningBudgetGovernorReviewTrace = reasoningBudgetGovernorReviewTraceFromInputs(fingerprintReview, handoff, plan);
const blockers = [];
if (fingerprintReview.status !== "reusable_workflow_repair_fingerprint_review_ready_for_approval_gate_rebuild") {
  blockers.push("fingerprint_review_not_ready_for_approval_gate_rebuild");
}
if (fingerprintReview.readyForApprovalGateRebuild !== true) blockers.push("approval_gate_rebuild_ready_flag_missing");
if (handoff.kind !== "reusable_workflow_repair_fingerprint_review_approval_gate_rebuild_handoff") {
  blockers.push("approval_gate_rebuild_handoff_missing");
}
if (fingerprintReview.locks?.approvalGateRebuildStillRequired !== true) blockers.push("approval_gate_rebuild_lock_missing");
if (fingerprintReview.locks?.doesNotRebuildApprovalGate !== true) blockers.push("fingerprint_review_must_not_have_rebuilt_gate");
if (fingerprintReview.locks?.doesNotRunMediumRuntime !== true) blockers.push("medium_runtime_lock_missing_from_fingerprint_review");
if (ragInformedRepairReuse) {
  if (fingerprintReview.ragEvidenceTreatedAsAuthority === true || handoff.ragEvidenceTreatedAsAuthority === true) {
    blockers.push("rag_informed_approval_gate_rebuild_treats_rag_as_authority");
  }
  if (fingerprintReview.ragEvidenceNonAuthoritative !== true && handoff.ragEvidenceNonAuthoritative !== true) {
    blockers.push("rag_informed_approval_gate_rebuild_non_authority_flag_missing");
  }
  if (fingerprintReview.locks?.ragEvidenceNonAuthoritative !== true || fingerprintReview.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_approval_gate_rebuild_non_authority_lock_missing");
  }
}
if (plan.status !== "medium_runtime_reuse_invocation_ready_for_approval_gate_planning") {
  blockers.push("invocation_plan_not_ready_for_rebuilt_approval_gate");
}
if (plan.invocationReady !== true || plan.fingerprintMatched !== true) {
  blockers.push("invocation_plan_fingerprint_or_ready_flag_missing");
}
if (plan.approvalGateStillRequired !== true || plan.rollbackStillRequired !== true || plan.outcomeReviewStillRequired !== true) {
  blockers.push("invocation_plan_required_followup_locks_missing");
}

let prepResult = null;
let prepRunnerInvoked = false;
let approvalGateRebuilt = false;
if (blockers.length === 0) {
  const args = ["--plan", planInput.path || JSON.stringify(plan), "--output-dir", join(rebuildDir, "approval-gate-prep")];
  if (goal) args.push("--goal", goal);
  const selector = argValue("--selector", argValue("--selector-path", ""));
  const queue = argValue("--queue", argValue("--queue-path", ""));
  const selectedPilotId = argValue("--selected-pilot-id", argValue("--pilot-id", ""));
  const selectedNumber = argValue("--selected-number", argValue("--number", ""));
  const adapterId = argValue("--adapter-id", "");
  const teacherConfirmation = argValue("--teacher-confirmation", argValue("--confirmation", ""));
  if (selector) args.push("--selector", selector);
  if (queue) args.push("--queue", queue);
  if (selectedPilotId) args.push("--selected-pilot-id", selectedPilotId);
  if (selectedNumber) args.push("--selected-number", selectedNumber);
  if (adapterId) args.push("--adapter-id", adapterId);
  for (const [flag, value] of [
    ["--reviewed-command", argValue("--reviewed-command", "")],
    ["--reviewed-api-request", argValue("--reviewed-api-request", "")],
    ["--reviewed-mapping", argValue("--reviewed-mapping", "")],
    ["--reviewed-browser-target", argValue("--reviewed-browser-target", "")],
    ["--target-window-title", argValue("--target-window-title", "")]
  ]) {
    if (value) args.push(flag, value);
  }
  if (teacherConfirmation) args.push("--teacher-confirmation", teacherConfirmation);
  if (hasFlag("--rollback-point-created")) args.push("--rollback-point-created");
  prepRunnerInvoked = true;
  const prep = runPrepRunner(args, process.cwd());
  if (!prep.ok) {
    blockers.push(`approval_gate_prep_runner_failed:${prep.error}`);
  } else {
    prepResult = prep.result;
    approvalGateRebuilt = prepResult.status === "reusable_workflow_invocation_approval_gate_prepared_waiting_for_teacher_execute_review";
    if (!approvalGateRebuilt) {
      for (const blocker of prepResult.blockers || []) blockers.push(`approval_gate_rebuild_blocker:${blocker}`);
    }
  }
}

const status = approvalGateRebuilt
  ? "reusable_workflow_repair_approval_gate_rebuild_prepared_waiting_for_teacher_execute_review"
  : prepRunnerInvoked
    ? "reusable_workflow_repair_approval_gate_rebuild_prepared_but_blocked"
    : "blocked_before_reusable_workflow_repair_approval_gate_rebuild";
const packageLocks = locks(approvalGateRebuilt, ragInformedRepairReuse);
const rebuildPackage = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approval_gate_rebuild_package_v1",
  rebuildId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  approvalGateRebuilt,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  approvalGatePrepRunnerInvoked: prepRunnerInvoked,
  readyForTeacherExecuteReview: approvalGateRebuilt,
  mediumRuntimeRetryAllowed: false,
  approvedGateRunnerInvoked: false,
  sourceEvidence: {
    fingerprintReviewValidationPath: fingerprintReviewInput.path,
    fingerprintReviewValidationHash: sha256Object(fingerprintReview),
    invocationPlanPath: planInput.path,
    invocationPlanHash: sha256Object(plan),
    workflowFingerprintBefore: handoff.workflowFingerprintBefore || "",
    workflowFingerprintAfter: handoff.workflowFingerprintAfter || plan.expectedWorkflowFingerprint || "",
    providerRoleUsePlanTrace,
    reasoningBudgetGovernorReviewTrace,
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse
  },
  generatedEvidence: {
    prepRunnerPacketPath: prepResult?.packetPath || "",
    prepRunnerReceiptPath: prepResult?.receiptPath || "",
    prepRunnerReadmePath: prepResult?.readmePath || "",
    approvalGatePath: prepResult?.approvalGatePath || "",
    approvalGateReceiptPath: prepResult?.approvalGateReceiptPath || "",
    approvalGateReadmePath: prepResult?.approvalGateReadmePath || ""
  },
  nextTeacherActions: approvalGateRebuilt
    ? [
        "Review the rebuilt approval gate packet and generated runner request.",
        "Confirm the repaired workflow fingerprint still matches the intended route.",
        "Only after separate teacher execute review may an approved-gate runner be invoked.",
        "Create a fresh outcome review after any later run."
      ]
    : [
        "Resolve every blocker before any medium-runtime retry.",
        "Return to high-reasoning repair if the fingerprint review, plan, or route evidence no longer matches.",
        "Keep rollback points until the teacher confirms the rebuilt approval gate is correct."
      ],
  blockers,
  blockedTransitions: [
    "run_approved_gate_runner_from_repair_approval_gate_rebuild",
    "run_medium_runtime_workflow_from_repair_approval_gate_rebuild",
    "execute_target_software_from_repair_approval_gate_rebuild",
    "send_ui_events_from_repair_approval_gate_rebuild",
    "capture_screenshot_from_repair_approval_gate_rebuild",
    "write_memory_from_repair_approval_gate_rebuild",
    "enable_rule_from_repair_approval_gate_rebuild",
    "unlock_packaging_from_repair_approval_gate_rebuild",
    ...(ragInformedRepairReuse ? ["treat_rag_as_authority_from_repair_approval_gate_rebuild"] : []),
    "claim_goal_complete_from_repair_approval_gate_rebuild"
  ],
  paths: {
    package: packagePath,
    receipt: receiptPath,
    readme: readmePath
  },
  locks: packageLocks
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approval_gate_rebuild_receipt_v1",
  rebuildId,
  status,
  approvalGateRebuilt,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  approvalGatePrepRunnerInvoked: prepRunnerInvoked,
  readyForTeacherExecuteReview: approvalGateRebuilt,
  mediumRuntimeRetryAllowed: false,
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

writeJson(packagePath, rebuildPackage);
writeJson(receiptPath, receipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow Repair Approval Gate Rebuild",
    "",
    `Status: ${status}`,
    `Approval gate rebuilt: ${approvalGateRebuilt ? "yes" : "no"}`,
    "",
    "This package rebuilds only the approval gate after a teacher-approved high-reasoning repair fingerprint review.",
    "It does not run the approved-gate runner, execute target software, send UI events, capture screenshots, write memory, enable rules, unlock packaging, or claim completion.",
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
        "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_approval_gate_rebuild_package_result_v1",
      rebuildId,
      status,
      approvalGateRebuilt,
      approvalGatePrepRunnerInvoked: prepRunnerInvoked,
      readyForTeacherExecuteReview: approvalGateRebuilt,
      mediumRuntimeRetryAllowed: false,
      approvedGateRunnerInvoked: false,
      packagePath,
      receiptPath,
      readmePath,
      prepRunnerPacketPath: prepResult?.packetPath || "",
      approvalGatePath: prepResult?.approvalGatePath || "",
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
      goalComplete: false
    },
    null,
    2
  )
);
