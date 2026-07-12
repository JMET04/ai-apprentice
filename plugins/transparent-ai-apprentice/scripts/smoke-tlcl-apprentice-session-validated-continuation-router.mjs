#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-validated-continuation-router-smoke");

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
  note: "Router smoke keeps RAG evidence non-authoritative."
});
const fixtureRollback = writeJson(join(outRoot, "fixture-rollback.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "router-smoke-rollback",
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
  "Smoke route one validated TLCL continuation request.",
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
  teacherNotes: "Smoke validated continuation router route.",
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
const requestPath = writeJson(join(outRoot, "valid-continuation-request.json"), {
  format: "transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1",
  queuePath: receiptValidation.handoffQueuePath,
  itemNumber: item.order,
  itemId: item.id,
  selectedRoute: item.selectedRoute,
  commandTemplate: item.commandTemplate,
  nextCall: item.nextCall,
  handoffInputs: item.handoffInputs,
  teacherConfirmation: "teacher confirmed this validated TLCL continuation route",
  retainedRollbackPoint: fixtureRollback,
  executeNow: false,
  reviewOnly: true,
  locks: builder.locks
});
const continuationValidation = runJson("validate-tlcl-apprentice-session-handoff-item-continuation-request.mjs", [
  "--builder",
  builderResult.builderPath,
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
const routerJson = readJson(router.routerPath);
const routerHtml = readFileSync(router.htmlPath, "utf8");

const blockedValidationPath = writeJson(join(outRoot, "blocked-validation.json"), {
  ...readJson(continuationValidation.validationPath),
  ok: false,
  status: "blocked_before_tlcl_handoff_item_continuation",
  blockers: [{ code: "fixture_block", message: "Fixture blocked validation." }]
});
const blockedRouter = runJson("create-tlcl-apprentice-session-validated-continuation-router.mjs", [
  "--validation",
  blockedValidationPath,
  "--output-dir",
  join(outRoot, "blocked-router")
]);

const unsupportedValidationPath = writeJson(join(outRoot, "unsupported-tool-validation.json"), {
  ...readJson(continuationValidation.validationPath),
  nextManualHandoff: {
    ...readJson(continuationValidation.validationPath).nextManualHandoff,
    tool: "run_unreviewed_external_tool"
  }
});
const unsupportedRouter = runJson("create-tlcl-apprentice-session-validated-continuation-router.mjs", [
  "--validation",
  unsupportedValidationPath,
  "--output-dir",
  join(outRoot, "unsupported-router")
]);

const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL validated continuation router prepares reviewed RAG Rule DSL route",
  router.format === "transparent_ai_tlcl_apprentice_session_validated_continuation_router_result_v1" &&
    router.ok === true &&
    router.status === "tlcl_validated_continuation_route_prepared_waiting_for_manual_downstream_review" &&
    router.route === "rag_rule_dsl_validation_package_manual_handoff" &&
    router.nextTool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs" &&
    routerJson.preparedRoute?.args?.reviewValidation === fixtureReviewValidation &&
    routerJson.preparedRoute?.executesNow === false &&
    existsSync(router.readmePath) &&
    existsSync(router.htmlPath),
  { routerPath: router.routerPath }
);
check(
  "TLCL validated continuation router keeps downstream tool manual and locked",
  router.locks?.routerDoesNotExecuteNextCall === true &&
    router.locks?.routerDoesNotInvokeDownstreamTool === true &&
    router.locks?.routerDoesNotInvokeModel === true &&
    router.locks?.routerDoesNotFetchRag === true &&
    router.locks?.routerDoesNotWriteMemory === true &&
    router.locks?.routerDoesNotEnableRule === true &&
    router.locks?.routerDoesNotUnlockPackaging === true &&
    routerHtml.includes("does not run nextCall"),
  { locks: router.locks }
);
check(
  "TLCL validated continuation router blocks failed continuation validation",
  blockedRouter.ok === false &&
    blockedRouter.status === "blocked_before_tlcl_validated_continuation_route" &&
    blockedRouter.blockers.some((blocker) => blocker.code === "validation_not_ok"),
  { blockers: blockedRouter.blockers }
);
check(
  "TLCL validated continuation router blocks non-allowlisted next tool",
  unsupportedRouter.ok === false &&
    unsupportedRouter.status === "blocked_before_tlcl_validated_continuation_route" &&
    unsupportedRouter.blockers.some((blocker) => blocker.code === "next_tool_not_allowlisted"),
  { blockers: unsupportedRouter.blockers }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_validated_continuation_router_smoke_v1",
  passed,
  total: checks.length,
  checks,
  router,
  blockedRouter,
  unsupportedRouter
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
