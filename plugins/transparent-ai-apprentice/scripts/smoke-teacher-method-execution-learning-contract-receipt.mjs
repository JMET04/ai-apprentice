#!/usr/bin/env node
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runJson(args, expectOk = true) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 180000 });
  if (expectOk && result.status !== 0) {
    throw new Error(`command failed\nargs=${args.join(" ")}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`command unexpectedly passed\nargs=${args.join(" ")}\nstdout=${result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

const root = mkdtempSync(join(tmpdir(), "ta-teacher-method-contract-receipt-"));
const rollbackPoint = join(root, "rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-teacher-method-contract-receipt",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const profileResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-teacher-learning-method-profile.mjs",
  "--goal",
  "Adapt to teacher method across all local software with low-token evidence and transparent sketch confirmation.",
  "--software",
  "arbitrary desktop software",
  "--teacher-message",
  "I teach by drawing first, then I correct the logic. Watch logs cheaply, ask fewer questions, and do not execute until I confirm a numbered target.",
  "--teacher-style",
  "transparent overlay sketch, spatial intent review, log deltas, correction-first, ask less",
  "--evidence-preference",
  "log metadata first",
  "--preferred-tool",
  "transparent drawing overlay",
  "--output-dir",
  join(root, "profile")
]);

const lowTokenHandoffPath = join(root, "low-token-handoff.json");
writeJson(lowTokenHandoffPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_compact_evidence_learning_handoff_v1",
  status: "waiting_for_teacher_learning_event_review",
  counts: { compactLearningEvents: 1 },
  locks: {
    reviewOnly: true,
    fullLogsRead: false,
    screenshotsCaptured: false,
    targetSoftwareCommandsExecuted: false,
    memoryWritten: false,
    goalComplete: false
  }
});

const contractResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-teacher-method-execution-learning-contract.mjs",
  "--profile",
  profileResult.profilePath,
  "--low-token-learning-handoff",
  lowTokenHandoffPath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed-method",
  "--output-dir",
  join(root, "contract")
]);
const contract = readJson(contractResult.contractPath);

const builderResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/create-teacher-method-execution-learning-contract-receipt-builder.mjs",
  "--contract",
  contractResult.contractPath,
  "--output-dir",
  join(root, "builder")
]);
const builder = readJson(builderResult.builderPath);
const receipt = readJson(builderResult.receiptTemplatePath);
assert(builder.format === "transparent_ai_teacher_method_execution_learning_contract_receipt_builder_v1", "bad builder format");
assert(receipt.format === "transparent_ai_teacher_method_execution_learning_contract_receipt_v1", "bad receipt format");
assert(receipt.routeRows.length === contract.routeContracts.length, "receipt rows should match route contracts");
assert(builder.nextValidationCommand.includes("validate-teacher-method-execution-learning-contract-receipt.mjs"), "validation command missing");
assert(builder.locks.builderDoesNotRunCommands === true, "builder command lock missing");
assert(builder.locks.goalComplete === false, "builder completion lock missing");

receipt.teacherDecision = "teacher_method_contract_confirmed";
receipt.teacherConfirmationText = "I reviewed every route; this matches how I want to teach.";
receipt.rollbackPointRetained = true;
for (const row of receipt.routeRows) {
  row.teacherReviewed = true;
  row.matchesTeacherMethod = true;
  row.boundaryExample = `Boundary for ${row.routeId}`;
}
const confirmedReceiptPath = join(root, "confirmed-teacher-method-contract-receipt.json");
writeJson(confirmedReceiptPath, receipt);
const confirmedValidationResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-teacher-method-execution-learning-contract-receipt.mjs",
  "--contract",
  contractResult.contractPath,
  "--receipt",
  confirmedReceiptPath,
  "--output-dir",
  join(root, "validation")
]);
const confirmedValidation = readJson(confirmedValidationResult.validationPath);
assert(
  confirmedValidation.status === "teacher_method_contract_confirmed_waiting_for_reuse_result_proof",
  "confirmed receipt should wait for reuse proof"
);
assert(confirmedValidation.readyForReuseResultProof === true, "ready for reuse proof missing");
assert(confirmedValidation.completionBoundary.completionAllowed === false, "completion boundary must remain closed");
assert(confirmedValidation.locks.validationDoesNotExecuteTargetSoftware === true, "execution lock missing");
assert(confirmedValidation.locks.validationDoesNotWriteMemory === true, "memory lock missing");
assert(confirmedValidation.locks.goalComplete === false, "goal completion lock missing");

const incompleteReceipt = readJson(builderResult.receiptTemplatePath);
incompleteReceipt.teacherDecision = "teacher_method_contract_confirmed";
incompleteReceipt.teacherConfirmationText = "I only reviewed one row.";
incompleteReceipt.rollbackPointRetained = true;
incompleteReceipt.routeRows[0].teacherReviewed = true;
incompleteReceipt.routeRows[0].matchesTeacherMethod = true;
const incompleteReceiptPath = join(root, "incomplete-teacher-method-contract-receipt.json");
writeJson(incompleteReceiptPath, incompleteReceipt);
const incompleteResult = runJson([
  "plugins/transparent-ai-apprentice/scripts/validate-teacher-method-execution-learning-contract-receipt.mjs",
  "--contract",
  contractResult.contractPath,
  "--receipt",
  incompleteReceiptPath,
  "--output-dir",
  join(root, "incomplete-validation")
]);
const incompleteValidation = readJson(incompleteResult.validationPath);
assert(
  incompleteValidation.status === "teacher_method_contract_receipt_needs_teacher_review",
  "incomplete rows should stay in teacher review"
);
assert(incompleteValidation.readyForReuseResultProof === false, "incomplete receipt must not be ready");
assert(incompleteValidation.blockers.some((blocker) => blocker.startsWith("route_not_teacher_reviewed:")), "missing row blocker expected");

const forbiddenReceipt = readJson(confirmedReceiptPath);
forbiddenReceipt.teacherDecision = "accepted";
const forbiddenReceiptPath = join(root, "forbidden-teacher-method-contract-receipt.json");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenResult = runJson(
  [
    "plugins/transparent-ai-apprentice/scripts/validate-teacher-method-execution-learning-contract-receipt.mjs",
    "--contract",
    contractResult.contractPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(root, "forbidden-validation")
  ],
  false
);
assert(forbiddenResult.status === "blocked_for_forbidden_teacher_method_decision", "forbidden decision should fail closed");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_teacher_method_execution_learning_contract_receipt_smoke_v1",
      builder: builderResult.builderPath,
      receiptTemplate: builderResult.receiptTemplatePath,
      confirmedValidation: confirmedValidationResult.validationPath,
      incompleteValidation: incompleteResult.validationPath,
      forbiddenDecisionBlocked: true,
      readyForReuseResultProof: confirmedValidation.readyForReuseResultProof,
      locks: confirmedValidation.locks
    },
    null,
    2
  )
);
