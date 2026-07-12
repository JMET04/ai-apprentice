#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-validated-route-command-builder-smoke");

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

const fixtureManual = writeJson(join(outRoot, "fixture-manual.json"), { format: "fixture_manual_v1" });
const fixtureRollback = writeJson(join(outRoot, "fixture-rollback.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "route-command-builder-smoke-rollback",
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
  "Smoke build downstream command from validated route.",
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
  teacherNotes: "Smoke route command builder.",
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
const itemBuilder = runJson("create-tlcl-apprentice-session-handoff-item-command-builder.mjs", [
  "--queue",
  receiptValidation.handoffQueuePath,
  "--output-dir",
  join(outRoot, "item-builder")
]);
const builder = readJson(itemBuilder.builderPath);
const item = builder.items[0];
const requestPath = writeJson(join(outRoot, "continuation-request.json"), {
  format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1",
  queuePath: receiptValidation.handoffQueuePath,
  itemNumber: item.order,
  itemId: item.id,
  selectedRoute: item.selectedRoute,
  commandTemplate: item.commandTemplate,
  nextCall: item.nextCall,
  handoffInputs: item.handoffInputs,
  teacherConfirmation: "teacher confirmed validated route command builder input",
  retainedRollbackPoint: fixtureRollback,
  executeNow: false,
  reviewOnly: true,
  locks: builder.locks
});
const continuationValidation = runJson("validate-tlcl-apprentice-session-handoff-item-continuation-request.mjs", [
  "--builder",
  itemBuilder.builderPath,
  "--request",
  requestPath,
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
const commandBuilderHtml = readFileSync(commandBuilder.htmlPath, "utf8");

const blockedRouterPath = writeJson(join(outRoot, "blocked-router.json"), {
  ...readJson(router.routerPath),
  ok: false,
  status: "blocked_before_tlcl_validated_continuation_route",
  blockers: [{ code: "fixture_blocked_router", message: "Fixture blocked router." }]
});
const blockedBuilder = runJson("create-tlcl-apprentice-session-validated-route-command-builder.mjs", [
  "--router",
  blockedRouterPath,
  "--output-dir",
  join(outRoot, "blocked-route-command-builder")
]);

const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL validated route command builder creates copyable downstream request",
  commandBuilder.format === "transparent_ai_tlcl_apprentice_session_validated_route_command_builder_result_v1" &&
    commandBuilder.ok === true &&
    commandBuilder.status === "tlcl_validated_route_command_builder_waiting_for_teacher_copy" &&
    commandBuilder.route === "rag_rule_dsl_validation_package_manual_handoff" &&
    commandBuilder.nextTool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs" &&
    commandBuilderJson.downstreamRequest?.args?.reviewValidation === fixtureReviewValidation &&
    commandBuilderJson.downstreamRequest?.executeNow === false &&
    existsSync(commandBuilder.htmlPath),
  { builderPath: commandBuilder.builderPath }
);
check(
  "TLCL validated route command builder stays copy-only and no-op",
  commandBuilder.locks?.builderDoesNotExecuteDownstreamTool === true &&
    commandBuilder.locks?.builderDoesNotAutoRunCommand === true &&
    commandBuilder.locks?.builderDoesNotInvokeModel === true &&
    commandBuilder.locks?.builderDoesNotFetchRag === true &&
    commandBuilder.locks?.builderDoesNotWriteMemory === true &&
    commandBuilder.locks?.builderDoesNotEnableRule === true &&
    commandBuilder.locks?.builderDoesNotUnlockPackaging === true &&
    commandBuilderHtml.includes("copy-only") &&
    commandBuilderHtml.includes("Copy downstream request JSON"),
  { locks: commandBuilder.locks }
);
check(
  "TLCL validated route command builder blocks failed router packets",
  blockedBuilder.ok === false &&
    blockedBuilder.status === "blocked_before_tlcl_validated_route_command_builder" &&
    blockedBuilder.blockers.some((blocker) => blocker.code === "router_not_ok"),
  { blockers: blockedBuilder.blockers }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_validated_route_command_builder_smoke_v1",
  passed,
  total: checks.length,
  checks,
  commandBuilder,
  blockedBuilder
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
