#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

function runNode(repoRoot, args, expectSuccess = true) {
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8" });
  if (expectSuccess && result.status !== 0) throw new Error(result.stderr || result.stdout || "command failed");
  if (!expectSuccess && result.status === 0) throw new Error("command should have failed");
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.stdout.trim() ? JSON.parse(result.stdout) : null
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const root = mkdtempSync(join(tmpdir(), "ta-teacher-method-reuse-proof-"));
const contractPath = join(root, "teacher-method-contract.json");
const contractReceiptValidationPath = join(root, "contract-receipt-validation.json");
const previousEvidencePath = join(root, "previous-run-evidence.json");
const reuseEvidencePath = join(root, "reuse-run-evidence.json");
writeJson(contractPath, {
  format: "transparent_ai_teacher_method_execution_learning_contract_v1",
  contractId: "teacher-method-contract-smoke",
  goal: "Adapt to arbitrary teacher method with proof-based reuse.",
  status: "ready_for_teacher_method_execution_learning_contract_review",
  profilePath: join(root, "teacher-method-profile.json"),
  rollbackPoint: "rollback-smoke-retained",
  routeContracts: [
    {
      id: "method-first",
      teacherMode: "show-example-then-correct",
      summary: "Ask for the teacher's example, extract the logic, then reuse only after confirmation."
    }
  ],
  locks: {
    reviewOnly: true,
    goalComplete: false
  }
});
writeJson(contractReceiptValidationPath, {
  ok: true,
  format: "transparent_ai_teacher_method_execution_learning_contract_receipt_validation_v1",
  validationId: "contract-receipt-validation-smoke",
  status: "teacher_method_contract_confirmed_waiting_for_reuse_result_proof",
  readyForReuseResultProof: true,
  sourceEvidence: {
    contract: contractPath,
    receipt: join(root, "contract-receipt.json"),
    rollbackPoint: "rollback-smoke-retained"
  },
  locks: {
    reviewOnly: true,
    goalComplete: false
  }
});
writeJson(previousEvidencePath, {
  format: "teacher_method_previous_run_evidence_smoke_v1",
  issue: "The assistant asked for too much context and missed the teacher's correction style."
});
writeJson(reuseEvidencePath, {
  format: "teacher_method_reuse_run_evidence_smoke_v1",
  improvement: "The assistant followed the teacher's example-first correction loop and reduced ambiguity."
});

const builderResult = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-teacher-method-reuse-result-proof-builder.mjs"),
  "--contract-receipt-validation",
  contractReceiptValidationPath,
  "--contract",
  contractPath,
  "--output-dir",
  join(root, "builder")
]).json;
const builder = readJson(builderResult.builderPath);
const receiptTemplate = readJson(builderResult.receiptTemplatePath);
assert(builder.format === "transparent_ai_teacher_method_reuse_result_proof_builder_v1", "bad builder format");
assert(builder.readyForTeacherReuseResultReceipt === true, "builder should be ready");
assert(receiptTemplate.format === "transparent_ai_teacher_method_reuse_result_proof_receipt_v1", "bad receipt template");
assert(receiptTemplate.teacherDecision === "needs_teacher_review", "default decision must wait for teacher");
assert(receiptTemplate.forbiddenTeacherDecisions.includes("accepted"), "accepted must be forbidden");
assert(builder.locks.builderDoesNotExecuteTargetSoftware === true, "builder execution lock missing");
assert(builder.locks.goalComplete === false, "builder completion lock missing");

