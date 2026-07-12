#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readJsonInput(input, label, expectedFormat = "") {
  const text = String(input || "").trim();
  if (!text) throw new Error(`${label} is required`);
  const parsed = existsSync(text)
    ? { value: JSON.parse(readFileSync(resolve(text), "utf8").replace(/^\uFEFF/, "")), path: resolve(text) }
    : text.startsWith("{")
      ? { value: JSON.parse(text), path: "" }
      : null;
  if (!parsed) throw new Error(`${label} must be a JSON path or JSON object string`);
  if (expectedFormat && parsed.value?.format !== expectedFormat) throw new Error(`${label} must be ${expectedFormat}`);
  return parsed;
}

function slug(value) {
  return (
    String(value || "tlcl-dry-run-only-post-run-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-dry-run-only-post-run-receipt-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["dry_run_matched_expected", "matched_expected", "ready_for_execution_approval_gate"].includes(decision)) {
    return "dry_run_matched_expected";
  }
  if (["dry_run_mismatch_blocked", "mismatch_blocked", "blocked"].includes(decision)) return "dry_run_mismatch_blocked";
  if (["correction_to_senior_compile", "teacher_correction", "repair_contract"].includes(decision)) return "correction_to_senior_compile";
  if (["accepted", "execute_now", "run_execute_mode", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function sha256Object(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function providerRoleUsePlanTraceFromRun(run) {
  return (
    run?.simulatedDryRunEvidence?.providerRoleUsePlanTrace ||
    run?.sourceEvidence?.providerRoleUsePlanTrace ||
    {}
  );
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    doesNotCreateExecutionApprovalGate: true,
    doesNotRunDryRun: true,
    noSoftwareExecution: true,
    noTargetSoftwareCommands: true,
    noUiEvents: true,
    noScreenshots: true,
    noFullLogs: true,
    noRuleEnablement: true,
    noMemoryWrite: true,
    noPackagingUnlock: true,
    noCompletionClaim: true,
    accepted: false,
    ruleEnabled: false,
    packagingGated: true
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const goal = argValue("--goal", "Validate a teacher post-run receipt for a TLCL dry-run-only run.");
const runInput = readJsonInput(
  argValue("--run", argValue("--dry-run-only-run", "")),
  "--run",
  "transparent_ai_tlcl_medium_runtime_dry_run_only_run_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-dry-run-only-post-run-receipt-validations"))
);
const run = runInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set(["accepted", "execute_now", "run_execute_mode", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"]);
const blockers = [];

if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (run.status !== "dry_run_only_runner_completed_waiting_for_teacher_review") blockers.push("run_not_waiting_for_teacher_review");
if (!run.simulatedDryRunEvidence) blockers.push("simulated_dry_run_evidence_missing");
if (run.simulatedDryRunEvidence?.adapterInvoked !== false) blockers.push("adapter_invoked_lock_mismatch");
if (run.simulatedDryRunEvidence?.targetSoftwareCommandsExecuted !== false) blockers.push("target_command_lock_mismatch");
if (run.locks?.noTargetSoftwareCommands !== true) blockers.push("run_target_command_lock_missing");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");

if (decision === "dry_run_matched_expected") {
  if (receipt.dryRunEvidenceReviewed !== true) blockers.push("dry_run_evidence_not_reviewed");
  if (receipt.commandTemplateReviewed !== true) blockers.push("command_template_not_reviewed");
  if (receipt.noExecutionLocksReviewed !== true) blockers.push("no_execution_locks_not_reviewed");
  if (receipt.rollbackPointStillRetained !== true) blockers.push("rollback_point_not_retained");
  if (receipt.teacherMatchedExpected !== true) blockers.push("teacher_match_confirmation_missing");
}
if (decision === "correction_to_senior_compile" && !String(receipt.teacherCorrection || "").trim()) {
  blockers.push("senior_compile_correction_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForExecutionApprovalGatePlanning = decision === "dry_run_matched_expected" && blockers.length === 0;
const mismatchBlocked = decision === "dry_run_mismatch_blocked" && !forbiddenDecisionUsed;
const escalateToSeniorCompile = decision === "correction_to_senior_compile" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyForExecutionApprovalGatePlanning
    ? "ready_for_execution_approval_gate_planning"
    : mismatchBlocked
      ? "blocked_by_teacher_dry_run_mismatch"
      : escalateToSeniorCompile
        ? "escalate_to_senior_compile"
        : "needs_teacher_review_or_more_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-medium-runtime-dry-run-only-post-run-receipt-validation.json");
const receiptPath = join(validationDir, "tlcl-medium-runtime-dry-run-only-post-run-receipt-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_MEDIUM_RUNTIME_DRY_RUN_ONLY_POST_RUN_RECEIPT_VALIDATION_START_HERE.md");
const executionApprovalGatePlanningHandoff = readyForExecutionApprovalGatePlanning
  ? {
      kind: "execution_approval_gate_planning_handoff",
      executesNow: false,
      sourceRunId: run.runId || "",
      providerRoleUsePlanTrace: providerRoleUsePlanTraceFromRun(run),
      routeIndex: run.simulatedDryRunEvidence?.routeIndex || 0,
      handoffItemId: run.simulatedDryRunEvidence?.handoffItemId || "",
      reviewedCommandTemplate: run.simulatedDryRunEvidence?.commandTemplate || "",
      requiredBeforeGate: [
        "teacher provides explicit execute approval text",
        "retained rollback point is confirmed again",
        "deterministic validators still pass",
        "target software route is reviewed against the exact selected target"
      ],
      blockedUntil: "separate execution approval gate is created and reviewed"
    }
  : null;
const seniorCompileEscalation = escalateToSeniorCompile
  ? {
      escalates_to: "senior_reasoning_compile",
      teacherCorrection: receipt.teacherCorrection || "",
      repairTasks: [
        "Repair the TLCL contract, route interpretation, command template, or dry-run evidence from the teacher correction.",
        "Rerun the TLCL runtime gate chain before any later execution approval planning."
      ]
    }
  : null;
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForExecutionApprovalGatePlanning,
  mismatchBlocked,
  escalateToSeniorCompile,
  forbiddenDecisionUsed,
  blockers,
  executionApprovalGatePlanningHandoff,
  seniorCompileEscalation,
  sourceEvidence: {
    runPath: runInput.path,
    runHash: sha256Object(run),
    receiptPath: receiptInput.path,
    receiptHash: sha256Object(receipt),
    providerRoleUsePlanTrace: providerRoleUsePlanTraceFromRun(run)
  },
  blockedTransitions: [
    "create_execution_approval_gate_from_post_run_validation",
    "execute_target_software_from_post_run_validation",
    "send_ui_events_from_post_run_validation",
    "enable_rule_from_post_run_validation",
    "write_memory_from_post_run_validation",
    "unlock_packaging_from_post_run_validation",
    "claim_completion_from_post_run_validation"
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
  format: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForExecutionApprovalGatePlanning,
  mismatchBlocked,
  escalateToSeniorCompile,
  forbiddenDecisionUsed,
  blockers,
  executionApprovalGateCreated: false,
  targetSoftwareCommandsExecuted: false,
  uiEventsSent: false,
  memoryWritten: false,
  accepted: false,
  ruleEnabled: false,
  packagingGated: true,
  locks: locks()
};

writeJson(validationPath, validation);
writeJson(receiptPath, validationReceipt);
writeFileSync(
  readmePath,
  [
    "# TLCL Medium Runtime Dry-Run-Only Post-Run Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation checks the teacher post-run receipt. It may prepare a later execution approval gate planning handoff, but it does not create the gate or execute target software.",
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
      format: "transparent_ai_tlcl_medium_runtime_dry_run_only_post_run_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForExecutionApprovalGatePlanning,
      mismatchBlocked,
      escalateToSeniorCompile,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath,
      readmePath,
      executionApprovalGateCreated: false,
      targetSoftwareCommandsExecuted: false,
      uiEventsSent: false,
      memoryWritten: false,
      accepted: false,
      ruleEnabled: false,
      packagingGated: true
    },
    null,
    2
  )
);

if (forbiddenDecisionUsed) process.exit(1);
