#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const smokeRoot = join(repoRoot, ".ta-smoke", "original-goal-low-token-evidence-return-cockpit-receipt-validation-runner");

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function runScript(script, args, { expectFailure = false } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [join(pluginRoot, "scripts", script), ...args], {
      cwd: repoRoot,
      encoding: "utf8"
    });
    if (expectFailure) throw new Error(`Expected ${script} to fail`);
    return JSON.parse(stdout);
  } catch (error) {
    if (!expectFailure) throw error;
    const stdout = String(error.stdout || "");
    return JSON.parse(stdout);
  }
}

rmSync(smokeRoot, { recursive: true, force: true });
mkdirSync(smokeRoot, { recursive: true });

const cockpitPath = join(smokeRoot, "cockpit.json");
const cockpit = {
  ok: true,
  format: "transparent_ai_original_goal_low_token_coverage_waiting_row_cockpit_v1",
  cockpitId: "smoke-return-runner-cockpit",
  reviewRows: [
    {
      rowId: "low-token-waiting-001",
      ledgerNumber: "001",
      software: "BlockedCAD",
      reviewStatus: "blocked_needs_more_low_token_evidence"
    }
  ],
  paths: {
    sourceMetadataGatePreflight: join(smokeRoot, "metadata-gate-preflight.json")
  },
  locks: {
    reviewOnly: true,
    cockpitDoesNotRunMetadataGate: true,
    cockpitDoesNotReadLogs: true,
    cockpitDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
};
writeJson(cockpitPath, cockpit);

const evidenceValidationPath = join(smokeRoot, "evidence-plan-receipt-validation.json");
writeJson(evidenceValidationPath, {
  ok: true,
  format: "transparent_ai_original_goal_low_token_blocked_waiting_row_evidence_plan_receipt_validation_v1",
  status: "evidence_plan_receipt_ready_to_return_to_waiting_row_cockpit",
  sourceEvidence: {
    sourceCockpit: cockpitPath
  },
  counts: {
    invalidRows: 0,
    readyRows: 1
  },
  validationRows: [
    {
      rowId: "low-token-waiting-001",
      status: "ready_to_return_to_waiting_row_cockpit_review",
      readyToReturnToCockpitReview: true
    }
  ],
  locks: {
    validationDoesNotRunMetadataGate: true,
    validationDoesNotReadLogs: true,
    validationDoesNotExecuteTargetSoftware: true,
    goalComplete: false
  }
});

const builderResult = runScript("create-original-goal-low-token-blocked-waiting-row-evidence-return-cockpit-receipt-builder.mjs", [
  "--validation",
  evidenceValidationPath,
  "--cockpit",
  cockpitPath,
  "--output-dir",
  join(smokeRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);

const checks = [];
const readyRun = runScript("run-original-goal-low-token-evidence-return-cockpit-receipt-validation.mjs", [
  "--builder",
  builderResult.builderPath,
  "--teacher-reviewed-draft",
  "true",
  "--rollback-retained",
  "true",
  "--teacher-confirmation",
  "Teacher reviewed the generated cockpit receipt draft and retained rollback.",
  "--output-dir",
  join(smokeRoot, "ready-run")
]);
const readyRunJson = readJson(readyRun.runPath);
checks.push({
  name: "Teacher-reviewed return cockpit receipt draft validates through the existing cockpit receipt gate",
  pass:
    readyRun.format === "transparent_ai_original_goal_low_token_evidence_return_cockpit_receipt_validation_run_result_v1" &&
    readyRun.status === "cockpit_receipt_validation_ready_for_metadata_preflight_receipt_review" &&
    readyRunJson.cockpitReceiptValidation?.ok === true &&
    readyRunJson.cockpitReceiptValidation?.readyRows === 1 &&
    readyRun.nextSafeCommand?.commandLine.includes("validate-original-goal-low-token-metadata-gate-preflight-receipt.mjs") &&
    readyRun.locks?.runnerDoesNotRunMetadataGate === true &&
    readyRun.locks?.runnerDoesNotReadLogs === true &&
    readyRun.locks?.runnerDoesNotExecuteTargetSoftware === true &&
    readyRun.locks?.goalComplete === false,
  evidence: JSON.stringify(readyRun).slice(0, 700)
});

const missingTeacherRun = runScript(
  "run-original-goal-low-token-evidence-return-cockpit-receipt-validation.mjs",
  [
    "--builder",
    builderResult.builderPath,
    "--rollback-retained",
    "true",
    "--teacher-confirmation",
    "Teacher did not tick the reviewed-draft flag.",
    "--output-dir",
    join(smokeRoot, "missing-teacher-run")
  ],
  { expectFailure: true }
);
const missingTeacherRunJson = readJson(missingTeacherRun.runPath);
checks.push({
  name: "Missing teacher-reviewed draft flag blocks before invoking cockpit receipt validation",
  pass:
    missingTeacherRun.ok === false &&
    missingTeacherRun.status === "blocked_before_cockpit_receipt_validation" &&
    missingTeacherRunJson.validationRunnerCall.invoked === false &&
    missingTeacherRunJson.blockers.includes("teacher_reviewed_draft_confirmation_missing") &&
    missingTeacherRun.locks?.runnerDoesNotRunMetadataGate === true,
  evidence: JSON.stringify(missingTeacherRun).slice(0, 700)
});

const missingRollbackRun = runScript(
  "run-original-goal-low-token-evidence-return-cockpit-receipt-validation.mjs",
  [
    "--builder",
    builderResult.builderPath,
    "--teacher-reviewed-draft",
    "true",
    "--teacher-confirmation",
    "Teacher reviewed but rollback was not retained.",
    "--output-dir",
    join(smokeRoot, "missing-rollback-run")
  ],
  { expectFailure: true }
);
const missingRollbackRunJson = readJson(missingRollbackRun.runPath);
checks.push({
  name: "Missing retained rollback blocks before invoking cockpit receipt validation",
  pass:
    missingRollbackRun.ok === false &&
    missingRollbackRun.status === "blocked_before_cockpit_receipt_validation" &&
    missingRollbackRunJson.validationRunnerCall.invoked === false &&
    missingRollbackRunJson.blockers.includes("rollback_not_retained") &&
    missingRollbackRun.locks?.runnerDoesNotExecuteTargetSoftware === true,
  evidence: JSON.stringify(missingRollbackRun).slice(0, 700)
});

const forbiddenReceiptPath = builder.receiptDraftPath;
const forbiddenReceipt = readJson(forbiddenReceiptPath);
forbiddenReceipt.rowDecisions[0].teacherDecision = "execute_now";
writeJson(forbiddenReceiptPath, forbiddenReceipt);
const forbiddenRun = runScript(
  "run-original-goal-low-token-evidence-return-cockpit-receipt-validation.mjs",
  [
    "--builder",
    builderResult.builderPath,
    "--teacher-reviewed-draft",
    "true",
    "--rollback-retained",
    "true",
    "--teacher-confirmation",
    "Teacher reviewed a tampered receipt in smoke.",
    "--output-dir",
    join(smokeRoot, "forbidden-run")
  ],
  { expectFailure: true }
);
const forbiddenRunJson = readJson(forbiddenRun.runPath);
checks.push({
  name: "Forbidden receipt decisions fail closed through the cockpit receipt validator",
  pass:
    forbiddenRun.ok === false &&
    forbiddenRun.status === "cockpit_receipt_validation_failed_closed" &&
    forbiddenRunJson.validationRunnerCall.invoked === true &&
    forbiddenRunJson.cockpitReceiptValidation?.ok === false &&
    forbiddenRunJson.nextSafeCommand === null &&
    forbiddenRun.locks?.runnerDoesNotReadLogs === true &&
    forbiddenRun.locks?.goalComplete === false,
  evidence: JSON.stringify(forbiddenRun).slice(0, 700)
});

const passed = checks.filter((check) => check.pass).length;
const result = {
  format: "transparent_ai_original_goal_low_token_evidence_return_cockpit_receipt_validation_runner_smoke_v1",
  status: passed === checks.length ? "passed" : "failed",
  passed,
  total: checks.length,
  smokeRoot: existsSync(smokeRoot) ? smokeRoot : "",
  checks
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "passed") process.exit(1);
