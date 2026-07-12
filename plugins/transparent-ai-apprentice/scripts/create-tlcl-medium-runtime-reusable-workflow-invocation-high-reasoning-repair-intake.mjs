#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
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

function slug(value) {
  return (
    String(value || "tlcl-reusable-workflow-high-reasoning-repair-intake")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-reusable-workflow-high-reasoning-repair-intake"
  );
}

function locks(ragInformedRepairReuse = false) {
  return {
    reviewOnly: true,
    repairIntakeOnly: true,
    supportsRagInformedRepairReuseInvocation: true,
    highReasoningCompileRequired: true,
    mediumRuntimeContinuationBlocked: true,
    doesNotRepairAutomatically: true,
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
    goalComplete: false,
    ...(ragInformedRepairReuse
      ? {
          ragEvidenceNonAuthoritative: true,
          doesNotTreatRagAsAuthority: true
        }
      : {})
  };
}

function providerRoleUsePlanTraceFromValidation(validation, handoff) {
  return (
    handoff?.providerRoleUsePlanTrace ||
    validation?.sourceEvidence?.providerRoleUsePlanTrace ||
    {}
  );
}

function reasoningBudgetGovernorReviewTraceFromValidation(validation, handoff) {
  return (
    handoff?.reasoningBudgetGovernorReviewTrace ||
    validation?.sourceEvidence?.reasoningBudgetGovernorReviewTrace ||
    {}
  );
}

const goal = argValue("--goal", "Create a high-reasoning repair intake for one failed TLCL reusable workflow invocation.");
const validationInput = readJsonInput(
  argValue("--validation", argValue("--outcome-review-validation", "")),
  "--validation"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-reusable-workflow-high-reasoning-repair-intakes"))
);
const validation = validationInput.value;
const handoff = validation.highReasoningRepairHandoff || {};
const acceptedFormats = new Set([
  "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1",
  "transparent_ai_tlcl_medium_runtime_repaired_reusable_workflow_invocation_approved_gate_outcome_review_validation_v1"
]);
const formatAccepted = acceptedFormats.has(validation.format);
const ragInformedRepairReuse = validation.ragInformedRepairReuse === true || handoff.ragInformedRepairReuse === true;
const expectedRepairStatuses = new Set([
  "reusable_workflow_invocation_to_high_reasoning_contract_repair",
  "repaired_reusable_workflow_invocation_to_high_reasoning_contract_repair"
]);
const expectedRuntimeTransitions = new Set([
  "reusable_workflow_invocation_to_high_reasoning_contract_repair",
  "repaired_reusable_workflow_fresh_outcome_to_high_reasoning_contract_repair"
]);
const readyForRepair =
  formatAccepted &&
  expectedRepairStatuses.has(validation.status) &&
  validation.escalateToHighReasoningRepair === true &&
  validation.forbiddenDecisionUsed !== true &&
  expectedRuntimeTransitions.has(handoff.runtimeTransition);
const blockers = [];
if (!formatAccepted) blockers.push("validation_format_not_supported_for_reusable_workflow_high_reasoning_repair_intake");
if (!readyForRepair) blockers.push("validation_not_ready_for_reusable_workflow_high_reasoning_repair");
if (validation.forbiddenDecisionUsed === true) blockers.push("forbidden_outcome_review_decision_cannot_create_repair_intake");
if (!String(handoff.teacherCorrection || handoff.observedIssue || "").trim()) {
  blockers.push("teacher_correction_or_observed_issue_missing");
}
if (ragInformedRepairReuse) {
  if (validation.ragEvidenceTreatedAsAuthority === true || handoff.ragEvidenceTreatedAsAuthority === true) {
    blockers.push("rag_informed_repair_intake_treats_rag_as_authority");
  }
  if (validation.ragEvidenceNonAuthoritative !== true && handoff.ragEvidenceNonAuthoritative !== true) {
    blockers.push("rag_informed_repair_intake_non_authority_flag_missing");
  }
  if (validation.locks?.ragEvidenceNonAuthoritative !== true || validation.locks?.doesNotTreatRagAsAuthority !== true) {
    blockers.push("rag_informed_repair_intake_non_authority_lock_missing");
  }
}

const intakeId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const intakeDir = join(outRoot, intakeId);
const intakePath = join(intakeDir, "tlcl-reusable-workflow-high-reasoning-repair-intake.json");
const receiptPath = join(intakeDir, "tlcl-reusable-workflow-high-reasoning-repair-intake-receipt.json");
const readmePath = join(intakeDir, "TLCL_REUSABLE_WORKFLOW_HIGH_REASONING_REPAIR_INTAKE_START_HERE.md");
const promptPath = join(intakeDir, "high-reasoning-repair-prompt.md");
const status = blockers.length
  ? "blocked_before_reusable_workflow_high_reasoning_repair_intake"
  : "reusable_workflow_high_reasoning_repair_intake_ready";
const repairTasks = blockers.length
  ? []
  : [
      "Reconstruct the intended teacher logic from the correction and evidence paths.",
      "Repair the Rule Card, Rule DSL, validator expectations, route binding, workflow fingerprint, or command template as needed.",
      "Produce a disabled repaired rule package and regression validation plan before any medium-runtime retry.",
      "Require deterministic validation, rollback retention, approval gate rebuild, and a fresh outcome review before reusing the workflow again."
    ];
