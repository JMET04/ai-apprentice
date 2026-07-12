#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-validated-route-request-receipt-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function runJson(script, args, options = {}) {
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

const fixtureManual = writeJson(join(outRoot, "fixture-manual.json"), { format: "fixture_manual_v1" });
const fixtureRollback = writeJson(join(outRoot, "fixture-rollback.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "route-request-receipt-smoke-rollback",
  status: "waiting_for_teacher_confirmation"
});
const fixtureReviewValidation = writeJson(join(outRoot, "fixture-retrieval-review-validation.json"), {
  format: "transparent_ai_rag_confirmed_retrieval_draft_review_receipt_validation_v1",
  status: "ready_for_rule_dsl_validation_package",
  reviewOnly: true
});

const launcher = runJson("create-tlcl-apprentice-session-launcher.mjs", [
  "--output-dir",
  join(outRoot, "launcher"),
  "--goal",
  "Smoke validate reviewed downstream route request receipt.",
  "--software",
  "FixtureCAD",
  "--knowledge-source",
  fixtureManual,
  "--rollback-point",
  fixtureRollback
]);
const packet = readJson(launcher.packetPath);
const receiptPath = writeJson(join(outRoot, "launcher-receipt.json"), {
  format: "transparent_ai_tlcl_apprentice_session_launcher_receipt_v1",
  launchId: packet.launchId,
  teacherSelectedDecision: "continue_with_rag_rule_dsl_review",
  teacherNotes: "Smoke validated route request receipt.",
  confirmedRollbackPoint: fixtureRollback,
  handoffInputs: {
    retrievalDraftReviewValidation: fixtureReviewValidation,
    teacherConfirmedSource: fixtureManual
  }
});
const receiptValidation = runJson("validate-tlcl-apprentice-session-launcher-receipt.mjs", [
  "--launcher",
  launcher.packetPath,
  "--receipt",
  receiptPath,
  "--output-dir",
  join(outRoot, "launcher-receipt-validation")
]);
const itemBuilder = runJson("create-tlcl-apprentice-session-handoff-item-command-builder.mjs", [
  "--queue",
  receiptValidation.handoffQueuePath,
  "--output-dir",
  join(outRoot, "item-builder")
]);
const builder = readJson(itemBuilder.builderPath);
const item = builder.items[0];
const continuationRequestPath = writeJson(join(outRoot, "continuation-request.json"), {
  format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1",
  queuePath: receiptValidation.handoffQueuePath,
  itemNumber: item.order,
  itemId: item.id,
  selectedRoute: item.selectedRoute,
  commandTemplate: item.commandTemplate,
  nextCall: item.nextCall,
  handoffInputs: item.handoffInputs,
  teacherConfirmation: "teacher confirmed validated route request receipt smoke",
  retainedRollbackPoint: fixtureRollback,
  executeNow: false,
  reviewOnly: true,
  locks: builder.locks
});
const continuationValidation = runJson("validate-tlcl-apprentice-session-handoff-item-continuation-request.mjs", [
  "--builder",
  itemBuilder.builderPath,
  "--request",
  continuationRequestPath,
  "--output-dir",
  join(outRoot, "continuation-validation")
]);
const router = runJson("create-tlcl-apprentice-session-validated-continuation-router.mjs", [
  "--validation",
  continuationValidation.validationPath,
  "--output-dir",
  join(outRoot, "router")
]);
const commandBuilder = runJson("create-tlcl-apprentice-session-validated-route-command-builder.mjs", [
  "--router",
  router.routerPath,
  "--output-dir",
  join(outRoot, "route-command-builder")
]);
const commandBuilderJson = readJson(commandBuilder.builderPath);
const receiptBuilder = runJson("create-tlcl-apprentice-session-validated-route-request-receipt-builder.mjs", [
  "--builder",
  commandBuilder.builderPath,
  "--output-dir",
  join(outRoot, "receipt-builder")
]);
const receiptTemplate = readJson(receiptBuilder.receiptTemplatePath);
const validRouteReceiptPath = writeJson(join(outRoot, "valid-route-request-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "teacher_reviewed_downstream_request_ready_for_manual_use",
  confirmedRollbackPoint: "route-request-receipt-smoke-rollback",
  downstreamRequestReviewed: true,
  commandTemplateReviewed: true,
  noOpLocksReviewed: true,
  separateManualStepConfirmed: true,
  blockedActionsConfirmed: true,
  teacherNotes: "Teacher reviewed the downstream request and keeps it as a separate manual step."
});
const validValidation = runJson("validate-tlcl-apprentice-session-validated-route-request-receipt.mjs", [
  "--builder",
  commandBuilder.builderPath,
  "--receipt",
  validRouteReceiptPath,
  "--output-dir",
  join(outRoot, "valid-receipt-validation")
]);

