#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(repoRoot, ".transparent-apprentice", "tlcl-medium-runtime-approved-gate-outcome-review-smoke", String(Date.now()));
mkdirSync(smokeRoot, { recursive: true });

function runNode(script, args = [], expectFailure = false) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (!expectFailure && result.status !== 0) throw new Error(`${script} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  if (expectFailure && result.status === 0) throw new Error(`${script} should have failed`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : { status: result.status, stderr: result.stderr };
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

const providerRoleUsePlanTrace = {
  inheritedFromPrep: true,
  requiredForScopedProvider: true,
  accepted: false,
  providerRole: "medium_reasoning_runtime",
  providerRoleUsePlanPath: join(smokeRoot, "tlcl-provider-role-use-plan.json"),
  providerRoleUsePlanHash: "sha256:approved-outcome-provider-role-use-plan-smoke",
  nextGateSatisfied: true
};

const existingReceiptPath = writeJson(join(smokeRoot, "existing-runner-receipt.json"), {
  format: "transparent_ai_all_software_execution_approved_gate_runner_receipt_v1",
  status: "approved_gate_controlled_route_completed_waiting_for_teacher_review"
});
const adapterReceiptPath = writeJson(join(smokeRoot, "adapter-receipt.json"), {
  format: "transparent_ai_existing_software_execution_receipt_v1",
  status: "teacher_confirmed_cli_script_executed",
  commandExecuted: true
});
const outcomeVerificationPath = writeJson(join(smokeRoot, "outcome-verification.json"), {
  format: "transparent_ai_supervised_action_outcome_verification_v1",
  status: "waiting_for_supervised_outcome_review"
});
const checkpointPath = writeJson(join(smokeRoot, "post-action-checkpoint.json"), {
  format: "transparent_ai_post_action_evidence_checkpoint_v1",
  status: "checkpoint_waiting_for_teacher_review"
});
const runPath = writeJson(join(smokeRoot, "tlcl-approved-gate-runner.json"), {
  ok: true,
  format: "transparent_ai_tlcl_medium_runtime_approved_gate_runner_v1",
  runId: "tlcl-approved-outcome-review-smoke-run",
  status: "tlcl_approved_gate_controlled_route_completed_waiting_for_teacher_review",
  runnerInvoked: true,
  controlledRouteActionExecuted: true,
  targetSoftwareCommandsExecuted: true,
  uiEventsSent: false,
  sourceEvidence: {
    providerRoleUsePlanTrace
  },
  generatedEvidence: {
    existingRunnerReceiptPath: existingReceiptPath,
    adapterReceiptPath,
    outcomeVerificationPath,
    postActionCheckpointPath: checkpointPath
  },
  locks: {
    accepted: false,
    ruleEnabled: false,
    packagingGated: true,
    nativeUniversalExecution: false,
    allSoftwareExecutionComplete: false,
    goalComplete: false
  }
});

const builder = runNode("scripts/create-tlcl-medium-runtime-approved-gate-outcome-review-receipt-builder.mjs", [
  "--run",
  runPath,
  "--out-dir",
  join(smokeRoot, "builder")
]);
const template = readJson(builder.receiptTemplatePath);
const matchedReceiptPath = writeJson(join(smokeRoot, "matched-receipt.json"), {
  ...template,
  teacherDecision: "executed_route_matched_contract",
  runnerPacketReviewed: true,
  existingRunnerReceiptReviewed: true,
  adapterReceiptReviewed: true,
  outcomeVerificationReviewed: true,
  postActionCheckpointReviewed: true,
  rollbackPointStillRetained: true,
  teacherMatchedContract: true,
  blockedActionsConfirmed: true,
  teacherNote: "The executed controlled route matched the TLCL contract."
});
const correctionReceiptPath = writeJson(join(smokeRoot, "correction-receipt.json"), {
  ...template,
  teacherDecision: "correction_to_high_reasoning_repair",
  blockedActionsConfirmed: true,
  teacherCorrection: "The command used the wrong parameter binding for the target edge.",
  observedIssue: "Parameter binding mismatch.",
  affectedLogicFields: ["route.commandTemplate", "rule.parameterBinding"]
});
const mismatchReceiptPath = writeJson(join(smokeRoot, "mismatch-receipt.json"), {
  ...template,
  teacherDecision: "executed_route_mismatch_blocked",
  blockedActionsConfirmed: true,
  observedIssue: "Output did not match teacher intent."
});
const forbiddenReceiptPath = writeJson(join(smokeRoot, "forbidden-receipt.json"), {
  ...template,
  teacherDecision: "write_memory",
  blockedActionsConfirmed: true
});

const matchedValidation = runNode("scripts/validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  runPath,
  "--receipt",
  matchedReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const correctionValidation = runNode("scripts/validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  runPath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const mismatchValidation = runNode("scripts/validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  runPath,
  "--receipt",
  mismatchReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);
const forbiddenValidation = runNode("scripts/validate-tlcl-medium-runtime-approved-gate-outcome-review-receipt.mjs", [
  "--run",
  runPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(smokeRoot, "validation")
]);

const correctionPacket = readJson(correctionValidation.validationPath);
const matchedPacket = readJson(matchedValidation.validationPath);
const checks = [
  check(
    "TLCL approved outcome review builder creates teacher receipt without running another approved gate",
    builder.format === "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_builder_result_v1" &&
      builder.doesNotRunApprovedGate === true &&
      builder.memoryWritten === false &&
      builder.ruleEnabled === false &&
      builder.goalComplete === false,
    builder.builderPath
  ),
  check(
    "Matched approved outcome stays review-only before rule activation",
    matchedValidation.status === "execution_outcome_matched_contract_waiting_for_rule_activation_review" &&
      matchedValidation.outcomeMatchedContract === true &&
      matchedValidation.memoryWritten === false &&
      matchedValidation.ruleEnabled === false &&
      matchedValidation.goalComplete === false,
    matchedValidation.validationPath
  ),
  check(
    "Teacher correction from approved outcome escalates back to high reasoning repair",
    correctionValidation.status === "escalate_to_high_reasoning_repair" &&
      correctionValidation.escalateToHighReasoningRepair === true &&
      correctionPacket.highReasoningRepairHandoff?.runtimeTransition ===
        "medium_runtime_execution_result_to_high_reasoning_contract_repair" &&
      correctionValidation.memoryWritten === false,
    correctionValidation.validationPath
  ),
  check(
    "Mismatch approved outcome blocks medium runtime continuation",
    mismatchValidation.status === "escalate_to_high_reasoning_repair" &&
      mismatchValidation.mismatchBlocked === true &&
      mismatchValidation.ruleEnabled === false,
    mismatchValidation.validationPath
  ),
  check(
    "Forbidden approved outcome review decisions are fail-closed",
    forbiddenValidation.status === "blocked_for_forbidden_decision" &&
      forbiddenValidation.forbiddenDecisionUsed === true &&
      forbiddenValidation.targetSoftwareCommandsExecuted === false &&
      forbiddenValidation.memoryWritten === false,
    forbiddenValidation.validationPath
  ),
  check(
    "Approved outcome review preserves provider role-use trace for reuse or high-reasoning repair",
    matchedPacket.sourceEvidence.providerRoleUsePlanTrace.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      matchedPacket.matchedContractHandoff.providerRoleUsePlanTrace.providerRoleUsePlanHash === providerRoleUsePlanTrace.providerRoleUsePlanHash &&
      correctionPacket.highReasoningRepairHandoff.providerRoleUsePlanTrace.providerRoleUsePlanHash ===
        providerRoleUsePlanTrace.providerRoleUsePlanHash,
    matchedValidation.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_medium_runtime_approved_gate_outcome_review_receipt_smoke_v1",
  passed,
  total: checks.length,
  smokeRoot,
  builderPath: builder.builderPath,
  matchedValidationPath: matchedValidation.validationPath,
  correctionValidationPath: correctionValidation.validationPath,
  mismatchValidationPath: mismatchValidation.validationPath,
  checks
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
