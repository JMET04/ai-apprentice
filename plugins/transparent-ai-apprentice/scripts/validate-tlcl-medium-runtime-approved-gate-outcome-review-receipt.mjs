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

function slug(value) {
  return (
    String(value || "tlcl-approved-gate-outcome-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-approved-gate-outcome-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["executed_route_matched_contract", "matched_contract", "route_matched"].includes(decision)) {
    return "executed_route_matched_contract";
  }
  if (["executed_route_mismatch_blocked", "mismatch_blocked", "blocked"].includes(decision)) {
    return "executed_route_mismatch_blocked";
  }
  if (["correction_to_high_reasoning_repair", "teacher_correction", "repair_contract", "correction_to_senior_compile"].includes(decision)) {
    return "correction_to_high_reasoning_repair";
  }
  if (["accepted", "enable_rule", "write_memory", "unlock_packaging", "claim_goal_complete", "claim_all_software_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function providerRoleUsePlanTraceFromRun(run) {
  return run?.sourceEvidence?.providerRoleUsePlanTrace || {};
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goal = argValue("--goal", "Validate teacher outcome review for one TLCL approved-gate run.");
const runInput = readJsonInput(
  argValue("--run", argValue("--approved-gate-runner", "")),
  "--run",
  "transparent_ai_tlcl_medium_runtime_approved_gate_runner_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-approved-gate-outcome-review-validations"))
);
const run = runInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set([
  "accepted",
  "enable_rule",
  "write_memory",
  "unlock_packaging",
  "claim_goal_complete",
  "claim_all_software_complete"
]);
const blockers = [];

if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (run.runnerInvoked !== true) blockers.push("approved_gate_runner_not_invoked");
if (run.locks?.goalComplete !== false) blockers.push("run_goal_completion_lock_missing");
if (run.locks?.allSoftwareExecutionComplete !== false) blockers.push("run_all_software_completion_lock_missing");
if (run.locks?.packagingGated !== true) blockers.push("run_packaging_gate_lock_missing");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");

if (decision === "executed_route_matched_contract") {
  if (run.controlledRouteActionExecuted !== true) blockers.push("controlled_route_action_not_executed");
  if (receipt.runnerPacketReviewed !== true) blockers.push("runner_packet_not_reviewed");
  if (receipt.existingRunnerReceiptReviewed !== true) blockers.push("existing_runner_receipt_not_reviewed");
  if (receipt.adapterReceiptReviewed !== true) blockers.push("adapter_receipt_not_reviewed");
  if (receipt.outcomeVerificationReviewed !== true) blockers.push("outcome_verification_not_reviewed");
  if (receipt.postActionCheckpointReviewed !== true) blockers.push("post_action_checkpoint_not_reviewed");
  if (receipt.rollbackPointStillRetained !== true) blockers.push("rollback_point_not_retained");
  if (receipt.teacherMatchedContract !== true) blockers.push("teacher_contract_match_confirmation_missing");
}

if (decision === "correction_to_high_reasoning_repair" && !String(receipt.teacherCorrection || "").trim()) {
  blockers.push("high_reasoning_repair_correction_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const outcomeMatchedContract = decision === "executed_route_matched_contract" && blockers.length === 0;
const mismatchBlocked = decision === "executed_route_mismatch_blocked" && !forbiddenDecisionUsed;
const escalateToHighReasoningRepair = decision === "correction_to_high_reasoning_repair" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : outcomeMatchedContract
    ? "execution_outcome_matched_contract_waiting_for_rule_activation_review"
    : mismatchBlocked || escalateToHighReasoningRepair
      ? "escalate_to_high_reasoning_repair"
      : "needs_teacher_review_or_more_evidence";

const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-medium-runtime-approved-gate-outcome-review-validation.json");
const receiptPath = join(validationDir, "tlcl-medium-runtime-approved-gate-outcome-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_MEDIUM_RUNTIME_APPROVED_GATE_OUTCOME_REVIEW_VALIDATION_START_HERE.md");
const highReasoningRepairHandoff =
  mismatchBlocked || escalateToHighReasoningRepair
    ? {
        kind: "high_reasoning_repair_handoff",
        runtimeTransition: "medium_runtime_execution_result_to_high_reasoning_contract_repair",
        sourceRunId: run.runId || "",
        providerRoleUsePlanTrace: providerRoleUsePlanTraceFromRun(run),
        teacherDecision: decision,
        teacherCorrection: receipt.teacherCorrection || "",
        observedIssue: receipt.observedIssue || receipt.teacherNote || "",
        affectedLogicFields: Array.isArray(receipt.affectedLogicFields) ? receipt.affectedLogicFields : [],
        evidenceToInspect: [
          runInput.path,
          run.generatedEvidence?.existingRunnerReceiptPath || "",
          run.generatedEvidence?.adapterReceiptPath || "",
          run.generatedEvidence?.outcomeVerificationPath || "",
          run.generatedEvidence?.postActionCheckpointPath || ""
        ].filter(Boolean),
        repairTasks: [
          "Use highest-reasoning compile to repair the TLCL contract, rule package, route binding, or command template.",
          "Do not let the medium runtime continue from this failed outcome.",
          "Rerun deterministic validation and the TLCL dry-run chain before any future approved-gate runner."
        ],
        blockedUntil: "a repaired TLCL contract passes validators and the teacher re-enters the dry-run review chain"
      }
    : null;
const matchedContractHandoff = outcomeMatchedContract
  ? {
      kind: "matched_contract_review_handoff",
      runtimeTransition: "one_medium_runtime_execution_result_waiting_for_teacher_rule_activation_review",
      sourceRunId: run.runId || "",
      providerRoleUsePlanTrace: providerRoleUsePlanTraceFromRun(run),
      executesNow: false,
      memoryWriteAllowed: false,
      ruleEnablementAllowed: false,
      nextRequiredReview:
        "Teacher must separately review whether this single successful route should become reusable rule evidence; this validation does not enable it."
    }
  : null;

const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
  matchedContractHandoff,
  highReasoningRepairHandoff,
  sourceEvidence: {
    runPath: runInput.path,
    runHash: sha256Object(run),
    receiptPath: receiptInput.path,
    receiptHash: sha256Object(receipt),
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromRun(run)
  },
  blockedTransitions: [
    "run_approved_gate_from_outcome_validation",
    "execute_target_software_from_outcome_validation",
    "enable_rule_from_outcome_validation",
    "write_memory_from_outcome_validation",
    "unlock_packaging_from_outcome_validation",
    "claim_goal_complete_from_outcome_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceRun: runInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_validation_receipt_v1",
  validationId,
  status,
  decision,
  outcomeMatchedContract,
  mismatchBlocked,
  escalateToHighReasoningRepair,
  forbiddenDecisionUsed,
  blockers,
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
  locks: locks()
};

writeJson(validationPath, validation);
writeJson(receiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Approved-Gate Outcome Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation reads one TLCL approved-gate outcome review receipt. It does not run software, enable rules, write memory, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_validation_result_v1",
      validationId,
      status,
      decision,
      outcomeMatchedContract,
      mismatchBlocked,
      escalateToHighReasoningRepair,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath,
      readmePath,
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