const forbiddenReceiptPath = writeJson(join(outRoot, "forbidden-route-request-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "execute_now",
  confirmedRollbackPoint: "route-request-receipt-smoke-rollback",
  downstreamRequestReviewed: true,
  commandTemplateReviewed: true,
  noOpLocksReviewed: true,
  separateManualStepConfirmed: true
});
const forbiddenValidation = runJson(
  "validate-tlcl-apprentice-session-validated-route-request-receipt.mjs",
  ["--builder", commandBuilder.builderPath, "--receipt", forbiddenReceiptPath, "--output-dir", join(outRoot, "forbidden-receipt-validation")],
  { allowFailure: true }
);

const mismatchedArgsReceiptPath = writeJson(join(outRoot, "mismatched-args-route-request-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "teacher_reviewed_downstream_request_ready_for_manual_use",
  reviewedArgs: { unexpected: true },
  confirmedRollbackPoint: "route-request-receipt-smoke-rollback",
  downstreamRequestReviewed: true,
  commandTemplateReviewed: true,
  noOpLocksReviewed: true,
  separateManualStepConfirmed: true
});
const mismatchedArgsValidation = runJson("validate-tlcl-apprentice-session-validated-route-request-receipt.mjs", [
  "--builder",
  commandBuilder.builderPath,
  "--receipt",
  mismatchedArgsReceiptPath,
  "--output-dir",
  join(outRoot, "mismatched-args-receipt-validation")
]);

const missingRollbackReceiptPath = writeJson(join(outRoot, "missing-rollback-route-request-receipt.json"), {
  ...receiptTemplate,
  teacherDecision: "teacher_reviewed_downstream_request_ready_for_manual_use",
  confirmedRollbackPoint: "",
  downstreamRequestReviewed: true,
  commandTemplateReviewed: true,
  noOpLocksReviewed: true,
  separateManualStepConfirmed: true
});
const missingRollbackValidation = runJson("validate-tlcl-apprentice-session-validated-route-request-receipt.mjs", [
  "--builder",
  commandBuilder.builderPath,
  "--receipt",
  missingRollbackReceiptPath,
  "--output-dir",
  join(outRoot, "missing-rollback-receipt-validation")
]);

const receiptBuilderHtml = readFileSync(receiptBuilder.htmlPath, "utf8");
const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL validated route request receipt builder creates teacher receipt template",
  receiptBuilder.format === "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_builder_result_v1" &&
    receiptBuilder.ok === true &&
    receiptBuilder.status === "tlcl_validated_route_request_receipt_builder_waiting_for_teacher_review" &&
    receiptTemplate.format === "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_v1" &&
    receiptTemplate.reviewedNextTool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs" &&
    receiptTemplate.executeNow === false &&
    existsSync(receiptBuilder.htmlPath) &&
    receiptBuilderHtml.includes("does not execute downstream tools"),
  { receiptBuilderPath: receiptBuilder.receiptBuilderPath }
);
check(
  "TLCL validated route request receipt validation prepares separate manual downstream use",
  validValidation.format === "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_validation_result_v1" &&
    validValidation.status === "tlcl_validated_route_request_reviewed_waiting_for_separate_manual_downstream_use" &&
    validValidation.readyForManualDownstreamUse === true &&
    validValidation.manualDownstreamUse?.nextTool === commandBuilderJson.downstreamRequest.nextTool &&
    validValidation.manualDownstreamUse?.executeNow === false &&
    validValidation.locks?.validatorDoesNotExecuteDownstreamTool === true &&
    validValidation.locks?.validatorDoesNotInvokeModel === true &&
    validValidation.locks?.validatorDoesNotFetchRag === true &&
    validValidation.locks?.validatorDoesNotWriteMemory === true &&
    validValidation.locks?.validatorDoesNotEnableRule === true &&
    validValidation.locks?.validatorDoesNotUnlockPackaging === true,
  { validationPath: validValidation.validationPath }
);
check(
  "TLCL validated route request receipt blocks forbidden execute decisions",
  forbiddenValidation.status === "blocked_for_forbidden_route_request_receipt_decision" &&
    forbiddenValidation.forbiddenDecisionUsed === true &&
    forbiddenValidation.blockers.some((blocker) => blocker.code === "forbidden_teacher_decision"),
  { blockers: forbiddenValidation.blockers }
);
check(
  "TLCL validated route request receipt detects reviewed args mismatch",
  mismatchedArgsValidation.status === "needs_teacher_review_or_more_downstream_request_evidence" &&
    mismatchedArgsValidation.readyForManualDownstreamUse === false &&
    mismatchedArgsValidation.blockers.some((blocker) => blocker.code === "reviewed_args_mismatch"),
  { blockers: mismatchedArgsValidation.blockers }
);
check(
  "TLCL validated route request receipt requires retained rollback point",
  missingRollbackValidation.status === "needs_teacher_review_or_more_downstream_request_evidence" &&
    missingRollbackValidation.readyForManualDownstreamUse === false &&
    missingRollbackValidation.blockers.some((blocker) => blocker.code === "confirmed_rollback_point_missing"),
  { blockers: missingRollbackValidation.blockers }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_validated_route_request_receipt_smoke_v1",
  passed,
  total: checks.length,
  checks,
  receiptBuilder,
  validValidation,
  forbiddenValidation,
  mismatchedArgsValidation,
  missingRollbackValidation
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