const confirmedReceiptPath = join(root, "confirmed-reuse-result-receipt.json");
writeJson(confirmedReceiptPath, {
  ...receiptTemplate,
  teacherDecision: "teacher_reuse_result_confirmed",
  teacherReviewedBeforeAfter: true,
  teacherObservedImprovement: true,
  ambiguityReducedOrAccuracyImproved: true,
  previousRunEvidencePath: previousEvidencePath,
  reuseRunEvidencePath: reuseEvidencePath,
  improvementSummary: "The reuse run followed the teacher's preferred example-first correction loop and required fewer clarifying turns.",
  remainingMismatchOrCorrection: "",
  rollbackPointRetained: true,
  contractStillMatchesTeacherMethod: true,
  mediumRuntimeReuseScopeReviewed: true,
  highReasoningRepairRouteForFailures: true,
  ragEvidenceNonAuthoritativeConfirmed: true,
  teacherConfirmationText: "I reviewed the before/after result and this method improved the next run."
});
const confirmedResult = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "validate-teacher-method-reuse-result-proof-receipt.mjs"),
  "--contract-receipt-validation",
  contractReceiptValidationPath,
  "--contract",
  contractPath,
  "--receipt",
  confirmedReceiptPath,
  "--output-dir",
  join(root, "confirmed-validation")
]).json;
const confirmedValidation = readJson(confirmedResult.validationPath);
assert(
  confirmedValidation.status === "teacher_method_reuse_result_confirmed_ready_for_medium_runtime_reuse_gate",
  "confirmed reuse result should prepare medium runtime gate"
);
assert(confirmedValidation.readyForMediumRuntimeReuseGate === true, "medium reuse gate readiness missing");
assert(confirmedValidation.completionBoundary.completionAllowed === false, "full completion must stay closed");
assert(confirmedValidation.locks.validationDoesNotExecuteTargetSoftware === true, "validation execution lock missing");
assert(confirmedValidation.locks.validationDoesNotWriteMemory === true, "validation memory lock missing");
assert(confirmedValidation.locks.goalComplete === false, "goal completion lock missing");

const repairReceiptPath = join(root, "repair-reuse-result-receipt.json");
writeJson(repairReceiptPath, {
  ...receiptTemplate,
  teacherDecision: "teacher_reuse_result_needs_repair",
  previousRunEvidencePath: previousEvidencePath,
  reuseRunEvidencePath: reuseEvidencePath,
  remainingMismatchOrCorrection: "It improved the tone, but still reused the wrong boundary example.",
  highReasoningRepairRouteForFailures: true,
  ragEvidenceNonAuthoritativeConfirmed: true
});
const repairResult = runNode(repoRoot, [
  join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "validate-teacher-method-reuse-result-proof-receipt.mjs"),
  "--contract-receipt-validation",
  contractReceiptValidationPath,
  "--contract",
  contractPath,
  "--receipt",
  repairReceiptPath,
  "--output-dir",
  join(root, "repair-validation")
]).json;
const repairValidation = readJson(repairResult.validationPath);
assert(repairValidation.repairRequired === true, "repair route missing");
assert(repairValidation.readyForMediumRuntimeReuseGate === false, "repair route must not prepare medium reuse");

const forbiddenReceiptPath = join(root, "forbidden-reuse-result-receipt.json");
writeJson(forbiddenReceiptPath, {
  ...confirmedValidation,
  format: "transparent_ai_teacher_method_reuse_result_proof_receipt_v1",
  teacherDecision: "accepted"
});
const forbiddenResult = runNode(
  repoRoot,
  [
    join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "validate-teacher-method-reuse-result-proof-receipt.mjs"),
    "--contract-receipt-validation",
    contractReceiptValidationPath,
    "--contract",
    contractPath,
    "--receipt",
    forbiddenReceiptPath,
    "--output-dir",
    join(root, "forbidden-validation")
  ],
  false
);
assert(forbiddenResult.status === 1, "forbidden decision should fail closed");

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_teacher_method_reuse_result_proof_smoke_v1",
      builder: builderResult.builderPath,
      receiptTemplate: builderResult.receiptTemplatePath,
      confirmedValidation: confirmedResult.validationPath,
      repairValidation: repairResult.validationPath,
      forbiddenDecisionBlocked: true,
      readyForMediumRuntimeReuseGate: confirmedValidation.readyForMediumRuntimeReuseGate,
      repairRequired: repairValidation.repairRequired,
      locks: confirmedValidation.locks
    },
    null,
    2
  )
);
