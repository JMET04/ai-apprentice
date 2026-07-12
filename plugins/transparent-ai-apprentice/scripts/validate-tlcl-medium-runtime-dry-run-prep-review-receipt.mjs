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
    String(value || "tlcl-medium-runtime-dry-run-prep-review-validation")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "tlcl-medium-runtime-dry-run-prep-review-validation"
  );
}

function normalizeDecision(value) {
  const decision = String(value || "needs_teacher_review").trim().toLowerCase();
  if (["teacher_reviewed_route_ready_for_dry_run", "ready_for_dry_run", "approve_dry_run_route"].includes(decision)) {
    return "teacher_reviewed_route_ready_for_dry_run";
  }
  if (["needs_more_route_evidence", "blocked_needs_more_evidence"].includes(decision)) return "needs_more_route_evidence";
  if (["correction_to_senior_compile", "teacher_correction", "repair_contract"].includes(decision)) return "correction_to_senior_compile";
  if (["accepted", "execute_now", "run_execute_mode", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"].includes(decision)) {
    return decision;
  }
  return "needs_teacher_review";
}

function locks() {
  return {
    reviewOnly: true,
    validationOnly: true,
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

const goal = argValue("--goal", "Validate a teacher receipt for TLCL medium runtime dry-run prep.");
const prepInput = readJsonInput(
  argValue("--prep", argValue("--dry-run-prep", argValue("--tlcl-medium-runtime-dry-run-prep", ""))),
  "--prep",
  "transparent_ai_tlcl_medium_runtime_dry_run_prep_v1"
);
const receiptInput = readJsonInput(
  argValue("--receipt", argValue("--teacher-receipt", "")),
  "--receipt",
  "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_receipt_v1"
);
const outRoot = resolve(
  argValue("--out-dir", join(process.cwd(), ".transparent-apprentice", "tlcl-medium-runtime-dry-run-prep-review-validations"))
);

const prep = prepInput.value;
const receipt = receiptInput.value;
const decision = normalizeDecision(receipt.teacherDecision);
const forbiddenDecisions = new Set(["accepted", "execute_now", "run_execute_mode", "enable_rule", "write_memory", "unlock_packaging", "claim_complete"]);
const routeCandidates = prep.dryRunPreparation?.routeCandidates || [];
const selectedRoute = routeCandidates.find((route) => Number(route.index) === Number(receipt.selectedRouteIndex)) || null;
const blockers = [];

if (forbiddenDecisions.has(decision)) blockers.push("forbidden_teacher_decision");
if (prep.status !== "medium_runtime_dry_run_prep_ready_for_teacher_review") blockers.push("prep_not_ready_for_teacher_review");
if (prep.dryRunPreparation?.canPrepareDryRun !== true) blockers.push("prep_cannot_prepare_dry_run");
if (prep.locks?.noSoftwareExecution !== true) blockers.push("prep_execution_lock_mismatch");
if (receipt.blockedActionsConfirmed !== true) blockers.push("blocked_actions_not_confirmed_by_teacher");

if (decision === "teacher_reviewed_route_ready_for_dry_run") {
  if (!selectedRoute) blockers.push("selected_route_index_not_found");
  if (receipt.routeEvidenceReviewed !== true) blockers.push("route_evidence_not_reviewed");
  if (receipt.selectedTargetReviewed !== true) blockers.push("selected_target_not_reviewed");
  if (receipt.logicContractReviewed !== true) blockers.push("logic_contract_not_reviewed");
}
if (decision === "correction_to_senior_compile" && !String(receipt.teacherCorrection || "").trim()) {
  blockers.push("senior_compile_correction_missing");
}

const forbiddenDecisionUsed = forbiddenDecisions.has(decision);
const readyForDryRunRouteReview = decision === "teacher_reviewed_route_ready_for_dry_run" && blockers.length === 0;
const escalateToSeniorCompile = decision === "correction_to_senior_compile" && !forbiddenDecisionUsed;
const status = forbiddenDecisionUsed
  ? "blocked_for_forbidden_decision"
  : readyForDryRunRouteReview
    ? "ready_for_separate_dry_run_route_review"
    : escalateToSeniorCompile
      ? "escalate_to_senior_compile"
      : "needs_teacher_review_or_more_route_evidence";
const validationId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug(goal)}`;
const validationDir = join(outRoot, validationId);
const validationPath = join(validationDir, "tlcl-medium-runtime-dry-run-prep-review-validation.json");
const receiptPath = join(validationDir, "tlcl-medium-runtime-dry-run-prep-review-validation-receipt.json");
const readmePath = join(validationDir, "TLCL_MEDIUM_RUNTIME_DRY_RUN_PREP_REVIEW_VALIDATION_START_HERE.md");
const nextDryRunRouteReview = readyForDryRunRouteReview
  ? {
      routeIndex: selectedRoute.index,
      adapterId: selectedRoute.adapterId,
      dryRunHandoff: selectedRoute.dryRunHandoff,
      executesNow: false,
      blockedUntil: "separate dry-run route review command is teacher-confirmed"
    }
  : null;
const validation = {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_validation_v1",
  validationId,
  createdAt: new Date().toISOString(),
  goal,
  status,
  decision,
  readyForDryRunRouteReview,
  escalateToSeniorCompile,
  forbiddenDecisionUsed,
  blockers,
  selectedRouteIndex: Number(receipt.selectedRouteIndex || 0),
  nextDryRunRouteReview,
  seniorCompileEscalation: escalateToSeniorCompile
    ? {
        escalates_to: "senior_reasoning_compile",
        teacherCorrection: receipt.teacherCorrection || "",
        repairTasks: [
          "Repair the TLCL contract, route evidence, or target/logic interpretation from the teacher correction.",
          "Rerun TLCL status refresh, deterministic validation, runtime gate, medium dry-run prep, and this receipt validation."
        ]
      }
    : null,
  blockedTransitions: [
    "run_dry_run_from_validation",
    "execute_target_software_from_validation",
    "send_ui_events_from_validation",
    "enable_rule_from_validation",
    "write_memory_from_validation",
    "unlock_packaging_from_validation",
    "claim_completion_from_validation"
  ],
  paths: {
    validation: validationPath,
    receipt: receiptPath,
    readme: readmePath,
    sourcePrep: prepInput.path,
    sourceReceipt: receiptInput.path
  },
  locks: locks()
};
const validationReceipt = {
  format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_validation_receipt_v1",
  validationId,
  status,
  decision,
  readyForDryRunRouteReview,
  escalateToSeniorCompile,
  forbiddenDecisionUsed,
  blockers,
  dryRunExecuted: false,
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
    "# TLCL Medium Runtime Dry-Run Prep Review Validation",
    "",
    `Status: ${status}`,
    `Decision: ${decision}`,
    "",
    "This validation only checks the teacher receipt. It does not run dry-runs, execute target software, send UI events, enable rules, write memory, unlock packaging, or claim completion.",
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
      format: "transparent_ai_tlcl_medium_runtime_dry_run_prep_review_validation_result_v1",
      validationId,
      status,
      decision,
      readyForDryRunRouteReview,
      escalateToSeniorCompile,
      forbiddenDecisionUsed,
      blockers,
      validationPath,
      receiptPath,
      readmePath,
      dryRunExecuted: false,
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
