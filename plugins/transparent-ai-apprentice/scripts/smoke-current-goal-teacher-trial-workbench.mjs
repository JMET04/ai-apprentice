#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(tmpdir(), "transparent-ai-apprentice-smoke", "current-goal-teacher-trial-workbench", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNodeScript(scriptName, args = []) {
  const result = spawnSync(process.execPath, [join(pluginRoot, "scripts", scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 180000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${scriptName} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const result = runNodeScript("create-current-goal-teacher-trial-workbench.mjs", [
  "--goal",
  "Smoke teacher trial workbench for all-software low-token learning, transparent overlay drawing, teacher method review, spatial 2D 3D depth, and execution gate prep.",
  "--output-dir",
  smokeRoot
]);
const workbench = readJson(result.workbenchPath);
const receiptTemplate = readJson(result.receiptTemplatePath);
const receiptBuilderHtml = readFileSync(workbench.paths.receiptBuilderHtml, "utf8");

const routeReceipt = {
  ...receiptTemplate,
  teacherDecision: "ready_for_low_token_route_selection",
  selectedSoftware: "Smoke software",
  selectedLowTokenRouteId: "existing_low_token_coverage_review",
  teacherNotes: "Route selected for manual validation only."
};
const routeReceiptPath = join(smokeRoot, "route-receipt.json");
writeJson(routeReceiptPath, routeReceipt);
const routeValidationResult = runNodeScript("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
  "--workbench",
  result.workbenchPath,
  "--receipt",
  routeReceiptPath,
  "--output-dir",
  join(smokeRoot, "validations")
]);
const routeValidation = readJson(routeValidationResult.validationPath);

const forbiddenReceipt = {
  ...receiptTemplate,
  teacherDecision: "accepted",
  locks: { ...receiptTemplate.locks, goalComplete: true, softwareActionsExecuted: true }
};
const forbiddenReceiptPath = join(smokeRoot, "forbidden-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenValidationResult = runNodeScript("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
  "--workbench",
  result.workbenchPath,
  "--receipt",
  forbiddenReceiptPath,
  "--output-dir",
  join(smokeRoot, "validations")
]);
const forbiddenValidation = readJson(forbiddenValidationResult.validationPath);

const dummyEvidenceDir = join(smokeRoot, "dummy-reviewed-evidence");
mkdirSync(dummyEvidenceDir, { recursive: true });
const evidenceFiles = [
  "low-token-route-validation.json",
  "overlay-packet-validation.json",
  "spatial-intent-validation.json",
  "teacher-method-contract.json"
].map((name) => {
  const path = join(dummyEvidenceDir, name);
  writeJson(path, { smoke: true, name });
  return path;
});
const executionReceipt = {
  ...receiptTemplate,
  teacherDecision: "ready_for_execution_gate_prep",
  selectedSoftware: "Smoke software",
  selectedLowTokenRouteId: "existing_low_token_coverage_review",
  validatedLowTokenRouteReceiptPath: evidenceFiles[0],
  teacherOverlayPacketValidationPath: evidenceFiles[1],
  teacherReviewedSpatialIntentPath: evidenceFiles[2],
  teacherMethodContractPath: evidenceFiles[3],
  confirmedRollbackPoint: "retained-smoke-rollback-point",
  teacherNotes: "All reviewed evidence is dummy smoke evidence; validator should only route a manual command."
};
const executionReceiptPath = join(smokeRoot, "execution-receipt.json");
writeJson(executionReceiptPath, executionReceipt);
const executionValidationResult = runNodeScript("validate-current-goal-teacher-trial-workbench-receipt.mjs", [
  "--workbench",
  result.workbenchPath,
  "--receipt",
  executionReceiptPath,
  "--output-dir",
  join(smokeRoot, "validations")
]);
const executionValidation = readJson(executionValidationResult.validationPath);

const phaseIds = new Set(workbench.trialPhases.map((phase) => phase.id));
const expectedPhases = [
  "review_integrated_evidence_gate",
  "select_low_token_route",
  "draw_transparent_overlay_packet",
  "review_spatial_intent_and_depth",
  "review_teacher_method_profile",
  "prepare_logic_contract_and_reasoning_gate",
  "prepare_execution_approval_gate",
  "validate_teacher_trial_receipt"
];

const checks = [
  {
    name: "Workbench writes JSON HTML README receipt template and receipt builder",
    pass:
      workbench.format === "transparent_ai_current_goal_teacher_trial_workbench_v1" &&
      existsSync(workbench.paths.workbench) &&
      existsSync(workbench.paths.html) &&
      existsSync(workbench.paths.readme) &&
      existsSync(workbench.paths.receiptTemplate) &&
      existsSync(workbench.paths.receiptBuilderHtml) &&
      receiptTemplate.format === "transparent_ai_current_goal_teacher_trial_workbench_receipt_v1",
    evidence: workbench.paths
  },
  {
    name: "Receipt builder exposes teacher decisions and JSON download without execution controls",
    pass:
      receiptBuilderHtml.includes("Teacher Trial Receipt Builder") &&
      receiptBuilderHtml.includes("ready_for_low_token_route_selection") &&
      receiptBuilderHtml.includes("ready_for_overlay_packet_validation") &&
      receiptBuilderHtml.includes("ready_for_method_contract_review") &&
      receiptBuilderHtml.includes("ready_for_execution_gate_prep") &&
      receiptBuilderHtml.includes("Download Receipt JSON") &&
      receiptBuilderHtml.includes("softwareActionsExecuted: false") &&
      receiptBuilderHtml.includes("goalComplete: false"),
    evidence: workbench.paths.receiptBuilderHtml
  },
  {
    name: "Workbench provides one trial route across all current-goal evidence blockers",
    pass:
      expectedPhases.every((id) => phaseIds.has(id)) &&
      workbench.trialPhases.length >= expectedPhases.length &&
      workbench.sourceCompletionAudit?.completionProvenCount === 0,
    evidence: workbench.trialPhases.map((phase) => phase.id)
  },
  {
    name: "Receipt defaults stay non-accepting and support low-token overlay method execution-gate decisions",
    pass:
      receiptTemplate.teacherDecision === "needs_teacher_trial" &&
      receiptTemplate.allowedTeacherDecisions.includes("ready_for_low_token_route_selection") &&
      receiptTemplate.allowedTeacherDecisions.includes("ready_for_overlay_packet_validation") &&
      receiptTemplate.allowedTeacherDecisions.includes("ready_for_method_contract_review") &&
      receiptTemplate.allowedTeacherDecisions.includes("ready_for_execution_gate_prep") &&
      receiptTemplate.forbiddenDecisions.includes("accepted"),
    evidence: receiptTemplate.allowedTeacherDecisions
  },
  {
    name: "Low-token route receipt validates into a manual next command without running anything",
    pass:
      routeValidation.ok === true &&
      routeValidation.status === "ready_for_low_token_route_receipt_validation_manual_command" &&
      routeValidation.readyForNextManualCommand === true &&
      routeValidation.locks.validationDoesNotReadLogs === true &&
      routeValidation.locks.validationDoesNotExecuteTargetSoftware === true,
    evidence: routeValidation
  },
  {
    name: "Forbidden acceptance or execution claims fail closed",
    pass:
      forbiddenValidation.ok === false &&
      forbiddenValidation.status === "blocked_for_invalid_or_forbidden_teacher_trial_receipt" &&
      forbiddenValidation.reasons.includes("unsupported_teacher_decision:accepted") &&
      forbiddenValidation.reasons.includes("receipt_claims_software_execution") &&
      forbiddenValidation.reasons.includes("receipt_claims_goal_complete"),
    evidence: forbiddenValidation
  },
  {
    name: "Execution-gate receipt only routes a separate manual approval command",
    pass:
      executionValidation.ok === true &&
      executionValidation.status === "ready_for_separate_execution_approval_gate_manual_command" &&
      executionValidation.readyForNextManualCommand === true &&
      executionValidation.locks.validationDoesNotExecuteTargetSoftware === true &&
      executionValidation.locks.goalComplete === false,
    evidence: executionValidation
  },
  {
    name: "Workbench keeps all system-change locks closed",
    pass:
      workbench.locks.workbenchDoesNotReadLogs === true &&
      workbench.locks.workbenchDoesNotReadFullLogs === true &&
      workbench.locks.workbenchDoesNotCaptureScreenshots === true &&
      workbench.locks.workbenchDoesNotExecuteTargetSoftware === true &&
      workbench.locks.workbenchDoesNotWriteMemory === true &&
      workbench.locks.workbenchDoesNotEnableRules === true &&
      workbench.locks.goalComplete === false,
    evidence: workbench.locks
  }
];

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed, smokeRoot }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_current_goal_teacher_trial_workbench_smoke_v1",
      smokeRoot,
      checks,
      artifact: result.workbenchPath
    },
    null,
    2
  )
);
