#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const scriptsRoot = join(repoRoot, "plugins", "transparent-ai-apprentice", "scripts");
const outRoot = join(repoRoot, ".transparent-apprentice", "tlcl-apprentice-session-handoff-item-command-builder-smoke");

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
  note: "RAG evidence remains review-only."
});
const fixtureRollback = writeJson(join(outRoot, "fixture-rollback.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "builder-smoke-rollback",
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
  "Smoke TLCL handoff item command builder from a reviewed RAG Rule DSL route.",
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
  teacherNotes: "Smoke command builder route.",
  confirmedRollbackPoint: fixtureRollback,
  handoffInputs: {
    retrievalDraftReviewValidation: fixtureReviewValidation,
    teacherConfirmedSource: fixtureManual
  }
});
const validation = runJson("validate-tlcl-apprentice-session-launcher-receipt.mjs", [
  "--launcher",
  launcher.packetPath,
  "--receipt",
  receiptPath,
  "--output-dir",
  join(outRoot, "validations")
]);

const builder = runJson("create-tlcl-apprentice-session-handoff-item-command-builder.mjs", [
  "--queue",
  validation.handoffQueuePath,
  "--output-dir",
  join(outRoot, "builder")
]);
const builderJson = readJson(builder.builderPath);
const builderHtml = readFileSync(builder.htmlPath, "utf8");
const builderReadme = readFileSync(builder.readmePath, "utf8");

const placeholderBuilder = runJson("create-tlcl-apprentice-session-handoff-item-command-builder.mjs", [
  "--output-dir",
  join(outRoot, "placeholder-builder")
]);
const placeholderJson = readJson(placeholderBuilder.builderPath);
const placeholderHtml = readFileSync(placeholderBuilder.htmlPath, "utf8");

const checks = [];
function check(name, passed, evidence = {}) {
  checks.push({ name, passed, evidence });
}

check(
  "TLCL handoff item command builder consumes launcher handoff queue",
  builderJson.format === "transparent_ai_tlcl_apprentice_session_handoff_item_command_builder_v1" &&
    builderJson.queueFormat === "transparent_ai_tlcl_apprentice_session_launcher_handoff_queue_v1" &&
    builderJson.queueSupported === true &&
    builderJson.counts.queueItems === 1 &&
    builderJson.items[0].selectedRoute === "continue_with_rag_rule_dsl_review" &&
    builderJson.items[0].nextCall?.tool === "knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs",
  { builderPath: builder.builderPath }
);
check(
  "TLCL handoff item command builder writes a copyable browser page",
  existsSync(builder.htmlPath) &&
    builderHtml.includes("TLCL Apprentice Session Handoff Item Command Builder") &&
    builderHtml.includes("Generate continuation request") &&
    builderHtml.includes("Copy request JSON") &&
    builderHtml.includes("Copy selected nextCall") &&
    builderHtml.includes("transparent_ai_tlcl_apprentice_session_handoff_item_continuation_request_v1") &&
    builderHtml.includes("fixture-retrieval-review-validation.json") &&
    builderHtml.includes("knowledge/create-rag-reviewed-rule-dsl-validation-package.mjs") &&
    builderReadme.includes("does not auto-run nextCall"),
  { htmlPath: builder.htmlPath }
);
check(
  "TLCL handoff item command builder keeps continuation review-only",
  builderJson.locks?.builderDoesNotExecuteQueueItem === true &&
    builderJson.locks?.builderDoesNotAutoRunNextCall === true &&
    builderJson.locks?.builderDoesNotInvokeModel === true &&
    builderJson.locks?.builderDoesNotFetchRag === true &&
    builderJson.locks?.builderDoesNotWriteMemory === true &&
    builderJson.locks?.builderDoesNotEnableRule === true &&
    builderJson.locks?.builderDoesNotUnlockPackaging === true &&
    builderJson.locks?.goalComplete === false,
  { locks: builderJson.locks }
);
check(
  "TLCL handoff item command builder can render before queue exists",
  placeholderJson.status === "waiting_for_tlcl_handoff_queue_path" &&
    placeholderJson.queueFormat === "queue_not_loaded_yet" &&
    placeholderJson.items[0].placeholders.includes("<tlcl-apprentice-session-launcher-handoff-queue.json>") &&
    placeholderHtml.includes("&lt;tlcl-apprentice-session-launcher-handoff-queue.json&gt;"),
  { placeholderBuilderPath: placeholderBuilder.builderPath }
);

const passed = checks.filter((item) => item.passed).length;
const smoke = {
  status: passed === checks.length ? "passed" : "failed",
  format: "transparent_ai_tlcl_apprentice_session_handoff_item_command_builder_smoke_v1",
  passed,
  total: checks.length,
  checks,
  validation,
  builder,
  placeholderBuilder
};

console.log(JSON.stringify(smoke, null, 2));
if (smoke.status !== "passed") process.exit(1);
