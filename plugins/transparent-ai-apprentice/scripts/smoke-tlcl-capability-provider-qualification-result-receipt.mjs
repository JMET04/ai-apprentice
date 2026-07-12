#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const smokeRoot = join(
  repoRoot,
  ".transparent-apprentice",
  "tlcl-capability-provider-qualification-result-receipt-smoke",
  String(Date.now())
);

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [join(repoRoot, "plugins", "transparent-ai-apprentice", script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 120000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function check(name, pass, evidence) {
  return { name, pass: Boolean(pass), evidence: String(evidence || "") };
}

function receiptPath(basePath, suffix) {
  return join(dirname(basePath), `tlcl-capability-provider-qualification-result-receipt-${suffix}.json`);
}

const statusRefresh = runNode("scripts/create-tlcl-status-refresh.mjs", [
  "--goal",
  "smoke-tlcl-capability-provider-qualification-result-receipt",
  "--out-dir",
  smokeRoot
]);
const intake = runNode("scripts/create-tlcl-capability-provider-intake.mjs", [
  "--status-refresh",
  statusRefresh.refreshPath,
  "--provider-name",
  "receipt-validator-distilled-skill",
  "--provider-kind",
  "distilled_skill",
  "--requested-role",
  "low_reasoning_tool",
  "--capability-summary",
  "Fills fixed reviewed qualification result fields.",
  "--source-ref",
  "smoke-receipt-skill",
  "--out-dir",
  smokeRoot
]);
const plan = runNode("scripts/create-tlcl-capability-provider-qualification-plan.mjs", [
  "--intake",
  intake.intakePath,
  "--teacher-reviewed-candidate",
  "--teacher-review-note",
  "Teacher keeps this provider candidate for result receipt validation smoke.",
  "--out-dir",
  smokeRoot
]);
const run = runNode("scripts/run-tlcl-capability-provider-qualification-no-action-runner.mjs", [
  "--plan",
  plan.planPath,
  "--teacher-reviewed-test-plan",
  "--teacher-review-note",
  "Teacher reviewed the qualification plan for result receipt validation smoke.",
  "--out-dir",
  smokeRoot
]);

const template = readJson(run.resultTemplatePath);

const matchedReceipt = structuredClone(template);
matchedReceipt.overallDecision = "ready_for_validator_review";
matchedReceipt.rows = matchedReceipt.rows.map((row) => ({
  ...row,
  observedEvidencePath: `evidence/${row.rowId}.json`,
  observedSummary: "Verifier observed output matching the disabled qualification expectation.",
  resultStatus: "matched_expected",
  teacherOrVerifierNote: "No provider enablement is requested."
}));
const matchedReceiptPath = receiptPath(run.resultTemplatePath, "matched");
writeJson(matchedReceiptPath, matchedReceipt);
const matched = runNode("scripts/validate-tlcl-capability-provider-qualification-result-receipt.mjs", [
  "--run",
  run.runPath,
  "--receipt",
  matchedReceiptPath,
  "--out-dir",
  smokeRoot
]);
const matchedValidation = readJson(matched.validationPath);

const mismatchReceipt = structuredClone(template);
mismatchReceipt.overallDecision = "blocked";
mismatchReceipt.rows = mismatchReceipt.rows.map((row, index) => ({
  ...row,
  resultStatus: index === 0 ? "mismatch_blocked" : "unknown_blocked",
  observedSummary: index === 0 ? "Verifier found mismatch." : "Verifier cannot prove expected behavior."
}));
const mismatchReceiptPath = receiptPath(run.resultTemplatePath, "mismatch");
writeJson(mismatchReceiptPath, mismatchReceipt);
const mismatch = runNode("scripts/validate-tlcl-capability-provider-qualification-result-receipt.mjs", [
  "--run",
  run.runPath,
  "--receipt",
  mismatchReceiptPath,
  "--out-dir",
  smokeRoot
]);
const mismatchValidation = readJson(mismatch.validationPath);

const partialReceipt = structuredClone(template);
partialReceipt.overallDecision = "needs_result_review";
partialReceipt.rows = partialReceipt.rows.map((row, index) => ({
  ...row,
  resultStatus: index === 0 ? "matched_expected" : "not_run_yet"
}));
const partialReceiptPath = receiptPath(run.resultTemplatePath, "partial");
writeJson(partialReceiptPath, partialReceipt);
const partial = runNode("scripts/validate-tlcl-capability-provider-qualification-result-receipt.mjs", [
  "--run",
  run.runPath,
  "--receipt",
  partialReceiptPath,
  "--out-dir",
  smokeRoot
]);
const partialValidation = readJson(partial.validationPath);

const forbiddenReceipt = structuredClone(matchedReceipt);
forbiddenReceipt.overallDecision = "accepted";
const forbiddenReceiptPath = receiptPath(run.resultTemplatePath, "forbidden");
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbidden = runNode("scripts/validate-tlcl-capability-provider-qualification-result-receipt.mjs", [
  "--run",
  run.runPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  smokeRoot
]);
const forbiddenValidation = readJson(forbidden.validationPath);

const tamperedReceipt = structuredClone(matchedReceipt);
tamperedReceipt.sourceRunHash = "sha256:tampered";
tamperedReceipt.rows[0].testCaseId = "tampered-test-case";
const tamperedReceiptPath = receiptPath(run.resultTemplatePath, "tampered");
writeJson(tamperedReceiptPath, tamperedReceipt);
const tampered = runNode("scripts/validate-tlcl-capability-provider-qualification-result-receipt.mjs", [
  "--run",
  run.runPath,
  "--receipt",
  tamperedReceiptPath,
  "--out-dir",
  smokeRoot
]);
const tamperedValidation = readJson(tampered.validationPath);

const checks = [
  check(
    "Matched receipt becomes ready for later validator review but keeps provider disabled",
    matched.status === "tlcl_capability_provider_qualification_results_ready_for_validator_review" &&
      matchedValidation.decision.mayEnableProvider === false &&
      matchedValidation.decision.mayUseProvider === false &&
      matchedValidation.locks.providerEnabled === false &&
      matchedValidation.locks.targetSoftwareCommandsExecuted === false &&
      matchedValidation.locks.memoryWritten === false &&
      matchedValidation.locks.packagingGated === true &&
      matchedValidation.counts.matchedExpected === matchedValidation.counts.totalRows,
    matched.validationPath
  ),
  check(
    "Mismatch and unknown receipt blocks provider enablement before reuse",
    mismatch.status === "tlcl_capability_provider_qualification_results_blocked_before_provider_enablement" &&
      mismatchValidation.counts.mismatchBlocked === 1 &&
      mismatchValidation.counts.unknownBlocked === 1 &&
      mismatchValidation.decision.mayEnableProvider === false &&
      mismatchValidation.nextActions.some((action) => action.includes("senior compile")),
    mismatch.validationPath
  ),
  check(
    "Partial receipt waits for more evidence and cannot enable provider",
    partial.status === "tlcl_capability_provider_qualification_results_waiting_for_more_evidence" &&
      partialValidation.counts.notRunYet === 1 &&
      partialValidation.decision.mayUseProvider === false &&
      partialValidation.locks.accepted === false,
    partial.validationPath
  ),
  check(
    "Forbidden acceptance decision fails closed",
    forbidden.status === "blocked_before_tlcl_capability_provider_qualification_result_validation" &&
      forbiddenValidation.blockers.includes("forbidden_overall_decision") &&
      forbiddenValidation.decision.accepted === false &&
      forbiddenValidation.locks.packagingUnlocked === false,
    forbidden.validationPath
  ),
  check(
    "Tampered source hash or row identity fails closed",
    tampered.status === "blocked_before_tlcl_capability_provider_qualification_result_validation" &&
      tamperedValidation.blockers.includes("receipt_source_run_hash_mismatch") &&
      tamperedValidation.blockers.includes("receipt_test_case_id_mismatch") &&
      tamperedValidation.locks.ruleEnabled === false,
    tampered.validationPath
  )
];

const passed = checks.filter((item) => item.pass).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_capability_provider_qualification_result_receipt_smoke_v1",
  smokeRoot,
  runPath: run.runPath,
  matchedValidationPath: matched.validationPath,
  mismatchValidationPath: mismatch.validationPath,
  partialValidationPath: partial.validationPath,
  forbiddenValidationPath: forbidden.validationPath,
  tamperedValidationPath: tampered.validationPath,
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
