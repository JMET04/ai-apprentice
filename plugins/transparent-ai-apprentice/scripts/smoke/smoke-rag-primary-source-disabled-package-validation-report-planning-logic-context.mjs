#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readJson, writeJson } from "../knowledge/knowledge-core.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const repoRoot = resolve(pluginRoot, "..", "..");
const root = resolve(repoRoot, ".ta-smoke", "rag-primary-source-disabled-package-validation-report-planning-logic-context");
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

const disabledPackageSmoke = runScript(
  join(pluginRoot, "scripts", "smoke", "smoke-rag-primary-source-disabled-rule-package-planning-logic-context.mjs"),
  []
);
const disabledPackageSmokeResult = JSON.parse(disabledPackageSmoke.stdout);
const disabledPackage = readJson(disabledPackageSmokeResult.packagePath);

const rollbackPoint = join(root, "retained-rollback-point");
mkdirSync(rollbackPoint, { recursive: true });
writeJson(join(rollbackPoint, "rollback-point.json"), {
  format: "transparent_ai_rollback_point_result_v1",
  rollbackId: "smoke-rag-primary-source-disabled-package-validation-report-planning-logic-context",
  status: "waiting_for_teacher_confirmation",
  deleteOnlyAfterTeacherConfirmation: true
});

const reportRun = runKnowledge("create-rag-disabled-package-validation-report.mjs", [
  "--disabled-rule-package",
  disabledPackageSmokeResult.packagePath,
  "--rollback-point",
  rollbackPoint,
  "--teacher-reviewed",
  "--out-dir",
  join(root, "report")
]);
const reportResult = JSON.parse(reportRun.stdout);
const packet = readJson(reportResult.packetPath);
const report = readJson(packet.validationReportPath);

if (!disabledPackage.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source disabled package fixture should expose upstream planning logic hints.");
}
if (!packet.planningLogicEvidence?.logicExtractionHints?.[0]?.logicExtractionHint.includes("data-to-geometry")) {
  throw new Error("Primary-source disabled package validation report should preserve upstream planning logic hints.");
}
if (packet.planningLogicEvidence?.logicEvidenceReviews?.[0]?.decision !== "logic_evidence_confirmed") {
  throw new Error("Primary-source disabled package validation report should preserve confirmed planning logic evidence reviews.");
}
if (!packet.planningLogicEvidenceHash || packet.planningLogicEvidenceHash !== disabledPackage.planningLogicEvidenceHash) {
  throw new Error("Primary-source disabled package validation report should preserve the upstream planning logic evidence hash.");
}
if (packet.nextReview.planningLogicEvidenceHash !== packet.planningLogicEvidenceHash) {
  throw new Error("Primary-source disabled package validation report should expose the planning logic evidence hash for report review.");
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
  throw new Error("Primary-source disabled package validation report planning logic flow must keep all locks closed.");
}

const tampered = readJson(disabledPackageSmokeResult.packagePath);
tampered.planningLogicEvidence.logicExtractionHints = [];
const tamperedPath = join(root, "tampered-disabled-package-planning-logic.json");
writeJson(tamperedPath, tampered);
const tamperedRun = runKnowledge(
  "create-rag-disabled-package-validation-report.mjs",
  ["--disabled-rule-package", tamperedPath, "--rollback-point", rollbackPoint, "--teacher-reviewed", "--out-dir", join(root, "tampered-report")],
  false
);
if (!`${tamperedRun.stdout}\n${tamperedRun.stderr}`.includes("VALIDATION_REPORT_PLANNING_LOGIC_EVIDENCE_HASH_MISMATCH")) {
  throw new Error("Primary-source disabled package validation report must reject tampered planning logic evidence.");
}

const tamperedNextReview = readJson(disabledPackageSmokeResult.packagePath);
tamperedNextReview.nextReview.planningLogicEvidence.logicExtractionHints = [];
const tamperedNextReviewPath = join(root, "tampered-next-review-disabled-package-planning-logic.json");
writeJson(tamperedNextReviewPath, tamperedNextReview);
const tamperedNextReviewRun = runKnowledge(
  "create-rag-disabled-package-validation-report.mjs",
  [
    "--disabled-rule-package",
    tamperedNextReviewPath,
    "--rollback-point",
    rollbackPoint,
    "--teacher-reviewed",
    "--out-dir",
    join(root, "tampered-next-review-report")
  ],
  false
);
if (
  !`${tamperedNextReviewRun.stdout}\n${tamperedNextReviewRun.stderr}`.includes(
    "VALIDATION_REPORT_NEXT_REVIEW_PLANNING_LOGIC_EVIDENCE_MISMATCH"
  )
) {
  throw new Error("Primary-source disabled package validation report must reject tampered next-review planning logic evidence.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: "transparent_ai_rag_primary_source_disabled_package_validation_report_planning_logic_context_smoke_v1",
      disabledPackagePath: disabledPackageSmokeResult.packagePath,
      packetPath: reportResult.packetPath,
      validationReportPath: packet.validationReportPath,
      preservedPlanningLogicEvidence: true,
      preservedPlanningLogicEvidenceHash: true,
      rejectedTamperedPlanningLogicEvidence: true,
      rejectedTamperedNextReviewPlanningLogicEvidence: true,
      deliveryAllowed: packet.summary.deliveryAllowed,
      locks: packet.locks
    },
    null,
    2
  )
);
