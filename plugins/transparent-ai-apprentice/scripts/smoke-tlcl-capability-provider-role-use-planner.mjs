#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-capability-provider-role-use-planner-smoke",
  String(Date.now())
);

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

const statusRefresh = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-capability-provider-role-use-planner",
  "--out-dir",
  smokeRoot
]);
const intake = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "role-use-medium-runtime",
  "--provider-kind",
  "strong_foundation_model",
  "--requested-role",
  "medium_reasoning_runtime",
  "--capability-summary",
  "Runs bounded TLCL medium-runtime reasoning after role and runtime gates.",
  "--source-ref",
  "smoke-role-use-provider-card",
  "--out-dir",
  smokeRoot
]);
const plan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  intake.intakePath,
  "--teacher-reviewed-candidate",
  "--teacher-review-note",
  "Teacher keeps this medium runtime candidate for role-use planner smoke.",
  "--out-dir",
  smokeRoot
]);
const run = runNode("scripts/run-tlcl-capability-provider-qualification-no-action-runner.mjs", [
  "--plan",
  plan.planPath,
  "--teacher-reviewed-test-plan",
  "--teacher-review-note",
  "Teacher reviewed the qualification plan for role-use planner smoke.",
  "--out-dir",
  smokeRoot
]);
const resultTemplate = readJson(run.resultTemplatePath);
const matchedReceiptPath = writeJson(join(smokeRoot, "matched-result-receipt.json"), {
  ...resultTemplate,
  overallDecision: "ready_for_validator_review",
  rows: resultTemplate.rows.map((row) => ({
    ...row,
    observedEvidencePath: `role-use-evidence/${row.rowId}.json`,
    observedSummary: "Verifier observed expected result for role-use planner.",
    resultStatus: "matched_expected",
    teacherOrVerifierNote: "Result is ready for separate role-use planning only."
  }))
});
const resultValidation = runNode("scripts/validate-tlcl-capability-provider-qualification-result-receipt.mjs", [
  "--run",
  run.runPath,
  "--receipt",
  matchedReceiptPath,
  "--out-dir",
  smokeRoot
]);
const candidate = runNode("scripts/create-tlcl-capability-provider-activation-review-candidate-builder.mjs", [
  "--validation",
  resultValidation.validationPath,
  "--out-dir",
  smokeRoot
]);
const activationTemplate = readJson(candidate.receiptTemplatePath);
const approvedReceiptPath = writeJson(join(smokeRoot, "provider-activation-approved-receipt.json"), {
  ...activationTemplate,
  teacherDecision: "approve_provider_for_tlcl_role",
  providerReviewed: true,
  qualificationEvidenceReviewed: true,
  roleBoundaryReviewed: true,
  deterministicValidatorsStillRequiredConfirmed: true,
  runtimeGateStillRequiredConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedProviderForTlclRole: true,
  blockedActionsConfirmed: true,
  teacherNote: "Teacher approves only role-scoped provider card issuance."
});
const correctionReceiptPath = writeJson(join(smokeRoot, "provider-activation-correction-receipt.json"), {
  ...activationTemplate,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherCorrection: "Provider role is too broad for runtime planning.",
  blockedActionsConfirmed: true
});
const approvedActivation = runNode("scripts/validate-tlcl-capability-provider-activation-review-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  approvedReceiptPath,
  "--out-dir",
  smokeRoot
]);
const correctionActivation = runNode("scripts/validate-tlcl-capability-provider-activation-review-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  smokeRoot
]);

