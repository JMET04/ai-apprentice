#!/usr/bin/env node
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
    String(value || "tlcl-dry-run-route-review-receipt-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-dry-run-route-review-receipt-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["route_reviewed_ready_for_dry_run_only_runner", "ready_for_dry_run_only_runner", "approve_dry_run_only_runner"].includes(decision)) {
    return "route_reviewed_ready_for_dry_run_only_runner";
  }
  if (["needs_more_route_evidence", "blocked_needs_more_evidence"].includes(decision)) return "needs_more_route_evidence";
  if (["correction_to_senior_compile", "teacher_correction", "repair_contract"].includes(decision)) return "correction_to_senior_compile";
  if (["accepted", "execute_now", "run_execute_mode", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function commandTemplate(tool, args) {
  return `${tool} ${JSON.stringify(args || {})}`;
}

function providerRoleUsePlanTraceFromHandoff(handoff) {
  const trace = handoff?.sourceEvidence?.providerRoleUsePlanTrace || {};
  return {
    inheritedFromHandoff: Boolean(trace.providerRoleUsePlanHash),
    requiredForScopedProvider: trace.requiredForScopedProvider === true,
    accepted: trace.accepted === true,
    providerRole: trace.providerRole || "",
    providerRoleUsePlanPath: trace.providerRoleUsePlanPath || "",
    providerRoleUsePlanHash: trace.providerRoleUsePlanHash || "",
    nextGateSatisfied: trace.nextGateSatisfied !== false
  };
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
    doesNotRunDryRun: true,
    doesNotRunRunner: true,
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

const goal = argValue("--goal", "Validate a teacher receipt for a TLCL dry-run route review handoff.");
const handoffInput = readJsonInput(
  argValue("--handoff", argValue("--route-review-handoff", "")),
  "--handoff",
  "transparent_ai_tlcl_medium_runtime_dry_run_route_review_handoff_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-dry-run-route-review-receipt-validations"))
);

const handoff = handoffInput.value;
const receipt = receiptInput.value;
const providerRoleUsePlanTrace = providerRoleUsePlanTraceFromHandoff(handoff);
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set(["accepted", "execute_now", "run_execute_mode", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"]);
const handoffItems = Array.isArray(handoff.handoffItems) ? handoff.handoffItems : [];
const selectedItem =
  handoffItems.find((item) => item.id && item.id === receipt.selectedHandoffItemId) ||
  handoffItems.find((item) => Number(item.routeIndex) === Number(receipt.selectedRouteIndex)) ||
  null;
const blockers = [];

if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (handoff.status !== "dry_run_route_review_handoff_ready") blockers.push("handoff_not_ready_for_route_review");
if (handoff.locks?.noSoftwareExecution !== true) blockers.push("handoff_execution_lock_mismatch");
if (handoff.locks?.noTargetSoftwareCommands !== true) blockers.push("handoff_target_command_lock_mismatch");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");

if (decision === "route_reviewed_ready_for_dry_run_only_runner") {
  if (!selectedItem) blockers.push("selected_handoff_item_not_found");
  if (selectedItem?.executesNow !== false) blockers.push("selected_handoff_item_not_non_executing");
  if (receipt.handoffEvidenceReviewed !== true) blockers.push("handoff_evidence_not_reviewed");
  if (receipt.commandTemplateReviewed !== true) blockers.push("command_template_not_reviewed");
  if (receipt.retainedRollbackPointConfirmed !== true) blockers.push("retained_rollback_point_not_confirmed");
  if (receipt.dryRunOnlyConfirmed !== true) blockers.push("dry_run_only_boundary_not_confirmed");
}
if (decision === "correction_to_senior_compile" && !String(receipt.teacherCorrection || "").trim()) {
  blockers.push("senior_compile_correction_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForDryRunOnlyRunner = decision === "route_reviewed_ready_for_dry_run_only_runner" && blockers.length === 0;
const escalateToSeniorCompile = decision === "correction_to_senior_compile" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyForDryRunOnlyRunner
    ? "ready_for_separate_dry_run_only_runner"
    : escalateToSeniorCompile
      ? "escalate_to_senior_compile"
      : "needs_teacher_review_or_more_route_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-medium-runtime-dry-run-route-review-receipt-validation.json");
const receiptPath = join(validationDir, "tlcl-medium-runtime-dry-run-route-review-receipt-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_MEDIUM_RUNTIME_DRY_RUN_ROUTE_REVIEW_RECEIPT_VALIDATION_START_HERE.md");

const dryRunOnlyRunnerHandoff = readyForDryRunOnlyRunner
  ? {
      kind: "dry_run_only_runner_command_template",
      routeIndex: selectedItem.routeIndex,
      handoffItemId: selectedItem.id,
      tool: selectedItem.tool || "",
      arguments: selectedItem.arguments || {},
      commandTemplate: commandTemplate(selectedItem.tool || "", {
        ...(selectedItem.arguments || {}),
        mode: "dry_run_only",
        requiresPostRunTeacherReceipt: true
      }),
      executesNow: false,
      blockedUntil: "teacher separately confirms dry-run-only runner invocation",
      requiresRetainedRollbackPoint: true,
      requiresPostDryRunReceiptReview: true
    }
  : null;
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForDryRunOnlyRunner,
  escalateToSeniorCompile,
  forbiddenDecisionUsed,
  blockers,
  sourceEvidence: {
    handoffPath: handoffInput.path,
    receiptPath: receiptInput.path,
    providerRoleUsePlanTrace
  },
  selectedHandoffItemId: receipt.selectedHandoffItemId || "",
  selectedRouteIndex: Number(receipt.selectedRouteIndex || 0),
  dryRunOnlyRunnerHandoff,
  seniorCompileEscalation: escalateToSeniorCompile
    ? {
        escalates_to: "senior_reasoning_compile",
        teacherCorrection: receipt.teacherCorrection || "",
        repairTasks: [
          "Repair the TLCL contract, route evidence, command template, or selected target interpretation from the teacher correction.",
          "Rerun status refresh, deterministic validation, runtime gate, medium dry-run prep, route review handoff, and this receipt validation."
        ]
      }
    : null,
  blockedTransitions: [
    "run_dry_run_from_route_review_validation",
    "run_dry_run_only_runner_from_validation",
    "execute_target_software_from_route_review_validation",
    "send_ui_events_from_route_review_validation",
    "enable_rule_from_route_review_validation",
    "write_memory_from_route_review_validation",
    "unlock_packaging_from_route_review_validation",
    "claim_completion_from_route_review_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourceHandoff: handoffInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForDryRunOnlyRunner,
  escalateToSeniorCompile,
  forbiddenDecisionUsed,
  blockers,
  dryRunExecuted: false,
  runnerExecuted: false,
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
    "# TLCL Medium Runtime Dry-Run Route Review Receipt Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation only checks the teacher route-review receipt. It may prepare a later dry-run-only runner command template, but it does not run dry-runs, run runners, execute target software, send UI events, enable rules, write memory, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_dry_run_route_review_receipt_validation_result_v1",
      validationId,
      status,
      decision,
      readyForDryRunOnlyRunner,
      escalateToSeniorCompile,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath,
      readmePath,
      dryRunExecuted: false,
      runnerExecuted: false,
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
