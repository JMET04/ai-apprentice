#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const createScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "create-tlcl-reasoning-budget-governor.mjs");
const validateScript = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts", "validate-tlcl-reasoning-budget-governor-review-receipt.mjs");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-reasoning-budget-governor-review-receipt-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runNode(script, args, options = {}) {
  const output = execFileSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.expectFailure ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(output);
}

function runNodeExpectFailure(script, args) {
  try {
    runNode(script, args);
    return { failed: false, output: null };
  } catch (error) {
    const stdout = String(error.stdout || "").trim();
    return { failed: true, output: stdout ? JSON.parse(stdout) : null };
  }
}

const validationReportPath = writeJson(join(outRoot, "passing-validation-report.json"), {
  format: "transparent_ai_validation_report_v1",
  status: "pass",
  delivery_allowed: true,
  results: []
});
const governorResult = runNode(createScript, [
  "--goal",
  "Prepare one confirmed low-cost reuse decision for teacher review.",
  "--operation",
  "medium_runtime_reuse",
  "--tier",
  "medium_reasoning_runtime",
  "--validation-report",
  validationReportPath,
  "--workflow-confirmed",
  "--deterministic-validators-passed",
  "--teacher-reviewed",
  "--rollback-point-retained",
  "--fresh-outcome-review-planned",
  "--out-dir",
  join(outRoot, "governors")
]);
const governor = readJson(governorResult.governorPath);
const templateReceipt = readJson(governorResult.receiptPath);

const checks = [];

function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

const confirmedReceiptPath = writeJson(join(outRoot, "confirmed-receipt.json"), {
  ...templateReceipt,
  teacherReviewDecision: "confirmed_for_next_gate",
  governorDecisionReviewed: true,
  recommendedTierReviewed: true,
  costPolicyReviewed: true,
  mediumReusePreconditionsReviewed: true,
  nextGateReviewed: true,
  blockedTransitionsConfirmed: true,
  rollbackPointStillRetained: true,
  ragEvidenceNonAuthorityConfirmed: true
});
const confirmed = runNode(validateScript, [
  "--governor",
  governorResult.governorPath,
  "--receipt",
  confirmedReceiptPath,
  "--out-dir",
  join(outRoot, "validations", "confirmed")
]);
check("Confirmed governor receipt prepares only the next reviewed gate", confirmed.status === "reasoning_budget_governor_confirmed_for_next_gate", {
  status: confirmed.status,
  readyForNextGate: confirmed.readyForNextGate
});
const confirmedValidation = readJson(confirmed.validationPath);
check(
  "Confirmed validation keeps model/runtime/software actions locked",
  confirmedValidation.locks.doesNotInvokeModel === true &&
    confirmedValidation.locks.doesNotRunMediumRuntime === true &&
    confirmedValidation.locks.doesNotExecuteTargetSoftware === true,
  { locks: confirmedValidation.locks }
);
check("Confirmed validation points to medium-runtime next gate without running it", confirmedValidation.nextGate?.kind === "medium_reasoning_runtime_next_gate", {
  nextGate: confirmedValidation.nextGate
});

const correctionReceiptPath = writeJson(join(outRoot, "correction-receipt.json"), {
  ...templateReceipt,
  teacherReviewDecision: "correction_to_high_reasoning_repair",
  teacherCorrection: "The saved workflow should not be reused until the parameter relationship is repaired.",
  observedIssue: "Teacher found a wrong data relationship."
});
const correction = runNode(validateScript, [
  "--governor",
  governorResult.governorPath,
  "--receipt",
  correctionReceiptPath,
  "--out-dir",
  join(outRoot, "validations", "correction")
]);
check("Teacher correction routes back to high-reasoning repair", correction.status === "reasoning_budget_governor_review_escalate_to_high_reasoning_repair", {
  status: correction.status,
  escalateToHighReasoningRepair: correction.escalateToHighReasoningRepair
});

const incompleteReceiptPath = writeJson(join(outRoot, "incomplete-receipt.json"), {
  ...templateReceipt,
  teacherReviewDecision: "confirmed_for_next_gate",
  governorDecisionReviewed: true
});
const incomplete = runNode(validateScript, [
  "--governor",
  governorResult.governorPath,
  "--receipt",
  incompleteReceiptPath,
  "--out-dir",
  join(outRoot, "validations", "incomplete")
]);
check("Incomplete teacher review stays blocked before next gate", incomplete.status === "reasoning_budget_governor_review_needs_teacher_review_or_more_evidence", {
  blockers: incomplete.blockers
});

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-receipt.json"), {
  ...templateReceipt,
  teacherReviewDecision: "execute_now"
});
const forbidden = runNodeExpectFailure(validateScript, [
  "--governor",
  governorResult.governorPath,
  "--receipt",
  forbiddenReceiptPath,
  "--out-dir",
  join(outRoot, "validations", "forbidden")
]);
check("Forbidden receipt decision fails closed", forbidden.failed === true && forbidden.output?.forbiddenDecisionUsed === true, {
  output: forbidden.output
});

const sourceText = readFileSync(validateScript, "utf8");
check(
  "Validator exposes fail-closed no-op boundaries",
  sourceText.includes("forbidden_teacher_review_decision") &&
    sourceText.includes("doesNotInvokeModel: true") &&
    sourceText.includes("doesNotRunMediumRuntime: true") &&
    sourceText.includes("execute_target_software_from_governor_review_validation"),
  {}
);

const passed = checks.filter((item) => item.passed).length;
const result = {
  status: passed === checks.length ? "passed" : "failed",
  smoke: "transparent_ai_tlcl_reasoning_budget_governor_review_receipt_smoke_v1",
  governorDecision: governor.decision,
  passed,
  total: checks.length,
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
