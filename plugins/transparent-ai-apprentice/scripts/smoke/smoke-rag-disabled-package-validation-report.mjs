#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-disabled-package-validation-report");
mkdirSync(root, { recursive: true });

function runScript(scriptPath, args, expectOk = true) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (expectOk && result.status !== 0) {
    throw new Error(`${scriptPath} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (!expectOk && result.status === 0) {
    throw new Error(`${scriptPath} unexpectedly passed:\nSTDOUT:\n${result.stdout}`);
  }
  return result;
}

function runKnowledge(script, args, expectOk = true) {
  return runScript(join(pluginRoot, "scripts", "knowledge", script), args, expectOk);
}

const disabledPackageSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-reviewed-disabled-rule-package.mjs"), []);
const disabledPackageSmokeResult = JSON.parse(disabledPackageSmoke.stdout);
const disabledPackagePath = disabledPackageSmokeResult.packagePath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-disabled-package-validation-report",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const reportRun = runKnowledge("create-rag-disabled-package-validation-report.mjs", [
  "--disabled-rule-package",
  disabledPackagePath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "report")
]);
const reportResult = JSON.parse(reportRun.stdout);
const packet = readJson(reportResult.packetPath);
const report = readJson(packet.validationReportPath);

if (packet.format !== "transparent_ai_rag_disabled_package_validation_report_v1") {
  throw new Error("RAG disabled package validation report should use the expected format.");
}
if (packet.status !== "ready_for_teacher_validation_report_review") {
  throw new Error("RAG disabled package validation report should be teacher-review-only.");
}
if (packet.summary.disabledRuleCount !== 1 || packet.summary.lifecycleSkippedRows !== 1) {
  throw new Error("RAG disabled package validation report should include one lifecycle-skipped disabled rule.");
}
if (packet.summary.validatorRowsEvaluated !== 0 || packet.summary.activeRulesEvaluated !== 0) {
  throw new Error("RAG disabled package validation report must not evaluate disabled rules as active validators.");
}
if (report.delivery_allowed !== true || report.status !== "skipped") {
  throw new Error("RAG disabled package validation report must not block delivery.");
}
if (
  packet.locks.ruleEnabled !== false ||
  packet.locks.activeRulePackageCompiled !== false ||
  packet.locks.memoryEnabled !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.packagingUnlocked !== false
) {
  throw new Error("RAG disabled package validation report must keep rule, memory, execution, fetch, and packaging locks.");
}

const noTeacherRun = runKnowledge(
  "create-rag-disabled-package-validation-report.mjs",
  ["--disabled-rule-package", disabledPackagePath, "--rollback-point", rollbackPoint, "--out-dir", join(root, "no-teacher-report")],
  false
);
if (!noTeacherRun.stderr.includes("RAG_DISABLED_PACKAGE_VALIDATION_REPORT_REQUIRES_TEACHER_REVIEWED_FLAG")) {
  throw new Error("RAG disabled package validation report must reject missing teacher-reviewed flag.");
}

const activePackage = readJson(disabledPackagePath);
const compiled = readJson(activePackage.compiledRulePackagePath);
compiled.rules[0].lifecycle = "active";
compiled.rules[0].owner = { ...compiled.rules[0].owner, reviewer_id: "teacher.local", approved_at: "2026-06-13T00:00:00.000Z" };
const activeCompiledPath = join(root, "forbidden-active-rule-package.json");
writeJson(activeCompiledPath, compiled);
activePackage.compiledRulePackagePath = activeCompiledPath;
const activeDisabledPackagePath = join(root, "forbidden-active-disabled-package.json");
writeJson(activeDisabledPackagePath, activePackage);
const activeRun = runKnowledge(
  "create-rag-disabled-package-validation-report.mjs",
  ["--disabled-rule-package", activeDisabledPackagePath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "active-report")],
  false
);
if (!activeRun.stderr.includes("VALIDATION_REPORT_REHEARSAL_REJECTS_ACTIVE_RULES")) {
  throw new Error("RAG disabled package validation report must reject active rules.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_disabled_package_validation_report_smoke_v1",
      packetPath: reportResult.packetPath,
      validationReportPath: packet.validationReportPath,
      disabledRuleCount: packet.summary.disabledRuleCount,
      lifecycleSkippedRows: packet.summary.lifecycleSkippedRows,
      deliveryAllowed: packet.summary.deliveryAllowed,
      rejectedMissingTeacherReviewedFlag: true,
      rejectedActiveRules: true,
      locks: packet.locks
    },
    null,
    2
  )
);