const roleUse = runNode("scripts/create-tlcl-capability-provider-role-use-planner.mjs", [
  "--activation-validation",
  approvedActivation.validationPath,
  "--status-refresh",
  statusRefresh.refreshPath,
  "--requested-role",
  "medium_reasoning_runtime",
  "--use-intent",
  "prepare medium runtime provider for the next TLCL runtime gate",
  "--out-dir",
  smokeRoot
]);
const roleUsePacket = readJson(roleUse.planPath);
const roleMismatch = runNode("scripts/create-tlcl-capability-provider-role-use-planner.mjs", [
  "--activation-validation",
  approvedActivation.validationPath,
  "--status-refresh",
  statusRefresh.refreshPath,
  "--requested-role",
  "senior_reasoning_compile",
  "--out-dir",
  smokeRoot
]);
const blockedUnapproved = runNode("scripts/create-tlcl-capability-provider-role-use-planner.mjs", [
  "--activation-validation",
  correctionActivation.validationPath,
  "--status-refresh",
  statusRefresh.refreshPath,
  "--requested-role",
  "medium_reasoning_runtime",
  "--out-dir",
  smokeRoot
]);
const missingStatus = runNode("scripts/create-tlcl-capability-provider-role-use-planner.mjs", [
  "--activation-validation",
  approvedActivation.validationPath,
  "--requested-role",
  "medium_reasoning_runtime",
  "--out-dir",
  smokeRoot
]);
const invalidSource = runNode("scripts/create-tlcl-capability-provider-role-use-planner.mjs", [
  "--activation-validation",
  run.runPath,
  "--status-refresh",
  statusRefresh.refreshPath,
  "--requested-role",
  "medium_reasoning_runtime",
  "--out-dir",
  smokeRoot
]);

const checks = [
  check(
    "Approved provider card becomes only a role-use plan for the next TLCL runtime gate",
    roleUse.status === "tlcl_capability_provider_role_use_ready_for_runtime_gate" &&
      roleUse.providerRoleUseAllowed === true &&
      roleUse.nextGate === "tlcl_runtime_gate_before_medium_runtime" &&
      roleUse.targetSoftwareCommandsExecuted === false &&
      roleUse.memoryWritten === false &&
      roleUse.accepted === false &&
      roleUse.packagingUnlocked === false &&
      roleUsePacket.locks?.providerMayExecuteTargetSoftware === false &&
      roleUsePacket.requiredBeforeUse?.includes("teacher correction must return to senior reasoning compile repair"),
    roleUse.planPath
  ),
  check(
    "Requested role mismatch is blocked and routed to high reasoning repair",
    roleMismatch.status === "tlcl_capability_provider_role_use_blocked_role_mismatch" &&
      roleMismatch.providerRoleUseAllowed === false &&
      roleMismatch.blockers.includes("requested_role_does_not_match_provider_card_role") &&
      readJson(roleMismatch.planPath).highReasoningRepairHandoff?.transition ===
        "provider_role_use_mismatch_to_high_reasoning_repair",
    roleMismatch.planPath
  ),
  check(
    "Unapproved activation validation cannot become a role-use plan",
    blockedUnapproved.status === "blocked_before_tlcl_capability_provider_role_use_plan" &&
      blockedUnapproved.providerRoleUseAllowed === false &&
      blockedUnapproved.blockers.includes("activation_validation_not_role_approved"),
    blockedUnapproved.planPath
  ),
  check(
    "Missing TLCL status refresh blocks role-use planning",
    missingStatus.status === "blocked_before_tlcl_capability_provider_role_use_plan" &&
      missingStatus.providerRoleUseAllowed === false &&
      missingStatus.blockers.includes("missing_status_refresh"),
    missingStatus.planPath
  ),
  check(
    "Invalid activation source fails closed before provider role use",
    invalidSource.status === "blocked_before_tlcl_capability_provider_role_use_plan" &&
      invalidSource.providerRoleUseAllowed === false &&
      invalidSource.blockers.includes("invalid_activation_validation_format"),
    invalidSource.planPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_capability_provider_role_use_planner_smoke_v1",
  smokeRoot,
  roleUsePlanPath: roleUse.planPath,
  roleMismatchPlanPath: roleMismatch.planPath,
  blockedUnapprovedPlanPath: blockedUnapproved.planPath,
  missingStatusPlanPath: missingStatus.planPath,
  invalidSourcePlanPath: invalidSource.planPath,
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