const evidenceToInspect = Array.from(
  new Set([validationInput.path, ...(Array.isArray(handoff.evidenceToInspect) ? handoff.evidenceToInspect : [])].filter(Boolean))
);
const repairPrompt = [
  "# High-Reasoning Repair Prompt",
  "",
  "Role: highest-reasoning TLCL compiler.",
  "",
  "Objective: repair a failed medium-runtime reusable workflow invocation by updating the logical contract, not by improvising a one-off output.",
  "",
      `Teacher correction: ${handoff.teacherCorrection || ""}`,
      `Observed issue: ${handoff.observedIssue || ""}`,
      `Affected logic fields: ${(handoff.affectedLogicFields || []).join(", ") || "unspecified"}`,
      `RAG-informed repair reuse: ${ragInformedRepairReuse ? "yes, evidence-only and non-authoritative" : "no"}`,
      "",
      "Evidence to inspect:",
  ...(evidenceToInspect.length ? evidenceToInspect.map((item) => `- ${item}`) : ["- none"]),
  "",
  "Required output boundary:",
  "- A repaired Rule Card / Rule DSL / validator or workflow fingerprint proposal.",
  "- No target software execution.",
  "- No memory write, rule enablement, packaging unlock, or completion claim.",
  "- A deterministic validation and teacher review plan before medium runtime can retry."
].join("\n");
const intake = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_v1",
  intakeId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  readyForHighReasoningCompile: blockers.length === 0,
  sourceEvidence: {
    validationPath: validationInput.path,
    validationHash: sha256Object(validation),
    sourceRunId: handoff.sourceRunId || "",
    sourceRepairedRunId: handoff.sourceRepairedRunId || "",
    workflowFingerprint: handoff.workflowFingerprint || "",
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromValidation(validation, handoff),
    reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromValidation(validation, handoff),
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse
  },
  repairContext: {
    runtimeTransition: handoff.runtimeTransition || "",
    teacherDecision: handoff.teacherDecision || validation.decision || "",
    ragInformedRepairReuse,
    ragEvidenceTreatedAsAuthority: false,
    ragEvidenceNonAuthoritative: ragInformedRepairReuse,
    teacherCorrection: handoff.teacherCorrection || "",
    observedIssue: handoff.observedIssue || "",
    affectedLogicFields: Array.isArray(handoff.affectedLogicFields) ? handoff.affectedLogicFields : [],
    evidenceToInspect,
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromValidation(validation, handoff),
    reasoningBudgetGovernorReviewTrace: reasoningBudgetGovernorReviewTraceFromValidation(validation, handoff),
    repairTasks
  },
  mediumRuntimeRetryGate: {
    blockedUntilHighReasoningRepairValidated: true,
    requiresRepairedRuleDslValidation: true,
    requiresWorkflowFingerprintReview: true,
    requiresRollbackPoint: true,
    requiresApprovalGateRebuild: true,
    requiresFreshOutcomeReview: true
  },
  blockedTransitions: [
    "retry_medium_runtime_from_repair_intake",
    "run_reusable_workflow_from_repair_intake",
    "execute_target_software_from_repair_intake",
    "enable_rule_from_repair_intake",
    "write_memory_from_repair_intake",
    "unlock_packaging_from_repair_intake",
    "treat_rag_as_authority_from_repair_intake",
    "claim_completion_from_repair_intake"
  ],
  blockers,
  paths: {
    intake: intakePath,
    receipt: receiptPath,
    readme: readmePath,
    prompt: promptPath
  },
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  locks: locks(ragInformedRepairReuse)
};
const receipt = {
  format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_receipt_v1",
  intakeId,
  status,
  readyForHighReasoningCompile: intake.readyForHighReasoningCompile,
  blockerCount: blockers.length,
  repairTaskCount: repairTasks.length,
  approvedGateRunnerInvoked: false,
  targetSoftwareCommandsExecuted: false,
  screenshotsCaptured: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  nativeUniversalExecution: false,
  allSoftwareExecutionComplete: false,
  goalComplete: false,
  ragInformedRepairReuse,
  ragEvidenceTreatedAsAuthority: false,
  ragEvidenceNonAuthoritative: ragInformedRepairReuse,
  locks: locks(ragInformedRepairReuse)
};

writeJson(intakePath, intake);
writeJson(receiptPath, receipt);
writeFileSync(promptPath, `${repairPrompt}\n`, "utf8");
writeFileSync(
  readmePath,
  [
    "# TLCL Reusable Workflow High-Reasoning Repair Intake",
    "",
    `Status: ${status}`,
    "",
    "This intake packages one failed reusable workflow invocation for highest-reasoning contract repair.",
    "It does not repair automatically, run software, write memory, enable rules, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_reusable_workflow_invocation_high_reasoning_repair_intake_result_v1",
      intakeId,
      status,
      readyForHighReasoningCompile: intake.readyForHighReasoningCompile,
      intakePath,
      receiptPath,
      readmePath,
      promptPath,
      ragInformedRepairReuse,
      ragEvidenceTreatedAsAuthority: false,
      ragEvidenceNonAuthoritative: ragInformedRepairReuse,
      blockerCount: blockers.length,
      repairTaskCount: repairTasks.length,
      approvedGateRunnerInvoked: false,
      targetSoftwareCommandsExecuted: false,
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
