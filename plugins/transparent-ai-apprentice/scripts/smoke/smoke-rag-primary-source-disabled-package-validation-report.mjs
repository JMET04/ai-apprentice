#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-disabled-package-validation-report");
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

const disabledPackageSmoke = runScript(join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-disabled-rule-package.mjs"), []);
const disabledPackageSmokeResult = JSON.parse(disabledPackageSmoke.stdout);
const disabledPackagePath = disabledPackageSmokeResult.packagePath;

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-disabled-package-validation-report",
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
  throw new Error("Primary-source disabled package validation report should use the existing report packet format.");
}
if (packet.status !== "ready_for_teacher_validation_report_review") {
  throw new Error("Primary-source disabled package validation report should remain teacher-review-only.");
}
if (packet.summary.primarySourceLogicHintCount !== 1) {
  throw new Error("Primary-source disabled package validation report should count one primary-source logic hint.");
}
if (!packet.disabledRuleLogicRows[0].logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source disabled package validation report should preserve the logic extraction hint.");
}
if (packet.disabledRuleLogicRows[0].logicFitDecision !== "matches_intended_logic") {
  throw new Error("Primary-source disabled package validation report should preserve the logic-fit decision.");
}
if (!packet.nextReview.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source disabled package validation report should expose logic hints for report review.");
}
if (packet.summary.validatorRowsEvaluated !== 0 || packet.summary.activeRulesEvaluated !== 0) {
  throw new Error("Primary-source disabled package validation report must not evaluate disabled rules as active validators.");
}
if (report.delivery_allowed !== true || report.status !== "skipped") {
  throw new Error("Primary-source disabled package validation report must not block delivery.");
}
if (
  packet.locks.ruleEnabled !== false ||
  packet.locks.activeRulePackageCompiled !== false ||
  packet.locks.memoryEnabled !== false ||
  packet.locks.softwareActionsExecuted !== false ||
  packet.locks.externalFetchPerformed !== false ||
  packet.locks.packagingUnlocked !== false
) {
  throw new Error("Primary-source disabled package validation report must keep rule, memory, execution, fetch, and packaging locks.");
}

const tampered = readJson(disabledPackagePath);
tampered.nextReview.logicExtractionHints[0].logicExtractionHint = "tampered different logic";
const tamperedPath = join(root, "tampered-disabled-package.json");
writeJson(tamperedPath, tampered);
const tamperedRun = runKnowledge(
  "create-rag-disabled-package-validation-report.mjs",
  ["--disabled-rule-package", tamperedPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "tampered-report")],
  false
);
if (!tamperedRun.stderr.includes("VALIDATION_REPORT_LOGIC_EXTRACTION_HINT_MISMATCH")) {
  throw new Error("Primary-source disabled package validation report must reject tampered logic hints.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_disabled_package_validation_report_smoke_v1",
      disabledPackagePath,
      packetPath: reportResult.packetPath,
      validationReportPath: packet.validationReportPath,
      primarySourceLogicHintCount: packet.summary.primarySourceLogicHintCount,
      preservedLogicExtractionHint: true,
      preservedLogicFitDecision: true,
      rejectedTamperedLogicHint: true,
      deliveryAllowed: packet.summary.deliveryAllowed,
      locks: packet.locks
    },
    null,
    2
  )
);
