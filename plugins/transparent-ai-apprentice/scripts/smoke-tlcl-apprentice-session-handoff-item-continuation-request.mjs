#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-handoff-item-continuation-smoke");

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

function runJson(script, args) {
  return JSON.parse(
    execFileSync(process.execPath, [join(scriptsRoot, script), ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    })
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

const fixtureManual = writeJson(join(outRoot, "fixture-manual.json"), {
  format: "fixture_manual_v1",
  note: "Continuation smoke keeps RAG evidence review-only."
});
const fixtureRollback = writeJson(join(outRoot, "fixture-rollback.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "continuation-smoke-rollback",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
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
  "Smoke validate one TLCL handoff item continuation request.",
  "--software",
  "FixtureCAD",
  "--knowledge-source",
  fixtureManual,
  "--rollback-point",
  fixtureRollback
]);
const packet = readJson(launcher.packetPath);
const receiptPath = writeJson(join(outRoot, "receipt.json"), {
  format: "transparent_ai_tlcl_apprentice_session_launcher_receipt_v1",
  launchId: packet.launchId,
  teacherSelectedDecision: "continue_with_rag_rule_dsl_review",
  teacherNotes: "Smoke continuation request validator route.",
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
  join(outRoot, "receipt-validation")
]);
const builderResult = runJson("create-tlcl-apprentice-session-handoff-item-command-builder.mjs", [
  "--queue",
  receiptValidation.handoffQueuePath,
  "--output-dir",
  join(outRoot, "builder")
]);
const builder = readJson(builderResult.builderPath);
const item = builder.items[0];
const validRequestPath = writeJson(join(outRoot, "valid-continuation-request.json"), {
  format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1",
  queuePath: receiptValidation.handoffQueuePath,
  itemNumber: item.order,
  itemId: item.id,
  selectedRoute: item.selectedRoute,
  commandTemplate: item.commandTemplate,
  nextCall: item.nextCall,
  handoffInputs: item.handoffInputs,
  teacherConfirmation: "teacher confirmed this single TLCL handoff queue item",
  retainedRollbackPoint: fixtureRollback,
  executeNow: false,
  reviewOnly: true,
  locks: builder.locks
});
const validValidation = runJson("validate-tlcl-apprentice-session-handoff-item-continuation-request.mjs", [
  "--builder",
  builderResult.builderPath,
  "--request",
  validRequestPath,
  "--output-dir",
  join(outRoot, "valid-validation")
]);
const validValidationJson = readJson(validValidation.validationPath);
const validHtml = readFileSync(validValidation.htmlPath, "utf8");

const executeNowRequestPath = writeJson(join(outRoot, "execute-now-request.json"), {
  ...readJson(validRequestPath),
  executeNow: true
});
const executeNowValidation = runJson("validate-tlcl-apprentice-session-handoff-item-continuation-request.mjs", [
  "--builder",
  builderResult.builderPath,
  "--request",
  executeNowRequestPath,
  "--output-dir",
  join(outRoot, "execute-now-validation")
]);

const mismatchRequestPath = writeJson(join(outRoot, "mismatch-request.json"), {
  ...readJson(validRequestPath),
  itemId: "not-the-reviewed-item",
  itemNumber: 99
});
const mismatchValidation = runJson("validate-tlcl-apprentice-session-handoff-item-continuation-request.mjs", [
  "--builder",
  builderResult.builderPath,
  "--request",
  mismatchRequestPath,
  "--output-dir",
  join(outRoot, "mismatch-validation")
]);

const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL handoff item continuation request validates one reviewed queue item",
  validValidation.format ===
    "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_validation_result_v1" &&
    validValidation.ok === true &&
    validValidation.status ===
      "tlcl_handoff_item_continuation_request_validated_waiting_for_manual_next_call" &&
    validValidation.nextTool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs" &&
    validValidationJson.nextManualHandoff?.executesNow === false &&
    existsSync(validValidation.handoffPath) &&
    existsSync(validValidation.htmlPath),
  { validationPath: validValidation.validationPath }
);
check(
  "TLCL handoff item continuation validation keeps nextCall manual and locked",
  validValidation.locks?.validatorDoesNotExecuteNextCall === true &&
    validValidation.locks?.validatorDoesNotInvokeModel === true &&
    validValidation.locks?.validatorDoesNotFetchRag === true &&
    validValidation.locks?.validatorDoesNotWriteMemory === true &&
    validValidation.locks?.validatorDoesNotEnableRule === true &&
    validValidation.locks?.validatorDoesNotUnlockPackaging === true &&
    validValidation.locks?.goalComplete === false &&
    validHtml.includes("does not run nextCall"),
  { locks: validValidation.locks }
);
check(
  "TLCL handoff item continuation validation blocks executeNow",
  executeNowValidation.ok === false &&
    executeNowValidation.status === "blocked_before_tlcl_handoff_item_continuation" &&
    executeNowValidation.blockers.some((blocker) => blocker.code === "execute_now_forbidden"),
  { blockers: executeNowValidation.blockers }
);
check(
  "TLCL handoff item continuation validation blocks unreviewed item mismatch",
  mismatchValidation.ok === false &&
    mismatchValidation.status === "blocked_before_tlcl_handoff_item_continuation" &&
    mismatchValidation.blockers.some((blocker) => blocker.code === "queue_item_not_found"),
  { blockers: mismatchValidation.blockers }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_smoke_v1",
  passed,
  total: checks.length,
  checks,
  builderResult,
  validValidation,
  executeNowValidation,
  mismatchValidation
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
