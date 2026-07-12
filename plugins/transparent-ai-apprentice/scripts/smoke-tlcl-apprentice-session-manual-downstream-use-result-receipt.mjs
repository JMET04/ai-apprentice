#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-manual-downstream-result-receipt-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function runJson(script, args = [], options = {}) {
  try {
    return JSON.parse(
      execFileSync(process.execPath, [join(scriptsRoot, script), ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 30 * 1024 * 1024
      })
    );
  } catch (error) {
    if (!options.allowFailure) throw error;
    const stdout = String(error.stdout || "").trim();
    return stdout
      ? JSON.parse(stdout)
      : {
          ok: false,
          status: "process_failed_without_json",
          stderr: String(error.stderr || ""),
          code: error.status
        };
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const upstreamSmoke = runJson("smoke-tlcl-apprentice-session-validated-route-request-receipt.mjs");
const routeRequestValidationPath = upstreamSmoke.validValidation.validationPath;
const routeRequestValidation = readJson(routeRequestValidationPath);
const resultEvidencePath = writeJson(join(outRoot, "manual-downstream-result-evidence.json"), {
  format: "fixture_manual_downstream_result_evidence_v1",
  source: "smoke",
  result: "reviewed downstream packet created"
});

const receiptBuilder = runJson("create-tlcl-apprentice-session-manual-downstream-use-result-receipt-builder.mjs", [
  "--validation",
  routeRequestValidationPath,
  "--output-dir",
  join(outRoot, "result-receipt-builder")
]);
const receiptTemplate = readJson(receiptBuilder.receiptTemplatePath);
const validReceiptPath = writeJson(join(outRoot, "valid-manual-downstream-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_downstream_result_reviewed_ready_for_next_gate",
  manualDownstreamUseWasSeparate: true,
  downstreamResultEvidenceReviewed: true,
  observedResultStatus: "completed_reviewed",
  resultEvidencePaths: [resultEvidencePath],
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher reviewed separate manual downstream result evidence."
});
const validValidation = runJson("validate-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs", [
  "--validation",
  routeRequestValidationPath,
  "--receipt",
  validReceiptPath,
  "--output-dir",
  join(outRoot, "valid-result-validation")
]);

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-manual-downstream-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "execute_now",
  manualDownstreamUseWasSeparate: true,
  downstreamResultEvidenceReviewed: true,
  observedResultStatus: "completed_reviewed",
  resultEvidencePaths: [resultEvidencePath]
});
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs",
  ["--validation", routeRequestValidationPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(outRoot, "forbidden-result-validation")],
  { allowFailure: true }
);

const missingEvidenceReceiptPath = writeJson(join(outRoot, "missing-evidence-manual-downstream-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_downstream_result_reviewed_ready_for_next_gate",
  manualDownstreamUseWasSeparate: true,
  downstreamResultEvidenceReviewed: true,
  observedResultStatus: "completed_reviewed",
  resultEvidencePaths: []
});
const missingEvidenceValidation = runJson("validate-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs", [
  "--validation",
  routeRequestValidationPath,
  "--receipt",
  missingEvidenceReceiptPath,
  "--output-dir",
  join(outRoot, "missing-evidence-result-validation")
]);

const rollbackMismatchReceiptPath = writeJson(join(outRoot, "rollback-mismatch-manual-downstream-result-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "manual_downstream_result_reviewed_ready_for_next_gate",
  confirmedRollbackPoint: "wrong-rollback",
  manualDownstreamUseWasSeparate: true,
  downstreamResultEvidenceReviewed: true,
  observedResultStatus: "completed_reviewed",
  resultEvidencePaths: [resultEvidencePath]
});
const rollbackMismatchValidation = runJson("validate-tlcl-apprentice-session-manual-downstream-use-result-receipt.mjs", [
  "--validation",
  routeRequestValidationPath,
  "--receipt",
  rollbackMismatchReceiptPath,
  "--output-dir",
  join(outRoot, "rollback-mismatch-result-validation")
]);

const builderHtml = readFileSync(receiptBuilder.htmlPath, "utf8");
const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL manual downstream result receipt builder creates teacher result evidence template",
  receiptBuilder.format === "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_builder_result_v1" &&
    receiptBuilder.ok === true &&
    receiptBuilder.status === "manual_downstream_use_result_receipt_builder_waiting_for_teacher_result_evidence" &&
    receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_v1" &&
    receiptTemplate.reviewedNextTool === routeRequestValidation.manualDownstreamUse.nextTool &&
    receiptTemplate.executeNow === false &&
    existsSync(receiptBuilder.htmlPath) &&
    builderHtml.includes("does not execute tools"),
  { receiptBuilderPath: receiptBuilder.builderPath }
);
check(
  "TLCL manual downstream result receipt validation prepares reviewed result for next gate",
  validValidation.format === "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_validation_result_v1" &&
    validValidation.status === "manual_downstream_result_reviewed_waiting_for_next_tlcl_gate_selection" &&
    validValidation.readyForNextGate === true &&
    validValidation.reviewedDownstreamResult?.format ===
      "transparent_ai_tlcl_apprentice_session_reviewed_manual_downstream_result_v1" &&
    validValidation.reviewedDownstreamResult?.executeNow === false &&
    validValidation.reviewedDownstreamResult?.resultEvidencePaths?.includes(resultEvidencePath) &&
    validValidation.locks?.validatorDoesNotExecuteDownstreamTool === true &&
    validValidation.locks?.validatorDoesNotInvokeModel === true &&
    validValidation.locks?.validatorDoesNotFetchRag === true &&
    validValidation.locks?.validatorDoesNotWriteMemory === true &&
    validValidation.locks?.validatorDoesNotEnableRule === true &&
    validValidation.locks?.validatorDoesNotUnlockPackaging === true,
  { validationPath: validValidation.validationPath }
);
check(
  "TLCL manual downstream result receipt blocks forbidden execute decisions",
  forbiddenValidation.status === "blocked_for_forbidden_manual_downstream_result_decision" &&
    forbiddenValidation.forbiddenDecisionUsed === true &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
  { blockers: forbiddenValidation.blockers }
);
check(
  "TLCL manual downstream result receipt requires result evidence",
  missingEvidenceValidation.status === "needs_teacher_review_or_more_downstream_result_evidence" &&
    missingEvidenceValidation.readyForNextGate === false &&
    missingEvidenceValidation.blockers.some((blocker) => blocker.code === "result_evidence_missing"),
  { blockers: missingEvidenceValidation.blockers }
);
check(
  "TLCL manual downstream result receipt rejects rollback mismatch",
  rollbackMismatchValidation.status === "needs_teacher_review_or_more_downstream_result_evidence" &&
    rollbackMismatchValidation.readyForNextGate === false &&
    rollbackMismatchValidation.blockers.some((blocker) => blocker.code === "rollback_point_mismatch"),
  { blockers: rollbackMismatchValidation.blockers }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_manual_downstream_use_result_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  upstreamRouteRequestValidation: routeRequestValidationPath,
  receiptBuilder,
  validValidation,
  forbiddenValidation,
  missingEvidenceValidation,
  rollbackMismatchValidation
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
