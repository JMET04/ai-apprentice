#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-capability-provider-activation-review-smoke",
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
  "smoke-tlcl-capability-provider-activation-review",
  "--out-dir",
  smokeRoot
]);
const intake = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "activation-review-medium-runtime",
  "--provider-kind",
  "strong_foundation_model",
  "--requested-role",
  "medium_reasoning_runtime",
  "--capability-summary",
  "Runs bounded TLCL medium-runtime reasoning after gates.",
  "--source-ref",
  "smoke-provider-card",
  "--out-dir",
  smokeRoot
]);
const plan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  intake.intakePath,
  "--teacher-reviewed-candidate",
  "--teacher-review-note",
  "Teacher keeps this medium runtime candidate for activation review smoke.",
  "--out-dir",
  smokeRoot
]);
const run = runNode("scripts/run-tlcl-capability-provider-qualification-no-action-runner.mjs", [
  "--plan",
  plan.planPath,
  "--teacher-reviewed-test-plan",
  "--teacher-review-note",
  "Teacher reviewed the qualification plan for activation review smoke.",
  "--out-dir",
  smokeRoot
]);
const resultTemplate = readJson(run.resultTemplatePath);
const matchedReceiptPath = writeJson(join(smokeRoot, "matched-result-receipt.json"), {
  ...resultTemplate,
  overallDecision: "ready_for_validator_review",
  rows: resultTemplate.rows.map((row) => ({
    ...row,
    observedEvidencePath: `activation-evidence/${row.rowId}.json`,
    observedSummary: "Verifier observed expected result for activation review.",
    resultStatus: "matched_expected",
    teacherOrVerifierNote: "Result is ready for separate activation review only."
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
const template = readJson(candidate.receiptTemplatePath);
const approvedReceiptPath = writeJson(join(smokeRoot, "provider-activation-approved-receipt.json"), {
  ...template,
  teacherDecision: "approve_provider_for_tlcl_role",
  providerReviewed: true,
  qualificationEvidenceReviewed: true,
  roleBoundaryReviewed: true,
  deterministicValidatorsStillRequiredConfirmed: true,
  runtimeGateStillRequiredConfirmed: true,
  rollbackPointStillRetained: true,
  teacherApprovedProviderForTlclRole: true,
  blockedActionsConfirmed: true
});
const correctionReceiptPath = writeJson(join(smokeRoot, "provider-activation-correction-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  teacherCorrection: "Provider role boundary must be narrowed before use.",
  blockedActionsConfirmed: true
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "provider-activation-forbidden-receipt.json"), {
  ...template,
  teacherDecision: "execute_target_software",
  blockedActionsConfirmed: true
});

const approved = runNode("scripts/validate-tlcl-capability-provider-activation-review-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  approvedReceiptPath,
  "--out-dir",
  smokeRoot
]);
const approvedPacket = readJson(approved.validationPath);
const correction = runNode("scripts/validate-tlcl-capability-provider-activation-review-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  smokeRoot
]);
const correctionPacket = readJson(correction.validationPath);
const forbidden = runNode("scripts/validate-tlcl-capability-provider-activation-review-receipt.mjs", [
  "--candidate",
  candidate.candidatePath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  smokeRoot
]);

const blockedSource = runNode("scripts/create-tlcl-capability-provider-activation-review-candidate-builder.mjs", [
  "--validation",
  run.runPath,
  "--out-dir",
  smokeRoot
]);

const checks = [
  check(
    "Result validation becomes activation review candidate only after all rows match",
    candidate.status === "tlcl_capability_provider_activation_review_candidate_ready_for_teacher_approval" &&
      candidate.providerEnabledForTlclRole === false &&
      candidate.targetSoftwareCommandsExecuted === false &&
      candidate.memoryWritten === false,
    candidate.candidatePath
  ),
  check(
    "Teacher activation approval issues only a TLCL role-scoped provider card",
    approved.status === "tlcl_capability_provider_role_approved_waiting_for_gated_use" &&
      approved.providerEnabledForTlclRole === true &&
      approved.providerCapabilityCardIssued === true &&
      approved.targetSoftwareCommandsExecuted === false &&
      approved.memoryWritten === false &&
      approved.accepted === false &&
      approvedPacket.providerCapabilityCard?.stillRequires?.includes("runtime gate before medium-runtime work") &&
      approvedPacket.providerCapabilityCard?.forbiddenUse?.includes("contract bypass"),
    approved.validationPath
  ),
  check(
    "Teacher correction routes provider activation back to high reasoning repair",
    correction.status === "tlcl_capability_provider_activation_review_escalate_to_high_reasoning_repair" &&
      correction.escalateToHighReasoningRepair === true &&
      correctionPacket.highReasoningRepairHandoff?.transition === "provider_activation_review_to_high_reasoning_repair",
    correction.validationPath
  ),
  check(
    "Forbidden provider activation decision fails closed",
    forbidden.status === "blocked_before_tlcl_capability_provider_activation_review" &&
      forbidden.forbiddenDecisionUsed === true &&
      forbidden.targetSoftwareCommandsExecuted === false &&
      forbidden.memoryWritten === false &&
      forbidden.packagingUnlocked === false,
    forbidden.validationPath
  ),
  check(
    "Activation candidate builder rejects non-result-validation source",
    blockedSource.status === "blocked_before_tlcl_capability_provider_activation_review_candidate" &&
      blockedSource.blockers.includes("invalid_qualification_result_validation_format") &&
      blockedSource.providerEnabledForTlclRole === false,
    blockedSource.candidatePath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_capability_provider_activation_review_smoke_v1",
  smokeRoot,
  candidatePath: candidate.candidatePath,
  approvedValidationPath: approved.validationPath,
  correctionValidationPath: correction.validationPath,
  forbiddenValidationPath: forbidden.validationPath,
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
